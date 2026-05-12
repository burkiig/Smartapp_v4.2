from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
        data.enrolled_count = len(enroll_repo.get_by_course(c.id))
        data.instructor_ids = [ci.instructor_id for ci in c.course_instructors]
        data.instructor_names = [u.name for u in c.instructors if u.name]
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
    # shared_class_id doğrulama: değer verilmişse pozitif olmalı
    if data.shared_class_id is not None and data.shared_class_id <= 0:
        raise HTTPException(status_code=400, detail="shared_class_id pozitif bir tamsayı olmalı")
    return repo.create(
        code=data.code,
        name=data.name,
        instructor_id=data.instructor_id or current_user.id,
        schedule=data.schedule,
        default_duration_minutes=data.default_duration_minutes,
        shared_class_id=data.shared_class_id,
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
    data.instructor_ids = [ci.instructor_id for ci in course.course_instructors]
    data.instructor_names = [u.name for u in course.instructors if u.name]
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
    if current_user.role != "admin" and not repo.is_instructor_of_course(current_user.id, course_id):
        raise HTTPException(status_code=403, detail="Bu dersi güncelleme yetkiniz yok")
    return repo.update(course, **data.model_dump(exclude_none=True))


@router.get("/{course_id}/parallel", response_model=List[CourseResponse])
def get_parallel_courses(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bu dersle aynı shared_class_id'ye sahip paralel dersleri döndür."""
    repo = CourseRepository(db)
    enroll_repo = EnrollmentRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    if course.shared_class_id is None:
        return []
    parallels = repo.get_parallel_courses(course.shared_class_id)
    result = []
    for c in parallels:
        if c.id == course_id:
            continue  # kendisini hariç tut
        data = CourseResponse.model_validate(c)
        data.enrolled_count = len(enroll_repo.get_by_course(c.id))
        result.append(data)
    return result


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
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Derse öğrenci kaydı yalnızca admin tarafından yapılabilir."""
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


# ── Course Instructor management ──────────────────────────────────────────────

@router.get("/{course_id}/instructors")
def get_course_instructors(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Derse atanmış tüm öğretmenleri listele."""
    repo = CourseRepository(db)
    if not repo.get_by_id(course_id):
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    instructors = repo.get_instructors_for_course(course_id)
    from app.schemas.user import UserResponse
    return [UserResponse.model_validate(i) for i in instructors]


class InstructorAssign(BaseModel):
    instructor_id: int


@router.post("/{course_id}/instructors", status_code=201)
def add_course_instructor(
    course_id: int,
    data: InstructorAssign,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Derse yeni öğretmen ata (admin only)."""
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    from app.repositories.user_repo import UserRepository
    instructor = UserRepository(db).get_by_id(data.instructor_id)
    if not instructor or instructor.role not in ("instructor", "admin"):
        raise HTTPException(status_code=400, detail="Geçerli bir öğretmen ID'si girin")
    repo.add_instructor(course_id, data.instructor_id)
    return {"success": True, "message": "Öğretmen derse eklendi"}


@router.delete("/{course_id}/instructors/{instructor_id}")
def remove_course_instructor(
    course_id: int,
    instructor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Öğretmeni dersten kaldır (admin only)."""
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    removed = repo.remove_instructor(course_id, instructor_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Bu öğretmen bu derse atanmamış")
    # Primary instructor kaldırılıyorsa courses.instructor_id'yi temizle
    if course.instructor_id == instructor_id:
        remaining = repo.get_instructors_for_course(course_id)
        new_primary = remaining[0].id if remaining else None
        repo.update(course, instructor_id=new_primary)
    return {"success": True, "message": "Öğretmen dersten kaldırıldı"}
