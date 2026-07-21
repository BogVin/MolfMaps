# Feature Specification: Maps List & Admin Map Management

**Feature Branch**: `003-maps-list-admin`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "allow admin that are loged in to add new maps, also make new page that will show lost of all maps. Maps page and opening maps allowed for all users, only loged in user can add or delete already existing map"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anyone browses the maps list (Priority: P1)

A visitor (signed in or not) opens the Maps page and sees a list of all available maps. Each entry is clearly identifiable (e.g., by name) so they can choose which map to open. No sign-in is required to view the list.

**Why this priority**: Discovering and browsing maps is the core public value of this feature. Without a usable list, add/delete capabilities have nowhere to surface and visitors cannot find maps beyond a single landing image.

**Independent Test**: With at least one map available, open the Maps page in a fresh browser session (not logged in) and confirm all maps appear in a readable list with a way to open each map.

**Acceptance Scenarios**:

1. **Given** one or more maps exist, **When** a visitor opens the Maps page without signing in, **Then** they see a list of all maps.
2. **Given** the Maps page is open, **When** maps are listed, **Then** each map shows a clear display name so the visitor can tell maps apart.
3. **Given** no maps exist, **When** a visitor opens the Maps page, **Then** they see a clear empty state explaining that no maps are available yet (not a blank or broken page).
4. **Given** the site is open, **When** a visitor looks for maps, **Then** there is a visible, accessible way to navigate to the Maps page from the main site navigation.

---

### User Story 2 - Anyone opens a map from the list (Priority: P1)

A visitor selects a map from the Maps list and views that map’s image as the primary content. Opening a map does not require authentication.

**Why this priority**: Listing maps only matters if visitors can open and view them. This is the public consumption path and pairs with the list as the minimum useful product.

**Independent Test**: From the Maps page while not logged in, open a listed map and confirm its image is shown as the primary view content.

**Acceptance Scenarios**:

1. **Given** a visitor on the Maps page, **When** they choose a listed map, **Then** they are taken to a view that displays that map’s image as the primary content.
2. **Given** a map view is open, **When** the image finishes loading, **Then** it is shown without visual distortion and scaled to fit the viewport appropriately.
3. **Given** a map’s image cannot be loaded, **When** the visitor opens that map, **Then** a graceful fallback is shown instead of a broken-image indicator.
4. **Given** a visitor is viewing a map, **When** they want to return to browsing, **Then** they can navigate back to the Maps list.

---

### User Story 3 - Logged-in admin adds a new map (Priority: P2)

An authenticated administrator adds a new map by providing a display name and an image file. After a successful add, the new map appears in the Maps list and can be opened by anyone.

**Why this priority**: Admin creation grows the catalog, but the public list/open flows deliver value first even with only pre-existing maps. Add is the first privileged write path.

**Independent Test**: Log in as admin, add a map with a name and image, then confirm (including in a logged-out session) that the new map appears in the list and can be opened.

**Acceptance Scenarios**:

1. **Given** an authenticated admin on the Maps page (or add-map flow), **When** they submit a valid display name and map image, **Then** the map is created and appears in the Maps list.
2. **Given** an authenticated admin, **When** they attempt to add a map without a name or without an image, **Then** the system rejects the attempt and indicates the missing required information.
3. **Given** a visitor who is not logged in, **When** they view the Maps page, **Then** they do not see controls to add a new map.
4. **Given** a visitor who is not logged in, **When** they somehow attempt to add a map, **Then** the system refuses the action and does not create a map.
5. **Given** an admin has just added a map, **When** any visitor opens the Maps list, **Then** the new map is included and can be opened.

---

### User Story 4 - Logged-in admin deletes an existing map (Priority: P2)

An authenticated administrator removes a map that should no longer be available. After deletion, the map no longer appears in the list and cannot be opened. Visitors who are not logged in never see delete controls and cannot delete maps.

**Why this priority**: Deletion is required for catalog hygiene and was explicitly requested with the same privilege boundary as add. It depends on having maps to remove, so it ranks with add rather than ahead of public browse/open.

**Independent Test**: Log in as admin, delete an existing map (with confirmation), then confirm it is gone from the list and cannot be opened; confirm a logged-out visitor cannot delete.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewing the Maps list (or a map’s management controls), **When** they choose to delete a map and confirm the action, **Then** the map is removed and no longer appears in the list.
2. **Given** an authenticated admin has started deleting a map, **When** they cancel the confirmation, **Then** the map remains available and unchanged.
3. **Given** a visitor who is not logged in, **When** they view the Maps page or a map, **Then** they do not see controls to delete a map.
4. **Given** a visitor who is not logged in, **When** they somehow attempt to delete a map, **Then** the system refuses the action and the map remains available.
5. **Given** a map has been deleted, **When** anyone tries to open that map (including via a previous link), **Then** they see a clear not-found or unavailable message rather than the deleted map.

---

### Edge Cases

