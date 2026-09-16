"""Replace the collar on a fit's original line art.

Erases the base's collar assembly (opening, band, collar ink, nearby cover
stitch), then pastes ONLY the aligned donor's collar assembly. Shoulders,
sleeves, seams, hem and silhouette stay byte-identical base pixels, so every
neckline of a fit is one continuous garment — the packed Body/sleeve/hem parts
line up across necklines to the pixel.

Usage:
  python scripts/collar/composite_neck_variant.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402

ROOT = HERE.parents[1]
SRC = ROOT / "src" / "assets" / "studio-tshirt"
DIAG = SRC / "_diag"

JOBS = [
    {
        "id": "slim-crew",
        "base": "slim-vneck-lineart-bold.png",
        "donor": "slim-crew-lineart-bold.png",
        "out": "slim-crew-composite-bold.png",
    },
    {
        "id": "boxy-vneck",
        "base": "boxy-tshirt-lineart-bold.png",
        "donor": "boxy-vneck-lineart-bold.png",
        "out": "boxy-vneck-composite-bold.png",
    },
    {
        "id": "regular-vneck",
        "base": "regular-tshirt-lineart-bold.png",
        "donor": "regular-vneck-lineart-bold.png",
        "out": "regular-vneck-composite-bold.png",
    },
    {
        "id": "oversized-vneck",
        "base": "oversized-tshirt-lineart-bold.png",
        "donor": "oversized-vneck-lineart-bold.png",
        "out": "oversized-vneck-composite-bold.png",
    },
    {
        "id": "slim-scoop",
        "base": "slim-vneck-lineart-bold.png",
        "donor": "slim-scoop-lineart-bold.png",
        "out": "slim-scoop-composite-bold.png",
        "extra_shift": (5, 14),
    },
    {
        "id": "regular-scoop",
        "base": "regular-tshirt-lineart-bold.png",
        "donor": "regular-scoop-lineart-bold.png",
        "out": "regular-scoop-composite-bold.png",
    },
    {
        "id": "boxy-scoop",
        "base": "boxy-tshirt-lineart-bold.png",
        "donor": "boxy-scoop-lineart-bold.png",
        "out": "boxy-scoop-composite-bold.png",
    },
    {
        "id": "oversized-scoop",
        "base": "oversized-tshirt-lineart-bold.png",
        "donor": "oversized-scoop-lineart-bold.png",
        "out": "oversized-scoop-composite-bold.png",
    },
    {
        "id": "slim-deep-vneck",
        "base": "slim-vneck-lineart-bold.png",
        "donor": "slim-deep-vneck-lineart-bold.png",
        "out": "slim-deep-vneck-composite-bold.png",
    },
    {
        "id": "regular-deep-vneck",
        "base": "regular-tshirt-lineart-bold.png",
        "donor": "regular-deep-vneck-lineart-bold.png",
        "out": "regular-deep-vneck-composite-bold.png",
    },
    {
        "id": "boxy-deep-vneck",
        "base": "boxy-tshirt-lineart-bold.png",
        "donor": "boxy-deep-vneck-lineart-bold.png",
        "out": "boxy-deep-vneck-composite-bold.png",
    },
    {
        "id": "oversized-deep-vneck",
        "base": "oversized-tshirt-lineart-bold.png",
        "donor": "oversized-deep-vneck-lineart-bold.png",
        "out": "oversized-deep-vneck-composite-bold.png",
    },
    {
        "id": "slim-polo",
        "base": "slim-vneck-lineart-bold.png",
        "donor": "slim-polo-lineart-bold.png",
        "out": "slim-polo-composite-bold.png",
        "extra_shift": (0, -38),
        "seal_placket": True,
    },
    {
        "id": "regular-polo",
        "base": "regular-tshirt-lineart-bold.png",
        "donor": "regular-polo-lineart-bold.png",
        "out": "regular-polo-composite-bold.png",
    },
    {
        "id": "boxy-polo",
        "base": "boxy-tshirt-lineart-bold.png",
        "donor": "boxy-polo-lineart-bold.png",
        "out": "boxy-polo-composite-bold.png",
    },
    {
        "id": "oversized-polo",
        "base": "oversized-tshirt-lineart-bold.png",
        "donor": "oversized-polo-lineart-bold.png",
        "out": "oversized-polo-composite-bold.png",
    },
    {
        "id": "slim-thin-crew",
        "base": "slim-vneck-lineart-bold.png",
        "donor": "slim-thin-crew-lineart-bold.png",
        "out": "slim-thin-crew-composite-bold.png",
    },
    {
        "id": "regular-thin-crew",
        "base": "regular-tshirt-lineart-bold.png",
        "donor": "regular-thin-crew-lineart-bold.png",
        "out": "regular-thin-crew-composite-bold.png",
    },
    {
        "id": "boxy-thin-crew",
        "base": "boxy-tshirt-lineart-bold.png",
        "donor": "boxy-thin-crew-lineart-bold.png",
        "out": "boxy-thin-crew-composite-bold.png",
    },
    {
        "id": "oversized-thin-crew",
        "base": "oversized-tshirt-lineart-bold.png",
        "donor": "oversized-thin-crew-lineart-bold.png",
        "out": "oversized-thin-crew-composite-bold.png",
    },
]


def ink_mask(rgb: np.ndarray) -> np.ndarray:
    return rgb.min(axis=2) < 200


def _grid(shape: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    height, width = shape
    return np.arange(height)[:, None], np.arange(width)[None, :]


def outer_silhouette(ink: np.ndarray) -> np.ndarray:
    enclosed = G.enclosed_by(ink)
    if not enclosed.any():
        return np.zeros_like(ink)
    return enclosed & ~ndimage.binary_erosion(enclosed, iterations=2)


def nape_top(ink: np.ndarray) -> tuple[float, float]:
    edge = outer_silhouette(ink)
    height, width = ink.shape
    ys, xs = _grid(ink.shape)
    band = edge & (np.abs(xs - width / 2.0) < width * 0.14)
    ey, ex = np.nonzero(band if band.any() else edge)
    top = int(ey.min())
    on_top = ey <= top + 6
    return float(ex[on_top].mean()), float(ey[on_top].mean())


def nape_width(ink: np.ndarray) -> float:
    _, top_y = nape_top(ink)
    edge = outer_silhouette(ink)
    ys, xs = np.nonzero(edge)
    near = np.abs(ys.astype(np.float64) - top_y) < 14
    if not np.any(near):
        return 220.0
    span = float(xs[near].max() - xs[near].min())
    return span if span > 40 else 220.0


def neck_hole(ink: np.ndarray) -> np.ndarray:
    height, width = ink.shape
    enclosed = G.enclosed_by(ink)
    interior = enclosed & ~ink
    labels, count = ndimage.label(interior)
    cx = width / 2.0
    best = np.zeros_like(ink)
    best_area = 0
    for index in range(1, count + 1):
        mask = labels == index
        area = int(mask.sum())
        if area < 2500 or area > 120000:
            continue
        ys, xs = np.nonzero(mask)
        if float(ys.mean()) > height * 0.50:
            continue
        if abs(float(xs.mean()) - cx) > width * 0.14:
            continue
        if area > best_area:
            best_area = area
            best = mask
    return best


def shift_rgb(rgb: np.ndarray, dy: float, dx: float) -> np.ndarray:
    channels = [
        ndimage.shift(rgb[:, :, c].astype(np.float32), (dy, dx), order=0, cval=255)
        for c in range(3)
    ]
    return np.stack(channels, axis=2).astype(np.uint8)


def fit_donor(base_ink: np.ndarray, don_rgb: np.ndarray, extra_shift: tuple[int, int] = (0, 0)) -> np.ndarray:
    """Sit the donor nape on the original nape with a whole-pixel shift."""
    bx, by = nape_top(base_ink)
    dx, dy = nape_top(ink_mask(don_rgb))
    ex, ey = extra_shift
    return shift_rgb(don_rgb, round(by - dy + ey), round(bx - dx + ex))


def collar_assembly(
    ink_arr: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The collar assembly of one drawing: opening + band + leaves + their ink.

    The band flood is bounded by the drawn collar outline (same rule the pack
    uses to colour the band), so the assembly is exactly the part of the
    garment a neckline change is allowed to touch — never the shoulders.
    Returns (assembly, hole, core) where core = hole | band | leaves.
    """
    hole = neck_hole(ink_arr)
    if not hole.any():
        return np.zeros_like(ink_arr), hole, hole
    band = G.collar_band_mask(hole, ink_arr)
    leaves = collar_part_masks(ink_arr)
    core = hole | band | leaves
    assembly = core | (ink_arr & ndimage.binary_dilation(core, iterations=8))
    return assembly, hole, core


