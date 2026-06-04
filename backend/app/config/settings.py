import os
import warnings
from pathlib import Path

from dotenv import load_dotenv

# backend/ — always load this folder's .env (not cwd), so uvicorn from any directory works.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BACKEND_ROOT.parent

# Prefer backend/.env; optional repo-root .env fills only missing keys (e.g. Docker-compose split).
load_dotenv(_BACKEND_ROOT / ".env")
load_dotenv(_REPO_ROOT / ".env", override=False)

_UNSAFE_SECRET = "change-this-in-production-super-secret-key"
_UNSAFE_ADMIN_PASS = "admin123"


def _resolve_sqlite_url(url: str) -> str:
    """Anchor relative SQLite file paths to backend/, not process cwd."""
    if not url.lower().startswith("sqlite"):
        return url
    prefix = "sqlite:///"
    rest = url[len(prefix) :]
    lower = rest.lower()
    if lower.startswith(":memory:") or "mode=memory" in lower:
        return url
    path_part = rest.split("?", 1)[0]
    try:
        path_obj = Path(path_part)
    except ValueError:
        return url
    if path_obj.is_absolute():
        return url
    abs_path = (_BACKEND_ROOT / path_part).resolve()
    if "?" in rest:
        qs = rest.split("?", 1)[1]
        return f"sqlite:///{abs_path.as_posix()}?{qs}"
    return f"sqlite:///{abs_path.as_posix()}"


class Settings:
    # ── Database ─────────────────────────────────────────────────────────────
    ENV: str = os.getenv("ENV", "development").lower()
    TESTING: bool = (
        os.getenv("TESTING", "false").lower() == "true"
        or os.getenv("PYTEST_CURRENT_TEST") is not None
        or ENV == "test"
    )
    _DATABASE_URL_RAW: str = os.getenv("DATABASE_URL", "sqlite:///./smart_attendance.db")
    DATABASE_URL: str = (
        _resolve_sqlite_url("sqlite:///./test.db")
        if TESTING
        else _resolve_sqlite_url(_DATABASE_URL_RAW)
    )
    if TESTING and "postgresql" in _DATABASE_URL_RAW.lower():
        raise RuntimeError(
            "Unsafe test configuration: TESTING=true while DATABASE_URL points to PostgreSQL. "
            "Use a dedicated test database URL (for example sqlite:///./test.db)."
        )
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY", _UNSAFE_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,http://localhost:8081,"
            "http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:8081",
        ).split(",")
        if o.strip()
    ]

    # ── Face Recognition ─────────────────────────────────────────────────────
    FACE_SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.42"))
    # Liveness: iki kare arası benzerlik alt sınırı — 0.15 aşırı hareketi/farklı kişiyi yakalar
    FACE_LIVENESS_THRESHOLD: float = float(os.getenv("FACE_LIVENESS_THRESHOLD", "0.15"))

    # ── Geofencing ───────────────────────────────────────────────────────────
    DEFAULT_GEOFENCE_RADIUS_M: int = int(os.getenv("DEFAULT_GEOFENCE_RADIUS_M", "100"))
    # GPS doğruluğu 40m üstüyse red — şehir içi mobil GPS için gerçekçi eşik
    MAX_GPS_ACCURACY_M: float = float(os.getenv("MAX_GPS_ACCURACY_M", "40.0"))
    GPS_ACCURACY_THRESHOLD: float = float(os.getenv("GPS_ACCURACY_THRESHOLD", "40.0"))

    # ── Admin defaults ───────────────────────────────────────────────────────
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@attendance.com")
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", _UNSAFE_ADMIN_PASS)
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "System Administrator")

    # ── Push Notifications (Expo) ─────────────────────────────────────────────
    EXPO_PUSH_URL: str = "https://exp.host/--/api/v2/push/send"

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    LOGIN_RATE_LIMIT: str = os.getenv("LOGIN_RATE_LIMIT", "10/minute")

    # ── QR Token TTL ──────────────────────────────────────────────────────────
    QR_TOKEN_TTL_SECONDS: int = int(os.getenv("QR_TOKEN_TTL_SECONDS", "90"))

    # ── Cookies ───────────────────────────────────────────────────────────────
    # Set COOKIE_SECURE=true in production (requires HTTPS).
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    # "lax" is safe for same-site navigation; use "strict" for maximum security.
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")
    # Leave empty for localhost; set to ".yourdomain.com" in production.
    COOKIE_DOMAIN: str = os.getenv("COOKIE_DOMAIN", "") or ""

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"


settings = Settings()

# ── Production safety warnings ───────────────────────────────────────────────
if settings.SECRET_KEY == _UNSAFE_SECRET:
    warnings.warn(
        "\n⚠️  SECURITY WARNING: Using default SECRET_KEY! "
        "Set the SECRET_KEY environment variable before production deployment.",
        stacklevel=2,
    )

if settings.ADMIN_PASSWORD == _UNSAFE_ADMIN_PASS:
    warnings.warn(
        "\n⚠️  SECURITY WARNING: Using default admin password 'admin123'! "
        "Set the ADMIN_PASSWORD environment variable before production deployment.",
        stacklevel=2,
    )

if settings.DEBUG:
    warnings.warn(
        "\n⚠️  DEBUG mode is ON. Stack traces will be visible in API responses. "
        "Set DEBUG=false for production.",
        stacklevel=2,
    )

if not settings.TESTING:
    _is_prod = settings.ENV == "production"

    if not settings.SUPABASE_URL:
        warnings.warn(
            "SUPABASE_URL not set. Storage features unavailable.",
            stacklevel=2,
        )
    if not settings.SUPABASE_SERVICE_KEY:
        warnings.warn(
            "SUPABASE_SERVICE_KEY not set. Storage features unavailable.",
            stacklevel=2,
        )
    if not settings.ENCRYPTION_KEY:
        if _is_prod:
            raise RuntimeError(
                "ENCRYPTION_KEY is required in production. "
                "Refusing to start without it — biometric data would be stored unencrypted. "
                "Generate a key with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        warnings.warn(
            "ENCRYPTION_KEY not set. Face embeddings unencrypted.",
            stacklevel=2,
        )
