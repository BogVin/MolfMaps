"""Shared route-layer concerns (research Decision 5).

Authorization is decided here rather than inline in each handler, so the write
endpoints cannot drift apart. Hiding controls in the frontend is presentation
only — this is the control that actually satisfies FR-014. Resolving the map named
in a path lives here too, so every router that nests under `/api/maps/{map_id}`
answers an unknown id identically.
"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from . import catalog
from .config import SESSION_COOKIE_NAME, get_settings
from .security import verify_session

# One generic message for every refusal — never reveals whether the cookie was
# absent, forged, or merely expired.
_UNAUTHORIZED_MESSAGE = "Authentication required."

# Stale links and never-existing ids are indistinguishable to the caller, which
# is both correct (FR-012) and avoids confirming which ids once existed.
MAP_NOT_FOUND_MESSAGE = "This map is no longer available."


def require_admin(request: Request) -> None:
    """Allow the request only when it carries a valid, unexpired admin session."""
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not verify_session(cookie, get_settings()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_UNAUTHORIZED_MESSAGE,
        )


def require_map(map_id: str) -> catalog.MapEntry:
    """The catalog entry for this path id, or a 404 before any nested work runs."""
    entry = catalog.get_map(map_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=MAP_NOT_FOUND_MESSAGE
        )
    return entry
