"""Catalog contract tests: public reads, admin writes, authorization boundary.

Every test runs against a temporary MAPS_DATA_DIR (see conftest), so a run never
touches a developer's real backend/data.
"""

from __future__ import annotations

import base64
import json

from app import catalog

# A genuine 1x1 PNG — the upload path sniffs real bytes, so a placeholder string
# would be rejected the same way a malicious file is.
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _empty_catalog(client) -> None:
    """Replace the seeded catalog with a valid empty one (FR-007)."""
    for entry in catalog.list_maps():
        catalog.image_path(entry).unlink(missing_ok=True)
    catalog.index_path().write_text(json.dumps({"maps": []}), encoding="utf-8")


def _catalog_bytes() -> bytes:
    """The raw index, so a refused write can be proven byte-for-byte unchanged."""
    return catalog.index_path().read_bytes()


def test_list_maps_without_session_returns_seeded_entry(configured_client):
    res = configured_client.get("/api/maps")

    assert res.status_code == 200
    maps = res.json()["maps"]
    assert len(maps) == 1
    assert maps[0]["name"] == "Kal Main Map"
    assert maps[0]["image_url"] == f"/api/maps/{maps[0]['id']}/image"


def test_list_maps_with_empty_catalog_returns_empty_list(configured_client):
    _empty_catalog(configured_client)

    res = configured_client.get("/api/maps")

    assert res.status_code == 200
    assert res.json() == {"maps": []}


def test_get_map_without_session_returns_metadata(configured_client):
    seeded = configured_client.get("/api/maps").json()["maps"][0]

    res = configured_client.get(f"/api/maps/{seeded['id']}")

    assert res.status_code == 200
    assert res.json() == seeded


def test_get_map_image_without_session_returns_stored_bytes(configured_client):
    seeded = configured_client.get("/api/maps").json()["maps"][0]

    res = configured_client.get(f"/api/maps/{seeded['id']}/image")

    assert res.status_code == 200
    assert res.headers["content-type"] == "image/webp"
    assert res.content[:4] == b"RIFF"


def test_unknown_map_id_returns_404_on_both_read_paths(configured_client):
    unknown = "0" * 32

    assert configured_client.get(f"/api/maps/{unknown}").status_code == 404
    assert configured_client.get(f"/api/maps/{unknown}/image").status_code == 404


def test_admin_add_creates_a_listed_and_openable_map(admin_client):
    res = admin_client.post(
        "/api/maps",
        data={"name": "  Harbour District  "},
        files={"image": ("upload.png", PNG_BYTES, "image/png")},
    )

    assert res.status_code == 201
    created = res.json()
    assert created["name"] == "Harbour District"

    listed = admin_client.get("/api/maps").json()["maps"]
    assert created in listed

    image = admin_client.get(f"/api/maps/{created['id']}/image")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.content == PNG_BYTES


def test_unauthenticated_add_is_refused_and_catalog_unchanged(configured_client):
    before = _catalog_bytes()

    res = configured_client.post(
        "/api/maps",
        data={"name": "Sneaky"},
        files={"image": ("upload.png", PNG_BYTES, "image/png")},
    )

    assert res.status_code == 401
    assert _catalog_bytes() == before
    assert len(configured_client.get("/api/maps").json()["maps"]) == 1


def test_add_with_missing_or_blank_name_returns_422(admin_client):
    missing = admin_client.post(
        "/api/maps", files={"image": ("upload.png", PNG_BYTES, "image/png")}
    )
    blank = admin_client.post(
        "/api/maps",
        data={"name": "   "},
        files={"image": ("upload.png", PNG_BYTES, "image/png")},
    )

    assert missing.status_code == 422
    assert blank.status_code == 422
    assert len(admin_client.get("/api/maps").json()["maps"]) == 1


def test_add_with_non_image_content_returns_400(admin_client):
    # A text file renamed .png with an image Content-Type: both are ignored in
    # favour of sniffing the actual bytes.
    res = admin_client.post(
        "/api/maps",
        data={"name": "Fake"},
        files={"image": ("evil.png", b"not an image at all", "image/png")},
    )

    assert res.status_code == 400
    assert len(admin_client.get("/api/maps").json()["maps"]) == 1


def test_add_over_size_limit_returns_413(admin_client, monkeypatch):
    monkeypatch.setenv("MAX_MAP_IMAGE_BYTES", "512")

    res = admin_client.post(
        "/api/maps",
        data={"name": "Huge"},
        files={"image": ("big.png", PNG_BYTES + b"\x00" * 1024, "image/png")},
    )

    assert res.status_code == 413
    assert len(admin_client.get("/api/maps").json()["maps"]) == 1


def test_admin_delete_removes_map_from_list_and_both_read_paths(admin_client):
    seeded = admin_client.get("/api/maps").json()["maps"][0]

    res = admin_client.delete(f"/api/maps/{seeded['id']}")

    assert res.status_code == 200
    assert res.json() == {"detail": "Map deleted."}
    assert admin_client.get("/api/maps").json() == {"maps": []}
    assert admin_client.get(f"/api/maps/{seeded['id']}").status_code == 404
    assert admin_client.get(f"/api/maps/{seeded['id']}/image").status_code == 404


def test_unauthenticated_delete_is_refused_and_map_survives(configured_client):
    seeded = configured_client.get("/api/maps").json()["maps"][0]
    before = _catalog_bytes()

    res = configured_client.delete(f"/api/maps/{seeded['id']}")

    assert res.status_code == 401
    assert _catalog_bytes() == before
    assert configured_client.get(f"/api/maps/{seeded['id']}/image").status_code == 200


def test_forged_session_cookie_cannot_delete(configured_client):
    seeded = configured_client.get("/api/maps").json()["maps"][0]
    before = _catalog_bytes()

    configured_client.cookies.set("session", "forged.value")
    res = configured_client.delete(f"/api/maps/{seeded['id']}")

    assert res.status_code == 401
    assert _catalog_bytes() == before
    assert configured_client.get(f"/api/maps/{seeded['id']}/image").status_code == 200


def test_delete_unknown_id_returns_404(admin_client):
    res = admin_client.delete(f"/api/maps/{'0' * 32}")

    assert res.status_code == 404
    assert len(admin_client.get("/api/maps").json()["maps"]) == 1


def test_delete_removes_the_stored_image_file(admin_client):
    seeded = admin_client.get("/api/maps").json()["maps"][0]

    admin_client.delete(f"/api/maps/{seeded['id']}")

    assert list(catalog.images_dir().iterdir()) == []


def test_rejected_uploads_leave_no_stored_image(admin_client):
    admin_client.post(
        "/api/maps",
        data={"name": "Fake"},
        files={"image": ("evil.png", b"not an image at all", "image/png")},
    )

    stored = sorted(path.name for path in catalog.images_dir().iterdir())
    seeded = admin_client.get("/api/maps").json()["maps"][0]
    assert stored == [f"{seeded['id']}.webp"]
