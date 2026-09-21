"""Raster reference sleeves fitted to existing armholes, then Potrace only."""
from pathlib import Path
from io import BytesIO
import shutil
import numpy as np
from PIL import Image

SRC = Path(__file__).resolve().parents[2] / 'src' / 'assets' / 'studio-tshirt'
OUT = SRC / 'long-sleeves'
REF = SRC / 'long-sleeve-reference.png'

def raster(category, name):
    import cairosvg

    png = cairosvg.svg2png(url=str(SRC / category / (name + '.svg')), output_width=1536, output_height=1536)
    return np.asarray(Image.open(BytesIO(png)).convert('RGBA').crop((256, 0, 1280, 1536)))[:, :, 3] >= 128

def save(fit, name, mask, ink=False):
    import pack_studio_neck_variant as P

    (OUT / f'{fit}-{name}.svg').write_text((P.wrap_ink if ink else P.wrap_fill_only)(name, mask), encoding='utf-8')

def build(fit):
    from scipy import ndimage as ndi
    import pack_studio_neck_variant as P

    OUT.mkdir(exist_ok=True)
    if not REF.exists():
        raise FileNotFoundError(f'Long-sleeve reference not found: {REF}')
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

def build_reference_sleeves(fit='slim', install=False):
    import hashlib
    import json
    import zipfile
    import cv2
    import resvg_py
    from PIL import ImageEnhance
    import trace_svg as tracer

    if fit not in {'slim', 'regular', 'boxy', 'oversized'}:
        raise ValueError(f'Unsupported Premium Cotton T-Shirt fit: {fit}')
    stage = Path(__file__).resolve().parent / 'refs' / f'{fit}-long-reference'
    stage.mkdir(parents=True, exist_ok=True)
    width, height = 1024, 1536

    def render(category, name):
        png = resvg_py.svg_to_bytes(svg_path=str(SRC / category / (name + '.svg')),
                                    width=height, height=height)
        return np.asarray(Image.open(BytesIO(png)).convert('RGBA').crop(
            (256, 0, 1280, height)))[:, :, 3] >= 128

    tag = '' if fit == 'slim' else f' ({fit})'
    neck_tag = ' crew' if fit == 'slim' else tag
    original_body = render('Body', 'Body' + neck_tag)
    original_outline = render('Outline', 'Outline' + neck_tag)
    original_stitch = render('Stitching', 'Cover stitch' + neck_tag)
    original_sleeve = render('Left sleeve', 'Left sleeve' + tag) | render('Left cuff', 'Left cuff' + tag)
    original_right = render('Right sleeve', 'Right sleeve' + tag) | render('Right cuff', 'Right cuff' + tag)
    body_hem = render('Body hem', 'Body hem' + tag)
    attachment_sleeve = original_sleeve.copy()
    if fit in {'regular', 'oversized'}:
        attachment_sleeve[:408] = False
    rows, columns = np.where(attachment_sleeve)
    top, old_end = int(rows.min()), int(rows.max())
    right_edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in attachment_sleeve])
    armhole_rows = np.flatnonzero(right_edges == right_edges.max())
    underarm = int(np.median(armhole_rows)) if fit == 'slim' else int(armhole_rows[-1])
    join_row = top + 24
    outer_start = int(np.flatnonzero(original_sleeve[join_row])[0])
    if fit != 'slim':
        outer_start = int(np.flatnonzero(original_outline[join_row, :width // 2])[0])
    end = int(np.where(body_hem)[0].max())
    measure_start = 700 if fit == 'slim' else old_end + 40
    measure_end = 1100 if fit == 'slim' else end - 80
    outer_width = int(np.median(np.sum(original_outline[measure_start:measure_end, :width // 2], axis=1)))
    assert 3 <= outer_width <= 8, f'Unexpected original outline width: {outer_width}'

    def curve(start, control_one, control_two, end):
        amount = np.linspace(0, 1, 512)[:, None]
        return ((1 - amount) ** 3 * np.array(start)
                + 3 * (1 - amount) ** 2 * amount * np.array(control_one)
                + 3 * (1 - amount) * amount ** 2 * np.array(control_two)
                + amount ** 3 * np.array(end))

    def polygon(points):
        mask = np.zeros((height, width), np.uint8)
        cv2.fillPoly(mask, [np.rint(points).astype(np.int32)], 255)
        return mask > 0

    outer_wrist, wrist_width = {'slim': (60, 120), 'regular': (44, 132),
                                'boxy': (34, 145), 'oversized': (26, 154)}[fit]
    inner_wrist = outer_wrist + wrist_width
    if fit == 'slim':
        sleeve_outer = curve((outer_start, join_row), (65, 380), (28, end - 230), (outer_wrist, end))
        wrist = curve((outer_wrist, end), (98, end + 8), (155, end + 8), (inner_wrist, end - 3))
        sleeve_inner = curve((inner_wrist, end - 3), (190, end - 170),
                             (214, underarm + 190), (right_edges[underarm], underarm))
    else:
        sleeve_outer = curve((outer_start, join_row), (outer_start - 55, join_row + 110),
                             (max(8, outer_wrist - 24), end - 230), (outer_wrist, end))
        wrist = curve((outer_wrist, end), (outer_wrist + wrist_width * .32, end + 8),
                      (outer_wrist + wrist_width * .79, end + 8), (inner_wrist, end - 3))
        sleeve_inner = curve((inner_wrist, end - 3), (inner_wrist + 10, end - 170),
                             (right_edges[underarm] - 12, underarm + 150), (right_edges[underarm], underarm))
    attachment = np.array([(right_edges[row], row) for row in range(underarm, join_row - 1, -1)])
    left = polygon(np.vstack([sleeve_outer, wrist, sleeve_inner, attachment]))
    left[:join_row + 1] = attachment_sleeve[:join_row + 1]
    for row in range(join_row + 1, underarm + 1):
        left[row, right_edges[row] + 1:] = False

    torso_body = original_body.copy()
    if fit in {'regular', 'oversized'}:
        below_sleeve = old_end + 12
        torso_left = int(np.flatnonzero(original_body[below_sleeve])[0])
        for row in range(top, below_sleeve):
            if row <= underarm:
                boundary = right_edges[row]
            else:
                boundary = round(np.interp(row, [underarm, below_sleeve], [right_edges[underarm], torso_left]))
            torso_body[row, :boundary] = False
            torso_body[row, width - boundary:] = False
    protection_size = 15 if fit == 'slim' else 7
    protected = cv2.dilate(torso_body.astype(np.uint8), np.ones((protection_size, protection_size), np.uint8)) > 0
    for row in protected:
        occupied = np.flatnonzero(row)
        if occupied.size:
            row[occupied[0]:occupied[-1] + 1] = True
    keep = np.ones_like(left)
    keep[join_row + 1:old_end + 12] = protected[join_row + 1:old_end + 12]
    if fit != 'slim':
        for row in range(join_row + 1, underarm + 1):
            boundary = int(right_edges[row])
            keep[row, boundary - outer_width:boundary + 1] = True
            keep[row, width - boundary - 1:width - boundary + outer_width] = True
    distance = cv2.distanceTransform(left.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    edge = left & (distance <= outer_width)
    edge[:join_row + 1] = False
    if fit == 'slim':
        edge &= ~protected
    else:
        attachment_guard = cv2.dilate(protected.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        edge[:underarm + 1] &= ~attachment_guard[:underarm + 1]
        edge &= ~torso_body
    structural = edge | np.fliplr(edge)
    stitches = np.zeros((height, width), np.uint8)

    def stitch(coordinates, spacing=5.4, dash=2.0):
        distance = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(coordinates, axis=0), axis=1))])
        for start in np.arange(0, distance[-1] - dash, spacing):
            endpoints = np.array([
                np.interp([start, start + dash], distance, coordinates[:, axis])
                for axis in range(2)
            ]).T
            cv2.line(stitches, tuple(np.rint(endpoints[0]).astype(int)),
                     tuple(np.rint(endpoints[1]).astype(int)), 255, 1, cv2.LINE_8)

    cuff_top = wrist + [0, -26]
    cuff = polygon(np.vstack([cuff_top, wrist[::-1]])) & left
    for offset in [0, 5]:
        stitch(cuff_top + [0, offset])
    stitches = ((stitches > 0) & left) | np.fliplr((stitches > 0) & left)
    masks = {
        'left': left & ~cuff, 'right': np.fliplr(left & ~cuff),
        'left-cuff': cuff, 'right-cuff': np.fliplr(cuff),
        'outline': structural, 'stitch': stitches, 'keep': keep,
    }
    if fit != 'slim':
        masks['right'][:join_row + 1] = original_right[:join_row + 1]
        if fit in {'regular', 'oversized'}:
            masks['right'][:top] = False
            assert not np.any(masks['left'][:top] | masks['right'][:top]), 'Sleeve colour enters shoulder'
    ink = structural | stitches
    lineart = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8))
    keyed = tracer.to_transparent(ImageEnhance.Contrast(lineart).enhance(tracer.CONTRAST))
    source_svg = tracer.source_svg(f'{fit.title()} reference sleeves only', keyed.getchannel('A'))
    assert set(np.unique(lineart)) == {0, 255}
    assert np.array_equal(masks['left'][join_row + 1:], np.fliplr(masks['right'])[join_row + 1:])
    assert np.array_equal(masks['left-cuff'], np.fliplr(masks['right-cuff']))
    assert not np.any(ink & torso_body), 'Sleeve ink overlaps the original torso'
    assert not np.any(torso_body & ~keep), 'Keep mask clips the original torso'
    sleeve_measure_start = 800 if fit == 'slim' else old_end + 60
    sleeve_measure_end = 1100 if fit == 'slim' else end - 100
    assert int(np.median(np.sum(edge[sleeve_measure_start:sleeve_measure_end, :100], axis=1))) == outer_width
    composed_outline = (original_outline & keep) | structural
    composed_stitch = (original_stitch & keep) | stitches
    assert np.array_equal(composed_outline[torso_body], original_outline[torso_body])
    assert np.array_equal(composed_stitch[protected], original_stitch[protected])
    lineart.save(stage / 'lineart.png')
    keyed.save(stage / 'keyed.png')
    (stage / 'lineart.svg').write_text(source_svg, encoding='utf-8')

    def packed_svg(name, mask):
        path = tracer.trace(mask, resample=Image.LANCZOS if name == 'outline' else Image.NEAREST)
        assert path and path.count('M') >= 1, f'Empty part: {name}'
        colour = tracer.INK_COLOR if name == 'outline' else '#000000'
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">\n'
                f'<title>{fit.title()} reference sleeves only - {name}</title>\n'
                f'<g transform="translate(0,2048) scale(0.1,-0.1)" fill="{colour}" stroke="none">\n'
                f'<path d="{path}" fill-rule="evenodd"/>\n</g>\n</svg>\n')

    for name, mask in masks.items():
        (stage / f'{fit}-{name}.svg').write_text(packed_svg(name, mask), encoding='utf-8')
    (stage / f'Long sleeve ({fit}).svg').write_text(packed_svg('sleeve-length', left | np.fliplr(left)), encoding='utf-8')

    def traced_alpha(name):
        png = resvg_py.svg_to_bytes(svg_path=str(stage / f'{fit}-{name}.svg'), width=height, height=height)
        return np.asarray(Image.open(BytesIO(png)).convert('RGBA').crop((256, 0, 1280, height)))[:, :, 3]

    traced_keep = traced_alpha('keep')
    traced_ink = traced_alpha('outline')
    traced_stitch = traced_alpha('stitch')
    protected_core = cv2.erode(protected.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    torso_core = cv2.erode(torso_body.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    body_names = (['Body' + suffix for suffix in ['', ' crew', ' thin crew', ' scoop', ' deep V-neck', ' polo collar']]
                  if fit == 'slim' else [path.stem for path in (SRC / 'Body').glob(f'* ({fit}).svg')])
    assert len(body_names) == 6, f'Expected six neck/body variants: {body_names}'
    for name in body_names:
        body = render('Body', name)
        if fit in {'regular', 'oversized'}:
            body &= protected_core
        assert np.all(traced_keep[body] == 255), f'Original body clipped: {name}'
        assert not np.any(traced_ink[body & torso_core] | traced_stitch[body & torso_core]), f'Sleeve ink overlaps body: {name}'
    protected_ink = protected_core & (original_outline | original_stitch)
    assert np.all(traced_keep[protected_ink] == 255), 'Original torso/neck ink clipped after tracing'
    assert not np.any(traced_ink[torso_core] | traced_stitch[torso_core]), 'Ink entered protected torso region'
    if fit != 'slim':
        for row in range(underarm - 40, underarm + 1):
            boundary = int(right_edges[row])
            retained = original_outline[row, boundary - outer_width:boundary + 1]
            assert np.all(traced_keep[row, boundary - outer_width:boundary + 1][retained] >= 250), f'Original underarm ink clipped at row {row}'
        for row in range(underarm + 1, sleeve_measure_end):
            inner = int(np.flatnonzero(left[row])[-1])
            expected = np.arange(inner - outer_width + 1, inner + 1)
            expected = expected[~torso_body[row, expected]]
            assert np.all(edge[row, expected]), f'Underarm outline gap at row {row}'
            if expected.size == outer_width:
                assert np.sum(traced_ink[row, inner - outer_width:inner + 2] >= 128) >= outer_width - 1, f'Traced underarm outline faded at row {row}'
    traced_width = int(np.median(np.sum(traced_ink[sleeve_measure_start:sleeve_measure_end, :100] >= 128, axis=1)))
    assert traced_width == outer_width, f'Traced line width mismatch: {traced_width} != {outer_width}'
    proof = np.full((height, width, 3), 255, np.uint8)
    proof[(original_body & keep) | body_hem] = (226, 232, 231)
    palette = [(101, 164, 204), (116, 179, 151), (233, 158, 81), (211, 143, 173)]
    for name, colour in zip(list(masks)[:4], palette):
        proof[masks[name]] = colour
    proof[composed_outline | composed_stitch] = 0
    Image.fromarray(proof).save(stage / f'{fit}-proof.png')
    report = {
        'fit': fit,
        'sourceSize': [width, height], 'appViewBox': [0, 0, 2048, 2048],
        'measuredBodyOutlineWidth': outer_width, 'measuredSleeveOutlineWidth': outer_width,
        'tracedSleeveOutlineWidth': traced_width, 'protectedBodyVariants': len(body_names),
        'protectedBodyOutlineAndStitchPixelsUnchanged': True,
        'underarmContinuityChecked': fit != 'slim',
        'shoulderExcludedFromSleeveColour': fit in {'regular', 'oversized'},
        'originalBodyIsNotAnOutput': True,
        'attachment': {'top': top, 'underarm': underarm, 'wrist': end},
        'traceUpsample': tracer.TRACE_SS, 'threshold': 128, 'contrast': tracer.CONTRAST,
        'source': f'Sleeve contours interpreted from the supplied front reference and fitted to the existing {fit} armholes',
        'parts': list(masks),
    }
    targets = {OUT / f'{fit}-{name}.svg': stage / f'{fit}-{name}.svg' for name in masks}
    targets[OUT / f'{fit}-proof.png'] = stage / f'{fit}-proof.png'
    targets[SRC / 'Sleeve length' / f'Long sleeve ({fit}).svg'] = stage / f'Long sleeve ({fit}).svg'
    untouched = {
        path: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in SRC.parent.rglob('*') if path.is_file() and path not in targets
    }
    if install:
        backup = stage.parent / f'{fit}-long-original-20260921.zip'
        if fit != 'slim' and not backup.exists():
            with zipfile.ZipFile(backup, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
                for target in targets:
                    archive.write(target, str(target.relative_to(SRC)))
        with zipfile.ZipFile(backup) as archive:
            assert archive.testzip() is None
            expected = ({'slim-left.svg', 'slim-outline.svg', 'slim-keep.svg'} if fit == 'slim'
                        else {target.relative_to(SRC).as_posix() for target in targets})
            assert expected <= set(archive.namelist())
        for target, source in targets.items():
            shutil.copyfile(source, target)
        assert all(hashlib.sha256(path.read_bytes()).hexdigest() == digest for path, digest in untouched.items())
        report['installedFiles'] = [str(path.relative_to(SRC)) for path in targets]
        report['unchangedAssetFilesVerified'] = len(untouched)
        report['backup'] = str(backup.relative_to(SRC.parents[2]))
    report['generatedFiles'] = [str(path.relative_to(SRC.parents[2])) for path in sorted(stage.iterdir()) if path.is_file()]
    report['protectedAssetHashes'] = {str(path.relative_to(SRC.parent)): digest for path, digest in untouched.items()}
    (stage / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'protectedAssetHashes'}, indent=2))
    print(f'Staged proof: {stage}')


if __name__ == '__main__':
    import sys
    if '--reference-slim' in sys.argv:
        build_reference_sleeves(install='--install' in sys.argv)
    elif '--reference-fit' in sys.argv:
        fits = [value for value in sys.argv[sys.argv.index('--reference-fit') + 1:] if value != '--install']
        if not fits or any(fit not in {'regular', 'boxy', 'oversized'} for fit in fits):
            raise ValueError('--reference-fit requires regular, boxy, and/or oversized')
        for fit in fits:
            build_reference_sleeves(fit, install='--install' in sys.argv)
    else:
        for fit in sys.argv[1:] or ['slim','regular','boxy','oversized']:
            build(fit)
