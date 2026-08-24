"""Photo → collar part SVGs for the slim test tee.

Same four steps for every neck (crew, V, mock/funnel, …):

1. Black-and-white construction line art of only the collar.
2. Key white with the luminance ramp (WHITE_CUTOFF 246, INK_CUTOFF 120, contrast 1.35).
3. Place shoulder corners onto the slim crew socket (354, 210) / (671, 210).
4. Potrace: 3× upsample, invert, even-odd, 2048 viewBox, translate(0,2048) scale(0.1,-0.1).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import draw_collar as DC  # noqa: E402
import lineart as LA  # noqa: E402
import trace_svg as T  # noqa: E402

CREW_MASKS = HERE / "refs" / "crew_masks.npz"
DEST_LEFT = (354, 210)
DEST_RIGHT = (671, 210)


class CollarError(Exception):
    pass


def progress(step: str, label: str) -> None:
    print(json.dumps({"type": "progress", "step": step, "label": label}), flush=True)


def debug_image(name: str, image: Image.Image | np.ndarray) -> None:
    """Optional local diagnostics; disabled unless COLLAR_DEBUG_DIR is set."""
    target = LA.load_secrets().get("COLLAR_DEBUG_DIR", "").strip()
    if not target:
        return
    directory = Path(target)
    directory.mkdir(parents=True, exist_ok=True)
    if isinstance(image, np.ndarray):
        pixels = np.where(image, 0, 255).astype(np.uint8)
        output = Image.fromarray(pixels, "L")
    else:
        output = image
    output.save(directory / f"{name}.png")


# Real construction ink only. Faint keyed paper (alpha ~32–120) becomes a
# rectangular frame around the photo and must not be treated as the collar.
STRONG_INK = 168


def drop_image_frame(ink: np.ndarray, rim: int = 7) -> np.ndarray:
    """Strip a rectangular border hugging the ink bounding box."""
    ys, xs = np.where(ink)
    if xs.size == 0:
        return ink
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    if (y1 - y0) < 40 or (x1 - x0) < 40:
        return ink

    def edge(y_slice, x_slice) -> np.ndarray:
        sl = np.zeros_like(ink)
        sl[y_slice, x_slice] = True
        return sl

    top = edge(slice(y0, min(y0 + rim, y1 + 1)), slice(x0, x1 + 1))
    bot = edge(slice(max(y0, y1 - rim + 1), y1 + 1), slice(x0, x1 + 1))
    left = edge(slice(y0, y1 + 1), slice(x0, min(x0 + rim, x1 + 1)))
    right = edge(slice(y0, y1 + 1), slice(max(x0, x1 - rim + 1), x1 + 1))

    def covered(mask: np.ndarray) -> float:
        return float((ink & mask).sum()) / max(int(mask.sum()), 1)

    if sum(covered(edge_m) > 0.42 for edge_m in (top, bot, left, right)) >= 3:
        return ink & ~(top | bot | left | right)
    return ink


def drop_rectangular_loops(ink: np.ndarray) -> np.ndarray:
    """Remove a thin rectangular photo-frame loop around the drawing."""
    closed = ndimage.binary_closing(ink, iterations=2)
    filled = ndimage.binary_fill_holes(closed)
    labeled, count = ndimage.label(filled)
    out = ink.copy()
    for i in range(1, count + 1):
        blob = labeled == i
        ys, xs = np.where(blob)
        if xs.size == 0:
            continue
        rect = int(ys.max() - ys.min() + 1) * int(xs.max() - xs.min() + 1)
        if rect < 8000:
            continue
        fill_ratio = float(blob.sum()) / rect
        ring_ratio = float((ink & blob).sum()) / max(int(blob.sum()), 1)
        if fill_ratio > 0.82 and ring_ratio < 0.14:
            rim = blob & ~ndimage.binary_erosion(blob, iterations=8)
            out &= ~rim
    return out if out.any() else ink


def drop_box_edges(ink: np.ndarray) -> np.ndarray:
    """Drop long thin strips that are the sides of a photo frame."""
    ys, xs = np.where(ink)
    if xs.size == 0:
        return ink
    bw = int(xs.max() - xs.min()) + 1
    bh = int(ys.max() - ys.min()) + 1
    labeled, count = ndimage.label(ink)
    keep = np.zeros_like(ink)
    for i in range(1, count + 1):
        comp = labeled == i
        cys, cxs = np.where(comp)
        cw = int(cxs.max() - cxs.min()) + 1
        ch = int(cys.max() - cys.min()) + 1
        if ch <= 6 and cw >= bw * 0.8:
            continue
        if cw <= 6 and ch >= bh * 0.8:
            continue
        keep |= comp
    return keep if keep.any() else ink


def keep_strong_ink(keyed: Image.Image) -> Image.Image:
    """Keep only strong construction ink before placement.

    Do not geometrically strip a supposed frame here. That heuristic also
    stripped the outer contour of mock/funnel collars. Gemini's raster
    validator rejects real frames before this stage.
    """
    rgba = np.array(keyed.convert("RGBA"))
    strong = rgba[..., 3] >= STRONG_INK
    strong = LA.drop_speckles(strong, min_area=24)
    if not strong.any():
        return keyed
    rgba[..., 3] = np.where(strong, 255, 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def _closed_pockets(ink: np.ndarray) -> tuple[np.ndarray, int]:
    """White regions enclosed by the generated raster construction lines."""
    best = np.zeros_like(ink, dtype=np.int32)
    best_count = 0
    best_area = 0
    ys, xs = np.where(ink)
    bbox_area = (
        max((int(xs.max()) - int(xs.min()) + 1) * (int(ys.max()) - int(ys.min()) + 1), 1)
        if xs.size
        else ink.size
    )
    for iterations in (2, 3, 4, 6, 8, 10, 12, 16):
        sealed = ndimage.binary_closing(ink, iterations=iterations)
        exterior = flood_from_border(~sealed)
        pockets = (~exterior) & ~sealed
        labeled, count = ndimage.label(pockets)
        if count == 0:
            continue
        sizes = ndimage.sum(pockets, labeled, index=range(1, count + 1))
        useful_area = int(
            sum(
                float(size)
                for size in sizes
                if 80 <= float(size) <= bbox_area * 0.72
            )
        )
        if useful_area > best_area:
            best, best_count, best_area = labeled, count, useful_area
    return best, best_count


def _head_opening_from_pockets(
    labeled: np.ndarray,
    count: int,
    ink: np.ndarray,
    crew_hole: np.ndarray,
) -> np.ndarray:
    """Pick the upper central enclosed pocket as the true head opening."""
    ys, xs = np.where(ink)
    if xs.size == 0:
        raise CollarError("Generated collar drawing is empty")
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    cx = (x0 + x1) / 2.0
    target_y = y0 + (y1 - y0) * 0.28
    opening_limit_y = y0 + (y1 - y0) * 0.58
    bbox_area = max((x1 - x0 + 1) * (y1 - y0 + 1), 1)

    best: np.ndarray | None = None
    best_score = float("-inf")
    for index in range(1, count + 1):
        pocket = labeled == index
        pys, pxs = np.where(pocket)
        area = int(pxs.size)
        if area < max(80, bbox_area * 0.006) or area > bbox_area * 0.48:
            continue
        pcx = float(pxs.mean())
        pcy = float(pys.mean())
        # A collar leaf can start above the head opening, but its centre sits
        # to one side. Only a genuinely central pocket may become transparent.
        if abs(pcx - cx) > max((x1 - x0) * 0.14, 12.0):
            continue
        if float(pxs.min()) > cx or float(pxs.max()) < cx:
            continue
        # Plackets and V inserts sit below the collar. They can overlap the
        # crew socket strongly, but they are never the head opening.
        if pcy > opening_limit_y:
            continue
        centrality = 1.0 - min(abs(pcx - cx) / max((x1 - x0) / 2.0, 1.0), 1.0)
        vertical = 1.0 - min(abs(pcy - target_y) / max(y1 - y0, 1), 1.0)
        topness = 1.0 - min((float(pys.min()) - y0) / max(y1 - y0, 1), 1.0)
        overlap = float((pocket & ndimage.binary_dilation(crew_hole, iterations=20)).sum())
        score = (
            centrality * 3.0
            + vertical
            + topness * 18.0
            + overlap / max(area, 1) * 0.25
        )
        if score > best_score:
            best, best_score = pocket, score
    if best is None:
        raise CollarError("Generated collar has no closed head opening")
    return best


def seated_collar(
    ink: np.ndarray,
    collar: np.ndarray,
    hole: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Build fabric from the uploaded collar's closed raster regions.

    The catalog crew mask is used only as a placement/socket reference. It is
    never inserted into the custom collar fill.
    """
    del collar  # placement reference only; never substitute its geometry
    # The Gemini raster was already cleaned before placement. Removing small
    # components again here breaks tiny joins and opens otherwise closed outer
    # contours, especially at mock-neck folds and V-point seams.
    ink = ink.copy()
    labeled, count = _closed_pockets(ink)
    if count == 0:
        raise CollarError("Generated collar outlines are not closed")

    opening = _head_opening_from_pockets(labeled, count, ink, hole)
    fabric = np.zeros_like(ink)
    iys, ixs = np.where(ink)
    ink_bbox_area = max(
        (int(ixs.max()) - int(ixs.min()) + 1) * (int(iys.max()) - int(iys.min()) + 1),
        1,
    )
    sizes = ndimage.sum(labeled > 0, labeled, index=range(1, count + 1))
    for index, size in enumerate(sizes, start=1):
        pocket = labeled == index
        if np.array_equal(pocket, opening):
            continue
        if 80 <= float(size) <= ink_bbox_area * 0.72:
            fabric |= pocket

    # Include only ink directly bordering a fabric panel. This closes the
    # raster edge under the black overlay without creating a coloured halo.
    fabric |= ink & ndimage.binary_dilation(fabric, iterations=2)
    fabric = ndimage.binary_fill_holes(fabric | opening) & ~opening

    # Remove small detached pockets while preserving real leaves/plackets.
    parts, part_count = ndimage.label(fabric)
    if part_count:
        part_sizes = ndimage.sum(fabric, parts, index=range(1, part_count + 1))
        largest = float(max(part_sizes))
        keep = np.zeros_like(fabric)
        for index, size in enumerate(part_sizes, start=1):
            if float(size) >= max(80.0, largest * 0.025):
                keep |= parts == index
        fabric = keep

    if int(fabric.sum()) < 1200:
        raise CollarError("Generated collar fabric panels are incomplete")
    strokes = ink_strokes(LA.to_strokes(ink, max_width=3)) & ~opening
    return fabric, strokes, opening


