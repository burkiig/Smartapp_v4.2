from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config.settings import settings
from app.core.startup import on_startup
from app.api import auth, sessions, attendance, face, users, courses, rooms, excuses, dashboard
from app.api import audit_logs, admin_settings, disputes
from app.middleware.sanitization import SanitizationMiddleware


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
# Only allow explicitly listed origins. No regex wildcards.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
app.include_router(disputes.router,    prefix="/api/v1/disputes",         tags=["Disputes"])


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
