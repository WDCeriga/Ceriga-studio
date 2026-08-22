"""Garment neckline photo -> clean black-and-white tech-pack line art.

This version is intentionally conservative:
- The image model is responsible for understanding and redrawing the neckline.
- We do NOT use morphology/hole detection to reconstruct the collar afterward.
- We do NOT invent a V-neck, placket, buttons, or other construction details.
- Post-processing only converts the result to solid black strokes on white.
- The original generate_lineart(photo) function is preserved for reuse by an app.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps
from scipy import ndimage


# ---------------------------------------------------------------------------
# PROMPTS
# ---------------------------------------------------------------------------

LINEART_PROMPT = r"""
EDIT the attached garment photograph into a professional fashion tech-pack
construction drawing of ONLY the neckline/collar.

IMPORTANT: Reproduce the actual photographed construction. Do not redesign it,
simplify it into a generic V-neck, or invent construction details.

The photographed garment has:
- a ROUND / CREW ribbed neckline around the neck;
- a ribbed V-SHAPED INSERT / GUSSET inside the front of the crew neckline;
- the V insert extends downward to a sharp point;
- the V insert is part of the neckline construction;
- this is NOT a conventional V-neck;
- a back-neck label/label area is visible.

The V-shaped insert must remain inside the round crew neckline exactly as in
the photograph. Preserve the proportions, depth, width, overlap, ribbing,
seams and construction lines visible in the reference.

DRAWING REQUIREMENTS:
- Front-view fashion flat / technical construction sketch.
- ONLY the neckline/collar. Remove the garment body.
- Large, centered neckline with generous WHITE space on every side.
- Show the complete back-of-neck/nape as a smooth curved line.
- The complete collar must fit inside the image. Never crop the top.
- Show the round rib collar and its inner and outer edges.
- Show the ribbed V-shaped insert/gusset and its sharp lower point.
- Show the seam/binding lines where the V insert joins the collar.
- Show the visible back-neck label box/label area if present in the photo.
- Preserve visible construction/stitching details.
- White background.
- White inside all openings and closed shapes.
- BLACK LINEWORK ONLY.
- Thin, clean technical outlines.
- No colour.
- No blue garment fill.
- No grey shading.
- No texture or photographic fabric.
- No black filled neck opening.
- No black filled collar slab.
- No person, head, hair, skin, torso, shoulders or sleeves.
- Do not add buttons, zippers, plackets, drawcords, or any other feature
  that is not visible in the reference.
- Do not turn the neckline into a standard V-neck.

The output should look like a clean garment tech-pack flat sketch that a
designer could trace/vectorise in Illustrator or Procreate.
"""


RETRY_PROMPT = r"""
REDRAW the attached garment neckline as a clean black-and-white fashion
tech-pack construction drawing.

The previous attempt was incorrect. The key construction is:

1. A ROUND RIBBED CREW NECK forms the main neckline.
2. A RIBBED V-SHAPED INSERT/GUSSET sits INSIDE the front of that crew neck.
3. The V insert comes down to a sharp point.
4. The V insert does NOT replace the round neckline.
5. Reproduce the photographed construction rather than creating a generic
   V-neck.

Requirements:
- Complete collar visible.
- White space above the back/nape.
- Smooth curved back neckline; never crop or flatten the top.
- Black outlines only.
- White background.
- White openings and white interiors.
- Show inner and outer collar edges.
- Show ribbing/construction lines.
- Show the V insert and its joining/seam lines.
- Show the back-neck label area if visible.
- No coloured fills.
- No grey.
- No black neck opening.
- No black collar slab.
- No garment body.
- No person.
- No invented buttons, placket, zipper or other details.

This must be a technical drawing of the EXACT photographed neckline.
"""


NAME_PROMPT = r"""
Look at the attached garment neckline photograph.

Reply with ONE line only:
Name: <2 to 6 word neckline/collar name>

