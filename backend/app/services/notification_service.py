"""Notification service: email helpers + APScheduler jobs.

Feature 6: When a scheduled class is about to start (5 min before),
           send push notification to the instructor.

Feature 7: When a session ends, email absent students.
"""
import smtplib
import logging
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

logger = logging.getLogger(__name__)

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
            from datetime import datetime, timedelta
            from app.models.course import Course
            from app.models.user import User
            from app.utils.push import send_expo_push

            db = db_factory()
            now = datetime.now()
            day_name = now.strftime("%A")  # e.g. "Monday"
            current_minutes = now.hour * 60 + now.minute

            courses = db.query(Course).filter(Course.schedule.isnot(None)).all()
            for course in courses:
                schedule = course.schedule
                if not schedule or day_name not in (schedule.get("days") or []):
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
                    instructor = db.query(User).filter(User.id == course.instructor_id).first()
                    if instructor and instructor.push_token:
                        send_expo_push(
                            tokens=[instructor.push_token],
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
