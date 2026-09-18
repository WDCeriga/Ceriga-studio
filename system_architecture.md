# Asset Architecture

## Scuba Hood registration and selection

The Neck / Collar stage exposes Regular Hood and Scuba Hood for all five fits. Existing `Hood*.svg` IDs and geometry remain unchanged for saved-design compatibility; user-facing labels say Regular Hood. Hood is user-selected rather than forced by fitParts, and changing fits preserves the chosen hood variant.

Scuba Hood and Funnel Hybrid Hood were rebuilt from NEW raster sources in `src/assets/studio-hoodie/hoods/rebuilt/`. The old variant SVGs and old `regular/mockup.json` masters must never be used as shape sources. `rebuild_hood_variants.mjs` keys and traces the new rasters, fits each neck attachment contour, and sizes each hood by neckline width (not old hood height). Separate fill and ink groups preserve independent recolouring. The Regular Hood and body geometry stay unchanged.

Run `node scripts/collar/rebuild_hood_variants.mjs` to generate staged candidates; `validate_rebuilt_hoods.mjs` checks them before `publish_rebuilt_hoods.mjs` replaces live files and retires old copies outside the asset tree. Compatibility generation commands also target this new pipeline. `validate_scuba_hoods.mjs` checks both live variants and all 50 fit transitions. With the local dev server running, `check_scuba_browser.mjs` checks all ten selections and hood-only colouring in headless Edge. Proofs and source prompts are retained under `hoods/rebuilt/`. Existing live filenames/IDs remain stable so saved designs load the replacement shapes.

## Hoodie fit packs

The hoodie builder uses five raster-first fit packs: `boxy`, `cropped`, `baggy`, `regular`, and `slim`.

- Boxy generation artifacts live in `src/assets/studio-hoodie/`.
- Other fit artifacts live in `src/assets/studio-hoodie/fits/<fit>/`.
- Live builder SVGs live in `src/assets/hoodie-test/<part>/`.
- Boxy uses untagged filenames; other fits use `Part (<fit>).svg`.
- Every fit must export exactly eight parts: Body, Hood, Kangaroo pocket, Left sleeve, Right sleeve, Left cuff, Right cuff, and Rib hem.

`scripts/collar/pack_hoodie.mjs` keys the white background, traces construction ink with Potrace, derives registered fabric masks, validates part completeness and cuff symmetry, and writes `mockup.json`.

Fabric masks form an exact exclusive partition of the non-ink garment interior. A multi-source region assignment gives every fillable pixel to exactly one component, while construction-line pixels remain reserved for the fixed black outline layer. Generated packs must report zero missing, overlapping, and overflowing fill pixels; do not reintroduce per-part dilation or colour construction-line pixels.

`scripts/collar/export_hoodie_test.mjs <fit>` publishes generated parts to the live builder directories.

`scripts/collar/validate_hoodie_pack.mjs` verifies all five packs have eight editable SVGs. Each SVG contains:

1. A first `#000000` fabric group recoloured by `tintPotraceSvg`.
2. A second `#141414` construction-ink group that remains fixed.

Both groups use even-odd fills and the same 2048×2048 viewBox so parts remain registered.

The shared hoodie design language requires an upright hood continuously joined to the neckline, matching rib-knit cuff and waistband construction, and fit-specific silhouette changes without changing seam or line-art style.
