# Phase 1 Data Model: Text Mark Styling & Region Links

**Feature**: `005-text-mark-styling` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This model **extends** [`004-map-zoom-annotations/data-model.md`](../004-map-zoom-annotations/data-model.md).
`Map`, `Admin Session`, `Point-of-Interest Image`, zoom/pan view state, storage
layout, cascade-on-map-delete, and POI fields are unchanged except where noted.
Points of interest still have no color, typeface, or region appearance (FR-012).

---

## Entity: Annotation (extended)

Still one object in `{MAPS_DATA_DIR}/annotations/{map_id}.json`. Discriminator
`kind` is now `"text_link" | "poi" | "region_link"` (research Decision 6).
`kind` remains immutable after create.

### Common stored fields

Unchanged: `id`, `kind`, `x`, `y`, `created_at`, `updated_at`.

For **text_link** and **poi**, `x`/`y` remain the **centre** of the marker
(rendered with `translate(-50%, -50%)`). For **region_link**, `x`/`y` are the
**top-left** of the rectangle (research Decision 4).

---

## Variant: Text Link (extended)

Existing fields (`text`, `target_map_id`, `text_scale`, API-only
`target_available`) are unchanged. Added:

| Field | Type | Required on disk | Description |
|---|---|---|---|
| `color` | string | no (legacy) | Label text color, `#rrggbb`. Default `#f5f7fa`. |
| `typeface` | `"sans"` \| `"serif"` \| `"condensed"` | no (legacy) | Offered set. Default `sans`. |

**API projection**: `color` and `typeface` are **always present** on read.
Missing or unknown stored values become the defaults (research Decision 7,
FR-008). Create that omits them **stores** the defaults so new records are
complete.

`text_scale` bounds stay `[0.01, 0.10]`, default `0.03`, **clamped**.

---

## Variant: Point of Interest

Unchanged from `004`. Create/update payloads that include `color`, `typeface`,
`width`, `height`, `rest`, or `hover` are **rejected** (`422` kind mismatch).

---

## Variant: Region Link (`kind = "region_link"`)

A rectangular hotspot that opens another map. No displayed label (spec).

| Field | Type | Required | Description |
|---|---|---|---|
| `target_map_id` | string | yes | Catalog map id; required at write; self-reference allowed |
| `width` | float | yes | Fraction of image width, clamped then fitted on-map |
| `height` | float | yes | Fraction of image height, same rules |
| `rest` | RegionAppearance | yes | Fill when the pointer is not over the region |
| `hover` | RegionAppearance | yes | Fill while hovered / while pressed on touch |

**API-only**: `target_available` (same computation as text links).

Create may omit `width`/`height`/`rest`/`hover`; server stores defaults
(Decision 3–4).

---

## Entity: Region Appearance

| Field | Type | Bounds | Notes |
|---|---|---|---|
| `color` | `#rrggbb` | pattern `^#[0-9a-f]{6}$` | Invalid → `422` |
| `opacity` | float | `[0, 1]`, **clamped** | `0` = fully clear; `1` = fully solid |
| `brightness` | float | `[0.25, 2.0]`, **clamped** | CSS `filter: brightness()`; `1` = unchanged |

Defaults:

| State | color | opacity | brightness |
|---|---|---|---|
| rest | `#4f9dff` | `0` | `1.0` |
| hover | `#4f9dff` | `0.4` | `1.0` |

Rest and hover are independent; changing one MUST NOT rewrite the other
(FR-032).

---

## Entity: Typeface Choice

Product-defined token, not an uploaded file. Mapping to CSS is frontend-only
(research Decision 1). Persistence stores the token.

---

## Entity: Placement Mode (client only, extended)

Four-valued signal; mutual exclusion is structural (FR-016, SC-013).

| Value | Meaning |
|---|---|
| `'off'` | Initial on every map view. Clicks/drags do not author. |
| `'label'` | Click plants a text link (existing). |
| `'poi'` | Click plants a point of interest (existing). |
| `'region'` | Click plants a default rectangle (research Decision 5). |

