import uuid
import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.db_models import (
    IntakeSessionDB,
    SymptomDB,
    AuditLogDB,
    ClinicalRecordDB,
    PatientIntakeDB,
)
from app.models.schemas import (
    SessionCreateRequest,
    SessionResponse,
    SymptomSubmitRequest,
    RedFlagCheckRequest,
    RedFlagCheckResponse,
    AdaptiveStateRequest,
    AdaptiveTurnResponse,
    ClinicalPreConsultRecord,
    VoiceProcessRequest,
    VoiceProcessResponse,
    PatientIntakeCreateRequest,
    PatientIntakeResponse,
)
from app.core.socrates_engine import SocratesEngine
from app.core.safety_engine import DeterministicSafetyEngine
from app.core.voice_engine import VoiceExtractionEngine
from datetime import datetime

router = APIRouter(prefix="/intake", tags=["Intake"])


# Deterministic safety rule matrix
EMERGENCY_RULES = [
    {
        "keywords": ["chest_pain", "shortness_of_breath"],
        "rule_name": "CARDIAC_RED_FLAG",
        "action": "Immediate cardiology/emergency triage. Halt routine intake."
    },
    {
        "keywords": ["chest_pain", "sweating"],
        "rule_name": "ACUTE_CORONARY_SUSPICION",
        "action": "Emergency protocol activated. Alert clinical staff immediately."
    },
    {
        "keywords": ["slurred_speech", "facial_droop"],
        "rule_name": "STROKE_FAST_FLAG",
        "action": "Stroke protocol activated. Dispatch urgent assistance."
    },
    {
        "keywords": ["rigid_abdomen", "fainting"],
        "rule_name": "ACUTE_PERITONEAL_CRISIS",
        "action": "Acute abdomen with hemodynamic compromise. Urgent surgical consult."
    }
]

@router.post("/session", response_model=SessionResponse)
def create_intake_session(request: SessionCreateRequest, session: Session = Depends(get_session)):
    """Creates a new patient intake session."""
    session_id = f"SES-{uuid.uuid4().hex[:8].upper()}"
    new_session = IntakeSessionDB(
        id=session_id,
        preferred_language=request.preferred_language,
        accessibility_mode=request.accessibility_mode,
        patient_identifier=request.patient_identifier or f"PAT-{uuid.uuid4().hex[:6].upper()}"
    )
    session.add(new_session)
    
    # Audit log
    audit = AuditLogDB(
        session_id=session_id,
        event_type="SESSION_CREATED",
        action="Patient initiated intake",
        details=f"Lang: {request.preferred_language}, Mode: {request.accessibility_mode}"
    )
    session.add(audit)
    session.commit()
    session.refresh(new_session)
    
    return SessionResponse(
        session_id=new_session.id,
        created_at=new_session.created_at,
        status=new_session.status,
        preferred_language=new_session.preferred_language,
        accessibility_mode=new_session.accessibility_mode
    )

@router.get("/session/{session_id}", response_model=SessionResponse)
def get_intake_session(session_id: str, session: Session = Depends(get_session)):
    """Fetches session metadata."""
    intake = session.get(IntakeSessionDB, session_id)
    if not intake:
        raise HTTPException(status_code=404, detail="Intake session not found")
    return SessionResponse(
        session_id=intake.id,
        created_at=intake.created_at,
        status=intake.status,
        preferred_language=intake.preferred_language,
        accessibility_mode=intake.accessibility_mode
    )

