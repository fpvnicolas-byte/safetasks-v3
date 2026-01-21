"""
Test health check and basic endpoints.
"""
import pytest


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "3.0.0"
    assert "modules" in data
    assert len(data["modules"]) == 5  # All 5 modules should be present


def test_root_endpoint(client):
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "Safe Tasks V3" in data["message"]
    assert data["version"] == "3.0.0"