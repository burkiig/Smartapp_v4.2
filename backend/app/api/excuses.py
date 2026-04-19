from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database.connection import get_db
from app.schemas.excuse import ExcuseCreate, ExcuseReview, ExcuseResponse
from app.repositories.excuse_repo import ExcuseRepository
from app.security.dependencies import get_current_user, require_student, require_instructor
from app.models.user import User
from app.models.excuse import Excuse

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
    repo = ExcuseRepository(db)
    return repo.create(
        student_id=current_user.id,
        course_id=data.course_id,
        session_id=data.session_id,
        session_date=data.session_date,
        excuse_type=data.excuse_type,
        description=data.description,
        document_url=data.document_url,
    )


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
    return repo.update(excuse, **data.model_dump(exclude_none=True))


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
        updated.append(excuse_id)

    return {
        "updated": len(updated),
        "skipped": len(skipped),
        "updated_ids": updated,
        "skipped_ids": skipped,
    }
