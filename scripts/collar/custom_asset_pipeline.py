from __future__ import annotations

import base64
import hashlib
import io
import json
import sys
import uuid
from dataclasses import asdict
from pathlib import Path

from PIL import Image, ImageOps

from asset_profiles import PROFILES, validate_svg, validate_render
from asset_providers import ReferenceAnalysis, ReferenceComponent, select_provider
from collar_from_photo import CollarError
from lineart import clean_lineart
from trace_svg import TraceError, find_potrace_executable
from sleeve_isolation import isolate_sleeve, propose_sleeve
from sleeve_normalization import normalize_sleeve, registration_raster
from sleeve_style import detect_sleeve_style, garment_context, sleeve_socket


def png_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def progress(step: str, label: str) -> None:
    print(json.dumps({"type": "progress", "step": step, "label": label}), flush=True)


def upload_identity(source: bytes, request: dict) -> dict:
    source_hash = hashlib.sha256(source).hexdigest()
    context = {key: request.get(key) for key in ("category", "contextCategory", "detailType", "source", "side", "selectionMode", "fit", "view", "garmentType", "sleeveMode")}
    context["crop"] = request.get("crop", [0, 0, 1, 1])
    if request.get("sleeveMode") == "reconstruction-v1":
        context["garmentAdaptationVersion"] = 2
    identity = hashlib.sha256(json.dumps({"sourceImageHash": source_hash, **context}, sort_keys=True).encode()).hexdigest()
    return {"sourceImageHash": source_hash, "uploadIdentity": identity}


def process(photo_path: str, request: dict) -> dict:
    provenance = upload_identity(Path(photo_path).read_bytes(), request)
    request = {**request, "stageProvenance": provenance}
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
    if not (category == "sleeve" and request.get("sleeveMode") == "reconstruction-v1"):
        photo = photo.crop((round(left*photo.width), round(top*photo.height), round(right*photo.width), round(bottom*photo.height)))
    photo.thumbnail((1536, 1536))
    provider = select_provider(request["source"])
    progress("analyze", "Analyzing garment part")
    cache = Path(photo_path).parent
    cached = cache / "sleeve-state.json"
    if request.get("resumeIsolation"):
        state = json.loads(cached.read_text(encoding="utf-8"))
        if state.get("stageProvenance") != provenance:
            raise ValueError("Sleeve isolation belongs to a different source image or upload context. Process the current image again.")
        saved = state["analysis"]
        saved["components"] = tuple(ReferenceComponent(**component) for component in saved.get("components", []))
        analysis = ReferenceAnalysis(**saved)
    else:
        analysis = provider.analyzeReference(photo, part_type, **({"side": request.get("selectionMode", request["side"])} if category == "sleeve" and request["source"] == "photo" else {}))
    if analysis.category != part_type:
        raise ValueError("Wrong selected asset type: reference analysis does not match the requested garment part.")
    primary = process_part(photo, request, provider, analysis, cache=cache if category == "sleeve" else None)
    if primary.get("isolationPending") or primary.get("reconstructionDraft"):
        return primary
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


