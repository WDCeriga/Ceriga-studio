# Artwork editor: reference-driven working studies

Open `/artwork-studies`. Each example opens a **new local builder draft**, rather than overwriting the current project. Download source retains all layer settings. Gallery thumbnails are captured from the live renderer; click one to inspect its live garment.

## Workflow ownership

- **Materials & Colour:** actual sleeve/body fabric, fabric construction/texture, base colour, trim colour. Both plaid examples assign cotton twill to the sleeves; their bodies remain jersey or rib. These are visual material approximations inferred from the references, not verified product compositions.
- **Patterns & repeats:** editable plaid/stripe geometry, palette, scale, repeat alignment and assignment to garment parts. A repeat does not replace the underlying assigned fabric.
- **Typography:** words, font, arc, outline/fill, spacing and worn printing. Bundled display fonts add collegiate, stencil and script starting points without changing UI fonts.
- **Artwork library:** import tiger/custom lettering graphics, isolate their ink, recolour and position them. User-supplied reference crops remain original source assets; edits are non-destructive.
- **Wear & texture:** local garment abrasion, distinct from ink distress on printed lettering.

## Added capabilities

1. **Pattern ink** in text/shape inspectors: create plaid, tartan, gingham or houndstooth inside an artwork's alpha; editable palette, density and angle. This reuses the procedural pattern generator and existing effect pipeline. No photo is required.
2. **Custom lettering:** convert straight/arched lettering from bundled or imported font files into editable cubic vector contours, including counters; edit with the existing point/handle editor; retain original words/font for restoration. Circle/vertical conversion is disabled. Complex shaping that cannot be preserved reports an error rather than producing broken lettering. Some Latin fallback shaping can differ in decorative joins.
3. **Extract print from image:** isolate light/dark ink or remove a background colour. Adjust threshold, edge softness, colour spread, background rejection and ink colour. Optional morphological cleanup closes tiny gaps/removes single-pixel fibres. The uploaded source is retained.
4. **Alpha correctness:** filter strength now blends alpha as well as RGB. Single-colour recolouring uses the filtered alpha, including inside groups, so it cannot restore an extracted photo background.
5. **Part targeting:** structural outline/stitch layers do not act as pattern surfaces; the mask uses closed fabric geometry instead of texture alpha. The whole-garment pattern action covers the full silhouette and can keep the collar plain.

## Four working studies

1. Navy/yellow long-sleeve varsity: editable whole-garment striped repeat with a plain collar and outlined arched Graduate lettering; isolated supplied tiger graphic; editable disc/number and procedural abrasion.
2. Plaid athletic: plaid sleeve repeats and shoulder areas, contrasting collar, live stencil number/headline/caption, script overlay and seeded ink distress.
3. Black rib/sleeve script: rib body and twill sleeves, editable plaid, stencil 83 with seeded distress, separated imported sleeve calligraphy.
4. Plaid badge: editable procedural plaid oval; separated supplied custom lettering, cream edging and dark ink. The exact original hand lettering remains a graphic rather than pretending it is a font.

These are close visual studies of prints. Existing garment silhouettes and shoulder-area overlays approximate the reference cuts; shoulder artwork areas are not a replacement for production seam construction. Logo source detail is limited by the supplied images.

## Research informing the separation of fabric, repeats and printed ink

- Cotton Incorporated explains that yarn dyeing precedes weaving/knitting and produces plaids, ginghams and woven stripes: https://www.cotton.org/pubs/cottoncounts/fieldtofabric/dyeing.cfm
- CottonWorks describes direct/indirect textile printing processes: https://cottonworks.com/learning-hub/printing/printing-process/
- CottonWorks distinguishes pigment, discharge and other cotton print techniques: https://cottonworks.com/learning-hub/printing/cotton-printing-types-and-techniques/
- Inkscape documents non-destructive clipping/masking/pattern fills: https://wiki.inkscape.org/wiki/Scratchpad_clippingtutorial
- Inkscape's guide distinguishes live text-on-path from converted editable lettering: https://inkscape-manuals.readthedocs.io/en/latest/putting-text-on-path.html

Validation: `node scripts/verify-print-study-tools.mjs`, `node scripts/verify-pattern-textiles.mjs`, `node scripts/verify-artwork-resolution.mjs`, production build, plus live editor tests of pattern ink, conversion/restoration and editable draft loading.
## Clothing fonts and licensing

Typography includes 19 bundled clothing display families, plus the three existing core families, with searchable previews and categories for varsity, condensed, stencil, blackletter, script, hand drawn, western and editorial lettering. The inspector picker is constrained to the available screen height. SVG lettering embeds its selected font before effect capture so curved text does not silently fall back to a system face.

The original licence and copyright notices for all 22 families are retained in `public/font-licenses/`. Seventeen display families use SIL OFL 1.1; Yellowtail and Permanent Marker use Apache 2.0. These licences permit commercial garment artwork under their terms. Imported fonts remain subject to the uploader's own licence. Device fonts are labelled separately and are not claimed as bundled open fonts.

Primary licence references: https://openfontlicense.org/how-to-use-ofl-fonts/ and https://www.apache.org/licenses/LICENSE-2.0 .
