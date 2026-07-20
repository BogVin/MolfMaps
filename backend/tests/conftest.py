"""Shared pytest fixtures (research Decision 6).

Settings are driven via environment overrides so tests can exercise both a
configured-credentials app and an unconfigured (safe-fail) app. `get_settings`
re-reads the environment on each call. `MOLFMAPS_DISABLE_DOTENV=1` ensures a
developer's local `backend/.env` never leaks into the test environment.
"""

from __future__ import annotations

import importlib
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

TEST_USERNAME = "admin"
TEST_PASSWORD = "s3cret-pw"
TEST_SECRET = "unit-test-signing-secret-please-change"


def _build_client() -> TestClient:
    # Reload config + main so the freshly-set environment is picked up.
    import app.config as config
    import app.main as main

    importlib.reload(config)
    importlib.reload(main)
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def _isolate_dotenv(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MOLFMAPS_DISABLE_DOTENV", "1")


@pytest.fixture
def configured_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """A TestClient for an app with valid admin credentials configured."""
    monkeypatch.setenv("ADMIN_USERNAME", TEST_USERNAME)
    monkeypatch.setenv("ADMIN_PASSWORD", TEST_PASSWORD)
    monkeypatch.setenv("SESSION_SECRET", TEST_SECRET)
    with _build_client() as client:
        yield client


@pytest.fixture
def unconfigured_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """A TestClient for an app with NO admin credentials configured (FR-011)."""
    monkeypatch.delenv("ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    with _build_client() as client:
        yield client
