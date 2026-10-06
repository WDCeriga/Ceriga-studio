"""Source-proportioned technical projection, separate from photographic edge tracing."""
from __future__ import annotations

import copy
import re

import numpy as np
from PIL import Image
from scipy import ndimage

from garment_manifest import detail_ink, outline_mask, segment_drawing, validate_manifest
from garment_source_geometry import frame_source


def supports_technical_flat(manifest: dict) -> bool:
    return manifest["view"] in {"front", "back"} and any(
        region["structural"] and region["semanticType"] not in {"label", "decoration"}
        for region in manifest["regions"]
    )


def supports_tank_projection(manifest: dict) -> bool:
    family = manifest["garmentType"].lower()
    description = " ".join(manifest[key] for key in ("subtype", "construction")).lower()
    return (manifest["view"] == "front" and family in {"vest", "other"}
            and bool(re.search(r"tank|vest|camisole|singlet", description))
            and "scoop" in description
            and not re.search(r"asymmetr|one.shoulder|unequal straps", description)
            and sum(region["semanticType"] == "body" for region in manifest["regions"]) == 1)


def resample(points, count=192, closed=True):
    points = np.asarray(points, dtype=float)
    if closed:
        points = np.vstack([points, points[0]])
    keep = np.r_[True, np.linalg.norm(np.diff(points, axis=0), axis=1) > 1e-9]
    points = points[keep]
    distance = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
    if len(points) < 2 or distance[-1] <= 1e-9:
        raise ValueError("Technical construction curve has no length.")
    target = np.linspace(0, distance[-1], count, endpoint=not closed)
    return np.column_stack([np.interp(target, distance, points[:, axis]) for axis in (0, 1)])


def smooth(points, closed=True):
    sampled = resample(points, closed=closed)
    filtered = ndimage.gaussian_filter1d(sampled, 1.35, axis=0, mode="wrap" if closed else "nearest")
    # Preserve deliberate corners while fairing the intervening source curves.
    before = sampled - np.roll(sampled, 4, axis=0)
    after = np.roll(sampled, -4, axis=0) - sampled
    cosine = np.sum(before * after, axis=1) / np.maximum(np.linalg.norm(before, axis=1) * np.linalg.norm(after, axis=1), 1e-12)
    corners = cosine < .4
    filtered[corners] = sampled[corners]
    if not closed:
        filtered[0], filtered[-1] = sampled[0], sampled[-1]
    return filtered


def reflected(points, axis):
    result = np.asarray(points).copy()
    result[:, 0] = 2 * axis - result[:, 0]
    return result


def balanced(first, second, axis):
    first, second = resample(first), reflected(resample(second), axis)
    shifts = (np.roll(direction, offset, axis=0)
              for direction in (second, second[::-1]) for offset in range(len(first)))
    aligned = min(shifts, key=lambda candidate: float(np.square(first - candidate).sum()))
    return (first + aligned) / 2


def move_construction(points, source_outline, target_outline):
    source, target = resample(source_outline), resample(target_outline)
    candidates = (np.roll(direction, offset, axis=0)
                  for direction in (target, target[::-1]) for offset in range(len(target)))
    target = min(candidates, key=lambda candidate: float(np.square(source - candidate).sum()))
    points = np.asarray(points, dtype=float)
    distance = np.square(points[:, None, :] - source[None, :, :]).sum(axis=2)
    nearest = np.argsort(distance, axis=1)[:, :4]
    weights = 1 / np.maximum(np.take_along_axis(distance, nearest, axis=1), 1e-12)
    weights /= weights.sum(axis=1, keepdims=True)
    displacement = ((target - source)[nearest] * weights[:, :, None]).sum(axis=1)
    return points + displacement


def update_region(region, points):
    points = np.clip(points, 0, 1)
    region["outline"] = points.tolist()
    region["bounds"] = np.r_[points.min(axis=0), points.max(axis=0)].tolist()
    mask = outline_mask(region, (1024, 1024))
    if not mask.any():
        raise ValueError("Technical projection removed a construction piece.")
    y, x = np.unravel_index(ndimage.distance_transform_edt(mask).argmax(), mask.shape)
    region["seed"] = [float(x / 1023), float(y / 1023)]


