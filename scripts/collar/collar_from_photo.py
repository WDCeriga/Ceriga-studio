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
    (ax, ay), (bx, _by) = shoulder_ends(alpha >= T.INK_THRESHOLD)
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


def _band_from_closed(ink: np.ndarray, bridged: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
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
    fill = ndimage.binary_closing(enclosed & ~hole, iterations=6) & enclosed & ~hole
    dist = ndimage.distance_transform_edt(~hole)
    ink_on_collar = ink & enclosed
    if ink_on_collar.any():
        outer = max(float(np.percentile(dist[ink_on_collar], 98)), 14.0)
        fill = fill & (dist <= outer + 6)
    fill = fill & (ndimage.distance_transform_edt(~ink) <= 42)
    fill = fill & ~ink
    if int(fill.sum()) < 800:
        return None
    return fill, hole


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
    """Keep construction lines as strokes so even-odd never floods a collar leaf."""
    return LA.to_strokes(ndimage.binary_dilation(ink, iterations=1), max_width=2)


def clip_above_band(mask: np.ndarray, band: np.ndarray) -> np.ndarray:
    out = mask.copy()
    for x in np.where(band.any(axis=0))[0]:
        out[: int(np.argmax(band[:, x])), x] = False
    return out


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
    """Step 1 — construction drawing of only the collar. Keep going; don't fail the upload."""
    if LA.looks_like_lineart(photo):
        return photo, "existing-lineart", DC.read_shape(photo).kind, ""

    secrets = LA.load_secrets()
    gkey = LA.gemini_key(secrets)
    okey = LA.openai_key(secrets)
    if gkey:
        try:
            drawing, name = LA.generate_lineart_gemini(
                photo,
                gkey,
                LA.gemini_model(secrets),
                on_progress=lambda msg: progress("lineart", msg),
            )
            return drawing, "gemini", DC.read_shape(photo).kind, name
        except Exception:  # noqa: BLE001
            progress("lineart", "First drawing pass failed — closing the collar from the photo")
    if okey:
        try:
            drawing = LA.isolate_collar(LA.generate_lineart_openai(photo, okey))
            return drawing, "openai", DC.read_shape(photo).kind, ""
        except Exception:  # noqa: BLE001
            progress("lineart", "Closing the collar from the photo")
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

    progress("key", "Keying white out with a luminance ramp")
    keyed = key_white(drawing)

    progress("place", "Mapping shoulders onto the slim crew collar (354, 210)")
    if not CREW_MASKS.is_file():
        raise CollarError(f"missing crew masks at {CREW_MASKS}")
    crew = np.load(CREW_MASKS)
    collar = crew["collar"].astype(bool)
    interior = crew["interior"].astype(bool)
    body = crew["body"].astype(bool)
    hole = crew["hole"].astype(bool)
    crew_ink = crew["ink"].astype(bool)
    art_hw = interior.shape

    placed = place_on_crew(keyed, art_hw)
    progress("potrace", "Closing the collar ring and tracing")
    split = try_split_band(placed)
    if split is None:
        progress("potrace", "Filling remaining gaps in the neckline")
        ink, band, opening = force_closed_band(placed)
    else:
        ink, band, opening = split

    if int(band.sum()) < 200:
        ink, band, opening = force_closed_band(placed)

    if band.any():
        band_top = int(np.where(band)[0].min())
        opening[:band_top] = False

    interior = clip_above_band(interior, band) if band.any() else interior
    garment = interior & ~opening
    join = band & ndimage.binary_dilation(~interior, iterations=2)
    neck_ink = ink_strokes(ink)
    neck_ink = neck_ink & (band | ndimage.binary_dilation(band, iterations=6) | join)
    neck_ink = (neck_ink | join) & ~opening
    body_fill = (body | collar | hole) & garment & ~band
    body_ink = (
        crew_ink
        & body
        & ~ndimage.binary_dilation(collar, np.ones((3, 3), bool), 5)
        & body_fill
    )

    name = display_name_for(kind, model_name)
    fill_d = T.trace(band)
    ink_d = T.trace(neck_ink)
    if not fill_d.strip():
        fill_d = T.trace(ndimage.binary_dilation(ink, iterations=8) & ~opening)
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
