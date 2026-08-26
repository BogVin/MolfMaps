---
description: "Task list for feature 004-map-zoom-annotations"
---

# Tasks: Map Zoom & Interactive Annotations

**Input**: Design documents from `/specs/004-map-zoom-annotations/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: Test tasks ARE included. The plan's Technical Context mandates `backend/tests/test_annotations.py` plus Vitest coverage of the zoom arithmetic and the auth-gated toggles, research Decision 12 defines the coverage set, and Constitution Principle V requires automated tests for the authorization boundary and the clamping logic before the feature is complete.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)
- Every task names its exact file path

## Path Conventions

Web application, two trees at the repository root (plan.md → Project Structure):

- **Backend**: `backend/app/`, tests in `backend/tests/`
- **Frontend**: `frontend/src/app/`, tests alongside components (`*.spec.ts`)
- **Runtime store**: `backend/data/` (gitignored) — now also `annotations/` and `poi-images/`

**No new dependency on either side.** `backend/requirements.txt` and `frontend/package.json` are untouched by this feature (plan.md → Primary Dependencies).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration and bounds that the annotation code reads before any of it runs

- [X] T001 Extend `Settings` in `backend/app/config.py` with `max_poi_images: int = 5`, and add the module-level annotation bounds beside the existing `ALLOWED_IMAGE_TYPES` table: `MIN_TEXT_SCALE = 0.01`, `MAX_TEXT_SCALE = 0.10`, `DEFAULT_TEXT_SCALE = 0.03`, `MAX_LABEL_TEXT_LENGTH = 120`, `MAX_POI_TEXT_LENGTH = 2000` (data-model.md → New configuration, Shared constants)
- [X] T002 [P] Document `MAX_POI_IMAGES` (default `5`) with a commented default in `backend/.env.example`, alongside the existing `MAPS_DATA_DIR` and `MAX_MAP_IMAGE_BYTES` entries, and note that `MAX_MAP_IMAGE_BYTES` now also caps point-of-interest uploads
- [X] T003 [P] Confirm `.gitignore` still excludes the whole runtime store so the new `backend/data/annotations/` and `backend/data/poi-images/` subtrees are never committed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared filesystem primitives, typed annotation contract, sidecar persistence, the public list and admin create endpoints, and the frontend DTOs/service methods that every annotation story builds on

**⚠️ CRITICAL**: No annotation user story (US2–US4) can begin until this phase is complete. US1 (zoom & pan) touches none of it and may start in parallel.

- [X] T004 Create `backend/app/storage.py` holding the primitives currently private to `catalog.py`: the module-level `write_lock`, `read_json(path)`, `write_json_atomic(path, document)` committing via temp file + `flush` + `os.fsync` + `os.replace`, `detect_content_type(header)` magic-byte sniffing, and `store_upload(directory, stream, size_limit)` which streams in 64 KB chunks, aborts past the cap, sniffs the leading bytes, and `os.replace`s into `{uuid4().hex}.{ext}` from the *detected* type (research Decision 5; DRY guidance → extract common code)
- [X] T005 Refactor `backend/app/catalog.py` onto `backend/app/storage.py` — delete the now-duplicated `_write_lock`, `_detect_content_type`, `_load_index`/`_write_index` internals and the inline upload loop, keeping every public name and behavior identical so `test_maps.py` stays green unchanged (depends on T004)
- [X] T006 [P] Add the annotation contract to `backend/app/models.py`: `AnnotationBase`, `TextLinkAnnotation`, `PoiAnnotation`, the `Annotation = Annotated[Union[...], Field(discriminator="kind")]` union, `PoiImage`, `AnnotationListResponse`, `CreateTextLinkRequest`, `CreatePoiRequest`, the `AnnotationCreateRequest` union, and `AnnotationUpdateRequest` — field types, bounds, and required sets exactly as in `contracts/openapi.yaml` (research Decision 6)
- [X] T007 Create `backend/app/annotations.py` with the sidecar persistence core: resolve `{MAPS_DATA_DIR}/annotations/{map_id}.json` and `{MAPS_DATA_DIR}/poi-images/`, load/save the `{"annotations": [...]}` document through `storage`, and expose `list_annotations(map_id)` (ordered `created_at` ascending), `get_annotation(map_id, annotation_id)`, `create_annotation(map_id, payload)` — trim text, clamp `text_scale` into `[MIN_TEXT_SCALE, MAX_TEXT_SCALE]` rather than rejecting, verify a text link's `target_map_id` exists in the catalog, stamp `uuid4().hex` and UTC timestamps — and `delete_map_annotations(map_id)` removing the sidecar plus every point-of-interest image file it owned (depends on T004, T006; data-model.md → Validation rules, Cascade rules)
- [X] T008 Create `backend/app/routes/annotations.py` with `APIRouter(prefix="/api/maps")`, implementing public `GET /{map_id}/annotations` (404 for an unknown map, `target_available` computed from the already-loaded catalog) and `POST /{map_id}/annotations` with `Depends(require_admin)` returning `201`, and register it via `app.include_router(annotations.router)` in `backend/app/main.py` (depends on T007; research Decisions 7–8)
- [X] T009 Make map deletion cascade in `backend/app/catalog.py` — `delete_map` calls `annotations.delete_map_annotations(map_id)` inside the write lock via a function-local import, so the two modules stay free of a circular import at load time (depends on T007; FR-044)
- [X] T010 [P] Extend `backend/tests/conftest.py` with a `sample_png` bytes fixture (a minimal valid PNG) and a `make_map` factory fixture that creates a catalog map through `admin_client` and returns its id, so annotation tests always have a real owning map
- [X] T011 [P] Add the annotation DTOs to `frontend/src/app/core/api.types.ts` — `TextLinkAnnotation`, `PoiAnnotation`, the `Annotation` discriminated union, `PoiImage`, `AnnotationListResponse`, `CreateAnnotationRequest`, `UpdateAnnotationRequest` — mirroring the contract schemas
- [X] T012 Add `listAnnotations(mapId)` and `createAnnotation(mapId, body)` to `frontend/src/app/core/api.service.ts` in the existing `HttpClient` wrapper style, with `withCredentials: true` on the write (depends on T011)

**Checkpoint**: A map's annotations can be listed publicly and created by an admin, map deletion cascades, and the existing catalog suite is still green — the annotation stories can now begin

---

## Phase 3: User Story 1 - Anyone zooms and pans an open map (Priority: P1) 🎯 MVP

**Goal**: Any visitor, signed in or not, can zoom, pan, and reset an open map with pointer, wheel, touch, and keyboard, without leaving the view or reloading.

**Independent Test**: Open any existing map as a logged-out visitor, zoom in on a region, pan around it, zoom out past the fit size, hit the maximum, zoom toward a chosen spot, and reset — confirming the aspect ratio holds, the map never leaves the visible area, and reset restores the fitted view.

### Tests for User Story 1

- [X] T013 [P] [US1] Create `frontend/src/app/maps/zoom-pan.spec.ts` covering the pure arithmetic: scale never drops below `1.0` and never exceeds `8.0`, a discrete step multiplies by `1.5` and clamps at both ends, pan offsets are bounded on both axes so the scaled image always covers the frame, the offset is pinned to centre at `scale = 1`, zoom-to-pointer keeps the pointed map point stationary, reset restores `scale = 1` with a centred offset, and a frame resize re-clamps existing offsets (research Decision 1, FR-003, FR-004, FR-007)

### Implementation for User Story 1

- [X] T014 [US1] Create `frontend/src/app/maps/zoom-pan.ts` — `scale`/`offsetX`/`offsetY` signals, the `MIN_SCALE = 1.0`, `MAX_SCALE = 8.0`, `ZOOM_STEP = 1.5` constants, `zoomBy`, `zoomToPointer`, `panBy`, `reset`, `setFrameSize`, a `transform` computed producing `translate(Xpx, Ypx) scale(S)`, and the clamping helpers the spec tests exercise — pure state and arithmetic, no DOM ownership (research Decision 1)
- [X] T015 [US1] Wire zoom and pan into `frontend/src/app/maps/map-view.ts` and `frontend/src/app/maps/map-view.html` — a fixed map frame containing a transformed wrapper around the existing `<img>` with `transform-origin: 0 0`, Pointer Events for drag, `wheel` for scroll-zoom, two-pointer distance tracking for pinch, keyboard handlers for `+`/`-`/arrows/`0`, a `ResizeObserver` feeding `setFrameSize`, and zoom-in / zoom-out / reset controls that are visibly disabled at their bound (FR-001…FR-007, SC-002)
- [X] T016 [P] [US1] Add the map frame, transformed wrapper, and zoom-control styles to `frontend/src/styles.css` — frame `overflow: hidden`, `touch-action: none` on the drag surface, and controls that stay legible over any map image

**Checkpoint**: Zoom, pan, and reset work for logged-out visitors on every existing map, with no backend change — MVP is demoable

---

## Phase 4: User Story 2 - Logged-in user adds clickable text that leads to another map (Priority: P2)

**Goal**: An authenticated user arms the label toggle, clicks a spot, types text, picks a target map, sizes the label with live preview, and saves it; every visitor then sees that label at that size and can click through to the target map.

**Independent Test**: Log in, turn on the label toggle, click a spot on map A, point the label at map B, enlarge its text, save, then sign out and confirm the label renders at the clicked spot in the chosen size and that clicking it opens map B.

### Tests for User Story 2

- [X] T017 [P] [US2] Create `backend/tests/test_annotations.py` covering text links with no session and with `admin_client`: `GET /api/maps/{id}/annotations` returns `200` with `{"annotations": []}` for a fresh map and `404` for an unknown map; an authorized create returns `201` and the annotation is then listed publicly; an unauthenticated create returns `401` with the list byte-for-byte unchanged; missing text, blank text, text over 120 chars, a missing `target_map_id`, an unknown `target_map_id`, and `x`/`y` outside `[0, 1]` each return `422` with nothing saved; an out-of-range `text_scale` is **clamped** to the nearest bound and returns `201`; an omitted `text_scale` defaults to `0.03`; and a self-referencing `target_map_id` is accepted (FR-020, FR-021, FR-024, FR-025, FR-046, SC-015)
- [X] T018 [P] [US2] Create `frontend/src/app/maps/map-view.spec.ts` asserting that the placement toggles are absent when `GET /api/session` reports `authenticated: false`, present and both off when it reports `true`, that arming one toggle disarms the other, and that the mode is `'off'` on every fresh view (FR-008, FR-009, FR-011, FR-012, SC-005)

### Implementation for User Story 2

- [X] T019 [US2] Add the placement toggles to `frontend/src/app/maps/map-view.ts` and `frontend/src/app/maps/map-view.html` — a single `placementMode` signal holding `'off' | 'label' | 'poi'`, two `<button aria-pressed>` controls rendered in a bottom corner of the map frame *outside* the transformed wrapper, shown only when `ApiService.getSession()` reports an authenticated session, with a clear active indication (research Decision 10; FR-008…FR-014)
- [X] T020 [US2] Add click-versus-drag placement detection to `frontend/src/app/maps/map-view.ts` — `pointerdown` records position and time, `pointerup` counts as a placement only under 5 CSS px of movement and 500 ms, and the frame point is converted to `x`/`y` fractions of the map image; a drag pans instead and creates nothing (FR-015, FR-016, FR-017)
- [X] T021 [P] [US2] Create `frontend/src/app/maps/annotation-layer.ts` and `annotation-layer.html` — render each text link inside the transformed wrapper at `left: x × 100%` / `top: y × 100%` with `font-size` computed as `text_scale × fittedImageWidthPx`, emit an `activate` event per annotation, stop propagation so the map surface never sees the click, mark links whose `target_available` is `false`, and expose each label as a keyboard-operable control (research Decisions 2–3; FR-028, FR-038)
- [X] T022 [US2] Create `frontend/src/app/maps/annotation-editor.ts` and `annotation-editor.html` — the create form for a text link: text input, target-map `<select>` populated from `ApiService.listMaps()`, a size slider bounded to `[0.01, 0.10]` that previews the label live before saving, inline validation for missing text or target, and save/cancel (FR-021, FR-022, FR-023, FR-024, SC-009)
- [X] T023 [US2] Orchestrate creation in `frontend/src/app/maps/map-view.ts` — load annotations on init, open the editor anchored at the clicked fraction, POST through `ApiService.createAnnotation`, show the new annotation immediately, leave the toggle armed after a save or a cancel, and surface server validation messages (FR-019, SC-007, SC-008)
- [X] T024 [US2] Handle link activation in `frontend/src/app/maps/map-view.ts` — navigate to `/maps/{target_map_id}` on activate for every visitor, and show the existing "no longer available" message when the target is flagged unavailable or its view answers `404` (FR-029, FR-030, SC-011)
- [X] T025 [P] [US2] Add label and placement-toggle styles to `frontend/src/styles.css` — labels readable over any map, toggles small enough to leave the map usable and reachable on a short viewport

**Checkpoint**: Admins can connect maps with sized text links, logged-out visitors can follow them, and the authorization boundary is enforced server-side

---

## Phase 5: User Story 3 - Logged-in user adds a point of interest with a detail popup (Priority: P3)

**Goal**: An authenticated user arms the point-of-interest toggle, marks a spot, and attaches descriptive text and optional images; any visitor can open the marker's popup over the map and dismiss it without losing their zoom and pan.

**Independent Test**: Log in, turn on the point-of-interest toggle, click a spot, add text and an image, then sign out and confirm the marker is visible, its popup shows the text and image, only one popup opens at a time, and dismissing it leaves the view untouched.

### Tests for User Story 3

- [X] T026 [P] [US3] Add point-of-interest coverage to `backend/tests/test_annotations.py`: a POI with text and no images returns `201`; blank text and text over 2000 chars return `422`; an authorized image attach returns `201` and the image appears in the list projection with its `image_url`; a non-image file returns `400`; an upload over `MAX_MAP_IMAGE_BYTES` returns `413`; exceeding `MAX_POI_IMAGES` returns `409`; attaching to a text link returns `409`; unauthenticated attach and detach return `401` with the annotation unchanged; `GET` on the image is public and serves the detected media type; a missing file on disk returns `404`; and a detach returns `200` and unlinks the file (FR-031…FR-037, FR-046)

### Implementation for User Story 3

- [X] T027 [US3] Add image handling to `backend/app/annotations.py` — `add_image(map_id, annotation_id, stream)` refusing a text link and a POI already at `settings.max_poi_images`, storing bytes through `storage.store_upload` into `poi-images/` *before* appending the record and rewriting the sidecar under the write lock, plus `remove_image` and `image_file` resolution; any failure before the sidecar write leaves no partial record (data-model.md → Creation ordering; research Decision 9)
- [X] T028 [US3] Add the image sub-resource to `backend/app/routes/annotations.py` — `POST /{map_id}/annotations/{annotation_id}/images` and `DELETE .../images/{image_id}` behind `Depends(require_admin)`, and a public `GET .../images/{image_id}` streaming a `FileResponse` with the stored content type and documenting the binary responses in the OpenAPI `responses` block as `GET /api/maps/{id}/image` already does; map catalog errors onto `400` / `401` / `404` / `409` / `413` with the generic `ErrorResponse`
- [X] T029 [P] [US3] Add `addAnnotationImage(mapId, annotationId, file)` and `deleteAnnotationImage(mapId, annotationId, imageId)` to `frontend/src/app/core/api.service.ts`, posting `FormData` with `withCredentials: true` and using each `PoiImage.image_url` verbatim rather than composing paths
- [X] T030 [P] [US3] Render point-of-interest markers in `frontend/src/app/maps/annotation-layer.ts` and `annotation-layer.html` — anchored by the same `x`/`y` fractions but counter-scaled with `transform: scale(1 / currentScale)` about the anchor so they keep a constant on-screen size, emitting `activate` and operable by keyboard (research Decision 4; FR-034)
- [X] T031 [P] [US3] Create `frontend/src/app/maps/poi-popup.ts` and `poi-popup.html` — one popup rendered *outside* the transformed wrapper and positioned by projecting the annotation's map coordinates to screen coordinates, showing the text and images, keeping the text readable with a graceful fallback when an image fails using the existing `(error)` + `naturalWidth === 0` pattern, and offering an explicit dismiss (FR-035, FR-036, SC-019)
- [X] T032 [US3] Own popup state in `frontend/src/app/maps/map-view.ts` — a single `openPopupId` signal so activating another marker closes the first, and dismissal restores the map with its zoom and pan untouched (FR-035, SC-013)
- [X] T033 [US3] Extend `frontend/src/app/maps/annotation-editor.ts` and `annotation-editor.html` with the point-of-interest branch — required descriptive text plus add/remove image controls that call the image endpoints and report per-file rejection messages without discarding the saved text (FR-032, FR-033, FR-037)
- [X] T034 [P] [US3] Add marker and popup styles to `frontend/src/styles.css` — a comfortable constant marker size, a popup clamped inside the viewport near map edges, capped image height, and long text that wraps or scrolls without breaking the layout

**Checkpoint**: Maps carry both annotation kinds; popups open over the map for every visitor and never two at once

---

## Phase 6: User Story 4 - Logged-in user corrects or removes map annotations (Priority: P4)

**Goal**: An authenticated user edits an annotation's wording, target, size, and position, or deletes it after an explicit confirmation, and the change is what every later visitor sees.

**Independent Test**: Log in, edit an existing text link's wording, target, and size, move a point of interest to a new spot, cancel one deletion and confirm another, then sign out and verify every change is visible to a logged-out visitor.

### Tests for User Story 4

- [X] T035 [P] [US4] Add lifecycle coverage to `backend/tests/test_annotations.py`: `PATCH` updates text, target, `text_scale`, and position, bumps `updated_at`, and is reflected on the next public read; an unauthenticated `PATCH` or `DELETE` returns `401` with the annotation unchanged; an unknown map or annotation returns `404`; a field belonging to the other kind and an unknown target map return `422` with nothing changed; an out-of-range `text_scale` is clamped; `DELETE` returns `200`, removes the annotation, and unlinks its image files; deleting the owning map removes the sidecar and its image files so the list then `404`s; and a text link whose target map was deleted afterwards still lists with `target_available: false` (FR-030, FR-039…FR-044, FR-046, SC-014, SC-015)

### Implementation for User Story 4

- [X] T036 [US4] Add `update_annotation(map_id, annotation_id, changes)` and `delete_annotation(map_id, annotation_id)` to `backend/app/annotations.py` — the update applies only supplied fields, rejects fields belonging to the other kind, re-validates the target map, clamps `text_scale`, and bumps `updated_at`; the delete removes the record and unlinks every image file it owned, all under the shared write lock (data-model.md → Lifecycle)
- [X] T037 [US4] Implement `PATCH` and `DELETE /{map_id}/annotations/{annotation_id}` in `backend/app/routes/annotations.py` behind `Depends(require_admin)`, returning the updated `Annotation` and a `MessageResponse` respectively, with `404` / `422` mapped onto the generic `ErrorResponse`
- [X] T038 [P] [US4] Add `updateAnnotation(mapId, annotationId, changes)` and `deleteAnnotation(mapId, annotationId)` to `frontend/src/app/core/api.service.ts` with `withCredentials: true`
- [X] T039 [US4] Extend `frontend/src/app/maps/annotation-editor.ts` and `annotation-editor.html` with edit mode — fields prefilled from the existing annotation, the size slider previewing changes live, and a two-step Delete → Confirm / Cancel control where cancelling leaves the annotation untouched (FR-039, FR-041)
- [X] T040 [US4] Wire editing into `frontend/src/app/maps/map-view.ts` — activating an existing annotation while a placement toggle is armed opens its editor instead of creating a new annotation, navigating to its target, or opening its popup; a Move action re-arms a single click to supply new `x`/`y` fractions; and the layer refreshes after every save or delete (FR-018, FR-040, FR-042)

**Checkpoint**: All four user stories are independently functional; annotations support the full place / edit / resize / move / delete lifecycle

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T041 [P] Handle a `401` returned mid-authoring in `frontend/src/app/maps/map-view.ts` by re-checking the session, dropping the toggles and any open editor, and prompting the admin to sign in again, so no partial annotation is left behind (spec Edge Cases → session expires while a toggle is on / mid-authoring)
- [X] T042 [P] Accessibility pass across `frontend/src/app/maps/map-view.html`, `annotation-layer.html`, and `poi-popup.html` — zoom, reset, every label, every marker, and the toggles reachable by Tab and operable with Enter/Space, `aria-pressed` announcing toggle state, and focus returned to the marker when its popup closes (FR-006, FR-010, SC-016)
- [X] T043 [P] Verify the crowded and degenerate cases in `frontend/src/styles.css` — a very long label and a long popup description wrap or scroll readably, an annotation under the toggles stays reachable, and an enlarged label near an edge is not clipped (spec Edge Cases)
- [X] T044 [P] Run `pytest` from `backend/` and confirm the new `test_annotations.py` passes and that `test_maps.py`, `test_auth.py`, `test_map.py`, and `test_session.py` are all still green through the `storage.py` extraction (Constitution → Pragmatic Testing)
- [X] T045 [P] Run `npm test` from `frontend/` and confirm `zoom-pan.spec.ts`, `map-view.spec.ts`, and the existing `maps.spec.ts` and `app.spec.ts` pass
- [X] T046 [P] Compare the FastAPI-generated schema at `http://localhost:8000/openapi.json` against `specs/004-map-zoom-annotations/contracts/openapi.yaml` and reconcile any drift in paths, status codes, or model fields — including that `/api/maps*` and `/api/map` are unchanged from `003` (Constitution → Clear API Contracts)
- [X] T047 Walk through all thirteen validation scenarios in `specs/004-map-zoom-annotations/quickstart.md`, including the authorization-boundary curls (scenario 7), the cascade check (scenario 9), the 50-annotation responsiveness check (scenario 11), and the existing-behavior parity check (scenario 13)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 must land before any annotation model or validator reads the bounds.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS US2, US3, and US4
- **US1 (Phase 3)**: Depends only on Setup. It is frontend-only and shares no file with Phase 2, so it can run alongside the foundational work.
- **US2–US4 (Phases 4–6)**: Depend on Foundational completion; they can then run in parallel or sequentially in priority order
- **Polish (Phase 7)**: Depends on the delivered user stories

