"""Whole-garment upload routing: auto detection, photo redraw, or exact raster tracing.

Clean artwork bypasses providers and reconstruction. Photo uploads generate a
black-and-white raster before white keying and Potrace. The named reconstruct()
API retains its source-registered semantic projection for existing callers, and
--local-only keeps the legacy experimental local importer available.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import trace_svg as T  # noqa: E402

RASTER = 1024
MAX_PARTS = 12
MIN_PART_RATIO = 0.006


class GarmentError(Exception):
    pass


def progress(step: str, label: str) -> None:
    print(json.dumps({"type": "progress", "step": step, "label": label}), flush=True)


def debug_image(name: str, image: Image.Image | np.ndarray) -> None:
    target = os.environ.get("GARMENT_DEBUG_DIR", "").strip()
    if not target:
        return
    directory = Path(target)
    directory.mkdir(parents=True, exist_ok=True)
    if isinstance(image, np.ndarray):
        output = Image.fromarray(np.where(image, 0, 255).astype(np.uint8), "L")
    else:
        output = image
    output.save(directory / f"{name}.png")


def contain_photo(photo: Image.Image) -> Image.Image:
    oriented = ImageOps.exif_transpose(photo)
    if "A" in oriented.getbands():
        rgba = oriented.convert("RGBA")
        base = Image.new("RGBA", rgba.size, "white")
        base.alpha_composite(rgba)
        rgb = base.convert("RGB")
    else:
        rgb = oriented.convert("RGB")
    scale = min((RASTER * 0.88) / max(rgb.width, 1), (RASTER * 0.88) / max(rgb.height, 1))
    size = (max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale)))
    fitted = rgb.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (RASTER, RASTER), "white")
    canvas.paste(fitted, ((RASTER - fitted.width) // 2, (RASTER - fitted.height) // 2))
    return canvas


def _largest_components(mask: np.ndarray, minimum: int) -> np.ndarray:
    labeled, count = ndimage.label(mask)
    if count == 0:
        return mask
    sizes = ndimage.sum(mask, labeled, index=range(1, count + 1))
    keep = np.zeros_like(mask)
    largest = max(float(value) for value in sizes)
    for index, size in enumerate(sizes, start=1):
        if float(size) >= max(minimum, largest * 0.015):
            keep |= labeled == index
    return keep


def _line_components(mask: np.ndarray) -> np.ndarray:
    """Keep coherent long/thin seam marks while dropping texture dots."""
    labeled, count = ndimage.label(mask)
    keep = np.zeros_like(mask)
    for index in range(1, count + 1):
        piece = labeled == index
        ys, xs = np.where(piece)
        if xs.size == 0:
            continue
        width = int(xs.max() - xs.min()) + 1
        height = int(ys.max() - ys.min()) + 1
        if int(piece.sum()) >= 10 and max(width, height) >= 12:
            keep |= piece
    return keep


def garment_silhouette(image: Image.Image) -> np.ndarray:
    """Foreground from border colour distance, cleaned into a solid garment."""
    arr = np.asarray(image).astype(np.float32)
    border = np.concatenate(
        [arr[:16].reshape(-1, 3), arr[-16:].reshape(-1, 3),
         arr[:, :16].reshape(-1, 3), arr[:, -16:].reshape(-1, 3)],
        axis=0,
    )
    background = np.median(border, axis=0)
    distance = np.sqrt(((arr - background) ** 2).sum(axis=2))
    luminance = arr.mean(axis=2)
    foreground = (distance > 24.0) | (luminance < 225.0)
    foreground = ndimage.binary_opening(foreground, iterations=2)
    foreground = ndimage.binary_closing(foreground, iterations=5)
    foreground = _largest_components(foreground, minimum=800)
    foreground = ndimage.binary_fill_holes(foreground)
    foreground = ndimage.binary_closing(foreground, iterations=3)
    if int(foreground.sum()) < RASTER * RASTER * 0.035:
        raise GarmentError(
            "Could not isolate a full garment. Use a photo showing the complete item."
        )
    if int(foreground.sum()) > RASTER * RASTER * 0.78:
        raise GarmentError(
            "The garment does not separate from the background in this local test."
        )
    return foreground


def construction_ink(image: Image.Image, garment: np.ndarray) -> np.ndarray:
    """Sparse seam/edge drawing with the silhouette guaranteed."""
    rgb = np.asarray(
        ImageEnhance.Contrast(image.convert("RGB")).enhance(1.45),
        dtype=np.float32,
    )
    gradients = []
    for channel in range(3):
        smooth = ndimage.gaussian_filter(rgb[..., channel], sigma=1.25)
        gx = ndimage.sobel(smooth, axis=1)
        gy = ndimage.sobel(smooth, axis=0)
        gradients.append(np.hypot(gx, gy))
    magnitude = np.sqrt(sum(channel ** 2 for channel in gradients))
    inner = ndimage.binary_erosion(garment, iterations=3)
    samples = magnitude[inner]
    threshold = float(np.percentile(samples, 81.0)) if samples.size else 28.0
    seams = (magnitude >= max(threshold, 14.0)) & inner

    # Suppress fabric grain: retain coherent lines, not isolated edge flecks.
    neighbours = ndimage.uniform_filter(seams.astype(np.float32), size=5)
    seams &= neighbours >= 0.08
    seams = ndimage.binary_closing(seams, iterations=1)
    seams = _line_components(seams)

    boundary = garment & ~ndimage.binary_erosion(garment, iterations=2)
    ink = boundary | seams
    return ink


def raster_lineart(ink: np.ndarray) -> Image.Image:
    """Render black construction ink on white before any vector operation."""
    page = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8), "L")
    # A light antialias gives the luminance key a real ramp at ink edges.
    return page.filter(ImageFilter.GaussianBlur(radius=0.35)).convert("RGB")


def key_lineart(lineart: Image.Image) -> tuple[Image.Image, np.ndarray]:
    """Key white with trace_svg's luminance ramp, never a hard RGB cut."""
    keyed = T.to_transparent(lineart)
    alpha = np.asarray(keyed.getchannel("A"), dtype=np.uint8)
    return keyed, alpha >= T.INK_THRESHOLD


