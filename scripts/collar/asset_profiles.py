from __future__ import annotations

import io
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import collar_from_photo as collar
import trace_svg as tracer

ROOT = Path(__file__).resolve().parents[2]
IDENTITY = {"x": 0, "y": 0, "scale": 1, "scaleX": 1, "scaleY": 1, "rotation": 0}


def validate_svg(svg: str) -> None:
    root = ET.fromstring(svg)
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError("Trace did not produce an SVG")
    paths = list(root.iter("{http://www.w3.org/2000/svg}path"))
    if not paths or not any(path.get("d", "").strip() for path in paths):
        raise ValueError("Trace is empty")
    if len(svg) > 4_000_000 or len(paths) > 5000:
        raise ValueError("Trace contains excessive background or detail")
    for element in root.iter():
        if element.tag not in {f"{{http://www.w3.org/2000/svg}}{tag}" for tag in ("svg", "g", "path", "title", "desc", "metadata")}:
            raise ValueError("Trace contains unsupported SVG content")
        if any(name.lower().startswith("on") or "href" in name.lower() or "url(" in value.lower() for name, value in element.attrib.items()):
            raise ValueError("Trace contains external or active content")


def validate_render(svg: str) -> None:
    import resvg_py

    png = resvg_py.svg_to_bytes(svg_string=svg, width=512, height=512)
    alpha = np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))[..., 3] >= 128
    if alpha.sum() < 10:
        raise ValueError("Registered trace renders empty. Retry with a clearer reference.")
    if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
        raise ValueError("Registered trace is clipped by the canvas. Adjust crop.")


def masks(drawing: Image.Image, category: str) -> tuple[np.ndarray, np.ndarray]:
    ink = np.asarray(drawing.convert("L")) < 168
    density = float(ink.mean())
    maximum_density = .35 if category == "zip" else .18
    if density <= .001:
        raise ValueError(f"Trace contains insufficient construction ink ({density:.2%}; must exceed 0.10%)")
    if density >= maximum_density:
        raise ValueError(f"Trace contains excessive dark coverage ({density:.2%}; must be below {maximum_density:.0%} for {category})")
    if ink[:4].any() or ink[-4:].any() or ink[:, :4].any() or ink[:, -4:].any():
        raise ValueError("Part touches the image boundary. Adjust crop.")
    closed = ndimage.binary_closing(ink, iterations=3)
    solid = ndimage.binary_fill_holes(closed)
    labels, count = ndimage.label(solid)
    sizes = np.bincount(labels.ravel())
    if not count:
        raise ValueError(f"Could not identify {category} boundary")
    sizes[0] = 0
    largest = labels == int(sizes.argmax())
    if largest.sum() < ink.sum() * 2 or largest.sum() < 1500:
        raise ValueError(f"Could not identify {category} boundary. Close the outer contour or adjust crop.")
    if (solid & ~largest).sum() > largest.sum() * .12:
        raise ValueError(f"Multiple {category} boundaries found. Crop to one part.")
    rows, columns = np.where(largest)
    area = (rows.max() - rows.min() + 1) * (columns.max() - columns.min() + 1)
    if area > ink.size * .85:
        raise ValueError("Trace contains excessive background")
    return largest, ink & ndimage.binary_dilation(largest, iterations=3)


def traced(fabric: np.ndarray, ink: np.ndarray) -> str:
    svg = tracer.wrap_svg("Custom asset", tracer.trace(fabric), tracer.trace(ink))
    validate_svg(svg)
    return svg


def raster_catalog(category: str, name: str) -> np.ndarray:
    import resvg_py

    path = ROOT / "src/assets/studio-tshirt" / category / f"{name}.svg"
    png = resvg_py.svg_to_bytes(svg_path=str(path), width=1536, height=1536)
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGBA").crop((256, 0, 1280, 1536)))[..., 3] >= 128


