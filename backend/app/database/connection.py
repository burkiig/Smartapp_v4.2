from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config.settings import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    """SQLite per-connection performance & integrity pragmas.

    - journal_mode=WAL  → concurrent readers + single writer (yüksek throughput)
    - foreign_keys=ON   → SQLite default OFF; FK constraint'lerini gerçekten zorla
    - synchronous=NORMAL → WAL ile birlikte güvenli & hızlı (FULL'a kıyasla ~2x)
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    from app.models import user, course, room, session, attendance, face_reference, excuse, audit_log  # noqa: F401
    Base.metadata.create_all(bind=engine)
