from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.connection import get_db
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.repositories.user_repo import UserRepository
from app.security.dependencies import get_current_user, require_admin, require_instructor
from app.models.user import User

router = APIRouter()


@router.get("/")
def get_users(
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with pagination (admin only)"""
    repo = UserRepository(db)
    return repo.get_all(role=role, page=page, page_size=page_size)


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Create user — admin can create any role, instructor can only create students"""
    if current_user.role == "instructor" and data.role not in ("student",):
        raise HTTPException(status_code=403, detail="Öğretmenler yalnızca öğrenci hesabı oluşturabilir")

    repo = UserRepository(db)
    if repo.get_by_email(data.email):
        raise HTTPException(status_code=409, detail="Bu e-posta adresi zaten kullanılıyor")
    if repo.get_by_username(data.username):
        raise HTTPException(status_code=409, detail="Bu kullanıcı adı zaten kullanılıyor")

    return repo.create(
        username=data.username,
        email=data.email,
        password=data.password,
        name=data.name,
        role=data.role,
        department=data.department,
        student_number=data.student_number,
    )


@router.get("/students", response_model=List[UserResponse])
def get_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all students (admin & instructor)"""
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    repo = UserRepository(db)
    return repo.get_all_list(role="student")


@router.get("/instructors", response_model=List[UserResponse])
def get_instructors(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all instructors (admin only)"""
    repo = UserRepository(db)
    return repo.get_all_list(role="instructor")


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return repo.update(user, **data.model_dump(exclude_none=True))


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    repo.delete(user)
    return {"success": True, "message": "Kullanıcı silindi"}
