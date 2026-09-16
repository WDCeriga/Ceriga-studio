"""Coarse per-part ASCII view of a variant's fill proof.

Class codes:
  H = Inner back neck (the hole behind the opening)
  B = Neck (the collar band)
  . = Body
  f = sleeve / hem / cuff
  o = outside the garment
  ? = unassigned

Usage: python _proof_ascii.py slim-crew [crop_x0 crop_y0 crop_x1 crop_y1]
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[1] / "src" / "assets" / "studio-tshirt"

PROOF = {
    "Inner back neck": "H",
    "Neck": "B",
    "Body": ".",
    "Left sleeve": "f",
    "Right sleeve": "f",
    "Body hem": "f",
    "Left cuff": "f",
    "Right cuff": "f",
}
# part name -> exact proof colour used by the packers
PROOF_COLORS = {
    "Body": (20, 20, 20),
    "Left sleeve": (30, 90, 220),
    "Right sleeve": (0, 150, 90),
    "Body hem": (0, 200, 220),
    "Left cuff": (240, 140, 0),
    "Right cuff": (150, 60, 200),
    "Neck": (214, 40, 40),
    "Inner back neck": (180, 180, 200),
    "Stitching": (255, 255, 255),
}
# code -> rgb tuple
CODE_RGB: dict[str, tuple[int, int, int]] = {}
for part_name, code in PROOF.items():
    CODE_RGB[code] = PROOF_COLORS[part_name]
WHITE = (255, 255, 255)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    vid = sys.argv[1]
    img = np.asarray(Image.open(SRC / f"{vid}-fill-proof.png").convert("RGB"))

    h, w = img.shape[:2]
    ys = np.arange(h)[:, None]
    xs = np.arange(w)[None, :]

    classes = np.full((h, w), "?", dtype="<U1")
    classes[np.all(img == WHITE, axis=-1)] = "o"
    for code, rgb_tuple in CODE_RGB.items():
        rgb = np.array(rgb_tuple, np.int16)
        classes[np.all(np.abs(img.astype(np.int16) - rgb) <= 2, axis=-1)] = code
    classes[np.all(np.abs(img.astype(np.int16) - np.array((180, 180, 180), np.int16)) <= 2, axis=-1)] = "s"

    if len(sys.argv) >= 6:
        x0, y0, x1, y1 = (int(v) for v in sys.argv[2:6])
    else:
        x0, y0, x1, y1 = 0, 0, w, h

    step = max(1, (x1 - x0) // 110)
    print(f"{vid}  crop=({x0},{y0})-({x1},{y1})  col_step={step}")
    header = "     " + "".join(str((x0 + i * step) // 100 % 10) for i in range((x1 - x0) // step))
    print(header)
    for y in range(y0, y1, step * 2):
        row = []
        for x in range(x0, x1, step):
            block = classes[y : y + step * 2, x : x + step]
            vals, counts = np.unique(block, return_counts=True)
            order = np.argsort(-counts)
            # prefer a part class over stray singles in the block
            code = "?"
            for v in vals[order]:
                if v in "HBfs.":
                    code = str(v)
                    break
            row.append(code)
        print(f"{y:4d} " + "".join(row))


if __name__ == "__main__":
    main()
