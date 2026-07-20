# Phase 0 Research: Map Landing & Admin Login

All Technical Context items were resolvable from the spec and constitution; there
are no outstanding NEEDS CLARIFICATION markers. This document records the key
decisions and the alternatives weighed against Principle I (Simplicity First).

## Decision 1: Session mechanism — signed HTTP-only cookie

- **Decision**: Represent the admin session with a signed, HTTP-only, `SameSite=Lax`
  cookie carrying an issued-at timestamp, signed with `itsdangerous` using a
  `SESSION_SECRET` from `.env`. Expiry is enforced server-side by validating the
  timestamp against a fixed max age (e.g. 8 hours).
- **Rationale**: No datastore is required (Principle I). The cookie is opaque to the
  browser JS (HTTP-only) so no credential/session secret reaches client code
  (FR-010, SC-005). Signing prevents tampering; server-side max-age gives clean
  expiry (FR-008, edge case "session expiry").
- **Alternatives considered**:
  - *Server-side session store (Redis / in-memory dict)*: adds a dependency or
    stateful process for a single-admin app — rejected as premature complexity.
  - *JWT (`python-jose`)*: heavier token semantics (claims, alg negotiation) than a
    single boolean "is admin" needs — rejected; itsdangerous is smaller and simpler.
  - *Starlette `SessionMiddleware`*: viable and also cookie-based; using
    `itsdangerous` directly keeps the mechanism explicit and testable without extra
    middleware coupling. Either is acceptable; the explicit helper is chosen for
    clarity in tests.

## Decision 2: Credential source — pydantic-settings from `.env`

- **Decision**: Load `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` via a
  `pydantic-settings` `BaseSettings` class that reads a `.env` file. `.env` is
  git-ignored; a committed `.env.example` documents the variables.
- **Rationale**: Satisfies FR-005/FR-010 (external config, out of VCS) with a typed,
  validated settings object aligned with Principle II. If credentials are absent, the
  settings are `None` and every login is refused (FR-011, SC-004).
- **Alternatives considered**:
  - *Raw `os.environ` reads*: works but untyped and scattered — a single settings
    model is clearer and centralizes validation.
  - *Hashed password in `.env`*: stronger, but for a single operator-managed secret
    a plaintext compare is adequate for this first step; can be upgraded later
    without changing the contract. Documented as a deliberate simplification.

## Decision 3: Credential comparison — constant-time compare

- **Decision**: Compare submitted username and password against configured values
  using `hmac.compare_digest` (constant-time). Return one generic error for any
  mismatch.
- **Rationale**: Prevents timing side-channels and satisfies FR-006/SC-004 (do not
  reveal which field was wrong; identical response for bad username vs bad password).
- **Alternatives considered**: plain `==` — rejected for timing-leak risk despite
  low threat; `compare_digest` is stdlib and free.

## Decision 4: Map asset delivery + fallback

- **Decision**: The backend serves the image via `GET /api/map` using FastAPI's
  `FileResponse` with `media_type=image/webp`. If the file is missing, respond `404`.
  The frontend `<img>` uses an `onerror` handler to swap in a friendly placeholder,
  so a missing/failed asset never shows a broken-image icon (FR-012, SC-006).
- **Rationale**: Keeps fallback logic where it belongs (presentation) while the
  backend stays a simple typed asset endpoint. Progressive display is handled by the
  browser's native image loading (edge case: large image / slow connection).
- **Alternatives considered**:
  - *Static mount only (no `/api/map`)*: acceptable, but an explicit endpoint gives a
    single documented contract and a clean place to add caching headers later.
  - *Base64-inlining the image in HTML*: rejected — bloats the page and defeats
    browser caching / progressive load.

## Decision 5: Frontend without a framework

- **Decision**: Plain HTML/CSS/JS (`fetch`), no build step, no npm framework. The
  "tracked manifest" for the frontend is a short `frontend/README.md` documenting
  that there are no runtime package dependencies.
- **Rationale**: Two pages and four `fetch` calls do not warrant a framework or
  bundler (Principle I). No build step keeps environments reproducible (Principle IV)
  with zero frontend install.
- **Alternatives considered**: React/Vue + bundler — rejected as disproportionate to
  the scope; would add toolchain and dependencies for negligible benefit here.

## Decision 6: Testing approach

- **Decision**: Backend contract/behavior tests with pytest + FastAPI `TestClient`,
  driving settings via environment overrides (configured creds, and an
  unconfigured-creds case). Cover: login success, wrong password, wrong username,
  missing fields, missing-creds safe-fail, session status pre/post login, logout,
  and map served / map-missing 404.
- **Rationale**: Targets exactly the risky paths per Principle V without over-testing
  trivial code. Frontend is thin and validated manually via `quickstart.md`.
- **Alternatives considered**: browser E2E (Playwright) — deferred; not warranted for
  this slice and adds toolchain weight.