Still hidden without a session; never persisted; stays on after save/cancel;
`401` on write returns the view to plain viewing.

---

## Validation rules (additions / changes)

| Rule | Source | Failure behavior |
|---|---|---|
| `kind` ∈ three known values | Decision 6 | `422` |
| Text `color` matches `#rrggbb` | FR-009 | `422` — nothing saved |
| Text `typeface` ∈ `{sans, serif, condensed}` | FR-009 | `422` |
| Missing text color/typeface on **create** | FR-007 | Store defaults |
| Missing text color/typeface on **read** | FR-008 | Project defaults |
| Region `target_map_id` present and exists at write | FR-017 | `422` — nothing saved |
| Region `width`/`height` out of `[MIN, MAX]` | FR-020 | **Clamped** |
| Region would extend past the image | FR-020 | **Shift/shrink** onto the image |
| Appearance `opacity`/`brightness` out of range | FR-033 | **Clamped** |
| Invalid appearance `color` | FR-033 | `422` |
| Style or region fields on the wrong kind | FR-012 | `422` |
| Image attach to `region_link` | Kind mismatch | `409` |
| Admin session on every write | FR-010, FR-029 | `401` — map unchanged |
| Cancel in UI | FR-013 | No request; store unchanged |

`text_scale`, region size, opacity, and brightness clamp because the spec
describes those controls stopping at a limit. Colors and typeface tokens have
no “nearest valid” besides the allowlist, so they reject.

---

## Lifecycle

```text
(absent) --POST (admin, valid text_link | poi | region_link)--> Present
Present  --PATCH (admin: style, geometry, target, appearance)--> Present
Present  --DELETE (admin, UI-confirmed)--> (removed, permanent)
Present  --DELETE map--> (removed with the map)
```

Same as `004`: no drafts on disk; last write wins; no undo. PATCH remains the
single path for restyle, resize, and reposition.

Target-map deletion still **does not** cascade: region links and text links
report `target_available: false` and activation shows the existing unavailable
message (FR-028).

---

## Relationships

```text
Map --owns 0..N--> Annotation
Annotation --is one of--> Text Link | Point of Interest | Region Link
Text Link  --has--> color, typeface, text_scale
Text Link  --references--> Map
Region Link --has--> width, height, rest, hover
Region Link --references--> Map
Point of Interest --unchanged-->
```

---

## Shared constants (new)

Centralise in `backend/app/config.py` (and mirror numeric bounds in the
frontend slider/clamp helpers):

| Constant | Value |
|---|---|
| `DEFAULT_TEXT_COLOR` | `#f5f7fa` |
| `DEFAULT_TYPEFACE` | `sans` |
| `TYPEFACES` | `sans`, `serif`, `condensed` |
| `COLOR_PATTERN` | `^#[0-9a-f]{6}$` |
| `MIN_REGION_SIZE` / `MAX_REGION_SIZE` | `0.04` / `1.0` |
| `DEFAULT_REGION_WIDTH` / `DEFAULT_REGION_HEIGHT` | `0.16` / `0.10` |
| `MIN_OPACITY` / `MAX_OPACITY` | `0.0` / `1.0` |
| `MIN_BRIGHTNESS` / `MAX_BRIGHTNESS` | `0.25` / `2.0` |
| `DEFAULT_REST_APPEARANCE` | color `#4f9dff`, opacity `0`, brightness `1` |
| `DEFAULT_HOVER_APPEARANCE` | color `#4f9dff`, opacity `0.4`, brightness `1` |

Existing `004` constants (`MIN_TEXT_SCALE`, `DEFAULT_TEXT_SCALE`, text length
caps, zoom bounds) are reused unchanged.

## New configuration

None. No new env vars. `MAX_POI_IMAGES` and `MAPS_DATA_DIR` keep `004` meanings.
