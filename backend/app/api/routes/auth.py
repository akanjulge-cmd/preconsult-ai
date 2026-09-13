import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.db_models import UserDB, PatientProfileDB, ClinicianProfileDB, PatientIntakeDB, OCRDocumentDB
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_payload
)

router = APIRouter(tags=["Authentication & Patient"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = "en"
    accessibility_mode: Optional[str] = "standard"
    emergency_contact: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None
    accessibility_mode: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None

def seed_demo_accounts_if_needed(db: Session):
    """Ensures deterministic hackathon demo patient and clinician accounts are always available."""
    # 1. Demo Patient: Maria Gonzalez
    demo_patient = db.exec(select(UserDB).where(UserDB.email == "maria.demo@preconsult.ai")).first()
    if not demo_patient:
        # Also check alternative alias
        demo_patient = db.exec(select(UserDB).where(UserDB.email == "patient@preconsult.ai")).first()
    
    if not demo_patient:
        pw_hash, salt = hash_password("Demo@123")
        patient_user = UserDB(
            id="USR-PAT-MARIA",
            email="maria.demo@preconsult.ai",
            hashed_password=pw_hash,
            salt=salt,
            full_name="Maria Gonzalez",
            role="patient",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(patient_user)
        db.commit()
        db.refresh(patient_user)
        
        patient_profile = PatientProfileDB(
            id="PRF-PAT-MARIA",
            user_id=patient_user.id,
            date_of_birth="1982-04-12",
            sex="Female",
            phone="+1 (555) 234-5678",
            preferred_language="en",
            accessibility_mode="standard",
            emergency_contact="Carlos Gonzalez (+1 555-987-6543)",
            allergies="Penicillin",
            current_medications="Omeprazole 20mg daily",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(patient_profile)
        db.commit()

    # 2. Demo Clinician: Dr. Sarah Vance
    demo_doc = db.exec(select(UserDB).where(UserDB.email == "dr.vance@preconsult.ai")).first()
    if not demo_doc:
        demo_doc = db.exec(select(UserDB).where(UserDB.email == "clinician@preconsult.ai")).first()
        
    if not demo_doc:
        pw_hash, salt = hash_password("Demo@123")
        doc_user = UserDB(
            id="USR-DOC-VANCE",
            email="dr.vance@preconsult.ai",
            hashed_password=pw_hash,
            salt=salt,
            full_name="Dr. Sarah Vance, MD",
            role="clinician",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(doc_user)
        db.commit()
        db.refresh(doc_user)
        
        doc_profile = ClinicianProfileDB(
            id="PRF-DOC-VANCE",
            user_id=doc_user.id,
            title="Attending Physician",
            department="Emergency & Internal Medicine",
            license_number="MD-98421",
            hospital_name="Metropolitan General Hospital",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(doc_profile)
        db.commit()

@router.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_session)):
    seed_demo_accounts_if_needed(db)
    
    email_clean = req.email.strip().lower()
    user = db.exec(select(UserDB).where(UserDB.email == email_clean)).first()
    
    # Allow demo alias logins
    if not user:
        if email_clean in ["maria", "patient", "maria@demo.com", "patient@demo.com"]:
            user = db.exec(select(UserDB).where(UserDB.email == "maria.demo@preconsult.ai")).first()
        elif email_clean in ["vance", "doctor", "clinician", "dr.vance"]:
            user = db.exec(select(UserDB).where(UserDB.email == "dr.vance@preconsult.ai")).first()
            
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
        
    if not verify_password(req.password, user.hashed_password, user.salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
        
    # Retrieve profile
    profile_data = {}
    if user.role == "patient":
        profile = db.exec(select(PatientProfileDB).where(PatientProfileDB.user_id == user.id)).first()
        if profile:
            profile_data = {
                "date_of_birth": profile.date_of_birth,
                "sex": profile.sex,
                "phone": profile.phone,
                "preferred_language": profile.preferred_language,
                "accessibility_mode": profile.accessibility_mode,
                "emergency_contact": profile.emergency_contact,
                "allergies": profile.allergies,
                "current_medications": profile.current_medications,
            }
    elif user.role == "clinician":
        profile = db.exec(select(ClinicianProfileDB).where(ClinicianProfileDB.user_id == user.id)).first()
        if profile:
            profile_data = {
                "title": profile.title,
                "department": profile.department,
                "license_number": profile.license_number,
                "hospital_name": profile.hospital_name,
            }
            
    token_payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role
    }
    access_token = create_access_token(token_payload)
    
    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "profile": profile_data
        }
    }

@router.post("/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_session)):
    email_clean = req.email.strip().lower()
    existing = db.exec(select(UserDB).where(UserDB.email == email_clean)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )
        
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )
        
    full_name = f"{req.first_name.strip()} {req.last_name.strip()}".strip()
    user_id = f"USR-PAT-{uuid.uuid4().hex[:8].upper()}"
    pw_hash, salt = hash_password(req.password)
    
    user = UserDB(
        id=user_id,
        email=email_clean,
        hashed_password=pw_hash,
        salt=salt,
        full_name=full_name,
        role="patient",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    profile = PatientProfileDB(
        id=f"PRF-{uuid.uuid4().hex[:8].upper()}",
        user_id=user.id,
        date_of_birth=req.date_of_birth,
        sex=req.sex,
        phone=req.phone,
        preferred_language=req.preferred_language or "en",
        accessibility_mode=req.accessibility_mode or "standard",
        emergency_contact=req.emergency_contact,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(profile)
    db.commit()
    
    token_payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role
    }
    access_token = create_access_token(token_payload)
    
    return {
        "status": "success",
        "message": "Patient account registered successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "profile": {
                "date_of_birth": profile.date_of_birth,
                "sex": profile.sex,
                "phone": profile.phone,
                "preferred_language": profile.preferred_language,
                "accessibility_mode": profile.accessibility_mode,
                "emergency_contact": profile.emergency_contact,
            }
        }
    }

@router.get("/auth/me")
@router.get("/me")
def get_me(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_session)):
    user_id = payload.get("sub")
    user = db.exec(select(UserDB).where(UserDB.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
        
    profile_data = {}
    if user.role == "patient":
        profile = db.exec(select(PatientProfileDB).where(PatientProfileDB.user_id == user.id)).first()
        if profile:
            profile_data = {
                "date_of_birth": profile.date_of_birth,
                "sex": profile.sex,
                "phone": profile.phone,
                "preferred_language": profile.preferred_language,
                "accessibility_mode": profile.accessibility_mode,
                "emergency_contact": profile.emergency_contact,
                "allergies": profile.allergies,
                "current_medications": profile.current_medications,
            }
    elif user.role == "clinician":
        profile = db.exec(select(ClinicianProfileDB).where(ClinicianProfileDB.user_id == user.id)).first()
        if profile:
            profile_data = {
                "title": profile.title,
                "department": profile.department,
                "license_number": profile.license_number,
                "hospital_name": profile.hospital_name,
            }
            
    return {
        "id": user.id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
        "profile": profile_data
    }

@router.get("/auth/clinician/me")
@router.get("/clinician/me")
def get_clinician_me(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_session)):
    if payload.get("role") != "clinician":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to licensed clinicians."
        )
    return get_me(payload=payload, db=db)