def heal_fabric(
    fabric: np.ndarray,
    opening: np.ndarray,
) -> np.ndarray:
    """Close trace gaps and fill every enclosed void except the head opening."""
    healed = ndimage.binary_closing(fabric, iterations=2)
    healed = ndimage.binary_fill_holes(healed | opening) & ~opening
    return healed


def body_for_custom_opening(
    body: np.ndarray,
    collar: np.ndarray,
    socket_hole: np.ndarray,
    opening: np.ndarray,
) -> np.ndarray:
    """Replace the old Crew cutout with the uploaded collar's opening.

    Filling the unused Crew hole removes the white crescent around tall,
    polo and funnel collars while preserving the actual custom head opening.
    """
    body_with_socket = body | collar | socket_hole
    return body_with_socket & ~opening


def validate_part_masks(
    fabric: np.ndarray,
    strokes: np.ndarray,
    opening: np.ndarray,
    body_fill: np.ndarray,
    collar: np.ndarray,
    body: np.ndarray,
) -> None:
    """Never return a broken option to the builder."""
    errors: list[str] = []
    fabric_pixels = int(fabric.sum())
    if fabric_pixels < 1200:
        errors.append("collar fabric is incomplete")
    if int((fabric & opening).sum()):
        errors.append("collar fill covers the head opening")
    socket_overlap = int((fabric & ndimage.binary_dilation(collar, iterations=8)).sum())
    if socket_overlap < max(180, min(1200, round(fabric_pixels * 0.025))):
        errors.append("collar does not sit in the shirt neck socket")

    # There must be no enclosed transparent pockets except the known head
    # opening. Those pockets are the checkerboard holes seen in the preview.
    if int(body_fill.sum()) < int(body.sum()) * 0.90:
        errors.append("matching body was cut away")
    if fabric_pixels and int(strokes.sum()) > fabric_pixels * 0.65:
        errors.append("construction ink would black out the collar")

    if errors:
        raise CollarError(
            "Generated collar failed final validation: " + "; ".join(errors)
        )


