"""Map annotation endpoints (research Decisions 7-8).

Annotations are nested under their owning map, mirroring the existing
`/api/maps/{id}/image` sub-resource, so the handler can 404 an unknown map before
touching any annotation. Listing is public — following a text link or opening a
popup never requires a session (FR-048) — while every write declares the existing
`require_admin` dependency, which is what actually enforces FR-045 and FR-046.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from .. import annotations, catalog, storage
from ..dependencies import require_admin, require_map
from ..models import (
    Annotation,
    AnnotationCreateRequest,
    AnnotationListResponse,
    AnnotationUpdateRequest,
    ErrorResponse,
    MessageResponse,
    PoiAnnotation,
    PoiImage,
    TextLinkAnnotation,
)

router = APIRouter(prefix="/api/maps", tags=["annotations"])

_UNKNOWN_TARGET_MESSAGE = "Choose a target map that still exists."
_ANNOTATION_NOT_FOUND_MESSAGE = "This annotation is no longer available."
_IMAGE_NOT_FOUND_MESSAGE = "This image is no longer available."
_NOT_A_POI_MESSAGE = "Only a point of interest can carry images."

_AUTH_RESPONSES: dict[int | str, dict[str, object]] = {
    401: {"model": ErrorResponse, "description": "No valid admin session."},
    404: {"model": ErrorResponse, "description": "No map with this id exists."},
}

_ANNOTATION_RESPONSES: dict[int | str, dict[str, object]] = {
    401: {"model": ErrorResponse, "description": "No valid admin session."},
    404: {
        "model": ErrorResponse,
        "description": "No such map, or no such annotation on this map.",
    },
}


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def _unprocessable(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
    )


def _image_url(map_id: str, annotation_id: str, image_id: str) -> str:
    return f"/api/maps/{map_id}/annotations/{annotation_id}/images/{image_id}"


def _to_api(
    map_id: str, record: annotations.Record, known_map_ids: set[str]
) -> TextLinkAnnotation | PoiAnnotation:
    """Project a stored record onto its API variant; disk layout stays private."""
    if record["kind"] == "text_link":
        return TextLinkAnnotation(
            id=record["id"],
            kind="text_link",
            map_id=map_id,
            x=record["x"],
            y=record["y"],
            created_at=record["created_at"],
            updated_at=record["updated_at"],
            text=record["text"],
            target_map_id=record["target_map_id"],
            text_scale=record["text_scale"],
            # Resolved from the catalog the handler has already loaded, so the
            # frontend needs no lookup per label (research Decision 8).
            target_available=record["target_map_id"] in known_map_ids,
        )
    return PoiAnnotation(
        id=record["id"],
        kind="poi",
        map_id=map_id,
        x=record["x"],
        y=record["y"],
        created_at=record["created_at"],
        updated_at=record["updated_at"],
        text=record["text"],
        images=[
            PoiImage(
                id=image["id"],
                image_url=_image_url(map_id, record["id"], image["id"]),
            )
            for image in record.get("images", [])
        ],
    )


def _known_map_ids() -> set[str]:
    return {entry.id for entry in catalog.list_maps()}


@router.get(
    "/{map_id}/annotations",
    response_model=AnnotationListResponse,
    responses={404: {"model": ErrorResponse, "description": "No map with this id exists."}},
)
def list_annotations(map_id: str) -> AnnotationListResponse:
    """Every annotation on the map, oldest first. Public (FR-028, FR-048)."""
    require_map(map_id)
    known = _known_map_ids()
    return AnnotationListResponse(
        annotations=[
            _to_api(map_id, record, known)
            for record in annotations.list_annotations(map_id)
        ]
    )


@router.post(
    "/{map_id}/annotations",
    response_model=Annotation,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    responses={
        **_AUTH_RESPONSES,
        422: {
            "model": ErrorResponse,
            "description": "Invalid payload, or a target map that does not exist.",
        },
    },
)
def create_annotation(
    map_id: str, payload: AnnotationCreateRequest
) -> TextLinkAnnotation | PoiAnnotation:
    """Place a text link or a point of interest on the map. Admin only (FR-045)."""
    require_map(map_id)
    try:
        record = annotations.create_annotation(map_id, payload)
    except annotations.UnknownTargetMapError:
        raise _unprocessable(_UNKNOWN_TARGET_MESSAGE) from None
    return _to_api(map_id, record, _known_map_ids())


@router.patch(
    "/{map_id}/annotations/{annotation_id}",
    response_model=Annotation,
    dependencies=[Depends(require_admin)],
    responses={
        **_ANNOTATION_RESPONSES,
        422: {
            "model": ErrorResponse,
            "description": "Invalid change, or a field of the other kind.",
        },
    },
)
def update_annotation(
    map_id: str, annotation_id: str, changes: AnnotationUpdateRequest
) -> TextLinkAnnotation | PoiAnnotation:
    """Edit, resize, or reposition one annotation. Admin only (FR-039, FR-040)."""
    require_map(map_id)
    try:
        record = annotations.update_annotation(map_id, annotation_id, changes)
    except annotations.AnnotationNotFoundError:
        raise _not_found(_ANNOTATION_NOT_FOUND_MESSAGE) from None
    except annotations.UnknownTargetMapError:
        raise _unprocessable(_UNKNOWN_TARGET_MESSAGE) from None
    except annotations.InvalidUpdateError as error:
        raise _unprocessable(str(error)) from None
    return _to_api(map_id, record, _known_map_ids())


@router.delete(
    "/{map_id}/annotations/{annotation_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_admin)],
    responses=_ANNOTATION_RESPONSES,
)
def delete_annotation(map_id: str, annotation_id: str) -> MessageResponse:
    """Permanently remove one annotation. Admin only; confirming is a UI concern."""
    require_map(map_id)
    try:
        annotations.delete_annotation(map_id, annotation_id)
    except annotations.AnnotationNotFoundError:
        raise _not_found(_ANNOTATION_NOT_FOUND_MESSAGE) from None
    return MessageResponse(detail="Annotation deleted.")


# --- Point-of-interest images ------------------------------------------------


@router.post(
    "/{map_id}/annotations/{annotation_id}/images",
    response_model=PoiImage,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
    responses={
        **_ANNOTATION_RESPONSES,
        400: {"model": ErrorResponse, "description": "Empty, corrupt, or unsupported image."},
        409: {
            "model": ErrorResponse,
            "description": "Not a point of interest, or its image limit is reached.",
        },
        413: {"model": ErrorResponse, "description": "Image exceeds the size limit."},
    },
)
def add_annotation_image(
    map_id: str, annotation_id: str, image: UploadFile = File(...)
) -> PoiImage:
    """Attach one image to a point of interest. Admin only (FR-032, FR-045)."""
    require_map(map_id)
    try:
        record = annotations.add_image(map_id, annotation_id, image.file)
    except annotations.AnnotationNotFoundError:
        raise _not_found(_ANNOTATION_NOT_FOUND_MESSAGE) from None
    except annotations.KindMismatchError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_NOT_A_POI_MESSAGE
        ) from None
    except annotations.ImageLimitReachedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This point of interest already has the maximum number of images.",
        ) from None
    except storage.ImageTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="That image is too large.",
        ) from None
    except storage.UnsupportedImageError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a WebP, PNG, JPEG, or GIF image.",
        ) from None
    return PoiImage(
        id=record["id"], image_url=_image_url(map_id, annotation_id, record["id"])
    )


@router.get(
    "/{map_id}/annotations/{annotation_id}/images/{image_id}",
    responses={
        200: {
            "content": {
                "image/webp": {},
                "image/png": {},
                "image/jpeg": {},
                "image/gif": {},
            },
            "description": "The point-of-interest image.",
        },
        404: {
            "model": ErrorResponse,
            "description": "Map, annotation, or image unavailable.",
        },
    },
)
def get_annotation_image(map_id: str, annotation_id: str, image_id: str) -> FileResponse:
    """Stream a popup image. Public, so logged-out visitors see popups (FR-048)."""
    require_map(map_id)
    try:
        path, content_type = annotations.image_file(map_id, annotation_id, image_id)
    except (annotations.AnnotationNotFoundError, annotations.ImageNotFoundError):
        raise _not_found(_IMAGE_NOT_FOUND_MESSAGE) from None
    return FileResponse(str(path), media_type=content_type)


@router.delete(
    "/{map_id}/annotations/{annotation_id}/images/{image_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_admin)],
    responses={
        **_ANNOTATION_RESPONSES,
        409: {"model": ErrorResponse, "description": "Not a point of interest."},
    },
)
def delete_annotation_image(
    map_id: str, annotation_id: str, image_id: str
) -> MessageResponse:
    """Detach an image and unlink its file. Admin only (FR-039, FR-045)."""
    require_map(map_id)
    try:
        annotations.remove_image(map_id, annotation_id, image_id)
    except annotations.AnnotationNotFoundError:
        raise _not_found(_ANNOTATION_NOT_FOUND_MESSAGE) from None
    except annotations.ImageNotFoundError:
        raise _not_found(_IMAGE_NOT_FOUND_MESSAGE) from None
    except annotations.KindMismatchError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_NOT_A_POI_MESSAGE
        ) from None
    return MessageResponse(detail="Image removed.")
