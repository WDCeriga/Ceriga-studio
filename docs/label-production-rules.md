# Label production and editor rules

The editor uses artwork choices, not inferred care advice. Content is shown only on applicable label types: a size tab has size, a sleeve/hem tag has brand/footer, and a hangtag has retail branding fields. Care content is offered on a dedicated care label or direct garment print. It starts empty and requires explicit instruction choices and manufacturer confirmation; material composition never generates washing instructions.

Physical woven and printed fabric labels can use straight cut, end, centre, loop and mitre folds. Direct garment prints and card hangtags have no textile fold choices. Round/oval physical labels use a die-cut edge. Artwork dimensions are retained and never silently reduced to fit the garment drawing. Unfolded sizes in the editor are estimates using the entered fold allowance, not universal supplier cutting specifications.

Manufacturers distinguish a crease at the centre from an open loop, and different suppliers use different seam/fold allowances. Confirm the actual cutting template with the supplier. Do not assume that woven care labels are impossible: both woven and printed products exist, and suitability depends on text legibility and the supplier.

Sources checked 21 October 2026:
- Dutch Label Shop, Label Fold Guide: https://www.dutchlabelshop.com/en_uk/blog/label-fold-guide/
- EE Label Factory, folding methods (woven and printed): https://www.eelabelfactory.com/C308-N104-Selection-aid---folding-method-labels.html
- JC Basic, choosing a woven label fold: https://support.jcbasic.com/portal/en/kb/articles/choosing-a-fold-type-for-your-woven-labels
- Custom Woven Labels, fold and sizing guide: https://customwovenlabels.com/woven-label-design-guide

Technical regression: sleeve files may contain paired mirrored sleeves. Attachment samples the actual opaque sleeve on the selected side, not the bounding-box centre. Label measurements publish only after masks load; an unmasked/masked alternation must not trigger a render loop when leaving Labels.

Shape and corner cuts are independent from textile folding. Rectangle, rounded rectangle, square, oval, circle, horizontal, vertical and custom proportions use the same edge geometry in thumbnails, canvas and exported SVG. Straight, rounded and angled corner cuts are included in specifications. Sleeve-tag close-ups frame the tag rather than the full sleeve. Successful logo uploads request a close-up, including an isolated artwork view while a manually placed label awaits attachment. Each label and hangtag face retains its own label/text colours; uploaded bitmap artwork keeps its own pixel colours.

Folded sleeve/hem tags use a 20 × 15 mm finished default. Artwork face is separate from garment side and attachment offsets. Front/back artwork, fonts, section backgrounds and fill settings persist independently; production PDF includes both faces. Stacked, split-column and grid layouts use the same renderer in preview and export. Phone editing keeps a live artwork preview visible above the controls.
