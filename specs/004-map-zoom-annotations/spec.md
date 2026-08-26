# Feature Specification: Map Zoom & Interactive Annotations

**Feature Branch**: `004-map-zoom-annotations`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "add zoom for map pages. Add l features: loged in user can add text to map, if cliked on that text it will folow to another map. Loged in user can add point of interest to the map, if cleaked on that point small window will show app with text, optionaly it can have images."

**Additional input**: "add pont that text that leads to another map, user can change size of it after typing"

**Additional input**: "loged in user have small togels in buttom corner of map, one for lables and one for point of interest, turned on can be only one at the time, if togle turned on than user can click at any point on the map and make lable or poit depending on what is turned on"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anyone zooms and pans an open map (Priority: P1)

A visitor (signed in or not) opens a map and wants to inspect a small region of it. They zoom in to enlarge the map, drag to move around the enlarged map, zoom back out, and reset the view to see the whole map again. Zooming works without leaving the map view or reloading the page.

**Why this priority**: Map images contain detail that is unreadable when scaled to fit the viewport. Zoom is the foundation for every other capability in this feature — text links and points of interest are only placeable and clickable with confidence once the map can be magnified. It also delivers standalone value on existing maps with no other change.

**Independent Test**: Open any existing map as a logged-out visitor, zoom in on a region, pan around it, zoom out, and reset — confirming the map stays sharp-fitting, never leaves the visible area permanently, and returns to the original fit-to-view state.

**Acceptance Scenarios**:

1. **Given** a visitor is viewing a map, **When** they zoom in, **Then** the map is displayed at a larger scale with its aspect ratio preserved.
2. **Given** a visitor has zoomed in, **When** they drag the map, **Then** the visible region moves accordingly and the map cannot be dragged completely out of view.
3. **Given** a visitor has zoomed in, **When** they zoom out repeatedly, **Then** the map does not shrink below its fit-to-viewport size.
4. **Given** a visitor has zoomed and panned, **When** they choose to reset the view, **Then** the whole map is shown fitted to the viewport again.
5. **Given** a visitor is at the maximum zoom level, **When** they attempt to zoom in further, **Then** the zoom level stays at the maximum and the interface indicates no further zoom is possible.
6. **Given** a visitor on a touch device, **When** they pinch to zoom and drag to pan, **Then** the map responds the same way as with the mouse and keyboard controls.
7. **Given** a visitor zooms toward a specific spot, **When** the zoom is applied, **Then** that spot remains approximately under the pointer rather than jumping to an unrelated region.

---

### User Story 2 - Logged-in user adds clickable text that leads to another map (Priority: P2)

An authenticated user turns on the label toggle in the corner of the map, clicks the spot they want, types a short text label, and links it to another map in the catalog (for example, labelling a region "North District" that leads to the detailed North District map). After typing the text they adjust how large it appears on the map, so a region name can be large and prominent while a minor landmark stays discreet. Afterwards, any visitor — signed in or not — can click that text and be taken straight to the linked map's view.

**Why this priority**: This turns a set of unrelated map images into a navigable, connected set of maps, which is the main value the requester asked for beyond zooming. It depends on nothing but an existing catalog, and once delivered it is demonstrable on its own.

**Independent Test**: Log in, turn on the label toggle, click a spot on map A, point the label at map B, enlarge its text, save it, then sign out and confirm the label is visible on map A at the clicked spot in the chosen size and that clicking it opens map B's view.

**Acceptance Scenarios**:

