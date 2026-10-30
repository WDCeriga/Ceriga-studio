# Artwork pen and shape workflows

## Interaction audit

Artwork already uses structured document objects. Pen paths store cubic anchors and incoming/outgoing handles in normalized local coordinates, with placement, size, rotation, paint, effects and original sources stored separately. SVG renders native shapes, brush geometry, lettering and masks. Uploaded photographs remain image sources. Some effect presentations use raster caches while retaining their editable source.

Custom hit testing registers artwork roots. Visible bounds support whole-object dragging; unpainted paths use native Path2D stroke hit tests without painting a stroke. Geometry uses existing cubic utilities and polygon-clipping for shape operations. Changing engines to Paper.js would add a second document model without replacing a missing core geometry capability.

The main avoidable lag was repeated React preview updates across the artwork list. Object moves now update cached selected roots at animation-frame rate and commit once on release. Plain native path editing updates the selected SVG and its own overlay, with a single document commit on release. Effect/warp previews retain the existing rendering fallback. Draft pen and pencil input is coalesced to display frames. Cancellation discards pending updates; release flushes the last sample.

## Paint belongs to the user

Closing a new pen path stores geometry with **fill off and outline width zero**. Closing never requests paint. The editing guide is editor chrome, excluded from captured artwork. Explicit Add fill and Add outline actions are independent; disabling either does not silently enable the other. An intentionally drawn open line retains its pen stroke.

Unpainted paths retain full selection bounds, point editing and transforms. Their invisible interiors do not block other artwork; their geometry remains selectable within a screen-space stroke tolerance. Preset library shapes keep the appearance of their selected preset.

## Available interactions

- Select: click, Shift-click, drag a marquee in either direction, Ctrl/Cmd+A, Escape, multi-object movement, arrow nudging, grouping and ungrouping. Marquees exclude hidden, locked, fabric-bound and system artwork, and the opposite garment side.
- Point editing: double-click a vector shape, or press A. Select anchors individually, Shift-select, marquee from anywhere on the canvas, or Ctrl/Cmd+A for the active contour. Drag anchors, direction handles or a segment. Segment bending preserves endpoints and follows the grabbed point. Add/delete/convert controls remain available in the right inspector.
- Pen (P): click corners; drag curves; Shift constrains angles; Alt separates handles or converts an anchor; hold Space while dragging to reposition its anchor. Ctrl/Cmd temporarily moves anchors. Hover/click existing draft segments to split a cubic exactly; click interior draft anchors to remove them. Click the first anchor to close, or use the small Close/Done chips. Enter, Escape, V or double-click finishes an open path. Draft undo/redo uses one snapshot per gesture.
- Open paths: continue from either end. Reversing a path swaps incoming/outgoing handles without changing geometry. The previous source is hidden during continuation so stale ink cannot appear behind the preview.
- Pencil (N): freehand input is sampled at device rate and fitted to native cubic curves. Curve smoothing changes the fitter, not the brush medium. No bitmap trace is used.
- Shapes: M places a rectangle, L an ellipse, T opens typography, V returns to selection. Alt resizes from the centre; ordinary resizing keeps the opposite handle fixed. Shift constrains proportions or rotation to 15-degree steps. Native vector size has no old 520-unit bitmap ceiling. Contextual resize/rotate cursors, corner rotation zones, a centre pivot and temporary transform readouts are editor chrome.
- Navigation: Space-drag pans; Ctrl/Cmd+wheel zooms around the pointer; Ctrl/Cmd+0 fits; Shift+2 fits the selection. Form controls retain their keyboard input.
- Duplication: the right inspector duplicates native shapes; Ctrl/Cmd+D repeats the preceding copy's edited transform; Alt-drag previews copies and commits them once. Nested groups keep editable native children.
- Combine & arrange: right-panel actions unite, cut the front shapes, keep overlap or exclude overlap. Unpainted closed geometry can also be combined. Non-neighbouring selections are permitted when unrelated intervening artwork cannot change the stacking result. Sources remain recoverable. Different production methods remain separate inside groups.
- Lettering: Edit word outline, Separate letters, Separate letter and Copy letter. Each glyph retains its counters and detached parts. Move or resize an isolated letter, then edit its points, cut holes or add regions. Inter, Montserrat and Poppins support normal, bold, italic and bold italic conversion. Outline-reader copies of the existing fonts resolve overlapping contours as curves and include their original OFL licences. Original live text remains available for restoration.
- Existing Ink finish controls expose clean, faded, cracked and chipped vector-mask finishes. Existing group source controls edit child text and colours without ungrouping.

## Visual design

Right-hand controls use compact monochrome buttons, clear paint choices and the site's MaterialSelect dropdown. The pen inspector contains precision settings rather than a second drawing toolbar. Small visual points have larger invisible hit targets. White/charcoal contrast guides are temporary overlay geometry, never an outline added to saved artwork. Unrelated artwork dims during point isolation. Shapes, paths and text remain structured vector data after refresh; font geometry is not raster traced.

## Research

- [Adobe: adding and removing anchors](https://helpx.adobe.com/illustrator/desktop/draw-shapes-and-paths/modify-paths/add-or-remove-anchor-points.html)
- [Adobe Learn: drawing with Pen and Pencil](https://www.adobe.com/learn/illustrator/web/draw-vector-paths-with-pen-pencil-tools)
- [Figma: vector networks](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks)
- [Figma: editing vector layers](https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers)
- [Adobe: vectorizing fonts](https://www.adobe.com/uk/products/illustrator/vectorize-font.html)

These references inform common gestures; the application keeps its own simpler UI and native document model.

## Verification and remaining brief items

Regression scripts cover exact cubic insertion/bending, handle semantics, frame batching/cancellation, unpainted paths and independent paint, rotated resizing, real font counters and styled lettering, native brush vectors, copying/grouping, fabric relief and resolution. Build output is recorded under node_modules/.cache/artwork-final-build.log.

The 200-object/50-anchor **60fps acceptance target requires a live browser benchmark**; unit-level frame coalescing is not a substitute. Browser automation could not start because the local runtime reported a locked D: volume. Shape transform controls now use the existing garment chest-width reference for cm/mm calibration; see [vector behaviour](artwork-vector-behaviour.md). Full nested-group canvas isolation, configurable physical print-area warnings and equal-spacing distance labels remain separate work; existing source editing, bounds/centre snapping and group operations are retained.
