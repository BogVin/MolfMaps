"""Contract tests for GET /api/session and POST /api/logout (FR-008, FR-009)."""

from __future__ import annotations

import app.security as security
from tests.conftest import TEST_PASSWORD, TEST_USERNAME


def _login(client):
    return client.post(
        "/api/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )


def test_session_false_before_login(configured_client):
    res = configured_client.get("/api/session")
    assert res.status_code == 200
    assert res.json() == {"authenticated": False}


def test_session_true_after_login(configured_client):
    _login(configured_client)
    res = configured_client.get("/api/session")
    assert res.status_code == 200
    assert res.json() == {"authenticated": True}


def test_tampered_cookie_is_unauthenticated(configured_client):
    configured_client.cookies.set("session", "tampered.value.notsigned")
    res = configured_client.get("/api/session")
    assert res.json() == {"authenticated": False}


def test_expired_cookie_is_unauthenticated(configured_client, monkeypatch):
    _login(configured_client)
    # Advance time past the max age so the (valid-signature) cookie expires.
    real_time = security.time.time()
    monkeypatch.setattr(
        security.time, "time", lambda: real_time + security.SESSION_MAX_AGE + 10
    )
    res = configured_client.get("/api/session")
    assert res.json() == {"authenticated": False}


def test_logout_clears_cookie(configured_client):
    _login(configured_client)
    res = configured_client.post("/api/logout")
    assert res.status_code == 200
    assert "detail" in res.json()
    # After logout the session is no longer authenticated.
    assert configured_client.get("/api/session").json() == {"authenticated": False}
