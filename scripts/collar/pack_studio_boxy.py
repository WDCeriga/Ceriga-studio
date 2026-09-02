"""Pack the boxy ringer t-shirt line art into builder fill parts.

Same construction as the slim V-neck pack: closed fabric fills, black
construction (including collar rib ticks) on top, dashed cover-stitch
separate. Front crew + back band are one Neck colour. Inner back (through
the hole) is a lighter body colour.

Does not wipe the slim V-neck assets — writes `(boxy)` named files alongside.

Usage:
    python scripts/collar/pack_studio_boxy.py --probe
    python scripts/collar/pack_studio_boxy.py
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
ART_IN = SRC / "boxy-tshirt-lineart-bold.png"
KEYED = SRC / "boxy-tshirt-lineart-transparent.png"

# Seeds from --probe on the keyed 1024x1536 ringer drawing.
# Neck = every collar sliver (front rib + back band) as one colour.
PART_SEEDS: list[dict] = [
    {"category": "Body", "asset": "Body (boxy)", "seeds": [[510, 726], [261, 277], [700, 250]]},
    {"category": "Left sleeve", "asset": "Left sleeve (boxy)", "seeds": [[128, 556]]},
    {"category": "Right sleeve", "asset": "Right sleeve (boxy)", "seeds": [[894, 556]]},
    {"category": "Body hem", "asset": "Body hem (boxy)", "seeds": [[227, 1302]]},
    {
        "category": "Left cuff",
        "asset": "Left cuff (boxy)",
        "seeds": [[44, 631], [116, 674], [175, 703]],
    },
    {
        "category": "Right cuff",
        "asset": "Right cuff (boxy)",
        "seeds": [[872, 695], [927, 656], [986, 627]],
    },
    {
        "category": "Neck",
        "asset": "Crew neck (boxy)",
        "seeds": [
            [520, 370],
            [380, 236],
            [489, 245],
            [533, 245],
            [584, 240],
            [634, 230],
            [621, 307],
            [571, 352],
            [461, 355],
        ],
    },
    {"category": "Inner back neck", "asset": "Inner back neck (boxy)", "seeds": [[507, 306]]},
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

BOXY_FILES = (
    ("Body", "Body (boxy)"),
    ("Left sleeve", "Left sleeve (boxy)"),
    ("Right sleeve", "Right sleeve (boxy)"),
    ("Body hem", "Body hem (boxy)"),
    ("Left cuff", "Left cuff (boxy)"),
    ("Right cuff", "Right cuff (boxy)"),
    ("Neck", "Crew neck (boxy)"),
    ("Inner back neck", "Inner back neck (boxy)"),
    ("Outline", "Outline (boxy)"),
    ("Stitching", "Cover stitch (boxy)"),
)


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
    grown = ndimage.binary_dilation(mask, iterations=iterations)
    return mask | (grown & ink)


def wrap_source_svg(title: str, mask: np.ndarray) -> str:
    """Potrace in source-pixel space (MOCKUP_PROCESS deliverable SVG)."""
    import potrace

    height, width = mask.shape
    img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    big = np.asarray(
        img.resize((width * G.TRACE_SS, height * G.TRACE_SS), Image.LANCZOS)
    ) >= 128
    if not big.any():
        raise SystemExit("empty mask for source SVG")
    bitmap = potrace.Bitmap(big)
    bitmap.invert()
    path = bitmap.trace(
        turdsize=4,
        turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=1.0,
        opticurve=True,
        opttolerance=0.2,
    )

    def point(p) -> str:
        return f"{p.x / G.TRACE_SS:.2f} {p.y / G.TRACE_SS:.2f}"

    out = []
    for curve in path:
        d = [f"M{point(curve.start_point)}"]
        for segment in curve:
            if segment.is_corner:
                d.append(f"L{point(segment.c)}")
                d.append(f"L{point(segment.end_point)}")
            else:
                d.append(
                    f"C{point(segment.c1)} {point(segment.c2)} {point(segment.end_point)}"
                )
        d.append("Z")
        out.append("".join(d))
    d_attr = " ".join(out)
    if d_attr.count("M") < 40:
        print(f"  !! source SVG only {d_attr.count('M')} subpaths — check polarity")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n'
        f"<title>{title}</title>\n"
        f'<path d="{d_attr}" fill="#000000" fill-rule="evenodd"/>\n'
        "</svg>\n"
    )


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
    ink_d = G.trace(mask, resample=Image.LANCZOS)
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


def remove_previous_boxy() -> None:
    for category, asset in BOXY_FILES:
        target = SRC / category / f"{asset}.svg"
        if target.exists():
            target.unlink()
            print(f"  removed {target.relative_to(SRC)}")


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

    proof = SRC / "boxy-tshirt-closed-regions.png"
    G.write_proof(regions, proof)
    print(f"wrote {proof.name}")

    ink = regions.ink if regions.ink is not None else np.zeros_like(regions.labels, bool)
    stitches = G.claim_dash_tips(ink, dash_mask(ink, cfg))
    print(f"stitch dashes: {int(stitches.sum())}px")

    source_svg = SRC / "boxy-tshirt-lineart.svg"
    source_svg.write_text(wrap_source_svg("Ceriga boxy ringer t-shirt line art", ink), encoding="utf-8")
    print(f"wrote {source_svg.name}  ({source_svg.stat().st_size / 1024:.0f} KB)")

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
    print(f"nape ribs Inner->Neck: {G.apply_nape_rib_move(masks)}px")
    G.clip_fills_inside_ink(masks, ink, stitches)
    for part in named:
        part["mask"] = masks[part["category"]]

    missed = [i for i in regions.ids if i not in claimed]
    if missed:
        print("  !! regions with no part:", missed)
        for region_id in missed:
            print(
                f"     region {region_id}: {regions.area(region_id)}px "
                f"at {regions.anchor(region_id)}"
            )

    colour_proof = np.full((*regions.labels.shape, 3), 255, np.uint8)
    for part in named:
        colour_proof[part["mask"]] = PROOF_COLORS.get(part["category"], (80, 80, 80))
    colour_proof[stitches] = (180, 180, 180)
    Image.fromarray(colour_proof).save(SRC / "boxy-tshirt-fill-proof.png")
    print("wrote boxy-tshirt-fill-proof.png")

    remove_previous_boxy()
    for part in named:
        if not part["ids"]:
            continue
        write_part(
            part["category"],
            part["asset"],
            wrap_fill_only(f"Boxy ringer t-shirt - {part['asset']}", part["mask"]),
        )

    construction = ink & ~stitches
    write_part("Outline", "Outline (boxy)", wrap_ink("Boxy ringer t-shirt - Outline", construction))
    if stitches.any():
        write_part(
            "Stitching",
            "Cover stitch (boxy)",
            wrap_fill_only("Boxy ringer t-shirt - Cover stitch", stitches),
        )

    from pack_denim_shorts import rasterize_svg

    print("raster 2048 / 4096...")
    rasterize_svg(source_svg, 2048, ss=4).save(SRC / "boxy-tshirt-vector-2048.png")
    rasterize_svg(source_svg, 4096, ss=2).save(SRC / "boxy-tshirt-vector-4096.png")
    print("done")


if __name__ == "__main__":
    pack(probe_only="--probe" in sys.argv)
