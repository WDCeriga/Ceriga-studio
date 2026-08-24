"""Full garment photo -> locally generated colourable technical-flat layers.

This experimental Studio pipeline does not use image-model credits. It:
1. isolates the garment from a light/neutral background,
2. derives a clean silhouette and construction/seam ink,
3. uses those seam barriers to split the raster into regions,
4. traces every region with the same potrace convention as the builder.

No SVG paths are authored by hand; every path comes from a raster mask.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import trace_svg as T  # noqa: E402

RASTER = 1024
MAX_PARTS = 12
MIN_PART_RATIO = 0.006


class GarmentError(Exception):
    pass


def progress(step: str, label: str) -> None:
    print(json.dumps({"type": "progress", "step": step, "label": label}), flush=True)


def debug_image(name: str, image: Image.Image | np.ndarray) -> None:
    target = os.environ.get("GARMENT_DEBUG_DIR", "").strip()
    if not target:
        return
    directory = Path(target)
    directory.mkdir(parents=True, exist_ok=True)
    if isinstance(image, np.ndarray):
        output = Image.fromarray(np.where(image, 0, 255).astype(np.uint8), "L")
    else:
        output = image
    output.save(directory / f"{name}.png")


def contain_photo(photo: Image.Image) -> Image.Image:
    oriented = ImageOps.exif_transpose(photo)
    if "A" in oriented.getbands():
        rgba = oriented.convert("RGBA")
        base = Image.new("RGBA", rgba.size, "white")
        base.alpha_composite(rgba)
        rgb = base.convert("RGB")
    else:
        rgb = oriented.convert("RGB")
    scale = min((RASTER * 0.88) / max(rgb.width, 1), (RASTER * 0.88) / max(rgb.height, 1))
    size = (max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale)))
    fitted = rgb.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (RASTER, RASTER), "white")
    canvas.paste(fitted, ((RASTER - fitted.width) // 2, (RASTER - fitted.height) // 2))
    return canvas


def _largest_components(mask: np.ndarray, minimum: int) -> np.ndarray:
    labeled, count = ndimage.label(mask)
    if count == 0:
        return mask
    sizes = ndimage.sum(mask, labeled, index=range(1, count + 1))
    keep = np.zeros_like(mask)
    largest = max(float(value) for value in sizes)
    for index, size in enumerate(sizes, start=1):
        if float(size) >= max(minimum, largest * 0.015):
            keep |= labeled == index
    return keep


def _line_components(mask: np.ndarray) -> np.ndarray:
    """Keep coherent long/thin seam marks while dropping texture dots."""
    labeled, count = ndimage.label(mask)
    keep = np.zeros_like(mask)
    for index in range(1, count + 1):
        piece = labeled == index
        ys, xs = np.where(piece)
        if xs.size == 0:
            continue
        width = int(xs.max() - xs.min()) + 1
        height = int(ys.max() - ys.min()) + 1
        if int(piece.sum()) >= 10 and max(width, height) >= 12:
            keep |= piece
    return keep


def garment_silhouette(image: Image.Image) -> np.ndarray:
    """Foreground from border colour distance, cleaned into a solid garment."""
    arr = np.asarray(image).astype(np.float32)
    border = np.concatenate(
        [arr[:16].reshape(-1, 3), arr[-16:].reshape(-1, 3),
         arr[:, :16].reshape(-1, 3), arr[:, -16:].reshape(-1, 3)],
        axis=0,
    )
    background = np.median(border, axis=0)
    distance = np.sqrt(((arr - background) ** 2).sum(axis=2))
    luminance = arr.mean(axis=2)
    foreground = (distance > 24.0) | (luminance < 225.0)
    foreground = ndimage.binary_opening(foreground, iterations=2)
    foreground = ndimage.binary_closing(foreground, iterations=5)
    foreground = _largest_components(foreground, minimum=800)
    foreground = ndimage.binary_fill_holes(foreground)
    foreground = ndimage.binary_closing(foreground, iterations=3)
    if int(foreground.sum()) < RASTER * RASTER * 0.035:
        raise GarmentError(
            "Could not isolate a full garment. Use a photo showing the complete item."
        )
    if int(foreground.sum()) > RASTER * RASTER * 0.78:
        raise GarmentError(
            "The garment does not separate from the background in this local test."
        )
    return foreground


def construction_ink(image: Image.Image, garment: np.ndarray) -> np.ndarray:
    """Sparse seam/edge drawing with the silhouette guaranteed."""
    rgb = np.asarray(
        ImageEnhance.Contrast(image.convert("RGB")).enhance(1.45),
        dtype=np.float32,
    )
    gradients = []
    for channel in range(3):
        smooth = ndimage.gaussian_filter(rgb[..., channel], sigma=1.25)
        gx = ndimage.sobel(smooth, axis=1)
        gy = ndimage.sobel(smooth, axis=0)
        gradients.append(np.hypot(gx, gy))
    magnitude = np.sqrt(sum(channel ** 2 for channel in gradients))
    inner = ndimage.binary_erosion(garment, iterations=3)
    samples = magnitude[inner]
    threshold = float(np.percentile(samples, 81.0)) if samples.size else 28.0
    seams = (magnitude >= max(threshold, 14.0)) & inner

    # Suppress fabric grain: retain coherent lines, not isolated edge flecks.
    neighbours = ndimage.uniform_filter(seams.astype(np.float32), size=5)
    seams &= neighbours >= 0.08
    seams = ndimage.binary_closing(seams, iterations=1)
    seams = _line_components(seams)

    boundary = garment & ~ndimage.binary_erosion(garment, iterations=2)
    ink = boundary | seams
    return ink


def raster_lineart(ink: np.ndarray) -> Image.Image:
    """Render black construction ink on white before any vector operation."""
    page = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8), "L")
    # A light antialias gives the luminance key a real ramp at ink edges.
    return page.filter(ImageFilter.GaussianBlur(radius=0.35)).convert("RGB")


def key_lineart(lineart: Image.Image) -> tuple[Image.Image, np.ndarray]:
    """Key white with trace_svg's luminance ramp, never a hard RGB cut."""
    keyed = T.to_transparent(lineart)
    alpha = np.asarray(keyed.getchannel("A"), dtype=np.uint8)
    return keyed, alpha >= T.INK_THRESHOLD


