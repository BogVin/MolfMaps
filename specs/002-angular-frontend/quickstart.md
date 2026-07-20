# Quickstart & Validation: Migrate Frontend to Angular

Run-and-verify guide proving Angular delivers the same visitor/admin experience
as before, as the sole active frontend. API shapes live in
[`contracts/openapi.yaml`](./contracts/openapi.yaml); client entities in
[`data-model.md`](./data-model.md). Implementation steps belong in `tasks.md`.

## Prerequisites

- Python 3.11+ (backend `venv`)
- Node.js LTS + npm (Angular CLI / frontend install)
- Map asset at `backend/assets/kal_main_map.webp`
- Backend `.env` configured (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`)
  per `backend/.env.example`

## Setup

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env   # then edit secrets if needed

# Frontend (Angular — after migration lands)
cd ../frontend
npm ci                    # or npm install when lockfile is first created
```

## Run (separated local development)

Terminal 1 — API:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — Angular (proxies `/api` → `:8000`):

```bash
cd frontend
npm start                 # ng serve with proxy.conf.json
```

Open the URL printed by the CLI (typically `http://localhost:4200/`).

Optional single-origin mode (if implemented): build the Angular app and let
FastAPI serve `frontend/dist/...` at `/` — then only Uvicorn on `:8000` is
required. Prefer documenting one primary path in `frontend/README.md` (FR-011).

## Validation Scenarios

### 1. Public landing map (User Story 1 — FR-002, FR-003, SC-001, SC-002)

1. Fresh/incognito browser → home route (`/`).
2. **Expect**: main map as primary content within ~3s; scaled without distortion;
   Login control visible and not covering the map.
3. **Expect**: UI is the Angular app (not legacy `index.html` / plain static site).

### 2. Map fallback (FR-008)

1. Temporarily rename/remove `backend/assets/kal_main_map.webp`.
2. Reload home.
3. **Expect**: graceful fallback (no broken-image icon); page remains usable.
4. Restore the asset.

### 3. Login success (User Story 2 — FR-004–FR-006, SC-003, SC-007)

1. Open Login → submit credentials from `backend/.env`.
2. **Expect**: authenticated within ≤2 steps; session reflected (e.g. Logout);
   HttpOnly `session` cookie present; no credential values in frontend source,
   network response bodies beyond what the API always returned, or built assets.

```bash
curl -i -c cookies.txt -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'
curl -s -b cookies.txt http://localhost:8000/api/session
# {"authenticated":true}
```

### 4. Invalid / empty credentials (FR-004, SC-004)

1. Wrong username or password → refused with the same generic error; no auth.
2. Empty fields → client validation; no login request (or API would `422`).

### 5. Session persistence & logout (FR-006, FR-007)

1. While logged in, navigate / refresh → still recognized.
2. Logout → session ends; admin chrome gone; `GET /api/session` →
   `{"authenticated":false}`.

### 6. Already logged in on login route (User Story 2 §6)

1. Authenticated → navigate to `/login`.
2. **Expect**: handled sensibly (redirect or clear “already signed in”), not a
   dead-end re-prompt.

### 7. Deep links & history (edge cases)

1. Direct load of `/` and `/login` works.
2. Browser back/forward between home and login does not blank the UI.

### 8. Sole frontend / docs (User Story 3 — FR-010, FR-011, SC-005, SC-006)

1. Follow `frontend/README.md` only — Angular is the documented start path.
2. Confirm plain HTML/JS is not what visitors get on the documented entry URL.
3. New contributor can reach the home map on first documented attempt.

### 9. Backend unavailable feedback (edge case)

1. Stop Uvicorn; trigger login or session check from the UI.
2. **Expect**: clear error or loading indication; UI does not hang silently.

## Automated tests

```bash
cd backend
source .venv/bin/activate
pytest            # existing API contract tests must remain green
```

Frontend: exercise scenarios 1–8 manually (or via any optional unit tests added
during implementation). No new backend endpoints required for this feature.
