from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession
from datetime import datetime, timezone
from typing import Optional

from app.repositories.session_repo import SessionRepository
from app.repositories.course_repo import CourseRepository, EnrollmentRepository
from app.repositories.room_repo import RoomRepository
from app.repositories.attendance_repo import FinalAttendanceRepository
from app.models.session import AttendanceSession
from app.models.user import User
from app.utils.qr import generate_qr_token, build_qr_payload, generate_qr_image_base64


class SessionService:
    def __init__(self, db: DBSession):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.course_repo = CourseRepository(db)
        self.enrollment_repo = EnrollmentRepository(db)
        self.final_repo = FinalAttendanceRepository(db)
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

        # Instructor can only start sessions for their own courses
        if created_by.role == "instructor" and not self.course_repo.is_instructor_of_course(created_by.id, course_id):
            raise HTTPException(status_code=403, detail="Bu ders için oturum başlatma yetkiniz yok")

        # Oda seçildiyse GPS koordinatlarını ve geofence yarıçapını odadan al
        geofence_radius = None
        if room_id:
            room = self.room_repo.get_by_id(room_id)
            if room:
                if latitude is None and longitude is None and room.latitude is not None:
                    latitude = room.latitude
                    longitude = room.longitude
                if room.geofence_radius:
                    geofence_radius = room.geofence_radius

        # Check for existing active session
        existing = self.session_repo.get_active(course_id=course_id)
        if existing:
            raise HTTPException(status_code=409, detail="Bu ders için zaten aktif bir oturum var")

        qr_token = generate_qr_token()
        static_qr_token = generate_qr_token()
        today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_time = start_time or datetime.now(timezone.utc).strftime("%H:%M")

        # end_time verilmemişse: önce ders programından, sonra default_duration_minutes'tan türet
        resolved_end_time = end_time
        if resolved_end_time is None and course.schedule:
            resolved_end_time = course.schedule.get("end_time")
        if resolved_end_time is None and course.default_duration_minutes:
            try:
                from datetime import timedelta
                h, m = map(int, now_time.split(":"))
                end_dt = datetime.now(timezone.utc).replace(
                    hour=h, minute=m, second=0, microsecond=0
                ) + timedelta(minutes=course.default_duration_minutes)
                resolved_end_time = end_dt.strftime("%H:%M")
            except Exception:
                pass

        session = self.session_repo.create(
            course_id=course_id,
            date=today,
            start_time=now_time,
            end_time=resolved_end_time,
            qr_token=qr_token,
            static_qr_token=static_qr_token,
            latitude=latitude,
            longitude=longitude,
            geofence_radius=geofence_radius,
            created_by_id=created_by.id,
        )
        return session

    def end_session(self, session_id: int, user: User) -> AttendanceSession:
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Oturum zaten kapalı")

        # Instructor can only end sessions for their own courses
        if user.role == "instructor" and not self.course_repo.is_instructor_of_course(user.id, session.course_id):
            raise HTTPException(status_code=403, detail="Bu oturumu kapatma yetkiniz yok")
        closed = self.session_repo.close(session)
        self.auto_mark_absent_students(closed.id)
        return closed

    def auto_mark_absent_students(self, session_id: int) -> int:
        """
        Ensure enrolled students with no final record are recorded as absent.
        Idempotent: can be called multiple times safely.
        """
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")

        # Paralel ders desteği: shared_class_id varsa tüm paralel gruptaki öğrencileri dahil et
        course = self.course_repo.get_by_id(session.course_id)
        if course and course.shared_class_id is not None:
            enrolled_ids = self.course_repo.get_parallel_enrolled_student_ids(course.shared_class_id)
        else:
            enrollments = self.enrollment_repo.get_by_course(session.course_id)
            enrolled_ids = {e.student_id for e in enrollments}
        if not enrolled_ids:
            return 0

        existing_records = self.final_repo.get_by_session(session_id)
        recorded_ids = {r.student_id for r in existing_records}
        absent_ids = enrolled_ids - recorded_ids
        if not absent_ids:
            return 0

        created = 0
        for student_id in absent_ids:
            try:
                attendance_course_id = self.enrollment_repo.resolve_attendance_course_id(
                    student_id,
                    session.course_id,
                    strict_ambiguous=False,
                )
            except ValueError:
                attendance_course_id = None
            if attendance_course_id is None:
                continue
            self.final_repo.create(
                student_id=student_id,
                session_id=session_id,
                course_id=attendance_course_id,
                status="absent",
                is_flagged=False,
                flag_reason=None,
                verification_steps={
                    "qr_ok": False,
                    "face_ok": False,
                    "location_ok": False,
                    "auto_marked_absent": True,
                },
            )
            created += 1

        return created

    def get_qr_image(self, session_id: int) -> str:
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Oturum aktif değil")

        payload = build_qr_payload(session.id, session.course_id, session.qr_token)
        return generate_qr_image_base64(payload)
