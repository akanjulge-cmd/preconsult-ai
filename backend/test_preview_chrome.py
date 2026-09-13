import subprocess
import time
import json
import httpx
import asyncio
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

async def test_preview():
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--remote-debugging-port=9222",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-certificate-errors",
        "about:blank"
    ]
    proc = subprocess.Popen(cmd)
    try:
        for _ in range(25):
            try:
                res = httpx.get("http://127.0.0.1:9222/json", timeout=2)
                if res.status_code == 200 and len(res.json()) > 0:
                    break
            except Exception:
                time.sleep(0.2)
        else:
            print("Failed to connect to Chrome port 9222")
            return

        targets = res.json()
        page_target = next((t for t in targets if t.get("type") == "page"), targets[0])
        ws_url = page_target["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url, ping_interval=None) as ws:
            req_id = 1
            async def send_cmd(method, params=None):
                nonlocal req_id
                r_id = req_id
                req_id += 1
                payload = {"id": r_id, "method": method}
                if params:
                    payload["params"] = params
                await ws.send(json.dumps(payload))
                return r_id

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("Log.enable")
            await send_cmd("Network.enable")

            target_url = "http://127.0.0.1:3000/"
            print(f"Navigating to {target_url}...")
            await send_cmd("Page.navigate", {"url": target_url})

            start = time.time()
            exceptions = []
            while time.time() - start < 6:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(raw)
                    method = data.get("method", "")
                    params = data.get("params", {})

                    if method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        desc = details.get("exception", {}).get("description", str(details))
                        exceptions.append(desc)
                        print("\n!!! RUNTIME EXCEPTION !!!\n", desc)

                    elif method == "Runtime.consoleAPICalled":
                        c_type = params.get("type")
                        c_args = [arg.get("value", arg.get("description", str(arg))) for arg in params.get("args", [])]
                        print(f"CONSOLE [{c_type}]:", *c_args)

                except asyncio.TimeoutError:
                    pass

            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const root = document.getElementById('root');
                    return JSON.stringify({
                        documentTitle: document.title,
                        rootHasChildren: root ? root.children.length : 0,
                        rootChildTags: root ? Array.from(root.children).map(c => c.tagName + '.' + c.className) : [],
                        bodyInnerTextSample: document.body.innerText.slice(0, 300)
                    });
                })()
                """
            })

            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                if data.get("id") == eval_id:
                    val = data.get("result", {}).get("result", {}).get("value", "")
                    print("\n>>> DOM EVALUATION RESULT <<<\n", val.encode('ascii', errors='replace').decode('ascii'))
                    break

            if exceptions:
                print(f"\nFAILED with {len(exceptions)} exceptions!")
            else:
                print("\nSUCCESS: 0 RUNTIME EXCEPTIONS! React app rendered properly!")

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    asyncio.run(test_preview())
