# Tasks: Migrate Frontend to Angular

**Input**: Design documents from `/specs/002-angular-frontend/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/openapi.yaml

**Tests**: Not requested for this feature. Per plan.md (Decision 7 / Principle V), the backend pytest suite remains the automated safety net and Angular UX is validated manually via `quickstart.md`. No automated frontend test tasks are generated; optional unit tests may be added ad hoc for non-trivial helpers.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app: backend at `backend/` (unchanged behavior), Angular frontend at `frontend/`
- Angular source under `frontend/src/app/` (standalone components, Angular 22)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the Angular application and reproducible toolchain in `frontend/` without yet retiring the plain frontend (cutover happens in US3).

- [X] T001 Scaffold an Angular 22 CLI app into a fresh `frontend/` tree (standalone, routing enabled, CSS): generate `frontend/package.json`, `frontend/package-lock.json`, `frontend/angular.json`, `frontend/tsconfig*.json`, `frontend/src/index.html`, `frontend/src/main.ts`, and `frontend/src/app/app.ts` + `frontend/src/app/app.config.ts` + `frontend/src/app/app.routes.ts`. Preserve the existing plain files (`frontend/index.html`, `frontend/login.html`, `frontend/css/`, `frontend/js/`) side-by-side for now; they are retired in Phase 5 (US3).
- [X] T002 Pin Angular/CLI dependency versions in `frontend/package.json` and verify `npm ci` (or `npm install`) succeeds against `frontend/package-lock.json` for reproducible installs (Principle IV).
- [X] T003 [P] Add the Angular dev proxy at `frontend/proxy.conf.json` mapping `/api` → `http://localhost:8000`, and wire `npm start` to `ng serve --proxy-config proxy.conf.json` in `frontend/package.json` scripts.
- [X] T004 [P] Port the existing visual styles for parity (FR-012) into `frontend/src/styles.css` from `frontend/css/styles.css` (CSS variables, `.site-header`, `.map-stage`/`.map-image` scaling, `.map-fallback`, `.login-*`, `.btn*` classes).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core app wiring (providers, routing shell, typed API service) that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Configure application providers in `frontend/src/app/app.config.ts`: `provideRouter(routes)` and `provideHttpClient(withFetch())` with credentials enabled (`withCredentials: true` via `HttpClient` options or an interceptor) so the HttpOnly session cookie is sent/received (research Decision 3, FR-006).
- [X] T006 Define routes in `frontend/src/app/app.routes.ts`: `'' → Home`, `'login' → Login`, with a wildcard redirect to `''` so deep links and refresh work (research Decision 4, edge cases).
- [X] T007 Implement the root shell in `frontend/src/app/app.ts` / `frontend/src/app/app.html` rendering only `<router-outlet>` (no duplicated per-page chrome).
- [X] T008 Define typed API DTOs in `frontend/src/app/core/api.types.ts` matching `contracts/openapi.yaml`: `LoginRequest`, `LoginResponse`, `SessionResponse`, `MessageResponse`, `ErrorResponse`.
- [X] T009 Implement the thin `ApiService` in `frontend/src/app/core/api.service.ts` using `HttpClient` with `withCredentials: true`: `getSession()` → `SessionResponse`, `login(username, password)` → `LoginResponse`, `logout()` → `MessageResponse`, and a `mapUrl = '/api/map'` constant. It MUST NOT embed or hardcode admin credentials (FR-005, SC-007).

**Checkpoint**: Foundation ready — providers, routing, and the API service exist; user story implementation can begin.

---

## Phase 3: User Story 1 - Visitor sees the main map after migration (Priority: P1) 🎯 MVP

**Goal**: The Angular home route shows the main map image as primary content without auth, with viewport-appropriate scaling, a visible login link, and a graceful fallback when the map fails to load.

**Independent Test**: Open `/` in a fresh/incognito browser (not logged in) and confirm the main map displays as primary content, is scaled without distortion, a Login control is visible without obscuring the map, and removing the map asset shows a graceful fallback instead of a broken image.

