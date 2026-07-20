# Phase 1 Data Model: Migrate Frontend to Angular

This feature adds **no database and no new backend entities**. Persistence and
session semantics remain those of `001-map-landing-login`. Below are the
frontend-facing concepts Angular must model in the client (presentation state
and API DTOs only).

## Entity: Main Map Asset (unchanged)

Presented on the home view; still served by `GET /api/map`.

| Attribute | Value |
|-----------|-------|
| Source URL | `/api/map` (relative; via proxy or same-origin build) |
| Media type | `image/webp` |
| Auth | Public |
| Failure | HTTP error / image load failure → graceful fallback UI (FR-008) |

Angular responsibility: render the image with viewport-appropriate scaling and
no aspect-ratio distortion; swap to fallback on load failure (parity with current
`onerror` behavior).

## Entity: Admin Session (backend-owned; frontend reflection)

The authenticated admin state continues to live in the signed HttpOnly `session`
cookie. Angular **never** stores credentials or the cookie value in
`localStorage` / app state secrets.

| Client field | Type | Notes |
|--------------|------|-------|
| `authenticated` | boolean | From `GET /api/session` or successful `POST /api/login` |
| Loading / error flags | boolean / string | UX only (slow/unavailable backend edge case) |

**State transitions (client view)**:

```text
unknown --GET /api/session--> authenticated | unauthenticated
unauthenticated --POST /api/login (valid)--> authenticated
authenticated --POST /api/logout--> unauthenticated
authenticated --session expired / invalid cookie--> unauthenticated (on next status check)
```

## Entity: Frontend Application (Angular)

Owns presentation, routing, and API interaction.

| Concern | Ownership |
|---------|-----------|
| Routes `/` and `/login` | Angular Router |
| Login form fields | Component local state; required-field validation client-side before POST (FR-004) |
| API calls | Thin `ApiService` / equivalent using `HttpClient` + credentials |
| Credentials | Never embedded; only submitted to `POST /api/login` (FR-005, SC-007) |

## API DTOs (unchanged; typed on the client)

Shapes match `contracts/openapi.yaml` (same as `001`):

| Model | Fields |
|-------|--------|
| `LoginRequest` | `username: string` (min length 1), `password: string` (min length 1) |
| `LoginResponse` | `authenticated: true` |
| `SessionResponse` | `authenticated: boolean` |
| `MessageResponse` | `detail: string` |
| `ErrorResponse` | `detail: string` (generic; non-revealing on auth failure) |

Client-side empty username/password MUST block submit without calling login
(FR-004 / parity with previous form validation). Server still returns `422` for
invalid payloads if called directly.

## Validation rules carried into the UI

- Map image is primary home content without auth (FR-002).
- Login link/control visible without obscuring the map (FR-003).
- Failed login shows a clear generic error (FR-004).
- Logout clears session via backend and updates UI (FR-007).
- Already-logged-in visit to login is handled without useless re-prompt (User Story 2 §6).
