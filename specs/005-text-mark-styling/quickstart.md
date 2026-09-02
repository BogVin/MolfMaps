# Quickstart & Validation: Text Mark Styling & Region Links

Run-and-verify guide for color/typeface on text marks and for region links.
API shapes: [`contracts/openapi.yaml`](./contracts/openapi.yaml). Entities and
bounds: [`data-model.md`](./data-model.md). Rationale: [`research.md`](./research.md).
Implementation steps belong in `tasks.md`.

This guide **adds** scenarios on top of the [`004` quickstart](../004-map-zoom-annotations/quickstart.md);
zoom, pan, POI popups, and unauthenticated write refusal from `004` must still hold.

## Prerequisites

- Same toolchain as `004`: Python 3.11+ `venv`, Node.js LTS, **no new packages**
- Backend `.env` with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`
- At least **two** maps in the catalog
- Optional: a map whose sidecar still has text links **without** `color` /
  `typeface` (or strip those keys from a test sidecar) for the legacy scenario

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env

cd ../frontend
npm ci
```

No new settings. From the repository root:

```bash
./run
```

API: `http://localhost:8000`. App: `http://localhost:4200`.

```bash
curl -s -c cookies.txt -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'

curl -s http://localhost:8000/api/maps
```

---

## Validation Scenarios

### 1. Author styles a new text mark (User Story 1 — FR-001…FR-007, FR-014, SC-001, SC-002)

1. Log in, open a map, turn on **text label** placement, click the map, type a
   label, choose a target map.
2. Change size, pick a color other than the default, choose **serif** or
   **condensed**.
   **Expect**: the preview on the map shows all three at once before save.
3. Save. Open the same map in a signed-out window.
   **Expect**: the mark uses the saved color, typeface, and size, and still
   opens the linked map.
4. Create another mark without touching color or typeface.
   **Expect**: default color `#f5f7fa` and `sans` at default size.

```bash
# After save, list should include color and typeface
curl -s http://localhost:8000/api/maps/{MAP_ID}/annotations
```

### 2. Invalid styling is refused (FR-009)

```bash
curl -s -b cookies.txt -X POST http://localhost:8000/api/maps/{MAP_ID}/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.5,"y":0.5,"text":"X","target_map_id":"{TARGET}","color":"red"}'
# Expect 422; GET list unchanged

curl -s -b cookies.txt -X POST http://localhost:8000/api/maps/{MAP_ID}/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.5,"y":0.5,"text":"X","target_map_id":"{TARGET}","typeface":"comic"}'
# Expect 422
```

### 3. Restyle an existing mark (User Story 2 — FR-011, SC-003)

1. Log in, open an existing text mark, change only color and typeface, save.
   **Expect**: wording, target, and position unchanged; new look visible signed out.
2. Open the editor again and **Cancel**.
   **Expect**: stored styling unchanged.
3. Signed out, there are no color/typeface controls.

### 4. Unauthenticated style or region writes fail (FR-010, FR-029, SC-005)

```bash
curl -s -X POST http://localhost:8000/api/maps/{MAP_ID}/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text_link","x":0.4,"y":0.4,"text":"Nope","target_map_id":"{TARGET}","color":"#ff0000"}'
# Expect 401

curl -s -X POST http://localhost:8000/api/maps/{MAP_ID}/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"region_link","x":0.1,"y":0.1,"target_map_id":"{TARGET}"}'
# Expect 401
```

### 5. Legacy text marks (User Story 5 — FR-008, SC-004)

1. Open a map whose stored text links have `text_scale` but no `color`/`typeface`.
   **Expect**: they render at saved size in default color and `sans`, and still
   navigate.
2. `GET` the list: those items still include `color` and `typeface` in the JSON
   (projected defaults).
3. Log in, edit one, assign a custom color, save. Visitors then see the custom
   color; others stay defaulted.

### 6. Place an invisible region link (User Story 3 — FR-015…FR-021, FR-028, FR-035, SC-008, SC-013)

1. Log in. **Expect**: a third placement control (region) alongside label and
   POI; at most one pressed; all start off on a fresh view.
2. Turn region mode on, **drag** the map.
   **Expect**: the map pans; no region is created.
3. **Click** (no drag). **Expect**: a default-sized rectangle preview and the
   editor requiring a target map. Saving without a target saves nothing.
4. Choose a target, leave appearance at defaults, save. Signed-out visitor:
   artwork looks unchanged at rest; clicking the area opens the linked map.
5. Zoom and pan. **Expect**: the rectangle stays on the same map area; colors
   do not change with zoom (SC-007).

```bash
curl -s -b cookies.txt -X POST http://localhost:8000/api/maps/{MAP_ID}/annotations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"region_link","x":0.2,"y":0.3,"target_map_id":"{TARGET}"}'
# Expect 201, rest.opacity 0, default hover opacity 0.4
```

### 7. Region hover appearance (User Story 4 — FR-022…FR-025, SC-009, SC-010, SC-012)

1. Log in, edit the region: set rest fully clear; set hover to a distinct
   color, opacity, and brightness. Preview rest and hover before save.
2. Signed-out, pointer device: move onto the region — hover look; move off —
   rest look. Click still follows the link.
3. Touch (or DevTools device mode): press-and-hold shows hover look; completing
   the tap still navigates.
4. Push opacity or brightness past the slider ends.
   **Expect**: the value stops at the bound; save stores the clamped value.

### 8. Author can still edit an invisible region (FR-030, FR-031)

1. Log in with rest opacity 0.
   **Expect**: a dashed (or otherwise visible) editing outline so the rectangle
   can be selected, resized, restyled, or deleted (delete still asks confirm).
2. Signed-out: no outline, no editor.

### 9. Region target missing (FR-028, SC-011)

Delete (or use) a target map that a region still points at. Activate the
region. **Expect**: the existing “map is no longer available” message, not a
broken view. `target_available` is `false` on `GET`.

### 10. Points of interest unchanged (FR-012)

POI markers have no color, typeface, or region appearance controls. Posting
those fields on a POI create/update returns `422`. Attaching an image to a
region link returns `409`.

### 11. Automated tests

```bash
cd backend && source .venv/bin/activate && python -m pytest tests/test_annotations.py
cd ../frontend && npx vitest run src/app/maps/map-view.spec.ts
```

**Expect**: existing `004` cases still pass, plus new cases for defaults,
invalid style, region create/clamp, and the third placement mode.

---

## What “done” looks like

- Styled text marks match the author’s last save for signed-out visitors, or
  documented defaults for older records
- Region links are invisible at rest by default, hover as configured, and
  navigate (or show unavailable)
- Unauthenticated writes never change the store
- `requirements.txt` and `package.json` still have no new dependencies