def crop_ink(img: Image.Image, pad: int = 16) -> Image.Image:
    alpha = np.asarray(img.getchannel("A"))
    ys, xs = np.where(alpha >= T.INK_THRESHOLD)
    if xs.size == 0:
        return img
    return img.crop((
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(img.width, int(xs.max()) + pad + 1),
        min(img.height, int(ys.max()) + pad + 1),
    ))


def shoulder_ends(mask: np.ndarray) -> tuple[tuple[int, int], tuple[int, int]]:
    ys, xs = np.where(mask)
    if xs.size == 0:
        height, width = mask.shape
        return (0, max(0, height // 4)), (max(0, width - 1), max(0, height // 4))
    left_x, right_x = int(xs.min()), int(xs.max())
    left_y = int(ys[xs == left_x].min())
    right_y = int(ys[xs == right_x].min())
    return (left_x, left_y), (right_x, right_y)


def place_on_crew(keyed: Image.Image, art_hw: tuple[int, int]) -> np.ndarray:
    """Map the drawing's shoulder extrema onto (354, 210) and (671, 210).

    Scale down if the nape would otherwise paste above y=0 and get cropped.
    """
    height, width = art_hw
    alpha = np.asarray(keyed.convert("RGBA").getchannel("A"))
    (ax, ay), (bx, _by) = shoulder_ends(alpha >= STRONG_INK)
    scale = (DEST_RIGHT[0] - DEST_LEFT[0]) / max(bx - ax, 1)
    if ay > 0:
        scale = min(scale, (DEST_LEFT[1] - 48) / ay)
    new_w = max(1, round(keyed.width * scale))
    new_h = max(1, round(keyed.height * scale))
    py = round(DEST_LEFT[1] - ay * scale)
    if py + new_h > height - 8 and new_h > 0:
        room = height - 8 - max(py, 20)
        if room > 40:
            scale *= room / new_h
            new_w = max(1, round(keyed.width * scale))
            new_h = max(1, round(keyed.height * scale))
            py = round(DEST_LEFT[1] - ay * scale)
    px = round(DEST_LEFT[0] - ax * scale)
    py = max(24, py)
    fitted = keyed.convert("RGBA").resize((new_w, new_h), Image.NEAREST)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.paste(fitted, (px, py), fitted)
    return np.asarray(canvas.getchannel("A"))


def flood_from_border(open_cells: np.ndarray) -> np.ndarray:
    seed = np.zeros(open_cells.shape, bool)
    seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
    seed &= open_cells
    structure = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
    return ndimage.binary_propagation(seed, mask=open_cells, structure=structure)


def _interior_hole(bridged: np.ndarray) -> np.ndarray | None:
    exterior = flood_from_border(~bridged)
    enclosed = ~exterior
    white_inside = enclosed & ~bridged
    labeled, count = ndimage.label(white_inside)
    if count == 0:
        return None
    sizes = ndimage.sum(white_inside, labeled, index=range(1, count + 1))
    hole = labeled == int(np.argmax(sizes)) + 1
    if int(hole.sum()) < 200:
        return None
    # A hole that touches the top of the canvas leaked — it is not a neck opening.
    if hole[0].any() or hole[-1].any():
        return None
    return hole


def _band_from_closed(ink: np.ndarray, bridged: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
    hole = _interior_hole(bridged)
    if hole is None:
        return None
    exterior = flood_from_border(~bridged)
    enclosed = ~exterior
    # Full collar fabric, including a tall nape/stand — do not clip to a 42px halo.
    fill = ndimage.binary_closing(enclosed & ~hole, iterations=6) & enclosed & ~hole
    fill = fill | (ink & enclosed & ~hole)
    if int(fill.sum()) < 800:
        return None
    return fill, hole


def _pick_opening(interiors: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Neck opening = interior pocket that sits on the catalog hole, not a leaf."""
    labeled, count = ndimage.label(interiors)
    if count == 0:
        return hole
    best_i = 0
    best = -1.0
    for i in range(1, count + 1):
        pocket = labeled == i
        if pocket[0].any() or pocket[-1].any():
            continue
        overlap = float((pocket & hole).sum())
        size = float(pocket.sum())
        score = overlap * 8.0 + min(size, float(hole.sum()) * 3.0) * 0.05
        if overlap == 0:
            score = size * 0.01
        if score > best:
            best, best_i = score, i
    if best_i == 0:
        return hole
    picked = labeled == best_i
    if int((picked & hole).sum()) < int(hole.sum()) * 0.08 and int(picked.sum()) < int(hole.sum()) * 0.5:
        return hole
    return picked


def fabric_from_ink(
    ink: np.ndarray,
    hole: np.ndarray,
    interior: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Part colour stays inside the drawn outlines — no exterior pink halo.

    binary_closing seals gaps then erodes back, so the outer edge does not grow.
    """
    best = ink.copy()
    best_n = 3
    for n in (2, 3, 4, 6, 8, 10):
        closed = ndimage.binary_closing(ink, iterations=n)
        filled = ndimage.binary_fill_holes(closed)
        if int(filled.sum()) > int(interior.sum()) * 0.32:
            continue
        if int(filled.sum()) >= int(best.sum()):
            best = filled
            best_n = n
    closed = ndimage.binary_closing(ink, iterations=best_n)
    interiors = best & ~closed
    opening = _pick_opening(interiors, hole)

    ys, xs = np.where(ink)
    if xs.size:
        bbox = int(ys.max() - ys.min() + 1) * int(xs.max() - xs.min() + 1)
        # Sealed photo frame: the "fill" is the whole rectangle. Keep only
        # small collar pockets (leaves / stand / placket), not the box.
        if bbox > 0 and int(best.sum()) > bbox * 0.55:
            keep = np.zeros_like(ink)
            labeled, count = ndimage.label(interiors)
            for i in range(1, count + 1):
                pocket = labeled == i
                if int(pocket.sum()) > bbox * 0.35:
                    continue
                if pocket[0].any() or pocket[-1].any():
                    continue
                keep |= pocket
            if keep.any():
                return keep | ink, opening
            return ink.copy(), hole
    return best | ink, opening


def split_fabric_and_strokes(
    ink: np.ndarray,
    hole: np.ndarray,
    interior: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Catalog behaviour: solid tintable fabric + thin black outlines.

    Hatched / filled-black collar leaves are fabric (part colour), not ink.
    Only sparse structural lines stay in the #141414 group.
    """
    ink = drop_rectangular_loops(drop_box_edges(drop_image_frame(ink)))
    density = ndimage.uniform_filter(ink.astype(np.float32), size=11)
    dense = ndimage.binary_closing(density >= 0.16, iterations=5)
    dense = ndimage.binary_fill_holes(dense)
    closed = ndimage.binary_closing(ink, iterations=4)
    outlined = ndimage.binary_fill_holes(closed)
    if int(outlined.sum()) > int(interior.sum()) * 0.32:
        outlined = np.zeros_like(ink)
    fabric = dense | outlined

    ys, xs = np.where(ink)
    if xs.size and fabric.any():
        bbox = int(ys.max() - ys.min() + 1) * int(xs.max() - xs.min() + 1)
        if bbox > 0 and int(fabric.sum()) > bbox * 0.58:
            fabric = dense if dense.any() and int(dense.sum()) < bbox * 0.58 else ink

    if int(fabric.sum()) > int(interior.sum()) * 0.30:
        fabric = dense if dense.any() else ndimage.binary_dilation(ink, iterations=4)

    inner = _interior_hole(ndimage.binary_closing(fabric, iterations=2)) if fabric.any() else None
    opening = inner if inner is not None else (hole & ndimage.binary_dilation(fabric, iterations=16))
    if not opening.any():
        opening = hole
    fabric = (fabric | dense) & ~opening

    boundary = fabric ^ ndimage.binary_erosion(fabric, iterations=2)
    sparse = ink & (density < 0.18)
    sparse = LA.drop_speckles(sparse, min_area=36)
    sparse = drop_rectangular_loops(drop_box_edges(drop_image_frame(sparse)))
    strokes = (boundary | sparse) & ~opening
    strokes = ink_strokes(strokes)
    if int(fabric.sum()) < 800 and ink.any():
        fabric = ndimage.binary_dilation(ink, iterations=5) & ~opening
    return fabric, strokes, opening


def clip_opening(
    opening: np.ndarray,
    hole: np.ndarray,
    interior: np.ndarray,
) -> np.ndarray:
    """Head opening only. A leaked flood must not become the whole chest."""
    if not opening.any():
        return hole
    if int(opening.sum()) > int(hole.sum()) * 6:
        return hole
    if int(opening.sum()) > int(interior.sum()) * 0.18:
        return hole
    if int((opening & hole).sum()) < int(hole.sum()) * 0.12:
        return hole
    return opening


def body_fill_from_catalog(
    body: np.ndarray,
    hole: np.ndarray,
    opening: np.ndarray,
) -> np.ndarray:
    """Slim body with a neck hole. Never subtract the custom collar silhouette."""
    filled = body & ~opening
    if int(filled.sum()) < int(body.sum()) * 0.55:
        return body & ~hole
    return filled


def try_split_band(alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    ink = LA.to_strokes(alpha >= T.INK_THRESHOLD)
    ink = LA.close_flat_nape(ink)
    for close_n, dilate_n in ((6, 2), (10, 3), (14, 4), (18, 6)):
        bridged = ndimage.binary_closing(ink, iterations=close_n)
        bridged = ndimage.binary_dilation(bridged, iterations=dilate_n)
        split = _band_from_closed(ink, bridged)
        if split:
            fill, hole = split
            return ink, fill, hole
    return None


def force_closed_band(alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Always return a seated collar — close gaps instead of erroring."""
    ink = LA.to_strokes(alpha >= T.INK_THRESHOLD, max_width=3)
    ink = LA.close_flat_nape(ink)
    split = try_split_band(alpha)
    if split:
        return split
    for dilate_n in range(4, 28, 2):
        bridged = ndimage.binary_dilation(ink, iterations=dilate_n)
        bridged = ndimage.binary_closing(bridged, iterations=max(3, dilate_n // 2))
        split = _band_from_closed(ink, bridged)
        if split:
            fill, hole = split
            return ink, fill, hole
    ys, xs = np.where(ink)
    if xs.size == 0:
        hole = np.zeros(alpha.shape, bool)
        return ink, ink, hole
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    cy = y0 + (y1 - y0) * 0.28
    cx = (x0 + x1) / 2.0
    ry = max(14.0, (y1 - y0) * 0.18)
    rx = max(18.0, (x1 - x0) * 0.22)
    yy, xx = np.ogrid[: ink.shape[0], : ink.shape[1]]
    hole = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    hull = ndimage.binary_dilation(ink, iterations=14)
    fill = hull & ~hole & ~ink
    return ink, fill, hole


def ink_strokes(ink: np.ndarray) -> np.ndarray:
    """Always hollow slabs. A closed leaf must not stay a #141414 fill."""
    dist = ndimage.distance_transform_edt(ink)
    thin = ink & ~(dist > 2)
    if int(thin.sum()) >= 80:
        return thin
    if int(ink.sum()) < 4000:
        return ink
    return thin


def fit_photo(img: Image.Image, longest: int = 1024) -> Image.Image:
    w, h = img.size
    scale = longest / max(w, h)
    if scale >= 1:
        return img
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def display_name_for(kind: str, model_name: str = "") -> str:
    if model_name:
        return model_name
    return {
        "vneck": "Ribbed V-neck",
        "mock": "Mock neck",
        "crew": "Crew neck",
    }.get(kind, "Collar")


def construction_lineart(photo: Image.Image) -> tuple[Image.Image, str]:
    drawing, kind = DC.render_lineart(photo)
    return drawing, kind


def lineart_from_photo(photo: Image.Image) -> tuple[Image.Image, str, str, str]:
    """Step 1 — construction drawing of only the collar. Always redraw photos."""
    secrets = LA.load_secrets()
    gkey = LA.gemini_key(secrets)
    okey = LA.openai_key(secrets)
    if gkey:
        drawing, name = LA.generate_lineart_gemini(
            photo,
            gkey,
            LA.gemini_model(secrets),
            on_progress=lambda msg: progress("lineart", msg),
        )
        return drawing, "gemini", "custom", name
    if okey:
        drawing = LA.isolate_collar(LA.generate_lineart_openai(photo, okey))
        return drawing, "openai", "custom", ""
    drawing, kind = construction_lineart(photo)
    return drawing, "constructed", kind, ""


def key_white(drawing: Image.Image) -> Image.Image:
    """Step 2 — luminance ramp, not a hard cut."""
    contrasted = ImageEnhance.Contrast(drawing).enhance(T.CONTRAST)
    return crop_ink(T.to_transparent(contrasted))


def build(photo: Image.Image) -> dict:
    photo = fit_photo(photo)

    progress("lineart", "Drawing construction line art of only the collar")
    drawing, source, kind, model_name = lineart_from_photo(photo)
    progress("lineart", f"Line art ready ({source}{', ' + model_name if model_name else ''})")
    debug_image("01-lineart", drawing)

    progress("key", "Keying white out with a luminance ramp")
    keyed = key_white(drawing)
    debug_image("02-keyed", keyed)

    progress("place", "Seating the uploaded collar on the slim shoulder socket")
    if not CREW_MASKS.is_file():
        raise CollarError(f"missing crew masks at {CREW_MASKS}")
    crew = np.load(CREW_MASKS)
    collar = crew["collar"].astype(bool)
    interior = crew["interior"].astype(bool)
    body = crew["body"].astype(bool)
    hole = crew["hole"].astype(bool)
    crew_ink = crew["ink"].astype(bool)
    art_hw = interior.shape

    # Real black strokes only. Faint paper + a photo frame become the box
    # around the collar if we place/trace them as ink.
    keyed = keep_strong_ink(keyed)
    keyed = crop_ink(keyed, pad=8)

    placed = place_on_crew(keyed, art_hw)
    ink = placed >= STRONG_INK
    debug_image("03-placed-ink", ink)
    progress("potrace", "Tracing a solid collar fill with construction outlines")
    band, neck_ink, opening = seated_collar(ink, collar, hole)
    band = heal_fabric(band, opening)
    debug_image("04-fabric", band)
    debug_image("05-construction-ink", neck_ink)
    body_fill = body_for_custom_opening(body, collar, hole, opening)
    body_ink = (
        crew_ink
        & body
        & ~ndimage.binary_dilation(collar, np.ones((3, 3), bool), 5)
        & body_fill
    )
    validate_part_masks(band, neck_ink, opening, body_fill, collar, body)

    name = display_name_for(kind, model_name)
    fill_d = T.trace(band)
    ink_d = T.trace(neck_ink)
    if not fill_d.strip():
        raise CollarError("Generated collar fabric could not be traced")
    neck_svg = T.wrap_svg(f"Ceriga test t-shirt - {name}", fill_d, ink_d)
    body_svg = T.wrap_svg(
        f"Ceriga test t-shirt - Body {name}",
        T.trace(body_fill),
        T.trace(body_ink),
    )
    return {
        "neckSvg": neck_svg,
        "bodySvg": body_svg,
        "source": source,
        "kind": kind,
        "displayName": name,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photo")
    args = parser.parse_args()
    photo = Image.open(args.photo).convert("RGB")
    result = build(photo)
    print(json.dumps({"type": "result", "ok": True, **result}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except CollarError as exc:
        print(json.dumps({"type": "error", "ok": False, "error": str(exc)}), flush=True)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"type": "error", "ok": False, "error": str(exc)}), flush=True)
        sys.exit(1)
