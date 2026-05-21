from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional
from datetime import datetime

LEADERSHIP_ROLES = frozenset({"dean", "rector"})
STAFF_ROLES = frozenset({"admin", "instructor", "student", "dean", "rector"})


def _validate_password_strength(v: str) -> str:
    """Minimum şifre politikası: en az 8 karakter, 1 rakam, 1 büyük harf."""
    if len(v) < 8:
        raise ValueError("Şifre en az 8 karakter olmalıdır")
    if not any(c.isdigit() for c in v):
        raise ValueError("Şifre en az 1 rakam içermelidir")
    if not any(c.isupper() for c in v):
        raise ValueError("Şifre en az 1 büyük harf içermelidir")
    return v


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    name: str
    role: str = "student"
    department: Optional[str] = None
    student_number: Optional[str] = None
    scope_type: Optional[str] = None
    scope_value: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v):
        if v not in STAFF_ROLES:
            raise ValueError(f"role must be one of {sorted(STAFF_ROLES)}")
        return v

    @model_validator(mode="after")
    def validate_leadership_scope(self):
        if self.role == "dean":
            if self.scope_type != "department" or not (self.scope_value or "").strip():
                raise ValueError("dean role requires scope_type='department' and a non-empty scope_value")
        elif self.role == "rector":
            if self.scope_type and self.scope_type not in ("university", "faculty"):
                raise ValueError("rector scope_type must be 'university' or 'faculty'")
        elif self.scope_type or self.scope_value:
            raise ValueError("scope_type/scope_value are only valid for dean or rector roles")
        return self

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    student_number: Optional[str] = None
    push_token: Optional[str] = None
    is_active: Optional[bool] = None
    scope_type: Optional[str] = None
    scope_value: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v):
        if v is None:
            return v
        if v not in STAFF_ROLES:
            raise ValueError(f"role must be one of {sorted(STAFF_ROLES)}")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    name: str
    role: str
    department: Optional[str] = None
    student_number: Optional[str] = None
    scope_type: Optional[str] = None
    scope_value: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    """Supports login by email OR username"""
    login: str          # email or username
    password: str

    @field_validator("login", "password")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class PushTokenUpdate(BaseModel):
    push_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)
