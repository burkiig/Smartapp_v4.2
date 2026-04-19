"""
InsightFace tabanlı yüz tanıma motoru.
buffalo_l modeli kullanır, cosine similarity ile karşılaştırma yapar.
Kütüphane yüklü değilse graceful fallback sağlar.
"""
import numpy as np
import io
import base64
from typing import Optional, Tuple

try:
    import insightface
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False


class FaceEngine:
    _instance: Optional["FaceEngine"] = None
    _app = None

    @classmethod
    def get_instance(cls) -> "FaceEngine":
        if cls._instance is None:
            cls._instance = FaceEngine()
        return cls._instance

    def __init__(self):
        self._initialized = False
        self._init_model()

    def _init_model(self):
        if not INSIGHTFACE_AVAILABLE:
            print("WARNING: insightface not installed. Face recognition disabled.")
            return
        try:
            self._app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            self._app.prepare(ctx_id=0, det_size=(640, 640))
            self._initialized = True
            print("FaceEngine: buffalo_l model loaded successfully.")
        except Exception as e:
            print(f"WARNING: FaceEngine init failed: {e}")

    @property
    def is_available(self) -> bool:
        return self._initialized and self._app is not None

    def _decode_image(self, image_base64: str) -> Optional[np.ndarray]:
        """Decode base64 image to numpy array (BGR)"""
        if not CV2_AVAILABLE:
            return None
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            img_bytes = base64.b64decode(image_base64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception:
            return None

    def extract_embedding(self, image_base64: str) -> Optional[np.ndarray]:
        """Extract face embedding from base64 image. Returns None if no face found."""
        if not self.is_available:
            return None
        img = self._decode_image(image_base64)
        if img is None:
            return None
        try:
            faces = self._app.get(img)
            if not faces:
                return None
            # Use the face with the largest bounding box
            face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            return face.embedding
        except Exception as e:
            print(f"FaceEngine extract_embedding error: {e}")
            return None

    def compare(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Cosine similarity between two embeddings. Returns value 0-1."""
        try:
            n1 = embedding1 / (np.linalg.norm(embedding1) + 1e-10)
            n2 = embedding2 / (np.linalg.norm(embedding2) + 1e-10)
            similarity = float(np.dot(n1, n2))
            return max(0.0, min(1.0, similarity))
        except Exception:
            return 0.0

    def check_liveness(self, image1_b64: str, image2_b64: Optional[str]) -> Tuple[bool, float]:
        """
        Passive liveness: compare embeddings from two frames.
        If they're too similar (same static image), it might be a photo attack.
        Returns (is_live, confidence_score).
        If only one frame provided, always returns True (liveness bypassed).
        """
        if not image2_b64:
            return True, 1.0

        emb1 = self.extract_embedding(image1_b64)
        emb2 = self.extract_embedding(image2_b64)

        if emb1 is None or emb2 is None:
            return False, 0.0

        sim = self.compare(emb1, emb2)
        # Two live frames of the same person: sim ~0.85-0.98
        # Two identical photos: sim > 0.999
        if sim > 0.999:
            return False, 0.0   # likely same static image
        if sim < 0.5:
            return False, 0.0   # different people or bad capture
        return True, sim

    @staticmethod
    def serialize_embedding(embedding: np.ndarray) -> bytes:
        """Serialize embedding using numpy's safe format (NOT pickle)."""
        buf = io.BytesIO()
        np.save(buf, embedding)
        return buf.getvalue()

    @staticmethod
    def deserialize_embedding(data: bytes) -> np.ndarray:
        """Deserialize embedding. Supports both numpy (.npy) and legacy pickle formats."""
        buf = io.BytesIO(data)
        try:
            return np.load(buf)
        except ValueError:
            # Legacy embeddings were stored with pickle — re-enroll to migrate.
            buf.seek(0)
            return np.load(buf, allow_pickle=True)


def get_face_engine() -> FaceEngine:
    return FaceEngine.get_instance()
