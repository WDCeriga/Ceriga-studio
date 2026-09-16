"""Raster reference sleeves fitted to existing armholes, then Potrace only."""
from pathlib import Path
from io import BytesIO
import shutil
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import cairosvg
import pack_studio_neck_variant as P

SRC = P.SRC
OUT = SRC / 'long-sleeves'
OUT.mkdir(exist_ok=True)
REF = SRC / 'long-sleeve-reference.png'
if not REF.exists():
    shutil.copyfile(r'C:/Users/richy/AppData/Local/Temp/codex-clipboard-d2ddcf30-7c5c-41fe-a476-8255f58d4b10.png', REF)

def raster(category, name):
    png = cairosvg.svg2png(url=str(SRC / category / (name + '.svg')), output_width=1536, output_height=1536)
    return np.asarray(Image.open(BytesIO(png)).convert('RGBA').crop((256, 0, 1280, 1536)))[:, :, 3] >= 128

def save(fit, name, mask, ink=False):
    (OUT / f'{fit}-{name}.svg').write_text((P.wrap_ink if ink else P.wrap_fill_only)(name, mask), encoding='utf-8')

def build(fit):
    tag = '' if fit == 'slim' else f' ({fit})'
    sleeve = raster('Left sleeve', 'Left sleeve' + tag)
    cuff = raster('Left cuff', 'Left cuff' + tag)
    old = sleeve | cuff
    # These dropped-armhole packs include a shoulder stitch allowance in their
    # sleeve colour mask. It belongs to the retained torso, not sleeve length.
    if fit in ('regular', 'oversized'):
        old[:408] = False
    ys, xs = np.where(old)
    top = int(ys.min())
    right = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in old])
    left = np.array([np.flatnonzero(row)[0] if row.any() else 0 for row in old])
    joins = np.flatnonzero(right >= right.max() - 3)
    join = int(joins[0])
    under = int(joins[-1])
    # The source's rounded wrist and slight elbow shaping are retained by a
    # scanline warp. Shoulder-to-armhole ink above the join stays unchanged.
    ref = P.key_lineart(REF)
    refink = np.asarray(ref)[:, :, 3] >= 128
    refsolid = ndi.binary_fill_holes(refink)
    donor = refsolid[540:869, :154]
    original_width = right[join] - left[join] + 1
    width_top = round(original_width * {'slim': .75, 'regular': 1.1, 'boxy': 1.1, 'oversized': 1.15}[fit])
    hem = raster('Body hem', 'Body hem' + tag)
    end = min(1450, int(np.where(hem)[0].max()) + 18)
    width_end = {'slim': 112, 'regular': 132, 'boxy': 145, 'oversized': 154}[fit]
    inner_end = int(right[under]) - 45
    new = np.zeros_like(old)
    new[:under + 1] = old[:under + 1]
    for y in range(top, join):
        if not right[y]:
            continue
        amount = (y-top) / max(1, join-top)
        outer = round(left[y] - (width_top-original_width)*amount)
        new[y] = False
        new[y, max(4, outer):int(right[y])+1] = True
    # Replace the old diagonal short-sleeve opening with the continuing upper
    # sleeve, while retaining the whole original armhole attachment.
    for y in range(join, under + 1):
        inner = int(right[y])
        new[y] = False
        new[y, max(4, inner-width_top):inner+1] = True
    mapped_ink = np.zeros_like(old)
    for y in range(under + 1, end + 1):
        t = (y - under) / (end - under)
        sy = min(328, round(t * 328))
        row = np.flatnonzero(donor[sy])
        if not row.size:
            continue
        # Normalize the reference row between its original lower-sleeve edges.
        outer_src, inner_src = int(row[0]), int(row[-1])
        width = round(width_top * (1-t) + width_end * t)
        inner = round(right[under] * (1-t) + inner_end * t)
        outer = max(4, inner - width)
        new[y, outer:inner+1] = True
        sx = np.linspace(outer_src, inner_src, inner-outer+1).round().astype(int)
        mapped_ink[y, outer:inner+1] = refink[540+sy, sx]
    # Raster contours, not hand-authored SVG curves. Close the wrist edge.
    edge = new & ~ndi.binary_erosion(new, iterations=3)
    # The retained garment already supplies its armhole seam. Drawing a second
    # mirrored seam here would double the line on slightly asymmetric rasters.
    for y in range(top, under + 1):
        row = np.flatnonzero(new[y])
        if row.size:
            edge[y, max(0, row[-1]-4):] = False
    cc, _ = ndi.label(mapped_ink, np.ones((3,3)))
    sizes = np.bincount(cc.ravel())
    stitches = mapped_ink & (sizes[cc] < 160)
    wrist = new & (np.indices(new.shape)[0] >= end - 20)
    # Retain the original armhole seam on the torso, remove the old sleeve and
    # cuff everywhere else, including their outside outlines and stitch rows.
    remove = np.zeros_like(old)
    # Clear the whole old sleeve side, not just its fill pixels: the legacy
    # outline can extend beyond that fill, especially on the boxy cuff.
    for y in range(top, min(old.shape[0], int(ys.max()) + 16)):
        boundary = right[min(y, under)]
        if boundary:
            remove[y, :max(0, boundary-3)] = True
    keep = ~remove
    keep &= np.fliplr(keep)
    for side, flip in [('left', False), ('right', True)]:
        f = np.fliplr if flip else lambda a:a
        save(fit, side, f(new))
        save(fit, side+'-cuff', f(wrist))
    outline = edge | np.fliplr(edge)
    stitch = stitches | np.fliplr(stitches)
    save(fit, 'outline', outline, True)
    save(fit, 'stitch', stitch)
    save(fit, 'keep', keep)
    for style, mask in [('Short sleeve', old | np.fliplr(old)), ('Long sleeve', new | np.fliplr(new))]:
        P.write_part('Sleeve length', style + f' ({fit})', P.wrap_fill_only(style, mask))
    proof = np.full((*new.shape,3),255,np.uint8)
    proof[new | np.fliplr(new)] = (94,128,178)
    proof[outline] = (20,20,20)
    proof[stitch] = (210,210,210)
    Image.fromarray(proof).save(OUT / f'{fit}-proof.png')
    print(fit, 'top',top,'underarm',under,'wrist',end,'width',width_top,width_end,flush=True)

if __name__ == '__main__':
    import sys
    for fit in sys.argv[1:] or ['slim','regular','boxy','oversized']:
        build(fit)
