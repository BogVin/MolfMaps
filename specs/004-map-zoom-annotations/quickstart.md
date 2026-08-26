# Quickstart & Validation: Map Zoom & Interactive Annotations

Run-and-verify guide proving the feature works end to end: anyone can zoom and
pan a map, follow text links between maps, and open point-of-interest popups,
while only a logged-in admin sees the placement toggles and can create, edit,
resize, move, or delete annotations. API shapes live in
[`contracts/openapi.yaml`](./contracts/openapi.yaml); entities, bounds, and
validation rules in [`data-model.md`](./data-model.md); design rationale in
[`research.md`](./research.md). Implementation steps belong in `tasks.md`.

## Prerequisites

- Python 3.11+ (backend `venv`) and Node.js LTS + npm — unchanged from `003`,
  with **no new packages on either side**
- Backend `.env` configured (`ADMIN_USERNAME`, `ADMIN_PASSWORD`,
  `SESSION_SECRET`) per `backend/.env.example` — without it every login is
  refused, so no authoring scenario can be exercised
- At least **two** maps in the catalog, so text links have somewhere to point
- A sample image for a point of interest (WebP/PNG/JPEG/GIF)

## Setup

```bash
# Backend — requirements.txt is unchanged; this only matters on a fresh clone
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env           # then edit secrets if needed

# Frontend — package.json is unchanged
cd ../frontend
npm ci
```

`MAX_POI_IMAGES` (default `5`) is the only new setting and has a working
default, so no configuration change is required. `MAPS_DATA_DIR` and
`MAX_MAP_IMAGE_BYTES` keep their `003` meanings; the annotation store and
point-of-interest images live under the same `MAPS_DATA_DIR` root.

## Run

From the repository root:

```bash
./run
```

