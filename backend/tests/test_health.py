"""Tests for health check endpoints."""
import pytest


def test_health_live(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "healthy", "live")


def test_health_ready(client):
    r = client.get("/health/ready")
    assert r.status_code in (200, 503)
    data = r.json()
    assert "status" in data or "db" in data
