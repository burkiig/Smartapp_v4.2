from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.connection import get_db
from app.models.user import User
from app.security.jwt import is_token_revoked


def _decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token geçersiz veya süresi dolmuş",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _extract_token(request: Request, cookie_name: str) -> str:
    """
    Extract JWT from Authorization header (Bearer) first, then fall back to
    an httpOnly cookie. This allows both web-panel (cookie) and mobile/API
    clients (Bearer header) to authenticate transparently.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    cookie_val = request.cookies.get(cookie_name)
    if cookie_val:
        return cookie_val
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kimlik doğrulama gerekli",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(request, "access_token")
    payload = _decode_token(token)
    user_id: str = payload.get("sub")
    token_type: str = payload.get("type", "access")
    jti: str = payload.get("jti", "")

    if not user_id or token_type != "access":
        raise HTTPException(status_code=401, detail="Token geçersiz")

    if jti and is_token_revoked(jti):
        raise HTTPException(status_code=401, detail="Token iptal edilmiş, lütfen tekrar giriş yapın")

    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Token geçersiz")
    user = db.query(User).filter(User.id == uid, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


def get_current_user_from_refresh(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(request, "refresh_token")
    payload = _decode_token(token)
    user_id: str = payload.get("sub")
    token_type: str = payload.get("type", "access")
    jti: str = payload.get("jti", "")

    if not user_id or token_type != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token geçersiz")

    if jti and is_token_revoked(jti):
        raise HTTPException(status_code=401, detail="Refresh token iptal edilmiş")

    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Refresh token geçersiz")
    user = db.query(User).filter(User.id == uid, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")
    return current_user


def require_instructor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Bu işlem için öğretmen veya admin yetkisi gerekli")
    return current_user


def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Bu işlem yalnızca öğrenciler içindir")
    return current_user
