# How to generate a perfect garment mockup

Two jobs, same rules:

1. **Full garment mockup** — black-and-white tee drawing, then vector parts you can edit or drop into Procreate.
2. **Neck for the website** — photo of a collar → SVG that sits on the slim test tee next to Crew / V-neck.

Never ask an image model to “output an SVG”. Models only make rasters. Vectors come from tracing code.

## Custom assets: Azure AI upload pipeline

The builder's Neck / Collar, Sleeves and Pocket uploads share `CustomAssetUpload.tsx`
and the local `/api/custom-assets` middleware. Photo references use Astra analysis
through Azure OpenAI Responses, then a separate Azure GPT Image edit deployment
for the technical raster. Local cleanup, Potrace and part-specific registration
produce the SVG. Astra never authors final SVG. There is no Gemini fallback in
this upload flow; the duplicate legacy collar button and its route are no longer
registered. Saved legacy collars remain supported. Historical Gemini CLI helpers
and the separate full-garment photo test are not part of this migration.

The detail upload offers Pockets, Buttons, Zips and Patches in Photo / Azure AI mode.
Uploaded patches preserve their traced silhouette and artwork, use free placement,
and appear in Patches with independent colour, size and position controls. Procedural
patch construction controls remain exclusive to patches created with Add patch.

Photo analysis can identify up to 16 attached pocket, zip, button or patch components.
Each component is processed and traced separately; the parent drawing excludes
those components. Analysis bounds include complete assemblies, including zip
surrounds and attachment stitching. These regions are blanked with a small margin
in a copy of the parent reference before raster generation, which reconstructs the
underlying fabric. The untouched reference remains available for child extraction
and review. Separation still depends on accurate bounds and reconstruction.
Accept installs the complete bundle together, with independent
colour, size and position controls in the corresponding detail sections. Initial
placement uses the reference bounds and remains editable, including sleeve hardware
outside the torso. If review finds a separation or construction defect, non-sleeve multi-part
uploads receive one corrective redraw using that feedback
and are reviewed again. Sleeve generation explicitly excludes neighboring torso
contours and must not replace observed cuff stripes or solid joins with invented
ribbing or dashed stitching. This correction path is covered by mocked review
tests; the user's striped sleeve has not been verified live after this change.
Sleeve technical review now measures reference and generated centerline length,
upper width, cuff opening, armhole endpoint width, taper and silhouette aspect.
Vision supplies normalized landmarks in each supplied image; code converts them
to pixel coordinates before measuring, retaining rotation and scale independence.
Length is normalized by armhole width; upper, cuff and armhole widths by length;
taper is cuff/upper width; aspect is the outline extent along/across the sleeve axis.
These are estimates from vision landmarks, not calibrated physical measurements.
For each ratio, drift is `max(generated/reference, reference/generated) - 1`.
No catalog fit or ideal sleeve dimensions enter technical review.
GOOD MATCH means high-confidence estimates with at most 20% drift and no issues.
NEEDS REVIEW covers moderate drift, uncertain projection/landmarks or moderate
construction issues and continues to tracing, registration and enabled Accept.
REJECTED means high-confidence drift above 50%, clearly reversed/lost reference
taper, or evidence-backed major structural/construction failure. Taper reversal
uses reference/drawing ratios on opposite sides of 0.8 and 1.2; taper removal means
a reference below 0.75 or above 1/0.75 becomes nearly straight (0.9 to 1.1).
Only REJECTED triggers one corrective redraw, keeping the original measured target
fixed. Malformed review responses stop processing without a corrective redraw.
The opposite sleeve inherits the canonical review and is mirrored locally.
`sleeveReview` in the result records both ratio sets, confidence, drift, thresholds
and evidence separately from registration status. Registration logic is unchanged.
Sleeve photo analysis also requires `sleeveOutline`, a normalized perimeter following
the sleeve, cuff and actual armhole seam, excluding the shoulder/torso wedge.
The generator receives a copy masked outside that perimeter, with a two-pixel
margin to retain boundary ink. Attached component regions are then removed as usual.
Review and child extraction still use the untouched original. Missing or invalid
outlines stop processing before generation; semantic accuracy still depends on Astra.
All 40 custom-asset tests pass, including synthetic shoulder removal, cuff retention,
original-reference review and invalid-outline rejection. The exact sleeve upload
has not been verified live with perimeter masking.
Sleeve registration first keeps the existing sideways placement when it fits.
If it overflows, registration searches bounded downward poses, fixing the armhole
edge and progressively turning the distal sleeve and cuff. The outward centreline
length is retained; this is a pose adaptation, not a rigid copy of the source.
Nonfolding and full-outline canvas checks reject impossible poses before tracing.
The fixed attachment edge is explicitly rasterized to retain thin shoulder tips.
The former fixed 650-pixel width limit is removed; actual canvas bounds still apply.
Regressions cover wide sleeves on all four fits and both sides, retained cuff
construction, overlong-sleeve rejection, and real Boxy tracing/render validation.
The exact Azure drawing from the reported canvas failure was not retained by the
failed request, so its end-to-end retry remains unverified.
A component that still fails prevents partial installation. Local drawing
tracing remains single-part and does not run semantic component recognition.
In Photo / Azure AI mode, Astra-classified technical drawings of pockets, buttons,
zips and patches can retain their source geometry instead of being redrawn. A
monochrome, whitespace and ink-density guard allows antialiased line art, including
denser isolated component crops. Attached component regions are removed from the
parent copy; children use the untouched source. Extraction must pass Astra isolation
review before tracing. A failed semantic review falls back to reconstruction;
request or malformed-review errors still stop processing. Collars and sleeves do
not use this preservation path.
Multi-part recognition and upload handling are covered by mocked tests. A live
synthetic pocket-and-zip reference passed parent isolation review and tracing after
region removal, but its separate zip failed both reviews for changed proportions
(narrow tape and undersized slider/pull). No bundle was installed. On the user's
exact JPEG, source-preserving pocket extraction passed review and tracing, but the
zip crop exceeded the original antialias guard and entered redraw. The guard was
adjusted with a dense antialiased-crop regression; all 37 custom asset tests pass.
The subsequent exact-image retry was blocked during analysis by Azure HTTP 429
(token rate limit). End-to-end separation of that image remains unverified.

