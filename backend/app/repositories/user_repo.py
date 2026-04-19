from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.user import User
from app.security.password import hash_password
from math import ceil


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_by_login(self, login: str) -> Optional[User]:
        """Find user by email or username"""
        user = self.get_by_email(login)
        if not user:
            user = self.get_by_username(login)
        return user

    def get_all(self, role: Optional[str] = None, page: int = 1, page_size: int = 50) -> dict:
        q = self.db.query(User)
        if role:
            q = q.filter(User.role == role)
        total = q.count()
        users = q.order_by(User.id).offset((page - 1) * page_size).limit(page_size).all()
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total / page_size) if page_size else 1,
            "users": users,
        }

    def get_all_list(self, role: Optional[str] = None) -> List[User]:
        """Return a flat list of users (no pagination) — for internal use only."""
        q = self.db.query(User)
        if role:
            q = q.filter(User.role == role)
        return q.all()

    def create(self, username: str, email: str, password: str, name: str,
               role: str = "student", department: Optional[str] = None,
               student_number: Optional[str] = None) -> User:
        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            name=name,
            role=role,
            department=department,
            student_number=student_number,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_push_token(self, user: User, push_token: str) -> User:
        user.push_token = push_token
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()
