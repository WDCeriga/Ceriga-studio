"""Potrace wrapper that shells out to the standalone Windows tracer.

This keeps the project's established raster-to-SVG workflow while avoiding the
missing native Python binding. The binary is discovered from PATH or a few known
Windows install locations, then invoked with the same turn policy and geometry
settings the original pipeline used.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

CANVAS = 2048
TRACE_SS = 3
INK_COLOR = "#141414"
INK_THRESHOLD = 32

WHITE_CUTOFF = 246
INK_CUTOFF = 120
CONTRAST = 1.35


def _potrace_candidates() -> list[str]:
    candidates = [
        os.environ.get("POTRACE"),
        os.environ.get("POTRACE_EXE"),
        shutil.which("potrace"),
        shutil.which("potrace.exe"),
        "C:\\Users\\rodiase\\Downloads\\potrace-1.16.win64\\potrace-1.16.win64\\potrace.exe",
        "C:\\Users\\rodiase\\potrace\\potrace-1.16.win64\\potrace.exe",
    ]
    return [str(path) for path in candidates if path and str(path).strip()]


def find_potrace_executable() -> str:
    for candidate in _potrace_candidates():
        if os.path.exists(candidate):
            return candidate
    raise RuntimeError(
        "Potrace executable not found. Install Potrace 1.16 and add it to PATH or set POTRACE/POTRACE_EXE."
    )


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


def _transform_svg_path_d(path_d: str, shape: tuple[int, int]) -> str:
    """Convert Potrace's native path coordinates onto the app's 2048 canvas."""
    scale, offset_x, offset_y = _place(shape)
    token_re = re.compile(r"([A-Za-z]|-?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)")
    tokens = token_re.findall(path_d)
    if not tokens:
        return path_d

    output: list[str] = []
    cursor_x = cursor_y = start_x = start_y = 0.0
    position = 0
    while position < len(tokens):
        token = tokens[position]
        position += 1
        command = token.upper()
        if command == "Z":
            output.append("Z")
            cursor_x, cursor_y = start_x, start_y
            continue
        if command not in {"M", "L", "C"}:
            raise ValueError(f"Unexpected Potrace path command: {token}")
        values: list[float] = []
        while position < len(tokens) and not tokens[position].isalpha():
            values.append(float(tokens[position]))
            position += 1
        stride = 6 if command == "C" else 2
        if not values or len(values) % stride:
            raise ValueError(f"Incomplete Potrace path command: {token}")
        for offset in range(0, len(values), stride):
            coordinates = values[offset:offset + stride]
            if token.islower():
                coordinates = [
                    value + (cursor_x if index % 2 == 0 else cursor_y)
                    for index, value in enumerate(coordinates)
                ]
            cursor_x, cursor_y = coordinates[-2:]
            emitted = "L" if command == "M" and offset else command
            if emitted == "M":
                start_x, start_y = cursor_x, cursor_y
            converted = [
                round(10 * (offset_x if index % 2 == 0 else offset_y) + value * scale / TRACE_SS)
                for index, value in enumerate(coordinates)
            ]
            output.append(emitted + " ".join(str(value) for value in converted))
    return " ".join(output)


def _run_potrace(mask) -> str:
    """Trace an already upsampled boolean mask in native Potrace coordinates."""
    import numpy as np

    if not mask.any():
        return ""

    with tempfile.TemporaryDirectory() as tmpdir:
        src = Path(tmpdir) / "trace.pbm"
        out = Path(tmpdir) / "trace.svg"
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert(
            "1", dither=Image.Dither.NONE
        ).save(src, format="PPM")
        exe = find_potrace_executable()
        cmd = [
            exe,
            "--svg",
            "--longcoding",
            "--unit",
            "10",
            "--turnpolicy",
            "minority",
            "--turdsize",
            "4",
            "--alphamax",
            "1.0",
            "--opttolerance",
            "0.2",
            "-o",
            str(out),
            str(src),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Potrace failed: {result.stderr.strip() or result.stdout.strip() or 'unknown error'}")
        if not out.exists():
            raise RuntimeError("Potrace did not produce a trace output file.")
        svg_text = out.read_text(encoding="utf-8")

    root = ET.fromstring(svg_text)
    return " ".join(
        element.attrib["d"] for element in root.iter("{http://www.w3.org/2000/svg}path")
    )


def trace(mask, *, resample: int = Image.NEAREST) -> str:
    """Potrace a boolean mask while preserving the original tile/outline semantics.

    The CLI path is used because the native Python binding is not available in this
    environment. The raster-first workflow, 3× upsampling, threshold-128 mask, and
    final 2048 viewBox placement remain unchanged.
    """
    import numpy as np

    height, width = mask.shape
    img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    big = np.asarray(img.resize((width * TRACE_SS, height * TRACE_SS), resample)) >= 128
    if not big.any():
        return ""
    return _transform_svg_path_d(_run_potrace(big), mask.shape)


def source_svg(title: str, alpha: Image.Image) -> str:
    """Trace keyed alpha with a viewBox matching the source raster."""
    import numpy as np

    width, height = alpha.size
    bitmap = np.asarray(alpha.resize((width * TRACE_SS, height * TRACE_SS), Image.LANCZOS)) >= 128
    path = _run_potrace(bitmap)
    root = ET.Element("svg", {
        "xmlns": "http://www.w3.org/2000/svg", "width": str(width), "height": str(height),
        "viewBox": f"0 0 {width} {height}",
    })
    ET.SubElement(root, "title").text = title
    group = ET.SubElement(root, "g", {
        "transform": f"translate(0,{height}) scale({1 / (10 * TRACE_SS)}, {-1 / (10 * TRACE_SS)})",
        "fill": "#000000", "stroke": "none", "fill-rule": "evenodd",
    })
    ET.SubElement(group, "path", {"d": path, "fill-rule": "evenodd"})
    return ET.tostring(root, encoding="unicode")


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