def level_hem(regions, body):
    hems = [region for region in regions if region["semanticType"] == "hem" and region["attachmentTo"] == body["id"]]
    if len(hems) != 1:
        return
    hem = hems[0]
    polygon = np.asarray(body["outline"])
    left, top, right, bottom = hem["bounds"]
    xs = np.linspace(left, right, 161)
    envelope = []
    for x in xs:
        intersections = []
        for a, b in zip(polygon, np.roll(polygon, -1, axis=0)):
            if min(a[0], b[0]) <= x <= max(a[0], b[0]) and abs(b[0] - a[0]) > 1e-9:
                intersections.append(a[1] + (x-a[0]) * (b[1]-a[1]) / (b[0]-a[0]))
        envelope.append(max(intersections) if intersections else bottom)
    envelope = ndimage.gaussian_filter1d(envelope, 3)
    baseline = float(np.median(envelope[16:-16]))
    start = top - (bottom-top) * 2

    def move(points):
        points = np.asarray(points).copy()
        boundary = np.interp(points[:, 0], xs, envelope)
        weight = np.clip((points[:, 1]-start) / np.maximum(boundary-start, 1e-6), 0, 1)
        points[:, 1] += weight * weight * (3-2*weight) * (baseline-boundary)
        return points

    for region in regions:
        if region["boundary"]["boundaryType"] == "hardware-edge" or region["semanticType"] in {"button", "rivet", "zip"}:
            continue
        update_region(region, move(region["outline"]))
        for edge in region["visibleEdges"]:
            edge["points"] = move(edge["points"]).tolist()


def project_manifest(mapped: dict) -> dict:
    if not supports_tank_projection(mapped):
        return project_general(mapped)
    result = copy.deepcopy(mapped)
    regions = result["regions"]
    by_id = {region["id"]: region for region in regions}
    body = next(region for region in regions if region["semanticType"] == "body")
    axis = (body["bounds"][0] + body["bounds"][2]) / 2
    done = set()
    for region in regions:
        if region["id"] in done:
            continue
        partner = by_id.get(region["symmetryPartner"])
        original = np.asarray(region["outline"])
        central = region["bounds"][0] < axis < region["bounds"][2]
        points = balanced(original, partner["outline"] if partner else original, axis) if partner or central else original
        points = smooth(points)
        update_region(region, points)
        for edge in region["visibleEdges"]:
            path = move_construction(edge["points"], original, points)
            if central and path[:, 0].min() < axis < path[:, 0].max():
                sampled = resample(path, closed=False)
                path = (sampled + reflected(sampled[::-1], axis)) / 2
            edge["points"] = smooth(path, closed=False).tolist()
        for hole in region["cutouts"]:
            hole["outline"] = smooth(move_construction(hole["outline"], original, points)).tolist()
        if partner:
            partner_original = np.asarray(partner["outline"])
            partner_points = reflected(points, axis)[::-1]
            update_region(partner, partner_points)
            for edge in partner["visibleEdges"]:
                edge["points"] = smooth(move_construction(edge["points"], partner_original, partner_points), closed=False).tolist()
            for hole in partner["cutouts"]:
                hole["outline"] = smooth(move_construction(hole["outline"], partner_original, partner_points)).tolist()
            # Identical clasps can have their hinge on the same side, not mirrored.
            hardware = region["boundary"]["boundaryType"] == "hardware-edge"
            remaining = [] if hardware else list(partner["visibleEdges"])
            for first in region["visibleEdges"]:
                path = resample(first["points"], closed=False)
                matches = []
                for second in remaining:
                    if (first["style"], first["boundaryType"]) != (second["style"], second["boundaryType"]):
                        continue
                    other = reflected(resample(second["points"], closed=False), axis)
                    if np.linalg.norm(path[0]-other[-1]) < np.linalg.norm(path[0]-other[0]):
                        other = other[::-1]
                    matches.append((float(np.square(path-other).sum()), second, other))
                if matches:
                    _, second, other = min(matches, key=lambda match: match[0])
                    first["points"] = smooth((path+other)/2, closed=False).tolist()
                    second["points"] = reflected(first["points"], axis).tolist()
                    remaining.remove(second)
            done.add(partner["id"])
        done.add(region["id"])
    level_hem(regions, body)
    original = next(region for region in mapped["regions"] if region["id"] == body["id"])
    source_mask, projected_mask = (outline_mask(region, (1024, 1024)) for region in (original, body))
    overlap = (source_mask & projected_mask).sum() / (source_mask | projected_mask).sum()
    if overlap < .85:
        raise ValueError("The source pose is too asymmetric for a faithful balanced technical flat. Use a straighter front reference.")
    result["uncertainties"].append("Technical flat: paired construction is balanced and photograph-induced hem unevenness is levelled. Source proportions are retained; this is not a pixel trace or a measured production pattern.")
    return validate_manifest(result)


