# Phase 0 Research: Map Zoom & Interactive Annotations

**Feature**: `004-map-zoom-annotations` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION`
markers remain.

---

## Decision 1: Zoom & pan — a hand-rolled CSS transform controller, no mapping library

**Decision**: Implement zoom and pan in the frontend as a small, self-contained
Angular controller (`frontend/src/app/maps/zoom-pan.ts`) that maintains three
signals — `scale`, `offsetX`, `offsetY` — and applies them to a single wrapper
element as `transform: translate(Xpx, Ypx) scale(S)` with
`transform-origin: 0 0`. The wrapper contains the `<img>` and the annotation
layer, so both transform together. Input handling uses the Pointer Events API
(one code path for mouse, trackpad, pen, and touch), `wheel` for scroll-zoom,
two-pointer distance tracking for pinch, and keyboard handlers for `+`/`-`,
arrow keys, and `0` (reset). No new npm dependency.

**Rationale**: Constitution Principle I requires the simplest approach that
satisfies the requirement, and every zoom requirement here (FR-001 … FR-007) is
satisfied by one CSS transform plus clamping arithmetic. A CSS transform is
GPU-composited, which is what makes the "responds within a quarter of a second"
target (SC-002) and the "50 annotations without stutter" target (SC-018)
comfortable — annotations are ordinary DOM children of the transformed wrapper,
so panning and zooming repositions all of them in a single composited operation
rather than N per-element updates. Pointer Events give pointer/touch parity
(FR-006) without writing separate mouse and touch branches.

**Alternatives considered**:

- **Leaflet with `CRS.Simple` + `imageOverlay`**: the conventional choice for
  image-as-map work and it brings markers, popups, and pan/zoom for free. Rejected:
  it is a substantial new runtime dependency plus its stylesheet, it wants to own
  the DOM inside its container (making the Angular-rendered annotation layer,
  the placement toggles, and the size-preview interaction awkward to integrate),
  and its tile/geographic model is irrelevant here. Principle I requires
  justifying added dependencies against a simpler rejected alternative; here the
  simpler alternative is roughly 150 lines of arithmetic that we fully control.
- **OpenSeadragon**: built for deep-zoom of very large images, but expects tiled
  pyramids to pay off and adds a canvas-based rendering model that our DOM-based
  annotation layer would have to fight. Overkill for single-file map images
  capped at 10 MB.
- **A generic pan/zoom npm package (`panzoom`, `svg-pan-zoom`)**: smaller than
  Leaflet, but still a dependency for arithmetic we need to customise anyway
  (clamping to the fitted size, zoom-to-pointer, and suppressing the placement
  click during a drag).
- **Native browser zoom / CSS `zoom`**: cannot be constrained, does not pan, and
  scales the whole page rather than the map. Fails FR-003, FR-004, FR-005.

**Concrete parameters**:

| Parameter | Value | Source |
|---|---|---|
| Minimum scale | `1.0` — the map fitted to the viewport | FR-003 |
| Maximum scale | `8.0` | FR-003; "no further zoom" indicated by disabling the zoom-in control |
| Step per discrete action (button/keyboard) | `×1.5` | Three steps reach 3.375× (SC-003) |
| Wheel / pinch | Continuous, clamped to `[1, 8]` | FR-006 |
| Reset | One action restoring `scale = 1`, `offset = (0, 0)` | FR-005 |

Zoom-to-pointer (FR-007) keeps the map point under the cursor stationary:
`offset' = pointer - (pointer - offset) × (scale' / scale)`, then clamped.

Pan clamping (FR-004) constrains each axis so the scaled image always covers the
frame: when the scaled image is larger than the frame, `offset ∈ [frame - scaled, 0]`;
when it is not larger (only possible at `scale = 1`), the offset is pinned to the
centred position. This makes "cannot be dragged completely out of view" a
structural property rather than a heuristic.

---

## Decision 2: Annotation coordinates — normalized fractions of the map image

**Decision**: Store every annotation position as `x` and `y` floats in `[0, 1]`,
expressed as a fraction of the map image's own width and height. Rendering
places each annotation with `left: x × 100%` / `top: y × 100%` inside the
transformed wrapper, which is sized to the image.

**Rationale**: This is exactly what FR-038 and the spec's "positions are stored
relative to the map image, not to screen pixels" assumption require. Because the
annotation layer is a child of the transformed wrapper, anchoring across zoom,
pan, and viewport resize costs no code at all — the browser's own layout and the
single composited transform keep everything registered to the image. Fractions
also survive the map image being re-encoded at a different pixel size, and they
make the click→coordinate conversion a two-line division.

**Alternatives considered**:

- **Absolute pixel coordinates in the source image's intrinsic space**: equally
  stable, but requires the natural width/height on every read and write and
  breaks silently if an image is ever replaced at another resolution.
- **Screen/viewport coordinates**: fails on every viewport size but the author's,
  and fails FR-038 outright.
- **Latitude/longitude via a CRS**: meaningless for arbitrary illustration maps
  and only worth it if a mapping library were adopted, which Decision 1 rejects.

---

## Decision 3: Label text size — a fraction of image width, scaling with the map

**Decision**: A text link stores `text_scale`, a float in `[0.01, 0.10]`
(default `0.03`), interpreted as the label's font size as a fraction of the map
image's width. Rendering computes `font-size = text_scale × fittedImageWidthPx`
inside the transformed wrapper, so the CSS transform scales the label with the
map for free. Values outside the range are clamped server-side and the slider is
bounded client-side.

**Rationale**: FR-027 requires the size to be defined relative to the map image
so it keeps its proportion at every zoom level, and FR-026 requires the same
size to be shown to every visitor on any viewport — a fraction of image width
satisfies both, while a raw pixel size would not (it would mean different
proportions on different screens). The bounded range with a default satisfies
FR-024 and FR-025, and clamping rather than rejecting matches the spec's
"the size stops at that limit" acceptance scenario instead of erroring. Live
preview (FR-023) is then trivially the same computation applied to unsaved
state.

**Alternatives considered**:

- **Absolute font size in CSS pixels**: simple but viewport-dependent and
  zoom-invariant, contradicting FR-027.
- **A small enum (small/medium/large)**: fewer states to validate, but the spec's
  "push the size past the smallest or largest allowed value" and continuous
  live-preview scenarios read as a continuous control.
- **Fraction of image height**: equivalent, but width is the dimension that
  governs how much text fits, so it is the more meaningful reference.

---

## Decision 4: Marker sizing — labels scale with the map, POI markers do not

**Decision**: Text labels scale with the zoom transform (Decision 3). Point-of-
interest markers are counter-scaled — the marker element carries
`transform: scale(1 / currentScale)` about its anchor point — so it keeps a
constant, comfortable on-screen size at every zoom level. Popups are rendered
outside the transformed wrapper entirely and positioned by projecting the
annotation's map coordinates to screen coordinates.

**Rationale**: FR-027 mandates map-relative sizing for *labels only*, and the
spec's assumptions state that POI markers "keep one uniform size". A marker that
scaled with an 8× zoom would cover a large part of the map and stop being a
marker; a marker that stays constant remains a precise, always-tappable target,
and the edge case "zooming in separates them" still holds because their anchor
positions spread apart. Keeping popups out of the transform is what makes
"remain fully readable rather than clipped" (edge case) and the constant,
legible popup text achievable — a transformed popup would be unreadable at low
zoom and enormous at high zoom.

**Alternatives considered**:

- **Everything inside the transform**: one less concept, but produces unusable
  popups and markers at the zoom extremes.
- **Everything outside the transform, positioned by projection**: forces manual
  recomputation of every annotation's screen position on every pan/zoom frame —
  the N-element update that Decision 1 specifically avoids for SC-018.

---

## Decision 5: Persistence — per-map annotation sidecar files, sharing one storage helper

**Decision**: Persist annotations in one JSON file per map at
`{MAPS_DATA_DIR}/annotations/{map_id}.json`, with the document shape
`{"annotations": [...]}`. Point-of-interest image bytes are stored at
`{MAPS_DATA_DIR}/poi-images/{image_id}.{ext}`. The atomic-write primitive
currently private to `catalog.py` is extracted into a new
`backend/app/storage.py` (atomic JSON write, JSON read, image sniff-and-store,
shared write lock), and both `catalog.py` and the new `annotations.py` use it.
Deleting a map deletes its sidecar and its POI image files.

**Rationale**: Keeping annotations out of `maps.json` leaves the `003` catalog
contract and its tests untouched, and means a save on a crowded map rewrites
only that map's file rather than the whole catalog index. One file per map is
also the natural read unit — the map view always wants exactly one map's
annotations. Extracting the shared primitive is required by the DRY guidance:
the atomic `write → flush → fsync → os.replace` sequence and the magic-byte image
sniffing are both safety-critical and would otherwise be copy-pasted into a
second module, where the two copies could drift. A single shared write lock
across both modules also keeps the "delete a map, then its annotations" sequence
free of interleaving.

**Alternatives considered**:

- **Nesting an `annotations` array inside each entry in `maps.json`**: makes
  FR-044 (annotations removed with the map) free, but every annotation write
  rewrites the entire catalog index, and it changes the shape of the file the
  `003` tests assert on.
- **One global `annotations.json`**: a single file to lock, but every map view
  then reads every map's annotations, and the file becomes the hot spot for all
  writes.
- **SQLite**: the relational shape (annotation → images) is a genuine fit, but it
  introduces schema and migration discipline for a few hundred records at most,
  and image bytes would still live on disk. Rejected under Principle I,
  consistent with `003` Decision 1.

---

## Decision 6: Two annotation kinds — one collection, a discriminated union

**Decision**: Text links and points of interest are two `kind` variants of a
single `Annotation` record sharing `id`, `map_id`, `x`, `y`, `created_at`,
`updated_at`. Pydantic models the API payloads as a discriminated union on
`kind` (`Literal["text_link"] | Literal["poi"]`) via
`Field(discriminator="kind")`, so FastAPI validates and documents each variant's
own required fields.

**Rationale**: The spec's Key Entities section describes exactly this — "Map
Annotation … exists in two kinds". One collection means one list endpoint, one
position/reposition/delete code path, and one storage file, rather than two of
each that would drift (DRY). A discriminated union keeps Principle II satisfied:
each variant is explicitly typed, no untyped dict crosses the boundary, and the
generated OpenAPI shows both shapes with correct required fields — which a
single model with everything optional would not.

**Alternatives considered**:

- **Two separate endpoints, models, and files**: duplicates reposition, delete,
  and list logic; the frontend would also need to merge two lists to render one
  layer and to enforce "at most one popup".
- **One flat model with all fields optional**: loses the contract — nothing would
  stop a text link without a target or a POI with a `text_scale`.

---

## Decision 7: API shape — annotations nested under their map

**Decision**:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/maps/{map_id}/annotations` | public | List a map's annotations → `AnnotationListResponse` |
| POST | `/api/maps/{map_id}/annotations` | admin | Create (JSON, discriminated union) → 201 `Annotation` |
| PATCH | `/api/maps/{map_id}/annotations/{annotation_id}` | admin | Edit text, target, size, and/or position → 200 `Annotation` |
| DELETE | `/api/maps/{map_id}/annotations/{annotation_id}` | admin | Remove → 200 `MessageResponse` |
| POST | `/api/maps/{map_id}/annotations/{annotation_id}/images` | admin | Attach one image (multipart) → 201 `PoiImage` |
| DELETE | `/api/maps/{map_id}/annotations/{annotation_id}/images/{image_id}` | admin | Detach an image → 200 `MessageResponse` |
| GET | `/api/maps/{map_id}/annotations/{annotation_id}/images/{image_id}` | public | Image bytes → 200, else 404 |

