from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database.connection import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Notification(Base):
    """
    Persistent in-app notification record.

    Every business event that should surface in the notification bell/feed
    is written here.  Push (Expo) and email are fire-and-forget side-effects;
    this table is the source-of-truth for unread counts and notification history.

    type values (open enum — add as needed):
        flagged_attendance   — a student's record was flagged
        class_cancelled      — a class was cancelled
        session_started      — a new yoklama session opened
        excuse_pending       — a new excuse awaiting review
        excuse_reviewed      — instructor approved / rejected student's excuse
        system               — admin broadcast / system announcement
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    type = Column(String, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(String(1024), nullable=False)
    data = Column(JSON, nullable=True)       # extra navigation / context payload

    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
