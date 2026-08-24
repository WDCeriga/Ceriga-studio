"""Generate validated collar-only construction line art from a photo.

The image model interprets the uploaded collar. This module only:
1. asks for black construction ink on white,
2. validates that raster result,
3. normalises it to clean black/white pixels.

SVG geometry is never authored here.
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from scipy import ndimage


LINEART_PROMPT = r"""
EDIT the attached reference into a front-view fashion tech-pack construction
drawing of ONLY the exact neck/collar shown.

COPY THE UPLOADED CONSTRUCTION:
- Preserve whether it is a polo/shirt collar, crew, ribbed V, mock/funnel,
  button-down, zip neck, hood join, or another neckline.
- For a polo/shirt collar include both leaves, points, stand, true head
  opening, placket and buttons only when present.
- For a V-neck include the complete band, inner and outer edges, V-point join,
  sparse rib ticks, and seam where it joins the body.
- For a mock, funnel or turtle neck include the complete tall standing tube,
  top head opening, outer side edges and the full curved seam at its base.
  Do not flatten a tall collar into a crew-neck ring.
- Do not replace the uploaded collar with a generic crew or V.

OUTPUT:
- One large, centred collar with generous pure-white margin on every side.
- Entire collar visible. Nothing cropped. No torso, shoulders, sleeves, person,
  mannequin, label, logo, text, title, border, rectangle or background frame.
- Pure white background and pure white inside every closed fabric piece and
  inside the true head opening.
- Thin continuous black construction lines only.
- No solid black fabric, grey fill, colour, shading, hatching, dense rib
  texture, stipple, grain, shadow or photographic detail.
- Use only enough internal seam/rib marks to describe construction clearly.

This must look like clean black ink line art ready to key and potrace.
"""

RETRY_PROMPT = r"""
REDRAW the uploaded collar from scratch as clean technical line art.

The previous pass failed validation. Correct all of these requirements:
- exact same collar construction as the upload
- complete collar, centred, with wide white margin
- only thin black outlines and sparse construction marks
- every fabric panel is white inside; the head opening is white
- no black-filled leaves/band/stand, no hatching, noise, labels, words,
  garment body, rectangular frame, crop or background

