from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import time

from sqlalchemy import text

from app.config.settings import settings
from app.core.startup import on_startup
from app.api import auth, sessions, attendance, face, users, courses, rooms, excuses, dashboard
from app.api import audit_logs, admin_settings, disputes, notifications
from app.middleware.sanitization import SanitizationMiddleware
from app.database.connection import SessionLocal, engine
from app.adapters.supabase_storage import get_storage_adapter


@asynccontextmanager
async def lifespan(app: FastAPI):
    await on_startup()
    yield


# In production (DEBUG=False), disable public Swagger UI
app = FastAPI(
    title="Smart Attendance System API",
    version="3.0.0",
    description="Unified Smart Attendance System — FastAPI backend",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# ── Sanitization middleware (body size, content-type, pattern scan) ──────────
app.add_middleware(SanitizationMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Capacitor and Expo WebView origins are added unconditionally for dev/mobile.
# Production deployments should set CORS_ORIGINS via environment variable.
_MOBILE_ORIGINS = [
    "capacitor://localhost",   # Capacitor iOS/Android WebView
    "http://localhost",        # Capacitor Android HTTP (port-less)
    "http://localhost:8081",   # Expo web dev server
    "http://localhost:19006",  # Expo web alternative port
]
_cors_origins = list(dict.fromkeys(settings.CORS_ORIGINS + _MOBILE_ORIGINS))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Requested-With",
        "Cache-Control",
        "X-HTTP-Method-Override",
    ],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/v1/auth",       tags=["Auth"])
app.include_router(users.router,      prefix="/api/v1/users",      tags=["Users"])
app.include_router(courses.router,    prefix="/api/v1/courses",    tags=["Courses"])
app.include_router(rooms.router,      prefix="/api/v1/rooms",      tags=["Rooms"])
app.include_router(sessions.router,   prefix="/api/v1/sessions",   tags=["Sessions"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["Attendance"])
app.include_router(face.router,       prefix="/api/v1/face",       tags=["Face"])
app.include_router(excuses.router,    prefix="/api/v1/excuses",    tags=["Excuses"])
app.include_router(dashboard.router,   prefix="/api/v1/dashboard",       tags=["Dashboard"])
app.include_router(audit_logs.router,  prefix="/api/v1/audit-logs",      tags=["AuditLogs"])
app.include_router(admin_settings.router, prefix="/api/v1/admin/settings", tags=["AdminSettings"])
app.include_router(disputes.router,       prefix="/api/v1/disputes",         tags=["Disputes"])
app.include_router(notifications.router, prefix="/api/v1/notifications",    tags=["Notifications"])


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions so they return through CORSMiddleware (CORS headers preserved)."""
    import logging
    logging.getLogger(__name__).error("Unhandled exception: %s %s — %r", request.method, request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Sunucu hatası"})


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "3.0.0"}


@app.get("/api/v1/health", tags=["Health"])
def api_health():
    return {"status": "ok", "version": "3.0.0"}


@app.get("/health/ready", tags=["Health"])
def readiness_health():
    db_connected = False
    response_time_ms = 0.0
    db_error = None
    start = time.perf_counter()
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as exc:
        db_error = str(exc)
    finally:
        response_time_ms = (time.perf_counter() - start) * 1000
        try:
            db.close()
        except Exception:
            pass

    checked_out = 0
    pool_size = 0
    overflow = 0
    available = 0
    if hasattr(engine, "pool"):
        checked_out = engine.pool.checkedout()
        pool_size = engine.pool.size()
        overflow = engine.pool.overflow()
        available = max(pool_size - checked_out, 0)

    supabase_configured = bool(settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY)
    storage_ok = False
    if supabase_configured:
        storage_ok = get_storage_adapter().ping()

    # If Supabase is not configured (local/dev mode), skip storage check.
    storage_healthy = (not supabase_configured) or storage_ok
    status = "healthy" if db_connected and storage_healthy else "unhealthy"
    payload = {
        "status": status,
        "db": {
            "connected": db_connected,
            "response_time_ms": round(response_time_ms, 2),
            "pool": {
                "checked_out": checked_out,
                "size": pool_size,
                "overflow": overflow,
                "available": available,
            },
            "error": db_error,
        },
        "storage": {
            "configured": supabase_configured,
            "reachable": storage_ok if supabase_configured else None,
        },
        "version": "3.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if not db_connected or not storage_healthy:
        return JSONResponse(status_code=503, content=payload)
    return payload
