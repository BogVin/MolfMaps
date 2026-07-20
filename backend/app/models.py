"""Pydantic request/response models — the typed API contract (Principle II)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login payload. Both fields required and non-empty (FR-007)."""

    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    """Success payload for `POST /api/login`. Never carries secrets."""

    authenticated: bool = True


class SessionResponse(BaseModel):
    """Result of `GET /api/session`."""

    authenticated: bool


class MessageResponse(BaseModel):
    """Generic success message, e.g. logout confirmation."""

    detail: str


class ErrorResponse(BaseModel):
    """Generic, non-revealing error (FR-006)."""

    detail: str
