# Artwork vector behaviour

Vector behaviour reuses the existing inspector, StudioFold, StudioNumber, MaterialSelect and colour-popover components. The follow-up usability pass refines their styles and grouping while retaining garment geometry and the canvas/sidebar structure.

## Shapes and physical units

Rectangle, ellipse, polygon, star and line remain parametric. Click a library item and drag on the canvas; Shift constrains proportions and Alt draws from the centre. A click opens W/H entry in cm in the existing inspector. Rectangles have a live radius handle. Polygon sides, star radii and corner controls remain editable until a committed point edit materializes the path. Entering point mode alone does not convert a live shape.

New pen drawings and live shapes start with a black vector outline and no automatic fill. Their temporary selection guides are editor chrome. Fill, stroke and opacity are explicit properties. Stroke controls include physical width, cap, join and inside/centre/outside alignment. The artwork colour picker uses ordinary swatches, gradients, HSV, hex and RGB. Fabric/Pantone selection stays in Materials & Colour. Shape colour references are retained in production SVG metadata.

The garment body width divided by the existing chest-width measurement provides model units per cm. Asset workspaces use ten model units per cm. This is the existing 2D garment measurement reference, not a new print-machine calibration system.

## Boolean groups and paths

Unite, Minus front, Intersect, Exclude and Divide retain source shapes in `children` and store the operation in `booleanOperation`. The root shape caches the current result so the existing renderer can draw it. Source transforms, live parameters, fill and point/handle coordinates can be edited in Combine & arrange; the result updates on every document change. An initially empty intersection can become visible after child edits.

The bottom source supplies the initial appearance. Later bottom-source appearance changes update the corresponding result properties without resetting unrelated group overrides. Repeated normalization rebases the result and its children together to avoid positional drift. Flatten explicitly removes the boolean relationship; Release restores an ordinary editable source group. Divide stores separate planar faces in the compound result.

Hover/focus previews are transient editor chrome. Joining open paths chooses the nearest endpoint orientation and merges coincident endpoints. Compound paths retain contour direction and expose even-odd/non-zero winding. Close, simplify, stroke outlining and positive/negative path offsets produce native vector geometry. Boolean clipping uses adaptive curve subdivision and integer Clipper winding resolution, not bitmap tracing.

Group/ungroup, hide, lock, stacking, flips, alignment and equal-gap distribution use the existing document operations. Alignment targets selection bounds, the garment body/print-area reference or a key object. Single-object arrange controls use the existing collapsed accordion.

## Typography

T activates point/area placement. Click for point text; drag for area text. Point frames grow to their natural dimensions; area frames retain their wrap width. Text remains editable inline and through the inspector. Both editors retain character selections for font, size, weight, style, colour and baseline adjustments. Tracking supports a canvas drag; kerning can target the pair at the caret. Search, recent fonts, favourites and rights-attested TTF/OTF/WOFF/WOFF2 import reuse the existing font picker.

Text can follow a snapshot of an existing vector contour, with a baseline offset, or use the existing Arc/circle controls. Path attachment includes space for the glyphs instead of clipping them to a thin line's bounds. Sticker/varsity offset creates a separate native outline behind the live text.

Cmd/Ctrl+Shift+O uses opentype.js font contours, preserving glyph counters, placement, rotations, flips and character colours. Individual glyph membership remains available for separation and point editing. The bundled Inter/Montserrat/Poppins regular, semibold, bold and italic outline sources use the actual installed typefaces; no bitmap tracing is involved.

## Production SVG

The existing export flow downloads front/back native artwork SVGs when artwork pages are included. It outlines a cloned document, flattens boolean results and retains winding rules, stroke alignment, crop/erase masks, transforms, opacity and physical units. Live document text stays editable. Native font contours preserve geometry; browser hinting/antialiasing can differ slightly between live text and SVG paths. Uploaded raster images remain images; this change does not invent vector geometry for photographs.

A missing font/weight, unsupported shaping, text decoration/shadow or a non-native effect renderer reports an error before downloading either side. Active Warp/Perspective must be reset for this production SVG route. The existing general PDF/ZIP tech-pack export is a separate flow; this change does not claim to implement that exporter.

## Verification

- `scripts/verify-artwork-vector-acceptance.mjs`: clean union; exported circle hole; winding; offsets; joins; caps/stroke alignment; arrange/key object; text contours and exact glyph placement through flips/rotation; curved character colours; attached-path text; kerning; source immutability; crop/erase masks; production copies without live text.
- `scripts/verify-live-booleans.mjs`: editable children, initial empty results, normalized transforms and no cumulative drift.
- Existing path, pen, selection and font regression scripts remain applicable.
- Isolated browser checks use a fresh headless Chrome profile and an IndexedDB test project, without changing the user's projects. Test artifacts stay under ignored `node_modules/.cache`.

Engine references: [Clipper documentation](https://github.com/junmer/clipper-lib/blob/master/Documentation.md), [opentype.js](https://github.com/opentypejs/opentype.js). Earlier interaction research is recorded in [pen workflows](artwork-pen-workflows.md).

## Usability follow-up

The artwork picker now has swatches, gradients and numeric colours; Pantone stays in fabric controls. Font browsing has one bounded results viewport, stable keyboard navigation, recent/favourite collections and a compact style filter. Wheel events stay inside the font popover.

Pen completion lives in the right inspector. Point modes use icon-led controls; advanced operations are collapsed rows. Everyday appearance and typography precede production choices. Duplicate transform/stroke controls and nested catalogue scrollers were removed. Outline controls appear only when an outline is enabled. Phone artwork navigation shows all six tools without a horizontal carousel.

Fresh-profile browser checks cover font scrolling, filtering, favourites, nested dropdowns, keyboard navigation, pen completion and artwork colours. Tablet and phone checks cover page overflow and runtime errors. Existing geometry/selection regressions remain passing.


### Asset workspace follow-up
New pen/pencil paths and live shapes start with a black vector stroke and no automatic fill. Ctrl/Cmd+Z and Ctrl/Cmd+Y (or Shift+Z) target the active asset document, including the top history buttons. Text fields retain native undo. Asset zoom supports 0.01% to 1,000,000% with proportional buttons, Ctrl/Cmd+plus/minus, pointer-centred Ctrl/Cmd+wheel, pinch, Fit and Space-drag pan. Finite safety bounds prevent invalid transforms.
