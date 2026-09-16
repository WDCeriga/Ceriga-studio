"""Measure neck geometry across the crew variants to quantify the slim-crew position issue."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import composite_neck_variant as C  # noqa: E402

SRC = HERE.parents[1] / "src" / "assets" / "studio-tshirt"

ARTS = {
    "slim-crew": "slim-crew-composite-bold.png",
    "slim-vneck(base)": "slim-vneck-lineart-bold.png",
    "slim-thin-crew": "slim-thin-crew-composite-bold.png",
    "slim-deep-vneck": "slim-deep-vneck-composite-bold.png",
    "slim-scoop": "slim-scoop-composite-bold.png",
}


def hole_metrics(ink: np.ndarray) -> dict:
    hole = C.neck_hole(ink)
    if not hole.any():
        return {"hole": False}
    ys, xs = np.nonzero(hole)
    return {
        "hole": True,
        "top": int(ys.min()),
        "bottom": int(ys.max()),
        "left": int(xs.min()),
        "right": int(xs.max()),
        "cx": round(float(xs.mean()), 1),
        "area": int(hole.sum()),
    }


def band_metrics(ink: np.ndarray) -> dict:
    hole = C.neck_hole(ink)
    if not hole.any():
        return {"band": False}
    band = C.G.collar_band_mask(hole, ink)
    ys, xs = np.nonzero(band)
    return {
        "band": True,
        "top": int(ys.min()),
        "bottom": int(ys.max()),
        "left": int(xs.min()),
        "right": int(xs.max()),
    }


for name, art in ARTS.items():
    path = SRC / art
    if not path.exists():
        print(f"{name}: missing {art}")
        continue
    rgb = np.asarray(Image.open(path).convert("RGB"))
    ink = C.ink_mask(rgb)
    h = hole_metrics(ink)
    b = band_metrics(ink)
    print(f"{name}: hole={h}")
    print(f"{'':>16}  band={b}")
