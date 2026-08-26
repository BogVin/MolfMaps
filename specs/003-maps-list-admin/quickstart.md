# Quickstart & Validation: Maps List & Admin Map Management

Run-and-verify guide proving the map catalog works end to end: anyone can browse
and open maps, and only a logged-in admin can add or delete them. API shapes live
in [`contracts/openapi.yaml`](./contracts/openapi.yaml); entities and validation
rules in [`data-model.md`](./data-model.md); design rationale in
[`research.md`](./research.md). Implementation steps belong in `tasks.md`.

## Prerequisites

- Python 3.11+ (backend `venv`)
- Node.js LTS + npm (Angular CLI)
- Backend `.env` configured (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`)
  per `backend/.env.example` — without it every login is refused, so the admin
  scenarios cannot be exercised
- A sample image to upload (any WebP/PNG/JPEG/GIF)

## Setup

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt   # now includes python-multipart
cp -n .env.example .env           # then edit secrets if needed

# Frontend
cd ../frontend
npm ci
```

`MAPS_DATA_DIR` and `MAX_MAP_IMAGE_BYTES` have working defaults
(`backend/data`, 10 MB) and only need setting to override them.

## Run

Terminal 1 — API:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — Angular (proxies `/api` → `:8000`):

```bash
cd frontend
npm start
```

Open the URL printed by the CLI (typically `http://localhost:4200/`).

On first start the backend creates `backend/data/maps.json` and seeds it with the
existing `kal_main_map.webp`, so the catalog is not empty on an existing
deployment.

## Validation Scenarios

### 1. Anyone browses the maps list (User Story 1 — FR-001, FR-002, FR-003, SC-001)

1. Open a fresh/incognito window (not logged in) and load the home page.
2. **Expect**: a visible "Maps" navigation link (FR-002).
3. Follow it to `/maps`.
4. **Expect**: every catalog map listed with its display name, rendered within
   ~3s; no add or delete controls anywhere on the page (FR-013).

```bash
curl -s http://localhost:8000/api/maps
# {"maps":[{"id":"...","name":"Kal Main Map","image_url":"/api/maps/.../image"}]}
```

### 2. Anyone opens a map (User Story 2 — FR-004, FR-005, FR-015, SC-002)

1. From `/maps` (still logged out) choose a map.
2. **Expect**: `/maps/{id}` shows that map's image as the primary content within
   ~3s, scaled to the viewport without aspect-ratio distortion.
3. **Expect**: a working way back to the maps list.
4. Reload the `/maps/{id}` URL directly and open it in a new tab.
   **Expect**: it works without login (deep-link edge case).

### 3. Empty state (FR-007)

1. Stop the backend, move `backend/data/maps.json` aside, and write `{"maps": []}`
   in its place (an empty array, so the first-run seed does not re-trigger).
2. Restart the backend and open `/maps` logged out.
3. **Expect**: a clear "no maps available yet" message — not a blank or broken
   page.
4. Restore the original file.

### 4. Image fallback (FR-006, SC-007)

1. Delete or rename the stored image file for one map under `backend/data/maps/`
   while leaving its index entry in place.
2. Open that map.
3. **Expect**: a graceful fallback message, no broken-image icon; the page stays
   usable.
4. Restore the file.

### 5. Admin adds a map (User Story 3 — FR-008, FR-009, FR-010, SC-003)

1. Log in at `/login` with the credentials from `backend/.env`.
2. Go to `/maps`. **Expect**: the add-map control is now visible.
3. Submit a display name plus an image file.
4. **Expect**: the new map appears in the list, completing in under 2 minutes.
5. Submit again with a blank name, or with no file.
   **Expect**: rejected with a message naming the missing information, and no new
   entry appears in the list.
6. Open a separate logged-out window and load `/maps`.
   **Expect**: the newly added map is listed and opens.

```bash
# Log in, then add a map
curl -s -c cookies.txt -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'

curl -s -b cookies.txt -X POST http://localhost:8000/api/maps \
  -F 'name=Harbour District' \
  -F 'image=@/path/to/sample.png'
# 201 {"id":"...","name":"Harbour District","image_url":"/api/maps/.../image"}
```

### 6. Upload rejections (edge cases)

```bash
# Not an image (a text file renamed .png) → 400, nothing added
printf 'not an image' > /tmp/fake.png
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps \
  -F 'name=Fake' -F 'image=@/tmp/fake.png'
# 400

# Oversized image (> MAX_MAP_IMAGE_BYTES) → 413, nothing added
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps \
  -F 'name=Huge' -F 'image=@/path/to/huge.png'
# 413
```

After each rejection, re-run `curl -s http://localhost:8000/api/maps` and
**expect** no partial or broken entry in the catalog.

### 7. Admin deletes a map (User Story 4 — FR-011, FR-012, SC-004)

1. Logged in on `/maps`, choose Delete on a map and then Cancel.
   **Expect**: the map is unchanged and still listed.
2. Choose Delete again and confirm.
   **Expect**: it disappears from the list, in under 1 minute including
   confirmation.
3. Navigate to that map's previous `/maps/{id}` URL.
   **Expect**: a clear not-found / unavailable message, not the deleted map.

```bash
curl -s -b cookies.txt -X DELETE http://localhost:8000/api/maps/{id}
# {"detail":"Map deleted."}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/maps/{id}
# 404
```

### 8. Authorization boundary (FR-013, FR-014, SC-005)

This is the scenario that must not regress — hiding buttons is not access
control.

```bash
# No cookie at all
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/maps \
  -F 'name=Sneaky' -F 'image=@/path/to/sample.png'
# 401

curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:8000/api/maps/{id}
# 401

# Tampered/garbage session cookie
curl -s -o /dev/null -w '%{http_code}\n' \
  --cookie 'session=forged.value' \
  -X DELETE http://localhost:8000/api/maps/{id}
# 401
```

After all three, **expect** `GET /api/maps` to be byte-for-byte unchanged.

### 9. Session expiry mid-action (edge case)

1. Log in, open `/maps`, then log out in a second tab (or clear the `session`
   cookie).
2. In the first tab, attempt an add or delete.
3. **Expect**: the action is refused, the catalog is unchanged, and the UI
   prompts to log in again rather than failing silently.

### 10. Home page parity (spec Assumptions)

1. Load the home page.
2. **Expect**: the existing landing map experience is unchanged; `GET /api/map`
   still serves the same asset, and adding or deleting catalog maps does not
   alter the home page.

## Automated tests

```bash
cd backend
source .venv/bin/activate
pytest
```

**Expect**: existing `test_auth.py`, `test_map.py`, `test_session.py` stay green,
and the new `test_maps.py` covers list/add/delete plus the authorization and
upload-validation rejections. Tests run against a temporary `MAPS_DATA_DIR`, so
your local `backend/data/` is never touched.

```bash
cd frontend
npm test
```

**Expect**: component tests confirming add/delete controls render only when the
session is authenticated.
