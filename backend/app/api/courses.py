from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.connection import get_db
from app.schemas.course import CourseCreate, CourseUpdate, CourseResponse, EnrollmentCreate, EnrollmentResponse
from app.repositories.course_repo import CourseRepository, EnrollmentRepository
from app.security.dependencies import get_current_user, require_admin, require_instructor
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[CourseResponse])
def get_courses(
    instructor_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    enroll_repo = EnrollmentRepository(db)

    # Instructor only sees their own courses
    if current_user.role == "instructor":
        instructor_id = current_user.id
    # Student only sees enrolled courses
    if current_user.role == "student":
        enrollments = enroll_repo.get_by_student(current_user.id)
        course_ids = [e.course_id for e in enrollments]
        courses = [repo.get_by_id(cid) for cid in course_ids if repo.get_by_id(cid)]
    else:
        courses = repo.get_all(instructor_id=instructor_id)

    result = []
    for c in courses:
        data = CourseResponse.model_validate(c)
        data.enrolled_count = enroll_repo.get_by_course(c.id).__len__()
        result.append(data)
    return result


@router.post("/", response_model=CourseResponse, status_code=201)
def create_course(
    data: CourseCreate,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    if repo.get_by_code(data.code):
        raise HTTPException(status_code=409, detail="Bu ders kodu zaten mevcut")
    return repo.create(
        code=data.code,
        name=data.name,
        instructor_id=data.instructor_id or current_user.id,
        schedule=data.schedule,
        default_duration_minutes=data.default_duration_minutes,
    )


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    data = CourseResponse.model_validate(course)
    enroll_repo = EnrollmentRepository(db)
    data.enrolled_count = len(enroll_repo.get_by_course(course_id))
    return data


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    data: CourseUpdate,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    if current_user.role != "admin" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu dersi güncelleme yetkiniz yok")
    return repo.update(course, **data.model_dump(exclude_none=True))


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    repo.delete(course)
    return {"success": True, "message": "Ders silindi"}


# ── Enrollment endpoints ──────────────────────────────────────────────────────

@router.post("/{course_id}/enroll")
def enroll_student(
    course_id: int,
    data: EnrollmentCreate,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Enroll a student to a course (instructor/admin only)"""
    course_repo = CourseRepository(db)
    enroll_repo = EnrollmentRepository(db)

    if not course_repo.get_by_id(course_id):
        raise HTTPException(status_code=404, detail="Ders bulunamadı")

    existing = enroll_repo.get(data.student_id, course_id)
    if existing:
        raise HTTPException(status_code=409, detail="Öğrenci bu derse zaten kayıtlı")

    enrollment = enroll_repo.create(data.student_id, course_id)
    return {"success": True, "message": "Öğrenci derse kaydedildi", "enrollment_id": enrollment.id}


@router.delete("/{course_id}/enroll/{student_id}")
def unenroll_student(
    course_id: int,
    student_id: int,
    current_user: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    enroll_repo = EnrollmentRepository(db)
    enrollment = enroll_repo.get(student_id, course_id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    enroll_repo.delete(enrollment)
    return {"success": True, "message": "Öğrenci dersten çıkarıldı"}


@router.get("/{course_id}/students")
def get_course_students(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Yetki gerekli")
    enroll_repo = EnrollmentRepository(db)
    enrollments = enroll_repo.get_by_course(course_id)
    from app.repositories.user_repo import UserRepository
    user_repo = UserRepository(db)
    students = [user_repo.get_by_id(e.student_id) for e in enrollments]
    from app.schemas.user import UserResponse
    return [UserResponse.model_validate(s) for s in students if s]
