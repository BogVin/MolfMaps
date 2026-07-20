"""Contract tests for POST /api/login (FR-005, FR-006, FR-007, FR-011, SC-004)."""

from __future__ import annotations

from tests.conftest import TEST_PASSWORD, TEST_USERNAME


def test_login_success_sets_cookie(configured_client):
    res = configured_client.post(
        "/api/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )
    assert res.status_code == 200
    assert res.json() == {"authenticated": True}
    assert "session" in res.cookies


def test_wrong_password_and_wrong_username_are_identical(configured_client):
    bad_pw = configured_client.post(
        "/api/login", json={"username": TEST_USERNAME, "password": "nope"}
    )
    bad_user = configured_client.post(
        "/api/login", json={"username": "someone", "password": TEST_PASSWORD}
    )
    assert bad_pw.status_code == 401
    assert bad_user.status_code == 401
    # Identical generic message — never reveals which field was wrong.
    assert bad_pw.json() == bad_user.json()
    assert "session" not in bad_pw.cookies
    assert "session" not in bad_user.cookies


def test_missing_or_empty_fields_return_422(configured_client):
    assert configured_client.post("/api/login", json={"username": "admin"}).status_code == 422
    assert (
        configured_client.post(
            "/api/login", json={"username": "", "password": ""}
        ).status_code
        == 422
    )


def test_unconfigured_refuses_any_login(unconfigured_client):
    res = unconfigured_client.post(
        "/api/login", json={"username": "admin", "password": "anything"}
    )
    assert res.status_code == 401
    assert "session" not in res.cookies
