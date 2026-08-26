"""Filesystem primitives shared by every JSON store (research Decision 5).

The atomic write sequence and the magic-byte image sniffing below are both
safety-critical, so they exist exactly once and are used by `catalog.py` and
`annotations.py` alike rather than being copy-pasted per store.
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO

from .config import ALLOWED_IMAGE_TYPES

# Longest run of leading bytes any signature below needs.
SNIFF_BYTES = 16
CHUNK_BYTES = 64 * 1024

# Serializes every mutation across all stores. The app runs as a single Uvicorn
# process, so a process-local lock is enough to stop two concurrent writes from
# reading the same document and silently dropping one another's change. Sharing
# one lock across stores also keeps "delete a map, then its annotations" free of
# interleaving. The lock is not reentrant: a helper called from inside a locked
# section must not reacquire it.
write_lock = threading.Lock()


class UnsupportedImageError(Exception):
    """The uploaded bytes are empty or are not an allowed image format."""


class ImageTooLargeError(Exception):
    """The upload exceeded the size limit and was aborted mid-stream."""


@dataclass(frozen=True)
class StoredFile:
    """An upload committed to disk, ready to be referenced by a record."""

    id: str
    filename: str
    content_type: str


def utc_now_iso() -> str:
    """Current UTC time as an ISO 8601 string — the format every record stores."""
    return datetime.now(timezone.utc).isoformat()


def detect_content_type(header: bytes) -> str | None:
    """Identify the format from the file's leading bytes, or None if unknown.

    The client's Content-Type and filename are deliberately not consulted: both
    are attacker-controlled, so a renamed executable must fail here.
    """
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return "image/gif"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


def read_json(path: Path) -> dict[str, Any] | None:
    """The parsed document, or None when the file has never been written."""
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    return json.loads(raw)


def write_json_atomic(path: Path, document: dict[str, Any]) -> None:
    """Commit a document atomically so a crash mid-write cannot truncate it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(f"{path.suffix}.tmp")
    with temp.open("w", encoding="utf-8") as handle:
        handle.write(json.dumps(document, indent=2))
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def store_upload(directory: Path, stream: BinaryIO, size_limit: int) -> StoredFile:
    """Validate an uploaded image and commit it under a server-generated name.

    Nothing is committed until the bytes have been fully received, sized, and
    identified, so a refused upload never leaves a record pointing at a missing
    or unusable file. The stored name derives from a fresh id and the *detected*
    type, never from the client-supplied filename, which makes path traversal
    structurally impossible.
    """
    directory.mkdir(parents=True, exist_ok=True)
    temp = directory / f".upload-{uuid.uuid4().hex}.part"
    try:
        received = 0
        with temp.open("wb") as handle:
            while chunk := stream.read(CHUNK_BYTES):
                received += len(chunk)
                # Abort as soon as the cap is passed rather than buffering the
                # whole oversized upload.
                if received > size_limit:
                    raise ImageTooLargeError
                handle.write(chunk)
        if received == 0:
            raise UnsupportedImageError

        with temp.open("rb") as handle:
            content_type = detect_content_type(handle.read(SNIFF_BYTES))
        if content_type is None:
            raise UnsupportedImageError

        file_id = uuid.uuid4().hex
        filename = f"{file_id}.{ALLOWED_IMAGE_TYPES[content_type]}"
        os.replace(temp, directory / filename)
        return StoredFile(id=file_id, filename=filename, content_type=content_type)
    finally:
        temp.unlink(missing_ok=True)
