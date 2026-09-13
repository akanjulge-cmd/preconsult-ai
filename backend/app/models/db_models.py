from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class UserDB(SQLModel, table=True):
    __tablename__ = "users"
    
    id: str = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    salt: str
    full_name: str
    role: str = Field(default="patient")  # "patient", "clinician", "admin"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PatientProfileDB(SQLModel, table=True):
    __tablename__ = "patient_profiles"
    
    id: str = Field(default=None, primary_key=True)
    user_id: str = Field(unique=True, index=True)
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: str = Field(default="en")
    accessibility_mode: str = Field(default="standard")
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ClinicianProfileDB(SQLModel, table=True):
    __tablename__ = "clinician_profiles"
    
    id: str = Field(default=None, primary_key=True)
    user_id: str = Field(unique=True, index=True)
    title: str = Field(default="Attending Physician")
    department: str = Field(default="Emergency & Internal Medicine")
    license_number: str = Field(default="MD-98421")
    hospital_name: str = Field(default="Metropolitan General Hospital")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class IntakeSessionDB(SQLModel, table=True):
    __tablename__ = "intake_sessions"
    
    id: str = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="active")  # active, completed, intercepted
    preferred_language: str = Field(default="en")
    accessibility_mode: str = Field(default="standard")
    patient_identifier: Optional[str] = None

class SymptomDB(SQLModel, table=True):
    __tablename__ = "symptoms"
    
    id: str = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    body_macro_region: str
    anatomical_micro_zone: str
    character: str
    severity: int
    onset: Optional[str] = None
    duration: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VoiceRecordingDB(SQLModel, table=True):
    __tablename__ = "voice_recordings"
    
    id: str = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    filename: str
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    language: str = Field(default="en")
    original_transcript: Optional[str] = None
    english_translation: Optional[str] = None
    confidence: Optional[float] = 0.95
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OCRDocumentDB(SQLModel, table=True):
    __tablename__ = "ocr_documents"
    
    id: str = Field(default=None, primary_key=True)
    session_id: Optional[str] = Field(default=None, index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    document_type: str = Field(default="prescription")  # prescription, lab_report, clinical_note
    filename: str
    raw_text: str
    confidence_score: float = Field(default=0.95)
    needs_verification: bool = Field(default=False)
    is_verified: bool = Field(default=False)
    extracted_fields_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SafetyAssessmentDB(SQLModel, table=True):
    __tablename__ = "safety_assessments"
    
    id: str = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    urgency_level: str = Field(default="ROUTINE")  # ROUTINE, URGENT, EMERGENCY
    rule_triggered: Optional[str] = None
    rule_version: str = Field(default="1.0.0")
    action_taken: str = Field(default="CLEAR_TRIAGE")
    recommendations_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AuditLogDB(SQLModel, table=True):
    __tablename__ = "audit_logs"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[str] = Field(default=None, index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    event_type: str
    action: str
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ClinicalRecordDB(SQLModel, table=True):
    __tablename__ = "clinical_records"
    
    id: str = Field(default=None, primary_key=True)
    session_id: str = Field(unique=True, index=True)
    patient_id: str
    chief_complaint: str
    hpi_narrative: str
    triage_urgency: str = Field(default="ROUTINE")
    is_approved: bool = Field(default=False)
    review_status: str = Field(default="DRAFT")  # DRAFT, CLINICIAN_EDITED, APPROVED, REJECTED, REGENERATED
    clinician_notes: Optional[str] = None
    clinician_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    json_payload: str  # Full serialized ClinicalPreConsultRecord
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PatientIntakeDB(SQLModel, table=True):
    __tablename__ = "patient_intakes"
    
    id: str = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    patient_identifier: str = Field(default="PAT-ANON")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    selected_body_region: str
    anatomical_zone: Optional[str] = None
    side: Optional[str] = "midline"
    symptom: Optional[str] = None
    symptom_character: Optional[str] = None
    severity: Optional[int] = None
    onset: Optional[str] = None
    duration: Optional[str] = None
    associated_symptoms_json: Optional[str] = None
    voice_transcript: Optional[str] = None
    patient_stated_text: Optional[str] = None
    ai_extracted_fields_json: Optional[str] = None
    patient_confirmed_fields_json: Optional[str] = None
    is_patient_confirmed: bool = Field(default=True)
    safety_result_json: Optional[str] = None
    triage_urgency: str = Field(default="ROUTINE")
    clinician_review_status: str = Field(default="DRAFT")
    clinician_notes: Optional[str] = None
    clinician_id: Optional[str] = None
    is_approved: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
