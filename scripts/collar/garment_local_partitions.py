"""Recover candidate partitions across short gaps in existing trace ink only.

Closing is a topology probe, never replacement artwork. Only already enclosed
cells may be divided; source pixels are assigned back after the probe so the
partition covers exactly the original cell. Semantic classification still must
establish that a recovered boundary is construction rather than a fold.
"""
from __future__ import annotations

import numpy as np
from scipy import ndimage


def recover_partitions(ink: np.ndarray, labels: np.ndarray, eligible: list[int]) -> tuple[np.ndarray, dict[int, dict]]:
    recovered = labels.copy()
    evidence: dict[int, dict] = {}
    # At the 1024px analysis resolution this bridges at most a six-pixel gap.
    radius_limit = max(1, min(3, round(max(ink.shape) * 3 / 1024)))
    next_label = int(labels.max()) + 1
    minimum = max(128, int(ink.size * .00025))
    objects = ndimage.find_objects(labels)
    for label in eligible:
        location = objects[label - 1]
        if location is None:
            continue
        ys, xs = location
        pad = radius_limit + 1
        crop = (slice(max(0, ys.start - pad), min(ink.shape[0], ys.stop + pad)),
                slice(max(0, xs.start - pad), min(ink.shape[1], xs.stop + pad)))
        original = labels[crop] == label
        area = int(original.sum())
        if area < minimum * 4:
            continue
        local_ink = ink[crop]
        threshold = max(minimum, int(area * .02))
        for radius in range(1, radius_limit + 1):
            y, x = np.ogrid[-radius:radius + 1, -radius:radius + 1]
            closed = ndimage.binary_closing(local_ink, structure=x * x + y * y <= radius * radius)
            bridges = closed & original
            pieces, _ = ndimage.label(original & ~bridges)
            sizes = np.bincount(pieces.ravel())
            substantial = [i for i in range(1, len(sizes)) if sizes[i] >= threshold]
            if not 2 <= len(substantial) <= 8:
                continue
            # Reject a narrow channel or a row of stitch specks as a fabric cut.
            if any(ndimage.distance_transform_edt(pieces == i).max() < max(3, radius * 2)
                   for i in substantial):
                continue
            seeds = np.where(np.isin(pieces, substantial), pieces, 0)
            _, nearest = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
            assigned = seeds[tuple(nearest)]
            # Keep the old ID for the largest remainder and allocate new IDs
            # only for added candidates. No source ink/exterior is reassigned.
            substantial.sort(key=lambda i: (-sizes[i], i))
            target = recovered[crop]
            for index, piece in enumerate(substantial):
                identifier = label if index == 0 else next_label
                if index:
                    next_label += 1
                target[original & (assigned == piece)] = identifier
                evidence[identifier] = {"method": "local-short-gap-partition", "sourceLabel": label,
                                        "radiusPixels": radius, "maximumGapPixels": radius * 2,
                                        "probeBridgePixels": int(bridges.sum()),
                                        "originalCellPixelsPreserved": True}
            break
    return recovered, evidence
