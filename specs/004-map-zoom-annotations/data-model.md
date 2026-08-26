# Phase 1 Data Model: Map Zoom & Interactive Annotations

**Feature**: `004-map-zoom-annotations` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Entities are derived from the spec's Key Entities section. Persistence choices
follow [research.md](./research.md) Decisions 2, 3, 5, 6, and 9. The `Map` and
`Admin Session` entities from
[`003-maps-list-admin/data-model.md`](../003-maps-list-admin/data-model.md) are
reused unchanged.

---

## Entity: Annotation

A marker placed on one map at one spot. Persisted as an object in the
`annotations` array of `{MAPS_DATA_DIR}/annotations/{map_id}.json`. Two kinds
share a common core and are distinguished by `kind` (research Decision 6).

### Common stored fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Server-generated `uuid4().hex` (32 lowercase hex chars). Immutable and opaque. |
| `kind` | `"text_link"` \| `"poi"` | yes | Discriminator. Immutable after creation — changing a kind means deleting and recreating. |
| `x` | float | yes | Horizontal position as a fraction of the map image's width, in `[0, 1]` (research Decision 2). |
| `y` | float | yes | Vertical position as a fraction of the map image's height, in `[0, 1]`. |
| `created_at` | string | yes | ISO 8601 UTC timestamp. Used for stable list ordering. |
| `updated_at` | string | yes | ISO 8601 UTC timestamp; equal to `created_at` until first edit. |

The owning map is the sidecar filename, so `map_id` is not duplicated inside
each record. The API projection adds it back for the client's convenience.

### Variant: Text Link (`kind = "text_link"`)

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | yes | Displayed label. Trimmed, 1–120 characters. |
| `target_map_id` | string | yes | Id of the map this label opens. May equal the owning map's id (self-reference is allowed). |
| `text_scale` | float | yes | Font size as a fraction of the map image's width, in `[0.01, 0.10]`, default `0.03` (research Decision 3). |

**API-only field** (computed at read time, never stored):

| Field | Type | Description |
|---|---|---|
| `target_available` | boolean | Whether `target_map_id` still exists in the catalog. Lets the UI mark a stale link without one lookup per label (research Decision 8). |

### Variant: Point of Interest (`kind = "poi"`)

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | yes | Descriptive text shown in the popup. Trimmed, 1–2000 characters. |
| `images` | array | yes | Ordered list of `PoiImage` records, possibly empty. At most `MAX_POI_IMAGES` (default 5). |

### Validation rules

| Rule | Source | Failure behavior |
|---|---|---|
| Owning map exists | Path resource | `404` — annotation untouched |
| Caller has a valid admin session (writes only) | FR-045, FR-046 | `401` — annotations unchanged |
| `kind` is one of the two known values | Research Decision 6 | `422` |
| `x` and `y` present and within `[0, 1]` | FR-038 | `422` |
| `text` present and non-empty after trimming | FR-021, FR-033 | `422` |
| `text` ≤ 120 chars (text link) / ≤ 2000 chars (POI) | Edge case: very long annotation text | `422` |
| `target_map_id` present (text link) | FR-021 | `422` |
| `target_map_id` refers to an existing map at write time | FR-021, research Decision 8 | `422` — nothing saved |
| `text_scale` within `[0.01, 0.10]` | FR-024 | **Clamped**, not rejected — the size "stops at that limit" |
| `text_scale` absent on create | FR-025 | Defaults to `0.03` |
| Image count ≤ `MAX_POI_IMAGES` | Spec assumption: a small handful | `409` — image not stored |
| Image size ≤ `MAX_MAP_IMAGE_BYTES` | FR-037 | `413` — streaming abort, nothing written |
| Detected image type ∈ `{image/webp, image/png, image/jpeg, image/gif}` | FR-037 | `400` — nothing written |
| Attaching an image to a text link | Kind mismatch | `409` — only a POI carries images |

`text_scale` is the one input that clamps rather than rejects, because FR-024
and its acceptance scenario describe the value stopping at the bound rather
than the save failing. Every other out-of-range value is a client bug and is
refused.

### Lifecycle

