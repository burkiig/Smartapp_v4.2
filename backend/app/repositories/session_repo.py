from sqlalchemy.orm import Session as DBSession
from typing import Optional, List
from datetime import datetime, timezone
from app.models.session import AttendanceSession


class SessionRepository:
    def __init__(self, db: DBSession):
        self.db = db

    def get_by_id(self, session_id: int) -> Optional[AttendanceSession]:
        return self.db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()

    def get_active(self, course_id: Optional[int] = None) -> List[AttendanceSession]:
        q = self.db.query(AttendanceSession).filter(AttendanceSession.status == "active")
        if course_id:
            q = q.filter(AttendanceSession.course_id == course_id)
        return q.all()

    def get_all(self, course_id: Optional[int] = None, status: Optional[str] = None) -> List[AttendanceSession]:
        q = self.db.query(AttendanceSession)
        if course_id:
            q = q.filter(AttendanceSession.course_id == course_id)
        if status:
            q = q.filter(AttendanceSession.status == status)
        return q.order_by(AttendanceSession.created_at.desc()).all()

    def get_by_qr_token(self, qr_token: str) -> Optional[AttendanceSession]:
        return self.db.query(AttendanceSession).filter(
            AttendanceSession.qr_token == qr_token
        ).first()

    def create(self, course_id: int, date: str, start_time: Optional[str] = None,
               end_time: Optional[str] = None, qr_token: Optional[str] = None,
               latitude: Optional[float] = None, longitude: Optional[float] = None,
               created_by_id: Optional[int] = None) -> AttendanceSession:
        from datetime import timezone as _tz
        session = AttendanceSession(
            course_id=course_id,
            date=date,
            start_time=start_time,
            end_time=end_time,
            qr_token=qr_token,
            qr_token_issued_at=datetime.now(_tz.utc) if qr_token else None,
            latitude=latitude,
            longitude=longitude,
            created_by_id=created_by_id,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update(self, session: AttendanceSession, **kwargs) -> AttendanceSession:
        for key, value in kwargs.items():
            if hasattr(session, key):
                setattr(session, key, value)
        self.db.commit()
        self.db.refresh(session)
        return session

    def close(self, session: AttendanceSession) -> AttendanceSession:
        session.status = "closed"
        session.end_time = datetime.now(timezone.utc).strftime("%H:%M")
        self.db.commit()
        self.db.refresh(session)
        return session
