# SVG stroke correction and neckline restoration — 16 October 2026

The earlier global contour-replacement pass was rejected. It suppressed original outline/embedded collar ink and reconstructed contours from sampled surfaces. That changed the visible collars and could leave their ink missing while geometry sampling was unavailable. The source neckline SVG files themselves were not edited.

## Final implementation
- `src/app/components/builder/TshirtSvgPreview.tsx`: restores original fabric and construction SVGs for all parts, including every front/back neckline. Original ink is always rendered; no contour-readiness dependency. Only stroke normalization is added. Existing Regular construction repair remains; no new collar geometry is generated.
- `src/app/lib/technicalDrawing.tsx`: original path data, holes, viewBoxes and transforms are retained. Explicit outline/construction/stitch strokes use shared 4.8/3.6/2.4 drawing-unit weights. Filled traced construction ink receives a 1.6-unit stroke-only boldness increment, with round joins/caps. The geometry-stripping helper has been removed.
- `src/app/features/panelling/TechnicalLinework.tsx`: global reconstructed garment/neckline replacement is no longer used. Existing repair masks limit this component to local legacy ink repair regions. No generated neckline layer or exclusion mask remains.
- `src/app/features/panelling/PanellingCanvas.tsx`: committed and active seam weights follow the measured native body-outline ribbon plus the same boldness increment; explicit stroke assets fall back to the canonical outline weight. Weights remain in garment coordinates and scale with garment zoom.
- `scripts/technical-drawing-review.tsx`: original-source versus stroke-only proof, front/back, six neck choices, five sleeve styles and four fits; checks compare the visible collar and original outline path data directly. Query parameters reproduce an exact review configuration.
- `scripts/technical-drawing-selftest.ts`: guards original path/placement/closure preservation, SVG stroke inheritance, masks, dash logic and hardware hierarchy.

No neckline asset files, collar-generation code, Measurements page layout, garment proportions or original sleeve checkout were overwritten. All edits stay in the isolated worktree. No commits.

## Other requested follow-ups
- `src/app/pages/Catalog.tsx`: Open new Builder links on garment cards use the existing garment id with `builder=redesign`; spec-only flow is retained and packaging-only flow is excluded.
- `src/app/components/builder/shell/BuilderSelect.tsx` and `builder-select.css`: accessible shared light dropdown. Applied to Advanced base/compare-size controls and the tablet measurement picker. Native blue option menu replaced with neutral selected/hover styles and a checkmark.

## Verification
- Original crew front/back and V front/back path identity passed; raised polo collar with long sleeves matched original visible collar/outline paths.
- 23 browser SVG checks and 17 Regular construction checks passed; 21 Panelling regressions passed.
- Grading 18, manufacturing tolerance 15 and responsive sheets 33 regression checks passed.
- Advanced Sizing: shared chest tolerance 2 cm propagated to all sizes; custom XL tolerance 3 cm preserved on save/reload. Size comparison displayed M/XL outlines with +6 cm chest and +4 cm body-length differences.
- Catalogue new Builder link opened the redesigned route. Size dropdown selection and Escape dismissal passed.

- Full source integrity audit: all 505 T-shirt and garment-detail SVGs retain their original geometry attributes after stroke normalization (including path data, viewBoxes and transforms). This does not constitute visual approval of every sleeve/shoulder curve.

## Sleeve follow-up completed
- Inspected four fits across five sleeve styles, front and back, in the development sleeve sheet (40 configurations).
- `TechnicalLinework.tsx`: fixed invalid grouped clipPath content. Repair clips now have direct path children with their placement transforms baked in. This restores previously missing shoulder/hem ink. IDs and user-space units are explicit. Bounded local tracing cleanup uses 3.2 garment units, with rounded tracing corners; it never renders over neckline regions.
- `tshirtHemStyles.ts`: the mirrored shoulder/armhole ink cleanup covers Regular and Oversized across all five sleeve variants. Windows stay outside collar geometry. The existing complete Boxy short-sleeve band also repairs the matching layered-sleeve band, eliminating its disconnected right cuff islands.
- `TshirtSvgPreview.tsx`: local repairs are enabled for Oversized too. The existing Regular sleeve attachment correction now also applies to back sleeves; back neckline and back stitching construction remain separate and unchanged.
- Added three regression checks for valid direct clip shapes, nested transform placement and filled clip paint (23 SVG checks total). Regular geometry/stitches 17 and Panelling 21 pass. All 505 source SVG geometry fingerprints pass again. Production build passes (existing bundle-size warning only).
- No source neckline asset/path data or page layout CSS changed in this follow-up. Original source asset files are retained. The bounded sleeve/cuff correction is intentional; the stroke normalizer itself never changes geometry.
- Review: `/scripts/technical-drawing-review.html?sheet=1` provides every fit/sleeve front and back. The standard proof retains shoulder, neckline, sleeve hem, bottom hem, zip and pocket close-ups plus the source-identity audit.


## Current sleeve construction correction (16 October)
This supersedes the earlier sleeve-completion assessment above. User review found further visible defects.

- `tshirtSurfaceQuality.ts` preserves original neck/inner-back-neck layer objects and original collar ink, removes traced sleeve holes and extra cuff ink, and leaves the approved Slim short-sleeve layers untouched.
- `tshirtSleeveConstruction.ts` derives mirrored clean sleeves from the existing dimensions, shares a continuous attachment curve with the torso, and supplies explicit straight layered-sleeve opening edges. Undersleeves overlap behind those openings to avoid white slivers.
- Regular, Boxy and Oversized torso sides and bottom bands align. Oversized and Boxy torso keep masks cannot reintroduce a ledge below the underarm.
- `TechnicalLinework.tsx` renders consistent outer/construction strokes; sleeve bands do not introduce an extra internal black fold line. `TshirtSvgPreview.tsx` uses the visible torso surface for body selection highlighting. No page layout CSS was changed by this sleeve correction.
- The browser sleeve-family check passed all 40 fit/style/view combinations, including source collar identity and the approved Slim short geometry. Subsequent focused visual checks confirmed straight Oversized cap-sleeve body sides and clean Boxy layered openings. Panelling: 21 regression checks passed. The final production build is recorded separately in the execution log.
- These checks establish structural validity and the inspected visual cases; they do not replace user approval of every garment combination.
