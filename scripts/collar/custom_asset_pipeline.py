from __future__ import annotations

import base64
import io
import json
import sys
import uuid
from dataclasses import asdict
from pathlib import Path

from PIL import Image, ImageOps

from asset_profiles import PROFILES, validate_svg, validate_render
from asset_providers import ReferenceAnalysis, select_provider
from collar_from_photo import CollarError
from lineart import clean_lineart
from trace_svg import TraceError, find_potrace_executable


def progress(step: str, label: str) -> None:
    print(json.dumps({"type": "progress", "step": step, "label": label}), flush=True)


def process(photo_path: str, request: dict) -> dict:
    category = request.get("category")
    if category not in PROFILES or request.get("source") not in {"photo", "drawing"}:
        raise ValueError("Choose a supported asset type and source")
    if request.get("contextCategory") != category:
        raise ValueError("Wrong selected asset type: category must match the builder section. Reopen the correct Upload dialog.")
    detail_type = request.get("detailType", "pocket")
    if category == "pocket" and detail_type not in {"pocket", "button", "zip", "patch"}:
        raise ValueError("Choose Pockets, Buttons, Zips or Patches")
    part_type = detail_type if category == "pocket" else category
    if request.get("view") not in {"front", "back"} or request.get("side") not in {"left", "right"}:
        raise ValueError("Choose a view and sleeve side")
    if request.get("garmentType") not in {"tshirt", "tshirtTest"} or request.get("fit") not in {"slim", "regular", "boxy", "oversized"}:
        raise ValueError("Unsupported garment or fit")
    if category == "collar" and (request["fit"] != "slim" or request["view"] != "front"):
        raise ValueError("Collar socket is verified only for Slim tees, front view. The garment fit has not been changed.")
    if category == "sleeve" and (request["garmentType"] != "tshirt" or request["view"] != "front"):
        raise ValueError("Sleeve socket is verified only for the main tee front. Rear geometry is not verified.")
    find_potrace_executable()
    import resvg_py

    resvg_py.svg_to_bytes(svg_string='<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>')
    with Image.open(photo_path) as opened:
        if opened.width * opened.height > 32_000_000:
            raise ValueError("Image exceeds 32 megapixels")
        photo = ImageOps.exif_transpose(opened).convert("RGBA")
    white = Image.new("RGBA", photo.size, "white")
    white.alpha_composite(photo)
    photo = white.convert("RGB")
    crop = request.get("crop", [0, 0, 1, 1])
    if not isinstance(crop, list) or len(crop) != 4 or any(not isinstance(value, (int, float)) or not 0 <= value <= 1 for value in crop):
        raise ValueError("Invalid image crop")
    left, top, right, bottom = crop
    if (right-left)*photo.width < 64 or (bottom-top)*photo.height < 64:
        raise ValueError("Image crop too small (minimum 64 pixels on each side)")
    photo = photo.crop((round(left*photo.width), round(top*photo.height), round(right*photo.width), round(bottom*photo.height)))
    photo.thumbnail((1536, 1536))
    provider = select_provider(request["source"])
    progress("analyze", "Analyzing garment part")
    analysis = provider.analyzeReference(photo, part_type)
    if analysis.category != part_type:
        raise ValueError("Wrong selected asset type: reference analysis does not match the requested garment part.")
    primary = process_part(photo, request, provider, analysis)
    additional = []
    for index, component in enumerate(analysis.components):
        progress("components", f"Separating {component.name} ({index + 1}/{len(analysis.components)})")
        left, top, right, bottom = component.bounds
        component_photo = photo.crop((int(left * photo.width), int(top * photo.height), max(int(left * photo.width) + 1, round(right * photo.width)), max(int(top * photo.height) + 1, round(bottom * photo.height))))
        component_analysis = ReferenceAnalysis(component.category, component.name, component.construction, analysis.provider,
                               isolated=True, technical_drawing=analysis.technical_drawing)
        component_request = {**request, "category": "pocket", "contextCategory": "pocket", "detailType": component.category}
        asset = process_part(component_photo, component_request, provider, component_analysis)
        primary_left, primary_top, primary_right, primary_bottom = analysis.bounds
        asset["registration"]["relativePlacement"] = {
            "parentId": primary["id"],
            "x": ((left + right) / 2 - primary_left) / (primary_right - primary_left),
            "y": ((top + bottom) / 2 - primary_top) / (primary_bottom - primary_top),
            "width": (right - left) / (primary_right - primary_left),
        }
        additional.append(asset)
    if additional:
        primary["additionalAssets"] = additional
    return primary


def process_part(photo: Image.Image, request: dict, provider, analysis: ReferenceAnalysis) -> dict:
    category = request["category"]
    detail_type = request.get("detailType", "pocket")
    progress("drawing", "Generating technical drawing")
    drawing = provider.generateTechnicalRaster(photo, analysis, lambda label: progress("drawing", label))
    if not isinstance(drawing, Image.Image) or drawing.width * drawing.height > 16_000_000:
        raise ValueError("Raster generation failed: missing image or drawing exceeds the processing size limit.")
    progress("cleanup", "Cleaning technical raster")
    try:
        drawing = clean_lineart(drawing)
    except (ValueError, RuntimeError, OSError) as error:
        raise ValueError(f"Raster cleanup failed: {error}") from error
    progress("trace", "Tracing construction masks and registering garment part")
    try:
        output = PROFILES[category].register(drawing, request)
    except TraceError:
        raise
    except (ValueError, RuntimeError, OSError, CollarError) as error:
        part_name = detail_type if category == "pocket" else category
        raise ValueError(f"{part_name.title()} registration failed: {error}") from error
    progress("validate", "Validating registered asset")
    try:
        validate_svg(output["svg"])
        validate_render(output["svg"])
        if "bodySvg" in output:
            validate_svg(output["bodySvg"])
            validate_render(output["bodySvg"])
    except Exception as error:
        raise ValueError(f"Final asset validation failed: {error}") from error
    buffer = io.BytesIO()
    drawing.save(buffer, format="PNG")
    return {
        "version": 1, "id": str(uuid.uuid4()), "category": category, "name": analysis.name,
        **({"detailType": detail_type} if category == "pocket" else {}),
        "provenance": request["view"], "analysis": {key: value for key, value in asdict(analysis).items() if key in {"category", "name", "construction", "provider"}},
        "source": request["source"], "validation": {"version": 1, "status": "passed", "checks": ["boundary", "trace", "registration", "render-nonempty", "canvas-bounds"] + (["drawing-fidelity"] if category == "collar" else [])},
        "colorBindings": {"fabric": "#000000", "ink": "#141414"},
        "cleanDrawing": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"),
        **output,
    }


if __name__ == "__main__":
    try:
        result = process(sys.argv[1], json.loads(Path(sys.argv[2]).read_text(encoding="utf-8")))
        print(json.dumps({"type": "result", "asset": result}), flush=True)
    except (ValueError, RuntimeError) as error:
        print(json.dumps({"type": "error", "error": str(error)[:500]}), flush=True)
        sys.exit(1)
    except Exception:
        print(json.dumps({"type": "error", "error": "Processing failed. Check the image format and local tracing dependencies, then retry."}), flush=True)
        sys.exit(1)