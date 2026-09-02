---
description: "Task list for feature 005-text-mark-styling"
---

# Tasks: Text Mark Styling & Region Links

**Input**: Design documents from `/specs/005-text-mark-styling/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: Test tasks ARE included. The plan's Technical Context requires extending `backend/tests/test_annotations.py` and `frontend/src/app/maps/map-view.spec.ts`, research Decision 10 defines that coverage set, and Constitution Principle V requires automated tests for auth, invalid color/typeface, legacy default projection, region geometry clamping, and kind-mismatch before the feature is complete. Hover/touch visual checks stay in [quickstart.md](./quickstart.md) (no Playwright).

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US5)
- Every task names its exact file path

## Path Conventions

Web application, two trees at the repository root (plan.md → Project Structure):

- **Backend**: `backend/app/`, tests in `backend/tests/`
- **Frontend**: `frontend/src/app/`, tests alongside components (`*.spec.ts`)
- **Runtime store**: `backend/data/annotations/` — same sidecar as `004`; new `kind` and fields inside the existing array

**No new dependency on either side.** `backend/requirements.txt` and `frontend/package.json` are untouched (plan.md → Primary Dependencies).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared bounds and typeface/color defaults that every later module reads. No new packages, env vars, or directories.

- [X] T001 Extend `backend/app/config.py` with the shared constants from data-model.md: `DEFAULT_TEXT_COLOR = "#f5f7fa"`, `DEFAULT_TYPEFACE = "sans"`, `TYPEFACES = ("sans", "serif", "condensed")`, `COLOR_PATTERN` (`^#[0-9a-f]{6}$`), `MIN_REGION_SIZE = 0.04`, `MAX_REGION_SIZE = 1.0`, `DEFAULT_REGION_WIDTH = 0.16`, `DEFAULT_REGION_HEIGHT = 0.10`, `MIN_OPACITY`/`MAX_OPACITY`, `MIN_BRIGHTNESS`/`MAX_BRIGHTNESS`, `DEFAULT_REST_APPEARANCE` (`color #4f9dff`, opacity `0`, brightness `1.0`), `DEFAULT_HOVER_APPEARANCE` (`color #4f9dff`, opacity `0.4`, brightness `1.0`). Leave `MIN_TEXT_SCALE` / `MAX_TEXT_SCALE` / `DEFAULT_TEXT_SCALE` unchanged. No new `Settings` fields.
- [X] T002 [P] Create `frontend/src/app/maps/annotation-constants.ts` mirroring those numeric and token values (typeface union, default text color, region size/opacity/brightness bounds and defaults) so sliders and clamp helpers do not hard-code them.
- [X] T003 [P] Create `frontend/src/app/maps/typeface.ts` mapping tokens `sans` / `serif` / `condensed` to the system stacks in research Decision 1 (`sans` matching today's inherit/`body` stack so existing maps do not visually jump). Unknown tokens resolve to `sans`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Typed contract and persistence for text-link `color`/`typeface`, plus frontend DTOs. Region-link union members wait for US3 so MVP (US1) can ship without region UI.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Extend `backend/app/models.py`: add `color` (`#rrggbb`) and `typeface` (`Literal["sans","serif","condensed"]`) as required on `TextLinkAnnotation`; optional on `CreateTextLinkRequest` and `AnnotationUpdateRequest` with the same pattern/enum; reject extra fields. Do **not** add `region_link` yet (US3). Field names, patterns, and required sets must match `specs/005-text-mark-styling/contracts/openapi.yaml` for the text-link schemas.
- [X] T005 Extend `backend/app/annotations.py`: on text-link create, store omitted `color`/`typeface` as `DEFAULT_TEXT_COLOR` / `DEFAULT_TYPEFACE`; reject invalid color or unknown typeface (`422`, nothing saved); add `color` and `typeface` to `_TEXT_LINK_ONLY_FIELDS` so POI create/update with those keys is kind-mismatch `422`; PATCH applies supplied style fields only (does not rewrite missing disk keys unless those fields are in the body). Keep existing `text_scale` clamping (depends on T001, T004).
- [X] T006 Extend `_to_api` in `backend/app/routes/annotations.py` so every text-link response always includes `color` and `typeface`; missing or unknown stored values become `DEFAULT_TEXT_COLOR` and `sans` (research Decision 7, FR-008). Do not add a sidecar migration (depends on T005).
- [X] T007 [P] Extend `frontend/src/app/core/api.types.ts`: add `color` and `typeface` to `TextLinkAnnotation`; optional `color`/`typeface` on create/update request types; `typeface` is `'sans' | 'serif' | 'condensed'`. Keep `Annotation` as `TextLinkAnnotation | PoiAnnotation` until US3.

**Checkpoint**: Admin create/update of text links can persist color and typeface; public GET always returns both fields; POI records still reject style fields — user stories can begin

---

## Phase 3: User Story 1 - Author styles a new text mark (Priority: P1) 🎯 MVP

**Goal**: An authenticated author creating a text mark can set color and typeface (with size), see a live preview, save, and visitors see that look and can still follow the link.

**Independent Test**: Log in, create a text mark, set size, color, and typeface away from defaults, save, then open the map signed out and confirm those choices and navigation (spec US1 Independent Test; quickstart scenario 1).

### Tests for User Story 1

- [X] T008 [P] [US1] Extend `backend/tests/test_annotations.py` with create cases: omitted color/typeface store and return `#f5f7fa` and `sans`; explicit non-default color and `serif`/`condensed` round-trip; `color: "red"` and `typeface: "comic"` return `422` and leave the list unchanged; unauthenticated POST with `color` returns `401` and does not create a mark (FR-007, FR-009, FR-010). Existing `004` cases must stay green.
- [X] T009 [P] [US1] Add Vitest coverage in `frontend/src/app/maps/typeface.spec.ts` (or beside `typeface.ts`) that `sans`/`serif`/`condensed` map to the Decision 1 stacks and an unknown token falls back to `sans`.

### Implementation for User Story 1

- [X] T010 [P] [US1] Apply saved and draft `color` and `typeface` on labels in `frontend/src/app/maps/annotation-layer.ts` and `frontend/src/app/maps/annotation-layer.html` (inline `color`, `font-family` from `typeface.ts`). Keep map-relative `font-size` from `text_scale`. Click still navigates (FR-014).
- [X] T011 [US1] Add a native `<input type="color">` and a typeface select (`sans` / `serif` / `condensed`) to `frontend/src/app/maps/annotation-editor.ts` and `frontend/src/app/maps/annotation-editor.html` for text links only; changing them updates the draft so the overlay preview reflects size, color, and typeface together before save (FR-001, FR-002, FR-004). Hide these controls for POI (FR-012). Use constants from `annotation-constants.ts`.
- [X] T012 [US1] Wire create payloads in `frontend/src/app/maps/map-view.ts` so POST includes `color` and `typeface` from the draft; draft preview uses the same fields. Visitors still see no authoring controls when signed out (FR-010). Size slider remains (FR-003).
- [X] T013 [P] [US1] Add any label typeface/color rules that cannot live as inline styles to `frontend/src/styles.css` without changing zoom/pan or POI marker look.

**Checkpoint**: A new text mark can be authored with color, typeface, and size, previewed, saved, and viewed signed-out — MVP is demoable

---

## Phase 4: User Story 2 - Author restyles an existing text mark (Priority: P2)

**Goal**: An authenticated author changes color, typeface, and/or size on an existing text mark without recreating it; wording, target, and position stay unless also edited; cancel leaves the store unchanged.

**Independent Test**: Log in, change only color and typeface on an existing mark, save, then confirm as a signed-out visitor that wording, destination, and position are unchanged (spec US2 Independent Test; quickstart scenario 3).

### Tests for User Story 2

- [X] T014 [P] [US2] Extend `backend/tests/test_annotations.py` with PATCH cases: color and typeface update without changing `text`, `target_map_id`, `x`, `y`; omitted style fields leave stored style unchanged; invalid color/typeface `422` leaves the record unchanged; PATCH `color` on a POI returns `422`; unauthenticated PATCH with `color` returns `401` (FR-011, FR-010, FR-012).

### Implementation for User Story 2

- [X] T015 [US2] When opening the editor on an existing text link, seed color and typeface from the annotation in `frontend/src/app/maps/annotation-editor.ts`; Cancel discards the draft with no HTTP write (FR-013).
- [X] T016 [US2] Include `color` and `typeface` in the PATCH body from `frontend/src/app/maps/map-view.ts` only when those fields are being saved (partial update); do not send region fields. Confirm signed-out visitors still have no restyle controls.

**Checkpoint**: Existing marks can be restyled in place; US1 create path still works

---

## Phase 5: User Story 3 - Author places an invisible region link (Priority: P2)

**Goal**: A third placement mode plants an axis-aligned rectangle linked to another map, invisible at rest by default, pan-safe, map-relative, and activatable by visitors.

**Independent Test**: Log in, plant a rectangle, link another map, leave rest appearance default (invisible), save, then as a signed-out visitor confirm the art is unchanged until hover/press and activation opens the linked map (spec US3 Independent Test; quickstart scenario 6).

### Tests for User Story 3

- [X] T017 [P] [US3] Extend `backend/tests/test_annotations.py` for `region_link`: create with only `kind`, `x`, `y`, `target_map_id` stores default width/height/rest/hover (`rest.opacity` `0`, hover opacity `0.4`); missing or unknown `target_map_id` is `422` and saves nothing; width/height outside `[MIN, MAX]` are clamped; a box that would leave the image is shifted/shrunk onto `[0,1]`; unauthenticated create is `401`; attaching an image to a region is `409`; `text`/`color`/`typeface` on region create/update is `422`; DELETE works for admin (FR-017, FR-020, FR-021, FR-029).
- [X] T018 [P] [US3] Add `frontend/src/app/maps/region-geometry.spec.ts` covering clamp-then-fit: min/max size, edge shift, and click-to-centre planting that stays on-image (research Decision 4–5).
- [X] T019 [P] [US3] Extend `frontend/src/app/maps/map-view.spec.ts`: a third region toggle; at most one of `label` / `poi` / `region` pressed; every fresh view starts `'off'`; selecting region deselects the others (FR-016, SC-013). Keep existing label/POI tests green.

### Implementation for User Story 3

- [X] T020 [US3] Add `RegionAppearance`, `RegionLinkAnnotation`, `CreateRegionLinkRequest`, and region fields on `AnnotationUpdateRequest` to `backend/app/models.py`; extend the create and response discriminated unions with `kind: "region_link"` per `contracts/openapi.yaml` (research Decision 6).
- [X] T021 [US3] Implement region create/update in `backend/app/annotations.py`: require existing `target_map_id`; default width/height/rest/hover; clamp size then fit `x,y,width,height` on the image (`x,y` = top-left); clamp opacity/brightness; reject invalid appearance color (`422`); kind-mismatch for region-only vs text/POI fields; `x,y` for regions are top-left, not centre (depends on T020).
- [X] T022 [US3] Project `region_link` in `backend/app/routes/annotations.py` `_to_api` including `target_available` (same catalog check as text links). Reuse existing PATCH/DELETE/list paths — no new URLs (depends on T021).
- [X] T023 [P] [US3] Add `RegionAppearance`, `RegionLinkAnnotation`, and create/update fields to `frontend/src/app/core/api.types.ts`; extend `Annotation` to `TextLinkAnnotation | PoiAnnotation | RegionLinkAnnotation`. `api.service.ts` URLs stay unchanged; payloads already accept the union.
- [X] T024 [US3] Implement `clampRegionGeometry` (and click-to-default-rect centred then fitted) in `frontend/src/app/maps/region-geometry.ts` using `annotation-constants.ts` (depends on T018 helpers expected by the spec).
- [X] T025 [US3] Extend `PlacementMode` in `frontend/src/app/maps/map-view.ts` and `frontend/src/app/maps/map-view.html` with `'region'`: third mutually exclusive toggle, starts `'off'`; a true click (existing pan threshold) plants a default rectangle and opens the editor; a drag that is pan creates nothing (FR-035, research Decision 5). Require `target_map_id` before save (FR-017). POST `kind: "region_link"`.
- [X] T026 [US3] Render region rectangles in `frontend/src/app/maps/annotation-layer.ts` and `frontend/src/app/maps/annotation-layer.html`: `left/top/width/height` percentages, **no** `translate(-50%, -50%)`; paint order regions (oldest first) then labels then POIs (research Decision 8); `pointer-events: auto` even at rest opacity 0 (FR-034); activation uses the same navigation / unavailable message as text links (FR-028).
- [X] T027 [US3] Extend `frontend/src/app/maps/annotation-editor.ts` and `frontend/src/app/maps/annotation-editor.html` for region drafts: no text field; required target map; width/height sliders with live preview (FR-018); explicit delete confirmation (FR-030). Size changes update the overlay before save.
- [X] T028 [P] [US3] Add region box layout (absolute %, hittable transparent fill) to `frontend/src/styles.css` without breaking label or POI positioning.

**Checkpoint**: Region links can be placed, saved invisible-at-rest, panned without accidental create, and followed by signed-out visitors

---

## Phase 6: User Story 4 - Author configures region hover appearance (Priority: P3)

**Goal**: Authors set independent rest and hover fill (color, opacity, brightness), preview both, and visitors see rest vs hover (or press-as-hover on touch).

**Independent Test**: Log in, set rest fully transparent and a distinct hover color/brightness/opacity, save, then as a signed-out visitor confirm rest vs hover and that the link still works (spec US4 Independent Test; quickstart scenario 7).

### Tests for User Story 4

- [X] T029 [P] [US4] Extend `backend/tests/test_annotations.py`: PATCH `rest` does not rewrite `hover` (and vice versa); opacity/brightness outside bounds are clamped and stored; invalid rest/hover `color` is `422`; rest opacity `0` remains a valid saved region (FR-032, FR-033, FR-034).

### Implementation for User Story 4

- [X] T030 [US4] Add rest and hover controls (native color input, opacity and brightness sliders) to `frontend/src/app/maps/annotation-editor.ts` and `frontend/src/app/maps/annotation-editor.html`, with a way to preview hover without saving (FR-022, FR-023). Clamp slider ends to `annotation-constants.ts`. PATCH only the appearances being saved.
- [X] T031 [US4] Apply `rest` vs `hover` in `frontend/src/app/maps/annotation-layer.ts` / `frontend/src/app/maps/annotation-layer.html` using CSS `:hover`, `:focus-visible`, and `:active` (touch press) plus `filter: brightness()` (research Decision 3, FR-024, FR-025). Authenticated map views pass an `authoring` flag for a dashed outline and a slightly visible hit fill when rest opacity is 0 (FR-031); visitors get no outline.
- [X] T032 [P] [US4] Add region rest/hover/authoring-outline rules to `frontend/src/styles.css` (no author-configurable transition timing).

**Checkpoint**: Hover/rest appearance is authorable and visible to visitors; US3 placement and navigation still work

---

## Phase 7: User Story 5 - Older text marks keep a sensible look (Priority: P4)

**Goal**: Text links stored with size only (no `color`/`typeface` keys) render at saved size with default color and `sans`, stay clickable, and can be restyled without recreate.

**Independent Test**: Open a map whose sidecar text links lack `color`/`typeface`, confirm default look at saved sizes, then log in and assign a custom color/typeface to one (spec US5 Independent Test; quickstart scenario 5).

### Tests for User Story 5

- [X] T033 [P] [US5] Extend `backend/tests/test_annotations.py`: write a sidecar record that has `text_scale` but omits `color` and `typeface`; GET lists `#f5f7fa` and `sans` without rewriting the file until PATCH; a mixed list of legacy and fully styled marks each keep their own values; PATCH color on a legacy mark persists color and still projects typeface default until typeface is supplied (FR-008, SC-004, research Decision 7).

### Implementation for User Story 5

- [X] T034 [US5] Confirm `frontend/src/app/maps/annotation-layer.ts` and `frontend/src/app/maps/annotation-editor.ts` treat API-projected defaults as current values (no extra client-side “missing field” branch). Mixed maps render each mark independently. If GET already always includes the fields (T006), this task is the UI/editor verification plus any fallback if a token is still unknown.

**Checkpoint**: Pre-feature text marks look like today’s labels and can be restyled; new styled marks are unchanged

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Contract alignment, regression, and the run-and-verify guide

- [X] T035 [P] Confirm FastAPI-generated OpenAPI for annotation schemas still matches `specs/005-text-mark-styling/contracts/openapi.yaml` (text `color`/`typeface` required on read, `region_link` union member, no new paths). Adjust `backend/app/models.py` only if the runtime schema drifted.
- [X] T036 [P] Points of interest: no color/typeface/region controls in `frontend/src/app/maps/annotation-editor.html`; POST/PATCH of those fields on POI remains `422` (covered in tests; FR-012, quickstart scenario 10).
- [X] T037 Run `python -m pytest tests/test_annotations.py` from `backend/` (venv) and `npx vitest run src/app/maps/map-view.spec.ts` plus new `typeface.spec.ts` / `region-geometry.spec.ts` from `frontend/` — existing `004` cases stay green (quickstart scenario 11).
- [ ] T038 Walk [quickstart.md](./quickstart.md) scenarios 1–10 against `./run` (styled create, invalid curl 422, restyle/cancel, unauth 401, legacy sidecar, region place/pan, hover/touch, author outline, missing target, POI unchanged).
- [X] T039 Confirm `backend/requirements.txt` and `frontend/package.json` have no new dependencies.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 (models/persistence import config constants). T007 can start after T004’s field names are known
- **User Story 1 (Phase 3)**: Depends on Foundational. Tests T008–T009 should fail until T005–T006 and T003 exist
- **User Story 2 (Phase 4)**: Depends on Foundational; shares editor/layer with US1 — implement after US1 if one developer, or in parallel if US1 editor already exposes draft color/typeface
- **User Story 3 (Phase 5)**: Depends on Foundational (not on US1 UI). Can start after Phase 2 if staffed separately; models/persistence for `region_link` live in this phase
- **User Story 4 (Phase 6)**: Depends on US3 (region records and overlay must exist)
- **User Story 5 (Phase 7)**: Depends on Foundational projection (T006); independently testable with a legacy sidecar; editor restyle reuses US2
- **Polish (Phase 8)**: Depends on the stories you intend to ship

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 — no dependency on regions
- **User Story 2 (P2)**: After Phase 2 — PATCH styling; editor UX is smoother if US1 controls exist
- **User Story 3 (P2)**: After Phase 2 — adds `region_link`; does not require styled text UI
- **User Story 4 (P3)**: After US3
- **User Story 5 (P4)**: After Phase 2 (GET defaults); restyle uses US2

### Within Each User Story

- Tests (where listed) are written first and should fail before the matching implementation
- Models before persistence before routes (US3)
- Overlay/editor before map-view wiring when they share the draft type
- Story complete before raising priority to the next slice if shipping incrementally

### Parallel Opportunities

- T002 and T003 in Phase 1
- T007 with T005/T006 once field names from T004 are stable
- T008 and T009 in US1
- T010 and T013 after types exist
- T017, T018, T019 in US3
- T023 with T020 once schema names are stable
- T035 and T036 in polish
- After Phase 2, US1 (text UI) and US3 (region backend+UI) can proceed in parallel on different files; do not edit `models.py` / `annotations.py` concurrently without sequencing T004–T006 vs T020–T022

---

## Parallel Example: User Story 1

```bash
# Tests (after Phase 2 types exist):
Task: "Extend backend/tests/test_annotations.py for create color/typeface, 422, 401"
Task: "Add frontend/src/app/maps/typeface.spec.ts stack mapping tests"

# Implementation (different files):
Task: "Apply color and font-family in frontend/src/app/maps/annotation-layer.ts/.html"
Task: "Add typeface CSS only if needed in frontend/src/styles.css"
```

---

## Parallel Example: User Story 3

```bash
# Tests first:
Task: "Region lifecycle tests in backend/tests/test_annotations.py"
Task: "Clamp/fit tests in frontend/src/app/maps/region-geometry.spec.ts"
Task: "Third placement mode tests in frontend/src/app/maps/map-view.spec.ts"

# Then backend union (sequential: models → persistence → routes):
Task: "Region models in backend/app/models.py"
Task: "Region persist/clamp in backend/app/annotations.py"
Task: "Region projection in backend/app/routes/annotations.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (constants, typeface map)
2. Complete Phase 2: Foundational (text style on the existing seven endpoints)
3. Complete Phase 3: User Story 1 (create + preview + visitor view)
4. **STOP and VALIDATE**: Independent Test for US1 and quickstart scenarios 1–2, 4 (text half)
5. Demo styled labels without region links

### Incremental Delivery

1. Setup + Foundational → style fields persist and appear on GET
2. US1 → new marks can be styled → MVP
3. US2 → existing marks restyled in place
4. US5 → legacy sidecars (can also land right after Phase 2 tests)
5. US3 → invisible region hotspots
6. US4 → hover appearance polish
7. Each story leaves prior stories green (`004` + new tests)

### Parallel Team Strategy

1. Together: Phase 1 + Phase 2
2. Then:
   - Developer A: US1 → US2 → US5
   - Developer B: US3 → US4 (after B takes `models.py` / `annotations.py` / `routes/annotations.py` for `region_link`)
3. Integrate on `map-view.ts` last (placement union + draft payloads)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps the task to spec.md US1–US5
- Do not add webfonts, a color-picker library, a `/regions` collection, or a migration job (research Decisions 1, 2, 6, 7)
- Region placement is click-to-plant + sliders, not rubber-band drag (Decision 5, FR-035)
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
