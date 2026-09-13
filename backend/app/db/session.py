from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite
)

def init_db():
    """Initializes database tables using SQLModel and applies schema updates."""
    # Import models so SQLModel registers them before create_all
    import app.models.db_models  # noqa: F401
    from sqlalchemy import text
    
    SQLModel.metadata.create_all(engine)

    # Automatically migrate missing columns on existing SQLite databases
    if engine.dialect.name == "sqlite":
        with Session(engine) as session:
            try:
                result = session.exec(text("PRAGMA table_info(clinical_records)")).all()
                existing_cols = {row[1] for row in result}
                if existing_cols:
                    if "review_status" not in existing_cols:
                        session.exec(text("ALTER TABLE clinical_records ADD COLUMN review_status VARCHAR DEFAULT 'DRAFT'"))
                    if "clinician_id" not in existing_cols:
                        session.exec(text("ALTER TABLE clinical_records ADD COLUMN clinician_id VARCHAR"))
                    if "rejection_reason" not in existing_cols:
                        session.exec(text("ALTER TABLE clinical_records ADD COLUMN rejection_reason VARCHAR"))
                    session.commit()
            except Exception:
                pass


def get_session():
    """Dependency for yielding database sessions."""
    with Session(engine) as session:
        yield session
