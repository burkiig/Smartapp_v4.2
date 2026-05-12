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
    student_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="RESTRICT"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    reason = Column(Text, nullable=False)
    # status: pending | approved | rejected
    status = Column(String, default="pending", nullable=False)
    instructor_notes = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Direkt FK — itiraz hangi yoklama kaydını hedefliyor?
    # NULL: öğrencinin o oturum için yoklama kaydı henüz yoksa
    #       (örn. hiç katılmadı, kayıt oluşmadı)
    # SET NULL: yoklama kaydı silinirse itiraz kaybolmaz, FK sadece NULL olur
    attendance_record_id = Column(
        Integer,
        ForeignKey("final_attendance_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    student = relationship("User", foreign_keys=[student_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    session = relationship("AttendanceSession")
    course = relationship("Course")
    attendance_record = relationship(
        "FinalAttendanceRecord",
        foreign_keys=[attendance_record_id],
    )
