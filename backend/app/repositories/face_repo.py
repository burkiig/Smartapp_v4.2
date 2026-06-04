from sqlalchemy.orm import Session
from typing import Optional
from app.models.face_reference import FaceReference


class FaceReferenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user(self, user_id: int) -> Optional[FaceReference]:
        return self.db.query(FaceReference).filter(FaceReference.user_id == user_id).first()

    def upsert(self, user_id: int, embedding: bytes) -> FaceReference:
        ref = self.get_by_user(user_id)
        if ref:
            ref.embedding = embedding
            from datetime import datetime, timezone
            ref.updated_at = datetime.now(timezone.utc)
        else:
            ref = FaceReference(user_id=user_id, embedding=embedding)
            self.db.add(ref)
        self.db.commit()
        self.db.refresh(ref)
        return ref

    def delete(self, ref: FaceReference) -> None:
        self.db.delete(ref)
        self.db.commit()
