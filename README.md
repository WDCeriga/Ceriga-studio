
  # Design Request (Copy)

  This is a code bundle for Design Request (Copy). The original project is available at https://www.figma.com/design/gS67Oy3t7CSSnsqKcAKyic/Design-Request--Copy-.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Construction material model

`garmentFabrics.ts` keeps legacy `assignments` (explicit part overrides) and
`unlinkedGroups`, adding optional `garmentDefault`, `categoryDefaults`, and
`interior: { matchExteriorFabric, matchExteriorColour, fabricId?, colour? }`.
Call `initializeFabricDefaults(type, existing?)` explicitly when installing a
material-aware garment. Builder hydration adds defaults while preserving saved
explicit overrides and registered geometry. The tee default
is 180 GSM cotton single jersey with a 240 GSM 1×1 rib neckband. Main fabric
changes use `setGarmentFabric`; `setCategoryFabric` changes a category or clears it
with `undefined`. Neither overwrites explicit part assignments. Calling
`resetFabricDefaults(type)` returns only material state, never garment geometry.
`resetPartFabric(state, parts, targetId)` clears the target's explicit overrides
(including linked partners and descendant panels), preserving defaults, link flags,
independent interiors, and unrelated overrides.

`resolvePartFabric(state, part, parts?)` and `resolvePartMaterial` resolve source
relationships and category/main fallback; pass the complete parts list for recursive
inheritance. The material result includes `fabric`, `fabricId`, `surface`, and
`interior` (the reverse-map flag). Parts may declare `materialCategory`,
`surface: 'face' | 'reverse' | 'lining'`, and `exteriorPartId`. A genuine lining
requires its own part/category assignment and renders its face, never the shell's
reverse. `resolveInteriorColour(interior, exteriorColour, override?, surface?)`
uses matching exterior colour without automatic lightening. Colour overrides and
technical/no-texture display mode remain caller-owned; hiding texture must not
clear saved materials. `assignFabric(..., 'part')` explicitly unlinks a targeted
pair member; its existing default linked/bulk behavior remains compatible.

Single-jersey and generic denim reverse maps are separately authored, neutral,
tileable construction studies, **not scanned reverses**. Denim retains its verified
CC0 face scan; its procedural reverse has separate review-required provenance.
Missing reverse maps remain unavailable, never substituted with unrelated textures.
Run `node scripts\collar\run_fabric_tests.mjs` for inheritance, provenance,
asset-checksum, and compatibility regressions.

Native and imported construction uses exact blue region selection. Accepted
structural parts are selection-only; `creationEditing` explicitly enables custom
geometry handles in the upload draft. Artwork and placement tools retain their
separate interactions. Fabric cards and colour swatches can be dropped onto parts;
a linked-pair choice offers both matching parts or just the targeted part.
Colour defaults stay sparse in saved state (`colourDefaults` and `partColors`),
so changing the garment default does not erase explicit overrides. Reverse colour
matching uses its exterior part without fake lightening; lining keeps separate
part/category colours. The visible native inside-back neck uses the body reverse,
not the rib neckband. Imported material inheritance resolves both front and rear
part metadata. Technical/no-texture mode changes the view only.

Browser regressions in `scripts/collar/test_construction_material_editing.tsx`
export `verifyUnifiedConstructionSelection()` for native hit regions, locked
accepted collars, creation handles, material drops, defaults, and view-only texture
switching, and `verifyImportedConstructionMaterials(garment)` for exact imported
seam selection, independent drops, and source-geometry preservation without saving
the supplied garment. `verifySchematicConstructionSelection()` checks schematic
keyboard selection and material drops. `test_fabric_controls.tsx` exports `runFabricControlInteractions()`
for category/part precedence, matching controls, and material reset interactions.

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
Tracing itself does not infer semantic garment pieces. Optional construction-region
analysis runs afterward, without changing the traced drawing.

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
retain all traced construction ink together. Fabric/wash effects cannot alter this
ink. Existing saved semantic imports retain their part controls.

### Post-trace construction regions

Construction-region analysis is a separate, review-gated stage after either upload
route. `/api/garment-construction-regions` accepts the completed trace and selected
front/back view, not another image-generation request. Re-analysis replaces only
that view's source evidence. Legacy source regions without a view use their source
view metadata, matching part, or original source-manifest view; they are not appended
again as duplicates. Genuine cross-view ID collisions still fail safely.
Local geometry extracts candidate enclosed areas; Astra assigns semantic names, categories and groups to
candidate IDs rather than generating SVG paths. Local short-gap probes may recover
pocket partitions within an already-enclosed cell, preserving its exact coverage;
these candidates still require semantic and visual review. Missing or ambiguous
boundaries remain warnings, not invented cuts. Kangaroo pockets route to Openings
& Closures, separately from the body; sleeve-child panels route to Sleeves. Saved
imports receive these category corrections on load without resetting colours or
fabrics. Linked region controls include **Edit separately** to give left/right
pockets (or other grouped pieces) independent colour and fabric controls without
changing their geometry, mirror relationship, current assignments or review state.
The original construction ink stays above all editable fills. Recognised drawstrings
and enclosed hardware surfaces have colour controls without fabric texture. Source
zip isolation is reviewed separately in Openings & Closures: recolouring clips the
original ink, while **Convert to editable zip** explicitly replaces that isolated
portion with the existing pull/size/opening editor. **Restore original zip**, hiding
or deleting the replacement restores the source. Stored construction ink is never
rewritten. Stitching or details that cannot be reliably isolated remain immutable
ink rather than receiving invented geometry.

