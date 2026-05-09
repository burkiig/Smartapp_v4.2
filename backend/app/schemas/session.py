from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionCreate(BaseModel):
    course_id: int
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    room_id: Optional[int] = None  # if provided, GPS is taken from the room/faculty record


class SessionUpdate(BaseModel):
    status: Optional[str] = None
    end_time: Optional[str] = None
    qr_token: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    course_id: int
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: str
    qr_token: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    qr_image: Optional[str] = None
    static_qr_image: Optional[str] = None

    model_config = {"from_attributes": True}


class SessionPublicResponse(BaseModel):
    """Safe response that excludes qr_token — used for student-visible endpoints."""
    id: int
    course_id: int
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_by_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