Zip registration permits dark-pixel coverage below 35%, rather than the 18%
limit retained for other mask-based parts. Closed-contour, boundary, background
and render checks remain active. A manually bounded zip crop from the exact JPEG
measured 18.28% ink after cleanup and passed preservation, cleanup, registration,
Potrace and render validation locally with this change. This check does not verify
Azure's component bounds or semantic review. Density errors now report measured
coverage and the applicable limit; registration errors name the actual detail type.

### Server configuration

Set these in the project root `.env.local` (ignored by git), then restart Vite:

```dotenv
CERIGA_AZURE_API_KEY=<your Azure resource key>
CERIGA_AZURE_ENDPOINT=https://richyjames6643-0474-resource.openai.azure.com/openai/v1/
CERIGA_AZURE_REASONING_DEPLOYMENT=gpt-6-astra
CERIGA_AZURE_IMAGE_DEPLOYMENT=gpt-image-2
CERIGA_AZURE_IMAGE_API_VERSION=2025-04-01-preview
```

The image API version is optional and defaults to the value above. The image
deployment must belong to the same Azure resource; both calls use its server-side
`api-key` header. Never prefix secrets with `VITE_` or `NEXT_PUBLIC_`. Requests go
to `/openai/v1/responses` for analysis and
`/openai/deployments/{deployment}/images/edits?api-version={version}` for raster
editing. Only base64 PNG/JPEG/WebP image responses are accepted from image editing.

`gpt-6-astra` performs analysis only; `gpt-image-2` produces the raster. Both
configured deployments and the routes above were exercised successfully live.
Missing required configuration stops photo processing explicitly; the Local trace
mode remains entirely local. Generated raster quality and registration are checked for
each upload, not assumed from deployment availability.

Live verification passed end to end for the V-neck collar photograph and a
recognizable flap-pocket technical reference submitted through Photo mode.
The pocket test is not evidence of arbitrary photograph quality. Sleeve analysis
and image generation succeeded for a cropped raglan drawing, but registration
correctly rejected its hanging orientation: the armhole was not on the required
right edge. A catalog outline was rejected by Astra as ambiguous. A successful
live sleeve upload is still unverified; use a clear compatible reference before
claiming all three photo workflows are proven.

Live diagnostics exposed two local raster defects now covered by regressions:
sparse ink below 1% must not be discarded by contrast normalization, and thin
collar contours must retain pixel coverage when downsampled onto the neck socket.
The image prompt also suppresses rib/knit hatching in favor of bounded white
panels and essential seams. Boundary, socket and black-fill guards remain active.

