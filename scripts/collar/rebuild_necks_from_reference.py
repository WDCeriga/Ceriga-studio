"""Rebuild crew / V / deep-V neck parts from the reference flats, for every fit.

Raster first, then trace. Nothing here authors path data:

1. The reference front half is keyed (repo luminance ramp, chroma fill dropped).
2. Its neck drawing is registered to a fit's shoulder/neck corners and composited
   into that fit's untouched base raster (git original kept in refs/neck-refs).
3. All ink is thinned to the light outline weight, then keyed again and traced by
   Potrace through the shared pack_studio_neck_variant writers.

Usage: python rebuild_necks_from_reference.py [fit-neck ...]
       fit in slim|regular|boxy|oversized, neck in crew|vneck|deep-vneck
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import pack_studio_neck_variant as P
from trace_reference_neck import ink_alpha

SRC = P.SRC
REFS = Path(__file__).parent / 'refs' / 'neck-refs'
BUILD = REFS / 'build'
PACK = P.SRC.parent / 'tshirt-necks'
FITS = ('slim', 'regular', 'boxy', 'oversized')
NECKS = ('crew', 'vneck', 'deep-vneck')
REFERENCE = {'crew': 'ref-a.png', 'deep-vneck': 'ref-b.png', 'vneck': 'ref-c.png'}
BASE = {'slim': 'slim-crew-composite-bold.png', 'regular': 'regular-tshirt-composite-bold.png',
        'boxy': 'boxy-tshirt-composite-bold.png', 'oversized': 'oversized-tshirt-composite-bold.png'}

TARGET_PX = 2.0  # outline width on the 1024-wide raster (zip outline weight on the 2048 canvas is ~2 units)
LEFT, RIGHT = 330, 694
SEEDS = {
    'slim': dict(sleeves=((133, 507), (888, 507)), cuffs=(((91, 597),), ((944, 592),)), hem=((230, 1349),)),
    'regular': dict(sleeves=((120, 600), (900, 600)), cuffs=(((100, 700),), ((920, 700),)), hem=((512, 1260),)),
    'boxy': dict(sleeves=((128, 556), (894, 556)),
        cuffs=(((44, 631), (116, 674), (175, 703)), ((872, 695), (927, 656), (986, 627))), hem=((227, 1302),)),
    'oversized': dict(sleeves=((120, 600), (900, 600)), cuffs=(((100, 745),), ((920, 745),)), hem=((512, 1260),)),
}


def names(fit, neck):
    """Asset names follow the catalog: slim is unsuffixed, other fits use (fit)."""
    sfx = '' if fit == 'slim' else f' ({fit})'
    if fit == 'slim':
        return {'crew': dict(Body='Body crew', Neck='Crew neck', Inner='Inner back neck crew',
                    Outline='Outline crew', Stitch='Cover stitch crew'),
                'vneck': dict(Body='Body', Neck='V-neck', Inner='Inner back neck',
                    Outline='Outline', Stitch='Cover stitch'),
                'deep-vneck': dict(Body='Body deep V-neck', Neck='Deep V-neck', Inner='Inner back neck deep V-neck',
                    Outline='Outline deep V-neck', Stitch='Cover stitch deep V-neck')}[neck]
    label = {'crew': ('', 'Crew neck'), 'vneck': (' V-neck', 'V-neck'), 'deep-vneck': (' Deep V-neck', 'Deep V-neck')}[neck]
    return dict(Body=f'Body{label[0]}{sfx}', Neck=f'{label[1]}{sfx}', Inner=f'Inner back neck{label[0]}{sfx}',
        Outline=f'Outline{label[0]}{sfx}', Stitch=f'Cover stitch{label[0]}{sfx}')


def thin_ink(ink: np.ndarray, remove: float) -> np.ndarray:
    """Erode ink by `remove` px per side; strokes already as fine as the target stay whole."""
    from skimage.morphology import skeletonize
    edt = ndi.distance_transform_edt(ink)
    keep = edt > remove
    skel = skeletonize(ink)
    _, (iy, ix) = ndi.distance_transform_edt(~skel, return_indices=True)
    local_w = 2 * edt[iy, ix]
    fine = ink & (local_w <= 2 * remove + 2.5)
    return keep | fine


def thin_base(base: Image.Image, old_px: float = 4.0, scale: int = 3) -> np.ndarray:
    gray = base.convert('L')
    big = gray.resize((gray.width * scale, gray.height * scale), Image.BICUBIC)
    ink = np.asarray(big) < 160
    thin = thin_ink(ink, (old_px - TARGET_PX) / 2 * scale)
    out = Image.fromarray(np.where(thin, 0, 255).astype(np.uint8)).resize(gray.size, Image.BOX)
    return np.asarray(out).astype(np.float32)


def top_corners(ink: np.ndarray, x0: int, x1: int, centre: int, rows: int) -> tuple[int, int, float]:
    top = np.full(ink.shape[1], 10 ** 6)
    for x in range(x0, x1):
        hits = np.flatnonzero(ink[:rows, x])
        if hits.size:
            top[x] = hits[0]
    left = x0 + int(np.argmin(top[x0:centre]))
    right = centre + int(np.argmin(top[centre:x1]))
    return left, right, (top[left] + top[right]) / 2


def donor_for(neck: str, base_ink: np.ndarray, size: tuple[int, int], view: str = 'front') -> np.ndarray:
    x0 = 0 if view == 'front' else 512
    ref = Image.open(REFS / REFERENCE[neck]).convert('RGB').crop((x0, 0, x0 + 512, 768))
    alpha = ink_alpha(ref)
    # Dark fabric tone in some references reads as ink; true linework is near black.
    alpha[np.asarray(ref.convert('L')) > 118] = 0
    # The reference is cropped at the hem; drop that crop edge, it is not garment.
    last = int(np.flatnonzero((alpha > 0.5).any(axis=1))[-1])
    alpha[last - 10:] = 0
    hi = 4
    big = Image.fromarray((alpha * 255).astype(np.uint8)).resize((512 * hi, 768 * hi), Image.LANCZOS)
    ref_ink = np.asarray(big) >= 128
    # Faint rib-texture specks in the reference are not linework.
    comp, _ = ndi.label(ref_ink, np.ones((3, 3)))
    areas = np.bincount(comp.ravel())
    ref_ink &= areas[comp] >= 260
    rl, rr, ry = top_corners(ref_ink, 100 * hi, 415 * hi, 258 * hi, 400 * hi)
    rl, rr, ry = rl / hi, rr / hi, ry / hi
    bl, br, by = top_corners(base_ink, 280, 744, 512, 500)
    s = (br - bl) / (rr - rl)
    remove = max(0.0, (2.0 * hi - TARGET_PX / s * hi) / 2)
    thin = thin_ink(ref_ink, remove)
    scaled = Image.fromarray(np.where(thin, 0, 255).astype(np.uint8)).resize(
        (round(512 * s), round(768 * s)), Image.BOX)
    # Box-filtering a ~2px line leaves it pale; deepen it so the key keeps every edge.
    scaled = Image.fromarray(np.clip(255 - (255 - np.asarray(scaled).astype(np.float32)) * 1.8, 0, 255).astype(np.uint8))
    donor = Image.new('L', size, 255)
    donor.paste(scaled, (round(bl - rl * s), round(by - ry * s)))
    return np.asarray(donor).astype(np.float32), (bl, br)


def composite(fit: str, neck: str, view: str = 'front') -> Image.Image:
    base = Image.open(REFS / f'base-{fit}.png').convert('RGB')
    a = thin_base(base)
    donor, (bl, br) = donor_for(neck, a < 128, base.size, view)
    b = donor.copy()
    # Shoulder join: ease the donor's vertical offset to zero at the neck corners.
    for edge, stop in ((LEFT, bl - 10), (RIGHT - 1, br + 10)):
        base_y = np.flatnonzero(a[:400, edge] < 128)[0]
        donor_y = np.flatnonzero(b[:400, edge] < 128)[0]
        delta = int(base_y) - int(donor_y)
        for x in range(min(edge, stop), max(edge, stop) + 1):
            shift = round(delta * abs(x - stop) / abs(edge - stop))
            b[:, x] = ndi.shift(b[:, x], shift, order=0, cval=255)
    a[:650, LEFT:RIGHT] = b[:650, LEFT:RIGHT]
    lab, n = ndi.label(b[:650, LEFT:RIGHT] < 128)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl[0].start > 400 and (lab[sl] == i).sum() < 300:
            a[:650, LEFT:RIGHT][lab == i] = 255
    out = Image.fromarray(a.astype(np.uint8)).convert('RGB')
    BUILD.mkdir(parents=True, exist_ok=True)
    out.save(BUILD / (f'{fit}-{neck}-composite.png' if view == 'front' else f'{fit}-{neck}-back-composite.png'))
    return out


def write_pack(fit: str, neck: str, view: str, finish: str, part: str, svg: str) -> None:
    PACK.mkdir(parents=True, exist_ok=True)
    target = PACK / f'{fit}.{neck}.{view}.{finish}.{part}.svg'
    target.write_text(svg, encoding='utf-8')
    print(f'  pack/{target.name}  {target.stat().st_size / 1024:.0f} KB', flush=True)


def with_ribs(svg: str, ribs: np.ndarray) -> str:
    """Rib texture is traced from the same raster pipeline and sits under the outline as a faint layer."""
    import re
    d = P.G.trace(ribs)
    if not d:
        return svg
    group = f'<g transform="translate(0,2048) scale(0.1,-0.1)" fill="#141414" opacity="0.16" data-neck-ribs="true"><path d="{d}" fill-rule="evenodd"/></g>\n'
    return re.sub(r'</svg>\s*$', group + '</svg>\n', svg)


def rib_mask(ring: np.ndarray, inner: np.ndarray | None, front: bool, pitch: float = 8.5) -> np.ndarray:
    """One hairline rib every `pitch` px along the band centre line, across the band width."""
    import cv2
    edt = ndi.distance_transform_edt(ring)
    ys, xs = np.nonzero(ring)
    if front:
        region = ring | inner
        ry, rx = np.nonzero(region)
        cx, cy = rx.mean(), ry.mean()
    else:
        cx, cy = xs.mean(), ys.min() + 520
    angles = np.linspace(-np.pi, np.pi, 1440, endpoint=False)
    radii = np.arange(5, 900, 0.5)
    centre_pts = []
    for theta in angles:
        px = np.round(cx + radii * np.cos(theta)).astype(int)
        py = np.round(cy + radii * np.sin(theta)).astype(int)
        ok = (px >= 0) & (px < ring.shape[1]) & (py >= 0) & (py < ring.shape[0])
        px, py = px[ok], py[ok]
        vals = np.where(ring[py, px], edt[py, px], 0)
        if vals.size and vals.max() > 2.0:
            i = int(np.argmax(vals))
            centre_pts.append((px[i], py[i], vals[i]))
        else:
            centre_pts.append(None)
    canvas = np.zeros(ring.shape, np.uint8)
    run = []
    runs = []
    for pt in centre_pts + [None]:
        if pt is None:
            if len(run) > 4:
                runs.append(run)
            run = []
        else:
            run.append(pt)
    for run in runs:
        travelled = 0.0
        next_at = pitch / 2
        for i in range(1, len(run) - 1):
            step = np.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1])
            travelled += step
            if travelled < next_at:
                continue
            next_at += pitch
            a, b = run[max(0, i - 3)], run[min(len(run) - 1, i + 3)]
            tx, ty = b[0] - a[0], b[1] - a[1]
            norm = np.hypot(tx, ty) or 1.0
            nx, ny = -ty / norm, tx / norm
            half = run[i][2] + 1
            cv2.line(canvas, (int(run[i][0] - nx * half), int(run[i][1] - ny * half)),
                     (int(run[i][0] + nx * half), int(run[i][1] + ny * half)), 255, 1)
    return (canvas > 0) & ndi.binary_erosion(ring, iterations=2)


def inner_seed(cells: np.ndarray, body_id: int) -> int:
    """First sizeable enclosed cell below the neck top on the centre column."""
    seen = []
    for y in range(120, 700):
        label = int(cells[y, 512])
        if label and label not in seen and label != cells[0, 0] and label != body_id:
            seen.append(label)
    # The opening is the first cell tall on the centre column; the back band strip above it is thin.
    tall = [l for l in seen if np.count_nonzero(cells[120:700, 512] == l) > 60]
    assert tall, ('no inner opening', seen)
    return tall[0]


def neck_stitch(ring: np.ndarray, body: np.ndarray, offset: int = 6, dash: float = 9.0, gap: float = 6.0) -> np.ndarray:
    """Cover-stitch dashes on the body, parallel to the band's outer edge, on the arc length of that edge."""
    import cv2
    grown = ndi.binary_dilation(ring, iterations=offset)
    cnts, _ = cv2.findContours(grown.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    canvas = np.zeros(ring.shape, np.uint8)
    for cnt in cnts:
        pts = cnt[:, 0, :].astype(np.float32)
        if len(pts) < 40:
            continue
        pts = np.stack([ndi.uniform_filter1d(pts[:, 0], 9, mode='wrap'), ndi.uniform_filter1d(pts[:, 1], 9, mode='wrap')], 1)
        step = np.hypot(*np.diff(pts, axis=0, append=pts[:1]).T)
        s = np.cumsum(step)
        on = (s % (dash + gap)) < dash
        for i in range(len(pts) - 1):
            if on[i] and on[i + 1]:
                cv2.line(canvas, tuple(np.round(pts[i]).astype(int)), tuple(np.round(pts[i + 1]).astype(int)), 255, 2)
    safe = ndi.binary_erosion(body, iterations=5)
    return (canvas > 0) & safe & ~ndi.binary_dilation(ring, iterations=offset - 2)


def regularize(variant: str, owners: np.ndarray, stitches: np.ndarray, back_band: bool = False) -> None:
    """Second raster pass: redraw the neck linework from the segmented regions.

    The reference's rib texture and hand-drawn wobble survive keying as dark blobs and broken dashes.
    Region boundaries (exterior / body / band / opening) are smoothed, mirrored about the centre line and
    redrawn as uniform thin anti-aliased lines, then the same key + trace pipeline runs on that raster.
    """
    import cv2
    x0, x1, y1, up = 300, 724, 650, 3
    crop = owners[:y1, x0:x1].copy()
    if back_band:
        # The V reference shows no back-neck band; give it one matching the other necks (inner top edge, ~18 px).
        to_exterior = ndi.distance_transform_edt(crop != 0)
        crop[(crop == 2) & (to_exterior <= 18)] = 3
    h, w = crop.shape
    best = None
    score = np.full((h * up, w * up), -1.0, np.float32)
    best = np.zeros((h * up, w * up), np.uint8)
    for label in (0, 1, 2, 3):
        field = cv2.resize((crop == label).astype(np.float32), (w * up, h * up), interpolation=cv2.INTER_NEAREST)
        field = cv2.GaussianBlur(field, (0, 0), 16.0)
        take = field > score
        best[take] = label
        score[take] = field[take]
    half = best.shape[1] // 2
    best[:, half:] = best[:, :half][:, ::-1]
    edge = np.zeros(best.shape, bool)
    edge[:, :-1] |= best[:, :-1] != best[:, 1:]
    edge[:-1, :] |= best[:-1, :] != best[1:, :]
    line = cv2.dilate(edge.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))).astype(np.float32)
    coverage = cv2.resize(line, (w, h), interpolation=cv2.INTER_AREA)
    ink = np.clip(coverage * 1.8, 0, 1)

    comp = np.array(Image.open(BUILD / f'{variant}-composite.png').convert('L')).astype(np.float32)
    ring_zone = ndi.binary_dilation(owners >= 2, iterations=16)
    keep_stitch = stitches & ~ring_zone
    window = comp[:y1, x0:x1].copy()
    mine = 255 - ink * 255
    old = window.copy()
    sl = (slice(0, y1), slice(30, w - 30))
    window[sl] = mine[sl]
    stitch_px = keep_stitch[:y1, x0:x1] & (old < 200)
    window[stitch_px] = np.minimum(window[stitch_px], old[stitch_px])
    comp[:y1, x0:x1] = window
    Image.fromarray(comp.astype(np.uint8)).convert('RGB').save(BUILD / f'{variant}-composite.png')


