"""Filesystem persistence for map annotations (research Decision 5).

One JSON sidecar per map at `annotations/{map_id}.json`, with the document shape
`{"annotations": [...]}`, plus point-of-interest image bytes under
`poi-images/`. Keeping annotations out of `maps.json` leaves the catalog contract
untouched and means a save on a crowded map rewrites only that map's file.

Records are stored as plain dicts because the two kinds share most of their
fields; the typed contract lives in `models.py` and is applied at the API
boundary, where each variant is validated and projected.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, BinaryIO

from . import catalog, storage
from .config import (
    DEFAULT_HOVER_APPEARANCE,
    DEFAULT_REGION_HEIGHT,
    DEFAULT_REGION_WIDTH,
    DEFAULT_REST_APPEARANCE,
    DEFAULT_TEXT_COLOR,
    DEFAULT_TEXT_SCALE,
    DEFAULT_TYPEFACE,
    MAX_LABEL_TEXT_LENGTH,
    MAX_POI_TEXT_LENGTH,
    MAX_REGION_SIZE,
    MAX_TEXT_SCALE,
    MIN_REGION_SIZE,
    MIN_TEXT_SCALE,
    get_settings,
)
from .models import AnnotationCreateRequest, AnnotationUpdateRequest

Record = dict[str, Any]

# Fields only a text link carries; supplying one for a point of interest is a
# client bug rather than a no-op, so it is refused.
_TEXT_LINK_ONLY_FIELDS = frozenset({"text_scale", "color", "typeface"})
_LINK_ONLY_FIELDS = frozenset({"target_map_id"})
_REGION_ONLY_FIELDS = frozenset({"width", "height", "rest", "hover"})


class AnnotationNotFoundError(Exception):
    """No annotation with this id exists on this map."""


class UnknownTargetMapError(Exception):
    """A text link named a target map that does not exist in the catalog."""


class KindMismatchError(Exception):
    """The operation does not apply to this annotation's kind."""


class InvalidUpdateError(Exception):
    """A change was refused; the message is safe to show the author."""


class ImageLimitReachedError(Exception):
    """This point of interest already holds the maximum number of images."""


class ImageNotFoundError(Exception):
    """No image with this id belongs to this annotation."""


def _data_dir() -> Path:
    # Settings are re-read per call so tests can repoint MAPS_DATA_DIR.
    return Path(get_settings().maps_data_dir)


def annotations_dir() -> Path:
    return _data_dir() / "annotations"


def poi_images_dir() -> Path:
    return _data_dir() / "poi-images"


def sidecar_path(map_id: str) -> Path:
    return annotations_dir() / f"{map_id}.json"


def image_path(filename: str) -> Path:
    return poi_images_dir() / filename


def _load(map_id: str) -> list[Record]:
    """Every record on this map, or an empty list when the sidecar is absent."""
    document = storage.read_json(sidecar_path(map_id)) or {}
    return list(document.get("annotations", []))


def _save(map_id: str, records: list[Record]) -> None:
    storage.write_json_atomic(sidecar_path(map_id), {"annotations": records})


def _clamp_text_scale(value: float | None) -> float:
    """Bring a label size inside its bounds, or supply the default.

    FR-024 describes the size stopping at its limit rather than the save failing,
    so this clamps where every other out-of-range value is refused.
    """
    if value is None:
        return DEFAULT_TEXT_SCALE
    return min(max(value, MIN_TEXT_SCALE), MAX_TEXT_SCALE)


def _fit_region(
    x: float, y: float, width: float | None, height: float | None
) -> tuple[float, float, float, float]:
    """Clamp region size and shift it fully onto the normalized image."""
    width = min(max(width or DEFAULT_REGION_WIDTH, MIN_REGION_SIZE), MAX_REGION_SIZE)
    height = min(max(height or DEFAULT_REGION_HEIGHT, MIN_REGION_SIZE), MAX_REGION_SIZE)
    x = min(max(x, 0.0), 1.0 - width)
    y = min(max(y, 0.0), 1.0 - height)
    return x, y, width, height


def _appearance(value: Any, default: dict[str, float | str]) -> Record:
    if value is None:
        return dict(default)
    return value.model_dump() if hasattr(value, "model_dump") else dict(value)


