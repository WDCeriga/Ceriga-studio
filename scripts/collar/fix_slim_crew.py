"""Rebuild slim crew from measured raster collar boundaries, then repack.

The donor's shoulder lines are excluded; both nape attachment points map to
the slim base. Masks are traced by the existing packer on its shared canvas.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src/assets/studio-tshirt'


def polygon(size, points):
    image = Image.new('L', size)
    ImageDraw.Draw(image).polygon(points, fill=255)
    return np.asarray(image) > 0


def complete_corner_fills(masks, ink):
    """Include rib cells at the two joins, beyond the opening-distance flood.

    Select whole ink-bounded white cells by their centre; the measured
    triangles select cells only and never become SVG geometry themselves.
    """
    size = (ink.shape[1], ink.shape[0])
    corners = polygon(size, [(389,143),(354,163),(396,181)])
    corners |= polygon(size, [(637,143),(672,163),(630,181)])
    labels, count = ndimage.label(~ink)
    boxes = ndimage.find_objects(labels)
    take = np.zeros_like(ink)
    for index, box in enumerate(boxes, start=1):
        cell = labels[box] == index
        if not 4 <= cell.sum() <= 1500:
            continue
        y, x = np.nonzero(cell)
        cy, cx = int(round(y.mean())) + box[0].start, int(round(x.mean())) + box[1].start
        if corners[cy, cx]:
            take[box] |= cell
    take |= ndimage.binary_dilation(take, iterations=3) & ink
    masks['Neck'] |= take
    masks['Body'] &= ~take
    return int(take.sum())


def rebuild():
    base = Image.open(SRC / 'slim-vneck-lineart-bold.png').convert('RGB')
    donor = Image.open(SRC / 'slim-crew-lineart-bold.png').convert('RGB')
    if base.size != (1024, 1536) or donor.size != base.size:
        raise ValueError('Re-measure collar landmarks before using different source dimensions')
    (SRC / '_diag').mkdir(exist_ok=True)
    # Measured nape joins: donor (377,162)/(644,162), base (389,144)/(637,144).
    scale = 248 / 267
    dx = 389 - scale * 377
    dy = -18
    aligned = donor.transform(base.size, Image.Transform.AFFINE,
                              (1 / scale, 0, -dx / scale, 0, 1, -dy),
                              resample=Image.Resampling.BICUBIC, fillcolor='white')
    # Outside the donor's cover stitch, inside its shoulder seam: exclude
    # shoulder ink even when it is connected to the collar's construction web.
    boundary = [(377,160),(343,178),(339,201),(345,243),(366,288),
                (400,327),(449,352),(510,362),(571,352),(620,327),
                (654,288),(675,243),(681,201),(679,178),(644,160),
                (600,120),(420,120)]
    paste = polygon(base.size, [(x * scale + dx, y + dy) for x, y in boundary])
    # Remove the entire old V assembly, including its lower point and dashes.
    erase = polygon(base.size, [(389,142),(354,159),(351,197),(372,260),
                                (423,326),(512,390),(600,326),(652,260),
                                (672,197),(669,159),(637,142),(600,110),(420,110)])
    out = np.asarray(base).copy()
    out[erase] = 255
    out[paste] = np.asarray(aligned)[paste]
    result = Image.fromarray(out)
    # Close the two-pixel raster cut at the left shoulder attachment.
    ImageDraw.Draw(result).line([(350,166),(361,161)], fill=(0,0,0), width=4)
    out = np.asarray(result)
    if not np.array_equal(out[400:], np.asarray(base)[400:]):
        raise AssertionError('Collar replacement changed the lower garment')
    result.save(SRC / 'slim-crew-composite-bold.png')
    Image.fromarray(out).crop((300,110,720,405)).resize((840,590)).save(SRC / '_diag/slim-crew-repaired.png')


if __name__ == '__main__':
    rebuild()
    from pack_studio_neck_variant import pack
    pack('slim-crew', probe_only=False)
