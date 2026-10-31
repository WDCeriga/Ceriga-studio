# Labels and packaging continuation

User brief: complete stages 1–6 using the existing shared surface engine, CSS and components. The amendment takes precedence: labels/tag faces have no safeInset or safe-zone guides; fills reach the cut outline; padding affects content only; border/stitching is a separate top decoration with adjustable inset (default 1.5 mm, including 0), and can be off. New stacked labels default edge-to-edge; old designs retain their appearance. Custom outlines follow the same rules. Fold risks are checks; Flat retains fold hatching. Packaging keeps existing optional print-safe guides, off by default.

## Audit
- Shared Surface/ArtworkDocument, precision SVG migration, native editor, SVG/PDF support and frozen regression fixtures already exist.
- Label sections have appearance and linked text frames, but use legacy bespoke controls. Insets currently mix content layout, clipping and border geometry.
- No label safe-zone warning is currently implemented; safeInset is stored from marginMm on migrated surfaces and must be removed from label/tag metadata without moving content. Packaging metadata stays intact.
- Border and attachment stitching currently precede or sit inside content. New decoration semantics must preserve legacy fixtures through versioned opt-in migration.

## Ordered stages
1. Label frames, common add/layers flow, named colours, stacking/free layout, edge/background/fold and border rules. Run frozen fixtures and report.
2. Custom outline upload/draw/edit/library and construction/cut capabilities; same amendment rules. Run fixtures and report.
3. Packaging Flat editing, compact panels, common tools/inspector, materials and dielines. Run fixtures and report.
4. Linked confirmed data, per-size variants and target market. Run fixtures and report.
5. Production checks with Show me, replacing label safe zones with fold risk. Run fixtures and report.
6. Components, review specifications and native production outputs. Run fixtures and report.

Stop and ask only on a failing frozen fixture or a lossless migration obstacle, as requested. Do not alter baseline SVGs. Preserve all uncommitted logo/camera fixes.

## Preceding fixes verified
- Logo: collapsed closed contours no longer disable the connected colour fill; worker filters degenerate contours; multi-colour preview uses all visible regions. Exact supplied image verified in browser; connected-colour and existing vector suites pass.
- Artwork camera: class/data camera changes, transitions, replacement, zoom and missing-camera reset are observed without starving updates. Real builder repeated toggles, all four fits and section switches preserve registration; browser harness added. Production compilation and surface prechecks passed.

## Stability and consistency checkpoint — 31 October 2026
- Paused feature expansion to fix the unresponsive Labels page. Resolving linked colours created new section arrays on each render, repeatedly triggering font loading and another render. Memoised colour resolution and a stable font-dependency signature stop the loop. Added a browser regression harness.
- Unchanged artwork/colourways preserve object identity; vector graphic and source-signature caching avoid repeated work. Document comparisons walk shared branches instead of serialising images/vectors. Undo snapshots are batched per pointer gesture. Autosaves replace obsolete queued requests while preserving manual saves and write order.
- Garment/artwork share one camera layer; browser checks cover every transition frame, repeated close-ups, camera replacement, zoom, all four fits and navigation.
- Labels use a compact toolbar without Add/zoom overlap. Layout segments, switches, visibility controls and shared label/packaging field/row/colour styles have been aligned. Labels and packaging use the artwork ink picker; fabric and panelling retain their material picker. Colour popovers sit above canvas chrome and dismiss on captured outside clicks.
- Browser checks passed label editing and autosave/reload, label render stability, builder navigation, packaging tools/ink picker, and tablet/mobile page width. Full frozen surface checks passed 128 fixtures with zero failures (121 unchanged and 7 documented legacy fixes).
- This is a user-requested push checkpoint. Stages 1–6 above are not all complete; the wider labels/packaging feature work and exhaustive styling audit remain follow-on work.

User requested an immediate stop and push. The final repeated build/check run was interrupted; the earlier production build and frozen checks passed. No further styling work was performed after that stop request.