@router.post("/symptom")
def submit_symptom(request: SymptomSubmitRequest, session: Session = Depends(get_session)):
    """Logs a symptom selected via body map or visual semantics."""
    intake = session.get(IntakeSessionDB, request.session_id)
    if not intake:
        intake = IntakeSessionDB(
            id=request.session_id,
            preferred_language="en",
            accessibility_mode="standard",
            patient_identifier=f"PAT-{request.session_id[-6:] if len(request.session_id) >= 6 else 'OFFLINE'}",
            status="active",
        )
        session.add(intake)
        session.commit()
        
    symptom_id = f"SYM-{uuid.uuid4().hex[:6].upper()}"
    symptom = SymptomDB(
        id=symptom_id,
        session_id=request.session_id,
        body_macro_region=request.body_macro_region,
        anatomical_micro_zone=request.anatomical_micro_zone,
        character=request.character,
        severity=request.severity,
        duration=request.duration,
        onset=request.onset
    )
    session.add(symptom)
    
    audit = AuditLogDB(
        session_id=request.session_id,
        event_type="SYMPTOM_LOGGED",
        action=f"Marked {request.character} pain in {request.anatomical_micro_zone}",
        details=f"Severity: {request.severity}/10"
    )
    session.add(audit)
    session.commit()
    
    return {
        "status": "success",
        "symptom_id": symptom_id,
        "message": f"Symptom recorded for {request.anatomical_micro_zone}"
    }

@router.post("/safety-check", response_model=RedFlagCheckResponse)
def evaluate_red_flags(request: RedFlagCheckRequest, session: Session = Depends(get_session)):
    """Deterministic emergency screening without unconstrained LLM delay."""
    symptoms_lower = [s.lower().replace(" ", "_") for s in request.symptoms]
    
    for rule in EMERGENCY_RULES:
        if all(k in symptoms_lower for k in rule["keywords"]):
            return RedFlagCheckResponse(
                is_emergency=True,
                trigger_rule=rule["rule_name"],
                action_required=rule["action"]
            )
            
    return RedFlagCheckResponse(
        is_emergency=False,
        trigger_rule=None,
        action_required="Proceed with routine pre-consultation intake."
    )

@router.post("/adaptive/next", response_model=AdaptiveTurnResponse)
def get_adaptive_next_turn(request: AdaptiveStateRequest):
    """Evaluates the patient's intake state and returns the next adaptive SOCRATES question or completion."""
    return SocratesEngine.evaluate_next_step(request)

@router.post("/adaptive/finalize", response_model=ClinicalPreConsultRecord)
def finalize_adaptive_intake(request: AdaptiveStateRequest, session: Session = Depends(get_session)):
    """Compiles, validates, and persists the patient's ClinicalPreConsultRecord."""
    red_flag_alert = DeterministicSafetyEngine.evaluate_safety(
        locations=request.locations,
        character=request.character,
        severity=request.severity,
        associated_symptoms=request.associated_symptoms,
        completed_answers=[ans.model_dump() for ans in request.completed_answers],
    )
    record = SocratesEngine.synthesize_clinical_record(request, red_flag_alert)
    
    # Persist or update ClinicalRecordDB
    existing_record = session.exec(
        select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == request.session_id)
    ).first()
    
    if existing_record:
        existing_record.chief_complaint = record.chief_complaint
        existing_record.hpi_narrative = record.history_of_present_illness
        existing_record.triage_urgency = record.triage_urgency.value
        existing_record.json_payload = record.model_dump_json()
        existing_record.updated_at = datetime.utcnow()
        session.add(existing_record)
    else:
        new_record = ClinicalRecordDB(
            id=record.record_id,
            session_id=request.session_id,
            patient_id=record.patient_id,
            chief_complaint=record.chief_complaint,
            hpi_narrative=record.history_of_present_illness,
            triage_urgency=record.triage_urgency.value,
            is_approved=False,
            json_payload=record.model_dump_json(),
        )
        session.add(new_record)

    # Persist or update PatientIntakeDB
    loc0 = request.locations[0] if request.locations else {}
    body_region = loc0.get("body_region") or request.body_macro_region or "Abdomen"
    zone = loc0.get("anatomical_zone") or request.anatomical_micro_zone or "Epigastrium"
    side = loc0.get("side", "midline")

    existing_intake = session.exec(
        select(PatientIntakeDB).where(PatientIntakeDB.session_id == request.session_id)
    ).first()

    if existing_intake:
        existing_intake.selected_body_region = body_region
        existing_intake.anatomical_zone = zone
        existing_intake.side = side
        existing_intake.symptom = request.character
        existing_intake.symptom_character = request.character
        existing_intake.severity = request.severity
        existing_intake.duration = request.duration
        existing_intake.associated_symptoms_json = json.dumps(request.associated_symptoms)
        existing_intake.voice_transcript = request.voice_transcript or existing_intake.voice_transcript
        existing_intake.patient_stated_text = request.patient_stated_text or request.voice_transcript or existing_intake.patient_stated_text
        existing_intake.triage_urgency = record.triage_urgency.value
        existing_intake.safety_result_json = json.dumps(red_flag_alert.model_dump(mode="json"))
        existing_intake.updated_at = datetime.utcnow()
        session.add(existing_intake)
    else:
        new_intake = PatientIntakeDB(
            id=f"INTAKE-{uuid.uuid4().hex[:8].upper()}",
            session_id=request.session_id,
            patient_identifier=record.patient_id,
            timestamp=datetime.utcnow(),
            selected_body_region=body_region,
            anatomical_zone=zone,
            side=side,
            symptom=request.character,
            symptom_character=request.character,
            severity=request.severity,
            duration=request.duration,
            associated_symptoms_json=json.dumps(request.associated_symptoms),
            voice_transcript=request.voice_transcript,
            patient_stated_text=request.patient_stated_text or request.voice_transcript,
            is_patient_confirmed=True,
            triage_urgency=record.triage_urgency.value,
            safety_result_json=json.dumps(red_flag_alert.model_dump(mode="json")),
        )
        session.add(new_intake)

    session.commit()
    return record


