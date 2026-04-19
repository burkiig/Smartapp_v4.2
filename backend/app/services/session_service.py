from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession
from datetime import datetime, timezone
from typing import Optional

from app.repositories.session_repo import SessionRepository
from app.repositories.course_repo import CourseRepository
from app.repositories.room_repo import RoomRepository
from app.models.session import AttendanceSession
from app.models.user import User
from app.utils.qr import generate_qr_token, build_qr_payload, generate_qr_image_base64


class SessionService:
    def __init__(self, db: DBSession):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.course_repo = CourseRepository(db)
        self.room_repo = RoomRepository(db)

    def start_session(self, course_id: int, created_by: User,
                      latitude: Optional[float] = None,
                      longitude: Optional[float] = None,
                      room_id: Optional[int] = None,
                      date: Optional[str] = None,
                      start_time: Optional[str] = None,
                      end_time: Optional[str] = None) -> AttendanceSession:
        course = self.course_repo.get_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Ders bulunamadı")

        # Use room/faculty GPS if room_id provided and no explicit coordinates given
        if room_id and latitude is None and longitude is None:
            room = self.room_repo.get_by_id(room_id)
            if room and room.latitude is not None:
                latitude = room.latitude
                longitude = room.longitude

        # Check for existing active session
        existing = self.session_repo.get_active(course_id=course_id)
        if existing:
            raise HTTPException(status_code=409, detail="Bu ders için zaten aktif bir oturum var")

        qr_token = generate_qr_token()
        today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_time = start_time or datetime.now(timezone.utc).strftime("%H:%M")

        session = self.session_repo.create(
            course_id=course_id,
            date=today,
            start_time=now_time,
            end_time=end_time,
            qr_token=qr_token,
            latitude=latitude,
            longitude=longitude,
            created_by_id=created_by.id,
        )
        return session

    def end_session(self, session_id: int, user: User) -> AttendanceSession:
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Oturum zaten kapalı")
        return self.session_repo.close(session)

    def get_qr_image(self, session_id: int) -> str:
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Oturum aktif değil")

        payload = build_qr_payload(session.id, session.course_id, session.qr_token)
        return generate_qr_image_base64(payload)
