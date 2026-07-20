---
description: "Task list for Map Landing & Admin Login"
---

# Tasks: Map Landing & Admin Login

**Input**: Design documents from `/specs/001-map-landing-login/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/openapi.yaml

**Tests**: Backend contract/behavior tests ARE included — the spec (Constitution Principle V: Pragmatic Testing), plan.md (Testing: pytest + FastAPI `TestClient`), and research.md (Decision 6) explicitly require them for the risky auth/session/asset paths.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Web app** (per plan.md Structure Decision — Option 2): backend at `backend/`, frontend at `frontend/`, both at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the web-app directory skeleton per plan.md: `backend/app/`, `backend/app/routes/`, `backend/assets/`, `backend/tests/`, `frontend/css/`, `frontend/js/`
- [X] T002 Create `backend/requirements.txt` with pinned deps: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`, `itsdangerous`, `httpx`, `pytest`
- [X] T003 [P] Create `backend/.env.example` documenting `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` (no real secrets) and add a repo-root `.gitignore` ignoring `backend/.env`, `.venv/`, `__pycache__/`
- [X] T004 [P] Create empty package markers `backend/app/__init__.py` and `backend/app/routes/__init__.py`
- [X] T005 Move the map asset from `temp_assets/kal_main_map.webp` to `backend/assets/kal_main_map.webp`
- [X] T006 [P] Create `frontend/README.md` documenting that the frontend has no runtime package dependencies and how it is served (FastAPI static mount in dev)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement typed settings in `backend/app/config.py` using `pydantic-settings` `BaseSettings` that loads `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` from `.env` (all optional at load time), plus a `SESSION_MAX_AGE` constant (e.g. 8h) and an `is_configured` helper (FR-005, FR-010, FR-011, data-model "Admin Credentials")
- [X] T008 [P] Implement Pydantic request/response models in `backend/app/models.py`: `LoginRequest` (username/password min_length 1), `LoginResponse`, `SessionResponse`, `MessageResponse`, `ErrorResponse` (per contracts/openapi.yaml + data-model)
- [X] T009 [P] Implement signed-cookie session helpers in `backend/app/security.py` using `itsdangerous`: `issue_session()` (sign `{issued_at: now}`), `verify_session(cookie)` (valid signature AND `now - issued_at <= SESSION_MAX_AGE`), `clear_session()`, and cookie attribute config (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in prod) (data-model "Admin Session", research Decision 1)
- [X] T010 Create FastAPI app in `backend/app/main.py`: instantiate app, include routers (assets, auth — created in later phases), mount `frontend/` as static files for dev, and emit a startup warning when credentials are unconfigured (FR-011, research Decision 2/4)
- [X] T011 [P] Create `backend/tests/__init__.py` and a `backend/tests/conftest.py` providing a `TestClient` fixture plus fixtures for configured-creds and unconfigured-creds environments (research Decision 6)
- [X] T012 [P] Create shared frontend fetch wrappers in `frontend/js/api.js` for `GET /api/map` URL, `POST /api/login`, `POST /api/logout`, `GET /api/session` (credentials: 'include')

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Visitor sees the main map on arrival (Priority: P1) 🎯 MVP

**Goal**: Any visitor opening the site root sees `kal_main_map.webp` as primary content, scaled to the viewport, with a visible Login link and a graceful fallback if the asset is missing — no authentication required.

**Independent Test**: Open the site root in a fresh/incognito browser (not logged in) and confirm the main map fills the landing area without distortion and a Login link is visible; rename the asset and confirm a friendly placeholder appears instead of a broken image.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Contract test for `GET /api/map` in `backend/tests/test_map.py`: 200 + `image/webp` when asset present, and 404 with `ErrorResponse` when asset missing (FR-001, FR-012, SC-006)

### Implementation for User Story 1

- [X] T014 [US1] Implement the map endpoint in `backend/app/routes/assets.py`: `GET /api/map` returns `backend/assets/kal_main_map.webp` via `FileResponse` (`media_type=image/webp`), 404 with `ErrorResponse` when missing (FR-001, FR-012); register the router in `backend/app/main.py`
- [X] T015 [P] [US1] Create `frontend/index.html` landing page: an `<img>` that loads the map from `/api/map` with an `onerror` fallback placeholder container, plus a visible, non-obscuring Login link (FR-001, FR-003, FR-012)
- [X] T016 [P] [US1] Create `frontend/css/styles.css`: scale the map to fit the viewport without distorting aspect ratio, position the Login link so it does not obscure the map, and style the fallback placeholder (FR-002, SC-002)
- [X] T017 [US1] Implement `frontend/js/landing.js`: load the map via `api.js`, wire the `onerror` fallback, and reflect session state (show Login vs. logged-in badge/Logout by calling `GET /api/session`) (FR-003, FR-008)

