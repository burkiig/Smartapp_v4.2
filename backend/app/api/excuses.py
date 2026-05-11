from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database.connection import get_db
from app.schemas.excuse import ExcuseCreate, ExcuseReview, ExcuseResponse
from app.repositories.excuse_repo import ExcuseRepository
from app.security.dependencies import get_current_user, require_student, require_instructor
from app.models.user import User
from app.models.attendance import FinalAttendanceRecord
from app.services.excuse_service import upload_excuse_document, get_excuse_signed_url

router = APIRouter()


@router.get("/", response_model=List[ExcuseResponse])
def get_excuses(
    course_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ExcuseRepository(db)
    if current_user.role == "student":
        return repo.get_by_student(current_user.id, course_id)
    if current_user.role == "admin":
        return repo.get_all(course_id=course_id)
    from app.repositories.course_repo import CourseRepository
    course_repo = CourseRepository(db)
    my_course_ids = [c.id for c in course_repo.get_by_instructor(current_user.id)]
    if course_id and course_id not in my_course_ids:
        raise HTTPException(status_code=403, detail="Bu derse erişim yetkiniz yok")
    return repo.get_all(course_id=course_id, course_ids=my_course_ids if not course_id else None)


@router.post("/", response_model=ExcuseResponse, status_code=201)
def submit_excuse(
    data: ExcuseCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    # Öğrenci bu oturum için zaten yoklama atmışsa mazeret kabul etme
    if data.session_id is not None:
        existing_attendance = db.query(FinalAttendanceRecord).filter(
            FinalAttendanceRecord.student_id == current_user.id,
            FinalAttendanceRecord.session_id == data.session_id,
            FinalAttendanceRecord.status == "present",
        ).first()
        if existing_attendance:
            raise HTTPException(
                status_code=409,
                detail="Bu oturum için zaten yoklama kaydınız mevcut, mazeret eklenemez",
            )

    repo = ExcuseRepository(db)
    return repo.create(
        student_id=current_user.id,
        course_id=data.course_id,
        session_id=data.session_id,
        session_date=data.session_date,
        excuse_type=data.excuse_type,
        description=data.description,
        storage_path=data.storage_path,
    )


@router.post("/upload", response_model=ExcuseResponse)
async def upload_excuse_file(
    excuse_id: int = Query(..., ge=1),
    file: UploadFile = File(...),
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    repo = ExcuseRepository(db)
    excuse = repo.get_by_id(excuse_id)
    if not excuse:
        raise HTTPException(status_code=404, detail="Mazeret bulunamadı")
    if excuse.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sadece kendi mazeret belgenizi yukleyebilirsiniz")
    await upload_excuse_document(current_user.id, file, excuse_id, db)
    return repo.get_by_id(excuse_id)


@router.get("/{excuse_id}", response_model=ExcuseResponse)
def get_excuse(
    excuse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ExcuseRepository(db)
    excuse = repo.get_by_id(excuse_id)
    if not excuse:
        raise HTTPException(status_code=404, detail="Mazeret bulunamadı")
    if current_user.role == "student" and excuse.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    return excuse


def _sync_attendance_for_excuse(db: Session, excuse, new_status: str) -> None:
    """Mazeret kararını ilgili FinalAttendanceRecord'a yansıt.

    approved  → attendance status = 'excused'
    rejected  → attendance status = 'absent'   (zaten yoksa dokunma)
    pending   → hiç değiştirme
    """
    if new_status not in ("approved", "rejected"):
        return
    if not excuse.session_id:
        return
    record = db.query(FinalAttendanceRecord).filter(
        FinalAttendanceRecord.student_id == excuse.student_id,
        FinalAttendanceRecord.session_id == excuse.session_id,
    ).first()
    if record:
        record.status = "excused" if new_status == "approved" else "absent"
        db.commit()


@router.patch("/{excuse_id}", response_model=ExcuseResponse)
def review_excuse(
    excuse_id: int,
    data: ExcuseReview,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    if data.status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="Geçersiz durum değeri")
    repo = ExcuseRepository(db)
    excuse = repo.get_by_id(excuse_id)
    if not excuse:
        raise HTTPException(status_code=404, detail="Mazeret bulunamadı")
    updated = repo.update(excuse, **data.model_dump(exclude_none=True))
    _sync_attendance_for_excuse(db, excuse, data.status)
    return updated


@router.get("/{excuse_id}/document")
def get_excuse_document(
    excuse_id: int,
    expires_in: int = Query(default=3600, ge=60, le=7200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = ExcuseRepository(db)
    excuse = repo.get_by_id(excuse_id)
    if not excuse:
        raise HTTPException(status_code=404, detail="Mazeret bulunamadı")
    if not excuse.storage_path:
        raise HTTPException(status_code=404, detail="Bu mazeret icin belge yuklenmemis")
    signed_url = get_excuse_signed_url(
        storage_path=excuse.storage_path,
        requesting_user_id=current_user.id,
        requesting_user_role=current_user.role,
        db=db,
        expires_in=expires_in,
        excuse_owner_id=excuse.student_id,
    )
    return {"excuse_id": excuse_id, "signed_url": signed_url, "expires_in": expires_in}


class BulkExcuseReview(BaseModel):
    ids: List[int]
    status: str          # approved | rejected
    instructor_notes: Optional[str] = None


@router.post("/bulk-review")
def bulk_review_excuses(
    data: BulkExcuseReview,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Bulk approve or reject multiple excuses at once."""
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Geçersiz durum: approved veya rejected olmalı")
    if not data.ids:
        raise HTTPException(status_code=400, detail="ID listesi boş olamaz")

    repo = ExcuseRepository(db)
    updated = []
    skipped = []

    # Instructor scope check
    allowed_course_ids = None
    if current_user.role == "instructor":
        from app.repositories.course_repo import CourseRepository
        allowed_course_ids = {c.id for c in CourseRepository(db).get_by_instructor(current_user.id)}

    try:
        for excuse_id in data.ids:
            excuse = repo.get_by_id(excuse_id)
            if not excuse:
                skipped.append(excuse_id)
                continue
            if allowed_course_ids is not None and excuse.course_id not in allowed_course_ids:
                skipped.append(excuse_id)
                continue
            repo.update(excuse, status=data.status,
                        instructor_notes=data.instructor_notes or excuse.instructor_notes)
            _sync_attendance_for_excuse(db, excuse, data.status)
            updated.append(excuse_id)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Toplu güncelleme başarısız, hiçbir değişiklik kaydedilmedi")

    return {
        "updated": len(updated),
        "skipped": len(skipped),
        "updated_ids": updated,
        "skipped_ids": skipped,
    }
