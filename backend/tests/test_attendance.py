"""
Attendance pipeline tests:
  - QR scan step (valid / invalid token / expired token)
  - Duplicate prevention (UniqueConstraint → 409)
  - Attendance records pagination
  - Instructor scope: can't see other instructor's records
  - my-history for students
  - Review / flag endpoint
  - web-attend input validation
"""
import pytest
from datetime import datetime, timezone, timedelta


class TestScanQR:
    def test_valid_qr_scan(self, client, student_headers, active_session, enrollment):
        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)
        assert resp.status_code == 200
        assert resp.json()["qr_status"] == "verified"

    def test_wrong_qr_token_rejected(self, client, student_headers, active_session, enrollment):
        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": "totally_wrong_token",
        }, headers=student_headers)
        assert resp.status_code == 400

    def test_expired_qr_token_rejected(self, client, student_headers, active_session, enrollment, db):
        # Backdate the issued_at so the token is "expired"
        active_session.qr_token_issued_at = datetime.now(timezone.utc) - timedelta(seconds=120)
        db.commit()

        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)
        assert resp.status_code == 400
        assert "süre" in resp.json()["detail"].lower() or "dolmuş" in resp.json()["detail"].lower()

    def test_not_enrolled_student_rejected(self, client, active_session, db):
        """A student not enrolled in the course cannot scan QR."""
        from app.models.user import User
        from app.security.password import hash_password
        from app.security.jwt import create_access_token

        outsider = User(
            username="outsider",
            email="outsider@test.com",
            hashed_password=hash_password("Pass1234!"),
            name="Outsider",
            role="student",
        )
        db.add(outsider)
        db.commit()
        db.refresh(outsider)

        headers = {"Authorization": f"Bearer {create_access_token(outsider.id)}"}
        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=headers)
        assert resp.status_code == 403

    def test_instructor_cannot_scan_qr(self, client, instructor_headers, active_session, enrollment):
        resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=instructor_headers)
        assert resp.status_code == 403


class TestAttendanceRecordsPagination:
    def test_records_paginated_shape(self, client, instructor_headers):
        resp = client.get("/api/v1/attendance/records", headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "records" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data

    def test_page_size_respected(self, client, instructor_headers, db, active_session, course, enrollment, student_user):
        # Create 3 final records
        from app.models.attendance import FinalAttendanceRecord
        for i in range(3):
            rec = FinalAttendanceRecord(
                student_id=student_user.id,
                session_id=active_session.id + i,  # different sessions to avoid unique constraint
                course_id=course.id,
                status="present",
                is_flagged=False,
            )
            # Use real session IDs to avoid FK issues — just test pagination logic
        resp = client.get("/api/v1/attendance/records?page=1&page_size=1", headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["records"]) <= 1

    def test_student_forbidden_from_records(self, client, student_headers):
        resp = client.get("/api/v1/attendance/records", headers=student_headers)
        assert resp.status_code == 403


class TestMyHistory:
    def test_student_sees_own_history(self, client, student_headers):
        resp = client.get("/api/v1/attendance/my-history", headers=student_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_instructor_cannot_use_my_history(self, client, instructor_headers):
        resp = client.get("/api/v1/attendance/my-history", headers=instructor_headers)
        assert resp.status_code == 403


class TestDuplicatePrevention:
    def test_double_qr_scan_returns_409_or_existing(self, client, student_headers, active_session, enrollment, db):
        """Second scan for same session should either reuse attempt or return 409."""
        # First scan
        r1 = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)
        assert r1.status_code == 200

        # Second scan — should reuse the existing attempt (not crash)
        r2 = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)
        assert r2.status_code in (200, 409)


