# Phase 0 Research: Text Mark Styling & Region Links

**Feature**: `005-text-mark-styling` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION`
markers remain.

---

## Decision 1: Typefaces — three tokens, system stacks, no font files

**Decision**: Offer exactly three typeface tokens: `sans` (default), `serif`,
and `condensed`. Persist the token, not a CSS `font-family` string. The
frontend maps tokens to stacks that do not require downloads:

| Token | CSS stack | Role |
|---|---|---|
| `sans` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | Matches today’s `body` / label font (`font: inherit`) |
| `serif` | `Georgia, "Times New Roman", Times, serif` | Distinct hierarchy for names/titles |
| `condensed` | `"Arial Narrow", "Helvetica Condensed", "Segoe UI Condensed", sans-serif` | Compact labels on busy art |

Unknown or missing tokens on **read** render as `sans` (FR-008, edge case:
typeface not in the offered set). Unknown tokens on **write** are `422`.

**Rationale**: The spec requires a small readable set and forbids custom
uploads. Shipping webfonts would add files or a CDN (Principle I, reproducible
environments). Tokens keep the API stable if stacks are tweaked later.
Defaulting `sans` to the current inherit stack satisfies “existing maps do not
visually jump.”

**Alternatives considered**:

- **Google Fonts / self-hosted woff2**: prettier pairing, extra network or
  binaries, and a new dependency surface. Rejected under Principle I.
- **Free-form `font-family` string**: XSS/CSS injection risk and unreadable
  fallbacks. Rejected in favour of an allowlist.
- **More than three families**: YAGNI until authors ask.

---

## Decision 2: Color — `#rrggbb` hex, native picker, no contrast engine

**Decision**: Store text color and region fill color as a lowercase 6-digit
hex string matching `^#[0-9a-f]{6}$`. Authors pick with `<input type="color">`.
Default **text** color is `#f5f7fa` (current `--text` on `.annotation-label`).
Invalid color on write is **rejected** (`422`); missing color on read uses the
default (FR-007, FR-008). No automatic contrast correction (spec assumption).

**Rationale**: Hex is unambiguous, typed, and maps 1:1 to CSS `color` /
`background-color`. Native color input needs no npm package. Rejecting
malformed color (rather than clamping) matches “not an allowed option” —
unlike size, color has no numeric bound to snap to.

**Alternatives considered**:

- **Named CSS colors / `rgb()`**: looser parsing, harder OpenAPI pattern.
- **8-digit hex with alpha**: alpha is a separate opacity field on regions;
  mixing both would duplicate FR-022.
- **A color-picker library**: unjustified dependency.

---

## Decision 3: Region appearance — nested `{color, opacity, brightness}`

**Decision**: Persist two objects on a region, `rest` and `hover`, each:

| Field | Type | Bounds | Default (rest) | Default (hover) |
|---|---|---|---|---|
| `color` | `#rrggbb` | pattern | `#4f9dff` (`--accent`) | `#4f9dff` |
| `opacity` | float | `[0, 1]`, **clamped** | `0` (fully clear) | `0.4` |
| `brightness` | float | `[0.25, 2.0]`, **clamped** | `1.0` | `1.0` |

The UI may label opacity as “how solid / see-through”; the stored field is
CSS `opacity` (0 = invisible, 1 = fully solid). Brightness is a CSS
`filter: brightness(N)` on the fill, independent of hue (spec assumption).
Hover look on pointer devices is `:hover` (and `:focus-visible` for keyboard).
On touch, `:active` during the press shows the hover look; click still
activates the link (FR-025). No author-configurable transition (spec).

**Rationale**: Nested appearance matches the spec’s Region Appearance entity
and avoids six similarly named flat fields. Clamping opacity/brightness
matches FR-020/FR-033 “stops at the bound.” Default rest opacity `0` is the
invisible hotspot (FR-021). A non-zero default hover opacity makes new regions
discoverable without forcing the author through User Story 4 first.

**Alternatives considered**:

- **Separate “transparency” where 1 means invisible**: fights CSS and invites
  off-by-one bugs; reject in favour of opacity.
- **Brightness as a derived filter from the map pixels**: spec forbids it.
- **JS mouseenter handlers**: extra code; CSS pseudo-classes already cover
  hover and press.

---

## Decision 4: Region geometry — top-left + width/height fractions

**Decision**: Store `x`, `y` as the **top-left** corner in `[0, 1]`, and
`width`, `height` as fractions of image width/height. Bounds:

| Constant | Value | Role |
|---|---|---|
| `MIN_REGION_SIZE` | `0.04` | Minimum width and height so the hit target stays usable |
| `MAX_REGION_SIZE` | `1.0` | Cannot exceed the image |
| `DEFAULT_REGION_WIDTH` | `0.16` | Click-to-place starting size |
| `DEFAULT_REGION_HEIGHT` | `0.10` | Slightly shorter than wide, typical “building” |

On write, clamp each of width/height into `[MIN, MAX]`, then **shift/shrink**
so `x >= 0`, `y >= 0`, `x + width <= 1`, `y + height <= 1` (FR-020, edge:
region near a map edge / covering the whole map). Rendering uses
`left/top/width/height` percentages **without** the label’s
`translate(-50%, -50%)`, so the box is the stored rectangle.

