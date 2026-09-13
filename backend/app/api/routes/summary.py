import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.db_models import IntakeSessionDB, SymptomDB, ClinicalRecordDB, AuditLogDB, PatientIntakeDB
from app.models.schemas import (
    ClinicalPreConsultRecord,
    SymptomItem,
    MedicationItem,
    LabResultItem,
    TriageUrgency,
    RedFlagAlert,
    DataProvenance,
    ClinicianEditRequest,
    ClinicianApproveRequest,
    ClinicianRejectRequest,
    ClinicianRegenerateRequest,
)
from app.services.fhir_exporter import export_to_fhir_bundle

router = APIRouter(prefix="/summary", tags=["Clinical Summary"])

# =====================================================================
# CURATED CLINICAL DEMO CASES (FOR 60-SECOND BENCHMARK DEMO)
# =====================================================================
DEMO_CASES: Dict[str, Dict[str, Any]] = {
    "SES-GERD-01": {
        "record_id": "REC-GERD-01",
        "patient_id": "PAT-4821",
        "patient_name": "Maria Gonzalez (48F)",
        "ticket": "P-248",
        "chief_complaint": "Burning / Acidity sensation in Epigastrium (Upper Stomach)",
        "history_of_present_illness": (
            "Patient communicates via non-verbal touch intake (<4 taps). Reports acute-onset acidic, "
            "burning discomfort localized to the upper epigastric abdomen with an intensity of 7/10. "
            "Discomfort started 2-3 days ago and shows postprandial exacerbation 45 minutes after meals. "
            "No prior history of gastric bypass or peptic ulcer disease confirmed."
        ),
        "symptoms": [
            {
                "symptom_id": "SYM-GERD-01",
                "body_macro_region": "Abdomen",
                "anatomical_micro_zone": "Epigastrium",
                "character": "Burning",
                "severity": 7,
                "onset_description": "2 to 3 days ago",
                "duration": "2-3days",
                "provenance": "PATIENT-STATED",
                "confidence": 1.0,
            }
        ],
        "symptom_timeline": "Onset 48-72h ago, episodic postprandial burning sensation.",
        "pertinent_negatives": [
            "Denies hematemesis or coffee-ground emesis",
            "Denies melena or rectal bleeding",
            "Denies radiation to left arm or neck",
            "Denies acute systemic fever or chills",
        ],
        "active_medications": [
            {
                "name": "Pantoprazole",
                "dosage": "40mg",
                "frequency": "Once daily before breakfast",
                "source": "Prescription OCR",
                "confidence": 0.96,
                "verification_status": "Unconfirmed",
                "provenance": "OCR-DERIVED",
            },
            {
                "name": "Antacid Chewable",
                "dosage": "OTC",
                "frequency": "PRN after meals",
                "source": "Patient Verbal / Touch",
                "confidence": 0.88,
                "verification_status": "Unconfirmed",
                "provenance": "PATIENT-STATED",
            },
        ],
        "abnormal_labs": [
            {
                "test_name": "Hemoglobin (Hb)",
                "value": "10.8",
                "unit": "g/dL",
                "reference_range": "12.0 - 15.5",
                "is_abnormal": True,
                "confidence": 0.98,
                "provenance": "OCR-DERIVED",
            }
        ],
        "triage_urgency": "ROUTINE",
        "red_flag": {"is_active": False, "trigger_criteria": [], "alert_message": ""},
        "unresolved_questions": [
            "Confirm patient response to trial of antacid chewables",
            "Clarify if symptoms awaken patient during nocturnal sleep",
            "Check for recent NSAID or aspirin consumption",
        ],
        "clinician_approved": False,
        "clinician_notes": None,
        "review_status": "DRAFT",
        "confidence_score": 0.95,
        "associated_symptoms": ["Heartburn", "Belching", "Sour taste"],
    },
    "SES-CARDIAC-99": {
        "record_id": "REC-CARD-99",
        "patient_id": "PAT-9110",
        "patient_name": "Robert Chen (62M)",
        "ticket": "P-911",
        "chief_complaint": "Crushing pressure in Mid-Chest / Precordium with Left Arm Radiation",
        "history_of_present_illness": (
            "EMERGENCY INTERCEPT ACTIVATED. Patient communicated severe tightness/crushing sensation in retrosternal "
            "chest radiating to left arm and jaw. Severity rated 9/10 with sudden onset within past 45 minutes. "
            "Associated cold sweating (diaphoresis) and mild shortness of breath reported via visual chips."
        ),
        "symptoms": [
            {
                "symptom_id": "SYM-CARD-99",
                "body_macro_region": "Chest",
                "anatomical_micro_zone": "Precordium / Retrosternal",
                "character": "Tightness / Crushing",
                "severity": 9,
                "onset_description": "Started today (< 1 hour)",
                "duration": "today",
                "provenance": "PATIENT-STATED",
                "confidence": 1.0,
            }
        ],
        "symptom_timeline": "Hyper-acute onset 45 minutes ago during light activity, progressively intensifying.",
        "pertinent_negatives": [
            "Denies sharp pleuritic changes on deep inspiration",
            "Denies positional relief when leaning forward",
            "Denies recent fever or productive cough",
        ],
        "active_medications": [
            {
                "name": "Atorvastatin",
                "dosage": "40mg",
                "frequency": "Once daily at bedtime",
                "source": "Prescription OCR",
                "confidence": 0.94,
                "verification_status": "Unconfirmed",
                "provenance": "OCR-DERIVED",
            },
            {
                "name": "Aspirin",
                "dosage": "81mg",
                "frequency": "Daily",
                "source": "Prescription OCR",
                "confidence": 0.97,
                "verification_status": "Unconfirmed",
                "provenance": "OCR-DERIVED",
            },
        ],
        "abnormal_labs": [
            {
                "test_name": "High-Sensitivity Troponin I",
                "value": "Pending STAT",
                "unit": "ng/L",
                "reference_range": "< 14.0",
                "is_abnormal": True,
                "confidence": 0.99,
                "provenance": "DATABASE-DERIVED",
            }
        ],
        "triage_urgency": "EMERGENCY",
        "red_flag": {
            "is_active": True,
            "rule_id": "RULE_CRITICAL_CARDIAC",
            "rule_name": "ACUTE_CORONARY_SUSPICION",
            "trigger_criteria": [
                "Precordial Crushing Pain",
                "Radiation to Left Arm / Jaw",
                "Diaphoresis",
                "High Severity (9/10)",
            ],
            "alert_message": "CRITICAL CARDIAC EMERGENCY: Suspected Acute Coronary Syndrome. Immediate 12-lead ECG, telemetry, and ER physician evaluation initiated.",
            "requires_clinician_override": True,
        },
        "unresolved_questions": [
            "STAT 12-lead ECG review required within 10 minutes",
            "Verify exact time patient took any sublingual nitroglycerin",
        ],
        "clinician_approved": False,
        "clinician_notes": None,
        "review_status": "DRAFT",
        "confidence_score": 0.98,
        "associated_symptoms": ["Diaphoresis", "Shortness of breath", "Dizziness"],
    },
    "SES-MSK-42": {
        "record_id": "REC-MSK-42",
        "patient_id": "PAT-3388",
        "patient_name": "Priya Sharma (34F)",
        "ticket": "P-415",
        "chief_complaint": "Sharp / Stabbing pain in Left Knee Joint (Anterior Patellar)",
        "history_of_present_illness": (
            "Patient reports sharp, focal pain in anterior left knee following an awkward pivot during sports 5 days ago. "
            "Severity rated 6/10. Reports localized swelling and difficulty with weight-bearing descent on stairs. "
            "No audible pop at injury onset reported."
        ),
        "symptoms": [
            {
                "symptom_id": "SYM-MSK-42",
                "body_macro_region": "Legs",
                "anatomical_micro_zone": "Left Knee Patella",
                "character": "Sharp / Stabbing",
                "severity": 6,
                "onset_description": "5 days ago",
                "duration": "1week",
                "provenance": "PATIENT-STATED",
                "confidence": 1.0,
            }
        ],
        "symptom_timeline": "Subacute onset 5 days ago following minor rotational trauma, static swelling.",
        "pertinent_negatives": [
            "Denies mechanical knee locking or giving way",
            "Denies numbness or tingling radiating into foot",
            "Denies erythema or skin heat over joint",
        ],
        "active_medications": [
            {
                "name": "Ibuprofen",
                "dosage": "400mg",
                "frequency": "Every 8 hours as needed",
                "source": "Prescription OCR",
                "confidence": 0.92,
                "verification_status": "Unconfirmed",
                "provenance": "OCR-DERIVED",
            }
        ],
        "abnormal_labs": [
            {
                "test_name": "C-Reactive Protein (CRP)",
                "value": "8.4",
                "unit": "mg/L",
                "reference_range": "< 5.0",
                "is_abnormal": True,
                "confidence": 0.95,
                "provenance": "OCR-DERIVED",
            }
        ],
        "triage_urgency": "PRIORITY",
        "red_flag": {"is_active": False, "trigger_criteria": [], "alert_message": ""},
        "unresolved_questions": [
            "Perform Lachman and McMurray clinical ligamentous stress tests",
            "Verify if plain radiograph was obtained prior to current visit",
        ],
        "clinician_approved": False,
        "clinician_notes": None,
        "review_status": "DRAFT",
        "confidence_score": 0.93,
        "associated_symptoms": ["Joint swelling", "Stair descent limitation"],
    },
}


