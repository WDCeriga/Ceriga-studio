from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage
from scipy.spatial import ConvexHull


def propose_sleeve(drawing: Image.Image, side: str) -> dict:
    ink = np.asarray(drawing.convert("L")) < 168
    barrier = ndimage.binary_closing(ink, iterations=2)
    labels, count = ndimage.label(~barrier)
    excluded = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1], [0])))
    candidates = []
    for label in range(1, count + 1):
        if label in excluded:
            continue
        rows, columns = np.where(labels == label)
        if rows.size > ink.size * .003:
            candidates.append((label, rows, columns))
    if not candidates:
        raise ValueError("No plausible sleeve found. Include a visible sleeve opening and armhole.")
    chosen = min(candidates, key=lambda item: float(item[2].mean()) if side != "right" else -float(item[2].mean()))
    label, rows, columns = chosen
    boundary = (labels == label) & ~ndimage.binary_erosion(labels == label)
    vertical, horizontal = np.where(boundary)
    points = np.column_stack((horizontal, vertical))
    hull = points[ConvexHull(points).vertices]
    if len(hull) > 60:
        hull = hull[np.linspace(0, len(hull) - 1, 60).astype(int)]
    inner = points[:, 0] >= np.quantile(points[:, 0], .9) if side != "right" else points[:, 0] <= np.quantile(points[:, 0], .1)
    edge = points[inner]
    armhole = edge[[edge[:, 1].argmin(), edge[:, 1].argmax()]]
    outer = points[:, 0] <= np.quantile(points[:, 0], .15) if side != "right" else points[:, 0] >= np.quantile(points[:, 0], .85)
    opening = points[outer]
    cuff = opening[[opening[:, 1].argmin(), opening[:, 1].argmax()]]
    return {"outline": (hull / drawing.size).tolist(), "armhole": (armhole / drawing.size).tolist(),
            "cuff": (cuff / drawing.size).tolist(), "confidence": "low", "side": side}


def geometry_points(value: object, minimum: int = 2) -> list[list[float]]:
    if not isinstance(value, (list, tuple)) or not minimum <= len(value) <= 64:
        raise ValueError("Sleeve isolation needs a visible perimeter, armhole and opening")
    if any(not isinstance(point, (list, tuple)) or len(point) != 2 or any(
        isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not 0 <= number <= 1
        for number in point
    ) for point in value):
        raise ValueError("Invalid sleeve isolation coordinates")
    return [list(point) for point in value]


