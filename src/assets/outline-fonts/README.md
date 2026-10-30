# Font sources for editable outlines

TrueType copies of the existing bundled Inter and Montserrat Latin fonts, instantiated at the regular and bold weights, in normal and italic styles. The editor uses these for native glyph paths because its OpenType reader cannot decompress WOFF2. The displayed web fonts are unchanged.

Generated with `python scripts/prepare-outline-fonts.py` using fontTools, Brotli and skia-pathops. Overlapping TrueType contours are resolved as curves, retaining counters under SVG fill rules. Original copyright and SIL OFL 1.1 licences are included alongside the files. These are font curves, not traced bitmap glyphs.
