"""
JWT token yönetimi — oluşturma, doğrulama ve iptal (blacklist).

Blacklist stratejisi:
  - Depolama : REDIS_URL tanımlıysa Redis (çok worker/pod için güvenli),
               yoksa in-memory Dict[jti, expire_unix_timestamp] (tek süreç).
  - Temizlik  : In-memory modda lazy O(n); Redis modda TTL otomatik expire.
  - Kapsam    : Üretimde birden fazla Gunicorn worker çalıştırıldığında
                REDIS_URL zorunludur — aksi hâlde her worker kendi
                blacklist'ini tutar ve logout revocation tutarsız olur.
"""

import os
import time
import uuid
import warnings
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from jose import jwt

from app.config.settings import settings


# ── Blacklist backend seçimi ─────────────────────────────────────────────────

class _InMemoryBlacklist:
    """Tek süreç için yeterli in-memory blacklist."""

    def __init__(self) -> None:
        self._store: Dict[str, float] = {}

    def add(self, jti: str, expire_unix_ts: float) -> None:
        self._store[jti] = expire_unix_ts

    def contains(self, jti: str) -> bool:
        now = time.time()
        expired_keys = [k for k, exp in self._store.items() if exp <= now]
        for k in expired_keys:
            del self._store[k]
        return jti in self._store


class _RedisBlacklist:
    """Redis tabanlı blacklist — çok worker/pod ortamında tutarlı logout revocation."""

    def __init__(self, url: str) -> None:
        import redis as redis_lib  # type: ignore[import]
        self._r = redis_lib.from_url(url, decode_responses=True)

    def add(self, jti: str, expire_unix_ts: float) -> None:
        ttl = max(1, int(expire_unix_ts - time.time()))
        self._r.setex(f"bl:{jti}", ttl, "1")

    def contains(self, jti: str) -> bool:
        return bool(self._r.exists(f"bl:{jti}"))


def _build_blacklist():
    redis_url = os.getenv("REDIS_URL", "")
    if redis_url:
        try:
            bl = _RedisBlacklist(redis_url)
            return bl
        except Exception:
            pass  # Redis bağlantısı başarısız → in-memory'e düş
    return _InMemoryBlacklist()


_blacklist = _build_blacklist()

# Üretimde Redis yoksa ve birden fazla worker varsa uyar
if isinstance(_blacklist, _InMemoryBlacklist) and not settings.TESTING:
    warnings.warn(
        "\n⚠️  JWT BLACKLIST UYARISI: REDIS_URL tanımlı değil, in-memory blacklist kullanılıyor.\n"
        "   Birden fazla Gunicorn worker çalıştırıldığında logout revocation tutarsız olabilir.\n"
        "   Üretim için REDIS_URL ortam değişkenini ayarlayın.",
        stacklevel=2,
    )


def revoke_token(jti: str, expire_unix_ts: Optional[float] = None) -> None:
    """JTI'yi blacklist'e ekle. expire_unix_ts token'ın 'exp' claim değeri (unix timestamp)."""
    if expire_unix_ts is None:
        expire_unix_ts = time.time() + (settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400)
    _blacklist.add(jti, expire_unix_ts)


def is_token_revoked(jti: str) -> bool:
    """Token'ın revoke edilip edilmediğini kontrol et."""
    return _blacklist.contains(jti)


# ── Token oluşturma ───────────────────────────────────────────────────────────


def _create_token(user_id: int, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),  # revocation için benzersiz token ID
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        user_id,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_password_reset_token(user_id: int) -> str:
    return _create_token(user_id, "password_reset", timedelta(minutes=15))
