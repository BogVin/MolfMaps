# Feature Specification: Map Landing & Admin Login

**Feature Branch**: `001-map-landing-login`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "First step for creating website with python fast api for backend and js for frontend. When user first entered website the kal_main_map.webp should be displayed. There should be login page, so admin can enter via predefined cred form .env"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor sees the main map on arrival (Priority: P1)

A visitor opens the website's home address in a browser. Without needing to sign in or take any action, they are presented with the main map image (`kal_main_map.webp`) rendered prominently as the landing view.

**Why this priority**: This is the core public-facing value of the site — showing the map is the reason the site exists. It delivers immediate value with no dependency on authentication and is a complete, demonstrable slice on its own.

**Independent Test**: Open the site root in a fresh browser session (not logged in) and confirm the main map image is displayed correctly and fills the intended landing area.

**Acceptance Scenarios**:

1. **Given** a visitor who has never signed in, **When** they navigate to the site's home page, **Then** the main map image is displayed as the primary content.
2. **Given** the home page is loaded, **When** the map image finishes loading, **Then** it is shown without visual distortion and scaled to fit the viewport appropriately.
3. **Given** a visitor on the home page, **When** they view the page, **Then** a way to reach the login page (e.g., a login link/button) is available without obscuring the map.

---

### User Story 2 - Admin logs in with predefined credentials (Priority: P2)

An administrator navigates to the login page, enters the predefined username and password (configured by the operator outside the application code), and is granted an authenticated admin session. Incorrect credentials are rejected with a clear message.

**Why this priority**: Authentication gates future admin-only capabilities. It is essential to the product's roadmap but is not required for the public map view to deliver value, so it ranks just below the landing map.

**Independent Test**: Navigate to the login page, submit the correct predefined credentials, and confirm an authenticated admin state is reached; separately submit wrong credentials and confirm access is denied with an error message.

**Acceptance Scenarios**:

1. **Given** the login page is open, **When** the admin submits the correct predefined username and password, **Then** they are authenticated and taken to the post-login destination.
2. **Given** the login page is open, **When** someone submits an incorrect username or password, **Then** login is refused and a clear, non-revealing error message is shown.
3. **Given** the login form, **When** it is submitted with an empty username or password, **Then** the form indicates the required fields and does not attempt authentication.
4. **Given** an authenticated admin session, **When** the admin returns to the site, **Then** they remain recognized as logged in until the session expires or they log out.

---

### Edge Cases

- **Missing map asset**: If the main map image fails to load, the home page shows a friendly fallback/placeholder rather than a broken image.
- **Missing credential configuration**: If the predefined admin credentials are not configured by the operator, login attempts fail safely (no one can log in) and the situation is surfaced to the operator, not to end users.
- **Repeated failed logins**: Multiple wrong-password attempts are handled gracefully without leaking whether the username or the password was wrong.
- **Direct navigation to login while already authenticated**: An already-logged-in admin visiting the login page is handled sensibly (e.g., recognized as logged in rather than forced to re-enter credentials).
- **Session expiry**: When an admin session expires, subsequent admin actions require logging in again.
- **Large image on slow connections**: The map image loads acceptably (with progressive/appropriate loading) on typical broadband and does not block basic page interaction indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the main map image (`kal_main_map.webp`) as the primary content of the home/landing page to any visitor without requiring authentication.
- **FR-002**: The system MUST render the map image scaled to fit the browser viewport without distorting its aspect ratio.
- **FR-003**: The home page MUST provide a visible, accessible way to navigate to the login page.
- **FR-004**: The system MUST provide a login page with fields for a username and a password.
- **FR-005**: The system MUST authenticate an admin only when the submitted credentials match the predefined credentials supplied by the operator via external configuration (an environment/`.env`-style source), not hardcoded in application code.
- **FR-006**: The system MUST reject invalid credentials and display a clear error message that does not reveal which field was incorrect.
- **FR-007**: The system MUST validate that both username and password are provided before attempting authentication.
- **FR-008**: The system MUST establish an authenticated admin session upon successful login and maintain it across page navigations until logout or expiry.
- **FR-009**: The system MUST provide a way for an authenticated admin to log out, ending the session.
- **FR-010**: The system MUST keep admin credentials out of version control and out of any content served to the browser.
- **FR-011**: The system MUST behave safely when the predefined credentials are not configured, disallowing all logins rather than granting default access.
- **FR-012**: The system MUST display a graceful fallback when the map image cannot be loaded.

### Key Entities *(include if feature involves data)*

- **Admin User**: The single privileged operator identity, defined by a predefined username and password held in external operator configuration. Attributes: username, password (secret). No self-registration; not stored in an application database for this feature.
- **Admin Session**: Represents an authenticated admin's active login state. Attributes: authenticated status, creation time, expiry. Ends on logout or expiry.
- **Main Map Asset**: The `kal_main_map.webp` image presented on the landing page. Attributes: image content, intended display placement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of first-time visitors reaching the home page see the main map image rendered as the primary content without any sign-in step.
- **SC-002**: The main map image is visible on the landing page within 3 seconds on a typical broadband connection.
- **SC-003**: An admin using the correct predefined credentials can complete login and reach the authenticated state in under 30 seconds and in no more than 2 steps (open login page, submit form).
- **SC-004**: 100% of login attempts with incorrect or missing credentials are denied, and none reveal which field was wrong.
- **SC-005**: No admin credential value ever appears in version-controlled files or in any response delivered to the browser.
- **SC-006**: When the map asset is unavailable, 100% of home-page loads show a fallback instead of a broken-image indicator.

## Assumptions

- A single admin identity is sufficient for this first step; multi-user accounts, roles, and self-registration are out of scope.
- Predefined admin credentials are provided by the operator via an environment configuration source (`.env`-style) and are not managed through the UI.
- After successful login, the admin lands on a simple authenticated destination (e.g., the home page in an admin-recognized state); admin-only management features are out of scope for this feature and will be defined later.
- The map is presented as a static image for this first step; interactive map behaviors (pan/zoom beyond browser defaults, markers, layers) are out of scope here.
- Password reset, "remember me", and account lockout policies are out of scope for this first step; sessions simply expire.
- The site targets modern desktop and mobile browsers with WebP image support.
- Backend and frontend are separate concerns communicating over HTTP, consistent with the project constitution.
