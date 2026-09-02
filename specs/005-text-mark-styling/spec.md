# Feature Specification: Text Mark Styling & Region Links

**Feature Branch**: `005-text-mark-styling`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Lets allow user to change not only size for the text marks but color and font."

**Additional input**: "lets update it and add aditional feature, user can make invisible rectangle as links, add options for rectangle like size obiviousle but also behaiver if hover on like change color when hover on, what color how bright and transparent it should be and so on"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Author styles a new text mark (Priority: P1)

An authenticated user places a text mark on a map the same way they do today: they turn on the label toggle, click a spot, type the wording, and choose the linked map. In addition to adjusting size, they pick a color and a typeface so the mark can stand out against the map or match a visual convention (for example, a district name in dark blue serif versus a small landmark in compact sans-serif). They see the wording update on the map as they change color, typeface, and size, then save. Visitors later see that styled mark at the same spot.

**Why this priority**: Size alone is already available; color and typeface are the missing styling controls that make text marks useful as visual hierarchy. Authoring a new mark with all three properties is the core value of the text-styling slice and can ship even if region links wait.

**Independent Test**: Log in, create a text mark, set size, color, and typeface to values other than the defaults, save, then open the map while signed out and confirm the mark appears with those choices and still navigates to the linked map.

**Acceptance Scenarios**:

1. **Given** an authenticated user has typed a new text mark's wording, **When** they choose a color, **Then** the mark immediately previews in that color on the map before they save.
2. **Given** an authenticated user has typed a new text mark's wording, **When** they choose a typeface from the offered set, **Then** the mark immediately previews in that typeface on the map before they save.
3. **Given** an authenticated user is creating a text mark, **When** they adjust size, color, and typeface together, **Then** the preview on the map reflects all three at once.
4. **Given** an authenticated user saves a text mark after choosing color and typeface, **When** any visitor opens that map, **Then** the mark is shown in the saved color and typeface at the saved size.
5. **Given** an authenticated user adds a text mark without changing color or typeface, **When** they save it, **Then** the mark uses the same default appearance visitors already see for unsized-beyond-default marks today, plus the existing default size.
6. **Given** an authenticated user is choosing a color or typeface, **When** they attempt a value that is not allowed, **Then** the choice is refused or clamped to an allowed option, with clear feedback, and nothing invalid is saved.
7. **Given** a visitor who is not logged in, **When** they view a map, **Then** they see styled text marks but no controls for changing color, typeface, or size.

---

### User Story 2 - Author restyles an existing text mark (Priority: P2)

An authenticated user selects an existing text mark that is hard to read on the map (wrong color against the artwork, or a typeface that does not fit). They change its color, typeface, and/or size without recreating it, confirm, and every visitor then sees the updated look while the wording, linked map, and position stay as they were unless also edited.

**Why this priority**: Maps already have text marks whose size can be changed; those marks need the same color and typeface controls so authors are not forced to delete and recreate them.

**Independent Test**: Log in, change only the color and typeface of an existing text mark, save, then confirm as a signed-out visitor that wording, destination, and position are unchanged and the new color and typeface are visible.

**Acceptance Scenarios**:

1. **Given** an authenticated user viewing a map with text marks, **When** they change an existing mark's color, **Then** the mark is shown in that color for all visitors and stays anchored to its spot.
2. **Given** an authenticated user viewing a map with text marks, **When** they change an existing mark's typeface, **Then** the mark is shown in that typeface for all visitors.
3. **Given** an authenticated user changes color, typeface, and size on an existing mark, **When** they save, **Then** all three updates apply together and the wording, target map, and position remain unchanged unless they also edited those fields.
4. **Given** an authenticated user opens the editor for an existing mark, **When** they cancel without saving, **Then** color, typeface, and size remain as they were.
5. **Given** a visitor who is not logged in, **When** they attempt to change a text mark's color or typeface by any means, **Then** the attempt is refused and the map is unchanged.

---

### User Story 3 - Author places an invisible region link (Priority: P2)

An authenticated user wants a painted region on the map (a building, a country, a room) to act as a link without covering it with a text label. They turn on a region-link placement mode, draw a rectangle over that area, choose the destination map, and set the rectangle's size. By default the rectangle is invisible at rest so the map art shows through. Visitors who move a pointer over it see the hover look the author configured; clicking or activating the region opens the linked map.

