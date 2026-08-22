"""Potrace wrap matching the test-tee part SVGs (2048 viewBox, even-odd, inverted)."""
from __future__ import annotations

from PIL import Image

CANVAS = 2048
TRACE_SS = 4
INK_COLOR = "#141414"
INK_THRESHOLD = 32

WHITE_CUTOFF = 246
INK_CUTOFF = 120
CONTRAST = 1.35


def to_transparent(img: Image.Image) -> Image.Image:
    grey = img.convert("L")
    span = WHITE_CUTOFF - INK_CUTOFF

    def alpha_for(lum: int) -> int:
        if lum >= WHITE_CUTOFF:
            return 0
        if lum <= INK_CUTOFF:
            return 255
        return round((WHITE_CUTOFF - lum) / span * 255)

    alpha = grey.point([alpha_for(v) for v in range(256)])
    out = Image.new("RGBA", img.size, (0, 0, 0, 255))
    out.putalpha(alpha)
    return out


def _place(shape: tuple[int, int]) -> tuple[float, float, float]:
    height, width = shape
    scale = CANVAS / max(width, height)
    return scale, (CANVAS - width * scale) / 2, (CANVAS - height * scale) / 2


def trace(mask) -> str:
    import numpy as np
    import potrace

    height, width = mask.shape
    img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    big = np.asarray(img.resize((width * TRACE_SS, height * TRACE_SS), Image.NEAREST)) >= 128
    if not big.any():
        return ""

    bitmap = potrace.Bitmap(big)
    bitmap.invert()
    path = bitmap.trace(
        turdsize=2,
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
                d.append(f"C{point(segment.c1)} {point(segment.c2)} {point(segment.end_point)}")
        d.append("Z")
        out.append("".join(d))
    return " ".join(out)


def wrap_svg(title: str, fill_d: str, ink_d: str) -> str:
    group = '<g transform="translate(0,2048) scale(0.1,-0.1)"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}">\n'
        f"<title>{title}</title>\n"
        f'{group} fill="#000000" stroke="none">\n'
        f'<path d="{fill_d}" fill-rule="evenodd"/>\n'
        "</g>\n"
        f'{group} fill="{INK_COLOR}" stroke="none">\n'
        f'<path d="{ink_d}" fill="{INK_COLOR}" fill-rule="evenodd"/>\n'
        "</g>\n"
        "</svg>\n"
    )
