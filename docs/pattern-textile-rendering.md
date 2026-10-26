# Pattern textile rendering

## References and design decisions

- [Cotton Incorporated / CottonWorks: Printing process](https://cottonworks.com/learning-hub/printing/printing-process/). Textile printing applies colour to the fabric using dye or pigment systems; the fabric construction still matters. The preview therefore keeps the selected material relief and construction linework above a repeat, rather than multiplying the repeat by the garment's original colour.
- [Spoonflower: Repeat options](https://support.spoonflower.com/hc/en-us/articles/204444650-Repeat-Options). Basic, half-drop, half-brick and mirror repeats describe different translation lattices. Continuous garment alignment uses a shared origin and a common repeat scale, not the bounding-box size of each sleeve.
- [MultiCam: How it works](https://multicampattern.com/). Its explanation of shape, volume, colour and blending informed the use of several spatial scales and restrained tonal palettes. No proprietary pattern artwork, photographs or licensed print tiles have been copied into the library.
- [Cotton Incorporated: Printing of pigments and special effects](https://www.cottoninc.com/wp-content/uploads/2017/12/ISP-1017-Printing-of-Pigments-and-Special-Effects.pdf). Pigment printing uses a binder and interacts with textile construction. The preview is a fabric-aware design illustration, not a guarantee of an exact ink process or manufactured colour match.

## Original artwork

The built-in library remains original editable vector geometry. Woodland, desert, urban, abstract and generic camouflage now use periodic, domain-warped gradient fields and contour boundaries rather than radial blobs stamped on a regular grid. Tiger stripe uses a directional periodic field with broken secondary structure. Digital camouflage quantizes the connected field onto a pixel lattice; cow print uses a two-colour field. Existing saved palettes, seeds and settings remain editable. Original seed values remain deterministic, although the improved generator intentionally changes their appearance.

Checks cover repeat-edge continuity, stable generation, meaningful seed/density changes, finite output at extreme values and equal repeat pitch on differently sized garment parts.

## Garment integration

- The underlying fabric assignments and garment colour values are never changed by applying a repeat.
- Printed regions use the repeat palette. Transparent parts retain the original garment colour.
- A separate neutral relief pass brings the actual selected fabric and garment construction over the pattern without tinting it with the old garment colour.
- SVG root paint inheritance is retained when capturing technical linework; a `fill="none"` root must not become a black silhouette.
- The same garment-scale reference is used for body and sleeve fills and during drag previews. Continuous alignment accounts for each part's top-left origin.
- Pattern layers stay behind uploaded artwork, shapes, typography and wear layers. Asset-only canvases keep their existing flat artwork behaviour.

The current garment renderer is a flat technical preview. It does not simulate new folds, three-dimensional drape or print chemistry; it preserves the material and construction detail that already exists in the garment view.
