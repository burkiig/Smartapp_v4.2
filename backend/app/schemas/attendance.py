from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Any
from datetime import datetime

_MAX_IMAGE_CHARS = 2_800_000  # ~2MB raw


def _check_image_size(v: str) -> str:
    if v and len(v) > _MAX_IMAGE_CHARS:
        raise ValueError("Görüntü çok büyük. Maksimum boyut 2MB.")
    return v


# ── GPS coordinate validators (shared by both location request models) ────────

def _validate_latitude(v: float) -> float:
    if not -90.0 <= v <= 90.0:
        raise ValueError(f"Geçersiz enlem '{v}': [-90, 90] aralığında olmalı.")
    return v


def _validate_longitude(v: float) -> float:
    if not -180.0 <= v <= 180.0:
        raise ValueError(f"Geçersiz boylam '{v}': [-180, 180] aralığında olmalı.")
    return v


def _validate_not_null_island(lat: float, lon: float) -> None:
    """Null Island (0, 0) kontrolü — sahte GPS uygulamaları sıklıkla bu noktayı kullanır."""
    if abs(lat) < 0.0001 and abs(lon) < 0.0001:
        raise ValueError(
            "Koordinat (0, 0) meşru bir GPS konumu değil (Null Island). "
            "Gerçek konumunuzu gönderin."
        )


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
    is_mocked: Optional[bool] = None

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        return _validate_longitude(v)

    @model_validator(mode="after")
    def validate_not_null_island(self):
        _validate_not_null_island(self.latitude, self.longitude)
        return self


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
    image_base64: Optional[str] = None  # kapalı oturumda opsiyonel


class OverrideAttendanceRequest(BaseModel):
    status: str  # present | absent | excused
    note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v):
        allowed = {"present", "absent", "excused"}
        if v not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v


class SetAttendanceStatusRequest(BaseModel):
    """Öğretmen → öğrenci + oturum çifti için durum belirle.
    Kayıt yoksa oluşturur, varsa günceller (upsert).
    """
    session_id: int
    student_id: int
    status: str  # present | absent | excused
    note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v):
        allowed = {"present", "absent", "excused"}
        if v not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v


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
    is_mocked: Optional[bool] = None

    @field_validator("image_base64", mode="before")
    @classmethod
    def validate_image_size(cls, v):
        return _check_image_size(v)

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        return _validate_longitude(v)

    @model_validator(mode="after")
    def validate_not_null_island(self):
        _validate_not_null_island(self.latitude, self.longitude)
        return self


class WebAttendanceResponse(BaseModel):
    success: bool
    message: str
    is_flagged: bool
    flag_reason: Optional[str] = None
    face_ok: bool
    location_ok: bool
    location_distance_m: Optional[float] = None
    location_skipped: Optional[bool] = None


class CancellationCreate(BaseModel):
    course_id: int
    session_id: Optional[int] = None
    date: Optional[str] = None
    reason: str
    topic: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class CancellationResponse(BaseModel):
    id: int
    course_id: int
    session_id: Optional[int] = None
    instructor_id: int
    date: str
    reason: str
    topic: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
