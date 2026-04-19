from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.database.connection import get_db
from app.models.dispute import AttendanceDispute
from app.models.user import User
from app.security.dependencies import get_current_user, require_student, require_instructor
from app.services.audit_service import log_action

router = APIRouter()


class DisputeCreate(BaseModel):
    session_id: int
    course_id: int
    reason: str


class DisputeReview(BaseModel):
    status: str   # approved | rejected
    instructor_notes: Optional[str] = None


def _serialize(d: AttendanceDispute) -> dict:
    return {
        "id": d.id,
        "student_id": d.student_id,
        "student_name": d.student.name if d.student else None,
        "session_id": d.session_id,
        "course_id": d.course_id,
        "course_code": d.course.code if d.course else None,
        "reason": d.reason,
        "status": d.status,
        "instructor_notes": d.instructor_notes,
        "reviewed_by_id": d.reviewed_by_id,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


@router.post("/", status_code=201)
def submit_dispute(
    data: DisputeCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    # Prevent duplicate disputes for same session
    existing = db.query(AttendanceDispute).filter(
        AttendanceDispute.student_id == current_user.id,
        AttendanceDispute.session_id == data.session_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu oturum için zaten bir itiraz gönderildi")

    dispute = AttendanceDispute(
        student_id=current_user.id,
        session_id=data.session_id,
        course_id=data.course_id,
        reason=data.reason,
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    log_action(db, "dispute_submitted", actor_id=current_user.id, actor_role="student",
               resource="attendance_dispute", resource_id=dispute.id,
               detail={"session_id": data.session_id, "course_id": data.course_id})
    return _serialize(dispute)


@router.get("/")
def get_disputes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AttendanceDispute)
    if current_user.role == "student":
        q = q.filter(AttendanceDispute.student_id == current_user.id)
    elif current_user.role == "instructor":
        from app.repositories.course_repo import CourseRepository
        my_ids = {c.id for c in CourseRepository(db).get_by_instructor(current_user.id)}
        q = q.filter(AttendanceDispute.course_id.in_(my_ids))
    disputes = q.order_by(AttendanceDispute.created_at.desc()).all()
    return [_serialize(d) for d in disputes]


@router.patch("/{dispute_id}")
def review_dispute(
    dispute_id: int,
    data: DisputeReview,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Geçersiz durum: approved veya rejected olmalı")

    dispute = db.query(AttendanceDispute).filter(AttendanceDispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="İtiraz bulunamadı")

    if current_user.role == "instructor":
        from app.repositories.course_repo import CourseRepository
        my_ids = {c.id for c in CourseRepository(db).get_by_instructor(current_user.id)}
        if dispute.course_id not in my_ids:
            raise HTTPException(status_code=403, detail="Bu itiraz üzerinde yetkiniz yok")

    old_status = dispute.status
    dispute.status = data.status
    dispute.instructor_notes = data.instructor_notes
    dispute.reviewed_by_id = current_user.id
    db.commit()
    db.refresh(dispute)

    # If approved, update the attendance record to present
    if data.status == "approved":
        from app.models.attendance import FinalAttendanceRecord
        record = db.query(FinalAttendanceRecord).filter(
            FinalAttendanceRecord.student_id == dispute.student_id,
            FinalAttendanceRecord.session_id == dispute.session_id,
        ).first()
        if record:
            record.status = "present"
            record.flag_reason = "İtiraz onaylandı"
            db.commit()

    log_action(db, "dispute_reviewed", actor_id=current_user.id, actor_role=current_user.role,
               resource="attendance_dispute", resource_id=dispute_id,
               detail={"old_status": old_status, "new_status": data.status})
    return _serialize(dispute)
