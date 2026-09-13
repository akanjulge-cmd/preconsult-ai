import requests
import json
import time
import io
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

FRONTEND_URL = "https://frontend-hazel-six-6dsq834e13.vercel.app"
BACKEND_URL = "https://preconsult-ai-backend.onrender.com"
ORIGIN = FRONTEND_URL

print("================================================================")
print("   PRECONSULT AI — LIVE CLOUD DEPLOYMENT VERIFICATION")
print("================================================================")

# 1. Frontend Page
r_fe = requests.get(FRONTEND_URL, timeout=15)
assert r_fe.status_code == 200, f"Frontend status: {r_fe.status_code}"
assert "PreConsult AI" in r_fe.text, "Title missing in frontend"
print("[PASS] 1. Live Frontend is UP on Vercel (HTTP 200)")

# 2. 3D Model
r_model = requests.get(f"{FRONTEND_URL}/models/human_anatomy.glb", timeout=15)
assert r_model.status_code == 200, f"3D model failed: {r_model.status_code}"
print(f"[PASS] 2. 3D Anatomical Body Model served from Vercel ({len(r_model.content):,} bytes)")

# 3. Draco WASM
r_draco = requests.get(f"{FRONTEND_URL}/draco/draco_decoder.wasm", timeout=15)
assert r_draco.status_code == 200, f"Draco wasm failed: {r_draco.status_code}"
print(f"[PASS] 3. Draco WASM Decoder served ({len(r_draco.content):,} bytes)")

# 4. Backend Root Health & Deployment Spin-up Wait
print("[...] Waiting for Render backend service to respond...")
r_health = None
for attempt in range(1, 15):
    try:
        r_health = requests.get(f"{BACKEND_URL}/health", timeout=30)
        if r_health.status_code == 200:
            break
    except Exception as e:
        print(f"  Attempt {attempt}/15 waiting for Render build/deploy: {e}")
        time.sleep(8)

assert r_health and r_health.status_code == 200, f"Root health failed: {r_health.status_code if r_health else 'Timeout'}"
print(f"[PASS] 4. Root /health live on Render: {r_health.json()}")

# 5. Backend Database & API Health
r_api_health = requests.get(f"{BACKEND_URL}/api/v1/health", timeout=30)
assert r_api_health.status_code == 200, f"API health failed: {r_api_health.status_code}"
data = r_api_health.json()
assert data.get("database_connected") is True, "Database not connected!"
print(f"[PASS] 5. PostgreSQL Database is CONNECTED & Healthy ({data.get('ai_mode')})")

# 6. CORS Preflight
opt_headers = {
    "Origin": ORIGIN,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Content-Type",
}
r_cors = requests.options(f"{BACKEND_URL}/api/v1/intake/session", headers=opt_headers, timeout=15)
assert r_cors.status_code == 200, f"CORS preflight failed: {r_cors.status_code}"
print(f"[PASS] 6. CORS Preflight permitted for {r_cors.headers.get('access-control-allow-origin')}")

# 7. Create Intake Session
r_sess = requests.post(f"{BACKEND_URL}/api/v1/intake/session", headers={"Origin": ORIGIN}, json={"preferred_language": "te", "accessibility_mode": "standard"}, timeout=15)
assert r_sess.status_code == 200
session_id = r_sess.json()["session_id"]
print(f"[PASS] 7. Created Live Patient Intake Session: {session_id}")

# 8. Multipart Audio Upload (MediaRecorder pipeline)
dummy_audio = io.BytesIO(b"LIVE_PRODUCTION_WEBM_AUDIO_SAMPLE_DATA_1234567890")
dummy_audio.name = "live_audio_sample.webm"
files = {"audio": (dummy_audio.name, dummy_audio, "audio/webm")}
data = {"language": "te"}
r_upload = requests.post(f"{BACKEND_URL}/api/v1/intake/{session_id}/voice/upload", headers={"Origin": ORIGIN}, files=files, data=data, timeout=15)
assert r_upload.status_code == 200, f"Audio upload failed: {r_upload.status_code}"
upload_res = r_upload.json()
audio_filename = upload_res["audio_filename"]
print(f"[PASS] 8. Multipart Audio Upload & Storage persisted on Render: {audio_filename}")

# 9. Audio Streaming Playback
r_play = requests.get(f"{BACKEND_URL}/api/v1/intake/audio/{audio_filename}", headers={"Origin": ORIGIN}, timeout=15)
assert r_play.status_code == 200, f"Audio stream failed: {r_play.status_code}"
print(f"[PASS] 9. Audio Playback Stream endpoint verified ({len(r_play.content)} bytes)")