`POST` and `PATCH` carry JSON; only image upload uses multipart. `PATCH` covers
edit (FR-039), resize (FR-022), and reposition (FR-040) with one handler, since
all three are partial field updates on the same record. Every write endpoint
declares the existing `require_admin` dependency; the three read paths declare
none.

**Rationale**: Nesting under `/api/maps/{map_id}` mirrors the existing
`/api/maps/{id}/image` sub-resource convention from `003`, makes the owning map
explicit in the path (so the handler can 404 an unknown map before touching
annotations), and keeps authorization uniform. Separating image bytes from
annotation JSON is the same reasoning as `003` Decision 6: the list response
stays small and images load lazily through ordinary `<img>` tags with browser
caching, which is what keeps a 50-annotation map responsive (SC-018). A separate
image-attach endpoint also means the create flow and the edit flow use one image
code path instead of two (DRY), and a failed image upload leaves a valid
text-only POI rather than a half-written annotation — which FR-033 explicitly
permits.

**Alternatives considered**:

- **Top-level `/api/annotations?map_id=…`**: loses the ownership hierarchy and
  makes the "map deleted" case a filter concern rather than a path concern.
- **`PUT` full-replacement instead of `PATCH`**: forces the client to resend
  every field to nudge a position, and makes a stale client silently revert a
  concurrent edit.
