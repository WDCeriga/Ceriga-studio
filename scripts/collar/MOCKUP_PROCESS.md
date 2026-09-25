# How to generate a perfect garment mockup

Two jobs, same rules:

1. **Full garment mockup** — black-and-white tee drawing, then vector parts you can edit or drop into Procreate.
2. **Neck for the website** — photo of a collar → SVG that sits on the slim test tee next to Crew / V-neck.

Never ask an image model to “output an SVG”. Models only make rasters. Vectors come from tracing code.

## Registered hoodie sleeve demonstration

Scope: **Boxy / Set-in / left sleeve**, against the existing Boxy body and cuff.
Only this replacement is certified. The new sleeve is freshly raster-traced from
the existing drawing, so its silhouette intentionally matches the original.
No T-shirt geometry or files are used. Other hoodie assets are not regenerated.

Installed asset ID: `hoodie/Left sleeve/Set-in Left sleeve v1 (boxy)`.
Its SVG and `.registration.json` sidecar live in `src/assets/hoodie-test/Left sleeve/`.
The original `hoodie/Left sleeve/Left sleeve` remains available and unchanged.

### Registration versus editing

The 1024 x 1536 source maps to a shared 2048 x 2048 canvas with scale `4/3`,
horizontal padding `1024/3` and vertical padding `0`. Identity user transform is
`{ x: 0, y: 0, scale: 1, rotation: 0 }`. No per-part positioning guesses are used.
Fabric interiors are exclusive; fixed seam ink connects adjacent panels.

All structural parts remain independently movable, resizable and rotatable.
Reset removes the selected part's user transform, restoring registered placement.
Colours and custom artwork transforms remain independent. Moving a sleeve away
from its socket is allowed: registration defines the default, not a lock.

The manifest declares compatibility family `hoodie/boxy/set-in/left-v1` and the
original sleeve as `transformReferenceAssetId`. The builder uses that original
bounding box/pivot for both compatible versions, preserving user adjustments
when switching between them. The regenerated option is available only for Boxy
Set-in; other fits and Raglan keep their existing linked selections.

New hoodie projects store `hoodieAssemblyVersion: 1`, independently of user edits.
Saved transform maps are never cleared or migrated automatically. Unversioned and
unknown-version projects retain legacy preview behavior. Thumbnails receive the
same fit/version. The browser fixture checks serialized saved transforms, not
cloud save/hydration.

### Generate, inspect, then install

Run from the hoodie repository after installing its npm dependencies:

```powershell
node scripts/collar/build_hoodie_part.mjs scripts/collar/refs/boxy-set-in-left-v1.json
```

The command prints a unique staging directory under `.tmp-hoodie-assembly/`.
Inspect its `registered-proof.png` (candidate with the seven unchanged parts),
candidate SVG and `registration.json`. Generation never writes live assets.
The initial demonstration was installed with:

```powershell
node scripts/collar/export_hoodie_test.mjs .tmp-hoodie-assembly/boxy-set-in-left-v1-fZYyN7
```

For another run, use its printed staging directory. Reinstalling v1 is rejected:
existing versions are never overwritten. Installation validates before copying,
validates the installed pair again, checks all prior asset hashes, and removes
only newly created files on failure. No old assets are deleted.

Validation covers pinned source/dependency hashes, source dimensions, XML and
full-canvas SVG structure, identity placement, compatible fit/construction/side,
fabric overlap, connected coverage and enclosed gaps. The candidate must retain
at least 98% of both original attachment boundaries, stay within 16 pixels of
the original bounds and leave no more than 16 enclosed empty pixels. This v1
retains 4786/4786 body contact pixels and 785/785 cuff contact pixels, with zero
fabric overlap and zero enclosed gaps.

### Partner workflow for a future compatible sleeve

1. Keep the full 1024 x 1536 Boxy drawing in `src/assets/studio-hoodie/`; do not
   crop, recenter or rescale the sleeve. Preserve its body armhole and cuff join.
2. Create a new recipe based on `scripts/collar/refs/boxy-set-in-left-v1.json`.
   Use a new version (for example `v2`), source path and source SHA-256. Obtain the
   hash with `Get-FileHash <source-path> -Algorithm SHA256` and lowercase it.
