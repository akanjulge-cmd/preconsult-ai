import subprocess
import time
import json
import httpx
import asyncio
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

async def test_live_site():
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
        # Find page target
        page_target = next((t for t in targets if t.get("type") == "page"), targets[0])
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"Connecting to page WS: {ws_url}")

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

            target_url = "https://frontend-hazel-six-6dsq834e13.vercel.app/"
            print(f"Navigating to {target_url}...")
            await send_cmd("Page.navigate", {"url": target_url})

            start = time.time()
            page_loaded = False
            while time.time() - start < 12:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(raw)
                    method = data.get("method", "")
                    params = data.get("params", {})

                    if method == "Page.loadEventFired":
                        print(">>> PAGE LOAD EVENT FIRED! <<<")
                        page_loaded = True

                    elif method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        text = details.get("text", "")
                        exception = details.get("exception", {})
                        desc = exception.get("description", str(exception))
                        print("\n!!! RUNTIME EXCEPTION !!!\n", text, desc)

                    elif method == "Runtime.consoleAPICalled":
                        c_type = params.get("type")
                        c_args = [arg.get("value", arg.get("description", str(arg))) for arg in params.get("args", [])]
                        print(f"CONSOLE [{c_type}]:", *c_args)

                    elif method == "Log.entryAdded":
                        entry = params.get("entry", {})
                        print(f"LOG [{entry.get('level')}]:", entry.get("text"))

                    elif method == "Network.responseReceived":
                        resp = params.get("response", {})
                        url = resp.get("url", "")
                        status = resp.get("status")
                        if not url.endswith((".png", ".wasm")):
                            print(f"NETWORK [{status}]: {url}")

                    elif method == "Network.loadingFailed":
                        print("NETWORK FAIL:", params.get("errorText"), params.get("type"), params.get("blockedReason"))

                except asyncio.TimeoutError:
                    if page_loaded:
                        break

            # Now evaluate DOM state
            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const root = document.getElementById('root');
                    return JSON.stringify({
                        documentTitle: document.title,
                        rootHasChildren: root ? root.children.length : 0,
                        rootInnerHTMLSample: root ? root.innerHTML.slice(0, 400) : null,
                        bodyInnerText: document.body.innerText.slice(0, 400),
                        html: document.documentElement.outerHTML.slice(0, 600)
                    });
                })()
                """
            })

            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                if data.get("id") == eval_id:
                    res_val = data.get("result", {}).get("result", {}).get("value", "")
                    print("\n>>> DOM EVALUATION RESULT <<<\n", res_val.encode('ascii', errors='replace').decode('ascii'))
                    break

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    asyncio.run(test_live_site())
