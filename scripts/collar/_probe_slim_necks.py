"""Probe slim neck pack assignments."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402
from pack_studio_neck_variant import VARIANTS, dash_mask, key_lineart  # noqa: E402


def simulate(vid: str) -> None:
    spec = VARIANTS[vid]
    src = Path("src/assets/studio-tshirt")
    art = src / spec["art"]
    keyed_path = src / spec["keyed"]
    keyed = key_lineart(art)
    keyed.save(keyed_path)
    cfg = G.Settings()
    regions = G.analyse(keyed_path, cfg)
    ink = regions.ink if regions.ink is not None else np.zeros_like(regions.labels, bool)
    stitches = G.claim_dash_tips(ink, dash_mask(ink, cfg))
    claimed: dict[int, str] = {}
    named: list[dict] = []
    for entry in spec["seeds"]:
        ids: list[int] = []
        name = f"{entry['category']}/{entry['asset']}"
        for x, y in entry["seeds"]:
            rid = int(regions.labels[y, x])
            if rid == 0:
                print(f"  !! {name}: ({x},{y}) empty")
                continue
            if rid in claimed:
                print(f"  !! {name}: region {rid} taken by {claimed[rid]}")
                continue
            claimed[rid] = name
            ids.append(rid)
            x0, y0 = regions.anchor(rid)
            print(f"  {name}: region #{rid} {regions.area(rid)}px at ({x0},{y0})")
        mask = np.zeros(regions.labels.shape, bool)
        for rid in ids:
            mask |= regions.mask(rid)
        named.append({**entry, "ids": ids, "mask": mask, "name": name})

    masks = {part["category"]: part["mask"] for part in named}
    for label, count in G.apply_stitch_strip_moves(masks, ink, stitches).items():
        print(f"  stitch-strip {label}: {count}px")
    print(f"  nape ribs: {G.apply_nape_rib_move(masks)}px")
    G.clip_fills_inside_ink(masks, ink, stitches)
    missed = [i for i in regions.ids if i not in claimed]
    if missed:
        print("  missed:", [(i, regions.anchor(i), regions.area(i)) for i in missed])
    if "Neck" in masks and "Inner back neck" in masks:
        inner = ndimage.binary_fill_holes(masks["Inner back neck"])
        dist = ndimage.distance_transform_edt(~inner)
        neck_far = masks["Neck"] & (dist > 22)
        top_shoulder = neck_far & (np.arange(inner.shape[0])[:, None] < 220)
        print(f"  neck >22px from inner: {int(neck_far.sum())}px, top shoulder: {int(top_shoulder.sum())}px")


if __name__ == "__main__":
    for variant_id in sys.argv[1:] or ["slim-crew", "slim-deep-vneck", "slim-polo", "slim-scoop"]:
        print(f"=== {variant_id} ===")
        simulate(variant_id)
        print()
