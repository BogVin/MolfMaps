# Implementation Plan: Map Landing & Admin Login

**Branch**: `001-map-landing-login` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-map-landing-login/spec.md`

## Summary

Deliver the first slice of the MolfMaps website: a public landing page that renders
the main map image (`kal_main_map.webp`) with no authentication required, plus an
admin login flow that authenticates a single operator against credentials supplied
via a `.env` file. The backend is a Python FastAPI service exposing a small typed
REST API (serve map asset, login, logout, session status); the frontend is plain
JavaScript that renders the landing map, provides a login page, and reflects the
authenticated state. Sessions are held in a signed, HTTP-only cookie so no database
is needed for this feature.

## Technical Context

**Language/Version**: Python 3.11 (backend); ES2020 vanilla JavaScript (frontend)

**Primary Dependencies**: FastAPI, Uvicorn (ASGI server), Pydantic v2,
pydantic-settings (`.env` loading), itsdangerous (signed session cookie),
passlib is NOT required (plaintext compare of a single env credential). Frontend:
no framework — plain HTML/CSS/JS served as static files.

**Storage**: N/A — no database. Admin credentials are read from `.env`; session
state lives entirely in a signed HTTP-only cookie.

**Testing**: pytest + FastAPI `TestClient` (httpx) for backend API/contract tests.

**Target Platform**: Linux/macOS server running Uvicorn; modern desktop & mobile
browsers with WebP support.

**Project Type**: Web application (separate `backend/` and `frontend/`).

**Performance Goals**: Landing map visible within 3s on typical broadband (SC-002);
login round-trip completes well under the 30s / 2-step budget (SC-003).

**Constraints**: Credentials never committed to VCS and never sent to the browser
(FR-010, SC-005); safe failure when credentials are unconfigured (FR-011);
graceful map fallback (FR-012). Session cookie MUST be HTTP-only.

**Scale/Scope**: Single admin identity; single map asset; ~4 API endpoints; 2
frontend pages (landing, login). Low traffic, single-instance deployment.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First (YAGNI) | PASS | No database, no user table, no auth framework. Single admin from `.env`; cookie session via `itsdangerous`. No speculative multi-user/roles. |
| II. Clear API Contracts | PASS | All endpoints are typed FastAPI routes with Pydantic request/response models; OpenAPI is the contract. See `contracts/`. |
| III. Frontend/Backend Separation | PASS | Frontend is static JS talking to the backend only over HTTP REST. Business logic (auth, session) is backend-only. |
| IV. Reproducible Environments | PASS | Backend runs in a `venv`; deps pinned in `backend/requirements.txt`. Frontend has no build deps (documented in `frontend/README`). |
| V. Pragmatic Testing | PASS | Critical paths (login success/failure, missing-creds safety, session status, logout) covered by pytest contract tests. |

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-map-landing-login/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI app, static mounts, CORS/session config
│   ├── config.py          # pydantic-settings: loads ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET
│   ├── security.py        # signed-cookie session helpers (issue/verify/clear)
│   ├── models.py          # Pydantic request/response models
│   └── routes/
│       ├── __init__.py
│       ├── auth.py        # POST /api/login, POST /api/logout, GET /api/session
│       └── assets.py      # GET /api/map  (serves kal_main_map.webp with fallback semantics)
├── assets/
│   └── kal_main_map.webp  # moved from temp_assets/ during implementation
├── tests/
│   ├── test_auth.py       # login success/failure, missing fields, missing-creds safety, logout
│   ├── test_session.py    # session status before/after login, expiry behavior
│   └── test_map.py        # map served, fallback when asset missing
├── .env.example           # documents required vars (no real secrets)
└── requirements.txt       # pinned deps

frontend/
├── index.html             # landing page: renders map, login link, fallback placeholder
├── login.html             # login form (username, password, error area)
├── css/
│   └── styles.css
├── js/
│   ├── api.js             # fetch wrappers for the REST endpoints
│   ├── landing.js         # load map + reflect session (logged-in badge / logout)
│   └── login.js           # submit credentials, handle errors, redirect on success
└── README.md              # how to serve/run the frontend
```

**Structure Decision**: Option 2 (Web application) — the spec and constitution
mandate a separated JavaScript frontend and Python FastAPI backend communicating
over HTTP. The backend owns auth/session/asset logic; the frontend is static and
presentation-only. FastAPI serves the frontend static files in development for a
single-command run, but the two remain logically decoupled (frontend calls the
REST API and does not import backend code).

## Complexity Tracking

> No constitution violations; this section intentionally left empty.
