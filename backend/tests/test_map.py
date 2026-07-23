"""Contract tests for the public map asset and catalog endpoints."""

from __future__ import annotations

from pathlib import Path

import app.routes.assets as assets_route

ASSET_PATH = Path(__file__).resolve().parent.parent / "assets" / "kal_main_map.webp"


def test_map_served_when_present(configured_client):
    res = configured_client.get("/api/map")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/webp"
    assert len(res.content) > 0


def test_maps_list_is_public_and_describes_available_maps(unconfigured_client):
    res = unconfigured_client.get("/api/maps")

    assert res.status_code == 200
    assert res.json() == {
        "maps": [
            {
                "id": "kal-main",
                "title": "Main map of Kal",
                "image_url": "/api/map",
            }
        ]
    }


def test_maps_list_is_empty_when_asset_is_missing(
    configured_client, tmp_path, monkeypatch
):
    missing = tmp_path / "kal_main_map.webp"
    monkeypatch.setattr(assets_route, "MAP_ASSET_PATH", missing)

    res = configured_client.get("/api/maps")

    assert res.status_code == 200
    assert res.json() == {"maps": []}


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