### Implementation for User Story 1

- [X] T010 [US1] Create the Home component in `frontend/src/app/home/home.ts` + `frontend/src/app/home/home.html`: header with brand and a `session-nav` area, a `<main class="map-stage">` with the map `<img>` bound to `ApiService.mapUrl` (`/api/map`) and an `alt` text (FR-002).
- [X] T011 [US1] Add the login navigation control on the home view in `frontend/src/app/home/home.html` (Angular `routerLink="/login"`), visible and not obscuring the map (FR-003).
- [X] T012 [US1] Implement graceful map fallback in `frontend/src/app/home/home.ts` + `frontend/src/app/home/home.html`: bind the image `(error)` event to swap to a `.map-fallback` card and hide the broken image, including the cached-error case where the image already failed (FR-008, quickstart scenario 2).
- [X] T013 [US1] Ensure map scaling parity in `frontend/src/styles.css` (`.map-image` `object-fit: contain`, `max-width/height` to fit viewport) so the map is primary content within ~3s without aspect-ratio distortion (FR-002, SC-002).

**Checkpoint**: User Story 1 is fully functional and independently testable (public landing + fallback).

---

## Phase 4: User Story 2 - Admin can log in and out after migration (Priority: P1)

**Goal**: A login route with validated fields authenticates the admin against the backend, reflects authenticated state across navigation/refresh, supports logout, and handles an already-logged-in visit to `/login` without a useless re-prompt.

**Independent Test**: Submit correct credentials and confirm authenticated state (Logout shown); submit wrong/empty credentials and confirm denial with a generic error and no auth; refresh while logged in and confirm still recognized; log out and confirm session ends; visit `/login` while authenticated and confirm sensible handling.

### Implementation for User Story 2

- [X] T014 [US2] Create the Login component in `frontend/src/app/login/login.ts` + `frontend/src/app/login/login.html`: a form with username/password fields and a submit button, using Angular forms with required-field validation that blocks submit and does not call the API when a field is empty (FR-004, data-model validation).
- [X] T015 [US2] Implement login submission in `frontend/src/app/login/login.ts` calling `ApiService.login(...)`, navigating to `/` on success and showing a single generic, non-revealing error on `401` (FR-004, FR-005, SC-004); disable the submit button while the request is in flight.
- [X] T016 [US2] Handle already-authenticated visits to `/login` in `frontend/src/app/login/login.ts` by calling `ApiService.getSession()` on init and redirecting to `/` when authenticated (User Story 2 §6, research Decision 4).
- [X] T017 [US2] Reflect authenticated session on the home view in `frontend/src/app/home/home.ts` + `frontend/src/app/home/home.html`: call `ApiService.getSession()` to show a "Logged in" badge + Logout button when authenticated, or the Login link when not (FR-006).
- [X] T018 [US2] Implement logout in `frontend/src/app/home/home.ts` calling `ApiService.logout()` and refreshing the reflected session state so admin chrome disappears (FR-007, quickstart scenario 5).
- [X] T019 [P] [US2] Add backend-unavailable / error feedback in `frontend/src/app/login/login.ts` and `frontend/src/app/home/home.ts` so failed session/login requests show a clear error or loading indication instead of hanging silently (edge cases, quickstart scenario 9).

**Checkpoint**: User Stories 1 AND 2 both work independently (public landing, login/logout, session reflection).

---

## Phase 5: User Story 3 - Contributors work only with the Angular frontend (Priority: P2)

**Goal**: Full cutover — the Angular app is the sole active frontend; the plain HTML/JS is retired from the delivery path and documentation reflects the Angular workflow.

**Independent Test**: Follow `frontend/README.md` only, start the frontend, and confirm the served visitor UI is the Angular app (not `index.html`/plain static site); confirm the plain frontend is no longer the active entry point.

### Implementation for User Story 3

