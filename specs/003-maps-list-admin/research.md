# Phase 0 Research: Maps List & Admin Map Management

**Feature**: `003-maps-list-admin` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION`
markers remain.

---

## Decision 1: Catalog persistence — JSON index file plus image files on disk

**Decision**: Store catalog metadata in a single JSON file at
`backend/data/maps.json` (`{"maps": [...]}`), and image bytes as individual
files under `backend/data/maps/`. Both live under a configurable
`MAPS_DATA_DIR` root (default `backend/data`). All persistence code lives in one
module, `backend/app/catalog.py`; routes never touch the filesystem directly.

**Rationale**: The catalog holds tens of entries with no querying, sorting, or
relational needs beyond "list everything" and "fetch one by id". A JSON file
read per request satisfies the 3-second budget (SC-001) with room to spare and
uses only the standard library. Keeping images as plain files lets FastAPI's
`FileResponse` stream them with correct content types, exactly as `/api/map`
already does. Constitution Principle I explicitly forbids adding services or
layers for anticipated-but-absent needs.

**Alternatives considered**:

- **SQLite via SQLAlchemy or raw `sqlite3`**: adds schema definition, migration
  discipline, and a session/connection lifecycle for what amounts to a list of
  three-field records. Blobs would still be better off on disk, so this buys a
  second storage mechanism rather than replacing one. Rejected under Principle I;
  the `catalog.py` seam makes a later swap cheap if the catalog ever grows.
- **In-memory dict populated at startup**: simplest of all, but every added map
  vanishes on restart, violating FR-010.
- **One JSON sidecar file per map**: avoids rewriting a shared index on every
  write, but turns listing into a directory scan with N file reads and creates
  more partial-state failure modes than it removes.

---

## Decision 2: Write safety — in-process lock plus atomic replace

**Decision**: Guard every index mutation with a module-level
`threading.Lock` in `catalog.py`. Write the updated index to a temporary file in
the same directory, `flush` + `os.fsync` it, then `os.replace()` it over
`maps.json`.

**Rationale**: The app runs as a single Uvicorn process, so a process-local lock
is sufficient to serialize concurrent add/delete requests, including those from
FastAPI's threadpool for sync endpoints. `os.replace` is atomic on POSIX and
Windows, so a crash mid-write leaves the previous valid index intact rather than
a truncated file — this is what keeps "no partial/broken map entry" (spec Edge
Cases) true even for a hard failure.

**Alternatives considered**:

- **No locking**: two concurrent adds can read the same index and the second
  write silently drops the first entry.
- **`fcntl` / OS advisory file locks**: needed only for multi-process
  deployments, which are not in scope; adds platform-specific code.

---

## Decision 3: Map identity — server-generated UUID, independent of display name

**Decision**: Each map gets `id = uuid.uuid4().hex` assigned by the server. The
display name is metadata only and carries no uniqueness constraint.

**Rationale**: The spec explicitly allows two maps to share a display name and
states identity is not solely the name (Edge Cases, "Duplicate names"). A random
opaque id is also inherently URL-safe and filesystem-safe, which removes an
entire class of path-traversal and encoding bugs when the id becomes part of a
stored filename and a route path.

**Alternatives considered**:

- **Slug derived from the display name**: requires collision suffixes for
  duplicates, transliteration rules for non-ASCII names, and careful sanitizing
  before touching the filesystem. Rejected — prettier URLs are not a requirement.
- **Sequential integer counter**: needs its own persisted counter and makes the
  catalog trivially enumerable; no benefit here.

---

## Decision 4: Upload transport and validation

**Decision**: Accept `multipart/form-data` on `POST /api/maps` with a `name`
text field and an `image` file field, using FastAPI `Form`/`UploadFile` (adds the
pinned `python-multipart` dependency). Validation, in order:

1. `name` — trim surrounding whitespace; reject empty or longer than 100
   characters.
2. Size — stream the upload in 64 KB chunks to a temporary file, aborting with
   `413` as soon as the cumulative size exceeds `MAX_MAP_IMAGE_BYTES`
   (default 10 MB, configurable).
3. Format — sniff the leading bytes of the received file and require a match in
   the allowlist `{image/webp, image/png, image/jpeg, image/gif}`. The
   client-supplied `Content-Type` and filename are used for nothing.
4. Commit — only after all checks pass, move the temp file to
   `data/maps/{id}.{ext}` (extension chosen from the *detected* type) and add the
   index entry under the write lock. Any failure deletes the temp file and leaves
   the index untouched.

**Rationale**: Multipart is the browser-native upload path and keeps the Angular
side to a plain `FormData`. Streaming with an early abort means an oversized
upload is rejected without buffering it fully in memory (spec Edge Cases,
"Very large image upload"). Magic-byte sniffing is the allowlist-over-blocklist
control the secure-coding guidance calls for: a renamed `.exe` with
`Content-Type: image/png` fails. Deriving the stored filename from the
server-generated id rather than the client filename makes path traversal
(`../../etc/passwd`) structurally impossible. Writing the image before the index
entry, and only committing the entry on success, guarantees no dangling catalog
row (FR-009, spec Edge Cases "Unsupported or corrupt image").

**Alternatives considered**:

- **Base64 image inside a JSON body**: avoids `python-multipart` but inflates the
  payload, requires full in-memory buffering (defeating the streaming size
  guard), and adds encode/decode code on both sides.
- **Trusting the browser-supplied `Content-Type`**: trivially spoofed; provides
  no security value.
- **Full image decode with Pillow to validate**: stronger validation, but pulls
  in a large native-dependency imaging library purely to reject bad files, and
  image decoders themselves are a common vulnerability surface. Magic-byte
  sniffing plus a size cap is proportionate for this project (Principle I).

---

## Decision 5: Authorization — one reusable `require_admin` dependency

**Decision**: Add `backend/app/dependencies.py` with a `require_admin` FastAPI
dependency that reads the `session` cookie and calls the existing
`security.verify_session`. On failure it raises `401` with the generic
`ErrorResponse` shape. `POST /api/maps` and `DELETE /api/maps/{id}` declare it;
no other endpoint changes. The Angular UI hides add/delete controls based on
`GET /api/session`, but that is presentation only.

**Rationale**: This reuses the existing session mechanism exactly as the spec
requires (FR-016) and puts the enforcement decision in one place instead of
repeating cookie-reading logic in two handlers (DRY). Expired sessions resolve
to "not authenticated" through the same `verify_session` path already used by
`GET /api/session`, which is what makes the "session expires mid-action" edge
case behave correctly with no extra code. Server-side enforcement is what
actually satisfies FR-014 and SC-005 — hidden buttons are not access control.

**Alternatives considered**:

- **Inline cookie checks in each handler**: duplicated logic, two places to get
  wrong, drifting error messages.
- **Global middleware with a public-path allowlist**: inverts the default to
  "protected unless listed", which is riskier to maintain when most of this API
  is intentionally public.

---

## Decision 6: API shape — `/api/maps` collection with a separate image sub-resource

**Decision**:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/maps` | public | List all maps → `MapListResponse` |
| GET | `/api/maps/{id}` | public | One map's metadata → `MapSummary`, else 404 |
| GET | `/api/maps/{id}/image` | public | Image bytes, else 404 |
| POST | `/api/maps` | admin | Create from `name` + `image` → 201 `MapSummary` |
| DELETE | `/api/maps/{id}` | admin | Remove map → 200 `MessageResponse`, else 404 |

