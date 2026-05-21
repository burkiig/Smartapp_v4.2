from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io

from app.database.connection import get_db
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.repositories.user_repo import UserRepository
from app.repositories.course_repo import CourseRepository, EnrollmentRepository
from app.security.dependencies import get_current_user, require_admin, require_instructor
from app.security.user_privileges import apply_create_scope, enforce_update_privileges
from app.models.course import Course
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
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create user — admin only"""
    repo = UserRepository(db)
    if repo.get_by_email(data.email):
        raise HTTPException(status_code=409, detail="Bu e-posta adresi zaten kullanılıyor")
    if repo.get_by_username(data.username):
        raise HTTPException(status_code=409, detail="Bu kullanıcı adı zaten kullanılıyor")

    data = apply_create_scope(data)

    return repo.create(
        username=data.username,
        email=data.email,
        password=data.password,
        name=data.name,
        role=data.role,
        department=data.department,
        student_number=data.student_number,
        scope_type=data.scope_type,
        scope_value=data.scope_value,
    )


@router.get("/students", response_model=List[UserResponse])
def get_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Öğrenci listesi: admin tüm öğrenciler; öğretmen yalnızca derslerine kayıtlı öğrenciler."""
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    repo = UserRepository(db)
    if current_user.role == "admin":
        return repo.get_all_list(role="student")
    course_repo = CourseRepository(db)
    enroll_repo = EnrollmentRepository(db)
    my_course_ids = {c.id for c in course_repo.get_by_instructor(current_user.id)}
    my_course_ids.update(
        cid for cid, in db.query(Course.id).filter(Course.instructor_id == current_user.id)
    )
    student_ids = set()
    for cid in my_course_ids:
        for e in enroll_repo.get_by_course(cid):
            student_ids.add(e.student_id)
    if not student_ids:
        return []
    out = [repo.get_by_id(uid) for uid in student_ids]
    return sorted(
        [UserResponse.model_validate(u) for u in out if u],
        key=lambda x: (x.name or x.username or "").lower(),
    )


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
    if data.role is not None and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Rol değişikliği yalnızca admin tarafından yapılabilir")
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    updates = enforce_update_privileges(current_user, user, data)
    if not updates:
        return user
    return repo.update(user, **updates)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    force: bool = False,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Kullanıcı sil (admin only).
    force=false (varsayılan): soft delete — kullanıcı pasifleştirilir, tüm veriler korunur.
    force=true: kalıcı silme — yoklama/mazeret kaydı varsa 409 döner (önce dışa aktarın).
    """
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı silemezsiniz")
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if force:
        repo.hard_delete(user)
        return {"success": True, "message": "Kullanıcı kalıcı olarak silindi"}
    repo.deactivate(user)
    return {"success": True, "message": "Kullanıcı pasifleştirildi (soft delete)"}


@router.post("/bulk-import")
async def bulk_import_users(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """CSV ile toplu kullanıcı ekleme (admin only).

    CSV başlık satırı: username,email,password,name,role,department,student_number
    role değerleri: student | instructor | admin
    department ve student_number isteğe bağlıdır.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Sadece .csv dosyası kabul edilir")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # BOM'lu UTF-8 de desteklenir
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Dosya UTF-8 formatında olmalıdır")

    reader = csv.DictReader(io.StringIO(text))
    required_cols = {"username", "email", "password", "name", "role"}
    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV başlık satırı eksik. Gerekli sütunlar: {', '.join(sorted(required_cols))}",
        )

    repo = UserRepository(db)
    created, skipped = [], []

    for i, row in enumerate(reader, start=2):
        username = (row.get("username") or "").strip()
        email    = (row.get("email")    or "").strip()
        password = (row.get("password") or "").strip()
        name     = (row.get("name")     or "").strip()
        role     = (row.get("role")     or "student").strip().lower()

        if not all([username, email, password, name]):
            skipped.append({"row": i, "reason": "Zorunlu alan boş (username/email/password/name)"})
            continue

        if role not in ("student", "instructor", "admin"):
            skipped.append({"row": i, "username": username, "reason": f"Geçersiz rol: {role}"})
            continue

        if repo.get_by_email(email) or repo.get_by_username(username):
            skipped.append({"row": i, "username": username, "reason": "Kullanıcı zaten mevcut"})
            continue

        try:
            user = repo.create(
                username=username,
                email=email,
                password=password,
                name=name,
                role=role,
                department=(row.get("department") or "").strip() or None,
                student_number=(row.get("student_number") or "").strip() or None,
            )
            created.append({"id": user.id, "username": user.username, "role": user.role})
        except Exception as exc:
            skipped.append({"row": i, "username": username, "reason": str(exc)})

    return {
        "success": True,
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped,
    }
