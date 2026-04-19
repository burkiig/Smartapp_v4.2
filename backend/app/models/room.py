from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.database.connection import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    capacity = Column(Integer, nullable=True)
    type = Column(String, nullable=True)       # lecture | lab | seminar
    equipment = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geofence_radius = Column(Integer, default=50)
    status = Column(String, default="available")
    created_at = Column(DateTime, default=datetime.utcnow)