Use the project's Python environment with Pillow, numpy, scipy, resvg-py and
`requests>=2.32.4,<3`. Install the added dependency with
`python -m pip install "requests>=2.32.4,<3"` using that environment. Potrace 1.16
must be available via `POTRACE`, `POTRACE_EXE`, PATH, or the middleware's local
`.venv/tools/potrace-1.16.win64/potrace.exe` discovery. `PYTHON` can override the
middleware's interpreter. This backend runs under Vite development only; a static
production build does not provide the Python upload service.

### Local verification

Collar registration now infers fabric and the opening at the cleaned drawing's
source resolution, retains its construction ink, and traces before applying one
uniform scale and translation. Minimal contour closing replaces aggressive gap
filling. Opening selection no longer favors the upper rear band or overlap with
the stock crew opening. No named collar preset replaces uploaded geometry.
Measured Slim socket anchors still control placement; other fits remain unsupported.
The paired body fills the old neck socket and removes the uploaded opening locally.

The registered collar is rendered back into source coordinates before it can be
returned: fabric IoU must reach 96%, opening fill must stay below 1%, and ink
coverage in both directions must reach 98% within one source pixel. Detached ink
components of at least four pixels must retain 90% coverage. Failure reports
"Final asset differs significantly from generated drawing" and prevents Accept.
This checks tracing fidelity against inferred masks, not semantic correctness of
every possible opening. Opening inference remains heuristic.

FINAL ASSET offers Garment and Collar Close-up views of the same registered SVG.
The close-up preserves the selected collar color and does not regenerate artwork.
Layered-V regressions cover rear-band retention, transparent opening, a short seam,
center join, local body changes, and rejection of filled holes or scale drift.
The browser fixture is synthetic, not the user's original uploaded raster; exact
reference verification still requires that CLEAN DRAWING image. Responsive mobile
verification remains pending because the integrated browser did not honor resizing.

Start `npm run dev -- --host 127.0.0.1` and use its reported URL.

1. Collar: open the main T-shirt or test tee in Slim, front view, Neck / Collar, Upload. Other collar
   sockets are intentionally disabled; uploading never silently changes fit.
2. Sleeve: open the main tee, front view, Sleeves, Upload. Select left or right.
   All four fits are supported. Technical input must be one canonical left sleeve
   with its armhole at the right; registration mirrors it for a right sleeve.
3. Pocket: open Trims & Details, Custom Pocket, Upload. Both tee packs and both
   views support placement. Accepted pockets retain independent measurements.
4. Choose Photo · Azure AI and a single-part crop. Check ORIGINAL, CLEAN DRAWING and
   FINAL ASSET, then Accept. The upload's category is locked to its builder section.
   A photo identified as another part must fail, leaving Accept disabled. Local
   technical drawings use the user-confirmed category, not semantic AI analysis.
5. Test missing configuration, a rejected Azure request, an open technical contour,
   and a crop touching the boundary. The error should identify the failing stage
   and cause. Failed or cancelled processing must not install a partial asset.
6. Accept a valid asset, change its colour and measurements, save and reload.
   The stored vector should restore without a new API call.

Run `python -m unittest discover -s scripts/collar -p test_custom_assets.py` with
the project interpreter. Tests cover mocked Azure contracts and failures plus real
local tracing for collar, pocket and eight fit/side sleeve combinations. In the
browser console, run the existing offline fixture and state checks:

```js
const assets = await import('/scripts/collar/test_custom_assets.tsx');
await assets.processFixture('collar');
await assets.processFixture('sleeve');
await assets.processFixture('pocket');
await assets.verifyCustomAssetState();
```

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

## Whole Garment Import measurement tables

The imported measurement panel builds both tables from the detected garment's current-view measurement guides, not a fixed T-shirt or shorts row list. The XS–XXL table contains editable, initially blank user-supplied size specifications. Values are stored in `importedGarment.sizeMeasurements[view][measurementId][size]` in millimetres; the cm/mm control converts display only. Entries are committed on blur or Enter, and clearing a cell removes its value. Front and back entries remain independent. Size entries do not calibrate the photo or generate grading for other sizes.

The separate photo-reference table retains Measurement, Value, Unit and Status, with optional one-dimension calibration. Both tables highlight the same geometry guide. Development review fixtures are available at `/garment-import-review?garment=shorts`, `?garment=tshirt` and `?garment=hoodie`; these are synthetic SVG fixtures, not live photo-analysis results. `test_generic_garment_measurements.ts` covers generated size rows, empty defaults, unit display, serialization and view isolation.

