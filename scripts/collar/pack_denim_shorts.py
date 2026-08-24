"""Pack the denim-shorts line-art SVG into builder parts + Procreate PNGs.

Follows scripts/collar/MOCKUP_PROCESS.md:
  rasterize the existing vector (never author path data),
  split the raster by construction, colour-proof, then Potrace each part
  onto the same 2048 viewBox the builder tints.

Usage:
  python scripts/collar/pack_denim_shorts.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / "src" / "assets" / "studio-jorts"
SVG = OUT / "denim-shorts-lineart.svg"

TOKEN = re.compile(r"([MLCZ])([^MLCZ]*)")
PALETTE_HEX = [
    "#2B3A4A",
    "#4A5D73",
    "#1F2A36",
    "#35485C",
    "#C4A574",
    "#6B7C8F",
    "#243140",
    "#8A6A4B",
    "#3D4F63",
    "#5C4A3A",
    "#2E3C4C",
    "#7A8B9C",
]


def parse_subpaths(d: str) -> list[list[tuple[float, float]]]:
    subpaths: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    cursor = (0.0, 0.0)

    for cmd, raw in TOKEN.findall(d):
        nums = [float(v) for v in raw.replace(",", " ").split()]
        if cmd == "M":
            if len(current) > 2:
                subpaths.append(current)
            cursor = (nums[0], nums[1])
            current = [cursor]
        elif cmd == "L":
            for i in range(0, len(nums), 2):
                cursor = (nums[i], nums[i + 1])
                current.append(cursor)
        elif cmd == "C":
            for i in range(0, len(nums), 6):
                c1 = (nums[i], nums[i + 1])
                c2 = (nums[i + 2], nums[i + 3])
                end = (nums[i + 4], nums[i + 5])
                current.extend(_flatten_cubic(cursor, c1, c2, end))
                cursor = end
        elif cmd == "Z":
            if len(current) > 2:
                subpaths.append(current)
            current = []

    if len(current) > 2:
        subpaths.append(current)
    return subpaths


def _flatten_cubic(p0, p1, p2, p3):
    span = (
        abs(p1[0] - p0[0]) + abs(p1[1] - p0[1])
        + abs(p2[0] - p1[0]) + abs(p2[1] - p1[1])
        + abs(p3[0] - p2[0]) + abs(p3[1] - p2[1])
    )
    steps = max(3, min(48, int(span / 1.5) + 3))
    pts = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        pts.append((
            u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1],
        ))
    return pts


def rasterize_svg(src: Path, width: int, ss: int) -> Image.Image:
    svg = src.read_text(encoding="utf-8")
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    if not vb:
        raise SystemExit(f"no viewBox in {src}")
    vw, vh = int(vb.group(1)), int(vb.group(2))
    subpaths = []
    for d in re.findall(r'<path d="([^"]+)"', svg):
        subpaths.extend(parse_subpaths(d))

    height = round(width * vh / vw)
    gw, gh = width * ss, height * ss
    scale = gw / vw
    acc = np.zeros((gh, gw), dtype=bool)

    for poly in subpaths:
        xs = [p[0] * scale for p in poly]
        ys = [p[1] * scale for p in poly]
        x0, x1 = int(np.floor(min(xs))), int(np.ceil(max(xs))) + 1
        y0, y1 = int(np.floor(min(ys))), int(np.ceil(max(ys))) + 1
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(gw, x1), min(gh, y1)
        if x1 <= x0 or y1 <= y0:
            continue
        tile = Image.new("1", (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(tile).polygon(
            [(x - x0, y - y0) for x, y in zip(xs, ys)], fill=1
        )
        acc[y0:y1, x0:x1] ^= np.asarray(tile, dtype=bool)

    cov = acc.reshape(height, ss, width, ss).mean(axis=(1, 3))
    alpha = Image.fromarray((cov * 255).round().astype(np.uint8), mode="L")
    out = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    out.putalpha(alpha)
    return out


def composite_on_white(img: Image.Image) -> Image.Image:
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    return Image.alpha_composite(bg, img).convert("RGB")


# Seeds are deepest-in-region points from garment_regions on this drawing.
# Left/right = left/right of the front-on flat (as you look at it).
PART_SEEDS = [
    {"name": "Right outer leg", "seeds": [[787, 731]]},
    {"name": "Left outer leg", "seeds": [[232, 731]]},
    {"name": "Right inner leg", "seeds": [[600, 784]]},
    {"name": "Left inner leg", "seeds": [[403, 793]]},
    {"name": "Right hip panel", "seeds": [[718, 202]]},
    {"name": "Left hip panel", "seeds": [[303, 200]]},
    {"name": "Right cargo pocket", "seeds": [[875, 520]]},
    {"name": "Left cargo pocket", "seeds": [[144, 522]]},
    {"name": "Fly / centre front", "seeds": [[512, 199]]},
    {"name": "Right front pocket", "seeds": [[754, 376]]},
    {"name": "Left front pocket", "seeds": [[266, 376]]},
    {"name": "Centre waistband", "seeds": [[528, 141]]},
    {"name": "Right waistband", "seeds": [[661, 130]]},
    {"name": "Left waistband", "seeds": [[344, 129]]},
    {"name": "Right outer hem", "seeds": [[714, 869]]},
    {"name": "Left outer hem", "seeds": [[286, 866]]},
    {"name": "Right inner hem", "seeds": [[648, 876]]},
    {"name": "Waistband lining", "seeds": [[444, 140]]},
    {"name": "Left inner hem", "seeds": [[370, 877]]},
    {"name": "Right belt loop", "seeds": [[617, 171]]},
    {"name": "Left belt loop", "seeds": [[398, 171]]},
]


def resolve_named_parts(regions: G.Regions) -> list[dict]:
    claimed: dict[int, str] = {}
    parts: list[dict] = []
    for entry in PART_SEEDS:
        ids: list[int] = []
        for x, y in entry["seeds"]:
            region_id = int(regions.labels[y, x])
            if region_id == 0:
                print(f"  !! {entry['name']}: seed ({x}, {y}) is not inside a region")
                continue
            if region_id in claimed:
                print(f"  !! {entry['name']}: region {region_id} already taken by {claimed[region_id]}")
                continue
            claimed[region_id] = entry["name"]
            ids.append(region_id)
        mask = np.zeros(regions.labels.shape, bool)
        for region_id in ids:
            mask |= regions.mask(region_id)
        parts.append({**entry, "ids": ids, "mask": mask})

    missed = [i for i in regions.ids if i not in claimed]
    if missed:
        print("  !! regions with no part:", missed)
        for region_id in missed:
            print(f"     region {region_id}: {regions.area(region_id)}px "
                  f"at {regions.anchor(region_id)}")
    return parts


def wrap_fill(title: str, mask: np.ndarray) -> str:
    return G.wrap_svg(title, G.trace(mask), "")


def wrap_ink(title: str, mask: np.ndarray) -> str:
    return G.wrap_svg(title, "", G.trace(mask))


def pack(skip_raster: bool = False) -> None:
    if not SVG.exists():
        raise SystemExit(f"missing {SVG}")

    OUT.mkdir(parents=True, exist_ok=True)
    subpaths = len(re.findall(r"M[0-9]", SVG.read_text(encoding="utf-8")))
    print(f"source SVG: {SVG}  (~{subpaths} subpaths)")
    if subpaths < 40:
        raise SystemExit("SVG polarity looks wrong (too few subpaths)")

    keyed = OUT / "denim-shorts-lineart-transparent.png"
    if skip_raster and keyed.exists():
        print("skipping raster (using existing PNGs)")
    else:
        print("raster 1024 (line art)...")
        art_1024 = rasterize_svg(SVG, 1024, ss=4)
        composite_on_white(art_1024).save(OUT / "denim-shorts-lineart-bold.png")
        art_1024.save(keyed)
        print("  denim-shorts-lineart-bold.png")

        print("raster 2048...")
        rasterize_svg(SVG, 2048, ss=4).save(OUT / "denim-shorts-vector-2048.png")
        print("  denim-shorts-vector-2048.png")

        print("raster 4096...")
        rasterize_svg(SVG, 4096, ss=2).save(OUT / "denim-shorts-vector-4096.png")
        print("  denim-shorts-vector-4096.png")

    keyed = OUT / "denim-shorts-lineart-transparent.png"
    regions = G.analyse(keyed, G.Settings())
    print(f"{len(regions.ids)} construction regions")
    for region_id in regions.ids:
        x, y = regions.anchor(region_id)
        print(f"  #{region_id:>2d}  {regions.area(region_id):>8d}px  seed ({x}, {y})")

    proof = OUT / "denim-shorts-regions.png"
    G.write_proof(regions, proof)
    print(f"wrote {proof.name}")

    named = resolve_named_parts(regions)
    parts = []
    for index, part in enumerate(named):
        if not part["ids"]:
            continue
        name = part["name"]
        parts.append({
            "id": f"part-{index + 1}",
            "name": name,
            "svg": wrap_fill(f"Denim shorts - {name}", part["mask"]),
            "color": PALETTE_HEX[index % len(PALETTE_HEX)],
            "area": int(part["mask"].sum()),
        })
        print(f"  traced {name}")

    ink = regions.ink if regions.ink is not None else np.zeros_like(regions.labels, bool)
    result = {
        "type": "result",
        "ok": True,
        "source": "denim-shorts-lineart",
        "parts": parts,
        "lineArtSvg": wrap_ink("Denim shorts - construction ink", ink),
        "partCount": len(parts),
        "process": {
            "rasterFirst": True,
            "whiteKey": "luminance-ramp",
            "traceSupersampling": G.TRACE_SS,
            "bitmapInverted": True,
            "fillRule": "evenodd",
            "viewBox": "0 0 2048 2048",
            "turdsize": 4,
        },
    }
    target = OUT / "mockup.json"
    target.write_text(json.dumps(result), encoding="utf-8")
    print(f"wrote {target}  ({target.stat().st_size / 1024:.0f} KB, {len(parts)} parts)")


if __name__ == "__main__":
    pack(skip_raster="--skip-raster" in sys.argv)
