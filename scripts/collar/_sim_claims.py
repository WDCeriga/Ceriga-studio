"""Simulate the part-claim step of pack_studio_neck_variant.py for one variant.

Recomputes regions from the composite line art, claims regions with the
variant's seeds in a chosen order, then absorbs leftovers. Prints the final
part composition per region so seed lists and claim order can be tuned before
an actual pack. Read-only.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402
from pack_studio_neck_variant import VARIANTS, key_lineart, dash_mask  # noqa: E402

ROOT = HERE.parents[1]
SRC = ROOT / "src" / "assets" / "studio-tshirt"


def sim(variant_id: str, order: list[str] | None = None) -> None:
    spec = VARIANTS[variant_id]
    keyed = key_lineart(SRC / spec["art"])
    tmp = SRC / f"_sim-{variant_id}.png"
    keyed.save(tmp)
    cfg = G.Settings()
    regions = G.analyse(tmp, cfg)
    tmp.unlink(missing_ok=True)
    ink = regions.ink if regions.ink is not None else np.zeros_like(regions.labels, bool)
    stitches = G.claim_dash_tips(ink, dash_mask(ink, cfg))

    order = order or [
        "Inner back neck", "Neck", "Body hem", "Left cuff", "Right cuff",
        "Left sleeve", "Right sleeve", "Body",
    ]

    claimed: dict[int, str] = {}
    parts = {part: None for part in ["Body", "Neck", "Inner back neck", "Body hem",
                                     "Left cuff", "Right cuff", "Left sleeve", "Right sleeve"]}
    note = {rid: "" for rid in regions.ids}

    def seed_to(entry_seeds, part):
        hits = []
        for x, y in entry_seeds:
            rid = int(regions.labels[y, x])
            if rid == 0:
                note.setdefault(0, "")
                print(f"   !! {part} seed ({x},{y}) not inside a region")
                continue
            if rid in claimed:
                note[rid] = f"SEED-{part}-conflict-with-{claimed[rid]}"
                print(f"   !! {part} seed ({x},{y}) -> region {rid} claimed by {claimed[rid]}")
                continue
            claimed[rid] = part
            hits.append(rid)
        return hits

    for part in order:
        for entry in spec["seeds"]:
            if entry["category"] != part:
                continue
            seed_to(entry["seeds"], part)

    masks = {}
    for part in parts:
        mask = np.zeros(regions.labels.shape, bool)
        for rid, owner in claimed.items():
            if owner == part:
                mask |= regions.mask(rid)
        masks[part] = mask

    absorbed = G.absorb_leftovers(
        masks, regions.labels, regions.ids, claimed, avoid={"Inner back neck"},
    )
    for part in ["Neck", "Inner back neck"]:
        if masks[part].any():
            masks[part] = masks[part] & ~stitches

    print(f"\n== {variant_id} — {len(regions.ids)} regions")
    leftover = [rid for rid in regions.ids if rid not in claimed]
    if leftover:
        for rid in leftover:
            cell = regions.mask(rid)
            owners = [p for p, m in masks.items() if m is not None and m.any() and (m & cell).any()]
            print(f"   leftover region {rid}: {regions.area(rid):>6d}px at {regions.anchor(rid)} -> {'+'.join(owners) if owners else 'UNASSIGNED'}")
    print("   absorbed px by part:", {k: v for k, v in absorbed.items() if v})
    for part in ["Neck", "Inner back neck", "Body"]:
        area = int(masks[part].sum()) if masks[part] is not None else 0
        print(f"   {part}: {area}px")
    print("   no-owner px:", int((regions.labels > 0) & ~(masks['Neck'] | masks['Inner back neck'] | masks['Body'] | masks['Body hem'] | masks['Left cuff'] | masks['Right cuff'] | masks['Left sleeve'] | masks['Right sleeve'])).sum())


if __name__ == "__main__":
    for vid in (sys.argv[1:] or ["slim-crew"]):
        sim(vid)
