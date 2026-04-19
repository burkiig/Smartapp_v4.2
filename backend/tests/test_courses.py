"""
Course and enrollment endpoint tests.
"""
import pytest


class TestCourseList:
    def test_admin_sees_all_courses(self, client, admin_headers, course):
        resp = client.get("/api/v1/courses/", headers=admin_headers)
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert course.id in ids

    def test_instructor_sees_own_courses(self, client, instructor_headers, course):
        resp = client.get("/api/v1/courses/", headers=instructor_headers)
        assert resp.status_code == 200
        # All returned courses should belong to this instructor
        for c in resp.json():
            assert c["instructor_id"] == course.instructor_id

    def test_student_can_see_courses(self, client, student_headers, course, enrollment):
        resp = client.get("/api/v1/courses/", headers=student_headers)
        assert resp.status_code == 200


class TestCourseCreate:
    def test_admin_creates_course(self, client, admin_headers, instructor_user):
        resp = client.post("/api/v1/courses/", json={
            "code": "MATH201",
            "name": "Linear Algebra",
            "instructor_id": instructor_user.id,
        }, headers=admin_headers)
        assert resp.status_code == 201
        assert resp.json()["code"] == "MATH201"

    def test_student_cannot_create_course(self, client, student_headers, instructor_user):
        resp = client.post("/api/v1/courses/", json={
            "code": "HACK101",
            "name": "Hacking",
            "instructor_id": instructor_user.id,
        }, headers=student_headers)
        assert resp.status_code == 403


class TestEnrollment:
    def test_enroll_student(self, client, admin_headers, course, db):
        from app.models.user import User
        from app.security.password import hash_password
        s = User(
            username="enroll_student",
            email="enroll@test.com",
            hashed_password=hash_password("Pass1234!"),
            name="Enroll Student",
            role="student",
        )
        db.add(s)
        db.commit()
        db.refresh(s)

        resp = client.post(
            f"/api/v1/courses/{course.id}/enroll",
            json={"student_id": s.id},
            headers=admin_headers,
        )
        assert resp.status_code in (200, 201)

    def test_duplicate_enrollment_rejected(self, client, admin_headers, course, enrollment, student_user):
        resp = client.post(
            f"/api/v1/courses/{course.id}/enroll",
            json={"student_id": student_user.id},
            headers=admin_headers,
        )
        assert resp.status_code in (409, 400)

    def test_get_course_students(self, client, instructor_headers, course, enrollment, student_user):
        resp = client.get(f"/api/v1/courses/{course.id}/students", headers=instructor_headers)
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert student_user.id in ids
