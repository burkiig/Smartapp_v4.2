"""Tests for notification endpoints."""
import pytest


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
