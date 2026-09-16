"""Find leftover base ink and eaten donor ink in the slim-crew composite.

Classifies every ink pixel of the composite in the collar clamp zone:
  leftover — composite ink that the aligned donor does not explain (base residue)
  missing  — base ink that vanished without a donor replacement (eaten dashes)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import composite_neck_variant as C  # noqa: E402

SRC = HERE.parents[1] / "src" / "assets" / "studio-tshirt"
DIAG = SRC / "_diag"

base = np.asarray(Image.open(SRC / "slim-vneck-lineart-bold.png").convert("RGB"))
donor = np.asarray(Image.open(SRC / "slim-crew-lineart-bold.png").convert("RGB"))
out = np.asarray(Image.open(SRC / "slim-crew-composite-bold.png").convert("RGB"))

base_ink = C.ink_mask(base)
donor_ink = C.ink_mask(donor)
out_ink = C.ink_mask(out)

# Reproduce the composite's alignment + clamp so zones line up exactly.
aligned = C.fit_donor(base_ink, donor)
aligned_ink = C.ink_mask(aligned)
height, width = base_ink.shape
ys, xs = C._grid(base_ink.shape)
margin = max(C.nape_width(base_ink) * 0.5 + 60, 240)
clamp = (ys < height * 0.50) & (np.abs(xs - width / 2.0) <= margin)

base_asm, base_hole, _ = C.collar_assembly(base_ink)
don_asm, new_hole, don_core = C.collar_assembly(aligned_ink)

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

keep = C.shoulder_keep(base_ink)

# Composite ink that neither donor ink nor kept base ink explains.
explained = ndimage.binary_dilation(aligned_ink, iterations=2) | keep | ~clamp
leftover = out_ink & ~explained
leftover &= ndimage.binary_erosion(clamp, iterations=6)

lbl, n = ndimage.label(leftover, np.ones((3, 3), bool))
boxes = ndimage.find_objects(lbl)
print("composite ink the aligned donor cannot explain (leftover base residue):")
shown = 0
for i, box in enumerate(boxes, start=1):
    area = int((lbl == i).sum())
    if area < 40:
        continue
    y0, y1 = box[0].start, box[0].stop
    x0, x1 = box[1].start, box[1].stop
    print(f"  area={area:>6}  bbox x[{x0},{x1}) y[{y0},{y1})")
    shown += 1
    if shown >= 25:
        break

# Base ink that vanished although the donor never repainted it (eaten detail).
guard = ndimage.binary_dilation(don_core, iterations=6)
eaten = (
    base_ink & erase & ~ndimage.binary_dilation(aligned_ink, iterations=2) & ~keep
    & ~guard & clamp
)
lbl2, n2 = ndimage.label(eaten, np.ones((3, 3), bool))
boxes2 = ndimage.find_objects(lbl2)
print("\nbase ink eaten without donor replacement (shoulder-dash candidates):")
shown = 0
for i, box in enumerate(boxes2, start=1):
    area = int((lbl2 == i).sum())
    if area < 40:
        continue
    y0, y1 = box[0].start, box[0].stop
    x0, x1 = box[1].start, box[1].stop
    print(f"  area={area:>6}  bbox x[{x0},{x1}) y[{y0},{y1})")
    shown += 1
    if shown >= 25:
        break

# Save a colour-coded overlay for the harness.
overlay = out.copy()
overlay[leftover] = (255, 0, 255)      # magenta: leftover base residue
overlay[eaten] = (0, 200, 0)           # green: eaten base detail
Image.fromarray(overlay).save(DIAG / "slim-crew-classified.png")
crop = overlay[: height // 2, int(width * 0.2) : int(width * 0.8)]
Image.fromarray(crop).save(DIAG / "slim-crew-classified-neckcrop.png")
print("\nwrote _diag/slim-crew-classified.png and neckcrop")
