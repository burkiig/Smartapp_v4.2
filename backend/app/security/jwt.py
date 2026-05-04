"""
JWT token yönetimi — oluşturma, doğrulama ve iptal (blacklist).

Blacklist stratejisi:
  - Depolama : Dict[jti, expire_unix_timestamp]
  - Temizlik  : is_token_revoked() her çağrıldığında süresi dolmuş
                girişleri siler (lazy / amortized O(n)).
  - Kapsam    : Tek süreç için yeterli. Çok sunucu ortamında
                bu dict'i Redis ile değiştir; arayüz aynı kalır.

Neden Set değil Dict?
  - Set sonsuz büyür: logout edilen her token süresi dolduktan
    sonra da kümede kalır. 30 günlük refresh token varken bu
    ciddi bellek sızıntısı yaratır.
  - Dict + expire timestamp ile süresi dolmuş tokenlar otomatik
    silinir; bellek kullanımı hiçbir zaman "aktif token sayısı"nı
    geçmez.
"""

import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict

from jose import jwt

from app.config.settings import settings

# ── Token blacklist: {jti: expire_unix_timestamp} ────────────────────────────
_revoked_jtis: Dict[str, float] = {}


def revoke_token(jti: str, expire_unix_ts: float | None = None) -> None:
    """
    JTI'yi blacklist'e ekle.

    expire_unix_ts: token'ın kendi 'exp' claim değeri (unix timestamp).
    Verilmezse maks. refresh TTL kadar tutulur (en kötü durum).
    Bu değeri her zaman token payload'ından alıp geçirmek tercih edilir;
    böylece tokenlar tam sürelerinde silinir, daha erken veya geç değil.
    """
    if expire_unix_ts is None:
        # Güvenli fallback: refresh token ömrü kadar tut
        expire_unix_ts = time.time() + (settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400)
    _revoked_jtis[jti] = expire_unix_ts


def is_token_revoked(jti: str) -> bool:
    """
    Token'ın revoke edilip edilmediğini kontrol et.

    Aynı zamanda lazy cleanup yapar: süresi dolmuş tüm girişleri
    tek bir geçişte siler. Bu işlem request başına bir kez çalışır
    ve amortized O(1) maliyetlidir.
    """
    now = time.time()

    # Süresi dolmuş girişleri temizle — bellek sızıntısını önler
    expired_keys = [k for k, exp in _revoked_jtis.items() if exp <= now]
    for k in expired_keys:
        del _revoked_jtis[k]

    return jti in _revoked_jtis


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
