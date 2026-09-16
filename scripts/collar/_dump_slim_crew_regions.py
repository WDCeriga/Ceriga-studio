"""ASCII ink maps of the slim-crew problem regions across base / donor / composite."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import composite_neck_variant as C  # noqa: E402

SRC = HERE.parents[1] / "src" / "assets" / "studio-tshirt"

base = np.asarray(Image.open(SRC / "slim-vneck-lineart-bold.png").convert("RGB"))
donor = np.asarray(Image.open(SRC / "slim-crew-lineart-bold.png").convert("RGB"))
out = np.asarray(Image.open(SRC / "slim-crew-composite-bold.png").convert("RGB"))

base_ink = C.ink_mask(base)
donor_ink = C.ink_mask(donor)
out_ink = C.ink_mask(out)
aligned = C.fit_donor(base_ink, donor)
aligned_ink = C.ink_mask(aligned)

REGIONS = [
    ("nape-top y130-215 x360-660", 130, 215, 360, 660),
    ("below-band y300-390 x440-590", 300, 390, 440, 590),
]

for title, y0, y1, x0, x1 in REGIONS:
    print(f"=== {title} ===")
    step = 4
    print("     " + "".join(str((x0 + i * step) // 100 % 10) for i in range((x1 - x0) // step)))
    print("     " + "".join(str((x0 + i * step) // 10 % 10) for i in range((x1 - x0) // step)))
    for y in range(y0, y1, step):
        row_b = "".join("#" if base_ink[y, x] else "." for x in range(x0, x1, step))
        row_d = "".join("#" if aligned_ink[y, x] else "." for x in range(x0, x1, step))
        row_o = "".join("#" if out_ink[y, x] else "." for x in range(x0, x1, step))
        print(f"{y:4d}  {row_b}   {row_d}   {row_o}")
    print("      BASE      DONOR(aligned)  COMPOSITE")
    print()