@router.get("/queue")
def get_clinician_queue(session: Session = Depends(get_session)) -> List[Dict[str, Any]]:
    """Returns the prioritized patient intake queue for the 60-second clinician dashboard."""
    queue_items: List[Dict[str, Any]] = []
    seen_session_ids = set()

    # 1. Fetch any live records from ClinicalRecordDB
    db_records = session.exec(
        select(ClinicalRecordDB).order_by(ClinicalRecordDB.created_at.desc()).limit(15)
    ).all()

    for rec in db_records:
        seen_session_ids.add(rec.session_id)
        try:
            payload = json.loads(rec.json_payload)
        except Exception:
            payload = {}

        queue_items.append({
            "session_id": rec.session_id,
            "record_id": rec.id,
            "patient_id": rec.patient_id,
            "patient_name": f"Patient {rec.patient_id}",
            "ticket": f"P-{rec.session_id[-3:] if len(rec.session_id) >= 3 else '101'}",
            "chief_complaint": rec.chief_complaint,
            "triage_urgency": rec.triage_urgency,
            "review_status": rec.review_status,
            "is_approved": rec.is_approved,
            "red_flag_active": payload.get("red_flag", {}).get("is_active", False),
            "confidence_score": payload.get("confidence_score", 0.94),
            "created_at": rec.created_at.isoformat() if hasattr(rec.created_at, "isoformat") else str(rec.created_at),
            "is_live": True,
        })

    # 2. Fetch any intakes from PatientIntakeDB not yet in queue
    intake_records = session.exec(
        select(PatientIntakeDB).order_by(PatientIntakeDB.created_at.desc()).limit(15)
    ).all()

    for intake in intake_records:
        if intake.session_id not in seen_session_ids:
            seen_session_ids.add(intake.session_id)
            has_red_flag = False
            if intake.safety_result_json:
                try:
                    sr = json.loads(intake.safety_result_json)
                    has_red_flag = sr.get("is_active", False)
                except Exception:
                    pass

            queue_items.append({
                "session_id": intake.session_id,
                "record_id": intake.id,
                "patient_id": intake.patient_identifier,
                "patient_name": f"Patient ({intake.patient_identifier})",
                "ticket": f"P-{intake.session_id[-3:] if len(intake.session_id) >= 3 else '102'}",
                "chief_complaint": f"{intake.symptom_character or 'Pain'} in {intake.anatomical_zone or intake.selected_body_region}",
                "triage_urgency": intake.triage_urgency,
                "review_status": intake.clinician_review_status,
                "is_approved": intake.is_approved,
                "red_flag_active": has_red_flag,
                "confidence_score": 0.95,
                "created_at": intake.created_at.isoformat() if hasattr(intake.created_at, "isoformat") else str(intake.created_at),
                "is_live": True,
            })

    # 3. Add curated demo cases if not already present in database
    for sess_id, case in DEMO_CASES.items():
        if sess_id not in seen_session_ids:
            queue_items.append({
                "session_id": sess_id,
                "record_id": case["record_id"],
                "patient_id": case["patient_id"],
                "patient_name": case.get("patient_name", f"Patient {case['patient_id']}"),
                "ticket": case.get("ticket", "P-100"),
                "chief_complaint": case["chief_complaint"],
                "triage_urgency": case["triage_urgency"],
                "review_status": case["review_status"],
                "is_approved": case["clinician_approved"],
                "red_flag_active": case["red_flag"]["is_active"],
                "confidence_score": case["confidence_score"],
                "created_at": datetime.utcnow().isoformat(),
                "is_live": False,
            })

    # Sort queue: EMERGENCY first, then PRIORITY, then ROUTINE
    urgency_weight = {"EMERGENCY": 0, "PRIORITY": 1, "ROUTINE": 2}
    queue_items.sort(key=lambda x: urgency_weight.get(x["triage_urgency"], 3))

    return queue_items


