"""Offline regressions. Optional TRACE_ONLY_SOURCE_IMAGE is read-only, never copied.

Run: .venv\\Scripts\\python.exe -B -m unittest discover -s scripts\\collar
     -p test_garment_trace_only.py -v
Set PYTHONDONTWRITEBYTECODE=1; supply TRACE_ONLY_SOURCE_IMAGE for a real-image check.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

import garment_trace_only as trace


def image_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def from_url(url: str) -> Image.Image:
    with Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))) as image:
        return image.copy()


def fixture() -> Image.Image:
    image = Image.new("RGB", (240, 310), "white")
    draw = ImageDraw.Draw(image)
    polygon = [(75, 30), (100, 38), (109, 57), (132, 61), (144, 38), (164, 25),
               (216, 68), (197, 107), (171, 95), (182, 270), (54, 274),
               (67, 102), (37, 113), (20, 75)]
    draw.line(polygon + [polygon[0]], fill="black", width=3)
    draw.line([(57, 256), (181, 252)], fill="black", width=2)
    for x in range(67, 167, 9):
        draw.line([(x, 263), (x + 4, 263)], fill="black", width=1)
    draw.ellipse((83, 125, 116, 157), outline="black", width=2)
    draw.line([(130, 160), (150, 180)], fill="black", width=1)
    draw.text((83, 200), "INK", fill="black")
    draw.rectangle((225, 290, 227, 292), fill="black")
    return image


def accepts_like_existing_frontend(result: dict) -> bool:
    """Mirror the existing canAcceptImportedConstruction gate, not new semantics."""
    return result["constructionVersion"] == 2 and any(part["layerKind"] == "structural" for part in result["parts"]) and all(
        part["boundary"]["confidence"] >= .8 and part["boundary"]["evidence"].strip()
        and part["layerKind"] and part["builderCategory"] and part["outline"]
        for part in result["parts"])


class TraceOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.image = fixture()
        cls.data = image_bytes(cls.image)
        with patch("socket.create_connection", side_effect=AssertionError("Network forbidden")):
            cls.result = trace.trace_only(cls.data)

    def test_full_alpha_ramp_and_exact_thresholds(self):
        image = Image.fromarray(np.arange(256, dtype=np.uint8).reshape((1, 256)))
        alpha = np.asarray(trace._key(image).getchannel("A"))[0]
        for lum in range(256):
            expected = 0 if lum >= 246 else 255 if lum <= 120 else round((246 - lum) * 255 / 126)
            self.assertEqual(int(alpha[lum]), expected)
        self.assertEqual(int(alpha[183]), 128)
        self.assertEqual(int(alpha[184]), 125)

    def test_contrast_is_exact_and_no_crop_or_repair(self):
        preview = self.result["tracePreview"]
        expected = ImageEnhance.Contrast(self.image).enhance(1.35)
        self.assertTrue(np.array_equal(np.asarray(from_url(preview["cleanedRaster"])), np.asarray(expected)))
        self.assertTrue(np.array_equal(np.asarray(from_url(preview["sourceRaster"])), np.asarray(self.image)))
        self.assertEqual(from_url(preview["keyedRaster"]).size, self.image.size)

    def test_transparent_black_background_does_not_turn_into_ink(self):
        rgba = self.image.convert("RGBA")
        pixels = np.asarray(rgba).copy()
        pixels[np.all(pixels[:, :, :3] == 255, axis=2)] = [0, 0, 0, 0]
        result = trace.trace_only(image_bytes(Image.fromarray(pixels)))
        self.assertEqual(result["tracePreview"]["tracedSvg"], self.result["tracePreview"]["tracedSvg"])

    def test_svg_source_coordinates_evenodd_and_native_inversion(self):
        svg = ET.fromstring(self.result["tracePreview"]["tracedSvg"])
        self.assertEqual(svg.get("viewBox"), "0 0 240 310")
        self.assertEqual(svg.get("width"), "240")
        group = svg.find(f"{{{trace.SVG_NS}}}g")
        self.assertIn("translate(0,310)", group.get("transform"))
        self.assertIn("-0.03333333333333333", group.get("transform"))
        self.assertTrue(all(path.get("fill-rule") == "evenodd" for path in svg.iter(f"{{{trace.SVG_NS}}}path")))

    def test_builder_wrapper_retains_identical_source_paths(self):
        source = self.result["tracePreview"]["tracedSvg"]
        wrapper = self.result["lineArtSvg"]
        self.assertIn(source, wrapper)
        root = ET.fromstring(wrapper)
        self.assertEqual(root.get("viewBox"), "0 0 2048 2048")
        group = root.find(f"{{{trace.SVG_NS}}}g")
        self.assertIn(f"scale({2048 / 310:.16g})", group.get("transform"))
        self.assertNotIn(",", group.get("transform").split("scale(")[1])
        original = self.result["sourceManifest"]["regions"][0]["outline"]
        mapped = self.result["parts"][0]["outline"]
        for (sx, sy), (mx, my) in zip(original, mapped):
            self.assertAlmostEqual(mx, (sx * 240 + 35) / 310)
            self.assertAlmostEqual(my, sy)

    def test_contract_gate_and_no_semantic_fabric_claims(self):
        result = self.result
        self.assertEqual(result["source"], "azure-garment-reconstruction-v1")
        self.assertEqual(result["processingMode"], "trace-only")
        self.assertTrue(accepts_like_existing_frontend(result))
        self.assertEqual(result["manifest"]["garmentType"], "unknown")
        self.assertEqual(result["partCount"], 1)
        part = result["parts"][0]
        self.assertFalse(part["colorable"])
        self.assertFalse(result["accepted"])
        self.assertEqual(part["name"], "Source ink")
        self.assertEqual(result["manifest"]["measurementSchema"], [])
        self.assertEqual(part["constructionSvg"], result["lineArtSvg"])
        self.assertNotIn("path", part["svg"])
        self.assertNotIn("path", result["stitchSvg"])
        self.assertGreater(result["tracePreview"]["metrics"]["closedRegionCount"], 1)
        self.assertEqual(result["tracePreview"]["metrics"]["closedRegionFillCount"], 0)
        self.assertEqual(result["provenance"]["sourceImageHash"], "source-" + hashlib.sha256(self.data).hexdigest())
        json.dumps(result, allow_nan=False)

    def test_outline_is_source_supported_not_bbox(self):
        points = self.result["sourceManifest"]["regions"][0]["outline"]
        self.assertGreater(len(points), 20)
        alpha = np.asarray(from_url(self.result["tracePreview"]["keyedRaster"]).getchannel("A"))
        for x, y in points:
            px, py = round(x * 240), round(y * 310)
            self.assertTrue((alpha[max(0, py - 1):py + 1, max(0, px - 1):px + 1] >= 128).any())

    def test_rasterized_trace_preserves_stitches_holes_and_remote_ink(self):
        try:
            import resvg_py
        except ImportError:
            self.skipTest("resvg_py unavailable; production reports unverified fidelity")
        preview = self.result["tracePreview"]
        metrics = preview["metrics"]
        self.assertTrue(metrics["fidelityVerified"])
        self.assertGreater(metrics["inkIoU"], .90)
        self.assertGreater(metrics["inkRecallWithin1px"], .99)
        rendered = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=preview["tracedSvg"], skip_system_fonts=True))).convert("RGBA")
        alpha = np.asarray(rendered.getchannel("A"))
        self.assertEqual(int(alpha[140, 100]), 0, "Closed hole was filled")
        self.assertEqual(int(alpha[10, 10]), 0, "Background was inverted")
        self.assertGreater(int(alpha[291, 226]), 128, "Disconnected original ink was lost")
        for x in range(67, 167, 9):
            self.assertGreater(int(alpha[263, x + 2]), 100, "A source stitch was removed")
        self.assertEqual(from_url(preview["overlayRaster"]).size, self.image.size)

    def test_exact_potrace_settings_and_inverted_supersampled_bitmap(self):
        original_run = subprocess.run
        observed = {}

        def capture(command, **kwargs):
            observed["command"] = command
            with Image.open(io.BytesIO(kwargs["input"])) as image:
                observed["bitmap"] = image.convert("L")
            return original_run(command, **kwargs)

        with patch.object(trace.subprocess, "run", side_effect=capture):
            trace._trace(trace._key(self.image).getchannel("A"))
        command = observed["command"]
        for option, expected in [("--turdsize", "4"), ("--turnpolicy", "minority"), ("--alphamax", "1"), ("--opttolerance", "0.2")]:
            self.assertEqual(command[command.index(option) + 1], expected)
        self.assertNotIn("--longcurve", command, "Opticurve must remain enabled")
        self.assertEqual(command[-3:], ["--output", "-", "-"])
        bitmap = observed["bitmap"]
        self.assertEqual(bitmap.size, (720, 930))
        self.assertEqual(bitmap.getpixel((10, 10)), 255)
        self.assertEqual(bitmap.getpixel((226 * 3, 291 * 3)), 0)

    def test_blank_and_rectangle_sources_fail_closed(self):
        for kind in ("blank", "solid", "rectangle", "open"):
            with self.subTest(kind=kind):
                image = Image.new("RGB", (120, 160), "white")
                draw = ImageDraw.Draw(image)
                if kind == "solid":
                    draw.rectangle((0, 0, 119, 159), fill="black")
                elif kind == "rectangle":
                    draw.rectangle((20, 20, 100, 140), outline="black", width=2)
                elif kind == "open":
                    draw.line([(20, 30), (50, 50), (80, 20)], fill="black", width=2)
                with self.assertRaises(trace.TraceOnlyError):
                    trace.trace_only(image_bytes(image))

    def test_failed_empty_or_rectangle_trace_output_is_not_accepted(self):
        try:
            import resvg_py  # noqa: F401
        except ImportError:
            self.skipTest("Fidelity guard requires optional resvg_py")
        for content in ("", '<rect width="240" height="310" fill="black"/>'):
            svg = f'<svg xmlns="{trace.SVG_NS}" viewBox="0 0 240 310">{content}</svg>'
            with self.subTest(content=content), patch.object(trace, "_trace", return_value=(svg, 1)):
                with self.assertRaisesRegex(trace.TraceOnlyError, "fidelity failed"):
                    trace.trace_only(self.data)

    def test_missing_renderer_is_explicit_not_fake_overlay(self):
        with patch.dict(sys.modules, {"resvg_py": None}):
            overlay, metrics = trace._fidelity("unused", trace._key(self.image), self.image)
        self.assertIsNone(overlay)
        self.assertFalse(metrics["fidelityVerified"])
        self.assertNotIn("inkIoU", metrics)

    def test_detection_is_local_and_uncertainty_stays_local(self):
        self.assertEqual(trace.detect_input(self.data)["mode"], "trace-only")
        self.assertEqual(trace.detect_input(Image.new("RGB", (40, 40), (140, 150, 160)))["mode"], "photo")
        self.assertEqual(trace.detect_input(Image.new("RGB", (40, 40), "white"))["mode"], "trace-only")
        self.assertEqual(trace.detect_input(Image.new("RGB", (40, 40), "black"))["mode"], "trace-only")

    def test_detection_exposes_evidence_and_routes_filled_references_to_photo(self):
        clean = trace.detect_input(self.data)
        self.assertGreater(clean["confidence"], .9)
        self.assertIn("enclosedWhiteFraction", clean["indicators"])
        self.assertIn("not semantic", clean["limitations"])
        for colour in ("black", "blue"):
            image = Image.new("RGB", (300, 300), "white")
            ImageDraw.Draw(image).rectangle((100, 70, 200, 240), fill=colour)
            result = trace.detect_input(image)
            self.assertEqual(result["mode"], "photo")
        blank = trace.detect_input(Image.new("RGB", (40, 40), "white"))
        self.assertLess(blank["confidence"], .8)

    def test_caller_detection_is_copied_and_never_routes_to_ai(self):
        detection = {"mode": "photo", "confidence": .99, "reason": "caller", "extra": {"supplied": True}}
        with patch("socket.create_connection", side_effect=AssertionError("Network forbidden")):
            result = trace.trace_only(self.data, "back", inputDetection=detection)
        self.assertEqual(result["inputDetection"], detection)
        result["inputDetection"]["extra"]["supplied"] = False
        self.assertTrue(detection["extra"]["supplied"])
        self.assertEqual(result["processingMode"], "trace-only")
        self.assertFalse(result["process"]["externalServicesUsed"])
        self.assertIn("backView", result["manifest"])
        self.assertNotIn("frontView", result["manifest"])
        self.assertNotEqual(result["parts"][0]["id"], self.result["parts"][0]["id"])
        self.assertEqual(result["tracePreview"]["tracedSvg"], self.result["tracePreview"]["tracedSvg"])
        self.assertNotIn("inference", result["manifest"]["backView"])

    def test_invalid_input_view_and_oversized_sources(self):
        for data in (b"", b"not an image"):
            with self.assertRaises(trace.TraceOnlyError):
                trace.trace_only(data)
        with self.assertRaises(trace.TraceOnlyError):
            trace.trace_only(self.data, "side")
        with patch.object(trace, "MAX_PIXELS", 100):
            with self.assertRaisesRegex(trace.TraceOnlyError, "megapixels"):
                trace.trace_only(self.data)

    def test_potrace_failure_reports_local_error(self):
        with patch.object(trace.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, b"", b"failed")):
            with self.assertRaisesRegex(trace.TraceOnlyError, "Local Potrace failed"):
                trace._trace(trace._key(self.image).getchannel("A"))
        with patch.object(trace.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, b"<svg/>", b"")):
            with self.assertRaisesRegex(trace.TraceOnlyError, "no ink paths"):
                trace._trace(trace._key(self.image).getchannel("A"))

    @unittest.skipUnless(os.environ.get("TRACE_ONLY_SOURCE_IMAGE"), "Set TRACE_ONLY_SOURCE_IMAGE for the read-only actual-image regression")
    def test_actual_source_read_only(self):
        path = Path(os.environ["TRACE_ONLY_SOURCE_IMAGE"])
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        with patch("socket.create_connection", side_effect=AssertionError("Network forbidden")):
            result = trace.trace_only(data)
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest)
        self.assertEqual(result["inputDetection"]["mode"], "trace-only")
        self.assertTrue(accepts_like_existing_frontend(result))
        self.assertEqual(result["tracePreview"]["metrics"]["closedRegionFillCount"], 0)
        with Image.open(io.BytesIO(data)) as image:
            self.assertEqual(from_url(result["tracePreview"]["keyedRaster"]).size, image.size)
        metrics = result["tracePreview"]["metrics"]
        if metrics["fidelityVerified"]:
            self.assertGreater(metrics["inkIoU"], .90)
            self.assertGreater(metrics["inkRecallWithin1px"], .99)
        print("ACTUAL_SOURCE_METRICS=" + json.dumps(metrics, sort_keys=True))


if __name__ == "__main__":
    unittest.main()