def _seam_barriers(ink: np.ndarray, garment: np.ndarray) -> np.ndarray:
    inner_ink = ink & ndimage.binary_erosion(garment, iterations=2)
    barriers = ndimage.binary_dilation(inner_ink, iterations=1)
    barriers = ndimage.binary_closing(barriers, iterations=2)
    # Join short breaks in fly/leg seams and waistband seams without replacing
    # them with hand-authored geometry.
    barriers = ndimage.binary_closing(
        barriers, structure=np.ones((15, 3), dtype=bool)
    )
    barriers = ndimage.binary_closing(
        barriers, structure=np.ones((3, 15), dtype=bool)
    )
    return barriers


def _region_seeds(garment: np.ndarray, barriers: np.ndarray) -> np.ndarray:
    open_fabric = garment & ~barriers
    labels, count = ndimage.label(open_fabric)
    if count == 0:
        return garment.astype(np.int32)
    sizes = ndimage.sum(open_fabric, labels, index=range(1, count + 1))
    minimum = max(250, round(int(garment.sum()) * MIN_PART_RATIO))
    ranked = sorted(
        ((index, int(size)) for index, size in enumerate(sizes, start=1) if int(size) >= minimum),
        key=lambda item: item[1],
        reverse=True,
    )[:MAX_PARTS]
    if not ranked:
        return garment.astype(np.int32)
    seeds = np.zeros_like(labels)
    for new_index, (old_index, _size) in enumerate(ranked, start=1):
        seeds[labels == old_index] = new_index
    return seeds


def split_regions(garment: np.ndarray, ink: np.ndarray) -> list[np.ndarray]:
    """Assign every garment pixel to the nearest seam-enclosed large region."""
    seeds = _region_seeds(garment, _seam_barriers(ink, garment))
    if int(seeds.max()) <= 1:
        return [garment]
    _distance, indices = ndimage.distance_transform_edt(
        seeds == 0, return_indices=True
    )
    assigned = seeds[tuple(indices)]
    assigned[~garment] = 0
    parts: list[np.ndarray] = []
    for index in range(1, int(assigned.max()) + 1):
        part = assigned == index
        part = ndimage.binary_closing(part, iterations=1) & garment
        if int(part.sum()) >= 200:
            parts.append(part)
    return parts or [garment]


