from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from typing import Optional

from app.database.connection import get_db
from app.schemas.user import LoginRequest, TokenResponse, UserResponse, PushTokenUpdate
from app.services.auth_service import AuthService
from app.security.dependencies import get_current_user, get_current_user_from_refresh
from app.security.jwt import revoke_token
from app.repositories.user_repo import UserRepository
from app.models.user import User
from app.config.settings import settings
from app.services.audit_service import log_action

router = APIRouter()

# ── Simple in-memory rate limiter for login ────────────────────────────────
import time
from collections import defaultdict

_login_attempts: dict = defaultdict(list)
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 60


def _check_login_rate(client_ip: str) -> None:
    now = time.time()
    attempts = _login_attempts[client_ip]
    _login_attempts[client_ip] = [t for t in attempts if now - t < _WINDOW_SECONDS]
    if len(_login_attempts[client_ip]) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Çok fazla başarısız giriş denemesi. {_WINDOW_SECONDS} saniye bekleyin.",
            headers={"Retry-After": str(_WINDOW_SECONDS)},
        )
    _login_attempts[client_ip].append(now)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _cookie_kwargs(path: str, max_age: int) -> dict:
    """Build consistent cookie attributes."""
    kwargs = dict(
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=max_age,
        path=path,
    )
    if settings.COOKIE_DOMAIN:
        kwargs["domain"] = settings.COOKIE_DOMAIN
    return kwargs


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: Optional[str] = None,
) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        **_cookie_kwargs("/", settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
    )
    if refresh_token is not None:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            **_cookie_kwargs("/", settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600),
        )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    if settings.COOKIE_DOMAIN:
        response.delete_cookie("access_token", path="/", domain=settings.COOKIE_DOMAIN)
        response.delete_cookie("refresh_token", path="/", domain=settings.COOKIE_DOMAIN)


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Login with email or username + password. Sets httpOnly auth cookies."""
    ip = _get_client_ip(request)
    _check_login_rate(ip)
    service = AuthService(db)
    try:
        result = service.login(data.login, data.password)
    except HTTPException as exc:
        log_action(db, "login_failed", detail={"login": data.login, "reason": exc.detail}, ip_address=ip)
        raise
    user = UserRepository(db).get_by_login(data.login)
    log_action(
        db, "login_success",
        actor_id=user.id if user else None,
        actor_role=user.role if user else None,
        resource="user", resource_id=user.id if user else None,
        ip_address=ip,
    )
    _set_auth_cookies(response, result["access_token"], result["refresh_token"])
    return result


@router.post("/refresh")
def refresh_token(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user_from_refresh),
    db: Session = Depends(get_db),
):
    """Get new access token. Accepts refresh token from cookie or Authorization header.
    Revokes the old refresh token (rotation)."""
    # Extract and revoke old refresh token (from header or cookie)
    old_token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        old_token = auth_header[7:]
    else:
        old_token = request.cookies.get("refresh_token")

    if old_token:
        try:
            payload = jwt.decode(old_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            old_jti = payload.get("jti")
            if old_jti:
                revoke_token(old_jti)
        except JWTError:
            pass

    service = AuthService(db)
    result = service.refresh(current_user)
    # Only refresh the access_token cookie; issue a new refresh token too
    from app.security.jwt import create_refresh_token
    new_refresh = create_refresh_token(current_user.id)
    result["refresh_token"] = new_refresh
    _set_auth_cookies(response, result["access_token"], new_refresh)
    return result


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/push-token")
def update_push_token(
    data: PushTokenUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = UserRepository(db)
    repo.update_push_token(current_user, data.push_token)
    return {"success": True, "message": "Push token kaydedildi"}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logout — revokes access token and clears auth cookies."""
    # Revoke access token (from header or cookie)
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        token = request.cookies.get("access_token")

    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            jti = payload.get("jti")
            if jti:
                revoke_token(jti)
        except JWTError:
            pass

    _clear_auth_cookies(response)
    log_action(
        db, "logout",
        actor_id=current_user.id, actor_role=current_user.role,
        resource="user", resource_id=current_user.id,
        ip_address=_get_client_ip(request),
    )
    return {"success": True, "message": "Çıkış başarılı, token iptal edildi"}