- **Multipart create carrying text and images together**: one round trip, but it
  cannot express the discriminated union cleanly, and it duplicates image
  handling between create and edit.

---

## Decision 8: Target-map validation and unavailable targets

**Decision**: On create and on update, a text link's `target_map_id` must
reference a map that currently exists in the catalog; an unknown id is rejected
with `422` and nothing is saved. Self-references are explicitly allowed. A
target deleted *after* the link was saved is left alone in storage; the frontend
discovers it when following the link, because the existing
`GET /api/maps/{id}` already answers `404` with "This map is no longer
available." The list response marks such links with `target_available: false`
so the UI can style them without an extra request per label.

**Rationale**: Validating at write time gives the author immediate, clear
feedback (FR-021) rather than a link that was broken from birth. Not
cascading on delete is what FR-030 and the "target map deleted after linking"
edge case describe — the source map and its other annotations must be
unaffected, and the visitor gets a clear message instead of a broken view. The
`target_available` flag is computed at read time from the catalog the handler
has already loaded, so it costs nothing and spares the frontend N lookups.

**Alternatives considered**:

- **Cascade-delete links pointing at a removed map**: silently destroys the
  author's work and contradicts "the source map and its other annotations are
  unaffected".
- **No write-time validation**: cheapest, but lets a typo produce a permanently
  dead link with no feedback, failing FR-021's intent.