### User Story Dependencies

- **US1 (P1)**: Independent of everything else — no API surface at all (research Decision 1). Delivers value on existing maps with no backend change.
- **US2 (P2)**: Starts after Phase 2. Uses the shared `POST` create endpoint delivered in T008; no dependency on US1, though placing an annotation while zoomed is only demonstrable once US1 lands.
- **US3 (P3)**: Starts after Phase 2. Reuses the same create endpoint with `kind: "poi"` and adds its own image sub-resource, so it does not depend on US2.
- **US4 (P4)**: Starts after Phase 2. Needs at least one annotation to correct — create one through the API, so no dependency on US2 or US3.

The single create endpoint sits in Foundational rather than in US2 because both annotation kinds are one discriminated union behind one handler (research Decision 6); splitting it per story would mean two stories editing the same function.

### Within Each User Story

- Tests are written first and must fail before the implementation lands
- `storage.py` before `catalog.py`/`annotations.py`; the annotations module before its route handlers; route handlers before the frontend that calls them
- Story complete and checkpoint-validated before moving to the next priority

### Same-File Serialization (no `[P]`)

- `backend/app/storage.py` → `backend/app/catalog.py`: T004 → T005 → T009
- `backend/app/annotations.py`: T007 → T027 → T036
- `backend/app/routes/annotations.py`: T008 → T028 → T037
- `backend/app/main.py`: T008 only
- `frontend/src/app/core/api.service.ts`: T012 → T029 → T038
- `frontend/src/app/maps/map-view.ts` / `map-view.html`: T015 → T019 → T020 → T023 → T024 → T032 → T040 → T041
- `frontend/src/app/maps/annotation-layer.ts` / `.html`: T021 → T030
- `frontend/src/app/maps/annotation-editor.ts` / `.html`: T022 → T033 → T039
- `frontend/src/styles.css`: T016 → T025 → T034 → T043
- `backend/tests/test_annotations.py`: T017 → T026 → T035 (each phase appends its own tests, so they are `[P]` only relative to the other tasks in their phase)