Explicit semantic part types take precedence over descriptive references to other parts: a body described as lying beneath a hem or placket overlay remains the body. Chest guides use shared sleeve/body armhole junctions when available; otherwise the method explicitly identifies the chest level as estimated. Visible plackets, including detail-layer overlays, add length and width measurements only to their owning view, regardless of garment name. Sampled lower-facing hem/cuff contours are measured across the complete connected edge rather than a single tiny segment, excluding near-vertical side seams. `test_imported_henley_measurements.ts` covers these cases, contour resampling and view isolation. Photo-derived geometry still requires calibration and does not constitute an exact production specification.

### Whole-garment input routing

`Input type` offers Auto, **Photo / reference (redraw)** and **Clean mockup / technical drawing (trace only)**. `/api/garment-input-type` screens local tone, colour, thin ink and enclosed regions, returning structured indicators and heuristic confidence, not semantic person/mannequin detection. Ambiguous monochrome sources suggest local tracing with an explicit uncertainty warning. The selection is editable and a stale response cannot overwrite a manual override. Automatic requests retain their detection evidence. Primary and optional back images have independent selections; the UI makes sequential single-image requests and installs the pair only when both succeed. A missing-view upload is staged for this same selection before processing.

Clean mockups bypass providers, semantic reconstruction, technical projection and inferred neck backing. The uploaded raster is authoritative, including collar shape, silhouette, sleeve angles, hem and stitch marks. Local cleanup keys white with contrast 1.35, opaque ink at luminance ≤120, transparent at ≥246 and a smooth intermediate alpha ramp. Potrace traces a 3× alpha mask at threshold 128 (ink-side inversion), minority turn policy, turdsize 4, alphamax 1.0, opticurve and even-odd paths. The standalone SVG uses source pixel dimensions; builder framing is uniform rather than reshaping the garment. Degenerate traces must fail, not fall back to semantic templates. Semantic colour panels and an estimated rear view are not invented for trace-only drawings.

Photo/reference mode retains Azure construction analysis and Azure image-edit technical redraw before the **same** white-key/Potrace implementation. The prompt requests front-on orthographic construction, correcting photographic perspective and pose while preserving garment proportions, unusual details and intentional asymmetry. Person/background, texture, lighting, colour and branding are excluded. Provider failures stop processing rather than tracing the original photo as a fallback.

The review dialog shows source, cleaned raster (technical redraw in Photo mode), keyed alpha, traced SVG and overlay, with a source-sized SVG download. The photo overlay measures tracing against the technical redraw, not against the original photograph: construction fidelity must be visually reviewed separately. Both routes retain traced ink together without inferred colour panels or separately editable stitches; fabric/wash effects do not alter source-ink layers. Mode, detection and preview artifacts persist per view through save/reload and replacement. Existing saved imports remain untouched until re-imported. Offline coverage includes `test_garment_trace_only`, `test_garment_upload_routes`, and `test_garment_trace_ui.tsx`; Azure is mocked in routing tests.

### Source-derived analysis contract (legacy/internal reconstruction)

The retained `reconstruct()` engine described below is separate from the input-type upload router; clean trace-only drawings never enter it. The engine classifies garment type independently of material; it is not restricted to denim or shorts. Original-photo analysis includes a family-independent construction checklist covering short strap/hardware joins, seam junctions, bindings, closures and hems. Unclear or hidden details remain uncertain rather than invented; mocked multi-family tests verify evidence preservation, not universal recognition accuracy. It now analyzes the original photo and traces source-coordinate construction without image-model redraw or redraw registration. A uniform affine transform preserves source aspect ratio. Front and back garments use clean source-matched technical projection, described below. Intentional asymmetry and strongly posed pairs are preserved rather than forced into a generic mirrored template. Semantic regions include body, sleeves, cuffs, neckband, collar, hood, yoke, placket, skirt and lining in addition to panels, pockets, closures and trims. Unknown material is allowed when explicitly documented; an unidentifiable garment is rejected before tracing. Detail controls retain their source region's builder category and display name.

