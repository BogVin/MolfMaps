"""Pydantic request/response models — the typed API contract (Principle II)."""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import (
    COLOR_PATTERN,
    MAX_BRIGHTNESS,
    MAX_LABEL_TEXT_LENGTH,
    MAX_OPACITY,
    MAX_POI_TEXT_LENGTH,
    MAX_REGION_SIZE,
    MAX_TEXT_SCALE,
    MIN_BRIGHTNESS,
    MIN_OPACITY,
    MIN_REGION_SIZE,
    MIN_TEXT_SCALE,
)


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


class MapSummary(BaseModel):
    """A catalog map as exposed by the API. On-disk layout is never revealed."""

    id: str
    name: str
    image_url: str


class MapListResponse(BaseModel):
    """Result of `GET /api/maps` — an object, never a bare array (FR-001)."""

    maps: list[MapSummary]


# --- Annotations (research Decision 6) ---------------------------------------
#
# The two annotation kinds are variants of one record, modelled as a Pydantic
# discriminated union on `kind`. Each variant therefore declares exactly the
# fields it needs, instead of one model of optional fields that could not stop a
# text link without a target or a point of interest carrying a text size.

# A position along one axis of the map image, never a screen pixel, so it stays
# correct at any viewport size and zoom level (FR-038).
Fraction = Annotated[float, Field(ge=0.0, le=1.0)]


class AnnotationBase(BaseModel):
    """Fields every annotation carries, whatever its kind."""

    id: str
    map_id: str
    x: Fraction
    y: Fraction
    created_at: str
    updated_at: str


class TextLinkAnnotation(AnnotationBase):
    """A clickable label that opens another map."""

    # Declared without a default so the generated schema marks the discriminator
    # required, which is what makes the union usable by a generated client.
    kind: Literal["text_link"]
    text: str = Field(min_length=1, max_length=MAX_LABEL_TEXT_LENGTH)
    target_map_id: str
    text_scale: float = Field(ge=MIN_TEXT_SCALE, le=MAX_TEXT_SCALE)
    color: str = Field(pattern=COLOR_PATTERN)
    typeface: Literal["sans", "serif", "condensed"]
    # Computed at read time, never stored: whether the target still exists, so
    # the UI can mark a stale link without a lookup per label (FR-030).
    target_available: bool


class PoiImage(BaseModel):
    """One popup image as exposed by the API; the on-disk name stays private."""

    id: str
    image_url: str


class PoiAnnotation(AnnotationBase):
    """A marker whose popup shows descriptive text and optional images."""

    kind: Literal["poi"]
    text: str = Field(min_length=1, max_length=MAX_POI_TEXT_LENGTH)
    # Always present, empty included, so a client never has to treat a popup
    # without images as a missing field.
    images: list[PoiImage]


class RegionAppearance(BaseModel):
    """A region fill in either its resting or interactive state."""

    model_config = ConfigDict(extra="forbid")

    color: str = Field(pattern=COLOR_PATTERN)
    opacity: float = Field(ge=MIN_OPACITY, le=MAX_OPACITY)
    brightness: float = Field(ge=MIN_BRIGHTNESS, le=MAX_BRIGHTNESS)

    @field_validator("opacity", mode="before")
    @classmethod
    def _clamp_opacity(cls, value: object) -> object:
        if isinstance(value, (int, float)):
            return min(max(float(value), MIN_OPACITY), MAX_OPACITY)
        return value

    @field_validator("brightness", mode="before")
    @classmethod
    def _clamp_brightness(cls, value: object) -> object:
        if isinstance(value, (int, float)):
            return min(max(float(value), MIN_BRIGHTNESS), MAX_BRIGHTNESS)
        return value


class RegionLinkAnnotation(AnnotationBase):
    """An axis-aligned, map-relative hotspot linking to another map."""

    kind: Literal["region_link"]
    target_map_id: str
    width: float = Field(ge=MIN_REGION_SIZE, le=MAX_REGION_SIZE)
    height: float = Field(ge=MIN_REGION_SIZE, le=MAX_REGION_SIZE)
    rest: RegionAppearance
    hover: RegionAppearance
    target_available: bool


Annotation = Annotated[
    Union[TextLinkAnnotation, PoiAnnotation, RegionLinkAnnotation],
    Field(discriminator="kind"),
]


class AnnotationListResponse(BaseModel):
    """Result of `GET /api/maps/{id}/annotations` — oldest first, never a bare array."""

    annotations: list[Annotation]


class _AnnotationRequest(BaseModel):
    """Shared request behavior: unknown fields refused, `text` trimmed first.

    Trimming before validation is what makes whitespace-only text a 422 and lets
    the length bounds apply to what will actually be stored.
    """

    model_config = ConfigDict(extra="forbid")

    @field_validator("text", mode="before", check_fields=False)
    @classmethod
    def _trim_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CreateTextLinkRequest(_AnnotationRequest):
    """Payload for creating a text link."""

    kind: Literal["text_link"]
    x: Fraction
    y: Fraction
    text: str = Field(min_length=1, max_length=MAX_LABEL_TEXT_LENGTH)
    target_map_id: str
    # Unbounded here on purpose: out-of-range sizes are clamped to the nearest
    # bound rather than refused, because FR-024 describes the size stopping at
    # its limit. Omitted means DEFAULT_TEXT_SCALE (FR-025).
    text_scale: float | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    typeface: Literal["sans", "serif", "condensed"] | None = None


class CreatePoiRequest(_AnnotationRequest):
    """Payload for creating a point of interest. Images are attached afterwards."""

    kind: Literal["poi"]
    x: Fraction
    y: Fraction
    text: str = Field(min_length=1, max_length=MAX_POI_TEXT_LENGTH)


class CreateRegionLinkRequest(_AnnotationRequest):
    """Payload for creating a rectangular map hotspot."""

    kind: Literal["region_link"]
    x: Fraction
    y: Fraction
    target_map_id: str
    width: float | None = None
    height: float | None = None
    rest: RegionAppearance | None = None
    hover: RegionAppearance | None = None


AnnotationCreateRequest = Annotated[
    Union[CreateTextLinkRequest, CreatePoiRequest, CreateRegionLinkRequest],
    Field(discriminator="kind"),
]


class AnnotationUpdateRequest(_AnnotationRequest):
    """Partial update covering edit, resize, and reposition.

    Every field is optional and omitted fields are left unchanged. `kind` is
    immutable, and a field belonging to the other kind is refused against the
    annotation's own kind by the persistence layer.
    """

    x: Fraction | None = None
    y: Fraction | None = None
    # The looser of the two caps; the kind-specific one is applied by the
    # persistence layer, which is where the annotation's own kind is known.
    text: str | None = Field(default=None, min_length=1, max_length=MAX_POI_TEXT_LENGTH)
    target_map_id: str | None = None
    text_scale: float | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    typeface: Literal["sans", "serif", "condensed"] | None = None
    width: float | None = None
    height: float | None = None
    rest: RegionAppearance | None = None
    hover: RegionAppearance | None = None