- **Empty catalog**: Maps page shows a clear empty state; add controls are available only to authenticated admins.
- **Duplicate names**: Two maps may share the same display name; the system still treats them as distinct maps (identity is not solely the name).
- **Unsupported or corrupt image on add**: The add attempt fails with a clear message; no partial/broken map entry is left in the list.
- **Very large image upload**: Oversized images are rejected with a clear message rather than hanging or silently failing.
- **Session expires mid-action**: If an admin’s session expires while adding or deleting, the action is refused and they must log in again; the catalog is left unchanged for failed attempts.
- **Concurrent delete**: If a map is deleted while another user is viewing the list, refreshing or reopening shows the updated list without that map.
- **Last map deleted**: Deleting the final map returns the catalog to the empty state; the site remains usable.
- **Direct URL to Maps or a specific map**: Bookmarks and shared links to the Maps page or a map view work for anyone without requiring login.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Maps page that lists all available maps for any visitor without requiring authentication.
- **FR-002**: The Maps page MUST be reachable via a visible, accessible navigation path from the site’s main visitor-facing pages.
- **FR-003**: Each listed map MUST show a display name so visitors can distinguish maps in the list.
- **FR-004**: Any visitor MUST be able to open a listed map and view that map’s image as the primary content without signing in.
- **FR-005**: Map images MUST be displayed without distorting aspect ratio and MUST scale appropriately to the viewport.
- **FR-006**: When a map image cannot be loaded, the system MUST show a graceful fallback instead of a broken-image indicator.
- **FR-007**: When no maps exist, the Maps page MUST show a clear empty state.
- **FR-008**: An authenticated admin MUST be able to add a new map by providing a display name and an image file.
- **FR-009**: The system MUST require both a display name and an image when adding a map, and MUST reject incomplete submissions with clear feedback.
- **FR-010**: After a successful add, the new map MUST appear in the Maps list and be openable by any visitor.
- **FR-011**: An authenticated admin MUST be able to delete an existing map, with an explicit confirmation step before the delete is applied.
- **FR-012**: After a successful delete, the map MUST no longer appear in the Maps list and MUST NOT be viewable via its previous open link.
- **FR-013**: Add and delete controls MUST be visible and usable only when the user has an authenticated admin session.
- **FR-014**: The system MUST refuse add and delete attempts from unauthenticated users and MUST NOT change the map catalog in those cases.
- **FR-015**: Visitors MUST be able to navigate from an open map view back to the Maps list.
- **FR-016**: The existing admin login/logout session capability MUST be reused; this feature does not introduce a separate account system.

### Key Entities *(include if feature involves data)*

- **Map**: A catalog entry that visitors can list and open. Attributes: stable identity, display name, image content (or reference), availability status. Relationships: appears in the Maps list; openable as a map view.
- **Admin Session**: The existing authenticated admin login state used to authorize add and delete. Attributes: authenticated status, expiry. Relationships: when present, enables map management actions; when absent, those actions are hidden and refused.
- **Map Catalog**: The collection of all currently available maps shown on the Maps page. Changes when an admin successfully adds or deletes a map.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of visitors who open the Maps page (signed in or not) can see the full list of available maps or a clear empty state within 3 seconds on a typical broadband connection.
- **SC-002**: 100% of listed maps can be opened by a logged-out visitor, and the chosen map’s image is visible as primary content within 3 seconds on a typical broadband connection when the asset is available.
- **SC-003**: An authenticated admin can complete adding a new map (name + image) in under 2 minutes and see it appear in the Maps list on the first successful attempt.
- **SC-004**: An authenticated admin can delete a map (including confirmation) in under 1 minute, after which 100% of subsequent list and open attempts treat that map as unavailable.
- **SC-005**: 100% of add or delete attempts made without an authenticated admin session are refused, and the catalog is unchanged.
- **SC-006**: In usability checks, at least 90% of first-time visitors can find the Maps page and open a map without assistance.
- **SC-007**: When a map image is missing or fails to load, 100% of open attempts show a fallback rather than a broken-image indicator.

## Assumptions

- “Logged-in user” and “admin that are logged in” refer to the existing single admin identity and session from the map landing & login feature; no multi-user roles or self-registration are introduced.
- Adding a map requires a human-readable display name and one image file; editing/renaming maps after creation is out of scope for this feature.
- Supported image formats follow common web image types already used by the product (e.g., WebP and typical browser-supported formats); exact size limits follow a reasonable operator-configured or product default sufficient for map images.
- Delete is permanent for this feature (no recycle bin or soft-delete recovery UI).
- The existing home/landing map experience remains available; this feature adds a Maps list page and per-map open views rather than replacing the home page with the list.
- The current main map asset is represented in the catalog (or remains reachable as today) so the site still has at least one map to browse once the catalog is in use; seeding/migration details are an implementation concern as long as public browse/open works.
- Interactive map behaviors beyond viewing the map image (pan/zoom tools, markers, layers, annotations) remain out of scope.
- Password reset, account lockout, and additional admin accounts remain out of scope.
