"""Offline, source-authoritative mockup tracing; no providers or reconstruction.

API: trace_only(source_bytes, view='front', *, inputDetection=None) returns the
ImportedGarment wire shape plus processingMode, inputDetection and tracePreview.
The legacy source discriminator is compatibility-only, not a claim of AI use.
Raster previews are PNG data URLs; tracedSvg is markup in source coordinates.
Builder SVGs uniformly letterbox that same trace into a 2048 square. Source
manifest coordinates are source-normalized; manifest/part coordinates are
builder-normalized. Nothing is cropped, mirrored, repaired, or reinterpreted.

Closed white regions cannot locally be distinguished from fabric, openings or
printed marks. They are measured but deliberately NOT filled. One non-colourable
source-ink part retains all traced ink (including stitches); its evidence outline
is the observed exterior of the largest closed ink component, not a fitted box.
Boundary confidence describes raster support, never semantic garment certainty.
Unclosed, blank and rectangular-only inputs fail closed rather than inventing an
outline to satisfy the editor's construction gate. Acceptance remains manual.

Potrace uses binary stdin/stdout, with no scratch files. resvg_py is optional for
independent raster fidelity measurements. Without it overlayRaster is null and
metrics explicitly say unverified, rather than substituting the input as proof.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import io
import os
from pathlib import Path
import shutil
import subprocess
from typing import Any
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

CONTRAST = 1.35
WHITE_CUTOFF = 246
INK_CUTOFF = 120
TRACE_SS = 3
CANVAS = 2048
MAX_PIXELS = 24_000_000
SVG_NS = "http://www.w3.org/2000/svg"


class TraceOnlyError(ValueError):
    """Source or trace cannot safely be installed as source-evidenced geometry."""


def _decode(source_bytes: bytes) -> Image.Image:
    if not isinstance(source_bytes, bytes) or not source_bytes:
        raise TraceOnlyError("Expected non-empty source image bytes.")
    try:
        with Image.open(io.BytesIO(source_bytes)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise TraceOnlyError("Source image exceeds 24 megapixels.")
            if min(image.size) < 8:
                raise TraceOnlyError("Source image is too small to evidence an outline.")
            if getattr(image, "n_frames", 1) != 1:
                raise TraceOnlyError("Animated or multi-frame sources are not supported.")
            # Stored pixels and dimensions are authoritative, including EXIF orientation.
            rgba = image.convert("RGBA")
            return Image.alpha_composite(Image.new("RGBA", image.size, "white"), rgba).convert("RGB")
    except (OSError, Image.DecompressionBombError) as error:
        raise TraceOnlyError(f"Cannot decode source image: {error}") from error


def detect_input(photo: Image.Image | bytes) -> dict[str, Any]:
    """Conservative local screening only; 'photo' never invokes an external API.

    Ambiguous monochrome artwork stays local. A photo classification requires
    continuous tone, foreground colour or broad dark surfaces; confidence is
    heuristic, not calibrated. Blank monochrome inputs stay local and fail tracing.
    """
    if isinstance(photo, bytes):
        rgb = _decode(photo)
    elif isinstance(photo, Image.Image):
        rgb = Image.alpha_composite(Image.new("RGBA", photo.size, "white"), photo.convert("RGBA")).convert("RGB")
    else:
        raise TraceOnlyError("Expected image bytes or a PIL image.")
    sample = rgb.copy()
    sample.thumbnail((768, 768))
    pixels = np.asarray(sample).astype(np.int16)
    grey = np.asarray(sample.convert("L"))
    white = float(np.mean(grey >= WHITE_CUTOFF))
    mid = float(np.mean((grey > INK_CUTOFF) & (grey < WHITE_CUTOFF)))
    chroma = float(np.mean(np.ptp(pixels, axis=2) > 24))
    continuous = float(np.mean((grey > 30) & (grey < 240)))
    dark = grey <= INK_CUTOFF
    dark_fraction = float(np.mean(dark))
    thick_fraction = float(np.mean(ndimage.distance_transform_edt(dark)[dark] > 2.5)) if dark.any() else 0.0
    enclosed_fraction = float(np.mean(ndimage.binary_fill_holes(dark) & ~dark))
    coloured_reference = chroma > .01 and chroma / max(1 - white, .001) > .2
    broad_dark_surface = .03 < dark_fraction < .97 and thick_fraction > .55
    photographic = (mid > .30 and white < .60) or coloured_reference or broad_dark_surface
    if photographic:
        mode, confidence = "photo", .8
        reason = "Continuous tone, coloured foreground or broad filled surfaces suggest a photo/reference rather than construction line art."
    else:
        mode = "trace-only"
        confidence = .95 if white > .75 and mid < .15 and chroma < .01 and enclosed_fraction > .02 and thick_fraction < .35 else .55
        reason = "Sparse thin monochrome lines enclosing shapes on a light field." if confidence > .9 else "Ambiguous artwork: check the input type; conservative local tracing is suggested, not a confident technical-drawing classification."
    return {"mode": mode, "confidence": confidence, "reason": reason,
            "method": "local-raster-statistics-v2", "whiteFraction": white,
            "midtoneFraction": mid, "chromaFraction": chroma,
            "indicators": {"continuousToneFraction": continuous, "darkFraction": dark_fraction,
                           "thickInkFraction": thick_fraction, "enclosedWhiteFraction": enclosed_fraction,
                           "colouredReference": coloured_reference, "broadDarkSurface": broad_dark_surface},
            "limitations": "Raster screening is not semantic person/mannequin detection. Confirm ambiguous sources using the manual override."}


def _key(cleaned: Image.Image) -> Image.Image:
    alpha_lut = [0 if lum >= WHITE_CUTOFF else 255 if lum <= INK_CUTOFF else
                 round((WHITE_CUTOFF - lum) * 255 / (WHITE_CUTOFF - INK_CUTOFF))
                 for lum in range(256)]
    keyed = Image.new("RGBA", cleaned.size, (0, 0, 0, 0))
    keyed.putalpha(cleaned.convert("L").point(alpha_lut))
    return keyed


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _data_url(image: Image.Image) -> str:
    return "data:image/png;base64," + base64.b64encode(_png(image)).decode("ascii")


def _identity(prefix: str, payload: bytes) -> str:
    return prefix + "-" + hashlib.sha256(payload).hexdigest()


def _potrace_executable() -> str:
    local = Path(__file__).resolve().parents[2] / ".venv" / "tools" / "potrace-1.16.win64" / "potrace.exe"
    for candidate in (os.environ.get("POTRACE_EXE"), os.environ.get("POTRACE"), str(local), shutil.which("potrace")):
        if candidate and Path(candidate).is_file():
            return str(candidate)
    raise TraceOnlyError("Potrace is missing; set POTRACE_EXE to the installed executable.")


def _trace(alpha: Image.Image) -> tuple[str, int]:
    width, height = alpha.size
    upsampled = alpha.resize((width * TRACE_SS, height * TRACE_SS), Image.Resampling.LANCZOS)
    ink = np.asarray(upsampled) >= 128
    # PBM black is foreground. High keyed alpha must become BLACK, not white.
    bitmap = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).convert("1", dither=Image.Dither.NONE)
    buffer = io.BytesIO()
    bitmap.save(buffer, format="PPM")
    try:
        completed = subprocess.run([
            _potrace_executable(), "--svg", "--longcoding", "--unit", "10",
            "--turnpolicy", "minority", "--turdsize", "4", "--alphamax", "1",
            "--opttolerance", "0.2", "--output", "-", "-",
        ], input=buffer.getvalue(), capture_output=True, timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise TraceOnlyError(f"Local Potrace failed: {error}") from error
    if completed.returncode:
        raise TraceOnlyError("Local Potrace failed: " + completed.stderr.decode("utf-8", errors="replace")[:500])
    try:
        root = ET.fromstring(completed.stdout)
    except ET.ParseError as error:
        raise TraceOnlyError("Potrace returned invalid SVG.") from error
    paths = [element.attrib["d"] for element in root.iter(f"{{{SVG_NS}}}path") if element.get("d", "").strip()]
    if not paths:
        raise TraceOnlyError("Potrace produced no ink paths.")
    svg = ET.Element("svg", {"xmlns": SVG_NS, "width": str(width), "height": str(height),
                             "viewBox": f"0 0 {width} {height}", "preserveAspectRatio": "xMidYMid meet"})
    group = ET.SubElement(svg, "g", {"transform": f"translate(0,{height}) scale({1 / 30:.16g}, {-1 / 30:.16g})",
                                    "fill": "#000000", "stroke": "none", "fill-rule": "evenodd"})
    for path in paths:
        ET.SubElement(group, "path", {"d": path, "fill-rule": "evenodd"})
    return ET.tostring(svg, encoding="unicode"), len(paths)


def _builder_svg(source_svg: str, size: tuple[int, int]) -> str:
    width, height = size
    scale = CANVAS / max(size)
    x, y = (CANVAS - width * scale) / 2, (CANVAS - height * scale) / 2
    # Nest the source SVG intact: both native Potrace inversion and path data survive.
    return (f'<svg xmlns="{SVG_NS}" width="2048" height="2048" viewBox="0 0 2048 2048">'
            f'<g transform="translate({x:.16g},{y:.16g}) scale({scale:.16g})">{source_svg}</g></svg>')


def _raster_outline(mask: np.ndarray) -> list[list[int]]:
    """Walk exterior pixel edges, removing only exactly collinear vertices."""
    padded = np.pad(mask, 1)
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    neighbours = [padded[:-2, 1:-1], padded[1:-1, 2:], padded[2:, 1:-1], padded[1:-1, :-2]]
    offsets = [(0, 0, 1, 0), (1, 0, 1, 1), (1, 1, 0, 1), (0, 1, 0, 0)]
    for adjacent, (ax, ay, bx, by) in zip(neighbours, offsets):
        ys, xs = np.where(mask & ~adjacent)
        for x, y in zip(xs.tolist(), ys.tolist()):
            edges.setdefault((x + ax, y + ay), []).append((x + bx, y + by))
    start = min(edges, key=lambda point: (point[1], point[0]))
    ring = [start]
    current, direction = start, (1, 0)
    directions = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    for _ in range(sum(map(len, edges.values())) + 1):
        candidates = edges.get(current, [])
        if not candidates:
            raise TraceOnlyError("Source boundary is not a closed raster contour.")
        index = directions.index(direction)
        priorities = [directions[(index + turn) % 4] for turn in (1, 0, -1, 2)]
        nxt = min(candidates, key=lambda point: priorities.index((point[0] - current[0], point[1] - current[1])))
        direction = (nxt[0] - current[0], nxt[1] - current[1])
        current = nxt
        if current == start:
            break
        ring.append(current)
    else:
        raise TraceOnlyError("Source boundary walk did not close.")
    simplified = []
    for i, point in enumerate(ring):
        previous, following = ring[i - 1], ring[(i + 1) % len(ring)]
        if (point[0] - previous[0]) * (following[1] - point[1]) != (point[1] - previous[1]) * (following[0] - point[0]):
            simplified.append(list(point))
    return simplified


def _source_boundary(ink: np.ndarray) -> tuple[list[list[int]], dict[str, Any]]:
    if not ink.any():
        raise TraceOnlyError("Blank source: no ink to trace.")
    labels, count = ndimage.label(ink)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    primary = labels == int(sizes.argmax())
    envelope = ndimage.binary_fill_holes(primary)
    interior = envelope & ~primary
    if int(interior.sum()) < max(64, ink.size * .005):
        raise TraceOnlyError("No substantial source-evidenced closed outline; refusing invented construction.")
    if envelope[0].any() or envelope[-1].any() or envelope[:, 0].any() or envelope[:, -1].any():
        raise TraceOnlyError("Source outline meets the image border; background/closed boundary is ambiguous.")
    ys, xs = np.where(envelope)
    occupancy = float(envelope.sum() / ((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)))
    if occupancy >= .985:
        raise TraceOnlyError("Rectangle-only source boundary; refusing a bounding-box garment.")
    outline = _raster_outline(envelope)
    closed = ndimage.binary_fill_holes(ink) & ~ink
    region_labels, region_count = ndimage.label(closed)
    areas = np.bincount(region_labels.ravel())[1:]
    return outline, {"inkComponentCount": count, "closedRegionCount": region_count,
                     "closedRegionAreas": sorted((int(area) for area in areas), reverse=True),
                     "closedRegionFillCount": 0, "outlineVertexCount": len(outline),
                     "outlineBoundarySupport": 1.0, "outlineBoxOccupancy": occupancy}


def _fidelity(svg: str, keyed: Image.Image, source: Image.Image) -> tuple[str | None, dict[str, Any]]:
    try:
        import resvg_py
    except ImportError:
        return None, {"fidelityVerified": False, "renderer": None,
                      "reason": "Optional resvg_py unavailable; no rasterized trace comparison was performed."}
    try:
        png = resvg_py.svg_to_bytes(svg_string=svg, width=keyed.width, height=keyed.height, skip_system_fonts=True)
        with Image.open(io.BytesIO(png)) as image:
            rendered = image.convert("RGBA")
    except (OSError, ValueError, RuntimeError) as error:
        raise TraceOnlyError(f"Trace rasterization failed: {error}") from error
    expected_alpha = np.asarray(keyed.getchannel("A"), dtype=float) / 255
    actual_alpha = np.asarray(rendered.getchannel("A"), dtype=float) / 255
    expected, actual = expected_alpha >= .5, actual_alpha >= .5
    intersection = int((expected & actual).sum())
    union = int((expected | actual).sum())
    recall = intersection / max(1, int(expected.sum()))
    precision = intersection / max(1, int(actual.sum()))
    iou = intersection / max(1, union)
    # Account for subpixel curve placement without hiding missing/inverted geometry.
    near_expected = ndimage.binary_dilation(expected, iterations=1)
    near_actual = ndimage.binary_dilation(actual, iterations=1)
    tolerant_recall = float((expected & near_actual).sum() / max(1, expected.sum()))
    tolerant_precision = float((actual & near_expected).sum() / max(1, actual.sum()))
    if iou < .80 or tolerant_recall < .97 or tolerant_precision < .97:
        raise TraceOnlyError(f"Trace fidelity failed: ink IoU={iou:.4f}, recall={recall:.4f}, precision={precision:.4f}.")
    overlay = source.convert("RGBA")
    red = Image.new("RGBA", source.size, (255, 0, 0, 0))
    red.putalpha(rendered.getchannel("A").point(lambda value: round(value * .6)))
    overlay = Image.alpha_composite(overlay, red)
    return _data_url(overlay), {"fidelityVerified": True, "renderer": "resvg_py",
        "inkIoU": iou, "inkRecall": recall, "inkPrecision": precision,
        "inkRecallWithin1px": tolerant_recall, "inkPrecisionWithin1px": tolerant_precision,
        "alphaMeanAbsoluteError": float(np.abs(expected_alpha - actual_alpha).mean()),
        "renderedInkPixels": int(actual.sum()), "missingInkPixels": int((expected & ~actual).sum()),
        "extraInkPixels": int((actual & ~expected).sum())}


def trace_only(source_bytes: bytes, view: str = "front", *, inputDetection: dict[str, Any] | None = None) -> dict[str, Any]:
    """Trace locally; supplied detection is metadata only and never selects a provider."""
    if view not in {"front", "back"}:
        raise TraceOnlyError("view must be 'front' or 'back'.")
    source = _decode(source_bytes)
    cleaned = ImageEnhance.Contrast(source).enhance(CONTRAST)
    keyed = _key(cleaned)
    ink = np.asarray(keyed.getchannel("A")) >= 128
    outline, metrics = _source_boundary(ink)
    traced_svg, path_count = _trace(keyed.getchannel("A"))
    overlay, fidelity = _fidelity(traced_svg, keyed, source)
    metrics.update(fidelity)
    metrics.update(sourceWidth=source.width, sourceHeight=source.height,
                   keyedInkPixels=int(ink.sum()), pathCount=path_count)
    source_url, cleaned_url, keyed_url = _data_url(source), _data_url(cleaned), _data_url(keyed)
    builder_svg = _builder_svg(traced_svg, source.size)
    empty_svg = f'<svg xmlns="{SVG_NS}" viewBox="0 0 2048 2048"/>'
    source_hash = _identity("source", source_bytes)
    drawing_id = _identity("drawing", _png(cleaned))
    segmentation_id = _identity("trace", traced_svg.encode())
    garment_id = _identity("garment", f"trace-only-v1:{view}:{source_hash}:{segmentation_id}".encode())
    provenance = {"sourceImageHash": source_hash, "analysisId": _identity("local-raster", source_bytes),
                  "drawingId": drawing_id, "segmentationId": segmentation_id, "garmentVersion": garment_id}
    evidence = ("Exterior pixel edges of the largest closed source-ink component; all boundary pixels are source-supported. "
                "Raster geometry only, not an inferred fabric boundary; closed white areas remain unfilled.")
    notes = ["Source pixels only: contrast 1.35, luminance alpha ramp, 3x Potrace; no reconstruction or semantic analysis.",
             "All ink, including stitches and printed marks, remains together. No stitch separation or invented seams.",
             "Colour fills disabled: closed white regions may be fabric, openings or decoration; review against the source.",
             "Potrace smoothing and turdsize 4 may remove tiny specks; inspect the overlay and fidelity metrics."]
    if not fidelity["fidelityVerified"]:
        notes.append(fidelity["reason"])
    width, height = source.size
    longest = max(source.size)
    offset_x, offset_y = (longest - width) / 2, (longest - height) / 2
    mapped_outline = [[(x + offset_x) / longest, (y + offset_y) / longest] for x, y in outline]
    source_outline = [[x / width, y / height] for x, y in outline]

    def bounds(points: list[list[float]]) -> list[float]:
        xs, ys = zip(*points)
        return [min(xs), min(ys), max(xs), max(ys)]

    ys, xs = np.where(ink)
    seed = [int(xs[0]), int(ys[0])]
    part_id = f"{view}-{source_hash[7:19]}-source-ink"
    region = {"id": part_id, "name": "Source ink", "userFacingName": "Source ink",
              "semanticType": "panel", "material": "unknown", "evidence": evidence,
              "colorable": False, "structural": True, "layerKind": "structural",
              "structuralRole": "source-ink", "builderCategory": "custom-details",
              "measurementRole": "none", "editableIndependently": False,
              "attachmentTo": None, "symmetryPartner": None, "view": view,
              "boundary": {"boundaryType": "panel-edge", "confidence": 1.0, "evidence": evidence}}
    source_region = {**copy.deepcopy(region), "outline": source_outline, "bounds": bounds(source_outline),
                     "seed": [seed[0] / width, seed[1] / height]}
    mapped_region = {**region, "outline": mapped_outline, "bounds": bounds(mapped_outline),
                     "seed": [(seed[0] + offset_x) / longest, (seed[1] + offset_y) / longest]}
    geometry_bounds = [(float(xs.min()) + offset_x) / longest, (float(ys.min()) + offset_y) / longest,
                       (float(xs.max()) + 1 + offset_x) / longest, (float(ys.max()) + 1 + offset_y) / longest]
    part = {**mapped_region, "svg": empty_svg, "constructionSvg": builder_svg, "stitchSvg": empty_svg,
            "area": int(ink.sum()), "color": "#000000", "parentGarment": garment_id, "layerOrder": 0,
            "geometryBounds": geometry_bounds,
            "measurement": {"unit": "relative", "width": geometry_bounds[2] - geometry_bounds[0],
                            "height": geometry_bounds[3] - geometry_bounds[1]},
            "transform": {"x": 0, "y": 0, "scale": 1, "rotation": 0}}
    manifest = {"garmentType": "unknown", "material": "unknown", "subtype": "source trace", "fit": "unknown",
                "construction": "Source-authoritative raster ink; no semantic construction inferred.",
                "materialEvidence": "Not inferred in trace-only mode.", "confidence": 0.0, "view": view,
                "uncertainties": notes[1:], "regions": [mapped_region], "views": [view],
                "measurementSchema": [], "builderCategories": ["custom-details"], "structuralParts": [part_id],
                "detailLayers": [], "colourGroups": [], "symmetryGroups": []}
    source_manifest = {**copy.deepcopy(manifest), "regions": [source_region]}
    manifest[f"{view}View"] = {"view": view, "partIds": [part_id], "detailLayerIds": [],
        "sourceImageHash": source_hash, "sourceImage": source_url, "cleanDrawing": cleaned_url,
        "lineArtSvg": builder_svg, "stitchSvg": empty_svg, "provenance": provenance}
    return {"type": "result", "ok": True, "source": "azure-garment-reconstruction-v1",
            "processingMode": "trace-only", "inputDetection": copy.deepcopy(inputDetection) if inputDetection is not None else detect_input(source),
            "constructionVersion": 2, "parts": [part], "partCount": 1, "detailLayers": [], "proposedBoundaries": [],
            "lineArtSvg": builder_svg, "stitchSvg": empty_svg, "manifest": manifest, "sourceManifest": source_manifest,
            "sourceImage": source_url, "sourceImages": {view: source_url}, "cleanDrawing": cleaned_url,
            "provenance": provenance, "accepted": False, "reviewed": False, "reviewNotes": notes,
            "process": {"rasterFirst": True, "contrast": CONTRAST, "whiteCutoff": WHITE_CUTOFF, "inkCutoff": INK_CUTOFF,
                        "whiteKey": "luminance-ramp", "traceSupersampling": TRACE_SS, "alphaThreshold": 128,
                        "bitmapInverted": True, "turdsize": 4, "turnpolicy": "minority", "alphamax": 1,
                        "opticurve": True, "opttolerance": .2, "fillRule": "evenodd", "viewBox": "0 0 2048 2048",
                        "externalServicesUsed": False},
            "tracePreview": {"sourceRaster": source_url, "cleanedRaster": cleaned_url, "keyedRaster": keyed_url,
                             "tracedSvg": traced_svg, "overlayRaster": overlay, "metrics": metrics}}
