from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.face_repo import FaceReferenceRepository
from app.integrations.face_engine import get_face_engine
from app.config.settings import settings


class FaceService:
    def __init__(self, db: Session):
        self.db = db
        self.face_repo = FaceReferenceRepository(db)
        self.engine = get_face_engine()

    def enroll(self, user_id: int, image_base64: str) -> dict:
        if not self.engine.is_available:
            raise HTTPException(status_code=503, detail="Yüz tanıma motoru kullanılamıyor. insightface kurulu mu?")

        embedding = self.engine.extract_embedding(image_base64)
        if embedding is None:
            raise HTTPException(status_code=400, detail="Görüntüde yüz bulunamadı")

        serialized = self.engine.serialize_embedding(embedding)
        self.face_repo.upsert(user_id, serialized)
        return {"success": True, "message": "Yüz kaydı başarıyla güncellendi"}

    def is_enrolled(self, user_id: int) -> bool:
        return self.face_repo.get_by_user(user_id) is not None

    def verify(self, user_id: int, image_base64: str,
               image_base64_2: str = None) -> tuple[bool, float]:
        """
        Verify face against stored reference.
        Returns (verified: bool, confidence: float)
        """
        if not self.engine.is_available:
            raise HTTPException(status_code=503, detail="Yüz tanıma motoru kullanılamıyor")

        ref = self.face_repo.get_by_user(user_id)
        if not ref:
            raise HTTPException(status_code=404, detail="Bu kullanıcı için yüz kaydı bulunamadı")

        # Liveness check (if second frame provided)
        if image_base64_2:
            is_live, _ = self.engine.check_liveness(image_base64, image_base64_2)
            if not is_live:
                raise HTTPException(status_code=400, detail="Liveness kontrolü başarısız — statik görüntü tespiti")

        # Extract embedding from incoming frame
        embedding = self.engine.extract_embedding(image_base64)
        if embedding is None:
            raise HTTPException(status_code=400, detail="Görüntüde yüz bulunamadı")

        # Compare with stored reference
        stored_embedding = self.engine.deserialize_embedding(ref.embedding)
        similarity = self.engine.compare(stored_embedding, embedding)
        verified = similarity >= settings.FACE_SIMILARITY_THRESHOLD

        return verified, similarity