def isolate_sleeve(drawing: Image.Image, guidance: dict) -> tuple[Image.Image, Image.Image, dict]:
    outline = np.array(geometry_points(guidance.get("outline"), 3)) * drawing.size
    armhole = np.array(geometry_points(guidance.get("armhole"))) * drawing.size
    cuff = np.array(geometry_points(guidance.get("cuff"))) * drawing.size
    ink = np.asarray(drawing.convert("L")) < 168
    if ink.sum() < 20 or np.linalg.norm(armhole[-1] - armhole[0]) < 8:
        raise ValueError("No plausible sleeve with a visible attachment was identified")
    radius = max(3, round(max(drawing.size) * .012))
    distance, nearest = ndimage.distance_transform_edt(~ink, return_indices=True)

    def snap(points: np.ndarray) -> np.ndarray:
        snapped = []
        for horizontal, vertical in points:
            column = int(np.clip(round(horizontal), 0, drawing.width - 1))
            row = int(np.clip(round(vertical), 0, drawing.height - 1))
            snapped.append([nearest[1, row, column], nearest[0, row, column]] if distance[row, column] <= radius else [column, row])
        return np.array(snapped)

    outline, armhole, cuff = snap(outline), snap(armhole), snap(cuff)
    region_image = Image.new("L", drawing.size)
    ImageDraw.Draw(region_image).polygon([tuple(point) for point in outline], fill=255)
    proposed = np.asarray(region_image) > 0
    seam = Image.new("L", drawing.size)
    ImageDraw.Draw(seam).line([tuple(point) for point in armhole], fill=255, width=3)
    barrier = ndimage.binary_closing(ink, iterations=2) | (np.asarray(seam) > 0)
    labels, count = ndimage.label(~barrier)
    sizes = np.bincount(labels.ravel())
    overlap = np.bincount(labels[proposed].ravel(), minlength=len(sizes))
    border_labels = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    selected = (overlap / np.maximum(sizes, 1) >= .55) & (overlap > 4)
    selected[border_labels] = False
    selected[0] = False
    interior = selected[labels]
    envelope = ndimage.binary_dilation(proposed, iterations=radius)
    fabric = ndimage.binary_fill_holes(ndimage.binary_dilation(interior, iterations=3)) & envelope
    covered = float((fabric & proposed).sum() / max(1, proposed.sum()))
    needs_confirmation = guidance.get("confidence") != "high" or covered < .85
    if covered < .65:
        fabric = proposed.copy()
    if fabric.sum() < 100:
        raise ValueError("No plausible sleeve area was identified")
    retained = ink & fabric
    retained |= fabric & ~ndimage.binary_erosion(fabric, iterations=2)
    isolated = Image.fromarray(np.where(retained, 0, 255).astype(np.uint8)).convert("RGB")
    raw_bounds = ImageOps.invert(isolated.convert("L")).getbbox()
    raw_isolation = ImageOps.expand(isolated.crop(raw_bounds), border=24, fill="white")
    raw_origin = np.array(raw_bounds[:2]) - 24
    overlay = np.array(drawing.convert("RGB"), dtype=float)
    overlay[fabric] = overlay[fabric] * .65 + np.array([30, 190, 130]) * .35
    overlay_image = Image.fromarray(overlay.astype(np.uint8))
    segments = np.linalg.norm(np.diff(armhole, axis=0), axis=1)
    parameters = np.concatenate(([0], np.cumsum(segments)))
    samples = np.column_stack([np.interp(np.linspace(0, parameters[-1], 64), parameters, armhole[:, dimension]) for dimension in (0, 1)])
    best = np.ones(len(samples), dtype=bool)
    support = 0
    for first in range(len(armhole) - 1):
        for last in range(first + 1, len(armhole)):
            direction = armhole[last] - armhole[first]
            length = np.linalg.norm(direction)
            if length < 8:
                continue
            normal = np.array([-direction[1], direction[0]]) / length
            inliers = np.abs((samples - armhole[first]) @ normal) <= max(2, max(drawing.size) * .005)
            if inliers.sum() > support:
                support, best = int(inliers.sum()), inliers
    centered = samples[best] - samples[best].mean(axis=0)
    tangent = np.linalg.svd(centered, full_matrices=False)[2][0]
    if tangent @ (armhole[-1] - armhole[0]) < 0:
        tangent = -tangent
    angle = math.degrees(math.atan2(tangent[1], tangent[0])) - 90
    isolated = isolated.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor="white")
    radians = math.radians(angle)
    cuff_offset = cuff.mean(axis=0) - armhole.mean(axis=0)
    if math.cos(radians) * cuff_offset[0] + math.sin(radians) * cuff_offset[1] > 0:
        isolated = ImageOps.mirror(isolated)
    bounds = ImageOps.invert(isolated.convert("L")).getbbox()
    isolated = ImageOps.expand(isolated.crop(bounds), border=24, fill="white")
    rows, columns = np.where(fabric)
    metadata = {
        "status": "confirm" if needs_confirmation else "isolated",
        "guidance": {**guidance, "outline": (outline / drawing.size).tolist(), "armhole": (armhole / drawing.size).tolist(), "cuff": (cuff / drawing.size).tolist()},
        "processingCrop": [float(columns.min() / drawing.width), float(rows.min() / drawing.height), float((columns.max() + 1) / drawing.width), float((rows.max() + 1) / drawing.height)],
        "diagnostics": {"interiorRegions": count, "selectedRegions": int(selected.sum()), "coverage": covered,
                        "retainedInk": int((ink & fabric).sum()), "removedInk": int((ink & ~fabric).sum())},
    }
    isolated.info["normalizationSource"] = {
        "image": raw_isolation,
        "armhole": (armhole - raw_origin).tolist(),
        "cuff": (cuff - raw_origin).tolist(),
        "side": guidance.get("side", "left"),
    }
    return isolated, overlay_image, metadata