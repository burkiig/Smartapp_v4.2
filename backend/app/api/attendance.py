from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import io

from app.database.connection import get_db
from app.schemas.attendance import (
    ScanQRRequest, VerifyFaceRequest, VerifyLocationRequest,
    AttendanceAttemptResponse, FinalAttendanceResponse,
    ManualAttendanceRequest, ReviewAttendanceRequest,
    WebAttendanceRequest, WebAttendanceResponse,
)
from app.services.attendance_service import AttendancePipelineService
from app.services.audit_service import log_action
from app.repositories.attendance_repo import FinalAttendanceRepository
from app.repositories.course_repo import CourseRepository
from app.security.dependencies import get_current_user, require_student, require_instructor
from app.security.rate_limit import rate_limit
from app.models.user import User
from app.models.attendance import FinalAttendanceRecord

router = APIRouter()

# Tek sorguda belleğe alınacak maksimum satır sayısı.
# 5000 satır × ~500 byte/satır ≈ 2.5 MB — makul bir sunucu belleği kullanımı.
# Bu limitin üzerinde kayıt varsa X-Export-Truncated: true header'ı döner;
# kullanıcı daha dar bir filtre (course_id / date) ile tekrar isteyebilir.
_EXPORT_LIMIT = 5_000


# ── Student pipeline ──────────────────────────────────────────────────────────