**Checkpoint**: User Story 1 is fully functional and testable independently — the public landing map (the MVP) works with fallback.

---

## Phase 4: User Story 2 - Admin logs in with predefined credentials (Priority: P2)

**Goal**: An admin can log in with the operator-configured credentials to reach an authenticated state, is rejected with a generic message on bad/missing input, stays logged in across navigation until logout/expiry, and can log out.

**Independent Test**: Go to the login page, submit correct `.env` credentials → authenticated state reached and an HttpOnly `session` cookie is set; submit a wrong username OR wrong password → identical generic error, no cookie; log out → session ends.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [P] [US2] Contract test for `POST /api/login` in `backend/tests/test_auth.py`: success (200, sets cookie), wrong password and wrong username (both 401 with identical generic detail), missing/empty fields (422), and unconfigured-creds safe-fail (401 for any input) (FR-005, FR-006, FR-007, FR-011, SC-004)
- [X] T019 [P] [US2] Contract test for `GET /api/session` and `POST /api/logout` in `backend/tests/test_session.py`: session false before login, true after login, expiry/tampered cookie treated as unauthenticated, and logout clears the cookie / returns `MessageResponse` (FR-008, FR-009)

### Implementation for User Story 2

- [X] T020 [US2] Implement auth endpoints in `backend/app/routes/auth.py`: `POST /api/login` (validate via `LoginRequest`; constant-time `hmac.compare_digest` on username+password; refuse all when unconfigured; set signed HttpOnly cookie on success; single generic 401 on any mismatch), `POST /api/logout` (clear cookie, `MessageResponse`), `GET /api/session` (`SessionResponse` from `verify_session`); register the router in `backend/app/main.py` (FR-005..FR-011, research Decision 2/3)
- [X] T021 [P] [US2] Create `frontend/login.html`: username + password form with required attributes and an error message area (FR-004, FR-007)
- [X] T022 [US2] Implement `frontend/js/login.js`: client-side required-field check, submit credentials via `api.js`, show the generic error on failure, redirect to landing on success, and if already authenticated (`GET /api/session`) redirect away from the login page (FR-006, FR-007, FR-008, already-authenticated edge case)

**Checkpoint**: User Stories 1 AND 2 both work independently — public map plus full admin login/session/logout.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and validation that span both user stories

- [X] T023 [P] Ensure a friendly logged-in state on the landing page (logout control visible when authenticated) is consistent across `frontend/js/landing.js` and `frontend/js/login.js` redirects
- [X] T024 [P] Confirm no secrets leak: `.env` is git-ignored, `.env.example` has no real values, and no endpoint/response returns credential values (FR-010, SC-005)
- [X] T025 Run `pytest` from `backend/` and make the full suite pass (`test_map.py`, `test_auth.py`, `test_session.py`)
- [X] T026 Execute `specs/001-map-landing-login/quickstart.md` scenarios 1–8 end-to-end and confirm expected behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3, 4)**: All depend on Foundational completion
  - US1 (P1) and US2 (P2) are independent and can proceed in parallel once Phase 2 is done, or sequentially P1 → P2
- **Polish (Phase 5)**: Depends on the user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Only depends on Foundational (config, main app, api.js). No dependency on US2.
- **User Story 2 (P2)**: Only depends on Foundational (config, models, security helpers, api.js). No dependency on US1. (Landing page's logged-in badge is a shared enhancement covered in Polish.)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend endpoint before/independent of frontend page; shared helpers (Phase 2) before both
- Story complete before moving to next priority

### Parallel Opportunities

- Setup: T003, T004, T006 can run in parallel
- Foundational: T008, T009, T011, T012 can run in parallel (after T007 for config-dependent pieces)
- US1: T015 and T016 in parallel; test T013 before T014
- US2: tests T018 and T019 in parallel before T020; T021 in parallel with backend work
- Once Foundational completes, US1 and US2 can be built by different developers in parallel

---

## Parallel Example: User Story 1

```bash
# Write the failing test first:
Task: "Contract test for GET /api/map in backend/tests/test_map.py"

# Then build the frontend pieces in parallel:
Task: "Create frontend/index.html landing page"
Task: "Create frontend/css/styles.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (public landing map + fallback)
4. **STOP and VALIDATE**: Test US1 independently (quickstart scenarios 1–2)
5. Deploy/demo — the public map is live

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → test → deploy (MVP: public map)
3. Add User Story 2 → test → deploy (admin login/session/logout)
4. Polish → run full pytest + quickstart validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to a specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- No database: credentials come from `.env`; session lives in a signed HttpOnly cookie
