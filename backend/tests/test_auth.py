"""
Tests for authentication endpoints:
  - login success / failure
  - rate limiting
  - /auth/me
  - logout + token revocation
  - refresh token
"""
import pytest
from app.security.jwt import _revoked_jtis


class TestLogin:
    def test_login_success_with_username(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_success_with_email(self, client, student_user):
        resp = client.post("/api/v1/auth/login", json={
            "login": "student@test.com",
            "password": "Student1234!",
        })
        assert resp.status_code == 200

    def test_login_wrong_password(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_unknown_user(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "login": "nobody@nowhere.com",
            "password": "password123",
        })
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, db):
        from app.models.user import User
        from app.security.password import hash_password
        inactive = User(
            username="inactive_u",
            email="inactive@test.com",
            hashed_password=hash_password("Pass1234!"),
            name="Inactive",
            role="student",
            is_active=False,
        )
        db.add(inactive)
        db.commit()
        resp = client.post("/api/v1/auth/login", json={
            "login": "inactive_u",
            "password": "Pass1234!",
        })
        assert resp.status_code == 403


class TestGetMe:
    def test_me_returns_correct_user(self, client, instructor_user, instructor_headers):
        resp = client.get("/api/v1/auth/me", headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "test_instructor"
        assert data["role"] == "instructor"

    def test_me_requires_auth(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    def test_me_rejects_invalid_token(self, client):
        resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401


class TestLogout:
    def test_logout_revokes_token(self, client, student_user, student_headers):
        # Logout
        resp = client.post("/api/v1/auth/logout", headers=student_headers)
        assert resp.status_code == 200

        # Same token must now be rejected
        resp2 = client.get("/api/v1/auth/me", headers=student_headers)
        assert resp2.status_code == 401

    def test_logout_requires_auth(self, client):
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code in (401, 403)


class TestRefreshToken:
    def test_refresh_returns_new_access_token(self, client, admin_user):
        login = client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        refresh_token = login.json()["refresh_token"]

        resp = client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_refresh_rejects_access_token(self, client, admin_headers):
        """An access token must not be accepted as a refresh token."""
        resp = client.post("/api/v1/auth/refresh", headers=admin_headers)
        assert resp.status_code == 401


class TestCookieAuth:
    """Verify httpOnly cookie-based authentication flow."""

    def test_login_sets_access_token_cookie(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.cookies

    def test_login_sets_refresh_token_cookie(self, client, admin_user):
        resp = client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        assert resp.status_code == 200
        assert "refresh_token" in resp.cookies

    def test_cookie_auth_allows_access_without_header(self, client, admin_user):
        """After login, /auth/me should be accessible via cookie alone."""
        login_resp = client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        assert login_resp.status_code == 200
        # TestClient (requests) carries cookies automatically after the login response
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        assert resp.json()["username"] == "test_admin"

    def test_logout_clears_cookies(self, client, admin_user):
        client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code == 200
        # After logout the cookie should be cleared (empty value or absent)
        cookie_val = resp.cookies.get("access_token", "")
        assert cookie_val == ""

    def test_refresh_via_cookie(self, client, admin_user):
        """Refresh token cookie should allow getting a new access token."""
        client.post("/api/v1/auth/login", json={
            "login": "test_admin",
            "password": "Admin1234!",
        })
        resp = client.post("/api/v1/auth/refresh")
        assert resp.status_code == 200
        assert "access_token" in resp.json()