1. **Given** an authenticated user opens a map, **When** the view loads, **Then** two small placement toggles — one for labels, one for points of interest — are shown in a bottom corner of the map, both switched off.
2. **Given** an authenticated user viewing a map with both toggles off, **When** they turn on the label toggle, **Then** the interface shows that clicking the map will create a label.
3. **Given** an authenticated user viewing a map with the label toggle on, **When** they click a spot on the map, enter the text, and select a target map, **Then** the label is saved and appears at that spot on the map.
4. **Given** an authenticated user has just saved a label with the label toggle still on, **When** they click another spot, **Then** they can create a second label without turning the toggle on again.
5. **Given** an authenticated user viewing a map with both toggles off, **When** they click anywhere on the map, **Then** no label or point of interest is created.
6. **Given** an authenticated user has the label toggle on, **When** they turn it off, **Then** clicking the map no longer creates labels and the map returns to plain viewing.
7. **Given** an authenticated user has the label toggle on, **When** they zoom or drag the map, **Then** the map zooms and pans as usual and no label is created by the drag.
8. **Given** an authenticated user has typed the label text, **When** they adjust its size, **Then** the label immediately previews at the new size on the map before they save.
9. **Given** an authenticated user saved a label at a chosen size, **When** any visitor opens that map, **Then** the label is shown at that size.
10. **Given** an authenticated user is adjusting a label's size, **When** they push the size past the smallest or largest allowed value, **Then** the size stops at that limit and the label stays legible.
11. **Given** an authenticated user adds a text link without adjusting its size, **When** they save it, **Then** the label is saved at a sensible default size.
12. **Given** a text link exists on a map, **When** any visitor (including a logged-out one) clicks it, **Then** they are taken to the linked map's view.
13. **Given** an authenticated user is adding a text link, **When** they submit without text or without choosing a target map, **Then** the attempt is rejected with a clear indication of what is missing and nothing is saved.
14. **Given** a visitor who is not logged in, **When** they view a map, **Then** they see existing text links but no placement toggles and no controls for adding or resizing labels.
15. **Given** a visitor who is not logged in, **When** they attempt to add or resize a text link by any means, **Then** the attempt is refused and the map is unchanged.
16. **Given** a map has text links, **When** a visitor zooms or pans the map, **Then** each label stays anchored to the same spot on the map image and keeps its size relative to the map.
17. **Given** a text link points at a map that has since been deleted, **When** a visitor clicks it, **Then** they see a clear unavailable message rather than a broken view.

---

### User Story 3 - Logged-in user adds a point of interest with a detail popup (Priority: P3)

An authenticated user turns on the point-of-interest toggle, clicks a spot on the map to mark it, and attaches descriptive text, optionally adding one or more images. Any visitor can click the marker to open a small popup showing that text and images, then dismiss the popup and continue exploring the map.

**Why this priority**: Points of interest enrich a single map with content but are not required for navigating between maps, so they follow the linking capability. They remain independently valuable and demonstrable on one map alone.

**Independent Test**: Log in, turn on the point-of-interest toggle, click a spot, add text and an image, then sign out and confirm the marker is visible, clicking it opens a popup with the text and image, and the popup can be closed.

**Acceptance Scenarios**:

1. **Given** an authenticated user viewing a map with the point-of-interest toggle on, **When** they click a spot and provide descriptive text, **Then** a marker is saved and shown at that spot.
2. **Given** an authenticated user has the label toggle on, **When** they turn on the point-of-interest toggle, **Then** the label toggle switches off and clicking the map creates points of interest instead of labels.
3. **Given** an authenticated user has the point-of-interest toggle on, **When** they turn on the label toggle, **Then** the point-of-interest toggle switches off, so only one placement mode is ever active.
4. **Given** an authenticated user is adding a point of interest, **When** they also attach one or more images, **Then** the images are saved with it and shown in its popup.
5. **Given** an authenticated user is adding a point of interest, **When** they provide text but no images, **Then** it is saved successfully and its popup shows only the text.
6. **Given** a point of interest exists, **When** any visitor clicks its marker, **Then** a small popup opens over the map showing its text and any images, without navigating away from the map.
7. **Given** a popup is open, **When** the visitor dismisses it, **Then** the popup closes and the map view (including zoom and pan position) is unchanged.
8. **Given** one popup is open, **When** the visitor clicks a different marker, **Then** the first popup closes and the second one opens, so at most one popup is shown at a time.
9. **Given** a visitor who is not logged in, **When** they view a map, **Then** they can open point-of-interest popups but see no placement toggles, and any attempt to add a point of interest is refused.
10. **Given** an authenticated user submits a point of interest without descriptive text, **When** they confirm, **Then** the attempt is rejected with a clear message and nothing is saved.
11. **Given** a point-of-interest image cannot be loaded, **When** a visitor opens its popup, **Then** the text is still readable and a graceful fallback replaces the missing image.

---

