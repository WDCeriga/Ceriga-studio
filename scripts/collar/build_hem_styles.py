from io import BytesIO
from pathlib import Path
import argparse
import json

import cv2
import numpy as np
from PIL import Image
import resvg_py


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'src/assets/studio-tshirt'
SIZE = 1536
FITS = ('slim', 'regular', 'boxy', 'oversized')


def render(path):
    png = resvg_py.svg_to_bytes(svg_path=str(path), width=SIZE, height=SIZE)
    return np.asarray(Image.open(BytesIO(png)).convert('RGBA'))[:, :, 3] >= 128


def dilate(mask, radius):
    return cv2.dilate(mask.astype(np.uint8), np.ones((radius * 2 + 1,) * 2, np.uint8)) > 0


def closed(mask, radius=4):
    filled = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE,
                              np.ones((radius * 2 + 1,) * 2, np.uint8))
    contours, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, contours, -1, 1, cv2.FILLED)
    return filled > 0


def path_data(mask):
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for contour in contours:
        if cv2.contourArea(contour) < 1:
            continue
        points = cv2.approxPolyDP(contour, .35, True).reshape(-1, 2)
        paths.append('M' + ' L'.join(f'{int(point[0])},{int(point[1])}' for point in points) + ' Z')
    return ' '.join(paths)


def geometry(band, parent, outline, stitching):
    band = closed(band)
    silhouette = closed(parent | band | (outline & dilate(parent | band, 7)))
    distance = cv2.distanceTransform(silhouette.astype(np.uint8), cv2.DIST_L2, 5)
    interior = distance > 3
    points = np.column_stack(np.where(band)[::-1]).astype(float)
    eigenvalues, eigenvectors = np.linalg.eigh(np.cov(points.T))
    tangent = eigenvectors[:, np.argmax(eigenvalues)]
    if tangent[0] < 0:
        tangent = -tangent
    angle = float(np.degrees(np.arctan2(tangent[1], tangent[0])))
    matrix = cv2.getRotationMatrix2D(tuple(points.mean(axis=0)), angle, 1)
    inverse = cv2.invertAffineTransform(matrix)

    def warp(mask, transform):
        return cv2.warpAffine(mask.astype(np.uint8), transform, (SIZE, SIZE),
                              flags=cv2.INTER_NEAREST) > 0

    aligned_band = warp(band, matrix)
    aligned_ink = warp(outline & dilate(band, 4), matrix)
    seams = cv2.morphologyEx(aligned_ink.astype(np.uint8), cv2.MORPH_OPEN,
                             np.ones((1, 17), np.uint8)) > 0
    seams = warp(dilate(seams, 1), inverse)
    normal_cut = dilate(band, 4) & interior & ~(seams & (distance > 8))
    old_ribs = outline & normal_cut
    detected_ribs = outline & dilate(band, 2) & (distance > 8) & ~seams
    count, _, stats, _ = cv2.connectedComponentsWithStats(detected_ribs.astype(np.uint8), 8)
    rib_count = sum(stats[index, cv2.CC_STAT_AREA] >= 8 for index in range(1, count))
    ribbing = old_ribs.copy()
    extra_stitch = np.zeros_like(band)
    columns = np.flatnonzero(aligned_band.any(axis=0))
    extra_seam = np.zeros_like(band)
    if np.count_nonzero(outline & seams & interior) < 20:
        generated = np.zeros_like(band)
        for column in columns:
            top = int(np.flatnonzero(aligned_band[:, column])[0])
            generated[max(0, top - 1):top + 2, column] = True
        extra_seam = warp(generated, inverse) & interior
    if rib_count < 5:
        generated = np.zeros_like(band)
        for column in range(int(columns[0]) + 8, int(columns[-1]) - 7, 13):
            rows = np.flatnonzero(aligned_band[:, column])
            if rows.size > 8:
                generated[rows[0] + 3:rows[-1] - 2, column:column + 2] = True
        ribbing |= warp(generated, inverse) & band & interior & ~seams
    stitch_cut = dilate(band, 20)
    if np.count_nonzero(stitching & stitch_cut) < 20:
        generated = np.zeros_like(band)
        for column in columns[8:-8]:
            if (int(column) - int(columns[0])) % 15 >= 9:
                continue
            top = int(np.flatnonzero(aligned_band[:, column])[0])
            generated[max(0, top - 7):max(0, top - 5), column] = True
        extra_stitch = warp(generated, inverse) & interior
    none_cut = dilate(band, 12) & interior
    fill = dilate(band, 5) & silhouette
    assert not np.any(none_cut & (distance <= 3))
    assert not np.any(normal_cut & (distance <= 3))
    masks = dict(normalCut=normal_cut, noneCut=none_cut, stitchCut=stitch_cut,
                 fill=fill, ribbing=ribbing, extraStitch=extra_stitch, extraSeam=extra_seam)
    return {name: path_data(mask) for name, mask in masks.items()}, {
        'originalRibCount': int(rib_count),
        'removedRibPixels': int(old_ribs.sum()),
        'ribPixels': int(ribbing.sum()),
        'hemStitchPixels': int((stitching & stitch_cut).sum()),
        'outerEdgeProtected': True,
    }


