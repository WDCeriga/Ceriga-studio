from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage


def edge_center(points: np.ndarray) -> np.ndarray:
    lengths = np.linalg.norm(np.diff(points, axis=0), axis=1)
    if lengths.sum() < 4:
        raise ValueError("Sleeve normalization needs distinct armhole and opening edges")
    return np.average((points[:-1] + points[1:]) / 2, axis=0, weights=lengths)


def normalize_sleeve(raw: Image.Image, armhole, cuff) -> tuple[Image.Image, dict]:
    edges = {"armhole": np.asarray(armhole, dtype=float), "cuff": np.asarray(cuff, dtype=float)}
    for points in edges.values():
        if points.ndim != 2 or points.shape[1] != 2 or not 2 <= len(points) <= 64 or not np.isfinite(points).all():
            raise ValueError("Sleeve normalization needs labeled armhole and opening coordinates")
        if (points < 0).any() or (points >= np.array(raw.size)).any():
            raise ValueError("Sleeve normalization landmarks lie outside the isolated raster")
    centers = {name: edge_center(points) for name, points in edges.items()}
    axis = centers["cuff"] - centers["armhole"]
    length = float(np.linalg.norm(axis))
    if length < 8:
        raise ValueError("Sleeve normalization cannot distinguish attachment from opening")
    angle = math.degrees(math.atan2(axis[1], axis[0])) - 90
    radians = math.radians(angle)
    rotation = np.array([[math.cos(radians), math.sin(radians)], [-math.sin(radians), math.cos(radians)]])
    rotated = raw.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor="white")
    bounds = rotated.convert("L").point(lambda value: 255 if value < 168 else 0).getbbox()
    if bounds is None:
        raise ValueError("Sleeve normalization produced an empty raster")
    bounds = (max(0, bounds[0] - 4), max(0, bounds[1] - 4), min(rotated.width, bounds[2] + 4), min(rotated.height, bounds[3] + 4))
    normalized = ImageOps.expand(rotated.crop(bounds), border=24, fill="white")
    translation = (np.array(rotated.size) - 1) / 2 - rotation @ ((np.array(raw.size) - 1) / 2) - np.array(bounds[:2]) + 24
    mapped = {name: points @ rotation.T + translation for name, points in edges.items()}
    mapped_axis = edge_center(mapped["cuff"]) - edge_center(mapped["armhole"])
    source_ink = np.asarray(raw.convert("L")) < 168
    result_ink = np.asarray(normalized.convert("L")) < 168
    source_mask = ndimage.binary_fill_holes(source_ink)
    result_mask = ndimage.binary_fill_holes(result_ink)
    source_points = np.moveaxis(np.indices(source_mask.shape), 0, -1)[..., ::-1]
    result_points = source_points @ rotation.T + translation
    restored = ndimage.map_coordinates(result_mask, [result_points[..., 1], result_points[..., 0]], order=0, prefilter=False)
    similarity = float((source_mask & restored).sum() / max(1, (source_mask | restored).sum()))
    area_ratio = float(result_mask.sum() / max(1, source_mask.sum()))
    ink_ratio = float(result_ink.sum() / max(1, source_ink.sum()))
    if mapped_axis[1] <= 0 or abs(mapped_axis[0]) > .01 or abs(mapped_axis[1] - length) > .01:
        raise ValueError("Sleeve normalization failed to orient the structural length axis")
    if similarity < .95 or not .95 <= area_ratio <= 1.05 or not .85 <= ink_ratio <= 1.15:
        raise ValueError("Sleeve normalization changed the silhouette or construction ink; review the isolated sleeve")
    if result_ink[:4].any() or result_ink[-4:].any() or result_ink[:, :4].any() or result_ink[:, -4:].any():
        raise ValueError("Sleeve normalization clipped the isolated sleeve")
    widths = {}
    for name, points in edges.items():
        width = float(np.linalg.norm(points[-1] - points[0]))
        if abs(np.linalg.norm(mapped[name][-1] - mapped[name][0]) - width) > .01:
            raise ValueError("Sleeve normalization changed an attachment or opening width")
        widths[name] = width
    return normalized, {
        "version": 1, "orientation": "armhole-top-cuff-bottom", "rotationDegrees": angle,
        "scale": 1, "landmarks": {name: points.tolist() for name, points in mapped.items()},
        "rigidTransform": {"matrix": rotation.tolist(), "translation": translation.tolist()},
        "validation": {"status": "passed", "length": length, "armholeWidth": widths["armhole"],
                       "openingWidth": widths["cuff"], "silhouetteIoU": similarity,
                       "areaRatio": area_ratio, "inkRatio": ink_ratio, "clipped": False},
    }


def registration_raster(normalized: Image.Image, side: str) -> Image.Image:
    canonical = ImageOps.mirror(normalized) if side == "right" else normalized
    return canonical.transpose(Image.Transpose.ROTATE_270)