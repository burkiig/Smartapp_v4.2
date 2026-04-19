from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.course import Course, Enrollment


class CourseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, course_id: int) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    def get_by_code(self, code: str) -> Optional[Course]:
        return self.db.query(Course).filter(Course.code == code).first()

    def get_all(self, instructor_id: Optional[int] = None) -> List[Course]:
        q = self.db.query(Course)
        if instructor_id:
            q = q.filter(Course.instructor_id == instructor_id)
        return q.all()

    def get_by_instructor(self, instructor_id: int) -> List[Course]:
        return self.db.query(Course).filter(Course.instructor_id == instructor_id).all()

    def create(self, code: str, name: str, instructor_id: Optional[int] = None,
               schedule=None, default_duration_minutes=None) -> Course:
        course = Course(
            code=code, name=name, instructor_id=instructor_id,
            schedule=schedule, default_duration_minutes=default_duration_minutes,
        )
        self.db.add(course)
        self.db.commit()
        self.db.refresh(course)
        return course

    def update(self, course: Course, **kwargs) -> Course:
        for key, value in kwargs.items():
            if hasattr(course, key):
                setattr(course, key, value)
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

    def create(self, student_id: int, course_id: int) -> Enrollment:
        enrollment = Enrollment(student_id=student_id, course_id=course_id)
        self.db.add(enrollment)
        self.db.commit()
        self.db.refresh(enrollment)
        return enrollment

    def delete(self, enrollment: Enrollment) -> None:
        self.db.delete(enrollment)
        self.db.commit()
