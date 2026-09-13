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
                # clinical_records
                res_cr = session.exec(text("PRAGMA table_info(clinical_records)")).all()
                cols_cr = {row[1] for row in res_cr}
                if cols_cr:
                    if "review_status" not in cols_cr:
                        session.exec(text("ALTER TABLE clinical_records ADD COLUMN review_status VARCHAR DEFAULT 'DRAFT'"))
                    if "clinician_id" not in cols_cr:
                        session.exec(text("ALTER TABLE clinical_records ADD COLUMN clinician_id VARCHAR"))
                    if "rejection_reason" not in cols_cr:
                        session.exec(text("ALTER TABLE clinical_records ADD COLUMN rejection_reason VARCHAR"))

                # audit_logs
                res_al = session.exec(text("PRAGMA table_info(audit_logs)")).all()
                cols_al = {row[1] for row in res_al}
                if cols_al and "user_id" not in cols_al:
                    session.exec(text("ALTER TABLE audit_logs ADD COLUMN user_id VARCHAR"))

                # patient_intakes
                res_pi = session.exec(text("PRAGMA table_info(patient_intakes)")).all()
                cols_pi = {row[1] for row in res_pi}
                if cols_pi and "user_id" not in cols_pi:
                    session.exec(text("ALTER TABLE patient_intakes ADD COLUMN user_id VARCHAR"))

                # intake_sessions
                res_is = session.exec(text("PRAGMA table_info(intake_sessions)")).all()
                cols_is = {row[1] for row in res_is}
                if cols_is and "user_id" not in cols_is:
                    session.exec(text("ALTER TABLE intake_sessions ADD COLUMN user_id VARCHAR"))

                session.commit()
            except Exception as e:
                print(f"Warning running SQLite schema migration: {e}")


def get_session():
    """Dependency for yielding database sessions."""
    with Session(engine) as session:
        yield session