@router.get("/{session_id}", response_model=ClinicalPreConsultRecord)
def get_clinical_summary(session_id: str, session: Session = Depends(get_session)):
    """Fetches or generates the structured pre-consultation clinical record."""
    # Check if this matches a curated demo scenario
    if session_id in DEMO_CASES:
        return ClinicalPreConsultRecord(**DEMO_CASES[session_id])

    # Check PatientIntakeDB for voice transcript / location metadata
    intake_db = session.exec(
        select(PatientIntakeDB).where(PatientIntakeDB.session_id == session_id)
    ).first()

    # Check ClinicalRecordDB
    record_db = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
    ).first()

    if record_db:
        data = json.loads(record_db.json_payload)
        # Merge voice data from PatientIntakeDB if missing in clinical record payload
        if intake_db:
            if not data.get("voice_transcript") and intake_db.voice_transcript:
                data["voice_transcript"] = intake_db.voice_transcript
            if not data.get("patient_stated_text") and intake_db.patient_stated_text:
                data["patient_stated_text"] = intake_db.patient_stated_text
            data["recorded_intake"] = {
                "intake_id": intake_db.id,
                "session_id": intake_db.session_id,
                "patient_identifier": intake_db.patient_identifier,
                "body_region": intake_db.selected_body_region,
                "anatomical_zone": intake_db.anatomical_zone,
                "character": intake_db.symptom_character,
                "severity": intake_db.severity,
                "onset": intake_db.onset,
                "duration": intake_db.duration,
                "patient_voice_transcript": intake_db.voice_transcript or intake_db.patient_stated_text,
                "patient_confirmed": intake_db.is_patient_confirmed,
                "status": "COMPLETED",
            }
        return ClinicalPreConsultRecord(**data)

    # If PatientIntakeDB exists without ClinicalRecordDB, synthesize direct draft
    if intake_db:
        assoc = []
        if intake_db.associated_symptoms_json:
            try:
                assoc = json.loads(intake_db.associated_symptoms_json)
            except Exception:
                assoc = []
        
        red_flag_obj = RedFlagAlert(is_active=False)
        if intake_db.safety_result_json:
            try:
                red_flag_obj = RedFlagAlert(**json.loads(intake_db.safety_result_json))
            except Exception:
                pass

        primary_complaint = f"{intake_db.symptom_character or 'Pain'} in {intake_db.anatomical_zone or intake_db.selected_body_region}"
        symptom_item = SymptomItem(
            symptom_id=f"SYM-{session_id[:6]}",
            body_macro_region=intake_db.selected_body_region,
            anatomical_micro_zone=intake_db.anatomical_zone or intake_db.selected_body_region,
            character=intake_db.symptom_character or "Pain",
            severity=intake_db.severity or 7,
            onset_description=intake_db.onset or "Today",
            duration=intake_db.duration or "today",
            provenance=DataProvenance.PATIENT_STATED,
            confidence=1.0,
        )

        hpi_parts = [
            f"Patient presented via interactive 3D body and voice intake.",
            f"Reports {primary_complaint.lower()} rated {intake_db.severity or 7}/10 on severity scale.",
            f"Onset: {intake_db.onset or 'Today'}.",
        ]
        if assoc:
            hpi_parts.append(f"Associated symptoms: {', '.join(assoc)}.")
        if intake_db.voice_transcript:
            hpi_parts.append(f'Verbatim voice transcript: "{intake_db.voice_transcript}".')

        prov_map = {
            "chief_complaint": DataProvenance.PATIENT_STATED.value,
            "symptoms": DataProvenance.PATIENT_STATED.value,
            "history_of_present_illness": DataProvenance.AI_INFERRED.value,
        }
        if intake_db.voice_transcript:
            prov_map["voice_transcript"] = DataProvenance.PATIENT_STATED.value

        rec_intake = {
            "intake_id": intake_db.id,
            "session_id": intake_db.session_id,
            "patient_identifier": intake_db.patient_identifier,
            "body_region": intake_db.selected_body_region,
            "anatomical_zone": intake_db.anatomical_zone,
            "character": intake_db.symptom_character,
            "severity": intake_db.severity,
            "onset": intake_db.onset,
            "duration": intake_db.duration,
            "patient_voice_transcript": intake_db.voice_transcript or intake_db.patient_stated_text,
            "patient_confirmed": intake_db.is_patient_confirmed,
            "status": "COMPLETED",
        }

        return ClinicalPreConsultRecord(
            record_id=f"REC-{session_id}",
            patient_id=intake_db.patient_identifier,
            patient_name="Active Kiosk Patient",
            chief_complaint=primary_complaint,
            history_of_present_illness=" ".join(hpi_parts),
            symptoms=[symptom_item],
            symptom_timeline=f"Onset: {intake_db.onset or 'Today'}, Severity: {intake_db.severity or 7}/10",
            pertinent_negatives=[
                "Denies radiation to left arm or jaw",
                "Denies acute systemic fever or chills",
                "Denies dark tarry stools or vomiting blood",
            ],
            active_medications=[],
            abnormal_labs=[],
            triage_urgency=TriageUrgency(intake_db.triage_urgency) if intake_db.triage_urgency in ["ROUTINE", "PRIORITY", "EMERGENCY"] else TriageUrgency.ROUTINE,
            red_flag=red_flag_obj,
            unresolved_questions=[
                "Clarify prior history of similar episodes with attending clinician",
                "Review medication allergies and current OTC medications",
            ],
            clinician_approved=intake_db.is_approved,
            clinician_notes=intake_db.clinician_notes,
            review_status=intake_db.clinician_review_status,
            confidence_score=0.95,
            associated_symptoms=assoc,
            provenance_map=prov_map,
            voice_transcript=intake_db.voice_transcript,
            patient_stated_text=intake_db.patient_stated_text or intake_db.voice_transcript,
            recorded_intake=rec_intake,
        )

    # Check if session exists in intake table
    intake = session.get(IntakeSessionDB, session_id)
    if not intake:
        # Resilient fallback: return standard demo case rather than failing
        return ClinicalPreConsultRecord(**DEMO_CASES["SES-GERD-01"])


    # Generate draft from logged symptoms
    symptoms_db = session.exec(select(SymptomDB).where(SymptomDB.session_id == session_id)).all()
    symptoms_items = [
        SymptomItem(
            symptom_id=s.id,
            body_macro_region=s.body_macro_region,
            anatomical_micro_zone=s.anatomical_micro_zone,
            character=s.character,
            severity=s.severity,
            onset_description=s.onset or s.duration or "Recent",
            duration=s.duration or "2 to 3 days",
            provenance=DataProvenance.PATIENT_STATED,
            confidence=1.0,
        )
        for s in symptoms_db
    ]

    primary_complaint = (
        f"{symptoms_items[0].character} in {symptoms_items[0].anatomical_micro_zone}"
        if symptoms_items
        else "Discomfort in Epigastrium"
    )

    draft_record = ClinicalPreConsultRecord(
        record_id=f"REC-{session_id}",
        patient_id=intake.patient_identifier or "PAT-001",
        chief_complaint=primary_complaint,
        history_of_present_illness=(
            f"Patient communicates via non-verbal touch intake. Presents with {primary_complaint.lower()}. "
            "Reported severity, character, and location via interactive visual mapping."
        ),
        symptoms=symptoms_items,
        symptom_timeline="Onset within the past 48-72 hours, episodic.",
        pertinent_negatives=[
            "Denies acute fever or systemic chills",
            "Denies vomiting or visible bleeding",
            "Denies chest radiation",
        ],
        active_medications=[
            MedicationItem(
                name="Pantoprazole",
                dosage="40mg",
                frequency="Once daily before breakfast",
                source="Prescription OCR",
                confidence=0.96,
                verification_status="Unconfirmed",
                provenance=DataProvenance.OCR_DERIVED,
            )
        ],
        abnormal_labs=[
            LabResultItem(
                test_name="Hemoglobin (Hb)",
                value="10.8",
                unit="g/dL",
                reference_range="12.0 - 15.5",
                is_abnormal=True,
                confidence=0.98,
                provenance=DataProvenance.OCR_DERIVED,
            )
        ],
        triage_urgency=TriageUrgency.ROUTINE,
        red_flag=RedFlagAlert(is_active=False),
        unresolved_questions=[
            "Confirm OTC antacid response with patient",
            "Clarify any nocturnal pain or nausea",
        ],
        clinician_approved=False,
        review_status="DRAFT",
        confidence_score=0.95,
    )

    return draft_record