Return an image, not SVG and not instructions.
"""

NAME_PROMPT = r"""
Identify the neckline/collar in the uploaded garment photo.
Reply with exactly one line:
Name: <2 to 6 word collar name>
Do not describe anything else.
"""


def _env_file_values(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


def load_secrets() -> dict[str, str]:
    values = dict(os.environ)
    here = Path(__file__).resolve()
    for parent in (here.parent, *here.parents):
        for filename in (".env.local", ".env"):
            for key, value in _env_file_values(parent / filename).items():
                values.setdefault(key, value)
    return values


def gemini_key(secrets: dict[str, str]) -> str:
    return secrets.get("GEMINI_API_KEY") or secrets.get("GOOGLE_API_KEY") or ""


def openai_key(secrets: dict[str, str]) -> str:
    return secrets.get("OPENAI_API_KEY", "")


def gemini_model(secrets: dict[str, str]) -> str:
    return secrets.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")


def openai_model(secrets: dict[str, str]) -> str:
    return secrets.get("OPENAI_IMAGE_MODEL", "gpt-image-1")


def _png_bytes(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.convert("RGB").save(out, format="PNG")
    return out.getvalue()


def _decode_image_bytes(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


def prepare_reference(photo: Image.Image, size: int = 1024) -> Image.Image:
    """Contain the photo on white so Gemini sees the entire collar."""
    rgb = photo.convert("RGB")
    scale = min((size * 0.82) / max(rgb.width, 1), (size * 0.82) / max(rgb.height, 1), 1.0)
    fitted = rgb.resize(
        (max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


def to_strokes(ink: np.ndarray, max_width: int = 4) -> np.ndarray:
    """Turn accidental black slabs into their boundary while retaining lines."""
    dist = ndimage.distance_transform_edt(ink)
    interior = dist > max_width
    if int(interior.sum()) < 120:
        return ink
    return ink & ~interior


def drop_speckles(ink: np.ndarray, min_area: int = 20) -> np.ndarray:
    labeled, count = ndimage.label(ink)
    if count == 0:
        return ink
    keep = np.zeros_like(ink)
    for index in range(1, count + 1):
        piece = labeled == index
        if int(piece.sum()) >= min_area:
            keep |= piece
    return keep if keep.any() else ink


def close_flat_nape(ink: np.ndarray) -> np.ndarray:
    """Bridge only a short nearly-closed top edge; never construct a new neck."""
    out = ink.copy()
    height, width = out.shape
    for y in range(min(height // 4, 70)):
        cols = np.where(out[y])[0]
        if cols.size < 20:
            continue
        left, right = int(cols.min()), int(cols.max())
        span = right - left
        if span < width * 0.15 or cols.size / max(span, 1) < 0.55:
            continue
        out[max(0, y - 1): min(height, y + 2), left:right + 1] = True
        break
    return out


def _raw_ink(image: Image.Image) -> np.ndarray:
    grey = np.asarray(ImageOps.autocontrast(image.convert("L"), cutoff=1))
    if float(np.median(grey)) < 128:
        grey = 255 - grey
    return grey < 150


def speckle_ratio(image: Image.Image) -> float:
    ink = _raw_ink(image)
    labeled, count = ndimage.label(ink)
    if count == 0:
        return 1.0
    sizes = ndimage.sum(ink, labeled, index=range(1, count + 1))
    tiny = sum(float(size) for size in sizes if size < 18)
    return tiny / max(float(ink.sum()), 1.0)


def filled_area_ratio(image: Image.Image) -> float:
    ink = _raw_ink(image)
    deep = ndimage.distance_transform_edt(ink) > 5
    return float(deep.mean())


def validate_lineart(image: Image.Image) -> tuple[bool, list[str], float]:
    """Reject bad raster output before it can be keyed or traced."""
    ink = _raw_ink(image)
    height, width = ink.shape
    total = max(height * width, 1)
    ratio = float(ink.sum()) / total
    reasons: list[str] = []

    if ratio < 0.002:
        reasons.append("drawing is nearly empty")
    if ratio > 0.16:
        reasons.append("too much black ink or shading")
    if filled_area_ratio(image) > 0.025:
        reasons.append("fabric pieces are filled black")
    if speckle_ratio(image) > 0.22:
        reasons.append("drawing contains stipple or photographic grain")

    rim = max(3, round(min(height, width) * 0.008))
    if ink[:rim].any() or ink[-rim:].any() or ink[:, :rim].any() or ink[:, -rim:].any():
        reasons.append("collar or frame touches the image edge")

    ys, xs = np.where(ink)
    if xs.size:
        bw = int(xs.max() - xs.min()) + 1
        bh = int(ys.max() - ys.min()) + 1
        if bw < width * 0.20 or bh < height * 0.08:
            reasons.append("collar is too small or incomplete")
        if bw > width * 0.94 and bh > height * 0.82:
            reasons.append("background frame detected")

    # A usable collar raster needs closed white fabric panels and a separate
    # closed head opening. Open scribbles cannot become a solid fillable part.
    closed_regions = 0
    min_region = max(80, round(total * 0.001))
    for iterations in (2, 3, 4, 6):
        sealed = ndimage.binary_closing(ink, iterations=iterations)
        open_cells = ~sealed
        seed = np.zeros_like(open_cells)
        seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
        exterior = ndimage.binary_propagation(seed & open_cells, mask=open_cells)
        pockets = (~exterior) & ~sealed
        labels, count = ndimage.label(pockets)
        if count:
            sizes = ndimage.sum(pockets, labels, index=range(1, count + 1))
            closed_regions = max(closed_regions, sum(float(size) >= min_region for size in sizes))
    if closed_regions < 2:
        reasons.append("outlines do not close into fabric and head-opening regions")

    score = 4.0 - ratio * 6.0 - filled_area_ratio(image) * 30.0 - speckle_ratio(image) * 8.0
    return not reasons, reasons, score


def clean_lineart(image: Image.Image) -> Image.Image:
    grey = ImageOps.autocontrast(image.convert("L"), cutoff=1)
    if float(np.median(np.asarray(grey))) < 128:
        grey = ImageOps.invert(grey)
    grey = grey.filter(ImageFilter.GaussianBlur(radius=0.25))
    ink = np.asarray(grey) < 168
    ink = drop_speckles(ink, min_area=18)
    ink = to_strokes(ink, max_width=5)
    rgb = np.full((*ink.shape, 3), 255, dtype=np.uint8)
    rgb[ink] = 0
    return Image.fromarray(rgb, "RGB")


def isolate_collar(image: Image.Image) -> Image.Image:
    return clean_lineart(image)


def parse_collar_name(text: str) -> str:
    match = re.search(r"(?im)^\s*name\s*:\s*(.+)$", text or "")
    if not match:
        return ""
    raw = re.sub(r"\s+", " ", match.group(1)).strip(" `\"*.-:")
    words = raw.split()
    if not 2 <= len(words) <= 6 or len(raw) > 60:
        return ""
    return raw[:1].upper() + raw[1:]


def _gemini_error(raw: str) -> str:
    try:
        message = str((json.loads(raw).get("error") or {}).get("message") or raw)
    except Exception:
        message = raw
    return message[:500]


def _gemini_once(
    photo: Image.Image,
    api_key: str,
    model: str,
    prompt: str,
    *,
    image_response: bool = True,
    timeout: int = 180,
) -> tuple[Image.Image | None, str, str]:
    config = {"responseModalities": ["TEXT", "IMAGE"]} if image_response else {}
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {
                    "mime_type": "image/png",
                    "data": base64.b64encode(_png_bytes(photo)).decode("ascii"),
                }},
            ],
        }],
        "generationConfig": config,
    }
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return None, "", _gemini_error(exc.read().decode("utf-8", errors="replace"))
    except Exception as exc:
        return None, "", str(exc)

    image: Image.Image | None = None
    texts: list[str] = []
    for candidate in body.get("candidates") or []:
        for part in (candidate.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data") or {}
            if image is None and inline.get("data"):
                try:
                    image = _decode_image_bytes(base64.b64decode(inline["data"]))
                except Exception as exc:
                    return None, "", f"Could not decode Gemini image: {exc}"
            if part.get("text"):
                texts.append(str(part["text"]))
    if image_response and image is None:
        return None, "\n".join(texts), f"{model}: no image in response"
    return image, "\n".join(texts), ""


def name_collar_gemini(photo: Image.Image, api_key: str, model: str) -> str:
    _image, text, _error = _gemini_once(
        prepare_reference(photo), api_key, model, NAME_PROMPT,
        image_response=False, timeout=60,
    )
    return parse_collar_name(text)


def generate_lineart_gemini(
    photo: Image.Image,
    api_key: str,
    model: str | None = None,
    on_progress=None,
) -> tuple[Image.Image, str]:
    """Run three passes and return only a raster that passes validation."""
    chosen_model = model or gemini_model(load_secrets())
    reference = prepare_reference(photo)
    best: tuple[Image.Image, float] | None = None
    failures: list[str] = []
    previous_failure = ""

    for number in range(1, 4):
        if on_progress:
            on_progress(f"Drawing and checking the collar — pass {number}/3")
        prompt = LINEART_PROMPT
        if number > 1:
            prompt = (
                RETRY_PROMPT
                + (f"\nPrevious validation failure: {previous_failure}\n" if previous_failure else "")
                + "\n"
                + LINEART_PROMPT
            )
        image, _text, error = _gemini_once(reference, api_key, chosen_model, prompt)
        if image is None:
            failures.append(error or "no image returned")
            continue
        valid, reasons, score = validate_lineart(image)
        if not valid:
            previous_failure = ", ".join(reasons)
            failures.append(f"pass {number}: {previous_failure}")
            continue
        cleaned = clean_lineart(image)
        cleaned_valid, cleaned_reasons, cleaned_score = validate_lineart(cleaned)
        if not cleaned_valid:
            previous_failure = ", ".join(cleaned_reasons)
            failures.append(f"pass {number} after key cleanup: {previous_failure}")
            continue
        final_score = score + cleaned_score
        if best is None or final_score > best[1]:
            best = (cleaned, final_score)

    if best is None:
        detail = "; ".join(failures[-3:])
        raise RuntimeError(
            "Gemini did not produce a clean, complete collar drawing"
            + (f": {detail}" if detail else "")
        )

    name = name_collar_gemini(photo, api_key, chosen_model)
    return best[0], name


def generate_lineart_openai(
    photo: Image.Image,
    api_key: str,
    model: str = "gpt-image-1",
) -> Image.Image:
    reference = prepare_reference(photo)
    png = _png_bytes(reference)
    boundary = "cerigaCollarBoundary"
    fields = [
        ("model", model),
        ("prompt", LINEART_PROMPT),
        ("size", "1024x1024"),
    ]
    parts: list[bytes] = []
    for key, value in fields:
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n"
            f"{value}\r\n".encode()
        )
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; "
        f"filename=\"collar.png\"\r\nContent-Type: image/png\r\n\r\n".encode()
        + png + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    request = urllib.request.Request(
        "https://api.openai.com/v1/images/edits",
        data=b"".join(parts),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode("utf-8", errors="replace")[:500]) from exc
    data = (body.get("data") or [{}])[0]
    encoded = data.get("b64_json")
    if not encoded:
        raise RuntimeError("OpenAI returned no image")
    image = _decode_image_bytes(base64.b64decode(encoded))
    valid, reasons, _score = validate_lineart(image)
    if not valid:
        raise RuntimeError("OpenAI drawing failed validation: " + ", ".join(reasons))
    return clean_lineart(image)

