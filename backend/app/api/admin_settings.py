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
}


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
    return {
        "key": setting.key,
        "value": setting.value,
        "description": setting.description,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
    }


def get_setting_value(db: Session, key: str, default: str = "") -> str:
    """Helper used by other services to read a setting at runtime."""
    s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if s:
        return s.value
    return _DEFAULTS.get(key, (default, ""))[0]
