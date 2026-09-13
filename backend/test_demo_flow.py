import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def post_json(path, data):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def put_json(path, data):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def get_json(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def test_full_flow():
    print("=== 1. Health Check ===")
    status, health = get_json("/health")
    assert status == 200 and health["status"] == "healthy", f"Health check failed: {health}"
    print(f"[PASS] Backend healthy: status={health['status']}, version={health['version']}, db={health['database_connected']}")

    print("\n=== 2. Create Intake Session ===")
    status, session = post_json("/intake/session", {
        "preferred_language": "en",
        "accessibility_mode": "non_speaking",
        "patient_identifier": "DEMO-PATIENT-001"
    })
    assert status == 200, f"Session create failed: {session}"
    session_id = session["session_id"]
    print(f"[PASS] Session created: {session_id} (Mode: {session['accessibility_mode']})")

    print("\n=== 3. Submit Primary Symptom (Abdomen, Epigastrium, Burning, Severity 7) ===")
    status, symptom_res = post_json("/intake/symptom", {
        "session_id": session_id,
        "body_macro_region": "Abdomen",
        "anatomical_micro_zone": "Epigastrium",
        "character": "Burning",
        "severity": 7,
        "duration": "2-3days",
        "onset": "acute"
    })
    assert status == 200 and symptom_res["status"] == "success"
    print(f"[PASS] Symptom submitted: {symptom_res['message']}")

    print("\n=== 4. Adaptive Clarification Engine (SOCRATES) ===")
    adaptive_state = {
        "session_id": session_id,
        "body_macro_region": "Abdomen",
        "anatomical_micro_zone": "Epigastrium",
        "locations": [
            {
                "body_region": "Abdomen",
                "macro_region": "Abdomen",
                "micro_zone": "Epigastrium",
                "qualifier": "Midline",
                "sensation": "Burning"
            }
        ],
        "character": "Burning",
        "severity": 7,
        "duration": "2-3days",
        "associated_symptoms": ["Nausea"],
        "completed_answers": []
    }
    
    status, turn1 = post_json("/intake/adaptive/next", adaptive_state)
    assert status == 200
    next_q1 = turn1.get("next_question")
    assert next_q1 is not None, f"Expected next_question but got None: {turn1}"
    print(f"[PASS] Adaptive Turn 1: question_id='{next_q1['question_id']}', prompt='{next_q1['prompt_text']}'")
    print(f"  Options: {[opt['label'] for opt in next_q1['options']]}")
    
    # Simulate selecting option 0
    selected_opt = next_q1["options"][0]
    adaptive_state["completed_answers"].append({
        "question_id": next_q1["question_id"],
        "target_field": next_q1["target_field"],
        "selected_option_id": selected_opt["id"],
        "selected_text": selected_opt["label"]
    })
    
    status, turn2 = post_json("/intake/adaptive/next", adaptive_state)
    assert status == 200
    next_q2 = turn2.get("next_question")
    assert next_q2 is not None, f"Expected next_question in turn 2 but got None: {turn2}"
    print(f"[PASS] Adaptive Turn 2: question_id='{next_q2['question_id']}', prompt='{next_q2['prompt_text']}'")
    print(f"  Options: {[opt['label'] for opt in next_q2['options']]}")
    
    selected_opt2 = next_q2["options"][0]
    adaptive_state["completed_answers"].append({
        "question_id": next_q2["question_id"],
        "target_field": next_q2["target_field"],
        "selected_option_id": selected_opt2["id"],
        "selected_text": selected_opt2["label"]
    })

    print("\n=== 5. Finalize Intake & Safety Engine Check ===")
    status, record = post_json("/intake/adaptive/finalize", adaptive_state)
    assert status == 200
    record_id = record["record_id"]
    print(f"[PASS] Clinical Record Synthesized: {record_id}")
    print(f"  Patient: {record.get('patient_name')} ({record['patient_id']})")
    print(f"  Chief Complaint: {record['chief_complaint']}")
    print(f"  Triage Urgency: {record['triage_urgency']}")
    print(f"  Red Flag Active: {record['red_flag']['is_active']}")

    print("\n=== 6. Clinician Dashboard: View Queue ===")
    status, queue = get_json("/summary/queue")
    assert status == 200
    print(f"[PASS] Clinician Queue count: {len(queue)} patients waiting")

    print("\n=== 7. Clinician Dashboard: Fetch 60-Second Brief ===")
    # Can fetch either by session_id or record_id
    status, doc_record = get_json(f"/summary/{session_id}")
    assert status == 200
    print(f"[PASS] Doctor retrieved 60s brief for session: {session_id}")
    print(f"  HPI Narrative: {doc_record['history_of_present_illness']}")
    print(f"  Symptoms count: {len(doc_record['symptoms'])}")

    print("\n=== 8. Clinician Dashboard: Edit Record (Severity 7 -> 6, Add Notes) ===")
    status, edited_record = put_json(f"/summary/{session_id}", {
        "record_id": doc_record["record_id"],
        "clinician_id": "DR-CHEN-992",
        "notes": "Spicy food exacerbation noted. Started trial of famotidine.",
        "severity": 6
    })
    assert status == 200
    print("[PASS] Record successfully edited by clinician:")
    print(f"  Updated Severity: {edited_record['symptoms'][0]['severity']}")
    print(f"  Provenance: {edited_record['symptoms'][0]['provenance']}")
    assert edited_record['symptoms'][0]['severity'] == 6
    assert edited_record['symptoms'][0]['provenance'] == "CLINICIAN-EDITED"

    print("\n=== 9. Clinician Dashboard: Approve & Sign Brief ===")
    status, approved_res = post_json(f"/summary/{session_id}/approve", {
        "clinician_id": "DR-CHEN-992",
        "clinician_signature": "Dr. Sarah Chen, MD",
        "clinical_notes": "Reviewed and cleared for outpatient GI consultation."
    })
    assert status == 200
    print("[PASS] Record successfully approved by clinician:")
    print(f"  Status: {approved_res.get('review_status') or approved_res.get('verification_status')}")
    print(f"  Message: {approved_res.get('message')}")

    print("\n=======================================================")
    print(">>> FULL DEMO FLOW VERIFIED SUCCESSFULLY END-TO-END! <<<")
    print("=======================================================")

if __name__ == "__main__":
    try:
        test_full_flow()
    except Exception as e:
        print(f"\n❌ FAILED WITH ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
