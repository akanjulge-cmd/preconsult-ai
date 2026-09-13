from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator
from datetime import datetime

class TriageUrgency(str, Enum):
    ROUTINE = "ROUTINE"
    PRIORITY = "PRIORITY"
    EMERGENCY = "EMERGENCY"

class DataProvenance(str, Enum):
    # Core requested provenance categories
    PATIENT_STATED = "PATIENT-STATED"
    OCR_DERIVED = "OCR-DERIVED"
    AI_INFERRED = "AI-INFERRED"
    DATABASE_DERIVED = "DATABASE-DERIVED"
    CLINICIAN_EDITED = "CLINICIAN-EDITED"
    
    # Backwards-compatible aliases
    PATIENT_SELECTED = "PATIENT-STATED"
    OCR_EXTRACTED = "OCR-DERIVED"
    CLINICIAN_ENTERED = "CLINICIAN-EDITED"

class SymptomItem(BaseModel):
    symptom_id: str
    body_macro_region: str
    anatomical_micro_zone: str
    character: str = Field(description="e.g. Burning, Cramping, Sharp, Dull")
    severity: int = Field(ge=1, le=10)
    onset_description: Optional[str] = None
    duration: Optional[str] = None
    provenance: DataProvenance = DataProvenance.PATIENT_STATED
    confidence: float = 1.0

class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    source: str = "Prescription OCR"
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    verification_status: str = "Unconfirmed"
    provenance: DataProvenance = DataProvenance.OCR_DERIVED

class LabResultItem(BaseModel):
    test_name: str
    value: str
    unit: str
    reference_range: str
    is_abnormal: bool
    confidence: float = Field(default=0.98, ge=0.0, le=1.0)
    provenance: DataProvenance = DataProvenance.OCR_DERIVED

class RedFlagAlert(BaseModel):
    is_active: bool = False
    rule_id: Optional[str] = None
    rule_version: Optional[str] = None
    rule_name: Optional[str] = None
    category: Optional[str] = None
    trigger_criteria: List[str] = []
    alert_message: str = ""
    urgent_action_guidance: Optional[str] = None
    non_diagnostic_disclaimer: Optional[str] = None
    audit_event_id: Optional[int] = None
    requires_clinician_override: bool = True
    intercept_timestamp: Optional[datetime] = None

class ClinicalPreConsultRecord(BaseModel):
    record_id: str
    patient_id: str
    patient_name: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    chief_complaint: str
    history_of_present_illness: str
    symptoms: List[SymptomItem] = []
    symptom_timeline: str = ""
    pertinent_negatives: List[str] = []
    active_medications: List[MedicationItem] = []
    abnormal_labs: List[LabResultItem] = []
    triage_urgency: TriageUrgency = TriageUrgency.ROUTINE
    red_flag: RedFlagAlert = Field(default_factory=RedFlagAlert)
    unresolved_questions: List[str] = []
    clinician_approved: bool = False
    clinician_notes: Optional[str] = None
    # Clinician review & dashboard extensions
    review_status: str = Field(default="DRAFT")  # DRAFT, CLINICIAN_EDITED, APPROVED, REJECTED, REGENERATED
    rejection_reason: Optional[str] = None
    clinician_id: Optional[str] = None
    confidence_score: float = Field(default=0.94, ge=0.0, le=1.0)
    confidence_breakdown: Optional[Dict[str, float]] = None
    associated_symptoms: List[str] = []
    provenance_map: Optional[Dict[str, str]] = None
    voice_transcript: Optional[str] = None
    patient_stated_text: Optional[str] = None
    extracted_fields: Optional[Dict[str, Any]] = None
    recorded_intake: Optional[Dict[str, Any]] = None

# API Request / Response schemas
class SessionCreateRequest(BaseModel):
    preferred_language: str = "en"
    accessibility_mode: str = "standard"  # standard, non_speaking, high_contrast, tremors
    patient_identifier: Optional[str] = None

class SessionResponse(BaseModel):
    session_id: str
    created_at: datetime
    status: str
    preferred_language: str
    accessibility_mode: str

class SymptomSubmitRequest(BaseModel):
    session_id: str
    body_macro_region: str
    anatomical_micro_zone: str
    character: str
    severity: int = Field(ge=1, le=10)
    duration: Optional[str] = None
    onset: Optional[str] = None
    locations: Optional[List[Dict[str, Any]]] = None
    symptom_attributes: Optional[Dict[str, Any]] = None

class RedFlagCheckRequest(BaseModel):
    symptoms: List[str]
    anatomical_regions: List[str] = []
    severity_max: int = 1

class RedFlagCheckResponse(BaseModel):
    is_emergency: bool
    trigger_rule: Optional[str] = None
    action_required: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class HealthStatusResponse(BaseModel):
    status: str
    version: str
    database_connected: bool
    ai_mode: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Adaptive Clinical Intake Engine Schemas