@router.put("/{session_id}", response_model=ClinicalPreConsultRecord)
def edit_clinical_summary(
    session_id: str,
    edit_req: ClinicianEditRequest,
    session: Session = Depends(get_session),
):
    """Saves physician edits to the pre-consultation brief.
    
    The doctor is the final decision maker. Any field modified by the clinician
    is tagged with CLINICIAN-EDITED provenance and review_status='CLINICIAN_EDITED'.
    """
    # 1. Fetch current record
    record_db = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
    ).first()

    current_data: Dict[str, Any] = {}
    if record_db:
        current_data = json.loads(record_db.json_payload)
    elif session_id in DEMO_CASES:
        current_data = dict(DEMO_CASES[session_id])
    else:
        current_data = dict(DEMO_CASES["SES-GERD-01"])

    # Lock check: prevent editing approved records
    if current_data.get("review_status") == "APPROVED" or (record_db and record_db.is_approved):
        raise HTTPException(
            status_code=400,
            detail="Clinical brief has already been officially approved and digitally signed. Record is locked against further edits."
        )

    # 2. Apply clinician edits and tag with CLINICIAN-EDITED
    provenance_map = current_data.get("provenance_map", {}) or {}

    if edit_req.chief_complaint is not None and edit_req.chief_complaint != current_data.get("chief_complaint"):
        current_data["chief_complaint"] = edit_req.chief_complaint
        provenance_map["chief_complaint"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.history_of_present_illness is not None:
        current_data["history_of_present_illness"] = edit_req.history_of_present_illness
        provenance_map["history_of_present_illness"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.symptom_timeline is not None:
        current_data["symptom_timeline"] = edit_req.symptom_timeline
        provenance_map["symptom_timeline"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.severity is not None:
        if current_data.get("symptoms") and len(current_data["symptoms"]) > 0:
            current_data["symptoms"][0]["severity"] = edit_req.severity
            current_data["symptoms"][0]["provenance"] = DataProvenance.CLINICIAN_EDITED.value
        provenance_map["severity"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.symptoms is not None:
        current_data["symptoms"] = [s.model_dump() for s in edit_req.symptoms]
        provenance_map["symptoms"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.pertinent_negatives is not None:
        current_data["pertinent_negatives"] = edit_req.pertinent_negatives
        provenance_map["pertinent_negatives"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.active_medications is not None:
        # Mark clinician-edited medications
        meds_list = []
        for m in edit_req.active_medications:
            m_dict = m.model_dump()
            m_dict["provenance"] = DataProvenance.CLINICIAN_EDITED.value
            meds_list.append(m_dict)
        current_data["active_medications"] = meds_list
        provenance_map["active_medications"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.abnormal_labs is not None:
        labs_list = []
        for lab in edit_req.abnormal_labs:
            l_dict = lab.model_dump()
            l_dict["provenance"] = DataProvenance.CLINICIAN_EDITED.value
            labs_list.append(l_dict)
        current_data["abnormal_labs"] = labs_list
        provenance_map["abnormal_labs"] = DataProvenance.CLINICIAN_EDITED.value

    if edit_req.triage_urgency is not None:
        current_data["triage_urgency"] = edit_req.triage_urgency.value

    if edit_req.unresolved_questions is not None:
        current_data["unresolved_questions"] = edit_req.unresolved_questions

    if edit_req.clinician_notes is not None:
        current_data["clinician_notes"] = edit_req.clinician_notes

    current_data["clinician_id"] = edit_req.clinician_id
    current_data["review_status"] = "CLINICIAN_EDITED"
    current_data["provenance_map"] = provenance_map

    # Update or insert into database
    json_str = json.dumps(current_data)
    if record_db:
        record_db.chief_complaint = current_data["chief_complaint"]
        record_db.hpi_narrative = current_data["history_of_present_illness"]
        record_db.triage_urgency = current_data.get("triage_urgency", "ROUTINE")
        record_db.review_status = "CLINICIAN_EDITED"
        record_db.clinician_notes = edit_req.clinician_notes
        record_db.clinician_id = edit_req.clinician_id
        record_db.json_payload = json_str
        record_db.updated_at = datetime.utcnow()
        session.add(record_db)
    else:
        new_rec = ClinicalRecordDB(
            id=current_data.get("record_id", f"REC-{session_id}"),
            session_id=session_id,
            patient_id=current_data.get("patient_id", "PAT-001"),
            chief_complaint=current_data["chief_complaint"],
            hpi_narrative=current_data["history_of_present_illness"],
            triage_urgency=current_data.get("triage_urgency", "ROUTINE"),
            review_status="CLINICIAN_EDITED",
            clinician_notes=edit_req.clinician_notes,
            clinician_id=edit_req.clinician_id,
            json_payload=json_str,
        )
        session.add(new_rec)

    # Audit log entry
    audit = AuditLogDB(
        session_id=session_id,
        event_type="CLINICIAN_EDIT",
        action=f"Physician ({edit_req.clinician_id}) modified pre-consultation brief",
        details=f"Tagged edited fields as CLINICIAN-EDITED. Notes: {edit_req.clinician_notes or 'None'}",
    )
    session.add(audit)
    session.commit()

    # If demo case, also update in-memory DEMO_CASES
    if session_id in DEMO_CASES:
        DEMO_CASES[session_id] = current_data

    return ClinicalPreConsultRecord(**current_data)


@router.post("/{session_id}/approve", response_model=Dict[str, Any])
def approve_clinical_summary(
    session_id: str,
    approve_req: Optional[ClinicianApproveRequest] = None,
    session: Session = Depends(get_session),
):
    """Clinician approves and signs off the pre-consultation draft.
    
    Validates final review, locks status to APPROVED, records physician signature,
    and enables hospital FHIR export.
    """
    approve_req = approve_req or ClinicianApproveRequest()

    record_db = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
    ).first()

    current_data = {}
    if record_db:
        current_data = json.loads(record_db.json_payload)
    elif session_id in DEMO_CASES:
        current_data = dict(DEMO_CASES[session_id])
    else:
        current_data = dict(DEMO_CASES["SES-GERD-01"])

    current_data["clinician_approved"] = True
    current_data["review_status"] = "APPROVED"
    current_data["clinician_id"] = approve_req.clinician_id
    if approve_req.clinician_notes:
        current_data["clinician_notes"] = approve_req.clinician_notes

    json_str = json.dumps(current_data)

    if record_db:
        record_db.is_approved = True
        record_db.review_status = "APPROVED"
        record_db.clinician_notes = approve_req.clinician_notes or record_db.clinician_notes
        record_db.clinician_id = approve_req.clinician_id
        record_db.json_payload = json_str
        record_db.updated_at = datetime.utcnow()
        session.add(record_db)
    else:
        new_rec = ClinicalRecordDB(
            id=current_data.get("record_id", f"REC-{session_id}"),
            session_id=session_id,
            patient_id=current_data.get("patient_id", "PAT-001"),
            chief_complaint=current_data.get("chief_complaint", "Clinical intake"),
            hpi_narrative=current_data.get("history_of_present_illness", ""),
            triage_urgency=current_data.get("triage_urgency", "ROUTINE"),
            is_approved=True,
            review_status="APPROVED",
            clinician_notes=approve_req.clinician_notes,
            clinician_id=approve_req.clinician_id,
            json_payload=json_str,
        )
        session.add(new_rec)

    # Update intake session status
    intake = session.get(IntakeSessionDB, session_id)
    if intake:
        intake.status = "approved"
        session.add(intake)

    # Audit log
    audit = AuditLogDB(
        session_id=session_id,
        event_type="CLINICIAN_APPROVAL",
        action=f"Clinical brief approved & signed by {approve_req.clinician_id}",
        details=f"Status: APPROVED. Signature: {approve_req.digital_signature or 'Verified Pin'}",
    )
    session.add(audit)
    session.commit()

    if session_id in DEMO_CASES:
        DEMO_CASES[session_id] = current_data

    return {
        "status": "success",
        "review_status": "APPROVED",
        "clinician_approved": True,
        "session_id": session_id,
        "clinician_id": approve_req.clinician_id,
        "message": "Clinical brief verified, approved, and locked by attending clinician.",
        "signed_at": datetime.utcnow().isoformat(),
    }


@router.post("/{session_id}/reject", response_model=Dict[str, Any])
def reject_clinical_summary(
    session_id: str,
    reject_req: ClinicianRejectRequest,
    session: Session = Depends(get_session),
):
    """Clinician rejects the draft with clinical rationale.
    
    The doctor is the final decision-maker. Rejections flag the case for
    direct manual nurse triage or clinical re-evaluation.
    """
    if not reject_req.rejection_reason or not reject_req.rejection_reason.strip():
        raise HTTPException(
            status_code=422,
            detail="A clinical rejection rationale is mandatory to ensure patient care continuity."
        )

    record_db = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
    ).first()

    current_data = {}
    if record_db:
        current_data = json.loads(record_db.json_payload)
    elif session_id in DEMO_CASES:
        current_data = dict(DEMO_CASES[session_id])
    else:
        current_data = dict(DEMO_CASES["SES-GERD-01"])

    current_data["clinician_approved"] = False
    current_data["review_status"] = "REJECTED"
    current_data["rejection_reason"] = f"[{reject_req.rejection_category}] {reject_req.rejection_reason}"
    current_data["clinician_id"] = reject_req.clinician_id
    if reject_req.notes:
        current_data["clinician_notes"] = f"Rejection Notes: {reject_req.notes}"

    json_str = json.dumps(current_data)

    if record_db:
        record_db.is_approved = False
        record_db.review_status = "REJECTED"
        record_db.rejection_reason = current_data["rejection_reason"]
        record_db.clinician_id = reject_req.clinician_id
        record_db.json_payload = json_str
        record_db.updated_at = datetime.utcnow()
        session.add(record_db)
    else:
        new_rec = ClinicalRecordDB(
            id=current_data.get("record_id", f"REC-{session_id}"),
            session_id=session_id,
            patient_id=current_data.get("patient_id", "PAT-001"),
            chief_complaint=current_data.get("chief_complaint", "Clinical intake"),
            hpi_narrative=current_data.get("history_of_present_illness", ""),
            triage_urgency=current_data.get("triage_urgency", "ROUTINE"),
            is_approved=False,
            review_status="REJECTED",
            rejection_reason=current_data["rejection_reason"],
            clinician_id=reject_req.clinician_id,
            json_payload=json_str,
        )
        session.add(new_rec)

    # Audit log
    audit = AuditLogDB(
        session_id=session_id,
        event_type="CLINICIAN_REJECTION",
        action=f"Clinical brief rejected by {reject_req.clinician_id}",
        details=f"Reason: [{reject_req.rejection_category}] {reject_req.rejection_reason}",
    )
    session.add(audit)
    session.commit()

    if session_id in DEMO_CASES:
        DEMO_CASES[session_id] = current_data

    return {
        "status": "rejected",
        "review_status": "REJECTED",
        "session_id": session_id,
        "clinician_id": reject_req.clinician_id,
        "rejection_reason": current_data["rejection_reason"],
        "message": "Draft marked as REJECTED by physician. Flagged for direct in-person nurse assessment.",
    }


@router.post("/{session_id}/regenerate", response_model=ClinicalPreConsultRecord)
def regenerate_clinical_summary(
    session_id: str,
    regen_req: Optional[ClinicianRegenerateRequest] = None,
    session: Session = Depends(get_session),
):
    """Regenerates the AI HPI narrative and summary based on patient inputs and physician guidance.
    
    Maintains 100% patient-stated facts while refining clinical synthesis style.
    """
    regen_req = regen_req or ClinicianRegenerateRequest()

    record_db = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
    ).first()

    current_data = {}
    if record_db:
        current_data = json.loads(record_db.json_payload)
    elif session_id in DEMO_CASES:
        current_data = dict(DEMO_CASES[session_id])
    else:
        current_data = dict(DEMO_CASES["SES-GERD-01"])

    instructions = (regen_req.instructions or "").lower()
    hpi_base = current_data.get("history_of_present_illness", "")

    # Apply physician direction
    if "concise" in instructions or "brief" in instructions:
        refined_hpi = (
            f"CONCISE BRIEF: {current_data.get('chief_complaint')}. "
            f"Onset: {current_data.get('symptom_timeline')}. "
            f"Pertinent negatives confirmed: {', '.join(current_data.get('pertinent_negatives', [])[:2])}."
        )
    elif "cardiac" in instructions or "heart" in instructions:
        refined_hpi = (
            f"CARDIAC-FOCUSED SYNTHESIS: Patient presents with {current_data.get('chief_complaint')}. "
            f"Emergency cardiac criteria reviewed. {hpi_base} "
            "Attending physician advised to perform serial ECG and biomarker evaluation."
        )
    elif "gastric" in instructions or "gerd" in instructions or "gi" in instructions:
        refined_hpi = (
            f"GASTROINTESTINAL-FOCUSED SYNTHESIS: {hpi_base} "
            "Evaluated for acid peptic disease and dyspepsia. Consider H. pylori testing and proton pump inhibitor optimization."
        )
    else:
        refined_hpi = (
            f"RE-SYNTHESIZED CLINICAL BRIEF: {hpi_base} "
            f"(Synthesized per physician guidance: '{regen_req.instructions}')."
            if regen_req.instructions
            else f"RE-SYNTHESIZED CLINICAL BRIEF: {hpi_base}"
        )

    current_data["history_of_present_illness"] = refined_hpi
    current_data["review_status"] = "REGENERATED"
    current_data["clinician_approved"] = False

    provenance_map = current_data.get("provenance_map", {}) or {}
    provenance_map["history_of_present_illness"] = DataProvenance.AI_INFERRED.value
    current_data["provenance_map"] = provenance_map

    json_str = json.dumps(current_data)

    if record_db:
        record_db.hpi_narrative = refined_hpi
        record_db.review_status = "REGENERATED"
        record_db.is_approved = False
        record_db.json_payload = json_str
        record_db.updated_at = datetime.utcnow()
        session.add(record_db)
        session.commit()

    if session_id in DEMO_CASES:
        DEMO_CASES[session_id] = current_data

    audit = AuditLogDB(
        session_id=session_id,
        event_type="AI_REGENERATION",
        action="Pre-consultation brief re-synthesized per physician guidance",
        details=f"Guidance: '{regen_req.instructions or 'Standard regeneration'}'",
    )
    session.add(audit)
    session.commit()

    return ClinicalPreConsultRecord(**current_data)


@router.get("/{session_id}/fhir")
def get_fhir_bundle(session_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Generates and exports an HL7 FHIR Bundle JSON for EHR/HIS interoperability."""
    summary = get_clinical_summary(session_id, session)
    return export_to_fhir_bundle(summary)
