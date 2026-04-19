from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.connection import Base


def _utcnow():
    return datetime.now(timezone.utc)


class AttendanceDispute(Base):
    """Student-submitted attendance dispute: 'I was there but system didn't mark me'."""
    __tablename__ = "attendance_disputes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    reason = Column(Text, nullable=False)
    # status: pending | approved | rejected
    status = Column(String, default="pending", nullable=False)
    instructor_notes = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    student = relationship("User", foreign_keys=[student_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    session = relationship("AttendanceSession")
    course = relationship("Course")
