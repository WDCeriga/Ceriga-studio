"""Post-trace semantic grouping of locally evidenced cells and short gaps (no redraw).

Enclosed cells may be partitioned across source-ink gaps of at most six pixels
at 1024px resolution. These local topology probes preserve the original ink
and exact cell coverage; classification must still confirm sewn boundaries.
Drawstrings and classified closed button/rivet/zip cells are independently
colourable detail parts with applyFabric=False. Only existing enclosed surfaces
are filled; source outlines, open holes and inseparable hardware ink stay original.

API: segment_construction(garment, *, analyst=None, view=None, bridge_pixels=0).
An injected callable receives (technical_image, numbered_overlay, candidates,
view=...). It returns {regions: [...], excluded: [...], warnings: [...]}; regions
select candidateIds, never paths. The default calls configured Astra analysis.
Optional inkLocalizations propose source-pixel zipper bounds, NOT geometry:
{id, label, semanticType: "zip", sourceBounds: [left, top, right, bottom],
 evidence, scope: "teeth-only"|"visible-zip", confidence: 0..1}.
Bounds are half-open in the ORIGINAL trace raster, before canvas letterboxing.
All extracted ink requires review: a box cannot prove semantic ownership.
inkSvg retains original vectors under a pixel ownership clip; maskSvg is its
white-alpha equivalent for recolouring. ownershipSvg is the opaque pixel mask
for removing owned source ink AFTER review (using antialiased maskSvg instead
would leave dark fringes). Neither bounds nor path is a fabric/zipper-tape fill.
constructionInk itself must never be rewritten. Crossing rows remain original.
sourcePlacement reports owned-ink endpoint row centroids and bounding width in
both source pixels and normalized canvas coordinates. It does NOT assert the
full zipper's extent. Preserve-original is the default; full-editor conversion
requires explicit opt-in and complete ownership/extent review first.
API: isolate_source_zips(garment, localizations, *, view=None) augments existing
results without reclassifying or changing fabric/pocket groups or source parts.
CLI: python garment_construction_regions.py input.json --output output.json
     [--analysis analysis.json] [--view front|back] [--overlay overlay.png]
     [--ink-only] (requires --analysis; local review proposals, no provider call)
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import io
import json
import math
import re
from pathlib import Path
from typing import Any, Callable
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

from garment_local_partitions import recover_partitions

CANVAS = 2048
MAX_PIXELS = 24_000_000
MAX_CANDIDATES = 192
SVG_NS = "http://www.w3.org/2000/svg"
EMPTY_SVG = f'<svg xmlns="{SVG_NS}" viewBox="0 0 2048 2048"/>'
REGION_TYPES = {"panel", "waistband", "pocket", "flap", "fly", "belt-loop", "hem", "button", "rivet", "zip",
                "body", "sleeve", "cuff", "collar", "neckband", "hood", "yoke", "placket", "skirt", "lining", "drawstring"}
CATEGORIES = {"fabric-colour", "neck-hood", "sleeves", "hem-cuffs", "pockets-zips", "trims-details", "custom-details"}
HARDWARE = {"button", "rivet", "zip"}
COLOURABLE_TRIM = HARDWARE | {"drawstring"}


class ConstructionRegionError(ValueError):
    """No valid, aligned, source-authoritative traced input is available."""


def _image(url: str) -> Image.Image:
    if not isinstance(url, str) or not url.startswith("data:image/") or ";base64," not in url or len(url) > 80_000_000:
        raise ConstructionRegionError("Expected an embedded source raster, not an external URL.")
    try:
        data = base64.b64decode(url.split(",", 1)[1], validate=True)
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > MAX_PIXELS or min(image.size) < 8:
                raise ConstructionRegionError("Unsupported source raster dimensions.")
            return image.convert("RGBA")
    except (OSError, ValueError) as exc:
        raise ConstructionRegionError("Cannot decode the embedded technical raster.") from exc


def _png_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _render_trace(svg: str, size: tuple[int, int]) -> Image.Image:
    if not isinstance(svg, str) or len(svg) > 24_000_000 or "<!" in svg:
        raise ConstructionRegionError("Expected a bounded standalone traced SVG.")
    try:
        root = ET.fromstring(svg)
        allowed = {"svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"}
        for element in root.iter():
            if element.tag.split("}")[-1] not in allowed:
                raise ConstructionRegionError("Trace must contain only local vector geometry.")
            if any(key.split("}")[-1].lower().startswith(("on", "href")) or "url(" in value.lower()
                   for key, value in element.attrib.items()):
                raise ConstructionRegionError("External or active SVG content is not accepted.")
        box = [float(item) for item in root.get("viewBox", "").replace(",", " ").split()]
        if box != [0, 0, *size]:
            raise ConstructionRegionError("Trace/source coordinate frames differ; refusing realignment by guesswork.")
        import resvg_py
        png = resvg_py.svg_to_bytes(svg_string=svg, width=size[0], height=size[1], skip_system_fonts=True)
        with Image.open(io.BytesIO(png)) as image:
            return image.convert("RGBA")
    except (ET.ParseError, OSError, RuntimeError, ImportError, ValueError) as exc:
        raise ConstructionRegionError(f"Cannot render the authoritative trace locally: {exc}") from exc


def _rings(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """Exact pixel-edge loops, including holes; remove only collinear vertices."""
    padded = np.pad(mask, 1)
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    adjacent = [padded[:-2, 1:-1], padded[1:-1, 2:], padded[2:, 1:-1], padded[1:-1, :-2]]
    for neighbour, (ax, ay, bx, by) in zip(adjacent, [(0, 0, 1, 0), (1, 0, 1, 1), (1, 1, 0, 1), (0, 1, 0, 0)]):
        ys, xs = np.where(mask & ~neighbour)
        for x, y in zip(xs.tolist(), ys.tolist()):
            edges.setdefault((x + ax, y + ay), []).append((x + bx, y + by))
    loops = []
    directions = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    while edges:
        start = next(iter(edges))
        current, direction, ring = start, (1, 0), []
        while True:
            ring.append(current)
            choices = edges.get(current)
            if not choices:
                raise ConstructionRegionError("Local candidate boundary did not close.")
            index = directions.index(direction)
            priorities = [directions[(index + turn) % 4] for turn in (1, 0, -1, 2)]
            nxt = min(choices, key=lambda p: priorities.index((p[0] - current[0], p[1] - current[1])))
            choices.remove(nxt)
            if not choices:
                del edges[current]
            direction = (nxt[0] - current[0], nxt[1] - current[1])
            current = nxt
            if current == start:
                break
        loops.append([point for i, point in enumerate(ring)
                      if (point[0] - ring[i - 1][0]) * (ring[(i + 1) % len(ring)][1] - point[1])
                      != (point[1] - ring[i - 1][1]) * (ring[(i + 1) % len(ring)][0] - point[0])])
    return loops


def _geometry(mask: np.ndarray) -> dict[str, Any]:
    height, width = mask.shape
    scale = CANVAS / max(width, height)
    ox, oy = (CANVAS - width * scale) / 2, (CANVAS - height * scale) / 2
    loops = _rings(mask)
    mapped = [[(ox + x * scale, oy + y * scale) for x, y in ring] for ring in loops]
    path = " ".join("M" + " L".join(f"{x:.8f},{y:.8f}" for x, y in ring) + " Z" for ring in mapped)
    ys, xs = np.where(mask)
    bounds = [(ox + xs.min() * scale) / CANVAS, (oy + ys.min() * scale) / CANVAS,
              (ox + (xs.max() + 1) * scale) / CANVAS, (oy + (ys.max() + 1) * scale) / CANVAS]
    seed_index = int(np.argmax(ndimage.distance_transform_edt(mask)))
    sy, sx = np.unravel_index(seed_index, mask.shape)
    def area(ring):
        return abs(sum(x * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * y for i, (x, y) in enumerate(ring)))
    outline = [[x / CANVAS, y / CANVAS] for x, y in max(mapped, key=area)]
    return {"path": path, "bounds": [float(x) for x in bounds], "outline": outline,
            "seed": [float((ox + (sx + .5) * scale) / CANVAS), float((oy + (sy + .5) * scale) / CANVAS)],
            "area": int(mask.sum())}


def _candidate_cells(ink: np.ndarray, view: str, bridge_pixels: int) -> tuple[np.ndarray, list[dict], list[str]]:
    warnings = []
    envelope = ndimage.binary_fill_holes(ink)
    barriers = ink.copy()
    if bridge_pixels not in (0, 1):
        raise ConstructionRegionError("Only optional one-pixel, enclosed-interior gap bridging is supported.")
    if bridge_pixels:
        # Never repair the silhouette: bridges must already lie inside a closed
        # source contour, have opposite ink neighbours, and be just one pixel.
        p = np.pad(ink, 1)
        bridges = ~ink & envelope & ((p[1:-1, :-2] & p[1:-1, 2:]) | (p[:-2, 1:-1] & p[2:, 1:-1]))
        barriers |= bridges
        if bridges.any():
            warnings.append(f"Bridged {int(bridges.sum())} single-pixel interior gaps; review candidate partitions.")
    labels, _ = ndimage.label(~barriers)
    border_ids = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    sizes = np.bincount(labels.ravel())
    minimum = max(8, int(ink.size * .00001))
    eligible = [i for i in range(1, len(sizes)) if i not in border_ids and sizes[i] >= minimum]
    small_count = sum(1 for i in range(1, len(sizes)) if i not in border_ids and sizes[i] < minimum)
    if small_count:
        warnings.append(f"Omitted {small_count} tiny closed ink fragments; they are not fabric regions.")
    if len(eligible) > MAX_CANDIDATES:
        eligible = sorted(eligible, key=lambda i: (-sizes[i], i))[:MAX_CANDIDATES]
        warnings.append("Candidate limit reached; smallest cells left unassigned rather than inventing groups.")
    labels, recovery = recover_partitions(ink, labels, eligible)
    eligible = sorted(set(eligible) | recovery.keys())
    if recovery:
        count = len({item["sourceLabel"] for item in recovery.values()})
        warnings.append(f"Recovered local short-gap partitions in {count} enclosed cells; original ink and cell coverage unchanged. Review construction evidence before assigning pockets or panels.")
    candidates = []
    for number, label in enumerate(eligible, 1):
        geometry = _geometry(labels == label)
        candidates.append({"id": f"{view}-cell-{number:03d}", "label": str(number), "number": number,
                           **geometry, "confidence": .9 if bridge_pixels or label in recovery else 1.0,
                           **({"boundaryRecovery": recovery[label]} if label in recovery else {}),
                           "regionId": None, "_label": label})
    if not candidates:
        warnings.append("No substantial closed cells found. Open seams and silhouettes were not reconstructed.")
    warnings.append("Only enclosed trace cells are available; open or ambiguous seams are deliberately left undersegmented.")
    return labels, candidates, warnings


def _overlay(technical: Image.Image, labels: np.ndarray, candidates: list[dict], ink: np.ndarray) -> Image.Image:
    page = np.asarray(technical.convert("RGB")).copy()
    height, width = labels.shape
    for item in candidates:
        digest = hashlib.sha256(item["id"].encode()).digest()
        colour = np.array([85 + value % 145 for value in digest[:3]])
        mask = labels == item["_label"]
        page[mask] = (page[mask] * .25 + colour * .75).astype(np.uint8)
    page[ink] = 0
    image = Image.fromarray(page)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=max(11, min(26, round(max(width, height) / 60))))
    longest = max(width, height)
    for item in candidates:
        x, y = item["seed"]
        x, y = x * longest - (longest - width) / 2, y * longest - (longest - height) / 2
        text = item["label"]
        box = draw.textbbox((x, y), text, font=font, anchor="mm")
        draw.rectangle((box[0] - 2, box[1] - 1, box[2] + 2, box[3] + 1), fill="white", outline="black")
        draw.text((x, y), text, fill="black", font=font, anchor="mm")
    return image


def _identifier(view: str, value: object, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or fallback).lower()).strip("-") or fallback
    if slug.startswith(view + "-"):
        slug = slug[len(view) + 1:]
    prefix = f"{view}-{slug}"
    if len(prefix) > 64:
        prefix = prefix[:53].rstrip("-") + "-" + hashlib.sha256(prefix.encode()).hexdigest()[:10]
    return prefix


def _category(kind: str) -> str:
    if kind in {"hood", "collar", "neckband"}:
        return "neck-hood"
    if kind == "sleeve":
        return "sleeves"
    if kind in {"hem", "cuff", "waistband"}:
        return "hem-cuffs"
    if kind in {"pocket", "flap", "placket", "zip", "fly"}:
        return "pockets-zips"
    if kind in HARDWARE | {"belt-loop", "drawstring"}:
        return "trims-details"
    return "fabric-colour"


def _component_defaults(regions: list[dict], view: str) -> None:
    by_id = {region["id"]: region for region in regions}
    for region in regions:
        parent = by_id.get(region.get("parentRegionId"))
        if region["semanticType"] == "panel" and parent and parent["semanticType"] == "sleeve":
            region["builderCategory"] = "sleeves"
        elif region["semanticType"] == "pocket":
            region["builderCategory"] = "pockets-zips"
        if region["semanticType"] == "lining" and region["builderCategory"] == "neck-hood":
            region["colourGroupId"] = _identifier(view, "colour-inner-hood", "colour")
        elif region["semanticType"] == "hem":
            region["colourGroupId"] = _identifier(view, "colour-bottom-hem", "colour")
    for field in ("colourGroupId", "fabricGroupId"):
        categories: dict[str, set[str]] = {}
        for region in regions:
            categories.setdefault(region[field], set()).add(region["builderCategory"])
        for region in regions:
            if len(categories[region[field]]) > 1:
                region[field] = _identifier(view, f'{region[field]}-{region["builderCategory"]}', field)


def _default_analyst(technical: Image.Image, overlay: Image.Image, candidates: list[dict], *, view: str) -> dict:
    import lineart
    from asset_providers import AstraProvider
    return AstraProvider(lineart.load_secrets()).analyzeConstructionRegions(technical, overlay, candidates, view=view)


def _classify(analysis: object, candidates: list[dict], labels: np.ndarray, view: str) -> tuple[list[dict], list[dict], list[str]]:
    if not isinstance(analysis, dict) or not isinstance(analysis.get("regions"), list) or len(analysis["regions"]) > 64:
        raise ValueError("Semantic analysis must return at most 64 construction groups.")
    available = {item["id"]: item for item in candidates}
    claimed: set[str] = set()
    excluded: set[str] = set()
    for item in analysis.get("excluded", []):
        if not isinstance(item, dict) or not isinstance(item.get("candidateIds"), list):
            raise ValueError("Invalid excluded candidate classification.")
        excluded.update(item["candidateIds"])
    if not excluded <= available.keys():
        raise ValueError("Analysis excluded unknown candidate IDs.")
    output, hardware, warnings, ids = [], [], [], set()
    raw_ids = {}
    for index, group in enumerate(analysis["regions"]):
        if not isinstance(group, dict):
            raise ValueError("Malformed construction group.")
        candidate_ids = group.get("candidateIds")
        if not isinstance(candidate_ids, list) or not candidate_ids or any(not isinstance(i, str) for i in candidate_ids):
            raise ValueError("Construction group must select explicit candidate IDs.")
        chosen = set(candidate_ids)
        if len(chosen) != len(candidate_ids) or not chosen <= available.keys() or chosen & (claimed | excluded):
            raise ValueError("Unknown, repeated, overlapping or excluded candidate assignments.")
        claimed.update(chosen)
        kind = group.get("semanticType")
        confidence = group.get("confidence")
        if kind not in REGION_TYPES or isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("Invalid semantic type or confidence.")
        label, evidence = group.get("label"), group.get("evidence")
        if not isinstance(label, str) or not label.strip() or len(label) > 160 or not isinstance(evidence, str) or not evidence.strip() or len(evidence) > 2400:
            raise ValueError("Every construction group needs a label and visible construction evidence.")
        if confidence < .8:
            warnings.append(f"{label}: confidence below .8; retained cells but no fabric installed.")
            continue
        if group.get("editableIndependently", True) is not True and kind not in HARDWARE:
            warnings.append(f"{label}: decorative/non-editable classification; retained as original ink only.")
            continue
        mask = np.isin(labels, [available[i]["_label"] for i in chosen])
        if kind in {"body", "panel", "yoke", "sleeve", "hood", "skirt", "lining"} and int(mask.sum()) < max(32, labels.size * .00015):
            warnings.append(f"{label}: too small for a meaningful fabric panel; fragment left unassigned.")
            continue
        identifier = _identifier(view, group.get("id"), f"region-{index + 1}")
        if identifier in ids:
            raise ValueError("Construction group IDs collide after normalization.")
        ids.add(identifier)
        raw_ids[str(group.get("id", identifier))] = identifier
        geometry = _geometry(mask)
        category = group.get("builderCategory", _category(kind))
        if category not in CATEGORIES:
            raise ValueError("Unknown builder category.")
        region = {"id": identifier, "label": label.strip(), "semanticType": kind, "builderCategory": category,
                  "view": view, **geometry, "confidence": min(confidence, *(available[i]["confidence"] for i in chosen)),
                  "parentRegionId": group.get("parentRegionId"), "mirroredPairId": group.get("mirroredPairId"),
                  "colourGroupId": _identifier(view, "colour-" + str(group.get("colourGroupId") or identifier), "colour"),
                  "fabricGroupId": _identifier(view, "fabric-" + str(group.get("fabricGroupId") or identifier), "fabric"),
                  "editableIndependently": True, "colorable": True, "zIndex": len(output) + len(hardware), "candidateIds": sorted(chosen),
                  "evidence": evidence.strip(), "material": str(group.get("material") or "unknown")[:160],
                  "applyFabric": kind not in COLOURABLE_TRIM,
                  "geometryRole": "closed-source-cell"}
        for candidate_id in chosen:
            available[candidate_id]["regionId"] = identifier
        (hardware if kind in HARDWARE else output).append(region)
    valid = {region["id"]: region for region in output + hardware}
    for region in valid.values():
        for field in ("parentRegionId", "mirroredPairId"):
            value = region[field]
            region[field] = raw_ids.get(str(value), value) if isinstance(value, str) else None
            if region[field] not in valid or region[field] == region["id"]:
                region[field] = None
    for region in valid.values():
        partner = valid.get(region["mirroredPairId"])
        if partner is not None and (partner["mirroredPairId"] != region["id"] or partner["semanticType"] != region["semanticType"]):
            region["mirroredPairId"] = None
    _component_defaults(output + hardware, view)
    unassigned = available.keys() - claimed - excluded
    if unassigned:
        warnings.append(f"{len(unassigned)} candidate cells were not classified; no fills invented for them.")
    warnings.extend(note[:600] for note in analysis.get("warnings", []) if isinstance(note, str))
    for candidate in candidates:
        candidate["classification"] = "excluded" if candidate["id"] in excluded else "assigned" if candidate["regionId"] else "unassigned"
    return output, hardware, warnings


def _part(region: dict, garment_id: str) -> dict:
    bounds = region["bounds"]
    return {**copy.deepcopy(region), "name": region["label"], "userFacingName": region["label"],
            "colorable": True, "structural": region["semanticType"] not in COLOURABLE_TRIM,
            "layerKind": "detail" if region["semanticType"] in COLOURABLE_TRIM else "structural", "structuralRole": region["semanticType"],
            "attachmentTo": region["parentRegionId"], "symmetryPartner": region["mirroredPairId"],
            "colourGroup": region["colourGroupId"], "measurementRole": "none",
            "boundary": {"boundaryType": "panel-edge", "confidence": region["confidence"], "evidence": region["evidence"]},
            "svg": f'<svg xmlns="{SVG_NS}" viewBox="0 0 2048 2048"><path d="{region["path"]}" fill="#ffffff" fill-rule="evenodd"/></svg>',
            "constructionSvg": EMPTY_SVG, "stitchSvg": EMPTY_SVG, "color": "#ffffff", "parentGarment": garment_id,
            "layerOrder": region["zIndex"], "geometryBounds": bounds,
            "measurement": {"unit": "relative", "width": bounds[2] - bounds[0], "height": bounds[3] - bounds[1]},
            "transform": {"x": 0, "y": 0, "scale": 1, "rotation": 0}, "constructionRegionVersion": 1}


def _source_context(garment: dict, view: str | None) -> tuple:
    if not isinstance(garment, dict) or garment.get("ok") is False or garment.get("constructionVersion") != 2:
        raise ConstructionRegionError("A valid constructionVersion 2 traced garment is required.")
    manifest = garment.get("manifest", {})
    view = view or manifest.get("view")
    if view not in {"front", "back"}:
        raise ConstructionRegionError("An explicit front or back view is required.")
    metadata = manifest.get(f"{view}View", {})
    if metadata.get("inference"):
        raise ConstructionRegionError("Estimated views are not source-evidenced construction traces.")
    preview = metadata.get("tracePreview") or (garment.get("tracePreview") if view == manifest.get("view") else None)
    if not isinstance(preview, dict) or not isinstance(preview.get("tracedSvg"), str):
        raise ConstructionRegionError("This view has no authoritative tracePreview.tracedSvg.")
    source_ink = [part for part in garment.get("parts", []) if part.get("view") == view and part.get("structuralRole") == "source-ink"]
    if not source_ink or not all(part.get("constructionSvg") for part in source_ink):
        raise ConstructionRegionError("The unchanged source-ink construction layer is required.")
    technical_url = preview.get("cleanedRaster") or preview.get("technicalRaster") or preview.get("sourceRaster")
    technical = _image(technical_url)
    rendered = _render_trace(preview["tracedSvg"], technical.size)
    return view, metadata, preview, technical_url, technical, source_ink, rendered


def _ink_review_contract(width: int, height: int) -> dict:
    return {"version": 1, "status": "needs-review", "coordinateFrame": "source-pixels",
            "sourceWidth": width, "sourceHeight": height, "boundsConvention": "half-open",
            "localizationField": "inkLocalizations", "semanticTypes": ["zip"],
            "automaticOwnershipProven": False,
            "requiredFields": ["id", "label", "semanticType", "sourceBounds", "evidence", "scope", "confidence"],
            "instruction": "Localize only visible zipper ink, not tape, fabric or seams. Review exact owned ink, endpoints and omitted junctions before masking the displayed source layer. Never use bounds/path as a colour fill."}


def _clipped_ink_svg(construction_ink: str, path: str, identifier: str, *, white: bool = False) -> str:
    clip_id, filter_id = identifier + "-clip", identifier + "-alpha"
    filter_definition = (f'<filter id="{filter_id}" filterUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048">'
                         '<feFlood flood-color="white"/><feComposite in2="SourceGraphic" operator="in"/></filter>') if white else ""
    content = f'<g filter="url(#{filter_id})">{construction_ink}</g>' if white else construction_ink
    return (f'<svg xmlns="{SVG_NS}" width="2048" height="2048" viewBox="0 0 2048 2048">'
            f'<defs><clipPath id="{clip_id}" clipPathUnits="userSpaceOnUse"><path d="{path}" clip-rule="evenodd" shape-rendering="crispEdges"/>'
            f'</clipPath>{filter_definition}</defs><g clip-path="url(#{clip_id})">{content}</g></svg>')


def _ink_placement(selected: np.ndarray) -> dict:
    height, width = selected.shape
    ys, xs = np.where(selected)
    top, bottom = int(ys.min()), int(ys.max())
    start = [float(np.mean(np.flatnonzero(selected[top]))) + .5, top + .5]
    end = [float(np.mean(np.flatnonzero(selected[bottom]))) + .5, bottom + .5]
    ink_width = int(xs.max() - xs.min() + 1)
    longest = max(width, height)
    ox, oy = (longest - width) / 2, (longest - height) / 2
    return {"method": "owned-ink-endpoint-row-centroids-v1", "extent": "owned-ink-only",
            "coordinateFrame": "normalized-canvas", "canvasSize": CANVAS,
            "start": [(start[0] + ox) / longest, (start[1] + oy) / longest],
            "end": [(end[0] + ox) / longest, (end[1] + oy) / longest], "width": ink_width / longest,
            "sourcePixels": {"start": start, "end": end, "width": ink_width},
            "fullClosureExtentVerified": False}


def isolate_source_zips(garment: dict, localizations: object, *, view: str | None = None) -> dict:
    """Propose bounded source-ink ownership; never certify a semantic box as safe.

    Original vector geometry is reused, not traced/replaced. Side-contact rows
    (plus a two-source-pixel guard at 1024px) are withheld to avoid recolouring
    crossing seams. End-contact rows are withheld too. The remaining selection
    is explicitly partial/review-only, even if no junction was detected.
    """
    view, metadata, preview, _, technical, source_parts, rendered = _source_context(garment, view)
    if not isinstance(localizations, list) or len(localizations) > 16:
        raise ConstructionRegionError("Expected at most 16 structured ink localizations.")
    construction_ink = metadata.get("lineArtSvg") or garment.get("lineArtSvg") or source_parts[0]["constructionSvg"]
    existing = metadata.get("constructionRegions") or (garment.get("constructionRegions") if view == garment["manifest"].get("view") else None) or {}
    if existing.get("constructionInk", construction_ink) != construction_ink:
        raise ConstructionRegionError("Construction ink differs from the authoritative source layer.")
    # Verify the displayed source layer, not just a possibly stale trace preview.
    displayed = np.asarray(_render_trace(construction_ink, (CANVAS, CANVAS)))
    if len(source_parts) != 1 or not np.array_equal(displayed, np.asarray(_render_trace(source_parts[0]["constructionSvg"], (CANVAS, CANVAS)))):
        raise ConstructionRegionError("The displayed source-ink part must match constructionInk before ownership can be proposed.")
    scale = CANVAS / max(technical.size)
    ox, oy = (CANVAS - technical.width * scale) / 2, (CANVAS - technical.height * scale) / 2
    normalized = (f'<svg xmlns="{SVG_NS}" width="2048" height="2048" viewBox="0 0 2048 2048">'
                  f'<g transform="translate({ox:.16g},{oy:.16g}) scale({scale:.16g})">{preview["tracedSvg"]}</g></svg>')
    if not np.array_equal(displayed, np.asarray(_render_trace(normalized, (CANVAS, CANVAS)))):
        raise ConstructionRegionError("Displayed construction ink and trace preview do not match; review alignment first.")
    rgba = np.asarray(rendered)
    ink = (rgba[:, :, 3] > 0) & (rgba[:, :, :3].min(axis=2) < 128)
    height, width = ink.shape
    guard = max(1, math.ceil(max(width, height) / 512))
    claimed = np.zeros_like(ink)
    extractions, identifiers = [], set()
    for item in localizations:
        allowed = {"id", "label", "semanticType", "sourceBounds", "evidence", "scope", "confidence"}
        if not isinstance(item, dict) or set(item) != allowed or item.get("semanticType") != "zip":
            raise ConstructionRegionError("Ink localization must contain only the documented zipper review fields, never paths or acceptance flags.")
        bounds = item["sourceBounds"]
        if not isinstance(bounds, list) or len(bounds) != 4 or any(type(v) is not int for v in bounds):
            raise ConstructionRegionError("Zipper bounds must be four integer source-pixel edges.")
        left, top, right, bottom = bounds
        if not (0 < left < right < width and 0 < top < bottom < height):
            raise ConstructionRegionError("Zipper extent must be strictly inside the source raster.")
        if right - left > min(width * .12, (bottom - top) / 4) or bottom - top < 8:
            raise ConstructionRegionError("Only narrow vertical zipper extents are supported; broad fabric strips require manual review.")
        confidence = item["confidence"]
        if type(confidence) not in (int, float) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ConstructionRegionError("Invalid zipper localization confidence.")
        if item["scope"] not in {"teeth-only", "visible-zip"}:
            raise ConstructionRegionError("Zipper localization needs an explicit visible-ink scope.")
        for field, limit in (("id", 64), ("label", 160), ("evidence", 2400)):
            if not isinstance(item[field], str) or not item[field].strip() or len(item[field]) > limit:
                raise ConstructionRegionError("Zipper localization requires bounded identity, label and source evidence.")
        identifier = _identifier(view, "ink-" + item["id"], "zip")
        if identifier in identifiers:
            raise ConstructionRegionError("Duplicate zipper localization IDs.")
        identifiers.add(identifier)
        selected = np.zeros_like(ink)
        selected[top:bottom, left:right] = ink[top:bottom, left:right]
        proposal_count = int(selected.sum())
        outside = ink.copy()
        outside[top:bottom, left:right] = False
        contact = selected & ndimage.binary_dilation(outside, structure=np.ones((3, 3), dtype=bool))
        contact_rows = contact.any(axis=1)
        excluded_rows = ndimage.binary_dilation(contact_rows, iterations=guard)
        selected[excluded_rows] = False
        owned_count = int(selected.sum())
        if not owned_count:
            raise ConstructionRegionError("No zipper ink remains after withholding source-connected seam/end junctions; refine localization.")
        if (claimed & selected).any():
            raise ConstructionRegionError("Zipper proposals cannot own overlapping source ink.")
        claimed |= selected
        geometry = _geometry(selected)
        digest = hashlib.sha256(selected.tobytes()).hexdigest()
        entry = {"id": identifier, "label": item["label"].strip(), "semanticType": "zip", "view": view,
                 "builderCategory": "pockets-zips", "applyFabric": False, "editableIndependently": False,
                 "reviewStatus": "needs-review", "sourceBounds": bounds.copy(), "scope": item["scope"],
                 "evidence": item["evidence"].strip(), "confidence": confidence, **geometry,
                 "inkSvg": _clipped_ink_svg(construction_ink, geometry["path"], identifier + "-" + digest[:12]),
                 "maskSvg": _clipped_ink_svg(construction_ink, geometry["path"], identifier + "-" + digest[:12], white=True),
                 "ownershipSvg": f'<svg xmlns="{SVG_NS}" width="2048" height="2048" viewBox="0 0 2048 2048"><path d="{geometry["path"]}" fill="white" fill-rule="evenodd" shape-rendering="crispEdges"/></svg>',
                 "geometryRole": "source-ink-only", "coverage": "partial-review-proposal",
                 "sourcePlacement": _ink_placement(selected),
                 "conversion": {"defaultMode": "preserve-original", "requiresExplicitOptIn": True,
                                "status": "requires-complete-source-review", "canHideWholeOriginal": False,
                                "sourceRemovalSvgField": "ownershipSvg",
                                "reason": "This proposal owns partial visible ink, not a verified full zipper. Confirm complete pull, stopper and junction ownership and full endpoints before full-editor conversion."},
                 "provenance": {"method": "bounded-original-vector-ink-clip-v1", "traceSha256": hashlib.sha256(preview["tracedSvg"].encode()).hexdigest(),
                                "constructionInkSha256": hashlib.sha256(construction_ink.encode()).hexdigest(),
                                "ownershipSha256": digest, "sourceWidth": width, "sourceHeight": height,
                                "sourcePartIds": [part["id"] for part in source_parts],
                                "localizedPixelCount": proposal_count, "ownedPixelCount": owned_count,
                                "withheldPixelCount": proposal_count - owned_count, "junctionGuardPixels": guard,
                                "excludedJunctionRows": (np.flatnonzero(excluded_rows[top:bottom]) + top).tolist(),
                                "externalGeometryUsed": False, "originalVectorsReused": True, "automaticOwnershipProven": False},
                 "reviewReasons": ["A localization box does not prove which ink belongs to the zipper. Confirm all selected fragments against the source before enabling recolouring.",
                                   "Crossing/end-contact rows are withheld, not reconstructed. Unselected pull, stopper, rails and seams remain original ink."]}
        extractions.append(entry)
    result = copy.deepcopy(garment)
    construction = copy.deepcopy(existing)
    construction.setdefault("version", 1)
    construction["status"] = "needs-review"
    for field in ("regions", "hardware", "warnings"):
        construction.setdefault(field, [])
    construction["constructionInk"] = construction_ink
    construction["inkExtractions"] = extractions
    construction["inkLocalizationReview"] = _ink_review_contract(width, height)
    closures = [entry for entry in construction.get("closures", []) if not entry.get("inkExtractionId")]
    closures.extend({key: copy.deepcopy(entry[key]) for key in ("id", "label", "semanticType", "builderCategory", "view", "reviewStatus", "editableIndependently", "applyFabric", "bounds", "scope", "sourcePlacement", "conversion")} |
                    {"inkExtractionId": entry["id"], "geometryRole": "source-ink-only"} for entry in extractions)
    construction["closures"] = closures
    result["manifest"].setdefault(f"{view}View", {"view": view})["constructionRegions"] = copy.deepcopy(construction)
    if view == result["manifest"].get("view"):
        result["constructionRegions"] = construction
    return result


def segment_construction(garment: dict, *, analyst: Callable[..., dict] | None = None,
                         view: str | None = None, bridge_pixels: int = 0) -> dict:
    """Augment a valid trace without mutating it. Semantic failures fail closed.

    Invalid source/geometry raises ConstructionRegionError before any provider
    call. Analysis failure returns a needs-review object with no guessed fills.
    Candidate paths and preview rasters are retained for source-evidenced review.
    """
    view, metadata, _, technical_url, technical, source_ink, rendered = _source_context(garment, view)
    rgba = np.asarray(rendered)
    ink = (rgba[:, :, 3] >= 128) & (rgba[:, :, :3].min(axis=2) < 128)
    labels, candidates, warnings = _candidate_cells(ink, view, bridge_pixels)
    overlay = _overlay(technical, labels, candidates, ink)
    regions, hardware = [], []
    analysis = None
    if candidates or analyst is not None:
        try:
            public = [{key: value for key, value in item.items() if key not in {"_label", "path", "outline", "regionId"}} for item in candidates]
            analysis = (analyst or _default_analyst)(technical.convert("RGB"), overlay, public, view=view)
            regions, hardware, notes = _classify(analysis, candidates, labels, view)
            warnings.extend(notes)
        except Exception as exc:
            # Never expose transport payloads/secrets or invent a fallback panel.
            warnings.append(f"Construction semantic analysis failed ({type(exc).__name__}); no fabric regions installed. Retry analysis or review retained cells.")
            for candidate in candidates:
                candidate["regionId"] = None
                candidate["classification"] = "unassigned"
    warnings.append("Stitching could not be separated reliably: all original seam/stitch/detail ink is preserved unchanged above fills; stitchingPaths is empty.")
    construction = {"version": 1, "status": "needs-review", "regions": regions,
                    "inkExtractions": [], "inkLocalizationReview": _ink_review_contract(technical.width, technical.height),
                    "constructionInk": metadata.get("lineArtSvg") or garment.get("lineArtSvg") or source_ink[0]["constructionSvg"],
                    "stitchingPaths": [], "hardware": hardware,
                    "closures": [copy.deepcopy(item) for item in hardware if item["semanticType"] == "zip"],
                    "seams": [], "warnings": warnings,
                    "candidates": [{key: value for key, value in item.items() if key != "_label"} for item in candidates],
                    "candidateOverlay": _png_url(overlay), "technicalRaster": technical_url,
                    "geometry": {"method": "closed-trace-cells-v1", "localRecovery": "short-source-ink-gaps-v1", "sourceWidth": technical.width,
                                 "sourceHeight": technical.height, "frame": CANVAS, "bridgePixels": bridge_pixels,
                                 "fillRule": "evenodd", "externalGeometryUsed": False}}
    result = copy.deepcopy(garment)
    retained = [part for part in result["parts"] if not (part.get("view") == view and part.get("constructionRegionVersion") == 1)]
    garment_id = source_ink[0].get("parentGarment", "")
    parts = [_part(region, garment_id) for region in regions + hardware]
    result["parts"] = retained + parts
    highest = max((part.get("layerOrder", 0) for part in result["parts"] if part.get("structuralRole") != "source-ink"), default=0) + 1
    for part in result["parts"]:
        if part.get("structuralRole") == "source-ink":
            part["layerOrder"] = highest
    result["partCount"] = len(result["parts"])
    result["constructionRegions"] = construction
    result_manifest = result["manifest"]
    view_metadata = result_manifest.setdefault(f"{view}View", {"view": view})
    view_metadata["constructionRegions"] = copy.deepcopy(construction)
    view_metadata["partIds"] = [part["id"] for part in result["parts"] if part.get("view") == view]
    result_manifest["regions"] = [copy.deepcopy(part) for part in result["parts"]]
    result_manifest["builderCategories"] = sorted({part["builderCategory"] for part in result["parts"] if part.get("builderCategory")})
    result_manifest["structuralParts"] = [part["id"] for part in result["parts"] if part.get("structural")]
    for property_name, key in (("colourGroups", "colourGroupId"), ("fabricGroups", "fabricGroupId")):
        groups = {}
        for part in result["parts"]:
            if part.get(key):
                groups.setdefault(part[key], {"id": part[key], "partIds": []})["partIds"].append(part["id"])
        result_manifest[property_name] = list(groups.values())
    if isinstance(analysis, dict) and "inkLocalizations" in analysis:
        try:
            result = isolate_source_zips(result, analysis["inkLocalizations"], view=view)
        except ConstructionRegionError:
            note = "Zipper localization failed source-ownership validation; review source-pixel bounds. Original ink and fabric groups were retained."
            result["constructionRegions"]["warnings"].append(note)
            result["manifest"][f"{view}View"]["constructionRegions"]["warnings"].append(note)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, help="Save result JSON; otherwise stream an NDJSON result")
    parser.add_argument("--analysis", type=Path, help="Replay semantic JSON locally without calling Astra")
    parser.add_argument("--view", choices=("front", "back"))
    parser.add_argument("--overlay", type=Path)
    parser.add_argument("--bridge-pixels", type=int, choices=(0, 1), default=0)
    parser.add_argument("--ink-only", action="store_true", help="Augment an existing result with reviewed-localization proposals only; no provider or fabric regrouping")
    args = parser.parse_args()
    if args.ink_only and (not args.analysis or args.overlay or args.bridge_pixels):
        parser.error("--ink-only requires --analysis and cannot regenerate an overlay or bridge cells")
    analyst = None
    analysis = {}
    if args.analysis:
        analysis = json.loads(args.analysis.read_text(encoding="utf-8-sig"))
        analyst = lambda *a, **kw: analysis
    garment = json.loads(args.input.read_text(encoding="utf-8-sig"))
    result = (isolate_source_zips(garment, analysis.get("inkLocalizations"), view=args.view) if args.ink_only else
              segment_construction(garment, analyst=analyst, view=args.view, bridge_pixels=args.bridge_pixels))
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    if args.overlay:
        _image(result["constructionRegions"]["candidateOverlay"]).save(args.overlay)
    if args.output:
        print(json.dumps({"output": str(args.output), "regions": len(result["constructionRegions"]["regions"]),
                          "inkExtractions": len(result["constructionRegions"].get("inkExtractions", [])),
                          "warnings": result["constructionRegions"]["warnings"]}))
    else:
        print(json.dumps({**result, "type": "result", "ok": True}, ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    main()
