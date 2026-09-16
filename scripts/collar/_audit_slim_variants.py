"""Audit slim neck-variant seeds: map each seed to its region and list any
collar-zone region that no part claims (those become speckle holes in fills).

Read-only: only recomputes regions and prints. Never writes SVGs.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np

import garment_regions as G  # noqa: E402
from pack_studio_neck_variant import VARIANTS, key_lineart

ROOT = HERE.parents[1]
SRC = ROOT / "src" / "assets" / "studio-tshirt"
NECK_ZONE_Y = 360  # anything above the chest (y < 360 in 1024 art) near center x


def audit(variant_id: str) -> None:
    spec = VARIANTS[variant_id]
    art_in = SRC / spec["art"]
    if not art_in.exists():
        print(f"== {variant_id}: missing {spec['art']}")
        return
    keyed = key_lineart(art_in)
    tmp = SRC / f"_audit-{variant_id}.png"
    keyed.save(tmp)
    cfg = G.Settings()
    regions = G.analyse(tmp, cfg)
    tmp.unlink(missing_ok=True)
    labels = regions.labels
    claimed: dict[int, str] = {}

    print(f"\n== {variant_id}  ({len(regions.ids)} regions)")
    for entry in spec["seeds"]:
        name = f"{entry['category']}/{entry['asset']}"
        for x, y in entry["seeds"]:
            rid = int(labels[y, x])
            if rid == 0:
                print(f"   !! {name}: seed ({x},{y}) NOT inside a region")
                continue
            if rid in claimed:
                print(f"   !! {name}: seed ({x},{y}) -> region {rid} already claimed by {claimed[rid]}")
            else:
                claimed[rid] = name

    # collar zone: centre column band of ink-enclosed pockets
    unclaimed = []
    for rid in regions.ids:
        if rid in claimed:
            continue
        ax, ay = regions.anchor(rid)
        if ay < NECK_ZONE_Y and 300 < ax < 730:
            unclaimed.append((rid, regions.area(rid), (ax, ay)))
    unclaimed.sort(key=lambda row: -row[1])
    for rid, area, anchor in unclaimed:
        print(f"   UNCLAIMED collar-zone region #{rid}: {area:>6d}px at {anchor}")
    if not unclaimed:
        print("   no unclaimed collar-zone regions")


if __name__ == "__main__":
    ids = sys.argv[1:]
    for vid in (ids or [v for v in VARIANTS if v.startswith("slim-")]):
        audit(vid)
