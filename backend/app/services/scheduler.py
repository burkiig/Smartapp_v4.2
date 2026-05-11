"""
APScheduler — Automatic session open/close based on course schedules.

Timezone notu:
  Tüm "şu an saat kaç?" sorguları ZoneInfo("Europe/Istanbul") ile yapılır.
  Önceki datetime.now() (sistem saati, timezone-naive) kullanımı yaz saati
  geçişlerinde (DST) oturumların açılmamasına veya çift açılmasına yol açıyordu.
  ZoneInfo stdlib modülü (Python 3.9+) — ek paket gerekmez.
"""

import logging
from datetime import datetime, time
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

# Tek tanım — her fonksiyonda tekrar yazılmaz
_ISTANBUL = ZoneInfo("Europe/Istanbul")

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    logger.warning("APScheduler not installed. Auto session management disabled.")

_scheduler = None


def _parse_time(t: str) -> time | None:
    """HH:MM string'ini time nesnesine dönüştür. Hatalı formatta None döner."""
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
        # timezone-aware: DST geçişlerinde doğru saat
        now = datetime.now(_ISTANBUL)
        today_name = now.strftime("%A")  # "Monday", "Tuesday", ...
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

            existing = (
                db.query(AttendanceSession)
                .filter(
                    AttendanceSession.course_id == course.id,
                    AttendanceSession.date == today_date,
                )
                .first()
            )
            if existing:
                continue

            from datetime import timezone as _utc

            from app.utils.qr import generate_qr_token

            session = AttendanceSession(
                course_id=course.id,
                date=today_date,
                start_time=start_str,
                end_time=schedule.get("end_time"),
                qr_token=generate_qr_token(),
                qr_token_issued_at=datetime.now(_utc.utc),  # DB'ye UTC kaydedilir
            )
            db.add(session)
            db.commit()
            logger.info(
                "[Scheduler] Auto-opened session for course %s at %s",
                course.code,
                start_str,
            )
    except Exception as e:
        logger.error("[Scheduler] _open_scheduled_sessions error: %s", e)
        db.rollback()
    finally:
        db.close()


def _close_expired_sessions():
    from app.database.connection import SessionLocal
    from app.models.session import AttendanceSession
    from app.services.session_service import SessionService

    db = SessionLocal()
    try:
        # timezone-aware: DST geçişlerinde doğru saat
        now = datetime.now(_ISTANBUL)
        today_date = now.strftime("%Y-%m-%d")
        current_time = now.time().replace(second=0, microsecond=0)

        active_sessions = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.status == "active",
                AttendanceSession.date == today_date,
            )
            .all()
        )

        for session in active_sessions:
            if not session.end_time:
                # end_time tanımlı değil: 4 saatten uzun açık kalan oturumları kapat
                # Bu durum, öğretmenin oturumu manuel kapatmayı unuttuğu senaryoya karşı korur.
                if session.created_at is not None:
                    from datetime import timezone as _utc
                    created = session.created_at
                    if created.tzinfo is None:
                        created = created.replace(tzinfo=_utc.utc)
                    age_hours = (datetime.now(_ISTANBUL).astimezone(_utc.utc) - created).total_seconds() / 3600
                    if age_hours >= 4:
                        session.status = "closed"
                        db.commit()
                        SessionService(db).auto_mark_absent_students(session.id)
                        logger.warning(
                            "[Scheduler] Force-closed session %s (no end_time, open %.1f hours)",
                            session.id,
                            age_hours,
                        )
                continue
            end_time = _parse_time(session.end_time)
            if end_time is None:
                continue
            if current_time >= end_time:
                session.status = "closed"
                db.commit()
                # Devamsız öğrenciler için "absent" kayıt oluştur
                SessionService(db).auto_mark_absent_students(session.id)
                logger.info(
                    "[Scheduler] Auto-closed session %s (end_time=%s)",
                    session.id,
                    session.end_time,
                )
    except Exception as e:
        logger.error("[Scheduler] _close_expired_sessions error: %s", e)
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    global _scheduler
    if not SCHEDULER_AVAILABLE:
        return None

    # Scheduler'a da ZoneInfo nesnesi geç — string değil
    _scheduler = BackgroundScheduler(timezone=_ISTANBUL)

    _scheduler.add_job(
        _open_scheduled_sessions,
        trigger=CronTrigger(minute="*", second=0),
        id="open_sessions",
        replace_existing=True,
    )
    _scheduler.add_job(
        _close_expired_sessions,
        trigger=CronTrigger(minute="*", second=15),
        id="close_sessions",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[Scheduler] APScheduler started (timezone: Europe/Istanbul)")

    # Ders başlamadan 5 dakika önce push bildirimi
    try:
        from app.database.connection import SessionLocal
        from app.services.notification_service import schedule_session_reminder_jobs

        schedule_session_reminder_jobs(_scheduler, SessionLocal)
    except Exception as e:
        logger.warning("[Scheduler] Could not register session reminder job: %s", e)

    # Okunmuş eski bildirimleri temizle — her gün 03:00'da (Istanbul saatiyle)
    def _cleanup_notifications():
        from app.database.connection import SessionLocal
        from app.repositories.notification_repo import NotificationRepository

        db = SessionLocal()
        try:
            deleted = NotificationRepository.cleanup_old_notifications(db)
            if deleted:
                logger.info(
                    "[Scheduler] Notification cleanup: deleted %d old rows", deleted
                )
        except Exception as exc:
            logger.error("[Scheduler] Notification cleanup failed: %s", exc)
        finally:
            db.close()

    _scheduler.add_job(
        _cleanup_notifications,
        trigger=CronTrigger(hour=3, minute=0),
        id="notification_cleanup",
        replace_existing=True,
    )
    logger.info("[Scheduler] Notification cleanup job scheduled (daily 03:00 Istanbul)")

    return _scheduler


def schedule_notify_absent(session_id: int, db_factory) -> bool:
    """Schedule a one-off job to notify absent students. Returns True if scheduled."""
    if not _scheduler or not _scheduler.running:
        return False
    from datetime import datetime, timedelta, timezone
    from app.services.notification_service import notify_absent_students
    _scheduler.add_job(
        notify_absent_students,
        trigger="date",
        run_date=datetime.now(timezone.utc) + timedelta(seconds=3),
        args=[session_id, db_factory],
        id=f"notify_absent_{session_id}",
        replace_existing=True,
    )
    logger.info("[Scheduler] Absent notification job scheduled for session %s", session_id)
    return True


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()
        logger.info("[Scheduler] APScheduler stopped")
