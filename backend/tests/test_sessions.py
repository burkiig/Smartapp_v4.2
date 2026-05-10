"""
Session lifecycle tests:
  - start / end session
  - QR generation
  - QR rotate (anti-replay)
  - duplicate active session prevention
  - instructor scope enforcement
"""
import pytest


class TestStartSession:
    def test_instructor_can_start_session(self, client, instructor_headers, course):
        resp = client.post("/api/v1/sessions/start", json={
            "course_id": course.id,
        }, headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["session"]["status"] == "active"
        assert data["session"]["qr_image"] is not None

    def test_duplicate_active_session_rejected(self, client, instructor_headers, course, active_session):
        resp = client.post("/api/v1/sessions/start", json={
            "course_id": course.id,
        }, headers=instructor_headers)
        assert resp.status_code == 409

    def test_student_cannot_start_session(self, client, student_headers, course):
        resp = client.post("/api/v1/sessions/start", json={
            "course_id": course.id,
        }, headers=student_headers)
        assert resp.status_code == 403

    def test_nonexistent_course_returns_404(self, client, instructor_headers):
        resp = client.post("/api/v1/sessions/start", json={
            "course_id": 999999,
        }, headers=instructor_headers)
        assert resp.status_code == 404


class TestEndSession:
    def test_instructor_can_end_active_session(self, client, instructor_headers, active_session):
        resp = client.post(f"/api/v1/sessions/{active_session.id}/end", headers=instructor_headers)
        assert resp.status_code == 200

    def test_end_already_closed_session(self, client, instructor_headers, active_session, db):
        # Close it first
        active_session.status = "closed"
        db.commit()

        resp = client.post(f"/api/v1/sessions/{active_session.id}/end", headers=instructor_headers)
        assert resp.status_code == 400

    def test_student_cannot_end_session(self, client, student_headers, active_session):
        resp = client.post(f"/api/v1/sessions/{active_session.id}/end", headers=student_headers)
        assert resp.status_code == 403


class TestGetSessionQR:
    def test_instructor_gets_qr(self, client, instructor_headers, active_session):
        resp = client.get(f"/api/v1/sessions/{active_session.id}/qr", headers=instructor_headers)
        assert resp.status_code == 200
        assert resp.json()["qr_image"].startswith("data:image/png;base64,")

    def test_qr_for_closed_session_fails(self, client, instructor_headers, active_session, db):
        active_session.status = "closed"
        db.commit()
        resp = client.get(f"/api/v1/sessions/{active_session.id}/qr", headers=instructor_headers)
        assert resp.status_code == 400


class TestRotateQR:
    def test_rotate_returns_new_qr(self, client, instructor_headers, active_session):
        # Get original token
        original_qr = active_session.qr_token

        resp = client.post(
            f"/api/v1/sessions/{active_session.id}/rotate-qr",
            headers=instructor_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["qr_image"].startswith("data:image/png;base64,")
        assert "ttl_seconds" in data

    def test_rotate_invalidates_old_token(self, client, instructor_headers, active_session, db):
        old_token = active_session.qr_token

        # Rotate
        client.post(
            f"/api/v1/sessions/{active_session.id}/rotate-qr",
            headers=instructor_headers,
        )
        db.refresh(active_session)
        assert active_session.qr_token != old_token

    def test_rotate_closed_session_fails(self, client, instructor_headers, active_session, db):
        active_session.status = "closed"
        db.commit()
        resp = client.post(
            f"/api/v1/sessions/{active_session.id}/rotate-qr",
            headers=instructor_headers,
        )
        assert resp.status_code == 400

    def test_student_cannot_rotate_qr(self, client, student_headers, active_session):
        resp = client.post(
            f"/api/v1/sessions/{active_session.id}/rotate-qr",
            headers=student_headers,
        )
        assert resp.status_code == 403


class TestListSessions:
    def test_list_active_sessions(self, client, instructor_headers, active_session):
        resp = client.get("/api/v1/sessions/active", headers=instructor_headers)
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert active_session.id in ids

    def test_list_all_sessions(self, client, instructor_headers, active_session):
        resp = client.get("/api/v1/sessions/", headers=instructor_headers)
        assert resp.status_code == 200


class TestSessionPublicStats:
    def test_public_stats_active_session(self, client, instructor_headers, active_session):
        resp = client.get(
            f"/api/v1/sessions/{active_session.id}/public-stats",
            headers=instructor_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == active_session.id
        assert data["checked_in_count"] == 0

    def test_public_stats_closed_session_fails(self, client, instructor_headers, active_session, db):
        active_session.status = "closed"
        db.commit()
        resp = client.get(
            f"/api/v1/sessions/{active_session.id}/public-stats",
            headers=instructor_headers,
        )
        assert resp.status_code == 400

    def test_student_cannot_read_public_stats(self, client, student_headers, active_session):
        resp = client.get(
            f"/api/v1/sessions/{active_session.id}/public-stats",
            headers=student_headers,
        )
        assert resp.status_code == 403