class AdaptiveOption(BaseModel):
    id: str
    label: str
    icon: str
    clinical_value: str
    is_red_flag: bool = False
    is_pertinent_negative: bool = False

class AdaptiveQuestion(BaseModel):
    question_id: str
    target_field: str
    prompt_text: str
    audio_prompt: str
    options: List[AdaptiveOption]
    turn_number: int
    max_turns: int
    clinical_context: Optional[str] = None

class AdaptiveAnswer(BaseModel):
    question_id: str
    target_field: str
    selected_option_id: str
    selected_text: str

class AdaptiveStateRequest(BaseModel):
    session_id: str
    locations: List[Dict[str, Any]] = []
    body_macro_region: Optional[str] = None
    anatomical_micro_zone: Optional[str] = None
    character: Optional[str] = None
    severity: int = Field(default=5, ge=1, le=10)
    duration: Optional[str] = None
    associated_symptoms: List[str] = []
    completed_answers: List[AdaptiveAnswer] = []
    patient_identifier: Optional[str] = None
    voice_transcript: Optional[str] = None
    patient_stated_text: Optional[str] = None
    extracted_fields: Optional[Dict[str, Any]] = None

class StructuredIntakeData(BaseModel):
    body_region: Optional[str] = None
    anatomical_zone: Optional[str] = None
    symptom: Optional[str] = None
    character: Optional[str] = None
    severity: Optional[int] = None
    onset: Optional[str] = None
    duration: Optional[str] = None
    associated_symptoms: List[str] = []
    patient_text: str = ""

class VoiceProcessRequest(BaseModel):
    session_id: str = "SES-DEMO"
    voice_transcript: Optional[str] = None
    transcript: Optional[str] = None
    selected_body_region: Optional[str] = None
    body_region: Optional[str] = None
    selected_anatomical_zone: Optional[str] = None
    anatomical_zone: Optional[str] = None
    language: str = "en"

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("voice_transcript") and data.get("transcript"):
                data["voice_transcript"] = data["transcript"]
            if not data.get("voice_transcript") and data.get("patient_stated_text"):
                data["voice_transcript"] = data["patient_stated_text"]
            if not data.get("transcript") and data.get("voice_transcript"):
                data["transcript"] = data["voice_transcript"]
            if not data.get("language") and data.get("input_language"):
                data["language"] = data["input_language"]
            if not data.get("selected_body_region") and data.get("body_region"):
                data["selected_body_region"] = data["body_region"]
            if not data.get("body_region") and data.get("selected_body_region"):
                data["body_region"] = data["selected_body_region"]
            if not data.get("selected_anatomical_zone") and data.get("anatomical_zone"):
                data["selected_anatomical_zone"] = data["anatomical_zone"]
            if not data.get("anatomical_zone") and data.get("selected_anatomical_zone"):
                data["anatomical_zone"] = data["selected_anatomical_zone"]
        return data