### User Story 4 - Logged-in user corrects or removes map annotations (Priority: P4)

An authenticated user notices a text link placed in the wrong spot, sized too small to read at a glance, a typo in a point of interest's description, or an annotation that no longer belongs on the map. They reposition, resize, edit, or delete it, and the change is immediately reflected for all visitors.

**Why this priority**: Without correction, every mistaken placement is permanent, which makes the authoring flows risky to use. It is nonetheless the last slice, because creating annotations delivers value before editing them does.

**Independent Test**: Log in, edit an existing text link's wording, target, and text size, move a point of interest to a new spot, delete another annotation with confirmation, then sign out and confirm all the changes are visible to a logged-out visitor.

**Acceptance Scenarios**:

1. **Given** an authenticated user viewing a map with annotations, **When** they edit a text link's wording or target map, **Then** the updated label and destination apply for all visitors.
2. **Given** an authenticated user viewing a map with annotations, **When** they change an existing text link's size, **Then** the label is shown at the new size for all visitors while staying anchored to its spot.
3. **Given** an authenticated user viewing a map with annotations, **When** they edit a point of interest's text or images, **Then** the updated content appears in its popup for all visitors.
4. **Given** an authenticated user viewing a map with annotations, **When** they move an annotation to a new spot, **Then** it is shown at the new spot and stays anchored there through zoom and pan.
5. **Given** an authenticated user chooses to delete an annotation, **When** they confirm the deletion, **Then** the annotation disappears from the map for all visitors.
6. **Given** an authenticated user has started deleting an annotation, **When** they cancel the confirmation, **Then** the annotation remains unchanged.
7. **Given** a visitor who is not logged in, **When** they view a map, **Then** they see no placement toggles and no edit, resize, move, or delete controls, and any such attempt is refused with the map left unchanged.

---

### Edge Cases

- **Very large or very small map images**: Zoom limits adapt so that a small image can still be magnified usefully and a very large one still fits the viewport at its reset state.
- **Window resized or device rotated while zoomed**: The map remains visible and correctly fitted; annotations stay anchored to their spots.
- **Annotation placed near a map edge**: Its label, marker, and popup remain fully readable on screen rather than being clipped outside the viewport.
- **Overlapping annotations**: Markers and labels placed close together remain individually clickable, and zooming in separates them.
- **Very large text link on a small map**: An enlarged label that would overflow the map stays within the allowed size range and remains readable without obscuring the whole map or breaking the layout.
- **Enlarged label near a map edge**: A resized label remains fully visible and clickable rather than being clipped off the map or viewport.
- **Many annotations on one map**: A map crowded with annotations still opens and stays responsive to zoom and pan.
- **Empty annotation set**: A map with no annotations behaves exactly as before, with zoom fully functional.
- **Self-referencing text link**: A text link pointing at its own map is allowed and simply reloads/keeps that map's view.
- **Target map deleted after linking**: Following the link produces a clear unavailable message; the source map and its other annotations are unaffected.
- **Source map deleted**: Its annotations are removed with it and no longer appear anywhere.
- **Clicking an existing annotation while a placement toggle is on**: No new annotation is stacked on top of it; the author works with the annotation already there instead of being navigated away or shown its popup.
- **Placing while zoomed in**: The new annotation is anchored to the map point that was clicked, so it stays in the right place after zooming back out.
- **Annotation sitting under the toggles**: An annotation placed in the toggles' corner stays reachable — the toggles stay small and the map can be panned so the annotation clears them.
- **Small or short viewport**: The toggles remain visible and tappable in the corner without covering the middle of the map or the map's other controls.
- **Session expires while a placement toggle is on**: The next placement attempt is refused, the toggles stop offering authoring, the user is prompted to sign in again, and no partial annotation is saved.
- **Session expires mid-authoring**: The add, edit, resize, or delete attempt is refused, the user is prompted to sign in again, and no partial annotation is saved.
- **Oversized, unsupported, or corrupt point-of-interest image**: The upload is rejected with a clear message and the point of interest is either left unchanged or saved without that image, never in a broken state.
- **Very long annotation text**: Labels and popups handle long text readably (wrapping or scrolling) without breaking the map layout.
- **Concurrent editing**: If an annotation is changed or deleted while another visitor has the map open, reopening or refreshing the map shows the current state.
- **Keyboard-only and screen-reader visitors**: Zoom controls, text links, point-of-interest markers, and — for authenticated users — the placement toggles are reachable and operable without a mouse.

