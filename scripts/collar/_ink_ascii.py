"""ASCII of the active construction ink + region boundaries in a variant's keyed art.

Codes: # = ink (drawn line), space = white fabric, + = stitch dash, digits = region id.

Usage: python _ink_ascii.py slim-deep-vneck x0 y0 x1 y1
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[1] / "src" / "assets" / "studio-tshirt"


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    vid = sys.argv[1]
    x0, y0, x1, y1 = (int(v) for v in sys.argv[2:6])

    keyed = Image.open(SRC / f"{vid}-lineart-transparent.png").convert("RGBA")
    a = np.asarray(keyed.getchannel("A")).astype(np.int16)
    ink = a >= 128

    # region labels for reference
    from scipy import ndimage
    cfg_gaps, _ = ndimage.label(~ink)
    outside = set(cfg_gaps[0, :]) | set(cfg_gaps[-1, :]) | set(cfg_gaps[:, 0]) | set(cfg_gaps[:, -1])
    outside.discard(0)
    interior = ~np.isin(cfg_gaps, list(outside))

    step = max(1, (x1 - x0) // 100)
    print(f"{vid} ink crop=({x0},{y0})-({x1},{y1}) step={step}")
    print("     " + "".join(str((x0 + i * step) // 100 % 10) for i in range((x1 - x0) // step)))
    for y in range(y0, y1, step * 2):
        row = []
        for x in range(x0, x1, step):
            blkI = ink[y : y + step * 2, x : x + step]
            frac = blkI.mean()
            if frac > 0.5:
                row.append("#")
            elif frac > 0.15:
                row.append("+")
            else:
                blkW = interior[y : y + step * 2, x : x + step]
                row.append(" " if blkW.mean() > 0.5 else "o")
        print(f"{y:4d} " + "".join(row))


if __name__ == "__main__":
    main()
