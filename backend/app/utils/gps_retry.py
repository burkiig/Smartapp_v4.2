"""
GPS Fake-Attempt Counter
========================
Sahte GPS denemelerini oturum bazında sayar.

Mimari kararı:
  - Retry sayacı geçici session-state'idir; DB'ye yazılmaz.
  - Mevcut rate_limit altyapısıyla aynı backend'i kullanır:
      REDIS_URL tanımlıysa → Redis (çok pod ortamı için tutarlı)
      tanımlı değilse      → In-memory dict + threading.Lock (tek pod)
  - TTL: 24 saat — oturum bu süre içinde kapanır, sayaç otomatik silinir.
  - Eşik değeri: system_settings tablosundaki "fake_gps_max_attempts" (varsayılan: 3)

Kullanım:
    from app.utils.gps_retry import increment_fake_gps_counter, reset_fake_gps_counter

    count = increment_fake_gps_counter(student_id=5, session_id=42)
    # → 1, 2, 3 ...
"""

import os
import threading
import time
from typing import Dict, Tuple

_TTL_SECONDS = 86_400  # 24 saat


class _InMemoryCounter:
    """Thread-safe in-memory sayaç: {key: (count, expiry_monotonic)}"""

    def __init__(self) -> None:
        self._store: Dict[str, Tuple[int, float]] = {}
        self._lock = threading.Lock()

    def increment(self, key: str, ttl: int = _TTL_SECONDS) -> int:
        now = time.monotonic()
        with self._lock:
            # Süresi dolmuş girişleri temizle (lazy)
            expired = [k for k, (_, exp) in self._store.items() if now >= exp]
            for k in expired:
                del self._store[k]

            count, expiry = self._store.get(key, (0, now + ttl))
            count += 1
            self._store[key] = (count, expiry)
            return count

    def reset(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def get(self, key: str) -> int:
        now = time.monotonic()
        with self._lock:
            count, expiry = self._store.get(key, (0, 0))
            if now >= expiry:
                return 0
            return count


class _RedisCounter:
    """Redis tabanlı sayaç — REDIS_URL tanımlıysa otomatik devreye girer."""

    def __init__(self, url: str) -> None:
        try:
            import redis as redis_lib  # type: ignore[import]
            self._r = redis_lib.from_url(url, decode_responses=True)
        except ImportError:
            raise RuntimeError(
                "REDIS_URL tanımlı ama 'redis' paketi kurulu değil. "
                "pip install redis komutunu çalıştırın."
            )

    def increment(self, key: str, ttl: int = _TTL_SECONDS) -> int:
        pipe = self._r.pipeline()
        pipe.incr(key)
        pipe.expire(key, ttl)
        count, _ = pipe.execute()
        return int(count)

    def reset(self, key: str) -> None:
        self._r.delete(key)

    def get(self, key: str) -> int:
        val = self._r.get(key)
        return int(val) if val else 0


def _build_counter():
    redis_url = os.getenv("REDIS_URL", "")
    if redis_url:
        try:
            return _RedisCounter(redis_url)
        except Exception:
            pass
    return _InMemoryCounter()


_counter = _build_counter()


def _key(student_id: int, session_id: int) -> str:
    return f"gps_fake:{student_id}:{session_id}"


def _location_key(student_id: int, session_id: int) -> str:
    return f"gps_location_retry:{student_id}:{session_id}"


def increment_fake_gps_counter(student_id: int, session_id: int) -> int:
    """Sayacı 1 artır ve yeni değeri döndür."""
    return _counter.increment(_key(student_id, session_id))


def reset_fake_gps_counter(student_id: int, session_id: int) -> None:
    """Öğrenci başarılı yoklama attığında veya oturum kapandığında sıfırla."""
    _counter.reset(_key(student_id, session_id))


def get_fake_gps_count(student_id: int, session_id: int) -> int:
    """Mevcut deneme sayısını döndür (sayaç artırmaz)."""
    return _counter.get(_key(student_id, session_id))


def increment_location_retry_counter(student_id: int, session_id: int) -> int:
    """Konum doğrulaması (geofence dışı) için deneme sayacını artırır."""
    return _counter.increment(_location_key(student_id, session_id))


def reset_location_retry_counter(student_id: int, session_id: int) -> None:
    """Konum doğrulaması tamamlandığında/sonuçlandığında sayacı sıfırlar."""
    _counter.reset(_location_key(student_id, session_id))


def get_location_retry_count(student_id: int, session_id: int) -> int:
    """Mevcut konum-deneme sayısını döndürür."""
    return _counter.get(_location_key(student_id, session_id))
