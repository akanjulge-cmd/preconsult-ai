"""Document & Prescription OCR Ingestion Routes for PreConsult AI.

Implements the reliable OCR extraction and clinical ingestion pipeline:
image/PDF -> OCR -> structured fields -> confidence -> human verification -> clinical summary

Strict Clinical Safety Guardrails:
1. Low-confidence extractions (< 80%) strictly require human verification before entering the clinical summary.
2. Conflicting medication records (duplicate therapeutic classes or contradictory dosages)
   are never silently resolved; they must be explicitly resolved or prominently flagged.
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.db_models import ClinicalRecordDB, AuditLogDB, IntakeSessionDB
from app.models.schemas import (
    DocumentOcrResponse,
    DocumentVerificationRequest,
    DocumentUploadRequest,
    ClinicalPreConsultRecord,
    MedicationItem,
    LabResultItem,
    DataProvenance,
    TriageUrgency,
)
from app.core.ocr_engine import DocumentOcrEngine, CONFIDENCE_VERIFICATION_THRESHOLD
from app.api.routes.summary import DEMO_CASES

router = APIRouter(prefix="/documents", tags=["Document OCR Ingestion"])


@router.get("/samples", response_model=List[Dict[str, Any]])
def get_sample_documents():
    """Returns curated hackathon sample documents for instant testing.
    
    Includes:
    1. Dr. Evans Handwritten Rx: Low-confidence smudged dose (62%) requiring verification.
    2. Conflict Detection Rx: Duplicate PPIs and contradictory dosages requiring explicit resolution.
    3. Diagnostic Lab Panel: Hemoglobin 10.8 (LOW) and Glucose 146 (HIGH) with reference ranges.
    """
    return DocumentOcrEngine.get_sample_presets()


@router.post("/upload", response_model=DocumentOcrResponse)
def ingest_document_json(
    request: DocumentUploadRequest,
    session: Session = Depends(get_session),
):
    """Ingests a document or preset via JSON payload.
    
    Extracts structured medications and lab items with optical confidence metrics,
    checks for duplicate therapeutic classes or conflicting dosages, and gates low-confidence items.
    """
    response = DocumentOcrEngine.ingest_document(
        filename=request.filename or "prescription_document.png",
        text_content=request.text_content,
        preset_id=request.preset_id,
        session_id=request.session_id,
    )
    return response


@router.post("/upload-file", response_model=DocumentOcrResponse)
async def ingest_document_file(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    """Ingests an uploaded image or PDF document and performs optical character extraction."""
    file_bytes = await file.read()
    response = DocumentOcrEngine.ingest_document(
        filename=file.filename,
        file_bytes=file_bytes,
        session_id=session_id,
    )
    return response


@router.post("/verify")
def verify_and_merge_document(
    req: DocumentVerificationRequest,
    session: Session = Depends(get_session),
):
    """Verifies extracted OCR fields and safely merges them into the clinical pre-consult record.
    
    Safety Rules Enforced:
    1. Low-confidence extractions (< 80%) MUST be verified by a human before merging.
    2. Conflicting medication records are NEVER silently resolved or dropped.
    """
    # -------------------------------------------------------------
    # 1. VERIFY LOW-CONFIDENCE GATING
    # -------------------------------------------------------------
    for med in req.verified_medications:
        if med.confidence < CONFIDENCE_VERIFICATION_THRESHOLD and not med.is_verified:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Clinical Safety Violation: Medication '{med.name}' has low optical confidence "
                    f"({med.confidence * 100:.0f}%) and requires human verification before entering the clinical summary."
                ),
            )

    for lab in req.verified_labs:
        if lab.confidence < CONFIDENCE_VERIFICATION_THRESHOLD and not lab.is_verified:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Clinical Safety Violation: Lab test '{lab.test_name}' has low optical confidence "
                    f"({lab.confidence * 100:.0f}%) and requires human verification before entering the clinical summary."
                ),
            )

    # -------------------------------------------------------------
    # 2. CONFLICT CHECK: NEVER SILENTLY RESOLVE
    # -------------------------------------------------------------
    # If any medication has an unresolved conflict and has not been verified/acknowledged
    unresolved_conflicts = [
        m for m in req.verified_medications
        if m.has_conflict and not m.is_verified
    ]
    if unresolved_conflicts:
        conflict_names = ", ".join(m.name for m in unresolved_conflicts)
        raise HTTPException(
            status_code=422,
            detail=(
                f"Clinical Safety Violation: Unresolved medication conflict detected for [{conflict_names}]. "
                "System safety rules strictly prohibit silent resolution of conflicting medication records. "
                "The reviewer must explicitly confirm or reconcile these records."
            ),
        )

    # -------------------------------------------------------------
    # 3. FETCH OR INITIALIZE CLINICAL RECORD FOR SESSION
    # -------------------------------------------------------------
    session_id = req.session_id
    record_db = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
    ).first()

    current_data: Dict[str, Any] = {}
    if record_db:
        current_data = json.loads(record_db.json_payload)
    elif session_id in DEMO_CASES:
        current_data = dict(DEMO_CASES[session_id])
    else:
        # Fallback to base session template
        current_data = dict(DEMO_CASES["SES-GERD-01"])
        current_data["record_id"] = f"REC-{session_id}"

    # -------------------------------------------------------------
    # 4. MERGE VERIFIED MEDICATIONS
    # -------------------------------------------------------------
    existing_meds = current_data.get("active_medications", [])
    # Track existing medication names (case-insensitive) to prevent duplicate identical entries
    existing_names = {m.get("name", "").lower(): i for i, m in enumerate(existing_meds)}

    new_meds_list = list(existing_meds)
    for v_med in req.verified_medications:
        med_item = MedicationItem(
            name=v_med.name,
            dosage=v_med.dosage,
            frequency=v_med.frequency,
            source=f"Prescription OCR ({v_med.prescriber or 'Rx Document'})",
            confidence=v_med.confidence,
            verification_status="Verified (OCR + Human)" if v_med.is_verified else "OCR-Derived",
            provenance=DataProvenance.OCR_DERIVED,
        )
        med_item_dict = med_item.model_dump()
        norm_name = v_med.name.lower()

        # If identical medication already exists, update it rather than silently duplicating
        if norm_name in existing_names:
            idx = existing_names[norm_name]
            new_meds_list[idx] = med_item_dict
        else:
            new_meds_list.append(med_item_dict)
            existing_names[norm_name] = len(new_meds_list) - 1

    current_data["active_medications"] = new_meds_list

    # -------------------------------------------------------------
    # 5. MERGE VERIFIED LABS
    # -------------------------------------------------------------
    existing_labs = current_data.get("abnormal_labs", [])
    existing_lab_names = {l.get("test_name", "").lower(): i for i, l in enumerate(existing_labs)}

    new_labs_list = list(existing_labs)
    for v_lab in req.verified_labs:
        lab_item = LabResultItem(
            test_name=v_lab.test_name,
            value=v_lab.value,
            unit=v_lab.unit,
            reference_range=v_lab.reference_range,
            is_abnormal=v_lab.is_abnormal,
            confidence=v_lab.confidence,
            provenance=DataProvenance.OCR_DERIVED,
        )
        lab_item_dict = lab_item.model_dump()
        norm_lab = v_lab.test_name.lower()

        if norm_lab in existing_lab_names:
            idx = existing_lab_names[norm_lab]
            new_labs_list[idx] = lab_item_dict
        else:
            new_labs_list.append(lab_item_dict)
            existing_lab_names[norm_lab] = len(new_labs_list) - 1

    current_data["abnormal_labs"] = new_labs_list

    # -------------------------------------------------------------
    # 6. UPDATE PROVENANCE & CLINICAL METADATA
    # -------------------------------------------------------------
    provenance_map = current_data.get("provenance_map", {}) or {}
    provenance_map["active_medications"] = DataProvenance.OCR_DERIVED.value
    provenance_map["abnormal_labs"] = DataProvenance.OCR_DERIVED.value
    current_data["provenance_map"] = provenance_map

    # Check for any conflict notes to preserve for the clinician
    conflict_notes = []
    for m in req.verified_medications:
        if m.has_conflict and m.conflict_reason:
            conflict_notes.append(m.conflict_reason)
    if conflict_notes:
        unres = current_data.get("unresolved_questions", []) or []
        for cn in conflict_notes:
            if cn not in unres:
                unres.append(f"MEDICATION RECONCILIATION: {cn}")
        current_data["unresolved_questions"] = unres

    # -------------------------------------------------------------
    # 7. COMMIT TO DATABASE & IN-MEMORY DEMO
    # -------------------------------------------------------------
    json_str = json.dumps(current_data)
    if record_db:
        record_db.json_payload = json_str
        record_db.updated_at = datetime.utcnow()
        session.add(record_db)
    else:
        new_rec = ClinicalRecordDB(
            id=current_data.get("record_id", f"REC-{session_id}"),
            session_id=session_id,
            patient_id=current_data.get("patient_id", "PAT-001"),
            chief_complaint=current_data.get("chief_complaint", "Clinical Pre-Consult Review"),
            hpi_narrative=current_data.get("history_of_present_illness", ""),
            triage_urgency=current_data.get("triage_urgency", "ROUTINE"),
            review_status=current_data.get("review_status", "DRAFT"),
            json_payload=json_str,
        )
        session.add(new_rec)

    # Add audit log for tracking provenance and verification accountability
    audit = AuditLogDB(
        session_id=session_id,
        event_type="DOCUMENT_OCR_VERIFICATION",
        action=f"Human reviewer ({req.reviewer_role}) verified optical ingestion for {req.document_id}",
        details=(
            f"Merged {len(req.verified_medications)} medications and {len(req.verified_labs)} labs. "
            f"Notes: {req.reviewer_notes or 'None'}"
        ),
    )
    session.add(audit)
    session.commit()

    if session_id in DEMO_CASES:
        DEMO_CASES[session_id] = current_data

    return {
        "success": True,
        "message": "Document extractions successfully verified and merged into clinical summary.",
        "document_id": req.document_id,
        "session_id": session_id,
        "medications_added": len(req.verified_medications),
        "labs_added": len(req.verified_labs),
        "updated_record": current_data,
    }
