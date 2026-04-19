from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.user_repo import UserRepository
from app.security.password import verify_password
from app.security.jwt import create_access_token, create_refresh_token
from app.models.user import User


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def login(self, login: str, password: str) -> dict:
        user = self.user_repo.get_by_login(login)
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı adı/e-posta veya şifre hatalı")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Hesap devre dışı bırakılmış")
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Kullanıcı adı/e-posta veya şifre hatalı")

        return {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
            "user": user,
        }

    def refresh(self, user: User) -> dict:
        return {
            "access_token": create_access_token(user.id),
            "token_type": "bearer",
        }
