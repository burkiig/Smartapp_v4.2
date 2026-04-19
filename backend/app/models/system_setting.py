from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from app.database.connection import Base


def _utcnow():
    return datetime.now(timezone.utc)


class SystemSetting(Base):
    """Key-value store for admin-configurable system settings."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
