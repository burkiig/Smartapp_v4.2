from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.connection import Base


class Excuse(Base):
    __tablename__ = "excuses"
    __table_args__ = (
        # Aynı oturum için birden fazla mazeret engelleyen DB-level kısıtı.
        # session_id NULL ise (oturum bağlantısız mazeret) kısıt devreye girmez;
        # bu durum için uygulama katmanı (course_id + session_date) kombinasyonunu
        # kontrol eder.
        UniqueConstraint("student_id", "session_id", name="uq_excuse_student_session"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="SET NULL"), nullable=True)
    session_date = Column(String, nullable=False)   # "YYYY-MM-DD"
    excuse_type = Column(String, default="other")   # medical | family | other
    description = Column(Text, nullable=True)
    storage_path = Column(String, nullable=True)
    # status: pending | approved | rejected
    status = Column(String, default="pending")
    instructor_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    student = relationship("User", back_populates="excuses")
    course = relationship("Course")
    session = relationship("AttendanceSession")

    @property
    def student_name(self) -> str | None:
        return self.student.name if self.student else None

    @property
    def student_number(self) -> str | None:
        return self.student.student_number if self.student else None

    @property
    def course_code(self) -> str | None:
        return self.course.code if self.course else None

    @property
    def course_name(self) -> str | None:
        return self.course.name if self.course else None
