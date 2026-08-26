# Implementation Plan: Map Zoom & Interactive Annotations

**Branch**: `004-map-zoom-annotations` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-map-zoom-annotations/spec.md`

## Summary

Layer zoom, pan, and two kinds of annotation onto the existing map view. The
Angular frontend gains a hand-rolled CSS-transform zoom/pan controller (no
mapping library), an annotation overlay rendered inside that transform, two
placement toggles shown only to an authenticated admin, and a point-of-interest
popup rendered outside the transform. The FastAPI backend gains one annotation
collection nested under each map — `GET/POST /api/maps/{id}/annotations`,
`PATCH/DELETE /api/maps/{id}/annotations/{aid}`, plus attach/detach/serve
endpoints for point-of-interest images — with reads public and every write
guarded by the existing `require_admin` session dependency. Annotations persist
as one JSON sidecar per map under the existing `MAPS_DATA_DIR`, and the
atomic-write and image-validation primitives currently private to `catalog.py`
are extracted into a shared `storage.py` so both modules use one copy. Positions
are stored as fractions of the map image and label sizes as a fraction of image
width, so annotations stay anchored and proportional through zoom, pan, resize,
and reload. The `003` catalog contract and the `001`/`002` auth contract are
unchanged.

## Technical Context

**Language/Version**: Python 3.11 (backend, unchanged toolchain from `001`);
TypeScript ~6.0 targeting Angular 22 (frontend, unchanged toolchain from `002`).

**Primary Dependencies**: Backend — FastAPI 0.115.6, Uvicorn 0.34.0,
Pydantic 2.10.4, pydantic-settings 2.7.1, itsdangerous 2.2.0,
python-multipart 0.0.20. Frontend — Angular 22 standalone components, Angular
Router, `HttpClient`, `FormsModule`. **No new dependency on either side**: zoom,
pan, pinch, and the annotation overlay are built from the Pointer Events API and
CSS transforms (research Decision 1), and point-of-interest images reuse the
existing multipart upload path.

**Storage**: Filesystem, extending the existing catalog store under
`MAPS_DATA_DIR` — `annotations/{map_id}.json` (one sidecar per map) and
`poi-images/{image_id}.{ext}` for image bytes. `maps.json` and `maps/` are
untouched. No database, no ORM. All writes go through the shared in-process lock
and atomic temp-file replace (research Decision 5).

**Testing**: `pytest` (backend) — new `backend/tests/test_annotations.py`
covering the authorization boundary, validation rules, and annotation lifecycle
including cascade on map delete. Existing `test_maps.py`, `test_auth.py`,
`test_map.py`, and `test_session.py` must stay green through the `storage.py`
extraction. Frontend — existing Vitest setup; unit tests for the pure zoom/pan
clamping arithmetic and the placement-mode signal, plus a component test that
placement toggles are absent without a session.

**Target Platform**: Modern desktop & mobile browsers with Pointer Events
support; local dev on Linux/macOS with a Python `venv` for the backend and
Node.js LTS for the Angular CLI.

**Performance Goals**: A zoom or drag action produces a visible response within
250 ms on a typical laptop and a typical mobile device (SC-002), achieved by
compositing one CSS transform rather than repositioning annotations
individually. A map carrying at least 50 annotations opens and stays responsive
to zoom and pan without visible stutter (SC-018). A label size adjustment
previews within 1 s (SC-009), which is a local signal update with no request.

**Constraints**: Every annotation write MUST be refused server-side without a
valid session, not merely hidden in the UI (FR-045, FR-046, SC-015); annotation
positions MUST be stored relative to the map image, never in screen pixels
(FR-038); label size MUST be map-relative so it stays proportional at every zoom
level (FR-027); minimum zoom MUST NOT go below fit-to-viewport and the map MUST
NOT be pannable entirely out of view (FR-003, FR-004); at most one placement
mode and at most one popup may be active at a time (FR-011, FR-035); placement
mode MUST start off on every map view and MUST NOT persist (FR-012); POI image
uploads MUST reuse the existing content-sniffing allowlist and size cap with
server-derived filenames (research Decision 9); the `003` contract for
`/api/maps*` and the `001`/`002` contract for `/api/map`, `/api/login`,
`/api/logout`, `/api/session` MUST remain unchanged; deletion is permanent with
no undo.

**Scale/Scope**: 7 new API endpoints, 1 new backend module plus 1 extracted
shared module, no new routes (the existing `/maps/:id` view is extended), 4 new
Angular pieces inside the existing `maps/` folder, ~50 annotations per map as
the designed-for upper bound, at most 5 images per point of interest.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First (YAGNI) | PASS | **No new dependencies at all.** Leaflet, OpenSeadragon, and generic pan/zoom packages were each evaluated and rejected in favour of ~150 lines of clamping arithmetic over a CSS transform (research Decision 1); Pillow was rejected for image validation and thumbnailing (Decision 9); SQLite was rejected for annotation storage (Decision 5). No new Angular route, no new feature folder, no annotation state service, no soft-delete, no undo history, no optimistic-locking layer — none are required by the spec. The one new shared module (`storage.py`) is a DRY extraction of code that already exists, not a new abstraction. |
| II. Clear API Contracts | PASS | All seven endpoints are explicitly typed. Annotation payloads use a Pydantic discriminated union on `kind` (research Decision 6), so each variant's required fields are validated and documented rather than smuggled through optional fields. New models: `TextLinkAnnotation`, `PoiAnnotation`, `PoiImage`, `AnnotationListResponse`, `AnnotationCreateRequest`, `AnnotationUpdateRequest`; `ErrorResponse` and `MessageResponse` are reused. Binary image responses are documented in the OpenAPI `responses` block exactly as `/api/maps/{id}/image` already is. No untyped dicts cross the boundary. |
| III. Frontend/Backend Separation | PASS | Persistence, validation, target-map existence checks, and authorization live entirely in the backend. The frontend communicates only over `/api/*` and owns presentation concerns — the zoom transform, the annotation overlay, and placement mode, all of which are per-visit view state that the spec explicitly says is not saved content. Hiding the toggles without a session is presentation; `require_admin` is the control that actually enforces it. The backend still runs with no frontend build artifact present. |
| IV. Reproducible Environments | PASS | `requirements.txt` and `package.json` are both unchanged, so the existing manifests still reconstruct the environment exactly. The one new setting (`MAX_POI_IMAGES`) is declared in `.env.example` with a working default, so a fresh clone runs unconfigured — consistent with the existing "never crash on missing config" behaviour. |
| V. Pragmatic Testing | PASS | The silently-breaking paths get automated coverage: the write authorization boundary (invisible while logged in), the validation rules, cascade deletion of annotations and their image files with a map, and the zoom clamping arithmetic (an off-by-one shows as a map draggable into the void). Styling and gesture polish are covered by the `quickstart.md` scenarios instead of a browser-automation toolchain the project does not have (research Decision 12). |

**Result**: PASS — proceed to Phase 0. No new dependencies and no unjustified
complexity, so the Complexity Tracking table below is empty.

**Post-Phase 1 re-check**: PASS — the design added no database, no repository
abstraction, no background jobs, no new routes, and no dependencies. The single
new backend module (`annotations.py`) is one cohesive persistence unit mirroring
`catalog.py`, and `storage.py` removes duplication rather than adding a layer.
Contracts stayed fully typed, and the auth boundary is still the one existing
`require_admin` dependency applied to every new write endpoint.

## Project Structure

### Documentation (this feature)

```text
specs/004-map-zoom-annotations/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — 12 decisions
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output — annotation endpoints + inherited contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── main.py             # + include annotations router
│   ├── config.py           # + max_poi_images setting
│   ├── dependencies.py     # unchanged require_admin, reused by every write endpoint
│   ├── models.py           # + annotation union, PoiImage, list/create/update models
│   ├── storage.py          # NEW: atomic JSON write/read, image sniff+store, shared lock
│   ├── catalog.py          # refactored onto storage.py; + remove a map's annotations
│   ├── annotations.py      # NEW: sidecar read/write, CRUD, POI image handling
│   └── routes/
│       ├── assets.py       # unchanged
│       ├── auth.py         # unchanged
│       ├── maps.py         # unchanged endpoints; delete now cascades via catalog
│       └── annotations.py  # NEW: list/create/update/delete + image attach/detach/serve
├── data/                   # existing runtime store (gitignored)
│   ├── maps.json           # unchanged
│   ├── maps/{id}.{ext}     # unchanged
│   ├── annotations/{map_id}.json    # NEW
│   └── poi-images/{image_id}.{ext}  # NEW
├── tests/
│   ├── conftest.py         # unchanged fixtures (admin_client, temp MAPS_DATA_DIR)
│   └── test_annotations.py # NEW: authorization, validation, lifecycle, cascade
└── .env.example            # + MAX_POI_IMAGES

frontend/
└── src/app/
    ├── core/
    │   ├── api.service.ts        # + annotation CRUD + POI image methods and URLs
    │   └── api.types.ts          # + Annotation, TextLink, Poi, PoiImage DTOs
    └── maps/
        ├── map-view.ts/.html     # orchestrates zoom, layer, toggles, editor, popup
        ├── zoom-pan.ts           # NEW: scale/offset signals, clamping, gestures
        ├── zoom-pan.spec.ts      # NEW: clamping and zoom-to-pointer unit tests
        ├── annotation-layer.ts/.html   # NEW: renders labels and markers
        ├── annotation-editor.ts/.html  # NEW: create/edit form, size slider, images
        ├── poi-popup.ts/.html          # NEW: single popup, outside the transform
        ├── map-view.spec.ts      # NEW: placement-mode and auth-gating tests
        ├── maps.ts/.html         # unchanged list page
        └── maps.spec.ts          # unchanged
```

**Structure Decision**: Keep the existing two-tree web-app split and add nothing
at the top level. The backend mirrors the shape `003` established — one cohesive
persistence module (`annotations.py`) behind a thin route layer — with the
shared filesystem primitives lifted out of `catalog.py` into `storage.py` so the
atomic-write and image-validation logic exists exactly once. The frontend
extends the existing `maps/` feature folder rather than creating a second one,
because every new piece exists only inside the map view, and keeps using the
single shared `ApiService` rather than introducing a per-feature service
(research Decision 11).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. This feature adds no new runtime dependency, no new service, and
no new architectural layer; the only new shared module removes duplication
rather than introducing an abstraction. Rejected heavier alternatives (Leaflet,
OpenSeadragon, a pan/zoom package, Pillow, SQLite) are each recorded with their
rationale in [research.md](./research.md).
