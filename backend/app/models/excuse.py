from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base


class Excuse(Base):
    __tablename__ = "excuses"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=True)
    session_date = Column(String, nullable=False)   # "YYYY-MM-DD"
    excuse_type = Column(String, default="other")   # medical | family | other
    description = Column(Text, nullable=True)
    storage_path = Column(String, nullable=True)
    # status: pending | approved | rejected
    status = Column(String, default="pending")
    instructor_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("User", back_populates="excuses")
    course = relationship("Course")
    session = relationship("AttendanceSession")
