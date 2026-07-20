"""Contract tests for GET /api/map (FR-001, FR-012, SC-006)."""

from __future__ import annotations

import shutil
from pathlib import Path

import app.routes.assets as assets_route

ASSET_PATH = Path(__file__).resolve().parent.parent / "assets" / "kal_main_map.webp"


def test_map_served_when_present(configured_client):
    res = configured_client.get("/api/map")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/webp"
    assert len(res.content) > 0


def test_map_404_when_missing(configured_client, tmp_path, monkeypatch):
    # Point the endpoint at a directory without the asset.
    missing = tmp_path / "kal_main_map.webp"
    monkeypatch.setattr(assets_route, "MAP_ASSET_PATH", missing)

    res = configured_client.get("/api/map")
    assert res.status_code == 404
    body = res.json()
    assert "detail" in body


def test_asset_actually_exists_in_repo():
    # Guards against the asset move (T005) regressing.
    assert ASSET_PATH.is_file()
