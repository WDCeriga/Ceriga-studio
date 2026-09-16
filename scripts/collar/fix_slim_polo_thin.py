"""Rebuild slim polo, thin crew and scoop from complete donor collar drawings.

Raster boundaries isolate the collar; closed white cells provide the fills.
The thin crew uses two nape anchors, while the raised polo keeps its shoulder
anchors so its stand is not lowered into the shirt.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from fix_slim_crew import polygon

SRC = Path(__file__).resolve().parents[2] / 'src/assets/studio-tshirt'
SPECS = {
    'slim-scoop': {
        # Pull the scoop back toward the slim fit socket: the source drawing is
        # too wide and deep once stacked with the shared slim body.
        'sx': 0.68, 'dx': 512 - ((338 + 685) / 2) * 0.68,
        'sy': 0.72, 'dy': 144 - 161 * 0.72,
        'boundary': [(338,124),(302,174),(295,230),(311,330),
                     (347,423),(411,490),(512,521),(612,490),
                     (676,423),(711,330),(727,230),(721,174),
                     (686,124),(642,124),(512,116),(382,124)],
        'selector': [(340,134),(306,175),(310,260),(332,350),
                     (376,424),(432,470),(512,496),(592,470),
                     (648,424),(692,350),(714,260),(718,175),
                     (684,134),(610,174),(512,184),(414,174)],
        'hole': (512,270), 'min_hole': 20000,
        'joins': [[(350,166),(368,155)],[(658,154),(676,164)]],
    },
    'slim-polo': {
        'sx': 1, 'dx': 0, 'dy': -1,
        'boundary': [(394,96),(330,168),(342,298),(413,255),
                     (490,481),(530,481),(610,255),(683,298),
                     (693,168),(629,96),(580,80),(440,80)],
        'selector': [(395,99),(335,170),(346,293),(415,251),
                     (493,477),(527,477),(607,251),(679,293),
                     (688,170),(628,99),(570,105),(450,105)],
        'hole': (511,234), 'min_hole': 18000,
        'joins': [[(326,174),(338,168)],[(685,168),(698,173)]],
    },
    'slim-thin-crew': {
        'sx': 248 / 229, 'dx': 389 - 399 * 248 / 229, 'dy': 0,
        'boundary': [(399,142),(375,153),(373,179),(384,221),
                     (410,258),(456,286),(512,294),(568,286),
                     (614,258),(640,221),(651,179),(652,153),
                     (628,142),(590,110),(440,110)],
        'selector': [(399,144),(378,155),(385,207),(409,246),
                     (452,275),(512,283),(573,275),(617,246),
                     (640,207),(648,155),(628,144),
                     (580,156),(510,164),(450,156)],
        'hole': (511,225), 'min_hole': 8000,
        'joins': [[(350,166),(369,155)],[(658,154),(673,162)]],
    },
    'boxy-scoop': {
        'sx': 1, 'dx': 0, 'dy': 0,
        'selector': [(384,213),(640,213),(664,222),(650,370),
                     (610,468),(512,505),(414,468),(374,370),
                     (358,222)],
        'hole': (512,356), 'min_hole': 30000,
    },
    'boxy-vneck': {
        'sx': 1, 'dx': 0, 'dy': 0,
        'selector': [(384, 204), (640, 204), (660, 236), (624, 330),
                     (556, 430), (512, 468), (468, 430), (400, 330),
                     (364, 236)],
        'hole': (512, 330), 'min_hole': 20000,
    },
    'boxy-deep-vneck': {
        'sx': 1, 'dx': 0, 'dy': 0,
        'selector': [(392,220),(632,220),(662,238),(648,330),
                     (606,444),(544,560),(512,590),(480,560),
                     (418,444),(376,330),(362,238)],
        'hole': (512,361), 'min_hole': 30000,
    },
}


def points(spec, values):
    return [(x * spec['sx'] + spec['dx'], y * spec.get('sy',1) + spec['dy']) for x,y in values]


def _quad(p0, p1, p2, steps=40):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((round(x), round(y)))
    return pts


def _cubic(p0, p1, p2, p3, steps=48):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (
            (1 - t) ** 3 * p0[0]
            + 3 * (1 - t) ** 2 * t * p1[0]
            + 3 * (1 - t) * t * t * p2[0]
            + t ** 3 * p3[0]
        )
        y = (
            (1 - t) ** 3 * p0[1]
            + 3 * (1 - t) ** 2 * t * p1[1]
            + 3 * (1 - t) * t * t * p2[1]
            + t ** 3 * p3[1]
        )
        pts.append((round(x), round(y)))
    return pts


def _sample_path(path, count):
    lengths = []
    total = 0.0
    for a, b in zip(path, path[1:]):
        length = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        lengths.append(length)
        total += length
    if total == 0:
        return [path[0]] * count
    samples = []
    for index in range(count):
        target = total * index / max(count - 1, 1)
        travelled = 0.0
        for seg_index, length in enumerate(lengths):
            if travelled + length >= target or seg_index == len(lengths) - 1:
                a = path[seg_index]
                b = path[seg_index + 1]
                ratio = 0.0 if length == 0 else (target - travelled) / length
                samples.append((
                    round(a[0] + (b[0] - a[0]) * ratio),
                    round(a[1] + (b[1] - a[1]) * ratio),
                ))
                break
            travelled += length
    return samples


def _draw_path(draw, pts, width=4):
    draw.line(pts, fill=(0, 0, 0), width=width, joint='curve')
    radius = max(1, width // 2)
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(0, 0, 0))


def draw_reference_scoop(draw, *, profile):
    """Reference-style scoop: shallow back binding plus rounded U front."""
    if profile == 'slim':
        top = _quad((382, 132), (512, 150), (642, 132), 48)
        back_lower = _quad((378, 163), (512, 184), (646, 163), 48)
        outer = (
            _cubic((366, 158), (372, 288), (454, 426), (512, 426), 56)
            + _cubic((512, 426), (570, 426), (652, 288), (658, 158), 56)[1:]
        )
        inner = (
            _cubic((414, 166), (418, 268), (470, 358), (512, 358), 48)
            + _cubic((512, 358), (554, 358), (606, 268), (610, 166), 48)[1:]
        )
        connectors = [((382, 132), (366, 158)), ((642, 132), (658, 158)),
                      ((378, 163), (414, 166)), ((646, 163), (610, 166)),
                      ((300, 202), (350, 166)), ((350, 166), (366, 158)),
                      ((658, 158), (676, 164)), ((676, 164), (724, 202))]
        rib_count = 42
        top_rib_count = 30
    else:
        top = _quad((390, 204), (512, 222), (634, 204), 48)
        back_lower = _quad((398, 232), (512, 246), (626, 232), 48)
        outer = (
            _cubic((382, 222), (390, 320), (462, 410), (512, 410), 52)
            + _cubic((512, 410), (562, 410), (634, 320), (642, 222), 52)[1:]
        )
        inner = (
            _cubic((428, 234), (436, 300), (476, 362), (512, 362), 44)
            + _cubic((512, 362), (548, 362), (588, 300), (596, 234), 44)[1:]
        )
        connectors = [((390, 204), (382, 222)), ((634, 204), (642, 222)),
                      ((398, 232), (428, 234)), ((626, 232), (596, 234)),
                      ((314, 254), (382, 222)), ((642, 222), (710, 254))]
        rib_count = 36
        top_rib_count = 26

    for pts in (top, back_lower, outer, inner):
        _draw_path(draw, pts, width=5)
    for a, b in connectors:
        draw.line([a, b], fill=(0, 0, 0), width=5)

    # The collar replacement intentionally clears the old neckline, which can
    # also remove the last few pixels of the shoulder seam. Re-close those
    # garment joins as one continuous construction line so the final raster
    # trace cannot leave a shoulder hole or a floating collar corner.
    if profile == 'slim':
        shoulder_joins = [
            [(300, 202), (338, 178), (366, 158)],
            [(658, 158), (686, 178), (724, 202)],
        ]
    else:
        shoulder_joins = [
            [(314, 254), (350, 238), (382, 222)],
            [(642, 222), (674, 238), (710, 254)],
        ]
    for join in shoulder_joins:
        draw.line(join, fill=(0, 0, 0), width=7, joint='curve')

    for a, b in zip(_sample_path(inner, rib_count), _sample_path(outer, rib_count)):
        draw.line([a, b], fill=(0, 0, 0), width=2)
    for a, b in zip(_sample_path(top, top_rib_count), _sample_path(back_lower, top_rib_count)):
        draw.line([a, b], fill=(0, 0, 0), width=2)


def draw_clean_boxy_vneck(draw):
    top = _quad((392, 204), (512, 222), (632, 204), 48)
    back_lower = _quad((400, 232), (512, 244), (624, 232), 48)
    outer = [(384, 224), (425, 306), (476, 384), (512, 432),
             (548, 384), (599, 306), (640, 224)]
    inner = [(428, 236), (466, 308), (512, 374), (558, 308), (596, 236)]
    for pts in (top, back_lower, outer, inner):
        _draw_path(draw, pts, width=5)
    for a, b in [((392, 204), (384, 224)), ((632, 204), (640, 224)),
                 ((400, 232), (428, 236)), ((624, 232), (596, 236)),
                 ((314, 254), (384, 224)), ((640, 224), (710, 254))]:
        draw.line([a, b], fill=(0, 0, 0), width=5)
    draw.line([(314, 254), (350, 238), (384, 224)], fill=(0, 0, 0), width=7, joint='curve')
    draw.line([(640, 224), (674, 238), (710, 254)], fill=(0, 0, 0), width=7, joint='curve')
    for a, b in zip(_sample_path(inner, 34), _sample_path(outer, 34)):
        draw.line([a, b], fill=(0, 0, 0), width=2)
    for a, b in zip(_sample_path(top, 26), _sample_path(back_lower, 26)):
        draw.line([a, b], fill=(0, 0, 0), width=2)


def _line_mask(size, pts, width):
    img = Image.new('L', size, 0)
    draw = ImageDraw.Draw(img)
    draw.line(pts, fill=255, width=width, joint='curve')
    radius = width // 2
    for x, y in pts:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=255)
    return np.asarray(img) > 0


def _poly_mask(size, pts):
    return polygon(size, pts)


def _dilate_inside(mask, limit, iterations=2):
    return (mask | (ndimage.binary_dilation(mask, iterations=iterations) & limit))


def rebuild(variant):
    if variant in ('slim-scoop', 'boxy-scoop', 'boxy-vneck', 'boxy-crew', 'boxy-thin-crew', 'boxy-deep-vneck', 'boxy-polo'):
        from rebuild_reference_necks import composite
        composite(variant)
        return
    spec = SPECS[variant]
    base = Image.open(SRC / 'slim-vneck-lineart-bold.png').convert('RGB')
    if variant == 'slim-scoop':
        result = base.copy()
        draw = ImageDraw.Draw(result)
        draw.polygon(
            [(326, 120), (382, 92), (512, 96), (642, 92), (700, 120),
             (724, 240), (680, 390), (600, 488), (512, 494),
             (424, 488), (344, 390), (300, 240)],
            fill=(255, 255, 255),
        )
        draw_reference_scoop(draw, profile='slim')
        if not np.array_equal(np.asarray(result)[500:], np.asarray(base)[500:]):
            raise AssertionError('Collar replacement changed the lower garment')
        result.save(SRC / f'{variant}-composite-bold.png')
        (SRC / '_diag').mkdir(exist_ok=True)
        result.crop((300, 75, 720, 490)).save(SRC / f'_diag/{variant}-repaired.png')
        return
    if variant in ('boxy-scoop', 'boxy-vneck'):
        result = Image.open(SRC / 'boxy-tshirt-composite-bold.png').convert('RGB')
        draw = ImageDraw.Draw(result)
        draw.polygon(
            [(320, 176), (390, 148), (512, 160), (634, 148), (704, 176),
             (710, 270), (652, 410), (560, 520), (512, 560),
             (464, 520), (372, 410), (314, 270)],
            fill=(255, 255, 255),
        )
        if variant == 'boxy-scoop':
            draw_reference_scoop(draw, profile='boxy')
        else:
            draw_clean_boxy_vneck(draw)
        result.save(SRC / f'{variant}-composite-bold.png')
        (SRC / '_diag').mkdir(exist_ok=True)
        result.crop((300, 160, 724, 530)).save(SRC / f'_diag/{variant}-redrawn.png')
        return
    if variant in ('boxy-deep-vneck',):
        raise ValueError('boxy-deep-vneck uses the generic composite and custom fill ownership only')
    donor = Image.open(SRC / f'{variant}-lineart-bold.png').convert('RGB')
    if base.size != (1024,1536) or donor.size != base.size:
        raise ValueError('Re-measure landmarks before changing raster dimensions')
    aligned = donor.transform(base.size, Image.Transform.AFFINE,
        (1/spec['sx'],0,-spec['dx']/spec['sx'],0,1/spec.get('sy',1),-spec['dy']/spec.get('sy',1)),
        resample=Image.Resampling.BICUBIC, fillcolor='white')
    paste = polygon(base.size, points(spec,spec['boundary']))
    erase = polygon(base.size, [(389,142),(354,159),(351,197),(372,260),
        (423,326),(512,390),(600,326),(652,260),(672,197),(669,159),
        (637,142),(600,110),(420,110)])
    out = np.asarray(base).copy()
    out[erase] = 255
    out[paste] = np.asarray(aligned)[paste]
    result = Image.fromarray(out)
    draw = ImageDraw.Draw(result)
    for join in spec['joins']:
        draw.line(join, fill=(0,0,0), width=4)
    if variant == 'slim-scoop':
        # Recreate the lower edge of the rear neck binding after narrowing the
        # donor scoop. Without this line the back binding fill has no second
        # outline and appears to spill into the inner back neck.
        draw.line(
            [(366, 166), (430, 183), (512, 189), (594, 183), (658, 166)],
            fill=(0, 0, 0),
            width=4,
            joint='curve',
        )
        draw.line([(350, 166), (366, 166), (366, 155)], fill=(0, 0, 0), width=4)
        draw.line([(658, 154), (658, 166), (676, 164)], fill=(0, 0, 0), width=4)
    if variant == 'slim-polo':
        # Preserve the complete bottom edge and both corners of the placket.
        draw.line(points(spec,[(493,477),(527,477)]),fill=(0,0,0),width=3)
    if not np.array_equal(np.asarray(result)[500:],np.asarray(base)[500:]):
        raise AssertionError('Collar replacement changed the lower garment')
    result.save(SRC / f'{variant}-composite-bold.png')
    (SRC / '_diag').mkdir(exist_ok=True)
    result.crop((300,75,720,490)).save(SRC / f'_diag/{variant}-repaired.png')


def rebuild_fills(variant, masks, ink):
    spec = SPECS[variant]
    labels,_ = ndimage.label(~ink)
    hx,hy = spec['hole']
    hole_id = int(labels[hy,hx])
    hole = labels == hole_id
    if hole_id == 0 or not spec['min_hole'] < hole.sum() < 80000:
        raise ValueError(f'{variant}: opening is not enclosed')
    selector = polygon((ink.shape[1],ink.shape[0]),points(spec,spec['selector']))
    neck = np.zeros_like(ink)
    for index,box in enumerate(ndimage.find_objects(labels),start=1):
        if index == hole_id:
            continue
        cell = labels[box] == index
        if not 4 <= cell.sum() <= 50000:
            continue
        y,x = np.nonzero(cell)
        cy,cx = int(round(y.mean()))+box[0].start,int(round(x.mean()))+box[1].start
        if selector[cy,cx]:
            neck[box] |= cell
    neck |= ndimage.binary_dilation(neck,iterations=3) & ink
    hole |= ndimage.binary_dilation(hole,iterations=3) & ink
    fabric = masks['Body'] | masks['Neck'] | masks['Inner back neck']
    masks['Neck'] = neck
    masks['Inner back neck'] = hole & ~neck
    masks['Body'] = fabric & ~hole & ~neck
    if variant == 'slim-scoop':
        nape = polygon(
            (ink.shape[1], ink.shape[0]),
            [(382, 132), (642, 132), (646, 163), (512, 184),
             (378, 163)],
        )
        nape &= fabric
        masks['Neck'] |= nape
        masks['Inner back neck'] &= ~nape
        masks['Body'] &= ~nape
    if masks['Body'].sum() < 400000 or neck.sum() < 5000:
        raise ValueError(f'{variant}: incomplete fabric coverage')
    return int(neck.sum())


BOXY_NECK_SELECTORS = {
    'boxy-crew': [(372, 198), (652, 198), (680, 236), (657, 318),
                  (600, 374), (512, 392), (424, 374), (367, 318),
                  (344, 236)],
    'boxy-vneck': [(360, 198), (664, 198), (676, 246), (630, 332),
                  (560, 436), (512, 476), (464, 436), (394, 332),
                  (348, 246)],
    'boxy-deep-vneck': [(390, 210), (634, 210), (666, 238), (644, 330),
                        (604, 438), (540, 558), (512, 586), (484, 558),
                        (420, 438), (380, 330), (358, 238)],
    'boxy-scoop': [(350, 196), (674, 196), (672, 270), (636, 360),
                   (580, 428), (512, 454), (444, 428), (388, 360),
                   (352, 270)],
    'boxy-thin-crew': [(380, 210), (644, 210), (662, 244), (642, 314),
                       (590, 352), (512, 365), (434, 352), (382, 314),
                       (362, 244)],
}


def clip_boxy_neck_fills(variant, masks, ink):
    selector_points = BOXY_NECK_SELECTORS.get(variant)
    if selector_points is None:
        return 0
    fabric = masks['Body'] | masks['Neck'] | masks['Inner back neck']
    selector = polygon((ink.shape[1], ink.shape[0]), selector_points)
    removed = masks['Neck'] & ~selector
    masks['Neck'] &= selector
    masks['Inner back neck'] &= ~masks['Neck']
    masks['Body'] = (fabric & ~masks['Inner back neck'] & ~masks['Neck']) | removed
    if masks['Body'].sum() < 400000 or masks['Neck'].sum() < 3000:
        raise ValueError(f'{variant}: boxy collar clip removed too much fabric')
    return int(removed.sum())


BOXY_CLEAN_NECKS = {
    'slim-scoop': [
        ('poly', [(382, 132), (642, 132), (658, 158), (658, 220),
                  (650, 300), (606, 380), (548, 424), (512, 430),
                  (476, 424), (418, 380), (374, 300), (366, 220),
                  (366, 158)]),
    ],
    'boxy-crew': [
        ('line', [(386, 224), (440, 284), (512, 306), (584, 284), (638, 224)], 46),
        ('line', [(386, 222), (452, 242), (512, 248), (572, 242), (638, 222)], 36),
    ],
    'boxy-thin-crew': [
        ('line', [(390, 225), (444, 270), (512, 286), (580, 270), (634, 225)], 32),
        ('line', [(390, 222), (454, 238), (512, 242), (570, 238), (634, 222)], 28),
    ],
    'boxy-scoop': [
        ('poly', [(390, 204), (634, 204), (642, 222), (638, 300),
                  (598, 368), (546, 406), (512, 414), (478, 406),
                  (426, 368), (386, 300), (382, 222)]),
    ],
    'boxy-vneck': [
        ('poly', [(392, 204), (632, 204), (640, 224), (599, 306),
                  (548, 384), (512, 432), (476, 384), (425, 306),
                  (384, 224)]),
    ],
    'boxy-deep-vneck': [
        ('line', [(392, 224), (438, 360), (512, 548), (586, 360), (632, 224)], 42),
        ('line', [(392, 222), (456, 240), (512, 246), (568, 240), (632, 222)], 34),
    ],
    'boxy-polo': [
        ('poly', [(404, 218), (620, 218), (612, 260), (412, 260)]),
        ('poly', [(338, 222), (438, 244), (405, 336), (288, 306), (302, 258)]),
        ('poly', [(686, 222), (586, 244), (619, 336), (736, 306), (722, 258)]),
        ('poly', [(398, 232), (462, 260), (518, 540), (490, 556), (382, 274)]),
        ('poly', [(626, 232), (562, 260), (506, 540), (534, 556), (642, 274)]),
    ],
}


BOXY_CLEAN_INNERS = {
    'slim-scoop': [(414, 166), (610, 166), (606, 268), (554, 358),
                   (528, 368), (512, 372), (496, 368), (470, 358),
                   (418, 268)],
    'boxy-crew': [(424, 240), (600, 240), (584, 282), (512, 308),
                  (440, 282)],
    'boxy-thin-crew': [(424, 238), (600, 238), (572, 270), (512, 286),
                       (452, 270)],
    'boxy-scoop': [(428, 234), (596, 234), (588, 292), (558, 342),
                   (528, 362), (512, 366), (496, 362), (466, 342),
                   (436, 292)],
    'boxy-vneck': [(428, 236), (596, 236), (512, 374)],
    'boxy-deep-vneck': [(420, 242), (604, 242), (512, 500)],
    'boxy-polo': [(448, 266), (576, 266), (512, 492)],
}


def rebuild_boxy_clean_fills(variant, masks, ink):
    shapes = BOXY_CLEAN_NECKS.get(variant)
    if not shapes:
        return 0

    fabric = masks['Body'] | masks['Neck'] | masks['Inner back neck']
    size = (ink.shape[1], ink.shape[0])
    neck = np.zeros_like(ink)
    for shape in shapes:
        if shape[0] == 'line':
            _, pts, width = shape
            neck |= _line_mask(size, pts, width)
        else:
            _, pts = shape
            neck |= _poly_mask(size, pts)

    inner_points = BOXY_CLEAN_INNERS.get(variant)
    inner_source = (
        polygon(size, inner_points) & fabric
        if inner_points
        else masks['Inner back neck'] & fabric
    )
    neck = _dilate_inside(neck & fabric, fabric, iterations=1)
    inner = inner_source & fabric
    neck &= ~inner
    body = fabric & ~inner & ~neck
    if body.sum() < 400000 or neck.sum() < 3000:
        raise ValueError(f'{variant}: clean collar rebuild removed too much fabric')
    masks['Neck'] = neck
    masks['Inner back neck'] = inner
    masks['Body'] = body
    return int(neck.sum())


NECK_STITCH_BLACKENERS = {
    'slim-scoop': [(310, 115), (714, 115), (730, 200), (690, 410),
                   (610, 520), (512, 555), (414, 520), (334, 410),
                   (294, 200)],
    'boxy-crew': [(330, 185), (694, 185), (704, 255), (650, 360),
                  (512, 410), (374, 360), (320, 255)],
    'boxy-thin-crew': [(330, 185), (694, 185), (704, 250), (642, 340),
                       (512, 378), (382, 340), (320, 250)],
    'boxy-scoop': [(320, 185), (704, 185), (716, 280), (662, 450),
                   (512, 530), (362, 450), (308, 280)],
    'boxy-vneck': [(320, 185), (704, 185), (704, 280), (620, 410),
                   (512, 500), (404, 410), (320, 280)],
    'boxy-deep-vneck': [(330, 185), (694, 185), (710, 320), (620, 500),
                        (512, 620), (404, 500), (314, 320)],
    'boxy-polo': [(285, 170), (739, 170), (760, 330), (620, 610),
                  (512, 620), (404, 610), (264, 330)],
}


def blacken_neck_stitches(variant, stitches):
    zone = NECK_STITCH_BLACKENERS.get(variant)
    if zone is None:
        return 0
    mask = polygon((stitches.shape[1], stitches.shape[0]), zone)
    removed = stitches & mask
    stitches[removed] = False
    return int(removed.sum())


if __name__ == '__main__':
    from pack_studio_neck_variant import pack
    for variant in sys.argv[1:] or SPECS:
        rebuild(variant)
        pack(variant,probe_only=False)
