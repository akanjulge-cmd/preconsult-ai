import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

def get_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "sqlite:///./preconsult.db")
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql://", 1)
    return raw

def get_allowed_origins() -> list[str]:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    # Allow FRONTEND_URL env var (e.g. from Vercel)
    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    if frontend_url:
        for url in frontend_url.split(","):
            cleaned = url.strip().rstrip("/")
            if cleaned and cleaned not in origins:
                origins.append(cleaned)
    
    # Allow additional origins via ALLOWED_ORIGINS comma-separated
    extra_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
    if extra_origins:
        for url in extra_origins.split(","):
            cleaned = url.strip().rstrip("/")
            if cleaned and cleaned not in origins:
                origins.append(cleaned)

    return origins

class Settings(BaseModel):
    APP_NAME: str = "PreConsult AI Backend"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Database
    DATABASE_URL: str = get_database_url()
    
    # Gemini API Key (can be blank in mock/offline demo mode)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    MOCK_AI_FALLBACK: bool = os.getenv("MOCK_AI_FALLBACK", "True").lower() == "true"
    
    # CORS
    ALLOWED_ORIGINS: list[str] = get_allowed_origins()

settings = Settings()
