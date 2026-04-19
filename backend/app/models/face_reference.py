from sqlalchemy import Column, Integer, ForeignKey, LargeBinary, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base


class FaceReference(Base):
    __tablename__ = "face_references"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    embedding = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="face_reference")
