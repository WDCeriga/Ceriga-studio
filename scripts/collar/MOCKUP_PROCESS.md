# How to generate a perfect garment mockup

Two jobs, same rules:

1. **Full garment mockup** — black-and-white tee drawing, then vector parts you can edit or drop into Procreate.
2. **Neck for the website** — photo of a collar → SVG that sits on the slim test tee next to Crew / V-neck.

Never ask an image model to “output an SVG”. Models only make rasters. Vectors come from tracing code.

## T-shirt trims and details

Step 6 is Trims & Details for t-shirts only. Pocket, zip, and button source SVGs live in `src/assets/garment-details`; their sizing, default placement, and supported colour channels live in `src/app/data/garmentDetails.ts`. Add future detail types to that registry and provide an SVG using the same fill, outline, stitch, and hardware CSS variables.

The category picker inserts one of five options from `GARMENT_DETAIL_OPTIONS`. Assets are original outline drawings informed by the supplied reference shapes, without embedded reference images, backgrounds, watermarks, shading, or textures:

- `buttons/button-01.svg` through `button-05.svg`: two-hole rim, four-hole rim, flat four-hole, recessed four-hole, cross stitch.
- `zips/zip-01.svg` through `zip-05.svg`: classic pull, slim pull, ring pull, framed welt, open zip.
- `pockets/pocket-01.svg` through `pocket-05.svg`: rounded patch, square patch, pointed patch, envelope flap, divided patch.

Instances store an optional `variant` ID alongside their category. `detailAsset` resolves geometry and colour channels for that variant; missing or unknown variants retain the original category asset. Keep the three original SVGs for saved-project compatibility. Duplicates retain the variant, colours, and scale. Zip variants use their own viewBox aspect ratio and width to maintain consistent default length. Cross-stitch buttons expose thread colour, and flap/divided pockets expose hardware colour.

Each saved `garmentDetails` instance has its own ID, name, colours, x/y position, scale, selected flag, and optional `view`. Coordinates remain relative to the body bounds for compatibility, but may extend outside 0-1 to reach sleeves and the full 2048-square customization canvas. Only the object's center is bounded to the canvas edges; presets apply on creation, never during dragging. `GarmentDetailsOverlay` renders the active side's objects separately above the garment ink.

Four corner handles resize proportionally around the opposite corner, with a per-instance scale from 0.2 to 4 (legacy instances without scale use 1). The Size field and handle arrow keys also resize. Dragging and resizing commit once on release for undo; pointer cancellation discards the gesture. Object arrow keys move, and Delete removes the focused object. Selection changes are stored without adding undo entries. Source garment SVGs are never modified. Draft/project serialization includes the instances; remote persistence requires configured Supabase.

With Vite running, execute `await (await import('/scripts/collar/test_garment_details.ts')).verifyGarmentDetails()` in the browser console. This validates all 15 variants plus three legacy assets: SVG decoding and nonblank rendering, transparent backgrounds, viewBox ratios, independent IDs, colour channels, canvas bounds, free collar/sleeve placement, proportional resizing, resize anchors, legacy fallback, and variant serialization. Also verify all five options per category, add/select/duplicate/remove, drag and resize with zoom, front/back visibility, and fit changes in the builder.

## T-shirt wash and finish

Step 7 uses `garmentWash` for Clean, Vintage, Mineral, Acid, and Stone finishes. `src/app/data/garmentWash.ts` owns serializable settings and procedural rendering; `WashFinish.tsx` owns controls and mask editing. No wash-specific garment assets are generated, and construction paths remain unchanged.

Style, colour mode, intensity, blend, noise, seed, and wear settings are shared. Placement overrides, brush strokes, and shapes live separately under `views.front` and `views.back`. Missing wash state means Clean; missing side placement falls back to the global placement for compatibility. Natural and bleach tones derive from each fabric region's colour. Seeded texture is deterministic.

Each solid fabric region receives its own source-alpha-clipped wash above its fabric colour, below construction ink, stitching, trims, and prints. Neck openings and the transparent exterior remain unpainted. Placement masks are inverse-mapped through the region's actual transform; edge wear stays in local region coordinates. Presets, wear, shapes, and ordered paint/erase strokes combine non-destructively. SourceAlpha must be converted to white RGB before use in a luminance mask. Brush blur filters use user-space bounds so horizontal and vertical strokes do not disappear with a zero-sized object bounding box.

Brush and saved shape coordinates are normalized to garment bounds. Shape creation and editing controls are currently removed; saved shapes still render. Screen input uses the SVG screen matrix, including canvas zoom. Paint and eraser collect coalesced pointer samples and render quadratic paths by updating mounted mask paths once per animation frame. Soft strokes use individual user-space blur bounds padded by the brush radius plus four blur standard deviations; these bounds expand during drawing, with separate filters for mirrored strokes. Hard brushes omit blur filters. Gestures commit one history entry on release; cancellation discards the draft. Before/After hides rendering without clearing masks. Full builder state serialization carries both sides into history, projects, versions, and previews. Cloud roundtrips require configured Supabase and have not been verified locally.

With Vite running, execute these browser checks:

```js
const washTests = await import('/scripts/collar/test_wash.ts');
await washTests.verifyWashMasks();
await washTests.verifyWashGarments();
await washTests.verifyWashPreview();
```

The checks cover 84 style/placement/colour combinations, clipping, deterministic seeds, intensity, paint/erase, eight soft-stroke raster comparisons against broad blur bounds, mirrored saved shapes, serialization, 40 fit/view/sleeve combinations with 312 fabric regions, unchanged construction, transformed placement, and Before/After source preservation. Also exercise paint and eraser gestures, mirroring, cancellation, undo/redo, side switching, zoom, and responsive layout in the builder. Large accumulated stroke histories have not been performance-benchmarked.

