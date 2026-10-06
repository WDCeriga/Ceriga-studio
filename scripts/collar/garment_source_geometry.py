"""Source-registered construction masks; an image-model redraw never supplies geometry."""
from __future__ import annotations

import copy

import numpy as np
from PIL import Image
from scipy import ndimage

from garment_manifest import segment_drawing, validate_manifest


class SourceGeometryError(ValueError):
    pass


def frame_source(photo: Image.Image, manifest: dict, size: int = 1024) -> tuple[Image.Image, dict]:
    mapped = copy.deepcopy(validate_manifest(manifest))
    points = []
    for region in mapped["regions"]:
        points.extend(region["outline"])
        points.extend([region["bounds"][:2], region["bounds"][2:], region["seed"]])
        for edge in region["visibleEdges"]:
            points.extend(edge["points"])
        for hole in region["cutouts"]:
            points.extend(hole["outline"])
    pixels = np.asarray(points) * [max(1, photo.width - 1), max(1, photo.height - 1)]
    low, high = pixels.min(axis=0), pixels.max(axis=0)
    scale = .88 / max(float((high - low).max()), 1)
    offset = .5 - (low + high) * scale / 2

    def point(value):
        return [float(value[0] * max(1, photo.width - 1) * scale + offset[0]),
                float(value[1] * max(1, photo.height - 1) * scale + offset[1])]

    for region in mapped["regions"]:
        region["outline"] = [point(p) for p in region["outline"]]
        region["bounds"] = point(region["bounds"][:2]) + point(region["bounds"][2:])
        region["seed"] = point(region["seed"])
        for edge in region["visibleEdges"]:
            edge["points"] = [point(p) for p in edge["points"]]
        for hole in region["cutouts"]:
            hole["outline"] = [point(p) for p in hole["outline"]]
    pixel_scale = scale * (size - 1)
    rgb_photo = photo.convert("RGB")
    rgb = np.asarray(rgb_photo)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    background = tuple(int(v) for v in np.median(border, axis=0))
    framed = rgb_photo.transform((size, size), Image.Transform.AFFINE,
        (1 / pixel_scale, 0, -offset[0] / scale, 0, 1 / pixel_scale, -offset[1] / scale),
        resample=Image.Resampling.BICUBIC, fillcolor=background)
    return framed, validate_manifest(mapped)


