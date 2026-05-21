"""Tests for room CRUD endpoints."""
import pytest
from app.models.room import Room


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_room(client, admin_headers, name="A101", lat=41.0, lng=29.0, radius=50):
    return client.post(
        "/api/v1/rooms/",
        json={"name": name, "latitude": lat, "longitude": lng, "geofence_radius": radius},
        headers=admin_headers,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_create_room_admin(client, admin_headers):
    r = _create_room(client, admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "A101"
    assert data["geofence_radius"] == 50


def test_create_room_forbidden_for_student(client, student_headers):
    r = client.post(
        "/api/v1/rooms/",
        json={"name": "B201", "latitude": 41.0, "longitude": 29.0, "geofence_radius": 30},
        headers=student_headers,
    )
    assert r.status_code == 403


def test_list_rooms(client, admin_headers):
    _create_room(client, admin_headers, name="Room1")
    _create_room(client, admin_headers, name="Room2")
    r = client.get("/api/v1/rooms/", headers=admin_headers)
    assert r.status_code == 200
    names = [rm["name"] for rm in r.json()]
    assert "Room1" in names
    assert "Room2" in names


def test_get_room_by_id(client, admin_headers, db):
    r = _create_room(client, admin_headers, name="UniqueRoom")
    assert r.status_code == 200
    room_id = r.json()["id"]
    r2 = client.get(f"/api/v1/rooms/{room_id}", headers=admin_headers)
    assert r2.status_code == 200
    assert r2.json()["name"] == "UniqueRoom"


def test_update_room(client, admin_headers):
    r = _create_room(client, admin_headers, name="OldName")
    room_id = r.json()["id"]
    r2 = client.put(
        f"/api/v1/rooms/{room_id}",
        json={"name": "NewName", "geofence_radius": 75},
        headers=admin_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["name"] == "NewName"
    assert r2.json()["geofence_radius"] == 75


def test_delete_room(client, admin_headers):
    r = _create_room(client, admin_headers, name="ToDelete")
    room_id = r.json()["id"]
    rd = client.delete(f"/api/v1/rooms/{room_id}", headers=admin_headers)
    assert rd.status_code in (200, 204)
    r2 = client.get(f"/api/v1/rooms/{room_id}", headers=admin_headers)
    assert r2.status_code == 404
