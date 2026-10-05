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
            "collarTopology": result["collarTopology"],
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
        try:
            result = self.register_exact(drawing, request)
        except ValueError as error:
            if str(error) != "Sleeve cannot fit this garment canvas while retaining its length and armhole connection.":
                raise
            return self.register_adaptive(drawing, request)
        else:
            result["registration"].setdefault("status", "Exact registration")
            return result

    def register_adaptive(self, drawing: Image.Image, request: dict, *, exact: bool = False) -> dict:
        fabric, ink = masks(drawing, "sleeve")
        rows, columns = np.where(fabric)
        source_left, source_right = int(columns.min()), int(columns.max())
        cap_start = round(source_right - .2 * (source_right - source_left))
        seam_rows = np.flatnonzero(fabric[:, cap_start])
        if not seam_rows.size or np.any(np.diff(seam_rows) != 1):
            raise ValueError("Rejected: adapter boundary must be a continuous sleeve cross-section")
        source_top, source_bottom = int(seam_rows[0]), int(seam_rows[-1])
        source_height = source_bottom - source_top
        right_edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in fabric])
        attachment_rows = np.flatnonzero(right_edges >= source_right - 6)
        cap_rows = np.where(fabric[:, cap_start:])[0]
        if np.any(right_edges[seam_rows] < cap_start):
            raise ValueError("Rejected: ambiguous cap boundary; crop to a single connected sleeve")
        cap_excess = np.zeros_like(fabric)
        cap_excess[:source_top, cap_start:] = fabric[:source_top, cap_start:]
        cap_excess[source_bottom + 1:, cap_start:] = fabric[source_bottom + 1:, cap_start:]
        if cap_excess.sum() > fabric.sum() * .2:
            raise ValueError("Needs review: sleeve cap requires excessive trimming")
        fabric = fabric & ~cap_excess
        ink = ink & ndimage.binary_erosion(fabric, iterations=3)
        fit, side = request["fit"], request["side"]
        tag = "" if fit == "slim" else f" ({fit})"
        suffix = "Left" if side == "left" else "Right"
        original = raster_catalog(f"{suffix} sleeve", f"{suffix} sleeve{tag}") | raster_catalog(f"{suffix} cuff", f"{suffix} cuff{tag}")
        body = raster_catalog("Body", f"Body{tag}")
        if side == "right":
            original, body = np.fliplr(original), np.fliplr(body)
        padding = (original.shape[0] - original.shape[1]) // 2
        original = np.pad(original, ((0, 0), (padding, padding)))
        body = np.pad(body, ((0, 0), (padding, padding)))
        socket = original.copy()
        if fit == "oversized":
            socket[:408] = False
        target_top = int(np.where(socket)[0].min())
        edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in socket])
        target_bottom = int(np.flatnonzero(edges >= edges.max() - 3)[-1])
        target_rows = np.arange(target_top, target_bottom + 1)
        body_edges = np.array([np.flatnonzero(row)[0] if row.any() else body.shape[1] // 2 for row in body])
        target_columns = np.maximum(edges[target_rows] + 1, body_edges[target_rows])
        old_bottom = int(np.where(original)[0].max())
        body_edges[target_bottom:old_bottom + 5] = np.maximum(body_edges[target_bottom:old_bottom + 5], target_columns[-1])
        retained_body = body.copy()
        for row in range(target_top, min(body.shape[0], old_bottom + 5)):
            inner = int(np.interp(row, target_rows, target_columns))
            retained_body[row, :inner] = False
        sample_rows = np.unique(np.append(target_rows[::8], target_bottom))
        target = np.column_stack((sample_rows, np.interp(sample_rows, target_rows, target_columns)))
        parameters = (sample_rows - target_top) / (target_bottom - target_top)
        preferred_scale = (target_bottom - target_top) / source_height
        minimum_scale = min(1., max(.4, 48 / (source_height * preferred_scale), .75 / preferred_scale)) if exact else max(.4, 48 / (source_height * preferred_scale), .75 / preferred_scale)
        boundary = np.column_stack(np.where(fabric & ~ndimage.binary_erosion(fabric)))
        boundary = boundary[boundary[:, 1] <= cap_start]
        source_anchor = np.array([(source_top + source_bottom) / 2, cap_start])
        source_depth = cap_start - boundary[:, 1]
        source_across = boundary[:, 0] - source_anchor[0]
        solution = None
        reductions = [1.] if exact else np.unique(np.append(np.arange(1, minimum_scale, -.025), minimum_scale))[::-1]
        for reduction in reductions:
            if reduction > 1:
                continue
            scale = preferred_scale * reduction
            for degrees in range(20, 96, 5):
                radians = np.deg2rad(degrees)
                direction = np.array([np.sin(radians), -np.cos(radians)])
                across = np.array([np.cos(radians), np.sin(radians)])
                for clearance in (4, 12, 24):
                    center = direction * (float((target @ direction).max()) + clearance)
                    center += across * float((target @ across).mean())
                    relative = source_depth[:, None] * direction + source_across[:, None] * across
                    extent = relative * scale
                    shift = max(0, float((center[1] + extent[:, 1]).max() - body_edges[target_bottom:].min() + 8))
                    center -= across * shift / across[1]
                    seam = center + (parameters[:, None] - .5) * source_height * scale * across
                    strips = seam - target
                    tangent = np.diff(target, axis=0) / np.diff(parameters)[:, None]
                    seam_tangent = source_height * scale * across
                    determinants = []
                    for vectors, derivatives in ((strips[:-1], tangent), (strips[1:], tangent), (strips, np.broadcast_to(seam_tangent, strips.shape))):
                        determinants.extend((vectors[:, 0] * derivatives[:, 1] - vectors[:, 1] * derivatives[:, 0]).tolist())
                    if min(determinants) <= 1:
                        continue
                    placed = center + extent
                    bounds = np.concatenate((placed, target, seam))
                    if (bounds.min(axis=0) < 5).any() or (bounds.max(axis=0) >= np.array(body.shape) - 5).any():
                        continue
                    registered, registered_ink, rigid = self.render_adapter(
                        fabric, ink, body.shape, cap_start, source_top, source_bottom,
                        target, parameters, center, direction, across, scale, bounds)
                    sampled_columns = np.interp(target_rows, sample_rows, target[:, 1]).round().astype(int)
                    if np.abs(sampled_columns - target_columns).max() > 3:
                        continue
                    for row, sampled, actual in zip(target_rows, sampled_columns, target_columns):
                        registered[row, min(sampled, actual):max(sampled, actual) + 1] = True
                    interior = ndimage.binary_erosion(retained_body, iterations=6)
                    interior[:target_top] = False
                    interior[target_top:target_bottom + 1] &= np.indices(body.shape)[1][target_top:target_bottom + 1] > target_columns[:, None] + 6
                    if (registered & interior).sum() > max(20, registered.sum() * .01):
                        continue
                    attachment = registered[target_rows, target_columns]
                    if not attachment.all() or ndimage.label(registered, structure=np.ones((3, 3)))[1] != 1:
                        continue
                    solution = registered, registered_ink, reduction, scale, degrees, rigid
                    break
                if solution is not None:
                    break
            if solution is not None:
                break
        if solution is None:
            if exact:
                raise ValueError("Sleeve cannot fit this garment canvas while retaining its length and armhole connection.")
            raise ValueError("Rejected: sleeve needs excessive shrinkage or cannot attach without overlap; revise the sleeve or crop")
        registered, registered_ink, reduction, scale, degrees, rigid = solution
        for row, inner in zip(target_rows, target_columns):
            registered[row, inner + 1:] = False
            registered_ink[row, inner + 1:] = False
        registered_ink |= registered & ~ndimage.binary_erosion(registered, iterations=2)
        registered[:target_top] |= original[:target_top]
        old_bottom = int(np.where(original)[0].max())
        keep = np.ones_like(body)
        for target_row in range(max(0, target_top - 4), body.shape[0]):
            inner = int(np.interp(target_row, target_rows, target_columns)) if target_row <= old_bottom + 4 else int(body_edges[target_row])
            keep[target_row, :max(0, inner)] = False
        if side == "right":
            registered, registered_ink, keep = np.fliplr(registered), np.fliplr(registered_ink), np.fliplr(keep)
        keep_svg = tracer.wrap_svg("Retained garment", tracer.trace(keep), "")
        validate_svg(keep_svg)
        suffix = "Left" if side == "left" else "Right"
        anchors = [[int(target_columns[0]), target_top], [int(target_columns[-1]), target_bottom]]
        if side == "right":
            anchors = [[body.shape[1] - 1 - horizontal, vertical] for horizontal, vertical in anchors]
        return {
            "svg": traced(registered, registered_ink), "keepSvg": keep_svg,
            "compatibility": {"garmentTypes": ["tshirt"], "fits": [fit], "views": ["front"]},
            "registration": {"profile": self.name, "version": 1, "layerId": f"sleeve{suffix}",
                "defaultTransform": IDENTITY, "socket": f"studio-{fit}-{side}-armhole-v1", "cuff": "integrated", "side": side,
                "status": "Exact registration" if exact else "Needs review" if reduction < .75 else "Adaptive registration",
                "adaptation": {"capFraction": .2, "scaleReduction": float(reduction), "minimumScaleReduction": float(minimum_scale),
                    "uniformScale": float(scale), "rotation": degrees, "bodyArmholeAdjusted": False, "rigidPixels": int(rigid.sum())},
                "anchors": {"source": [[source_right, int(attachment_rows[0])], [source_right, int(attachment_rows[-1])]], "target": anchors}},
        }

    @staticmethod
    def render_adapter(fabric, ink, shape, cap_start, source_top, source_bottom, target, parameters, center, direction, across, scale, bounds):
        start = np.floor(bounds.min(axis=0)).astype(int) - 2
        stop = np.ceil(bounds.max(axis=0)).astype(int) + 3
        points = np.moveaxis(np.indices(tuple(stop - start), dtype=float), 0, -1) + start
        relative = points - center
        source_middle = (source_top + source_bottom) / 2
        source_row = source_middle + relative @ across / scale
        source_column = cap_start - relative @ direction / scale
        coordinates = np.array([source_row, source_column])
        rigid = ndimage.map_coordinates(fabric, coordinates, order=0, prefilter=False) & (source_column <= cap_start)
        rigid_ink = ndimage.map_coordinates(ink, coordinates, order=0, prefilter=False) & rigid
        minimum = np.zeros(points.shape[:2])
        maximum = np.ones_like(minimum)
        source_height = source_bottom - source_top
        for _ in range(20):
            parameter = (minimum + maximum) / 2
            attachment = np.stack([np.interp(parameter, parameters, target[:, dimension]) for dimension in (0, 1)], axis=-1)
            seam = center + (parameter[..., None] - .5) * source_height * scale * across
            strip = seam - attachment
            delta = points - attachment
            residual = strip[..., 0] * delta[..., 1] - strip[..., 1] * delta[..., 0]
            minimum = np.where(residual > 0, parameter, minimum)
            maximum = np.where(residual > 0, maximum, parameter)
        fraction = (delta * strip).sum(axis=-1) / (strip * strip).sum(axis=-1)
        source_row = source_top + parameter * source_height
        source_edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in fabric])
        source_edge = np.interp(source_row, np.arange(len(source_edges)), source_edges)
        source_column = source_edge + fraction * (cap_start - source_edge)
        coordinates = np.array([source_row, source_column])
        inside = (fraction >= 0) & (fraction <= 1) & (parameter > 1e-5) & (parameter < 1 - 1e-5)
        adapter = ndimage.map_coordinates(fabric, coordinates, order=0, prefilter=False) & inside
        adapter_ink = ndimage.map_coordinates(ink, coordinates, order=0, prefilter=False) & adapter
        registered, registered_ink, rigid_mask = (np.zeros(shape, dtype=bool) for _ in range(3))
        region = (slice(start[0], stop[0]), slice(start[1], stop[1]))
        registered[region] = rigid | adapter
        registered_ink[region] = rigid_ink | adapter_ink
        rigid_mask[region] = rigid
        for target_row in range(int(target[0, 0]), int(target[-1, 0]) + 1):
            column = round(np.interp(target_row, target[:, 0], target[:, 1]))
            registered[target_row, column - 1:column + 2] = True
        return registered, registered_ink, rigid_mask

    @staticmethod
    def fit_shoulder_cap(fabric, ink, socket, top, bottom, shoulder):
        depth = bottom - top
        outer = max(0, shoulder - round(depth * .4))
        floor = min(fabric.shape[0], top + round(depth * .25))
        allowed = np.ones_like(fabric)
        for column in range(outer, min(fabric.shape[1], shoulder + round(depth * .25) + 1)):
            rows = np.flatnonzero(socket[:, column])
            boundary = max(top, int(rows[0])) if rows.size else floor
            allowed[:min(floor, boundary), column] = False
        for row in range(top, floor):
            columns = np.flatnonzero(fabric[row])
            if columns.size:
                inner = int(columns[-1])
                allowed[row, max(0, inner - 2):inner + 1] = True
        removed = fabric & ~allowed
        excessive = removed.sum() > fabric.sum() * .2
        detached = fabric[:top, :outer].any()
        if excessive or detached:
            return fabric, ink, "Needs review"
        fitted = fabric & allowed
        if ndimage.label(fitted, structure=np.ones((3, 3)))[1] != 1:
            return fabric, ink, "Needs review"
        return fitted, ink & fitted, "Exact registration"

    def register_exact(self, drawing: Image.Image, request: dict) -> dict:
        if request["garmentType"] != "tshirt" or request["fit"] not in {"slim", "regular", "boxy", "oversized"} or request["view"] != "front":
            raise ValueError("Armhole connection failed: no verified socket for this garment and fit")
        return self.register_adaptive(drawing, request, exact=True)
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
        body = raster_catalog("Body", f"Body{tag}")
        if side == "right":
            body = np.fliplr(body)
        attachment_edges = target_edges.copy()
        for target_row in range(target_top, target_bottom + 1):
            body_columns = np.flatnonzero(body[target_row])
            if not body_columns.size:
                raise ValueError("Armhole connection failed: body edge is incomplete")
            attachment_edges[target_row] = max(target_edges[target_row] + 1, int(body_columns[0]))
        target_edges[target_top:target_bottom + 1] = np.linspace(target_edges[target_top], target_edges[target_bottom], target_bottom - target_top + 1).round().astype(int)
        scale = (target_bottom - target_top) / (lower - upper)
        mapped_top = round(target_top + (source_top - upper) * scale)
        mapped_bottom = round(target_top + (source_bottom - upper) * scale)
        mapping = []
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
            mapping.append((target_row, source_row, start, stop, width, inner))
        boundary = np.array([(target_row, column) for target_row, _, _, _, width, inner in mapping
                             for column in (inner - width + 1, inner)], dtype=float)
        slope = (target_edges[target_bottom] - target_edges[target_top]) / (target_bottom - target_top)
        anchor = np.array([(target_top + target_bottom) / 2, (target_edges[target_top] + target_edges[target_bottom]) / 2])
        axis = np.array([1, slope])
        transverse = boundary[:, 0] - anchor[0]
        depth = anchor[1] + slope * transverse - boundary[:, 1]
        length = float(depth.max())
        pose = None
        for degrees in range(90):
            sine, cosine = np.sin(np.deg2rad(degrees)), np.cos(np.deg2rad(degrees))
            direction = np.array([sine, -cosine])
            turn = np.array([cosine - slope * sine, sine + slope * cosine]) - axis
            baseline = cosine + slope * sine
            cross_turn = turn[0] * axis[1] - turn[1] * axis[0]
            critical = np.clip(-transverse.max() * cross_turn / (length * (1 - baseline)), 0, 1) if baseline < 1 else 0
            if baseline + (1 - baseline) * critical ** 2 + 2 * transverse.max() / length * cross_turn * critical < .03:
                continue
            posed_boundary = anchor + depth[:, None] * direction + transverse[:, None] * (axis + (depth[:, None] / length) ** 2 * turn)
            depth_ranges = depth.reshape(-1, 2)
            row_transverse = transverse[::2]
            for dimension in (0, 1):
                denominator = 2 * row_transverse * turn[dimension]
                stationary = np.divide(-direction[dimension] * length ** 2, denominator, out=np.full_like(denominator, np.inf), where=denominator != 0)
                inside = (stationary >= depth_ranges.min(axis=1)) & (stationary <= depth_ranges.max(axis=1))
                stationary = stationary[inside]
                extrema = anchor + stationary[:, None] * direction + row_transverse[inside, None] * (axis + (stationary[:, None] / length) ** 2 * turn)
                posed_boundary = np.concatenate((posed_boundary, extrema))
            if (posed_boundary >= 4).all() and (posed_boundary < np.array(socket.shape) - 4).all():
                pose = (direction, turn)
                break
        if pose is None:
            raise ValueError("Sleeve cannot fit this garment canvas while retaining its length and armhole connection.")
        if degrees == 0:
            offset = np.array([0, 0])
            shape = socket.shape
        else:
            offset = boundary.min(axis=0).astype(int) - 2
            shape = tuple((boundary.max(axis=0).astype(int) - offset + 3).tolist())
        registered = np.zeros(shape, dtype=bool)
        registered_ink = np.zeros(shape, dtype=bool)
        for target_row, source_row, start, stop, width, inner in mapping:
            mapped = np.linspace(start, stop, width).round().astype(int)
            local_row = target_row - offset[0]
            local_start, local_stop = inner - width + 1 - offset[1], inner + 1 - offset[1]
            registered[local_row, local_start:local_stop] = fabric[source_row, mapped]
            registered_ink[local_row, local_start:local_stop] = ink[source_row, mapped]
        if degrees:
            direction, turn = pose
            output_start = np.floor(posed_boundary.min(axis=0)).astype(int) - 1
            output_stop = np.ceil(posed_boundary.max(axis=0)).astype(int) + 2
            relative = np.indices(tuple(output_stop - output_start), dtype=float) + (output_start - anchor)[:, None, None]
            cross_axis = relative[0] * axis[1] - relative[1] * axis[0]
            cross_turn = relative[0] * turn[1] - relative[1] * turn[0]
            direction_axis = direction[0] * axis[1] - direction[1] * axis[0]
            direction_turn = direction[0] * turn[1] - direction[1] * turn[0]
            minimum = np.full_like(cross_axis, min(-2, float(depth.min()) - 1))
            maximum = np.full_like(cross_axis, length + 2)
            for _ in range(24):
                distance = (minimum + maximum) / 2
                weight = (distance / length) ** 2
                residual = cross_axis + weight * cross_turn - distance * (direction_axis + weight * direction_turn)
                minimum = np.where(residual > 0, distance, minimum)
                maximum = np.where(residual > 0, maximum, distance)
            distance = (minimum + maximum) / 2
            turned_axis = axis[:, None, None] + (distance / length) ** 2 * turn[:, None, None]
            across = ((relative - distance * direction[:, None, None]) * turned_axis).sum(axis=0) / (turned_axis ** 2).sum(axis=0)
            coordinates = np.array([anchor[0] + across - offset[0], anchor[1] + slope * across - distance - offset[1]])
            posed = np.zeros_like(socket)
            posed_ink = np.zeros_like(socket)
            region = (slice(output_start[0], output_stop[0]), slice(output_start[1], output_stop[1]))
            posed[region] = ndimage.map_coordinates(registered, coordinates, order=0, prefilter=False)
            posed_ink[region] = ndimage.map_coordinates(registered_ink, coordinates, order=0, prefilter=False)
            registered, registered_ink = posed, posed_ink
            for target_row in range(target_top, target_bottom + 1):
                inner = int(target_edges[target_row])
                registered[target_row, inner] = True
        if not registered.any() or any(not registered[row, target_edges[row]] for row in range(target_top, target_bottom + 1)):
            raise ValueError("Armhole connection failed")
        for target_row in range(target_top, target_bottom + 1):
            old_inner = int(target_edges[target_row])
            inner = int(attachment_edges[target_row])
            outer = max(0, old_inner - max(16, 2 * abs(inner - old_inner)))
            sampled = np.linspace(outer, old_inner, inner - outer + 1).round().astype(int)
            fabric_strip = registered[target_row, sampled].copy()
            ink_strip = registered_ink[target_row, sampled].copy()
            registered[target_row, outer:] = False
            registered_ink[target_row, outer:] = False
            registered[target_row, outer:inner + 1] = fabric_strip
            registered_ink[target_row, outer:inner + 1] = ink_strip
        registered, registered_ink, status = self.fit_shoulder_cap(
            registered, registered_ink, socket, target_top, target_bottom, int(attachment_edges[target_top]))
        registered_ink |= registered & ~ndimage.binary_erosion(registered, iterations=2)
        registered[:target_top] |= original[:target_top]
        keep = np.ones_like(socket)
        for target_row in range(max(0, target_top - 4), min(socket.shape[0], old_bottom + 5)):
            inner = attachment_edges[min(max(target_row, target_top), target_bottom)]
            keep[target_row, :max(0, inner)] = False
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
                             "status": status,
                             "defaultTransform": IDENTITY, "socket": f"studio-{fit}-{side}-armhole-v1",
                             "cuff": "integrated", "side": side,
                             "anchors": {"source": [[int(right_edges[upper]), upper], [int(right_edges[lower]), lower]],
                                         "target": [[int(attachment_edges[target_top]), target_top], [int(attachment_edges[target_bottom]), target_bottom]]}},
        }


PROFILES = {"collar": CollarRegistrationProfile(), "sleeve": SleeveRegistrationProfile(), "pocket": PocketPlacementProfile()}