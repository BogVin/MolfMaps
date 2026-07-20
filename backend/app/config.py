"""Typed application settings loaded from the environment / `.env`.

Credentials are intentionally optional at load time so a missing configuration
never crashes the app. When any credential is absent the app is "unconfigured"
and every login is refused (FR-011).
"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Session lifetime: 8 hours (in seconds).
SESSION_MAX_AGE: int = 8 * 60 * 60

# Name of the signed session cookie.
SESSION_COOKIE_NAME: str = "session"

# Tests set MOLFMAPS_DISABLE_DOTENV=1 so a developer's local backend/.env cannot
# leak real configuration into the test environment.
_ENV_FILE: str | Path | None = (
    None
    if os.getenv("MOLFMAPS_DISABLE_DOTENV") == "1"
    else Path(__file__).resolve().parent.parent / ".env"
)


class Settings(BaseSettings):
    """Operator-supplied configuration (FR-005, FR-010, FR-011)."""

    admin_username: str | None = None
    admin_password: str | None = None
    session_secret: str | None = None

    # Cookie `Secure` flag — enable in production (HTTPS).
    session_cookie_secure: bool = False

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def is_configured(self) -> bool:
        """True only when all three credentials/secret are present and non-empty."""
        return bool(self.admin_username and self.admin_password and self.session_secret)


def get_settings() -> Settings:
    """Return a fresh Settings instance (re-reads env each call for testability)."""
    return Settings()
