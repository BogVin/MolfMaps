# Phase 1 Data Model: Maps List & Admin Map Management

**Feature**: `003-maps-list-admin` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Entities are derived from the spec's Key Entities section. Persistence choices
follow [research.md](./research.md) Decisions 1–3.

---

## Entity: Map

A catalog entry that any visitor can list and open. Persisted as one object in
the `maps` array of `maps.json`, paired with one image file on disk.

### Stored fields (`maps.json`)

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Server-generated `uuid4().hex` (32 lowercase hex chars). Immutable, opaque, URL- and filesystem-safe. Sole identity — never derived from the name. |
| `name` | string | yes | Display name shown in the list. Whitespace-trimmed, 1–100 characters. Not unique. |
| `image_filename` | string | yes | Basename of the stored image, always `{id}.{ext}` where `ext` comes from the *detected* content type. Never taken from the client-supplied filename. |
| `content_type` | string | yes | Detected MIME type from the allowlist (see below). Used as the `media_type` when serving the image. |
| `created_at` | string | yes | ISO 8601 UTC timestamp of creation. Used only for stable list ordering. |

### API projection (`MapSummary`)

What the API returns; `image_filename` and the on-disk layout are never exposed.

| Field | Type | Description |
|---|---|---|
| `id` | string | Same as stored `id`. Used in the `/maps/:id` route. |
| `name` | string | Display name (FR-003). |
| `image_url` | string | Server-built relative URL, `/api/maps/{id}/image`. The frontend uses this verbatim rather than composing paths. |

### Validation rules

| Rule | Source | Failure behavior |
|---|---|---|
| `name` present and non-empty after trimming | FR-009 | `422` — missing required field |
| `name` length ≤ 100 characters | Input-boundary hardening | `422` |
| `image` file part present and non-empty | FR-009 | `422` (absent) / `400` (empty) |
| Image size ≤ `MAX_MAP_IMAGE_BYTES` (default 10 MB) | Edge case: very large upload | `413` — streaming abort, nothing written |
| Detected content type ∈ `{image/webp, image/png, image/jpeg, image/gif}` | Edge case: unsupported/corrupt image | `400` — generic message, nothing written |
| Caller has a valid admin session | FR-013, FR-014 | `401` — catalog unchanged |

The format allowlist is enforced by sniffing the file's leading bytes; the
client-declared `Content-Type` is never trusted (research Decision 4).

### Lifecycle

```text
(absent) --POST /api/maps (admin, valid name + image)--> Available
Available --DELETE /api/maps/{id} (admin, confirmed)--> (removed, permanent)
```

- There is no draft, hidden, or archived state — a map is either in the catalog
  or gone. "Availability status" from the spec's Key Entities is represented by
  presence in the index rather than a status flag; nothing in the requirements
  needs an unavailable-but-present map.
- Delete is permanent (spec Assumptions): the index entry is removed first, then
  the image file is unlinked. If the unlink fails the entry stays removed and the
  orphaned file is harmless — the map is already unreachable, which is what
  FR-012 requires.
- Editing or renaming after creation is out of scope for this feature.

### Creation ordering (no partial entries)

1. Stream the upload to a temp file, enforcing the size cap.
2. Sniff and validate the content type.
3. `os.replace` the temp file to `data/maps/{id}.{ext}`.
4. Under the write lock, append the entry and atomically rewrite `maps.json`.

Any failure before step 4 deletes the temp file and leaves the index untouched,
so a broken upload never produces a listed-but-unopenable map.

---

## Entity: Map Catalog

The collection of all currently available maps. Not a separate record — it is
the `maps.json` document plus the image directory.

| Aspect | Definition |
|---|---|
| Location | `{MAPS_DATA_DIR}/maps.json` and `{MAPS_DATA_DIR}/maps/` (default root `backend/data`) |
| Document shape | `{"maps": [Map, ...]}` |
| Ordering | `created_at` ascending, so the list is stable across reloads (SC-001) |
| Empty state | A valid document with an empty `maps` array; the API returns `{"maps": []}` and the UI renders the empty state (FR-007) |
| Seeding | On first run only (index file absent), one entry is created from `backend/assets/kal_main_map.webp` (research Decision 7) |
| Concurrency | All mutations serialized by an in-process lock and committed via atomic replace (research Decision 2) |
| Version control | `backend/data/` is gitignored — it is runtime state, not source |

---

## Entity: Admin Session

Unchanged from `001-map-landing-login`; reused as-is per FR-016.

| Aspect | Definition |
|---|---|
| Representation | Signed, HTTP-only `session` cookie holding `{issued_at}` |
| Lifetime | `SESSION_MAX_AGE` (8 hours) |
| Verification | `security.verify_session` — invalid signature, tampered payload, expired timestamp, missing cookie, or unconfigured app all resolve to "not authenticated" |
| New usage | The `require_admin` dependency gates `POST /api/maps` and `DELETE /api/maps/{id}` (research Decision 5) |

An expired session mid-action therefore yields `401` and an unchanged catalog,
matching the spec's "session expires mid-action" edge case with no extra logic.

---

## Relationships

```text
Admin Session --authorizes--> create / delete --mutates--> Map Catalog
Map Catalog --contains 0..N--> Map
Map --has exactly one--> stored image file (data/maps/{id}.{ext})
```

- A `Map` cannot exist without its image file (enforced by the creation
  ordering above).
- Deleting the last `Map` returns the catalog to the valid empty state; the site
  stays usable (spec Edge Cases).

---

## New configuration

Added to `Settings` in `backend/app/config.py`, declared in `.env.example`:

| Setting | Env var | Default | Purpose |
|---|---|---|---|
| `maps_data_dir` | `MAPS_DATA_DIR` | `backend/data` | Root of the catalog store; tests point this at a temp directory |
| `max_map_image_bytes` | `MAX_MAP_IMAGE_BYTES` | `10485760` (10 MB) | Upload size cap |

Both have working defaults, so a fresh clone runs without extra configuration —
consistent with the existing "never crash on missing config" behavior.