class CollarRegistrationProfile:
    name = "CollarRegistrationProfile"

    def register(self, drawing: Image.Image, request: dict) -> dict:
        garment = request["garmentType"]
        if garment not in {"tshirt", "tshirtTest"} or request["fit"] != "slim" or request["view"] != "front":
            raise ValueError("Collar attachment uncertain: this socket is verified only for Slim tees, front view. The garment fit has not been changed.")
        anchors = (collar.DEST_LEFT, collar.DEST_RIGHT)
        if garment == "tshirt":
            neck = raster_catalog("Neck", "Crew neck")
            interior = raster_catalog("Inner back neck", "Inner back neck crew")
            body = raster_catalog("Body", "Body crew")
            hole = ndimage.binary_fill_holes(neck | interior) & ~neck
            anchors = collar.shoulder_ends(neck)
            result = collar.build_from_drawing(drawing, socket_masks={
                "collar": neck, "interior": interior, "body": body, "hole": hole,
                "ink": np.zeros_like(body),
            }, anchors=anchors)
        else:
            result = collar.build_from_drawing(drawing)
        validate_svg(result["neckSvg"])
        validate_svg(result["bodySvg"])
        return {
            "svg": result["neckSvg"], "bodySvg": result["bodySvg"],
            "compatibility": {"garmentTypes": [garment], "fits": ["slim"], "views": ["front"]},
            "registration": {"profile": self.name, "version": 1, "layerId": "neck",
                             "defaultTransform": IDENTITY, "socket": "studio-slim-crew-v1" if garment == "tshirt" else "test-slim-crew-v1",
                             "anchors": {"left": list(anchors[0]), "right": list(anchors[1])}},
        }


class PocketPlacementProfile:
    name = "PocketPlacementProfile"

    def register(self, drawing: Image.Image, request: dict) -> dict:
        detail_type = request.get("detailType", "pocket")
        default_width, position_x, position_y = {"pocket": (.2, .72, .4), "button": (.06, .5, .43), "zip": (.055, .5, .31), "patch": (.15, .72, .4)}[detail_type]
        fabric, ink = masks(drawing, detail_type)
        rows, columns = np.where(fabric | ink)
        top, bottom = max(0, int(rows.min()) - 5), min(fabric.shape[0], int(rows.max()) + 6)
        left, right = max(0, int(columns.min()) - 5), min(fabric.shape[1], int(columns.max()) + 6)
        height, width = bottom - top, right - left
        svg = traced(fabric[top:bottom, left:right], ink[top:bottom, left:right])
        scale = 2048 / max(width, height)
        view_box = f"{(2048-width*scale)/2} {(2048-height*scale)/2} {width*scale} {height*scale}"
        return {
            "svg": svg.replace('viewBox="0 0 2048 2048"', f'viewBox="{view_box}"'),
            "compatibility": {"garmentTypes": ["tshirt", "tshirtTest"], "fits": ["slim", "regular", "boxy", "oversized"], "views": ["front", "back"]},
            "registration": {"profile": self.name, "version": 1, "layerId": "pocket",
                             "defaultTransform": {**IDENTITY, "x": position_x, "y": position_y},
                             "width": default_width, "ratio": width / height, "socket": "free-placement-v1"},
        }


