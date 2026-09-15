import os
import pytest
import json
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from app import app
from services.storage_service import storage_service
from services.excel_service import EXCEL_FILE_PATH

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_01_routes_200(client):
    """Verify all 4 core pages return HTTP 200 OK."""
    for path in ["/", "/gate", "/dashboard", "/admin"]:
        res = client.get(path)
        assert res.status_code == 200

def test_02_authorize_valid(client):
    """Test valid host authorization."""
    res = client.post("/api/authorize", json={
        "visitor_names": ["Rahul Sharma", "Priya Patil"],
        "pin": "1234",
        "contact": "visitor@example.com"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "Rahul Sharma" in data["visitor_names"]

def test_03_authorize_invalid_pin(client):
    """Test authorization rejection on invalid PIN."""
    res = client.post("/api/authorize", json={
        "visitor_names": ["Amit Kumar"],
        "pin": "9999"
    })
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False

def test_04_pin_format_restriction(client):
    """Test rejection when PIN is not 4-6 numeric digits."""
    # Test non-numeric
    res = client.post("/api/authorize", json={
        "visitor_names": ["Test Visitor"],
        "pin": "abcd"
    })
    assert res.status_code == 400
    assert "numbers only" in res.get_json()["message"]

    # Test short PIN (less than 4 digits)
    res2 = client.post("/api/authorize", json={
        "visitor_names": ["Test Visitor"],
        "pin": "123"
    })
    assert res2.status_code == 400
    assert "between 4 and 6 digits" in res2.get_json()["message"]

def test_05_gate_verify_authorized(client):
    """Test successful gate verification and Excel logging."""
    client.post("/api/authorize", json={
        "visitor_names": ["Rahul Sharma", "Priya Patil"],
        "pin": "1234"
    })

    res = client.post("/api/verify", json={
        "visitor_names": ["Rahul Sharma", "Priya Patil"],
        "pin": "1234"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["verdict"] == "ENTRY AUTHORIZED"
    assert os.path.exists(EXCEL_FILE_PATH)

def test_06_gate_verify_denied(client):
    """Test denied gate verification logging."""
    res = client.post("/api/verify", json={
        "visitor_names": ["Unknown Visitor"],
        "pin": "1234"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["verdict"] == "ENTRY NOT AUTHORIZED"

def test_07_dashboard_api(client):
    """Test dashboard data JSON endpoint."""
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "checks_today" in data
    assert "recent_entries" in data

def test_08_admin_change_pin(client):
    """Test changing authorization PIN."""
    res = client.post("/api/admin/change-pin", json={
        "current_pin": "1234",
        "new_pin": "5678",
        "confirm_new_pin": "5678"
    })
    assert res.status_code == 200

    # Confirm old PIN fails for new authorization
    res2 = client.post("/api/authorize", json={
        "visitor_names": ["Test Visitor"],
        "pin": "1234"
    })
    assert res2.status_code == 400

    # Reset PIN back to 1234 for consistency
    client.post("/api/admin/change-pin", json={
        "current_pin": "5678",
        "new_pin": "1234",
        "confirm_new_pin": "1234"
    })
