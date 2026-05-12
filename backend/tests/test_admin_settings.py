"""Tests for admin system settings endpoints."""
import pytest


def test_admin_can_list_settings(client, admin_headers):
    r = client.get("/api/v1/admin/settings/", headers=admin_headers)
    assert r.status_code == 200


def test_instructor_cannot_access_settings(client, instructor_headers):
    r = client.get("/api/v1/admin/settings/", headers=instructor_headers)
    assert r.status_code == 403


def test_student_cannot_access_settings(client, student_headers):
    r = client.get("/api/v1/admin/settings/", headers=student_headers)
    assert r.status_code == 403


def test_admin_can_upsert_setting(client, admin_headers):
    r = client.put(
        "/api/v1/admin/settings/",
        json={"key": "test_key", "value": "test_value"},
        headers=admin_headers,
    )
    assert r.status_code in (200, 201), r.text


def test_settings_requires_auth(client):
    r = client.get("/api/v1/admin/settings/")
    assert r.status_code == 401