## Requirements *(mandatory)*

### Functional Requirements

#### Zoom & Pan

- **FR-001**: Any visitor MUST be able to zoom a map in and out while viewing it, without signing in and without leaving the map view.
- **FR-002**: The system MUST preserve the map image's aspect ratio at every zoom level.
- **FR-003**: The system MUST enforce a minimum zoom level no smaller than the map fitted to the viewport, and a maximum zoom level beyond which further zooming has no effect.
- **FR-004**: Any visitor MUST be able to pan a zoomed map, and the system MUST prevent the map from being moved entirely out of the visible area.
- **FR-005**: Any visitor MUST be able to reset the view to the whole map fitted to the viewport in a single action.
- **FR-006**: Zoom and pan MUST be operable with pointer (mouse/trackpad), touch gestures, and keyboard.
- **FR-007**: When zooming toward a specific point, the system MUST keep that point approximately stationary on screen.

#### Annotation Placement Toggles

- **FR-008**: The map view MUST present two small placement toggles in a bottom corner of the map — one for text labels and one for points of interest — to users with an authenticated session.
- **FR-009**: The toggles MUST NOT be shown to visitors without an authenticated session.
- **FR-010**: The toggles MUST stay reachable in that corner at every zoom level and pan position, and MUST be operable by pointer, touch, and keyboard.
- **FR-011**: At most one toggle MUST be active at any moment; turning one on MUST turn the other off.
- **FR-012**: Both toggles MUST start off each time a map view is opened.
- **FR-013**: The system MUST clearly indicate which toggle is active, and therefore which kind of annotation a click on the map will create.
- **FR-014**: An authenticated user MUST be able to turn the active toggle off, returning the map to plain viewing.
- **FR-015**: While the label toggle is active, clicking any point on the map MUST begin creating a text label anchored at that point; while the point-of-interest toggle is active, the same click MUST begin creating a point of interest at that point.
- **FR-016**: When no toggle is active, clicking the map MUST NOT create any annotation.
- **FR-017**: While a toggle is active, zoom and pan MUST remain fully usable, and dragging the map MUST pan it rather than create an annotation.
- **FR-018**: While a toggle is active, activating an existing annotation MUST NOT create a new annotation on top of it, MUST NOT navigate to its target map, and MUST NOT open its popup; the existing annotation MUST be offered for editing instead.
- **FR-019**: The active toggle MUST stay on after an annotation is created or its creation is cancelled, so several annotations can be placed in succession, and each newly created annotation MUST appear on the map immediately.

#### Text Links Between Maps

- **FR-020**: An authenticated user MUST be able to add a text label at a clicked spot on a map and link it to a map from the catalog.
- **FR-021**: The system MUST require both label text and a target map, rejecting incomplete submissions with clear feedback and saving nothing.
- **FR-022**: An authenticated user MUST be able to change a label's displayed text size after entering its text, both while first creating the label and later on an existing label.
- **FR-023**: While the size is being changed, the system MUST show the label at the new size on the map before the change is saved.
- **FR-024**: The system MUST enforce a minimum and maximum label text size, clamping attempts to go beyond either bound, and MUST keep the label legible at every size within that range.
- **FR-025**: The system MUST apply a sensible default text size to a label whose size was never adjusted.
- **FR-026**: The system MUST save each label's chosen text size and show the label at that size to all visitors on later views.
- **FR-027**: Label text size MUST be defined relative to the map image so a label keeps the same proportion to the map as the visitor zooms in and out.
- **FR-028**: Text labels MUST be visible to all visitors, including those who are not signed in.
- **FR-029**: Clicking or activating a text label MUST take the visitor to the linked map's view.
- **FR-030**: When a text label's target map is unavailable, the system MUST show a clear unavailable message instead of a broken view.

#### Points of Interest

