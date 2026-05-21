"""Tests for dispute submission and review."""
import pytest

# ── Helpers ───────────────────────────────────────────────────────────────────

def _submit_dispute(client, headers, course_id, session_id, reason="Test reason"):
    return client.post(
        "/api/v1/disputes/",
        json={"course_id": course_id, "session_id": session_id, "reason": reason},
        headers=headers,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_submit_dispute_enrolled_student(client, student_headers, enrollment, active_session):
    r = _submit_dispute(
        client, student_headers,
        course_id=enrollment.course_id,
        session_id=active_session.id,
    )
    assert r.status_code in (200, 201), r.text


def test_submit_dispute_unenrolled_student_denied(client, student_headers, db, active_session):
    """Student not enrolled in the course cannot submit a dispute."""
    from app.models.course import Course
    from app.security.password import hash_password
    from app.models.user import User

    other_course = Course(code="OTHER999", name="Other Course", instructor_id=None)
    db.add(other_course)
    db.commit()
    db.refresh(other_course)

    r = _submit_dispute(
        client, student_headers,
        course_id=other_course.id,
        session_id=active_session.id,
    )
    assert r.status_code == 403


def test_submit_dispute_wrong_session_course(client, student_headers, enrollment, db):
    """session_id belonging to a different course must be rejected."""
    from app.models.course import Course
    from app.models.session import AttendanceSession
    from app.utils.qr import generate_qr_token
    from datetime import datetime, timezone

    other_course = Course(code="WRONG999", name="Wrong Course", instructor_id=None)
    db.add(other_course)
    db.commit()
    db.refresh(other_course)

    other_session = AttendanceSession(
        course_id=other_course.id,
        date="2024-02-01",
        start_time="10:00",
        status="active",
        qr_token=generate_qr_token(),
        qr_token_issued_at=datetime.now(timezone.utc),
    )
    db.add(other_session)
    db.commit()
    db.refresh(other_session)

    r = _submit_dispute(
        client, student_headers,
        course_id=enrollment.course_id,
        session_id=other_session.id,
    )
    assert r.status_code == 400


def test_instructor_cannot_review_other_instructor_dispute(
    client, instructor_headers, student_headers, enrollment, active_session, db
):
    """An instructor cannot review disputes for courses they don't teach."""
    from app.models.user import User
    from app.models.course import Course
    from app.security.password import hash_password

    # Submit a dispute as student
    r_submit = _submit_dispute(
        client, student_headers,
        course_id=enrollment.course_id,
        session_id=active_session.id,
    )
    assert r_submit.status_code in (200, 201), r_submit.text
    dispute_id = r_submit.json()["id"]

    # Another instructor (not teaching the course) tries to review
    other_inst = User(
        username="other_inst",
        email="other@test.com",
        hashed_password=hash_password("OtherInst1!"),
        name="Other Instructor",
        role="instructor",
        is_active=True,
    )
    db.add(other_inst)
    db.commit()
    db.refresh(other_inst)

    from app.security.jwt import create_access_token
    other_headers = {"Authorization": f"Bearer {create_access_token(other_inst.id)}"}

    r_review = client.patch(
        f"/api/v1/disputes/{dispute_id}/review",
        json={"status": "approved", "notes": "Approved"},
        headers=other_headers,
    )
    assert r_review.status_code == 403