def build(fit, variant):
    tag = '' if fit == 'slim' else f' ({fit})'
    body_tag = ' crew' if fit == 'slim' else tag
    outline = render(SOURCE / 'Outline' / f'Outline{body_tag}.svg')
    stitching = render(SOURCE / 'Stitching' / f'Cover stitch{body_tag}.svg')
    body = render(SOURCE / 'Body' / f'Body{body_tag}.svg')
    hems = {'bodyHem': (render(SOURCE / 'Body hem' / f'Body hem{tag}.svg'), body)}
    if variant not in ('short', 'layered-long'):
        folder = SOURCE / f'{variant}-sleeves'
        keep = render(folder / f'{fit}-keep.svg')
        outline = (outline & keep) | render(folder / f'{fit}-outline.svg')
        stitching = (stitching & keep) | render(folder / f'{fit}-stitch.svg')
    for side in ('Left', 'Right'):
        if variant in ('short', 'layered-long'):
            band = render(SOURCE / f'{side} cuff' / f'{side} cuff{tag}.svg')
            parent = render(SOURCE / f'{side} sleeve' / f'{side} sleeve{tag}.svg')
            if fit in ('regular', 'oversized'):
                band[:408] = False
                parent[:408] = False
        else:
            band = render(folder / f'{fit}-{side.lower()}-cuff.svg')
            parent = render(folder / f'{fit}-{side.lower()}.svg')
        hems[f'sleeveHem{side}'] = (band, parent)
    if variant == 'layered-long':
        folder = SOURCE / 'layered-long-sleeves'
        outline |= render(folder / f'{fit}-outline.svg')
        stitching |= render(folder / f'{fit}-stitch.svg')
        for side in ('Left', 'Right'):
            hems[f'underlayerHem{side}'] = (
                render(folder / f'{fit}-{side.lower()}-hem.svg'),
                render(folder / f'{fit}-{side.lower()}.svg'))
    data, reports = {}, {}
    for name, (band, parent) in hems.items():
        data[name], reports[name] = geometry(band, parent, outline, stitching)
    return data, reports


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fit', choices=FITS)
    parser.add_argument('--variant', choices=('short', 'long', 'longer-short', 'cap', 'layered-long'))
    parser.add_argument('--install', action='store_true')
    arguments = parser.parse_args()
    output = {}
    for fit in (arguments.fit,) if arguments.fit else FITS:
        for variant in (arguments.variant,) if arguments.variant else ('short', 'long', 'longer-short', 'cap', 'layered-long'):
            data, report = build(fit, variant)
            output[f'{fit}:{variant}'] = data
            print(json.dumps({'fit': fit, 'variant': variant, 'regions': report}), flush=True)
    if arguments.install:
        target = SOURCE / 'hem-styles.json'
        target.write_text(json.dumps(output, separators=(',', ':')) + '\n', encoding='utf-8')
        print(f'Wrote {target.name}: {target.stat().st_size} bytes', flush=True)


if __name__ == '__main__':
    main()