def rebuild(fit: str, neck: str, view: str = 'front', clean_pass: bool = False) -> None:
    front = view == 'front'
    variant = f'{fit}-{neck}' + ('' if front else '-back')
    nm = names(fit, neck)
    if not clean_pass:
        composite(fit, neck, view)
    keyed = P.key_lineart(BUILD / f'{variant}-composite.png')
    # Hairline breaks of a few px in a solid line would let fills leak between cells.
    alpha = np.asarray(keyed)[:, :, 3] >= 128
    comp, _ = ndi.label(alpha, np.ones((3, 3)))
    big = alpha & (np.bincount(comp.ravel())[comp] > 160)
    closed = ndi.binary_closing(big, structure=np.ones((1, 5), bool)) | ndi.binary_closing(
        big, structure=np.ones((5, 1), bool))
    arr = np.array(keyed)
    arr[closed & ~alpha] = (0, 0, 0, 255)
    # Armhole seam meets the shoulder outline with a few px of air in some bases.
    for x0, x1 in ((120, 260), (764, 904)):
        win = np.zeros_like(alpha)
        win[380:470, x0:x1] = True
        disk = np.ones((7, 7), bool)
        joined = ndi.binary_closing(alpha & win, structure=disk) & win & ~alpha
        arr[joined] = (0, 0, 0, 255)
    keyed = Image.fromarray(arr)
    keyed.save(BUILD / f'{variant}-keyed.png')
    ink = np.asarray(keyed)[:, :, 3] >= 128
    cc, _ = ndi.label(ink, np.ones((3, 3)))
    sizes = np.bincount(cc.ravel())
    construction = ink & (sizes[cc] > 160)
    stitches = ink & ~construction
    cells, _ = ndi.label(~construction)
    exterior = cells == cells[0, 0]
    inside = ~exterior
    body_id = int(cells[800, 512])
    inner_id = inner_seed(cells, body_id) if front else -1
    assert body_id and body_id != cells[0, 0], 'Open garment boundary'
    assert np.count_nonzero(cells == body_id) > 300000, 'Open shoulder/body boundary'
    neck_mask = np.zeros_like(ink)
    for label, box in enumerate(ndi.find_objects(cells), 1):
        if box is None or label in (body_id, inner_id, cells[0, 0]):
            continue
        if box[1].start > 300 and box[1].stop < 724 and box[0].stop < 650:
            neck_mask |= cells == label
    inner = cells == inner_id
    body = cells == body_id
    assert neck_mask.sum() > 3000 and (inner.sum() > 4000 or not front), (int(neck_mask.sum()), int(inner.sum()))
    owners = np.zeros_like(cells)
    owners[body] = 1
    owners[inner] = 2
    owners[neck_mask] = 3
    _, nearest = ndi.distance_transform_edt(owners == 0, return_indices=True)
    under_ink = construction & ndi.binary_dilation(owners > 0, iterations=5)
    owners[under_ink] = owners[tuple(nearest)][under_ink]
    masks = {'Body': owners == 1, 'Inner back neck': owners == 2, 'Neck': owners == 3}

    if not clean_pass:
        regularize(variant, owners, stitches, back_band=(neck == 'vneck' and front))
        return rebuild(fit, neck, view, clean_pass=True)

    stitches = stitches | neck_stitch(masks['Neck'], masks['Body'])

    seeds = SEEDS[fit]
    for bridge in (18.0, 24.0, 30.0, 36.0):
        regions = P.G.analyse(BUILD / f'{variant}-keyed.png', P.G.Settings(bridge=bridge))
        sizes_ok = all(int(regions.mask(regions.labels[y, x]).sum()) < 160000 for x, y in seeds['sleeves'])
        if sizes_ok:
            break
    sfx = '' if fit == 'slim' else f' ({fit})'
    claimed = set()
    for category, points in (('Left sleeve', (seeds['sleeves'][0],)), ('Right sleeve', (seeds['sleeves'][1],)),
                             ('Left cuff', seeds['cuffs'][0]), ('Right cuff', seeds['cuffs'][1]),
                             ('Body hem', seeds['hem'])):
        mask = np.zeros_like(ink)
        for x, y in points:
            rid = regions.labels[y, x]
            assert rid, (variant, category, 'missing raster region', (x, y))
            if rid in claimed:
                continue
            claimed.add(rid)
            mask |= regions.mask(rid)
        mask &= inside | construction
        assert 300 < mask.sum() < 160000, (variant, category, int(mask.sum()))
        mask = ndi.binary_dilation(mask, iterations=2) & (inside | construction)
        masks['Body'] |= mask
        if front:
            P.write_part(category, category + sfx, P.wrap_fill_only(category, mask))

    title = f'{fit} {neck} reference rebuild'
    if front:
        P.write_part('Body', nm['Body'], P.wrap_fill_only(title + ' Body', masks['Body']))
        P.write_part('Neck', nm['Neck'], P.wrap_fill_only(title + ' Neck', masks['Neck']))
        P.write_part('Inner back neck', nm['Inner'], P.wrap_fill_only(title + ' Inner', masks['Inner back neck']))
        P.write_part('Outline', nm['Outline'], P.wrap_ink(title, construction))
        P.write_part('Stitching', nm['Stitch'], P.wrap_fill_only(title + ' stitches', stitches))

    # Finish variants share the one traced garment: ribbed adds a faint rib texture inside the band,
    # raw absorbs the band into the opening/body and drops its seam line.
    ring = masks['Neck']
    near = lambda m, r=3: ndi.binary_dilation(m, iterations=r)
    other = near(masks['Inner back neck']) if front else near(masks['Body'])
    seam = construction & near(ring) & other & ~near(exterior) & (~near(masks['Body']) if front else True)
    raw_outline = construction & ~seam
    if front:
        # Raw front: the band, back strip and opening all become the cut-out; only the edge against the body stays.
        window = np.zeros_like(construction)
        window[:650, LEFT:RIGHT] = True
        raw_outline = construction & (~window | ndi.binary_dilation(masks['Body'], iterations=2))
        lab, count = ndi.label(raw_outline & window, np.ones((3, 3)))
        for i, size in enumerate(np.bincount(lab.ravel())[1:], 1):
            if size < 60 and not (ndi.binary_dilation(lab == i, iterations=2) & raw_outline & ~window).any():
                raw_outline[lab == i] = False
    raw_stitches = stitches & ~ndi.binary_dilation(ring, iterations=16)
    pack_title = f'{title} {view}'
    ribs = rib_mask(ring, inner if front else None, front)
    pack = {
        ('ribbed', 'outline'): with_ribs(P.wrap_ink(pack_title, construction), ribs),
        ('clean', 'outline'): P.wrap_ink(pack_title, construction),
        ('raw', 'outline'): P.wrap_ink(pack_title + ' raw', raw_outline),
        ('raw', 'stitching'): P.wrap_fill_only(pack_title + ' raw stitches', raw_stitches),
    }
    if front:
        pass
    else:
        pack[('ribbed', 'body')] = P.wrap_fill_only(pack_title + ' Body', masks['Body'])
        pack[('ribbed', 'neck')] = P.wrap_fill_only(pack_title + ' Neck', ring)
        pack[('ribbed', 'stitching')] = P.wrap_fill_only(pack_title + ' stitches', stitches)
        pack[('raw', 'body')] = P.wrap_fill_only(pack_title + ' raw Body', masks['Body'] | ring | seam)
    for (finish, part), svg in pack.items():
        write_pack(fit, neck, view, finish, part, svg)

    proof = np.full((*ink.shape, 3), 255, dtype=np.uint8)
    proof[inside] = (94, 128, 178)
    proof[masks['Inner back neck']] = (149, 172, 205)
    proof[masks['Neck']] = (204, 45, 36)
    proof[ink] = (20, 20, 20)
    proof[stitches] = (230, 230, 230)
    Image.fromarray(proof).save(BUILD / f'{variant}-proof.png')
    print(variant, 'neck', int(neck_mask.sum()), 'inner', int(inner.sum()), flush=True)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    views = ('back',) if '--back-only' in sys.argv else ('front', 'back')
    targets = args or [f'{f}-{n}' for f in FITS for n in NECKS]
    for target in targets:
        fit, neck = target.split('-', 1)
        for view in views:
            rebuild(fit, neck, view)