@router.post("/scan-qr", response_model=AttendanceAttemptResponse)
def scan_qr(
    data: ScanQRRequest,
    request: Request,
    _: None = Depends(rate_limit("30/minute")),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STEP 1: Student scans QR code"""
    service = AttendancePipelineService(db)
    return service.scan_qr(student, data.session_id, data.qr_token)


@router.post("/verify-face", response_model=AttendanceAttemptResponse)
def verify_face(
    data: VerifyFaceRequest,
    request: Request,
    _: None = Depends(rate_limit("20/minute")),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STEP 2: Face verification"""
    service = AttendancePipelineService(db)
    return service.verify_face(student, data.session_id, data.image_base64, data.image_base64_2)


@router.post("/verify-location")
def verify_location(
    data: VerifyLocationRequest,
    request: Request,
    _: None = Depends(rate_limit("30/minute")),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STEP 3: Location verification + finalize attendance"""
    service = AttendancePipelineService(db)
    return service.verify_location(
        student, data.session_id, data.latitude, data.longitude, data.accuracy, data.is_mocked
    )


@router.get("/attempt/{session_id}", response_model=AttendanceAttemptResponse)
def get_attempt(
    session_id: int,
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    from app.repositories.attendance_repo import AttendanceAttemptRepository
    repo = AttendanceAttemptRepository(db)
    attempt = repo.get_by_student_session(student.id, session_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Yoklama denemesi bulunamadı")
    return attempt


# ── Web attendance (student via browser — Face + GPS, no QR) ─────────────────

@router.post("/web-attend")
def web_attend(
    data: WebAttendanceRequest,
    request: Request,
    _: None = Depends(rate_limit("20/minute")),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Web browser attendance: face verification + GPS, QR skipped"""
    service = AttendancePipelineService(db)
    return service.web_attend(
        student=student,
        session_id=data.session_id,
        image_base64=data.image_base64,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
        is_mocked=data.is_mocked,
    )


# ── Manual attendance (instructor) ───────────────────────────────────────────

@router.post("/manual")
def manual_attendance(
    data: ManualAttendanceRequest,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Manual face attendance by instructor/admin.
    Instructors are restricted to their own courses.
    """
    service = AttendancePipelineService(db)
    # Pass instructor_id for scope check (admins pass None = unrestricted)
    instructor_id = current_user.id if current_user.role == "instructor" else None
    return service.manual_attendance(
        data.session_id, data.student_id, data.image_base64,
        instructor_id=instructor_id,
    )


# ── Attendance records ────────────────────────────────────────────────────────

@router.get("/records")
def get_records(
    course_id: Optional[int] = None,
    date: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated attendance records with student info enriched.

    Instructors are restricted to their own courses at the SQL level so that
    COUNT(*) and total_pages are always accurate.
    """
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Yetki gerekli")

    effective_course_id = course_id
    effective_allowed_ids: Optional[List[int]] = None

    if current_user.role == "instructor":
        my_course_ids = [c.id for c in CourseRepository(db).get_by_instructor(current_user.id)]
        if course_id:
            if course_id not in my_course_ids:
                raise HTTPException(status_code=403, detail="Bu derse erişim yetkiniz yok")
            # course_id filter alone is sufficient
        else:
            effective_course_id = None
            effective_allowed_ids = my_course_ids

    repo = FinalAttendanceRepository(db)
    result = repo.get_all(
        course_id=effective_course_id,
        allowed_course_ids=effective_allowed_ids,
        date=date,
        page=page,
        page_size=page_size,
    )

    enriched = [
        {
            "id": r.id,
            "student_id": r.student_id,
            "session_id": r.session_id,
            "course_id": r.course_id,
            "status": r.status,
            "is_flagged": r.is_flagged,
            "flag_reason": r.flag_reason,
            "verification_steps": r.verification_steps,
            "marked_at": r.marked_at.isoformat() if r.marked_at else None,
            "course_code": r.course.code if r.course else None,
            "course_name": r.course.name if r.course else None,
            "student_name": r.student.name if r.student else None,
            "student_number": r.student.student_number if r.student else None,
        }
        for r in result["records"]
    ]

    return {
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
        "records": enriched,
    }


@router.get("/my-history")
def my_history(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    repo = FinalAttendanceRepository(db)
    records = repo.get_by_student(current_user.id)
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "student_id": r.student_id,
            "session_id": r.session_id,
            "course_id": r.course_id,
            "status": r.status,
            "is_flagged": r.is_flagged,
            "flag_reason": r.flag_reason,
            "verification_steps": r.verification_steps,
            "marked_at": r.marked_at.isoformat() if r.marked_at else None,
            "course_code": r.course.code if r.course else None,
            "course_name": r.course.name if r.course else None,
        })
    return result


@router.get("/session/{session_id}")
def session_attendance(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Yetki gerekli")

    records = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.session_id == session_id
    ).options(
        joinedload(FinalAttendanceRecord.student),
        joinedload(FinalAttendanceRecord.course),
    ).all()

    # Instructor scope check
    if current_user.role == "instructor" and records:
        from app.repositories.course_repo import CourseRepository
        course_repo = CourseRepository(db)
        my_course_ids = {c.id for c in course_repo.get_by_instructor(current_user.id)}
        records = [r for r in records if r.course_id in my_course_ids]

    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "student_name": r.student.name if r.student else None,
            "student_number": r.student.student_number if r.student else None,
            "session_id": r.session_id,
            "course_id": r.course_id,
            "course_code": r.course.code if r.course else None,
            "status": r.status,
            "is_flagged": r.is_flagged,
            "flag_reason": r.flag_reason,
            "verification_steps": r.verification_steps,
            "marked_at": r.marked_at.isoformat() if r.marked_at else None,
        }
        for r in records
    ]


@router.get("/flagged")
def get_flagged(
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    repo = FinalAttendanceRepository(db)
    records = repo.get_flagged()
    if current_user.role == "admin":
        filtered = records
    else:
        from app.repositories.course_repo import CourseRepository
        course_repo = CourseRepository(db)
        my_course_ids = {c.id for c in course_repo.get_by_instructor(current_user.id)}
        filtered = [r for r in records if r.course_id in my_course_ids]

    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "student_name": r.student.name if r.student else None,
            "student_number": r.student.student_number if r.student else None,
            "session_id": r.session_id,
            "course_id": r.course_id,
            "course_code": r.course.code if r.course else None,
            "course_name": r.course.name if r.course else None,
            "status": r.status,
            "is_flagged": r.is_flagged,
            "flag_reason": r.flag_reason,
            "marked_at": r.marked_at.isoformat() if r.marked_at else None,
        }
        for r in filtered
    ]


