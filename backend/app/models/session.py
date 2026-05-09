from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.connection import Base


def _utcnow():
    return datetime.now(timezone.utc)


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    date = Column(String, nullable=False)          # "YYYY-MM-DD"
    start_time = Column(String, nullable=True)     # "HH:MM"
    end_time = Column(String, nullable=True)
    # status: active | closed | cancelled
    status = Column(String, default="active")
    qr_token = Column(String, unique=True, nullable=True)
    qr_token_issued_at = Column(DateTime(timezone=True), nullable=True)
    static_qr_token = Column(String, unique=True, nullable=True)  # slayt/sunum için sabit QR
    # Optional GPS for sessions created with coordinates
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geofence_radius = Column(Integer, nullable=True)  # odadan kopyalanır, NULL ise settings default kullanılır
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    course = relationship("Course", back_populates="sessions")
    created_by = relationship("User", foreign_keys=[created_by_id])
    attempts = relationship("AttendanceAttempt", back_populates="session")
    final_records = relationship("FinalAttendanceRecord", back_populates="session")
    cancellations = relationship("ClassCancellation", back_populates="session")
