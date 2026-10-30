# Artwork editing without preset placements

Artwork is edited directly on the garment or in Asset Workspace. There is no Placements tool, preset print-area assignment, area overlay, area focus, factory profile or area-specific production check. Each artwork object retains its own position, size, rotation, production method, colours and finish. The garment review lists the actual artwork rather than grouping it into preset areas.

Old saved drafts are read through `resolveBaseStudioArtwork`: production methods and physical units are copied from retired area metadata onto the artwork, including native group children. Positions, geometry and source colours stay unchanged. The normal state update discards retired area/component metadata after conversion. Colourway ink overrides continue to apply separately from source artwork. An explicitly empty artwork list never restores old prints.

Verification: `node scripts/verify-artwork-without-placements.mjs`, `node scripts/verify-artwork-production.mjs`, and `node scripts/verify-artwork-selection.mjs`.
