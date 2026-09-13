import subprocess
import time
import json
import httpx
import asyncio
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

async def run_live_e2e():
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

            async def eval_js(expression):
                e_id = await send_cmd("Runtime.evaluate", {"expression": expression, "returnByValue": True})
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("id") == e_id:
                        return data.get("result", {}).get("result", {}).get("value")

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")

            target_url = "https://frontend-hazel-six-6dsq834e13.vercel.app/"
            print(f"[TEST 1] Navigating to {target_url}...")
            await send_cmd("Page.navigate", {"url": target_url})
            await asyncio.sleep(4.0)

            # Step 1: Verify Initial Page Title & Buttons
            res1 = await eval_js("document.body.innerText.includes('Demo Patient')")
            print(f"[TEST 1] Initial Page has Demo Patient button: {res1}")
            assert res1 is True, "Demo Patient button not found"

            # Step 2: Click "Demo Patient"
            print("[TEST 2] Clicking Demo Patient button...")
            click_demo = await eval_js("""
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const demoBtn = btns.find(b => b.innerText.includes('Demo Patient'));
                    if (demoBtn) {
                        demoBtn.click();
                        return true;
                    }
                    return false;
                })()
            """)
            print(f"[TEST 2] Click result: {click_demo}")
            await asyncio.sleep(3.0)

            # Step 3: Verify Logged in as Maria Gonzalez
            user_text = await eval_js("document.body.innerText")
            has_maria = "Maria Gonzalez" in user_text
            print(f"[TEST 3] User 'Maria Gonzalez' logged in: {has_maria}")
            assert has_maria is True, "Maria Gonzalez not found after demo login"

            # Step 4: Verify Patient Portal Tab appears and click it
            has_portal_tab = "Patient Portal" in user_text
            print(f"[TEST 4] Patient Portal Tab exists: {has_portal_tab}")
            assert has_portal_tab is True, "Patient Portal Tab not rendered"

            print("[TEST 5] Navigating to Patient Portal tab...")
            await eval_js("""
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const portalBtn = btns.find(b => b.innerText.includes('Patient Portal'));
                    if (portalBtn) portalBtn.click();
                })()
            """)
            await asyncio.sleep(1.0)
            portal_text = await eval_js("document.body.innerText")
            has_welcome = "Welcome, Maria Gonzalez" in portal_text
            print(f"[TEST 5] Welcome greeting rendered: {has_welcome}")
            assert has_welcome is True, "Welcome greeting not rendered"

            # Step 6: Test Role Guard - Click "3. Clinician Command Center" as patient
            print("[TEST 6] Testing Role Guard (Patient clicking Clinician Command Center)...")
            await eval_js("""
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const docBtn = btns.find(b => b.innerText.includes('Clinician Command Center'));
                    if (docBtn) docBtn.click();
                })()
            """)
            await asyncio.sleep(1.0)
            guard_text = await eval_js("document.body.innerText")
            has_guard = "Clinician Authorization Required" in guard_text
            print(f"[TEST 6] Clinician Authorization Guard Triggered: {has_guard}")
            assert has_guard is True, "Role guard did not intercept patient"

            # Step 7: Click "Switch to Demo Clinician (Dr. Sarah Vance, MD)"
            print("[TEST 7] Switching to Demo Clinician...")
            await eval_js("""
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const switchBtn = btns.find(b => b.innerText.includes('Switch to Demo Clinician'));
                    if (switchBtn) switchBtn.click();
                })()
            """)
            await asyncio.sleep(3.0)
            doc_text = await eval_js("document.body.innerText")
            has_doc = "Dr. Sarah Vance" in doc_text
            print(f"[TEST 7] Switched to Clinician (Dr. Sarah Vance): {has_doc}")
            assert has_doc is True, "Failed to switch to Clinician"

            # Step 8: Test Sign Out
            print("[TEST 8] Testing Sign Out...")
            await eval_js("""
                (() => {
                    // Open profile dropdown
                    const btns = Array.from(document.querySelectorAll('button'));
                    const userBtn = btns.find(b => b.innerText.includes('Dr. Sarah Vance'));
                    if (userBtn) userBtn.click();
                })()
            """)
            await asyncio.sleep(0.5)
            await eval_js("""
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const signOutBtn = btns.find(b => b.innerText.includes('Sign Out'));
                    if (signOutBtn) signOutBtn.click();
                })()
            """)
            await asyncio.sleep(1.0)
            logged_out_text = await eval_js("document.body.innerText")
            has_login_modal = "Sign In to Portal" in logged_out_text or "Patient & Clinical Portal" in logged_out_text
            print(f"[TEST 8] Sign Out successful and redirected to login: {has_login_modal}")
            assert has_login_modal is True, "Sign out did not redirect to login modal"

            print("\n==================================================================")
            print("   >>> ALL 8 LIVE END-TO-END AUTH & ROLE GUARD TESTS PASSED! <<<")
            print("==================================================================")

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    asyncio.run(run_live_e2e())
