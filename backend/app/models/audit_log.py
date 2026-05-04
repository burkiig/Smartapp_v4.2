from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database.connection import Base
from app.database.types import CompatibleJSON  # PostgreSQL'de JSONB, SQLite'da JSON


def _utcnow():
    return datetime.now(timezone.utc)


class AuditLog(Base):
    """Immutable record of security-sensitive and business-critical actions."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    # Who did the action (None for anonymous/system events)
    actor_id = Column(Integer, nullable=True, index=True)
    actor_role = Column(String, nullable=True)
    # What happened
    action = Column(
        String, nullable=False, index=True
    )  # e.g. "login_success", "attendance_marked"
    resource = Column(String, nullable=True)  # e.g. "user", "attendance_record"
    resource_id = Column(Integer, nullable=True)
    # Extra context (IP, old/new values, etc.)
    detail = Column(CompatibleJSON, nullable=True)
    # Network context
    ip_address = Column(String, nullable=True)
    # When
    created_at = Column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
