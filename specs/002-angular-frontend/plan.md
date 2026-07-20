# Implementation Plan: Migrate Frontend to Angular

**Branch**: `002-angular-frontend` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-angular-frontend/spec.md`

## Summary

Replace the plain HTML/CSS/JS frontend with an Angular application that preserves
behavioral parity for public map landing, admin login/logout, session reflection,
and map fallback — without changing the FastAPI backend or its HTTP contract.
The Angular app talks to existing endpoints (`GET /api/map`, `POST /api/login`,
`POST /api/logout`, `GET /api/session`) with cookie credentials; the retired
plain frontend is removed from the delivery path, and docs describe Angular as
the sole active frontend.

## Technical Context

**Language/Version**: TypeScript (Angular/TypeScript toolchain) for the frontend;
Python 3.11 backend unchanged from `001-map-landing-login`.

**Primary Dependencies**: Angular 22 (standalone components, Angular Router,
`HttpClient`); Angular CLI for scaffold/build/serve. Backend deps unchanged
(FastAPI, Uvicorn, Pydantic, itsdangerous, pydantic-settings).

**Storage**: N/A — no frontend persistence beyond reflecting the existing
HttpOnly session cookie owned by the backend.

**Testing**: Existing backend pytest suite remains the automated contract suite.
Frontend validation is primarily manual via `quickstart.md` (parity scenarios).
Optional lightweight Angular unit tests only if they cover non-trivial client
logic without expanding toolchain weight unnecessarily.

**Target Platform**: Modern desktop & mobile browsers (same audience as today);
Linux/macOS local dev with Node.js LTS for Angular CLI and Python `venv` for
the backend.

**Project Type**: Web application (separated `backend/` + Angular `frontend/`).

**Performance Goals**: Home map visible within ~3s on typical broadband (SC-002);
login in ≤2 steps and under 30s (SC-003) — same bars as pre-migration.

**Constraints**: No new backend business endpoints (FR-009); no hardcoded admin
credentials in frontend source, build, or browser assets (FR-005, SC-007);
visual/interaction parity — no intentional redesign (FR-012); session cookie
must continue to work under the documented local run setup (proxy or served
build); single active frontend delivery path after cutover (FR-010, SC-005).

**Scale/Scope**: Two routes (home, login); four existing API calls; full cutover
of a small frontend (not a dual-UI period).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First (YAGNI) | PASS (justified) | Angular + npm toolchain is heavier than the current plain frontend. Justified by stakeholder-chosen migration (spec FR-001 / assumptions) and sole-frontend cutover. Scope stays minimal: two routes, thin API service, no state-management library, no UI kit, no SSR. See Complexity Tracking. |
| II. Clear API Contracts | PASS | No new backend endpoints. Frontend consumes the existing OpenAPI contract (`contracts/openapi.yaml`, same shapes as `001`). |
| III. Frontend/Backend Separation | PASS | Angular communicates only over HTTP REST; auth/session/asset logic remains backend-only. Backend MUST NOT depend on Angular build artifacts to function (API still works without UI). Serving built static files is optional packaging, not a logic dependency. |
| IV. Reproducible Environments | PASS | Frontend deps declared and pinned via `package.json` + lockfile; Node/npm install from that manifest. Backend remains `venv` + pinned `requirements.txt`. |
| V. Pragmatic Testing | PASS | Backend critical paths already covered. Migration validates UI parity via quickstart scenarios; no mandatory heavy E2E suite for this cutover. |

**Result**: PASS — Angular adoption is recorded under Complexity Tracking; no
unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-angular-frontend/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # Unchanged API contract consumed by Angular
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/                   # Unchanged API behavior from 001
├── app/
│   ├── main.py            # Stop mounting plain frontend; optionally serve
│   │                      # Angular production build for single-origin run
│   ├── config.py
│   ├── security.py
│   ├── models.py
│   └── routes/
│       ├── auth.py        # POST /api/login|logout, GET /api/session
│       └── assets.py      # GET /api/map
├── assets/
│   └── kal_main_map.webp
├── tests/                 # Existing pytest suite remains green
├── .env.example
└── requirements.txt

frontend/                  # Angular application (replaces plain HTML/JS)
├── package.json           # Pinned Angular/CLI deps + scripts
├── package-lock.json      # Lockfile for reproducible installs
├── angular.json
├── tsconfig*.json
├── proxy.conf.json        # Dev: proxy /api → http://localhost:8000
├── public/                # Static assets if any (parity styles/images)
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.css         # Ported visual styles for parity (FR-012)
│   ├── app/
│   │   ├── app.config.ts  # provideRouter, provideHttpClient(withCredentials)
│   │   ├── app.routes.ts  # '' → Home, 'login' → Login
│   │   ├── app.ts         # Root shell
│   │   ├── core/
│   │   │   └── api.service.ts   # HttpClient wrappers for /api/*
│   │   ├── home/
│   │   │   └── home.ts          # Map image, login link, session/logout UI
│   │   └── login/
│   │       └── login.ts         # Form, validation, errors, redirect
│   └── environments/      # Optional API base (empty when using proxy)
└── README.md              # Sole frontend run/dev docs (FR-011)
```

**Structure Decision**: Keep the existing web-app split (`backend/` + `frontend/`).
Replace the contents of `frontend/` with an Angular CLI app so contributors have
one frontend tree. Development uses `ng serve` + API proxy for cookie-safe
same-origin `/api` calls; optionally mount the Angular build from FastAPI for a
single-command same-origin experience after cutover. Plain `index.html` /
`login.html` / `js/` are removed from the active path (FR-010).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Adopt Angular + Node/npm toolchain for a two-page UI | Stakeholder-required framework migration (FR-001); TypeScript via Angular is explicitly accepted in the spec assumptions | Keeping plain HTML/JS satisfies YAGNI but contradicts the feature goal of a single Angular frontend delivery path |
| Angular Router + HttpClient (framework services) | Needed for bookmarkable routes and cookie-bearing API calls with parity UX | Raw `fetch` in plain files already works but is retired by this feature |
