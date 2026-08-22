"""Black-and-white construction line art of only the collar.

Photo sets the *shape* (crew / V / mock+gusset). The drawing is always a
closed ribbed ring on a white page — same language as the slim V-neck.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

DS = 3
PAGE = 1024
BAND = 52.0
MOCK_BAND = 76.0
BACK_BAND = 34.0
LEG_BOW = 14.0
BACK_LIFT = 22.0
MITRE_LIMIT = 1.35
EDGE_W = 4.0
RIB_PITCH = 8.0
RIB_W = 2.2
RIB_START = 2.5
STITCH_GAP = 6.0
STITCH_W = 2.2
STITCH_ON = 8.0
STITCH_OFF = 6.0

# Inner shoulder corners on the construction page. Outer extrema of the
# finished drawing map onto the slim crew socket (354, 210) / (671, 210).
LEFT = np.array([268.0, 410.0])
RIGHT = np.array([756.0, 410.0])

W = H = PAGE


@dataclass
class CollarShape:
    kind: str
    depth: float
    band: float
    gusset: float
    oval: bool


def quad(p0, p1, p2, n: int) -> np.ndarray:
    t = np.linspace(0.0, 1.0, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t**2 * p2


def resample(points: np.ndarray, step: float = 1.0, closed: bool = False) -> np.ndarray:
    pts = np.vstack([points, points[:1]]) if closed else points
    seg = np.hypot(*np.diff(pts, axis=0).T)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    if s[-1] < 1e-6:
        return points
    want = (
        np.arange(0.0, s[-1], step)
        if closed
        else np.linspace(0.0, s[-1], max(2, int(round(s[-1] / step)) + 1))
    )
    return np.stack([np.interp(want, s, pts[:, 0]), np.interp(want, s, pts[:, 1])], 1)


def polygon_area(points: np.ndarray) -> float:
    x, y = points[:, 0], points[:, 1]
    return abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2.0


def outward_offset(points: np.ndarray, d: float) -> np.ndarray:
    prev_seg = points - np.roll(points, 1, axis=0)
    next_seg = np.roll(points, -1, axis=0) - points

    def unit_normal(v):
        n = np.stack([v[:, 1], -v[:, 0]], axis=1)
        return n / np.maximum(np.hypot(*n.T), 1e-9)[:, None]

    n1, n2 = unit_normal(prev_seg), unit_normal(next_seg)
    bisector = n1 + n2
    bisector /= np.maximum(np.hypot(*bisector.T), 1e-9)[:, None]
    mitre = 1.0 / np.clip((bisector * n1).sum(axis=1), 1.0 / MITRE_LIMIT, 1.0)
    out = points + bisector * (d * mitre)[:, None]
    if polygon_area(out) < polygon_area(points):
        out = points - bisector * (d * mitre)[:, None]
    return out


def ellipse(cx: float, cy: float, rx: float, ry: float, n: int = 320) -> np.ndarray:
    t = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False) - np.pi
    return np.stack([cx + rx * np.cos(t), cy + ry * np.sin(t)], 1)


def canvas():
    img = Image.new("L", (PAGE * DS, PAGE * DS), 0)
    return img, ImageDraw.Draw(img)


def to_mask(img: Image.Image) -> np.ndarray:
    return np.asarray(img.resize((PAGE, PAGE), Image.LANCZOS)) >= 128


def xy(points: np.ndarray):
    return [(float(x) * DS, float(y) * DS) for x, y in points]


def rib_pairs(inner: np.ndarray, outer: np.ndarray):
    pairs = []
    since = RIB_PITCH
    for i in range(len(inner)):
        j = (i + 1) % len(inner)
        if since >= RIB_PITCH:
            pairs.append((inner[i], outer[i]))
            since = 0.0
        swing = float(np.hypot(*(outer[j] - outer[i])))
        if swing > RIB_PITCH:
            for t in np.arange(RIB_PITCH, swing, RIB_PITCH) / swing:
                pairs.append(
                    (inner[i] + (inner[j] - inner[i]) * t, outer[i] + (outer[j] - outer[i]) * t)
                )
            since = RIB_PITCH
        since += float(np.hypot(*(inner[j] - inner[i])))
    return pairs


def draw_ribs(inner: np.ndarray, outer: np.ndarray) -> np.ndarray:
    img, draw = canvas()
    for a, b in rib_pairs(inner, outer):
        span = b - a
        length = float(np.hypot(*span))
        if length < 1e-9:
            continue
        step = span / length
        draw.line(
            [tuple((a + step * RIB_START) * DS), tuple((b - step * 1.5) * DS)],
            fill=255,
            width=int(RIB_W * DS),
        )
    return to_mask(img)


def draw_edges(inner: np.ndarray, outer: np.ndarray, apex: int, miter: bool) -> np.ndarray:
    img, draw = canvas()
    for ring in (inner, outer):
        draw.line(xy(np.vstack([ring, ring[:1]])), fill=255, width=int(EDGE_W * DS), joint="curve")
    if miter:
        draw.line(
            xy(np.array([inner[apex], outer[apex]])),
            fill=255,
            width=int(EDGE_W * 0.7 * DS),
        )
    period = STITCH_ON + STITCH_OFF
    dash = resample(outward_offset(outer, STITCH_GAP), 1.0, closed=True)
    for i in range(len(dash) - 1):
        if i % period < STITCH_ON:
            draw.line(
                [tuple(dash[i] * DS), tuple(dash[i + 1] * DS)],
                fill=255,
                width=int(STITCH_W * DS),
            )
    return to_mask(img)


def _edge_map(photo: Image.Image) -> np.ndarray:
    grey = ImageOps.autocontrast(photo.convert("L"), cutoff=1)
    blur = grey.filter(ImageFilter.GaussianBlur(radius=1.4))
    arr = np.abs(np.asarray(grey, np.int16) - np.asarray(blur, np.int16))
    return arr >= max(18, int(np.percentile(arr, 82)))


def read_shape(photo: Image.Image) -> CollarShape:
    """Proportions from the photo — not a separate pipeline per neck type."""
    w, h = photo.size
    edges = _edge_map(photo)
    ys, xs = np.where(edges)
    if xs.size < 80:
        grey = np.asarray(photo.convert("L"))
        ys, xs = np.where(grey < np.median(grey) - 8)
    if xs.size < 80:
        return CollarShape("crew", 0.22, BAND, 0.0, False)

    keep = ys < int(h * 0.88)
    xs, ys = xs[keep], ys[keep]
    x0, x1 = int(np.percentile(xs, 5)), int(np.percentile(xs, 95))
    width = max(40.0, float(x1 - x0))
    cx = (x0 + x1) / 2.0

    def high(x_lo, x_hi):
        col = (xs >= x_lo) & (xs <= x_hi)
        return float(ys[col].min()) if np.any(col) else float(np.percentile(ys, 8))

    left_y = high(x0, x0 + width * 0.14)
    right_y = high(x1 - width * 0.14, x1)
    shoulder_y = (left_y + right_y) / 2.0
    mid = np.abs(xs - cx) < width * 0.14
    apex_y = float(ys[mid].max()) if np.any(mid) else shoulder_y + width * 0.22
    depth = (apex_y - shoulder_y) / width
    closeup = left_y < h * 0.10 and right_y < h * 0.10

    if closeup:
        # Standing mock/funnel: round opening, optional CF gusset below the join.
        gusset = float(np.clip(depth, 0.12, 0.40))
        return CollarShape("mock", 0.16, MOCK_BAND, gusset, True)
    if depth > 0.28:
        return CollarShape("vneck", float(np.clip(depth, 0.32, 0.82)), BAND, 0.0, False)
    return CollarShape("crew", 0.22, BAND, 0.0, False)


def inner_ring(shape: CollarShape) -> tuple[np.ndarray, int, int]:
    left, right = LEFT.copy(), RIGHT.copy()
    width = float(right[0] - left[0])
    cx = (left[0] + right[0]) / 2.0
    if shape.oval:
        rx = width * 0.47
        ry = max(28.0, width * 0.13)
        inner = ellipse(cx, left[1] + ry * 0.12, rx, ry)
        return inner, int(np.argmax(inner[:, 1])), 0

    back = np.array([cx, left[1] - BACK_LIFT])
    apex = np.array([cx, left[1] + width * shape.depth])
    top = resample(quad(left, back, right, 240))
    bow = LEG_BOW if shape.kind == "vneck" else 4.0

    def leg(shoulder, sign):
        mid = (shoulder + apex) / 2.0
        return resample(quad(shoulder, mid + [sign * bow, 0.0], apex, 360))

    right_leg = leg(right, 1.0)
    left_leg = leg(left, -1.0)[::-1]
    inner = np.vstack([top, right_leg[1:], left_leg[1:-1]])
    apex_i = len(top) + len(right_leg) - 2
    return inner, apex_i, len(top)


def lift_back(inner: np.ndarray, outer: np.ndarray, n_top: int) -> np.ndarray:
    if n_top < 8:
        return outer
    back_in = inner[:n_top]
    tan = np.zeros_like(back_in)
    tan[1:-1] = back_in[2:] - back_in[:-2]
    tan[0] = back_in[1] - back_in[0]
    tan[-1] = back_in[-1] - back_in[-2]
    nrm = np.stack([tan[:, 1], -tan[:, 0]], axis=1)
    nrm /= np.maximum(np.hypot(nrm[:, 0], nrm[:, 1]), 1e-9)[:, None]
    up = back_in - nrm * BACK_BAND
    if up[:, 1].mean() > back_in[:, 1].mean():
        up = back_in + nrm * BACK_BAND
    outer = outer.copy()
    outer[:n_top] = up
    return outer


def add_gusset(outer: np.ndarray, length: float) -> np.ndarray:
    """Pull the center-front outer edge down to a V-gusset without opening the ring."""
    if length < 8:
        return outer
    i = int(np.argmax(outer[:, 1]))
    n = len(outer)
    span = max(12, n // 16)
    tip = np.array([outer[i, 0], outer[i, 1] + length])
    out = outer.copy()
    for k in range(-span, span + 1):
        j = (i + k) % n
        t = abs(k) / span
        out[j] = outer[j] * t + tip * (1.0 - t)
    return out


def render_lineart(photo: Image.Image) -> tuple[Image.Image, str]:
    global W, H
    W = H = PAGE
    shape = read_shape(photo)
    inner, apex_i, n_top = inner_ring(shape)
    outer = outward_offset(inner, shape.band)
    outer = lift_back(inner, outer, n_top)
    if shape.gusset > 0:
        outer = add_gusset(outer, shape.gusset * float(RIGHT[0] - LEFT[0]))
        apex_i = int(np.argmax(inner[:, 1]))

    ink = draw_edges(inner, outer, apex_i, miter=shape.kind == "vneck") | draw_ribs(inner, outer)
    rgb = np.full((PAGE, PAGE, 3), 255, np.uint8)
    rgb[ink] = (18, 18, 18)
    return Image.fromarray(rgb), shape.kind