**Rationale**: Same normalized-coordinate principle as `004` Decision 2, so
zoom/pan/resize keep alignment (FR-019). Top-left + size is how CSS
absolutely positions a box. Text labels keep centre-point `x,y` unchanged.

**Alternatives considered**:

- **Centre + size**: more arithmetic to keep the box on-image.
- **Two opposite corners**: duplicate storage, harder PATCH.
- **Pixel sizes**: break on viewport change; forbidden by FR-019.

---

## Decision 5: Region placement — click to plant, sliders to size, pan unchanged

**Decision**: Region-link mode uses the **same click-versus-pan threshold** as
labels and POIs. A true click plants a default-sized rectangle centred on the
point (then clamped on-image) and opens the editor. Width/height sliders
(and later a Move action) preview before save (FR-018). A drag that the
existing gesture code already treats as pan **never** creates a region
(FR-035, US3 scenario 8). Keyboard zoom/pan keep working.

**Rationale**: A rubber-band drag-to-draw would consume the same pointer path
as pan, forcing region mode to disable panning or add a modifier key. The spec
requires pan to remain usable while the mode is on. Click + resize matches how
text size already works and stays YAGNI.

**Alternatives considered**:

- **Drag-to-draw rubber band**: natural “draw a rectangle,” but fights FR-035.
- **Shift+drag to draw**: extra undocumented gesture.
- **Two-click corners**: slower than click + sliders for the 90-second SC-008
  budget, and still easy to confuse with pan.

---

## Decision 6: Third union member, same seven endpoints

**Decision**: Add `kind: "region_link"` to the existing discriminated union.
`GET/POST /api/maps/{id}/annotations` and `PATCH/DELETE .../{aid}` stay the
only collection. Regions have no `text` and no images; attaching an image
returns the same `409` kind mismatch as a text link. `target_map_id` and
`target_available` work exactly as for text links (FR-017, FR-028).

**Rationale**: `004` already chose a discriminated union so each kind’s
required fields are real, not optional soup. A parallel `/regions` resource
would duplicate auth, sidecar locking, and cascade-on-map-delete.

**Alternatives considered**:

- **New collection `/api/maps/{id}/regions`**: clearer URL, twice the
  persistence code. Rejected.
- **Text link with empty text and a box**: overloads FR-012-era text marks and
  confuses listing/rendering.

---

## Decision 7: Legacy text marks — project defaults, no migration job

**Decision**: Records lacking `color` or `typeface` remain valid on disk.
`_to_api` fills `DEFAULT_TEXT_COLOR` and `sans` so every JSON response includes
the required fields (FR-008, SC-004). Create stores the defaults when omitted
so new rows are complete. PATCH does not rewrite missing style unless those
fields are supplied. No bulk rewrite of sidecars at startup.

**Rationale**: A migration pass is extra moving parts for data that already
renders correctly via defaults. Projection keeps the OpenAPI schema required
and complete for clients.

**Alternatives considered**:

- **Startup scan rewriting every sidecar**: works, unnecessary I/O and lock
  contention.
- **Optional fields forever in the API**: every client must default; duplicates
  FR-007 in two languages.

---

## Decision 8: Hit testing and author visibility

**Decision**: Paint order in the overlay is **regions (oldest first), then
text labels, then POI markers**. Later siblings sit on top, so overlapping
regions use “newest wins” for hover and click (edge: overlapping regions).
Labels above regions mean aiming at wording activates the text link (edge:
overlapping region and text mark). Authenticated map views pass an
`authoring` flag so region boxes get a dashed outline and slightly visible
hit fill even when rest opacity is 0 (FR-031). Visitors get no outline;
opacity 0 is still a `pointer-events: auto` box so the link stays activatable
(FR-034).

**Rationale**: DOM order is the browser’s hit test; no z-index service.
Authors cannot select a fully transparent box without an affordance.

**Alternatives considered**:

- **A always-on visitor outline**: breaks “invisible at rest.”
- **A separate editor hit-layer**: more components for one CSS class.

---

## Decision 9: No new backend modules or frontend services

**Decision**: Extend `models.py`, `annotations.py`, `routes/annotations.py`,
`config.py`, `api.types.ts`, `annotation-layer`, `annotation-editor`, and
`map-view`. Do not add `styling.py`, a fonts service, or a second Angular
feature folder.

**Rationale**: Same reasoning as `004` Decision 11: one persistence module,
one map-view orchestrator, one `ApiService`.

---

## Decision 10: Testing — extend `004` suites, not a new runner

**Decision**: Backend coverage in `test_annotations.py` (auth, validation,
legacy projection, region lifecycle). Frontend: placement-mode tests plus
pure clamp helpers if extracted. Hover/touch visual checks live in
[quickstart.md](./quickstart.md). No Playwright job unless the project later
adds that toolchain.

**Rationale**: Constitution Principle V — automate silent breakage; do not
stand up E2E infrastructure for CSS `:hover`.