class VoiceProcessResponse(BaseModel):
    session_id: str
    voice_transcript: str
    transcript: Optional[str] = None
    language: str = "en"
    translated_text: Optional[str] = None
    extracted_data: StructuredIntakeData
    provenance: str = "AI-INFERRED"
    requires_patient_confirmation: bool = True
    confidence_score: float = 0.95
    red_flag_detected: bool = False
    red_flag_alert: Optional[RedFlagAlert] = None
    safety_result: Dict[str, Any] = Field(default_factory=lambda: {
        "is_safe": True,
        "code": "ROUTINE_TRIAGE",
        "message": "No acute emergent flags detected"
    })
    audio_url: Optional[str] = None
    audio_filename: Optional[str] = None
    status: str = "completed"

    @model_validator(mode="before")
    @classmethod
    def sync_transcripts(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("transcript") and data.get("voice_transcript"):
                data["transcript"] = data["voice_transcript"]
            if not data.get("voice_transcript") and data.get("transcript"):
                data["voice_transcript"] = data["transcript"]
            if not data.get("audio_filename") and data.get("audio_url"):
                data["audio_filename"] = data["audio_url"].split("/")[-1]
        return data

class PatientIntakeCreateRequest(BaseModel):
    session_id: str = "SES-DEMO"
    sessionId: Optional[str] = None
    user_id: Optional[str] = None
    userId: Optional[str] = None
    patient_identifier: Optional[str] = None
    patientIdentifier: Optional[str] = None
    selected_body_region: Optional[str] = None
    body_region: Optional[str] = None
    bodyRegion: Optional[str] = None
    anatomical_zone: Optional[str] = None
    anatomicalZone: Optional[str] = None
    side: Optional[str] = "midline"
    symptom: Optional[str] = None
    symptom_character: Optional[str] = None
    character: Optional[str] = None
    severity: Optional[int] = None
    onset: Optional[str] = None
    duration: Optional[str] = None
    associated_symptoms: Optional[List[str]] = Field(default_factory=list)
    associatedSymptoms: Optional[List[str]] = None
    voice_transcript: Optional[str] = None
    patient_voice_transcript: Optional[str] = None
    patientVoiceTranscript: Optional[str] = None
    patient_stated_text: Optional[str] = None
    patientText: Optional[str] = None
    ai_extracted_fields: Optional[Dict[str, Any]] = None
    patient_confirmed_fields: Optional[Dict[str, Any]] = None
    structured_clinical_data: Optional[Dict[str, Any]] = None
    is_patient_confirmed: bool = True
    patient_confirmed: Optional[bool] = None
    patientConfirmed: Optional[bool] = None
    safety_result: Optional[Dict[str, Any]] = None
    safetyResult: Optional[Dict[str, Any]] = None
    triage_urgency: Optional[str] = "ROUTINE"
    status: Optional[str] = "COMPLETED"

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("session_id") and data.get("sessionId"):
                data["session_id"] = data["sessionId"]
            if not data.get("user_id") and data.get("userId"):
                data["user_id"] = data["userId"]
            if not data.get("patient_identifier") and data.get("patientIdentifier"):
                data["patient_identifier"] = data["patientIdentifier"]
            if not data.get("user_id") and data.get("patient_identifier") and str(data.get("patient_identifier")).startswith("USR-"):
                data["user_id"] = data.get("patient_identifier")
            
            # body region
            b_reg = data.get("selected_body_region") or data.get("body_region") or data.get("bodyRegion")
            if b_reg:
                data["selected_body_region"] = b_reg
                data["body_region"] = b_reg
            
            # anatomical zone
            zone = data.get("anatomical_zone") or data.get("anatomicalZone")
            if zone:
                data["anatomical_zone"] = zone
            
            # character
            char = data.get("symptom_character") or data.get("character")
            if char:
                data["symptom_character"] = char
                data["character"] = char
            
            # transcript
            trans = (
                data.get("voice_transcript")
                or data.get("patient_voice_transcript")
                or data.get("patientVoiceTranscript")
                or data.get("patient_stated_text")
                or data.get("patientText")
            )
            if trans:
                data["voice_transcript"] = trans
                data["patient_voice_transcript"] = trans
                data["patient_stated_text"] = trans

            # associated symptoms
            assoc = data.get("associated_symptoms")
            if assoc is None:
                assoc = data.get("associatedSymptoms")
            if assoc is not None:
                data["associated_symptoms"] = assoc

            # confirmation
            conf = data.get("is_patient_confirmed")
            if conf is None:
                conf = data.get("patient_confirmed") if data.get("patient_confirmed") is not None else data.get("patientConfirmed")
            if conf is not None:
                data["is_patient_confirmed"] = bool(conf)
                data["patient_confirmed"] = bool(conf)

            # safety result
            sr = data.get("safety_result") or data.get("safetyResult")
            if sr:
                data["safety_result"] = sr
        return data

class PatientIntakeResponse(BaseModel):
    intake_id: str
    session_id: str
    patient_identifier: str
    timestamp: datetime
    selected_body_region: str
    body_region: Optional[str] = None
    anatomical_zone: Optional[str] = None
    symptom: Optional[str] = None
    symptom_character: Optional[str] = None
    character: Optional[str] = None
    severity: Optional[int] = None
    onset: Optional[str] = None
    duration: Optional[str] = None
    associated_symptoms: List[str] = Field(default_factory=list)
    voice_transcript: Optional[str] = None
    patient_voice_transcript: Optional[str] = None
    patient_text: Optional[str] = None
    is_patient_confirmed: bool = True
    patient_confirmed: bool = True
    triage_urgency: str = "ROUTINE"
    clinician_review_status: str = "DRAFT"
    is_approved: bool = False
    status: str = "success"

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("body_region") and data.get("selected_body_region"):
                data["body_region"] = data["selected_body_region"]
            if not data.get("character") and data.get("symptom_character"):
                data["character"] = data["symptom_character"]
            if not data.get("patient_voice_transcript") and data.get("voice_transcript"):
                data["patient_voice_transcript"] = data["voice_transcript"]
            if not data.get("patient_text") and (data.get("patient_voice_transcript") or data.get("voice_transcript")):
                data["patient_text"] = data.get("patient_voice_transcript") or data.get("voice_transcript")
            if "patient_confirmed" not in data and "is_patient_confirmed" in data:
                data["patient_confirmed"] = data["is_patient_confirmed"]
        return data


class AdaptiveTurnResponse(BaseModel):
    is_complete: bool
    turn_number: int
    max_turns: int
    next_question: Optional[AdaptiveQuestion] = None
    red_flag_alert: Optional[RedFlagAlert] = None
    resolved_variables: List[str] = []
    unresolved_variables: List[str] = []
    record: Optional[ClinicalPreConsultRecord] = None

# Deterministic Safety Engine Schemas
class SafetyRuleInfo(BaseModel):
    rule_id: str
    version: str
    name: str
    category: str
    description: str
    triage_urgency: str
    is_active: bool = True

class SafetyOverrideRequest(BaseModel):
    session_id: str
    staff_pin: str = Field(description="Authorized clinical staff PIN e.g. 1234 for demo")
    clinician_name: str = "Triage Clinician"
    reason: str = Field(default="In-person clinical evaluation confirmed; patient cleared for routine intake.")

class SafetyOverrideResponse(BaseModel):
    success: bool
    message: str
    session_id: str
    audit_event_id: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SafetyEvaluationRequest(BaseModel):
    session_id: Optional[str] = None
    locations: List[Dict[str, Any]] = []
    character: Optional[str] = None
    severity: int = 5
    associated_symptoms: List[str] = []
    completed_answers: List[Dict[str, Any]] = []

# Clinician Action Request Schemas
class ClinicianEditRequest(BaseModel):
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    symptoms: Optional[List[SymptomItem]] = None
    severity: Optional[int] = Field(default=None, ge=1, le=10)
    symptom_timeline: Optional[str] = None
    pertinent_negatives: Optional[List[str]] = None
    active_medications: Optional[List[MedicationItem]] = None
    abnormal_labs: Optional[List[LabResultItem]] = None
    triage_urgency: Optional[TriageUrgency] = None
    unresolved_questions: Optional[List[str]] = None
    clinician_notes: Optional[str] = None
    clinician_id: str = "Dr. S. Vance, MD"

class ClinicianApproveRequest(BaseModel):
    clinician_id: str = "Dr. S. Vance, MD"
    clinician_notes: Optional[str] = None
    digital_signature: Optional[str] = None

class ClinicianRejectRequest(BaseModel):
    clinician_id: str = "Dr. S. Vance, MD"
    rejection_category: str = Field(
        default="AI_INFERENCE_INACCURATE",
        description="AI_INFERENCE_INACCURATE, OCR_UNCONFIRMED, PATIENT_INPUT_MISMATCH, DIRECT_NURSE_TRIAGE"
    )
    rejection_reason: str = Field(..., min_length=3, description="Clinical reason for rejecting the brief draft")
    notes: Optional[str] = None

class ClinicianRegenerateRequest(BaseModel):
    instructions: Optional[str] = Field(default="", description="Physician guidance for synthesis regeneration")
    focus_areas: Optional[List[str]] = None

# =====================================================================
# DOCUMENT & PRESCRIPTION OCR SCHEMAS
# =====================================================================

class OcrMedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    date: Optional[str] = None
    prescriber: Optional[str] = None
    source: str = "Prescription OCR"
    confidence: float = Field(ge=0.0, le=1.0)
    requires_verification: bool = False
    is_verified: bool = False
    has_conflict: bool = False
    conflict_reason: Optional[str] = None
    provenance: DataProvenance = DataProvenance.OCR_DERIVED

class OcrLabItem(BaseModel):
    test_name: str
    value: str
    unit: str
    reference_range: str
    is_abnormal: bool
    date: Optional[str] = None
    source: str = "Lab Report OCR"
    confidence: float = Field(ge=0.0, le=1.0)
    requires_verification: bool = False
    is_verified: bool = False
    provenance: DataProvenance = DataProvenance.OCR_DERIVED

class DocumentOcrResponse(BaseModel):
    document_id: str
    session_id: Optional[str] = None
    document_type: str = "PRESCRIPTION"  # PRESCRIPTION, LAB_REPORT, MIXED
    filename: str
    extracted_medications: List[OcrMedicationItem] = []
    extracted_labs: List[OcrLabItem] = []
    conflicts_detected: List[str] = []
    requires_human_verification: bool = False
    overall_confidence: float = 1.0
    raw_text: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class DocumentVerificationRequest(BaseModel):
    session_id: str
    document_id: str = "DOC-VERIFIED"
    verified_medications: List[OcrMedicationItem]
    verified_labs: List[OcrLabItem] = []
    resolved_conflicts: Optional[List[Dict[str, Any]]] = None
    reviewer_role: str = "PATIENT"  # PATIENT or CLINICIAN
    reviewer_notes: Optional[str] = None

class DocumentUploadRequest(BaseModel):
    preset_id: Optional[str] = None
    session_id: Optional[str] = None
    filename: Optional[str] = None
    text_content: Optional[str] = None


