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


def give_stitch_strip_to_neighbour(
    smaller: np.ndarray,
    larger: np.ndarray,
    ink: np.ndarray,
    stitches: np.ndarray,
    max_frac: float = 0.35,
) -> tuple[np.ndarray, np.ndarray]:
    """Move the strip between a join line and the attach-stitch onto the larger piece.

    Dashed cover-stitch is bridged so it splits cells, then the thin cell
    between that stitch and the outline merges into the smaller neighbour
    (collar into neck, cuff into cuff, hem into hem). Colour then fills past
    the join up to the dashes. Flood from the larger piece through anything
    that is not solid construction; stop at the join outline so only that
    strip moves.
    """
    construction = ndimage.binary_dilation(ink & ~stitches, iterations=1)
    walkable = (smaller | larger) & ~construction
    flooded = ndimage.binary_propagation(larger & walkable, mask=walkable)
    seep = flooded & smaller
    # If the join was eaten, the flood swallows the whole piece. Keep the move
    # only when it is a thin strip, not the garment part itself.
    if not seep.any() or int(seep.sum()) > int(smaller.sum() * max_frac):
        return smaller, larger
    return smaller & ~seep, larger | seep


def give_collar_stitch_strip_to_body(
    neck: np.ndarray,
    body: np.ndarray,
    ink: np.ndarray,
    stitches: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    return give_stitch_strip_to_neighbour(neck, body, ink, stitches)


STITCH_STRIP_PAIRS = (
    ("Neck", "Body"),
    ("Left cuff", "Left sleeve"),
    ("Right cuff", "Right sleeve"),
)


def apply_stitch_strip_moves(
    masks: dict[str, np.ndarray],
    ink: np.ndarray,
    stitches: np.ndarray,
) -> dict[str, int]:
    """Reassign every join-to-stitch strip onto the piece the stitch sits on."""
    moved: dict[str, int] = {}
    for smaller_name, larger_name in STITCH_STRIP_PAIRS:
        if smaller_name not in masks or larger_name not in masks:
            continue
        before = int(masks[smaller_name].sum())
        max_frac = 0.04 if smaller_name == "Neck" else 0.35
        masks[smaller_name], masks[larger_name] = give_stitch_strip_to_neighbour(
            masks[smaller_name],
            masks[larger_name],
            ink,
            stitches,
            max_frac=max_frac,
        )
        moved[f"{smaller_name}->{larger_name}"] = before - int(masks[smaller_name].sum())
    return moved


def give_nape_ribs_to_neck(inner: np.ndarray, neck: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Centre-back rib cells often fold into Inner. They belong on the collar.

    The hole is a solid oval; nape ribs are a sparse cap on top of it, still
    one connected component. Walk down from the top of Inner until a row is
    solid — that is the real opening — and keep only that and below. Do not
    grow the collar into the hole: through-the-opening fabric is Inner, the
    same as on the slim V-neck.
    """
    if not inner.any():
        return inner, neck
    row_w = inner.sum(axis=1)
    ys = np.flatnonzero(row_w)
    if ys.size == 0:
        return inner, neck
    max_w = float(row_w.max())
    hole_top = None
    for y in range(int(ys.min()), int(ys.max()) + 1):
        w = float(row_w[y])
        if w < 1:
            continue
        xs = np.flatnonzero(inner[y])
        span = float(xs[-1] - xs[0] + 1)
        # The opening is already wide on the first hole row, even when Neck
        # owns nape bites on that same row (span is large, fill looks sparse).
        # Only the narrow cap above that is nape. Waiting for a solid 80%
        # row steals the top of the hole and paints it collar colour.
        if span >= 0.50 * max_w:
            hole_top = y
            break
    if hole_top is None:
        return inner, neck
    hole = inner.copy()
    hole[:hole_top, :] = False
    nape = inner & ~hole
    if nape.any():
        inner, neck = hole, neck | nape
    return inner, neck


def clip_neck_to_rib_band(masks: dict[str, np.ndarray]) -> tuple[int, int]:
    """Keep Neck on the drawn rib band, Inner in the opening.

    Do not replace the U-shaped band with an oval ring around a convex hole —
    that misses the shoulder corners and paints collar colour into the hole
    and onto the chest. Follow the real Inner outline: the band is the
    annulus of rib-width around it. Grow existing Neck seeds through Body
    only inside that annulus. Anything inside Inner is the hole.
    """
    if "Inner back neck" not in masks or "Neck" not in masks:
        return 0, 0
    inner = ndimage.binary_fill_holes(masks["Inner back neck"])
    neck = masks["Neck"]
    body = masks.get("Body")
    if not inner.any():
        return 0, 0

    leak = neck & inner
    neck = neck & ~inner
    inner = inner | leak

    did_rim_split = False
    # When the rib band is open to the hole (one connected white region),
    # Inner swallows the band. Split: rim of that blob is Neck, core is hole.
    if int(inner.sum()) > 55_000:
        from_edge = ndimage.distance_transform_edt(inner)
        rim_hi = 24.0
        rim = inner & (from_edge <= rim_hi)
        core = inner & (from_edge > rim_hi)
        if int(core.sum()) > 8_000 and int(rim.sum()) > 2_000:
            neck = (neck & ~inner) | rim
            inner = core
            did_rim_split = True
            # Smooth the carved rim so SVG fill isn't a jagged scribble.
            neck = ndimage.binary_opening(neck, iterations=1)
            neck = ndimage.binary_closing(neck, iterations=2)

    # Nape dents: hanging collar in a column whose Inner starts late.
    # Pull the nape line up from neighbouring columns that already have Inner.
    # Do not invent Inner in columns that never had a hole (those are the band).
    height, width = inner.shape
    ys = np.arange(height)[:, None]
    xs = np.arange(width)[None, :]
    valid = inner.any(axis=0)
    first = np.where(inner, ys, height).min(axis=0)
    last = np.where(inner, ys, -1).max(axis=0)
    smooth = ndimage.minimum_filter(
        np.where(valid, first, height).astype(np.int32), size=31
    )
    dent = valid & (first > smooth + 3)
    if dent.any():
        nape = np.where(dent, smooth, first)
        hanging = (
            neck
            & valid[None, :]
            & (ys >= nape)
            & (ys <= np.maximum(nape, last))
        )
        neck = neck & ~hanging
        inner = inner | hanging

    dist = ndimage.distance_transform_edt(~inner)
    from_body = 0
    if neck.any():
        near = neck & (dist > 0) & (dist <= 40)
        if near.any():
            hi = float(np.clip(np.percentile(dist[near], 80) + 2, 18.0, 32.0))
        else:
            hi = 22.0
        hole_top = int(np.where(inner, ys, height).min())
        hole_bottom = int(np.where(inner, ys, -1).max())
        ring = (dist > 0) & (dist <= hi) & ~inner & (ys <= hole_bottom + hi)
        if body is not None:
            deep_body = ndimage.binary_erosion(body, iterations=max(10, int(hi // 2)))
            ring = ring & ~deep_body
        closed = ndimage.binary_closing(neck, iterations=2)
        neck = neck | (closed & ring)
        if body is not None:
            if did_rim_split:
                take = np.zeros_like(body)
            else:
                take = body & ring
            # V tip: outer mitre sits against thick torso — reclaim a short
            # corridor from existing band legs without opening the chest.
            if not did_rim_split:
                tip = (
                    body
                    & (dist > 0)
                    & (dist <= hi + 6)
                    & (ys >= hole_bottom - 30)
                    & (ys <= hole_bottom + int(hi) + 4)
                    & ndimage.binary_dilation(neck, iterations=16)
                )
                take = take | tip
            from_body = int(take.sum())
            body = body & ~take
            neck = neck | take
        overflow = neck & ~ring & ~inner
        if body is not None and overflow.any():
            # Polo collar leaves sit beside/above the hole. Only dump chest spill
            # and far noise — never the top of the collar flaps.
            dump = overflow & (
                (ys > hole_bottom + int(hi) + 8)
                | (dist > 120)
            )
            if dump.any():
                body = body | dump
                neck = neck & ~dump
        # Far shoulder paint outside the rib ring only (band corners stay Neck).
        if body is not None and inner.any():
            col_idx = np.arange(width)
            inner_cols = col_idx[inner.any(axis=0)]
            if inner_cols.size:
                x_lo = int(inner_cols.min())
                x_hi = int(inner_cols.max())
                shoulder_spill = (
                    neck
                    & ~ring
                    & (dist > hi)
                    & (ys <= hole_top + 14)
                    & ((xs < x_lo - 8) | (xs > x_hi + 8))
                )
                if shoulder_spill.any():
                    body = body | shoulder_spill
                    neck = neck & ~shoulder_spill
        if body is not None:
            # Polo flaps: the fold often opens into Body, so the top of each
            # leaf is still torso colour. Claim that zone as Neck.
            leaf_zone = (
                (dist > hi)
                & (dist <= 110)
                & (ys >= hole_top - 50)
                & (ys <= hole_top + 130)
                & (np.abs(xs - width / 2.0) > 40)
            )
            take_leaves = body & leaf_zone & ndimage.binary_dilation(neck, iterations=18)
            if take_leaves.any():
                from_body += int(take_leaves.sum())
                body = body & ~take_leaves
                neck = neck | take_leaves
            grow = ndimage.binary_dilation(neck, iterations=6)
            finish = body & ring & grow
            tip = (
                body
                & (dist > 0)
                & (dist <= hi + 8)
                & (ys >= hole_bottom - 36)
                & (ys <= hole_bottom + int(hi) + 6)
                & grow
            )
            finish = finish | tip
            if finish.any():
                from_body += int(finish.sum())
                body = body & ~finish
                neck = neck | finish

    masks["Inner back neck"] = inner
    masks["Neck"] = neck
    if body is not None:
        masks["Body"] = body
    return int(leak.sum()), from_body


def ink_web(
    ink: np.ndarray,
    passable_max: int = 600,
) -> tuple[np.ndarray, np.ndarray]:
    """Classify drawn ink into (block, passable) after dash bridging.

    block = the large construction web (collar outline + shoulder seams once
    the dashed lines are bridged) that a collar flood must not cross;
    passable = small rib ticks / stitch dashes a fill may run over.
    """
    bridged, _bridges = bridge_dashes(ink, Settings())
    ink_lbl, ink_n = ndimage.label(bridged, np.ones((3, 3), bool))
    areas = np.bincount(ink_lbl.ravel())
    block = np.zeros_like(ink)
    passable = np.zeros_like(ink)
    for i in range(1, ink_n + 1):
        (block if areas[i] > passable_max else passable)[ink_lbl == i] = True
    return block, passable


def collar_band_mask(
    hole: np.ndarray,
    ink: np.ndarray | None,
    passable_max: int = 600,
    max_radius: int = 46,
) -> np.ndarray:
    """Flood the collar band outward from the opening, bounded by DRAWN ink.

    Walks from the hole across white fabric and rib ticks (small ink) and
    stops at the big construction-ink web (collar outline + shoulder seams
    after dash bridging). A max_radius ceiling guards against a seam gap.
    Used both by rebuild_collar_band (pack time) and the neck-variant
    compositor (to find the collar area in base and donor drawings).
    """
    band = np.zeros_like(hole)
    if ink is not None and ink.any():
        block, passable = ink_web(ink, passable_max)

        garment_interior = ndimage.binary_fill_holes(block)
        interior_white = garment_interior & ~ink
        # Seed: white pixels just outside the hole (across the thin inner
        # collar ink) and not more than a collar-width away, so the flood
        # starts inside the band and cannot jump the outer outline.
        dist = ndimage.distance_transform_edt(~hole)
        seed = interior_white & (dist >= 1) & (dist <= 26)
        # Rest of the flood: white + passable ink, bounded by the block web.
        # The rib ticks are passable, so the fill runs over them; the collar
        # outline + shoulder seams are the block, so colour can't escape the
        # drawing. Clamp to a generous ceiling in case a seam gap leaks.
        walkable = (interior_white | passable) & ~hole
        band = ndimage.binary_propagation(seed, mask=walkable)
        band = band & (dist <= max_radius)
    else:
        # No ink available: fall back to a distance ring so we never crash.
        dist = ndimage.distance_transform_edt(~hole)
        band = (dist <= 45) & ~hole
    return band


def rebuild_collar_band(
    masks: dict[str, np.ndarray],
    ink: np.ndarray | None,
    keep_above_hole: bool = False,
    passable_max: int = 600,
    max_radius: int = 46,
) -> int:
    """Rebuild the collar bounded by the DRAWN ink, not a Euclidean radius.

    This is the behaviour that makes the reference V-neck right: its collar
    fill is exactly the white space between the inner hole edge and the outer
    collar outline, so colour never leaves the drawing. A distance ring is
    wrong here — on the donor collars a fixed radius reaches past the drawn
    band's outer line onto the shoulder yoke (why deep V and scoop spill red
    onto the shoulders).

    So: walk the collar outward from the hole across white fabric and rib
    ticks, and STOP at the large connected construction-ink web (the collar
    outline, which meets the shoulder seams). Result:

      * Inner back neck = the opening itself (its centred component).
      * Neck            = the ink-bounded collar band (white + rib ticks).
      * Body            = everything the old masks held beyond that.

    keep_above_hole=True (polo): collar leaves drawn above the opening stay
    in Neck. passable_max caps how big an ink run may be and still count as a
    rib tick / stitch dash the flood may cross; the outline/seam web is larger.
    """
    neck = masks.get("Neck")
    inner = masks.get("Inner back neck")
    body = masks.get("Body")
    if neck is None or inner is None or not inner.any():
        return 0

    # --- opening -----------------------------------------------------------------
    solid = ndimage.binary_fill_holes(inner) | inner
    solid = ndimage.binary_opening(solid, iterations=2)
    solid = ndimage.binary_closing(solid, iterations=2)
    comps, count = ndimage.label(solid, np.ones((3, 3), bool))
    hole = solid
    if count > 1:
        centre_x = solid.shape[1] / 2.0
        best_score: float | None = None
        for i in range(1, count + 1):
            comp = comps == i
            area = int(comp.sum())
            if area < 5000:
                continue
            ys_c, xs_c = np.nonzero(comp)
            off = abs(float(xs_c.mean()) - centre_x)
            score = off * 50.0 - area * 0.001
            if best_score is None or score < best_score:
                best_score = score
                hole = comp
    hole = ndimage.binary_fill_holes(hole)

    fabric = neck | inner
    if body is not None:
        fabric = fabric | body

    band = collar_band_mask(hole, ink, passable_max=passable_max, max_radius=max_radius)
    if ink is None or not ink.any():
        # Fallback ring: keep it on real fabric pixels only.
        band = band & fabric

    strays = inner & ~hole & ~band  # inner-back slivers beyond the band
    leaves = np.zeros_like(band)
    if keep_above_hole and ink is not None and ink.any():
        block, _passable = ink_web(ink, passable_max)
        row_idx = np.arange(hole.shape[0])[:, None]
        col_idx = np.arange(hole.shape[1])[None, :]
        hole_top = int(np.where(hole, row_idx, hole.shape[0]).min())
        hole_cols = col_idx.ravel()[hole.any(axis=0)]
        pad = 60
        leaves = (
            neck
            & (row_idx <= hole_top)
            & (col_idx >= max(0, int(hole_cols.min()) - pad))
            & (col_idx <= min(hole.shape[1] - 1, int(hole_cols.max()) + pad))
            & fabric
            & ~block
        )
        lbl, n = ndimage.label(leaves, np.ones((3, 3), bool))
        for i in range(1, n + 1):
            comp = lbl == i
            if int(comp.sum()) < 2000:
                leaves[comp] = False

    band = band | leaves
    masks["Inner back neck"] = hole
    masks["Neck"] = band
    if body is not None:
        masks["Body"] = ((body | neck | inner) & ~band & ~hole) | strays
    return int(band.sum())


def absorb_leftovers(
    masks: dict[str, np.ndarray],
    labels: np.ndarray,
    ids: list[int],
    claimed: dict[int, str],
    avoid: set[str] | None = None,
) -> dict[str, int]:
    """Every ink-enclosed pocket the seeds missed must belong to *some* part.

    Unclaimed pockets used to be dropped, which left white speckle holes inside
    fills (worst inside collar bands where rib ticks split the band into many
    cells). Give each leftover region to the already-claimed part sharing the
    longest border across the separating ink.
    """
    from scipy import ndimage

    if not ids:
        return {}
    # Which part each region currently belongs to (seeds only, no absorption yet).
    region_owner = {rid: part for rid, part in claimed.items()}

    # Border length region<->part: count pixels of the region next to each part
    # mask after a small dilation that crosses the separating ink line.
    part_keys = [p for p, m in masks.items() if m is not None and m.any()]
    if not part_keys:
        return {}
    dil = {}
    moved: dict[str, int] = {}
    leftovers = [rid for rid in ids if rid not in region_owner]
    leftovers.sort(key=lambda rid: -int(np.count_nonzero(labels == rid)))
    for rid in leftovers:
        cell = labels == rid
        if not cell.any():
            continue
        best_part: str | None = None
        best_score = 0
        for part in part_keys:
            if avoid and part in avoid:
                continue
            pm = masks.get(part)
            if pm is None or not pm.any():
                continue
            # Cross the ink: neighbours two cells away in both directions.
            grown = ndimage.binary_dilation(cell, iterations=3)
            score = int(np.count_nonzero(grown & pm))
            if score > best_score:
                best_score = score
                best_part = part
        if best_part is None or best_score <= 0:
            continue
        masks[best_part] = masks[best_part] | cell
        region_owner[rid] = best_part
        moved[best_part] = moved.get(best_part, 0) + int(np.count_nonzero(cell))
    return moved


def complete_garment_coverage(
    masks: dict[str, np.ndarray],
    interior: np.ndarray,
    ink: np.ndarray | None = None,
    fallback: str = "Body",
) -> int:
    """Put every remaining fabric pixel under the base fill.

    Region tracing is intentionally conservative around thick seams and open
    collar artwork. That is useful for keeping parts apart, but a missed pixel
    must never become a white hole in the preview. The base body is the safe
    underlay: detail parts still render above it, while the outline hides any
    overlap at construction lines. Keep actual ink out of the fill so it stays
    owned by Outline/Stitching.
    """
    body = masks.get(fallback)
    if body is None:
        return 0
    covered = np.zeros_like(interior)
    for mask in masks.values():
        if mask is not None:
            covered |= mask
    missing = interior & ~covered
    if ink is not None:
        missing &= ~ink
    count = int(missing.sum())
    if count:
        masks[fallback] = body | missing
    return count


def clip_fills_inside_ink(
    masks: dict[str, np.ndarray],
    ink: np.ndarray,
    stitches: np.ndarray | None = None,
    rib_fix: bool = True,
) -> None:
    """Keep part colour on the fabric side of every drawn line.

    Rib ticks only touch one piece — fold those ink pixels into that fill so
    colour meets the black line. Join and silhouette ink also touch a neighbour
    or the outside of the garment; leave those to the outline layer so colour
    cannot spill past the stroke into the stitch gutter or off the silhouette.
    """
    original = {name: mask.copy() for name, mask in masks.items()}
    garment = np.zeros_like(ink)
    for mask in original.values():
        garment |= mask
    exterior = ~garment & ~ink

    for name, mask in original.items():
        others = np.zeros_like(mask)
        for other_name, other in original.items():
            if other_name != name:
                others |= other
        # Join strokes are several pixels thick. A 1px neighbour test only
        # catches the far edge, so the rest of the stroke is filled and
        # colour shows past the black line. Reach across the full stroke.
        border = ink & ndimage.binary_dilation(others | exterior, iterations=6)
        owned = ink & ndimage.binary_dilation(mask, iterations=1) & ~border
        masks[name] = (mask | owned) & ~border

    if rib_fix and "Neck" in masks and "Inner back neck" in masks:
        hole, band = clip_neck_to_rib_band(masks)
        print(f"rib band: Neck out of hole {hole}px, Body->Neck in band {band}px")

    # Let Neck fill sit under the inner/outer collar strokes so colour meets
    # the black line. The outline layer is on top, so this does not show past
    # the stroke the way a convex ring did.
    if "Neck" in masks:
        inner = masks.get("Inner back neck")
        body = masks.get("Body")
        grow = ndimage.binary_dilation(masks["Neck"], iterations=2)
        extra = grow & ink
        if inner is not None and inner.any():
            hole = ndimage.binary_fill_holes(inner)
            eroded = ndimage.binary_erosion(hole, iterations=1)
            if eroded.any():
                extra = extra & ~eroded
            dist = ndimage.distance_transform_edt(~hole)
            extra = extra & (dist <= 14)
            hole_bottom = int(np.where(hole, np.arange(hole.shape[0])[:, None], -1).max())
            extra = extra & (np.arange(hole.shape[0])[:, None] <= hole_bottom + 12)
        if body is not None and body.any():
            deep_body = ndimage.binary_erosion(body, iterations=2)
            if deep_body.any():
                extra = extra & ~deep_body
        masks["Neck"] = masks["Neck"] | extra
        if inner is not None:
            masks["Inner back neck"] = inner & ~masks["Neck"]
        if body is not None:
            masks["Body"] = body & ~masks["Neck"]


def apply_nape_rib_move(masks: dict[str, np.ndarray]) -> int:
    if "Inner back neck" not in masks or "Neck" not in masks:
        return 0
    before = int(masks["Inner back neck"].sum())
    masks["Inner back neck"], masks["Neck"] = give_nape_ribs_to_neck(
        masks["Inner back neck"], masks["Neck"]
    )
    return before - int(masks["Inner back neck"].sum())


def claim_dash_tips(ink: np.ndarray, dashes: np.ndarray, reach: int = 12) -> np.ndarray:
    """Cover the black outline caps at the start and end of a dash row.

    The last isolated dash usually stops a gap short of the side seam, so the
    outline shows as a black stub. Step from each tip along the dash even
    through that gap, then claim a little of the outline it hits.
    """
    if not dashes.any():
        return dashes
    comps, count = ndimage.label(dashes, np.ones((3, 3), bool))
    extra = np.zeros_like(dashes)
    height, width = ink.shape
    for index in range(1, count + 1):
        ys, xs = np.nonzero(comps == index)
        if ys.size < 2:
            continue
        pts = np.stack([xs.astype(np.float64), ys.astype(np.float64)], axis=1)
        mean = pts.mean(axis=0)
        cov = np.cov(pts - mean, rowvar=False)
        if np.ndim(cov) != 2 or cov.shape != (2, 2):
            continue
        vals, vecs = np.linalg.eigh(cov)
        axis = vecs[:, int(np.argmax(vals))]
        along = (pts - mean) @ axis
        for tip, sign in (
            (pts[int(along.argmin())], -1.0),
            (pts[int(along.argmax())], 1.0),
        ):
            direction = axis * sign
            hit = 0
            for step in range(1, reach + 1):
                point = tip + direction * step
                x = int(round(point[0]))
                y = int(round(point[1]))
                if not (0 <= y < height and 0 <= x < width):
                    break
                if not ink[y, x]:
                    if hit:
                        break
                    continue
                y0, y1 = max(0, y - 1), min(height, y + 2)
                x0, x1 = max(0, x - 1), min(width, x + 2)
                extra[y0:y1, x0:x1] |= ink[y0:y1, x0:x1]
                hit += 1
                if hit >= 6:
                    break
    return dashes | extra


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


def trace(mask: np.ndarray, *, resample: int = Image.NEAREST) -> str:
    """Trace a mask into path data in the potrace space the app's assets use.

    Fills use nearest-neighbour upsampling so colour cannot bleed past the
    mask into a neighbouring piece. Pass LANCZOS only when re-tracing ink,
    where the existing outline assets were built that way.
    """
    import trace_svg

    return trace_svg.trace(mask, resample=resample)


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