**Why this priority**: Region links are a distinct annotation kind that text marks cannot replace: they follow the shape of map artwork rather than displaying words. Placement plus a working link is the MVP; hover polish can be demonstrated on the same slice with defaults.

**Independent Test**: Log in, draw a rectangle over part of a map, link it to another map, leave rest appearance invisible, save, then as a signed-out visitor confirm the area looks unchanged until pointer hover (or equivalent press), and that activating it opens the linked map.

**Acceptance Scenarios**:

1. **Given** an authenticated user opens a map, **When** the view loads, **Then** placement controls include a region-link mode in addition to the existing text-label and point-of-interest modes, and at most one mode is active.
2. **Given** an authenticated user has region-link mode on, **When** they draw a rectangle on the map and choose a target map, **Then** the region is saved and that area becomes a link.
3. **Given** an authenticated user is drawing or editing a region, **When** they change its width or height, **Then** the rectangle previews at the new size on the map before save, within allowed bounds.
4. **Given** an authenticated user saves a region without changing hover or rest appearance, **When** any visitor views the map, **Then** the region is invisible at rest (map artwork shows through) and still activatable as a link.
5. **Given** a visitor viewing a map with a region link, **When** they activate the region (click, tap, or keyboard equivalent), **Then** they are taken to the linked map, or shown a clear unavailable message if that map is gone.
6. **Given** a visitor who is not logged in, **When** they view a map, **Then** they can use region links but see no controls for adding, resizing, or restyling them.
7. **Given** the system requires a target map for a region link, **When** the author tries to save without one, **Then** nothing is saved and they receive clear feedback.
8. **Given** an authenticated user has region-link mode on, **When** they zoom or drag the map, **Then** the map zooms and pans as usual and a drag that starts as pan does not create a region.

---

### User Story 4 - Author configures region hover appearance (Priority: P3)

The author wants the invisible hotspot to give feedback when someone points at it: a tint over the building, brighter or dimmer, more or less see-through. They set rest color, rest transparency, rest brightness, hover color, hover transparency, and hover brightness, preview both states, and save. Visitors then see rest until they hover (or press), and the hover look while the pointer is over the region.

**Why this priority**: Hover styling is what makes invisible links discoverable and on-brand, but the region must already exist and navigate (User Story 3) before these options have somewhere to live.

**Independent Test**: Log in, set a region to fully transparent at rest and a distinct color, brightness, and transparency on hover, save, then as a signed-out visitor confirm rest vs hover looks match those choices and the link still works.

**Acceptance Scenarios**:

1. **Given** an authenticated user is creating or editing a region link, **When** they set rest color, transparency, and brightness, **Then** the map preview shows the rest look.
2. **Given** an authenticated user is creating or editing a region link, **When** they set hover color, transparency, and brightness, **Then** they can preview the hover look without saving.
3. **Given** rest transparency is set to fully see-through, **When** a visitor is not hovering the region, **Then** no fill is visible over the map in that rectangle.
4. **Given** a visitor moves a pointer onto a region, **When** the pointer is over it, **Then** the region shows the saved hover color, brightness, and transparency.
5. **Given** a visitor moves the pointer off the region, **When** it leaves, **Then** the region returns to the saved rest look.
6. **Given** a visitor uses a touch screen with no persistent hover, **When** they press and hold on the region, **Then** the hover look appears for the press, and completing the activation still follows the link.
7. **Given** an authenticated user changes only hover appearance on an existing region, **When** they save, **Then** size, position, target map, and rest appearance stay as they were unless also edited.
8. **Given** values outside allowed ranges (for example transparency beyond fully clear or fully solid), **When** the author adjusts them, **Then** they are clamped or rejected with clear feedback and nothing invalid is saved.

---

### User Story 5 - Older text marks keep a sensible look (Priority: P4)

A visitor opens a map whose text marks were created before color and typeface could be set. Those marks still appear at their saved size, using a consistent default color and default typeface, remain clickable, and can later be restyled by an authenticated user without being recreated.

**Why this priority**: Existing catalog maps must not look broken after text styling lands. Region links are new, so this story applies only to text marks.

