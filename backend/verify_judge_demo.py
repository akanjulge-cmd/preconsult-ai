import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    print("[1] Checking Health & OpenAPI Docs...")
    req = urllib.request.Request(f"{BASE_URL}/openapi.json")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode("utf-8"))
        paths = data.get("paths", {})
        assert "/api/intake/voice/process" in paths, "Missing /api/intake/voice/process"
        assert "/api/intake/record" in paths, "Missing /api/intake/record"
        print("  ✓ Backend is live, Swagger schemas updated.")

def test_voice_processing():
    print("[2] Testing Voice Processing for Hackathon Target Scenario...")
    payload = {
        "session_id": "SES-JUDGE-01",
        "transcript": "I have a burning pain in the right upper part of my abdomen. It started this morning. It's about an eight out of ten and I feel nauseous.",
        "body_region": "right_upper_abdomen",
        "anatomical_zone": "Right Upper Quadrant (RUQ)"
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/intake/voice/process",
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res = json.loads(resp.read().decode("utf-8"))
        extracted = res["extracted_data"]
        print(f"  ✓ Extracted Data: {json.dumps(extracted, indent=2)}")
        assert extracted["character"] == "burning", f"Expected character 'burning', got {extracted['character']}"
        assert extracted["severity"] == 8, f"Expected severity 8, got {extracted['severity']}"
        assert "nausea" in extracted["associated_symptoms"] or "nauseous" in extracted["associated_symptoms"], "Missing nausea"
        assert res["safety_result"]["is_safe"] == True
        print("  ✓ Voice NLP clinical entity extraction PASSED!")
        return extracted

def test_intake_persistence(extracted):
    print("[3] Testing Intake Persistence into SQLite Database...")
    payload = {
        "session_id": "SES-JUDGE-01",
        "patient_identifier": "PAT-JUDGE-01",
        "body_region": extracted["body_region"],
        "anatomical_zone": extracted["anatomical_zone"],
        "symptom": extracted["symptom"],
        "character": extracted["character"],
        "severity": extracted["severity"],
        "onset": extracted["onset"],
        "duration": extracted["duration"],
        "associated_symptoms": extracted["associated_symptoms"],
        "patient_voice_transcript": extracted["patient_text"],
        "patient_text": extracted["patient_text"],
        "structured_clinical_data": extracted,
        "safety_result": {"is_safe": True, "code": "ROUTINE_TRIAGE", "message": "No acute emergent flags detected"},
        "patient_confirmed": True,
        "status": "COMPLETED"
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/intake/record",
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res = json.loads(resp.read().decode("utf-8"))
        intake_id = res["intake_id"]
        print(f"  ✓ Saved intake record with ID: {intake_id}")

    # Fetch it back
    print("[4] Retrieving Persisted Intake Record...")
    req = urllib.request.Request(f"{BASE_URL}/api/intake/record/SES-JUDGE-01")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        saved = json.loads(resp.read().decode("utf-8"))
        assert saved["intake_id"] == intake_id
        assert saved["character"] == "burning"
        assert saved["severity"] == 8
        assert saved["patient_voice_transcript"] == extracted["patient_text"]
        assert saved["patient_confirmed"] == True
        print("  ✓ Intake successfully persisted and retrieved with exact patient voice transcript!")

def test_clinician_summary_integration():
    print("[5] Testing Clinician Summary integration with recorded intake...")
    req = urllib.request.Request(f"{BASE_URL}/api/summary/SES-JUDGE-01")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        summary = json.loads(resp.read().decode("utf-8"))
        assert "recorded_intake" in summary, "Summary missing recorded_intake!"
        ri = summary["recorded_intake"]
        print(f"  ✓ Summary contains recorded intake:")
        print(f"    - Voice Transcript: {ri['patient_voice_transcript']}")
        print(f"    - 3D Region: {ri['body_region']}")
        print(f"    - Severity: {ri['severity']}/10")
        print(f"    - Status: {ri['status']}")
        print("  ✓ Clinician Dashboard integration PASSED!")

def test_scenario_b_red_flag():
    print("[6] Testing Scenario B Red-Flag Cardiac Intercept...")
    payload = {
        "session_id": "SES-JUDGE-CARD-01",
        "transcript": "I have severe crushing chest pain spreading down my left arm and into my jaw. I can barely breathe and I'm sweating cold sweats.",
        "body_region": "left_chest",
        "anatomical_zone": "Left Anterior Precordial Chest"
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/intake/voice/process",
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res = json.loads(resp.read().decode("utf-8"))
        print(f"  ✓ Red Flag Detected: {res['red_flag_detected']}")
        print(f"  ✓ Safety Result: {json.dumps(res['safety_result'])}")
        assert res["red_flag_detected"] is True, "Expected red_flag_detected to be True"
        assert res["safety_result"]["is_active"] is True, "Expected safety_result.is_active to be True"
        assert res["safety_result"]["is_safe"] is False, "Expected safety_result.is_safe to be False"
        assert "CARDIOVASCULAR" in res["safety_result"]["code"]
        assert res["extracted_data"]["character"] == "crushing"
        print("  ✓ Scenario B Red-Flag Cardiac Intercept PASSED!")

if __name__ == "__main__":
    test_health()
    extracted = test_voice_processing()
    test_intake_persistence(extracted)
    test_clinician_summary_integration()
    test_scenario_b_red_flag()
    print("\n=======================================================")
    print(" ALL BACKEND VERIFICATIONS FOR JUDGE DEMO PASSED! ✓")
    print("=======================================================")
