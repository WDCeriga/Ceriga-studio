# Interface consistency

The UI uses shared tokens in `src/styles/ui-tokens.css`, the dark app palette in `ceriga-studio.css`, and the neutral light builder palette in `builder-palette.css`.

## Hierarchy and density

- Workspace page titles use `ceriga-page-title`: Inter, 26–30 px, weight 600, sentence case. Page descriptions use 14 px and a 1.65 line height.
- Use `InspectorHeading` for new builder headings instead of standalone title markup. Fit and Artwork Studio now share this component.
- Builder inspector titles use `--builder-ui-title`: 20 px on desktop and 16 px on mobile. Supporting text is 12 px; secondary captions are 10 px.
- Marketing display headings, numerical statistics, garment text, label artwork and packaging artwork keep their own typography. Do not apply a global descendant font rule to the canvas or SVGs.
- Controls normally use a 36 px height, with a 32 px compact variant. Data-heavy panels and canvas tools may use their existing compact sizes. Editable mobile text remains at least 16 px to prevent browser zoom.

## Surfaces and colour

- App cards use a 6 px corner radius; compact builder cards use 5 px; field controls use 4 px.
- Keep the dark app and light production workspace distinct. Shared builder portals use the light theme while the builder is mounted.
- Use the established red for primary app actions. Builder editing controls, alignment guides, borders and selection states use neutral grey. Preserve semantic warning, error, success, chart and artwork colours.
- Card selection should be shown through the border and a subtle neutral surface. Avoid adding lift animations and strong shadows to ordinary library cards.

## Layout

- Use the shared page gutter and section spacing tokens. Preserve narrower forms and wider operational tables where their content requires it.
- Builder inspector sections use the same title hierarchy, divider colour and field spacing. Larger functional diagrams may retain their own proportions.
- Pattern collections stay in two columns. Applied garment patterns use larger part previews in rows. Brush and shape libraries retain their established layouts.
- Canvas-side toolbars share one position and visual rhythm. Keep garment side controls and zoom controls consistent, while retaining section-specific actions.
- Visible focus states and reduced-motion support apply to shared controls. Portalled menus must use the same font and matching surface theme.

## Current scope

Wear & texture is excluded from the builder harmony selectors and was not redesigned in this pass. Preserve its current layout until its separate design pass.

Fit & Measurements retains its four-fit chooser, measurement order, size controls and grading workflow. Its cards, numeric fields and disclosures use the same styling rhythm as the other inspectors. Compact tables and phone measurement docks remain intentionally dense.
