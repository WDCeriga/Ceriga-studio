from __future__ import annotations

import hashlib
import json
import math
import re

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from asset_providers import component_bounds


EXCLUDED_REGION_TYPES = {"label", "decoration"}
HARDWARE_TYPES = {"button", "rivet", "zip"}
REGION_TYPES = {"panel", "waistband", "pocket", "flap", "fly", "belt-loop", "hem", "button", "rivet", "zip", "label", "decoration",
                "body", "sleeve", "cuff", "collar", "neckband", "hood", "yoke", "placket", "skirt", "lining"}
BUILDER_CATEGORIES = {"fabric-colour", "neck-hood", "sleeves", "hem-cuffs", "pockets-zips", "trims-details", "custom-details"}
BOUNDARY_TYPES = {"silhouette", "seam", "panel-edge", "pocket-edge", "waistband-edge", "hem-edge", "overlay-edge", "fly-edge", "hardware-edge"}
MIN_BOUNDARY_CONFIDENCE = .8


def outline_mask(region: dict, size: tuple[int, int]) -> np.ndarray:
    page = Image.new("1", size)
    ImageDraw.Draw(page).polygon([(round(horizontal * (size[0] - 1)), round(vertical * (size[1] - 1))) for horizontal, vertical in region["outline"]], fill=1)
    return np.asarray(page, dtype=bool)


def identity(stage: str, value: object) -> str:
    encoded = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return stage + "-" + hashlib.sha256(encoded).hexdigest()


