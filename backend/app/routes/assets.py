"""Public map endpoints for the landing image and maps catalog."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from ..models import ErrorResponse, MapSummary, MapsListResponse

router = APIRouter(prefix="/api", tags=["assets"])

MAP_ASSET_PATH = Path(__file__).resolve().parent.parent.parent / "assets" / "kal_main_map.webp"


@router.get("/maps", response_model=MapsListResponse)
def get_maps() -> MapsListResponse:
    """List every map asset currently available to public visitors."""
    maps = []
    if MAP_ASSET_PATH.is_file():
        maps.append(
            MapSummary(
                id="kal-main",
                title="Main map of Kal",
                image_url="/api/map",
            )
        )
    return MapsListResponse(maps=maps)


@router.get(
    "/map",
    responses={
        200: {"content": {"image/webp": {}}, "description": "The map image."},
        404: {"model": ErrorResponse, "description": "Map asset unavailable."},
    },
)
def get_map():
    """Return the main map asset, or a 404 the frontend renders as a placeholder."""
    if not MAP_ASSET_PATH.is_file():
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(detail="Map image is currently unavailable.").model_dump(),
        )
    return FileResponse(str(MAP_ASSET_PATH), media_type="image/webp")
