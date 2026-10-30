# Artwork placements and shared inspector

## Audit
- Artwork currently lives in `BuilderState.studioArtwork`, a flat list of native `DesignElement` objects; `prints` is the legacy fallback. Groups keep native children. Position and dimensions are in the stable 800 x 700 garment board. Physical conversion uses the garment body width.
- `PrintDesignNavigation` chooses a creation family. `PrintsDesignStep` hosts the creation panel and selected object editor. Each object type currently owns its own inspector and canvas strip. This duplicates placement, appearance and production-method fields.
- Shared components already exist: `StudioFold`, `StudioNumber`, `StudioPaint`, `MaterialSelect`, `InspectorHeading`, `StudioLayerDock`, the shared paint popover, native path operations, text appearance, and the document/history providers. Keep these visuals and reuse these components.
- Migrate legacy artwork to stable placements without changing its geometry, IDs, colours, references or child relationships. Keep assets independent of garment placements. A factory profile supplies method constraints; do not pretend an unconfigured factory supplied a colour limit.

## Phases
1. Finish and verify the six-group Text panel, physical sizing, native appearance expansion and workspace text styles.
2. Add versioned placement/colour-slot migration and tests, preserving legacy data and undo/redo. Add the placements landing page, details and shared canvas zones.
3. Connect the existing rail and canvas tools to one shared object inspector; retain native tool-specific editing within it. Reuse the current visual components.
4. Connect colour slots to saved colourways, finishes and components; improve reuse/import/repeat flows using existing engines.
5. Roll checks up by placement and show placement specifications and native previews in Review. Verify old project migration, object transfer, colourway switching, tools, Text acceptance, responsive behavior and production.

Each phase must leave existing projects readable and the preceding phase functional. The wider placement brief follows the user's Text-first choice; the user has now asked to continue all outstanding work before pushing.

## Implemented
- Versioned legacy migration, native placement membership, physical print areas, side mirroring and live outside-area feedback. Existing artwork geometry and editable sources remain intact.
- Grouped artwork rail, shared canvas tools and common placement/appearance/finish/check controls, retaining the six-group Text inspector.
- Stable ink bindings through grouping, booleans, separation and colourway changes; canonical sources remain independent of displayed variant inks.
- Artwork reuse/brand kit, native pattern sources and physical repeat sizing/seam checks; finish specifications and derived patch/embroidery components.
- Factory-supplied method limits, colourway ink matrix and per-placement Review specifications/previews. Factory limits remain unconfirmed until supplied.

## Verification
- Text browser acceptance: six 40px rows, real font styles, physical text height, double outline/hard shadow, effect switching, saved style and native appearance expansion.
- Placement browser acceptance: legacy project migration, physical area editing, atomic front/back mirror, mobile/iPad canvas visibility and no horizontal overflow.
- Native model checks: deterministic/idempotent migration, unchanged geometry, ink ownership through groups/booleans, source restoration, factory limits and derived components.
- Existing tracing, curve/radius, pen, text/font, live boolean, garment and vector acceptance suites pass.

Physical production capabilities require the chosen factory's supplied tolerances. Reference photographs and uploaded raster sources remain raster until traced; saved thumbnails are previews, not the production source.
