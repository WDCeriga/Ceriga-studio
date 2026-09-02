"""Redraw only the oversized crew collar on the existing bold line art.

Starts from the pre-neck backup so body, sleeves, hems, and cuffs stay as-is.
Replaces the rib-split collar with two smooth closed ellipses (outer join +
inner opening) so colour fills as one Neck ring plus Inner back through the
hole. Adds isolated hem-sized cover-stitch dashes on the body below the join.

Does not author SVG paths. Raster first, then pack_studio_oversized traces it.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SRC = ROOT / "src" / "assets" / "studio-tshirt"
ART = SRC / "oversized-tshirt-lineart-bold.png"
BACKUP = SRC / "_diag" / "oversized-tshirt-lineart-bold-preneck.png"
PREVIEW = SRC / "_diag" / "oversized-neck-fixed.png"

SCALE = 8
OUTLINE_W = 4
RIB_W = 2
DASH_W = 3
RIB_COUNT = 24
RIB_INSET = 0
RIB_LEN = 7
DASH_LEN = 6
DASH_GAP_ALONG = 7
DASH_OFFSETS = (9, 16)
# Front cover-stitch only (radians from +x). Down is +pi/2.
STITCH_ANG_MIN = math.pi / 2 - 1.05
STITCH_ANG_MAX = math.pi / 2 + 1.05

# Fitted to the backup collar union (1024x1536). Outer = closed join.
# Inner = neck opening (inner-back fill).
CX, CY = 511.5, 305.5
OUTER_RX, OUTER_RY = 128.5, 66.5
INNER_CX, INNER_CY = 511.0, 314.0
INNER_RX, INNER_RY = 86.0, 28.0


def ellipse_pts(cx: float, cy: float, rx: float, ry: float, n: int = 720) -> list[tuple[float, float]]:
    t = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False)
    return [(float(cx + rx * np.cos(t_i)), float(cy + ry * np.sin(t_i))) for t_i in t]


def unit(dx: float, dy: float) -> tuple[float, float]:
    length = max((dx * dx + dy * dy) ** 0.5, 1e-9)
    return dx / length, dy / length


def draw_ribs(
    draw: ImageDraw.ImageDraw,
    inner: list[tuple[float, float]],
    outer: list[tuple[float, float]],
) -> None:
    """Short even ticks from each edge so they never bridge the band."""
    n = min(len(inner), len(outer))
    shoulder_angs = (3.49, 5.91)  # left / right join, radians from +x
    for k in range(RIB_COUNT):
        i = int(round(k * n / RIB_COUNT)) % n
        ang = 2.0 * math.pi * i / n
        if any(abs((ang - s + math.pi) % (2 * math.pi) - math.pi) < 0.32 for s in shoulder_angs):
            continue
        if STITCH_ANG_MIN <= ang <= STITCH_ANG_MAX:
            continue
        ix, iy = inner[i]
        ox, oy = outer[i]
        ux, uy = unit(ox - ix, oy - iy)
        gap = float(np.hypot(ox - ix, oy - iy))
        tick = min(float(RIB_LEN), max(4.0, gap * 0.16))
        inner_a = (ix + ux * RIB_INSET, iy + uy * RIB_INSET)
        inner_b = (ix + ux * (RIB_INSET + tick), iy + uy * (RIB_INSET + tick))
        outer_a = (ox - ux * RIB_INSET, oy - uy * RIB_INSET)
        outer_b = (ox - ux * (RIB_INSET + tick), oy - uy * (RIB_INSET + tick))
        for a, b in ((inner_a, inner_b), (outer_a, outer_b)):
            draw.line(
                [(a[0] * SCALE, a[1] * SCALE), (b[0] * SCALE, b[1] * SCALE)],
                fill=(0, 0, 0),
                width=max(1, RIB_W * SCALE),
            )


def draw_front_stitch(draw: ImageDraw.ImageDraw, outer: list[tuple[float, float]]) -> None:
    """Isolated hem-sized dashes on the body, front U only. Two cover-stitch rows."""
    front = []
    for x, y in outer:
        ang = math.atan2(y - CY, x - CX)
        if STITCH_ANG_MIN <= ang <= STITCH_ANG_MAX:
            front.append((x, y))
    if len(front) < 8:
        return
    front.sort(key=lambda p: math.atan2(p[1] - CY, p[0] - CX))
    for offset in DASH_OFFSETS:
        pts: list[tuple[float, float]] = []
        for x, y in front:
            ux, uy = unit(x - CX, y - CY)
            pts.append((x + ux * offset, y + uy * offset))
        if len(pts) < 4:
            continue
        # Walk arc length so each dash is a short isolated segment.
        dist = [0.0]
        for i in range(1, len(pts)):
            dist.append(dist[-1] + float(np.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])))
        total = dist[-1]
        pos = 0.0
        period = DASH_LEN + DASH_GAP_ALONG
        while pos + DASH_LEN <= total:
            a = _at_length(pts, dist, pos)
            b = _at_length(pts, dist, pos + DASH_LEN)
            draw.line(
                [(a[0] * SCALE, a[1] * SCALE), (b[0] * SCALE, b[1] * SCALE)],
                fill=(0, 0, 0),
                width=DASH_W * SCALE,
            )
            pos += period


def _at_length(
    pts: list[tuple[float, float]],
    dist: list[float],
    target: float,
) -> tuple[float, float]:
    for i in range(1, len(dist)):
        if dist[i] >= target:
            span = dist[i] - dist[i - 1]
            t = 0.0 if span <= 1e-9 else (target - dist[i - 1]) / span
            x = pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0])
            y = pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])
            return x, y
    return pts[-1]


def erase_old_collar(rgb: np.ndarray) -> np.ndarray:
    """Clear rib slivers and the hole. Keep the outer join so the body stays closed."""
    h, w = rgb.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    in_outer_inset = ((xx - CX) / max(OUTER_RX - 4, 8)) ** 2 + (
        (yy - CY) / max(OUTER_RY - 4, 8)
    ) ** 2 <= 1.0
    in_inner_pad = ((xx - INNER_CX) / (INNER_RX + 5)) ** 2 + (
        (yy - INNER_CY) / (INNER_RY + 5)
    ) ** 2 <= 1.0
    hole = ((xx - INNER_CX) / max(INNER_RX - 4, 8)) ** 2 + (
        (yy - INNER_CY) / max(INNER_RY - 4, 8)
    ) ** 2 <= 1.0
    out = rgb.copy()
    out[in_outer_inset & ~in_inner_pad] = 255
    out[hole] = 255
    return out


def stamp_ellipse_ring(
    arr: np.ndarray,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    half_width: float = 2.4,
) -> None:
    """Paint a closed ellipse ring with no gaps (parametric + normal offset)."""
    h, w = arr.shape[:2]
    t = np.linspace(0.0, 2.0 * math.pi, 4000, endpoint=False)
    x = cx + rx * np.cos(t)
    y = cy + ry * np.sin(t)
    gx = (x - cx) / (rx * rx)
    gy = (y - cy) / (ry * ry)
    norm = np.clip(np.hypot(gx, gy), 1e-9, None)
    gx, gy = gx / norm, gy / norm
    for off in np.linspace(-half_width, half_width, 13):
        xs = np.clip(np.round(x + off * gx).astype(int), 0, w - 1)
        ys = np.clip(np.round(y + off * gy).astype(int), 0, h - 1)
        arr[ys, xs] = (18, 18, 18)


def stamp_closed_rings(arr: np.ndarray) -> None:
    stamp_ellipse_ring(arr, CX, CY, OUTER_RX, OUTER_RY, 2.4)
    stamp_ellipse_ring(arr, INNER_CX, INNER_CY, INNER_RX, INNER_RY, 2.2)


def connect_shoulders(arr: np.ndarray) -> None:
    """Short 1x stubs from leftover shoulder ink onto the closed outer ring."""
    h, w = arr.shape[:2]
    ink = arr.mean(axis=2) < 80
    yy, xx = np.ogrid[:h, :w]
    e = ((xx - CX) / OUTER_RX) ** 2 + ((yy - CY) / OUTER_RY) ** 2
    outside = e > 1.06
    im = Image.fromarray(arr)
    draw = ImageDraw.Draw(im)
    for x0, x1, y0, y1, is_left in (
        (300, 420, 250, 300, True),
        (600, 730, 250, 300, False),
    ):
        ys, xs = np.where(ink[y0:y1, x0:x1] & outside[y0:y1, x0:x1])
        if xs.size < 6:
            continue
        xs = xs + x0
        ys = ys + y0
        idx = int(np.argmax(xs)) if is_left else int(np.argmin(xs))
        sx, sy = float(xs[idx]), float(ys[idx])
        best = None
        best_d = 1e9
        for t in np.linspace(0.0, 2.0 * math.pi, 360, endpoint=False):
            ex = CX + OUTER_RX * math.cos(t)
            ey = CY + OUTER_RY * math.sin(t)
            d = (ex - sx) ** 2 + (ey - sy) ** 2
            if d < best_d:
                best_d = d
                best = (ex, ey)
        if best is None or best_d ** 0.5 > 40:
            continue
        draw.line([(sx, sy), best], fill=(18, 18, 18), width=4)
    arr[:] = np.asarray(im)


def main() -> None:
    if not BACKUP.exists():
        raise SystemExit(f"missing {BACKUP}")

    src = np.asarray(Image.open(BACKUP).convert("RGB")).copy()
    stamp_closed_rings(src)
    cleaned = erase_old_collar(src)
    stamp_closed_rings(cleaned)
    height, width = cleaned.shape[:2]
    hi = Image.fromarray(cleaned).resize((width * SCALE, height * SCALE), Image.NEAREST)
    draw = ImageDraw.Draw(hi)

    outer = ellipse_pts(CX, CY, OUTER_RX, OUTER_RY)
    inner = ellipse_pts(INNER_CX, INNER_CY, INNER_RX, INNER_RY)
    draw_ribs(draw, inner, outer)
    draw_front_stitch(draw, outer)

    out = hi.resize((width, height), Image.LANCZOS).convert("RGB")
    arr = np.asarray(out).copy()
    lum = arr.mean(axis=2)
    arr[lum < 200] = (18, 18, 18)
    arr[lum >= 200] = (255, 255, 255)
    yy, xx = np.ogrid[:height, :width]
    hole = ((xx - INNER_CX) / max(INNER_RX - 5, 8)) ** 2 + (
        (yy - INNER_CY) / max(INNER_RY - 5, 8)
    ) ** 2 <= 1.0
    arr[hole] = (255, 255, 255)
    stamp_closed_rings(arr)
    connect_shoulders(arr)
    stamp_closed_rings(arr)
    Image.fromarray(arr).save(ART)
    Image.fromarray(arr).crop((280, 160, 744, 460)).save(PREVIEW)
    print(f"wrote {ART.name} and {PREVIEW.name}")


if __name__ == "__main__":
    main()
