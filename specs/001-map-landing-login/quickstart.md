# Quickstart & Validation: Map Landing & Admin Login

A run-and-verify guide proving the feature works end-to-end. Implementation details
live in `tasks.md` and the code; contract shapes live in `contracts/openapi.yaml`
and entity rules in `data-model.md`.

## Prerequisites

- Python 3.11+ available
- The map asset present at `backend/assets/kal_main_map.webp`
  (moved from `temp_assets/kal_main_map.webp` during implementation)

## Setup

```bash
# From repo root — backend in a venv (Constitution IV)
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure admin credentials (never commit .env)
cp .env.example .env
# edit .env and set:
#   ADMIN_USERNAME=admin
#   ADMIN_PASSWORD=change-me
#   SESSION_SECRET=<long-random-string>
```

## Run

```bash
# From backend/ with the venv active
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/` for the landing page and
`http://localhost:8000/docs` for the live OpenAPI docs.

## Validation Scenarios

Each scenario maps to spec requirements / success criteria.

### 1. Public landing map (User Story 1 — FR-001, FR-002, FR-003, SC-001, SC-002)

1. In a fresh/incognito browser (not logged in) open `http://localhost:8000/`.
2. **Expect**: `kal_main_map.webp` is displayed as primary content, scaled to the
   viewport without distortion, within ~3s; a visible Login link is present and does
   not obscure the map.

### 2. Map fallback (Edge case — FR-012, SC-006)

1. Temporarily rename/remove `backend/assets/kal_main_map.webp`.
2. Reload the landing page.
3. **Expect**: a friendly placeholder appears instead of a broken-image icon; the
   page remains usable. (`GET /api/map` returns 404.) Restore the file afterward.

### 3. Admin login success (User Story 2 — FR-004, FR-005, FR-008, SC-003)

1. From the landing page click Login → `/login.html`.
2. Enter the credentials from `.env` and submit.
3. **Expect**: authenticated; redirected to the post-login destination; the app now
   shows a logged-in state (e.g., a Logout control). A `session` HttpOnly cookie is
   set (verify in devtools that it is HttpOnly and not readable from JS — SC-005).

Command-line equivalent:

```bash
curl -i -c cookies.txt -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'   # expect 200 {"authenticated":true}
curl -s -b cookies.txt http://localhost:8000/api/session  # expect {"authenticated":true}
```

### 4. Invalid credentials (FR-006, SC-004)

1. On the login page submit a wrong username OR wrong password.
2. **Expect**: login refused with the SAME generic error in both cases (never states
   which field was wrong); no session cookie set.

```bash
curl -s -X POST http://localhost:8000/api/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrong"}'      # 401, generic detail
curl -s -X POST http://localhost:8000/api/login -H 'Content-Type: application/json' \
  -d '{"username":"nope","password":"change-me"}'   # 401, identical detail
```

### 5. Missing fields (FR-007)

1. Submit the form with an empty username or password.
2. **Expect**: the form flags the required field(s); no auth attempt (`422` if called
   directly via the API).

### 6. Missing credential configuration (Edge case — FR-011)

1. Stop the server, blank out `ADMIN_PASSWORD` (or remove `.env`), restart.
2. Attempt login with any values.
3. **Expect**: all logins fail safely (no default access); operator sees a startup
   warning; end users only see the generic login failure.

### 7. Session persistence & logout (FR-008, FR-009)

1. While logged in, navigate around / reload → still recognized as logged in.
2. Click Logout.
3. **Expect**: session ends; `GET /api/session` returns `{"authenticated": false}`;
   returning to the landing page shows the logged-out state.

### 8. Already-authenticated visits login page (Edge case)

1. While logged in, open `/login.html` directly.
2. **Expect**: handled sensibly (recognized as logged in / redirected) rather than
   forced to re-enter credentials.

## Automated tests

```bash
cd backend
source .venv/bin/activate
pytest            # covers scenarios 3–7 at the API layer
```
