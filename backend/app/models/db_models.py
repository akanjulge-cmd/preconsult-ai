from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class IntakeSessionDB(SQLModel, table=True):
    __tablename__ = "intake_sessions"
    
    id: str = Field(default=None, primary_key=True)
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

class AuditLogDB(SQLModel, table=True):
    __tablename__ = "audit_logs"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[str] = Field(default=None, index=True)
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


