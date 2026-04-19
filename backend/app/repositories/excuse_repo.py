from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.excuse import Excuse


class ExcuseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, excuse_id: int) -> Optional[Excuse]:
        return self.db.query(Excuse).filter(Excuse.id == excuse_id).first()

    def get_by_student(self, student_id: int, course_id: Optional[int] = None) -> List[Excuse]:
        q = self.db.query(Excuse).filter(Excuse.student_id == student_id)
        if course_id:
            q = q.filter(Excuse.course_id == course_id)
        return q.order_by(Excuse.created_at.desc()).all()

    def get_by_course(self, course_id: int) -> List[Excuse]:
        return self.db.query(Excuse).filter(
            Excuse.course_id == course_id
        ).order_by(Excuse.created_at.desc()).all()

    def get_all(self, student_id: Optional[int] = None, course_id: Optional[int] = None, course_ids: Optional[List[int]] = None) -> List[Excuse]:
        q = self.db.query(Excuse)
        if student_id:
            q = q.filter(Excuse.student_id == student_id)
        if course_id:
            q = q.filter(Excuse.course_id == course_id)
        if course_ids is not None:
            q = q.filter(Excuse.course_id.in_(course_ids))
        return q.order_by(Excuse.created_at.desc()).all()

    def create(self, student_id: int, course_id: int, session_date: str,
               excuse_type: str = "other", description: Optional[str] = None,
               document_url: Optional[str] = None, session_id: Optional[int] = None) -> Excuse:
        excuse = Excuse(
            student_id=student_id,
            course_id=course_id,
            session_id=session_id,
            session_date=session_date,
            excuse_type=excuse_type,
            description=description,
            document_url=document_url,
        )
        self.db.add(excuse)
        self.db.commit()
        self.db.refresh(excuse)
        return excuse

    def update(self, excuse: Excuse, **kwargs) -> Excuse:
        for key, value in kwargs.items():
            if hasattr(excuse, key):
                setattr(excuse, key, value)
        self.db.commit()
        self.db.refresh(excuse)
        return excuse
