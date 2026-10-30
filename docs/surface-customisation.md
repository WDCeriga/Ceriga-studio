# Shared design controls

Shapes uses the same two-column preview/card approach as the brush library. The artwork library has an optional search, collapsed save-selection form, named saved cards and a small create action. Learning examples are collapsed separately.

Label colour/text sections and packaging colour sections support seven vector shapes, corner radius, six repeat patterns with four colours, repeat scale/angle, solid/dashed/dotted outlines and opacity. Label sections can be duplicated and reordered. Text uses the clothing-font browser, italic/underline/uppercase, millimetre tracking and an editable outline. Packaging text additionally has font weight and recalculates its frame when styling changes. Existing label text blocks retain their saved appearance stacks and can use the new text options. Advanced controls are collapsed.

Optional appearance/text fields travel with the native elements, normalisation, copied sections, presets and independent tag faces. Existing designs keep their default rectangle/solid/100% appearance. Repeat fills remain vector SVG sources. SVG and raster PDF exports embed available clothing fonts so they do not rely on the running website; restricted uploaded fonts are not embedded.

Verify with `node scripts/verify-surface-customisation.mjs`. Temporary browser checks under `work/` are not product pages.