def process_part(photo: Image.Image, request: dict, provider, analysis: ReferenceAnalysis, *, cache: Path | None = None) -> dict:
    category = request["category"]
    provenance = dict(request.get("stageProvenance") or upload_identity(png_url(photo).encode(), request))
    detail_type = request.get("detailType", "pocket")
    progress("drawing", "Generating technical drawing")
    if request.get("resumeIsolation") and cache is not None:
        state = json.loads((cache / "sleeve-state.json").read_text(encoding="utf-8"))
        if state.get("stageProvenance") != provenance:
            raise ValueError("Cached sleeve raster does not belong to this upload.")
        with Image.open(cache / "sleeve-raster.png") as saved:
            drawing = saved.convert("RGB")
        drawing.info.update(state["info"])
    elif category == "sleeve" and request.get("sleeveMode") == "reconstruction-v1":
        drawing = photo.copy()
        if analysis.sleeve_guidance:
            drawing.info["sleeveGuidance"] = {**analysis.sleeve_guidance, "outline": analysis.sleeve_outline}
    else:
        drawing = provider.generateTechnicalRaster(photo, analysis, lambda label: progress("drawing", label))
    if not isinstance(drawing, Image.Image) or drawing.width * drawing.height > 16_000_000:
        raise ValueError("Raster generation failed: missing image or drawing exceeds the processing size limit.")
    collar_review = drawing.info.get("collarReview") if category == "collar" else None
    if collar_review is not None:
        print(json.dumps({"type": "collar-review", "review": collar_review, "sourceCrop": png_url(photo), "cleanDrawing": png_url(drawing)}), flush=True)
        if collar_review["status"] == "Rejected":
            raise ValueError("Collar materially differs from the source reference. Review the source/drawing differences and retry. Nothing was installed.")
    sleeve_review = drawing.info.get("sleeveReview") if category == "sleeve" else None
    isolation = None
    normalized = None
    if category == "sleeve":
        progress("isolate", "Separating sleeve from shoulder and body")
        guidance = request.get("isolationGuidance") or drawing.info.get("sleeveGuidance")
        if guidance is None:
            guidance = propose_sleeve(drawing, request.get("side", "left"))
        if cache is not None and not request.get("resumeIsolation"):
            drawing.save(cache / "sleeve-raster.png")
            (cache / "sleeve-state.json").write_text(json.dumps({"stageProvenance": provenance, "analysis": asdict(analysis), "info": {key: value for key, value in drawing.info.items() if key in {"sleeveReview", "sleeveGuidance"}}}), encoding="utf-8")
        isolated, overlay, isolation = isolate_sleeve(drawing, guidance)
        isolation.update({"contextCrop": [0, 0, 1, 1] if request.get("sleeveMode") == "reconstruction-v1" else request.get("crop", [0, 0, 1, 1]), "contextDrawing": png_url(drawing), "overlay": png_url(overlay)})
        normalization_source = isolated.info.pop("normalizationSource")
        progress("normalize", "Orienting sleeve from armhole to opening")
        normalized, normalization = normalize_sleeve(normalization_source["image"], normalization_source["armhole"], normalization_source["cuff"])
        isolation.update({"rawIsolation": png_url(normalization_source["image"]), "normalization": normalization})
        provenance.update({"detectedRasterId": hashlib.sha256(isolation["contextDrawing"].encode()).hexdigest(),
                   "isolationId": hashlib.sha256(isolation["rawIsolation"].encode()).hexdigest(),
                           "normalizedAssetId": hashlib.sha256(png_url(normalized).encode()).hexdigest()})
        if isolation["status"] == "confirm" and not request.get("confirmIsolation"):
            return {"isolationPending": True, "isolation": isolation, "cleanDrawing": png_url(normalized), "stageProvenance": provenance}
        if request.get("sleeveMode") == "reconstruction-v1":
            progress("style", "Comparing source garment proportions with target construction")
            style = detect_sleeve_style(normalization, analysis, guidance)
            style["sourceGarment"] = garment_context(drawing, isolation["guidance"], allow_inference=request["source"] == "drawing" or analysis.technical_drawing)
            sockets = {side: sleeve_socket(request["fit"], side) for side in ("left", "right")}
            provenance["garmentContextId"] = hashlib.sha256(json.dumps(style["sourceGarment"], sort_keys=True).encode()).hexdigest()
            provenance["styleId"] = hashlib.sha256(json.dumps(style, sort_keys=True).encode()).hexdigest()
            return {"reconstructionDraft": True, "id": str(uuid.uuid4()), "fit": request["fit"], "side": request["side"],
                    "source": request["source"], "style": style, "sockets": sockets,
                    "analysis": {key: value for key, value in asdict(analysis).items() if key in {"category", "name", "construction", "provider"}},
                    "sleeveIsolation": isolation, "cleanDrawing": png_url(normalized), "stageProvenance": provenance}
        drawing = normalized
    progress("cleanup", "Cleaning technical raster")
    try:
        if category != "collar":
            drawing = clean_lineart(drawing)
    except (ValueError, RuntimeError, OSError) as error:
        raise ValueError(f"Raster cleanup failed: {error}") from error
    preview_drawing = normalized if normalized is not None else drawing
    if normalized is not None:
        drawing = registration_raster(drawing, normalization_source["side"])
    provenance["registrationInputId"] = hashlib.sha256(png_url(drawing).encode()).hexdigest()
    progress("trace", "Tracing construction masks and registering garment part")
    opposite_output = None
    try:
        output = PROFILES[category].register(drawing, request)
        if category == "sleeve" and request.get("selectionMode") == "both":
            opposite_side = "right" if request["side"] == "left" else "left"
            opposite_output = PROFILES[category].register(drawing, {**request, "side": opposite_side})
    except TraceError:
        raise
    except (ValueError, RuntimeError, OSError, CollarError) as error:
        if isolation is not None and not request.get("confirmIsolation"):
            isolation["status"] = "confirm"
            isolation["reason"] = str(error)
            return {"isolationPending": True, "isolation": isolation, "cleanDrawing": png_url(preview_drawing), "stageProvenance": provenance}
        part_name = detail_type if category == "pocket" else category
        raise ValueError(f"{part_name.title()} registration failed: {error}") from error
    progress("validate", "Validating registered asset")
    try:
        validate_svg(output["svg"])
        validate_render(output["svg"])
        if opposite_output is not None:
            validate_svg(opposite_output["svg"])
            validate_render(opposite_output["svg"])
            validate_svg(opposite_output["keepSvg"])
        if "bodySvg" in output:
            validate_svg(output["bodySvg"])
            validate_render(output["bodySvg"])
    except Exception as error:
        raise ValueError(f"Final asset validation failed: {error}") from error
    buffer = io.BytesIO()
    preview_drawing.save(buffer, format="PNG")
    asset = {
        "version": 1, "id": str(uuid.uuid4()), "category": category, "name": analysis.name,
        **({"detailType": detail_type} if category == "pocket" else {}),
        "provenance": request["view"], "analysis": {key: value for key, value in asdict(analysis).items() if key in {"category", "name", "construction", "provider"}},
        "source": request["source"], "validation": {"version": 1, "status": "passed", "checks": ["boundary", "trace", "registration", "render-nonempty", "canvas-bounds"] + (["drawing-fidelity"] if category == "collar" else [])},
        "colorBindings": {"fabric": "#000000", "ink": "#141414"},
        "cleanDrawing": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"),
        **({"collarReview": collar_review} if collar_review is not None else {}),
        **({"sleeveReview": sleeve_review} if sleeve_review is not None else {}),
        **({"sleeveIsolation": isolation} if isolation is not None else {}),
        **output,
        "stageProvenance": {**provenance, "tracedSvgId": hashlib.sha256(output["svg"].encode()).hexdigest(),
                "finalSvgId": hashlib.sha256(output["svg"].encode()).hexdigest(),
                    "registrationId": hashlib.sha256(json.dumps(output, sort_keys=True).encode()).hexdigest()},
    }
    if opposite_output is not None:
        asset["oppositeSleeve"] = {**asset, "id": str(uuid.uuid4()), "provenance": "derived", **opposite_output,
                      "stageProvenance": {**provenance, "tracedSvgId": hashlib.sha256(opposite_output["svg"].encode()).hexdigest(),
                                  "finalSvgId": hashlib.sha256(opposite_output["svg"].encode()).hexdigest(),
                                  "registrationId": hashlib.sha256(json.dumps(opposite_output, sort_keys=True).encode()).hexdigest()}}
    return asset


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