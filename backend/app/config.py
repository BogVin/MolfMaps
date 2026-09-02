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

# Accepted map image formats, detected by sniffing the file's leading bytes.
# The client-declared Content-Type and filename are never trusted; the stored
# extension always comes from this table (research Decision 4).
ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/webp": "webp",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
}

# Annotation bounds, centralised so the models, the server-side clamping, and the
# frontend slider all reference one source (data-model.md -> Shared constants).
#
# A text link's `text_scale` is its font size as a fraction of the map image's
# width, which is what keeps a label proportional to the map at every zoom level
# (FR-027). Out-of-range values are clamped to the nearest bound rather than
# refused, because FR-024 describes the size stopping at its limit.
MIN_TEXT_SCALE: float = 0.01
MAX_TEXT_SCALE: float = 0.10
DEFAULT_TEXT_SCALE: float = 0.03
DEFAULT_TEXT_COLOR: str = "#f5f7fa"
DEFAULT_TYPEFACE: str = "sans"
TYPEFACES: tuple[str, ...] = ("sans", "serif", "condensed")
COLOR_PATTERN: str = r"^#[0-9a-f]{6}$"

MIN_REGION_SIZE: float = 0.04
MAX_REGION_SIZE: float = 1.0
DEFAULT_REGION_WIDTH: float = 0.16
DEFAULT_REGION_HEIGHT: float = 0.10
MIN_OPACITY: float = 0.0
MAX_OPACITY: float = 1.0
MIN_BRIGHTNESS: float = 0.25
MAX_BRIGHTNESS: float = 2.0
DEFAULT_REST_APPEARANCE: dict[str, float | str] = {
    "color": "#4f9dff",
    "opacity": 0.0,
    "brightness": 1.0,
}
DEFAULT_HOVER_APPEARANCE: dict[str, float | str] = {
    "color": "#4f9dff",
    "opacity": 0.4,
    "brightness": 1.0,
}

MAX_LABEL_TEXT_LENGTH: int = 120
MAX_POI_TEXT_LENGTH: int = 2000

# Default catalog store, resolved relative to the `backend/` package root so the
# app behaves the same regardless of the working directory it is launched from.
_DEFAULT_MAPS_DATA_DIR: Path = Path(__file__).resolve().parent.parent / "data"

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

    # Map catalog store — both have working defaults so a fresh clone runs
    # unconfigured (data-model.md → New configuration).
    maps_data_dir: Path = _DEFAULT_MAPS_DATA_DIR
    max_map_image_bytes: int = 10 * 1024 * 1024

    # Upper bound on images attached to one point of interest — the spec assumes
    # a small handful rather than an unlimited gallery.
    max_poi_images: int = 5

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