def part_name(
    mask: np.ndarray,
    silhouette: np.ndarray,
    used: dict[str, int],
    rank: int,
) -> str:
    ys, xs = np.where(mask)
    all_ys, all_xs = np.where(silhouette)
    cx = float(xs.mean())
    cy = float(ys.mean())
    x0, x1 = int(all_xs.min()), int(all_xs.max())
    y0, y1 = int(all_ys.min()), int(all_ys.max())
    rel_x = (cx - x0) / max(x1 - x0, 1)
    rel_y = (cy - y0) / max(y1 - y0, 1)
    width = int(xs.max() - xs.min()) + 1

    if rank == 0:
        base = "Main garment panels"
    elif rel_y < 0.22 and width > (x1 - x0) * 0.45:
        base = "Waistband"
    elif rel_x < 0.40:
        base = "Left overlay panel"
    elif rel_x > 0.60:
        base = "Right overlay panel"
    elif rel_y < 0.48:
        base = "Fly / centre front"
    else:
        base = "Centre panel"
    used[base] = used.get(base, 0) + 1
    return base if used[base] == 1 else f"{base} {used[base]}"


def wrap_fill_svg(title: str, mask: np.ndarray) -> str:
    return T.wrap_svg(title, T.trace(mask), "")


def wrap_ink_svg(title: str, mask: np.ndarray) -> str:
    return T.wrap_svg(title, "", T.trace(mask))


def build(photo: Image.Image) -> dict:
    progress("prepare", "Fitting the complete garment onto the 2048 SVG canvas")
    framed = contain_photo(photo)
    debug_image("01-framed", framed)
    silhouette = garment_silhouette(framed)
    debug_image("02-silhouette", silhouette)
    progress("lineart", "Drawing black-and-white construction line art from visible seams")
    detected_ink = construction_ink(framed, silhouette)
    lineart = raster_lineart(detected_ink)
    debug_image("03-lineart", lineart)
    progress("key", "Keying white to transparency with a luminance ramp")
    keyed, ink = key_lineart(lineart)
    debug_image("04-keyed", keyed)
    debug_image("03-ink", ink)
    progress("parts", "Splitting colour regions along detected seams")
    masks = split_regions(silhouette, ink)
    for index, mask in enumerate(masks, start=1):
        debug_image(f"part-{index:02d}", mask)
    used: dict[str, int] = {}
    palette = [
        "#20242B", "#343A45", "#2A3039", "#454B55",
        "#F59E0B", "#06B6D4", "#EC4899", "#84CC16",
        "#8B5CF6", "#F97316", "#14B8A6", "#64748B",
    ]
    parts = []
    progress("potrace", "Upsampling 3x, inverting the bitmap and tracing SVG layers")
    for index, mask in enumerate(masks):
        name = part_name(mask, silhouette, used, index)
        parts.append({
            "id": f"part-{index + 1}",
            "name": name,
            "svg": wrap_fill_svg(f"Photo mockup - {name}", mask),
            "color": palette[index % len(palette)],
            "area": int(mask.sum()),
        })
    result = {
        "type": "result",
        "ok": True,
        "source": "local-seam-trace",
        "parts": parts,
        "lineArtSvg": wrap_ink_svg("Photo mockup - construction ink", ink),
        "partCount": len(parts),
        "process": {
            "rasterFirst": True,
            "whiteKey": "luminance-ramp",
            "traceSupersampling": T.TRACE_SS,
            "bitmapInverted": True,
            "fillRule": "evenodd",
            "viewBox": f"0 0 {T.CANVAS} {T.CANVAS}",
        },
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photo")
    args = parser.parse_args()
    result = build(Image.open(args.photo))
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    try:
        main()
    except GarmentError as exc:
        print(json.dumps({"type": "error", "ok": False, "error": str(exc)}), flush=True)
        raise SystemExit(1)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"type": "error", "ok": False, "error": str(exc)}), flush=True)
        raise SystemExit(1)
