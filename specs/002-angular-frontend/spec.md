# Feature Specification: Migrate Frontend to Angular

**Feature Branch**: `002-angular-frontend`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "migrate frontend to Angular"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor sees the main map after migration (Priority: P1)

A visitor opens the website home address in a browser. Without signing in, they see the main map image as the primary landing content, with a clear way to reach login — the same public experience as today, delivered by the new frontend.

**Why this priority**: Preserving the public map landing is the core product value. If migration breaks this, the site fails its primary purpose.

**Independent Test**: Open the site root in a fresh browser session (not logged in) and confirm the main map image displays as primary content and a path to login is available.

**Acceptance Scenarios**:

1. **Given** a visitor who has never signed in, **When** they navigate to the site's home page on the migrated frontend, **Then** the main map image is displayed as the primary content.
2. **Given** the home page is loaded, **When** the map image finishes loading, **Then** it is shown without visual distortion and scaled to fit the viewport appropriately.
3. **Given** a visitor on the home page, **When** they view the page, **Then** a way to reach the login page is available without obscuring the map.
4. **Given** the map asset cannot be loaded, **When** the home page is shown, **Then** a graceful fallback is displayed instead of a broken image.

---

### User Story 2 - Admin can log in and out after migration (Priority: P1)

An administrator uses the login page on the migrated frontend, submits the predefined credentials, and obtains an authenticated session. They can log out. Incorrect or empty credentials are rejected with clear feedback. Behavior matches the pre-migration product.

**Why this priority**: Auth is required for future admin capabilities; a regression here blocks the product roadmap and must ship with the migration.

**Independent Test**: Complete login with correct credentials, confirm authenticated state; attempt wrong/empty credentials and confirm denial; log out and confirm the session ends.

**Acceptance Scenarios**:

1. **Given** the login page is open, **When** the admin submits the correct predefined username and password, **Then** they are authenticated and taken to the post-login destination.
2. **Given** the login page is open, **When** someone submits an incorrect username or password, **Then** login is refused and a clear, non-revealing error message is shown.
3. **Given** the login form, **When** it is submitted with an empty username or password, **Then** the form indicates the required fields and does not attempt authentication.
4. **Given** an authenticated admin session, **When** the admin returns to the site or refreshes, **Then** they remain recognized as logged in until the session expires or they log out.
5. **Given** an authenticated admin, **When** they choose to log out, **Then** the session ends and subsequent admin-recognized UI is no longer shown.
6. **Given** an already-logged-in admin, **When** they navigate to the login page, **Then** they are handled sensibly (recognized as logged in rather than forced to re-enter credentials unnecessarily).

---

### User Story 3 - Contributors work only with the Angular frontend (Priority: P2)

After migration, the site’s browser UI is provided by the Angular frontend. The previous plain HTML/JS frontend is retired from the active delivery path so there is a single frontend to run, change, and document.

**Why this priority**: A clean cutover avoids dual UIs and drift; it is valuable for maintainability but secondary to user-facing parity.

**Independent Test**: Run the documented frontend start path and confirm the served UI is the Angular app; confirm the retired frontend is no longer the active entry point for visitors.

**Acceptance Scenarios**:

1. **Given** a contributor following the project’s frontend run instructions, **When** they start the frontend, **Then** the Angular application is what serves the visitor-facing pages.
2. **Given** the migrated site is running, **When** a visitor uses the product, **Then** they interact only with the Angular-delivered UI (not a leftover parallel plain frontend).
3. **Given** migration is complete, **When** a contributor looks for how to work on the UI, **Then** documentation describes the Angular frontend as the sole active frontend.

---

### Edge Cases

- **Backend unavailable or slow**: Login and map-related requests show clear user-facing error or loading feedback; the UI does not hang indefinitely without indication.
- **Missing map asset**: Home page shows the same graceful fallback behavior as before migration.
- **Session cookie / cross-origin setup**: Authenticated session recognition continues to work with the existing backend session mechanism under the documented local run setup.
- **Direct deep links**: Navigating directly to home or login routes works (refresh and bookmark-friendly entry points).
- **Browser back/forward**: Moving between home and login via browser history does not leave the UI in a broken or blank state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product’s visitor-facing UI MUST be delivered by an Angular application that replaces the current plain HTML/CSS/JavaScript frontend as the sole active frontend.
- **FR-002**: The Angular frontend MUST preserve the public landing experience: display the main map image as primary home content without requiring authentication, with appropriate viewport scaling and no aspect-ratio distortion.
- **FR-003**: The home view MUST provide a visible, accessible way to navigate to the login view.
- **FR-004**: The Angular frontend MUST provide a login view with username and password fields, client-side required-field validation, and clear error display for failed authentication.
- **FR-005**: The Angular frontend MUST authenticate admins only by calling the existing backend authentication capability; it MUST NOT embed or hardcode admin credentials in the frontend.
- **FR-006**: On successful login, the frontend MUST reflect the authenticated admin state and continue to recognize that state across navigations until logout or session expiry.
- **FR-007**: The frontend MUST provide a way for an authenticated admin to log out, ending the session via the existing backend capability.
- **FR-008**: The frontend MUST display a graceful fallback when the map image cannot be loaded.
- **FR-009**: The frontend MUST continue to communicate with the backend only over the existing HTTP API contract; no new backend business-logic endpoints are required for this migration.
- **FR-010**: The previous plain frontend MUST be removed from the active delivery path (retired or replaced) so visitors and contributors do not use two competing frontends.
- **FR-011**: Project documentation for running and developing the frontend MUST be updated to reflect the Angular-based workflow.
- **FR-012**: Visual and interaction parity with the pre-migration product is required for landing, login, session reflection, logout, and map fallback; intentional redesign beyond that parity is out of scope.

### Key Entities

- **Main Map Asset**: The main map image presented on the landing view (same asset and role as the current product).
- **Admin Session**: Authenticated admin state established by the existing backend; the frontend only reflects and requests creation/clearing of that session.
- **Frontend Application**: The Angular-based browser UI that owns presentation, navigation between home and login, and user interaction with the API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the pre-migration acceptance scenarios for public map landing and admin login/logout succeed after migration without behavioral regression.
- **SC-002**: First-time visitors see the main map as primary home content within 3 seconds on a typical broadband connection (same bar as the current product).
- **SC-003**: An admin with correct credentials can complete login and reach the authenticated state in under 30 seconds and in no more than 2 steps (open login, submit form).
- **SC-004**: 100% of login attempts with incorrect or missing credentials are denied with clear, non-revealing feedback.
- **SC-005**: After cutover, there is exactly one active frontend delivery path; the retired plain frontend is not served as the live visitor UI.
- **SC-006**: A new contributor can start the frontend using updated documentation and reach the home map view on first attempt without undocumented steps.
- **SC-007**: No admin credential values appear in frontend source, build output, or browser-delivered assets.

## Assumptions

- Migration is a full cutover of the existing small frontend (landing + login), not a long-lived dual-frontend period.
- Backend API, session cookie behavior, credential configuration, and map asset serving remain unchanged; this feature is frontend-only.
- Scope is behavioral parity with `001-map-landing-login` (map landing, login, session reflection, logout, map fallback) — no new product features in this migration.
- Intentional visual redesign, new admin tools, interactive map behaviors, and multi-user auth are out of scope.
- Modern browsers already targeted by the current product remain the target audience.
- Angular is the stakeholder-chosen frontend framework for this migration; TypeScript as used by Angular is acceptable under the project’s JavaScript frontend constraint.
- Local development continues to keep frontend and backend separable over HTTP, consistent with the project constitution.
