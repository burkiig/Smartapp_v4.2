from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RoomCreate(BaseModel):
    name: str
    capacity: Optional[int] = None
    type: Optional[str] = None
    equipment: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: int = 50


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    type: Optional[str] = None
    equipment: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: Optional[int] = None
    status: Optional[str] = None


class RoomResponse(BaseModel):
    id: int
    name: str
    capacity: Optional[int] = None
    type: Optional[str] = None
    equipment: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
