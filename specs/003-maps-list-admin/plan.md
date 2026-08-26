# Implementation Plan: Maps List & Admin Map Management

**Branch**: `003-maps-list-admin` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-maps-list-admin/spec.md`

## Summary

Turn the single-map site into a small map catalog. The FastAPI backend gains a
public catalog API (`GET /api/maps`, `GET /api/maps/{id}`, `GET /api/maps/{id}/image`)
plus two admin-only write endpoints (`POST /api/maps` multipart upload,
`DELETE /api/maps/{id}`) guarded by the existing signed session cookie from
`001-map-landing-login`. Persistence is a JSON index file plus image files on
disk — no database is introduced. The Angular frontend gains a public `/maps`
list route and a `/maps/:id` view route, with add/delete controls rendered only
for an authenticated admin. The existing home landing page and `GET /api/map`
stay unchanged, and the existing main map asset is seeded into the catalog on
first run so the list is never empty for an existing deployment.

## Technical Context

**Language/Version**: Python 3.11 (backend, unchanged toolchain from `001`);
TypeScript ~6.0 targeting Angular 22 (frontend, unchanged toolchain from `002`).

**Primary Dependencies**: Backend — FastAPI 0.115.6, Uvicorn 0.34.0,
Pydantic 2.10.4, pydantic-settings 2.7.1, itsdangerous 2.2.0, plus one new pinned
dependency `python-multipart` (required by FastAPI to parse `multipart/form-data`
uploads; see Complexity Tracking). Frontend — Angular 22 standalone components,
Angular Router, `HttpClient`; no new frontend packages.

**Storage**: Filesystem catalog under `backend/data/` — a JSON index
(`maps.json`) holding map metadata, and image bytes stored as
`maps/{id}.{ext}`. No database, no ORM. Writes are serialized with an in-process
lock and committed via atomic temp-file replace.

**Testing**: `pytest` (backend) — new `backend/tests/test_maps.py` covering the
public list/detail/image paths, admin add/delete happy paths, and the
authorization boundary (unauthenticated add/delete refused, catalog unchanged).
Existing `test_auth.py` / `test_map.py` / `test_session.py` must stay green.
Frontend — existing Vitest setup; light component tests for auth-gated control
visibility only.

**Target Platform**: Modern desktop & mobile browsers; local dev on Linux/macOS
with a Python `venv` for the backend and Node.js LTS for the Angular CLI.

**Project Type**: Web application (`backend/` FastAPI + `frontend/` Angular).

**Performance Goals**: Maps list or empty state rendered within 3s on typical
broadband (SC-001); a chosen map's image visible within 3s (SC-002). The catalog
is expected to hold tens of maps, so a full JSON index read per list request is
acceptable.

**Constraints**: Add/delete MUST be enforced server-side, not merely hidden in
the UI (FR-013, FR-014, SC-005); uploads MUST be validated by content sniffing
against an allowlist and capped in size, with no partial catalog entry left
behind on failure; stored filenames MUST be derived from the server-generated id
(never from client-supplied filenames) to prevent path traversal; the `002`
contract for `/api/map`, `/api/login`, `/api/logout`, `/api/session` MUST remain
unchanged; delete is permanent, with no soft-delete.

**Scale/Scope**: 5 new API endpoints, 2 new Angular routes, 1 new Angular
service area, ~10s of catalog entries, images up to 10 MB each (configurable).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First (YAGNI) | PASS (one justification) | No database, no ORM, no migration tooling, no storage-abstraction layer, no upload library — a JSON index plus files on disk is the simplest thing that satisfies list/add/delete for tens of maps. One new dependency (`python-multipart`) is unavoidable for multipart parsing and is recorded in Complexity Tracking. No soft-delete, no edit/rename, no pagination, no thumbnails — none are required by the spec. |
| II. Clear API Contracts | PASS | Every new endpoint has explicit Pydantic request/response models (`MapSummary`, `MapListResponse`, reusing `ErrorResponse` / `MessageResponse`). Binary image responses are documented in the OpenAPI `responses` block, matching the existing `/api/map` pattern. No untyped dicts cross the boundary. |
| III. Frontend/Backend Separation | PASS | Catalog persistence, upload validation, and authorization live entirely in the backend. Angular calls `/api/*` over HTTP only and renders results; hiding admin controls is presentation, while the security decision is a backend dependency. Backend continues to run without any frontend build artifact. |
| IV. Reproducible Environments | PASS | `python-multipart` is added to `backend/requirements.txt` with a pinned version and installed in the `venv`. No new frontend packages, so `package.json` / lockfile are untouched. New runtime configuration (`MAPS_DATA_DIR`, `MAX_MAP_IMAGE_BYTES`) is declared in `.env.example` with safe defaults so a fresh clone runs unconfigured. |
| V. Pragmatic Testing | PASS | The risky paths — authorization on write endpoints, upload validation/rejection, and delete removing the entry from both list and open paths — get automated pytest coverage against a temporary data directory. Trivial getters and pure presentation are not exhaustively tested. |

**Result**: PASS — proceed to Phase 0. The single dependency addition is
justified below; no unjustified complexity.

**Post-Phase 1 re-check**: PASS — the design added no database, no repository
abstraction, no background jobs, and no additional dependencies beyond
`python-multipart`. Contracts remain fully typed and the auth boundary is a
single reusable FastAPI dependency.

## Project Structure

### Documentation (this feature)

```text
specs/003-maps-list-admin/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output — existing + new catalog endpoints
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── main.py             # + include maps router; seed catalog on startup (lifespan)
│   ├── config.py           # + maps_data_dir, max_map_image_bytes settings
│   ├── security.py         # unchanged session sign/verify helpers
│   ├── dependencies.py     # NEW: require_admin FastAPI dependency (401 when no session)
│   ├── models.py           # + MapSummary, MapListResponse
│   ├── catalog.py          # NEW: JSON index read/write, image save/delete, seeding
│   └── routes/
│       ├── assets.py       # unchanged GET /api/map (home parity)
│       ├── auth.py         # unchanged login/logout/session
│       └── maps.py         # NEW: list/detail/image/create/delete
├── assets/
│   └── kal_main_map.webp   # unchanged; seeded into the catalog on first run
├── data/                   # NEW runtime store (gitignored)
│   ├── maps.json           # catalog index
│   └── maps/{id}.{ext}     # stored map images
├── tests/
│   ├── conftest.py         # + admin_client fixture and temp MAPS_DATA_DIR
│   └── test_maps.py        # NEW: catalog + authorization coverage
├── .env.example            # + MAPS_DATA_DIR, MAX_MAP_IMAGE_BYTES
└── requirements.txt        # + python-multipart (pinned)

frontend/
└── src/app/
    ├── app.routes.ts       # + 'maps' and 'maps/:id' routes
    ├── core/
    │   ├── api.service.ts  # + listMaps/getMap/createMap/deleteMap + mapImageUrl()
    │   └── api.types.ts    # + MapSummary, MapListResponse
    ├── home/               # + visible link to the Maps page (FR-002)
    ├── maps/
    │   ├── maps.ts/.html   # list, empty state, admin add form + delete controls
    │   └── map-view.ts/.html # single map image view, fallback, back link
    └── login/              # unchanged
```

**Structure Decision**: Keep the existing two-tree web-app split. The backend
grows one cohesive module (`catalog.py`) that owns all filesystem persistence, so
the route layer stays thin and the storage choice can be swapped later without
touching routes — this is separation of concerns, not a speculative abstraction
layer. The frontend adds a `maps/` feature folder mirroring the existing
`home/` and `login/` conventions, reusing the single `ApiService` rather than
introducing a per-feature service.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New runtime dependency `python-multipart` | FastAPI cannot parse `multipart/form-data` (the standard way to upload a name + image file) without it; `File`/`Form` parameters raise at import time otherwise | Accepting a base64-encoded image inside a JSON body avoids the dependency but inflates payloads ~33%, forces hand-rolled decode/validate code on the server and encode code in Angular, and departs from the browser-native file-upload path |
| New `backend/data/` writable runtime directory | Add/delete require durable storage for image bytes and metadata that survives restarts (FR-010, FR-012) | Keeping the catalog in memory is simpler but loses every added map on restart, failing FR-010; committing uploads into `backend/assets/` mixes user data with tracked repo assets |
