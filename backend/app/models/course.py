from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.connection import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # JSON: {"days": ["Monday","Wednesday"], "start_time": "09:00", "end_time": "10:30"}
    schedule = Column(JSON, nullable=True)
    # Session template: default duration in minutes for sessions of this course
    default_duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    instructor = relationship("User", foreign_keys=[instructor_id])
    enrollments = relationship("Enrollment", back_populates="course")
    sessions = relationship("AttendanceSession", back_populates="course")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_enrollment_student_course"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=_utcnow)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
