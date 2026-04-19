"""
APScheduler — Automatic session open/close based on course schedules.
"""
import logging
from datetime import datetime, time

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    logger.warning("APScheduler not installed. Auto session management disabled.")

_scheduler = None


def _parse_time(t: str) -> time | None:
    """Safely parse HH:MM string to time object for proper comparison."""
    try:
        parts = t.strip().split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, AttributeError, IndexError):
        return None


def _open_scheduled_sessions():
    from app.database.connection import SessionLocal
    from app.models.course import Course
    from app.models.session import AttendanceSession

    db = SessionLocal()
    try:
        now = datetime.now()
        today_name = now.strftime("%A")   # "Monday", "Tuesday", etc.
        today_date = now.strftime("%Y-%m-%d")
        current_time = now.time().replace(second=0, microsecond=0)

        courses = db.query(Course).all()
        for course in courses:
            schedule = course.schedule
            if not schedule or not isinstance(schedule, dict):
                continue
            days = schedule.get("days", [])
            start_str = schedule.get("start_time")
            if today_name not in days:
                continue
            start_time = _parse_time(start_str)
            if start_time is None:
                continue
            if current_time != start_time:
                continue

            existing = db.query(AttendanceSession).filter(
                AttendanceSession.course_id == course.id,
                AttendanceSession.date == today_date,
            ).first()
            if existing:
                continue

            from app.utils.qr import generate_qr_token
            from datetime import timezone as _tz
            session = AttendanceSession(
                course_id=course.id,
                date=today_date,
                start_time=start_str,
                end_time=schedule.get("end_time"),
                qr_token=generate_qr_token(),
                qr_token_issued_at=datetime.now(_tz.utc),
            )
            db.add(session)
            db.commit()
            logger.info(f"[Scheduler] Auto-opened session for course {course.code} at {start_str}")
    except Exception as e:
        logger.error(f"[Scheduler] _open_scheduled_sessions error: {e}")
        db.rollback()
    finally:
        db.close()


def _close_expired_sessions():
    from app.database.connection import SessionLocal
    from app.models.session import AttendanceSession

    db = SessionLocal()
    try:
        now = datetime.now()
        today_date = now.strftime("%Y-%m-%d")
        current_time = now.time().replace(second=0, microsecond=0)

        active_sessions = db.query(AttendanceSession).filter(
            AttendanceSession.status == "active",
            AttendanceSession.date == today_date,
        ).all()

        for session in active_sessions:
            if not session.end_time:
                continue
            end_time = _parse_time(session.end_time)
            if end_time is None:
                continue
            if current_time >= end_time:
                session.status = "closed"
                db.commit()
                logger.info(f"[Scheduler] Auto-closed session {session.id} (end_time={session.end_time})")
    except Exception as e:
        logger.error(f"[Scheduler] _close_expired_sessions error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    global _scheduler
    if not SCHEDULER_AVAILABLE:
        return None

    _scheduler = BackgroundScheduler(timezone="Europe/Istanbul")
    # Run every minute at second=0 to check for sessions to open
    _scheduler.add_job(
        _open_scheduled_sessions,
        trigger=CronTrigger(minute="*", second=0),
        id="open_sessions",
        replace_existing=True,
    )
    # Run every minute at second=15 to close expired sessions
    _scheduler.add_job(
        _close_expired_sessions,
        trigger=CronTrigger(minute="*", second=15),
        id="close_sessions",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[Scheduler] APScheduler started (Europe/Istanbul timezone)")

    # Feature 6: session reminder push notifications (5 min before class)
    try:
        from app.services.notification_service import schedule_session_reminder_jobs
        from app.database.connection import SessionLocal
        schedule_session_reminder_jobs(_scheduler, SessionLocal)
    except Exception as e:
        logger.warning(f"[Scheduler] Could not register session reminder job: {e}")

    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()
        logger.info("[Scheduler] APScheduler stopped")
