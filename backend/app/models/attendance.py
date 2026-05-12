from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.connection import Base
from app.database.types import CompatibleJSON  # PostgreSQL'de JSONB, SQLite'da JSON


def _utcnow():
    return datetime.now(timezone.utc)


class AttendanceAttempt(Base):
    """3-step pipeline state: QR → Face → Location"""

    __tablename__ = "attendance_attempts"
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_attempt_student_session"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)

    # Step states: pending | verified | failed
    qr_status = Column(String, default="pending")
    face_status = Column(String, default="pending")
    location_status = Column(String, default="pending")

    face_confidence = Column(Float, nullable=True)
    location_distance_m = Column(Float, nullable=True)

    started_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    student = relationship("User", back_populates="attendance_attempts")
    session = relationship("AttendanceSession", back_populates="attempts")


class FinalAttendanceRecord(Base):
    """Finalized attendance record after verification pipeline"""

    __tablename__ = "final_attendance_records"
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_final_student_session"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)

    # present | absent | excused | pending_review
    status = Column(String, default="present")
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String, nullable=True)

    # Verification step details
    verification_steps = Column(CompatibleJSON, nullable=True)

    marked_at = Column(DateTime(timezone=True), default=_utcnow)

    student = relationship("User", back_populates="final_records")
    session = relationship("AttendanceSession", back_populates="final_records")
    course = relationship("Course")


class ClassCancellation(Base):
    __tablename__ = "class_cancellations"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="SET NULL"), nullable=True)
    instructor_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    date = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    notified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    course = relationship("Course")
    session = relationship("AttendanceSession", back_populates="cancellations")
    instructor = relationship("User")