- **FR-031**: An authenticated user MUST be able to add a point of interest at a clicked spot on a map with descriptive text.
- **FR-032**: An authenticated user MUST be able to optionally attach one or more images to a point of interest.
- **FR-033**: The system MUST require descriptive text for a point of interest and MUST accept a point of interest that has no images.
- **FR-034**: Activating a point of interest MUST open a small popup over the map showing its text and any images, without navigating away from the map.
- **FR-035**: The system MUST show at most one popup at a time and MUST let visitors dismiss a popup, restoring the map view with its zoom and pan position intact.
- **FR-036**: When a point-of-interest image cannot be loaded, the system MUST still show the text and MUST show a graceful fallback in place of the image.
- **FR-037**: The system MUST reject point-of-interest images that are unsupported or exceed the allowed size, with a clear message and no broken content saved.

#### Annotation Anchoring & Management

- **FR-038**: Text labels and points of interest MUST stay anchored to the map point where they were placed, across zoom, pan, viewport resize, and reload.
- **FR-039**: An authenticated user MUST be able to edit a text label's text, target map, and text size, and a point of interest's text and images.
- **FR-040**: An authenticated user MUST be able to reposition an existing annotation to a different spot on the map.
- **FR-041**: An authenticated user MUST be able to delete an annotation, with an explicit confirmation step before it is applied.
- **FR-042**: Successful edits, resizes, repositions, and deletions MUST be reflected for all visitors on subsequent map views.
- **FR-043**: Annotations MUST persist with their map — including each label's text size — so they reappear unchanged for any visitor who opens that map later.
- **FR-044**: When a map is deleted, its annotations MUST be removed with it.

#### Access Control

- **FR-045**: The placement toggles and the controls for adding, editing, resizing, repositioning, and deleting annotations MUST be visible and usable only to users with an authenticated session.
- **FR-046**: The system MUST refuse all annotation add, edit, resize, reposition, and delete attempts from unauthenticated users and MUST leave annotations unchanged in those cases.
- **FR-047**: The existing login/logout session capability MUST be reused; this feature MUST NOT introduce a separate account system or new roles.
- **FR-048**: Viewing maps, zooming, following text links, and opening point-of-interest popups MUST NOT require authentication.

### Key Entities *(include if feature involves data)*

- **Map Annotation**: A marker placed on a specific map at a specific spot. Common attributes: stable identity, owning map, position expressed relative to the map image so it survives zoom and resize, creation/update time. Relationships: belongs to exactly one map; removed when that map is removed. Exists in two kinds — Text Link and Point of Interest.
- **Text Link**: An annotation kind that displays short text and navigates to another map when activated. Attributes: display text, target map reference, text size chosen by the author within allowed bounds and expressed relative to the map image so it scales with zoom. Relationships: references a map in the catalog (possibly its own map); may reference a map that later becomes unavailable.
- **Point of Interest**: An annotation kind that displays a marker and opens a popup when activated. Attributes: descriptive text (required), ordered collection of images (optional). Relationships: owns its images; images are removed when it is removed.
- **Point-of-Interest Image**: An image shown inside a point-of-interest popup. Attributes: image content (or reference), display order, availability status. Relationships: belongs to exactly one point of interest.
- **Map View State**: The visitor's current zoom level and pan position for the map they are viewing. Attributes: zoom level within allowed bounds, visible-region offset. Not persisted between visits; resettable to fit-to-viewport.
- **Placement Mode**: The authoring state of an open map view for an authenticated user — exactly one of: off, placing text labels, or placing points of interest. Attributes: which of the three states is current. Relationships: determines what a click on the map creates; always starts off when the view opens; never available to unauthenticated visitors; not shared between visitors and not remembered between visits.
- **Authenticated Session**: The existing logged-in state used to authorize annotation authoring. Attributes: authenticated status, expiry. Relationships: when present, enables annotation management; when absent, those actions are hidden and refused.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of visitors, signed in or not, can zoom and pan any open map, and the map remains legible at every zoom level with no distortion.
- **SC-002**: Zoom and pan feel immediate, with the map responding to a zoom or drag action within a quarter of a second on a typical laptop and on a typical mobile device.
- **SC-003**: A visitor can zoom in on a chosen region and read detail that was unreadable in the fit-to-viewport view, in at most three actions.
- **SC-004**: An authenticated user can start placing labels or points of interest in one action from the map view, and can switch between the two modes in one further action.
- **SC-005**: Both placement modes are never active at once, and no map view ever opens with a mode already active, in 100% of checks.
- **SC-006**: 100% of map clicks made with no placement mode active — by any visitor, signed in or not — create no annotation.
- **SC-007**: An authenticated user can add a text link to another map — placement, text, size, and target — in under 90 seconds, and it is clickable by a logged-out visitor on the first attempt.
- **SC-008**: An authenticated user can place three annotations in a row without leaving or re-arming the active placement mode between them.
- **SC-009**: An authenticated user can change a label's text size and see the result on the map within a second of each adjustment, reaching a size they judge right in under 30 seconds.
- **SC-010**: 100% of saved label sizes are shown identically to logged-out visitors after a reload, and remain proportional to the map at every zoom level.
- **SC-011**: 100% of text link activations lead to the intended map view, or to a clear unavailable message when the target no longer exists.
- **SC-012**: An authenticated user can add a point of interest with text and one image in under 2 minutes, and its popup shows that content to a logged-out visitor on the first attempt.
- **SC-013**: 100% of point-of-interest popups open over the map without navigating away and can be dismissed with the map's zoom and pan position preserved.
- **SC-014**: Annotations stay anchored within a small visual tolerance of the map point where they were placed, across zoom, pan, viewport resize, and reload, in 100% of checks.
- **SC-015**: 100% of annotation add, edit, resize, reposition, and delete attempts made without an authenticated session are refused, leaving annotations unchanged.
- **SC-016**: In usability checks, at least 90% of first-time visitors can zoom a map, follow a text link, and open a point-of-interest popup without assistance.
- **SC-017**: In usability checks, at least 90% of authenticated users can place their first label without guidance beyond the toggles themselves.
- **SC-018**: A map carrying at least 50 annotations opens and remains responsive to zoom and pan without visible stutter.
- **SC-019**: When a point-of-interest image is missing or fails to load, 100% of popup views still show the descriptive text with a fallback in place of the image.

