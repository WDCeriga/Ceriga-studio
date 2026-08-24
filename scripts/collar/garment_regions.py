"""Split a garment line art into its pattern pieces along the lines that are drawn.

The pieces come from the drawing itself rather than from measured landmarks, so a
colour fill stops exactly where the black line is. Three things stand between the
raw artwork and that result:

  * Seams are often drawn as topstitch -- a row of dashes. A fill runs straight
    through the gaps, so dashes are joined into continuous lines first.
  * Joining both rows of a twin-needle topstitch leaves a hairline strip between
    them, which belongs to the piece the stitching sits on, not to its neighbour.
  * Rib hatching chops a collar or cuff into dozens of slivers that are all one
    piece.

So: bridge the dashes, flood the interior into cells, then fold the slivers back
into the piece they came from. What is left is the set of pattern pieces.

Usage:
  python garment_regions.py <art.png> probe        numbered proof sheet
  python garment_regions.py <art.png> probe --tune bridge=20,thin=16
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage


@dataclass
class Settings:
    """Everything that depends on the scale and style of the drawing."""

    ink: int = 32
    """Alpha at or above this counts as a drawn line."""

    dash_len: float = 40.0
    """Longest a stroke can be and still be treated as a dash. Keeps real
    strokes -- drape lines, seam curves -- out of the bridging pass."""

    bridge: float = 18.0
    """Longest gap to close between two dashes."""

    bridge_angle: float = 45.0
    """How far off a dash's own direction its partner may sit, in degrees."""

    thin: float = 15.0
    """A cell narrower than this is stitch-strip or hatch filler, not a piece."""

    min_area: int = 1500
    """A cell smaller than this is filler too."""

    border_share: float = 0.25
    """How much of a cell's longest shared border a neighbour must also share to be
    a candidate to absorb it. Keeps a piece from jumping across a corner touch."""


@dataclass
class Regions:
    labels: np.ndarray
    """Region index per pixel; 0 is outside the garment or on unassigned ink."""

    ids: list[int] = field(default_factory=list)
    ink: np.ndarray | None = None
    interior: np.ndarray | None = None

    def mask(self, region_id: int) -> np.ndarray:
        return self.labels == region_id

    def area(self, region_id: int) -> int:
        return int(np.count_nonzero(self.labels == region_id))

    def anchor(self, region_id: int) -> tuple[int, int]:
        """The point furthest inside the region.

        Not the centroid: a collar is a ring and a hem is a crescent, and the
        centroid of either lands outside the region, which makes it useless both
        as a label position and as a seed point in a parts map.
        """
        mask = self.labels == region_id
        box = ndimage.find_objects(mask)[0]
        depth = ndimage.distance_transform_edt(np.pad(mask[box], 1))
        y, x = np.unravel_index(depth.argmax(), depth.shape)
        return int(x - 1 + box[1].start), int(y - 1 + box[0].start)


# --- reading -----------------------------------------------------------------


def load_alpha(path: Path) -> np.ndarray:
    art = Image.open(path)
    if art.mode != "RGBA":
        art = art.convert("RGBA")
    alpha = np.asarray(art.getchannel("A"))
    if alpha.max() == 0:
        # A flattened drawing: take darkness as coverage instead.
        grey = np.asarray(art.convert("L")).astype(np.int16)
        alpha = np.clip(255 - grey, 0, 255).astype(np.uint8)
    return alpha


def enclosed_by(ink: np.ndarray) -> np.ndarray:
    """Everything the outermost line encloses, ink included."""
    gaps, _ = ndimage.label(~ink)
    outside = set(gaps[0, :]) | set(gaps[-1, :]) | set(gaps[:, 0]) | set(gaps[:, -1])
    outside.discard(0)
    return ~np.isin(gaps, list(outside))


# --- joining dashed seams ----------------------------------------------------


