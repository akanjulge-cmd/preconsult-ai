import os
import time
import json
import hmac
import hashlib
import base64
import secrets
from typing import Optional
from fastapi import Header, HTTPException, status

SECRET_KEY = os.getenv("SECRET_KEY", "preconsult-super-secure-jwt-secret-key-2026-prod")

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hashes a plaintext password using NIST-approved PBKDF2-HMAC-SHA256 with a unique salt."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return key.hex(), salt

def verify_password(password: str, hashed_hex: str, salt: str) -> bool:
    """Verifies a plaintext password against stored PBKDF2-HMAC-SHA256 hash."""
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return hmac.compare_digest(key.hex(), hashed_hex)

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def b64url_decode(s: str) -> bytes:
    rem = len(s) % 4
    if rem > 0:
        s += '=' * (4 - rem)
    return base64.urlsafe_b64decode(s.encode('ascii'))

def create_access_token(data: dict, expires_delta_hours: int = 48) -> str:
    """Generates an RFC 7519 compliant HS256 JWT access token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = data.copy()
    payload["iat"] = int(time.time())
    payload["exp"] = int(time.time() + (expires_delta_hours * 3600))
    
    header_b64 = b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = b64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates signature and expiration of an HS256 JWT access token."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(b64url_encode(expected_sig), sig_b64):
            return None
            
        payload = json.loads(b64url_decode(payload_b64).decode('utf-8'))
        if "exp" in payload and payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None

def get_current_user_payload(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency to extract and validate current authenticated user payload."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = decode_access_token(parts[1])
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return payload