def shoulder_keep(base_ink: np.ndarray) -> np.ndarray:
    """Original shoulder outline only. The nape comes from the donor collar."""
    height, width = base_ink.shape
    ys, xs = _grid(base_ink.shape)
    margin = nape_width(base_ink) / 2.0 + 36
    return outer_silhouette(base_ink) & (np.abs(xs - width / 2.0) > margin)


def collar_part_masks(ink: np.ndarray) -> np.ndarray:
    """Collar leaves / placket bands: small upper regions off the centre hole."""
    height, width = ink.shape
    enclosed = G.enclosed_by(ink)
    interior = enclosed & ~ink
    labels, count = ndimage.label(interior)
    parts = np.zeros_like(ink)
    cx = width / 2.0
    for index in range(1, count + 1):
        mask = labels == index
        area = int(mask.sum())
        if area < 2500 or area > 28000:
            continue
        ys, xs = np.nonzero(mask)
        if float(ys.mean()) > height * 0.40:
            continue
        if abs(float(xs.mean()) - cx) < width * 0.05:
            continue
        if abs(float(xs.mean()) - cx) > width * 0.30:
            continue
        if float(ys.min()) > height * 0.28:
            continue
        parts |= mask
    return parts


def seal_v_placket_bottom(out: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Connect the two placket legs at the bottom of a polo / deep V opening."""
    if not hole.any():
        return out
    height, width = hole.shape
    ys, xs = np.nonzero(hole)
    tip_y = int(ys.max())
    tip_x = int(round(xs[ys == tip_y].mean()))
    ink = ink_mask(out)
    for y in range(tip_y - 2, min(height, tip_y + 12)):
        x0, x1 = max(0, tip_x - 36), min(width, tip_x + 37)
        row = ink[y, x0:x1]
        if not row.any():
            continue
        hits = np.where(row)[0]
        left = x0 + int(hits[0])
        right = x0 + int(hits[-1])
        span = right - left
        if span < 4 or span > 56:
            continue
        gap = slice(left + 1, right)
        if gap.stop <= gap.start:
            continue
        missing = ~ink[y, gap]
        if 2 <= int(missing.sum()) <= 36:
            out = out.copy()
            patch = out[y, gap].copy()
            patch[missing] = 0
            out[y, gap] = patch
            return out
    # Vertical bridge at the placket tip when the legs cross instead of meeting.
    for x in range(max(0, tip_x - 3), min(width, tip_x + 4)):
        col = ink[max(0, tip_y - 6): min(height, tip_y + 8), x]
        if int(col.sum()) >= 2:
            continue
        y0, y1 = max(0, tip_y - 4), min(height, tip_y + 7)
        window = ~ink[y0:y1, x]
        if 2 <= int(window.sum()) <= 10:
            out = out.copy()
            patch = out[y0:y1, x].copy()
            patch[window] = 0
            out[y0:y1, x] = patch
            return out
    return out


def seal_placket_bottom(out: np.ndarray, hole: np.ndarray, paste: np.ndarray) -> np.ndarray:
    """Bridge a small ink gap at the bottom of a polo / deep V placket."""
    if not hole.any():
        return out
    height, width = hole.shape
    ys, xs = np.nonzero(hole)
    tip_y = int(ys.max())
    tip_x = int(round(xs[ys == tip_y].mean()))
    # Only bridge white gaps between existing ink — never add a filled block.
    x0, x1 = max(0, tip_x - 8), min(width, tip_x + 9)
    y0, y1 = max(0, tip_y - 4), min(height, tip_y + 6)
    window = paste[y0:y1, x0:x1]
    if not window.any():
        return out
    ink = ink_mask(out)
    ink_win = ink[y0:y1, x0:x1]
    gap = window & ~ink_win
    if int(gap.sum()) < 4 or int(gap.sum()) > 120:
        return out
    bridged = ndimage.binary_closing(ink_win | gap, iterations=1)
    added = bridged & ~ink_win & gap
    if int(added.sum()) < 4:
        return out
    out = out.copy()
    patch = out[y0:y1, x0:x1].copy()
    patch[added] = 0
    out[y0:y1, x0:x1] = patch
    return out


def composite(
    base: Image.Image,
    donor: Image.Image,
    extra_shift: tuple[int, int] = (0, 0),
    seal_placket: bool = False,
) -> tuple[Image.Image, np.ndarray, dict]:
    """Paste ONLY the donor's collar assembly onto the base drawing.

    Everything outside the collar neighbourhood stays byte-identical base
    pixels — that is what makes all necklines of a fit share one body.
    """
    base_rgb = np.asarray(base.convert("RGB"))
    don_rgb = np.asarray(donor.convert("RGB"))
    if don_rgb.shape != base_rgb.shape:
        donor = donor.resize((base_rgb.shape[1], base_rgb.shape[0]), Image.NEAREST)
        don_rgb = np.asarray(donor.convert("RGB"))

    base_ink = ink_mask(base_rgb)
    aligned = fit_donor(base_ink, don_rgb, extra_shift=extra_shift)
    aligned_ink = ink_mask(aligned)

    base_asm, base_hole, base_core = collar_assembly(base_ink)
    don_asm, new_hole, don_core = collar_assembly(aligned_ink)
    leaf = collar_part_masks(aligned_ink)
    leaf_zone = ndimage.binary_dilation(leaf, iterations=4) if leaf.any() else leaf

    # Collar neighbourhood clamp: centred, upper half only. Nothing outside it
    # may change — this is the guarantee that the body stays the base drawing.
    height, width = base_ink.shape
    ys, xs = _grid(base_ink.shape)
    margin = max(nape_width(base_ink) * 0.5 + 60, 240)
    clamp = (ys < height * 0.50) & (np.abs(xs - width / 2.0) <= margin)

    paste = don_asm | (
        aligned_ink & (ndimage.binary_dilation(don_asm, iterations=26) & clamp)
    )
    paste &= clamp
    erase = (
        base_asm
        | (base_ink & (ndimage.binary_dilation(base_asm, iterations=26) & clamp))
        | paste
    )
    erase &= clamp
    keep = shoulder_keep(base_ink)

    out = base_rgb.copy()
    out[erase] = 255
    out[paste] = aligned[paste]
    # The donor collar can be narrower than the base's (deep V vs V): base ink
    # erased near the old collar but beyond the donor's own ink would leave a
    # GAP in the shoulder/nape outline. Restore any erased base ink that the
    # donor did not repaint and that does not sit inside the donor's new
    # collar (where the old line must genuinely disappear).
    guard = ndimage.binary_dilation(don_core, iterations=6)
    orphan_ink = erase & ~paste & base_ink & ~guard
    out[orphan_ink] = base_rgb[orphan_ink]
    out[keep] = base_rgb[keep]

    # Seal collar-leaf / placket borders so they stay separate fill regions.
    if leaf.any():
        border = ndimage.binary_dilation(leaf, iterations=2) & ~leaf
        out[border & paste] = aligned[border & paste]
        out[leaf & paste] = 255
        closed = ndimage.binary_closing(ink_mask(out), iterations=2)
        seal = closed & ~ink_mask(out) & border & paste
        out[seal] = 0

    if new_hole.any():
        band = ndimage.binary_dilation(new_hole, iterations=36) & ~new_hole & paste & ~leaf
        closed = ndimage.binary_closing(ink_mask(out), iterations=2)
        added = closed & ~ink_mask(out) & band
        out[added] = 0

    if seal_placket and new_hole.any():
        out = seal_placket_bottom(out, new_hole, paste)
        out = seal_v_placket_bottom(out, new_hole)

    out_ink = ink_mask(out)
    leaked = G.enclosed_by(base_ink) & ~G.enclosed_by(out_ink)
    if int(leaked.sum()) > 5_000:
        restore = outer_silhouette(base_ink) & ~aligned_ink & ~leaf_zone
        out[restore] = base_rgb[restore]
        leftover = erase & base_ink & ~aligned_ink & ~restore
        out[leftover] = 255
        out_ink = ink_mask(out)

    ghost = (
        base_ink
        & ndimage.binary_dilation(base_hole, iterations=50)
        & ~base_hole
        & out_ink
        & ~aligned_ink
        & erase
    )
    stats = {
        "erase": int(erase.sum()),
        "paste": int(paste.sum()),
        "ghost": int(ghost.sum()),
        # The whole point: zero ink changes outside the collar clamp.
        "body_diff": int(((out_ink != base_ink) & ~clamp).sum()),
        "lower_diff": int((out_ink[height // 2 :] != base_ink[height // 2 :]).sum()),
        "enclosed_base": int(G.enclosed_by(base_ink).sum()),
        "enclosed_out": int(G.enclosed_by(out_ink).sum()),
        "leaked": int((G.enclosed_by(base_ink) & ~G.enclosed_by(out_ink)).sum()),
    }
    return Image.fromarray(out), paste, stats


def mask_preview(rgb: np.ndarray, zone: np.ndarray) -> Image.Image:
    preview = rgb.copy()
    tint = preview[zone]
    preview[zone] = (tint * 0.45 + np.array([255, 80, 80]) * 0.55).astype(np.uint8)
    return Image.fromarray(preview)


def main() -> None:
    DIAG.mkdir(parents=True, exist_ok=True)
    ids = [a for a in sys.argv[1:] if not a.startswith("-")]
    jobs = [
        job
        for job in JOBS
        if not ids or job["id"] in ids or any(token in job["id"] for token in ids)
    ]
    for job in jobs:
        if job['id'].startswith(('regular-', 'oversized-')):
            from rebuild_reference_necks import composite as reference_composite
            reference_composite(job['id'])
            print(f"{job['id']}: rebuilt from reference raster")
            continue
        if job['id'] in ('slim-polo', 'slim-thin-crew', 'slim-scoop'):
            from fix_slim_polo_thin import rebuild
            rebuild(job['id'])
            print(f"{job['id']}: rebuilt from registered collar boundaries")
            continue
        if job["id"] == "slim-deep-vneck":
            from fix_slim_deep_vneck import rebuild
            rebuild()
            print("slim-deep-vneck: rebuilt from registered collar boundaries")
            continue
        if job["id"] == "slim-crew":
            # This donor needs two-point registration and a measured collar
            # boundary; a neighbourhood flood also copies its shoulder ink.
            from fix_slim_crew import rebuild
            rebuild()
            print("slim-crew: rebuilt from registered collar boundaries")
            continue
        base_path = SRC / job["base"]
        donor_path = SRC / job["donor"]
        if not base_path.exists() or not donor_path.exists():
            print(f"skip {job['id']}: missing source")
            continue
        result, zone, stats = composite(
            Image.open(base_path),
            Image.open(donor_path),
            extra_shift=tuple(job.get("extra_shift", (0, 0))),
            seal_placket=bool(job.get("seal_placket")),
        )
        out_path = SRC / job["out"]
        result.save(out_path)
        print(
            f"{job['id']}: body_diff={stats['body_diff']} lower {stats['lower_diff']} "
            f"ghost={stats['ghost']} paste={stats['paste']} "
            f"enclosed {stats['enclosed_base']}->{stats['enclosed_out']} "
            f"leaked {stats['leaked']} -> {out_path.name}"
        )
        w, h = result.size
        result.crop((int(w * 0.22), int(h * 0.04), int(w * 0.78), int(h * 0.52))).save(
            DIAG / f"neckcrop-{job['out']}"
        )
        mask_preview(np.asarray(Image.open(base_path).convert("RGB")), zone).save(
            DIAG / f"zone-{job['id']}.png"
        )


if __name__ == "__main__":
    sys.exit(main() or 0)