**Independent Test**: Open a map that has text marks saved with size only (no color or typeface recorded), confirm they render with the default color and typeface at their saved sizes, then log in and successfully assign a custom color and typeface to one of them.

**Acceptance Scenarios**:

1. **Given** a text mark that has a saved size but no recorded color or typeface, **When** any visitor opens the map, **Then** the mark appears at that size using the default color and default typeface.
2. **Given** such a mark, **When** an authenticated user opens it for editing, **Then** the editor shows the default color and typeface as the current choices so the author can change them.
3. **Given** a mix of older marks and newly styled marks on one map, **When** a visitor views the map, **Then** each mark uses its own saved (or defaulted) color, typeface, and size independently.

---

### Edge Cases

- **Color similar to the map artwork (text)**: The author is allowed to choose any permitted text color; the product does not auto-correct contrast. The default text color remains the current, generally readable appearance.
- **Very large text mark plus a decorative typeface**: Size limits from the existing text-mark feature still apply; the typeface change does not bypass those limits.
- **Typeface not in the offered set**: The mark is shown with the default typeface, and an authenticated user can pick a current offered typeface on save.
- **Unsupported or empty text color**: The attempt is rejected or the default color is used; the mark is never left with missing color.
- **Fully invisible region with no hover tint**: The region remains a valid link; visitors can still activate it if they hit the area. Authors are not blocked from this choice.
- **Region covering the whole map**: Size is clamped so the rectangle stays on the map image; a region may be large but must remain within the map bounds.
- **Overlapping region and text mark**: Each remains individually activatable; the control the visitor aims at is the one that receives the action. Authors are responsible for layout when they overlap.
- **Overlapping regions**: The region the visitor is pointing at that is treated as on top receives hover and activation; authors can reposition or resize to resolve ambiguity.
- **Very small region**: A minimum width and height is enforced so the region stays hittable.
- **Region near a map edge**: The rectangle stays on the map; resize and place cannot push it off the image.
- **Unavailable target map**: Activating the region shows a clear unavailable message instead of a broken view.
- **Session expires while changing style or drawing a region**: The save is refused, the user is prompted to sign in again, and stored annotations are unchanged.
- **Point of interest**: Color, typeface, and region-link hover controls do not apply; points of interest keep their existing appearance.
- **Zoom, pan, and resize**: Text marks and region rectangles stay anchored and keep map-relative size; colors and typefaces do not change with zoom. Hover look still applies at every zoom level.
- **Author editing an invisible region**: Authenticated users can still select and edit the rectangle (for example via a visible editing affordance) even when rest appearance is fully transparent to visitors.
- **Cancel create or edit**: Stored annotations, including region size and hover settings, remain unchanged.

## Requirements *(mandatory)*

### Functional Requirements

#### Text mark styling

- **FR-001**: An authenticated user MUST be able to set a text mark's color when creating the mark and when editing an existing mark.
- **FR-002**: An authenticated user MUST be able to set a text mark's typeface when creating the mark and when editing an existing mark, choosing from a small offered set of readable typefaces.
- **FR-003**: Existing size adjustment for text marks MUST remain available and MUST work together with color and typeface (all three are independent properties of the same mark).
- **FR-004**: While color, typeface, or size is being changed, the system MUST preview the mark on the map with the in-progress choices before save.
- **FR-005**: The system MUST persist each text mark's color, typeface, and size and MUST show those values to all visitors on later views.
- **FR-006**: Color, typeface, and size MUST be the same for every visitor of a given mark; they are authoring attributes, not per-visitor display preferences.
- **FR-007**: The system MUST apply a default color and a default typeface when the author does not choose them, matching the appearance text marks already have before this feature.
- **FR-008**: Text marks that have no recorded color or typeface MUST display using those defaults while still honoring any saved size.
- **FR-009**: The system MUST reject or ignore disallowed colors and typefaces and MUST NOT save invalid styling; in those cases it MUST keep a valid appearance (default or last valid saved values).
- **FR-010**: Unauthenticated visitors MUST see styled text marks but MUST NOT be offered controls to change color, typeface, or size, and any such attempt MUST be refused with the mark left unchanged.
- **FR-011**: Changing color or typeface MUST NOT alter the mark's wording, linked map, or position unless the author also edits those fields.
- **FR-012**: Point-of-interest annotations MUST remain unaffected: no color, typeface, or region-link authoring for those markers as part of this feature.
- **FR-013**: Canceling an in-progress create or edit MUST leave stored annotations unchanged, including text styling and region appearance.
- **FR-014**: Clicking a styled text mark MUST still take the visitor to the linked map, including when the mark uses non-default color or typeface.

