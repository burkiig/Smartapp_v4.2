from sqlalchemy.orm import Session
from sqlalchemy import exists, or_
from typing import Optional, List
from app.models.course import Course, Enrollment
from app.models.course_instructor import CourseInstructor
from app.models.session import AttendanceSession
from app.models.attendance import FinalAttendanceRecord, ClassCancellation
from app.models.dispute import AttendanceDispute
from app.models.excuse import Excuse
from app.models.user import User


class CourseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, course_id: int) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    def get_by_code(self, code: str) -> Optional[Course]:
        return self.db.query(Course).filter(Course.code == code).first()

    def get_all(self, instructor_id: Optional[int] = None, department: Optional[str] = None) -> List[Course]:
        if instructor_id:
            courses = self.get_by_instructor(instructor_id)
            if department:
                dep = department.strip()
                courses = [c for c in courses if (c.department or "").strip() == dep]
            return courses
        q = self.db.query(Course)
        if department:
            q = q.filter(Course.department == department.strip())
        return q.all()

    def get_by_instructor(self, instructor_id: int) -> List[Course]:
        """Join table + legacy courses.instructor_id fallback."""
        return (
            self.db.query(Course)
            .filter(
                or_(
                    Course.instructor_id == instructor_id,
                    exists().where(
                        CourseInstructor.course_id == Course.id,
                        CourseInstructor.instructor_id == instructor_id,
                    ),
                )
            )
            .all()
        )

    def get_instructor_course_ids_with_parallel(self, instructor_id: int) -> set[int]:
        """
        Instructor'ın doğrudan verdiği dersler + aynı paralel gruptaki ders ID'leri.
        """
        direct_courses = self.get_by_instructor(instructor_id)
        direct_ids = {c.id for c in direct_courses}
        shared_ids = {
            c.shared_class_id for c in direct_courses if c.shared_class_id is not None
        }
        if not shared_ids:
            return direct_ids
        parallel_ids = {
            row.id
            for row in self.db.query(Course.id)
            .filter(Course.shared_class_id.in_(shared_ids))
            .all()
        }
        return direct_ids | parallel_ids

    def is_instructor_of_course(self, instructor_id: int, course_id: int) -> bool:
        """Öğretmenin bu derse atanıp atanmadığını tek EXISTS sorgusuyla kontrol eder."""
        course = self.get_by_id(course_id)
        if not course:
            return False
        if course.instructor_id == instructor_id:
            return True
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

    def is_same_or_parallel_course(self, course_a_id: int, course_b_id: int) -> bool:
        """İki dersin aynı ders veya aynı paralel grupta olup olmadığını döndür."""
        if course_a_id == course_b_id:
            return True
        course_a = self.get_by_id(course_a_id)
        course_b = self.get_by_id(course_b_id)
        if not course_a or not course_b:
            return False
        if course_a.shared_class_id is None or course_b.shared_class_id is None:
            return False
        return course_a.shared_class_id == course_b.shared_class_id

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

    def create(self, code: str, name: str, department: Optional[str] = None, instructor_id: Optional[int] = None,
               schedule=None, default_duration_minutes=None,
               shared_class_id: Optional[int] = None) -> Course:
        course = Course(
            code=code, name=name, department=department, instructor_id=instructor_id,
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

    def get_delete_dependency_counts(self, course_id: int) -> dict[str, int]:
        """Return dependent row counts that block hard delete (RESTRICT FKs)."""
        return {
            "attendance_sessions": self.db.query(AttendanceSession).filter(
                AttendanceSession.course_id == course_id
            ).count(),
            "final_attendance_records": self.db.query(FinalAttendanceRecord).filter(
                FinalAttendanceRecord.course_id == course_id
            ).count(),
            "class_cancellations": self.db.query(ClassCancellation).filter(
                ClassCancellation.course_id == course_id
            ).count(),
            "disputes": self.db.query(AttendanceDispute).filter(
                AttendanceDispute.course_id == course_id
            ).count(),
            "excuses": self.db.query(Excuse).filter(
                Excuse.course_id == course_id
            ).count(),
        }

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
        try:
            return self.resolve_attendance_course_id(student_id, course_id) is not None
        except ValueError:
            # Ambiguous parallel enrollment is considered attendable from authorization
            # perspective; downstream flows should resolve explicitly.
            return True

    def resolve_attendance_course_id(
        self,
        student_id: int,
        session_course_id: int,
        *,
        strict_ambiguous: bool = True,
    ) -> Optional[int]:
        """
        Resolve which course_id attendance should be credited to for a session.

        Rules:
          1) If student is directly enrolled in session_course_id, use it.
          2) Else if session course has shared_class_id, pick student's enrolled course
             within the same parallel group.
          3) If no enrollment matches, return None.
          4) If multiple parallel enrollments match and strict_ambiguous=True, raise.
        """
        direct = self.get(student_id, session_course_id)
        if direct:
            return session_course_id

        course_repo = CourseRepository(self.db)
        session_course = course_repo.get_by_id(session_course_id)
        if not session_course or session_course.shared_class_id is None:
            return None

        candidates = (
            self.db.query(Enrollment.course_id)
            .join(Course, Course.id == Enrollment.course_id)
            .filter(
                Enrollment.student_id == student_id,
                Course.shared_class_id == session_course.shared_class_id,
            )
            .all()
        )
        candidate_ids = sorted({row.course_id for row in candidates})
        if not candidate_ids:
            return None
        if len(candidate_ids) == 1:
            return candidate_ids[0]
        if strict_ambiguous:
            raise ValueError(
                f"Ambiguous parallel enrollment for student_id={student_id}, "
                f"session_course_id={session_course_id}: {candidate_ids}"
            )
        return candidate_ids[0]

    def get_attendable_course_ids(self, student_id: int) -> set:
        """Öğrencinin katılabileceği tüm ders ID'lerini tek sorgu setiyle döndürür.

        Doğrudan kayıtlı olunan dersler + paralel şube dersleri dahil.
        N+1 yerine sabit 2-3 sorguyla oturum listelerini filtrelemek için kullanılır.
        """
        from app.models.course import Course

        enrollments = (
            self.db.query(Enrollment.course_id)
            .filter(Enrollment.student_id == student_id)
            .all()
        )
        direct_ids = {e.course_id for e in enrollments}
        if not direct_ids:
            return set()

        courses_with_shared = (
            self.db.query(Course.shared_class_id)
            .filter(
                Course.id.in_(direct_ids),
                Course.shared_class_id.isnot(None),
            )
            .all()
        )
        shared_class_ids = {c.shared_class_id for c in courses_with_shared}
        if not shared_class_ids:
            return direct_ids

        parallel_ids = {
            row.id
            for row in self.db.query(Course.id)
            .filter(Course.shared_class_id.in_(shared_class_ids))
            .all()
        }
        return direct_ids | parallel_ids

    def create(self, student_id: int, course_id: int) -> Enrollment:
        enrollment = Enrollment(student_id=student_id, course_id=course_id)
        self.db.add(enrollment)
        self.db.commit()
        self.db.refresh(enrollment)
        return enrollment

    def delete(self, enrollment: Enrollment) -> None:
        self.db.delete(enrollment)
        self.db.commit()