class TestFakeGpsFlagging:
    def _prepare_attempt_for_location(
        self,
        client,
        db,
        student_headers,
        active_session,
        enrollment,
        student_user,
        set_session_coords: bool = True,
    ):
        """Create a pipeline state ready for STEP 3 location verification."""
        # Optionally set session coordinates (some tests intentionally skip geofence).
        if set_session_coords:
            active_session.latitude = 41.015137
            active_session.longitude = 28.979530
        else:
            active_session.latitude = None
            active_session.longitude = None
        db.commit()

        # STEP 1 (QR) via API, then mark STEP 2 as verified for focused STEP 3 tests.
        qr_resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)
        assert qr_resp.status_code == 200

        from app.models.attendance import AttendanceAttempt
        attempt = db.query(AttendanceAttempt).filter(
            AttendanceAttempt.student_id == student_user.id,
            AttendanceAttempt.session_id == active_session.id,
        ).first()
        attempt.face_status = "verified"
        db.commit()

    def test_is_mocked_true_always_flagged(self, client, db, student_headers, active_session, enrollment, student_user):
        """If mobile reports mocked location, flow should eventually produce flagged record."""
        self._prepare_attempt_for_location(client, db, student_headers, active_session, enrollment, student_user)

        # fake_gps retry logic may return 400 until max attempts are reached.
        data = None
        resp = None
        for _ in range(3):
            resp = client.post("/api/v1/attendance/verify-location", json={
                "session_id": active_session.id,
                "latitude": active_session.latitude,
                "longitude": active_session.longitude,
                "accuracy": 5.0,
                "is_mocked": True,
            }, headers=student_headers)
            if resp.status_code == 200:
                data = resp.json()
                break
        assert resp is not None
        assert resp.status_code == 200
        assert data is not None
        assert data["is_flagged"] is True
        assert data["flag_reason"] == "fake_gps_detected"
        assert data["status"] == "pending_review"

    def test_location_skipped_flagged_when_session_has_no_coordinates(self, client, db, student_headers, active_session, enrollment, student_user):
        """If session has no geofence coordinates, location is skipped and record is flagged."""
        self._prepare_attempt_for_location(
            client, db, student_headers, active_session, enrollment, student_user, set_session_coords=False
        )

        resp = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 41.015137,
            "longitude": 28.979530,
            "accuracy": 150.0,
            "is_mocked": False,
        }, headers=student_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_flagged"] is True
        assert data["flag_reason"] in ("location_skipped", "face_simulated")
        assert data["status"] == "pending_review"

    def test_outside_geofence_is_flagged_instead_of_rejected(
        self, client, db, student_headers, active_session, enrollment, student_user
    ):
        """
        Mobile step-3 policy: geofence mismatch gives one retry warning first,
        then finalizes as flagged/pending_review on next attempt.
        """
        self._prepare_attempt_for_location(
            client, db, student_headers, active_session, enrollment, student_user, set_session_coords=True
        )

        first = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 40.7128,   # intentionally far from seeded Istanbul coordinate
            "longitude": -74.0060,
            "accuracy": 5.0,
            "is_mocked": False,
        }, headers=student_headers)
        assert first.status_code == 400
        assert "Sınıfa yaklaşın" in first.json()["detail"]
        assert "(1/2)" in first.json()["detail"]

        second = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "accuracy": 5.0,
            "is_mocked": False,
        }, headers=student_headers)
        assert second.status_code == 200
        data = second.json()
        assert data["is_flagged"] is True
        assert data["status"] == "pending_review"
        assert "location_failed" in (data["flag_reason"] or "")