def _seam_barriers(ink: np.ndarray, garment: np.ndarray) -> np.ndarray:
    inner_ink = ink & ndimage.binary_erosion(garment, iterations=2)
    barriers = ndimage.binary_dilation(inner_ink, iterations=1)
    barriers = ndimage.binary_closing(barriers, iterations=2)
    # Join short breaks in fly/leg seams and waistband seams without replacing
    # them with hand-authored geometry.
    barriers = ndimage.binary_closing(
        barriers, structure=np.ones((15, 3), dtype=bool)
    )
    barriers = ndimage.binary_closing(
        barriers, structure=np.ones((3, 15), dtype=bool)
    )
    return barriers


def _region_seeds(garment: np.ndarray, barriers: np.ndarray) -> np.ndarray:
    open_fabric = garment & ~barriers
    labels, count = ndimage.label(open_fabric)
    if count == 0:
        return garment.astype(np.int32)
    sizes = ndimage.sum(open_fabric, labels, index=range(1, count + 1))
    minimum = max(250, round(int(garment.sum()) * MIN_PART_RATIO))
    ranked = sorted(
        ((index, int(size)) for index, size in enumerate(sizes, start=1) if int(size) >= minimum),
        key=lambda item: item[1],
        reverse=True,
    )[:MAX_PARTS]
    if not ranked:
        return garment.astype(np.int32)
    seeds = np.zeros_like(labels)
    for new_index, (old_index, _size) in enumerate(ranked, start=1):
        seeds[labels == old_index] = new_index
    return seeds


def split_regions(garment: np.ndarray, ink: np.ndarray) -> list[np.ndarray]:
    """Assign every garment pixel to the nearest seam-enclosed large region."""
    seeds = _region_seeds(garment, _seam_barriers(ink, garment))
    if int(seeds.max()) <= 1:
        return [garment]
    _distance, indices = ndimage.distance_transform_edt(
        seeds == 0, return_indices=True
    )
    assigned = seeds[tuple(indices)]
    assigned[~garment] = 0
    parts: list[np.ndarray] = []
    for index in range(1, int(assigned.max()) + 1):
        part = assigned == index
        part = ndimage.binary_closing(part, iterations=1) & garment
        if int(part.sum()) >= 200:
            parts.append(part)
    return parts or [garment]


