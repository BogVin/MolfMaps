"""Annotation contract tests: public reads, admin writes, validation, clamping.

Every test runs against a temporary MAPS_DATA_DIR (see conftest), so a run never
touches a developer's real backend/data. The authorization boundary is the
headline case here: hiding the placement toggles in the frontend is presentation
only, so a regression in `require_admin` would be invisible while logged in.
"""

from __future__ import annotations

from typing import Any

from app import annotations
from app.config import DEFAULT_TEXT_SCALE, MAX_TEXT_SCALE, MIN_TEXT_SCALE

UNKNOWN_ID = "0" * 32


def _annotations_url(map_id: str) -> str:
    return f"/api/maps/{map_id}/annotations"


def _annotation_url(map_id: str, annotation_id: str) -> str:
    return f"{_annotations_url(map_id)}/{annotation_id}"


def _images_url(map_id: str, annotation_id: str) -> str:
    return f"{_annotation_url(map_id, annotation_id)}/images"


def _sidecar_bytes(map_id: str) -> bytes:
    """The raw sidecar, so a refused write can be proven byte-for-byte unchanged.

    An absent sidecar is a legitimate state — a map with no annotations has no
    file at all — so it reads as empty rather than raising.
    """
    path = annotations.sidecar_path(map_id)
    return path.read_bytes() if path.exists() else b""


def _text_link(target_map_id: str, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "kind": "text_link",
        "x": 0.5,
        "y": 0.5,
        "text": "North District",
        "target_map_id": target_map_id,
    }
    payload.update(overrides)
    return payload


def _poi(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "kind": "poi",
        "x": 0.3,
        "y": 0.7,
        "text": "The old lighthouse.",
    }
    payload.update(overrides)
    return payload


def _create_poi(client, map_id: str) -> str:
    res = client.post(_annotations_url(map_id), json=_poi())
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _attach(client, map_id: str, annotation_id: str, image: bytes) -> Any:
    return client.post(
        _images_url(map_id, annotation_id),
        files={"image": ("photo.png", image, "image/png")},
    )


def _listed(client, map_id: str, annotation_id: str) -> dict[str, Any]:
    """One annotation as the public list projects it."""
    listed = client.get(_annotations_url(map_id)).json()["annotations"]
    return next(item for item in listed if item["id"] == annotation_id)


def _sign_out(client) -> None:
    """Drop the admin session, leaving a client that is otherwise identical."""
    client.cookies.clear()


# --- Listing -----------------------------------------------------------------


def test_list_without_session_returns_empty_set_for_a_fresh_map(admin_client, make_map):
    map_id = make_map(admin_client)
    _sign_out(admin_client)

    res = admin_client.get(_annotations_url(map_id))

    assert res.status_code == 200
    assert res.json() == {"annotations": []}


def test_list_for_unknown_map_returns_404(configured_client):
    res = configured_client.get(_annotations_url(UNKNOWN_ID))

    assert res.status_code == 404


# --- Creating text links -----------------------------------------------------


