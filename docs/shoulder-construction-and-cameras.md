# Shoulder construction and artwork registration

## References

- [Sewing Lab Milano, raglan and saddle sleeve drafting](https://sewinglabmilano.com/lessons/2-10-raglan-1-2-pieces-sleeve-saddle-sleeve-2-2/): distinguishes the neckline-to-underarm raglan cut and its shoulder-ending variations; recommends smoothing the shoulder line.
- [Knitting & Crochet Guild, raglan sleeve](https://kcguild.org.uk/learn/design/raglan/raglan-sleeve/): diagonal seam placement and the relationship to saddle construction.
- [Brooklyn Tweed, Saddler by Aiste Butkeviciene](https://brooklyntweed.com/products/saddler): primary garment reference for a narrow shoulder saddle and its relationship to the neckband. Knitwear reference for the seam topology, not a copied sewing pattern.
- [Tilly and the Buttons, Samara](https://shop.tillyandthebuttons.com/collections/sewing-patterns/products/samara): relaxed drop shoulder and simple sleeve attachment, including a V-neck example.

## Implementation

Each fit retains its torso proportions. Set-in sleeves use a shared attachment edge; raglan seams meet the neckline; saddle seams follow a narrow shoulder strip with a tangent-continuous turn into the armhole; drop shoulders move the seam modestly beyond the sleeve cap rather than deep into the sleeve.

Construction repartitions the fabric surfaces and supplies one explicit sleeve attachment path per side. The shared technical renderer owns the exterior and hem ink. Stroking each entire partition separately previously duplicated borders and drew unwanted hem edges. The original neck and outline markup are retained so changing shoulders does not regenerate or clip collar ribbing.

The same neck-to-cap smoothing is applied to all fits, retaining the authored collar. The old bounded moving-average shoulder smoothing was removed because its start/stop window introduced dents and small shifts in the silhouette.

Artwork has its own 800 x 700 coordinate board. Read-only garment previews now project the artwork zone through the actual displayed garment square, including camera scale, translation and transition frames. The saved artwork coordinates remain untouched. Tests cover neck, chest and hem camera registration at several display scales and smooth shoulder seam tangents at different fit proportions.

## Complete outlines and stitch clearance

The final technical outline uses the entire visible fabric union and bypasses legacy repair/fold masks. Collar-owned edges are omitted by testing the actual neck surfaces, so the original collar ink remains intact. The outline sits above the stitch layer. Sleeve attachment ink is clipped to the same fabric footprint.

Convex cap tips receive a local 32-unit rounded transition in the actual fabric geometry; neckline and hem vertices remain fixed. Each fabric panel is intersected with this common rounded silhouette so material, mask and outline geometry agree.

The stitch renderer no longer guesses raglan/saddle/drop attachments from the set-in cap coordinate. It flattens the explicit open seam path, offsets the row 14 units into its owning fabric, and uses a five-unit outer-edge clearance mask for every stitch style. Sleeve hem rows use the centre of the actual hem band with endpoint allowances. There is no closing stitch segment between the ends of an open seam. The saddle turn has additional depth and width to retain a useful shoulder strip.

Underarm seams continue to each sleeve's original attachment endpoint, so short sleeves meet the inner cuff without a gap while long sleeves still end at the armpit. The surface partition and visible seam use the same complete path.

Brush fabric relief now multiplies RGB inside replayed ink without changing alpha coverage. This avoids the pale antialiased fringe produced by a separately masked DOM texture overlay. Legacy drawing bitmaps no longer receive that overlay. Paint bristle detail uses the selected ink rather than white strokes. Desktop drawing size/opacity controls are restored, with phone controls inside the tool panel to keep the garment clear.


## Underarm side-seam registration

The reconstructed torso now removes the old upward attachment hook below each inner cuff and keeps its first side run aligned to the cuff. A smooth transition rejoins the authored waist, preserving the lower fit. Both sides are covered by the shoulder/camera regression checks. The slim polo was visually checked with contrasting sleeves and a body pattern.