- [X] T020 [US3] Update the backend static mount in `backend/app/main.py` so the plain `frontend/` HTML/JS is no longer served as the live visitor UI: either mount the Angular production build directory (e.g. `frontend/dist/...`) at `/` for optional single-origin runs, or remove the plain static mount entirely (research Decision 5, FR-010, SC-005). Keep `/api/*` routes taking precedence.
- [X] T021 [P] [US3] Remove the retired plain frontend files from the active tree: delete `frontend/index.html`, `frontend/login.html`, `frontend/js/api.js`, `frontend/js/landing.js`, `frontend/js/login.js`, and `frontend/css/styles.css` (superseded by the Angular app and `frontend/src/styles.css`) (FR-010, SC-005).
- [X] T022 [US3] Rewrite `frontend/README.md` to document the Angular workflow as the sole active frontend: prerequisites (Node LTS + npm), `npm ci`, `npm start` (proxy to `:8000`), optional single-origin served-build mode, and the two routes `/` and `/login` (FR-011, SC-006).

**Checkpoint**: All user stories functional; exactly one active frontend delivery path.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify parity and reproducibility across the migration.

- [X] T023 Produce a production build via `npm run build` in `frontend/` and confirm no admin credential values appear in source, build output, or delivered assets (SC-007), and that `frontend/.gitignore` excludes `node_modules/` and `dist/`.
- [X] T024 [P] Confirm the existing backend pytest suite still passes: run `pytest` in `backend/` (contract safety net unchanged, FR-009).
- [X] T025 Run all `specs/002-angular-frontend/quickstart.md` validation scenarios (1–9) against the Angular app and record parity with the pre-migration product (SC-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 (P1) and US2 (P1) can proceed in parallel after Foundational (mostly different files; note US2 T017/T018 edit `home.*` created in US1 T010/T012).
  - US3 (P2) cutover should run after US1 and US2 are validated (removing the plain frontend before the Angular app works would break the visitor UI).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P1)**: Can start after Foundational — session reflection (T017/T018) extends the Home component from US1; sequence those after T010/T012 or coordinate edits.
- **User Story 3 (P2)**: Depends on US1 + US2 being functional (cutover retires the fallback plain frontend).

### Within Each User Story

- Components/templates before wiring behavior.
- API service (Phase 2) before any component that calls it.
- Story complete and validated before moving to the next priority.

### Parallel Opportunities

- Setup: T003 and T004 can run in parallel with each other after T001/T002.
- Foundational: T008 (types) can precede/parallel T009 (service); T005–T007 touch distinct files.
- After Foundational: US1 and US2 can be staffed in parallel (watch the shared `home.*` edits).
- Polish: T024 (backend pytest) is independent of frontend tasks and marked [P].

---

## Parallel Example: Setup Phase

```bash
# After scaffolding (T001) and pinning deps (T002):
Task: "Add dev proxy at frontend/proxy.conf.json and npm start script (T003)"
Task: "Port parity styles into frontend/src/styles.css (T004)"
```

## Parallel Example: User Stories (after Foundational)

```bash
# Two developers after Phase 2 completes:
Developer A -> User Story 1: T010, T011, T012, T013 (frontend/src/app/home/*)
Developer B -> User Story 2: T014, T015, T016 (frontend/src/app/login/*)
# Then coordinate US2 session-reflection edits to home (T017, T018).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (public map landing + fallback).
4. **STOP and VALIDATE**: quickstart scenarios 1–2, 7.
5. Demo the Angular landing behind `ng serve` + proxy.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → demo (MVP: public map landing).
3. US2 → validate → demo (login/logout + session reflection).
4. US3 → cutover, retire plain frontend, update docs.
5. Polish → build hygiene, backend tests green, full quickstart parity.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- No new backend business endpoints (FR-009); only the static-mount cutover in `backend/app/main.py` (T020) touches the backend.
- Never embed admin credentials in frontend source, build output, or assets (FR-005, SC-007).
- Commit after each task or logical group; validate stories at their checkpoints.
