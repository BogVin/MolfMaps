"""FastAPI application entry point.

Wires the typed REST API (map asset + auth/session). Optionally serves the
Angular production build for a single-origin run. Business logic
(auth/session/asset) stays in the backend; the frontend is presentation-only
(Principle III). The Angular app is the sole active frontend delivery path.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

from .config import get_settings
from .routes import assets, auth

logger = logging.getLogger("molfmaps")

# Angular `ng build` output (application builder → dist/frontend/browser).
_FRONTEND_DIST = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "dist"
    / "frontend"
    / "browser"
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Surface missing credentials to the operator only (never to end users).
    if not get_settings().is_configured():
        logger.warning(
            "MolfMaps admin credentials are not fully configured "
            "(ADMIN_USERNAME / ADMIN_PASSWORD / SESSION_SECRET). "
            "All login attempts will be refused until they are set in backend/.env."
        )
    yield


app = FastAPI(title="MolfMaps API", version="0.1.0", lifespan=lifespan)

app.include_router(assets.router)
app.include_router(auth.router)


# Optional single-origin mode: serve the Angular production build at `/` so
# deep links (/login) fall back to index.html. /api/* routes take precedence.
if _FRONTEND_DIST.is_dir():

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        dist = _FRONTEND_DIST.resolve()
        candidate = (dist / full_path).resolve()
        if candidate.is_file() and str(candidate).startswith(str(dist)):
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")
