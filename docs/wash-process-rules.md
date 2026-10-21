# Wash and finish: process rules

Reviewed 21 October 2026. These rules describe the standard processes offered by the builder. Specialist factory methods can differ; a design confirmation is not a manufacturability certification.

## Technical evidence

- [Cotton Incorporated: Garment finishing](https://cottonworks.com/learning-hub/finishing/garment-finishing/): stonewashing abrades the garment during tumbling. Cellulase acts on cellulose and can reduce strength. Standard acid/snow washing creates irregular discharge during machine processing. Brushing and spraying are separate ways of applying discharge locally. Outcomes depend on fabric, dye and process conditions.
- [Archroma: BACTOSOL](https://www.archroma.com/textile-effects/products/bactosol): enzymes serve specific functions. The offered biopolishing wash targets cellulosic fabric; it must not be represented as a universal treatment for synthetic fibre.
- [Cotton Incorporated: Dyeing basics](https://cottonworks.com/learning-hub/dyeing/dyeing-basics/): pigment coloration needs a binder and is distinct from dyes penetrating fibre. Dye choice, fixation and fastness matter. Garment dye and overdye are coloration operations rather than arbitrary local fade masks.
- [Archroma: Dyeing](https://www.archroma.com/textile-effects/solutions/dyeing): cellulosic, polyester, polyamide and wool substrates need different dye systems. Synthetic fabric alone does not make every dyeing process impossible.
- [Cotton Incorporated: Lab dip process](https://cottonworks.com/learning-hub/dyeing/lab-dip-process/): shade approval uses the specified substrate; the recipe changes with fibre and dye class.
- [The LYCRA Company: fibre durability](https://www.lycra.com.cn/en/business/news/discover-secret-durable-swimwear): ordinary elastane can be damaged by chlorine; specially engineered chlorine-resistant fibres differ. No universal assumption about a stretch blend's chlorine resistance is justified.

## Implemented product limits (conservative design decisions)

- None: no added treatment controls.
- Enzyme: specifically cellulase biopolishing; whole-garment application. Disabled only when a fully specified composition has no cellulose. Blends remain sample-dependent. No guaranteed local bleaching or tinting.
- Stone: overall abrasion and relative worn appearance. No arbitrary painted placement or independent chemical-colour selector.
- Acid/snow: standard overall, irregular discharge. No brush-shaped control presented as a machine acid wash. Existing dye and stretch components need factory verification; the app does not prescribe chlorine or a chemical recipe.
- Vintage and legacy mineral: appearance briefs, not uniquely defined recipes. Local placement and brush tools remain available as reference intent, with an explicit factory-method/sample qualification.
- Pigment: overall pigment colour and washdown appearance; binder, preparation and suitability need verification. No exact local fade mask.
- Garment dye and overdye: overall target colour; no fading intensity, feathered edges, local brush or seam-wear construction controls. Dyeing synthetics is not categorically disabled.
- Saved unsupported masks are ignored by the effective process settings and specification. Choosing another process resets incompatible editable settings; the original state remains recoverable through undo.
- Strength numbers describe visual intent, never chemical concentrations, processing time or a guarantee of reproducibility. Generic previews are illustrative and do not certify a fabric/dye combination.

Known limits: supplier dye class, dye readiness, treatment recipes, coatings and trim compatibility are not stored in the current product. Unknown information prompts factory sampling instead of invented compatibility claims or unsupported numerical cutoffs.

[Rit: Overdyeing](https://www.ritdye.com/faq/can-i-change-the-color-of-a-garment-by-overdyeing-it-with-a-new-dye-color/) distinguishes darkening from colour removal needed before a lighter result. The builder uses a darkening-only overdye approximation and does not expose a lightening preview for overdye. Garment-dye target colours remain subject to fabric preparation and shade approval.
