"""
Shared fixtures for all tests.

- Uses an in-memory SQLite database (isolated per test session).
- Overrides the FastAPI `get_db` dependency so no production DB is touched.
- Seeds one admin, one instructor, and one student user.
- Provides authenticated HTTP clients for each role.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.connection import Base, get_db
from app.security.password import hash_password
from app.security.rate_limit import reset_for_testing
from app.security.jwt import create_access_token
from app.models.user import User
from app.models.course import Course, Enrollment
from app.models.course_instructor import CourseInstructor  # noqa: F401 — ensures table is created
from app.models.room import Room
from app.models.session import AttendanceSession
from app.models.attendance import AttendanceAttempt, FinalAttendanceRecord, ClassCancellation
from app.models.face_reference import FaceReference
from app.models.excuse import Excuse
from app.models.audit_log import AuditLog
from app.models.notification import Notification  # noqa: F401 — ensures table is created
from app.models.system_setting import SystemSetting  # noqa: F401 — ensures table is created
from app.models.dispute import AttendanceDispute  # noqa: F401 — ensures table is created
from main import app

# ── In-memory test database ───────────────────────────────────────────────────

TEST_DB_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear the in-memory rate limiter store before every test."""
    reset_for_testing()
    yield


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Per-test DB session, rolls back after each test for isolation."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """TestClient with DB dependency overridden."""
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── User seed fixtures ────────────────────────────────────────────────────────

@pytest.fixture()
def admin_user(db) -> User:
    user = User(
        username="test_admin",
        email="admin@test.com",
        hashed_password=hash_password("Admin1234!"),
        name="Test Admin",
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def instructor_user(db) -> User:
    user = User(
        username="test_instructor",
        email="instructor@test.com",
        hashed_password=hash_password("Instructor1!"),
        name="Test Instructor",
        role="instructor",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def student_user(db) -> User:
    user = User(
        username="test_student",
        email="student@test.com",
        hashed_password=hash_password("Student1234!"),
        name="Test Student",
        role="student",
        is_active=True,
        student_number="2024001",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Authenticated header helpers ─────────────────────────────────────────────

def _auth_headers(user_id: int) -> dict:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(admin_user):
    return _auth_headers(admin_user.id)


@pytest.fixture()
def instructor_headers(instructor_user):
    return _auth_headers(instructor_user.id)


@pytest.fixture()
def student_headers(student_user):
    return _auth_headers(student_user.id)


# ── Course / Session fixtures ─────────────────────────────────────────────────

@pytest.fixture()
def course(db, instructor_user) -> Course:
    c = Course(
        code="CS101",
        name="Introduction to Computer Science",
        instructor_id=instructor_user.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def enrollment(db, course, student_user) -> Enrollment:
    e = Enrollment(course_id=course.id, student_id=student_user.id)
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@pytest.fixture()
def active_session(db, course) -> AttendanceSession:
    from app.utils.qr import generate_qr_token
    from datetime import datetime, timezone
    s = AttendanceSession(
        course_id=course.id,
        date="2024-01-15",
        start_time="09:00",
        end_time="11:00",
        status="active",
        qr_token=generate_qr_token(),
        qr_token_issued_at=datetime.now(timezone.utc),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s
