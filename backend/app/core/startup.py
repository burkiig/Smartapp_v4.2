import logging
from app.database.connection import create_all_tables, SessionLocal
from app.config.settings import settings
from app.services.scheduler import start_scheduler

logger = logging.getLogger(__name__)


async def on_startup():
    logger.info("Smart Attendance System v3.0.0 starting up...")

    # Create all DB tables
    create_all_tables()
    logger.info("Database tables created/verified.")

    # Seed default admin
    _seed_admin()

    # Start APScheduler
    start_scheduler()

    logger.info("Startup complete.")


def _seed_admin():
    from app.models.user import User
    from app.security.password import hash_password

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                name=settings.ADMIN_NAME,
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info(f"Default admin created: {settings.ADMIN_USERNAME}")
        else:
            logger.info(f"Admin already exists: {settings.ADMIN_USERNAME}")
    except Exception as e:
        logger.error(f"Seed admin error: {e}")
        db.rollback()
    finally:
        db.close()
