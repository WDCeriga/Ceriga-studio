"""Reference raster -> keyed ink -> closed regions -> Potrace website parts.

No collar curves are synthesized: scoop comes from scoop-reference-redraw.png,
V comes from the approved slim-vneck-lineart-bold.png. Shared fit rasters supply
the silhouette. All colour boundaries are connected components of that ink.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import pack_studio_neck_variant as P

SRC = P.SRC
BOXY_VARIANTS = ('boxy-crew', 'boxy-thin-crew', 'boxy-vneck', 'boxy-deep-vneck', 'boxy-polo', 'boxy-scoop')


def specification(variant):
    if variant == 'oversized-crew':
        spec = specification('regular-crew')
        return {**spec, 'art': 'oversized-crew-reference-composite.png',
            'keyed': 'oversized-crew-reference-keyed.png', 'title': 'Oversized crew neck',
            'outline': 'Outline (oversized)', 'stitch': 'Cover stitch (oversized)',
            'seeds': [dict(category=s['category'], asset=s['asset'].replace('(regular)', '(oversized)')) for s in spec['seeds']]}
    if variant == 'regular-crew':
        return dict(art='regular-crew-reference-composite.png', keyed='regular-crew-reference-keyed.png',
            title='Regular crew neck', outline='Outline (regular)', stitch='Cover stitch (regular)',
            seeds=[dict(category=c, asset=a) for c, a in (
                ('Body', 'Body (regular)'), ('Neck', 'Crew neck (regular)'),
                ('Inner back neck', 'Inner back neck (regular)'))])
    if variant != 'boxy-crew':
        return P.VARIANTS[variant]
    return dict(art='boxy-crew-reference-composite.png', keyed='boxy-crew-reference-keyed.png',
        title='Boxy crew neck', outline='Outline (boxy)', stitch='Cover stitch (boxy)',
        seeds=[dict(category=c, asset=a) for c, a in (
            ('Body', 'Body (boxy)'), ('Neck', 'Crew neck (boxy)'),
            ('Inner back neck', 'Inner back neck (boxy)'))])


def composite(variant):
    boxy = variant.startswith('boxy')
    regular = variant.startswith(('regular', 'oversized'))
    fit = variant.split('-')[0]
    base = Image.open(SRC / (fit + '-tshirt-composite-bold.png' if regular else 'boxy-tshirt-composite-bold.png' if boxy else 'slim-vneck-lineart-bold.png')).convert('RGB')
    sources = {
        'boxy-crew': ('boxy-tshirt-composite-bold.png', 0),
        'boxy-thin-crew': ('boxy-thin-crew-lineart-bold.png', 14),
        'boxy-deep-vneck': ('boxy-deep-vneck-lineart-bold.png', -32),
        'boxy-polo': ('boxy-polo-lineart-bold.png', -24),
        'boxy-vneck': ('slim-vneck-lineart-bold.png', 70),
        'boxy-scoop': ('scoop-reference-redraw.png', 62),
        'slim-scoop': ('scoop-reference-redraw.png', 0),
    }
    if regular:
        source, dy = sources[variant.replace(fit + '-', 'boxy-')]
        dy += 10
    else:
        source, dy = sources[variant]
    donor = Image.open(SRC / source).convert('RGB')
    # Fit the entire upper drawing to the original shoulder slope. Including
    # shoulder ink avoids the open joins caused by erasing through the seam.
    if dy:
        donor = donor.transform(base.size, Image.Transform.AFFINE,
            (1, 0, 0, 0, 1, -dy), Image.Resampling.BICUBIC, fillcolor='white')
    a = np.asarray(base).copy()
    b = np.asarray(donor).copy()
    # Match the raster shoulder at both crop joins. Fade the vertical offset
    # to zero before reaching collar artwork; do not invent new seam curves.
    left, right = 330, 694
    for edge, stop in ((left, 352), (right - 1, 672)):
        base_y = np.flatnonzero(a[:400, edge].mean(axis=1) < 120)[0]
        donor_y = np.flatnonzero(b[:400, edge].mean(axis=1) < 120)[0]
        delta = int(base_y) - int(donor_y)
        for x in range(min(edge, stop), max(edge, stop) + 1):
            shift = round(delta * abs(x - stop) / abs(edge - stop))
            b[:, x] = ndi.shift(b[:, x], (shift, 0), order=0, cval=255)
    # Only the central chest changes; shared armholes and sleeves stay exact.
    a[:650, left:right] = b[:650, left:right]
    result = Image.fromarray(a)
    result.save(SRC / specification(variant)['art'])
    return result


def rebuild(variant):
    spec = specification(variant)
    composite(variant)
    keyed = P.key_lineart(SRC / spec['art'])
    keyed.save(SRC / spec['keyed'])
    ink = np.asarray(keyed)[:, :, 3] >= 128
    # Detached dashes are detail, never fill boundaries.
    cc, n = ndi.label(ink, np.ones((3, 3)))
    sizes = np.bincount(cc.ravel())
    construction = ink & (sizes[cc] > 160)
    stitches = ink & ~construction
    cells, n = ndi.label(~construction)
    exterior = cells == cells[0, 0]
    inside = ~exterior
    body_id = cells[800, 512]
    inner_y = 310 if variant.startswith(('boxy', 'regular', 'oversized')) else 260
    if variant.endswith(('polo', 'deep-vneck')):
        inner_y = 360
    inner_id = cells[inner_y, 512]
    assert body_id and inner_id and body_id != inner_id
    assert body_id != cells[0, 0] and inner_id != cells[0, 0], 'Open garment boundary'
    assert np.count_nonzero(cells == body_id) > 300000, 'Open shoulder/body boundary'
    # All enclosed collar cells are above chest and between shoulder sockets.
    # This captures every rib in the V-neck, and the plain scoop binding.
    neck = np.zeros_like(ink)
    for label, box in enumerate(ndi.find_objects(cells), 1):
        if box is None or label in (body_id, inner_id, cells[0, 0]):
            continue
        if box[1].start > 300 and box[1].stop < 724 and box[0].stop < 650:
            neck |= cells == label
    inner = cells == inner_id
    body = cells == body_id
    assert neck.sum() > 3000 and inner.sum() > 5000
    # Extend colours only under ink to the nearest enclosed region. This
    # avoids both white hairlines and collar spill outside its black boundary.
    owners = np.zeros_like(cells)
    owners[body] = 1
    owners[inner] = 2
    owners[neck] = 3
    _, nearest = ndi.distance_transform_edt(owners == 0, return_indices=True)
    under_ink = construction & ndi.binary_dilation(owners > 0, iterations=5)
    owners[under_ink] = owners[tuple(nearest)][under_ink]
    masks = {'Body': owners == 1, 'Inner back neck': owners == 2, 'Neck': owners == 3}
    if variant in ('regular-crew', 'oversized-crew'):
        # Derive the shared sleeve/cuff/hem fills from this exact raster, with
        # dashed seams bridged only for region detection, never drawn as paths.
        regions = P.G.analyse(SRC / spec['keyed'], P.G.Settings())
        cuff_y = 745 if variant == 'oversized-crew' else 700
        claimed = set()
        for category, seed in (
            ('Left sleeve', (120, 600)), ('Right sleeve', (900, 600)),
            ('Left cuff', (100, cuff_y)), ('Right cuff', (920, cuff_y)),
            ('Body hem', (512, 1260))):
            x, y = seed
            rid = regions.labels[y, x]
            assert rid, (category, 'missing raster region')
            assert rid not in claimed, (category, 'overlapping trim regions')
            claimed.add(rid)
            mask = regions.mask(rid) & masks['Body']
            assert 500 < mask.sum() < 150000, (category, int(mask.sum()))
            mask = ndi.binary_dilation(mask, iterations=2) & (masks['Body'] | construction)
            fit = variant.split('-')[0]
            P.write_part(category, category + ' (' + fit + ')', P.wrap_fill_only(category, mask))
    # Detached dashed seams stay exclusively in the editable Stitching layer.
    # Connected rib ticks and binding edges remain structural black ink.
    # Also retain a full source-pixel SVG before adapting to the site's common
    # 2048 canvas. Every path is emitted by Potrace, including all stitch dashes.
    raw = P.wrap_ink(spec['title'] + ' source trace', ink)
    paths = raw.count('M')
    assert paths > 100, 'Trace polarity/detail sanity check failed'
    start, end = raw.index('<g '), raw.rindex('</svg>')
    native = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536">'
              '<g transform="translate(-256,0) scale(0.75)">' + raw[start:end] + '</g></svg>')
    (SRC / (variant + '-reference-traced.svg')).write_text(native, encoding='utf-8')
    for category, mask in masks.items():
        asset = next(s['asset'] for s in spec['seeds'] if s['category'] == category)
        P.write_part(category, asset, P.wrap_fill_only(spec['title'] + ' ' + category, mask))
    P.write_part('Outline', spec['outline'], P.wrap_ink(spec['title'], construction))
    P.write_part('Stitching', spec['stitch'], P.wrap_fill_only(spec['title'] + ' stitches', stitches))
    proof = np.full((*ink.shape, 3), 255, dtype=np.uint8)
    proof[inside] = (94, 128, 178)
    proof[masks['Inner back neck']] = (149, 172, 205)
    proof[masks['Neck']] = (204, 45, 36)
    proof[ink] = (20, 20, 20)
    proof[stitches] = (230, 230, 230)
    Image.fromarray(proof).save(SRC / '_diag' / (variant + '-reference-proof.png'))
    print(variant, 'neck', int(neck.sum()), 'inner', int(inner.sum()), 'traced subpaths', paths, flush=True)


if __name__ == '__main__':
    import sys
    for variant in sys.argv[1:] or BOXY_VARIANTS:
        rebuild(variant)
