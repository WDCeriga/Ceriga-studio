"""ASCII dump of the region-label grid in a slim variant's neck zone.

Chars: '#' = ink, '.' = outside/unlabelled, digit/letter = region id, with ids
mapped 1-9 -> 1-9, 10+ -> a,b,c...
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402
from pack_studio_neck_variant import VARIANTS, key_lineart  # noqa: E402

SRC = HERE.parents[1] / "src" / "assets" / "studio-tshirt"

CHARS = "123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def dump(variant_id: str, x0: int, x1: int, y0: int, y1: int, step: int = 4) -> None:
    if variant_id in VARIANTS:
        art = SRC / VARIANTS[variant_id]["art"]
    else:
        art = SRC / f"{variant_id}-lineart-bold.png"
    keyed = key_lineart(art)
    tmp = SRC / f"_lab-{variant_id}.png"
    keyed.save(tmp)
    cfg = G.Settings()
    regions = G.analyse(tmp, cfg)
    tmp.unlink(missing_ok=True)
    labels = regions.labels
    ink = regions.ink if regions.ink is not None else labels == 0
    print(f"\n== {variant_id} labels crop x[{x0}:{x1}] y[{y0}:{y1}] step {step}")
    for y in range(y0, y1, step):
        row = []
        for x in range(x0, x1, step):
            if ink[y, x]:
                row.append("#")
            else:
                rid = int(labels[y, x])
                row.append(CHARS[rid - 1] if rid > 0 else ".")
        print("".join(row))


if __name__ == "__main__":
    vid = sys.argv[1] if len(sys.argv) > 1 else "slim-crew"
    args = [int(a) for a in sys.argv[2:6]]
    x0, x1, y0, y1 = args or (220, 820, 60, 460)
    dump(vid, x0, x1, y0, y1)
