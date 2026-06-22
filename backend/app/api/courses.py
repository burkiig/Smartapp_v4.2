from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func

from app.database.connection import get_db
from app.schemas.course import CourseCreate, CourseUpdate, CourseResponse, EnrollmentCreate, EnrollmentResponse
from app.repositories.course_repo import CourseRepository, EnrollmentRepository
from app.security.dependencies import get_current_user, require_admin, require_instructor
from app.models.user import User
from app.models.course import Course

router = APIRouter()


def _next_shared_class_id(db: Session) -> int:
    max_shared = (
        db.query(func.max(Course.shared_class_id))
        .filter(Course.shared_class_id.isnot(None))
        .scalar()
    )
    return int(max_shared or 0) + 1


def _is_english_request(request: Request) -> bool:
    language = (request.headers.get("accept-language") or "").lower()
    return language.startswith("en")


def _build_delete_blocked_message(deps: dict[str, int], english: bool) -> str:
    labels = {
        "attendance_sessions": ("oturum", "session"),
        "final_attendance_records": ("yoklama kaydı", "attendance record"),
        "class_cancellations": ("ders iptali kaydı", "class cancellation"),
        "disputes": ("itiraz", "dispute"),
        "excuses": ("mazeret", "excuse"),
    }
    active = [(labels[key], count) for key, count in deps.items() if count > 0]
    summary = ", ".join(
        f"{count} {label[1] if english else label[0]}" for label, count in active
    )
    if english:
        return (
            "This course cannot be deleted because it has related data: "
            f"{summary}. Archive (soft delete) or clean related data first."
        )
    return (
        "Bu ders silinemiyor çünkü bağlı veriler var: "
        f"{summary}. Önce arşivleyin (soft delete) veya bağlı verileri temizleyin."
    )


class ParallelLinkRequest(BaseModel):
    course_id: int
    with_course_id: int


@router.post("/parallel/link")
def link_parallel_courses(
    data: ParallelLinkRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Link two courses into the same parallel group without manual ID entry.
    If both courses already belong to different groups, groups are merged.
    """
    if data.course_id == data.with_course_id:
        raise HTTPException(status_code=400, detail="Aynı ders kendiyle paralel bağlanamaz")

    repo = CourseRepository(db)
    course_a = repo.get_by_id(data.course_id)
    course_b = repo.get_by_id(data.with_course_id)
    if not course_a or not course_b:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")

    target_group_id = course_a.shared_class_id or course_b.shared_class_id or _next_shared_class_id(db)
    old_group_ids = {
        gid for gid in [course_a.shared_class_id, course_b.shared_class_id]
        if gid is not None and gid != target_group_id
    }

    # Merge existing parallel groups into one target group.
    if old_group_ids:
        db.query(Course).filter(Course.shared_class_id.in_(old_group_ids)).update(
            {Course.shared_class_id: target_group_id},
            synchronize_session=False,
        )

    course_a.shared_class_id = target_group_id
    course_b.shared_class_id = target_group_id
    db.commit()
    db.refresh(course_a)
    db.refresh(course_b)

    return {
        "success": True,
        "shared_class_id": target_group_id,
        "course_ids": sorted({course_a.id, course_b.id}),
        "message": "Dersler paralel gruba bağlandı",
    }


@router.get("/", response_model=List[CourseResponse])
def get_courses(
    instructor_id: Optional[int] = None,
    department: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    enroll_repo = EnrollmentRepository(db)

    # Instructor only sees their own courses
    if current_user.role == "instructor":
        instructor_id = current_user.id
    # Student sees enrolled courses + same parallel group courses
    if current_user.role == "student":
        enrollments = enroll_repo.get_by_student(current_user.id)
        courses_by_id: dict[int, Course] = {}
        for enrollment in enrollments:
            course = repo.get_by_id(enrollment.course_id)
            if course is None:
                continue
            courses_by_id[course.id] = course
            if course.shared_class_id is None:
                continue
            for parallel_course in repo.get_parallel_courses(course.shared_class_id):
                courses_by_id[parallel_course.id] = parallel_course
        courses = list(courses_by_id.values())
    else:
        courses = repo.get_all(instructor_id=instructor_id, department=department)

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
    # Instructor can only create courses for themselves; admin may assign any instructor_id
    if current_user.role == "instructor":
        assigned_instructor_id = current_user.id
    else:
        assigned_instructor_id = data.instructor_id or current_user.id

    return repo.create(
        code=data.code,
        name=data.name,
        department=data.department.strip() if data.department else None,
        instructor_id=assigned_instructor_id,
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
    payload = data.model_dump(exclude_none=True)
    if "department" in payload:
        payload["department"] = payload["department"].strip() or None
    return repo.update(course, **payload)


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
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    deps = repo.get_delete_dependency_counts(course_id)
    has_dependencies = any(count > 0 for count in deps.values())
    if has_dependencies:
        english = _is_english_request(request)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "course_delete_blocked",
                "message": _build_delete_blocked_message(deps, english=english),
                "dependencies": deps,
            },
        )
    repo.delete(course)
    return {"success": True, "message": "Ders silindi"}


@router.get("/{course_id}/delete-impact")
def get_course_delete_impact(
    course_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    deps = repo.get_delete_dependency_counts(course_id)
    can_delete = not any(count > 0 for count in deps.values())
    english = _is_english_request(request)
    return {
        "can_delete": can_delete,
        "dependencies": deps,
        "message": (
            "Course can be deleted safely."
            if can_delete and english
            else "Ders güvenle silinebilir."
            if can_delete
            else _build_delete_blocked_message(deps, english=english)
        ),
    }


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
    course_repo = CourseRepository(db)
    if not course_repo.get_by_id(course_id):
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    if current_user.role == "instructor" and not course_repo.is_instructor_of_course(current_user.id, course_id):
        raise HTTPException(status_code=403, detail="Bu dersten öğrenci çıkarma yetkiniz yok")
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
    course_repo = CourseRepository(db)
    course = course_repo.get_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    if current_user.role == "instructor":
        allowed_ids = course_repo.get_instructor_course_ids_with_parallel(current_user.id)
        if course_id not in allowed_ids:
            raise HTTPException(status_code=403, detail="Bu dersin öğrenci listesine erişim yetkiniz yok")

    target_course_ids = {course_id}
    if course.shared_class_id is not None:
        target_course_ids.update(
            c.id for c in course_repo.get_parallel_courses(course.shared_class_id)
        )

    enroll_repo = EnrollmentRepository(db)
    enrollments = [
        e for cid in target_course_ids for e in enroll_repo.get_by_course(cid)
    ]
    from app.repositories.user_repo import UserRepository
    user_repo = UserRepository(db)
    student_ids = sorted({e.student_id for e in enrollments})
    students = [user_repo.get_by_id(student_id) for student_id in student_ids]
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