Metadata responses are JSON objects (`{"maps": [...]}`, never a bare array), and
each `MapSummary` carries an `image_url` so the frontend never builds paths by
string concatenation. The existing `GET /api/map` singular endpoint is left
untouched.

**Rationale**: Separating metadata from bytes lets the list render immediately
while images load lazily via ordinary `<img src>` tags with browser caching,
which is what makes the 3-second targets (SC-001, SC-002) comfortable. Returning
an object rather than a top-level array leaves room to add fields without a
breaking change and matches the typed-model discipline of Principle II.
`DELETE` returns `MessageResponse` rather than a bodyless `204` for consistency
with the existing `POST /api/logout`, giving the frontend one uniform JSON
success/error handling path.

**Alternatives considered**:

- **Embedding base64 image data in the list response**: makes a list of ten maps
  megabytes large and defeats HTTP caching.
- **Reusing `/api/map/{id}`**: colliding with the existing singular landing
  endpoint invites routing ambiguity and risks `002` parity.

---

## Decision 7: Seeding the existing map, and home-page compatibility

**Decision**: On application startup, if the index file does not yet exist,
create it and seed one entry named "Kal Main Map" by copying
`backend/assets/kal_main_map.webp` into the data directory. The guard is the
absence of `maps.json`, so seeding happens exactly once and an admin who deletes
the seeded map does not get it back. `GET /api/map` and the home page keep their
current behavior.

