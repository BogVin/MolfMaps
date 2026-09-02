# Implementation Plan: Text Mark Styling & Region Links

**Branch**: `005-text-mark-styling` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-text-mark-styling/spec.md`

## Summary

Extend the existing map-annotation feature so text links carry author-chosen
**color** and **typeface** (alongside the size already shipped in `004`), and so
authors can place a third annotation kind: an axis-aligned **region link** —
a rectangle that navigates to another map, invisible at rest by default, with
independent rest and hover fill (color, opacity, brightness). Persistence stays
on the same per-map JSON sidecar and the same nested REST collection; the
discriminated union on `kind` gains `region_link`. No new routes, no new
dependencies, and no change to the `001`/`002`/`003` auth or catalog contracts.
The Angular map view adds styling controls and a third mutually exclusive
placement toggle; region geometry and text styling stay map-relative so zoom
and pan do not change look or alignment.

## Technical Context

**Language/Version**: Python 3.11 (backend, unchanged from `004`); TypeScript
~6.0 targeting Angular 22 (frontend, unchanged from `004`).

**Primary Dependencies**: Backend — FastAPI 0.115.6, Uvicorn 0.34.0,
Pydantic 2.10.4, pydantic-settings 2.7.1, itsdangerous 2.2.0,
python-multipart 0.0.20. Frontend — Angular 22 standalone components, Angular
Router, `HttpClient`, `FormsModule`. **No new dependency on either side**
(research Decisions 1, 2, 4): typefaces are a small system-font stack; color
uses native `<input type="color">`; region hover is CSS `:hover` / `:active`
plus inline fill styles.

**Storage**: Filesystem, same store as `004` — `MAPS_DATA_DIR/annotations/{map_id}.json`.
No new sidecar, no database. Text-link records gain optional-on-disk
`color` and `typeface` (defaults applied at read for older marks). Region-link
records are a new `kind` in the same `annotations` array. Atomic write +
in-process lock unchanged.

**Testing**: `pytest` — extend `backend/tests/test_annotations.py` for styling
validation, defaults for legacy records, region CRUD, geometry clamping,
appearance clamping, kind-mismatch, and the existing auth boundary. Frontend
Vitest — extend `map-view.spec.ts` for the third placement mode and
mutual exclusion; add focused tests for typeface/color defaults and region
geometry clamping helpers. Existing `004` tests must stay green.

**Target Platform**: Modern desktop and mobile browsers with Pointer Events;
local dev on Linux/macOS with the existing Python `venv` and Node.js LTS.

**Performance Goals**: Style and size preview remains a local signal update
(SC-010: visible within 1 s; typically a frame). Hover/rest switch is CSS, so
pointer enter/leave is immediate (SC-012). A map with mixed styled labels and
regions stays inside the `004` “50 annotations without stutter” budget because
regions are additional absolutely positioned elements inside the same CSS
transform.

**Constraints**: Writes still require `require_admin`; unauthenticated styling
or region authoring is refused server-side (FR-010, FR-029, SC-005). Positions
and region size are fractions of the map image, never screen pixels (FR-019).
Text size bounds from `004` are unchanged (FR-003). Invalid colors/typefaces
are rejected; out-of-range size, opacity, brightness, and region geometry are
**clamped** (FR-009, FR-020, FR-033). At most one placement mode, starting
`off` on every view, including the new region mode (FR-016, SC-013). Points of
interest are unchanged aside from sharing placement exclusivity (FR-012).
`001`/`002`/`003` HTTP contracts stay unchanged; `004` endpoints keep the same
paths and add fields/kinds rather than new URLs.

**Scale/Scope**: Same 7 annotation endpoints, extended union; 1 new Pydantic
variant plus a small appearance model; no new Angular route or feature folder;
typeface catalog of 3 tokens; region rectangles only. Designed-for bound
remains ~50 annotations per map.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First (YAGNI) | PASS | **No new libraries.** System font stacks instead of webfont packages or `@font-face` files; native color input instead of a picker kit; CSS hover/active instead of a gesture library; region placement reuses the existing click-vs-pan threshold plus size sliders instead of a rubber-band tool that would fight pan (research Decision 5). No new sidecar, route, or service. Rejected alternatives (Google Fonts, Konva/SVG drawing, a fourth storage file) are recorded in [research.md](./research.md). |
| II. Clear API Contracts | PASS | The annotation union stays a Pydantic discriminated union on `kind`, now with three variants. New fields are typed (`color` hex, `typeface` literal, nested `RegionAppearance`). OpenAPI is updated in this feature’s `contracts/`. No untyped dicts cross the boundary. Legacy text links without stored style are projected with documented defaults so the response schema stays required and complete. |
| III. Frontend/Backend Separation | PASS | Validation, defaults, clamping, target-map checks, and authorization stay in the backend. The frontend owns preview, placement mode, hover CSS, and the authoring outline for invisible regions. Communication remains HTTP `/api/*` only. |
| IV. Reproducible Environments | PASS | `requirements.txt` and `package.json` are unchanged. New constants live in `config.py` with working defaults; no new env vars required for a fresh clone. |
| V. Pragmatic Testing | PASS | Cover the silently-breaking paths: auth on style/region writes, invalid color/typeface, legacy default projection, region geometry clamping, rest opacity 0 still hittable, kind-mismatch (style fields on POI/region). Visual hover polish is in [quickstart.md](./quickstart.md), not a new E2E toolchain. |

**Result**: PASS — proceed to Phase 0. Complexity Tracking remains empty.

**Post-Phase 1 re-check**: PASS — design adds no database, no repository layer,
no webfont CDN, no new routes, and no dependencies. Contracts stay fully typed.
Auth remains the existing `require_admin` on every write. Legacy marks are
handled at projection time rather than a one-shot migration job.

## Project Structure

### Documentation (this feature)

```text
specs/005-text-mark-styling/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output — extended annotation union
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── config.py           # + typeface tokens, default color, region size/appearance bounds
│   ├── models.py           # + text color/typeface; RegionLinkAnnotation; appearance model
│   ├── annotations.py      # + style fields, region create/update, clamps, read-time defaults
│   └── routes/annotations.py  # + project region_link; default color/typeface on text_link read
├── tests/
│   └── test_annotations.py # + styling, legacy defaults, region lifecycle
└── data/annotations/       # same sidecar layout; new kind and fields inside the array

frontend/
└── src/app/
    ├── core/
    │   ├── api.types.ts          # + color, typeface, RegionLinkAnnotation, appearance
    │   └── api.service.ts        # unchanged URLs; payloads gain fields
    └── maps/
        ├── map-view.ts/.html     # + region placement toggle; preview includes style/geometry
        ├── map-view.spec.ts      # + third mode, mutual exclusion
        ├── annotation-layer.ts/.html  # + color/font on labels; region rects; author outline
        ├── annotation-editor.ts/.html # + color, typeface; region size + rest/hover controls
        └── (existing zoom-pan, poi-popup, maps list — unchanged except types)
```

**Structure Decision**: Keep the two-tree web-app split and the `004` module
boundaries. Styling and regions are more fields and one more union member on
the annotation already owned by `annotations.py` and the map-view folder — not
a new feature tree.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. No new runtime dependency, service, or architectural layer.
Rejected heavier alternatives are in [research.md](./research.md).
