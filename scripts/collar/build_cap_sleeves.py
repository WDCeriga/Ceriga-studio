from pathlib import Path
import argparse
import hashlib
import json
import shutil

import cv2
import numpy as np
from PIL import Image

from build_longer_short_sleeves import FITS, HEIGHT, WIDTH, SOURCE, render, source
import trace_svg as tracer


STAGE = Path(__file__).resolve().parent / 'refs/cap-sleeves'
PARTS = ('left', 'right', 'left-cuff', 'right-cuff', 'outline', 'stitch', 'keep')
PROFILES = {
    'slim': (.40, .27),
    'regular': (.42, .30),
    'boxy': (.43, .32),
    'oversized': (.44, .34),
}


def packed_svg(fit, name, mask):
    path = tracer.trace(mask, resample=Image.LANCZOS if name == 'outline' else Image.NEAREST)
    colour = tracer.INK_COLOR if name == 'outline' else '#000000'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">\n'
            f'<title>{fit} Cap Sleeve - {name}</title>\n'
            f'<g transform="translate(0,2048) scale(0.1,-0.1)" fill="{colour}" stroke="none">\n'
            f'<path d="{path}" fill-rule="evenodd"/>\n</g>\n</svg>\n')


def sleeve_edges(mask):
    rows = np.flatnonzero(mask.any(axis=1))
    inner = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in mask])
    underarm = int(np.flatnonzero(inner == inner.max())[-1])
    return int(rows[0]), int(rows[-1]), inner, underarm


