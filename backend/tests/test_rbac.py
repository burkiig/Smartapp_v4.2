"""
Role-Based Access Control tests.
Verifies that endpoints reject unauthorized roles correctly.
"""
import pytest


class TestAdminOnlyEndpoints:
    """Endpoints that only admin can access."""

    def test_list_users_admin_ok(self, client, admin_headers):
        resp = client.get("/api/v1/users/", headers=admin_headers)
        assert resp.status_code == 200

    def test_list_users_instructor_forbidden(self, client, instructor_headers):
        resp = client.get("/api/v1/users/", headers=instructor_headers)
        assert resp.status_code == 403

    def test_list_users_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/users/", headers=student_headers)
        assert resp.status_code == 403

    def test_audit_logs_admin_ok(self, client, admin_headers):
        resp = client.get("/api/v1/dashboard/audit-logs", headers=admin_headers)
        assert resp.status_code == 200

    def test_audit_logs_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/dashboard/audit-logs", headers=student_headers)
        assert resp.status_code == 403


class TestInstructorEndpoints:
    """Endpoints that instructor (or admin) can access but student cannot."""

    def test_course_performance_instructor_ok(self, client, instructor_headers):
        resp = client.get("/api/v1/dashboard/course-performance", headers=instructor_headers)
        assert resp.status_code == 200

    def test_course_performance_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/dashboard/course-performance", headers=student_headers)
        assert resp.status_code == 403

    def test_attendance_records_instructor_ok(self, client, instructor_headers):
        resp = client.get("/api/v1/attendance/records", headers=instructor_headers)
        assert resp.status_code == 200

    def test_attendance_records_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/attendance/records", headers=student_headers)
        assert resp.status_code == 403

    def test_flagged_records_instructor_ok(self, client, instructor_headers):
        resp = client.get("/api/v1/attendance/flagged", headers=instructor_headers)
        assert resp.status_code == 200

    def test_flagged_records_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/attendance/flagged", headers=student_headers)
        assert resp.status_code == 403


class TestStudentEndpoints:
    """Endpoints only students can call (instructors/admins are blocked)."""

    def test_scan_qr_student_ok_session_required(self, client, student_headers):
        """Scan-QR should fail with 404 (no session) but not 403."""
        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": 9999,
            "qr_token": "fake_token",
        }, headers=student_headers)
        assert resp.status_code in (400, 404)  # not 403

    def test_scan_qr_instructor_forbidden(self, client, instructor_headers):
        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": 1,
            "qr_token": "fake",
        }, headers=instructor_headers)
        assert resp.status_code == 403

    def test_my_history_student_ok(self, client, student_headers):
        resp = client.get("/api/v1/attendance/my-history", headers=student_headers)
        assert resp.status_code == 200

    def test_my_history_instructor_forbidden(self, client, instructor_headers):
        resp = client.get("/api/v1/attendance/my-history", headers=instructor_headers)
        assert resp.status_code == 403


class TestUnauthenticatedBlocked:
    """All protected endpoints must reject unauthenticated requests."""

    @pytest.mark.parametrize("method,path", [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/users/"),
        ("GET", "/api/v1/courses/"),
        ("GET", "/api/v1/dashboard/stats"),
        ("GET", "/api/v1/attendance/records"),
        ("GET", "/api/v1/attendance/my-history"),
    ])
    def test_unauthenticated_rejected(self, client, method, path):
        resp = client.request(method, path)
        assert resp.status_code in (401, 403, 422)
