"""Create outline-reader copies of the already bundled OFL web fonts.
Requires fontTools, Brotli and skia-pathops. Output is native TrueType, never traced artwork.
"""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'node_modules/.cache/font-generation'))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
output=root/'src/assets/outline-fonts'
output.mkdir(parents=True,exist_ok=True)
for family in ('inter','montserrat'):
    for style in ('normal','italic'):
        source=root/f'node_modules/@fontsource-variable/{family}/files/{family}-latin-wght-{style}.woff2'
        for weight in (400,700):
            font=TTFont(source,recalcTimestamp=False)
            font=instantiateVariableFont(font,{'wght':weight},inplace=True)
            removeOverlaps(font,removeHinting=True)
            font.flavor=None
            target=output/f'{family}-{weight}-{style}.ttf'
            font.save(target)
            print(target.name)