def build(fit):
    tag = '' if fit == 'slim' else f' ({fit})'
    neck_tag = ' crew' if fit == 'slim' else tag
    body = source('Body', 'Body' + neck_tag)
    outline = source('Outline', 'Outline' + neck_tag)
    hem = source('Body hem', 'Body hem' + tag)
    sleeves = [source(f'{side} sleeve', f'{side} sleeve' + tag) for side in ('Left', 'Right')]
    cuffs = [source(f'{side} cuff', f'{side} cuff' + tag) for side in ('Left', 'Right')]
    attachment = sleeves[0] | cuffs[0]
    if fit in ('regular', 'oversized'):
        attachment[:408] = False
    top, old_end, inner, underarm = sleeve_edges(attachment)
    opposite = np.fliplr(sleeves[1] | cuffs[1]).copy()
    if fit in ('regular', 'oversized'):
        opposite[:408] = False
    opening_row = round((underarm + sleeve_edges(opposite)[3]) / 2)
    hem_end = int(np.where(hem)[0].max())
    line_width = int(np.median(outline[old_end + 40:hem_end - 80, :WIDTH // 2].sum(axis=1)))
    assert 3 <= line_width <= 8, f'{fit}: unexpected outline width {line_width}'
    torso = body.copy()
    if fit in ('regular', 'oversized'):
        below_sleeve = old_end + 12
        body_left = int(np.flatnonzero(body[below_sleeve])[0])
        for row in range(top, below_sleeve):
            boundary = int(inner[row]) if row <= underarm else round(np.interp(
                row, [underarm, below_sleeve], [inner[underarm], body_left]))
            torso[row, :boundary] = False
            torso[row, WIDTH - boundary:] = False
    protected = cv2.dilate(torso.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    for row in protected:
        occupied = np.flatnonzero(row)
        if occupied.size:
            row[occupied[0]:occupied[-1] + 1] = True
    masks = {}
    structural = np.zeros_like(body)
    stitching = np.zeros_like(body)
    measurements = []
    width_probes = []
    row_grid, column_grid = np.indices(body.shape)
    for index, side in enumerate(('left', 'right')):
        flip = np.fliplr if index else lambda mask: mask
        original = flip(sleeves[index] | cuffs[index]).copy()
        if fit in ('regular', 'oversized'):
            original[:408] = False
        side_top, side_end, side_inner, _ = sleeve_edges(original)
        side_underarm = opening_row
        join = side_top + 24
        drop, fullness = PROFILES[fit]
        tip_row = round(side_top + (side_underarm - side_top) * drop)
        tip_column = round(side_inner[side_top] - (side_underarm - side_top) * fullness)
        join_ink = flip(outline)[join, :side_inner[join] + 1]
        start = np.array([np.flatnonzero(join_ink | original[join, :side_inner[join] + 1])[0], join], dtype=float)
        tip = np.array([tip_column, tip_row], dtype=float)
        end = np.array([side_inner[side_underarm], side_underarm], dtype=float)
        control = np.array([start[0] + (tip_column - start[0]) * .55, join + (tip_row - join) * .32])
        for fraction in (.35, .55, .75):
            point = (1 - fraction) ** 2 * start + 2 * (1 - fraction) * fraction * control + fraction ** 2 * tip
            tangent = 2 * (1 - fraction) * (control - start) + 2 * fraction * (tip - control)
            normal = np.array([-tangent[1], tangent[0]]) / np.linalg.norm(tangent)
            width_probes.append((index, point, normal))
        curve = []
        for fraction in np.linspace(0, 1, 160):
            curve.append((1 - fraction) ** 2 * start + 2 * (1 - fraction) * fraction * control + fraction ** 2 * tip)
        boundary = [[side_inner[row], row] for row in range(side_underarm, join - 1, -1)]
        polygon = np.rint(np.vstack([curve, end, boundary])).astype(np.int32)
        cap = np.zeros_like(body, dtype=np.uint8)
        cv2.fillPoly(cap, [polygon], 1)
        cap[:join + 1] = original[:join + 1]
        cap = (cap > 0) & ~flip(torso)
        opening = end - tip
        opening_length = float(np.linalg.norm(opening))
        distance = (opening[0] * (row_grid - tip[1]) - opening[1] * (column_grid - tip[0])) / opening_length
        along = ((column_grid - tip[0]) * opening[0] + (row_grid - tip[1]) * opening[1]) / opening_length
        cuff = cap & (np.abs(distance) <= 17) & (along >= 0)
        edge_distance = cv2.distanceTransform(cap.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        edge = cap & (edge_distance <= line_width) & ~flip(protected)
        edge[:join + 1] = False
        stitch = cap & (along > 7) & (along < opening_length - 7) & (along % 12 < 7)
        stitch &= (np.abs(np.abs(distance) - 9) < .85) | (np.abs(np.abs(distance) - 14) < .85)
        stitch &= ~flip(protected)
        masks[side] = flip(cap & ~cuff)
        masks[side + '-cuff'] = flip(cuff)
        structural |= flip(edge)
        stitching |= flip(stitch)
        assert np.array_equal(cap[:join + 1], (original & ~flip(torso))[:join + 1])
        assert side_underarm < side_end - 20, f'{fit}: cap opening not higher than short sleeve'
        assert not np.any(cap & flip(torso)), f'{fit}: sleeve enters body'
        measurements.append({'side': side, 'tip': tip.tolist(), 'underarm': end.tolist(),
                             'originalEnd': side_end, 'newEnd': side_underarm})
    old_sleeves = sleeves[0] | sleeves[1] | cuffs[0] | cuffs[1]
    remove = cv2.dilate(old_sleeves.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    keep = ~remove | protected
    keep[:top + 25] = True
    masks.update(outline=structural, stitch=stitching, keep=keep)
    STAGE.mkdir(parents=True, exist_ok=True)
    for name, mask in masks.items():
        (STAGE / f'{fit}-{name}.svg').write_text(packed_svg(fit, name, mask), encoding='utf-8')
    selector = masks['left'] | masks['right'] | masks['left-cuff'] | masks['right-cuff']
    (STAGE / f'Cap Sleeve ({fit}).svg').write_text(packed_svg(fit, 'length', selector), encoding='utf-8')
    traced_keep = render(STAGE / f'{fit}-keep.svg')
    traced_ink = render(STAGE / f'{fit}-outline.svg')
    torso_core = cv2.erode(protected.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    assert np.all(traced_keep[torso_core] == 255), f'{fit}: traced keep clips body'
    assert not np.any(traced_ink[torso_core]), f'{fit}: traced outline enters body'
    widths = []
    for index, point, normal in width_probes:
        offsets = np.arange(-12, 12, .25)
        samples = np.rint(point + offsets[:, None] * normal).astype(int)
        ink = np.fliplr(traced_ink) if index else traced_ink
        widths.append(float(np.count_nonzero(ink[samples[:, 1], samples[:, 0]] >= 128) * .25))
    assert abs(float(np.median(widths)) - line_width) <= 1.25, f'{fit}: outline widths {widths}'
    body_names = (['Body' + suffix for suffix in ('', ' crew', ' thin crew', ' scoop', ' deep V-neck', ' polo collar')]
                  if fit == 'slim' else [path.stem for path in (SOURCE / 'Body').glob(f'* ({fit}).svg')])
    assert len(body_names) == 6
    for name in body_names:
        variant = source('Body', name) & torso_core
        assert np.all(traced_keep[variant] == 255), f'{name}: body clipped'
        assert not np.any(traced_ink[variant]), f'{name}: sleeve ink overlaps body'
    proof = np.full((HEIGHT, WIDTH, 3), 255, np.uint8)
    proof[(body & keep) | hem] = (235, 238, 237)
    proof[masks['left']] = (207, 58, 66)
    proof[masks['right']] = (62, 156, 166)
    proof[masks['left-cuff'] | masks['right-cuff']] = (220, 190, 110)
    proof[(outline & keep) | structural | stitching] = (20, 20, 20)
    Image.fromarray(proof).save(STAGE / f'{fit}-proof.png')
    report = {'fit': fit, 'bodyOutlineWidth': line_width, 'protectedNecklineVariants': len(body_names),
              'tracedOutlineWidths': widths, 'torsoPreserved': True, 'attachmentPreserved': True, 'sleeves': measurements}
    print(json.dumps(report), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--fits', nargs='+', choices=FITS, default=FITS)
    arguments = parser.parse_args()
    targets = {SOURCE / 'cap-sleeves' / f'{fit}-{name}.svg' for fit in arguments.fits for name in PARTS}
    targets |= {SOURCE / 'Sleeve length' / f'Cap Sleeve ({fit}).svg' for fit in arguments.fits}
    original_hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest()
                       for path in SOURCE.parent.rglob('*') if path.is_file() and path not in targets}
    reports = [build(fit) for fit in arguments.fits]
    if arguments.install:
        (SOURCE / 'cap-sleeves').mkdir(exist_ok=True)
        for fit in arguments.fits:
            for name in PARTS:
                shutil.copyfile(STAGE / f'{fit}-{name}.svg', SOURCE / 'cap-sleeves' / f'{fit}-{name}.svg')
            name = f'Cap Sleeve ({fit}).svg'
            shutil.copyfile(STAGE / name, SOURCE / 'Sleeve length' / name)
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == digest
               for path, digest in original_hashes.items()), 'Existing assets changed'
    (STAGE / 'validation.json').write_text(json.dumps(
        {'fits': reports, 'unchangedAssets': len(original_hashes)}, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()