from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database.connection import Base
from app.database.types import EncryptedBinary


def _utcnow():
    """Timezone-aware UTC timestamp — tüm modellerdeki pattern ile tutarlı."""
    return datetime.now(timezone.utc)


class FaceReference(Base):
    __tablename__ = "face_references"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    embedding = Column(EncryptedBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="face_reference")
