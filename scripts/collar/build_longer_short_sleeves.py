from io import BytesIO
from pathlib import Path
import argparse
import hashlib
import json
import shutil

import cv2
import numpy as np
from PIL import Image
import resvg_py

import trace_svg as tracer


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'src/assets/studio-tshirt'
STAGE = Path(__file__).resolve().parent / 'refs/longer-short-sleeves'
FITS = ('slim', 'regular', 'boxy', 'oversized')
HEIGHT, WIDTH = 1536, 1536


def render(path):
    png = resvg_py.svg_to_bytes(svg_path=str(path), width=HEIGHT, height=HEIGHT)
    return np.asarray(Image.open(BytesIO(png)).convert('RGBA'))[:, :, 3]


def source(category, name):
    return render(SOURCE / category / f'{name}.svg') >= 128


def extend_opening(sleeve, cuff, extension):
    coordinates = np.column_stack(np.where(cuff)[::-1]).astype(float)
    eigenvalues, eigenvectors = np.linalg.eigh(np.cov(coordinates.T))
    direction = eigenvectors[:, np.argmin(eigenvalues)]
    if direction[1] < 0:
        direction *= -1
    assert direction[0] < 0 and direction[1] > 0, 'Expected an outward, downward sleeve opening'
    extended = sleeve | cuff
    translated = cuff.copy()
    for distance in range(1, extension + 1):
        offset = np.rint(direction * distance)
        translated = cv2.warpAffine(cuff.astype(np.uint8),
            np.array([[1, 0, offset[0]], [0, 1, offset[1]]], dtype=np.float32),
            (WIDTH, HEIGHT), flags=cv2.INTER_NEAREST) > 0
        extended |= translated
    return extended, translated, direction


def packed_svg(fit, name, mask):
    path = tracer.trace(mask, resample=Image.LANCZOS if name == 'outline' else Image.NEAREST)
    colour = tracer.INK_COLOR if name == 'outline' else '#000000'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">\n'
            f'<title>{fit} longer short sleeve - {name}</title>\n'
            f'<g transform="translate(0,2048) scale(0.1,-0.1)" fill="{colour}" stroke="none">\n'
            f'<path d="{path}" fill-rule="evenodd"/>\n</g>\n</svg>\n')


