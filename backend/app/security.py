"""Signed-cookie session helpers (data-model "Admin Session", research Decision 1).

The session is a signed, HTTP-only cookie carrying an issued-at timestamp. There
is no server-side store: a request is authenticated iff the cookie's signature is
valid AND it has not exceeded `SESSION_MAX_AGE`.
"""

from __future__ import annotations

import time

from fastapi import Response
from itsdangerous import BadSignature, URLSafeSerializer

from .config import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    Settings,
)

_SALT = "molfmaps-session"


def _serializer(settings: Settings) -> URLSafeSerializer:
    # Callers must ensure the app is configured before issuing/verifying.
    return URLSafeSerializer(settings.session_secret or "", salt=_SALT)


def issue_session(response: Response, settings: Settings) -> None:
    """Sign `{issued_at: now}` and set it as an HTTP-only cookie on `response`."""
    token = _serializer(settings).dumps({"issued_at": int(time.time())})
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


def verify_session(cookie: str | None, settings: Settings) -> bool:
    """Return True iff the cookie is a valid, unexpired session.

    An invalid signature, tampered payload, expired timestamp, missing cookie, or
    an unconfigured app all resolve to False (treated as logged out).
    """
    if not cookie or not settings.session_secret:
        return False
    try:
        data = _serializer(settings).loads(cookie)
    except BadSignature:
        return False
    issued_at = data.get("issued_at") if isinstance(data, dict) else None
    if not isinstance(issued_at, int):
        return False
    return (int(time.time()) - issued_at) <= SESSION_MAX_AGE


def clear_session(response: Response) -> None:
    """Delete the session cookie (logout, FR-009)."""
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
