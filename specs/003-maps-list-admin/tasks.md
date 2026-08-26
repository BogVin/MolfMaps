---
description: "Task list for feature 003-maps-list-admin"
---

# Tasks: Maps List & Admin Map Management

**Input**: Design documents from `/specs/003-maps-list-admin/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: Test tasks ARE included. The plan's Technical Context mandates `backend/tests/test_maps.py` plus light frontend component tests, research Decision 9 defines the coverage set, and Constitution Principle V requires automated tests for the authorization and upload-validation paths before the feature is complete.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)
- Every task names its exact file path

## Path Conventions

Web application, two trees at the repository root (plan.md → Project Structure):

- **Backend**: `backend/app/`, tests in `backend/tests/`
- **Frontend**: `frontend/src/app/`, tests alongside components (`*.spec.ts`)
- **Runtime store**: `backend/data/` (gitignored, created at runtime)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency and environment groundwork required before any catalog code runs

- [X] T001 Add `python-multipart==0.0.20` (pinned, per plan.md Complexity Tracking) to `backend/requirements.txt` and install it into the venv with `pip install -r requirements.txt`
- [X] T002 [P] Document `MAPS_DATA_DIR` (default `backend/data`) and `MAX_MAP_IMAGE_BYTES` (default `10485760`) with commented defaults in `backend/.env.example`
- [X] T003 [P] Add `backend/data/` to `.gitignore` so runtime catalog state is never committed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration, typed models, the catalog persistence module, the authorization dependency, and the shared route/service plumbing that every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Extend `Settings` in `backend/app/config.py` with `maps_data_dir: Path` (default `backend/data`) and `max_map_image_bytes: int` (default `10485760`), plus a module-level allowlist mapping detected MIME type → file extension for `image/webp`, `image/png`, `image/jpeg`, `image/gif` (data-model.md → New configuration)
- [X] T005 [P] Add `MapSummary` (`id`, `name`, `image_url`) and `MapListResponse` (`maps: list[MapSummary]`) Pydantic models to `backend/app/models.py`, matching the schemas in `contracts/openapi.yaml`
- [X] T006 Create `backend/app/catalog.py` with the persistence core: resolve `{MAPS_DATA_DIR}/maps.json` and `{MAPS_DATA_DIR}/maps/`, a module-level `threading.Lock`, `_load_index()`, `_write_index()` committing via temp file + `flush` + `os.fsync` + `os.replace`, and read helpers `list_maps()` (ordered by `created_at` ascending), `get_map(map_id)`, and `image_path(entry)` (depends on T004; research Decisions 1–2)
- [X] T007 [P] Create `backend/app/dependencies.py` with a `require_admin` FastAPI dependency that reads the `session` cookie, calls the existing `security.verify_session`, and raises `401` with the `ErrorResponse` shape on any failure (research Decision 5)
- [X] T008 Add `ensure_seeded()` to `backend/app/catalog.py` — when `maps.json` is absent, create the data directories, copy `backend/assets/kal_main_map.webp` into `maps/{id}.webp`, and write a one-entry index named "Kal Main Map" — then call it from the `lifespan` handler in `backend/app/main.py` (depends on T006; research Decision 7)
- [X] T009 Create `backend/app/routes/maps.py` with an `APIRouter(prefix="/api/maps")` and register it via `app.include_router(maps.router)` in `backend/app/main.py`, leaving `GET /api/map` and the auth routes untouched (depends on T006)
- [X] T010 [P] Extend `backend/tests/conftest.py` with an autouse fixture pointing `MAPS_DATA_DIR` at a `tmp_path` subdirectory and an `admin_client` fixture that yields a `configured_client` already logged in via `POST /api/login` (research Decision 9)
- [X] T011 [P] Add `MapSummary` and `MapListResponse` interfaces to `frontend/src/app/core/api.types.ts`, mirroring the contract schemas
- [X] T012 Add the public catalog read methods `listMaps()`, `getMap(id)`, and `mapImageUrl(id)` to `frontend/src/app/core/api.service.ts`, reusing the existing `HttpClient` wrapper style (depends on T011)

**Checkpoint**: Catalog storage, authorization, and the maps router exist and the app still starts — user stories can now begin

---

## Phase 3: User Story 1 - Anyone browses the maps list (Priority: P1) 🎯 MVP

**Goal**: Any visitor, signed in or not, can reach a Maps page from the site navigation and see every catalog map by display name, or a clear empty state.

**Independent Test**: With at least one map seeded, open `/maps` in a fresh logged-out browser session and confirm all maps appear with readable names and a way to open each; then with an empty catalog confirm the empty state renders instead of a blank page.

### Tests for User Story 1

- [X] T013 [P] [US1] Add tests to `backend/tests/test_maps.py` covering `GET /api/maps` with no session: returns `200` with the seeded entry, and returns `{"maps": []}` for an empty catalog (FR-001, FR-007)

### Implementation for User Story 1

- [X] T014 [US1] Implement the public `GET /api/maps` handler in `backend/app/routes/maps.py` returning `MapListResponse` from `catalog.list_maps()`, ordered `created_at` ascending, with each `image_url` built as `/api/maps/{id}/image` (FR-001, FR-003)
- [X] T015 [P] [US1] Create the maps list component `frontend/src/app/maps/maps.ts` and `frontend/src/app/maps/maps.html` — fetch via `ApiService.listMaps()`, render each map's display name as a link to `/maps/:id`, and show loading, request-error, and empty states (FR-003, FR-007)
- [X] T016 [US1] Register the public `{ path: 'maps', component: Maps }` route in `frontend/src/app/app.routes.ts` ahead of the wildcard redirect, with no guard (FR-001)
- [X] T017 [P] [US1] Add a visible "Maps" navigation link to `frontend/src/app/home/home.html` using `RouterLink` (FR-002)

**Checkpoint**: The Maps page lists the catalog for logged-out visitors and degrades gracefully when empty — MVP is demoable

---

## Phase 4: User Story 2 - Anyone opens a map from the list (Priority: P1)

**Goal**: Any visitor can select a listed map and view its image as the primary content, with a graceful fallback when the image is unavailable and a way back to the list.

**Independent Test**: From `/maps` while logged out, open a listed map and confirm the image renders undistorted and scaled to the viewport; reload the `/maps/{id}` URL directly in a new tab and confirm it works without login.

### Tests for User Story 2

- [X] T018 [P] [US2] Add tests to `backend/tests/test_maps.py` covering, with no session: `GET /api/maps/{id}` returns the map's metadata, `GET /api/maps/{id}/image` returns the image bytes with the stored content type, and both return `404` for an unknown id (FR-004, FR-012)

### Implementation for User Story 2

- [X] T019 [US2] Implement the public `GET /api/maps/{map_id}` handler in `backend/app/routes/maps.py` returning `MapSummary` or `404` with `ErrorResponse` for an unknown id
- [X] T020 [US2] Implement the public `GET /api/maps/{map_id}/image` handler in `backend/app/routes/maps.py` streaming a `FileResponse` with the entry's stored `content_type`, returning `404` when the entry or the file on disk is missing, and documenting the binary responses in the OpenAPI `responses` block as `GET /api/map` already does (FR-006)
- [X] T021 [P] [US2] Create the single-map view `frontend/src/app/maps/map-view.ts` and `frontend/src/app/maps/map-view.html` — read the `:id` route param, load metadata via `ApiService.getMap()`, render the image as primary content scaled to the viewport without aspect-ratio distortion, reuse the `(error)` + `naturalWidth === 0` fallback pattern from `home.ts`, show a clear not-found message on `404`, and include a back link to `/maps` (FR-004, FR-005, FR-006, FR-015)
- [X] T022 [US2] Register the public `{ path: 'maps/:id', component: MapView }` route in `frontend/src/app/app.routes.ts` after the `maps` route and before the wildcard

**Checkpoint**: The full public browse-and-open path works logged out, including deep links — User Stories 1 and 2 are independently functional

---

## Phase 5: User Story 3 - Logged-in admin adds a new map (Priority: P2)

**Goal**: An authenticated admin adds a map with a display name and image file; it immediately appears in the list for everyone. Unauthenticated callers neither see nor can use the add path.

**Independent Test**: Log in as admin, add a map with a name and image, then confirm in a separate logged-out session that the map is listed and opens; confirm an unauthenticated `POST /api/maps` is refused and adds nothing.

### Tests for User Story 3

- [X] T023 [P] [US3] Add tests to `backend/tests/test_maps.py` covering: authorized add returns `201` and the map is then listed and its image openable; unauthenticated add returns `401` with the catalog byte-for-byte unchanged; missing or blank `name` returns `422`; non-image content returns `400`; an upload over `MAX_MAP_IMAGE_BYTES` returns `413`; and after every rejection `GET /api/maps` shows no partial entry (FR-008, FR-009, FR-010, FR-014, SC-005)
- [X] T024 [P] [US3] Add a component test in `frontend/src/app/maps/maps.spec.ts` asserting the add-map control renders when `GET /api/session` reports `authenticated: true` and is absent when it reports `false` (FR-013)

### Implementation for User Story 3

- [X] T025 [US3] Add `create_map(name, upload)` to `backend/app/catalog.py` — trim and validate the name (1–100 chars), stream the upload to a temp file in 64 KB chunks aborting past `max_map_image_bytes`, sniff the leading bytes against the allowlist while ignoring the client `Content-Type` and filename, `os.replace` the temp file to `maps/{uuid4().hex}.{ext}` using the detected extension, then append the entry and rewrite the index under the write lock; delete the temp file and leave the index untouched on any failure (research Decision 4, data-model.md → Creation ordering)
- [X] T026 [US3] Implement `POST /api/maps` in `backend/app/routes/maps.py` with `Depends(require_admin)`, `name: str = Form(...)` and `image: UploadFile = File(...)`, mapping catalog validation failures to `400` / `413` / `422` with the generic `ErrorResponse` and returning `201` with `MapSummary` on success
- [X] T027 [US3] Add `createMap(name, file)` to `frontend/src/app/core/api.service.ts` posting a `FormData` body to `/api/maps` with `withCredentials: true`
- [X] T028 [US3] Add the admin-only add-map form (display name input, file input, inline validation and server-error messages, list refresh on success) to `frontend/src/app/maps/maps.ts` and `frontend/src/app/maps/maps.html`, rendered only when `ApiService.getSession()` reports an authenticated session (FR-008, FR-009, FR-010, FR-013)

**Checkpoint**: Admins can grow the catalog and the authorization boundary is enforced server-side

---

## Phase 6: User Story 4 - Logged-in admin deletes an existing map (Priority: P2)

**Goal**: An authenticated admin permanently removes a map after an explicit confirmation; it disappears from the list and stops opening. Unauthenticated callers neither see nor can use the delete path.

**Independent Test**: Log in as admin, cancel a delete and confirm the map survives, then confirm a delete and verify the map is gone from the list and its previous `/maps/{id}` link shows a not-found message; confirm an unauthenticated `DELETE /api/maps/{id}` is refused and the map remains.

### Tests for User Story 4

- [X] T029 [P] [US4] Add tests to `backend/tests/test_maps.py` covering: authorized delete returns `200` and the map then `404`s on both `GET /api/maps/{id}` and `GET /api/maps/{id}/image` and is absent from the list; unauthenticated delete and a forged `session` cookie both return `401` with the map still listed and openable; deleting an unknown id returns `404` (FR-011, FR-012, FR-014, SC-004, SC-005)
- [X] T030 [P] [US4] Add component tests in `frontend/src/app/maps/maps.spec.ts` asserting the delete control is absent for an unauthenticated session, and that for an authenticated session Cancel leaves the row intact while Confirm issues the delete request (FR-011, FR-013)

### Implementation for User Story 4

- [X] T031 [US4] Add `delete_map(map_id)` to `backend/app/catalog.py` — under the write lock, remove the entry and atomically rewrite the index first, then unlink the stored image, tolerating an already-missing file; signal "not found" to the caller when no entry matches (data-model.md → Lifecycle)
- [X] T032 [US4] Implement `DELETE /api/maps/{map_id}` in `backend/app/routes/maps.py` with `Depends(require_admin)`, returning `200` with `MessageResponse` on success and `404` with `ErrorResponse` for an unknown id
- [X] T033 [US4] Add `deleteMap(id)` to `frontend/src/app/core/api.service.ts` issuing `DELETE /api/maps/{id}` with `withCredentials: true`
- [X] T034 [US4] Add the admin-only inline two-step delete control (Delete → row shows Confirm / Cancel, list refreshes after a confirmed delete) to `frontend/src/app/maps/maps.ts` and `frontend/src/app/maps/maps.html`, rendered only for an authenticated session (FR-011, FR-012, FR-013; research Decision 8)

**Checkpoint**: All four user stories are independently functional; the catalog supports the full browse / open / add / delete lifecycle

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T035 [P] Handle a `401` returned mid-action in `frontend/src/app/maps/maps.ts` by refreshing session state and prompting the admin to log in again rather than failing silently (spec Edge Cases → session expires mid-action)
- [X] T036 [P] Run the full backend suite with `pytest` from `backend/` and confirm `test_auth.py`, `test_map.py`, and `test_session.py` remain green alongside the new `test_maps.py` (Constitution → Pragmatic Testing)
- [X] T037 [P] Run `npm test` from `frontend/` and confirm the new `maps.spec.ts` tests and the existing `app.spec.ts` pass
- [X] T038 [P] Compare the FastAPI-generated schema at `http://localhost:8000/openapi.json` against `specs/003-maps-list-admin/contracts/openapi.yaml` and reconcile any drift in paths, status codes, or model fields (Constitution → Clear API Contracts)
- [X] T039 Walk through all ten validation scenarios in `specs/003-maps-list-admin/quickstart.md`, including the authorization-boundary curls and home-page parity check

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 must land before any `Form`/`UploadFile` code is imported (Phase 5).
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational completion; they can then run in parallel or sequentially in priority order (US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: Depends on the user stories being delivered

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. No dependency on other stories.
- **US2 (P1)**: Starts after Phase 2. Independently testable via a direct `/maps/{id}` URL, though it is most natural to demo alongside US1's list.
- **US3 (P2)**: Starts after Phase 2. Verifying "the added map appears in the list" reuses US1's endpoint, but the story is independently testable through `POST /api/maps` plus `GET /api/maps`.
- **US4 (P2)**: Starts after Phase 2. Needs a map to delete — use the seeded entry, so no dependency on US3.

### Within Each User Story

- Tests are written first and must fail before the implementation lands
- Catalog module functions before route handlers; route handlers before the frontend that calls them
- Story complete and checkpoint-validated before moving to the next priority

### Same-File Serialization (no `[P]`)

- `backend/app/routes/maps.py`: T009 → T014 → T019 → T020 → T026 → T032
- `backend/app/catalog.py`: T006 → T008 → T025 → T031
- `backend/app/main.py`: T008 → T009
- `frontend/src/app/app.routes.ts`: T016 → T022
- `frontend/src/app/core/api.service.ts`: T012 → T027 → T033
- `frontend/src/app/maps/maps.ts` / `maps.html`: T015 → T028 → T034 → T035
- `backend/tests/test_maps.py`: T013 → T018 → T023 → T029 (each phase appends its own tests, so they are `[P]` only relative to the other tasks in their phase)

---

## Parallel Opportunities

- **Phase 1**: T002 and T003 run together while T001 installs
- **Phase 2**: T004, T005, T007, T010, T011 all touch different files and run together; T006 follows T004, T012 follows T011, and T008/T009 follow T006
- **Phase 3**: T013, T015, and T017 run together (backend test, new component, home template)
- **Phase 4**: T018 and T021 run together
- **Phase 5**: T023 and T024 run together; then T025/T026 (backend) and T027/T028 (frontend) can be split across two developers
- **Phase 6**: T029 and T030 run together; backend (T031, T032) and frontend (T033, T034) split cleanly
- **Phase 7**: T035–T038 run together; T039 runs last against the finished stack

### Parallel Example: Phase 2 Foundational

```bash
Task: "Extend Settings with maps_data_dir and max_map_image_bytes in backend/app/config.py"
Task: "Add MapSummary and MapListResponse models in backend/app/models.py"
Task: "Create require_admin dependency in backend/app/dependencies.py"
Task: "Add temp MAPS_DATA_DIR and admin_client fixtures in backend/tests/conftest.py"
Task: "Add MapSummary and MapListResponse interfaces in frontend/src/app/core/api.types.ts"
```

### Parallel Example: User Story 3

```bash
Task: "Add catalog and authorization tests for POST /api/maps in backend/tests/test_maps.py"
Task: "Add auth-gated add-control visibility test in frontend/src/app/maps/maps.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: US1 — the Maps list
4. **STOP and VALIDATE**: quickstart scenarios 1 and 3
5. Complete Phase 4: US2 — opening a map
6. **STOP and VALIDATE**: quickstart scenarios 2 and 4

Both P1 stories together form the public browse-and-open product. US1 alone is a shippable increment, but pairing it with US2 is the smallest genuinely useful release since a list you cannot open has limited value.

### Incremental Delivery

1. Setup + Foundational → seeded catalog served by a running API
2. US1 → logged-out visitors browse the list → demo
3. US2 → logged-out visitors open maps → demo
4. US3 → admins grow the catalog → demo
5. US4 → admins prune the catalog → demo
6. Polish → session-expiry handling, contract check, full quickstart pass

### Parallel Team Strategy

After Phase 2 completes: Developer A takes US1 + US2 (public path, `catalog` reads and the two public components), Developer B takes US3 + US4 (privileged writes, `require_admin`, admin controls). Both edit `catalog.py`, `routes/maps.py`, `api.service.ts`, and `test_maps.py`, so coordinate on those four files or sequence the phases if a single developer is working alone.

---

## Notes

- `[P]` marks tasks in different files with no incomplete dependencies
- Authorization is enforced server-side by `require_admin`; hiding controls in Angular is presentation only and never a substitute (FR-014, SC-005)
- Stored filenames always derive from the server-generated id and the *detected* content type — never from the client-supplied filename (prevents path traversal)
- No catalog entry is ever written before its image is fully received and validated, so a failed upload leaves no partial map
- `backend/data/` is runtime state: gitignored, created on demand, and pointed at a `tmp_path` in tests so a test run never touches a developer's real catalog
- The `001`/`002` contract for `/api/map`, `/api/login`, `/api/logout`, and `/api/session` must remain unchanged
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