```text
(absent) --POST   /api/maps/{map_id}/annotations (admin, valid)--> Present
Present  --PATCH  .../{id} (admin: text, target, size, and/or position)--> Present (updated_at bumped)
Present  --DELETE .../{id} (admin, confirmed in UI)--> (removed, permanent)
Present  --DELETE /api/maps/{map_id} (admin)--> (removed with the map, permanent)
```

- There is no draft or hidden state: an annotation is either in its map's
  sidecar or gone. Creation is a single atomic write after the click has
  supplied the position and the author has confirmed the details (spec
  assumption: the click chooses the position, it does not save an empty
  annotation).
- Delete is permanent — no undo, recycle bin, or version history (spec
  assumptions). Deleting a POI also unlinks its image files.
- `PATCH` is the single path for edit (FR-039), resize (FR-022), and reposition
  (FR-040), since all three are partial updates of the same record.
- Concurrency: the last write wins, and any visitor reopening or refreshing the
  map sees the current state (spec edge case). No optimistic locking, because
  nothing in the requirements asks for conflict detection.

---

## Entity: Point-of-Interest Image

An image shown inside a POI popup. Stored as an element of the owning
annotation's `images` array, with the bytes on disk at
`{MAPS_DATA_DIR}/poi-images/{image_id}.{ext}` (research Decision 9).

### Stored fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Server-generated `uuid4().hex`. Also the stored filename stem. |
| `filename` | string | yes | Basename on disk, always `{id}.{ext}` where `ext` comes from the *detected* content type. Never taken from the client-supplied filename. |
| `content_type` | string | yes | Detected MIME type from the allowlist. Used as `media_type` when serving. |

### API projection (`PoiImage`)

| Field | Type | Description |
|---|---|---|
| `id` | string | Same as stored `id`. |
| `image_url` | string | Server-built relative URL, `/api/maps/{map_id}/annotations/{annotation_id}/images/{id}`. Used verbatim by the frontend, never composed. |

`filename` and the on-disk layout are never exposed, matching the `MapSummary`
projection from `003`.

### Ordering and availability

- Array order is display order in the popup; new images append to the end.
- A missing or unreadable file is not a stored status flag — the image request
  answers `404` and the popup renders the text with a fallback in place of the
  image (FR-036). Representing availability as presence rather than a flag
  matches the `003` treatment of map availability.

### Creation ordering (no partial records)

1. Stream the upload to a temp file, aborting as soon as the size cap is passed.
2. Sniff the leading bytes and require an allowlisted type.
3. `os.replace` the temp file to `poi-images/{image_id}.{ext}`.
4. Under the shared write lock, append the record and atomically rewrite the
   sidecar.

Any failure before step 4 deletes the temp file and leaves the sidecar
untouched, so a refused upload never leaves a POI referencing a missing image.

---

## Entity: Annotation Set (per map)

The collection of one map's annotations. Not a separate record — it is the
sidecar document.

| Aspect | Definition |
|---|---|
| Location | `{MAPS_DATA_DIR}/annotations/{map_id}.json` |
| Document shape | `{"annotations": [Annotation, ...]}` |
| Ordering | `created_at` ascending, so the render order is stable across reloads |
| Empty state | Sidecar absent or an empty array; the API returns `{"annotations": []}` and the map behaves exactly as before (spec edge case) |
| Concurrency | All mutations serialized by the shared in-process lock and committed via atomic replace (research Decision 5) |
| Version control | Under `backend/data/`, which is already gitignored — runtime state, not source |

---

## Entity: Map View State (client only)

The visitor's current zoom and pan for the map they are viewing. Held in Angular
signals inside `zoom-pan.ts`; never sent to the server and never persisted (spec
assumption: zoom and pan are per-visit view state).

| Field | Type | Bounds | Description |
|---|---|---|---|
| `scale` | number | `[1.0, 8.0]` | `1.0` is the map fitted to the viewport; the minimum can never go below it (FR-003) |
| `offsetX` | number | derived | Horizontal translation in CSS px, clamped so the scaled image always covers the frame (FR-004) |
| `offsetY` | number | derived | Vertical translation, clamped the same way |

Reset restores `scale = 1.0` and a centred offset in one action (FR-005).
Resizing the viewport or rotating the device recomputes the fitted size and
re-clamps the offsets, keeping the map visible and annotations anchored (spec
edge case).

