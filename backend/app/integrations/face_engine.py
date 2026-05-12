"""
InsightFace tabanlı yüz tanıma motoru.
buffalo_l modeli kullanır, cosine similarity ile karşılaştırma yapar.
Kütüphane yüklü değilse graceful fallback sağlar.

Thread güvenliği: FaceEngine singleton'dır. ONNX inference CPU-ağır bir işlemdir;
  - `def` FastAPI endpoint'lerinden çağrıldığında FastAPI zaten thread pool kullanır (güvenli).
  - `async def` context'lerinden çağrılacaksa `extract_embedding_async` / `verify_async` kullanın.
"""
import asyncio
import concurrent.futures
import numpy as np
import io
import base64
from typing import Optional, Tuple

# Yüz tanıma için ayrı bir thread pool — diğer sync route'larla rekabet etmez
_FACE_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="face-")

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
        import threading
        result = {"ok": False, "error": None}

        def _load():
            try:
                app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                app.prepare(ctx_id=0, det_size=(320, 320))
                self._app = app
                self._initialized = True
                result["ok"] = True
                print("FaceEngine: buffalo_l model loaded successfully.")
            except Exception as e:
                result["error"] = e

        t = threading.Thread(target=_load, daemon=True)
        t.start()
        t.join(timeout=120)  # 2 dakikadan uzun sürerse sunucu bloke olmaz
        if t.is_alive():
            print("WARNING: FaceEngine init timed out (120s). Face recognition disabled.")
        elif not result["ok"]:
            print(f"WARNING: FaceEngine init failed: {result['error']}")

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

    def check_liveness(
        self,
        image1_b64: str,
        image2_b64: Optional[str],
        emb1_cached: Optional[np.ndarray] = None,
    ) -> Tuple[bool, float, Optional[np.ndarray]]:
        """Pasif liveness: iki kare arasındaki embedding farkına bakarak statik görüntü saldırısını tespit eder.

        Returns:
            (is_live, similarity_score, emb1)
            emb1 döndürülür — çağıran tekrar hesaplamak zorunda kalmaz (çift embedding önlenir).
        """
        if not image2_b64:
            return True, 1.0, emb1_cached

        emb1 = emb1_cached if emb1_cached is not None else self.extract_embedding(image1_b64)
        emb2 = self.extract_embedding(image2_b64)

        if emb1 is None or emb2 is None:
            return False, 0.0, emb1

        sim = self.compare(emb1, emb2)
        # Aynı kişinin iki canlı karesi: sim ~0.85-0.98
        # Aynı statik fotoğraf: sim > 0.999
        if sim > 0.999:
            return False, 0.0, emb1
        if sim < 0.5:
            return False, 0.0, emb1
        return True, sim, emb1

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


async def extract_embedding_async(image_base64: str) -> Optional[np.ndarray]:
    """Async wrapper — async def endpoint'lerden güvenli çağrı için."""
    engine = get_face_engine()
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_FACE_EXECUTOR, engine.extract_embedding, image_base64)