#### Region links

- **FR-015**: An authenticated user MUST be able to place a rectangular region on a map and link it to a map from the catalog.
- **FR-016**: Placement of region links MUST use a dedicated placement mode that is mutually exclusive with text-label and point-of-interest modes; at most one mode is active, and all modes start off when a map view opens.
- **FR-017**: The system MUST require a target map for a region link, rejecting incomplete submissions with clear feedback and saving nothing.
- **FR-018**: An authenticated user MUST be able to set a region link's position, width, and height, both while creating it and when editing it, with the size previewed on the map before save.
- **FR-019**: Region position and size MUST be defined relative to the map image so the rectangle stays aligned with the same map area through zoom, pan, viewport resize, and reload.
- **FR-020**: The system MUST enforce minimum and maximum width and height, clamp attempts beyond those bounds, and MUST keep the rectangle fully on the map image.
- **FR-021**: By default, a new region link MUST be fully transparent at rest so the map artwork shows through (invisible hotspot).
- **FR-022**: An authenticated user MUST be able to set, independently for rest and for hover: fill color, transparency (from fully clear to fully solid), and brightness.
- **FR-023**: While rest or hover appearance is being changed, the system MUST let the author preview that state on the map before save.
- **FR-024**: When a pointer is not over the region, the system MUST show the saved rest appearance; when a pointer is over it, the system MUST show the saved hover appearance.
- **FR-025**: On devices without persistent hover, pressing on the region MUST show the hover appearance for the duration of the press, and completing the activation MUST follow the link.
- **FR-026**: The system MUST persist each region link's geometry, target map, rest appearance, and hover appearance, and MUST show those values to all visitors on later views.
- **FR-027**: Region appearance MUST be the same for every visitor of a given region; it is not a per-visitor display preference.
- **FR-028**: Clicking or otherwise activating a region link MUST take the visitor to the linked map's view; when the target is unavailable, the system MUST show a clear unavailable message instead of a broken view.
- **FR-029**: Region links MUST be usable by visitors who are not signed in; those visitors MUST NOT see authoring controls, and unauthenticated add, edit, resize, restyle, reposition, and delete attempts MUST be refused with the map left unchanged.
- **FR-030**: An authenticated user MUST be able to edit a region link's target map, size, position, rest appearance, and hover appearance, and MUST be able to delete it with an explicit confirmation step.
- **FR-031**: Authenticated users MUST be able to find, select, and edit a region even when its rest appearance is fully transparent to visitors.
- **FR-032**: Changing rest or hover appearance MUST NOT alter the region's target map, position, or size unless the author also edits those fields.
- **FR-033**: Disallowed appearance values MUST be rejected or clamped; the system MUST NOT save invalid appearance and MUST keep a valid look (defaults or last valid saved values).
- **FR-034**: Region links MUST remain activatable when rest appearance is fully transparent.
- **FR-035**: While region-link mode is active, zoom and pan MUST remain usable; dragging the map to pan MUST NOT create a region.

## Key Entities

