
  # Design Request (Copy)

  This is a code bundle for Design Request (Copy). The original project is available at https://www.figma.com/design/gS67Oy3t7CSSnsqKcAKyic/Design-Request--Copy-.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## AI garment imports: construction only

Whole Garment Import has an **Input type** selector: Auto, **Photo / reference
(redraw)** and **Clean mockup / technical drawing (trace only)**. Local raster
screening measures tone, colour, thin ink and enclosed white regions. It shows the
suggested type, heuristic confidence and uncertainty; it is not semantic person or
mannequin detection. Ambiguous monochrome artwork conservatively suggests tracing
and explicitly asks for review. Either selection can be overridden. Auto remains
automatic in the request and retains its detection evidence; manual choices bypass it.
Primary and optional back images have independent selections. The UI processes them
sequentially, then installs both together only after both succeed. A missing-view
upload follows the same flow; the endpoint accepts one image per request.

Clean drawings are authoritative: no AI analysis, reconstruction, balancing, template
replacement or inferred neck backing runs. Their existing ink (including stitching)
is keyed locally using contrast 1.35 and a smooth luminance ramp (120 opaque, 246
transparent), then traced from a 3× alpha mask at threshold 128. Potrace uses minority
turn policy, turdsize 4, alphamax 1.0, curve optimization and even-odd paths. The review
SVG retains the source pixel-size viewBox; the builder uses only uniform framing.
Review **source raster → cleaned raster → keyed line art → traced SVG → overlay**
before accepting, or download the source-sized SVG. Review metadata persists with
each view. Blank/degenerate traces fail instead of substituting a garment template.
Trace-only does not infer semantic garment pieces from the drawing.

Photo/reference uploads retain **Azure construction analysis → Azure clean technical
raster redraw → the same white-key and Potrace trace**. The redraw prompt requests
orthographic, front-on construction with perspective/pose distortion, person,
background, lighting, texture and colour removed. It preserves distinctive garment
proportions, seams, functional details and intentional asymmetry, rather than using
a generic template. It excludes prints, logos, lettering, embroidery artwork and
entire physical branding patches, while retaining construction reinforcement.
Model fidelity must still be visually reviewed. Provider failures stop the import;
they never fall back to tracing the photograph itself.

Photo review shows the original photo and clean technical raster separately.
Its overlay/pixel metrics compare the SVG with the **redraw**, not the photograph;
these metrics cannot prove that AI preserved every construction detail. Both routes
retain all traced construction ink together, without inferred colour fills or
separately editable stitch paths. Fabric/wash effects cannot alter this ink. Existing
saved semantic imports retain their part controls.

### Source-derived reconstruction engine (legacy/internal callers)

