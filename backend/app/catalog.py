"""Filesystem persistence for the map catalog (research Decisions 1-2).

The catalog is a JSON index (`maps.json`) plus one image file per map under
`maps/`. Every filesystem access for the catalog lives in this module, so route
handlers stay thin and the storage choice can be replaced without touching the
API layer. The atomic-write, timestamp, and image-validation primitives are
shared with the annotation store through `storage.py`.
"""

from __future__ import annotations

import shutil
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import BinaryIO

from . import storage
from .config import get_settings

# Re-exported so callers keep catching `catalog.<Error>` for catalog operations.
from .storage import ImageTooLargeError, UnsupportedImageError  # noqa: F401

MAX_NAME_LENGTH = 100

_SEED_ASSET = Path(__file__).resolve().parent.parent / "assets" / "kal_main_map.webp"
_SEED_NAME = "Kal Main Map"
_SEED_CONTENT_TYPE = "image/webp"


@dataclass(frozen=True)
class MapEntry:
    """One catalog record as persisted in `maps.json` (data-model.md -> Map)."""

    id: str
    name: str
    image_filename: str
    content_type: str
    created_at: str


class InvalidMapNameError(Exception):
    """The display name was missing, blank after trimming, or too long."""


class MapNotFoundError(Exception):
    """No catalog entry matches the requested id."""


def _data_dir() -> Path:
    # Settings are re-read per call so tests can repoint MAPS_DATA_DIR.
    return Path(get_settings().maps_data_dir)


def index_path() -> Path:
    return _data_dir() / "maps.json"


def images_dir() -> Path:
    return _data_dir() / "maps"


def image_path(entry: MapEntry) -> Path:
    return images_dir() / entry.image_filename


def _load_index() -> list[MapEntry]:
    """Read every entry from the index, or an empty catalog when absent."""
    document = storage.read_json(index_path()) or {}
    return [MapEntry(**item) for item in document.get("maps", [])]


def _write_index(entries: list[MapEntry]) -> None:
    storage.write_json_atomic(
        index_path(), {"maps": [asdict(entry) for entry in entries]}
    )


def list_maps() -> list[MapEntry]:
    """All catalog maps, oldest first, so the list is stable across reloads."""
    return sorted(_load_index(), key=lambda entry: entry.created_at)


def get_map(map_id: str) -> MapEntry | None:
    """The entry with this id, or None when it was never created or was deleted."""
    for entry in _load_index():
        if entry.id == map_id:
            return entry
    return None


def _validate_name(name: str) -> str:
    clean = name.strip()
    if not clean or len(clean) > MAX_NAME_LENGTH:
        raise InvalidMapNameError
    return clean


def create_map(name: str, stream: BinaryIO) -> MapEntry:
    """Store an uploaded image and add its catalog entry (research Decision 4).

    The entry is only committed once the image has been fully received, sized,
    and identified, so a refused upload can never leave a listed-but-unopenable
    map behind.
    """
    clean_name = _validate_name(name)
    stored = storage.store_upload(
        images_dir(), stream, get_settings().max_map_image_bytes
    )
    entry = MapEntry(
        id=uuid.uuid4().hex,
        name=clean_name,
        image_filename=stored.filename,
        content_type=stored.content_type,
        created_at=storage.utc_now_iso(),
    )
    with storage.write_lock:
        _write_index([*_load_index(), entry])
    return entry


def delete_map(map_id: str) -> None:
    """Permanently remove a map, its image, and its annotations (FR-012, FR-044).

    The index is rewritten before the files are unlinked, so a failure to remove
    them still leaves the map unreachable — which is what FR-012 requires.
    """
    # Imported here rather than at module scope because `annotations` imports
    # this module to validate a text link's target map.
    from . import annotations

    with storage.write_lock:
        entries = _load_index()
        remaining = [entry for entry in entries if entry.id != map_id]
        if len(remaining) == len(entries):
            raise MapNotFoundError
        removed = next(entry for entry in entries if entry.id == map_id)
        _write_index(remaining)
        image_path(removed).unlink(missing_ok=True)
        # Already holding the (non-reentrant) write lock, so this must not take it.
        annotations.delete_map_annotations(map_id)


def ensure_seeded() -> None:
    """Seed the landing map into a brand-new catalog (research Decision 7).

    Guarded on the index file's absence, so an admin who deletes the seeded map
    does not get it back on the next restart.
    """
    with storage.write_lock:
        if index_path().exists():
            return
        images_dir().mkdir(parents=True, exist_ok=True)
        if not _SEED_ASSET.is_file():
            _write_index([])
            return
        map_id = uuid.uuid4().hex
        entry = MapEntry(
            id=map_id,
            name=_SEED_NAME,
            image_filename=f"{map_id}.webp",
            content_type=_SEED_CONTENT_TYPE,
            created_at=storage.utc_now_iso(),
        )
        shutil.copyfile(_SEED_ASSET, image_path(entry))
        _write_index([entry])