3. Keep `fit: boxy`, `construction: set-in`, `part: sleeveLeft`, `side: left`.
   Run the generation command with the new recipe. The generator records the
   current eight dependencies and measures the actual traced attachment joins.
4. Review the staged proof, then run the exporter with that staging directory.
   The JSON sidecar makes the new option discoverable without a catalog ID edit.
5. In the builder, test default attachment, movement, resize, rotation, swaps
   with the original and Reset. Do not accept a failed validator by weakening it.

This is a constrained compatible-replacement workflow, not automatic fitting of
arbitrary sleeve crops or new constructions. Changes to the body/cuff interface,
other fits, right sleeves or hoods require separate approval and registration work.

### Verification and visual review

With the hoodie Vite server already running:

```powershell
node scripts/collar/test_hoodie_assembly.mjs
$env:CERIGA_BASE_URL = 'http://localhost:5174'
node scripts/collar/check_hoodie_assembly_browser.mjs
node scripts/collar/validate_hoodie_pack.mjs
npm run build
```

The policy/generation test checks deterministic SVG output, installed registration,
15 invalid candidates, duplicate-install rejection and preservation of live assets.
The Edge/Playwright browser test covers all eight editable parts, six attachment
contacts, fabric overlap, connected coverage, gaps, colours, Raglan round-trip,
generated sleeve move/resize/rotate/Reset, compatible swaps, desktop/mobile,
serialized legacy transforms and independent artwork editing. Proofs and results
are written under `.tmp-hoodie-assembly/`, not source assets.

Open `http://localhost:5174/builder/hd-001`, choose **Boxy**, continue to the
configuration, open **Sleeves**, and choose **Set-in Sleeve v1 (regenerated left)**.
Compare with **Set-in Sleeve**. Click the left sleeve to select it, then drag it;
use its scale and rotation handles, swap versions while edited, then **Reset**.
Stop after this demonstration for visual approval before generating other assets.

---

## Reference Scuba hood v1

This separate test variant is **Boxy only**, compatible with the existing Set-in,
Raglan and Dropped Shoulder bodies. ID:
`hoodie/Hood/Reference Scuba hood v1 (boxy)`. Its SVG, registration sidecar and
binary source PNG are in `src/assets/hoodie-test/Hood/`. Regular Hood and Scuba
Hood remain unchanged. No other fit, rear geometry or zipper is generated.

The user's black hoodie attachment supplies visible design direction: rounded
structured crown, large deep opening, raised centre-front edges and panel seams.
This is a new Canvas-authored technical drawing traced through Potrace, not a
photo pixel trace. The attachment bytes were unavailable for archival; the
manifest says so, and the older lavender reference photo is not substituted.
The face opening depicts the inner hood panel, not a transparent hole through
the garment. There is no photographic texture, shading or copied body detail.

Placement is derived from the actual registered Regular hood neckline column
profile and the Boxy body mask on the common 2048 canvas. Crown width follows
the measured body chest; height follows the registered hood. Those dimensions
are not measurements inferred from the photo. Only this variant enables the
smooth side-panel taper; existing generators retain their default behavior.

The manifest pins the source, generator and dependency hashes, measured neckline
boundary, identity user transform and validation results. The final SVG must
pass strict XML/two-layer checks, clipping/alignment checks, and zero missing
neckline pixels and zero interior fabric overlap for all three Boxy bodies.
Its combined silhouette/ink raster difference from Scuba is about 16.1% of
their union, exceeding the 8% guard against a renamed copy.

Generate and validate before installing, from this repository:

```powershell
node scripts/collar/build_reference_scuba.mjs --generate
node scripts/collar/build_reference_scuba.mjs --validate <printed-staging-directory>
node scripts/collar/build_reference_scuba.mjs --install <printed-staging-directory>
```

Review the staged `registered-proof.png`, `original-scuba.png`, SVG and sidecar.
The initial install used `.tmp-hoodie-assembly/reference-scuba-v1-d0noB9`.
Installation is additive/exclusive, validates again after copying and checks
all prior asset hashes. Reinstalling an existing version is rejected. Future
design changes require a new versioned filename/ID and a new visual review;
do not use `publish_rebuilt_hoods.mjs`, which replaces canonical hood assets.

The hood stays selectable, movable, resizable, rotatable and recolourable.
Its transform reference is the original Scuba hood, so compatible swaps retain
the same pivot and user edits. Reset removes only the hood's user transform.
Regular Hood retains its own existing pivot. No transform locking is involved.