def fair_outline(region: dict, points):
    sampled = smooth(points)
    if region["semanticType"] not in {"body", "sleeve", "hood", "lining", "skirt", "yoke"}:
        return sampled
    filtered = ndimage.gaussian_filter1d(sampled, 3, axis=0, mode="wrap")
    # Bound fairing to small wrinkles; never change garment length or volume.
    limit = max(float(np.ptp(sampled, axis=0).min()) * .025, .001)
    delta = filtered - sampled
    distance = np.linalg.norm(delta, axis=1, keepdims=True)
    return sampled + delta * np.minimum(1, limit / np.maximum(distance, 1e-12))


def project_general(mapped: dict) -> dict:
    result = copy.deepcopy(mapped)
    originals = {region["id"]: region for region in mapped["regions"]}
    targets = {region["id"]: region for region in result["regions"]}
    primary = [region for region in mapped["regions"] if region["structural"]
               and region["semanticType"] in {"body", "skirt"}]
    if not primary:
        primary = [region for region in mapped["regions"] if region["structural"]]
    axis = (min(region["bounds"][0] for region in primary) + max(region["bounds"][2] for region in primary)) / 2
    asymmetric = bool(re.search(r"asymmetr|one.shoulder|unequal straps|offset closure|wrap.front",
                               mapped["subtype"] + " " + mapped["construction"], re.I))
    done, visiting = set(), set()
    restrained = set()

    def hardware(region):
        return region["boundary"]["boundaryType"] == "hardware-edge" or region["semanticType"] in {"button", "rivet", "zip"}

    def inherited(region, points):
        parent = originals.get(region["attachmentTo"])
        points = np.asarray(points, dtype=float)
        if parent is None:
            return points.copy()
        project(parent["id"])
        target = targets[parent["id"]]
        if hardware(region):
            centre = np.asarray([region["seed"]])
            return points + move_construction(centre, parent["outline"], target["outline"]) - centre
        return move_construction(points, parent["outline"], target["outline"])

    def apply(region, base, points):
        target = targets[region["id"]]
        for source, edge in zip(region["visibleEdges"], target["visibleEdges"]):
            path = inherited(region, source["points"])
            path = move_construction(path, base, points) if not hardware(region) else path
            edge["points"] = np.clip(smooth(path, closed=False) if not hardware(region) else path, 0, 1).tolist()
        for source, hole in zip(region["cutouts"], target["cutouts"]):
            path = inherited(region, source["outline"])
            path = move_construction(path, base, points) if not hardware(region) else path
            hole["outline"] = np.clip(path, 0, 1).tolist()
        update_region(target, points)
        done.add(region["id"])

    def close_to_source(source, target):
        first = outline_mask({"outline": np.asarray(source).tolist()}, (512, 512))
        second = outline_mask({"outline": np.asarray(target).tolist()}, (512, 512))
        union = (first | second).sum()
        return bool(union and (first & second).sum() / union >= .8)

    def pending_ancestor(region):
        seen = set()
        parent = region["attachmentTo"]
        while parent in originals:
            if parent in visiting or parent in seen:
                return True
            seen.add(parent)
            parent = originals[parent]["attachmentTo"]
        return False

    def project(identifier):
        if identifier in done:
            return
        if identifier in visiting:
            raise ValueError("Construction attachments contain a cycle; source geometry needs review.")
        visiting.add(identifier)
        region = originals[identifier]
        base = inherited(region, region["outline"])
        if hardware(region):
            apply(region, base, base)
            visiting.remove(identifier)
            return
        partner = originals.get(region["symmetryPartner"])
        paired = (not asymmetric and partner is not None and partner["id"] not in done
                  and partner["id"] not in visiting and partner["symmetryPartner"] == identifier
                  and partner["semanticType"] == region["semanticType"] and not hardware(partner)
                  and not pending_ancestor(partner)
                  and region["attachmentTo"] != partner["id"])
        if paired:
            visiting.add(partner["id"])
            other = inherited(partner, partner["outline"])
            candidate = fair_outline(region, balanced(base, other, axis))
            mirror = reflected(candidate, axis)[::-1]
            if close_to_source(base, candidate) and close_to_source(other, mirror):
                apply(region, base, candidate)
                apply(partner, other, mirror)
            else:
                # A posed or genuinely different pair must not become a generic mirrored template.
                restrained.update((identifier, partner["id"]))
                apply(region, base, fair_outline(region, base))
                apply(partner, other, fair_outline(partner, other))
            visiting.remove(partner["id"])
        else:
            apply(region, base, fair_outline(region, base))
        visiting.remove(identifier)

    for region in mapped["regions"]:
        project(region["id"])
    note = ("Clean source-matched technical flat: small contour irregularities are faired and only evidenced matching pairs "
            "are balanced. Attached details follow their source panels; one-sided features, functional hardware, openings "
            "and intentional asymmetry are retained. No hidden construction is invented; this is not a measured production pattern.")
    if restrained:
        note += " Strongly posed pairs retain their source pose rather than being forced into symmetry."
    result["uncertainties"] = result["uncertainties"][-31:] + [note]
    return validate_manifest(result)


