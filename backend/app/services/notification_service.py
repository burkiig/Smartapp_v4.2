"""Notification service: in-app, push, and email notification helpers.

Layers
------
1. DB persistence  — create_notification() / broadcast_to_role()
   Writes a row to the `notifications` table.  This is the source-of-truth
   for unread counts and the notification feed visible in the web panel.

2. Push (Expo)     — send_expo_push() in utils/push.py
   Fire-and-forget best-effort delivery to mobile devices.

3. Email           — send_email() + notify_absent_students()
   SMTP delivery for high-importance async events.

4. Scheduler jobs  — schedule_session_reminder_jobs()
   APScheduler cron job for 5-min pre-class push reminders.
"""
from __future__ import annotations

import smtplib
import logging
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── DB-backed notification helpers ───────────────────────────────────────────

def create_notification(
    db: "Session",
    user_id: int,
    type: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
):
    """
    Persist a single notification row and silently swallow any DB errors
    so that notification failures never break the calling business flow.

    Returns the created Notification ORM object (with .id populated),
    or None if the insert failed.
    """
    try:
        from app.repositories.notification_repo import NotificationRepository
        return NotificationRepository(db).create(
            user_id=user_id, type=type, title=title, body=body, data=data
        )
    except Exception as exc:
        logger.error("[Notification] create_notification failed: %s", exc)
        return None


def broadcast_to_role(
    db: "Session",
    target_role: str,
    type: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """
    Fan-out: create one notification row per active user whose role matches
    `target_role`.  Pass target_role="all" to reach every active user.

    Returns the number of rows created (0 on failure).
    """
    try:
        from app.models.user import User
        from app.repositories.notification_repo import NotificationRepository

        q = db.query(User).filter(User.is_active == True)  # noqa: E712
        if target_role != "all":
            q = q.filter(User.role == target_role)
        users = q.all()

        records = [
            {"user_id": u.id, "type": type, "title": title, "body": body, "data": data}
            for u in users
        ]
        return NotificationRepository(db).bulk_create(records)
    except Exception as exc:
        logger.error("[Notification] broadcast_to_role failed: %s", exc)
        return 0


# ── Email config from environment ─────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)


def send_email(to_addresses: List[str], subject: str, body_html: str) -> bool:
    """Send an HTML email to one or more recipients. Returns True on success."""
    if not SMTP_HOST or not SMTP_USER:
        logger.warning("SMTP not configured — skipping email to %s", to_addresses)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = ", ".join(to_addresses)
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to_addresses, msg.as_string())
        logger.info("Email sent to %s — %s", to_addresses, subject)
        return True
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False


def notify_absent_students(session_id: int, db_factory) -> None:
    """Feature 7: Send email to all absent students after session ends."""
    db = None
    try:
        db = db_factory()
        from app.models.attendance import FinalAttendanceRecord
        from app.models.user import User
        from app.models.session import AttendanceSession
        from app.models.course import Course

        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            return

        course = db.query(Course).filter(Course.id == session.course_id).first()
        course_name = course.code if course else f"Ders #{session.course_id}"

        # Get enrolled students
        from app.models.course import Enrollment
        enrollments = db.query(Enrollment).filter(Enrollment.course_id == session.course_id).all()
        enrolled_ids = {e.student_id for e in enrollments}

        # Find present students
        present_ids = {
            r.student_id
            for r in db.query(FinalAttendanceRecord).filter(
                FinalAttendanceRecord.session_id == session_id,
                FinalAttendanceRecord.status == "present",
            ).all()
        }

        absent_ids = enrolled_ids - present_ids
        if not absent_ids:
            return

        absent_students = db.query(User).filter(User.id.in_(absent_ids)).all()
        absent_emails = [s.email for s in absent_students if s.email]

        if absent_emails:
            subject = f"Devamsızlık Bildirimi — {course_name}"
            body = f"""
            <p>Sayın öğrenci,</p>
            <p><strong>{course_name}</strong> dersi için <strong>{session.date}</strong> tarihli
            yoklamada devamsız görünmekteysiniz.</p>
            <p>Mazeret durumunuz varsa öğretmeninize başvurunuz.</p>
            """
            send_email(absent_emails, subject, body)
    except Exception as exc:
        logger.error("notify_absent_students error: %s", exc)
    finally:
        try:
            db.close()
        except Exception:
            pass


def schedule_session_reminder_jobs(scheduler, db_factory) -> None:
    """Feature 6: Add a recurring job that checks today's course schedule
    and pushes a reminder to instructors 5 minutes before class."""
    from apscheduler.triggers.cron import CronTrigger

    def check_upcoming_classes():
        try:
            from datetime import datetime, timezone, timedelta
            from app.models.course import Course
            from app.models.user import User
            from app.utils.push import send_expo_push

            db = db_factory()
            now = datetime.now(timezone.utc)
            # Support both English ("Monday") and Turkish ("Pazartesi") day names in schedule
            day_en = now.strftime("%A")
            _TR_DAYS = {
                "Monday": "Pazartesi", "Tuesday": "Salı", "Wednesday": "Çarşamba",
                "Thursday": "Perşembe", "Friday": "Cuma", "Saturday": "Cumartesi", "Sunday": "Pazar",
            }
            day_tr = _TR_DAYS.get(day_en, day_en)
            current_minutes = now.hour * 60 + now.minute

            courses = db.query(Course).filter(Course.schedule.isnot(None)).all()
            for course in courses:
                schedule = course.schedule
                days = schedule.get("days") or []
                if not schedule or (day_en not in days and day_tr not in days):
                    continue
                start_time = schedule.get("start_time")
                if not start_time:
                    continue
                try:
                    sh, sm = map(int, start_time.split(":"))
                    class_minutes = sh * 60 + sm
                except ValueError:
                    continue

                # Notify 5 minutes before
                if class_minutes - current_minutes == 5:
                    from app.repositories.course_repo import CourseRepository
                    instructors = CourseRepository(db).get_instructors_for_course(course.id)
                    push_tokens = [i.push_token for i in instructors if i.push_token]
                    if push_tokens:
                        send_expo_push(
                            tokens=push_tokens,
                            title="Ders Başlamak Üzere",
                            body=f"{course.code} dersi 5 dakika sonra başlıyor. Oturumu başlatın!",
                            data={"type": "session_reminder", "course_id": course.id},
                        )
            db.close()
        except Exception as exc:
            logger.error("check_upcoming_classes error: %s", exc)

    scheduler.add_job(
        check_upcoming_classes,
        trigger=CronTrigger(minute="*"),  # runs every minute
        id="session_reminder",
        replace_existing=True,
    )
    logger.info("Session reminder job scheduled (every minute)")