def source_foreground(photo: Image.Image, framed: Image.Image, manifest: dict, masks: list[np.ndarray]) -> np.ndarray | None:
    if not manifest.get("isolatedOnPlainBackground", False):
        return None
    rgb = np.asarray(photo.convert("RGB"), dtype=np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    background = np.median(border, axis=0)
    noise = float(np.percentile(np.linalg.norm(border - background, axis=1), 99))
    if background.min() < 235 or noise > 12:
        return None
    distance = np.linalg.norm(np.asarray(framed, dtype=np.float32) - background, axis=2)
    foreground = distance > max(12, noise + 6)
    expected = np.logical_or.reduce(masks)
    labels, count = ndimage.label(foreground)
    areas = np.bincount(labels.ravel())
    overlaps = np.bincount(labels[expected], minlength=count + 1)
    keep = (areas >= 12) & (overlaps >= np.maximum(3, areas * .1))
    keep[0] = False
    foreground = keep[labels]
    if not foreground.any() or (foreground & expected).sum() < expected.sum() * .65:
        return None
    return foreground


def segment_source(photo: Image.Image, manifest: dict, size: int = 1024) -> tuple[Image.Image, dict, tuple]:
    framed, mapped = frame_source(photo, manifest, size)
    masks, contours, stitches, notes = segment_drawing(framed, mapped)
    foreground = source_foreground(photo, framed, manifest, masks)
    if foreground is not None:
        radius = max(2, round(size * .012))
        source_perimeters = np.logical_or.reduce([mask & ~ndimage.binary_erosion(mask) for mask in masks])
        # Only exterior background refines edges; pale labels/prints inside fabric
        # must not become holes. Enclosed openings remain source-manifest geometry.
        silhouette = ndimage.binary_fill_holes(foreground)
        photo_edge = silhouette & ~ndimage.binary_erosion(silhouette)
        near_photo_edge = ndimage.distance_transform_edt(~photo_edge) <= radius
        for index, (region, mask) in enumerate(zip(mapped["regions"], masks)):
            if not mask.any() or region["boundary"]["boundaryType"] == "hardware-edge" or region["semanticType"] in {"button", "rivet", "zip"}:
                continue
            boundary = mask & ~ndimage.binary_erosion(mask)
            snap = near_photo_edge & (ndimage.distance_transform_edt(~boundary) <= radius)
            masks[index] = (mask & ~snap) | (silhouette & snap)
        covered = np.logical_or.reduce(masks)
        # A source outline can miss a curved hem by more than the fine snap radius.
        # Allocate nearby missed fabric to its nearest evidenced piece, rather
        # than redrawing it. Protect enclosed openings and never grow hardware.
        protected_openings = ndimage.binary_fill_holes(covered) & ~covered
        fabric_indices = [i for i, (region, mask) in enumerate(zip(mapped["regions"], masks))
                          if mask.any() and region["boundary"]["boundaryType"] != "hardware-edge"
                          and region["semanticType"] not in {"button", "rivet", "zip"}]
        repair_radius = max(radius, round(size * .08))
        if fabric_indices:
            owners = np.zeros_like(covered, dtype=np.int32)
            for index in fabric_indices:
                owners[masks[index]] = index + 1
            distance, nearest = ndimage.distance_transform_edt(owners == 0, return_indices=True)
            nearest_owner = owners[tuple(nearest)]
            additions = (foreground | (silhouette & ~protected_openings)) & ~covered & (distance <= repair_radius)
            hardware = np.zeros_like(covered)
            for index, mask in enumerate(masks):
                if index not in fabric_indices:
                    hardware |= mask
            additions &= ~ndimage.binary_dilation(hardware, iterations=radius)
            if additions.any():
                notes.append("Nearby missing fabric was recovered from source pixels. Its colour-piece ownership is approximate; review seams against the photograph. Polygon guides and estimated-back geometry remain source-analysis approximations.")
            by_id = {region["id"]: i for i, region in enumerate(mapped["regions"])}
            for index in fabric_indices:
                extra = additions & (nearest_owner == index + 1)
                current = index
                visited = set()
                while current in fabric_indices and current not in visited:
                    masks[current] |= extra
                    visited.add(current)
                    current = by_id.get(mapped["regions"][current]["attachmentTo"])
            covered = np.logical_or.reduce(masks)
        missed = foreground & ~ndimage.binary_dilation(covered, iterations=2)
        if int(missed.sum()) > max(32, int(foreground.sum() * .015)):
            original = np.asarray(manifest["regions"][0]["bounds"])
            target = np.asarray(mapped["regions"][0]["bounds"])
            factor = (target[2:] - target[:2]) / (original[2:] - original[:2])
            offset = target[:2] - original[:2] * factor
            labels, _ = ndimage.label(missed)
            areas = np.bincount(labels.ravel())
            bounds = []
            for label in np.argsort(areas[1:])[-5:][::-1] + 1:
                y, x = np.where(labels == label)
                low = (np.array([x.min(), y.min()]) / (size - 1) - offset) / factor
                high = (np.array([x.max(), y.max()]) / (size - 1) - offset) / factor
                bounds.append(np.concatenate([low, high]).round(4).tolist())
            raise SourceGeometryError(
                f"Source outlines omit visible garment fabric ({missed.sum() / foreground.sum():.1%}). "
                f"Largest missed areas in original-photo normalized [left, top, right, bottom] coordinates: {bounds}. "
                "Correct outer hem, side edges and straps against these source pixels, not an idealized flat. "
                "Include the full visible rear/inside fabric behind the scoop neckline, "
                "not only its narrow upper binding. Keep true background openings empty. Trace all observed straps and their attachments; "
                "do not install a detached neckband or replace the garment with a generic symmetric tank."
            )
        # Repaired ownership boundaries are not evidence of new internal seams.
        # Keep source-supported internal perimeters and the recovered silhouette.
        from garment_manifest import detail_ink
        supported_edges = (ndimage.distance_transform_edt(~source_perimeters) <= radius)
        supported_edges |= covered & ~ndimage.binary_erosion(covered)
        contours = np.zeros_like(contours)
        for region, mask in zip(mapped["regions"], masks):
            contours |= mask & ~ndimage.binary_erosion(mask) & supported_edges
            solid, _ = detail_ink(region, framed.size)
            contours |= solid
        contours &= ~stitches
        notes.append("Source-locked geometry: visible exterior edges follow the isolated photograph; no AI redraw was traced.")
    else:
        notes.append("Source-locked geometry uses source-image construction outlines; automatic pixel-edge refinement was unavailable for this background.")
    drawing = Image.fromarray(np.where(contours | stitches, 0, 255).astype(np.uint8), "L").convert("RGB")
    return drawing, mapped, (masks, contours, stitches, notes)
