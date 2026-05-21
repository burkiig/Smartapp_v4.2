"""Generic IP-based fixed-window rate limiter for FastAPI.

Mimari:
  - Depolama  : In-memory Dict (tek süreç için yeterli).
                Production'da çok pod çalışıyorsa REDIS_URL env değişkeni
                tanımlanmış olursa otomatik olarak Redis backend'e geçer.
  - Pencere   : Fixed Window — her IP için (endpoint, window_start) bazlı sayaç.
  - Temizlik  : Lazy — pencere süresi dolmuş girişler bir sonraki istekte silinir,
                belleği sonsuz büyümekten korur (jwt.py blacklist'iyle aynı desen).
  - Thread    : threading.Lock ile thread-safe.

Kullanım (FastAPI dependency olarak):
    from app.security.rate_limit import rate_limit

    @router.post("/login")
    def login(
        request: Request,
        _: None = Depends(rate_limit("10/minute")),
        ...
    ):
        ...
"""

import os
import threading
import time
from typing import Callable, Dict, Tuple

from fastapi import HTTPException, Request


# ── IP çıkarma yardımcısı ─────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    """
    Gerçek istemci IP'sini al.
    TRUST_PROXY_HEADERS=true ortam değişkeni ayarlandığında ve reverse proxy
    (nginx, Traefik) arkasında çalışıldığında X-Forwarded-For header'ını kullanır.
    Aksi hâlde doğrudan bağlantının socket adresini kullanır.
    """
    if os.getenv("TRUST_PROXY_HEADERS", "").lower() == "true":
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Limit string ayrıştırıcı ─────────────────────────────────────────────────

def _parse_limit(limit_str: str) -> Tuple[int, int]:
    """
    '10/minute' → (10, 60) dönüştürür.
    Desteklenen birimler: second | minute | hour
    """
    parts = limit_str.strip().split("/")
    if len(parts) != 2:
        raise ValueError(f"Geçersiz rate limit formatı: '{limit_str}'. Örnek: '10/minute'")

    try:
        max_requests = int(parts[0])
    except ValueError:
        raise ValueError(f"İstek sayısı tamsayı olmalı: '{parts[0]}'")

    unit_map = {"second": 1, "minute": 60, "hour": 3600}
    unit = parts[1].lower()
    if unit not in unit_map:
        raise ValueError(f"Bilinmeyen zaman birimi '{unit}'. Kullanın: second, minute, hour")

    return max_requests, unit_map[unit]


# ── In-memory fixed-window store ──────────────────────────────────────────────

class _FixedWindowStore:
    """
    Thread-safe in-memory sabit pencereli sayaç deposu.

    Durum: { key: (count, window_start_monotonic) }

    Her erişimde süresi dolmuş pencereler temizlenir (lazy cleanup),
    böylece dict hiçbir zaman "etkin istek sayısı"ndan fazla büyümez.
    """

    def __init__(self) -> None:
        self._store: Dict[str, Tuple[int, float]] = {}
        self._lock = threading.Lock()

    # Periyodik temizlik: her N istekte bir tüm store taranır
    _CLEANUP_INTERVAL = 500  # istek sayısı
    _request_count: int = 0

    def is_allowed(
        self, key: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, int]:
        """
        İsteğe izin ver ya da reddet.

        Returns:
            (allowed, retry_after_seconds)
            allowed=True → istek kabul edildi
            allowed=False → retry_after saniye sonra tekrar dene
        """
        now = time.monotonic()

        with self._lock:
            # Periyodik temizlik: her 500 istekte bir süresi dolmuş girişleri sil
            # (her istekte O(n) tarama yerine amortized düşük maliyet)
            self._request_count += 1
            if self._request_count >= self._CLEANUP_INTERVAL:
                self._request_count = 0
                expired = [
                    k for k, (_, ws) in self._store.items()
                    if now - ws >= window_seconds
                ]
                for k in expired:
                    del self._store[k]

            if key not in self._store:
                self._store[key] = (1, now)
                return True, 0

            count, window_start = self._store[key]
            elapsed = now - window_start

            if elapsed >= window_seconds:
                # Pencere doldu — yeni pencere başlat
                self._store[key] = (1, now)
                return True, 0

            if count >= max_requests:
                retry_after = int(window_seconds - elapsed) + 1
                return False, retry_after

            self._store[key] = (count + 1, window_start)
            return True, 0


# ── Redis backend (opsiyonel) ─────────────────────────────────────────────────

class _RedisWindowStore:
    """
    Redis tabanlı sabit pencereli sayaç.
    REDIS_URL env değişkeni tanımlandığında otomatik olarak devreye girer.
    Çok pod / çok sunucu ortamında tutarlı rate limiting için zorunludur.
    """

    def __init__(self, url: str) -> None:
        try:
            import redis as redis_lib  # type: ignore[import]
            self._r = redis_lib.from_url(url, decode_responses=True)
        except ImportError:
            raise RuntimeError(
                "REDIS_URL tanımlı ama 'redis' paketi kurulu değil. "
                "pip install redis komutunu çalıştırın."
            )

    def is_allowed(
        self, key: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, int]:
        pipe = self._r.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        count, ttl = pipe.execute()

        if count == 1:
            # İlk istek — TTL belirle
            self._r.expire(key, window_seconds)
            return True, 0

        if count > max_requests:
            retry_after = max(ttl, 1)
            return False, retry_after

        return True, 0


# ── Backend seçimi ────────────────────────────────────────────────────────────

def _build_store():
    redis_url = os.getenv("REDIS_URL", "")
    if redis_url:
        try:
            store = _RedisWindowStore(redis_url)
            return store
        except Exception:
            pass  # Redis bağlantısı başarısız → in-memory'e düş
    return _FixedWindowStore()


_store = _build_store()


# ── Test yardımcısı ───────────────────────────────────────────────────────────

def reset_for_testing() -> None:
    """
    Tüm rate limit sayaçlarını sıfırla.
    Sadece test ortamında çağır — her test başında temiz sayfa açar.
    """
    if isinstance(_store, _FixedWindowStore):
        with _store._lock:
            _store._store.clear()


# ── Public API ────────────────────────────────────────────────────────────────

def rate_limit(limit: str, key_prefix: str = "") -> Callable:
    """
    FastAPI dependency factory — IP tabanlı sabit pencere hız sınırlaması.

    Args:
        limit      : '10/minute' formatında limit. Birimler: second, minute, hour.
        key_prefix : Bucket namespace'i (boş bırakılırsa endpoint path kullanılır).
                     Aynı limiti birden fazla endpoint'e uygularken faydalıdır.

    Kullanım:
        @router.post("/scan-qr")
        def scan_qr(
            request: Request,
            _: None = Depends(rate_limit("30/minute")),
            ...
        ):

    Hata:
        HTTP 429  → Retry-After header ile birlikte döner.
    """
    max_requests, window_seconds = _parse_limit(limit)

    def _dependency(request: Request) -> None:
        ip = get_client_ip(request)
        prefix = key_prefix or request.url.path
        key = f"rl:{prefix}:{ip}"

        allowed, retry_after = _store.is_allowed(key, max_requests, window_seconds)

        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Çok fazla istek gönderdiniz. "
                    f"Lütfen {retry_after} saniye bekleyin."
                ),
                headers={"Retry-After": str(retry_after)},
            )

    return _dependency
