from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config.settings import settings

def create_postgres_engine(url: str):
    use_pgbouncer = "pgbouncer=true" in url.lower()
    connect_args = {
        "connect_timeout": 10,
        "sslmode": "require",
        "options": "-c statement_timeout=30000",
    }
    engine_kwargs = {
        "pool_size": 5,       # 2 workers * (5 + 10) = 30 max connections, safe for Supabase free tier(60).
        "max_overflow": 10,   # Short traffic bursts can borrow extra connections without permanent cost.
        "pool_timeout": 30,   # Fail fast after 30s instead of waiting indefinitely for pool checkout.
        "pool_recycle": 1800, # Recycle every 30 minutes to avoid stale/idle upstream connections.
        "pool_pre_ping": True,# Validate pooled connections before use to avoid stale socket failures.
        "connect_args": connect_args,
    }
    if use_pgbouncer:
        # Supabase transaction-mode pooler does not support prepared statements.
        engine_kwargs["execution_options"] = {"no_parameters": True}
    return create_engine(url, **engine_kwargs)

if "sqlite" in settings.DATABASE_URL.lower():
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_postgres_engine(settings.DATABASE_URL)
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
