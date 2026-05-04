import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List

from app.database.connection import get_db
from app.models.dispute import AttendanceDispute
from app.models.user import User
from app.security.dependencies import get_current_user, require_student, require_instructor
from app.services.audit_service import log_action

router = APIRouter()
logger = logging.getLogger(__name__)


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
        "attendance_record_id": d.attendance_record_id,
        "reason": d.reason,
        "status": d.status,
        "instructor_notes": d.instructor_notes,
        "reviewed_by_id": d.reviewed_by_id,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


# ── Notification helpers (fail-safe) ─────────────────────────────────────────
# Her iki fonksiyon da herhangi bir bildirim hatasının ana iş akışını
# (itiraz kaydetme / inceleme) kesmemesini garanti eder.

def _notify_student_dispute_reviewed(
    db: Session,
    dispute: AttendanceDispute,
    new_status: str,
    instructor_notes: Optional[str],
) -> None:
    """
    İtiraz incelendiğinde öğrenciye DB + Push bildirimi gönder.

    dispute.student ve dispute.course joinedload ile yüklenmiş olmalı.
    """
    try:
        from app.services.notification_service import create_notification
        from app.utils.push import send_expo_push

        student = dispute.student
        course_code = dispute.course.code if dispute.course else f"Ders #{dispute.course_id}"

        if new_status == "approved":
            title = "İtirazınız Onaylandı"
            body = (
                f"{course_code} dersi yoklamanız 'Katıldı' olarak güncellendi."
            )
            notif_type = "dispute_approved"
        else:
            title = "İtirazınız İncelendi"
            body = f"{course_code} dersi itirazınız reddedildi."
            if instructor_notes:
                # Öğretmen notu 100 karakterle kısıtla (push payload boyutu)
                note_preview = instructor_notes[:100]
                body += f" Not: {note_preview}"
            notif_type = "dispute_rejected"

        notif_data = {
            "type": notif_type,
            "dispute_id": dispute.id,
            "session_id": dispute.session_id,
            "course_id": dispute.course_id,
        }

        # 1. DB kaydı — "Bildirimler" sekmesinde kalıcı görünür
        notif = create_notification(
            db=db,
            user_id=student.id,
            type=notif_type,
            title=title,
            body=body,
            data=notif_data,
        )

        # 2. Push — öğrencinin telefonu varsa anlık bildirim
        if student.push_token:
            send_expo_push(
                tokens=[student.push_token],
                title=title,
                body=body,
                data={
                    **notif_data,
                    # Mobil uygulama bu ID ile PATCH /notifications/{id}/read çağırır
                    "notificationId": notif.id if notif else None,
                },
            )
    except Exception as exc:
        logger.warning(
            "_notify_student_dispute_reviewed failed (non-critical): %s", exc
        )


def _notify_instructor_dispute_submitted(
    db: Session,
    dispute: AttendanceDispute,
    student_name: str,
) -> None:
    """
    Yeni itiraz gönderildiğinde derse ait hocaya DB + Push bildirimi gönder.
    """
    try:
        from app.repositories.course_repo import CourseRepository
        from app.services.notification_service import create_notification
        from app.utils.push import send_expo_push

        course = CourseRepository(db).get_by_id(dispute.course_id)
        if not course or not course.instructor_id:
            return

        instructor = db.query(User).filter(User.id == course.instructor_id).first()
        if not instructor:
            return

        course_code = course.code
        title = "Yeni İtiraz"
        body = f"{student_name} — {course_code} dersi için itiraz gönderdi."
        notif_type = "dispute_submitted"
        notif_data = {
            "type": notif_type,
            "dispute_id": dispute.id,
            "session_id": dispute.session_id,
            "course_id": dispute.course_id,
        }

        notif = create_notification(
            db=db,
            user_id=instructor.id,
            type=notif_type,
            title=title,
            body=body,
            data=notif_data,
        )

        if instructor.push_token:
            send_expo_push(
                tokens=[instructor.push_token],
                title=title,
                body=body,
                data={
                    **notif_data,
                    "notificationId": notif.id if notif else None,
                },
            )
    except Exception as exc:
        logger.warning(
            "_notify_instructor_dispute_submitted failed (non-critical): %s", exc
        )


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

    # Mevcut yoklama kaydını bul — varsa direkt FK ile bağla
    from app.models.attendance import FinalAttendanceRecord
    existing_record = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.student_id == current_user.id,
        FinalAttendanceRecord.session_id == data.session_id,
    ).first()

    dispute = AttendanceDispute(
        student_id=current_user.id,
        session_id=data.session_id,
        course_id=data.course_id,
        reason=data.reason,
        attendance_record_id=existing_record.id if existing_record else None,
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    log_action(db, "dispute_submitted", actor_id=current_user.id, actor_role="student",
               resource="attendance_dispute", resource_id=dispute.id,
               detail={"session_id": data.session_id, "course_id": data.course_id})

    # Hocaya yeni itiraz bildirimi (fail-safe)
    _notify_instructor_dispute_submitted(db, dispute, current_user.name)

    return _serialize(dispute)


@router.get("/")
def get_disputes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AttendanceDispute).options(
        joinedload(AttendanceDispute.student),
        joinedload(AttendanceDispute.course),
    )
    if current_user.role == "student":
        q = q.filter(AttendanceDispute.student_id == current_user.id)
    elif current_user.role == "instructor":
        from app.repositories.course_repo import CourseRepository
        my_ids = [c.id for c in CourseRepository(db).get_by_instructor(current_user.id)]
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

    dispute = (
        db.query(AttendanceDispute)
        .options(
            joinedload(AttendanceDispute.student),
            joinedload(AttendanceDispute.course),
            joinedload(AttendanceDispute.attendance_record),
        )
        .filter(AttendanceDispute.id == dispute_id)
        .first()
    )
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

    # If approved, update the attendance record to present.
    # Önce direkt FK'dan al (hız + veri tutarlılığı); yoksa student+session ile bul (eski kayıtlar).
    if data.status == "approved":
        record = dispute.attendance_record
        if not record:
            from app.models.attendance import FinalAttendanceRecord
            record = db.query(FinalAttendanceRecord).filter(
                FinalAttendanceRecord.student_id == dispute.student_id,
                FinalAttendanceRecord.session_id == dispute.session_id,
            ).first()
        if record:
            record.status = "present"
            record.flag_reason = "İtiraz onaylandı"
            db.commit()

    # Öğrenciye bildirim (DB + Push, fail-safe)
    _notify_student_dispute_reviewed(db, dispute, data.status, data.instructor_notes)

    log_action(db, "dispute_reviewed", actor_id=current_user.id, actor_role=current_user.role,
               resource="attendance_dispute", resource_id=dispute_id,
               detail={"old_status": old_status, "new_status": data.status})
    return _serialize(dispute)
