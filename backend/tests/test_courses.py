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

    def test_admin_can_filter_courses_by_department(self, client, admin_headers, db, instructor_user):
        from app.models.course import Course

        c1 = Course(code="DEP101", name="Dept CS", instructor_id=instructor_user.id, department="CS")
        c2 = Course(code="DEP102", name="Dept EE", instructor_id=instructor_user.id, department="EE")
        db.add(c1)
        db.add(c2)
        db.commit()

        resp = client.get("/api/v1/courses/?department=CS", headers=admin_headers)
        assert resp.status_code == 200
        codes = {c["code"] for c in resp.json()}
        assert "DEP101" in codes
        assert "DEP102" not in codes

    def test_student_sees_parallel_group_courses_when_enrolled_in_one(
        self, client, student_headers, db, instructor_user, student_user
    ):
        from app.models.course import Course, Enrollment

        base_course = Course(
            code="PARV101",
            name="Parallel Visible Base",
            instructor_id=instructor_user.id,
            shared_class_id=991,
        )
        parallel_course = Course(
            code="PARV102",
            name="Parallel Visible Branch",
            instructor_id=instructor_user.id,
            shared_class_id=991,
        )
        db.add(base_course)
        db.add(parallel_course)
        db.commit()
        db.refresh(base_course)
        db.refresh(parallel_course)

        db.add(Enrollment(course_id=parallel_course.id, student_id=student_user.id))
        db.commit()

        resp = client.get("/api/v1/courses/", headers=student_headers)
        assert resp.status_code == 200
        ids = {c["id"] for c in resp.json()}
        assert base_course.id in ids
        assert parallel_course.id in ids


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
    def test_instructor_cannot_enroll_student(self, client, instructor_headers, course, student_user):
        resp = client.post(
            f"/api/v1/courses/{course.id}/enroll",
            json={"student_id": student_user.id},
            headers=instructor_headers,
        )
        assert resp.status_code == 403

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

    def test_get_course_students_includes_parallel_group_students(
        self, client, instructor_headers, db, instructor_user, student_user
    ):
        from app.models.course import Course, Enrollment

        base_course = Course(
            code="PAR101",
            name="Parallel Base",
            instructor_id=instructor_user.id,
            shared_class_id=777,
        )
        parallel_course = Course(
            code="PAR102",
            name="Parallel Branch",
            instructor_id=instructor_user.id,
            shared_class_id=777,
        )
        db.add(base_course)
        db.add(parallel_course)
        db.commit()
        db.refresh(base_course)
        db.refresh(parallel_course)

        db.add(Enrollment(course_id=parallel_course.id, student_id=student_user.id))
        db.commit()

        resp = client.get(
            f"/api/v1/courses/{base_course.id}/students",
            headers=instructor_headers,
        )
        assert resp.status_code == 200
        student_ids = [s["id"] for s in resp.json()]
        assert student_user.id in student_ids


class TestParallelLinking:
    def test_admin_can_link_two_courses_without_manual_group_id(
        self, client, admin_headers, db, instructor_user
    ):
        from app.models.course import Course

        c1 = Course(code="LNK101", name="Link 1", instructor_id=instructor_user.id)
        c2 = Course(code="LNK102", name="Link 2", instructor_id=instructor_user.id)
        db.add(c1)
        db.add(c2)
        db.commit()
        db.refresh(c1)
        db.refresh(c2)

        resp = client.post(
            "/api/v1/courses/parallel/link",
            json={"course_id": c1.id, "with_course_id": c2.id},
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["success"] is True
        assert body["shared_class_id"] is not None

    def test_link_merge_existing_groups(
        self, client, admin_headers, db, instructor_user
    ):
        from app.models.course import Course

        c1 = Course(code="LNK201", name="Link A", instructor_id=instructor_user.id, shared_class_id=901)
        c2 = Course(code="LNK202", name="Link B", instructor_id=instructor_user.id, shared_class_id=902)
        c3 = Course(code="LNK203", name="Link C", instructor_id=instructor_user.id, shared_class_id=902)
        db.add(c1)
        db.add(c2)
        db.add(c3)
        db.commit()
        db.refresh(c1)
        db.refresh(c2)
        db.refresh(c3)

        resp = client.post(
            "/api/v1/courses/parallel/link",
            json={"course_id": c1.id, "with_course_id": c2.id},
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        target_group = resp.json()["shared_class_id"]

        db.refresh(c1)
        db.refresh(c2)
        db.refresh(c3)
        assert c1.shared_class_id == target_group
        assert c2.shared_class_id == target_group
        assert c3.shared_class_id == target_group


class TestCourseDelete:
    def test_delete_impact_returns_blocking_dependencies(
        self, client, admin_headers, db, course
    ):
        from app.models.session import AttendanceSession

        db.add(
            AttendanceSession(
                course_id=course.id,
                date="2026-06-22",
                start_time="09:00",
                end_time="10:00",
                status="closed",
            )
        )
        db.commit()

        resp = client.get(
            f"/api/v1/courses/{course.id}/delete-impact",
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        assert payload["can_delete"] is False
        assert payload["dependencies"]["attendance_sessions"] == 1

    def test_delete_course_returns_409_with_turkish_message_when_blocked(
        self, client, admin_headers, db, course
    ):
        from app.models.session import AttendanceSession

        db.add(
            AttendanceSession(
                course_id=course.id,
                date="2026-06-22",
                start_time="09:00",
                end_time="10:00",
                status="closed",
            )
        )
        db.commit()

        resp = client.delete(
            f"/api/v1/courses/{course.id}",
            headers={**admin_headers, "Accept-Language": "tr"},
        )
        assert resp.status_code == 409, resp.text
        detail = resp.json()["detail"]
        assert detail["code"] == "course_delete_blocked"
        assert "Bu ders silinemiyor" in detail["message"]
        assert detail["dependencies"]["attendance_sessions"] == 1

    def test_delete_course_returns_409_with_english_message_when_blocked(
        self, client, admin_headers, db, course
    ):
        from app.models.session import AttendanceSession

        db.add(
            AttendanceSession(
                course_id=course.id,
                date="2026-06-22",
                start_time="09:00",
                end_time="10:00",
                status="closed",
            )
        )
        db.commit()

        resp = client.delete(
            f"/api/v1/courses/{course.id}",
            headers={**admin_headers, "Accept-Language": "en-US"},
        )
        assert resp.status_code == 409, resp.text
        detail = resp.json()["detail"]
        assert detail["code"] == "course_delete_blocked"
        assert "cannot be deleted" in detail["message"]
        assert detail["dependencies"]["attendance_sessions"] == 1