def part_name(
    mask: np.ndarray,
    silhouette: np.ndarray,
    used: dict[str, int],
    rank: int,
) -> str:
    ys, xs = np.where(mask)
    all_ys, all_xs = np.where(silhouette)
    cx = float(xs.mean())
    cy = float(ys.mean())
    x0, x1 = int(all_xs.min()), int(all_xs.max())
    y0, y1 = int(all_ys.min()), int(all_ys.max())
    rel_x = (cx - x0) / max(x1 - x0, 1)
    rel_y = (cy - y0) / max(y1 - y0, 1)
    width = int(xs.max() - xs.min()) + 1

    if rank == 0:
        base = "Main garment panels"
    elif rel_y < 0.22 and width > (x1 - x0) * 0.45:
        base = "Waistband"
    elif rel_x < 0.40:
        base = "Left overlay panel"
    elif rel_x > 0.60:
        base = "Right overlay panel"
    elif rel_y < 0.48:
        base = "Fly / centre front"
    else:
        base = "Centre panel"
    used[base] = used.get(base, 0) + 1
    return base if used[base] == 1 else f"{base} {used[base]}"


def wrap_fill_svg(title: str, mask: np.ndarray) -> str:
    return T.wrap_svg(title, T.trace(mask), "")


def wrap_ink_svg(title: str, mask: np.ndarray) -> str:
    return T.wrap_svg(title, "", T.trace(mask))


