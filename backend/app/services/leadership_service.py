"""Leadership analytics queries with mandatory dean scope isolation."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session, Query

from app.api.admin_settings import get_setting_value
from app.models.attendance import FinalAttendanceRecord
from app.models.course import Course, Enrollment
from app.models.session import AttendanceSession
from app.models.user import User


_UNASSIGNED_DEPARTMENT = "Belirtilmemiş"
_MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class LeadershipScope:
    role: str
    department: Optional[str]  # None => university-wide (rector)


def resolve_scope(user: User) -> LeadershipScope:
    if user.role == "rector":
        return LeadershipScope(role="rector", department=None)
    if user.role == "dean":
        return LeadershipScope(role="dean", department=(user.scope_value or "").strip())
    raise ValueError("User is not a leadership role")


def _department_label(raw: Optional[str]) -> str:
    if raw and raw.strip():
        return raw.strip()
    return _UNASSIGNED_DEPARTMENT


def _scoped_students_query(db: Session, scope: LeadershipScope) -> Query:
    q = db.query(User).filter(User.role == "student", User.is_active.is_(True))
    if scope.department is not None:
        q = q.filter(User.department == scope.department)
    return q


def _scoped_records_query(db: Session, scope: LeadershipScope) -> Query:
    q = (
        db.query(FinalAttendanceRecord)
        .join(User, FinalAttendanceRecord.student_id == User.id)
        .filter(User.role == "student", User.is_active.is_(True))
    )
    if scope.department is not None:
        q = q.filter(User.department == scope.department)
    return q


def _attendance_rate(present: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((present / total) * 100, 1)


def _consecutive_absent_streak(db: Session, student_id: int) -> int:
    recent = (
        db.query(FinalAttendanceRecord)
        .filter(FinalAttendanceRecord.student_id == student_id)
        .order_by(FinalAttendanceRecord.marked_at.desc())
        .limit(3)
        .all()
    )
    streak = 0
    for record in recent:
        if record.status == "absent":
            streak += 1
        else:
            break
    return streak


def _classify_risk(attendance_rate: float, consecutive_absent: int, min_rate: float) -> Optional[str]:
    if attendance_rate < min_rate and consecutive_absent >= 3:
        return "critical"
    if attendance_rate < min_rate or consecutive_absent >= 3:
        return "potential"
    if min_rate <= attendance_rate < min_rate + 8:
        return "potential"
    return None


class LeadershipService:
    def __init__(self, db: Session):
        self.db = db

    def get_overview(self, scope: LeadershipScope) -> dict:
        student_count = _scoped_students_query(self.db, scope).count()

        records_q = _scoped_records_query(self.db, scope)
        total_records = records_q.count()
        present_count = records_q.filter(FinalAttendanceRecord.status == "present").count()
        flagged_count = records_q.filter(FinalAttendanceRecord.is_flagged.is_(True)).count()

        student_ids_sq = _scoped_students_query(self.db, scope).with_entities(User.id).scalar_subquery()
        active_courses = (
            self.db.query(func.count(func.distinct(Course.id)))
            .join(Enrollment, Enrollment.course_id == Course.id)
            .filter(Enrollment.student_id.in_(student_ids_sq))
            .scalar()
            or 0
        )

        active_sessions = (
            self.db.query(func.count(AttendanceSession.id))
            .filter(AttendanceSession.status == "active")
            .scalar()
            or 0
        )

        return {
            "role": scope.role,
            "scope_department": scope.department,
            "total_students": student_count,
            "average_attendance_rate": _attendance_rate(present_count, total_records),
            "active_courses": active_courses,
            "active_sessions": active_sessions,
            "flagged_records": flagged_count,
            "total_attendance_records": total_records,
        }

    def get_departments(self, scope: LeadershipScope) -> dict:
        if scope.role == "dean":
            return self._get_dean_courses(scope)

        rows = (
            self.db.query(
                User.department.label("department"),
                func.count(func.distinct(User.id)).label("student_count"),
                func.sum(
                    case((FinalAttendanceRecord.status == "present", 1), else_=0)
                ).label("present_count"),
                func.count(FinalAttendanceRecord.id).label("record_count"),
            )
            .outerjoin(
                FinalAttendanceRecord,
                FinalAttendanceRecord.student_id == User.id,
            )
            .filter(User.role == "student", User.is_active.is_(True))
            .group_by(User.department)
            .order_by(User.department)
            .all()
        )

        items = []
        for row in rows:
            present = int(row.present_count or 0)
            total = int(row.record_count or 0)
            items.append(
                {
                    "department": _department_label(row.department),
                    "student_count": int(row.student_count or 0),
                    "attendance_rate": _attendance_rate(present, total),
                    "record_count": total,
                }
            )

        return {"view": "departments", "items": items}

    def _get_dean_courses(self, scope: LeadershipScope) -> dict:
        # DISTINCT on full Course row fails on PostgreSQL because schedule is JSON
        # (no equality operator). Select course IDs first, then load courses.
        course_ids = [
            row[0]
            for row in (
                self.db.query(Course.id)
                .join(Enrollment, Enrollment.course_id == Course.id)
                .join(User, Enrollment.student_id == User.id)
                .filter(
                    User.role == "student",
                    User.is_active.is_(True),
                    User.department == scope.department,
                )
                .distinct()
                .all()
            )
        ]

        if not course_ids:
            return {"view": "courses", "items": []}

        course_rows = (
            self.db.query(Course)
            .filter(Course.id.in_(course_ids))
            .order_by(Course.code)
            .all()
        )

        items = []
        for course in course_rows:
            enrolled = (
                self.db.query(func.count(Enrollment.id))
                .join(User, Enrollment.student_id == User.id)
                .filter(
                    Enrollment.course_id == course.id,
                    User.role == "student",
                    User.is_active.is_(True),
                    User.department == scope.department,
                )
                .scalar()
                or 0
            )
            present = (
                self.db.query(func.count(FinalAttendanceRecord.id))
                .join(User, FinalAttendanceRecord.student_id == User.id)
                .filter(
                    FinalAttendanceRecord.course_id == course.id,
                    FinalAttendanceRecord.status == "present",
                    User.department == scope.department,
                )
                .scalar()
                or 0
            )
            total_sessions = (
                self.db.query(func.count(AttendanceSession.id))
                .filter(AttendanceSession.course_id == course.id)
                .scalar()
                or 0
            )
            denominator = total_sessions * enrolled if total_sessions and enrolled else 0
            items.append(
                {
                    "course_id": course.id,
                    "course_code": course.code,
                    "course_name": course.name,
                    "student_count": enrolled,
                    "attendance_rate": _attendance_rate(present, denominator),
                    "session_count": total_sessions,
                }
            )

        return {"view": "courses", "items": items}

    def get_at_risk(
        self,
        scope: LeadershipScope,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        page_size = min(max(page_size, 1), _MAX_PAGE_SIZE)
        page = max(page, 1)

        min_rate = float(get_setting_value(self.db, "min_attendance_rate", "70"))

        students = _scoped_students_query(self.db, scope).order_by(User.name).all()
        at_risk = []

        for student in students:
            total = (
                self.db.query(func.count(FinalAttendanceRecord.id))
                .filter(FinalAttendanceRecord.student_id == student.id)
                .scalar()
                or 0
            )
            if total == 0:
                continue

            present = (
                self.db.query(func.count(FinalAttendanceRecord.id))
                .filter(
                    FinalAttendanceRecord.student_id == student.id,
                    FinalAttendanceRecord.status == "present",
                )
                .scalar()
                or 0
            )
            rate = _attendance_rate(present, total)
            streak = _consecutive_absent_streak(self.db, student.id)
            risk_level = _classify_risk(rate, streak, min_rate)
            if not risk_level:
                continue

            at_risk.append(
                {
                    "id": student.id,
                    "name": student.name,
                    "student_number": student.student_number,
                    "department": _department_label(student.department),
                    "attendance_rate": rate,
                    "consecutive_absent": streak,
                    "risk_level": risk_level,
                }
            )

        at_risk.sort(
            key=lambda x: (
                0 if x["risk_level"] == "critical" else 1,
                x["attendance_rate"],
            )
        )

        total = len(at_risk)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "min_attendance_rate": min_rate,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total / page_size) if page_size else 1,
            "items": at_risk[start:end],
        }