Review the source, trace and coloured region overlay before installing the result.
Select individual panels using their actual SVG shapes, not rectangular bounds.
Colour and fabric assignments are independent; explicit pair groups can share
materials, while separate chest panels remain independently editable. Fabric targets
exclude source ink and non-fabric hardware. Front/back metadata stays separate;
a missing back requires a real uploaded reference rather than a silent estimate.
The initial visual acceptance examples are a clean tee, curved-seam hoodie and
utility jacket; semantic confidence is not a guarantee of construction accuracy.

#### Manual correction of construction regions

In construction-region review, choose the front or back and select a fabric region
from the list. Use **Paint into region** and adjust **Brush size** to transfer a
misassigned area to it—for example, select the hem and paint over pocket fill that
crosses the hem. **Erase from region** removes only the selected fill. Construction
ink, drawstrings and hardware remain protected; the other view is unchanged.

For missed white fabric, select an existing region or choose **New colourable
region** and name it. Paint directly, or choose **Select missed area** and click
inside an enclosed, unassigned white area. Inspect the cyan preview, then **Apply
selected area** or **Cancel area selection**. Open boundaries are rejected; use a
small brush instead. Brush edits are manual boundaries, not newly detected seams.

**Undo correction** restores up to 20 corrections while this review stays open
and the garment has not been changed elsewhere. Cancelling a pointer stroke does
not save it. Corrections require **Confirm construction region review**, followed
by the normal garment acceptance/save flow. New regions then have independent
colour and fabric controls in the builder. Re-analysis replaces the selected
view's region geometry, including manual corrections.

Focused regressions (from the repository root):

```powershell
@'
import { createServer } from 'vite';
const vite = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, watch: null, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const tests = await vite.ssrLoadModule('/scripts/collar/test_construction_region_painting.tsx');
  console.log('PASS manual correction', tests.verifyConstructionRegionPainting());
  await vite.ssrLoadModule('/scripts/collar/test_construction_regions.tsx');
} finally { await vite.close(); }
'@ | node --input-type=module
```

With the development app open, browser regressions are available in its console:

```javascript
const tests = await import('/scripts/collar/test_construction_region_painting.tsx');
await tests.verifyConstructionRegionPaintingBrowser();
```

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

**Generate estimated back** uses front proportions to infer essential construction,
not hidden decoration. Hoodies separate hood, body, sleeves, cuffs and waistband;
other supported garment types use their corresponding basic rear anatomy. Each
estimated region uses the same semantic selection/colour/fabric controls as the front,
with front-component appearance defaults and independent rear overrides. No rear
pockets, graphics or hidden fasteners are invented. Older silhouette estimates offer
**Upgrade estimated back construction**. Scoop-tank estimates retain their existing
conservative strap, armhole and shallow-scoop treatment.

Structured estimates use the front technical exterior and semantic component bounds,
not raw-photo texture or internal front ink. Dense exterior contours are simplified
and rounded once, before shared anatomical cuts, so adjacent editable masks meet.
Already-sparse technical outlines retain their corners. Source-labelled fabric cuff
adjustment tabs are preserved after smoothing as separate colour/fabric regions,
including their protruding ends. Their masks are cut out of the sleeve/cuff masks
so they do not overlap; ordinary pocket and throat flaps remain excluded. Tabs
must have valid outlines and connect at the cuff. Their rear orientation is still
an estimate, and no buttons or fastening mechanisms are invented. Regenerate an
existing estimated back to include these tabs.

Generation checks component
width/height changes against a 1.2% envelope-size tolerance, rejects overlapping
regions and limits silhouette symmetric-difference area to 3.5%. A second, gentler
simplification is tried if needed; failing both attempts returns an error, not an
unreliable back. Unsupported structured families retain their existing estimator.

**Compare front and estimated back** shows the front drawing, clean estimated back,
colour-coded rear regions and generation-time proportion checks. The measurements
compare the front-derived anatomical template with the cleaned back, not observed
rear dimensions. Checks persist on save/reload but do not certify subsequent manual
edits. **Regenerate estimated back** uses the current front and replaces manual rear
geometry corrections; **Replace estimate with real back** removes inferred geometry
and its report. Focused tests are `scripts/collar/test_structured_back.tsx`
(`verifyStructuredBack` via the Vite SSR runner), plus the existing back and trace
regression modules.

The estimate opens for review as **ESTIMATED BACK — essential construction inferred
from front geometry. Hidden rear details remain unknown.** It remains editable and
replaceable with a real back image; estimates never claim observed rear evidence. Review also offers technical
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
