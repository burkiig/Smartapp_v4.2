from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.room import Room


class RoomRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, room_id: int) -> Optional[Room]:
        return self.db.query(Room).filter(Room.id == room_id).first()

    def get_all(self) -> List[Room]:
        return self.db.query(Room).all()

    def create(self, name: str, capacity: Optional[int] = None, type: Optional[str] = None,
               equipment: Optional[str] = None, latitude: Optional[float] = None,
               longitude: Optional[float] = None, geofence_radius: int = 50) -> Room:
        room = Room(
            name=name, capacity=capacity, type=type, equipment=equipment,
            latitude=latitude, longitude=longitude, geofence_radius=geofence_radius
        )
        self.db.add(room)
        self.db.commit()
        self.db.refresh(room)
        return room

    def update(self, room: Room, **kwargs) -> Room:
        for key, value in kwargs.items():
            if hasattr(room, key):
                setattr(room, key, value)
        self.db.commit()
        self.db.refresh(room)
        return room

    def delete(self, room: Room) -> None:
        self.db.delete(room)
        self.db.commit()