```powershell
node scripts/collar/test_reference_scuba.mjs
node scripts/collar/test_hoodie_assembly.mjs
node scripts/collar/check_hoodie_assembly_browser.mjs
npm run build
```

The reference test checks deterministic regeneration, duplicate/invalid install
rejection, all prior asset hashes, browser move/resize/rotate/colour/Reset,
original/new/Regular swaps, construction and front/back roundtrips, and mobile
rendering. A local JSON fixture survives a browser reload with its selection,
colour and transforms. This is not authenticated cloud save/hydration coverage.
Screenshots are under `.tmp-hoodie-assembly/reference-scuba-browser/`.

At `http://localhost:5174/builder/hd-001`, choose **Boxy**, continue through Fabric,
then open **Neck / Collar** and select **Reference Scuba Hood v1**. Compare it with
**Scuba Hood** and **Regular Hood**. Stop for visual approval after this variant.

## General prompt (paste this with any garment photo)

```text
Turn the attached garment photo into a tech-pack SVG mockup.

Do not generate SVG path data yourself. Raster first, then trace.

STEP 1 — LINE ART
Redraw the photo as a black-and-white fashion-flat / construction drawing:
- Front-on, symmetrical, laid flat.
- Copy THIS garment's construction exactly (silhouette, seams, pockets, pleats, fly, waistband, hems, collar, sleeves — whatever the photo has). Do not swap it for a generic tee or omit distinctive parts.
- Pure black lines on pure white. No grey, no shading, no fabric texture, no colour, no labels, no person.
- Interior blank white.
- Closed hems: one edge per opening, no oval “see-through” bottom.
- Keep the real proportions (shorts stay shorts with a crotch and two legs; do not turn them into a skirt).

STEP 2 — KEY WHITE
Luminance ramp, not a hard cut. Contrast 1.35. Luminance >= 246 → transparent. <= 120 → opaque black ink. Ramp in between.

STEP 3 — POTRACE SVG
- Alpha mask, upsample 3×, threshold 128.
- potrace.Bitmap inverts on construction — invert AGAIN so you trace the ink, not the page.
- turdsize 4, minority turn policy, alphamax 1.0, opticurve on.
- even-odd filled outlines. viewBox = source pixel size.
- Sanity: hundreds of subpaths. One rectangle = polarity is wrong.

STEP 4 — OPTIONAL
- Rasterize the SVG at 2048 and 4096 for Procreate (Procreate cannot open SVG).
- If asked for parts: split the RASTER by construction (measure landmarks, colour-proof, then trace each part with the same viewBox).

Deliver the SVG and say where it was saved. For this denim shorts job:

- `src/assets/studio-jorts/denim-shorts-lineart.svg` — the vector
- `src/assets/studio-jorts/denim-shorts-vector-4096.png` — best for Procreate
- `src/assets/studio-jorts/denim-shorts-vector-2048.png` — lighter Procreate option
- `src/assets/studio-jorts/denim-shorts-lineart-bold.png` — line art that was traced

Then split the raster by construction and load the parts on `/studio/garment-photo-test` so each piece can be coloured.
```

---

## Hard rules (every time)

- Pure **black lines on pure white**. No grey, no shading, no fabric wash, no photo texture, no labels, no measurements, no hanger, no person.
- Garment **interior stays blank white** so prints / fill colour can go underneath.
- Draw **construction**, not a pretty fashion illustration: seams, rib ticks, dashed topstitch, hems, cuffs, collar join.
- **Closed hem by default**: one bottom edge only. No second curve showing the back hem. No oval “open” hole at the bottom.
- **Full length by default**: hip-length tee on a **3:4** canvas (~1024×1536). Do not crop a boxy tee into a crop top. Boxy means wide + straight sides, not short.
- Match the photo’s **construction** (crew vs V vs mock vs gusset, set-in vs drop shoulder, cuff type). Do not invent a different neck.
- Outline trace, not centreline: every stroke becomes a **filled black shape**. You can recolour lines; you cannot change stroke weight with one number.
- **Procreate cannot open SVG**. Give PNG exports for Procreate, SVG for Illustrator / Affinity / Inkscape / Figma / the builder.
- Website neck parts must be **closed fill regions** (fabric) plus a thin ink overlay, not hairline-only drawings. The builder tints the fill.

