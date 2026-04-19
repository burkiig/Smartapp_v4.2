from pydantic import BaseModel, field_validator
from typing import Optional, Any
from datetime import datetime

_MAX_IMAGE_CHARS = 2_800_000  # ~2MB raw


def _check_image_size(v: str) -> str:
    if v and len(v) > _MAX_IMAGE_CHARS:
        raise ValueError("Görüntü çok büyük. Maksimum boyut 2MB.")
    return v


class ScanQRRequest(BaseModel):
    session_id: int
    qr_token: str


class VerifyFaceRequest(BaseModel):
    session_id: int
    image_base64: str
    image_base64_2: Optional[str] = None  # second frame for liveness

    @field_validator("image_base64", "image_base64_2", mode="before")
    @classmethod
    def validate_image_size(cls, v):
        if v is not None:
            return _check_image_size(v)
        return v


class VerifyLocationRequest(BaseModel):
    session_id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


class AttendanceAttemptResponse(BaseModel):
    id: int
    student_id: int
    session_id: int
    qr_status: str
    face_status: str
    location_status: str
    face_confidence: Optional[float] = None
    location_distance_m: Optional[float] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FinalAttendanceResponse(BaseModel):
    id: int
    student_id: int
    session_id: int
    course_id: int
    status: str
    is_flagged: bool
    flag_reason: Optional[str] = None
    verification_steps: Optional[Any] = None
    marked_at: datetime
    # enriched fields (optional, populated in some endpoints)
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    student_name: Optional[str] = None
    student_number: Optional[str] = None

    model_config = {"from_attributes": True}


class ManualAttendanceRequest(BaseModel):
    session_id: int
    student_id: int
    image_base64: str


class ReviewAttendanceRequest(BaseModel):
    is_flagged: bool
    flag_reason: Optional[str] = None
    status: Optional[str] = None


class WebAttendanceRequest(BaseModel):
    session_id: int
    image_base64: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None

    @field_validator("image_base64", mode="before")
    @classmethod
    def validate_image_size(cls, v):
        return _check_image_size(v)


class WebAttendanceResponse(BaseModel):
    success: bool
    message: str
    is_flagged: bool
    flag_reason: Optional[str] = None
    face_ok: bool
    location_ok: bool


class CancellationCreate(BaseModel):
    course_id: int
    session_id: Optional[int] = None
    date: Optional[str] = None
    reason: str


class CancellationResponse(BaseModel):
    id: int
    course_id: int
    session_id: Optional[int] = None
    instructor_id: int
    date: str
    reason: str
    created_at: datetime

    model_config = {"from_attributes": True}
