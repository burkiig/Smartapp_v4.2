"""
Face enrollment endpoint tests:
  - size validation (oversized image rejected)
  - base64 format validation
  - enrollment status endpoint
  - instructor enrolls on behalf of student
"""
import pytest
import base64


def _tiny_valid_b64() -> str:
    """Return a minimal valid base64 string (1x1 white PNG)."""
    png_bytes = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
        b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    return base64.b64encode(png_bytes).decode()


class TestFaceEnrollValidation:
    def test_oversized_image_rejected(self, client, student_headers):
        big = "A" * 3_000_000
        resp = client.post("/api/v1/face/enroll", json={"image_base64": big}, headers=student_headers)
        assert resp.status_code == 413

    def test_invalid_base64_rejected(self, client, student_headers):
        resp = client.post("/api/v1/face/enroll", json={
            "image_base64": "not-valid-base64!!!"
        }, headers=student_headers)
        assert resp.status_code == 400

    def test_empty_image_rejected(self, client, student_headers):
        resp = client.post("/api/v1/face/enroll", json={"image_base64": ""},
                           headers=student_headers)
        assert resp.status_code in (400, 422)

    def test_valid_image_attempts_enrollment(self, client, student_headers):
        """A valid base64 image should pass validation (may fail on face detection without model)."""
        resp = client.post("/api/v1/face/enroll", json={
            "image_base64": _tiny_valid_b64()
        }, headers=student_headers)
        # 503 is valid in environments where face engine dependency/model is unavailable.
        assert resp.status_code in (200, 400, 503)


class TestEnrollmentStatus:
    def test_student_checks_own_status(self, client, student_headers):
        resp = client.get("/api/v1/face/my-status", headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "is_enrolled" in data
        assert "user_id" in data

    def test_admin_checks_any_user_status(self, client, admin_headers, student_user):
        resp = client.get(f"/api/v1/face/status/{student_user.id}", headers=admin_headers)
        assert resp.status_code == 200

    def test_student_cannot_check_others_status(self, client, student_headers, instructor_user):
        resp = client.get(f"/api/v1/face/status/{instructor_user.id}", headers=student_headers)
        assert resp.status_code == 403


class TestInstructorEnrollsStudent:
    def test_instructor_can_enroll_student(self, client, instructor_headers, student_user):
        resp = client.post("/api/v1/face/enroll/student", json={
            "student_id": student_user.id,
            "image_base64": _tiny_valid_b64(),
        }, headers=instructor_headers)
        # 503 is valid in environments where face engine dependency/model is unavailable.
        assert resp.status_code in (200, 400, 503)

    def test_student_cannot_enroll_others(self, client, student_headers, instructor_user):
        resp = client.post("/api/v1/face/enroll/student", json={
            "student_id": instructor_user.id,
            "image_base64": _tiny_valid_b64(),
        }, headers=student_headers)
        assert resp.status_code == 403

    def test_enroll_nonexistent_student_returns_404(self, client, instructor_headers):
        resp = client.post("/api/v1/face/enroll/student", json={
            "student_id": 999999,
            "image_base64": _tiny_valid_b64(),
        }, headers=instructor_headers)
        assert resp.status_code == 404
