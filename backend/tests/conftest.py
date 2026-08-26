"""Shared pytest fixtures (research Decision 6).

Settings are driven via environment overrides so tests can exercise both a
configured-credentials app and an unconfigured (safe-fail) app. `get_settings`
re-reads the environment on each call. `MOLFMAPS_DISABLE_DOTENV=1` ensures a
developer's local `backend/.env` never leaks into the test environment.
"""

from __future__ import annotations

import base64
import importlib
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient

TEST_USERNAME = "admin"
TEST_PASSWORD = "s3cret-pw"
TEST_SECRET = "unit-test-signing-secret-please-change"

# A genuine 1x1 PNG — the upload path sniffs real bytes, so a placeholder string
# would be rejected the same way a malicious file is.
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


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


@pytest.fixture(autouse=True)
def _isolate_catalog(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    """Point the catalog at a temp directory so tests never touch backend/data."""
    monkeypatch.setenv("MAPS_DATA_DIR", str(tmp_path / "catalog"))


@pytest.fixture
def configured_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """A TestClient for an app with valid admin credentials configured."""
    monkeypatch.setenv("ADMIN_USERNAME", TEST_USERNAME)
    monkeypatch.setenv("ADMIN_PASSWORD", TEST_PASSWORD)
    monkeypatch.setenv("SESSION_SECRET", TEST_SECRET)
    with _build_client() as client:
        yield client


@pytest.fixture
def admin_client(configured_client: TestClient) -> TestClient:
    """A configured TestClient that has already logged in as the admin."""
    res = configured_client.post(
        "/api/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )
    assert res.status_code == 200
    return configured_client


@pytest.fixture
def sample_png() -> bytes:
    """A minimal valid PNG, for tests that need a real uploadable image."""
    return _PNG_BYTES


@pytest.fixture
def make_map(sample_png: bytes) -> Callable[..., str]:
    """Factory creating a catalog map through an admin client, returning its id.

    Annotations are nested under a map, so almost every annotation test needs a
    real owning map first. The client is a parameter rather than a fixture
    dependency so a test can create the map as the admin and then exercise the
    same endpoints without a session.
    """

    def _make(client: TestClient, name: str = "Test Map") -> str:
        res = client.post(
            "/api/maps",
            data={"name": name},
            files={"image": ("map.png", sample_png, "image/png")},
        )
        assert res.status_code == 201, res.text
        return res.json()["id"]

    return _make


@pytest.fixture
def unconfigured_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """A TestClient for an app with NO admin credentials configured (FR-011)."""
    monkeypatch.delenv("ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    with _build_client() as client:
        yield client
