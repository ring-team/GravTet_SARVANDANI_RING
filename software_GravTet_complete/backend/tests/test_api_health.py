"""Smoke tests for the Flask gravity API (libraries may be unloaded in CI)."""

from api.app import app


def test_health_returns_ok():
    app.config["TESTING"] = True
    client = app.test_client()
    rv = client.get("/api/health")
    assert rv.status_code == 200
    data = rv.get_json()
    assert data is not None
    assert data.get("status") == "ok"