## Front and back views

Rear side-entry contours are measured at nine heights from the selected front collar, mirrored, and joined to the shoulders at their widest point. Sample at least two SVG units below the source's topmost bound: the extreme tip can contain ink on only one side and make a scan cross the opening. The construction regression rejects abrupt side-entry jumps as well as vertical end caps. Inspect paired front/back renders for all six collars and four fits; symmetry alone does not prove the source angle was preserved.

Both views use one builder garment configuration. Fit, fabric, part colours, transforms, sleeve construction, hems, and stitch settings remain shared. `resolveGarmentLayers({ ...input, view: 'back' })` applies `tshirtBackView.ts` after sleeve and hem construction, directly to the selected garment layers. Rear profiles use the selected collar's width and central top-neck geometry, centered and mirrored about the garment axis. Thin binding thickness is measured from its front binding; rib pitch and line weight come from the matching source outline. Rear ribs are evenly spaced, vertical, symmetric, and clipped inside the closed contour. Polo is a clean rear stand with no internal fold, front wings, or placket. Shoulder joins use the selected body edge and cubic transitions, not fixed crew anchors. A hidden three-unit body overlap closes the antialiased collar join without changing its visible outline. Front neck ink is cleared through the source neckline plus a 24-unit stitch margin. Outside the collar and short shoulder transitions, the selected garment's body, outline, stitching, sleeves, and hem remain unchanged. Original source assets are not edited.

Prints, text, pockets, zips, and buttons carry `view: 'front' | 'back'`. Missing `view` means front for saved-project compatibility. `decorationsForView` filters the active side; `replaceViewDecorations` merges its edits without replacing the other side. Details can be explicitly copied to the other side with a new identity. Temporary gestures reset when switching views. Saved state retains both arrays and version previews use the saved viewing side.

Measurement previews receive the same garment transforms and trim colours as the other steps. Back hides the front neck-drop guide; the shared measurement values remain unchanged. View changes do not reset canvas zoom or pan.

With Vite running, execute `await (await import('/scripts/collar/test_hem_styles.ts')).verifyBackViews()` in the browser console. It checks 120 fit/sleeve/collar combinations, rear neckline fill and colours, unchanged pixels outside the neck (two-level raster compositing tolerance), 140 rear stitch styles, No Hem suppression, immutable inputs, legacy decoration handling, side deletion, and serialization. Also inspect all fits visually, exercise independent front/back editing and copying, and verify repeated toggles at non-default zoom. Cloud persistence still requires configured Supabase.

Run `verifyRearCollarConstruction()` from the same module for all 24 fit/collar pairs. It uses production body edge sealing and checks exact vector symmetry, centered contours, mirrored vertical ribs, constant rib spacing, collar colour containment, transparent space above the collar, closed opaque joins, a clear Polo interior, and uniform upper-back fill. Raster symmetry permits minor edge antialias differences; vector symmetry does not. The outside-neck comparison includes one raster pixel around the clearing region for antialiasing.

## T-shirt stitch rendering

`src/app/data/tshirtStitching.ts` derives stitch centre lines from the resolved garment after sleeve and hem construction. All styles, including the default Standard, use the same curve renderer. Small tracing bumps are smoothed with displacement limited to two garment units; corners and seam endpoints are retained. Original assets, binding edges, ribbing and colour masks are not changed.

Standard uses 9-unit dashes and 9-unit gaps with balanced end margins on the 2048-unit canvas. Double and Triple use parallel dashed rows; Zigzag uses a narrower, open repeat; Overlock uses one rail with spaced loops; Coverstitch uses two clean continuous rails. Every style uses a 1.8-unit round-capped stroke. Thread colours and per-region settings are unchanged.

Stitching stays noninteractive and follows the existing seam clips. No Hem suppresses its corresponding stitches. Regions with no source stitch marks, including the Slim Scoop neckline, do not gain invented stitches. With Vite running, `verifyStitchStyles()` in `scripts/collar/test_hem_styles.ts` checks spacing, pattern distinctions, seam proximity, outline containment (with a one-pixel raster-edge tolerance), per-area colour independence, serialization and No Hem suppression across all fits and sleeve options.

## T-shirt hem construction

The builder applies independent `normal`, `ribbed`, or `none` construction to outer sleeve cuffs, the bottom hem, and layered undersleeve hems. The choices live in `tshirtHemStyles` on the saved builder state. Colour regions remain independently editable for every style.

`build_hem_styles.py` derives vector subtraction masks and construction paths from the existing fill, outline, and stitching assets. The runtime applies them after sleeve replacement; it does not hide ribs with fabric-coloured overlays or alter the original SVG files.

After changing source sleeve or hem geometry, regenerate all four fits and five sleeve variants from the repository root (Python dependencies: numpy, Pillow, opencv-python-headless, resvg-py):

```sh
python scripts/collar/build_hem_styles.py --install
```

Use `--fit` and `--variant` without `--install` for isolated diagnostics. Installing a filtered run replaces the generated catalog with only that subset.

With Vite running, execute the browser regression module from the browser console:

```js
const hemTests = await import('/scripts/collar/test_hem_styles.ts');
await hemTests.verifyHemStyles();
await hemTests.hemComparison('boxy', 'Short sleeve', [260, 565, 215, 175]);
```

The suite checks 60 construction renders, 120 neckline combinations, colour retention, independent controls, and newly transparent gaps. The comparison adds a temporary three-style overlay; reload to remove it. Inspect enlarged cuffs and bottom hems after regenerating, since pixel assertions do not replace visual review.

---

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