def test_admin_create_returns_201_and_is_then_listed_publicly(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")

    res = admin_client.post(_annotations_url(source), json=_text_link(target))

    assert res.status_code == 201, res.text
    created = res.json()
    assert created["kind"] == "text_link"
    assert created["map_id"] == source
    assert created["target_map_id"] == target
    assert created["target_available"] is True

    _sign_out(admin_client)
    listed = admin_client.get(_annotations_url(source))
    assert listed.status_code == 200
    assert listed.json() == {"annotations": [created]}


def test_unauthenticated_create_is_refused_and_nothing_saved(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    _sign_out(admin_client)
    before = _sidecar_bytes(source)

    res = admin_client.post(_annotations_url(source), json=_text_link(target))

    assert res.status_code == 401
    assert _sidecar_bytes(source) == before
    assert admin_client.get(_annotations_url(source)).json() == {"annotations": []}


def test_forged_session_cookie_cannot_create(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    _sign_out(admin_client)
    admin_client.cookies.set("session", "forged.value")

    res = admin_client.post(_annotations_url(source), json=_text_link(target))

    assert res.status_code == 401
    assert _sidecar_bytes(source) == b""


def test_create_on_unknown_map_returns_404(admin_client, make_map):
    target = make_map(admin_client, "Target")

    res = admin_client.post(_annotations_url(UNKNOWN_ID), json=_text_link(target))

    assert res.status_code == 404


# --- Text link validation ----------------------------------------------------


def test_create_with_missing_or_blank_text_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    payload = _text_link(target)
    del payload["text"]

    missing = admin_client.post(_annotations_url(source), json=payload)
    blank = admin_client.post(_annotations_url(source), json=_text_link(target, text="   "))

    assert missing.status_code == 422
    assert blank.status_code == 422
    assert _sidecar_bytes(source) == b""


def test_create_with_overlong_text_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")

    res = admin_client.post(
        _annotations_url(source), json=_text_link(target, text="x" * 121)
    )

    assert res.status_code == 422
    assert _sidecar_bytes(source) == b""


def test_create_without_target_map_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")
    payload = _text_link("unused")
    del payload["target_map_id"]

    res = admin_client.post(_annotations_url(source), json=payload)

    assert res.status_code == 422
    assert _sidecar_bytes(source) == b""


def test_create_with_unknown_target_map_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")

    res = admin_client.post(_annotations_url(source), json=_text_link(UNKNOWN_ID))

    assert res.status_code == 422
    assert _sidecar_bytes(source) == b""


def test_create_with_position_outside_the_image_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")

    too_high = admin_client.post(_annotations_url(source), json=_text_link(target, x=1.5))
    negative = admin_client.post(_annotations_url(source), json=_text_link(target, y=-0.1))

    assert too_high.status_code == 422
    assert negative.status_code == 422
    assert _sidecar_bytes(source) == b""


# --- Label size (the one input that clamps rather than rejects) ---------------


def test_create_with_out_of_range_text_scale_is_clamped(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")

    too_large = admin_client.post(
        _annotations_url(source), json=_text_link(target, text_scale=99)
    )
    too_small = admin_client.post(
        _annotations_url(source), json=_text_link(target, text_scale=-5)
    )

    assert too_large.status_code == 201
    assert too_large.json()["text_scale"] == MAX_TEXT_SCALE
    assert too_small.status_code == 201
    assert too_small.json()["text_scale"] == MIN_TEXT_SCALE


def test_create_without_text_scale_uses_the_default(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")

    res = admin_client.post(_annotations_url(source), json=_text_link(target))

    assert res.status_code == 201
    assert res.json()["text_scale"] == DEFAULT_TEXT_SCALE


def test_self_referencing_text_link_is_accepted(admin_client, make_map):
    source = make_map(admin_client, "Source")

    res = admin_client.post(_annotations_url(source), json=_text_link(source))

    assert res.status_code == 201
    assert res.json()["target_map_id"] == source
    assert res.json()["target_available"] is True


# --- Points of interest ------------------------------------------------------


def test_create_poi_without_images_is_accepted(admin_client, make_map):
    map_id = make_map(admin_client)

    res = admin_client.post(_annotations_url(map_id), json=_poi())

    assert res.status_code == 201, res.text
    created = res.json()
    assert created["kind"] == "poi"
    # A point of interest with text but no images is a complete, valid result
    # (FR-033) — images are attached afterwards, if at all.
    assert created["images"] == []


def test_create_poi_with_blank_or_overlong_text_returns_422(admin_client, make_map):
    map_id = make_map(admin_client)

    blank = admin_client.post(_annotations_url(map_id), json=_poi(text="   "))
    overlong = admin_client.post(_annotations_url(map_id), json=_poi(text="x" * 2001))

    assert blank.status_code == 422
    assert overlong.status_code == 422
    assert _sidecar_bytes(map_id) == b""


# --- Point-of-interest images ------------------------------------------------


def test_attached_image_is_listed_with_its_url(admin_client, make_map, sample_png):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)

    res = _attach(admin_client, map_id, poi_id, sample_png)

    assert res.status_code == 201, res.text
    image = res.json()
    assert image["image_url"] == f"{_images_url(map_id, poi_id)}/{image['id']}"
    assert _listed(admin_client, map_id, poi_id)["images"] == [image]


def test_attaching_a_non_image_returns_400_and_stores_nothing(admin_client, make_map):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)

    res = _attach(admin_client, map_id, poi_id, b"not an image at all")

    assert res.status_code == 400
    assert _listed(admin_client, map_id, poi_id)["images"] == []


def test_attaching_an_oversized_image_returns_413(
    admin_client, make_map, sample_png, monkeypatch
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    # Settings are re-read per request, so the cap can be lowered under the
    # already-running app rather than uploading a genuinely huge file.
    monkeypatch.setenv("MAX_MAP_IMAGE_BYTES", "10")

    res = _attach(admin_client, map_id, poi_id, sample_png)

    assert res.status_code == 413
    assert _listed(admin_client, map_id, poi_id)["images"] == []


def test_attaching_past_the_image_cap_returns_409(
    admin_client, make_map, sample_png, monkeypatch
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    monkeypatch.setenv("MAX_POI_IMAGES", "2")

    accepted = [
        _attach(admin_client, map_id, poi_id, sample_png).status_code for _ in range(2)
    ]
    refused = _attach(admin_client, map_id, poi_id, sample_png)

    assert accepted == [201, 201]
    assert refused.status_code == 409
    assert len(_listed(admin_client, map_id, poi_id)["images"]) == 2


def test_attaching_to_a_text_link_returns_409(admin_client, make_map, sample_png):
    map_id = make_map(admin_client)
    created = admin_client.post(_annotations_url(map_id), json=_text_link(map_id))
    link_id = created.json()["id"]

    res = _attach(admin_client, map_id, link_id, sample_png)

    assert res.status_code == 409


def test_attaching_to_an_unknown_annotation_returns_404(
    admin_client, make_map, sample_png
):
    map_id = make_map(admin_client)

    res = _attach(admin_client, map_id, UNKNOWN_ID, sample_png)

    assert res.status_code == 404


def test_unauthenticated_attach_and_detach_are_refused(
    admin_client, make_map, sample_png
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    image_id = _attach(admin_client, map_id, poi_id, sample_png).json()["id"]
    _sign_out(admin_client)
    before = _sidecar_bytes(map_id)

    attach = _attach(admin_client, map_id, poi_id, sample_png)
    detach = admin_client.delete(f"{_images_url(map_id, poi_id)}/{image_id}")

    assert attach.status_code == 401
    assert detach.status_code == 401
    assert _sidecar_bytes(map_id) == before


def test_image_bytes_are_public_and_served_with_the_detected_type(
    admin_client, make_map, sample_png
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    url = _attach(admin_client, map_id, poi_id, sample_png).json()["image_url"]
    _sign_out(admin_client)

    res = admin_client.get(url)

    assert res.status_code == 200
    # Sniffed from the bytes, never taken from the client's declared type.
    assert res.headers["content-type"] == "image/png"
    assert res.content == sample_png


def test_image_missing_from_disk_returns_404(admin_client, make_map, sample_png):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    url = _attach(admin_client, map_id, poi_id, sample_png).json()["image_url"]
    for path in annotations.poi_images_dir().iterdir():
        path.unlink()

    res = admin_client.get(url)

    # The record survives; the popup renders its text with a fallback (FR-036).
    assert res.status_code == 404
    assert len(_listed(admin_client, map_id, poi_id)["images"]) == 1


def test_detach_removes_the_image_and_unlinks_its_file(
    admin_client, make_map, sample_png
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    image_id = _attach(admin_client, map_id, poi_id, sample_png).json()["id"]

    res = admin_client.delete(f"{_images_url(map_id, poi_id)}/{image_id}")

    assert res.status_code == 200
    assert _listed(admin_client, map_id, poi_id)["images"] == []
    assert list(annotations.poi_images_dir().iterdir()) == []


def test_detaching_an_unknown_image_returns_404(admin_client, make_map):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)

    res = admin_client.delete(f"{_images_url(map_id, poi_id)}/{UNKNOWN_ID}")

    assert res.status_code == 404


# --- Editing -----------------------------------------------------------------


def test_patch_updates_every_field_and_is_reflected_publicly(admin_client, make_map):
    source = make_map(admin_client, "Source")
    first = make_map(admin_client, "First target")
    second = make_map(admin_client, "Second target")
    created = admin_client.post(_annotations_url(source), json=_text_link(first)).json()

    res = admin_client.patch(
        _annotation_url(source, created["id"]),
        json={
            "text": "South District",
            "target_map_id": second,
            "text_scale": 0.07,
            "x": 0.62,
            "y": 0.41,
        },
    )

    assert res.status_code == 200, res.text
    updated = res.json()
    assert updated["text"] == "South District"
    assert updated["target_map_id"] == second
    assert updated["text_scale"] == 0.07
    assert (updated["x"], updated["y"]) == (0.62, 0.41)
    assert updated["updated_at"] > created["updated_at"]
    assert updated["created_at"] == created["created_at"]

    _sign_out(admin_client)
    assert _listed(admin_client, source, created["id"]) == updated


def test_patch_leaves_omitted_fields_unchanged(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()

    res = admin_client.patch(
        _annotation_url(source, created["id"]), json={"text_scale": 0.09}
    )

    assert res.status_code == 200
    updated = res.json()
    assert updated["text"] == created["text"]
    assert updated["target_map_id"] == created["target_map_id"]
    assert (updated["x"], updated["y"]) == (created["x"], created["y"])


def test_patch_clamps_an_out_of_range_text_scale(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()

    res = admin_client.patch(
        _annotation_url(source, created["id"]), json={"text_scale": 99}
    )

    assert res.status_code == 200
    assert res.json()["text_scale"] == MAX_TEXT_SCALE


def test_patch_with_a_field_of_the_other_kind_returns_422(admin_client, make_map):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    before = _sidecar_bytes(map_id)

    target = admin_client.patch(
        _annotation_url(map_id, poi_id), json={"target_map_id": map_id}
    )
    scale = admin_client.patch(_annotation_url(map_id, poi_id), json={"text_scale": 0.05})

    assert target.status_code == 422
    assert scale.status_code == 422
    assert _sidecar_bytes(map_id) == before


def test_patch_with_an_unknown_target_map_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()
    before = _sidecar_bytes(source)

    res = admin_client.patch(
        _annotation_url(source, created["id"]), json={"target_map_id": UNKNOWN_ID}
    )

    assert res.status_code == 422
    assert _sidecar_bytes(source) == before


def test_patch_with_overlong_text_for_the_kind_returns_422(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()

    # Inside the request model's looser 2000-char cap, but past a label's 120.
    res = admin_client.patch(
        _annotation_url(source, created["id"]), json={"text": "x" * 121}
    )

    assert res.status_code == 422
    assert _listed(admin_client, source, created["id"])["text"] == created["text"]


def test_patch_on_an_unknown_map_or_annotation_returns_404(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()

    unknown_map = admin_client.patch(
        _annotation_url(UNKNOWN_ID, created["id"]), json={"text": "Elsewhere"}
    )
    unknown_annotation = admin_client.patch(
        _annotation_url(source, UNKNOWN_ID), json={"text": "Elsewhere"}
    )

    assert unknown_map.status_code == 404
    assert unknown_annotation.status_code == 404


def test_unauthenticated_patch_and_delete_are_refused(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()
    _sign_out(admin_client)
    before = _sidecar_bytes(source)

    patched = admin_client.patch(
        _annotation_url(source, created["id"]), json={"text": "Hijacked"}
    )
    deleted = admin_client.delete(_annotation_url(source, created["id"]))

    assert patched.status_code == 401
    assert deleted.status_code == 401
    assert _sidecar_bytes(source) == before


# --- Deleting ----------------------------------------------------------------


def test_delete_removes_the_annotation_and_its_image_files(
    admin_client, make_map, sample_png
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    _attach(admin_client, map_id, poi_id, sample_png)

    res = admin_client.delete(_annotation_url(map_id, poi_id))

    assert res.status_code == 200
    assert admin_client.get(_annotations_url(map_id)).json() == {"annotations": []}
    assert list(annotations.poi_images_dir().iterdir()) == []


def test_delete_of_an_unknown_annotation_returns_404(admin_client, make_map):
    map_id = make_map(admin_client)

    res = admin_client.delete(_annotation_url(map_id, UNKNOWN_ID))

    assert res.status_code == 404


def test_deleting_the_map_removes_its_annotations_and_images(
    admin_client, make_map, sample_png
):
    map_id = make_map(admin_client)
    poi_id = _create_poi(admin_client, map_id)
    _attach(admin_client, map_id, poi_id, sample_png)

    assert admin_client.delete(f"/api/maps/{map_id}").status_code == 200

    assert admin_client.get(_annotations_url(map_id)).status_code == 404
    assert not annotations.sidecar_path(map_id).exists()
    assert list(annotations.poi_images_dir().iterdir()) == []


def test_link_to_a_deleted_target_map_survives_as_unavailable(admin_client, make_map):
    source = make_map(admin_client, "Source")
    target = make_map(admin_client, "Target")
    created = admin_client.post(_annotations_url(source), json=_text_link(target)).json()

    assert admin_client.delete(f"/api/maps/{target}").status_code == 200

    # Deliberately not cascaded: the source map and its annotations are
    # unaffected, and the stale link is a display state (FR-030).
    listed = _listed(admin_client, source, created["id"])
    assert listed["target_available"] is False
    assert listed["target_map_id"] == target
