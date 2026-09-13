import pytest
from fastapi.testclient import TestClient
from main import app
from app.db.session import engine, init_db
from app.models.db_models import UserDB
from sqlmodel import Session, select

init_db()
client = TestClient(app)

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["ok", "degraded"]
    assert data["service"] == "preconsult-ai-backend"
    assert "database" in data
    assert "environment" in data

def test_demo_patient_login():
    res = client.post("/api/v1/auth/login", json={
        "email": "maria.demo@preconsult.ai",
        "password": "Demo@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["user"]["email"] == "maria.demo@preconsult.ai"
    assert data["user"]["role"] == "patient"
    assert data["user"]["name"] == "Maria Gonzalez"

def test_demo_clinician_login():
    res = client.post("/api/v1/auth/login", json={
        "email": "dr.vance@preconsult.ai",
        "password": "Demo@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["user"]["role"] == "clinician"
    assert "Dr. Sarah Vance" in data["user"]["name"]

def test_patient_registration_and_profile():
    # Register a new patient
    import uuid
    new_email = f"test.patient.{uuid.uuid4().hex[:6]}@preconsult.ai"
    res = client.post("/api/v1/auth/register", json={
        "first_name": "QA",
        "last_name": "Tester",
        "email": new_email,
        "password": "SecretPassword123!",
        "date_of_birth": "1990-01-01",
        "sex": "Non-binary",
        "phone": "+1 (555) 000-1111",
        "preferred_language": "te",
        "accessibility_mode": "tremor"
    })
    assert res.status_code == 200
    reg_data = res.json()
    token = reg_data["access_token"]
    assert token is not None
    assert reg_data["user"]["name"] == "QA Tester"
    assert reg_data["user"]["role"] == "patient"

    # Test /api/v1/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == new_email
    assert me_data["profile"]["preferred_language"] == "te"

    # Test unauthorized access to clinician endpoint
    clin_res = client.get("/api/v1/auth/clinician/me", headers=headers)
    assert clin_res.status_code == 403

    # Test updating profile
    up_res = client.put("/api/v1/auth/profile", json={
        "phone": "+1 (555) 999-8888",
        "allergies": "Sulfa drugs"
    }, headers=headers)
    assert up_res.status_code == 200
    assert up_res.json()["status"] == "success"