## Assumptions

- "Logged-in user" refers to the existing single admin identity and session established by the earlier login and map-management features; no multi-user roles, per-user ownership, or self-registration are introduced.
- Annotations are public content: any authenticated session may manage every annotation, and all visitors see the same annotations on a given map.
- Text links may target any map in the catalog, including the map they are placed on; there is no restriction on link depth or cycles.
- Adjustable size applies to a text link's text only, chosen from a bounded range with a sensible default; point-of-interest markers keep one uniform size. Other text styling — font family, colour, bold/italic, rotation, alignment — is out of scope.
- A label's size is part of the annotation and is the same for every visitor; it is not a per-visitor display preference.
- Point-of-interest content is plain text plus images; rich text, embedded video, audio, and external hyperlinks inside popups are out of scope.
- Point-of-interest images are supplied by upload in the same common web image formats and within a comparable size limit already used for map images, reusing that handling rather than introducing new media capabilities.
- A practical upper bound on images per point of interest (a small handful rather than an unlimited gallery) is acceptable and will be set to a sensible product default.
- The two placement toggles are the only way to create annotations; there is no separate authoring page, context menu, or bulk import.
- Placement mode is per-visit interface state, not saved content: it always starts off when a map view opens and is never remembered between visits or shared between visitors.
- After clicking a spot with a mode active, the author still enters the annotation's details (label text, target map, and size; or point-of-interest text and images) and confirms before anything is saved — the click chooses the position, it does not save an empty annotation.
- Zoom and pan are per-visit view state only; the system does not remember a visitor's zoom level between sessions or share view state via links.
- Annotation positions are stored relative to the map image, not to screen pixels, so they remain correct on any viewport size and at any zoom level.
- Deletion of an annotation is permanent for this feature; there is no undo history, recycle bin, or version history.
- Existing map browsing, opening, adding, and deleting behavior from the maps list feature remains unchanged; this feature layers zoom and annotations on top of the existing map view.
- Layers, routes, drawing shapes, freehand markup, clustering of dense markers, and search across annotations remain out of scope.
- Ordinary contemporary browsers on desktop and mobile are the target; no offline use of maps or annotations is assumed.