def build(photo: Image.Image) -> dict:
    progress("prepare", "Fitting the complete garment onto the 2048 SVG canvas")
    framed = contain_photo(photo)
    debug_image("01-framed", framed)
    silhouette = garment_silhouette(framed)
    debug_image("02-silhouette", silhouette)
    progress("lineart", "Drawing black-and-white construction line art from visible seams")
    detected_ink = construction_ink(framed, silhouette)
    lineart = raster_lineart(detected_ink)
    debug_image("03-lineart", lineart)
    progress("key", "Keying white to transparency with a luminance ramp")
    keyed, ink = key_lineart(lineart)
    debug_image("04-keyed", keyed)
    debug_image("03-ink", ink)
    progress("parts", "Splitting colour regions along detected seams")
    masks = split_regions(silhouette, ink)
    for index, mask in enumerate(masks, start=1):
        debug_image(f"part-{index:02d}", mask)
    used: dict[str, int] = {}
    palette = [
        "#20242B", "#343A45", "#2A3039", "#454B55",
        "#F59E0B", "#06B6D4", "#EC4899", "#84CC16",
        "#8B5CF6", "#F97316", "#14B8A6", "#64748B",
    ]
    parts = []
    progress("potrace", "Upsampling 3x, inverting the bitmap and tracing SVG layers")
    for index, mask in enumerate(masks):
        name = part_name(mask, silhouette, used, index)
        parts.append({
            "id": f"part-{index + 1}",
            "name": name,
            "svg": wrap_fill_svg(f"Photo mockup - {name}", mask),
            "color": palette[index % len(palette)],
            "area": int(mask.sum()),
        })
    result = {
        "type": "result",
        "ok": True,
        "source": "local-seam-trace",
        "parts": parts,
        "lineArtSvg": wrap_ink_svg("Photo mockup - construction ink", ink),
        "partCount": len(parts),
        "process": {
            "rasterFirst": True,
            "whiteKey": "luminance-ramp",
            "traceSupersampling": T.TRACE_SS,
            "bitmapInverted": True,
            "fillRule": "evenodd",
            "viewBox": f"0 0 {T.CANVAS} {T.CANVAS}",
        },
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect or import a whole garment without redrawing clean artwork.")
    parser.add_argument("photo")
    parser.add_argument("--reconstruct", action="store_true", help="Compatibility alias for the upload pipeline")
    parser.add_argument("--input-type", choices=("auto", "photo", "trace-only"), default="auto")
    parser.add_argument("--detect-input", action="store_true", help="Return local input detection JSON without processing")
    parser.add_argument("--view", choices=("front", "back"), default="front")
    parser.add_argument("--local-only", action="store_true", help="Use the legacy experimental local photo importer")
    args = parser.parse_args()
    source_bytes = Path(args.photo).read_bytes()
    if args.detect_input:
        from garment_trace_only import detect_input
        result = detect_input(source_bytes)
    elif args.local_only:
        with Image.open(io.BytesIO(source_bytes)) as photo:
            result = build(photo)
    else:
        result = process_upload(source_bytes, input_type=args.input_type, view=args.view)
    print(json.dumps(result), flush=True)


def process_upload(source_bytes: bytes, *, input_type: str = "auto", view: str = "front") -> dict:
    """Route before creating a provider; trace-only artwork is never reconstructed."""
    if input_type not in {"auto", "photo", "trace-only"}:
        raise GarmentError("inputType must be auto, photo or trace-only.")
    if view not in {"front", "back"}:
        raise GarmentError("requestedView must be front or back.")
    from garment_trace_only import detect_input, trace_only

    detection = detect_input(source_bytes) if input_type == "auto" else None
    mode = detection["mode"] if detection is not None else input_type
    if mode == "trace-only":
        result = trace_only(source_bytes, view=view)
    elif mode == "photo":
        result = redraw_photo(source_bytes, view=view)
    else:
        raise GarmentError("Input detection returned an unsupported mode.")
    result["processingMode"] = mode
    result["inputDetection"] = detection or {"mode": mode, "confidence": 1.0, "reason": "Explicit input-type selection; automatic routing bypassed."}
    metadata = result["manifest"][f"{view}View"]
    metadata.update(processingMode=mode, inputDetection=result["inputDetection"], tracePreview=result["tracePreview"])
    return result


def redraw_photo(source_bytes: bytes, *, view: str = "front") -> dict:
    """Photo -> provider BW raster redraw -> white key -> Potrace (never SVG-first)."""
    from asset_providers import AstraProvider
    from garment_manifest import identity
    from garment_trace_only import trace_only

    with Image.open(io.BytesIO(source_bytes)) as opened:
        if opened.width * opened.height > 24_000_000:
            raise GarmentError("Source image exceeds 24 megapixels.")
        photo = ImageOps.exif_transpose(opened).convert("RGB")
    provider = AstraProvider(dict(os.environ))
    progress("analysis", "Identifying source-confirmed garment construction")
    analysis = provider.analyzeGarment(photo)
    analysis = {**analysis, "view": view}
    progress("redraw", "Redrawing the source garment as a black-and-white raster, preserving its proportions")
    drawing = provider.raster.generateWholeGarmentRaster(photo, analysis, lambda label: progress("redraw", label))
    buffer = io.BytesIO()
    drawing.save(buffer, format="PNG")
    drawing_bytes = buffer.getvalue()
    progress("key", "Keying the redraw's white background before tracing its actual ink")
    result = trace_only(drawing_bytes, view=view)
    source_buffer = io.BytesIO()
    photo.thumbnail((1024, 1024))
    photo.save(source_buffer, format="PNG")
    source_url = "data:image/png;base64," + base64.b64encode(source_buffer.getvalue()).decode("ascii")
    drawing_url = "data:image/png;base64," + base64.b64encode(drawing_bytes).decode("ascii")
    result.update(processingMode="photo", sourceManifest=analysis, sourceImage=source_url,
                  sourceImages={view: source_url}, cleanDrawing=drawing_url)
    result["provenance"].update(sourceImageHash=identity("source", source_bytes),
                                analysisId=identity("analysis", json.dumps(analysis, sort_keys=True).encode()))
    for key in ("garmentType", "material", "subtype", "fit", "construction", "materialEvidence", "confidence"):
        if key in analysis:
            result["manifest"][key] = analysis[key]
    result["manifest"][f"{view}View"].update(sourceImageHash=result["provenance"]["sourceImageHash"],
                                             sourceImage=source_url, cleanDrawing=drawing_url)
    result["process"].update(externalServicesUsed=True, inputStage="azure-technical-redraw")
    result["tracePreview"].update(sourceRaster=source_url, technicalRaster=drawing_url,
                                  comparisonSource="technical-redraw")
    result["reviewNotes"] = [
        "Photo mode: source construction analysis, Azure black-and-white technical raster redraw, then the shared white-key and Potrace pipeline.",
        "Compare the technical redraw with the original photo for construction fidelity. The overlay and pixel metrics compare the SVG against the redraw, not the photograph.",
        "The traced construction ink stays together. No semantic colour fills or separately editable stitch paths are inferred.",
        *[note for note in result["reviewNotes"] if "Potrace smoothing" in note],
    ]
    result["manifest"]["uncertainties"] = list(analysis.get("uncertainties", [])) + result["reviewNotes"][1:]
    return result


def reconstruct(source_bytes: bytes) -> dict:
    from asset_providers import AstraProvider
    from garment_manifest import identity
    from garment_source_geometry import SourceGeometryError, segment_source
    from garment_technical_flat import segment_technical, supports_technical_flat

    with Image.open(io.BytesIO(source_bytes)) as opened:
        if opened.width * opened.height > 24_000_000:
            raise GarmentError("Source image exceeds 24 megapixels.")
        photo = ImageOps.exif_transpose(opened).convert("RGB")
    provider = AstraProvider(dict(os.environ))
    progress("analysis", "Astra: identifying construction on the original garment photo")
    feedback = None
    for attempt in range(2):
        try:
            analysis = provider.analyzeGarment(photo, geometry_feedback=feedback)
            technical_flat = supports_technical_flat(analysis)
            progress("registration", "Fairing source construction into a balanced technical flat" if technical_flat else "Preserving source-photo proportions and tracing its visible fabric")
            drawing, mapped, segmentation = (segment_technical if technical_flat else segment_source)(photo, analysis, RASTER)
            break
        except (SourceGeometryError, ValueError) as exc:
            if attempt or not (isinstance(exc, SourceGeometryError) or "cutout" in str(exc).lower()):
                raise
            feedback = str(exc)
            progress("analysis", "Rechecking source geometry before installing any garment parts")
    stage_buffer = io.BytesIO()
    drawing.save(stage_buffer, format="PNG")
    print(json.dumps({"type": "reconstruction-draft", "sourceManifest": analysis, "manifest": mapped,
                      "sourceImageHash": identity("source", source_bytes),
                      "cleanDrawing": "data:image/png;base64," + base64.b64encode(stage_buffer.getvalue()).decode("ascii")}), flush=True)
    return trace_reconstruction(photo, source_bytes, analysis, drawing, mapped, source_segmentation=segmentation, technical_flat=technical_flat)


def trace_reconstruction(photo: Image.Image, source_bytes: bytes, analysis: dict, drawing: Image.Image, mapped: dict, *, source_segmentation: tuple | None = None, technical_flat: bool = False) -> dict:
    from garment_manifest import EXCLUDED_REGION_TYPES, MIN_BOUNDARY_CONFIDENCE, detail_ink, identity, segment_drawing, validate_manifest

    analysis = validate_manifest(analysis)
    mapped = validate_manifest(mapped)
    progress("segmentation", "Tracing semantic fabric regions and separate construction ink")
    masks, contours, stitches, notes = source_segmentation if source_segmentation is not None else segment_drawing(drawing, mapped)
    detail_layers = []
    detail_lines = np.zeros_like(contours)
    detail_stitches = np.zeros_like(stitches)
    for region_index, region in enumerate(mapped["regions"]):
        visible = np.ones_like(contours)
        if technical_flat:
            visible = ndimage.binary_dilation(masks[region_index])
            for foreground in masks[region_index + 1:]:
                visible &= ~foreground
        solid, thread = detail_ink(region, drawing.size)
        solid, thread = solid & visible, thread & visible
        detail_lines |= solid
        detail_stitches |= thread
        groups = {}
        for edge in region["visibleEdges"]:
            category, name = region["builderCategory"], region["userFacingName"]
            groups.setdefault((category, name), []).append(edge)
        for index, ((category, name), edges) in enumerate(groups.items()):
            solid, thread = detail_ink({**region, "visibleEdges": edges}, drawing.size)
            solid, thread = solid & visible, thread & visible
            if solid.any() or thread.any():
                detail_layers.append({"id": f"detail-{region['id']}-{index}", "partId": region["id"], "name": region["name"],
                                      "builderCategory": category, "userFacingName": name,
                                      "view": mapped["view"], "visibleEdges": edges,
                                      "constructionSvg": wrap_ink_svg(region["name"] + " visible edges", solid),
                                      "stitchSvg": wrap_ink_svg(region["name"] + " topstitching", thread)})
    buffer = io.BytesIO()
    drawing.save(buffer, format="PNG")
    drawing_bytes = buffer.getvalue()
    source_id = identity("source", source_bytes)
    analysis_id = identity("analysis", {"source": source_id, "manifest": analysis})
    drawing_id = identity("drawing", drawing_bytes)
    if technical_flat:
        algorithm = "source-matched-technical-flat-v2"
    else:
        algorithm = "source-locked-photo-edges-v4" if source_segmentation is not None else "source-construction-outlines-v3-hardware-cutouts-no-labels"
    segmentation_id = identity("segmentation", {"drawing": drawing_id, "manifest": mapped, "algorithm": algorithm})
    garment_id = identity("garment", [source_id, analysis_id, drawing_id, segmentation_id])
    parts = []
    for order, (region, mask) in enumerate(zip(mapped["regions"], masks)):
        if not mask.any():
            continue
        rows, columns = np.where(mask)
        bounds = [float(columns.min() / drawing.width), float(rows.min() / drawing.height), float((columns.max() + 1) / drawing.width), float((rows.max() + 1) / drawing.height)]
        part_ink = (mask & ~ndimage.binary_erosion(mask)) if technical_flat else (contours & ~detail_lines & ndimage.binary_dilation(mask, iterations=1))
        part_stitches = stitches & ~detail_stitches & ndimage.binary_dilation(mask, iterations=2)
        fill_path = T.trace(mask)
        fill_svg = T.wrap_svg(region["name"], fill_path, "")
        if technical_flat:
            construction_svg = T.wrap_svg(region["name"] + " construction", "", fill_path).replace(
                f'fill="{T.INK_COLOR}" fill-rule="evenodd"',
                'fill="none" stroke="#141414" stroke-width="28" stroke-linejoin="round" stroke-linecap="round"',
            )
        else:
            construction_svg = wrap_ink_svg(region["name"] + " construction", part_ink)
        if technical_flat and region["semanticType"] in {"body", "lining"} and "rib" in (region["material"] + analysis["materialEvidence"]).lower():
            from garment_technical_flat import rib_paths
            ribs = rib_paths(mask)
            fill_svg = fill_svg.replace("</svg>", f'<g data-texture="rib" fill="none" stroke="#141414" stroke-width="1.4" opacity="0.16"><path d="{ribs}"/></g></svg>')
        hardware = region["boundary"]["boundaryType"] == "hardware-edge" or region["semanticType"] in {"button", "rivet", "zip"}
        color = ("#b7bbc0" if hardware else "#f4f3ef") if technical_flat else ("#62788b" if region["material"] == "denim" else "#b2ada3")
        parts.append({**region, "svg": fill_svg, "area": int(mask.sum()),
                      "color": color, "parentGarment": garment_id,
                      "layerOrder": order, "view": mapped["view"], "transform": {"x": 0, "y": 0, "scale": 1, "rotation": 0},
                      "geometryBounds": bounds, "measurement": {"unit": "relative", "width": bounds[2] - bounds[0], "height": bounds[3] - bounds[1]},
                      "constructionSvg": construction_svg,
                      "stitchSvg": wrap_ink_svg(region["name"] + " stitches", part_stitches)})
    if not any(part["layerKind"] == "structural" for part in parts):
        raise ValueError("No source-supported structural outline could be committed. Review construction evidence before retrying.")
    preview = photo.copy()
    preview.thumbnail((1024, 1024))
    source_buffer = io.BytesIO()
    preview.save(source_buffer, format="JPEG", quality=85)
    return {"type": "result", "ok": True, "source": "azure-garment-reconstruction-v1", "parts": parts,
            "constructionVersion": 2,
            "detailLayers": detail_layers,
            "proposedBoundaries": [region for region in mapped["regions"] if region["semanticType"] not in EXCLUDED_REGION_TYPES
                                   and (region["boundary"]["confidence"] < MIN_BOUNDARY_CONFIDENCE
                                        or any(cutout["confidence"] < MIN_BOUNDARY_CONFIDENCE for cutout in region["cutouts"]))],
            "lineArtSvg": wrap_ink_svg("Construction", contours), "stitchSvg": wrap_ink_svg("Stitching", stitches),
            "partCount": len(parts), "manifest": mapped, "sourceManifest": analysis,
            "sourceImage": "data:image/jpeg;base64," + base64.b64encode(source_buffer.getvalue()).decode("ascii"),
            "cleanDrawing": "data:image/png;base64," + base64.b64encode(drawing_bytes).decode("ascii"),
            "reviewNotes": notes + mapped["uncertainties"] + ["Construction outlines and seam-adjacent stitch candidates require comparison with the source."],
            "provenance": {"sourceImageHash": source_id, "analysisId": analysis_id, "drawingId": drawing_id,
                           "segmentationId": segmentation_id, "garmentVersion": garment_id}, "accepted": False}


if __name__ == "__main__":
    try:
        main()
    except GarmentError as exc:
        print(json.dumps({"type": "error", "ok": False, "error": str(exc)}), flush=True)
        raise SystemExit(1)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"type": "error", "ok": False, "error": str(exc)}), flush=True)
        raise SystemExit(1)
