# Builder redesign milestone 1 audit

Scope: shared shell, full navigation/scaffolding, Fit & Measurements. Styling reference: Hem & Cuffs. Structural reference: final Fit & Measurements screenshot. Existing garment renderer and project state remain authoritative.

## Existing functionality to preserve
- Actual configured fit choices and linked garment asset selection; existing measurement overrides survive fit changes.
- Editable per-measurement XS/S/M/L/XL/XXL values with fit presets.
- cm/in display conversion; stored values remain centimetres.
- Shared selected measurement highlighting between rows and garment callouts.
- Existing measurement guide geometry, garment rendering, front/back and preview zoom.
- Uploaded/custom garment asset dimensions via CustomAssetMeasurements and editAssetDimension.
- Measurement notes; imported garment-specific workflow.
- Undo/redo, keyboard shortcuts, project state, local/cloud saves and version snapshots/history.
- Existing reference attachment flow, accurately described as reference attachments rather than parsed measurement imports.

## Reuse
Builder.tsx state, handlers, persistence and history; MeasurementsStep data and callbacks; MeasurementPreview; BuilderGarmentPreview/TshirtSvgPreview; measurementGuides/measurementGeometry; measurementPreviewSizing; measurements.ts unit conversion; CustomAssetMeasurements; ImportedSizeTable and imported garment workflows where applicable.

## Existing features absent from references
Preserve the full six-size editing table in Advanced sizing, Custom fit where supported, asset dimensions in a dedicated accordion/tool, measurement notes, imported garment flows, version restore and keyboard shortcuts. Retain real measurement names and letter mappings instead of replacing them with screenshot coordinates.

## UI without matching implemented business logic
Selectable base size and size range, Standard/Cropped length as a measurement mode, grading presets/steps, measurement tolerances and confirmation status, arbitrary new points of measure, parsed Excel/CSV/PDF/photo size-chart import, recommendations, sample-readiness evaluation and comments. Use disabled/upcoming controls unless implemented on the existing state model. Do not treat a filename upload as a completed import.

## Structure
BuilderShell owns stable grid regions. BuilderTopBar renders breadcrumb, canvas colour, history and real save/review actions. BuilderSidebar renders eight sections and contextual tools, collapse toggle and bottom reference action. BuilderWorkspace keeps the existing garment subtree mounted while section changes update inspector/context tools. BuilderInspector provides shared title/helper, dividers and progressive disclosure. FitMeasurementsInspector adapts existing callbacks rather than duplicating persistence or coordinate logic.

## CSS
src/app/components/builder/shell/builder-shell.css: shared topbar/nav/inspector sizes, neutral surfaces, typography, dividers, selected states, red primary action, orange warnings, radii, row heights and spacing. Responsive rules for 1920x1080, 1440x900, 1366x768, 1280x800. No global UI scaling. Reduced-motion-aware hover, accordion and inspector transitions. Feature styles stay beneath the shared shell tokens.

## Review gate
Verify fit/measurement edits, units, front/back, zoom, undo/redo/save and preservation of garment node/zoom on section navigation. Capture 1440x900 and 1366x768, expanded/collapsed nav, expanded measurement, unfinished-section placeholder and section transition. Do not roll out other redesigned features or commit before review.
