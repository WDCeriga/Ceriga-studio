# Technical drawing first review

Open http://127.0.0.1:5174/scripts/technical-drawing-review.html.

This opt-in proof uses the production renderer with the same selected garment, material paths, detail placements and Panelling topology on both sides. The shared system is disabled by default pending visual review. No source SVG files were rewritten.

## Audit and strategy

- Body, sleeves and neck contain traced filled ink ribbons; changing stroke-width alone cannot normalize these. The proof retains exact material geometry, suppresses embedded ribbons, and draws shared vector boundaries from resolved material ownership and masks.
- Coincident construction boundaries are deduplicated; outer boundaries use the same system as the pocket, zip and committed Panelling seam.
- Primary 3.2, construction 2.5, stitching 1.5 and texture 0.75 use the common 2048-unit garment canvas. Detail widths compensate their source viewBox and local transforms. All scale with garment zoom; no non-scaling-stroke for normalized artwork.
- Render-only path simplification tolerance is 0.6 garment units, with shallow kink rounding bounded by another 0.3 units. Sharp structural corners remain sharp. Material paths, measurements and topology are unchanged.
- Existing nested SVG placements are retained for alignment. No rasterization or sharpening is introduced. Vector masks are resolved for boundary extraction. Intentional fabric texture remains separate. Fractional coordinate antialiasing is normal SVG rendering and is not removed by rounding the garment placement.
- Explicit stroked pocket/zip/stitch assets keep their paths and receive normalized widths. Broad custom-asset and remaining-neckline rollout is deferred until review.

## Validation

Production build passed; all 21 Panelling regression checks passed; git diff --check passed. Browser readiness/error checks passed for Slim, Regular, Boxy and Oversized at 50, 75, 100, 125 and 150 percent. Regular Crew and V-neck before/after screenshots were saved. Material path identity was checked for the Regular proof. These checks do not replace visual approval of every asset.

No commit or push. Original sleeve checkout untouched.