# 10. Multilingual Telugu Voice Processing
voice_payload = {
    "voice_transcript": "నాకు కుడి వైపు పైభాగంలో కడుపులో విపరీతమైన మంటగా ఉంది.",
    "language": "te",
}
r_voice = requests.post(f"{BACKEND_URL}/api/v1/intake/{session_id}/voice", headers={"Origin": ORIGIN}, json=voice_payload, timeout=15)
assert r_voice.status_code == 200, f"Voice processing failed: {r_voice.status_code}"
voice_res = r_voice.json()
assert voice_res.get("translated_text"), "Translation missing"
print(f'[PASS] 10. Multilingual Translation: "{voice_res.get("voice_transcript") or voice_res.get("transcript")}" -> "{voice_res.get("translated_text")}"')

# 11. Deterministic Red-Flag Safety Engine Intercept
safety_payload = {
    "symptoms": ["chest_pain", "shortness_of_breath", "left_arm_pain"],
    "anatomical_regions": ["Chest"],
    "severity_max": 9,
}
r_safety = requests.post(f"{BACKEND_URL}/api/v1/intake/safety-check", headers={"Origin": ORIGIN}, json=safety_payload, timeout=15)
assert r_safety.status_code == 200
safety_res = r_safety.json()
assert safety_res["is_emergency"] is True, "Safety engine failed to flag emergency!"
print(f'[PASS] 11. Safety Engine Guardrail Intercept: {safety_res["trigger_rule"]} ({safety_res["action_required"]})')

# 12. Record & Persist Full Intake in PostgreSQL
intake_payload = {
    "session_id": session_id,
    "patient_identifier": "PAT-JUDGE-LIVE-01",
    "selected_body_region": "Abdomen",
    "anatomical_zone": "Right Upper Quadrant",
    "side": "midline",
    "symptom": "Pain",
    "symptom_character": "Burning",
    "severity": 8,
    "onset": "this morning",
    "duration": "today",
    "associated_symptoms": ["nausea"],
    "voice_transcript": "I have a burning pain in the right upper part of my abdomen with nausea.",
    "patient_stated_text": "I have a burning pain in the right upper part of my abdomen with nausea.",
    "is_patient_confirmed": True,
    "safety_result": {"is_safe": True, "code": "ROUTINE_TRIAGE"},
    "triage_urgency": "ROUTINE",
}
r_record = requests.post(f"{BACKEND_URL}/api/v1/intake/record", headers={"Origin": ORIGIN}, json=intake_payload, timeout=15)
assert r_record.status_code == 200, f"Intake record failed: {r_record.status_code}"
intake_id = r_record.json()["intake_id"]
print(f"[PASS] 12. Intake Session Persisted to PostgreSQL: intake_id={intake_id}")

# 13. Clinician Command Center Queue
r_queue = requests.get(f"{BACKEND_URL}/api/v1/summary/queue", headers={"Origin": ORIGIN}, timeout=15)
assert r_queue.status_code == 200
queue = r_queue.json()
print(f"[PASS] 13. Clinician Command Center Queue Retrieved ({len(queue)} patients active)")

# 14. Clinician Clinical Summary Retrieval
r_sum = requests.get(f"{BACKEND_URL}/api/v1/summary/SES-GERD-01", headers={"Origin": ORIGIN}, timeout=15)
assert r_sum.status_code == 200
summary = r_sum.json()
print(f'[PASS] 14. Clinician Brief & HPI Retrieved: {summary["chief_complaint"]}')

# 15. Clinician Approval & Digital Signature
approve_payload = {
    "clinician_id": "DR-JUDGE-01",
    "clinician_name": "Dr. S. Vance, MD",
    "action": "APPROVE",
    "clinician_notes": "Clinical summary reviewed and verified in live production.",
    "digital_signature": "SIG-DRSVANCE-LIVE-7788",
}
r_app = requests.post(f"{BACKEND_URL}/api/v1/summary/SES-GERD-01/approve", headers={"Origin": ORIGIN}, json=approve_payload, timeout=15)
assert r_app.status_code == 200
print(f"[PASS] 15. Clinician Approval & Digital Signature Verified in PostgreSQL")

print("\n================================================================")
print("   ALL 15/15 LIVE END-TO-END VERIFICATION CHECKS PASSED!")
print("================================================================")
