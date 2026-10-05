from __future__ import annotations

import math
import re

import numpy as np
from scipy import ndimage

from asset_profiles import raster_catalog, validate_svg
from sleeve_isolation import geometry_points
import trace_svg as tracer


def garment_context(drawing, guidance: dict, *, allow_inference: bool = True) -> dict:
    armhole = np.asarray(geometry_points(guidance.get("armhole"))) * drawing.size
    cuff = np.asarray(geometry_points(guidance.get("cuff"))) * drawing.size
    landmarks = guidance.get("garment")
    if landmarks is not None:
        if not isinstance(landmarks, dict):
            raise ValueError("Invalid whole-garment landmarks.")
        pairs = {key: np.asarray(geometry_points(landmarks.get(key))) * drawing.size
                 for key in ("bodyWidth", "bodyLength", "shoulders")}
        if any(len(points) != 2 for points in pairs.values()):
            raise ValueError("Whole-garment measurements need two endpoints per dimension.")
        width_points, length_points, shoulders = (pairs[key] for key in ("bodyWidth", "bodyLength", "shoulders"))
    else:
        if not allow_inference:
            raise ValueError("Photo analysis could not establish body proportions. Upload the whole garment with both shoulders and torso visible.")
        ink = np.asarray(drawing.convert("L")) < 168
        barrier = ndimage.binary_closing(ink, iterations=2)
        labels, count = ndimage.label(~barrier)
        border = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1], [0])))
        sizes = np.bincount(labels.ravel())
        sizes[border] = 0
        if not count or sizes.max() < ink.size * .03:
            raise ValueError("Body proportions could not be measured. Upload the whole garment with its torso and shoulders visible.")
        torso = labels == sizes.argmax()
        rows = np.where(torso)[0]
        chest_row = round(armhole[-1, 1] + (rows.max() - armhole[-1, 1]) * .25)
        spans = [np.flatnonzero(torso[row]) for row in range(max(int(rows.min()), chest_row - 4), min(int(rows.max()), chest_row + 4) + 1)]
        spans = [span for span in spans if len(span) > 1]
        if not spans:
            raise ValueError("Torso width is not visible below the armhole. Upload the whole garment.")
        left = float(np.median([span[0] for span in spans]))
        right = float(np.median([span[-1] for span in spans]))
        middle = (left + right) / 2
        width_points = np.array([[left, chest_row], [right, chest_row]])
        length_points = np.array([[middle, rows.min()], [middle, rows.max()]])
        upper_rows, upper_columns = np.where(torso & (np.indices(torso.shape)[0] <= armhole[0, 1] + (right - left) * .12))
        if len(upper_columns) < 2:
            raise ValueError("Both shoulder joins must be visible in the garment drawing.")
        shoulders = np.array([[upper_columns[upper_columns.argmin()], upper_rows[upper_columns.argmin()]],
                              [upper_columns[upper_columns.argmax()], upper_rows[upper_columns.argmax()]]])
        if rows.max() - armhole[-1, 1] < (right - left) * .4 or not left - (right - left) * .15 < armhole[-1, 0] < right + (right - left) * .15 or abs(armhole[0, 0] - middle) < (right - left) * .25:
            raise ValueError("The reference does not show a measurable torso and sleeve attachment. Upload the whole garment.")
    body_width = float(np.linalg.norm(width_points[1] - width_points[0]))
    body_length = float(np.linalg.norm(length_points[1] - length_points[0]))
    armhole_length = float(np.linalg.norm(armhole[-1] - armhole[0]))
    shoulder_span = float(np.linalg.norm(shoulders[1] - shoulders[0]))
    if min(body_width, body_length, armhole_length) < 8 or not .4 < body_length / body_width < 3 or not .05 < armhole_length / body_width < 1.5 or not .3 < shoulder_span / body_width < 2:
        raise ValueError("Whole-garment measurements are inconsistent. Review the body and armhole landmarks.")
    down = (length_points[1] - length_points[0]) / body_length
    across = np.array([down[1], -down[0]])
    weights = np.linalg.norm(np.diff(armhole, axis=0), axis=1)
    origin = np.average((armhole[1:] + armhole[:-1]) / 2, axis=0, weights=weights)
    direction = cuff.mean(axis=0) - origin
    return {"armholeToBodyWidth": armhole_length / body_width, "bodyAspectRatio": body_length / body_width,
            "shoulderSpanToBodyWidth": shoulder_span / body_width,
            "shoulderDrop": float((armhole[0] - length_points[0]) @ down) / body_width,
            "sleeveAngle": math.degrees(math.atan2(float(direction @ down), abs(float(direction @ across))))}


