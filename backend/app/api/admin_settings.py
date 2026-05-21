import time
import threading

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database.connection import get_db
from app.models.system_setting import SystemSetting
from app.security.dependencies import require_admin

router = APIRouter()

# Default settings seeded on first access
_DEFAULTS = {
    "qr_token_ttl_seconds": ("60", "QR kod geçerlilik süresi (saniye)"),
    "min_attendance_rate": ("70", "Minimum devam oranı (%)"),
    "geofence_radius_m": ("50", "Konum doğrulama yarıçapı (metre)"),
    "fake_gps_max_attempts": ("3", "Sahte GPS denemesi eşiği — bu sayıya ulaşınca öğretmene bildirim gönderilir"),
}

# ── In-memory TTL cache — her QR taramasında DB'ye gitmemek için ─────────────
# Sistem ayarları nadiren değiştiğinden 60 saniyelik cache yeterlidir.
_SETTINGS_CACHE_TTL = 60  # saniye
_settings_cache: dict = {}          # {key: value}
_settings_cache_ts: float = 0.0     # son dolum zamanı (monotonic)
_settings_cache_lock = threading.Lock()


def _is_cache_valid() -> bool:
    return (time.monotonic() - _settings_cache_ts) < _SETTINGS_CACHE_TTL


def _invalidate_cache() -> None:
    """Ayar değiştiğinde cache'i sıfırla — update_setting() tarafından çağrılır."""
    global _settings_cache_ts
    with _settings_cache_lock:
        _settings_cache_ts = 0.0


def _get_or_create(db: Session, key: str) -> SystemSetting:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        default_val, desc = _DEFAULTS.get(key, ("", ""))
        setting = SystemSetting(key=key, value=default_val, description=desc)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("/")
def get_settings(
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Ensure all defaults exist
    for key in _DEFAULTS:
        _get_or_create(db, key)

    settings = db.query(SystemSetting).all()
    return [
        {
            "key": s.key,
            "value": s.value,
            "description": s.description,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in settings
    ]


class SettingUpdate(BaseModel):
    value: str


@router.put("/{key}")
def update_setting(
    key: str,
    data: SettingUpdate,
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    setting = _get_or_create(db, key)
    setting.value = data.value
    db.commit()
    db.refresh(setting)
    _invalidate_cache()  # Yeni değer hemen geçerli olsun
    return {
        "key": setting.key,
        "value": setting.value,
        "description": setting.description,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
    }


def get_setting_value(db: Session, key: str, default: str = "") -> str:
    """Sistem ayarını döndürür — TTL cache ile her QR taramasında DB sorgusu atılmaz."""
    global _settings_cache_ts

    with _settings_cache_lock:
        if _is_cache_valid() and key in _settings_cache:
            return _settings_cache[key]

    # Cache süresi dolmuş veya boş — DB'den tüm ayarları bir seferde çek
    rows = db.query(SystemSetting).all()
    now = time.monotonic()
    with _settings_cache_lock:
        for row in rows:
            _settings_cache[row.key] = row.value
        _settings_cache_ts = now

    if key in _settings_cache:
        return _settings_cache[key]
    return _DEFAULTS.get(key, (default, ""))[0]