@router.get("/export")
def export_attendance(
    format: str = Query(default="excel", pattern="^(excel|pdf)$"),
    course_id: Optional[int] = None,
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export attendance records as Excel or PDF.

    Instructor scope is enforced at SQL level (same as /records) so the query
    never fetches rows that would be thrown away in Python.
    """
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Yetki gerekli")

    effective_course_id = course_id
    effective_allowed_ids: Optional[List[int]] = None

    if current_user.role == "instructor":
        my_ids = [c.id for c in CourseRepository(db).get_by_instructor(current_user.id)]
        if course_id:
            if course_id not in my_ids:
                raise HTTPException(status_code=403, detail="Bu derse erişim yetkiniz yok")
        else:
            effective_course_id = None
            effective_allowed_ids = my_ids

    repo = FinalAttendanceRepository(db)
    result = repo.get_all(
        course_id=effective_course_id,
        allowed_course_ids=effective_allowed_ids,
        date=date,
        page=1,
        page_size=_EXPORT_LIMIT,
    )
    records = result["records"]
    total_available = result["total"]
    truncated = total_available > _EXPORT_LIMIT

    # Header'lar her iki format için de ortak kullanılır
    _meta_headers = {
        "X-Export-Truncated": "true" if truncated else "false",
        "X-Total-Available": str(total_available),
        "X-Export-Limit": str(_EXPORT_LIMIT),
    }

    rows = [
        {
            "Öğrenci Adı": r.student.name if r.student else f"#{r.student_id}",
            "Öğrenci No": r.student.student_number if r.student else "",
            "Ders Kodu": r.course.code if r.course else "",
            "Ders Adı": r.course.name if r.course else "",
            "Tarih": r.marked_at.strftime("%Y-%m-%d") if r.marked_at else "",
            "Saat": r.marked_at.strftime("%H:%M") if r.marked_at else "",
            "Durum": r.status or "present",
            "Şüpheli": "Evet" if r.is_flagged else "Hayır",
        }
        for r in records
    ]

    if format == "excel":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Yoklama"
        if rows:
            ws.append(list(rows[0].keys()))
            for row in rows:
                ws.append(list(row.values()))
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        filename = "yoklama_raporu.xlsx"
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                **_meta_headers,
            },
        )

    else:  # pdf
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = []

        elements.append(Paragraph("Yoklama Raporu", styles["Title"]))

        if rows:
            headers = list(rows[0].keys())
            table_data = [headers] + [list(r.values()) for r in rows]
        else:
            table_data = [["Kayıt bulunamadı"]]

        t = Table(table_data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f8ff")]),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        doc.build(elements)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=yoklama_raporu.pdf",
                **_meta_headers,
            },
        )


@router.patch("/{record_id}/review", response_model=FinalAttendanceResponse)
def review_attendance(
    record_id: int,
    data: ReviewAttendanceRequest,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    repo = FinalAttendanceRepository(db)
    record = db.query(FinalAttendanceRecord).filter(FinalAttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    if current_user.role != "admin":
        from app.repositories.course_repo import CourseRepository
        course_repo = CourseRepository(db)
        my_course_ids = {c.id for c in course_repo.get_by_instructor(current_user.id)}
        if record.course_id not in my_course_ids:
            raise HTTPException(status_code=403, detail="Bu kayıt üzerinde yetkiniz yok")
    old_status = record.status
    old_flagged = record.is_flagged
    update_data = data.model_dump(exclude_none=True)
    updated = repo.update(record, **update_data)
    log_action(
        db, "attendance_reviewed",
        actor_id=current_user.id, actor_role=current_user.role,
        resource="final_attendance_record", resource_id=record_id,
        detail={"old_status": old_status, "new_status": updated.status,
                "old_flagged": old_flagged, "new_flagged": updated.is_flagged,
                "flag_reason": updated.flag_reason},
    )
    return updated
