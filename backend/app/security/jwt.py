from datetime import datetime, timedelta, timezone
from typing import Set
import uuid
from jose import jwt
from app.config.settings import settings

# ── In-memory token blacklist (revoked JTIs) ────────────────────────────────
# For multi-server deployments, replace with Redis.
_revoked_jtis: Set[str] = set()


def revoke_token(jti: str) -> None:
    """Add a token's JTI to the blacklist."""
    _revoked_jtis.add(jti)


def is_token_revoked(jti: str) -> bool:
    """Return True if token has been revoked."""
    return jti in _revoked_jtis


def _create_token(user_id: int, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),   # unique token ID for revocation
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