Describe the actual construction shown in the photograph. Do not call it a
generic V-neck if the V is an insert inside a crew neckline.
"""


# ---------------------------------------------------------------------------
# ENVIRONMENT / FILE HELPERS
# ---------------------------------------------------------------------------

def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    if not path.is_file():
        return values

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def load_secrets() -> dict[str, str]:
    """Load environment variables plus common .env locations."""
    secrets = dict(os.environ)

    here = Path(__file__).resolve()

    candidates = (
        here.parent / ".env",
        here.parent.parent / ".env",
        Path.cwd() / ".env",
        Path.cwd() / ".env.local",
    )

    for path in candidates:
        for key, value in _read_env_file(path).items():
            secrets.setdefault(key, value)

    return secrets


def gemini_key(secrets: dict[str, str]) -> str:
    return (
        secrets.get("GEMINI_API_KEY")
        or secrets.get("GOOGLE_API_KEY")
        or secrets.get("GOOGLE_GENERATIVE_AI_API_KEY")
        or ""
    ).strip()


def openai_key(secrets: dict[str, str]) -> str:
    return (secrets.get("OPENAI_API_KEY") or "").strip()


def gemini_model(secrets: dict[str, str]) -> str:
    return (
        secrets.get("GEMINI_IMAGE_MODEL")
        or os.environ.get("GEMINI_IMAGE_MODEL")
        or "gemini-3.1-flash-image"
    ).strip()


def openai_model(secrets: dict[str, str]) -> str:
    return (
        secrets.get("OPENAI_IMAGE_MODEL")
        or os.environ.get("OPENAI_IMAGE_MODEL")
        or "gpt-image-1"
    ).strip()


# ---------------------------------------------------------------------------
# IMAGE ENCODING
# ---------------------------------------------------------------------------

def _png_bytes(img: Image.Image) -> bytes:
    buffer = io.BytesIO()
    img.convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue()


def _decode_image_bytes(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    return image.convert("RGB")


# ---------------------------------------------------------------------------
# BACKWARD-COMPATIBILITY / INPUT DETECTION
# ---------------------------------------------------------------------------

def looks_like_lineart(img: Image.Image) -> bool:
    """
    Backward-compatible helper used by older versions of the app.

    IMPORTANT:
    This is only a detector. It does NOT reject uploads.

    Any supported image can be uploaded:
    - garment photographs
    - screenshots
    - scans
    - existing technical drawings
    - black-and-white sketches
    - coloured references
    - PNG/JPEG/WEBP/etc.

    The caller can use this function to describe the input to the model, but
    the upload should never fail just because the image is not line art.
    """
    try:
        grey = img.convert("L")
        arr = np.asarray(grey)

        if arr.size == 0:
            return False

        total = arr.size
        white = float((arr >= 240).sum()) / total
        ink = float((arr < 40).sum()) / total
        mid = float(((arr >= 40) & (arr < 240)).sum()) / total

        return (
            white > 0.75
            and ink > 0.008
            and mid < 0.12
        )
    except Exception:
        # Detection must never break an upload.
        return False


def describe_input_type(img: Image.Image) -> str:
    """Return a harmless description of the reference for prompt selection."""
    if looks_like_lineart(img):
        return "The reference appears to already be a black-and-white technical drawing."
    return "The reference is a photographic, coloured, scanned, or otherwise non-line-art image."


# ---------------------------------------------------------------------------
# INPUT PREPARATION
# ---------------------------------------------------------------------------

def prepare_reference(photo: Image.Image) -> Image.Image:
    """
    Put the reference into a clean white canvas without trying to interpret
    or redraw its construction.

    We deliberately avoid edge extraction and morphological processing here.
    Those operations were damaging the neckline structure.
    """
    # Accept any PIL-readable image mode, including RGBA, grayscale, palette,
    # CMYK and images with transparency. Flatten transparency onto white.
    if photo.mode in ("RGBA", "LA"):
        rgba = photo.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        photo = Image.alpha_composite(background, rgba).convert("RGB")
    else:
        photo = photo.convert("RGB")

    # Keep the reference comfortably inside the model's frame.
    max_dimension = 1536

    if max(photo.size) > max_dimension:
        scale = max_dimension / max(photo.size)
        photo = photo.resize(
            (
                max(1, round(photo.width * scale)),
                max(1, round(photo.height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )

    # A little white breathing room prevents the top of the collar being
    # interpreted as cropped.
    pad_x = max(80, round(photo.width * 0.12))
    pad_y = max(100, round(photo.height * 0.18))

    canvas = Image.new(
        "RGB",
        (photo.width + pad_x * 2, photo.height + pad_y * 2),
        (255, 255, 255),
    )

    canvas.paste(photo, (pad_x, pad_y))
    return canvas


# ---------------------------------------------------------------------------
# OUTPUT CLEANUP
# ---------------------------------------------------------------------------

def crush_lineart(
    img: Image.Image,
    threshold: int = 205,
    blur_radius: float = 0.0,
) -> Image.Image:
    """
    Convert an AI line drawing into solid black ink on pure white.

    This does NOT try to identify the collar or reconstruct its geometry.
    It only cleans the rendered image.
    """
    grey = img.convert("L")

    if blur_radius > 0:
        grey = grey.filter(ImageFilter.GaussianBlur(blur_radius))

    grey = ImageOps.autocontrast(grey, cutoff=1)

    # If an image somehow came back inverted, correct it.
    if float(np.median(np.asarray(grey))) < 128:
        grey = ImageOps.invert(grey)

    arr = np.asarray(grey)

    output = np.full((*arr.shape, 3), 255, dtype=np.uint8)
    output[arr < threshold] = (0, 0, 0)

    return Image.fromarray(output, mode="RGB")


def clean_lineart(img: Image.Image) -> Image.Image:
    """
    Conservative cleanup.

    No edge tracing, no hole filling, no dilation/erosion and no collar
    isolation. Those operations can destroy small construction details.
    """
    return crush_lineart(img, threshold=205)


def isolate_collar(img: Image.Image) -> Image.Image:
    """Back-compat name used by collar_from_photo — cleanup only, no geometry rewrite."""
    return clean_lineart(img)


def to_strokes(ink: np.ndarray, max_width: int = 4) -> np.ndarray:
    """Keep thin construction lines; turn filled slabs into their outlines."""
    dist = ndimage.distance_transform_edt(ink)
    interior = dist > max_width
    if int(interior.sum()) < 120:
        return ink
    return ink & ~interior


def close_flat_nape(ink: np.ndarray) -> np.ndarray:
    """If the back of the neck was cropped to a straight line, close it with a curve."""
    height, width = ink.shape
    out = ink.copy()
    for y in range(min(height // 3, 80)):
        cols = np.where(out[y])[0]
        if cols.size < 16:
            continue
        left, right = int(cols.min()), int(cols.max())
        span = right - left
        if span < width * 0.12:
            continue
        coverage = cols.size / max(span, 1)
        if coverage < 0.32 and y > 6:
            continue
        cx = (left + right) / 2.0
        radius = max(span / 2.0, 1.0)
        bulge = min(max(y - 2, 12), radius * 0.5, 80)
        for x in range(left, right + 1):
            t = (x - cx) / radius
            if abs(t) > 1:
                continue
            yy = int(round(y - bulge * (1 - t * t)))
            for row in range(max(0, yy - 1), min(height, yy + 2)):
                out[row, x] = True
        break
    return out


# ---------------------------------------------------------------------------
# QUALITY CHECKS
# ---------------------------------------------------------------------------

def _ink_array(img: Image.Image) -> np.ndarray:
    return np.asarray(clean_lineart(img).convert("L")) < 128


def ink_ratio(img: Image.Image) -> float:
    ink = _ink_array(img)
    return float(ink.mean())


def white_ratio(img: Image.Image) -> float:
    grey = np.asarray(img.convert("L"))
    return float((grey >= 240).mean())


def top_crop_score(img: Image.Image) -> float:
    """
    Returns 0 for a safe top margin and higher values when the top edge
    contains suspiciously continuous ink.
    """
    ink = _ink_array(img)

    if ink.size == 0:
        return 1.0

    rows = min(8, ink.shape[0])
    top_ink = float(ink[:rows].mean())

    # A technical drawing should normally have clean white space at the top.
    return top_ink


def filled_area_ratio(img: Image.Image) -> float:
    """
    Detect obvious large black filled regions without attempting to alter them.
    """
    grey = np.asarray(img.convert("L"))
    dark = grey < 45

    if not dark.any():
        return 0.0

    # Count pixels that have dark neighbours on all four sides. Large solid
    # areas tend to contain many such pixels.
    interior = (
        dark[1:-1, 1:-1]
        & dark[:-2, 1:-1]
        & dark[2:, 1:-1]
        & dark[1:-1, :-2]
        & dark[1:-1, 2:]
    )

    return float(interior.mean())


def lineart_score(img: Image.Image) -> float:
    """
    Higher = more likely to be a usable technical line drawing.

    This is deliberately a soft score. The model's geometry is not modified
    based on the score.
    """
    ratio = ink_ratio(img)
    top = top_crop_score(img)
    filled = filled_area_ratio(img)

    score = 0.0

    # Too little ink = probably an empty response.
    if ratio < 0.002:
        score -= 10.0
    else:
        score += min(ratio * 18.0, 3.0)

    # Penalise excessive black fill.
    score -= min(filled * 12.0, 5.0)

    # Penalise ink touching the top.
    score -= min(top * 20.0, 5.0)

    # A drawing should mostly be white.
    if white_ratio(img) < 0.70:
        score -= 2.0

    return score


# ---------------------------------------------------------------------------
# NAME PARSING
# ---------------------------------------------------------------------------

def parse_collar_name(text: str) -> str:
    if not text:
        return ""

    match = re.search(
        r"(?im)^\s*(?:name|collar|neckline)\s*[:\-]\s*(.+)$",
        text.strip(),
    )

    raw = (
        match.group(1)
        if match
        else text.strip().splitlines()[0]
    ).strip()

    raw = re.sub(r'^[`"*]+|[`"*]+$', "", raw)
    raw = re.sub(r"\s+", " ", raw).strip(" -:")

    # Keep the returned name short and safe.
    words = raw.split()

    if len(words) < 2:
        return ""

    if len(words) > 6:
        raw = " ".join(words[:6])

    if len(raw) < 3 or len(raw) > 60:
        return ""

    if re.search(r"https?://|[{}=]", raw, re.I):
        return ""

    return raw[:1].upper() + raw[1:]


# ---------------------------------------------------------------------------
# GEMINI
# ---------------------------------------------------------------------------

def _gemini_error_message(raw: str) -> str:
    try:
        payload = json.loads(raw)
        message = str(
            (payload.get("error") or {}).get("message")
            or raw
        )
    except Exception:
        message = raw

    lower = message.lower()

    if "quota" in lower or "resource_exhausted" in lower:
        return (
            "Gemini image generation quota was exhausted. "
            "Check the Gemini API key/billing configuration."
        )

    return message[:500]


def _gemini_once(
    photo: Image.Image,
    api_key: str,
    model: str,
    prompt: str,
    timeout: int = 180,
) -> tuple[Image.Image | None, str, str]:

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(
                                _png_bytes(photo)
                            ).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
        },
    }

    url = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model}:generateContent"
    )

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(
                response.read().decode("utf-8")
            )
    except urllib.error.HTTPError as exc:
        return (
            None,
            "",
            _gemini_error_message(
                exc.read().decode("utf-8", errors="replace")
            ),
        )
    except urllib.error.URLError as exc:
        return None, "", f"{model}: {exc.reason}"
    except Exception as exc:
        return None, "", f"{model}: {exc}"

    image: Image.Image | None = None
    texts: list[str] = []

    for candidate in body.get("candidates") or []:
        content = candidate.get("content") or {}

        for part in content.get("parts") or []:
            inline = (
                part.get("inlineData")
                or part.get("inline_data")
                or {}
            )

            data = inline.get("data")

            if data and image is None:
                try:
                    image = _decode_image_bytes(
                        base64.b64decode(data)
                    )
                except Exception as exc:
                    return None, "", f"Could not decode Gemini image: {exc}"

            text = part.get("text")

            if text:
                texts.append(str(text))

    if image is None:
        return (
            None,
            parse_collar_name("\n".join(texts)),
            f"{model}: no image in response",
        )

    return image, parse_collar_name("\n".join(texts)), ""


def name_collar_gemini(
    photo: Image.Image,
    api_key: str,
    model: str,
) -> str:

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": NAME_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(
                                _png_bytes(photo)
                            ).decode("ascii"),
                        }
                    },
                ]
            }
        ]
    }

    url = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model}:generateContent"
    )

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(
                response.read().decode("utf-8")
            )
    except Exception:
        return ""

    texts: list[str] = []

    for candidate in body.get("candidates") or []:
        for part in (candidate.get("content") or {}).get("parts") or []:
            if part.get("text"):
                texts.append(str(part["text"]))

    return parse_collar_name("\n".join(texts))


def generate_lineart_gemini(
    photo: Image.Image,
    api_key: str,
    model: str | None = None,
    on_progress=None,
) -> tuple[Image.Image, str]:

    if not model:
        model = gemini_model(load_secrets())

    framed = prepare_reference(photo)

    # Two attempts are enough. More attempts can actually increase the chance
    # of selecting an unusual interpretation of the collar.
    attempts = (
        LINEART_PROMPT,
        RETRY_PROMPT,
    )

    best: tuple[Image.Image, str, float] | None = None
    last_error = "Gemini image generation failed"

    for number, prompt in enumerate(attempts, start=1):

        if on_progress:
            on_progress(
                f"Drawing the neckline — pass {number}/{len(attempts)}"
            )

        contextual_prompt = (
            describe_input_type(photo)
            + "\n\n"
            + prompt
        )

        image, name, error = _gemini_once(
            framed,
            api_key,
            model,
            contextual_prompt,
            timeout=180,
        )

        if image is None:
            last_error = error or last_error
            continue

        cleaned = clean_lineart(image)
        score = lineart_score(cleaned)

        if best is None or score > best[2]:
            best = (cleaned, name, score)

    if best is None:
        raise RuntimeError(last_error)

    drawing, name, _score = best

    if not name:
        name = name_collar_gemini(
            photo,
            api_key,
            model,
        )

    return drawing, name


# ---------------------------------------------------------------------------
# OPENAI
# ---------------------------------------------------------------------------

def generate_lineart_openai(
    photo: Image.Image,
    api_key: str,
    model: str = "gpt-image-1",
) -> Image.Image:

    reference = prepare_reference(photo)
    png = _png_bytes(reference)

    boundary = "cerigaCollarBoundary"

    parts = [
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="model"\r\n\r\n'
            f"{model}\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="prompt"\r\n\r\n'
            f"{describe_input_type(photo)}\r\n\r\n"
            f"{LINEART_PROMPT}\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="size"\r\n\r\n'
            f"1024x1024\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="image"; '
            f'filename="collar.png"\r\n'
            f"Content-Type: image/png\r\n\r\n"
        ).encode()
        + png
        + b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]

    request = urllib.request.Request(
        "https://api.openai.com/v1/images/edits",
        data=b"".join(parts),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": (
                f"multipart/form-data; boundary={boundary}"
            ),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(
                response.read().decode("utf-8")
            )
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            exc.read().decode("utf-8", errors="replace")[:500]
        ) from exc

    data = (body.get("data") or [{}])[0]
    b64 = data.get("b64_json")

    if not b64:
        raise RuntimeError("OpenAI returned no image")

    return clean_lineart(
        _decode_image_bytes(
            base64.b64decode(b64)
        )
    )


# ---------------------------------------------------------------------------
# LOCAL FALLBACK
# ---------------------------------------------------------------------------

def local_sketch_lineart(photo: Image.Image) -> Image.Image:
    """
    Local fallback.

    This is only used when no image-model API key is configured. It is not
    intended to understand the neckline construction; it simply creates a
    rough black/white edge sketch.
    """
    grey = ImageOps.autocontrast(
        photo.convert("L"),
        cutoff=2,
    )

    # Light smoothing reduces photographic noise.
    blur = grey.filter(
        ImageFilter.GaussianBlur(radius=1.2)
    )

    # Edge-like difference.
    edges = ImageOps.invert(
        ImageOps.autocontrast(
            ImageOps.invert(
                ImageChops.difference(blur, grey)
            )
        )
    )

    edges = ImageEnhance.Contrast(edges).enhance(3.0)

    arr = np.asarray(edges)
    output = np.full(
        (*arr.shape, 3),
        255,
        dtype=np.uint8,
    )

    output[arr < 170] = (0, 0, 0)

    return Image.fromarray(output, mode="RGB")


# ---------------------------------------------------------------------------
# MAIN GENERATOR
# ---------------------------------------------------------------------------

def generate_lineart(
    photo: Image.Image,
    on_progress=None,
) -> tuple[Image.Image, str]:
    """
    Main API used by the rest of the application.

    Returns:
        (drawing, source_name)
    """

    # Never reject an upload based on its appearance. The model gets the
    # reference regardless of whether it is a photo, scan, sketch, screenshot,
    # existing line art, or colour image.
    if photo.mode in ("RGBA", "LA"):
        rgba = photo.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        rgb = Image.alpha_composite(background, rgba).convert("RGB")
    else:
        rgb = photo.convert("RGB")

    secrets = load_secrets()

    gkey = gemini_key(secrets)
    okey = openai_key(secrets)

    errors: list[str] = []

    if gkey:
        try:
            if on_progress:
                on_progress("Using Gemini to redraw the neckline...")

            drawing, _name = generate_lineart_gemini(
                rgb,
                gkey,
                gemini_model(secrets),
                on_progress=on_progress,
            )

            return drawing, "gemini"

        except Exception as exc:
            errors.append(f"Gemini: {exc}")

    if okey:
        try:
            if on_progress:
                on_progress("Using OpenAI to redraw the neckline...")

            drawing = generate_lineart_openai(
                rgb,
                okey,
                openai_model(secrets),
            )

            return drawing, "openai"

        except Exception as exc:
            errors.append(f"OpenAI: {exc}")

    # No API key or both APIs failed.
    sketch = local_sketch_lineart(rgb)

    if errors:
        return (
            sketch,
            "local-sketch: " + " | ".join(errors),
        )

    return sketch, "local-sketch"


# ---------------------------------------------------------------------------
# OPTIONAL COMMAND-LINE INTERFACE
# ---------------------------------------------------------------------------

def main() -> int:
    """
    Usage:

        python collar_lineart.py input.jpg
        python collar_lineart.py input.jpg output.png
    """

    if len(sys.argv) < 2:
        print(
            "Usage: python collar_lineart.py "
            "input_image [output_image]"
        )
        return 1

    input_path = Path(sys.argv[1])

    if not input_path.is_file():
        print(f"Input file not found: {input_path}")
        return 1

    output_path = (
        Path(sys.argv[2])
        if len(sys.argv) >= 3
        else input_path.with_name(
            input_path.stem + "_lineart.png"
        )
    )

    try:
        photo = Image.open(input_path).convert("RGB")

        def progress(message: str) -> None:
            print(message, flush=True)

        drawing, source = generate_lineart(
            photo,
            on_progress=progress,
        )

        drawing.save(output_path, format="PNG")

        print(f"Done: {output_path}")
        print(f"Source: {source}")

        return 0

    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())