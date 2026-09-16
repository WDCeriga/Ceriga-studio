"""Register the deep V collar without copying or erasing shoulder seams."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from fix_slim_crew import polygon

SRC = Path(__file__).resolve().parents[2] / 'src/assets/studio-tshirt'
SCALE = 248 / 245
DX = 389 - SCALE * 391
DY = -1


def registered(points):
    return [(x * SCALE + DX, y + DY) for x, y in points]


def complete_band_fills(masks, ink):
    """Claim enclosed rib cells using the measured outer band as a selector.

    Connected rib ticks can block the generic opening flood. Select the
    actual white cells, then extend under ink; do not trace the polygon.
    """
    selector = polygon((ink.shape[1], ink.shape[0]), registered([
        (391,144),(359,163),(367,220),(380,282),(400,357),
        (429,438),(466,516),(512,579),(557,516),(594,438),
        (623,357),(643,282),(656,220),(664,163),(636,144),
        (590,157),(550,164),(510,165),(470,164),(430,157),
    ]))
    labels, _ = ndimage.label(~ink)
    hole_id = int(labels[287, 513])
    if hole_id == 0:
        raise ValueError('Deep V opening seed is on ink; re-probe the source')
    hole = labels == hole_id
    if not 30000 < hole.sum() < 80000:
        raise ValueError('Deep V opening is not enclosed')
    take = np.zeros_like(ink)
    for index, box in enumerate(ndimage.find_objects(labels), start=1):
        cell = labels[box] == index
        if not 4 <= cell.sum() <= 20000:
            continue
        y, x = np.nonzero(cell)
        cy, cx = int(round(y.mean())) + box[0].start, int(round(x.mean())) + box[1].start
        if selector[cy, cx]:
            take[box] |= cell
    take |= ndimage.binary_dilation(take, iterations=3) & ink
    hole |= ndimage.binary_dilation(hole, iterations=3) & ink
    fabric = masks['Body'] | masks['Neck'] | masks['Inner back neck']
    masks['Neck'] = take
    masks['Inner back neck'] = hole & ~take
    masks['Body'] = fabric & ~take & ~hole
    if masks['Body'].sum() < 400000:
        raise ValueError('Deep V body fill is incomplete; check the shoulder enclosure')
    if not 20000 < take.sum() < 40000:
        raise ValueError('Deep V band coverage is outside the measured range')
    return int(take.sum())


def rebuild():
    base = Image.open(SRC / 'slim-vneck-lineart-bold.png').convert('RGB')
    donor = Image.open(SRC / 'slim-deep-vneck-lineart-bold.png').convert('RGB')
    if base.size != (1024,1536) or donor.size != base.size:
        raise ValueError('Re-measure collar landmarks for different source dimensions')
    # Both donor nape corners map to the same two joins as every slim fit.
    aligned = donor.transform(base.size, Image.Transform.AFFINE,
        (1 / SCALE,0,-DX / SCALE,0,1,-DY),
        resample=Image.Resampling.BICUBIC, fillcolor='white')
    paste = polygon(base.size, registered([
        (391,142),(357,162),(352,190),(365,263),(390,357),
        (420,444),(460,530),(512,597),(564,530),(604,444),
        (634,357),(659,263),(672,190),(668,162),(636,142),
        (600,110),(420,110),
    ]))
    erase = polygon(base.size, [(389,142),(354,159),(351,197),(372,260),
        (423,326),(512,390),(600,326),(652,260),(672,197),(669,159),
        (637,142),(600,110),(420,110)])
    out = np.asarray(base).copy()
    out[erase] = 255
    out[paste] = np.asarray(aligned)[paste]
    result = Image.fromarray(out)
    # Raster cuts meet the original shoulders at these measured seam points.
    draw = ImageDraw.Draw(result)
    draw.line([(350,166),(363,160)], fill=(0,0,0), width=4)
    draw.line([(661,157),(676,164)], fill=(0,0,0), width=4)
    out = np.asarray(result)
    if not np.array_equal(out[600:], np.asarray(base)[600:]):
        raise AssertionError('Neck replacement changed the lower garment')
    result.save(SRC / 'slim-deep-vneck-composite-bold.png')
    (SRC / '_diag').mkdir(exist_ok=True)
    result.crop((300,110,720,610)).save(SRC / '_diag/slim-deep-vneck-repaired.png')


if __name__ == '__main__':
    rebuild()
    from pack_studio_neck_variant import pack
    pack('slim-deep-vneck', probe_only=False)