---

## Entity: Placement Mode (client only)

The authoring state of an open map view. A single three-valued signal, which
makes mutual exclusion structural rather than a rule to enforce (research
Decision 10).

| Value | Meaning |
|---|---|
| `'off'` | Initial value on every map view (FR-012). A map click creates nothing (FR-016). |
| `'label'` | A map click begins creating a text link at that point (FR-015). |
| `'poi'` | A map click begins creating a point of interest at that point (FR-015). |

- Only reachable when `GET /api/session` reports an authenticated session; the
  toggles are not rendered otherwise (FR-008, FR-009).
- Never persisted, never shared between visitors, never restored between visits
  (spec assumption).
- Stays on after a create or a cancel, so several annotations can be placed in
  succession (FR-019).
- A `401` from any write re-checks the session, which removes the toggles and
  returns the view to plain viewing — the same pattern `maps.ts` already uses
  for the add/delete controls (spec edge case: session expires while a toggle
  is on).

---

## Entity: Admin Session

Unchanged from `001-map-landing-login` and reused as-is per FR-047.

| Aspect | Definition |
|---|---|
| Representation | Signed, HTTP-only `session` cookie holding `{issued_at}` |
| Lifetime | `SESSION_MAX_AGE` (8 hours) |
| Verification | `security.verify_session` — missing, forged, tampered, expired, or unconfigured all resolve to "not authenticated" |
| New usage | The existing `require_admin` dependency gates all four annotation write endpoints and both image write endpoints |

An expired session mid-authoring therefore yields `401` with annotations
unchanged, satisfying the spec's "session expires mid-authoring" edge case with
no additional logic.

---

## Relationships

```text
Admin Session --authorizes--> create / update / delete --mutates--> Annotation Set
Map           --owns 0..N-->  Annotation        (sidecar keyed by map id)
Annotation    --is one of-->  Text Link | Point of Interest
Text Link     --references--> Map               (any map, including its own; may become unavailable)
Point of Interest --owns 0..N--> Point-of-Interest Image
Point-of-Interest Image --has exactly one--> stored file (poi-images/{id}.{ext})
```

### Cascade rules

| Trigger | Effect | Source |
|---|---|---|
| Map deleted | Its sidecar is removed and every POI image file it owned is unlinked | FR-044 |
| POI deleted | Its image records and image files are removed | Key Entities: images belong to exactly one POI |
| Target map deleted | Referencing text links are **left in place**; they report `target_available: false` and following one yields the existing "no longer available" message | FR-030, spec edge case |

Not cascading on target-map deletion is deliberate: the spec requires the source
map and its other annotations to be unaffected, so a stale link is a display
state rather than a data-integrity problem.

---

## New configuration

Added to `Settings` in `backend/app/config.py` and declared in `.env.example`:

| Setting | Env var | Default | Purpose |
|---|---|---|---|
| `max_poi_images` | `MAX_POI_IMAGES` | `5` | Upper bound on images per point of interest |

Reused unchanged: `maps_data_dir` (`MAPS_DATA_DIR`) now also roots
`annotations/` and `poi-images/`, and `max_map_image_bytes`
(`MAX_MAP_IMAGE_BYTES`) caps POI image uploads as well, per the spec's
assumption that POI images reuse the map-image handling and limits.

## Shared constants

Centralised so validators, models, and error messages reference one source
rather than embedding raw values:

| Constant | Value | Used by |
|---|---|---|
| `MIN_TEXT_SCALE` / `MAX_TEXT_SCALE` | `0.01` / `0.10` | Server-side clamping, OpenAPI schema, the frontend size slider bounds |
| `DEFAULT_TEXT_SCALE` | `0.03` | Create when the author never adjusted the size |
| `MAX_LABEL_TEXT_LENGTH` | `120` | Text link validation |
| `MAX_POI_TEXT_LENGTH` | `2000` | POI validation |
| `MIN_SCALE` / `MAX_SCALE` | `1.0` / `8.0` | Frontend zoom clamping |
| `ZOOM_STEP` | `1.5` | Frontend discrete zoom actions |
| `ALLOWED_IMAGE_TYPES` | existing table in `config.py` | Reused for POI image sniffing |
