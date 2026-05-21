"""Leadership analytics API — RBAC and dean scope isolation tests."""

import pytest

from app.security.password import hash_password
from app.security.jwt import create_access_token
from app.models.user import User
from app.models.course import Course, Enrollment
from app.models.session import AttendanceSession
from app.models.attendance import FinalAttendanceRecord


def _auth(user_id: int) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


@pytest.fixture()
def dept_a_student(db) -> User:
    user = User(
        username="lead_stu_a",
        email="lead_stu_a@test.com",
        hashed_password=hash_password("Student1234!"),
        name="Lead Student A",
        role="student",
        department="Bilgisayar Mühendisliği",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def dept_b_student(db) -> User:
    user = User(
        username="lead_stu_b",
        email="lead_stu_b@test.com",
        hashed_password=hash_password("Student1234!"),
        name="Lead Student B",
        role="student",
        department="Elektrik Mühendisliği",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def dean_user(db) -> User:
    user = User(
        username="test_dean",
        email="dean@test.com",
        hashed_password=hash_password("Dean12345!"),
        name="Test Dean",
        role="dean",
        scope_type="department",
        scope_value="Bilgisayar Mühendisliği",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def rector_user(db) -> User:
    user = User(
        username="test_rector",
        email="rector@test.com",
        hashed_password=hash_password("Rector123!"),
        name="Test Rector",
        role="rector",
        scope_type="university",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def leadership_course(db, instructor_user) -> Course:
    course = Course(
        code="LEAD101",
        name="Leadership Test Course",
        instructor_id=instructor_user.id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@pytest.fixture()
def seed_attendance(db, leadership_course, dept_a_student, dept_b_student):
    from datetime import datetime, timezone

    for student in (dept_a_student, dept_b_student):
        db.add(Enrollment(course_id=leadership_course.id, student_id=student.id))

    session = AttendanceSession(
        course_id=leadership_course.id,
        date="2024-02-01",
        start_time="09:00",
        end_time="11:00",
        status="closed",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    db.add(
        FinalAttendanceRecord(
            student_id=dept_a_student.id,
            session_id=session.id,
            course_id=leadership_course.id,
            status="present",
            marked_at=datetime.now(timezone.utc),
        )
    )
    db.add(
        FinalAttendanceRecord(
            student_id=dept_b_student.id,
            session_id=session.id,
            course_id=leadership_course.id,
            status="absent",
            marked_at=datetime.now(timezone.utc),
        )
    )
    db.commit()


class TestLeadershipAccess:
    def test_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/leadership/overview", headers=student_headers)
        assert resp.status_code == 403

    def test_admin_forbidden(self, client, admin_headers):
        resp = client.get("/api/v1/leadership/overview", headers=admin_headers)
        assert resp.status_code == 403

    def test_dean_ok(self, client, dean_user, seed_attendance):
        resp = client.get("/api/v1/leadership/overview", headers=_auth(dean_user.id))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_students"] == 1
        assert data["role"] == "dean"

    def test_rector_sees_all_students(self, client, rector_user, seed_attendance):
        resp = client.get("/api/v1/leadership/overview", headers=_auth(rector_user.id))
        assert resp.status_code == 200
        assert resp.json()["total_students"] == 2

    def test_dean_without_scope_forbidden(self, client, db):
        dean = User(
            username="dean_no_scope",
            email="dean_no_scope@test.com",
            hashed_password=hash_password("Dean12345!"),
            name="Dean No Scope",
            role="dean",
            is_active=True,
        )
        db.add(dean)
        db.commit()
        db.refresh(dean)
        resp = client.get("/api/v1/leadership/overview", headers=_auth(dean.id))
        assert resp.status_code == 403


class TestLeadershipDepartments:
    def test_rector_department_view(self, client, rector_user, seed_attendance):
        resp = client.get("/api/v1/leadership/departments", headers=_auth(rector_user.id))
        assert resp.status_code == 200
        data = resp.json()
        assert data["view"] == "departments"
        departments = {item["department"] for item in data["items"]}
        assert "Bilgisayar Mühendisliği" in departments
        assert "Elektrik Mühendisliği" in departments

    def test_dean_course_view(self, client, dean_user, seed_attendance):
        resp = client.get("/api/v1/leadership/departments", headers=_auth(dean_user.id))
        assert resp.status_code == 200
        data = resp.json()
        assert data["view"] == "courses"
        assert len(data["items"]) >= 1


class TestLeadershipAtRisk:
    def test_at_risk_pagination(self, client, rector_user, seed_attendance):
        resp = client.get(
            "/api/v1/leadership/at-risk",
            headers=_auth(rector_user.id),
            params={"page": 1, "page_size": 10},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert "min_attendance_rate" in data

    def test_page_size_capped(self, client, rector_user):
        resp = client.get(
            "/api/v1/leadership/at-risk",
            headers=_auth(rector_user.id),
            params={"page_size": 500},
        )
        assert resp.status_code == 422
