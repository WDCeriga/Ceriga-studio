"""Pack the slim V-neck line art into builder fill parts.

Closed fabric fills, construction outline on top, dashed stitching separate.
Front V rib + back band are one Neck fill. Inner back (through the V) is its
own hidden layer so the app can always lighten it from the body colour.

Source drawing: src/assets/studio-tshirt/slim-vneck-lineart-bold.png
(the parts in slim-vneck-parts/ are ink splits, not builder fills).

Usage:
  python scripts/collar/pack_studio_tshirt.py --probe
  python scripts/collar/pack_studio_tshirt.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402
import trace_svg as T  # noqa: E402

ROOT = HERE.parents[1]
SRC = ROOT / "src" / "assets" / "studio-tshirt"
ART_IN = SRC / "slim-vneck-lineart-bold.png"
KEYED = SRC / "slim-vneck-lineart-transparent.png"

# Seeds from --probe on the keyed 1024x1536 drawing.
# Neck = every collar sliver (front V + back band) as one colour.
PART_SEEDS: list[dict] = [
    # Regions 10/11 are the thin top-shoulder strips (between the outer outline
    # and the shoulder stitch). They belong to the body, not the collar.
    {"category": "Body", "asset": "Body", "seeds": [[507, 1071], [348, 172], [749, 204]]},
    {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
    {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
    {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
    {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
    {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
    {
        "category": "Neck",
        "asset": "V-neck",
        "seeds": [
            [511, 358],
            [541, 178],
            [650, 166],
            [487, 173],
            [570, 307],
        ],
    },
    {"category": "Inner back neck", "asset": "Inner back neck", "seeds": [[511, 259]]},
]

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

def key_lineart(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    boosted = ImageEnhance.Contrast(img).enhance(T.CONTRAST)
    return T.to_transparent(boosted)


def dash_mask(ink: np.ndarray, cfg: G.Settings) -> np.ndarray:
    comps, _count = ndimage.label(ink, np.ones((3, 3), bool))
    boxes = ndimage.find_objects(comps)
    dashes = np.zeros_like(ink)
    for index, box in enumerate(boxes, start=1):
        if box is None:
            continue
        height = box[0].stop - box[0].start
        width = box[1].stop - box[1].start
        if max(height, width) > cfg.dash_len:
            continue
        dashes[comps == index] = True
    return dashes


def seal_under_ink(mask: np.ndarray, ink: np.ndarray, iterations: int = 2) -> np.ndarray:
    """Grow a fill under the construction lines so colour meets the outline."""
    grown = ndimage.binary_dilation(mask, iterations=iterations)
    return mask | (grown & ink)


def wrap_fill_only(title: str, mask: np.ndarray) -> str:
    fill_d = G.trace(mask)
    if not fill_d:
        raise SystemExit(f"empty trace for {title}")
    group = '<g transform="translate(0,2048) scale(0.1,-0.1)"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{G.CANVAS}" height="{G.CANVAS}" '
        f'viewBox="0 0 {G.CANVAS} {G.CANVAS}">\n'
        f"<title>{title}</title>\n"
        f'{group} fill="#000000">\n'
        f'<path d="{fill_d}" fill-rule="evenodd"/>\n'
        "</g>\n"
        "</svg>\n"
    )


def wrap_ink(title: str, mask: np.ndarray) -> str:
    ink_d = G.trace(mask)
    if not ink_d:
        raise SystemExit(f"empty outline trace for {title}")
    group = '<g transform="translate(0,2048) scale(0.1,-0.1)"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{G.CANVAS}" height="{G.CANVAS}" '
        f'viewBox="0 0 {G.CANVAS} {G.CANVAS}">\n'
        f"<title>{title}</title>\n"
        f'{group} fill="{G.INK_COLOR}">\n'
        f'<path d="{ink_d}" fill="{G.INK_COLOR}" fill-rule="evenodd"/>\n'
        "</g>\n"
        "</svg>\n"
    )


def write_part(category: str, asset: str, svg: str) -> Path:
    folder = SRC / category
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{asset}.svg"
    target.write_text(svg, encoding="utf-8")
    print(f"  {category}/{asset}.svg  {target.stat().st_size / 1024:.0f} KB")
    return target


SLIM_V_FILES = (
    ("Body", "Body"),
    ("Left sleeve", "Left sleeve"),
    ("Right sleeve", "Right sleeve"),
    ("Body hem", "Body hem"),
    ("Left cuff", "Left cuff"),
    ("Right cuff", "Right cuff"),
    ("Neck", "V-neck"),
    ("Inner back neck", "Inner back neck"),
    ("Outline", "Outline"),
    ("Stitching", "Cover stitch"),
)


def clear_builder_dirs() -> None:
    """Remove the slim V-neck defaults only. Crew variants and other fits stay."""
    for category, asset in SLIM_V_FILES:
        target = SRC / category / f"{asset}.svg"
        if target.exists():
            target.unlink()


def pack(probe_only: bool) -> None:
    if not ART_IN.exists():
        raise SystemExit(f"missing {ART_IN}")

    SRC.mkdir(parents=True, exist_ok=True)
    print("key white (contrast 1.35, luminance ramp)...")
    keyed = key_lineart(ART_IN)
    keyed.save(KEYED)

    cfg = G.Settings()
    regions = G.analyse(KEYED, cfg)
    print(f"{len(regions.ids)} construction regions")
    for region_id in regions.ids:
        x, y = regions.anchor(region_id)
        print(f"  #{region_id:>2d}  {regions.area(region_id):>8d}px  seed ({x}, {y})")

    proof = SRC / "slim-vneck-closed-regions.png"
    G.write_proof(regions, proof)
    print(f"wrote {proof.name}")

    ink = regions.ink if regions.ink is not None else np.zeros_like(regions.labels, bool)
    stitches = G.claim_dash_tips(ink, dash_mask(ink, cfg))
    print(f"stitch dashes: {int(stitches.sum())}px")

    if probe_only:
        return
    if not PART_SEEDS:
        raise SystemExit("PART_SEEDS is empty — run --probe, set seeds, then pack")

    claimed: dict[int, str] = {}
    named: list[dict] = []
    for entry in PART_SEEDS:
        ids: list[int] = []
        name = f"{entry['category']}/{entry['asset']}"
        for x, y in entry["seeds"]:
            region_id = int(regions.labels[y, x])
            if region_id == 0:
                print(f"  !! {name}: seed ({x}, {y}) is not inside a region")
                continue
            if region_id in claimed:
                print(f"  !! {name}: region {region_id} already taken by {claimed[region_id]}")
                continue
            claimed[region_id] = name
            ids.append(region_id)
        mask = np.zeros(regions.labels.shape, bool)
        for region_id in ids:
            mask |= regions.mask(region_id)
        named.append({**entry, "ids": ids, "mask": mask, "name": name})

    masks = {part["category"]: part["mask"] for part in named}
    for label, count in G.apply_stitch_strip_moves(masks, ink, stitches).items():
        print(f"stitch-strip moved {label}: {count}px")
    for part in named:
        part["mask"] = masks[part["category"]]

    construction_ink = ink & ~stitches
    for part in named:
        part["mask"] = seal_under_ink(part["mask"], construction_ink)

    missed = [i for i in regions.ids if i not in claimed]
    if missed:
        print("  !! unclaimed regions (absorbing into border neighbours):", missed)
    masks = {part["category"]: part["mask"] for part in named}
    absorbed = G.absorb_leftovers(masks, regions.labels, regions.ids, claimed)
    for part, px in absorbed.items():
        print(f"absorbed leftover {part}: {px}px")
    for part in named:
        part["mask"] = masks[part["category"]]

    # Keep the body as a continuous underlay: conservative region tracing must
    # never expose the white canvas through a tiny seam or neckline gap.
    completed = G.complete_garment_coverage(masks, regions.interior, ink)
    if completed:
        print(f"completed unassigned fabric: {completed}px")
    for part in named:
        part["mask"] = masks[part["category"]]

    colour_proof = np.full((*regions.labels.shape, 3), 255, np.uint8)
    for part in named:
        colour_proof[part["mask"]] = PROOF_COLORS.get(part["category"], (80, 80, 80))
    colour_proof[stitches] = (180, 180, 180)
    Image.fromarray(colour_proof).save(SRC / "slim-vneck-fill-proof.png")
    print(f"wrote slim-vneck-fill-proof.png")

    clear_builder_dirs()
    for part in named:
        if not part["ids"]:
            continue
        write_part(
            part["category"],
            part["asset"],
            wrap_fill_only(f"Slim V-neck - {part['asset']}", part["mask"]),
        )

    construction = ink & ~stitches
    write_part("Outline", "Outline", wrap_ink("Slim V-neck - Outline", construction))
    if stitches.any():
        write_part(
            "Stitching",
            "Cover stitch",
            wrap_fill_only("Slim V-neck - Cover stitch", stitches),
        )
    print("done")


if __name__ == "__main__":
    pack(probe_only="--probe" in sys.argv)
