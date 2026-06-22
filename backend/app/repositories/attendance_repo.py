from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timezone
from app.models.attendance import AttendanceAttempt, FinalAttendanceRecord, ClassCancellation


class AttendanceAttemptRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_student_session(self, student_id: int, session_id: int) -> Optional[AttendanceAttempt]:
        return self.db.query(AttendanceAttempt).filter(
            AttendanceAttempt.student_id == student_id,
            AttendanceAttempt.session_id == session_id
        ).first()

    def create(self, student_id: int, session_id: int) -> AttendanceAttempt:
        attempt = AttendanceAttempt(student_id=student_id, session_id=session_id)
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def update(self, attempt: AttendanceAttempt, **kwargs) -> AttendanceAttempt:
        for key, value in kwargs.items():
            if hasattr(attempt, key):
                setattr(attempt, key, value)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt


class FinalAttendanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_student_session(self, student_id: int, session_id: int) -> Optional[FinalAttendanceRecord]:
        return self.db.query(FinalAttendanceRecord).filter(
            FinalAttendanceRecord.student_id == student_id,
            FinalAttendanceRecord.session_id == session_id
        ).first()

    def get_by_session(self, session_id: int) -> List[FinalAttendanceRecord]:
        return (
            self.db.query(FinalAttendanceRecord)
            .filter(FinalAttendanceRecord.session_id == session_id)
            .options(
                joinedload(FinalAttendanceRecord.student),
                joinedload(FinalAttendanceRecord.course),
            )
            .all()
        )

    def count_present_for_session(self, session_id: int) -> int:
        """Anonymous-friendly aggregate: finalized 'present' rows for this session."""
        return (
            self.db.query(FinalAttendanceRecord)
            .filter(
                FinalAttendanceRecord.session_id == session_id,
                FinalAttendanceRecord.status == "present",
            )
            .count()
        )

    def get_by_student(self, student_id: int) -> List[FinalAttendanceRecord]:
        return (
            self.db.query(FinalAttendanceRecord)
            .filter(FinalAttendanceRecord.student_id == student_id)
            .options(
                joinedload(FinalAttendanceRecord.student),
                joinedload(FinalAttendanceRecord.course),
            )
            .order_by(FinalAttendanceRecord.marked_at.desc())
            .all()
        )

    def get_flagged(self) -> List[FinalAttendanceRecord]:
        return self.db.query(FinalAttendanceRecord).filter(
            FinalAttendanceRecord.is_flagged == True
        ).options(
            joinedload(FinalAttendanceRecord.student),
            joinedload(FinalAttendanceRecord.course),
        ).order_by(FinalAttendanceRecord.marked_at.desc()).all()

    def get_all(
        self,
        course_id: Optional[int] = None,
        allowed_course_ids: Optional[List[int]] = None,
        date: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        """Returns paginated results with correct date range filtering.

        allowed_course_ids: when set, restricts results to this set of courses
        (used for instructor-scoped queries so COUNT(*) is also correct).
        Takes lower priority than an explicit course_id filter.
        """
        q = self.db.query(FinalAttendanceRecord)
        if course_id:
            q = q.filter(FinalAttendanceRecord.course_id == course_id)
        elif allowed_course_ids is not None:
            q = q.filter(FinalAttendanceRecord.course_id.in_(allowed_course_ids))
        if date:
            try:
                # Parse date and build exact day range
                day_start = datetime.strptime(date, "%Y-%m-%d").replace(
                    hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
                )
                day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
                q = q.filter(
                    FinalAttendanceRecord.marked_at >= day_start,
                    FinalAttendanceRecord.marked_at <= day_end,
                )
            except ValueError:
                pass  # Invalid date format — ignore filter

        total = q.count()
        offset = (page - 1) * page_size
        records = q.options(
            joinedload(FinalAttendanceRecord.student),
            joinedload(FinalAttendanceRecord.course),
        ).order_by(FinalAttendanceRecord.marked_at.desc()).offset(offset).limit(page_size).all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
            "records": records,
        }

    def create(
        self,
        student_id: int,
        session_id: int,
        course_id: int,
        is_flagged: bool = False,
        flag_reason: Optional[str] = None,
        verification_steps: Optional[dict] = None,
        status: str = "present",
    ) -> FinalAttendanceRecord:
        record = FinalAttendanceRecord(
            student_id=student_id,
            session_id=session_id,
            course_id=course_id,
            status=status,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            verification_steps=verification_steps,
        )
        self.db.add(record)
        try:
            self.db.commit()
            self.db.refresh(record)
            return record
        except IntegrityError:
            self.db.rollback()
            from fastapi import HTTPException
            raise HTTPException(
                status_code=409,
                detail="Bu oturum için yoklama zaten kaydedildi (eşzamanlılık hatası)"
            )

    def update(self, record: FinalAttendanceRecord, **kwargs) -> FinalAttendanceRecord:
        for key, value in kwargs.items():
            if hasattr(record, key):
                setattr(record, key, value)
        self.db.commit()
        self.db.refresh(record)
        return record


class CancellationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, course_id: Optional[int] = None) -> List[ClassCancellation]:
        q = self.db.query(ClassCancellation)
        if course_id:
            q = q.filter(ClassCancellation.course_id == course_id)
        return q.order_by(ClassCancellation.created_at.desc()).all()

    def create(self, course_id: int, instructor_id: int, date: str, reason: str,
               topic: Optional[str] = None,
               session_id: Optional[int] = None) -> ClassCancellation:
        cancellation = ClassCancellation(
            course_id=course_id,
            session_id=session_id,
            instructor_id=instructor_id,
            date=date,
            reason=reason,
            topic=topic,
            notified_at=datetime.now(timezone.utc),
        )
        self.db.add(cancellation)
        self.db.commit()
        self.db.refresh(cancellation)
        return cancellation
