from sqlalchemy.orm import Session
from sqlalchemy import exists
from typing import Optional, List
from app.models.course import Course, Enrollment
from app.models.course_instructor import CourseInstructor
from app.models.user import User


class CourseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, course_id: int) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    def get_by_code(self, code: str) -> Optional[Course]:
        return self.db.query(Course).filter(Course.code == code).first()

    def get_all(self, instructor_id: Optional[int] = None) -> List[Course]:
        if instructor_id:
            return self.get_by_instructor(instructor_id)
        return self.db.query(Course).all()

    def get_by_instructor(self, instructor_id: int) -> List[Course]:
        """course_instructors join tablosunu kullanır — authoritative kaynak."""
        return (
            self.db.query(Course)
            .join(CourseInstructor, CourseInstructor.course_id == Course.id)
            .filter(CourseInstructor.instructor_id == instructor_id)
            .all()
        )

    def is_instructor_of_course(self, instructor_id: int, course_id: int) -> bool:
        """Öğretmenin bu derse atanıp atanmadığını tek EXISTS sorgusuyla kontrol eder."""
        return self.db.query(
            exists().where(
                CourseInstructor.instructor_id == instructor_id,
                CourseInstructor.course_id == course_id,
            )
        ).scalar()

    def get_instructors_for_course(self, course_id: int) -> List[User]:
        """Derse atanmış tüm öğretmenleri döndür."""
        return (
            self.db.query(User)
            .join(CourseInstructor, CourseInstructor.instructor_id == User.id)
            .filter(CourseInstructor.course_id == course_id)
            .all()
        )

    def add_instructor(self, course_id: int, instructor_id: int) -> CourseInstructor:
        """Derse yeni öğretmen ekle (zaten varsa mevcut kaydı döndür)."""
        existing = self.db.query(CourseInstructor).filter(
            CourseInstructor.course_id == course_id,
            CourseInstructor.instructor_id == instructor_id,
        ).first()
        if existing:
            return existing
        ci = CourseInstructor(course_id=course_id, instructor_id=instructor_id)
        self.db.add(ci)
        self.db.commit()
        self.db.refresh(ci)
        return ci

    def remove_instructor(self, course_id: int, instructor_id: int) -> bool:
        """Öğretmeni dersten kaldır. Kaldırıldıysa True, bulunamadıysa False."""
        ci = self.db.query(CourseInstructor).filter(
            CourseInstructor.course_id == course_id,
            CourseInstructor.instructor_id == instructor_id,
        ).first()
        if not ci:
            return False
        self.db.delete(ci)
        self.db.commit()
        return True

    def get_parallel_courses(self, shared_class_id: int) -> List[Course]:
        """Aynı shared_class_id'ye sahip tüm paralel dersleri döndür."""
        return self.db.query(Course).filter(
            Course.shared_class_id == shared_class_id
        ).all()

    def get_parallel_enrolled_student_ids(self, shared_class_id: int) -> set:
        """Paralel gruptaki tüm derslere kayıtlı öğrenci ID'lerini birleştir."""
        parallel_courses = self.get_parallel_courses(shared_class_id)
        course_ids = [c.id for c in parallel_courses]
        if not course_ids:
            return set()
        enrollments = self.db.query(Enrollment).filter(
            Enrollment.course_id.in_(course_ids)
        ).all()
        return {e.student_id for e in enrollments}

    def create(self, code: str, name: str, instructor_id: Optional[int] = None,
               schedule=None, default_duration_minutes=None,
               shared_class_id: Optional[int] = None) -> Course:
        course = Course(
            code=code, name=name, instructor_id=instructor_id,
            schedule=schedule, default_duration_minutes=default_duration_minutes,
            shared_class_id=shared_class_id,
        )
        self.db.add(course)
        self.db.flush()  # course.id oluşsun
        # Primary instructor'ı join table'a da ekle
        if instructor_id is not None:
            ci = CourseInstructor(course_id=course.id, instructor_id=instructor_id)
            self.db.add(ci)
        self.db.commit()
        self.db.refresh(course)
        return course

    def update(self, course: Course, **kwargs) -> Course:
        new_instructor_id = kwargs.get("instructor_id")
        for key, value in kwargs.items():
            if hasattr(course, key):
                setattr(course, key, value)
        # instructor_id değiştiyse join table'da primary instructor'ı güncelle
        if new_instructor_id is not None and new_instructor_id != course.instructor_id:
            self.add_instructor(course.id, new_instructor_id)
        self.db.commit()
        self.db.refresh(course)
        return course

    def delete(self, course: Course) -> None:
        self.db.delete(course)
        self.db.commit()

    def get_enrolled_count(self, course_id: int) -> int:
        return self.db.query(Enrollment).filter(Enrollment.course_id == course_id).count()


class EnrollmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, student_id: int, course_id: int) -> Optional[Enrollment]:
        return self.db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id
        ).first()

    def get_by_student(self, student_id: int) -> List[Enrollment]:
        return self.db.query(Enrollment).filter(Enrollment.student_id == student_id).all()

    def get_by_course(self, course_id: int) -> List[Enrollment]:
        return self.db.query(Enrollment).filter(Enrollment.course_id == course_id).all()

    def student_can_attend_course(self, student_id: int, course_id: int) -> bool:
        """Öğrenci bu oturum dersinde veya paralel ortak şubede kayıtlıysa True (QR / yoklama ile uyumlu)."""
        if self.get(student_id, course_id):
            return True
        course_repo = CourseRepository(self.db)
        course = course_repo.get_by_id(course_id)
        if course and course.shared_class_id is not None:
            parallel_ids = {
                c.id for c in course_repo.get_parallel_courses(course.shared_class_id)
            }
            return any(self.get(student_id, cid) for cid in parallel_ids)
        return False

    def create(self, student_id: int, course_id: int) -> Enrollment:
        enrollment = Enrollment(student_id=student_id, course_id=course_id)
        self.db.add(enrollment)
        self.db.commit()
        self.db.refresh(enrollment)
        return enrollment

    def delete(self, enrollment: Enrollment) -> None:
        self.db.delete(enrollment)
        self.db.commit()
