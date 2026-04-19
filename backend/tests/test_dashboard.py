"""
Dashboard endpoint tests:
  - /stats role-aware response
  - /course-performance
  - /recent-activity
  - /audit-logs (admin only, pagination)
"""
import pytest


class TestStats:
    def test_admin_stats_shape(self, client, admin_headers):
        resp = client.get("/api/v1/dashboard/stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "admin"
        assert "total_students" in data
        assert "total_instructors" in data
        assert "total_courses" in data
        assert "active_sessions" in data

    def test_instructor_stats_shape(self, client, instructor_headers, course):
        resp = client.get("/api/v1/dashboard/stats", headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "instructor"
        assert "total_courses" in data
        assert "total_enrolled" in data
        assert "active_sessions" in data
        assert "present_today" in data
        assert "flagged_records" in data

    def test_student_stats_shape(self, client, student_headers, enrollment):
        resp = client.get("/api/v1/dashboard/stats", headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "student"
        assert "enrolled_courses" in data
        assert "attendance_rate" in data
        assert "total_sessions_attended" in data

    def test_stats_requires_auth(self, client):
        resp = client.get("/api/v1/dashboard/stats")
        assert resp.status_code in (401, 403)


class TestCoursePerformance:
    def test_instructor_gets_only_own_courses(self, client, instructor_headers, course):
        resp = client.get("/api/v1/dashboard/course-performance", headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        for item in data:
            assert "course_id" in item
            assert "attendance" in item
            assert "students" in item

    def test_admin_gets_all_courses(self, client, admin_headers, course):
        resp = client.get("/api/v1/dashboard/course-performance", headers=admin_headers)
        assert resp.status_code == 200

    def test_student_forbidden(self, client, student_headers):
        resp = client.get("/api/v1/dashboard/course-performance", headers=student_headers)
        assert resp.status_code == 403


class TestRecentActivity:
    def test_admin_sees_all_activity(self, client, admin_headers):
        resp = client.get("/api/v1/dashboard/recent-activity", headers=admin_headers)
        assert resp.status_code == 200
        assert "activities" in resp.json()

    def test_student_sees_own_activity(self, client, student_headers):
        resp = client.get("/api/v1/dashboard/recent-activity", headers=student_headers)
        assert resp.status_code == 200
        assert "activities" in resp.json()

    def test_instructor_sees_own_course_activity(self, client, instructor_headers):
        resp = client.get("/api/v1/dashboard/recent-activity", headers=instructor_headers)
        assert resp.status_code == 200


class TestAuditLogs:
    def test_admin_can_query_audit_logs(self, client, admin_headers):
        resp = client.get("/api/v1/dashboard/audit-logs", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "logs" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data

    def test_audit_logs_pagination(self, client, admin_headers):
        resp = client.get("/api/v1/dashboard/audit-logs?page=1&page_size=5", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()["logs"]) <= 5

    def test_audit_logs_filter_by_action(self, client, admin_headers):
        resp = client.get("/api/v1/dashboard/audit-logs?action=login_success", headers=admin_headers)
        assert resp.status_code == 200
        for entry in resp.json()["logs"]:
            assert entry["action"] == "login_success"

    def test_instructor_cannot_see_audit_logs(self, client, instructor_headers):
        resp = client.get("/api/v1/dashboard/audit-logs", headers=instructor_headers)
        assert resp.status_code == 403

    def test_student_cannot_see_audit_logs(self, client, student_headers):
        resp = client.get("/api/v1/dashboard/audit-logs", headers=student_headers)
        assert resp.status_code == 403