def _dash_tips(coords: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The two ends of a dash and the unit vector along it."""
    centre = coords.mean(axis=0)
    centred = coords - centre
    axis = np.linalg.svd(centred, full_matrices=False)[2][0]
    along = centred @ axis
    return coords[along.argmin()], coords[along.argmax()], axis


def bridge_dashes(ink: np.ndarray, cfg: Settings) -> tuple[np.ndarray, int]:
    """Join dashes into continuous lines so a fill cannot run between them.

    Each dash reaches out from both of its ends, along its own direction, for the
    nearest ink that belongs to something else. That picks up the next dash in the
    row and, at the end of a row, the seam or outline the row runs into.
    """
    comps, count = ndimage.label(ink, np.ones((3, 3), bool))
    boxes = ndimage.find_objects(comps)

    dashes = []
    for index, box in enumerate(boxes, start=1):
        height = box[0].stop - box[0].start
        width = box[1].stop - box[1].start
        if max(height, width) > cfg.dash_len:
            continue
        ys, xs = np.where(comps[box] == index)
        coords = np.stack([xs + box[1].start, ys + box[0].start], axis=1).astype(float)
        if len(coords) < 4:
            continue
        dashes.append((index, *_dash_tips(coords)))

    reach = int(np.ceil(cfg.bridge))
    limit = np.cos(np.radians(cfg.bridge_angle))
    height, width = ink.shape
    links: list[tuple[np.ndarray, np.ndarray]] = []

    for index, low, high, axis in dashes:
        for tip, direction in ((low, -axis), (high, axis)):
            x, y = int(round(tip[0])), int(round(tip[1]))
            x0, x1 = max(0, x - reach), min(width, x + reach + 1)
            y0, y1 = max(0, y - reach), min(height, y + reach + 1)

            window = comps[y0:y1, x0:x1]
            ys, xs = np.where((window > 0) & (window != index))
            if len(ys) == 0:
                continue

            offsets = np.stack([xs + x0 - tip[0], ys + y0 - tip[1]], axis=1)
            spans = np.hypot(*offsets.T)
            near = spans <= cfg.bridge
            if not near.any():
                continue

            aligned = (offsets[near] @ direction) / np.maximum(spans[near], 1e-9) >= limit
            if not aligned.any():
                continue

            candidates = offsets[near][aligned]
            best = candidates[np.hypot(*candidates.T).argmin()]
            links.append((tip, tip + best))

    if not links:
        return ink, 0

    canvas = Image.fromarray(np.zeros(ink.shape, np.uint8))
    draw = ImageDraw.Draw(canvas)
    for start, end in links:
        draw.line([tuple(start), tuple(end)], fill=255, width=2)
    return ink | (np.asarray(canvas) > 0), len(links)


# --- cells -------------------------------------------------------------------


def claim_ink(labels: np.ndarray, interior: np.ndarray) -> np.ndarray:
    """Hand every drawn pixel to the nearest cell, so seams are shared down the middle."""
    unassigned = interior & (labels == 0)
    if not unassigned.any():
        return labels
    _, (ys, xs) = ndimage.distance_transform_edt(labels == 0, return_indices=True)
    filled = labels.copy()
    filled[unassigned] = labels[ys[unassigned], xs[unassigned]]
    return filled * interior


def _thickness(mask: np.ndarray) -> float:
    if not mask.any():
        return 0.0
    box = ndimage.find_objects(mask)[0]
    return float(ndimage.distance_transform_edt(np.pad(mask[box], 1)).max() * 2.0)


def _adjacency(labels: np.ndarray) -> dict[int, dict[int, int]]:
    """Which cells touch, and along how many pixels."""
    pairs = []
    for a, b in ((labels[:, :-1], labels[:, 1:]), (labels[:-1, :], labels[1:, :])):
        differ = (a != b) & (a > 0) & (b > 0)
        pairs.append(np.stack([a[differ], b[differ]], axis=1))

    both = np.concatenate(pairs).astype(np.int64)
    stride = int(labels.max()) + 1
    keys, counts = np.unique(
        np.minimum(*both.T) * stride + np.maximum(*both.T), return_counts=True
    )

    touching: dict[int, dict[int, int]] = {}
    for key, count in zip(keys.tolist(), counts.tolist()):
        left, right = divmod(key, stride)
        touching.setdefault(left, {})[right] = count
        touching.setdefault(right, {})[left] = count
    return touching


def split_cells(ink: np.ndarray, interior: np.ndarray, cfg: Settings) -> np.ndarray:
    """Label the blank pockets, then fold the filler ones into real pieces.

    Cells are grown over the ink before anything is measured, so two cells count
    as neighbours when the only thing between them is the line that divides them.

    A cell is only ever folded into a neighbour at least as big as itself, and only
    into one it runs alongside rather than one it merely brushes past. Without the
    first rule a seam allowance can disappear into a single strand of rib hatching;
    without the second it can jump to a piece it touches at one corner.

    Of the neighbours left, a sliver between two rows of topstitch goes to the
    smaller, because stitching sits on the piece that was folded and sewn -- the
    hem, the cuff, the pocket -- not on the panel behind it. Anything else too small
    to be a piece goes to whichever neighbour it shares the most border with, which
    chains rib hatching back together one sliver at a time.

    A cell with nowhere to go waits: its neighbours may still grow past it, so every
    merge puts the waiting cells back in the running.
    """
    cells, count = ndimage.label(interior & ~ink)
    if count == 0:
        return cells

    owner = claim_ink(cells, interior)
    area = {i: int(n) for i, n in enumerate(np.bincount(owner.ravel())) if i > 0 and n}
    touching = _adjacency(owner)
    thick = {i: _thickness(owner == i) for i in area}
    stuck: set[int] = set()

    while len(area) > 1:
        filler = [
            i for i in area
            if i not in stuck and (thick[i] < cfg.thin or area[i] < cfg.min_area)
        ]
        if not filler:
            break

        region = min(filler, key=lambda i: area[i])
        neighbours = {
            i: n for i, n in touching.get(region, {}).items()
            if i in area and area[i] >= area[region]
        }
        if neighbours:
            longest = max(neighbours.values())
            neighbours = {
                i: n for i, n in neighbours.items() if n >= longest * cfg.border_share
            }
        if not neighbours:
            stuck.add(region)
            continue

        if thick[region] < cfg.thin:
            target = min(neighbours, key=lambda i: area[i])
        else:
            target = max(neighbours, key=lambda i: neighbours[i])

        stuck.clear()
        owner[owner == region] = target
        area[target] += area.pop(region)
        for other, shared in touching.pop(region).items():
            touching[other].pop(region, None)
            if other == target:
                continue
            touching[target][other] = touching[target].get(other, 0) + shared
            touching[other][target] = touching[other].get(target, 0) + shared
        thick[target] = _thickness(owner == target)

    return owner


def analyse(path: Path, cfg: Settings) -> Regions:
    alpha = load_alpha(path)
    ink = alpha >= cfg.ink
    bridged, links = bridge_dashes(ink, cfg)
    print(f"bridged {links} dash gaps")

    interior = enclosed_by(bridged)
    labels = split_cells(bridged, interior, cfg)

    ids = sorted(
        (i for i in np.unique(labels) if i > 0),
        key=lambda i: -int(np.count_nonzero(labels == i)),
    )
    renumbered = np.zeros_like(labels)
    for new, old in enumerate(ids, start=1):
        renumbered[labels == old] = new

    return Regions(
        labels=renumbered,
        ids=list(range(1, len(ids) + 1)),
        ink=ink,
        interior=interior,
    )


# --- proof -------------------------------------------------------------------

PALETTE = [
    (214, 40, 40), (30, 90, 220), (0, 150, 90), (240, 140, 0), (150, 60, 200),
    (0, 170, 190), (230, 80, 160), (120, 130, 40), (90, 60, 160), (200, 60, 60),
    (60, 160, 120), (180, 120, 0), (70, 110, 200), (170, 80, 40), (110, 110, 110),
]


def _font(size: int) -> ImageFont.ImageFont:
    for name in ("arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def write_proof(regions: Regions, out: Path) -> None:
    height, width = regions.labels.shape
    canvas = np.full((height, width, 3), 255, np.uint8)
    for index, region_id in enumerate(regions.ids):
        canvas[regions.mask(region_id)] = PALETTE[index % len(PALETTE)]
    canvas[regions.ink & (regions.labels > 0)] = (25, 25, 25)

    img = Image.fromarray(canvas)
    draw = ImageDraw.Draw(img)
    font = _font(max(22, height // 40))
    for region_id in regions.ids:
        x, y = regions.anchor(region_id)
        text = str(region_id)
        box = draw.textbbox((0, 0), text, font=font)
        draw.rectangle(
            [x - (box[2] - box[0]) // 2 - 8, y - (box[3] - box[1]) // 2 - 6,
             x + (box[2] - box[0]) // 2 + 8, y + (box[3] - box[1]) // 2 + 10],
            fill=(255, 255, 255), outline=(0, 0, 0), width=2,
        )
        draw.text((x - (box[2] - box[0]) // 2, y - (box[3] - box[1]) // 2),
                  text, fill=(0, 0, 0), font=font)
    img.save(out)


# --- emitting parts ----------------------------------------------------------

CANVAS = 2048
"""The app renders every garment into a square canvas of this size."""

TRACE_SS = 3
INK_COLOR = "#141414"


def _place(shape: tuple[int, int]) -> tuple[float, float, float]:
    """Scale and offset that fit the drawing into the app's square canvas."""
    height, width = shape
    scale = CANVAS / max(width, height)
    return scale, (CANVAS - width * scale) / 2, (CANVAS - height * scale) / 2


def trace(mask: np.ndarray) -> str:
    """Trace a mask into path data in the potrace space the app's assets use."""
    import potrace

    height, width = mask.shape
    img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    big = np.asarray(
        img.resize((width * TRACE_SS, height * TRACE_SS), Image.LANCZOS)
    ) >= 128
    if not big.any():
        return ""

    bitmap = potrace.Bitmap(big)
    bitmap.invert()
    path = bitmap.trace(
        turdsize=4,
        turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=1.0,
        opticurve=True,
        opttolerance=0.2,
    )

    scale, offset_x, offset_y = _place(mask.shape)

    def point(p) -> str:
        x = 10 * (offset_x + (p.x / TRACE_SS) * scale)
        y = 10 * (CANVAS - offset_y - (p.y / TRACE_SS) * scale)
        return f"{round(x):d} {round(y):d}"

    out = []
    for curve in path:
        d = [f"M{point(curve.start_point)}"]
        for segment in curve:
            if segment.is_corner:
                d.append(f"L{point(segment.c)}")
                d.append(f"L{point(segment.end_point)}")
            else:
                d.append(
                    f"C{point(segment.c1)} {point(segment.c2)} {point(segment.end_point)}"
                )
        d.append("Z")
        out.append("".join(d))
    return " ".join(out)


def wrap_svg(title: str, fill_d: str, ink_d: str) -> str:
    """Fill group first so the app's tinting recolours it; ink keeps its own colour."""
    group = '<g transform="translate(0,2048) scale(0.1,-0.1)"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}">\n'
        f"<title>{title}</title>\n"
        f'{group} fill="#000000">\n'
        f'<path d="{fill_d}" fill-rule="evenodd"/>\n'
        "</g>\n"
        f'{group} fill="{INK_COLOR}">\n'
        f'<path d="{ink_d}" fill="{INK_COLOR}" fill-rule="evenodd"/>\n'
        "</g>\n"
        "</svg>\n"
    )


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    path = Path(sys.argv[1])

    cfg = Settings()
    for arg in sys.argv[2:]:
        if arg.startswith("--tune"):
            for pair in arg.split("=", 1)[1].split(","):
                key, value = pair.split("=") if "=" in pair else (pair, None)
                setattr(cfg, key, type(getattr(cfg, key))(value))

    regions = analyse(path, cfg)
    print(f"\n{'#':>3s} {'area':>9s} {'thick':>6s}  seed")
    for region_id in regions.ids:
        mask = regions.mask(region_id)
        print(f"{region_id:>3d} {regions.area(region_id):>9d} "
              f"{_thickness(mask):>6.0f}  {list(regions.anchor(region_id))}")

    out = path.with_name(f"{path.stem}-regions.png")
    write_proof(regions, out)
    print(f"\nwrote {out.name}")


if __name__ == "__main__":
    main()