---

## Job A — Full garment mockup (body, sleeves, hem, neck)

Use this when you want a print template or separate editable parts, like the slim tee and the boxy tee.

### A1. Line art

Generate **two** rasters from the photo:

- Bold-line version — this is the source of truth for tracing.
- Fine-line version — optional, nicer to look at.

Prompt the image model with:

- Fashion-flat / tech-pack, front-on, symmetrical.
- All construction details from the photo.
- Closed single hem, full hip length, 3:4 frame.
- Blank white interior, no shading.

If the first draw is cropped, **delete and redraw** on 3:4. Do not stretch a square crop — it looks like a crop top.

If the hem is an open oval (front + back curves), **delete and redraw** with one closed hem.

### A2. Key white to transparency

Do not hard-cut white. That leaves a halo.

- Contrast boost **1.35**
- Luminance **≥ 246** → alpha 0 (background)
- Luminance **≤ 120** → alpha 255 (ink)
- In between → ramp
- Output RGB black + that alpha

Sanity: ~95%+ pixels fully transparent. Composite over bright red. No white fringe.

### A3. Trace to SVG (potrace)

- Take the alpha channel
- Upsample **3×** (Lanczos on the alpha, then threshold)
- Threshold at 128
- `potrace.Bitmap()` **inverts on construction** — call `invert()` again so you trace **ink**, not the page. If you forget, you get one black rectangle.
- `turdsize=4`, `turnpolicy=MINORITY`, `alphamax=1.0`, `opticurve=True`, `opttolerance=0.2`
- Corners: `L` to control then `L` to end. Curves: `C`. Close with `Z`
- Divide coordinates by 3 so the viewBox matches the source PNG
- One `<path fill="#000000" fill-rule="evenodd">`

Sanity: hundreds of subpaths, tens/hundreds of KB. One subpath / &lt;1 KB = polarity is wrong.

### A4. High-res PNGs from the vector

Rasterize the SVG at **2048** and **4096** with even-odd fill and supersampling. These are the Procreate files.

### A5. Split into parts

Default parts:

- `body`
- `neckline-collar`
- `sleeve-left` / `sleeve-right`
- `cuff-left` / `cuff-right`
- `body-hem`

**Cut the raster mask, then trace each part.** Do not slice SVG path strings.

1. Measure landmarks from the ink (width profile every ~32px + labelled grid). Read real coordinates for collar, armhole, underarm, cuff line, hem topstitch, side seams.
2. Assign every ink pixel to **exactly one** part, priority:
   1. neckline-collar
   2. body-hem
   3. cuffs
   4. sleeves
   5. body = leftover
3. Region shapes (measured, not guessed):
   - Collar: ellipse or box slightly **larger** than the rib band (tight boxes clip the top corners into the body).
   - Hem: just above the hem topstitch. Side seams stay on the body.
   - Sleeves: polygon that follows the armhole and **stops at the underarm corner**. Below that is the body side seam.
   - Cuffs: the strip on the opening side of the cuff line.
4. **Colour-proof before tracing.** Collar red, left sleeve blue, right sleeve green, left cuff orange, right cuff purple, hem cyan, body black. Fix landmarks until the proof is right.
5. Trace each part with the **same viewBox** as the full drawing so they stack in register.
6. Also write one layered SVG (`inkscape:groupmode="layer"` on each group).

Verify: union of parts vs full SVG must have **zero missing ink**. Some edge-pixel diff is normal.

### A6. What “done” looks like

```
{garment}-lineart-bold.png
{garment}-lineart.png
{garment}-lineart.svg
{garment}-vector-2048.png
{garment}-vector-4096.png
{garment}-parts/
  body.svg
  neckline-collar.svg
  sleeve-left.svg
  sleeve-right.svg
  cuff-left.svg
  cuff-right.svg
  body-hem.svg
  {garment}-all-parts-layered.svg
```

These outline parts are **not** drop-in builder fills. The website pack needs closed fabric regions (Job B format).

---

## Job B — Neck SVG for the Ceriga website

Use this when someone uploads a collar photo and it must appear as a neck option on the slim test tee.

Pipeline lives in `scripts/collar/`:

