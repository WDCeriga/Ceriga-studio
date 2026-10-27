# Artwork production methods

Fabric coverage and placed decoration are separate workflows. Fabric fills offer only Fabric Print. Screen Print and the other decoration methods are offered for placed graphics. Coverage is inferred from actual placement: a part target or explicit whole-garment fill uses Fabric Print. A free square is placed fabric and offers decoration methods. There is no manual coverage toggle. Pattern-filled letters/shapes remain placed graphics. Colour names and camo motifs alone do not determine compatibility.

All artwork inspectors, including the older artwork editor, use the shared ArtworkPrintMethod component and artworkProduction policy. Existing incompatible saved choices are retained and flagged for correction; opening the editor does not rewrite saved artwork. New patterns dropped onto garment parts use Fabric Print. New free pattern squares use DTG. Asset creation and physical distress do not ask for a decoration method.

Fabric Print is intentionally process-neutral: polyester sublimation and cotton textile ink processes are different. No fibre composition is guessed from colour, a visual texture or a pattern name. The current UI explains substrate checks rather than claiming supplier capabilities it cannot know. Specific textile printing processes are handled within the Fabric Print workflow rather than shown as competing decoration choices.

DTG, DTF, screen print, embroidery, puff and heat transfer remain available for placed designs with specific preparation notes. Raster images are not automatically blocked for embroidery: digitisation and sometimes simplification are required. Standard embroidery and specialist colour blending differ. Puff is expanding screen ink, not a synonym for puff vinyl. Heat Transfer distinguishes cut vinyl from printed film. No universal minimum stitch/line size or colour-count limit is invented from one supplier's specifications. Physical size cannot be inferred from editor pixels.

These are production guidance and workflow choices, not stitch simulation or a manufacturing preflight guarantee. Material, actual size, seams, process and supplier determine the final result. Selecting a process never silently changes colours, brush finish, gradients or artwork geometry.

## Primary references checked 27 October 2026

- Printful, AOP workflows and cotton vs polyester: https://help.printful.com/hc/en-us/articles/50264358498193-What-is-AOP-and-how-does-all-over-printing-work
- Printful, cut-and-sew vs finished-garment seams: https://help.printful.com/hc/en-us/articles/50264464097297-What-should-I-know-about-all-over-printing
- Printful, print-file detail and underbase: https://help.printful.com/hc/en-us/articles/50264019148177-How-should-I-prepare-my-print-file-for-the-best-results
- Printful, specialist embroidery blending: https://help.printful.com/hc/en-us/articles/50264126020881-What-should-I-consider-when-creating-unlimited-color-embroidery-designs
- Stahls, full-colour DTF and printed transfer vs spot-colour transfers: https://www.stahls.co.uk/faq
- ScreenPrinting.com, detail/ink/mesh and halftones: https://help.screenprinting.com/en-US/how-do-i-pick-the-right-mesh-count-for-my-design-16555
- SanMar, puff ink expansion and fine detail: https://www.education.sanmar.com/decorator-relations/screen-printing-in-the-3rd-dimension/

Verification: node scripts/verify-artwork-production.mjs; npm run build; browser checks for saved incompatible DTG fabric patterns, Fabric Print selection and placed-graphic switch.

The fabric-fill inspector is an applied-state summary, not a method picker. Fabric/process details are an optional disclosure. Free pattern squares are labelled Placed fabric; there is no coverage toggle.