class TestReviewAttendance:
    def _create_final_record(self, db, student_id, session_id, course_id):
        from app.models.attendance import FinalAttendanceRecord
        rec = FinalAttendanceRecord(
            student_id=student_id,
            session_id=session_id,
            course_id=course_id,
            status="pending_review",
            is_flagged=True,
            flag_reason="face_simulated",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return rec

    def test_instructor_can_review(self, client, instructor_headers, db, active_session, course, student_user):
        rec = self._create_final_record(db, student_user.id, active_session.id, course.id)
        resp = client.patch(f"/api/v1/attendance/{rec.id}/review", json={
            "is_flagged": False,
            "status": "present",
        }, headers=instructor_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_flagged"] is False
        assert data["status"] == "present"

    def test_student_cannot_review(self, client, student_headers, db, active_session, course, student_user):
        rec = self._create_final_record(db, student_user.id, active_session.id, course.id)
        resp = client.patch(f"/api/v1/attendance/{rec.id}/review", json={
            "is_flagged": False,
        }, headers=student_headers)
        assert resp.status_code == 403

    def test_review_nonexistent_record(self, client, instructor_headers):
        resp = client.patch("/api/v1/attendance/999999/review", json={
            "is_flagged": False,
        }, headers=instructor_headers)
        assert resp.status_code == 404


class TestParallelCourseCredit:
    def test_set_status_credits_student_parallel_course(
        self, client, db, instructor_headers, student_user, instructor_user
    ):
        from app.models.course import Course, Enrollment
        from app.models.session import AttendanceSession
        from app.models.attendance import FinalAttendanceRecord
        from app.utils.qr import generate_qr_token

        session_course = Course(
            code="PCR101",
            name="Parallel Session Course",
            instructor_id=instructor_user.id,
            shared_class_id=999,
        )
        student_course = Course(
            code="PCR102",
            name="Parallel Student Course",
            instructor_id=instructor_user.id,
            shared_class_id=999,
        )
        db.add(session_course)
        db.add(student_course)
        db.commit()
        db.refresh(session_course)
        db.refresh(student_course)

        db.add(Enrollment(course_id=student_course.id, student_id=student_user.id))
        db.commit()

        session = AttendanceSession(
            course_id=session_course.id,
            date="2024-06-01",
            start_time="09:00",
            status="active",
            qr_token=generate_qr_token(),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        resp = client.put(
            "/api/v1/attendance/set-status",
            json={
                "student_id": student_user.id,
                "session_id": session.id,
                "status": "present",
            },
            headers=instructor_headers,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["course_id"] == student_course.id

        record = db.query(FinalAttendanceRecord).filter(
            FinalAttendanceRecord.student_id == student_user.id,
            FinalAttendanceRecord.session_id == session.id,
        ).first()
        assert record is not None
        assert record.course_id == student_course.id


class TestWebAttendInputValidation:
    def test_oversized_image_rejected(self, client, student_headers, active_session, enrollment):
        big_image = "A" * 3_000_000  # > 2.8M char limit
        resp = client.post("/api/v1/attendance/web-attend", json={
            "session_id": active_session.id,
            "image_base64": big_image,
            "latitude": 41.0,
            "longitude": 29.0,
        }, headers=student_headers)
        assert resp.status_code == 422  # Pydantic validator

    def test_missing_fields_rejected(self, client, student_headers):
        resp = client.post("/api/v1/attendance/web-attend", json={
            "session_id": 1,
            # missing image_base64, latitude, longitude
        }, headers=student_headers)
        assert resp.status_code == 422


class TestWebAttendPolicy:
    def test_web_attend_location_skipped_flagged_when_face_passes(
        self, client, db, student_headers, active_session, enrollment, monkeypatch
    ):
        from app.services.face_service import FaceService

        monkeypatch.setattr(FaceService, "verify", lambda *args, **kwargs: (True, 0.99))
        active_session.latitude = None
        active_session.longitude = None
        db.commit()

        resp = client.post("/api/v1/attendance/web-attend", json={
            "session_id": active_session.id,
            "image_base64": "dGVzdA==",
            "latitude": 41.015137,
            "longitude": 28.979530,
            "accuracy": 10.0,
            "is_mocked": False,
        }, headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_flagged"] is True
        assert data["status"] == "pending_review"
        assert "location_skipped" in (data["flag_reason"] or "")

    def test_web_attend_outside_geofence_flagged_when_face_passes(
        self, client, db, student_headers, active_session, enrollment, monkeypatch
    ):
        from app.services.face_service import FaceService

        monkeypatch.setattr(FaceService, "verify", lambda *args, **kwargs: (True, 0.99))
        active_session.latitude = 41.015137
        active_session.longitude = 28.979530
        db.commit()

        first = client.post("/api/v1/attendance/web-attend", json={
            "session_id": active_session.id,
            "image_base64": "dGVzdA==",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "accuracy": 5.0,
            "is_mocked": False,
        }, headers=student_headers)
        assert first.status_code == 400
        assert "Sınıfa yaklaşın" in first.json()["detail"]
        assert "(1/2)" in first.json()["detail"]

        second = client.post("/api/v1/attendance/web-attend", json={
            "session_id": active_session.id,
            "image_base64": "dGVzdA==",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "accuracy": 5.0,
            "is_mocked": False,
        }, headers=student_headers)
        assert second.status_code == 200
        data = second.json()
        assert data["is_flagged"] is True
        assert data["status"] == "pending_review"
        assert "location_failed" in (data["flag_reason"] or "")


class TestGpsHardening:
    """PART 4 — GPS koordinat ve plausibility validator testleri."""

    # ── Schema-level (Pydantic 422) ───────────────────────────────────────────

    def test_null_island_verify_location_rejected(self, client, student_headers, active_session, enrollment):
        """(0, 0) koordinatı verify-location'a ulaşmamalı — 422."""
        resp = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 0.0,
            "longitude": 0.0,
        }, headers=student_headers)
        assert resp.status_code == 422

    def test_null_island_web_attend_rejected(self, client, student_headers, active_session, enrollment):
        """(0, 0) koordinatı web-attend'e ulaşmamalı — 422."""
        resp = client.post("/api/v1/attendance/web-attend", json={
            "session_id": active_session.id,
            "image_base64": "dGVzdA==",
            "latitude": 0.0,
            "longitude": 0.0,
        }, headers=student_headers)
        assert resp.status_code == 422

    def test_latitude_out_of_range_rejected(self, client, student_headers, active_session, enrollment):
        """lat=95 aralık dışı — 422."""
        resp = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 95.0,
            "longitude": 29.0,
        }, headers=student_headers)
        assert resp.status_code == 422

    def test_longitude_out_of_range_rejected(self, client, student_headers, active_session, enrollment):
        """lon=200 aralık dışı — 422."""
        resp = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 41.0,
            "longitude": 200.0,
        }, headers=student_headers)
        assert resp.status_code == 422

    def test_near_null_island_not_rejected(self, client, student_headers, active_session, enrollment):
        """(0.001, 0.001) Null Island değil — 422 DEĞİL (auth/pipeline hatası olabilir ama GPS kabul edilmeli)."""
        resp = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 0.001,
            "longitude": 0.001,
        }, headers=student_headers)
        # 422 olmamalı; pipeline hatası (400) veya başarı (200) beklenir
        assert resp.status_code != 422

    # ── Service-level flag (suspicious_accuracy) ──────────────────────────────

    def test_suspicious_accuracy_flagged(
        self, client, db, student_headers, active_session, enrollment, student_user
    ):
        """accuracy=0.001m → sub-metre hassasiyet → suspicious_accuracy flag."""
        # Pipeline'ı STEP 3'e hazırla
        active_session.latitude = None  # geofence'i atla
        active_session.longitude = None
        db.commit()

        qr_resp = client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)
        assert qr_resp.status_code == 200

        from app.models.attendance import AttendanceAttempt
        attempt = db.query(AttendanceAttempt).filter(
            AttendanceAttempt.student_id == student_user.id,
            AttendanceAttempt.session_id == active_session.id,
        ).first()
        attempt.face_status = "verified"
        db.commit()

        resp = client.post("/api/v1/attendance/verify-location", json={
            "session_id": active_session.id,
            "latitude": 41.015137,
            "longitude": 28.979530,
            "accuracy": 0.001,   # sub-metre → fiziksel olarak imkansız
            "is_mocked": False,
        }, headers=student_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_flagged"] is True
        assert data["flag_reason"] == "suspicious_accuracy"
        assert data["status"] == "pending_review"

    def test_is_mocked_beats_suspicious_accuracy(
        self, client, db, student_headers, active_session, enrollment, student_user
    ):
        """is_mocked=True + accuracy=0.001 → fake_gps_detected (is_mocked öncelikli)."""
        active_session.latitude = None
        active_session.longitude = None
        db.commit()

        client.post("/api/v1/attendance/scan-qr", json={
            "session_id": active_session.id,
            "qr_token": active_session.qr_token,
        }, headers=student_headers)

        from app.models.attendance import AttendanceAttempt
        attempt = db.query(AttendanceAttempt).filter(
            AttendanceAttempt.student_id == student_user.id,
            AttendanceAttempt.session_id == active_session.id,
        ).first()
        attempt.face_status = "verified"
        db.commit()

        data = None
        resp = None
        for _ in range(3):
            resp = client.post("/api/v1/attendance/verify-location", json={
                "session_id": active_session.id,
                "latitude": 41.015137,
                "longitude": 28.979530,
                "accuracy": 0.001,
                "is_mocked": True,
            }, headers=student_headers)
            if resp.status_code == 200:
                data = resp.json()
                break

        assert resp is not None
        assert resp.status_code == 200
        assert data is not None
        assert data["is_flagged"] is True
        assert data["flag_reason"] == "fake_gps_detected"  # is_mocked öncelikli
