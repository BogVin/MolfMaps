"""Map catalog endpoints (research Decision 6).

Listing and opening maps is public; creating and deleting requires a valid admin
session, enforced by `require_admin` rather than by hiding controls in the UI.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from .. import catalog
from ..dependencies import MAP_NOT_FOUND_MESSAGE, require_admin, require_map
from ..models import ErrorResponse, MapListResponse, MapSummary, MessageResponse

router = APIRouter(prefix="/api/maps", tags=["maps"])


def _to_summary(entry: catalog.MapEntry) -> MapSummary:
    """Project a stored entry onto the API shape; on-disk layout stays private."""
    return MapSummary(
        id=entry.id,
        name=entry.name,
        image_url=f"/api/maps/{entry.id}/image",
    )


@router.get("", response_model=MapListResponse)
def list_maps() -> MapListResponse:
    """Every catalog map, oldest first. Public — no session required (FR-001)."""
    return MapListResponse(maps=[_to_summary(entry) for entry in catalog.list_maps()])


@router.get(
    "/{map_id}",
    response_model=MapSummary,
    responses={404: {"model": ErrorResponse, "description": "No map with this id exists."}},
)
def get_map(map_id: str) -> MapSummary:
    """One map's metadata. Public, so deep links work without a session (FR-004)."""
    return _to_summary(require_map(map_id))


@router.get(
    "/{map_id}/image",
    responses={
        200: {
            "content": {
                "image/webp": {},
                "image/png": {},
                "image/jpeg": {},
                "image/gif": {},
            },
            "description": "The map image.",
        },
        404: {"model": ErrorResponse, "description": "Map or image unavailable."},
    },
)
def get_map_image(map_id: str) -> FileResponse:
    """Stream the stored image; a missing file is a 404 the UI renders as a fallback."""
    entry = require_map(map_id)
    path = catalog.image_path(entry)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=MAP_NOT_FOUND_MESSAGE
        )
    return FileResponse(str(path), media_type=entry.content_type)


@router.post(
    "",
    response_model=MapSummary,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    responses={
        400: {"model": ErrorResponse, "description": "Empty, corrupt, or unsupported image."},
        401: {"model": ErrorResponse, "description": "No valid admin session."},
        413: {"model": ErrorResponse, "description": "Image exceeds the size limit."},
        422: {"model": ErrorResponse, "description": "Missing or invalid name."},
    },
)
def create_map(
    name: str = Form(...),
    image: UploadFile = File(...),
) -> MapSummary:
    """Add a map from a display name and an image file. Admin only (FR-008)."""
    try:
        entry = catalog.create_map(name, image.file)
    except catalog.InvalidMapNameError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Provide a display name of 1-{catalog.MAX_NAME_LENGTH} characters.",
        ) from None
    except catalog.ImageTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="That image is too large.",
        ) from None
    except catalog.UnsupportedImageError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a WebP, PNG, JPEG, or GIF image.",
        ) from None
    return _to_summary(entry)


@router.delete(
    "/{map_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_admin)],
    responses={
        401: {"model": ErrorResponse, "description": "No valid admin session."},
        404: {"model": ErrorResponse, "description": "No map with this id exists."},
    },
)
def delete_map(map_id: str) -> MessageResponse:
    """Permanently remove a map. Admin only; the confirmation step is a UI concern."""
    try:
        catalog.delete_map(map_id)
    except catalog.MapNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=MAP_NOT_FOUND_MESSAGE
        ) from None
    return MessageResponse(detail="Map deleted.")
