# Hoodie Stitching: Visual Review Stage

## Donor Audit

The T-shirt donor is `Ceriga-studio-Tshirt-Asset-Builder`.
Only its stitching model, pattern sampling and control concepts were ported.
The T-shirt renderer was not copied.

| Donor piece | Decision |
| --- | --- |
| Seven stitch styles, three thread weights | Reused in `src/app/data/hoodieStitching.ts`. |
| SVG path sampling and stitch pattern generation | Reused independently of garment geometry. |
| Global/region controls and colour picker | Adapted; regions inherit global values until overridden. |
| Stitch-layer raster measurement and hem masks | Not reusable: they classify T-shirt-specific marks and hems. |
| T-shirt regional renderer and hem finish logic | Not reused. Hoodie overlays belong to existing hoodie panels. |
| Builder history and persistence | Existing hoodie state pipeline retained; `hoodieStitching` is optional JSON state. |

The live hoodie pack has fabric and baked construction ink, not an independent
stitch layer. The old hoodie stitching assets are not registered to this pack.

## Hoodie-Specific Mapping

| Region | Current review-stage data | Still needs approval |
| --- | --- | --- |
| Hood opening | Separate authored Regular, Deep and Scuba curves; Standard/Crossover dispatch per fit | Opening inset, fold intersections and overlap endpoints. |
| Hood centre/crown | Regular vertical centre; Deep transverse crown band; Scuba twin crown seams | Continuity and inset relative to baked construction ink. |
| Hood attachment | Authored per-fit neckline curves on the body | Visible ownership/occlusion at the socket and crossover base. |
| Shoulders | Authored non-raglan shoulder curves per fit | Endpoint placement for each fit. Raglan has no separate shoulder row. |
| Sleeve attachment | Per-fit set-in curves; registered raglan and dropped-shoulder joins | Join endpoints near underarm folds. |
| Sleeve seams | Authored per-fit inner sleeve curves | Visible underarm extent and fold clearance. |
| Cuffs and waistband | Authored attachment curves on the sleeve/body fabric side | Waistband stitches are occluded by the kangaroo pocket; no rows are forced through rib ink. |
| Kangaroo pocket | Authored top, curved entries, lower sides and bottom per fit | Corner joins and inset near existing entry stitches. |
| Future zip | No active geometry | Remains unavailable until a real zip seam is supplied. |

`hoodieAuthoredSeams.ts` owns all seam placement in the source 2048-coordinate
frame. `hoodieSeamGeometry.ts` only dispatches those mappings and rasterizes
fabric/ink clearance masks. Raster contours and ink runs no longer select paths.
Back-view seam geometry is not authored here.

### Coordinate Provenance

- Regular hood landmarks and body/pocket/trim Beziers were authored against the
  five live fit SVGs using coordinate-grid source sheets, not a shared silhouette.
- Deep opening and transverse crown curves use the reference source frame and
  `deep-reference-v3/registration.json` for the installed uniform transform.
- Crossover overlap curves use each family/fit entry in
  `crossover-reference-v1/construction.json`. The rear row ends at the front
  overlap; the Standard lower opening is cut off at the crossover boundary.
- Scuba opening/lip and twin crown curves use the Boxy source sheet and the exact
  per-fit transforms from `supplied-scuba-20260925/replacement.json`.
- Raglan and dropped-shoulder joins use their existing fit registration points
  and construction curvature. Set-in joins remain separate per-fit mappings.

These are authored review-stage mappings, not production-approved geometry.
The clearance mask can still interrupt rows near baked folds/entry ink. Review
those interruptions and join endpoints in the supplied high-contrast proofs.

## Rendering and State

- Source SVGs, registration, transforms and panel order are unchanged.
- Topstitching is inset onto fabric; a clearance mask excludes original ink and
  transparent areas. It does not erase or recolour baked construction lines.
- Visibility and No Stitching hide the new stitches only.
- Existing drafts render unchanged until stitching is enabled or edited.
- Reset removes stitching settings, restoring that original appearance.
- Regional values are sparse overrides. Clearing a value restores inheritance;
  clearing the region removes the override altogether.
- Both builder preview instances and saved-project previews receive the field.
- No changes to wash/fade, trims, labels, packaging, measurements or uploads.

## Verification and Review

Run the VS Code task **Validate hoodie stitching**, or with Node 24:

```sh
node scripts/collar/test_hoodie_stitching.mjs
```

Passed: 41 geometry cases including all five fits and 25 supported hood/front
construction combinations, styles, colour/weight, inheritance, visibility,
Reset, Undo/Redo, source SVG hash preservation and desktop/mobile control bounds.
The production Vite build passed. Regular, Deep Crossover and Scuba previews were
inspected with contrasting thread; placement remains pending visual approval.

The regression suite also requires five distinct hood mappings per fit,
different set-in/raglan/dropped joins, no separate raglan shoulder row, authored
panel dispatch and two transverse (not vertical) Deep crown segments.

Run **Capture authored hoodie seam review** to regenerate 45 yellow-thread
close-ups and five-fit comparison sheets in
`.tmp-hoodie-assembly/stitching-review/`. The nine views cover Regular Standard,
Regular Crossover, Deep Standard, Deep Crossover, Scuba, set-in, raglan, pocket,
and waistband/cuffs. Open `/scripts/collar/stitching-review.html` on the Vite
server for the Boxy review, or add `?fit=slim`, `regular`, `cropped` or `baggy`.
Add `&grid` to inspect source-coordinate guides without the overlay.

JSON settings round-trip is tested. Actual authenticated cloud save/reload is
not verified in the local unauthenticated preview; the existing project-state
save and hydration path is used without adding a separate persistence store.

Stop at visual review. Do not treat the authored mapping as approved for production
or regenerate/install garment artwork from it.