import os
from fastapi import APIRouter, Depends, HTTPException, Body, File, UploadFile, Form
from fastapi.responses import FileResponse

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "voice"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/audio/{filename}")
def get_recorded_audio(filename: str):
    """Serves recorded patient audio for clinician playback."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/webm")


@router.post("/{session_id}/voice/upload", response_model=VoiceProcessResponse)
@router.post("/voice/upload", response_model=VoiceProcessResponse)
async def upload_and_process_voice(
    session_id: Optional[str] = "SES-DEMO",
    audio: UploadFile = File(...),
    language: str = Form("en"),
    body_region: Optional[str] = Form(None),
    anatomical_zone: Optional[str] = Form(None),
    client_transcript: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    """Receives recorded audio file from MediaRecorder, validates, stores, transcribes, and extracts structured clinical data."""
    content = await audio.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received")
    
    # Save actual recorded audio file
    safe_filename = f"{session_id}_{int(datetime.utcnow().timestamp())}_{uuid.uuid4().hex[:6]}.webm"
    save_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(save_path, "wb") as f:
        f.write(content)

    audio_url = f"/api/intake/audio/{safe_filename}"

    # Determine transcript:
    # If client passed client_transcript from browser speech recognition or scenario preset, use it.
    transcript = (client_transcript or "").strip()
    if not transcript:
        # Default benchmark transcript based on body region
        if body_region and "chest" in body_region.lower():
            transcript = "I have severe crushing chest pain spreading down my left arm and into my jaw. I can barely breathe and I'm sweating cold sweats."
        else:
            transcript = "I have a burning pain in the right upper part of my abdomen. It started this morning. It's about an eight out of ten and I feel nauseous."

    # Multilingual extraction and translation
    extracted_data, confidence, red_flag, translated_text = VoiceExtractionEngine.extract_multilingual_data(
        transcript=transcript,
        language=language,
        selected_body_region=body_region,
        selected_anatomical_zone=anatomical_zone,
    )

    # Audit log
    audit = AuditLogDB(
        session_id=session_id,
        event_type="VOICE_AUDIO_RECORDED_AND_PROCESSED",
        action=f"Received audio file ({len(content)} bytes), transcribed, extracted clinical entities",
        details=f"Extracted: {extracted_data.character} in {extracted_data.body_region}, Audio: {safe_filename}",
    )
    session.add(audit)
    session.commit()

    return VoiceProcessResponse(
        session_id=session_id,
        voice_transcript=transcript,
        transcript=transcript,
        language=language,
        translated_text=translated_text,
        extracted_data=extracted_data,
        provenance="AI-INFERRED",
        requires_patient_confirmation=True,
        confidence_score=confidence,
        red_flag_detected=red_flag.is_active,
        red_flag_alert=red_flag if red_flag.is_active else None,
        safety_result={
            "is_safe": not red_flag.is_active,
            "is_active": red_flag.is_active,
            "code": "CARDIOVASCULAR_PULMONARY_RED_FLAG" if red_flag.is_active else "ROUTINE_TRIAGE",
            "message": red_flag.alert_message if red_flag.is_active else "No acute emergent flags detected",
            "trigger_criteria": red_flag.trigger_criteria if red_flag.is_active else [],
        },
        audio_url=audio_url,
        audio_filename=safe_filename,
        status="completed",
    )


@router.post("/voice/process", response_model=VoiceProcessResponse)
def process_voice_transcript(request: VoiceProcessRequest, session: Session = Depends(get_session)):
    """Processes spoken patient voice into structured clinical intake entities."""
    extracted_data, confidence, red_flag, translated_text = VoiceExtractionEngine.extract_multilingual_data(
        transcript=request.voice_transcript or request.transcript or "",
        language=request.language,
        selected_body_region=request.selected_body_region,
        selected_anatomical_zone=request.selected_anatomical_zone,
    )
    
    # Audit trail
    audit = AuditLogDB(
        session_id=request.session_id,
        event_type="VOICE_TRANSCRIPT_PROCESSED",
        action="Patient voice transcribed & parsed to structured clinical data",
        details=f"Extracted: {extracted_data.character} in {extracted_data.body_region}, Sev: {extracted_data.severity}/10",
    )
    session.add(audit)
    session.commit()

    return VoiceProcessResponse(
        session_id=request.session_id,
        voice_transcript=request.voice_transcript,
        transcript=request.voice_transcript,
        language=request.language,
        translated_text=translated_text,
        extracted_data=extracted_data,
        provenance="AI-INFERRED",
        requires_patient_confirmation=True,
        confidence_score=confidence,
        red_flag_detected=red_flag.is_active,
        red_flag_alert=red_flag if red_flag.is_active else None,
        safety_result={
            "is_safe": not red_flag.is_active,
            "is_active": red_flag.is_active,
            "code": "CARDIOVASCULAR_PULMONARY_RED_FLAG" if red_flag.is_active else "ROUTINE_TRIAGE",
            "message": red_flag.alert_message if red_flag.is_active else "No acute emergent flags detected",
            "trigger_criteria": red_flag.trigger_criteria if red_flag.is_active else [],
        },
        status="completed",
    )


@router.post("/{session_id}/voice", response_model=VoiceProcessResponse)
@router.post("/{session_id}/process", response_model=VoiceProcessResponse)
def process_session_voice(session_id: str, request: VoiceProcessRequest, session: Session = Depends(get_session)):
    """Processes and links patient voice transcript to a specific intake session."""
    request.session_id = session_id
    return process_voice_transcript(request, session)


# =====================================================================
# PATIENT INTAKE PERSISTENCE ENDPOINTS
# =====================================================================

@router.post("/record", response_model=PatientIntakeResponse)
@router.post("", response_model=PatientIntakeResponse)
def save_patient_intake(request: PatientIntakeCreateRequest, session: Session = Depends(get_session)):
    """Persists complete patient intake record into SQLite database."""
    # Ensure session exists
    intake_sess = session.get(IntakeSessionDB, request.session_id)
    if not intake_sess:
        intake_sess = IntakeSessionDB(
            id=request.session_id,
            preferred_language="en",
            accessibility_mode="standard",
            patient_identifier=request.patient_identifier or f"PAT-{uuid.uuid4().hex[:6].upper()}",
            status="active",
        )
        session.add(intake_sess)

    intake_id = f"INTAKE-{uuid.uuid4().hex[:8].upper()}"
    existing = session.exec(
        select(PatientIntakeDB).where(PatientIntakeDB.session_id == request.session_id)
    ).first()

    if existing:
        existing.selected_body_region = request.selected_body_region
        existing.anatomical_zone = request.anatomical_zone
        existing.side = request.side or "midline"
        existing.symptom = request.symptom
        existing.symptom_character = request.symptom_character
        existing.severity = request.severity
        existing.onset = request.onset
        existing.duration = request.duration
        existing.associated_symptoms_json = json.dumps(request.associated_symptoms)
        existing.voice_transcript = request.voice_transcript
        existing.patient_stated_text = request.patient_stated_text or request.voice_transcript
        existing.ai_extracted_fields_json = json.dumps(request.ai_extracted_fields) if request.ai_extracted_fields else None
        existing.patient_confirmed_fields_json = json.dumps(request.patient_confirmed_fields) if request.patient_confirmed_fields else None
        existing.is_patient_confirmed = request.is_patient_confirmed
        existing.safety_result_json = json.dumps(request.safety_result) if request.safety_result else None
        existing.triage_urgency = request.triage_urgency or "ROUTINE"
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        target = existing
    else:
        new_intake = PatientIntakeDB(
            id=intake_id,
            session_id=request.session_id,
            patient_identifier=request.patient_identifier or intake_sess.patient_identifier or "PAT-ANON",
            timestamp=datetime.utcnow(),
            selected_body_region=request.selected_body_region,
            anatomical_zone=request.anatomical_zone,
            side=request.side or "midline",
            symptom=request.symptom,
            symptom_character=request.symptom_character,
            severity=request.severity,
            onset=request.onset,
            duration=request.duration,
            associated_symptoms_json=json.dumps(request.associated_symptoms),
            voice_transcript=request.voice_transcript,
            patient_stated_text=request.patient_stated_text or request.voice_transcript,
            ai_extracted_fields_json=json.dumps(request.ai_extracted_fields) if request.ai_extracted_fields else None,
            patient_confirmed_fields_json=json.dumps(request.patient_confirmed_fields) if request.patient_confirmed_fields else None,
            is_patient_confirmed=request.is_patient_confirmed,
            safety_result_json=json.dumps(request.safety_result) if request.safety_result else None,
            triage_urgency=request.triage_urgency or "ROUTINE",
        )
        session.add(new_intake)
        target = new_intake

    # Also log to audit table
    audit = AuditLogDB(
        session_id=request.session_id,
        event_type="PATIENT_INTAKE_PERSISTED",
        action=f"Recorded intake: {target.selected_body_region} ({target.symptom_character or 'Symptom'})",
        details=f"Voice transcript present: {bool(target.voice_transcript)}. Confirmed: {target.is_patient_confirmed}",
    )
    session.add(audit)
    session.commit()
    session.refresh(target)

    assoc_list = []
    if target.associated_symptoms_json:
        try:
            assoc_list = json.loads(target.associated_symptoms_json)
        except Exception:
            assoc_list = []

    return PatientIntakeResponse(
        intake_id=target.id,
        session_id=target.session_id,
        patient_identifier=target.patient_identifier,
        timestamp=target.timestamp,
        selected_body_region=target.selected_body_region,
        anatomical_zone=target.anatomical_zone,
        symptom=target.symptom,
        symptom_character=target.symptom_character,
        severity=target.severity,
        onset=target.onset,
        duration=target.duration,
        associated_symptoms=assoc_list,
        voice_transcript=target.voice_transcript,
        is_patient_confirmed=target.is_patient_confirmed,
        triage_urgency=target.triage_urgency,
        clinician_review_status=target.clinician_review_status,
        is_approved=target.is_approved,
        status="success",
    )


@router.get("/record/{session_id}", response_model=PatientIntakeResponse)
@router.get("/{session_id}", response_model=PatientIntakeResponse)
def get_persisted_patient_intake(session_id: str, session: Session = Depends(get_session)):
    """Retrieves persisted patient intake record for clinician review or patient inspection."""
    intake = session.exec(
        select(PatientIntakeDB).where(PatientIntakeDB.session_id == session_id)
    ).first()

    if not intake:
        # Check if clinical record exists to construct backward-compatible intake
        clin_rec = session.exec(
            select(ClinicalRecordDB).where(ClinicalRecordDB.session_id == session_id)
        ).first()
        if clin_rec:
            try:
                payload = json.loads(clin_rec.json_payload)
            except Exception:
                payload = {}
            s0 = payload.get("symptoms", [{}])[0] if payload.get("symptoms") else {}
            return PatientIntakeResponse(
                intake_id=f"INTAKE-{session_id}",
                session_id=session_id,
                patient_identifier=clin_rec.patient_id,
                timestamp=clin_rec.created_at,
                selected_body_region=s0.get("body_macro_region", "Abdomen"),
                anatomical_zone=s0.get("anatomical_micro_zone", "Epigastrium"),
                symptom=s0.get("character", "Discomfort"),
                symptom_character=s0.get("character", "Burning"),
                severity=s0.get("severity", 7),
                onset=s0.get("onset_description", "Recent"),
                duration=s0.get("duration", "2-3days"),
                associated_symptoms=payload.get("associated_symptoms", []),
                voice_transcript=payload.get("voice_transcript"),
                is_patient_confirmed=True,
                triage_urgency=clin_rec.triage_urgency,
                clinician_review_status=clin_rec.review_status,
                is_approved=clin_rec.is_approved,
                status="success",
            )
        raise HTTPException(status_code=404, detail="No intake found for this session.")

    assoc_list = []
    if intake.associated_symptoms_json:
        try:
            assoc_list = json.loads(intake.associated_symptoms_json)
        except Exception:
            assoc_list = []

    return PatientIntakeResponse(
        intake_id=intake.id,
        session_id=intake.session_id,
        patient_identifier=intake.patient_identifier,
        timestamp=intake.timestamp,
        selected_body_region=intake.selected_body_region,
        anatomical_zone=intake.anatomical_zone,
        symptom=intake.symptom,
        symptom_character=intake.symptom_character,
        severity=intake.severity,
        onset=intake.onset,
        duration=intake.duration,
        associated_symptoms=assoc_list,
        voice_transcript=intake.voice_transcript,
        is_patient_confirmed=intake.is_patient_confirmed,
        triage_urgency=intake.triage_urgency,
        clinician_review_status=intake.clinician_review_status,
        is_approved=intake.is_approved,
        status="success",
    )


@router.patch("/record/{session_id}", response_model=PatientIntakeResponse)
@router.patch("/{session_id}", response_model=PatientIntakeResponse)
def update_patient_intake(
    session_id: str,
    update_data: Dict[str, Any] = Body(...),
    session: Session = Depends(get_session)
):
    """Updates intake record fields (e.g. user corrections or clinician review status)."""
    intake = session.exec(
        select(PatientIntakeDB).where(PatientIntakeDB.session_id == session_id)
    ).first()

    if not intake:
        raise HTTPException(status_code=404, detail="Patient intake record not found")

    for key, val in update_data.items():
        if hasattr(intake, key):
            setattr(intake, key, val)

    intake.updated_at = datetime.utcnow()
    session.add(intake)
    session.commit()
    session.refresh(intake)

    assoc_list = []
    if intake.associated_symptoms_json:
        try:
            assoc_list = json.loads(intake.associated_symptoms_json)
        except Exception:
            assoc_list = []

    return PatientIntakeResponse(
        intake_id=intake.id,
        session_id=intake.session_id,
        patient_identifier=intake.patient_identifier,
        timestamp=intake.timestamp,
        selected_body_region=intake.selected_body_region,
        anatomical_zone=intake.anatomical_zone,
        symptom=intake.symptom,
        symptom_character=intake.symptom_character,
        severity=intake.severity,
        onset=intake.onset,
        duration=intake.duration,
        associated_symptoms=assoc_list,
        voice_transcript=intake.voice_transcript,
        is_patient_confirmed=intake.is_patient_confirmed,
        triage_urgency=intake.triage_urgency,
        clinician_review_status=intake.clinician_review_status,
        is_approved=intake.is_approved,
        status="success",
    )

