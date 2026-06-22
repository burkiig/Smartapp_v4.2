from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.connection import get_db
from app.schemas.room import RoomCreate, RoomUpdate, RoomResponse
from app.repositories.room_repo import RoomRepository
from app.security.dependencies import get_current_user, require_admin
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[RoomResponse])
def get_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return RoomRepository(db).get_all()


@router.post("/", response_model=RoomResponse, status_code=200)
def create_room(
    data: RoomCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = RoomRepository(db)
    return repo.create(
        name=data.name,
        capacity=data.capacity,
        type=data.type,
        equipment=data.equipment,
        latitude=data.latitude,
        longitude=data.longitude,
        geofence_radius=data.geofence_radius,
    )


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = RoomRepository(db).get_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı")
    return room


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    data: RoomUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = RoomRepository(db)
    room = repo.get_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı")
    return repo.update(room, **data.model_dump(exclude_none=True))


@router.put("/{room_id}", response_model=RoomResponse)
def update_room_put(
    room_id: int,
    data: RoomUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Backward-compatible PUT alias for room updates.
    """
    repo = RoomRepository(db)
    room = repo.get_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı")
    return repo.update(room, **data.model_dump(exclude_none=True))


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = RoomRepository(db)
    room = repo.get_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı")
    repo.delete(room)
    return {"success": True, "message": "Sınıf silindi"}