def validate_manifest(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("Garment analysis must be an object.")
    garment_type = value.get("garmentType")
    if not isinstance(garment_type, str) or not 1 <= len(garment_type.strip()) <= 120 or garment_type.strip().lower() in {"unknown", "none", "not-a-garment"}:
        raise ValueError("The garment type could not be identified. Upload a clearer garment reference.")
    for key in ("material", "subtype", "fit", "construction", "materialEvidence"):
        if not isinstance(value.get(key), str) or not 1 <= len(value[key].strip()) <= 2400:
            raise ValueError(f"Missing garment {key} evidence.")
    if value.get("view") not in {"front", "back"}:
        raise ValueError("Only one visible front or back view can be imported at a time.")
    confidence = value.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
        raise ValueError("Invalid garment confidence.")
    if not isinstance(value.get("isolatedOnPlainBackground", False), bool):
        raise ValueError("Invalid source background classification.")
    uncertainties = value.get("uncertainties")
    if not isinstance(uncertainties, list) or len(uncertainties) > 32 or any(not isinstance(note, str) or len(note) > 600 for note in uncertainties):
        raise ValueError("Invalid garment uncertainties.")
    regions = value.get("regions")
    if not isinstance(regions, list) or not 1 <= len(regions) <= 64:
        raise ValueError("Expected visible construction pieces, at most 64; there is no target region count.")
    identifiers = set()
    normalized = []
    for region in regions:
        if not isinstance(region, dict) or not isinstance(region.get("id"), str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", region["id"]) or region["id"] in identifiers:
            raise ValueError("Region IDs must be unique semantic identifiers.")
        identifiers.add(region["id"])
        if region.get("semanticType") not in REGION_TYPES:
            raise ValueError("Unknown semantic region type.")
        for key in ("name", "material", "evidence"):
            if not isinstance(region.get(key), str) or not 1 <= len(region[key].strip()) <= 1200:
                raise ValueError(f"Invalid region {key}.")
        for key in ("colorable", "structural"):
            if not isinstance(region.get(key), bool):
                raise ValueError(f"Invalid region {key}.")
        bounds = list(component_bounds(region.get("bounds")))
        seed = region.get("seed")
        if not isinstance(seed, list) or len(seed) != 2 or any(isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) for number in seed) or not bounds[0] <= seed[0] <= bounds[2] or not bounds[1] <= seed[1] <= bounds[3]:
            raise ValueError("Region seed must be inside its bounds.")
        for key in ("attachmentTo", "symmetryPartner"):
            if region.get(key) is not None and not isinstance(region[key], str):
                raise ValueError(f"Invalid region {key}.")
        outline = region.get("outline")
        if not isinstance(outline, list) or not 3 <= len(outline) <= 256 or any(
            not isinstance(point, list) or len(point) != 2 or any(isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not 0 <= number <= 1 for number in point)
            for point in outline
        ):
            raise ValueError("Construction regions require a source-evidenced outline; seed partitioning is not supported.")
        boundary = region.get("boundary")
        if not isinstance(boundary, dict) or boundary.get("boundaryType") not in BOUNDARY_TYPES or not isinstance(boundary.get("evidence"), str) or not boundary["evidence"].strip():
            raise ValueError("Each construction boundary requires its type and source evidence.")
        certainty = boundary.get("confidence")
        if isinstance(certainty, bool) or not isinstance(certainty, (int, float)) or not math.isfinite(certainty) or not 0 <= certainty <= 1:
            raise ValueError("Invalid boundary confidence.")
        if region.get("builderCategory") not in BUILDER_CATEGORIES or region.get("layerKind") not in {"structural", "detail"}:
            raise ValueError("Each region requires a construction layer and builder category.")
        hardware = region["semanticType"] in HARDWARE_TYPES or (
            region["semanticType"] == "panel" and boundary["boundaryType"] == "hardware-edge"
        )
        if region["structural"] != (region["layerKind"] == "structural") or hardware and region["layerKind"] != "detail":
            raise ValueError("Hardware is a detail layer, never a structural fabric polygon.")
        for key in ("structuralRole", "userFacingName", "colourGroup", "measurementRole"):
            if not isinstance(region.get(key), str) or not 1 <= len(region[key]) <= 160:
                raise ValueError(f"Missing construction grouping {key}.")
        if not isinstance(region.get("editableIndependently"), bool):
            raise ValueError("Invalid independent editing flag.")
        visible_edges = region.get("visibleEdges", [])
        if not isinstance(visible_edges, list) or len(visible_edges) > 32:
            raise ValueError("Invalid visible construction details.")
        edge_ids = set()
        for edge in visible_edges:
            if not isinstance(edge, dict) or not isinstance(edge.get("id"), str) or edge["id"] in edge_ids:
                raise ValueError("Visible construction detail IDs must be unique within a piece.")
            edge_ids.add(edge["id"])
            points = edge.get("points")
            if not isinstance(points, list) or not 2 <= len(points) <= 256 or any(
                not isinstance(point, list) or len(point) != 2 or any(isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not 0 <= number <= 1 for number in point)
                for point in points
            ):
                raise ValueError("Visible construction details require an open source-supported polyline.")
            certainty = edge.get("confidence")
            if edge.get("boundaryType") not in BOUNDARY_TYPES or edge.get("style") not in {"solid", "stitch"} or not isinstance(edge.get("evidence"), str) or not edge["evidence"].strip() or isinstance(certainty, bool) or not isinstance(certainty, (int, float)) or not math.isfinite(certainty) or not 0 <= certainty <= 1:
                raise ValueError("Each visible detail needs separate source evidence, confidence and line style.")
        cutouts = region.get("cutouts", [])
        if not isinstance(cutouts, list) or len(cutouts) > 32 or (cutouts and not hardware):
            raise ValueError("Only hardware can have evidenced cutouts, at most 32.")
        cutout_ids = set()
        occupied = np.zeros((1024, 1024), dtype=bool) if cutouts else None
        interior = ndimage.binary_erosion(outline_mask(region, (1024, 1024))) if cutouts else None
        for cutout in cutouts:
            if not isinstance(cutout, dict) or not isinstance(cutout.get("id"), str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", cutout["id"]) or cutout["id"] in cutout_ids:
                raise ValueError("Hardware cutout IDs must be unique semantic identifiers.")
            cutout_ids.add(cutout["id"])
            points = cutout.get("outline")
            certainty = cutout.get("confidence")
            if not isinstance(points, list) or not 3 <= len(points) <= 256 or any(
                not isinstance(point, list) or len(point) != 2 or any(isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not 0 <= number <= 1 for number in point)
                for point in points
            ):
                raise ValueError("Hardware cutouts require closed normalized outlines.")
            if isinstance(certainty, bool) or not isinstance(certainty, (int, float)) or not math.isfinite(certainty) or not 0 <= certainty <= 1 or not isinstance(cutout.get("evidence"), str) or not cutout["evidence"].strip():
                raise ValueError("Hardware cutouts require source evidence and valid confidence.")
            hole = outline_mask(cutout, (1024, 1024))
            if int(hole.sum()) < 3 or np.any(hole & ~interior) or np.any(hole & occupied):
                raise ValueError("Hardware cutouts must be non-overlapping openings strictly inside their perimeter.")
            occupied |= hole
        normalized.append({key: region[key] for key in ("id", "name", "semanticType", "material", "evidence", "colorable", "structural", "seed")} | {
            "bounds": bounds, "attachmentTo": region.get("attachmentTo"), "symmetryPartner": region.get("symmetryPartner"),
            "visibleEdges": visible_edges, "cutouts": cutouts,
            **{key: region[key] for key in ("outline", "boundary", "layerKind", "structuralRole", "builderCategory", "userFacingName", "colourGroup", "measurementRole", "editableIndependently")},
        })
    by_id = {region["id"]: region for region in normalized}
    for region in normalized:
        for key in ("attachmentTo", "symmetryPartner"):
            target = region[key]
            if target is not None and (target not in identifiers or target == region["id"]):
                raise ValueError(f"Broken region {key} link.")
        partner = region["symmetryPartner"]
        if partner is not None and by_id[partner]["symmetryPartner"] != region["id"]:
            raise ValueError("Symmetry links must be reciprocal.")
        visited = {region["id"]}
        parent = region["attachmentTo"]
        while parent is not None:
            if parent in visited:
                raise ValueError("Cyclic region attachment.")
            visited.add(parent)
            parent = by_id[parent]["attachmentTo"]
    return {key: value[key] for key in ("garmentType", "material", "subtype", "fit", "construction", "materialEvidence", "view", "confidence", "uncertainties")} | {"regions": normalized, "isolatedOnPlainBackground": value.get("isolatedOnPlainBackground", False)}


def detail_ink(region: dict, size: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    solid = Image.new("1", size)
    stitches = Image.new("1", size)
    if region.get("semanticType") in EXCLUDED_REGION_TYPES:
        return np.asarray(solid, dtype=bool), np.asarray(stitches, dtype=bool)
    for edge in region.get("visibleEdges", []):
        if edge["confidence"] < MIN_BOUNDARY_CONFIDENCE:
            continue
        points = [(horizontal * (size[0] - 1), vertical * (size[1] - 1)) for horizontal, vertical in edge["points"]]
        width = max(1, round(max(size) / 700))
        if edge["style"] == "solid":
            ImageDraw.Draw(solid).line(points, fill=1, width=width, joint="curve")
        else:
            pen = ImageDraw.Draw(stitches)
            distance = 0.0
            dash = max(2, max(size) / 256)
            for start, finish in zip(points, points[1:]):
                length = math.dist(start, finish)
                for step in range(max(1, math.ceil(length))):
                    portion = step / max(1, math.ceil(length))
                    if int((distance + portion * length) / dash) % 2 == 0:
                        horizontal = round(start[0] + (finish[0] - start[0]) * portion)
                        vertical = round(start[1] + (finish[1] - start[1]) * portion)
                        pen.point((horizontal, vertical), fill=1)
                distance += length
    return np.asarray(solid, dtype=bool), np.asarray(stitches, dtype=bool)


def segment_drawing(drawing: Image.Image, manifest: dict) -> tuple[list[np.ndarray], np.ndarray, np.ndarray, list[str]]:
    ink = np.zeros((drawing.height, drawing.width), dtype=bool)
    notes = []
    masks = []
    construction = np.zeros_like(ink)
    for region in manifest["regions"]:
        if "outline" not in region or "boundary" not in region:
            raise ValueError("Construction evidence is missing. Re-analyze the source; arbitrary partitions are disabled.")
        if region["semanticType"] in EXCLUDED_REGION_TYPES:
            masks.append(np.zeros_like(ink))
            notes.append(f"{region['name']}: label or surface decoration omitted; garment imports include construction only.")
            continue
        if region["boundary"]["confidence"] < MIN_BOUNDARY_CONFIDENCE:
            masks.append(np.zeros_like(ink))
            notes.append(f"{region['name']}: uncertain boundary retained for review, not split into fabric.")
            continue
        if any(cutout["confidence"] < MIN_BOUNDARY_CONFIDENCE for cutout in region.get("cutouts", [])):
            masks.append(np.zeros_like(ink))
            notes.append(f"{region['name']}: uncertain hardware opening retained for review, not filled as solid metal.")
            continue
        mask = outline_mask(region, drawing.size)
        for cutout in region.get("cutouts", []):
            mask = mask & ~outline_mask(cutout, drawing.size)
        if int(mask.sum()) < 6:
            raise ValueError(f"Construction outline collapsed: {region['name']}.")
        masks.append(mask)
        edge = mask & ~ndimage.binary_erosion(mask)
        construction |= edge
    # Small raster lettering can resemble stitches even beside real seams.
    # Only source-evidenced visibleEdges may supply interior ink.
    stitches = np.zeros_like(ink)
    for region in manifest["regions"]:
        detail, topstitch = detail_ink(region, drawing.size)
        construction |= detail
        stitches |= topstitch
    return masks, construction & ~stitches, stitches, notes