from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database.connection import get_db
from app.models.user import User
from app.models.attendance import FinalAttendanceRecord
from app.models.session import AttendanceSession
from app.models.course import Course, Enrollment
from app.models.course_instructor import CourseInstructor
from app.security.dependencies import get_current_user, require_instructor, require_admin

router = APIRouter()


@router.get("/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dashboard statistics — role-aware"""
    if current_user.role == "student":
        return _student_stats(current_user, db)
    elif current_user.role == "instructor":
        return _instructor_stats(current_user, db)
    else:
        return _admin_stats(db)


def _admin_stats(db: Session) -> dict:
    total_students = db.query(User).filter(User.role == "student", User.is_active == True).count()
    total_instructors = db.query(User).filter(User.role == "instructor", User.is_active == True).count()
    total_courses = db.query(Course).count()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    active_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.status == "active"
    ).count()

    present_today = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.marked_at >= today_start
    ).count()

    flagged = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.is_flagged == True
    ).count()

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_records = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.marked_at >= thirty_days_ago
    ).count()

    return {
        "role": "admin",
        "total_students": total_students,
        "total_instructors": total_instructors,
        "total_courses": total_courses,
        "active_sessions": active_sessions,
        "present_today": present_today,
        "flagged_records": flagged,
        "recent_30d_records": recent_records,
    }


def _instructor_stats(user: User, db: Session) -> dict:
    courses = (
        db.query(Course)
        .join(CourseInstructor, CourseInstructor.course_id == Course.id)
        .filter(CourseInstructor.instructor_id == user.id)
        .all()
    )
    course_ids = [c.id for c in courses]

    total_enrolled = db.query(Enrollment).filter(
        Enrollment.course_id.in_(course_ids)
    ).count() if course_ids else 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    active_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.course_id.in_(course_ids),
        AttendanceSession.status == "active"
    ).count() if course_ids else 0

    today_records = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.course_id.in_(course_ids),
        FinalAttendanceRecord.marked_at >= today_start
    ).count() if course_ids else 0

    flagged = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.course_id.in_(course_ids),
        FinalAttendanceRecord.is_flagged == True
    ).count() if course_ids else 0

    return {
        "role": "instructor",
        "total_courses": len(courses),
        "total_enrolled": total_enrolled,
        "active_sessions": active_sessions,
        "present_today": today_records,
        "flagged_records": flagged,
    }


def _student_stats(user: User, db: Session) -> dict:
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == user.id).all()
    course_ids = [e.course_id for e in enrollments]

    total_records = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.student_id == user.id
    ).count()

    present_count = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.student_id == user.id,
        FinalAttendanceRecord.status == "present"
    ).count()

    attendance_rate = round((present_count / total_records * 100) if total_records > 0 else 0, 1)

    return {
        "role": "student",
        "enrolled_courses": len(course_ids),
        "total_sessions_attended": present_count,
        "total_sessions": total_records,
        "attendance_rate": attendance_rate if total_records > 0 else None,
        "has_attendance_data": total_records > 0,
    }


@router.get("/course-performance")
def course_performance(
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Per-course attendance performance for instructor"""
    if current_user.role == "admin":
        courses = db.query(Course).all()
    else:
        courses = (
            db.query(Course)
            .join(CourseInstructor, CourseInstructor.course_id == Course.id)
            .filter(CourseInstructor.instructor_id == current_user.id)
            .all()
        )

    if not courses:
        return []

    course_ids = [c.id for c in courses]

    # Tek GROUP BY sorgusuyla tüm derslerin enrollment sayılarını çek
    enrollment_counts = dict(
        db.query(Enrollment.course_id, func.count(Enrollment.student_id))
        .filter(Enrollment.course_id.in_(course_ids))
        .group_by(Enrollment.course_id)
        .all()
    )

    # Tek GROUP BY sorgusuyla tüm derslerin oturum sayılarını çek
    session_counts = dict(
        db.query(AttendanceSession.course_id, func.count(AttendanceSession.id))
        .filter(AttendanceSession.course_id.in_(course_ids))
        .group_by(AttendanceSession.course_id)
        .all()
    )

    # Tek GROUP BY sorgusuyla present kayıt sayılarını çek
    present_counts = dict(
        db.query(FinalAttendanceRecord.course_id, func.count(FinalAttendanceRecord.id))
        .filter(
            FinalAttendanceRecord.course_id.in_(course_ids),
            FinalAttendanceRecord.status == "present",
        )
        .group_by(FinalAttendanceRecord.course_id)
        .all()
    )

    result = []
    for course in courses:
        enrolled = enrollment_counts.get(course.id, 0)
        total_sessions = session_counts.get(course.id, 0)
        present_records = present_counts.get(course.id, 0)
        if total_sessions > 0 and enrolled > 0:
            rate = round((present_records / (total_sessions * enrolled)) * 100, 1)
        else:
            rate = 0
        result.append({
            "course_id": course.id,
            "course": course.code,
            "name": course.name,
            "attendance": rate,
            "students": enrolled,
        })
    return result


@router.get("/recent-activity")
def recent_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Last 10 attendance records visible to the requesting user"""
    q = db.query(FinalAttendanceRecord)
    if current_user.role == "student":
        q = q.filter(FinalAttendanceRecord.student_id == current_user.id)
    elif current_user.role == "instructor":
        courses = (
            db.query(Course)
            .join(CourseInstructor, CourseInstructor.course_id == Course.id)
            .filter(CourseInstructor.instructor_id == current_user.id)
            .all()
        )
        course_ids = [c.id for c in courses]
        if course_ids:
            q = q.filter(FinalAttendanceRecord.course_id.in_(course_ids))

    records = q.order_by(FinalAttendanceRecord.marked_at.desc()).limit(10).all()
    activities = []
    for r in records:
        activities.append({
            "type": "attendance",
            "record_id": r.id,
            "student_id": r.student_id,
            "course_id": r.course_id,
            "session_id": r.session_id,
            "status": r.status,
            "is_flagged": r.is_flagged,
            "timestamp": r.marked_at.isoformat(),
        })
    return {"activities": activities}


# Audit-log endpoint removed from dashboard router.
# Use the dedicated GET /api/v1/audit-logs/ endpoint (audit_logs.py) instead —
# it supports resource filtering and case-insensitive action matching.
