# Panelling construction research and implementation

Panel geometry, fabric assignment, seam construction and stitch formation are separate concepts. A different thread line does not create a different material panel; a zipper needs an actual opening.

## References
- Coats, Seam Types: https://www.coats.com/en/info-hub/seam-types/
- Coats, Basic Stitch Types: https://www.coats.com/en-us/info-hub/basic-stitch-types/
- American & Efird seam matrix: https://www.amefird.com/wp-content/uploads/2009/10/Seam-Type.pdf

The seam families include superimposed/plain, lapped, bound, flat, ornamental and edge finishing. Stitch families include lockstitch, chainstitch, zigzag, overedge and coverstitch. These classifications are not interchangeable.

## Application to the supplied references
- Black raglan/sports shirt: shaped panel boundaries with flatlock/cover stitching.
- Grey centre-back and chest-yoke examples: exposed seam allowance, with raised edges and topstitching.
- Curved camo and mesh inserts: real curved split geometry, independent fabric assignment, finished joins.
- Off-centre fleece zip: an opening integrated with the garment, not a drawn stroke.
- Cuff illustration: curved join with overedge/cover stitching; existing garment stitching remains in its own editor.
- Ventilated white shirt: a bound opening/mesh insert, not simply a wide black seam.

## Implemented in this update
- Cached immutable curve sampling, animation-frame pointer feedback and boundary-update deduplication.
- Finish-only changes skip polygon topology recomputation.
- Bézier point/segment editing retained; Shift angle snapping for new handles and Alt independent handles added.
- Sixteen vector treatments, grouped into Essentials, Stretch stitching, Edges & binding and Inserts. More finishes reveals the complete catalogue. Thread rows, loops, binding bands, fibres and mesh are drawn separately instead of represented by bold strokes.
- Shared saved-seam renderer across pages, preserving the panel geometry and material assignments.
- Straight and multi-anchor curved seams create actual zipper openings. A shared arc-length route drives fabric cuts, facing, vector tape, teeth and hardware. Details & trims offers straight, left/right arc and S-curve starting shapes plus draggable control handles. Generated panel zips use a fixed narrow default width, independent of path length.
- Links to existing shoulder construction and garment stitching controls.
- Saved seam undo remains owned by product history rather than hijacking Ctrl/Cmd-Z.

## Limits
These are visual construction previews, not sewing patterns or seam-allowance specifications. Curved zipper openings are implemented. Mesh and bound treatments are visual previews; a physical ventilation slit without zipper hardware is not implemented. Existing shoulder seams are edited through garment construction/stitching, not converted into custom seams. The artwork Pen tool was not replaced; the panelling tool keeps boundary-constrained geometry and its own editing state.

## Verification
`node scripts/verify-panelling-finishes.mjs` checks cached curve sampling, curve subdivision, fixed endpoints, unchanged geometry for all sixteen finishes, valid SVG output and JSON persistence. Production Vite build is checked separately. Browser interaction and visual appearance require review; no visual acceptance is claimed by the geometry tests.

Additional checks: `verify-curved-zips.mjs` covers the constructed curved cut, facing, endpoints/handles, move/rotate/reset and persistence. `verify-curved-zip-rendering.mjs` renders all five actual zip variants. `verify-panelling-vectors.mjs` renders a contact sheet of all finishes. Measurement display is capped at one decimal place; storage precision is preserved.