The retained `reconstruct()` engine uses **source-derived construction**, not an
AI-generated redraw. This is separate from the upload input-type router and is never
used for clean trace-only drawings. Front and back garments, including jackets,
hoodies and trousers, use clean,
source-matched technical projection: bounded contour smoothing and balancing of
source-evidenced matching pairs. Attached pockets and trims follow their panels;
hardware retains its dimensions, and one-sided details are never duplicated.
Explicitly asymmetric designs are smoothed without mirroring. Strongly posed pairs
retain their source pose when balancing would excessively change their silhouette.
Eligible front scoop tanks/vests retain their specialized level-hem projection,
separate shoulder hardware and subtle presentational ribs.
A uniform framing transform preserves source proportions. Technical SVG contours
reuse the fill paths as constant-width strokes rather than tracing ragged pixel-edge
rings. Photographic shadows, prints and wrinkles do not supply construction ink.
Other than the specialized tank path, source coverage is checked before projection;
near-white isolated photos support this check, while complex backgrounds rely on
source-analysis outlines. Pixel recovery is not used to grow the clean SVG panels.
SVG measurements and estimated-back geometry remain source-analysis approximations,
not measured production patterns. Existing saved imports are unchanged; re-import
from the original photograph to generate the new SVG.
Visible inner/rear fabric behind a scoop is a front-view lining detail, not an empty
opening, detached neckband or generated rear view. A coverage check rejects omitted
visible fabric and permits one corrective source analysis before failing safely.
Invalid source construction manifests also receive this single bounded correction;
unidentifiable garments, transport failures and malformed JSON are not automatically retried.
Source analysis checks visible construction across garment families, including short
strap joins beside fastenings, seam junctions, bindings, closures and hems. Only
photo-evidenced lines are retained; hidden or ambiguous construction is not invented.
Technical balancing moves each piece's construction lines and hardware openings with
its outline, without forcing same-handed clasp internals into mirrored positions.
Recognition still depends on photo clarity and should be reviewed before acceptance.
Source prompts preserve cropped length, straps, bindings and functional fastenings.
Straps and bindings use `semanticType: panel` with explicit `shoulder-strap` or
`armhole-binding` construction roles. Metal fastenings also use `panel`, with
`structuralRole: hardware` or `buckle`, `layerKind: detail`, and a `hardware-edge`
boundary; no new cross-language semantic enum is required.
Hardware can carry evidenced internal `cutouts`, traced as transparent openings with
inner metal edges, leaving any underlying fabric intact. Registration preserves their
IDs and source evidence and cannot increase confidence. Uncertain openings withhold
hardware fill for review rather than seal a slot with solid metal. These checks cannot
recognize a label misclassified by the model as genuine construction.

Existing saved drawings are not automatically rewritten: re-import the source photo
to regenerate a construction-only result. Offline regressions use mocked AI responses
and real tracing; AI seam/hardware identification can still be uncertain and is not
a pixel-perfect guarantee. Separately imported
patch assets are unchanged.

**Generate estimated back** carries over approved front proportions instead of
inventing hidden construction. Scoop-tank estimates retain the crop, side seams,
armholes, narrow straps and simplified shoulder clasp logic, with a shallower scoop.
The estimate opens for review as **Estimated back — inferred from front geometry**
and remains editable/replaceable with a real back image. Review also offers technical
flat, outline and construction-overlay SVG downloads; none embed the source photo.

## AI garment seam colours

Visible seam and panel-edge paths now create independent colour controls in
**Fabric & Colour** and the relevant garment section, including **Sleeves**.
This also applies to saved construction-v2 imports without uploading again.

- Colour areas are derived from the imported seam paths. Connected paths, curved
  seams, closed seams and seam junctions are supported. Stitching, pocket/hardware
  outlines and unfinished interior lines do not invent fabric cuts.
- These are colour-only panels, not new approved construction pieces. Original
  silhouettes, seam ink, measurements, calibration and part transforms remain intact.
- Panels initially inherit their existing part colour. Individual choices use the
  existing saved project colour map; whole-part/material/global recolouring and
  colour reset include the derived panels. Hiding seam ink does not erase colours.
- Missing or incomplete seam geometry still needs a clearer reference or a
  construction review; colour splitting does not infer invisible seams from pixels.

