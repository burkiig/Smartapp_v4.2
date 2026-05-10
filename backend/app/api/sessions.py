from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

from app.database.connection import get_db
from app.schemas.session import SessionCreate, SessionResponse, SessionPublicResponse
from app.schemas.attendance import CancellationCreate, CancellationResponse
from app.services.session_service import SessionService
from app.repositories.session_repo import SessionRepository
from app.repositories.attendance_repo import CancellationRepository, FinalAttendanceRepository
from app.repositories.course_repo import CourseRepository
from app.security.dependencies import get_current_user, require_instructor
from app.models.user import User
from app.utils.qr import build_qr_payload, generate_qr_image_base64, generate_qr_token
from app.utils.push import send_expo_push
from app.config.settings import settings

router = APIRouter()


def _session_to_response(session, qr_image: Optional[str] = None) -> dict:
    data = SessionResponse.model_validate(session).model_dump()
    data["qr_image"] = qr_image
    return data


@router.get("/")
def get_sessions(
    course_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    repo = SessionRepository(db)
    sessions = repo.get_all(course_id=course_id, status=status)
    if current_user.role == "student":
        return [SessionPublicResponse.model_validate(s) for s in sessions]
    return [SessionResponse.model_validate(s) for s in sessions]


@router.get("/active")
def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    repo = SessionRepository(db)
    sessions = repo.get_active()
    if current_user.role == "student":
        return [SessionPublicResponse.model_validate(s) for s in sessions]
    return [SessionResponse.model_validate(s) for s in sessions]


@router.post("/start")
def start_session(
    data: SessionCreate,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    """Start a new attendance session (instructor/admin)"""
    service = SessionService(db)

    # Apply session template: if end_time not provided, derive from default_duration_minutes
    end_time = data.end_time
    if not end_time and not data.end_time:
        course = CourseRepository(db).get_by_id(data.course_id)
        if course and course.default_duration_minutes and data.start_time:
            from datetime import datetime, timedelta
            try:
                start_dt = datetime.strptime(data.start_time, "%H:%M")
                end_dt = start_dt + timedelta(minutes=course.default_duration_minutes)
                end_time = end_dt.strftime("%H:%M")
            except ValueError:
                pass

    session = service.start_session(
        course_id=data.course_id,
        created_by=current_user,
        latitude=data.latitude,
        longitude=data.longitude,
        room_id=data.room_id,
        date=data.date,
        start_time=data.start_time,
        end_time=end_time,
    )
    payload = build_qr_payload(session.id, session.course_id, session.qr_token)
    qr_image = generate_qr_image_base64(payload)

    static_payload = build_qr_payload(session.id, session.course_id, session.static_qr_token)
    static_qr_image = generate_qr_image_base64(static_payload)

    # Notify enrolled students: push + DB notification
    try:
        from app.repositories.course_repo import EnrollmentRepository
        from app.repositories.user_repo import UserRepository
        from app.services.notification_service import create_notification
        enroll_repo = EnrollmentRepository(db)
        user_repo = UserRepository(db)
        course = CourseRepository(db).get_by_id(session.course_id)
        course_name = course.code if course else f"Ders #{session.course_id}"
        enrollments = enroll_repo.get_by_course(session.course_id)
        base_data = {"type": "session_started", "session_id": session.id, "course_id": session.course_id}
        notif_title = "📋 Yoklama Başladı"
        notif_body = f"{course_name} dersi için yoklama açıldı. Hemen yoklamanı al!"
        push_items = []  # (token, notificationId)
        for e in enrollments:
            student = user_repo.get_by_id(e.student_id)
            if not student:
                continue
            db_notif = create_notification(
                db=db,
                user_id=student.id,
                type="session_started",
                title=notif_title,
                body=notif_body,
                data=base_data,
            )
            if student.push_token:
                push_items.append((student.push_token, db_notif.id if db_notif else None))
        if push_items:
            # Group by notificationId is per-user; batch all tokens for efficiency.
            # The notificationId in data lets mobile auto-mark on tap.
            tokens = [t for t, _ in push_items]
            # Send a common push — individual notificationId mapping is best-effort.
            send_expo_push(
                tokens=tokens,
                title=notif_title,
                body=notif_body,
                data=base_data,
            )
    except Exception:
        pass

    data = _session_to_response(session, qr_image)
    data["static_qr_image"] = static_qr_image
    return {"success": True, "session": data}


@router.post("/{session_id}/end")
def end_session(
    session_id: int,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    service = SessionService(db)
    session = service.end_session(session_id, current_user)

    # Feature 7: Notify absent students asynchronously
    try:
        from app.database.connection import SessionLocal
        from app.services.notification_service import notify_absent_students
        import threading
        threading.Thread(
            target=notify_absent_students,
            args=(session_id, SessionLocal),
            daemon=True,
        ).start()
    except Exception:
        pass

    return {"success": True, "session": SessionResponse.model_validate(session)}


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    repo = SessionRepository(db)
    session = repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    return session


@router.get("/{session_id}/static-qr")
def get_static_qr(
    session_id: int,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    """Statik QR görüntüsünü döner — slayt/sunum için, TTL'den muaf."""
    repo = SessionRepository(db)
    session = repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Oturum aktif değil")
    if not session.static_qr_token:
        raise HTTPException(status_code=404, detail="Bu oturum için statik QR bulunamadı")
    payload = build_qr_payload(session.id, session.course_id, session.static_qr_token)
    qr_image = generate_qr_image_base64(payload)
    return {"success": True, "qr_image": qr_image, "session_id": session_id}


@router.get("/{session_id}/qr")
def get_session_qr(
    session_id: int,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    service = SessionService(db)
    qr_image = service.get_qr_image(session_id)
    return {"success": True, "qr_image": qr_image}


@router.get("/{session_id}/public-stats")
def get_session_public_stats(
    session_id: int,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    """Counts present check-ins only — no student names (projector-safe)."""
    repo = SessionRepository(db)
    session = repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Yalnızca aktif oturumlar için istatistik alınabilir")

    if current_user.role == "instructor":
        course_repo = CourseRepository(db)
        my_ids = {c.id for c in course_repo.get_by_instructor(current_user.id)}
        if session.course_id not in my_ids:
            raise HTTPException(status_code=403, detail="Bu oturum üzerinde yetkiniz yok")

    count = FinalAttendanceRepository(db).count_present_for_session(session_id)
    return {
        "session_id": session_id,
        "checked_in_count": count,
    }


@router.post("/{session_id}/rotate-qr")
def rotate_qr(
    session_id: int,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    """Rotate the QR token for an active session (anti-replay: old token immediately invalidated)."""
    from datetime import datetime, timezone

    repo = SessionRepository(db)
    session = repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Yalnızca aktif oturumların QR kodu yenilenebilir")

    # Instructor scope check
    if current_user.role == "instructor":
        course_repo = CourseRepository(db)
        my_ids = {c.id for c in course_repo.get_by_instructor(current_user.id)}
        if session.course_id not in my_ids:
            raise HTTPException(status_code=403, detail="Bu oturum üzerinde yetkiniz yok")

    new_token = generate_qr_token()
    repo.update(session, qr_token=new_token, qr_token_issued_at=datetime.now(timezone.utc))

    payload = build_qr_payload(session.id, session.course_id, new_token)
    qr_image = generate_qr_image_base64(payload)
    return {
        "success": True,
        "qr_image": qr_image,
        "ttl_seconds": settings.QR_TOKEN_TTL_SECONDS,
    }


# ── Class Cancellation ────────────────────────────────────────────────────────

@router.post("/cancel")
def cancel_class(
    data: CancellationCreate,
    current_user: User = Depends(require_instructor),
    db: DBSession = Depends(get_db),
):
    """Cancel a class and optionally close its active session"""
    from app.repositories.course_repo import CourseRepository, EnrollmentRepository
    from app.repositories.user_repo import UserRepository
    from datetime import datetime

    course_repo = CourseRepository(db)
    course = course_repo.get_by_id(data.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")

    session_repo = SessionRepository(db)
    cancel_repo = CancellationRepository(db)

    date = data.date or datetime.now().strftime("%Y-%m-%d")
    session_id = data.session_id

    # Close active session if exists
    if not session_id:
        active = session_repo.get_active(course_id=data.course_id)
        if active:
            session = active[0]
            session_repo.update(session, status="cancelled")
            session_id = session.id

    cancellation = cancel_repo.create(
        course_id=data.course_id,
        instructor_id=current_user.id,
        date=date,
        reason=data.reason,
        session_id=session_id,
    )

    # Notify enrolled students: push + DB notification
    try:
        from app.services.notification_service import create_notification
        enroll_repo = EnrollmentRepository(db)
        user_repo = UserRepository(db)
        enrollments = enroll_repo.get_by_course(data.course_id)
        push_tokens = []
        notif_title = "Ders İptal Edildi 📢"
        notif_body = f"{course.code} dersi iptal edildi. Sebep: {data.reason}"
        notif_data = {"type": "class_cancelled", "course_id": data.course_id, "date": date}
        for e in enrollments:
            student = user_repo.get_by_id(e.student_id)
            if not student:
                continue
            if student.push_token:
                push_tokens.append(student.push_token)
            create_notification(
                db=db,
                user_id=student.id,
                type="class_cancelled",
                title=notif_title,
                body=notif_body,
                data=notif_data,
            )
        if push_tokens:
            send_expo_push(
                tokens=push_tokens,
                title=notif_title,
                body=notif_body,
                data=notif_data,
            )
    except Exception:
        pass

    return {"success": True, "message": "Ders iptal edildi", "cancellation": CancellationResponse.model_validate(cancellation)}


@router.get("/cancellations/list", response_model=List[CancellationResponse])
def get_cancellations(
    course_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    repo = CancellationRepository(db)
    return repo.get_all(course_id=course_id)