1. `lineart.py` — photo → black-and-white construction drawing of **only** the neck
2. `collar_from_photo.py` — key → seat on the slim crew socket → potrace
3. `trace_svg.py` — 2048 viewBox, even-odd, inverted, `translate(0,2048) scale(0.1,-0.1)`

### B1. Photo

- Close-up of the neck, front-on, well lit
- Do not crop off the nape / back band
- The drawing must copy **this** construction (crew, V, mock, gusset-inside-crew, etc.)

### B2. Line art (Gemini)

The model must:

- Draw **only** the neckline/collar
- Front-on flat, left/right mirrored, whole nape on the page
- Black lines, white background, white openings
- **Never** fill the head opening or the chest with black
- **Never** invent a different neck (do not turn a gusset-in-crew into a generic V-neck)
- Rib ticks stay between inner and outer band edges

Post-process only:

- Crush to solid black on white (luminance ramp, not a hard cut)
- Punch a **real** filled head-opening slab if Gemini painted one — do **not** delete the collar band
- Keep a deep V-point; do not clip the bottom 20% of the collar
- A V-neck is an open horseshoe. That is valid. Do **not** run a “close the ring” refine pass that turns it into a crew

### B3. Key

Same ramp as Job A: contrast 1.35, white ≥ 246, ink ≤ 120.

### B4. Repair the band (do not destroy a V)

- Close only **tiny edge nicks**
- **Never** fill the gap between V-neck legs (that is the chest)
- Light close/dilate on a V; heavy `fill_holes` welds it into a crew
- Head hole = the white inside the neck, V-shaped if it is a V
- Fill = the fabric of the band only

### B5. Seat on the slim tee

Map the collar’s shoulder attach points onto the slim crew socket:

- Left `(354, 210)`
- Right `(671, 210)`

Scale / rotate so both attach points sit on that horizontal line. Keep the whole collar on the 2048 canvas.

### B6. Trace for the builder

Two layers, same format as `src/assets/tshirt-test/Neck/Crew neck.svg`:

- **Fill** — closed fabric region (`#000000`), even-odd
- **Ink** — thin construction overlay (`#141414`)
- `viewBox="0 0 2048 2048"`
- `<g transform="translate(0,2048) scale(0.1,-0.1)">`

Also cut a matching **body opening** so a V (or gusset) does not sit on a crew hole.

### B7. Sanity

- Neck SVG is a ring / horseshoe of fabric, not a black oval, not an empty hairline
- Opening is white
- Stacked on the slim body, attach points hit the shoulders
- Name describes the real construction (e.g. “Crew with V gusset”, not “V-neck” if it is not one)

---

## Prompt you can paste to another AI

```text
Generate a perfect garment mockup from the photo I attach.

Follow scripts/collar/MOCKUP_PROCESS.md.

If I ask for a full tee: Job A — bold + fine line art, key white, potrace SVG, 2048/4096 PNGs, split parts with a colour proof, same viewBox.

If I ask for a website neck: Job B — line art of only this neck (keep its real construction), key, repair without welding a V shut, seat on (354,210)/(671,210), potrace fill+ink at 2048 with the inverted potrace group.

Do not generate SVG paths by hand. Raster first, then trace.
Do not crop it. Do not open the hem. Do not invent a different neck.
```

---

## Failures we already hit (do not repeat)

| What you see | Cause | Fix |
| --- | --- | --- |
| One black rectangle SVG | Potrace polarity | Invert after `Bitmap()` |
| White halo on PNG | Hard white key | Luminance ramp |
| Crop top | Square canvas / short hem | 3:4, hem near bottom of frame |
| Open oval at the bottom | Front + back hem both drawn | One closed hem line |
| Collar corners on the body | Collar region too tight | Oversized collar box |
| Sleeves ate the side seam | Sleeve region went past underarm | Stop at underarm corner |
| V-neck became a crew | Refine “close the ring” or `fill_holes` | Treat V as a horseshoe |
| Neck is a black slab | Gemini filled the opening; cleanup deleted the band | Punch opening only; keep the band |
| Close-up V named “mock” | Top of photo hits the frame | Classify by V depth, not crop |
| Builder tint does nothing useful | Outline strokes, not fills | Job B closed fill + ink |

---

## Commands (local)

Website neck from a photo:

```bash
python scripts/collar/collar_from_photo.py path/to/neck-photo.png
```

Needs `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `.env`. Dev server exposes this as `POST /api/collar-from-photo`.
