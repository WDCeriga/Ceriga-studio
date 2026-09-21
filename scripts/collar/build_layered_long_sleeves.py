from pathlib import Path
import argparse
import hashlib
import json
import shutil

import cv2
import numpy as np
from PIL import Image

from build_longer_short_sleeves import SOURCE, FITS, HEIGHT, WIDTH, render, source
import trace_svg as tracer


STAGE = Path(__file__).resolve().parent / 'refs/layered-long-sleeves'


def packed_svg(fit, name, mask):
    path = tracer.trace(mask, resample=Image.LANCZOS if name == 'outline' else Image.NEAREST)
    colour = tracer.INK_COLOR if name == 'outline' else '#000000'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">\n'
            f'<title>{fit} Layered Long Sleeve - {name}</title>\n'
            f'<g transform="translate(0,2048) scale(0.1,-0.1)" fill="{colour}" stroke="none">\n'
            f'<path d="{path}" fill-rule="evenodd"/>\n</g>\n</svg>\n')


def build(fit):
    tag = '' if fit == 'slim' else f' ({fit})'
    neck_tag = ' crew' if fit == 'slim' else tag
    body = source('Body', 'Body' + neck_tag)
    hem = source('Body hem', 'Body hem' + tag)
    outline = source('Outline', 'Outline' + neck_tag)
    sleeves = [source(f'{side} sleeve', f'{side} sleeve' + tag) for side in ('Left', 'Right')]
    cuffs = [source(f'{side} cuff', f'{side} cuff' + tag) for side in ('Left', 'Right')]
    old_end = int(np.where(cuffs[0])[0].max())
    hem_end = int(np.where(hem)[0].max())
    line_width = int(np.median(outline[old_end + 40:hem_end - 80, :WIDTH // 2].sum(axis=1)))
    assert 3 <= line_width <= 8, f'{fit}: unexpected body outline width {line_width}'
    protected = body | hem
    structural = np.zeros_like(body)
    stitching = np.zeros_like(body)
    masks = {}
    measurements = []
    for index, side in enumerate(('left', 'right')):
        flip = np.fliplr if index else lambda mask: mask
        sleeve, cuff = flip(sleeves[index]), flip(cuffs[index]).copy()
        if fit in ('regular', 'oversized'):
            cuff[:408] = False
        occupied_columns = np.flatnonzero(cuff.any(axis=0))
        opening_left, opening_right = int(occupied_columns[0]), int(occupied_columns[-1])
        opening_width = opening_right - opening_left
        outer = round(opening_left + opening_width * .16)
        inner = round(opening_right - opening_width * .12)
        top = []
        for column in range(outer, inner + 1):
            rows = np.flatnonzero(cuff[:, column])
            assert rows.size, f'{fit}: discontinuous outer cuff'
            top.append((column, int(rows[-1]) - line_width * 2))
        wrist_y = hem_end
        wrist_width = round((inner - outer) * .94)
        wrist_outer = outer + round((inner - outer - wrist_width) / 2) - round(opening_width * .03)
        wrist_inner = wrist_outer + wrist_width
        polygon = np.array(top + [(wrist_inner, wrist_y),
                                  (wrist_outer, wrist_y)], dtype=np.int32)
        filled = np.zeros((HEIGHT, WIDTH), np.uint8)
        cv2.fillPoly(filled, [polygon], 1)
        filled = (filled > 0) & ~flip(protected)
        distance = cv2.distanceTransform(filled.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        ink = filled & (distance <= line_width)
        hem_top = wrist_y - 28
        hem_fill = filled.copy()
        hem_fill[:hem_top] = False
        stitch_width = max(2, line_width // 2)
        stitch_y = hem_top - stitch_width - 3
        stitches = np.zeros_like(filled)
        for column in range(wrist_outer + line_width * 2, wrist_inner - line_width * 2 - 8, 16):
            stitches[stitch_y:stitch_y + stitch_width, column:column + 9] = True
        stitches &= filled & (distance > line_width * 2)
        original = sleeve | cuff
        ink &= ~original
        assert not np.any(filled[:, :2]), f'{fit}: clipped sleeve'
        assert wrist_y > old_end + 100, f'{fit}: undersleeve too short'
        for column, row in top[line_width:-line_width]:
            assert filled[row + line_width * 2 + 2, column], f'{fit}: sleeve fails to meet outer cuff'
        masks[side] = flip(filled)
        masks[f'{side}-hem'] = flip(hem_fill)
        structural |= flip(ink)
        stitching |= flip(stitches)
        measurements.append({'side': side, 'opening': [outer, inner],
                             'wrist': [wrist_outer, wrist_inner, wrist_y],
                             'hemTop': hem_top, 'stitchRow': stitch_y})
    masks['outline'] = structural
    masks['stitch'] = stitching
    assert not np.any((masks['left'] | masks['right'] | structural | stitching) & protected)
    STAGE.mkdir(parents=True, exist_ok=True)
    for name, mask in masks.items():
        (STAGE / f'{fit}-{name}.svg').write_text(packed_svg(fit, name, mask), encoding='utf-8')
    selector = masks['left'] | masks['right'] | sleeves[0] | sleeves[1] | cuffs[0] | cuffs[1]
    (STAGE / f'Layered Long Sleeve ({fit}).svg').write_text(packed_svg(fit, 'length', selector), encoding='utf-8')
    traced_ink = render(STAGE / f'{fit}-outline.svg')
    traced_stitch = render(STAGE / f'{fit}-stitch.svg')
    traced_fills = [render(STAGE / f'{fit}-{side}.svg') for side in ('left', 'right')]
    body_names = (['Body' + suffix for suffix in ('', ' crew', ' thin crew', ' scoop', ' deep V-neck', ' polo collar')]
                  if fit == 'slim' else [path.stem for path in (SOURCE / 'Body').glob(f'* ({fit}).svg')])
    assert len(body_names) == 6
    for name in body_names:
        torso_core = cv2.erode(source('Body', name).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        assert not np.any(traced_ink[torso_core]), f'{name}: added ink enters body'
        assert not np.any(traced_stitch[torso_core]), f'{name}: added stitching enters body'
        assert all(not np.any(fill[torso_core]) for fill in traced_fills), f'{name}: added fill enters body'
    widths = []
    for index, side in enumerate(('left', 'right')):
        ink = np.fliplr(traced_ink) if index else traced_ink
        fill = np.fliplr(traced_fills[index]) if index else traced_fills[index]
        stitches = np.fliplr(traced_stitch) if index else traced_stitch
        geometry = measurements[index]
        wrist_outer, wrist_inner, wrist_y = geometry['wrist']
        interior = slice(wrist_outer + line_width * 2, wrist_inner - line_width * 2)
        bottoms = [int(np.flatnonzero(fill[:, column] >= 128)[-1])
               for column in range(interior.start, interior.stop)]
        assert max(abs(bottom - hem_end) for bottom in bottoms) <= 1, f'{fit}: wrist misses hem level'
        assert max(bottoms) - min(bottoms) <= 1, f'{fit}: wrist opening is slanted'
        assert np.all(ink[wrist_y - line_width + 2:wrist_y, interior] >= 128), f'{fit}: cuff bottom is not closed'
        assert not np.any(ink[geometry['hemTop']:wrist_y - line_width - 1, interior] >= 128), f'{fit}: extra cuff detail line'
        opening_width = geometry['opening'][1] - geometry['opening'][0]
        assert .92 <= (wrist_inner - wrist_outer) / opening_width <= .96, f'{fit}: excessive taper'
        hem_fill = render(STAGE / f'{fit}-{side}-hem.svg')
        hem_fill = np.fliplr(hem_fill) if index else hem_fill
        assert np.all(hem_fill[geometry['hemTop'] + 2:wrist_y, interior] >= 128), f'{fit}: missing hem customization mask'
        assert not np.any(hem_fill[:geometry['stitchRow'] + max(2, line_width // 2) + 1, interior] >= 128), f'{fit}: cuff color starts above stitching'
        assert geometry['hemTop'] > geometry['stitchRow'] + max(2, line_width // 2), f'{fit}: stitching overlaps cuff color'
        stitch_samples = stitches[geometry['stitchRow'] + 1, interior] >= 128
        assert np.count_nonzero(stitch_samples) >= 18, f'{fit}: missing hem stitches'
        assert np.count_nonzero(np.diff(stitch_samples.astype(int)) == 1) >= 2, f'{fit}: stitches are not dashed'
        original = sleeves[index] | cuffs[index]
        original = np.fliplr(original) if index else original
        original_ink = np.fliplr(outline) if index else outline
        connected_ink = (ink >= 128) | original_ink
        for edge in geometry['opening']:
            cuff_bottom = int(np.flatnonzero(original[:, edge])[-1])
            for row in range(cuff_bottom + 1, cuff_bottom + line_width * 3):
                occupied = np.flatnonzero(fill[row] >= 128)
                assert occupied.size, f'{fit}: missing join fill'
                boundary = int(occupied[0] if edge == geometry['opening'][0] else occupied[-1])
                assert np.any(connected_ink[row, boundary - line_width:boundary + line_width + 1]), f'{fit}: broken sleeve join at {side} row {row}'
        samples = []
        for row in range(old_end + 30, hem_end - 20):
            occupied = np.flatnonzero(fill[row] >= 128)
            assert occupied.size > 30, f'{fit}: undersleeve is disconnected or too narrow'
            outer = int(occupied[0])
            samples.append(np.count_nonzero(ink[row, outer - 2:outer + line_width + 5] >= 128))
        measured = float(np.median(samples))
        assert abs(measured - line_width) <= 1, f'{fit}: sleeve outline width {measured} != {line_width}'
        widths.append(measured)
    proof = np.full((HEIGHT, WIDTH, 3), 255, np.uint8)
    proof[body | hem | sleeves[0] | sleeves[1] | cuffs[0] | cuffs[1]] = (230, 230, 230)
    proof[traced_fills[0] >= 128] = (207, 58, 66)
    proof[traced_fills[1] >= 128] = (62, 156, 166)
    proof[outline | (traced_ink >= 128)] = (20, 20, 20)
    proof[traced_stitch >= 128] = (90, 90, 90)
    Image.fromarray(proof).save(STAGE / f'{fit}-proof.png')
    return {'fit': fit, 'bodyOutlineWidth': line_width, 'sleeveOutlineWidths': widths,
            'protectedNecklineVariants': len(body_names), 'bodyPreserved': True,
            'outerSleevesPreserved': True, 'hemAligned': True, 'horizontalOpenings': True,
            'closedCuffs': True, 'stitchAboveHemColor': True, 'smoothJoins': True,
            'reducedTaper': True, 'independentHemMasks': True, 'geometry': measurements}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--fits', nargs='+', choices=FITS, default=FITS)
    arguments = parser.parse_args()
    output = SOURCE / 'layered-long-sleeves'
    targets = {output / f'{fit}-{name}.svg' for fit in arguments.fits
               for name in ('left', 'right', 'left-hem', 'right-hem', 'outline', 'stitch')}
    targets |= {SOURCE / 'Sleeve length' / f'Layered Long Sleeve ({fit}).svg' for fit in arguments.fits}
    original_hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest()
                       for path in SOURCE.parent.rglob('*') if path.is_file() and path not in targets}
    reports = [build(fit) for fit in arguments.fits]
    if arguments.install:
        output.mkdir(exist_ok=True)
        for target in targets:
            shutil.copyfile(STAGE / target.name, target)
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == digest
               for path, digest in original_hashes.items()), 'Existing asset changed'
    report = {'fits': reports, 'unchangedAssets': len(original_hashes), 'installed': arguments.install}
    (STAGE / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()