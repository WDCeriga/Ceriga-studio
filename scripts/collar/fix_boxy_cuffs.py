"""Straighten boxy ringer cuff hems and rib ticks in the bold line art.

Does not author SVG paths. Edits the 1024x1536 raster, then the usual key /
pack pipeline traces it. Left and right cuffs are rebuilt as parallelograms
from each cuff region's PCA so they stay aligned with the existing sleeves.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402
import pack_studio_boxy as boxy  # noqa: E402

BACKUP = boxy.SRC / "_diag" / "boxy-tshirt-lineart-bold-precuff.png"
PREVIEW_L = boxy.SRC / "_diag" / "boxy-left-cuff-fixed.png"
PREVIEW_R = boxy.SRC / "_diag" / "boxy-right-cuff-fixed.png"

OUTLINE_W = 5
JOIN_W = 3
TICK_W = 2
DASH_W = 2
TICK_COUNT = 13
DASH_ON = 7
DASH_OFF = 6
DASH_INSET = 6

# Centroids of closed fill cells that belong to each ringer cuff on the
# original (pre-fix) drawing. Used instead of pack seeds so a split cuff
# still rebuilds as one band.
CUFF_BOXES = {
    "Left cuff": (20, 260, 520, 730),
    "Right cuff": (760, 1004, 520, 730),
}


def pca(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ys, xs = np.nonzero(mask)
    pts = np.stack([xs.astype(np.float64), ys.astype(np.float64)], axis=1)
    mean = pts.mean(axis=0)
    cov = np.cov(pts - mean, rowvar=False)
    vals, vecs = np.linalg.eigh(cov)
    order = np.argsort(vals)[::-1]
    return mean, vecs[:, order[0]], vecs[:, order[1]]


def claim_masks(regions: G.Regions) -> dict[str, np.ndarray]:
    claimed: dict[str, np.ndarray] = {}
    for entry in boxy.PART_SEEDS:
        mask = np.zeros(regions.labels.shape, bool)
        for x, y in entry["seeds"]:
            region_id = int(regions.labels[y, x])
            if region_id:
                mask |= regions.mask(region_id)
        cat = entry["category"]
        claimed[cat] = mask if cat not in claimed else claimed[cat] | mask
    for cat, (x0, x1, y0, y1) in CUFF_BOXES.items():
        mask = np.zeros(regions.labels.shape, bool)
        for region_id in regions.ids:
            cell = regions.mask(region_id)
            ys, xs = np.nonzero(cell)
            cx, cy = float(xs.mean()), float(ys.mean())
            if x0 <= cx <= x1 and y0 <= cy <= y1 and regions.area(region_id) >= 400:
                mask |= cell
        if not mask.any():
            raise SystemExit(f"no cuff cells in {cat} box {x0, x1, y0, y1}")
        claimed[cat] = mask
    return claimed


SCALE = 4


def xy(origin: np.ndarray, major: np.ndarray, minor: np.ndarray, t: float, n: float) -> tuple[float, float]:
    p = origin + t * major + n * minor
    return float(p[0]), float(p[1])


def stroke_poly(
    p0: tuple[float, float],
    p1: tuple[float, float],
    width: float,
) -> list[tuple[float, float]]:
    dx = p1[0] - p0[0]
    dy = p1[1] - p0[1]
    length = (dx * dx + dy * dy) ** 0.5 or 1.0
    nx = -dy / length * width / 2
    ny = dx / length * width / 2
    return [
        (p0[0] + nx, p0[1] + ny),
        (p1[0] + nx, p1[1] + ny),
        (p1[0] - nx, p1[1] - ny),
        (p0[0] - nx, p0[1] - ny),
    ]


def rebuild_cuff(
    rgb: Image.Image,
    cuff: np.ndarray,
    sleeve: np.ndarray,
) -> None:
    origin, major, minor = pca(cuff)
    sleeve_mean = np.array(
        [np.nonzero(sleeve)[1].mean(), np.nonzero(sleeve)[0].mean()],
        dtype=np.float64,
    )
    if np.dot(sleeve_mean - origin, minor) < 0:
        minor = -minor

    ys, xs = np.nonzero(cuff)
    pts = np.stack([xs.astype(np.float64), ys.astype(np.float64)], axis=1)
    t = (pts - origin) @ major
    n = (pts - origin) @ minor
    # Trim a few outlier pixels so one blob doesn't twist the band.
    t0, t1 = np.percentile(t, [1.5, 98.5])
    n_open, n_join = np.percentile(n, [2.0, 98.0])

    wipe = ndimage.binary_dilation(cuff, iterations=12)
    wys, wxs = np.nonzero(wipe)
    wpts = np.stack([wxs.astype(np.float64), wys.astype(np.float64)], axis=1)
    wn = (wpts - origin) @ minor
    # Expand the wipe past the old hem, but not along the band into the body.
    en_open = float(np.percentile(wn, 0.2))
    pad_t = 4.0
    pad_join = DASH_INSET + DASH_W + 4
    erase = [
        xy(origin, major, minor, t0 - pad_t, en_open),
        xy(origin, major, minor, t1 + pad_t, en_open),
        xy(origin, major, minor, t1 + pad_t, n_join + pad_join),
        xy(origin, major, minor, t0 - pad_t, n_join + pad_join),
    ]

    xs = [p[0] for p in erase]
    ys = [p[1] for p in erase]
    x0 = max(0, int(np.floor(min(xs))) - 2)
    y0 = max(0, int(np.floor(min(ys))) - 2)
    x1 = min(rgb.size[0], int(np.ceil(max(xs))) + 2)
    y1 = min(rgb.size[1], int(np.ceil(max(ys))) + 2)
    crop = rgb.crop((x0, y0, x1, y1))
    hi = crop.resize((crop.size[0] * SCALE, crop.size[1] * SCALE), Image.NEAREST)
    draw = ImageDraw.Draw(hi)

    def sx(point: tuple[float, float]) -> tuple[float, float]:
        return ((point[0] - x0) * SCALE, (point[1] - y0) * SCALE)

    def paint(p0: tuple[float, float], p1: tuple[float, float], width: float) -> None:
        draw.polygon([sx(p) for p in stroke_poly(p0, p1, width)], fill=(0, 0, 0))

    draw.polygon([sx(p) for p in erase], fill=(255, 255, 255))

    open_a = xy(origin, major, minor, t0, n_open)
    open_b = xy(origin, major, minor, t1, n_open)
    join_a = xy(origin, major, minor, t0, n_join)
    join_b = xy(origin, major, minor, t1, n_join)
    # Overlap the remaining sleeve outline so the cuff sides do not leave a gap.
    side_a = xy(origin, major, minor, t0, n_join + pad_join)
    side_b = xy(origin, major, minor, t1, n_join + pad_join)
    paint(open_a, open_b, OUTLINE_W)
    paint(join_a, join_b, JOIN_W)
    paint(open_a, side_a, OUTLINE_W)
    paint(open_b, side_b, OUTLINE_W)

    tick_n0 = n_open + OUTLINE_W * 0.55
    tick_n1 = n_join - JOIN_W * 0.55
    margin = 14.0
    for i in range(TICK_COUNT):
        tt = t0 + margin + (t1 - t0 - 2 * margin) * (i + 0.5) / TICK_COUNT
        paint(
            xy(origin, major, minor, tt, tick_n0),
            xy(origin, major, minor, tt, tick_n1),
            TICK_W,
        )

    dash_n = n_join + DASH_INSET
    length = t1 - t0 - 2 * margin
    pos = 0.0
    on = True
    while pos < length:
        span = DASH_ON if on else DASH_OFF
        nxt = min(length, pos + span)
        if on:
            paint(
                xy(origin, major, minor, t0 + margin + pos, dash_n),
                xy(origin, major, minor, t0 + margin + nxt, dash_n),
                DASH_W,
            )
        pos = nxt
        on = not on

    rgb.paste(hi.resize(crop.size, Image.BOX), (x0, y0))


def main() -> None:
    if not boxy.ART_IN.exists():
        raise SystemExit(f"missing {boxy.ART_IN}")

    boxy.SRC.joinpath("_diag").mkdir(parents=True, exist_ok=True)
    if BACKUP.exists():
        shutil.copy2(BACKUP, boxy.ART_IN)
        print(f"restored {BACKUP.name}")
    else:
        shutil.copy2(boxy.ART_IN, BACKUP)
        print(f"backup {BACKUP.name}")

    keyed = boxy.key_lineart(boxy.ART_IN)
    keyed.save(boxy.KEYED)
    regions = G.analyse(boxy.KEYED, G.Settings())
    masks = claim_masks(regions)

    rgb = Image.open(boxy.ART_IN).convert("RGB")
    rebuild_cuff(rgb, masks["Left cuff"], masks["Left sleeve"])
    rebuild_cuff(rgb, masks["Right cuff"], masks["Right sleeve"])
    rgb.save(boxy.ART_IN)
    rgb.crop((10, 510, 240, 720)).save(PREVIEW_L)
    rgb.crop((780, 510, 1010, 720)).save(PREVIEW_R)
    print(f"wrote {boxy.ART_IN.name}")
    print(f"preview {PREVIEW_L.name} {PREVIEW_R.name}")


if __name__ == "__main__":
    main()
