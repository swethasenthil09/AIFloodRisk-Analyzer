"""
Database Engine and Session Management.
Supports MySQL with seamless, automatic fallback to local SQLite.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

def _create_database_engine():
    db_url = settings.DATABASE_URL
    if "mysql" in db_url:
        try:
            eng = create_engine(db_url, pool_pre_ping=True)
            # Verify actual database connectivity
            with eng.connect() as conn:
                pass
            print("[Database] Successfully connected to MySQL database.")
            return eng
        except Exception as e:
            print(f"[Database] Warning: MySQL connection failed ({e}). Falling back to local SQLite.")
            return create_engine(
                settings.SQLITE_URL,
                connect_args={"check_same_thread": False},
                pool_pre_ping=True
            )
    return create_engine(
        settings.SQLITE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )

engine = _create_database_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