- **Text Mark (Text Link)**: A public label on a map that shows short text and navigates to another map. Styling attributes: text size (already exists, map-relative), color (author-chosen, with a default), typeface (author-chosen from an offered set, with a default). Relationships: belongs to one map; styling is stored with the mark, not with the visitor.
- **Typeface Choice**: One of a small, product-defined set of readable typefaces offered to authors. Not a custom uploaded font file.
- **Color Choice**: A color applied to text-mark wording, or to a region fill in rest or hover, chosen by the author from the allowed color controls.
- **Region Link**: A rectangular area on a map that navigates to another map when activated. Attributes: position and size relative to the map image; target map; rest fill color, transparency, and brightness; hover fill color, transparency, and brightness. Default rest is fully transparent. Relationships: belongs to one map; may reference a catalog map that later becomes unavailable.
- **Region Appearance**: The visual fill of a region in one state (rest or hover). Attributes: color, transparency (see-through amount), brightness (how light or intense the fill looks). Rest and hover are two independent appearances on the same region.
- **Placement Mode**: Extended so an authenticated user may be off, placing text labels, placing points of interest, or placing region links — still exactly one at a time, starting off on every map view, not available when signed out.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user can set color and typeface on a new text mark (in addition to size) and confirm the preview on the map within 30 seconds of opening the styling controls.
- **SC-002**: After save, 100% of checked text marks show the same color, typeface, and size to a signed-out visitor as the author last saved (or the documented defaults if never chosen).
- **SC-003**: An authenticated user can change only color, only typeface, or both on an existing mark in under 45 seconds without recreating the mark.
- **SC-004**: 100% of text marks created before this feature still appear at their saved size using the default color and typeface, and remain clickable to the linked map.
- **SC-005**: 100% of unauthenticated attempts to change a text mark's color or typeface, or to add or restyle a region link, are refused, leaving the map unchanged.
- **SC-006**: In a mixed map of at least 10 text marks with differing colors and typefaces, visitors can distinguish marks by look and still activate the correct linked map on the first click in at least 90% of attempts.
- **SC-007**: Zooming and panning do not change a text mark's color or typeface or a region's rest/hover colors; sizes remain proportional to the map in 100% of checks.
- **SC-008**: An authenticated user can draw a region, choose a target map, and save an invisible-at-rest hotspot in under 90 seconds, and a signed-out visitor can activate it on the first attempt.
- **SC-009**: After save, 100% of checked region links keep the author's rest and hover color, brightness, and transparency for signed-out visitors, including fully transparent rest.
- **SC-010**: An authenticated user can adjust a region's size and hover appearance and see each change previewed on the map within a second of the adjustment, finishing a look they judge right in under 60 seconds.
- **SC-011**: 100% of region-link activations lead to the intended map view, or to a clear unavailable message when the target no longer exists.
- **SC-012**: On a pointer device, moving onto and off a region switches hover and rest looks in 100% of checks; on touch, press shows hover look and release-to-activate still follows the link in 100% of checks.
- **SC-013**: At most one placement mode is active, and no map view opens with a mode already on, in 100% of checks including the new region-link mode.

## Assumptions

- "Text marks" are the existing cross-map text labels (text links), not point-of-interest titles or other UI copy.
- Authors are the same authenticated users who can already create, resize, edit, and delete annotations; visitors who are not signed in only view and follow links.
- "Font" means typeface (family) from a small offered set of common readable styles (for example a default sans-serif, a serif, and a condensed option). Authors cannot upload custom font files in this feature.
- For text marks, "color" means the color of the wording. Text fill chips, outlines, shadows, and gradients remain out of scope for text.
- Bold, italic, underline, letter spacing, rotation, and alignment remain out of scope for text marks.
- Default text color and default typeface match the look text marks have today so existing maps do not visually jump when styling ships.
- Styling (text and region) is stored per annotation and is identical for every visitor, like size today.
- The existing minimum and maximum text size, linking, and access rules stay as specified for map zoom and annotations except where this feature adds a third placement mode and region links.
- Contrast against arbitrary map art is the author's responsibility; the product supplies readable text defaults and fully transparent region rest by default rather than enforcing a contrast checker.
- No new user roles are introduced.
- Region links are axis-aligned rectangles only (not freehand, polygons, or circles) in this feature.
- Region "invisible" means rest fill is fully transparent by default; authors may raise rest transparency if they want a standing tint.
- "Brightness" is a distinct fill intensity the author sets per state (rest and hover), alongside color and transparency — not an automatic filter derived from the map image.
- Region links have no displayed label; destination is the linked map only. Optional captions on regions are out of scope.
- Hover appearance is not animated beyond switching rest and hover looks; transition timing is a simple product default, not author-configurable in this feature.
- Border, shadow, rounded corners, and rotation of rectangles are out of scope.
- Placement still works like other annotations: the draw chooses the area; the author confirms target (and optional appearance) before anything is saved.
- Existing text-label and point-of-interest behavior is unchanged except for sharing mutually exclusive placement with region-link mode.
