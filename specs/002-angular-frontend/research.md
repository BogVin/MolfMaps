# Phase 0 Research: Migrate Frontend to Angular

All Technical Context items are resolved from the feature spec, constitution, and
the existing `001-map-landing-login` implementation. There are no outstanding
NEEDS CLARIFICATION markers.

## Decision 1: Angular version and application shape

- **Decision**: Scaffold with Angular CLI against **Angular 22** (current stable as
  of plan date), using **standalone components**, `bootstrapApplication`, and
  functional `provideRouter` / `provideHttpClient`. No NgModules, no NgRx/signals
  store package, no component library.
- **Rationale**: Stakeholder-chosen framework (spec assumptions / FR-001). Standalone
  is the default angular.dev path and keeps structure flat for two routes.
  Avoiding extra libraries honors Principle I aside from the mandated Angular
  baseline.
- **Alternatives considered**:
  - *Keep plain HTML/JS*: rejected by feature goal (FR-001, FR-010).
  - *Older Angular LTS (e.g. 21)*: workable, but greenfield app should start on
    current stable to avoid an immediate forced upgrade.
  - *NgModules + feature modules*: unnecessary ceremony for two screens.

## Decision 2: Preserve the existing HTTP API unchanged

- **Decision**: Consume the `001` OpenAPI contract as-is (`GET /api/map`,
  `POST /api/login`, `POST /api/logout`, `GET /api/session`). No backend business
  endpoints added for this feature (FR-009). Copy the contract into this feature’s
  `contracts/` for local reference.
- **Rationale**: Migration is frontend-only (spec assumptions). Clear API Contracts
  (Principle II) already hold; Angular is a new consumer, not a contract change.
- **Alternatives considered**:
  - *Rewrite auth as token-in-localStorage*: would alter security model and
    backend — out of scope and weaker than HttpOnly cookies.
  - *New BFF or GraphQL layer*: rejected as unjustified complexity.

## Decision 3: Session cookies during separated local development

- **Decision**: In local Angular development (`ng serve`, typically port 4200), use
  an Angular **dev proxy** (`proxy.conf.json`) so browser requests to `/api/*` are
  forwarded to `http://localhost:8000`. Configure `HttpClient` with
  `withCredentials: true` (or interceptor / `provideHttpClient` defaults). For
  optional single-origin run, FastAPI may mount the Angular **production build**
  at `/` (replacing the plain static mount) instead of adding CORS.
- **Rationale**: Today’s plain frontend is same-origin with the API, so cookies
  work without CORS. A proxy (or served build) preserves that model and matches
  the edge case “Session cookie / cross-origin setup” without expanding backend
  auth semantics.
- **Alternatives considered**:
  - *CORSMiddleware with `allow_credentials=True` and explicit origins*: viable,
    but cookies + CORS is easier to misconfigure; proxy/served-build keep
    same-origin behavior closer to production packaging.
  - *Always require CORS even when serving the built SPA from FastAPI*: unnecessary
    when origin is shared.

## Decision 4: Routing and page parity

- **Decision**: Angular Router routes: `''` → home (map landing), `'login'` → login
  form. Deep links and refresh must work (edge cases). After successful login,
  navigate to home (or equivalent post-login destination matching current
  behavior). If already authenticated and visiting `/login`, redirect/recognize
  without forcing credential re-entry.
- **Rationale**: Matches User Stories 1–2 and FR-002–FR-007 without inventing new
  product flows (FR-012 parity).
- **Alternatives considered**:
  - *Keep multi-page `.html` URLs (`/login.html`)*: possible via redirects, but
    cleaner to use SPA paths and document the new URLs; update any static links
    accordingly while preserving UX (login reachable from home).

## Decision 5: Cutover — retire plain frontend

- **Decision**: Full cutover in `frontend/`: remove (or stop serving) plain
  `index.html`, `login.html`, and `js/` as the live visitor UI. Documentation
  (`frontend/README.md`, root/backend run notes if any) describe Angular as the
  sole active frontend (FR-010, FR-011, SC-005, SC-006).
- **Rationale**: Spec assumes no long-lived dual-frontend period; dual UIs invite
  drift (User Story 3).
- **Alternatives considered**:
  - *Serve both side-by-side under `/legacy`*: rejected by FR-010 / SC-005.
  - *Incremental iframe wrap*: rejected as unnecessary complexity.

## Decision 6: Visual/interaction parity, not redesign

- **Decision**: Port existing CSS variables, layout, map scaling (`object-fit`
  / equivalent), header overlay, form patterns, and map `onerror` fallback into
  Angular templates/styles. No intentional visual redesign (FR-012).
- **Rationale**: Success criteria require 100% acceptance-scenario parity
  (SC-001), not a new design system.
- **Alternatives considered**: Adopting Angular Material or a new theme —
  rejected (out of scope; adds weight).

## Decision 7: Testing approach for the migration

- **Decision**: Keep backend pytest as the automated API safety net. Validate
  Angular UX via `quickstart.md` scenarios aligned to User Stories 1–3. Add
  Angular unit tests only for non-trivial client helpers if they appear; do not
  mandate Playwright/Cypress for this cutover.
- **Rationale**: Principle V — risky contract paths already tested; UI is thin
  presentation over known API.
- **Alternatives considered**: Full browser E2E suite — deferred as disproportionate
  for a parity migration of two screens.

## Decision 8: Constitution “JavaScript frontend” vs TypeScript

- **Decision**: Proceed with Angular’s TypeScript toolchain per the feature spec
  assumption that TypeScript as used by Angular is acceptable under the project’s
  JavaScript frontend constraint.
- **Rationale**: Angular without TypeScript is not a supported primary path;
  stakeholder migration implies accepting the normal Angular stack.
- **Alternatives considered**: Compiling a JS-only Angular subset — not practical;
  would fight the framework.