**Rationale**: The spec assumes the current main map is represented in the
catalog so the site has something to browse (Assumptions, final bullets) while
also assuming the home landing experience is retained. Seeding on first run
satisfies both without touching the `002` contract. Copying rather than
referencing `assets/` keeps one uniform storage path for catalog images, so
delete works on the seeded entry like any other.

**Alternatives considered**:

- **Repointing the home page at the catalog**: expands scope into `002` parity
  territory for no user-visible gain.
- **A manual migration script**: an extra operational step that a small project
  will forget; the startup guard is idempotent and free.
- **Shipping an empty catalog**: technically valid (FR-007 covers the empty
  state) but leaves an existing deployment looking broken after upgrade.

---

## Decision 8: Frontend routes, delete confirmation, and image fallback

**Decision**: Add `/maps` (list) and `/maps/:id` (single map view) to
`app.routes.ts`, both public, plus a visible "Maps" link from the home page
(FR-002). Extend the existing single `ApiService` rather than adding a feature
service. Delete confirmation is an inline two-step control in the list
component (click Delete → row shows "Confirm / Cancel"), and image failures
reuse the `(error)` + `naturalWidth === 0` fallback pattern already proven in
`home.ts`.

**Rationale**: Matching the existing `home/` and `login/` folder and service
conventions keeps the codebase uniform, and reusing the established image
fallback logic satisfies FR-006 and SC-007 without inventing a second pattern
(DRY). An inline confirmation satisfies the "explicit confirmation step" of
FR-011 while staying testable and stylable, unlike a native `window.confirm`
which is awkward to assert against in Vitest and cannot be styled.

**Alternatives considered**:

- **A route guard on `/maps`**: wrong — the list and view are public by design
  (FR-001, FR-004); guarding them would break the core scenario.
- **A modal dialog component**: more markup and focus-management work than a
  two-step inline control needs for a single destructive action.

---

## Decision 9: Test strategy for the catalog

**Decision**: Extend `backend/tests/conftest.py` with an `admin_client` fixture
(a `configured_client` that has already logged in) and point `MAPS_DATA_DIR` at a
`tmp_path` for every test, so no test touches the developer's real
`backend/data/`. `test_maps.py` covers: empty list, add-then-list, add-then-open
image, delete removes from both list and image paths, unauthenticated add and
delete both refused with the catalog unchanged, missing name rejected,
non-image content rejected, and oversized upload rejected.

**Rationale**: Principle V asks for automated coverage of the paths that break
silently — here that is the authorization boundary and upload validation, since
a regression in either is invisible in normal manual use. Driving the data
directory through an environment override reuses the existing settings-reload
pattern in `conftest.py` rather than introducing dependency-injection plumbing.

**Alternatives considered**:

- **Mocking the filesystem**: a real temp directory is simpler and exercises the
  actual `os.replace` commit path that the safety argument depends on.
- **Full Playwright E2E coverage**: valuable later, but the backend contract
  tests plus quickstart scenarios cover the risk for this feature without adding
  a browser-automation toolchain that the project does not yet have.