class SleeveRegistrationProfile:
    name = "SleeveRegistrationProfile"

    def register(self, drawing: Image.Image, request: dict) -> dict:
        fit, side = request["fit"], request["side"]
        if request["garmentType"] != "tshirt" or fit not in {"slim", "regular", "boxy", "oversized"} or request["view"] != "front":
            raise ValueError("Armhole connection failed: no verified socket for this garment and fit")
        fabric, ink = masks(drawing, "sleeve")
        rows, columns = np.where(fabric)
        source_top, source_bottom = int(rows.min()), int(rows.max())
        right_edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in fabric])
        edge_rows = np.flatnonzero(right_edges >= right_edges.max() - 6)
        upper, lower = int(edge_rows.min()), int(edge_rows.max())
        if lower - upper < (source_bottom - source_top) * .4:
            raise ValueError("Could not identify sleeve boundary: armhole must be the right edge of a single left-sleeve technical drawing")
        tag = "" if fit == "slim" else f" ({fit})"
        suffix = "Left" if side == "left" else "Right"
        original = raster_catalog(f"{suffix} sleeve", f"{suffix} sleeve{tag}") | raster_catalog(f"{suffix} cuff", f"{suffix} cuff{tag}")
        if side == "right":
            original = np.fliplr(original)
        socket = original.copy()
        if fit == "oversized":
            socket[:408] = False
        target_rows = np.where(socket)[0]
        target_top, old_bottom = int(target_rows.min()), int(target_rows.max())
        target_edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in socket])
        join_rows = np.flatnonzero(target_edges >= target_edges.max() - 3)
        target_bottom = int(join_rows[-1])
        if target_bottom - target_top < 20:
            raise ValueError("Armhole connection failed: catalog socket is incomplete")
        target_edges[target_top:target_bottom + 1] = np.linspace(target_edges[target_top], target_edges[target_bottom], target_bottom - target_top + 1).round().astype(int)
        scale = (target_bottom - target_top) / (lower - upper)
        registered = np.zeros_like(socket)
        registered_ink = np.zeros_like(socket)
        mapped_top = round(target_top + (source_top - upper) * scale)
        mapped_bottom = round(target_top + (source_bottom - upper) * scale)
        if mapped_top < 4 or mapped_bottom >= socket.shape[0] - 4:
            raise ValueError("Sleeve exceeds the drawing canvas. Adjust crop or choose a different reference.")
        for target_row in range(mapped_top, mapped_bottom + 1):
            source_row = min(source_bottom, max(source_top, round(upper + (target_row - target_top) / scale)))
            source_columns = np.flatnonzero(fabric[source_row])
            if not source_columns.size:
                raise ValueError("Armhole connection failed: discontinuous sleeve boundary")
            start, stop = int(source_columns.min()), int(source_columns.max())
            width = max(2, round((stop - start + 1) * scale))
            socket_row = min(target_bottom, max(target_top, target_row))
            inner = int(target_edges[socket_row])
            if target_row < target_top or target_row > target_bottom:
                source_socket_row = upper if target_row < target_top else lower
                inner += round((right_edges[source_row] - right_edges[source_socket_row]) * scale)
            if inner - width < 3 or inner >= socket.shape[1] - 3 or width > 650:
                raise ValueError("Sleeve exceeds the drawing canvas. Adjust crop or choose a different reference.")
            mapped = np.linspace(start, stop, width).round().astype(int)
            registered[target_row, inner-width+1:inner+1] = fabric[source_row, mapped]
            registered_ink[target_row, inner-width+1:inner+1] = ink[source_row, mapped]
        if not registered.any() or any(not registered[row, target_edges[row]] for row in range(target_top, target_bottom + 1)):
            raise ValueError("Armhole connection failed")
        registered_ink |= registered & ~ndimage.binary_erosion(registered, iterations=2)
        registered[:target_top] |= original[:target_top]
        keep = np.ones_like(socket)
        for target_row in range(max(0, target_top - 4), min(socket.shape[0], old_bottom + 5)):
            inner = target_edges[min(max(target_row, target_top), target_bottom)]
            keep[target_row, :max(0, inner - 3)] = False
        body = raster_catalog("Body", f"Body{tag}")
        if side == "right":
            body = np.fliplr(body)
        for target_row in range(old_bottom + 5, socket.shape[0]):
            body_columns = np.flatnonzero(body[target_row])
            inner = int(body_columns[0]) if body_columns.size else socket.shape[1] // 2
            keep[target_row, :max(0, inner - 4)] = False
        if side == "right":
            registered, registered_ink, keep = np.fliplr(registered), np.fliplr(registered_ink), np.fliplr(keep)
        keep_svg = tracer.wrap_svg("Retained garment", tracer.trace(keep), "")
        validate_svg(keep_svg)
        return {
            "svg": traced(registered, registered_ink), "keepSvg": keep_svg,
            "compatibility": {"garmentTypes": ["tshirt"], "fits": [fit], "views": ["front"]},
            "registration": {"profile": self.name, "version": 1, "layerId": f"sleeve{suffix}",
                             "defaultTransform": IDENTITY, "socket": f"studio-{fit}-{side}-armhole-v1",
                             "cuff": "integrated", "side": side,
                             "anchors": {"source": [[int(right_edges[upper]), upper], [int(right_edges[lower]), lower]],
                                         "target": [[int(target_edges[target_top]), target_top], [int(target_edges[target_bottom]), target_bottom]]}},
        }


PROFILES = {"collar": CollarRegistrationProfile(), "sleeve": SleeveRegistrationProfile(), "pocket": PocketPlacementProfile()}