For AI-confirmed isolated garments on verified near-white backgrounds, source pixels refine nearby fabric exterior edges. Bounded recovery can assign missing fabric within 8% of the canvas to the nearest evidenced fabric piece and its fabric parents, without growing hardware. Pale internal prints do not create holes, and source-defined background openings remain protected. This colour-piece ownership is approximate, not evidence for new partition seams: only source-supported internal boundaries and the recovered silhouette supply closed construction ink. Refined masks supply SVG fills, geometry bounds and relative measurements; polygon guides and estimated-back geometry remain source-analysis approximations, noted during review when fabric recovery is used. Other photos retain the source polygons and report that refinement was skipped. Coverage validation prevents a floating rear neckband from substituting for visible fabric behind a scoop: that fabric is a non-structural `lining` detail with role `visible-inner-back`, drawn behind the front body and excluded from measurements. Invalid hardware cutouts or missing visible fabric permit one bounded original-photo reanalysis with validation feedback; persistent errors stop the import. Preview and SVG come from the same masks. This prevents redraw drift, but does not guarantee pixel-perfect AI seam/hardware recognition or reveal hidden back construction. Saved imports must be re-uploaded to use the new pipeline.

Technical imports use `source-matched-technical-flat-v2`. Generic front/back construction polygons are resampled and gently faired; only reciprocal, same-construction pairs with sufficient source overlap are balanced. Attached details inherit panel displacement, hardware moves rigidly, and intentional asymmetry disables balancing. Strongly posed pairs retain their pose. The source-coverage gate runs before generic projection, but pixel-recovery masks do not replace clean construction polygons. SVG construction strokes reuse the exact traced fill paths with constant width and rounded joins, beneath separate evidenced detail/stitch layers. Existing saved imports are not rewritten; re-import to regenerate. Eligible front scoop tanks/vests retain specialized balancing and hem-levelling without photo-edge snapping or pixel recovery. A body-mask intersection-over-union guard of 0.85 rejects excessive shape drift rather than substituting a generic tank. Paired perimeter alignment accepts either source winding so narrow bindings do not collapse or self-intersect when the model lists their vertices in opposite orders. Construction edges and cutouts follow their piece's perimeter displacement during balancing, including unmatched short joins. Fabric edges pair by construction/style and geometric correspondence, not array order. Hardware internals retain their observed handedness: identical clasps need not have mirrored hinges. Hardware and real slots retain separate geometry; foreground masks occlude hidden rear edges and stitches. Controlled vertical rib paths are presentational only, never seams, split boundaries or measurement geometry. Technical fabrics and hardware start in neutral colours and remain editable. These are source-analysis approximations, not production patterns. Run `python -m unittest test_garment_technical_flat test_garment_source_geometry test_generic_garment_import` for offline projection and fallback regressions.

Whole-garment source analysis requests Azure Responses server-sent events (`stream: true`, `store: false`). This avoids waiting for the entire detailed geometry response before receiving any data; Requests' HTTP `stream=True` alone does not enable server-side streaming. Only a terminal completed response proceeds to manifest validation; partial deltas, truncated streams and failed/incomplete responses never install a garment. Ordinary JSON responses remain supported. Transport retains its 24 MB response cap, 15-second connection timeout and 240-second idle-read timeout; the reconstruction endpoint retains its 900-second overall deadline. Requests are not automatically resubmitted after an interruption. Transport error messages distinguish connection failures from response timeouts; redraw-registration messages remain only for legacy callers, not source-locked reconstruction.

Run the offline backend regressions from this directory with `python -m unittest test_generic_garment_import`. Use the project virtual environment and set `POTRACE_EXE` to the installed Potrace executable if it is not on PATH. The tests mock Azure responses but run real segmentation and SVG tracing for denim shorts, non-denim shorts, a T-shirt and a hoodie, each as a separate front or back reference. They do not establish live model classification quality. The upload endpoint processes one image per request; the builder orchestrates optional front/back images sequentially through the current input-type router described above. A single raster containing both views is not split automatically.

### Independent colours, optional labels and estimated backs

Fabric & Colour exposes every colourable region in the active view, including body, sleeves, neck/hood, cuffs and hems. Shared source colour groups are scoped by construction role, so a sleeve colour does not recolour the body or neck merely because all regions started with the same fabric. Matching sleeve pairs can remain linked; explicitly independent regions stay independent. Material-wide recolouring remains an explicit action. Analysis requests separately bounded, editable construction zones even when their initial colours match. Hem bands require visible edge/seam evidence: old imports without that geometry need a clearer reference and re-analysis, not an invented fixed-width strip.

