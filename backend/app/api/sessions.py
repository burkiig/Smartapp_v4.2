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
    data["ttl_seconds"] = settings.QR_TOKEN_TTL_SECONDS
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
        from app.repositories.course_repo import EnrollmentRepository

        attendable_ids = EnrollmentRepository(db).get_attendable_course_ids(current_user.id)
        filtered = [s for s in sessions if s.course_id in attendable_ids]
        return [SessionPublicResponse.model_validate(s) for s in filtered]
    if current_user.role == "instructor":
        my_course_ids = {c.id for c in CourseRepository(db).get_by_instructor(current_user.id)}
        if course_id and course_id not in my_course_ids:
            raise HTTPException(status_code=403, detail="Bu derse erişim yetkiniz yok")
        filtered = [s for s in sessions if s.course_id in my_course_ids]
        return [SessionResponse.model_validate(s) for s in filtered]
    return [SessionResponse.model_validate(s) for s in sessions]


@router.get("/active")
def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    repo = SessionRepository(db)
    if current_user.role == "student":
        from app.repositories.course_repo import EnrollmentRepository

        # Tek sorgu setiyle katılabilir ders ID'lerini al, DB'de filtrele — N+1 yok
        attendable_ids = EnrollmentRepository(db).get_attendable_course_ids(current_user.id)
        if not attendable_ids:
            return []
        sessions = repo.get_active_for_student(attendable_ids)
        return [SessionPublicResponse.model_validate(s) for s in sessions]
    return [SessionResponse.model_validate(s) for s in repo.get_active()]


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
    if not end_time:
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
        # Tek IN sorgusuyla tüm öğrencileri çek — N+1 yok
        student_ids = [e.student_id for e in enrollments]
        students = {u.id: u for u in user_repo.get_by_ids(student_ids)}
        base_data = {"type": "session_started", "session_id": session.id, "course_id": session.course_id}
        notif_title = "📋 Yoklama Başladı"
        notif_body = f"{course_name} dersi için yoklama açıldı. Hemen yoklamanı al!"
        push_tokens = []
        for e in enrollments:
            student = students.get(e.student_id)
            if not student:
                continue
            create_notification(
                db=db,
                user_id=student.id,
                type="session_started",
                title=notif_title,
                body=notif_body,
                data=base_data,
            )
            if student.push_token:
                push_tokens.append(student.push_token)
        if push_tokens:
            send_expo_push(tokens=push_tokens, title=notif_title, body=notif_body, data=base_data)
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

    # Feature 7: Notify absent students asynchronously via APScheduler
    try:
        from app.database.connection import SessionLocal
        from app.services.scheduler import schedule_notify_absent
        if not schedule_notify_absent(session_id, SessionLocal):
            # Fallback: scheduler not running (e.g. test mode)
            from app.services.notification_service import notify_absent_students
            import threading
            threading.Thread(
                target=notify_absent_students,
                args=(session_id, SessionLocal),
                daemon=True,
            ).start()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "Could not schedule absent notification for session %s: %s", session_id, exc
        )

    return {"success": True, "session": SessionResponse.model_validate(session)}