With the development server running, open
[the seam-colour regression](http://localhost:5173/scripts/collar/colour-panels.html)
to run geometry, colour inheritance, serialization and SVG pixel checks and try
independent sleeve/body colours on a clearly labelled synthetic fixture. Tests are in
[scripts/collar/test_imported_colour_panels.tsx](scripts/collar/test_imported_colour_panels.tsx).

## Per-part fabrics

The existing **Fabric & Colour** page keeps its layout and colour controls. Use
**Apply fabric to** to select a garment part, then choose its fabric. Composition
and preset weight are shown separately from colour. The library includes single
and interlock jersey, French terry, loopback jersey, heavyweight and brushed fleece,
1×1 and 2×2 rib, waffle, piqué, cotton twill, denim twill, nylon taslan and mesh.
Cotton is a composition, not one universal surface texture.

- Parts come from the current garment construction, including imported garments.
  Matching sleeves/cuffs can share fabrics; uncheck **Link matching parts' fabrics**
  before changing one side separately. Group selectors can still apply to both sides.
- **T-shirt default**, **Hoodie default** and **Heavy sweatshirt** presets assign
  body and rib materials without changing colours. **Reset fabrics** clears only
  material assignments. Changes use the existing undo/redo and project save/load.
  Stable part assignments survive fit changes and front/back viewing.
- **Hybrid construction-specific library: all 14 face materials render.** Denim twill
  retains its verified dedicated CC0 photograph (Poly Haven `denim_fabric_03`). The
  other 13 have individually authored **review-required procedural materials**, not
  photographic substitutes. Source priority is exact CC0 scan → supplied/owned swatch
  with redistribution permission → commercial CC-BY with attribution → authored
  construction. No suitable supplied swatches or licensed exact scans were established
  for those 13; their recipes remain explicitly subject to visual review.
- Maps provide fine, low-contrast neutral relief below existing linework. Original dye
  never colours the garment. Per-construction family, scale, opacity, contrast,
  brightness correction, tiling density, direction and recommended uses are defined in
  [fabricTextureScans.ts](src/app/lib/fabricTextureScans.ts). Recommendations never block
  assignments. Roughness/sheen/thickness remain descriptive metadata, not simulated
  physical lighting. Rib 2×2 has paired stitches, not an enlarged Rib 1×1 map; terry and
  loopback use smooth faces and dedicated loop reverses. Fleece reverses are separately
  authored rather than borrowed from terry.
- [sources.json](src/assets/fabrics/sources.json) stores `sourceType` (`scan-cc0`,
  `scan-ccby`, `ceriga-owned`, `procedural`), `sourceStatus` (`verified`,
  `review-required`, `unresolved`), provenance, recipes, filenames and SHA256 hashes.
  [checksums.json](src/assets/fabrics/checksums.json) pins source/output/reverse files.
  Procedural maps are original authored output, not claimed CC0 photographs.
  CC-BY records require creator, asset name, source URL, license and attribution text
  outside rendering code; none are bundled currently. Restricted/unclear licenses,
  missing ownership permission, shared source/map files or hashes, unregistered images
  and absent major-preset records are rejected. Automated tests do not certify textile
  identity or replace visual review.
- The [normal-zoom comparison](scripts/collar/fabric-review.html) and separate
  [4× close-up comparison](scripts/collar/fabric-closeup.html) show all 14 materials
  with a labelled untextured baseline and a unified grid of source type, source texture
  or procedural height map, normalized map, actual garment and close-up. Procedural
  approval remains **review-required** even when automated tests pass. Unresolved
  records show **TEXTURE UNAVAILABLE**, never misleading plain comparison garments.
  Review colours do not change saved projects.
- The existing Builder flow, fabric IDs, part assignments and colours are unchanged.
  Missing assignments/maps still produce explicit warnings, including unknown saved
  IDs and unsupported reverse surfaces. Missing renderer maps carry an explicit
  diagnostic rather than a silent plain-colour fallback. No geometry is invented.
  [generate_fabric_materials.mjs](scripts/collar/generate_fabric_materials.mjs) reproduces
  deterministic procedural source/normalized/reverse maps using Node built-ins.
  Run `node scripts/collar/generate_fabric_materials.mjs` after changing a recipe.
  [prepare_fabric_textures.ps1](scripts/collar/prepare_fabric_textures.ps1) reproduces
  verified CC0 scan overlays (`-SourceDirectory <cache> -Download`) while retaining
  procedural checksum records. Embedded maps keep previews/export offline-safe.
  Geometry, colours, prints, labels and stitching remain unchanged; construction ink
  stays above the material. A reverse never silently borrows an exterior face map.
- Only existing filled regions can receive independent materials. The legacy SVG
  hoodie pack has no separate cuff/waistband masks; imported and schematic garments
  with those existing regions support them without inventing new geometry.
- Open [schematic-fabrics.html](scripts/collar/schematic-fabrics.html) on the dev server
  to compare untextured and assigned schematic garments with the same hybrid maps.
- Older projects without part assignments retain their previous appearance and
  legacy fabric specification until a material is explicitly selected. The existing
  editable GSM field remains a project specification; each library fabric shows
  its own reference weight in the material selector.

## Openings & Closures

The existing step 6 now contains **Openings & Closures**, alongside pockets,
buttons and patches. Its saved step ID is unchanged.

- Existing saved zips remain overlays. Select one and use **Convert to constructed
  opening** to opt in; projects are not migrated automatically.
- Constructed zips have a view-owned opening, independent endpoints and width,
  facing colour, and reset information. The original garment assets are retained;
  local construction is derived from their geometry.
- Placement presets position a zip once. Drag its tape to move it freely anywhere
  on supported fabric, including shoulders and side/hem edges; use the round
  handle to rotate it. Moving or rotating does not snap it back to the collar.
  **Snap to guides** is off by default for constructed zips; enable it optionally
  and hold Alt to bypass it. Other detail snapping is unchanged.
- **Zip opening** runs from closed (0%) to fully open (100%). Dragging the pull
  changes the same saved setting, separating teeth and the local fabric opening.
  **Close zip**, **Slightly open** (22%), **More open** (55%), and **Open zip fully**
  provide one-click presets. The visible
  interior uses the shirt's resolved back fabric colour. This is a flat construction
  preview, not 3D cloth draping or a physical sewing simulation.
- Opening a neckline zip separates the neckline material and front fabric along
  a curved opening; tapes, teeth, facings and stitching follow the same edges.
  The insertion reaches the source neckline contour and replaces binding under
  the tape footprint instead of leaving continuous finished trim beneath the zip.
  Tape extensions, stitches and top stops terminate at that contour. Original
  outline/stitch ink is cleared across the complete insertion footprint, including
  ink outside filled fabric. Neckline geometry outside the local insertion is preserved.
  Separation is capped by tape width and zip length; opening farther extends the
  placket downward instead of flaring the shirt body outward.
  Hardware renders above the facings so the slider and pull remain visible.
- Tap canvas or unoccupied garment fabric to deselect the zip and hide editing
  guides/handles, returning to the final view without removing its construction.
- Use **Before**, **Opening path**, **Reconstructed**, and **Final zip** to inspect
  the construction stages. Review stages are editor-only, not saved garment edits.
- Opening coordinates are drawing units, not calibrated production measurements.
  Check the **Valid / Needs Review / Invalid** status after changing placement or fit.
- **Reset opening** restores its original construction settings. **Remove opening;
  keep overlay** restores fabric but retains the zip trim. Removing the zip restores
  the unmodified local garment. Construction edits use the existing undo/redo and
  project persistence.
- Openings are not automatically mirrored or copied to the opposite view. Create
  a separate opening while viewing that side.
- This first construction milestone supports the T-shirt template pipeline.
  Imported multi-panel garments do not yet expose opening geometry, and unsupported
  SVG masks cannot safely be cut; these cases report **Needs Review** without cuts.

With the development server running, open
[the neckline milestone review](http://localhost:5173/scripts/collar/opening-milestones.html)
for V-neck, scoop-neck, crew-neck and deep V-neck openings. Each row shows closed,
slightly open and fully open states, with a garment overview and neck/tape close-up.
The original/path/reconstructed stages remain available in the editor.
Append `?validate=1` to run geometry, mounted preview, controls and
live-draft drag-commit regressions. The repeatable browser regressions are exported from
[scripts/collar/test_garment_openings.ts](scripts/collar/test_garment_openings.ts)
and [scripts/collar/test_opening_controls.tsx](scripts/collar/test_opening_controls.tsx).
For isolated pointer testing, append `?interaction=1` to the review URL. This mounts
real zip controls and the detail overlay against template geometry without saving
or modifying a project.
