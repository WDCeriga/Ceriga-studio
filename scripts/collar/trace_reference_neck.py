"""Reference garment image -> keyed ink -> Potrace SVG (front and back halves).

Usage: python trace_reference_neck.py <reference.png> <out_dir> <name>

The reference shows a front flat on the left and a back flat on the right. Only
dark ink is kept (fill colour is dropped), keyed with the repo's luminance ramp,
then traced with potracer. No path data is authored by hand.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
import potrace

from trace_svg import CONTRAST, INK_CUTOFF, WHITE_CUTOFF

UPSAMPLE = 3
INK_MAX_CHROMA = 60  # blue garment fill is chromatic; line ink is near-neutral


def ink_alpha(rgb: Image.Image) -> np.ndarray:
    arr = np.asarray(rgb.convert("RGB")).astype(np.float32)
    lum = arr @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lum = np.clip((lum - 128) * CONTRAST + 128, 0, 255)
    chroma = arr.max(axis=2) - arr.min(axis=2)
    span = WHITE_CUTOFF - INK_CUTOFF
    alpha = np.clip((WHITE_CUTOFF - lum) / span, 0, 1)
    alpha[(chroma > INK_MAX_CHROMA) & (lum > INK_CUTOFF)] = 0
    return alpha


def split_halves(image: Image.Image) -> dict[str, Image.Image]:
    width, height = image.size
    middle = width // 2
    return {"front": image.crop((0, 0, middle, height)), "back": image.crop((middle, 0, width, height))}


def crop_to_ink(alpha: np.ndarray, pad: int = 12) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha > 0.5)
    return (max(0, xs.min() - pad), max(0, ys.min() - pad),
            min(alpha.shape[1], xs.max() + pad + 1), min(alpha.shape[0], ys.max() + pad + 1))


def trace_alpha(alpha: np.ndarray) -> tuple[str, int]:
    big = Image.fromarray((alpha * 255).astype(np.uint8)).resize(
        (alpha.shape[1] * UPSAMPLE, alpha.shape[0] * UPSAMPLE), Image.LANCZOS)
    ink = np.asarray(big) >= 128
    # potrace.Bitmap inverts on construction, so pass the inverted mask to trace the ink.
    bitmap = potrace.Bitmap(~ink)
    plist = bitmap.trace(turdsize=4, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=1.0, opticurve=True, opttolerance=0.2)
    parts = []
    for curve in plist:
        start = curve.start_point
        parts.append(f"M{start.x / UPSAMPLE:.2f},{start.y / UPSAMPLE:.2f}")
        for segment in curve.segments:
            if segment.is_corner:
                parts.append(f"L{segment.c.x / UPSAMPLE:.2f},{segment.c.y / UPSAMPLE:.2f}"
                    f"L{segment.end_point.x / UPSAMPLE:.2f},{segment.end_point.y / UPSAMPLE:.2f}")
            else:
                parts.append("C" + " ".join(f"{p.x / UPSAMPLE:.2f},{p.y / UPSAMPLE:.2f}"
                    for p in (segment.c1, segment.c2, segment.end_point)))
        parts.append("Z")
    return "".join(parts), len(plist)


def main(reference: Path, out_dir: Path, name: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for view, half in split_halves(Image.open(reference).convert("RGB")).items():
        alpha = ink_alpha(half)
        box = crop_to_ink(alpha)
        cropped = alpha[box[1]:box[3], box[0]:box[2]]
        height, width = cropped.shape
        keyed = Image.new("RGBA", (width, height), (0, 0, 0, 255))
        keyed.putalpha(Image.fromarray((cropped * 255).astype(np.uint8)))
        keyed.save(out_dir / f"{name}-{view}-keyed.png")
        preview = ImageOps.invert(Image.fromarray((cropped * 255).astype(np.uint8)))
        preview.save(out_dir / f"{name}-{view}-lineart.png")
        d, count = trace_alpha(cropped)
        if count < 3:
            raise SystemExit(f"{view}: only {count} subpaths; trace looks wrong")
        (out_dir / f"{name}-{view}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">'
            f'<path fill="#141414" fill-rule="evenodd" d="{d}"/></svg>', encoding="utf-8")
        print(f"{view}: {width}x{height}, {count} subpaths, box={box}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