@router.get("/{session_id}")
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    from app.repositories.course_repo import CourseRepository, EnrollmentRepository

    repo = SessionRepository(db)
    session = repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    if current_user.role == "student":
        enroll_repo = EnrollmentRepository(db)
        if not enroll_repo.student_can_attend_course(current_user.id, session.course_id):
            raise HTTPException(status_code=403, detail="Bu oturuma erişim yetkiniz yok")
        return SessionPublicResponse.model_validate(session)

    if current_user.role == "instructor":
        course_repo = CourseRepository(db)
        if not course_repo.is_instructor_of_course(current_user.id, session.course_id):
            raise HTTPException(status_code=403, detail="Bu oturuma erişim yetkiniz yok")

    return SessionResponse.model_validate(session)


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
    repo = SessionRepository(db)
    session = repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    if current_user.role == "instructor":
        my_ids = {c.id for c in CourseRepository(db).get_by_instructor(current_user.id)}
        if session.course_id not in my_ids:
            raise HTTPException(status_code=403, detail="Bu oturum üzerinde yetkiniz yok")
    service = SessionService(db)
    qr_image = service.get_qr_image(session_id)
    return {
        "success": True,
        "qr_image": qr_image,
        "ttl_seconds": settings.QR_TOKEN_TTL_SECONDS,
    }


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

    # Instructor can only cancel their own courses
    if current_user.role == "instructor" and not course_repo.is_instructor_of_course(current_user.id, data.course_id):
        raise HTTPException(status_code=403, detail="Bu dersi iptal etme yetkiniz yok")

    session_repo = SessionRepository(db)
    cancel_repo = CancellationRepository(db)

    requested_date = data.date.strip() if isinstance(data.date, str) and data.date.strip() else None
    normalized_topic = data.topic.strip() if isinstance(data.topic, str) and data.topic.strip() else None
    date = requested_date or datetime.now().strftime("%Y-%m-%d")
    session_id = data.session_id
    event_start_time = data.start_time
    event_end_time = data.end_time

    # Close active session if exists
    if not session_id:
        active = session_repo.get_active(course_id=data.course_id)
        if active:
            session = active[0]
            session_repo.update(session, status="cancelled")
            session_id = session.id
            event_start_time = event_start_time or session.start_time
            event_end_time = event_end_time or session.end_time
            if not requested_date and session.date:
                date = session.date
    elif session_id:
        linked_session = session_repo.get_by_id(session_id)
        if linked_session:
            event_start_time = event_start_time or linked_session.start_time
            event_end_time = event_end_time or linked_session.end_time
            if not requested_date and linked_session.date:
                date = linked_session.date

    cancellation = cancel_repo.create(
        course_id=data.course_id,
        instructor_id=current_user.id,
        date=date,
        reason=data.reason,
        topic=normalized_topic,
        session_id=session_id,
    )

    # Notify enrolled students: push + DB notification
    try:
        from app.services.notification_service import create_notification
        enroll_repo = EnrollmentRepository(db)
        user_repo = UserRepository(db)
        enrollments = enroll_repo.get_by_course(data.course_id)
        # Tek IN sorgusuyla tüm öğrencileri çek — N+1 yok
        student_ids = [e.student_id for e in enrollments]
        students = {u.id: u for u in user_repo.get_by_ids(student_ids)}
        push_tokens = []
        notif_title = "Ders İptal Edildi 📢"
        details = [f"Tarih: {date}"]
        if event_start_time and event_end_time:
            details.append(f"Saat: {event_start_time}-{event_end_time}")
        if normalized_topic:
            details.append(f"Konu: {normalized_topic}")
        details_text = " | ".join(details)
        notif_body = f"{course.code} dersi iptal edildi. Sebep: {data.reason}. {details_text}"
        notif_data = {
            "type": "class_cancelled",
            "course_id": data.course_id,
            "course_code": course.code,
            "course_name": course.name,
            "date": date,
            "start_time": event_start_time,
            "end_time": event_end_time,
            "reason": data.reason,
            "topic": normalized_topic,
            "session_id": session_id,
            "cancellation_id": cancellation.id,
        }
        for e in enrollments:
            student = students.get(e.student_id)
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
            send_expo_push(tokens=push_tokens, title=notif_title, body=notif_body, data=notif_data)
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
    if current_user.role == "student":
        from app.repositories.course_repo import EnrollmentRepository
        enrolled_ids = EnrollmentRepository(db).get_attendable_course_ids(current_user.id)
        if course_id and course_id not in enrolled_ids:
            return []
        all_cancellations = repo.get_all(course_id=course_id)
        return [c for c in all_cancellations if c.course_id in enrolled_ids]
    if current_user.role == "instructor":
        my_course_ids = {c.id for c in CourseRepository(db).get_by_instructor(current_user.id)}
        if course_id and course_id not in my_course_ids:
            raise HTTPException(status_code=403, detail="Bu derse erişim yetkiniz yok")
        all_cancellations = repo.get_all(course_id=course_id)
        return [c for c in all_cancellations if c.course_id in my_course_ids]
    return repo.get_all(course_id=course_id)
