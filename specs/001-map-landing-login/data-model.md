# Phase 1 Data Model: Map Landing & Admin Login

This feature has **no database**. The "entities" below are configuration values,
transient session state carried in a signed cookie, and a static asset. They are
modeled as Pydantic settings/response models and a cookie payload rather than
persisted records.

## Entity: Admin Credentials (configuration)

Source: `.env` file, loaded via `pydantic-settings`. Never persisted by the app,
never returned to the browser.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ADMIN_USERNAME` | string | no* | The single admin username. |
| `ADMIN_PASSWORD` | string (secret) | no* | The single admin password. Compared with `hmac.compare_digest`. |
| `SESSION_SECRET` | string (secret) | no* | Signing key for the session cookie. |

\* Fields are optional at load time so a missing configuration does not crash the
app. **Validation rule (FR-011)**: if any of the three is absent/empty, the system
is "unconfigured" and MUST refuse all logins (no default access). The app SHOULD
surface the misconfiguration to the operator (startup log warning), never to end
users.

## Entity: Admin Session (signed cookie payload)

Represents the authenticated admin state. Not stored server-side; encoded and
signed into an HTTP-only cookie named `session`.

| Field | Type | Notes |
|-------|------|-------|
| `authenticated` | bool | Always `true` when the cookie exists and verifies. Absence of a valid cookie = not authenticated. |
| `issued_at` | int (unix ts) | Set at login; used for expiry. |

- **Cookie attributes**: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production.
- **Validation / state rules**:
  - **Create**: on successful login, sign `{issued_at: now}` and set the cookie
    (FR-008).
  - **Verify**: a request is authenticated iff the cookie's signature is valid AND
    `now - issued_at <= MAX_AGE`. Invalid signature or expired ⇒ treated as logged
    out (FR-008, session-expiry edge case).
  - **Clear**: on logout, delete the cookie (FR-009).
- **State transitions**:
  `unauthenticated --login(valid creds)--> authenticated`
  `authenticated --logout--> unauthenticated`
  `authenticated --max-age exceeded / tampered--> unauthenticated`

## Entity: Main Map Asset (static file)

The `kal_main_map.webp` image shown on the landing page.

| Attribute | Value |
|-----------|-------|
| Location | `backend/assets/kal_main_map.webp` |
| Media type | `image/webp` |
| Access | Public (no auth) via `GET /api/map` |
| Missing behavior | Endpoint returns `404`; frontend shows placeholder fallback (FR-012, SC-006) |

## Request / Response Models (Pydantic)

Used by the API; full shapes are defined in `contracts/openapi.yaml`.

- `LoginRequest` — `{ username: str (min_len 1), password: str (min_len 1) }`
  (FR-007: both required; empty ⇒ validation error, no auth attempt).
- `LoginResponse` — `{ authenticated: bool }` (success payload; no secrets).
- `SessionResponse` — `{ authenticated: bool }` (result of `GET /api/session`).
- `MessageResponse` — `{ detail: str }` (generic messages, e.g. logout ok).
- `ErrorResponse` — `{ detail: str }` (generic, non-revealing errors per FR-006).