def segment_technical(photo: Image.Image, manifest: dict, size=1024):
    if not supports_tank_projection(manifest):
        from garment_source_geometry import segment_source
        # Keep the source-coverage gate; a cleaner drawing must not hide omitted fabric.
        segment_source(photo, manifest, size)
    framed, mapped = frame_source(photo, manifest, size)
    mapped = project_manifest(mapped)
    masks, contours, stitches, notes = segment_drawing(framed, mapped)
    contours = np.zeros_like(contours)
    stitches = np.zeros_like(stitches)
    for region, mask in zip(mapped["regions"], masks):
        if not mask.any():
            continue
        solid, thread = detail_ink(region, framed.size)
        near = ndimage.binary_dilation(mask)
        contours = (contours & ~mask) | (mask & ~ndimage.binary_erosion(mask)) | (solid & near)
        stitches = (stitches & ~mask) | (thread & near)
    notes.append("Clean technical construction uses faired source outlines and source-evidenced paired construction; no photographic shadows, texture, prints or incidental wrinkles supply contour ink.")
    drawing = Image.fromarray(np.where(contours | stitches, 0, 255).astype(np.uint8)).convert("RGB")
    return drawing, mapped, (masks, contours, stitches, notes)


def rib_paths(mask: np.ndarray) -> str:
    interior = ndimage.binary_erosion(mask, iterations=2)
    size = mask.shape[1]
    paths = []
    for x in range(size // 2 % max(4, round(size / 65)), size, max(4, round(size / 65))):
        runs = np.diff(np.r_[False, interior[:, x], False].astype(np.int8))
        for start, end in zip(np.where(runs == 1)[0], np.where(runs == -1)[0]):
            if end-start >= 5:
                paths.append(f"M{x*2048/size:.2f},{start*2048/size:.2f}V{end*2048/size:.2f}")
    return " ".join(paths)