def build(fit):
    tag = '' if fit == 'slim' else f' ({fit})'
    neck_tag = ' crew' if fit == 'slim' else tag
    body = source('Body', 'Body' + neck_tag)
    outline = source('Outline', 'Outline' + neck_tag)
    hem = source('Body hem', 'Body hem' + tag)
    sleeves = [source(f'{side} sleeve', f'{side} sleeve' + tag) for side in ('Left', 'Right')]
    cuffs = [source(f'{side} cuff', f'{side} cuff' + tag) for side in ('Left', 'Right')]
    old_left = sleeves[0] | cuffs[0]
    if fit in ('regular', 'oversized'):
        old_left[:408] = False
    occupied_rows = np.flatnonzero(old_left.any(axis=1))
    top, old_end = int(occupied_rows[0]), int(occupied_rows[-1])
    right_edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in old_left])
    underarm = int(np.flatnonzero(right_edges == right_edges.max())[-1])
    join = top + 24
    hem_end = int(np.where(hem)[0].max())
    line_width = int(np.median(outline[old_end + 40:hem_end - 80, :WIDTH // 2].sum(axis=1)))
    assert 3 <= line_width <= 8, f'{fit}: unexpected body outline width {line_width}'
    torso = body.copy()
    if fit in ('regular', 'oversized'):
        below_sleeve = old_end + 12
        body_left = int(np.flatnonzero(body[below_sleeve])[0])
        for row in range(top, below_sleeve):
            boundary = int(right_edges[row]) if row <= underarm else round(np.interp(
                row, [underarm, below_sleeve], [right_edges[underarm], body_left]))
            torso[row, :boundary] = False
            torso[row, WIDTH - boundary:] = False
    protected = cv2.dilate(torso.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    for row in protected:
        occupied = np.flatnonzero(row)
        if occupied.size:
            row[occupied[0]:occupied[-1] + 1] = True
    extension = round((old_end - top) * .48)
    masks = {}
    structural = np.zeros_like(body)
    old_sleeves = np.zeros_like(body)
    directions = []
    for index, side in enumerate(('left', 'right')):
        flip = np.fliplr if index else lambda mask: mask
        sleeve, cuff = flip(sleeves[index]).copy(), flip(cuffs[index]).copy()
        if fit in ('regular', 'oversized'):
            sleeve[:408] = False
            cuff[:408] = False
        extended, end_cuff, direction = extend_opening(sleeve, cuff, extension)
        closed = cv2.morphologyEx(extended.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        continuous = np.zeros_like(closed)
        cv2.drawContours(continuous, contours, -1, 1, cv2.FILLED)
        extended[join + 1:] = continuous[join + 1:] > 0
        extended &= ~flip(torso)
        end_cuff &= extended
        edge_distance = cv2.distanceTransform(extended.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        edge = extended & (edge_distance <= line_width)
        edge &= ~flip(protected)
        edge[:join + 1] = False
        assert np.array_equal(extended[:join + 1], ((sleeve | cuff) & ~flip(torso))[:join + 1])
        original_top = int(np.where(sleeve | cuff)[0].min())
        assert not np.any(extended[:original_top]), f'{fit}: sleeve colour crosses into shoulder'
        assert np.where(extended)[0].max() > old_end + extension * .5
        assert not np.any(extended[:, :2]), f'{fit}: sleeve is clipped by the canvas'
        masks[side] = flip(extended & ~end_cuff)
        masks[side + '-cuff'] = flip(end_cuff)
        structural |= flip(edge)
        old_sleeves |= sleeves[index] | cuffs[index]
        directions.append(direction.tolist())
    remove = cv2.dilate(old_sleeves.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    keep = ~remove | protected
    keep[:join + 1] = True
    masks.update(outline=structural, stitch=np.zeros_like(body), keep=keep)
    assert not np.any(torso & ~keep), f'{fit}: original torso clipped'
    assert not np.any(structural & torso), f'{fit}: new ink enters torso'
    STAGE.mkdir(parents=True, exist_ok=True)
    for name, mask in masks.items():
        (STAGE / f'{fit}-{name}.svg').write_text(packed_svg(fit, name, mask), encoding='utf-8')
    selector = masks['left'] | masks['right'] | masks['left-cuff'] | masks['right-cuff']
    (STAGE / f'Longer short sleeve ({fit}).svg').write_text(packed_svg(fit, 'length', selector), encoding='utf-8')
    traced_keep = render(STAGE / f'{fit}-keep.svg')
    traced_ink = render(STAGE / f'{fit}-outline.svg')
    torso_core = cv2.erode(protected.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    assert np.all(traced_keep[torso_core] == 255), f'{fit}: traced keep clips torso'
    assert not np.any(traced_ink[torso_core]), f'{fit}: traced ink enters torso'
    assert np.all(traced_keep[(outline & torso_core)] == 255)
    body_names = (['Body' + suffix for suffix in ('', ' crew', ' thin crew', ' scoop', ' deep V-neck', ' polo collar')]
                  if fit == 'slim' else [path.stem for path in (SOURCE / 'Body').glob(f'* ({fit}).svg')])
    assert len(body_names) == 6, f'{fit}: missing neckline variants'
    for name in body_names:
        variant = source('Body', name) & torso_core
        assert np.all(traced_keep[variant] == 255), f'{name}: original body clipped'
        assert not np.any(traced_ink[variant]), f'{name}: new sleeve ink overlaps body'
    measured_widths = []
    for side in ('left', 'right'):
        filled = masks[side] | masks[side + '-cuff']
        if side == 'right':
            filled = np.fliplr(filled)
        ink = traced_ink if side == 'left' else np.fliplr(traced_ink)
        widths = []
        cuff_start = int(np.where(masks[side + '-cuff'])[0].min())
        for row in range(old_end + 5, cuff_start - 8):
            occupied = np.flatnonzero(filled[row])
            if occupied.size > 40:
                outer = int(occupied[0])
                widths.append(np.count_nonzero(ink[row, outer - 2:outer + line_width + 5] >= 128))
        measured = float(np.median(widths))
        assert abs(measured - line_width) <= 1, f'{fit} {side}: traced outline width {measured}'
        measured_widths.append(measured)
    proof = np.full((HEIGHT, WIDTH, 3), 255, np.uint8)
    proof[(body & keep) | hem] = (235, 238, 237)
    proof[masks['left'] | masks['left-cuff']] = (207, 58, 66)
    proof[masks['right'] | masks['right-cuff']] = (62, 156, 166)
    proof[(outline & keep) | structural] = (20, 20, 20)
    Image.fromarray(proof).save(STAGE / f'{fit}-proof.png')
    report = {'fit': fit, 'extension': extension, 'directions': directions,
              'bodyOutlineWidth': line_width, 'originalSleeveEnd': old_end,
              'tracedSleeveOutlineWidths': measured_widths, 'protectedNecklineVariants': len(body_names),
              'newSleeveEnd': int(np.where(selector)[0].max()),
              'attachmentPreserved': True, 'torsoPreserved': True,
              'shoulderColourExcluded': True, 'extraSleeveStrokes': False}
    print(json.dumps(report), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--fits', nargs='+', choices=FITS, default=FITS)
    arguments = parser.parse_args()
    original_hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest()
                       for path in SOURCE.parent.rglob('*') if path.is_file()}
    reports = [build(fit) for fit in arguments.fits]
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == digest
               for path, digest in original_hashes.items()), 'Existing assets changed during generation'
    if arguments.install:
        output = SOURCE / 'longer-short-sleeves'
        output.mkdir(exist_ok=True)
        for fit in arguments.fits:
            for name in ('left', 'right', 'left-cuff', 'right-cuff', 'outline', 'stitch', 'keep'):
                shutil.copyfile(STAGE / f'{fit}-{name}.svg', output / f'{fit}-{name}.svg')
            name = f'Longer short sleeve ({fit}).svg'
            shutil.copyfile(STAGE / name, SOURCE / 'Sleeve length' / name)
    report_path = STAGE / 'validation.json'
    report_path.write_text(json.dumps({'fits': reports, 'unchangedAssets': len(original_hashes)}, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()