---

## Parallel Opportunities

- **Phase 1**: T002 and T003 run together with T001
- **Phase 2**: T006, T010, and T011 touch different files and run together; T005 follows T004, T007 follows T004+T006, T008/T009 follow T007, T012 follows T011
- **Phases 2 and 3 together**: US1 is entirely frontend view state, so one developer can build zoom/pan while another builds the annotation backend
- **Phase 3**: T013 and T016 run together while T014/T015 are written
- **Phase 4**: T017, T018, T021, and T025 run together; then T019/T020/T023/T024 serialize on `map-view.ts`
- **Phase 5**: T026 and T029–T031 and T034 run together; T027 → T028 serialize on the backend
- **Phase 6**: T035 and T038 run together; T036 → T037 serialize on the backend, T039 → T040 on the frontend
- **Phase 7**: T041–T046 run together; T047 runs last against the finished stack

### Parallel Example: Phase 2 Foundational

```bash
Task: "Add the annotation models and discriminated union in backend/app/models.py"
Task: "Add sample_png and make_map fixtures in backend/tests/conftest.py"
Task: "Add the annotation DTOs in frontend/src/app/core/api.types.ts"
```

### Parallel Example: User Story 2

```bash
Task: "Add text-link authorization and validation tests in backend/tests/test_annotations.py"
Task: "Add toggle visibility and mutual-exclusion tests in frontend/src/app/maps/map-view.spec.ts"
Task: "Create the annotation layer rendering text links in frontend/src/app/maps/annotation-layer.ts"
Task: "Add label and toggle styles in frontend/src/styles.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: US1 — zoom, pan, and reset
3. **STOP and VALIDATE**: quickstart scenario 1
4. Ship it — zoom alone is a complete improvement to every existing map, with no API change and nothing to configure

US1 is the smallest genuinely useful release precisely because it needs none of Phase 2.

### Incremental Delivery

1. Setup + US1 → every visitor can zoom and pan → demo
2. Foundational → annotations persist, list publicly, and cascade on map delete
3. US2 → admins connect maps with sized text links → demo
4. US3 → admins enrich maps with points of interest and popups → demo
5. US4 → admins correct and remove annotations → demo
6. Polish → session-expiry handling, accessibility, contract check, full quickstart pass

### Parallel Team Strategy

Developer A takes US1 immediately (frontend-only, no shared files) while Developer B builds Phase 2. Once Foundational lands, Developer B continues on the annotation backend for US2–US4 while Developer A builds the layer, editor, and popup. Both edit `map-view.ts`, `api.service.ts`, and `styles.css`, so coordinate on those three files or sequence the phases if a single developer is working alone.

---

## Notes

- `[P]` marks tasks in different files with no incomplete dependencies
- Authorization is enforced server-side by the existing `require_admin` dependency on every write; hiding the toggles in Angular is presentation only and never a substitute (FR-045, FR-046, SC-015)
- Annotation positions and label sizes are stored as fractions of the map image, never in screen pixels, so they survive zoom, pan, resize, and reload (FR-027, FR-038)
- `text_scale` is the one input that clamps rather than rejects, because FR-024 describes the size stopping at its limit; every other out-of-range value is refused
- Point-of-interest image filenames always derive from a server-generated id and the *detected* content type — never from the client-supplied filename (prevents path traversal)
- No image record is written before its bytes are fully received and validated, so a refused upload never leaves a POI referencing a missing file
- The `003` contract for `/api/maps*` and the `001`/`002` contract for `/api/map`, `/api/login`, `/api/logout`, and `/api/session` must remain unchanged — the `storage.py` extraction is a refactor with no behavior change
- No new runtime dependency on either side; `requirements.txt` and `package.json` stay untouched
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
