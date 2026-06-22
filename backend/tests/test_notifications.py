"""Tests for notification endpoints."""
import pytest


def _create_notification_for(db, user_id: int):
    from app.models.notification import Notification

    n = Notification(
        user_id=user_id,
        type="system",
        title="Test Notification",
        body="Body",
        is_read=False,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def test_list_notifications_empty(client, student_headers):
    r = client.get("/api/v1/notifications/", headers=student_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (list, dict))


def test_notification_count(client, student_headers):
    r = client.get("/api/v1/notifications/count", headers=student_headers)
    assert r.status_code == 200
    data = r.json()
    assert "unread_count" in data or "count" in data


def test_mark_all_read(client, student_headers):
    r = client.patch("/api/v1/notifications/read-all", headers=student_headers)
    assert r.status_code in (200, 204)


def test_notification_requires_auth(client):
    r = client.get("/api/v1/notifications/")
    assert r.status_code == 401


def test_delete_single_notification(client, db, student_user, student_headers):
    n = _create_notification_for(db, student_user.id)
    r = client.delete(f"/api/v1/notifications/{n.id}", headers=student_headers)
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_prune_read_notifications(client, db, student_user, student_headers):
    from app.models.notification import Notification

    unread = Notification(
        user_id=student_user.id,
        type="system",
        title="Unread",
        body="Body",
        is_read=False,
    )
    read = Notification(
        user_id=student_user.id,
        type="system",
        title="Read",
        body="Body",
        is_read=True,
    )
    db.add(unread)
    db.add(read)
    db.commit()

    r = client.delete("/api/v1/notifications/prune-read", headers=student_headers)
    assert r.status_code == 200
    assert r.json().get("deleted", 0) >= 1