- **Resolving availability in the frontend with one request per label**: N extra
  requests on every map view, for information the server already has.

---

## Decision 9: Point-of-interest images — reuse the map-image pipeline

**Decision**: POI images are validated by the same magic-byte sniffing and the
same `MAX_MAP_IMAGE_BYTES` cap as map uploads, through the shared helper from
Decision 5. A POI holds an ordered list of at most `MAX_POI_IMAGES` images
(new setting, default `5`). Each image is stored as
`poi-images/{image_id}.{ext}` with the extension taken from the *detected*
type. Deleting a POI, or the map that owns it, unlinks its image files.

**Rationale**: The spec assumes POI images are "the same common web image
formats and within a comparable size limit already used for map images, reusing
that handling rather than introducing new media capabilities" — so reuse is the
specified behaviour, not just the convenient one. It also inherits the security
properties already argued in `003`: the client filename and `Content-Type` are
never trusted, and the stored name derives from a server-generated id, so path
traversal is structurally impossible. A bounded count satisfies the spec's
"small handful rather than an unlimited gallery" assumption and caps the worst
case for popup rendering.

**Alternatives considered**:

- **A separate, larger limit for POI images**: another setting to document and
  test for no stated need.
- **Server-side thumbnailing / resizing**: would need an imaging library
  (Pillow) purely for presentation; CSS `max-height` in the popup achieves the
  same visual result with no dependency.
- **Unlimited images per POI**: unbounded popup size and unbounded storage per
  record, contradicting the spec's assumption.

---

## Decision 10: Placement toggles, click-vs-drag, and annotation hit-testing

**Decision**: Placement mode is component state only — a single signal holding
`'off' | 'label' | 'poi'`, initialised to `'off'` on every map view (FR-012),
never persisted or sent to the server. Turning one toggle on sets the signal,
which structurally makes the two mutually exclusive (FR-011). The toggles render
only when `GET /api/session` reports an authenticated session (FR-008, FR-009),
inside the map frame but outside the transformed wrapper so they stay in the
corner at every zoom and pan position (FR-010), as real `<button>` elements with
`aria-pressed` for keyboard and screen-reader operation.

A map click creates an annotation only when the gesture was a click and not a
drag: `pointerdown` records position and time, and `pointerup` treats it as a
placement only if the pointer moved less than 5 CSS pixels and less than 500 ms
elapsed (FR-017). Clicks that land on an existing annotation are handled by that
annotation's own element and do not reach the map surface; while a placement
mode is active, an annotation's handler opens its editor instead of navigating
or opening its popup (FR-018).

**Rationale**: Modelling the mode as one three-valued signal rather than two
booleans means "only one active" cannot be violated by any code path, which is
what SC-005's "100% of checks" asks for; two booleans would need a synchronising
rule that a future edit could forget. The movement/time threshold is the
standard way to separate a tap from a drag and is what keeps zoom and pan
"fully usable" while armed. Letting the annotation element handle its own click
and stop propagation is simpler and more accurate than hit-testing coordinates
on the map surface, and it gives keyboard users the same behaviour for free.

**Alternatives considered**:

- **Two independent boolean signals**: allows an invalid both-on state to exist,
  even transiently.
