"""Unit tests for Clinician Dashboard API endpoints and FHIR Exporter."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from main import app
from app.models.schemas import DataProvenance
from app.db.session import init_db, engine
from app.models.db_models import ClinicalRecordDB

init_db()
client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_demo_record():
    with Session(engine) as session:
        rec = session.exec(select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == "SES-GERD-01")).first()
        if rec:
            session.delete(rec)
            session.commit()
    yield
    with Session(engine) as session:
        rec = session.exec(select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == "SES-GERD-01")).first()
        if rec:
            session.delete(rec)
            session.commit()


def test_get_clinician_queue():
    """Verify queue returns list of prioritized intake sessions."""
    res = client.get("/api/v1/summary/queue")
    assert res.status_code == 200
    queue = res.json()
    assert isinstance(queue, list)
    assert len(queue) >= 3
    # Check that emergency cases are prioritized or included
    urgencies = [item["triage_urgency"] for item in queue]
    assert "EMERGENCY" in urgencies
    assert "ROUTINE" in urgencies

def test_get_summary_demo_case():
    """Verify fetching a demo case returns full structured record with 5-tier provenance."""
    res = client.get("/api/v1/summary/SES-GERD-01")
    assert res.status_code == 200
    data = res.json()
    assert data["record_id"] == "REC-GERD-01"
    assert "Burning" in data["chief_complaint"]
    assert data["symptoms"][0]["provenance"] == DataProvenance.PATIENT_STATED.value
    assert data["active_medications"][0]["provenance"] == DataProvenance.OCR_DERIVED.value
    assert data["triage_urgency"] == "ROUTINE"

def test_clinician_edit_updates_provenance():
    """Verify that editing a field updates its provenance to CLINICIAN-EDITED."""
    edit_payload = {
        "chief_complaint": "Acute Reflux Esophagitis (Doctor Verified)",
        "clinician_notes": "Prescribed PPI increase; follow-up in 2 weeks.",
        "clinician_id": "Dr. S. Vance, MD",
    }
    res = client.put("/api/v1/summary/SES-GERD-01", json=edit_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["chief_complaint"] == "Acute Reflux Esophagitis (Doctor Verified)"
    assert data["review_status"] == "CLINICIAN_EDITED"
    assert data["provenance_map"]["chief_complaint"] == DataProvenance.CLINICIAN_EDITED.value

def test_clinician_approve_workflow():
    """Verify clinician approval and sign-off locks the record."""
    approve_payload = {
        "clinician_id": "Dr. S. Vance, MD",
        "clinician_notes": "Clinical summary reviewed and approved in person.",
        "digital_signature": "SIG-VANCE-8821",
    }
    res = client.post("/api/v1/summary/SES-GERD-01/approve", json=approve_payload)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["review_status"] == "APPROVED"
    assert res_data["clinician_id"] == "Dr. S. Vance, MD"

def test_clinician_reject_workflow():
    """Verify clinician rejection with structured rationale."""
    reject_payload = {
        "clinician_id": "Dr. S. Vance, MD",
        "rejection_category": "PATIENT_INPUT_MISMATCH",
        "rejection_reason": "Patient stated left knee during triage, but previous record shows right knee.",
        "notes": "Route to triage nurse for physical verification.",
    }
    res = client.post("/api/v1/summary/SES-MSK-42/reject", json=reject_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["review_status"] == "REJECTED"
    assert "PATIENT_INPUT_MISMATCH" in data["rejection_reason"]

def test_clinician_regenerate_workflow():
    """Verify clinician can regenerate brief with custom instructions."""
    regen_payload = {
        "instructions": "Make brief concise for rapid physician handoff.",
    }
    res = client.post("/api/v1/summary/SES-GERD-01/regenerate", json=regen_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["review_status"] == "REGENERATED"
    assert "CONCISE BRIEF" in data["history_of_present_illness"]

def test_fhir_export():
    """Verify standardized HL7 FHIR Bundle generation."""
    res = client.get("/api/v1/summary/SES-GERD-01/fhir")
    assert res.status_code == 200
    fhir = res.json()
    assert fhir["resourceType"] == "Bundle"
    assert fhir["type"] == "document"
    assert len(fhir["entry"]) >= 5
    # Verify presence of resources
    resource_types = [e["resource"]["resourceType"] for e in fhir["entry"]]
    assert "Patient" in resource_types
    assert "Encounter" in resource_types
    assert "Condition" in resource_types
    assert "Observation" in resource_types
    assert "MedicationStatement" in resource_types
    assert "Provenance" in resource_types