This starts the API on `http://localhost:8000` and the Angular app on
`http://localhost:4200` (proxying `/api` → `:8000`). To run them separately, see
[`003` quickstart](../003-maps-list-admin/quickstart.md#run).

Throughout the API examples below, log in first and reuse the cookie jar:

```bash
curl -s -c cookies.txt -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'

# Grab two map ids to work with
curl -s http://localhost:8000/api/maps
```

---

## Validation Scenarios

### 1. Anyone zooms and pans a map (User Story 1 — FR-001…FR-007, SC-001, SC-002, SC-003)

1. In a fresh/incognito window (not logged in), open a map at `/maps/{id}`.
2. Zoom in with the on-screen control, the scroll wheel, and the `+` key.
   **Expect**: the map enlarges with its aspect ratio preserved, responding
   visibly within a quarter second, without any page reload.
3. Drag the zoomed map, and pan with the arrow keys.
   **Expect**: the visible region moves, and the map can never be dragged
   completely out of view — dragging hard toward any edge stops at the boundary.
4. Zoom out repeatedly.
   **Expect**: the map stops shrinking at its fit-to-viewport size and never
   goes smaller.
5. Zoom in until the control indicates the maximum, then try again.
   **Expect**: the zoom level stays put and the zoom-in control is visibly
   disabled.
6. Point at a distinctive spot and zoom toward it.
   **Expect**: that spot stays approximately under the pointer rather than
   jumping elsewhere.
7. Choose Reset.
   **Expect**: the whole map is fitted to the viewport again.
8. Zoom in on a region of fine detail.
   **Expect**: text or detail unreadable in the fitted view becomes readable in
   at most three zoom actions.
9. On a touch device or with device emulation, pinch to zoom and drag to pan.
   **Expect**: identical behavior to pointer and keyboard.
10. While zoomed, resize the window or rotate the device.
    **Expect**: the map stays visible and correctly fitted, never stranded
    off-screen.

There is no API surface for this scenario — zoom and pan are client-only view
state and are never sent to the server.

### 2. Placement toggles appear only for an admin (User Story 2 — FR-008…FR-014, SC-004, SC-005)

1. Logged out, open a map.
   **Expect**: no placement toggles anywhere; clicking the map does nothing.
2. Log in at `/login` and reopen the map.
   **Expect**: two small toggles in a bottom corner — one for labels, one for
   points of interest — **both off**.
3. Turn on the label toggle.
   **Expect**: it is clearly marked active, and the interface indicates a click
   will create a label. Reaching this state took one action.
4. Turn on the point-of-interest toggle.
   **Expect**: the label toggle switches off automatically — one further action
   to swap modes, and the two are never both on.
5. Turn the active toggle off, then click the map.
   **Expect**: nothing is created; the map returns to plain viewing.
6. Zoom and pan while a toggle is on.
   **Expect**: the toggles stay put in the corner at every zoom level and pan
   position, and remain reachable by keyboard (Tab to them, Space/Enter to
   toggle).
7. Reload the page.
   **Expect**: both toggles are off again — the mode is never remembered.

### 3. Admin adds a text link to another map (User Story 2 — FR-015, FR-020…FR-029, SC-007, SC-009, SC-010)

1. With the label toggle on, click a spot on map A.
   **Expect**: an editor opens for a label anchored at that spot — the click
   chose the position, nothing was saved yet.
2. Enter text and select map B as the target. Adjust the size control.
   **Expect**: the label previews on the map at the new size within a second of
   each adjustment, before saving.
3. Push the size control past each end of its range.
   **Expect**: it stops at the limit and the label stays legible.
4. Save. **Expect**: the label appears at the clicked spot at the chosen size,
   the whole flow taking under 90 seconds.
5. Without re-arming, click two more spots and save labels there.
   **Expect**: three annotations placed in a row with the toggle never turned
   off (SC-008); each appears immediately.
6. Add a label without touching the size control.
   **Expect**: it saves at a sensible default size.
7. Try to save with empty text, or with no target map chosen.
   **Expect**: rejected with a clear indication of what is missing, and nothing
   is saved.
8. Zoom and pan the map.
   **Expect**: every label stays anchored to its spot and keeps its proportion
   to the map.
9. Open a logged-out window and load map A.
   **Expect**: the labels are visible at the same sizes, with no toggles and no
   editing controls. Click one — it opens map B's view on the first attempt.

```bash
# Create a text link at the centre of map A pointing at map B
curl -s -b cookies.txt -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.5,"y":0.5,"text":"North District",
       "target_map_id":"'"$MAP_B"'","text_scale":0.05}'
# 201 {"id":"...","kind":"text_link","text_scale":0.05,"target_available":true,...}

# Missing target → 422, nothing saved
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.5,"y":0.5,"text":"Nowhere"}'
# 422

# Unknown target map → 422, nothing saved
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.5,"y":0.5,"text":"Ghost",
       "target_map_id":"00000000000000000000000000000000"}'
# 422

# Out-of-range size is clamped, not rejected (FR-024)
curl -s -b cookies.txt -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.2,"y":0.2,"text":"Huge",
       "target_map_id":"'"$MAP_B"'","text_scale":99}'
# 201 with "text_scale":0.1
```

### 4. Admin adds a point of interest with a popup (User Story 3 — FR-031…FR-037, SC-012, SC-013)

1. Turn on the point-of-interest toggle and click a spot.
2. Enter descriptive text, attach one image, and save.
   **Expect**: a marker appears at that spot, the whole flow under 2 minutes.
3. Add a second point of interest with text but **no** image.
   **Expect**: it saves successfully.
4. Try to save one with no text.
   **Expect**: rejected with a clear message; nothing is saved.
5. Logged out in another window, click the first marker.
   **Expect**: a small popup opens over the map showing the text and the image,
   without navigating away.
6. Click a different marker while the popup is open.
   **Expect**: the first popup closes and the second opens — never two at once.
7. Zoom in, pan, then dismiss the popup.
   **Expect**: the popup closes and the map's zoom and pan position are exactly
   as they were.
8. Place a marker near a map edge and open its popup.
   **Expect**: the popup stays fully readable on screen rather than clipped.
9. Zoom to the maximum.
   **Expect**: markers stay a comfortable, constant on-screen size (they do not
   balloon), and markers that overlapped when zoomed out are now separated and
   individually clickable.

```bash
# Create a POI, then attach an image to it
POI=$(curl -s -b cookies.txt -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"poi","x":0.3,"y":0.7,"text":"The old lighthouse."}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

curl -s -b cookies.txt -X POST \
  http://localhost:8000/api/maps/$MAP_A/annotations/$POI/images \
  -F 'image=@/path/to/sample.png'
# 201 {"id":"...","image_url":"/api/maps/.../annotations/.../images/..."}

# POI without text → 422, nothing saved
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' -d '{"kind":"poi","x":0.1,"y":0.1,"text":""}'
# 422
```

### 5. Point-of-interest image rejections (FR-036, FR-037, SC-019)

```bash
# Not an image (a text file renamed .png) → 400, nothing stored
printf 'not an image' > /tmp/fake.png
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations/$POI/images \
  -F 'image=@/tmp/fake.png'
# 400

# Oversized image (> MAX_MAP_IMAGE_BYTES) → 413, nothing stored
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations/$POI/images \
  -F 'image=@/path/to/huge.png'
# 413

# Past the MAX_POI_IMAGES cap → 409
# (repeat a successful upload until it refuses)

# Images cannot be attached to a text link → 409
curl -s -o /dev/null -w '%{http_code}\n' -b cookies.txt \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations/$TEXT_LINK/images \
  -F 'image=@/path/to/sample.png'
# 409
```

After each rejection, re-read the annotation list and **expect** the point of
interest to be unchanged, never in a broken state.

**Missing image fallback**: delete or rename a stored file under
`backend/data/poi-images/` while leaving its record in place, then open that
popup. **Expect**: the descriptive text is still fully readable with a graceful
fallback where the image would be — no broken-image icon.

### 6. Admin corrects and removes annotations (User Story 4 — FR-039…FR-043, SC-014)

1. Edit a text link's wording and target map. **Expect**: both change for every
   visitor on reload.
2. Change an existing label's size. **Expect**: it renders at the new size and
   stays anchored to its spot.
3. Edit a point of interest's text and remove one of its images.
   **Expect**: the popup shows the updated content.
4. Move an annotation to a new spot. **Expect**: it renders at the new spot and
   stays anchored there through zoom and pan.
5. Delete an annotation and **cancel** the confirmation.
   **Expect**: it remains, unchanged.
6. Delete it again and confirm. **Expect**: it disappears for every visitor.
7. With a placement toggle on, click an existing annotation.
   **Expect**: it opens for editing — no new annotation is stacked on top of it,
   the map does not navigate to its target, and its popup does not open
   (FR-018).

```bash
# One PATCH covers edit, resize, and reposition
curl -s -b cookies.txt -X PATCH \
  http://localhost:8000/api/maps/$MAP_A/annotations/$ANNOTATION \
  -H 'Content-Type: application/json' \
  -d '{"text":"South District","x":0.62,"y":0.41,"text_scale":0.07}'
# 200 with updated fields and a bumped updated_at

curl -s -b cookies.txt -X DELETE \
  http://localhost:8000/api/maps/$MAP_A/annotations/$ANNOTATION
# {"detail":"Annotation deleted."}
```

### 7. Authorization boundary (FR-045, FR-046, SC-015)

This is the scenario that must not regress — hidden toggles are not access
control.

```bash
# No cookie at all
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"poi","x":0.5,"y":0.5,"text":"Sneaky"}'
# 401

curl -s -o /dev/null -w '%{http_code}\n' \
  -X PATCH http://localhost:8000/api/maps/$MAP_A/annotations/$ANNOTATION \
  -H 'Content-Type: application/json' -d '{"text":"Hijacked"}'
# 401

curl -s -o /dev/null -w '%{http_code}\n' \
  -X DELETE http://localhost:8000/api/maps/$MAP_A/annotations/$ANNOTATION
# 401

curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:8000/api/maps/$MAP_A/annotations/$POI/images \
  -F 'image=@/path/to/sample.png'
# 401

# Tampered session cookie
curl -s -o /dev/null -w '%{http_code}\n' --cookie 'session=forged.value' \
  -X DELETE http://localhost:8000/api/maps/$MAP_A/annotations/$ANNOTATION
# 401
```

After all five, **expect** `GET /api/maps/$MAP_A/annotations` to be unchanged.
Reads must stay open:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  http://localhost:8000/api/maps/$MAP_A/annotations
# 200 — listing never requires a session (FR-048)
```

### 8. Deleted target map (FR-030, SC-011)

1. Create a text link on map A pointing at map B.
2. Delete map B from `/maps`.
3. Reload map A. **Expect**: the label is still there, and the list response
   reports `"target_available": false`.
4. Click the label. **Expect**: a clear "no longer available" message, not a
   broken view. Map A and its other annotations are unaffected.

### 9. Deleted source map cascades (FR-044)

```bash
curl -s -b cookies.txt -X DELETE http://localhost:8000/api/maps/$MAP_A
curl -s -o /dev/null -w '%{http_code}\n' \
  http://localhost:8000/api/maps/$MAP_A/annotations
# 404
```

**Expect** `backend/data/annotations/$MAP_A.json` to be gone and the map's
point-of-interest image files removed from `backend/data/poi-images/`.

### 10. Session expiry while authoring (edge cases)

1. Log in, open a map, and turn on a placement toggle.
2. In a second tab, log out (or clear the `session` cookie).
3. Back in the first tab, click the map and try to save an annotation.
   **Expect**: the attempt is refused, the toggles stop offering authoring, the
   user is prompted to sign in again, and no partial annotation is saved.

### 11. Scale and empty-set behavior (SC-018, edge cases)

1. Create 50+ annotations on one map (loop the create call above).
2. Open the map and zoom and pan around.
   **Expect**: it opens and stays responsive with no visible stutter.
3. Open a map with **no** annotations.
   **Expect**: it behaves exactly as before this feature, with zoom fully
   functional.
4. Save a label with very long text and a point of interest with a long
   description.
   **Expect**: both wrap or scroll readably without breaking the map layout.

### 12. Keyboard and screen-reader access (FR-006, FR-010, FR-045, SC-016)

1. Using only the keyboard, Tab through an open map.
   **Expect**: zoom controls, reset, every text link, and every marker are
   reachable and operable with Enter/Space; logged in, the placement toggles are
   too, announcing their on/off state.
2. Logged out, Tab through the same map.
   **Expect**: no placement toggles and no edit, resize, move, or delete
   controls appear in the tab order at all.

### 13. Existing behavior unchanged (spec Assumptions)

1. Load the home page and the `/maps` list.
   **Expect**: both behave exactly as before — browsing, opening, adding, and
   deleting maps are unchanged, and `GET /api/map` still serves the landing
   asset.
2. Re-read `GET /api/maps` and `GET /api/maps/{id}`.
   **Expect**: byte-identical response shapes to `003` — no annotation fields
   leaked into the catalog contract.

---

## Automated tests

```bash
cd backend
source .venv/bin/activate
pytest
```

**Expect**: the new `test_annotations.py` covers the authorization boundary,
validation rules, `text_scale` clamping, image rejections and the image cap, and
cascade deletion — and, critically, that `test_maps.py`, `test_auth.py`,
`test_map.py`, and `test_session.py` all stay green through the `storage.py`
extraction. Tests run against a temporary `MAPS_DATA_DIR`, so your local
`backend/data/` is never touched.

```bash
cd frontend
npm test
```

**Expect**: unit tests for the zoom/pan clamping arithmetic (never below fit,
never above max, pan bounded on both axes, zoom-to-pointer keeps its fixed
point) and for placement mode (starts off, mutually exclusive), plus a component
test that the placement toggles are absent without an authenticated session.