def list_annotations(map_id: str) -> list[Record]:
    """A map's annotations, oldest first, so render order is stable across reloads."""
    return sorted(_load(map_id), key=lambda record: record["created_at"])


def get_annotation(map_id: str, annotation_id: str) -> Record | None:
    """The record with this id on this map, or None — an annotation belonging to
    another map is indistinguishable from one that never existed."""
    for record in _load(map_id):
        if record["id"] == annotation_id:
            return record
    return None


def create_annotation(map_id: str, payload: AnnotationCreateRequest) -> Record:
    """Add one annotation to a map's sidecar (data-model.md -> Lifecycle).

    Text is already trimmed by the request model. A text link's target is checked
    against the catalog here so the author gets immediate feedback instead of a
    link that was broken from birth (research Decision 8).
    """
    now = storage.utc_now_iso()
    record: Record = {
        "id": uuid.uuid4().hex,
        "kind": payload.kind,
        "x": payload.x,
        "y": payload.y,
        "created_at": now,
        "updated_at": now,
    }
    if payload.kind == "text_link":
        if catalog.get_map(payload.target_map_id) is None:
            raise UnknownTargetMapError
        record["text"] = payload.text
        record["target_map_id"] = payload.target_map_id
        record["text_scale"] = _clamp_text_scale(payload.text_scale)
        record["color"] = payload.color or DEFAULT_TEXT_COLOR
        record["typeface"] = payload.typeface or DEFAULT_TYPEFACE
    elif payload.kind == "poi":
        record["text"] = payload.text
        record["images"] = []
    else:
        if catalog.get_map(payload.target_map_id) is None:
            raise UnknownTargetMapError
        x, y, width, height = _fit_region(
            payload.x, payload.y, payload.width, payload.height
        )
        record.update(
            {
                "x": x,
                "y": y,
                "target_map_id": payload.target_map_id,
                "width": width,
                "height": height,
                "rest": _appearance(payload.rest, DEFAULT_REST_APPEARANCE),
                "hover": _appearance(payload.hover, DEFAULT_HOVER_APPEARANCE),
            }
        )

    with storage.write_lock:
        _save(map_id, [*_load(map_id), record])
    return record


def _validate_changes(record: Record, changes: Record) -> None:
    """Refuse a change before anything is written (data-model.md -> Lifecycle)."""
    kind = record["kind"]
    keys = changes.keys()
    if kind != "text_link" and _TEXT_LINK_ONLY_FIELDS & keys:
        raise InvalidUpdateError("This annotation has no text styling.")
    if kind != "region_link" and _REGION_ONLY_FIELDS & keys:
        raise InvalidUpdateError("Only a region link has region geometry or appearance.")
    if kind == "poi" and _LINK_ONLY_FIELDS & keys:
        raise InvalidUpdateError("A point of interest has no target map.")
    if kind == "region_link" and "text" in keys:
        raise InvalidUpdateError("A region link has no text.")
    if "text" in changes:
        limit = (
            MAX_LABEL_TEXT_LENGTH
            if record["kind"] == "text_link"
            else MAX_POI_TEXT_LENGTH
        )
        if len(changes["text"]) > limit:
            raise InvalidUpdateError(f"Keep the text to {limit} characters or fewer.")
    if "target_map_id" in changes and catalog.get_map(changes["target_map_id"]) is None:
        raise UnknownTargetMapError


