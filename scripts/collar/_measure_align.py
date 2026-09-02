"""Measure donor vs base alignment for slim neck composites."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import composite_neck_variant as C  # noqa: E402

SRC = Path("src/assets/studio-tshirt")

PAIRS = [
    ("slim-crew", "slim-vneck-lineart-bold.png", "slim-crew-lineart-bold.png"),
    ("slim-deep-vneck", "slim-vneck-lineart-bold.png", "slim-deep-vneck-lineart-bold.png"),
    ("slim-polo", "slim-vneck-lineart-bold.png", "slim-polo-lineart-bold.png"),
    ("slim-scoop", "slim-vneck-lineart-bold.png", "slim-scoop-lineart-bold.png"),
]


def shoulder_y(ink: np.ndarray) -> float:
    edge = C.outer_silhouette(ink)
    h, w = ink.shape
    ys_grid, _ = C._grid(ink.shape)
    top = int(np.nonzero(edge)[0].min()) if edge.any() else 0
    band = edge & (ys_grid <= top + 8)
    ey, _ = np.nonzero(band)
    return float(ey.mean()) if ey.size else float(top)


for name, base_name, donor_name in PAIRS:
    base = np.asarray(Image.open(SRC / base_name).convert("RGB"))
    donor = np.asarray(Image.open(SRC / donor_name).convert("RGB"))
    base_ink = C.ink_mask(base)
    donor_ink = C.ink_mask(donor)
    bx, by = C.nape_top(base_ink)
    dx, dy = C.nape_top(donor_ink)
    bs = shoulder_y(base_ink)
    ds = shoulder_y(donor_ink)
    print(
        f"{name}: nape base ({bx:.0f},{by:.0f}) donor ({dx:.0f},{dy:.0f}) "
        f"shift ({round(bx-dx)},{round(by-dy)}) shoulder base {bs:.0f} donor {ds:.0f} "
        f"shoulder-dy {round(bs-ds)}"
    )
