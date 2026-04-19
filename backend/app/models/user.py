from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.connection import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    # role: admin | instructor | student
    role = Column(String, nullable=False, default="student")
    department = Column(String, nullable=True)
    student_number = Column(String, nullable=True)
    push_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    face_reference = relationship("FaceReference", back_populates="user", uselist=False)
    enrollments = relationship("Enrollment", back_populates="student")
    attendance_attempts = relationship("AttendanceAttempt", back_populates="student")
    final_records = relationship("FinalAttendanceRecord", back_populates="student")
    excuses = relationship("Excuse", back_populates="student")
