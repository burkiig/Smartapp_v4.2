"""
User management endpoint tests.
Covers CRUD, role restrictions, pagination, and duplicate prevention.
"""
import pytest


class TestUserList:
    def test_paginated_response_shape(self, client, admin_headers, admin_user):
        resp = client.get("/api/v1/users/", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data
        assert isinstance(data["users"], list)

    def test_filter_by_role(self, client, admin_headers, student_user):
        resp = client.get("/api/v1/users/?role=student", headers=admin_headers)
        data = resp.json()
        for u in data["users"]:
            assert u["role"] == "student"

    def test_pagination_page_size(self, client, admin_headers):
        resp = client.get("/api/v1/users/?page=1&page_size=1", headers=admin_headers)
        data = resp.json()
        assert len(data["users"]) <= 1

    def test_students_list_flat(self, client, instructor_headers, student_user):
        resp = client.get("/api/v1/users/students", headers=instructor_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_instructors_list_flat(self, client, admin_headers, instructor_user):
        resp = client.get("/api/v1/users/instructors", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestUserCreate:
    def test_admin_creates_student(self, client, admin_headers):
        resp = client.post("/api/v1/users/", json={
            "username": "newstudent",
            "email": "newstudent@test.com",
            "password": "Pass1234!",
            "name": "New Student",
            "role": "student",
        }, headers=admin_headers)
        assert resp.status_code == 201
        assert resp.json()["role"] == "student"

    def test_admin_creates_instructor(self, client, admin_headers):
        resp = client.post("/api/v1/users/", json={
            "username": "newinstructor",
            "email": "newinstructor@test.com",
            "password": "Pass1234!",
            "name": "New Instructor",
            "role": "instructor",
        }, headers=admin_headers)
        assert resp.status_code == 201

    def test_instructor_cannot_create_admin(self, client, instructor_headers):
        resp = client.post("/api/v1/users/", json={
            "username": "badactor",
            "email": "bad@test.com",
            "password": "Pass1234!",
            "name": "Bad Actor",
            "role": "admin",
        }, headers=instructor_headers)
        assert resp.status_code == 403

    def test_duplicate_email_rejected(self, client, admin_headers, student_user):
        resp = client.post("/api/v1/users/", json={
            "username": "dup_user",
            "email": "student@test.com",  # already exists
            "password": "Pass1234!",
            "name": "Dup",
            "role": "student",
        }, headers=admin_headers)
        assert resp.status_code == 409

    def test_duplicate_username_rejected(self, client, admin_headers, student_user):
        resp = client.post("/api/v1/users/", json={
            "username": "test_student",  # already exists
            "email": "unique@test.com",
            "password": "Pass1234!",
            "name": "Dup",
            "role": "student",
        }, headers=admin_headers)
        assert resp.status_code == 409


class TestGetSingleUser:
    def test_admin_can_get_any_user(self, client, admin_headers, student_user):
        resp = client.get(f"/api/v1/users/{student_user.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == student_user.id

    def test_student_can_get_own_profile(self, client, student_user, student_headers):
        resp = client.get(f"/api/v1/users/{student_user.id}", headers=student_headers)
        assert resp.status_code == 200

    def test_student_cannot_get_other_profile(self, client, student_headers, instructor_user):
        resp = client.get(f"/api/v1/users/{instructor_user.id}", headers=student_headers)
        assert resp.status_code == 403

    def test_nonexistent_user_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/users/999999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateUser:
    def test_user_can_update_own_name(self, client, student_user, student_headers):
        resp = client.patch(f"/api/v1/users/{student_user.id}", json={
            "name": "Updated Name",
        }, headers=student_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_student_cannot_update_others(self, client, student_headers, instructor_user):
        resp = client.patch(f"/api/v1/users/{instructor_user.id}", json={
            "name": "Hacked",
        }, headers=student_headers)
        assert resp.status_code == 403


class TestDeleteUser:
    def test_admin_can_delete_user(self, client, admin_headers, db):
        from app.models.user import User
        from app.security.password import hash_password
        victim = User(
            username="to_delete",
            email="delete_me@test.com",
            hashed_password=hash_password("Pass1234!"),
            name="Delete Me",
            role="student",
        )
        db.add(victim)
        db.commit()
        db.refresh(victim)

        resp = client.delete(f"/api/v1/users/{victim.id}", headers=admin_headers)
        assert resp.status_code == 200

    def test_instructor_cannot_delete(self, client, instructor_headers, student_user):
        resp = client.delete(f"/api/v1/users/{student_user.id}", headers=instructor_headers)
        assert resp.status_code == 403
