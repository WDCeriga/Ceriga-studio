# Four new editable reference studies

The four supplied garment photographs are kept only as reference images. Their print compositions are rebuilt from native text, editable vector contours, repeat fills and fabric-wear layers. No new study uses image extraction or a flattened copy of the reference print.

- Berry sport club: separate coloured serif letters, italic caption, continuous plaid sleeve fills, waffle body, pink rib collar, raglan construction, shorter body and distressed hem.
- Raspberry archive: arched lettering, stencil badges, cream worn typography, local holes with frayed fibres, slate body and darker sleeves/inner fabric.
- Allure social: custom party silhouettes, pink capsule/badge shapes, layered lettering, editable blue tribal sleeve motifs, contrast hems and collar.
- Varsity 75: manually constructed athletic number contours, fine hatch ink, local print wear, editable sleeve stripes and script, pink collar inset and contrast raglan stitching, rib cuffs and cropped sweatshirt body.

## Reusable improvements

- Extract print from image now offers colour-preserving edge-connected background removal. It samples the dominant border colour or uses a chosen background colour, softens/unmattes edges, preserves enclosed matching colours, and retains the original source. It targets flat/similar backdrops, not semantic segmentation of arbitrary busy photographs. Processing is local through the existing image-filter worker.
- Pattern ink includes a fine athletic hatch with editable palette, angle and density up to 160 repeats.
- Party silhouette and tribal sigil are available in Shapes & paths. Their paths remain editable.
- Two-anchor closed cubic contours can retain their fill; straight degenerate contours remain unfillable.
- Body length in Fit & Measurements shortens only the torso and repositions the hem, leaving sleeves, collar and shoulder registration intact. Percentage shortening is a visual pattern change; finished measurements still need specifying.
- Hem & cuffs offers Distressed hem. Detailed controls live in Wear & texture → Hem distressing, with light/worn/torn presets, unevenness, tear depth, fibres and deterministic layout variation. The hem links directly to those controls, and both places edit the same saved hem settings. The rendered body and hem are physically cut to the uneven edge; original straight hem ink is removed and loose fibres are rendered separately. This is distinct from print distressing and floating wear marks.
- Single wear asset detail percentages are normalised to the wear engine's units.

The gallery opens fresh editable local drafts and exports source JSON. Earlier studies and their extracted source graphics are retained. The reference recreations approximate flat garment construction and typography; they do not duplicate the photographs' lighting or exact manufacturing dimensions.

Verification: scripts/verify-reference-studies.mjs, verify-print-study-tools.mjs, verify-shape-studio.mjs, verify-wear-rendering.mjs, existing construction checks, production build and live browser checks.

## Knit hem reference research
The distressed hem uses shallow ragged loss, horizontal broken-course openings, surviving yarn bridges, a softly rolled edge and a few hanging loops. It avoids repeated deep semicircular cuts. Openings remove actual fabric geometry; neutral translucent rims and fibres preserve the garment colour. Construction ink is suppressed locally so abrasion does not acquire a heavy seam outline.

Sources: CottonWorks, Single & Double Knits (https://cottonworks.com/learning-hub/knitting/single-and-double-knits/) describes jersey curling and running at cut edges. Luu Thi Tuoi et al., Research the Curling Behavior of Single Jersey Weft-Knitted Fabrics (2020), https://vjol.info.vn/dhcnhn/en/article/view/49066/ investigates edge curling and loop density. The supplied waffle garment photograph guides the clustered horizontal damage and hanging loops; this is a visual approximation, not a simulation of yarn failure.