Labels & Branding is opt-in: opening the panel or browsing label categories must not create labels. Use Add; deleting the last label leaves the garment empty. Imported sewn labels use explicit manual placement rather than assuming template-specific neck, sleeve or hem anchors. Hand tags are standalone two-sided designs, like template-builder hand tags: they have no garment placement target or position controls and never render attached to the garment, including when an older saved tag has placement coordinates. Saved tag content remains editable and exportable.

For eligible front neckband geometry, a derived inner-neck fabric backing fills the opening using the neckband hull minus its actual outline and overlapping source parts. Hood interiors use a genuinely enclosed aperture formed by observed hood panels and, when needed, observed attached closure geometry; open exterior gaps are not filled. Existing lining, hood fabric, hardware and torso remain uncovered. The backing follows body colour with 12% lightening; a panelled torso can instead use the source hood-crown colour. It never recolours the rear exterior, rear binding, placket or buttons. This is a preview-only, nonselectable visual layer, not an observed source part or measurement surface. Unsupported families, ambiguous or invalid outlines and nonidentity part transforms omit the backing instead of inventing a placement; neckband-only derivation still requires an unambiguous body. The captured panelled-hoodie front-outline regression is available at `/garment-import-review?garment=hoodie&construction=panelled`; it has no observed back, and its test metadata/colours are scaffolding rather than a fresh analysis result.

A front-only import still has no back until an explicit action. **Generate estimated back** builds separate local rear geometry from supported structural outlines, adapting the upper neckline, hood envelope or waist edge without copying front-only pockets, labels, fasteners or stitching; validated shoulder fastenings have the conservative carryover exception described below. It is marked **ESTIMATED / not observed**, retains low geometry confidence, supplies no back photograph, and inherits no physical calibration. Unknown or unsuitable outlines return an explanation rather than fabricated geometry. The estimate is editable and can be replaced with a real back reference while preserving the front. This is not a prediction of hidden construction or production measurements. Connected torso panels are assembled into one rear exterior rather than requiring a single front body polygon. Separated halves can join only through valid, body-attached central closure geometry, clipped to the torso bounds; disconnected or ambiguous assemblies remain unsupported. Multiple hood panels contribute one estimated exterior envelope, without carrying front panel seams onto the back. Attachments to assembled torso panels resolve to the new rear body. A recognized subtype can supply the family when the generic classification is `other`; lining and construction attached through it are excluded from the estimated exterior. This lets a tank's visible inner-back bindings remain front-view evidence without blocking an estimated back. The offline inferred-back tests cover eight garment families, panelled construction, closure-gap rejection and real-view replacement; they do not establish live image-analysis quality.

Separate waistbands retain their validated front perimeter in the estimate, including thin, curved and tilted bands; only the skirt body’s waist edge is approximated. This inherited outline is not evidence of rear construction. Synthetic regression tests cover both outline directions and dense sampling, while invalid or transformed waistband geometry remains rejected.

Sleeveless tank/vest estimates assemble body-attached fabric straps and bindings into a single connected exterior. Functional metal hardware (including legacy panel-classified buckles) is not rear fabric and does not block estimation. Deep front scoop necklines use a smooth, shallower rear scoop while preserving narrow strap placement, the outer armhole family, side seams and cropped hem. Validated attached shoulder clasps carry over as simplified, paired estimated loops rather than disappearing or becoming fabric. Exact rear hardware visibility and fastening mechanics remain unknown; this does not assert a racerback or unseen rear bindings. Unattached/disconnected straps, unresolved transforms and invalid geometry still fail safely. The synthetic regression at `/garment-import-review?garment=tank` exercises this flow without a provider call; it is not the uploaded photograph’s reconstructed result. Hardware remains independently editable in closure controls and does not receive fabric wash effects.

Generating a back clears review/acceptance and opens its vector interpretation for review. The UI says **Estimated back — inferred from front geometry**, lists rear uncertainty instead of presenting front detection confidence as rear evidence, and retains **Replace with real back image**. The estimate remains editable and replaceable without changing the front. Review exports offer a technical-flat SVG, a white outline SVG without rib texture/stitches, and a construction overlay with normalized boundaries. Exports contain vector layers, not the source photograph; inferred back SVGs also identify their estimated status.

## Commands (local)

Website neck from a photo:

```bash
python scripts/collar/collar_from_photo.py path/to/neck-photo.png
```

Needs `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `.env`. Dev server exposes this as `POST /api/collar-from-photo`.