@router.put("/auth/profile")
def update_profile(
    req: ProfileUpdateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_session)
):
    user_id = payload.get("sub")
    user = db.exec(select(UserDB).where(UserDB.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    if req.full_name:
        user.full_name = req.full_name.strip()
        user.updated_at = datetime.utcnow()
        db.add(user)
        
    if user.role == "patient":
        profile = db.exec(select(PatientProfileDB).where(PatientProfileDB.user_id == user.id)).first()
        if not profile:
            profile = PatientProfileDB(id=f"PRF-{uuid.uuid4().hex[:8].upper()}", user_id=user.id)
        if req.phone is not None:
            profile.phone = req.phone
        if req.preferred_language is not None:
            profile.preferred_language = req.preferred_language
        if req.accessibility_mode is not None:
            profile.accessibility_mode = req.accessibility_mode
        if req.emergency_contact is not None:
            profile.emergency_contact = req.emergency_contact
        if req.allergies is not None:
            profile.allergies = req.allergies
        if req.current_medications is not None:
            profile.current_medications = req.current_medications
            
        profile.updated_at = datetime.utcnow()
        db.add(profile)
        
    db.commit()
    return {
        "status": "success",
        "message": "Profile saved successfully."
    }

@router.get("/patient/intakes")
def get_patient_intakes(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_session)
):
    user_id = payload.get("sub")
    intakes = db.exec(
        select(PatientIntakeDB)
        .where((PatientIntakeDB.user_id == user_id) | (PatientIntakeDB.patient_identifier == user_id))
        .order_by(PatientIntakeDB.timestamp.desc())
    ).all()
    
    return [
        {
            "id": i.id,
            "session_id": i.session_id,
            "timestamp": i.timestamp.isoformat() if i.timestamp else None,
            "selected_body_region": i.selected_body_region,
            "anatomical_zone": i.anatomical_zone,
            "symptom": i.symptom,
            "symptom_character": i.symptom_character,
            "severity": i.severity,
            "triage_urgency": i.triage_urgency,
            "clinician_review_status": i.clinician_review_status,
            "is_approved": i.is_approved,
        }
        for i in intakes
    ]

@router.get("/patient/documents")
def get_patient_documents(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_session)
):
    user_id = payload.get("sub")
    docs = db.exec(
        select(OCRDocumentDB)
        .where(OCRDocumentDB.user_id == user_id)
        .order_by(OCRDocumentDB.created_at.desc())
    ).all()
    
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "document_type": d.document_type,
            "confidence_score": d.confidence_score,
            "is_verified": d.is_verified,
            "needs_verification": d.needs_verification,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]
