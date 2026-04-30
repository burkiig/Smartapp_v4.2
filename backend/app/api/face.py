from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
import base64

from app.database.connection import get_db
from app.services.face_service import FaceService
from app.security.dependencies import get_current_user, require_instructor
from app.models.user import User
from app.repositories.user_repo import UserRepository

router = APIRouter()

# Max image size: 2MB raw bytes → base64 is ~4/3 so allow ~2.7MB base64 string
_MAX_IMAGE_B64_CHARS = 2_800_000


def _validate_image(image_b64: str) -> str:
    """Validate image size and basic base64 format."""
    if not image_b64:
        raise HTTPException(status_code=400, detail="Görüntü boş olamaz")
    # Strip data-url prefix if present
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    if len(image_b64) > _MAX_IMAGE_B64_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Görüntü çok büyük. Maksimum boyut 2MB."
        )
    try:
        base64.b64decode(image_b64[:32], validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz görüntü formatı (base64 değil)")
    return image_b64


class EnrollRequest(BaseModel):
    image_base64: str


class EnrollForStudentRequest(BaseModel):
    student_id: int
    image_base64: str


@router.post("/enroll")
def enroll_self(
    data: EnrollRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student self-enrolls their own face"""
    _validate_image(data.image_base64)
    service = FaceService(db)
    return service.enroll(current_user.id, data.image_base64, accessed_by="/api/v1/face/enroll", ip_address=request.client.host if request.client else None)


@router.post("/enroll/student")
def enroll_student(
    data: EnrollForStudentRequest,
    request: Request,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Instructor/admin enrolls a student's face"""
    _validate_image(data.image_base64)
    user_repo = UserRepository(db)
    student = user_repo.get_by_id(data.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    service = FaceService(db)
    return service.enroll(data.student_id, data.image_base64, accessed_by="/api/v1/face/enroll/student", ip_address=request.client.host if request.client else None)


@router.get("/status/{user_id}")
def check_enrollment_status(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "instructor") and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    service = FaceService(db)
    return {"user_id": user_id, "is_enrolled": service.is_enrolled(user_id)}


@router.get("/my-status")
def my_face_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = FaceService(db)
    return {"user_id": current_user.id, "is_enrolled": service.is_enrolled(current_user.id)}