def sleeve_socket(fit: str, side: str) -> dict:
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
    top = int(np.where(socket)[0].min())
    edges = np.array([np.flatnonzero(row)[-1] if row.any() else 0 for row in socket])
    bottom = int(np.flatnonzero(edges >= edges.max() - 3)[-1])
    rows = np.arange(top, bottom + 1)
    body_edges = np.array([np.flatnonzero(row)[0] if row.any() else body.shape[1] // 2 for row in body])
    columns = np.maximum(edges[rows] + 1, body_edges[rows])
    old_bottom = int(np.where(original)[0].max())
    keep = np.ones_like(body)
    for row in range(max(0, top - 4), body.shape[0]):
        inner = int(np.interp(row, rows, columns)) if row <= old_bottom + 4 else int(body_edges[row])
        keep[row, :max(0, inner)] = False
    sampled = np.unique(np.append(rows[::8], bottom))
    points = np.column_stack((np.interp(sampled, rows, columns), sampled)).astype(float)
    if side == "right":
        keep = np.fliplr(keep)
        points[:, 0] = body.shape[1] - 1 - points[:, 0]
    keep_svg = tracer.wrap_svg("Retained garment", tracer.trace(keep), "")
    validate_svg(keep_svg)
    body_rows = np.flatnonzero(body.any(axis=1))
    chest_row = min(int(body_rows[-1]), bottom + round((body_rows[-1] - bottom) * .25))
    chest = np.flatnonzero(body[chest_row])
    body_width = float(chest[-1] - chest[0]) * 2048 / 1536
    canvas_points = points * 2048 / 1536
    body_length = float(body_rows[-1] - body_rows[0]) * 2048 / 1536
    context = {"bodyAspectRatio": body_length / body_width,
               "shoulderSpanToBodyWidth": abs(body.shape[1] - 1 - 2 * points[0, 0]) * 2048 / 1536 / body_width,
               "shoulderDrop": (top - int(body_rows[0])) * 2048 / 1536 / body_width,
               "armholeToBodyWidth": float(np.linalg.norm(canvas_points[-1] - canvas_points[0])) / body_width}
    return {"side": side, "join": canvas_points.tolist(), "keepSvg": keep_svg, "bodyWidth": body_width, "garment": context}


def detect_sleeve_style(normalization: dict, analysis, guidance: dict) -> dict:
    measurements = normalization["validation"]
    armhole = float(measurements["armholeWidth"])
    length = float(measurements["length"])
    opening = float(measurements["openingWidth"])
    if not all(math.isfinite(value) and value > 0 for value in (armhole, length, opening)):
        raise ValueError("Sleeve style needs valid armhole, length and opening measurements")
    description = f"{analysis.name} {analysis.construction}".lower()
    length_class = "long" if re.search(r"\blong[ -]sleeve", description) else "short" if re.search(r"\bshort[ -]sleeve", description) else "long" if length / armhole > 1.45 else "short"
    cuff_evidence = (getattr(analysis, "sleeve_guidance", None) or {}).get("cuffConstruction") or guidance.get("cuffConstruction")
    if cuff_evidence is not None:
        if (not isinstance(cuff_evidence, dict) or cuff_evidence.get("style") not in {"plain", "band", "ribbed", "rolled", "elastic"}
                or cuff_evidence.get("confidence") not in {"high", "medium", "low"}
                or not isinstance(cuff_evidence.get("evidence"), str) or not 1 <= len(cuff_evidence["evidence"].strip()) <= 1200):
            raise ValueError("Invalid source cuff construction evidence")
        cuff_style = cuff_evidence["style"]
    elif re.search(r"\b(?:no|without) (?:a |separate )?cuffs?\b|\bplain (?:sleeve )?hem\b|\buncuffed\b", description):
        cuff_style = "plain"
    else:
        cuff_style = next((style for pattern, style in (
            (r"\brib(?:bed)?(?:[ -]knit)? cuffs?\b|\bcuffs? (?:with|in) rib", "ribbed"),
            (r"\b(?:rolled|folded|turn[ -]up) cuffs?\b", "rolled"),
            (r"\belastic(?:ated)? cuffs?\b", "elastic"), (r"\bcuffs?\b", "band"),
        ) if re.search(pattern, description)), "plain")
    construction = next((style for pattern, style in ((r"\braglan", "raglan"), (r"\bdrop", "dropped-shoulder"), (r"\bdolman|\bbatwing", "dolman"), (r"\bset[ -]in", "set-in")) if re.search(pattern, description)), "unknown")
    cuff = np.asarray(normalization["landmarks"]["cuff"], dtype=float)
    cuff = cuff[np.argsort(cuff[:, 0])]
    hem_angle = math.degrees(math.atan2(float(cuff[-1, 1] - cuff[0, 1]), float(cuff[-1, 0] - cuff[0, 0])))
    taper = opening / armhole
    silhouette = "flared" if taper > 1.12 or "flared" in description else "tapered" if taper < .72 or "tapered" in description else "straight"
    return {
        "version": 1, "lengthClass": length_class,
        "sleeveType": "cuffed" if cuff_style != "plain" else silhouette if silhouette != "straight" else length_class,
        "construction": construction, "constructionNotes": analysis.construction,
        "length": length / armhole, "openingWidth": opening / armhole, "upperWidth": 1.0,
        "taper": taper, "hemAngle": max(-40, min(40, hem_angle)), "cuffStyle": cuff_style,
        "looseness": 1.15 if re.search(r"\bloose|\bwide|\boversized", description) else .9 if re.search(r"\bfitted|\bslim", description) else 1.0,
        "silhouette": silhouette, "confidence": guidance.get("confidence", "low"),
        "measurementBasis": "armhole-relative", "method": "landmarks-and-reference-analysis",
        "sourceMeasurements": {"length": length, "openingWidth": opening, "upperWidth": armhole},
        "needsReview": True,
        **({"sourceCuff": dict(cuff_evidence)} if cuff_evidence else {}),
    }