from fastapi import APIRouter, Depends
from sqlmodel import Session, text
from app.db.session import get_session
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
def get_health_status(session: Session = Depends(get_session)):
    """Verifies backend runtime, database connectivity, and environment."""
    db_status = "connected"
    try:
        session.exec(text("SELECT 1")).first()
    except Exception:
        db_status = "unavailable"
        
    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "service": "preconsult-ai-backend",
        "database": db_status,
        "database_connected": db_status == "connected",
        "environment": settings.ENVIRONMENT,
        "version": settings.APP_VERSION,
        "ai_mode": "deterministic_active"
    }