def update_annotation(
    map_id: str, annotation_id: str, changes: AnnotationUpdateRequest
) -> Record:
    """Apply a partial update — edit, resize, or reposition (FR-039, FR-040).

    Only the fields the author actually supplied are touched, so nudging a
    position cannot silently revert wording someone else changed.
    """
    supplied = {
        field: value
        for field, value in changes.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if "text_scale" in supplied:
        supplied["text_scale"] = _clamp_text_scale(supplied["text_scale"])

    with storage.write_lock:
        records = _load(map_id)
        record = next((item for item in records if item["id"] == annotation_id), None)
        if record is None:
            raise AnnotationNotFoundError
        _validate_changes(record, supplied)
        if record["kind"] == "region_link" and {
            "x",
            "y",
            "width",
            "height",
        } & supplied.keys():
            x, y, width, height = _fit_region(
                supplied.get("x", record["x"]),
                supplied.get("y", record["y"]),
                supplied.get("width", record["width"]),
                supplied.get("height", record["height"]),
            )
            supplied.update({"x": x, "y": y, "width": width, "height": height})
        record.update(supplied)
        record["updated_at"] = storage.utc_now_iso()
        _save(map_id, records)
    return record


def delete_annotation(map_id: str, annotation_id: str) -> None:
    """Permanently remove one annotation and unlink any images it owned (FR-041)."""
    with storage.write_lock:
        records = _load(map_id)
        removed = next((item for item in records if item["id"] == annotation_id), None)
        if removed is None:
            raise AnnotationNotFoundError
        _save(map_id, [item for item in records if item["id"] != annotation_id])
    for image in removed.get("images", []):
        image_path(image["filename"]).unlink(missing_ok=True)


def _require_poi(map_id: str, annotation_id: str) -> Record:
    """The point of interest with this id, or the reason it cannot carry images."""
    record = get_annotation(map_id, annotation_id)
    if record is None:
        raise AnnotationNotFoundError
    if record["kind"] != "poi":
        raise KindMismatchError
    return record


def add_image(map_id: str, annotation_id: str, stream: BinaryIO) -> Record:
    """Attach one image to a point of interest (data-model.md -> Creation ordering).

    The bytes are received, sized, sniffed, and committed *before* the sidecar is
    rewritten, so a refused upload leaves the annotation exactly as it was rather
    than referencing a file that was never stored.
    """
    settings = get_settings()
    record = _require_poi(map_id, annotation_id)
    if len(record.get("images", [])) >= settings.max_poi_images:
        raise ImageLimitReachedError

    stored = storage.store_upload(
        poi_images_dir(), stream, settings.max_map_image_bytes
    )
    image: Record = {
        "id": stored.id,
        "filename": stored.filename,
        "content_type": stored.content_type,
    }
    with storage.write_lock:
        records = _load(map_id)
        target = next((item for item in records if item["id"] == annotation_id), None)
        if target is None:
            # Deleted between the check above and this write; drop the orphan.
            image_path(stored.filename).unlink(missing_ok=True)
            raise AnnotationNotFoundError
        target.setdefault("images", []).append(image)
        _save(map_id, records)
    return image


def remove_image(map_id: str, annotation_id: str, image_id: str) -> None:
    """Detach an image from a point of interest and unlink its stored file."""
    _require_poi(map_id, annotation_id)
    with storage.write_lock:
        records = _load(map_id)
        target = next((item for item in records if item["id"] == annotation_id), None)
        if target is None:
            raise AnnotationNotFoundError
        images = target.get("images", [])
        removed = next((item for item in images if item["id"] == image_id), None)
        if removed is None:
            raise ImageNotFoundError
        target["images"] = [item for item in images if item["id"] != image_id]
        _save(map_id, records)
    image_path(removed["filename"]).unlink(missing_ok=True)


def image_file(map_id: str, annotation_id: str, image_id: str) -> tuple[Path, str]:
    """The stored path and detected media type for one popup image.

    A record whose file has gone still raises `ImageNotFoundError`, so the popup
    falls back gracefully rather than showing a broken image (FR-036).
    """
    record = get_annotation(map_id, annotation_id)
    if record is None:
        raise AnnotationNotFoundError
    image = next(
        (item for item in record.get("images", []) if item["id"] == image_id), None
    )
    if image is None:
        raise ImageNotFoundError
    path = image_path(image["filename"])
    if not path.is_file():
        raise ImageNotFoundError
    return path, image["content_type"]


def delete_map_annotations(map_id: str) -> None:
    """Remove a map's sidecar and unlink every image file it owned (FR-044).

    Called from `catalog.delete_map` while the shared write lock is already held,
    so this deliberately does not take the lock itself.
    """
    for record in _load(map_id):
        for image in record.get("images", []):
            image_path(image["filename"]).unlink(missing_ok=True)
    sidecar_path(map_id).unlink(missing_ok=True)
