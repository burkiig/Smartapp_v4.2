"""Privilege escalation tests for user role/scope management."""

import pytest

from app.security.password import hash_password
from app.security.jwt import create_access_token
from app.models.user import User


def _auth(user_id: int) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


class TestUserPrivilegeEscalation:
    def test_student_cannot_elevate_own_role(self, client, student_user):
        resp = client.patch(
            f"/api/v1/users/{student_user.id}",
            headers=_auth(student_user.id),
            json={"role": "rector", "scope_type": "university"},
        )
        assert resp.status_code == 403

    def test_instructor_cannot_set_dean_scope(self, client, db, instructor_user):
        resp = client.patch(
            f"/api/v1/users/{instructor_user.id}",
            headers=_auth(instructor_user.id),
            json={"scope_type": "department", "scope_value": "Bilgisayar Mühendisliği"},
        )
        assert resp.status_code == 403

    def test_admin_can_create_rector(self, client, admin_user):
        resp = client.post(
            "/api/v1/users/",
            headers=_auth(admin_user.id),
            json={
                "username": "new_rector",
                "email": "new_rector@test.com",
                "password": "SecurePass1",
                "name": "New Rector",
                "role": "rector",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "rector"
        assert data["scope_type"] == "university"
        assert data["scope_value"] is None

    def test_admin_create_dean_requires_department(self, client, admin_user):
        resp = client.post(
            "/api/v1/users/",
            headers=_auth(admin_user.id),
            json={
                "username": "new_dean",
                "email": "new_dean@test.com",
                "password": "SecurePass1",
                "name": "New Dean",
                "role": "dean",
            },
        )
        assert resp.status_code == 422

    def test_distinct_departments_admin_only(self, client, student_headers, admin_headers):
        assert client.get("/api/v1/admin/distinct-departments", headers=student_headers).status_code == 403
        assert client.get("/api/v1/admin/distinct-departments", headers=admin_headers).status_code == 200

    def test_distinct_departments_returns_student_departments(self, client, admin_headers, db):
        db.add(
            User(
                username="dept_stu",
                email="dept_stu@test.com",
                hashed_password=hash_password("Student1234!"),
                name="Dept Student",
                role="student",
                department="Makine Mühendisliği",
                is_active=True,
            )
        )
        db.commit()
        resp = client.get("/api/v1/admin/distinct-departments", headers=admin_headers)
        assert resp.status_code == 200
        assert "Makine Mühendisliği" in resp.json()["departments"]