- **Persisting the mode per visitor**: contradicts the spec's assumption that
  the mode always starts off and is never remembered.
- **A separate authoring page or a right-click context menu**: excluded by the
  spec's assumption that the toggles are the only way to create annotations.
- **Coordinate-based hit testing on the map surface**: reimplements what the DOM
  already does, and would need its own logic for keyboard activation.

---

## Decision 11: Frontend decomposition

**Decision**: Extend the existing `frontend/src/app/maps/` feature folder rather
than creating a new one, and keep using the single shared `ApiService`:

| File | Responsibility |
|---|---|
| `zoom-pan.ts` | Scale/offset signals, clamping, zoom-to-pointer, wheel/pointer/pinch/keyboard handling. No DOM ownership beyond the element it is attached to. |
| `annotation-layer.ts` / `.html` | Renders labels and markers from an annotation list; emits activate/edit events. Pure presentation. |
| `annotation-editor.ts` / `.html` | The create/edit form: text, target-map select, size slider with live preview, image add/remove, delete with confirmation. |
| `poi-popup.ts` / `.html` | The single open popup, positioned outside the transform, with image-failure fallback. |
| `map-view.ts` / `.html` | Orchestrates the above: loads the map and annotations, owns placement mode, wires events to `ApiService`. |
| `core/api.service.ts`, `core/api.types.ts` | New annotation methods and DTOs, alongside the existing ones. |

The image-failure fallback reuses the existing `(error)` + `naturalWidth === 0`
pattern already proven in `home.ts` and `map-view.ts` (FR-036).

**Rationale**: This follows the folder and service conventions already
established by `002` and `003`, so the codebase stays uniform, and it keeps each
piece independently testable — `zoom-pan.ts` in particular is pure arithmetic
that can be unit-tested without a DOM. Reusing the proven image-fallback pattern
rather than inventing a second one is the DRY guidance applied directly.
`map-view.ts` grows into an orchestrator, but the alternative — a shared
annotation state service — would be indirection for a single consumer.

**Alternatives considered**:

- **Everything in `map-view.ts`**: one file owning zoom maths, five interaction
  modes, a form, and a popup; untestable in pieces.
- **A dedicated `AnnotationService` with its own state**: a second state owner
  for one consumer, which Principle I and the DRY guidance's "don't over-extract"
  both warn against.
- **A new top-level `annotations/` feature folder**: splits one screen's code
  across two folders, since every one of these pieces exists only inside the map
  view.

---

## Decision 12: Test strategy

**Decision**: Backend — a new `backend/tests/test_annotations.py` covering the
paths that fail silently: the authorization boundary (unauthenticated create,
edit, reposition, delete, and image upload each refused with annotations
unchanged, per SC-015), validation (label text or target missing, unknown target
map, POI without text, out-of-range coordinates, out-of-range `text_scale`
clamped, oversized and non-image uploads, image count cap), and lifecycle
(annotations listed publicly, `PATCH` reflected on the next read, deleting a map
removes its annotations and their image files, a deleted target map yields
`target_available: false`). The existing `test_maps.py`, `test_auth.py`,
`test_map.py`, and `test_session.py` must stay green — in particular, the
`storage.py` extraction must not change any `003` behaviour.

Frontend — Vitest unit tests for the pure logic: `zoom-pan.ts` clamping (never
below fit, never above max, pan bounded, zoom-to-pointer fixed point) and the
placement-mode signal (mutual exclusion, starts off), plus a component test that
the toggles are absent without a session.

**Rationale**: Principle V asks for automated coverage of what breaks silently
and is hard to verify manually. The authorization boundary qualifies — a
regression there is invisible while logged in, which is exactly how the
requirement gets broken. The zoom clamping arithmetic qualifies too: an
off-by-one in the bounds shows up as a map that can be dragged into the void,
which is easy to miss and tedious to check by hand. Rendering polish and
styling are verified through the `quickstart.md` scenarios instead of
automated browser tests.

**Alternatives considered**:

- **Playwright E2E coverage**: the natural fit for pinch, drag, and popup
  behaviour, but the project has no browser-automation toolchain today, and
  adding one is a larger decision than this feature should make. The manual
  quickstart scenarios cover the same ground for now.
- **Snapshot-testing the annotation layer's markup**: brittle against styling
  changes and asserts nothing about the behaviour that matters.
- **Mocking the filesystem in backend tests**: a real `tmp_path` exercises the
  actual atomic-replace commit path the safety argument depends on, exactly as
  `003` already does.
