"""Auth & session endpoints (FR-005..FR-011, research Decisions 2/3)."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from ..config import SESSION_COOKIE_NAME, get_settings
from ..models import (
    ErrorResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    SessionResponse,
)
from ..security import clear_session, issue_session, verify_session

router = APIRouter(prefix="/api", tags=["auth"])

# Single generic message for every failed login — never reveals which field was
# wrong, whether the user exists, or that credentials are unconfigured (FR-006).
_GENERIC_LOGIN_ERROR = "Invalid username or password."


def _credentials_match(payload: LoginRequest, settings) -> bool:
    """Constant-time comparison of both fields (research Decision 3)."""
    if not settings.is_configured():
        # Still burn a comparison to avoid leaking config state via timing.
        hmac.compare_digest(payload.username, payload.username)
        hmac.compare_digest(payload.password, payload.password)
        return False
    user_ok = hmac.compare_digest(payload.username, settings.admin_username)
    pw_ok = hmac.compare_digest(payload.password, settings.admin_password)
    return user_ok and pw_ok


@router.post(
    "/login",
    responses={
        200: {"model": LoginResponse},
        401: {"model": ErrorResponse},
    },
)
def login(payload: LoginRequest, response: Response):
    settings = get_settings()
    if not _credentials_match(payload, settings):
        return JSONResponse(
            status_code=401,
            content=ErrorResponse(detail=_GENERIC_LOGIN_ERROR).model_dump(),
        )
    issue_session(response, settings)
    return LoginResponse(authenticated=True)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response):
    clear_session(response)
    return MessageResponse(detail="Logged out.")


@router.get("/session", response_model=SessionResponse)
def session_status(request: Request):
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    authenticated = verify_session(cookie, get_settings())
    return SessionResponse(authenticated=authenticated)
