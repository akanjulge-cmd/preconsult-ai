from fastapi import APIRouter, Depends
from sqlmodel import Session, select, text
from app.db.session import get_session
from app.core.config import settings
from app.models.schemas import HealthStatusResponse

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("", response_model=HealthStatusResponse)
def get_health_status(session: Session = Depends(get_session)):
    """Verifies backend runtime, database connectivity, and AI configuration."""
    db_connected = False
    try:
        session.exec(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False
        
    ai_mode = "live_gemini" if settings.GEMINI_API_KEY else "deterministic_mock_fallback"
    
    return HealthStatusResponse(
        status="healthy",
        version=settings.APP_VERSION,
        database_connected=db_connected,
        ai_mode=ai_mode
    )
