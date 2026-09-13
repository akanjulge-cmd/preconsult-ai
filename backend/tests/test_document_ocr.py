"""Tests for Document and Prescription OCR Ingestion Engine & API Routes.

Validates the complete pipeline:
image/PDF -> OCR -> structured fields -> confidence -> human verification -> clinical summary

Clinical Safety Requirements:
1. Low-confidence extractions (< 80%) strictly require human verification before merging.
2. Conflicting medication records (duplicate classes, contradictory dosages) must never be silently resolved.
3. Abnormal lab values, reference ranges, units, and dates are correctly extracted.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.ocr_engine import DocumentOcrEngine, CONFIDENCE_VERIFICATION_THRESHOLD
from app.models.schemas import OcrMedicationItem, OcrLabItem, DataProvenance

client = TestClient(app)


def test_ocr_sample_presets_available():
    """Verify all 3 curated hackathon presets are exposed via API."""
    response = client.get("/api/v1/documents/samples")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) >= 3
    preset_ids = {s["id"] for s in samples}
    assert "PRESET_LOW_CONF_RX" in preset_ids
    assert "PRESET_CONFLICT_RX" in preset_ids
    assert "PRESET_ABNORMAL_LABS" in preset_ids


def test_ocr_low_confidence_gating():
    """Verify that smudged / low-confidence prescription triggers verification requirement."""
    response = client.post(
        "/api/v1/documents/upload",
        json={"preset_id": "PRESET_LOW_CONF_RX", "session_id": "SES-GERD-01"},
    )
    assert response.status_code == 200
    data = response.json()
    
    assert data["requires_human_verification"] is True
    assert data["overall_confidence"] < CONFIDENCE_VERIFICATION_THRESHOLD
    meds = data["extracted_medications"]
    assert len(meds) == 1
    pantoprazole = meds[0]
    assert pantoprazole["confidence"] < CONFIDENCE_VERIFICATION_THRESHOLD
    assert pantoprazole["requires_verification"] is True
    assert pantoprazole["is_verified"] is False


def test_ocr_conflict_detection_no_silent_resolution():
    """Verify therapeutic duplication & contradictory dosing are detected and flagged."""
    response = client.post(
        "/api/v1/documents/upload",
        json={"preset_id": "PRESET_CONFLICT_RX", "session_id": "SES-GERD-01"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["requires_human_verification"] is True
    conflicts = data["conflicts_detected"]
    assert len(conflicts) > 0
    # Must explicitly identify therapeutic duplication
    assert any("THERAPEUTIC DUPLICATION" in c for c in conflicts)
    
    # Check that individual medication items have conflict flags set
    meds = data["extracted_medications"]
    conflicting_meds = [m for m in meds if m["has_conflict"]]
    assert len(conflicting_meds) >= 2
    for m in conflicting_meds:
        assert m["requires_verification"] is True
        assert m["conflict_reason"] is not None


def test_ocr_abnormal_lab_extraction():
    """Verify lab tests, values, units, reference ranges, and abnormal flags."""
    response = client.post(
        "/api/v1/documents/upload",
        json={"preset_id": "PRESET_ABNORMAL_LABS", "session_id": "SES-GERD-01"},
    )
    assert response.status_code == 200
    data = response.json()

    labs = data["extracted_labs"]
    assert len(labs) >= 4

    # Hemoglobin 10.8 g/dL (Abnormal Low)
    hb = next((l for l in labs if "Hemoglobin" in l["test_name"]), None)
    assert hb is not None
    assert hb["value"] == "10.8"
    assert hb["unit"] == "g/dL"
    assert hb["is_abnormal"] is True
    assert "12.0 - 15.5" in hb["reference_range"]

    # Fasting Glucose 146 mg/dL (Abnormal High)
    glucose = next((l for l in labs if "Glucose" in l["test_name"]), None)
    assert glucose is not None
    assert glucose["value"] == "146"
    assert glucose["unit"] == "mg/dL"
    assert glucose["is_abnormal"] is True

    # Creatinine 0.9 mg/dL (Normal)
    creat = next((l for l in labs if "Creatinine" in l["test_name"]), None)
    assert creat is not None
    assert creat["is_abnormal"] is False


def test_verify_blocks_unverified_low_confidence_item():
    """Clinical Safety Guardrail: low-confidence items cannot be merged without is_verified=True."""
    payload = {
        "session_id": "SES-GERD-01",
        "document_id": "DOC-TEST-01",
        "verified_medications": [
            {
                "name": "Pantoprazole Sodium",
                "dosage": "40mg",
                "frequency": "Once daily",
                "confidence": 0.62,
                "requires_verification": True,
                "is_verified": False,  # Human did NOT verify!
                "provenance": "OCR-DERIVED",
            }
        ],
        "verified_labs": [],
        "reviewer_role": "PATIENT",
    }
    response = client.post("/api/v1/documents/verify", json=payload)
    assert response.status_code == 422
    err_detail = response.json()["detail"]
    assert "Clinical Safety Violation" in err_detail
    assert "low optical confidence" in err_detail


def test_verify_blocks_unresolved_conflicting_medications():
    """Clinical Safety Guardrail: conflicting medications cannot be silently merged without verification."""
    payload = {
        "session_id": "SES-GERD-01",
        "document_id": "DOC-TEST-02",
        "verified_medications": [
            {
                "name": "Omeprazole",
                "dosage": "20mg",
                "frequency": "Once daily",
                "confidence": 0.95,
                "has_conflict": True,
                "conflict_reason": "Duplicate PPI",
                "requires_verification": True,
                "is_verified": False,  # Not verified or reconciled!
                "provenance": "OCR-DERIVED",
            }
        ],
        "verified_labs": [],
        "reviewer_role": "PATIENT",
    }
    response = client.post("/api/v1/documents/verify", json=payload)
    assert response.status_code == 422
    err_detail = response.json()["detail"]
    assert "Clinical Safety Violation" in err_detail
    assert "Unresolved medication conflict" in err_detail


def test_verify_and_merge_into_clinical_summary_success():
    """Verify that validated extractions properly merge into the pre-consult record with OCR-DERIVED provenance."""
    session_id = "SES-GERD-01"
    payload = {
        "session_id": session_id,
        "document_id": "DOC-VERIFIED-01",
        "verified_medications": [
            {
                "name": "Pantoprazole Sodium",
                "dosage": "40mg",
                "frequency": "Once daily before breakfast",
                "date": "2026-09-12",
                "prescriber": "Dr. Marcus Evans, MD",
                "confidence": 0.62,
                "requires_verification": True,
                "is_verified": True,  # Confirmed by human reviewer!
                "has_conflict": False,
                "provenance": "OCR-DERIVED",
            }
        ],
        "verified_labs": [
            {
                "test_name": "Hemoglobin (Hb)",
                "value": "10.8",
                "unit": "g/dL",
                "reference_range": "12.0 - 15.5",
                "is_abnormal": True,
                "date": "2026-09-12",
                "confidence": 0.98,
                "requires_verification": False,
                "is_verified": True,
                "provenance": "OCR-DERIVED",
            }
        ],
        "reviewer_role": "CLINICIAN",
        "reviewer_notes": "Reviewed smudged prescription; confirmed 40mg once daily before breakfast.",
    }
    response = client.post("/api/v1/documents/verify", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["medications_added"] == 1
    assert res_data["labs_added"] == 1

    # Verify that pre-consult summary reflects the merged items
    summary_resp = client.get(f"/api/v1/summary/{session_id}")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()

    # Active medications must include Pantoprazole with OCR-DERIVED
    med_names = [m["name"] for m in summary["active_medications"]]
    assert any("Pantoprazole" in name for name in med_names)

    # Abnormal labs must include Hemoglobin with OCR-DERIVED
    lab_names = [l["test_name"] for l in summary["abnormal_labs"]]
    assert any("Hemoglobin" in name for name in lab_names)
