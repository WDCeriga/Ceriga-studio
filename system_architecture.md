# Asset Architecture

## Hood bundles

`src/app/data/hoodBundles.ts` is the hood metadata registry. It does not generate,
modify or install geometry. `garmentSvgCatalog.ts` uses it for built-in hood
discovery, labels, fit compatibility, same-style fit switching and registration
reference selection. Existing renderer output remains unchanged.

| Stable bundle ID | Style ID | Initial variants |
| --- | --- | --- |
| `ceriga/hood/regular` | `regular` | Existing Regular front SVGs for all five fits |
| `ceriga/hood/scuba` | `scuba` | Existing Scuba front SVGs for all five fits |
| `ceriga/hood/oversized-deep` | `oversized-deep` | Reference-v3 front SVGs for Slim, Regular, Boxy, Cropped and Baggy |

Schema v2 separates family from front construction. `HoodSelection` is the
derived selection contract (the registry's stable `styleId` supplies `hoodStyle`):

```ts
type HoodSelection = {
	hoodStyle: 'regular' | 'oversized-deep' | 'scuba' | `custom:${string}`;
	frontConstruction: 'standard' | 'crossover';
};
```

| Hood Type | Front Construction | Current availability |
| --- | --- | --- |
| Regular Hood | Standard / Crossover | Both enabled across all five fits, with distinct SVGs |
| Oversized / Deep Hood | Standard / Crossover | Both enabled across all five fits, with distinct SVGs |
| Scuba Hood | Standard | Existing construction only; no crossover option |

The UI groups assets by family, then displays a separate Front Construction
segmented control. Availability is fit-specific and requires a selectable variant
and a catalog asset. Construction changes select an actual asset ID, not an SVG
overlay or extra linework. Regular/Deep family changes retain construction;
missing combinations disable that family choice rather than selecting Standard.
Choosing Scuba explicitly selects its only construction, Standard. If a saved
Crossover has no asset for a requested fit, retain its ID rather than silently
substituting Standard; that construction option is unavailable for the new fit.

Every variant declares `frontConstruction` and `approval`. Existing installed
standard assets use `approval: { status: 'existing' }` to preserve their current
availability without asserting new approval. New assets use `pending` until
approved, then `{ status: 'approved', referenceIds: [...] }`. Crossover requires
reference-linked approval; `existing` cannot enable it. Compatibility, approval,
fit and exact construction are checked by resolvers. An unavailable crossover
request returns no asset, never a standard asset posing as crossover. Layer and
drawstring choices remain independent of front construction.

### Crossover reference and approval boundary

The user authorized building and enabling Crossover using `crossover.jfif`, the
FIRST technical reference, and clarified that each existing hood must stay the
same except for the crossover front. This authorization is recorded by the
reference-linked `approved` availability gate; it is not a claim of subsequent
visual sign-off. Scuba remains unchanged.

`scripts/collar/build_crossover_hoods.mjs <reference> --install` builds ten
distinct SVGs. It preserves original Bezier artwork, replaces covered lower
fabric and ink with ordered overlapping panels, and retains Deep drawstrings.
The original crown and upper band are checked with a one-channel-level raster
rounding tolerance; the per-column lower silhouette must be identical. Standard
asset hashes must remain unchanged. No new body or sleeve geometry is authored.

Proofs and source hashes live in `studio-hoodie/hoods/crossover-reference-v1`:
isolated/technical SVGs, source overlay, family comparisons, five-fit assemblies,
builder screenshots and `construction.json`. Live IDs use `Regular Crossover Hood`
and `Deep Crossover Hood`, with the existing fit suffix convention. Crossover
uses its family's Standard transform reference because the outer bounds are
unchanged, preserving selection, scaling and Reset origins.

Each variant has a stable ID and option ID, fit, construction/drawstring states,
front asset ID, nullable future back asset and socket ID, front neckline reference,
compatible body constructions, and registration metadata. The placement remains
baked into the 2048-square asset, with identity as the default user transform.
Socket profiles are `null`, not guessed measurements. Existing Scuba variants
retain the archived Scuba pivot; Regular retains its own pivot. No rear asset or
rear attachment is claimed. The `oversized` fit type reserves a future contract;
it is not an enabled fit and is never aliased to Boxy or Baggy.

The schema recognizes single-layer/double-layer and drawstring/no-drawstring.
`constructionOptions` is the vocabulary, not a list of available geometry.
Existing variants are `as-authored`: no alternate construction has been certified.
`getHoodBundleConstructionVariant` returns only an exact authored combination,
otherwise `undefined`. Placeholders have no variants and never appear in the
picker. New geometry must come from user-supplied references; archived experiments
and the staged Regular reference drawings are not automatically installed.

Persistence remains `tshirtAssetSelection.Hood = <existing asset ID>`; bundle
metadata is derived, not copied into saved state. Compatible fit changes resolve
by stable bundle/option/front-construction identity. Hidden registered hood IDs keep their legacy
resolution path. There is no state migration or history change. Color stays in
`partColors.hood`, with the original fabric tint and construction ink behavior.
Transforms stay in `tshirtLayerTransforms.hood`; Reset removes that entry through
the existing Builder handler. Selection, color and other part transforms survive.

Future custom hood packages can use `custom:<id>` style IDs, user-reference
provenance and the same variant contract after validation/registration. This is a
schema extension point only, not upload support, an upload endpoint or dynamic
installation. Future back rendering also requires explicit view wiring and
validated rear sockets; front assets are not reused as rear geometry.

Run `node scripts/collar/test_hood_bundles.mjs` for the pinned pre-bundle rendering
baseline (160 fit/construction transitions), saved-ID round trips, socket metadata
and unavailable-option checks. Add `--browser` to start an ephemeral Vite server
and test actual hood edits, Reset, undo/redo and fit switching in Edge. The test
closes its server/browser. Saved-state checks cover serialization and resolution,
not authenticated cloud storage. Update the baseline only for approved changes
to existing geometry/rendering behavior, never merely to make a failure pass.

## Hood registration and selection

The Neck / Collar stage exposes Regular Hood, Oversized / Deep Hood and Scuba Hood for all five fits. Funnel Hybrid Hood and the old Oversized Hood remain archived. Existing Regular and Scuba IDs and geometry remain unchanged. The catalog preserves bundle/option identity across fit changes.

### Reference-derived Oversized / Deep Hood

The approved `deep-reference-v3/shape.json` records the user-supplied `newneck.png`
reference and the unchanged silhouette/opening. `register_deep_shape.mjs` applies
uniform scale and translation to the hood and cords, with only a local neckline
contact strip and body-exclusion mask. Original Bezier paths are retained, not
re-traced. Two fabric/ink groups use the established inverted canvas coordinates;
SVG definitions are excluded from transform bounds and the contact clip bounds
are respected. Default user transforms remain identity.

The five installed `Oversized Deep Hood` assets are the `reference-v3` option in
`oversized-deep`, with authored drawstrings and unspecified layer construction.
Only set-in bodies are geometry-certified; raglan/dropped-shoulder and rear views
are not claimed. No body, sleeve, cuff, hem, pocket, Regular or Scuba asset changed.

Run `node scripts/collar/register_deep_shape.mjs` for geometric checks and proofs.
Before initial installation, `node scripts/collar/test_hood_bundles.mjs --staged-deep --browser`
exposes candidates through a test-only Vite overlay. The resulting hash report
gates `register_deep_shape.mjs --install`, which refuses existing targets.
After installation, `test_hood_bundles.mjs --browser` verifies the live catalog,
all 25 Deep fit transitions, per-fit Reset/undo/redo, visible transform bounds,
unchanged other parts, and 160 pinned legacy snapshots. Reports and the five-fit
review are retained in `src/assets/studio-hoodie/hoods/deep-reference-v3`.

### Current high-neck Scuba

The original source is `src/assets/studio-hoodie/hoods/high-neck-scuba-20260922/scuba/source.png`. The pale zip-hoodie photo informs construction only; no reference pixels or garment silhouette are traced. An original symmetric Canvas raster defines a volumetric paneled crown, recessed curved opening with binding, raised chin rim and tapered collar. No drawstrings, zipper, branding, shading or texture are added. All SVG path geometry is generated by Potrace.

`bodyRelativeScuba` sizes the crown from each fit's chest; `necklineAttachment: true` retains the actual neckline span instead of creating shoulder extensions. Traced crown widths are 640/572/614/551/472px and attachment spans 414/386/390/423/396px for Boxy/Cropped/Baggy/Regular/Slim. Heights match Regular Hood. The lower raster mapping uses the source collar attachment span, not the crown extrema; mapping those extrema to the neckline creates vertical slivers. The upper 68% preserves the opening shape. Separate fabric and pure-black ink groups retain hood-only colouring.

Conversion: binary 2048px source, contrast 1.35, luminance >=246 transparent and <=120 opaque with a linear ramp; alpha masks upsampled 3x and thresholded at 128. Node Potrace uses mask negation plus `blackOnWhite: true` for the requested ink polarity, rather than Python's Bitmap inversion call. Settings are minority turn policy, turdsize 4, alphamax 1 and opticurve. Both groups have even-odd fills and a source-sized viewBox. Regular Hood supplies line-quality and attachment benchmarks only.

Generate with `node scripts/collar/create_hood_collection.mjs --high-neck-scuba`; validate installed assets with `--high-neck-scuba --validate --live`. Publish with `node scripts/collar/publish_rebuilt_hoods.mjs --high-neck-scuba`. Publication supports new files, backs up existing targets, rolls back on validation failure and checks unrelated asset hashes. This publication added five Scuba files and preserved all 70 unrelated hoodie SVGs. Never use `--collection` to publish this design.

`node scripts/collar/check_scuba_browser.mjs --variant=scuba` checks exactly two hood choices, 75 selection/fit transitions, all 15 fit/sleeve combinations, eight separate layers, hood-only colour, fixed black ink, serialized SVG rendering and mobile overflow. Full-garment monochrome proofs are in `.tmp-scuba-proof/browser/all-constructions.png`; the timestamped report is `results-scuba.json` in that directory. Asset checks, this browser check, both sleeve regression suites and production build passed on 2026-09-22. Build completed in 9.18s with the existing large-chunk warning. Authenticated saved-project reload and real PDF export remain unverified.

### Archived variant pipeline

The following older source assets, scripts and validation notes are development history, not current acceptance checks. Do not republish these designs unless explicitly requested. References to current Scuba within this historical section describe the retired structured source, not the high-neck source above.

Scuba uses `src/assets/studio-hoodie/hoods/structured-scuba-20260922/scuba/source.png`. Its Canvas drawing follows the user-supplied blue hoodie illustration: rounded dome, oval recessed opening with double binding, crown and lining seams, and a curved high collar with shoulder flare. The drawing is downsampled to a binary 2048px raster before Potrace tracing. Funnel Hybrid and Oversized retain `src/assets/studio-hoodie/hoods/cohesive-collection-20260922/<variant>/source.png`. Regular Hood is the visual style reference, not a source of copied crown geometry. Never hand-author SVG path data. The cohesive collection's Scuba and earlier photo-scuba, original-scuba, original-funnel, refined-funnel and original-oversized sources are archival.

New assets must match the existing hoodies in line thickness, proportions, construction detail, quality and overall aesthetics. Structured Scuba has a shaped upright crown, recessed curved opening, raised front collar and tapered sides with no drawstrings. Funnel Hybrid has a curved funnel lip; Oversized has a broader crown and deeper opening. `outlineWidth: 4`, `traceSmoothing: 0.5` and `matchRegularInk: true` control the fitted raster. Scuba additionally uses `preserveSideContour: true` to bypass the older column-fill workaround and `singleAttachmentLine: true` to suppress inner attachment ink while retaining the terminal seam pixels. Its fixed ink is pure `#000000`. The validator compares lower-quartile and median short horizontal ink runs against Regular Hood within 1px; this is a line-weight proxy and does not replace visual proof review.

Scuba uses `bodyRelativeScuba: true`: chest width is measured at 25% of the Body's vertical extent. Crown targets are 66/68/66/67/71% of chest width for boxy/cropped/baggy/regular/slim, yielding traced widths of 638/571/612/549/472px. The user explicitly prioritized fuller visual proportions over the earlier 30-38% guideline. Attachment spans are the greater of 112% of the existing neckline span or 96% of the crown target, yielding 612/547/588/527/452px. A common raster transform preserves the crown and opening through the upper 68% of the hood; only the lower collar is warped vertically and blended in width with smoothstep interpolation toward the attachment. Height is unchanged. Extended attachment columns are seated against the unchanged Body shoulder contour after resampling. Validation checks chest-derived dimensions and shoulder continuity, permitting isolated partially covered antialias pixels but rejecting transparent or multi-pixel gaps. Publication checks every non-target hoodie SVG hash.

The white-key conversion applies contrast 1.35 and luminance thresholds 246 (transparent) and 120 (opaque), with a linear alpha ramp between them. Alpha-derived masks are upsampled 3x and thresholded at 128. Node Potrace uses explicit black-on-white polarity, turdsize 4, minority turn policy, alphamax 1 and opticurve. Both SVG groups use even-odd fills and a source-sized 2048px viewBox. Structured Scuba validation also checks binary source pixels, symmetry, keyed alpha polarity, pure-black SVG fills and registration flags. Monochrome and independently coloured full-garment proofs are retained per fit.

Scuba and Funnel Hybrid use `matchRegularHeight`, retaining crown-to-neckline heights of 540/574/535/560/573px for boxy/cropped/baggy/regular/slim. Oversized uses `regularHeightScale: 1.18`, capped to a 24px canvas margin, and `crownWidthScale: 1.2`, tapering back to the unchanged neckline; its heights are 637/670/631/628/638px. Separate fabric and fixed-ink groups preserve independent recolouring. Regular Hood and body geometry remain unchanged, and all existing live filenames/IDs stay stable.

Run `node scripts/collar/create_hood_collection.mjs --structured-scuba` to generate and validate current Scuba candidates. Use `--structured-scuba --validate` to check without rebuilding. Publish only the five Scuba SVGs with `node scripts/collar/publish_rebuilt_hoods.mjs --structured-scuba`; retired copies are backed up outside the asset tree. Verify with `node scripts/collar/create_hood_collection.mjs --structured-scuba --validate --live`. Funnel Hybrid and Oversized still use `create_hood_collection.mjs --variant=funnel-hood-hybrid` or `--variant=oversized`; append `--validate --live` to check their existing published candidates. Do not use `publish_rebuilt_hoods.mjs --collection`: it includes the retired Scuba design. Source/provenance hashes, fit registration and rendered proofs remain beside the rasters.

With the local dev server running, `node scripts/collar/check_scuba_browser.mjs` checks all three alternatives across all five fits, hood-only colouring and availability of all four hood options in headless Edge. Add `--variant=scuba` for the focused five-fit check, including fixed-black Scuba ink. Successful runs write a timestamped completion report under `.tmp-scuba-proof/browser/results-<variant>.json`. `CERIGA_BASE_URL` optionally overrides the default localhost server URL.

## Hoodie fit packs

The hoodie builder uses five raster-first fit packs: `boxy`, `cropped`, `baggy`, `regular`, and `slim`.

- Boxy generation artifacts live in `src/assets/studio-hoodie/`.
- Other fit artifacts live in `src/assets/studio-hoodie/fits/<fit>/`.
- Live builder SVGs live in `src/assets/hoodie-test/<part>/`.
- Boxy uses untagged filenames; other fits use `Part (<fit>).svg`.
- Every baseline Set-in fit must export exactly eight parts: Body, Hood, Kangaroo pocket, Left sleeve, Right sleeve, Left cuff, Right cuff, and Rib hem.

`scripts/collar/pack_hoodie.mjs` keys the white background, traces construction ink with Potrace, derives registered fabric masks, validates part completeness and cuff symmetry, and writes `mockup.json`.

Fabric masks form an exact exclusive partition of the non-ink garment interior. A multi-source region assignment gives every fillable pixel to exactly one component, while construction-line pixels remain reserved for the fixed black outline layer. Generated packs must report zero missing, overlapping, and overflowing fill pixels; do not reintroduce per-part dilation or colour construction-line pixels.

`scripts/collar/export_hoodie_test.mjs <fit>` publishes generated parts to the live builder directories.

`scripts/collar/validate_hoodie_pack.mjs` verifies all five packs have eight editable SVGs. Each SVG contains:

1. A first `#000000` fabric group recoloured by `tintPotraceSvg`.
2. A second `#141414` construction-ink group that remains fixed.

Both groups use even-odd fills and the same 2048×2048 viewBox so parts remain registered.

The shared hoodie design language requires an upright hood continuously joined to the neckline, matching rib-knit cuff and waistband construction, and fit-specific silhouette changes without changing seam or line-art style.

## Hoodie sleeve construction

Sleeves exposes Set-in Sleeve (default), Raglan Sleeve and Dropped Shoulder Sleeve for all five hoodie fits. `garmentSvgCatalog.ts` uses the Left sleeve selection to link Body, Left sleeve and Right sleeve atomically within the active fit. Fit changes preserve construction; switching back restores the original Set-in assets. Both Regular Hood and Scuba Hood work with all three constructions.

`scripts/collar/pack_raglan.mjs` rasterizes the original upper panels, removes internal armhole ink while protecting the exterior contour, and repartitions the shoulders along mirrored curved neckline-to-underarm seams. Potrace generates the replacement upper SVG paths; coordinate registration is mechanical, not hand-authored path geometry. Clipped original lower vectors retain the existing silhouette, sleeve length and construction details. Cuffs remain separate original assets. The reference photo informs construction only.

All three constructions render eight layers: Body, both sleeves, both cuffs, Hood, Kangaroo pocket and Rib hem. Cuffs are never embedded in sleeve assets. Hem and cuff controls remain visible, independently selectable and independently colourable. Hoodie body/sleeve selection and movement use path hit targets rather than rectangular targets that intercept adjacent panels. Sleeve rotation handles sit outside the arms so they do not cover the cuffs.

Dropped Shoulder uses the same raster-first generator with `--construction=dropped`. The body owns the former upper sleeve area above mirrored, gently curved upper-arm seams; the sleeve owns the area below. Drop is proportional to original body height: Slim 0.06, Regular 0.08, Boxy 0.10, Cropped 0.11 and Baggy 0.12. These are visual proportions, not calibrated inches. Original body pixels remain body-owned, and the original silhouette, total arm length, lower vectors, hood, pocket, hem and separate cuffs are preserved.

Run `node scripts/collar/pack_raglan.mjs --construction=dropped --publish` to generate, validate and publish the fifteen additional Body/Left sleeve/Right sleeve SVGs. Staged masks, SVGs, proofs and reports live in `src/assets/studio-hoodie/dropped-shoulder/<fit>/`. Validation additionally requires more than 1,000 original sleeve pixels transferred to the body and zero original body pixels lost to sleeves.

Run `node scripts/collar/pack_raglan.mjs` to generate and validate staged assets in `src/assets/studio-hoodie/raglan/<fit>/`; add `--fit=slim` for one fit or `--publish` to publish the three replacement parts per fit. Original assets are not overwritten. Validation requires zero missing, overlapping or overflowing partition pixels, symmetric seams, unchanged lower rendered pixels, and no interior holes below alpha 128. Isolated antialias pixels below alpha 200 are reported separately. Raster masks, registration, reports and full-garment proofs remain beside staged SVGs.

With the dev server running, `node scripts/collar/check_raglan_browser.mjs` checks all 25 fit transitions, independent sleeve/hem/cuff colouring, 40 panel clicks including separate cuffs, Set-in restoration, serialized selection/SVG rendering and mobile overflow. Results are written to `.tmp-raglan-proof/browser/results.json`. The VS Code task `Validate Raglan and build` runs this check followed by the production build. Authenticated saved-project reload is not covered; the existing tech-pack download is a placeholder, so PDF export is not verified.

Add `--construction=dropped` to the browser check for all 25 Dropped Shoulder fit transitions and 60 panel clicks, including extended shoulder body ownership, independent cuffs and restored Set-in shoulder ownership. Results go to `.tmp-dropped-shoulder-proof/browser/results.json`. The `Validate Dropped Shoulder and build` task runs both construction suites and the production build. Both suites and the build passed on 2026-09-22; the existing large-chunk build warning remains.
