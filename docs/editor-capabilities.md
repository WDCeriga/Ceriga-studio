# Artwork and shoulder editing additions

The four reference studies are left unchanged. New capabilities are available in the existing editor:

- Paint stains: editable vector splashes, smears and drips, with variation and droplet controls; ordinary splatter/drip brushes remain available under Draw & paint. Paint is separate from fabric abrasion.
- Selected drawing refinement: Gentle/Balanced/Flowing presets and an editable smoothing amount. Every preview derives from retained original stroke commands; restoration preserves current erased areas. Older pixel-only drawings are identified rather than pretending their paths can be edited.
- Pattern ink: choosing a repeat while a shape or text is selected fills that artwork. Dragging onto an artwork does the same. Shapes keep their independent outline. Plaid stripe widths and spacing remain editable. Asset Workspace does not resolve or display garment pattern targets.
- Outline finishes: solid, dashed, dotted and a two-colour double rim.
- Ink wear: direct access to cracked and chipped alpha-removal effects on text and shapes. These reveal fabric beneath ink, rather than damage the shirt.
- Focus artwork: temporary isolation and camera fit for the selected print. It edits the same garment asset, whereas Asset Workspace creates reusable standalone designs. Returning restores the garment view without changing the asset.
- Shoulder construction: set-in, raglan, saddle and drop shoulder in Fit & Measurements. Alternate cuts repartition actual body/sleeve surfaces and retain their material IDs, colours and garment pattern targets. Sleeve ownership stops at the underarm and resumes only on the original lower sleeve, avoiding coloured torso wedges. The old set-in source ink is not reused as the new seam.

Construction references reviewed: [Jalie Nico front/back technical drawings](https://jalie.com/products/nico-raglan-tees-sewing-pattern), [raglan sleeve drafting](https://pattern-making.com/raglan-sleeve-draft/), [Closet Core raglan adjustments](https://blog.closetcorepatterns.com/clare-sewalong-raglan-sleeve-fit-adjustments/), [Brooklyn Tweed saddle shoulder construction](https://brooklyntweed.com/products/saddler), [Tilly and the Buttons shoulder placement](https://tillyandthebuttons.com/blogs/sewing/how-to-do-narrow-wide-shoulder-adjustment), and the user's supplied armhole chart. These inform construction types; the displayed SVGs are original parameterised geometry, not copied reference artwork.

Checks: `node scripts/verify-editor-capabilities.mjs`; browser checks of a pattern-filled circle with no garment present, original drawing restoration controls, focus/return, and construction combinations. Local QA fixtures under work/ are not product source.
