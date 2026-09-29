import unittest
import contextlib
import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image, ImageDraw

import asset_profiles as profiles
from asset_providers import AstraProvider, TechnicalDrawingProvider, select_provider


class CustomAssetsTests(unittest.TestCase):
    def test_notched_turtle_neck_with_shoulder_extensions(self):
        image = Image.new("L", (400, 320), 0)
        pen = ImageDraw.Draw(image)
        pen.line([(120, 50), (160, 54), (240, 54), (275, 50), (270, 60), (250, 72), (238, 87), (217, 98), (190, 99), (173, 94), (158, 83), (150, 68), (120, 50)], fill=255, width=2)
        pen.line([(120, 50), (108, 113), (85, 155), (110, 178), (150, 198), (200, 210), (250, 198), (290, 178), (315, 155), (291, 113), (275, 50)], fill=255, width=2)
        pen.line([(40, 190), (85, 155)], fill=255, width=2)
        pen.line([(315, 155), (360, 190)], fill=255, width=2)
        pen.line([(165, 202), (200, 265), (235, 202)], fill=255, width=2)
        ink = np.asarray(image) > 0
        empty = np.zeros_like(ink)
        fabric, strokes, opening = profiles.collar.seated_collar(ink, empty, empty)
        self.assertTrue(opening[75, 200], "Notched top is the head opening")
        self.assertTrue(fabric[150, 200], "Turtle-neck panel must be tintable")
        self.assertFalse(opening[150, 200], "Front fabric cannot be the opening")
        self.assertTrue(fabric[230, 200], "V insert must be tintable")
        self.assertTrue(np.array_equal(strokes, ink))

    def test_mock_neck_front_panel_is_fabric(self):
        image = Image.new("L", (400, 400), 0)
        pen = ImageDraw.Draw(image)
        pen.ellipse((70, 50, 330, 110), outline=255, width=2)
        pen.line([(70, 80), (85, 240), (200, 270), (315, 240), (330, 80)], fill=255, width=2)
        pen.line([(175, 264), (200, 330), (225, 264)], fill=255, width=2)
        ink = np.asarray(image) > 0
        empty = np.zeros_like(ink)
        fabric, strokes, opening = profiles.collar.seated_collar(ink, empty, empty)
        self.assertTrue(opening[80, 200], "Top opening must remain open")
        self.assertFalse(opening[180, 200], "Upright front band is not a head opening")
        self.assertTrue(fabric[180, 200], "Upright front band must take the collar colour")
        self.assertTrue(fabric[290, 200], "Front insert must remain fabric")
        self.assertTrue(np.array_equal(strokes, ink), "Original construction lines must be preserved")

    def layered_v_drawing(self):
        image = Image.new("L", (400, 400), 0)
        pen = ImageDraw.Draw(image)
        pen.line([(50, 75), (95, 50), (150, 80), (250, 80), (305, 50), (350, 75)], fill=255, width=2)
        pen.line([(50, 75), (80, 210), (200, 350), (320, 210), (350, 75)], fill=255, width=2)
        pen.line([(95, 50), (105, 120), (135, 215), (200, 295), (265, 215), (295, 120), (305, 50)], fill=255, width=2)
        pen.line([(105, 120), (160, 135), (240, 135), (295, 120)], fill=255, width=2)
        pen.line([(200, 295), (200, 350)], fill=255, width=2)
        pen.line([(175, 102), (185, 103)], fill=255, width=1)
        return image

    def test_layered_v_opening_is_not_rear_band(self):
        image = self.layered_v_drawing()
        ink = np.asarray(image) > 0
        empty = np.zeros_like(ink)
        fabric, strokes, opening = profiles.collar.seated_collar(ink, empty, empty)
        self.assertTrue(opening[190, 200], "Actual V opening was filled")
        self.assertFalse(opening[110, 200], "Rear collar band became the opening")
        self.assertTrue(fabric[110, 200], "Rear collar band was discarded")
        self.assertFalse(fabric[190, 200], "Interior V became collar fabric")
        self.assertTrue(strokes[320, 200], "V join construction line was lost")

    def test_layered_v_trace_fidelity(self):
        ink = np.asarray(self.layered_v_drawing()) > 0
        empty = np.zeros_like(ink)
        fabric, strokes, opening = profiles.collar.seated_collar(ink, empty, empty)
        art_hw = (1536, 1024)
        placement = (0.77, 320.5, 100.25)
        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        with patch.dict(os.environ, environment):
            svg = profiles.collar.registered_collar_svg(fabric, strokes, "Layered V", art_hw, placement)
            profiles.collar.validate_collar_fidelity(svg, fabric, ink, opening, art_hw, placement)
            damaged_ink = strokes.copy()
            damaged_ink[100:106, 173:188] = False
            damaged_svg = profiles.collar.registered_collar_svg(fabric, damaged_ink, "Missing seam", art_hw, placement)
            with self.assertRaisesRegex(profiles.collar.CollarError, "Final asset differs significantly"):
                profiles.collar.validate_collar_fidelity(damaged_svg, fabric, ink, opening, art_hw, placement)
            filled_svg = profiles.collar.registered_collar_svg(fabric | opening, strokes, "Filled opening", art_hw, placement)
            with self.assertRaisesRegex(profiles.collar.CollarError, "Final asset differs significantly"):
                profiles.collar.validate_collar_fidelity(filled_svg, fabric, ink, opening, art_hw, placement)
            with self.assertRaisesRegex(profiles.collar.CollarError, "Final asset differs significantly"):
                profiles.collar.validate_collar_fidelity(svg, fabric, ink, opening, art_hw, (0.8, 320.5, 100.25))

    def test_layered_v_body_changes_only_neck(self):
        ink = np.asarray(self.layered_v_drawing()) > 0
        empty = np.zeros_like(ink)
        fabric, _, opening = profiles.collar.seated_collar(ink, empty, empty)
        body = np.zeros_like(ink)
        body[160:390, 20:380] = True
        crew = np.zeros_like(ink)
        crew[80:160, 100:300] = True
        result = profiles.collar.body_for_custom_opening(body, crew, empty, opening)
        self.assertTrue(np.array_equal(result[360:], body[360:]))
        self.assertFalse(result[190, 200])
        self.assertTrue(result[110, 200])
        self.assertFalse(np.any((result ^ body) & ~(crew | opening)))

    def test_body_repairs_only_old_socket_perforations(self):
        body = np.zeros((400, 400), dtype=bool)
        body[80:390, 20:380] = True
        body[165:170, 110:120] = False
        body[365:370, 110:120] = False
        collar = np.zeros_like(body)
        collar[80:160, 100:300] = True
        empty = np.zeros_like(body)
        result = profiles.collar.body_for_custom_opening(body, collar, empty, empty)
        self.assertTrue(result[165:170, 110:120].all())
        self.assertFalse(result[365:370, 110:120].any())

    def test_collar_ring_keeps_center_open(self):
        image = Image.new("L", (400, 300), 0)
        pen = ImageDraw.Draw(image)
        pen.ellipse((40, 50, 360, 250), outline=255, width=2)
        pen.ellipse((55, 65, 345, 235), outline=255, width=2)
        ink = np.asarray(image) > 0
        empty = np.zeros_like(ink)
        fabric, _, opening = profiles.collar.seated_collar(ink, empty, empty)
        self.assertTrue(opening[150, 200])
        self.assertFalse(fabric[150, 200])
        self.assertTrue(fabric[150, 48])

    def drawing(self):
        image = Image.new("RGB", (512, 512), "white")
        ImageDraw.Draw(image).rectangle((100, 100, 350, 400), outline="black", width=3)
        return image

    def test_preserved_technical_reference(self):
        from dataclasses import replace
        from asset_providers import ReferenceAnalysis, ReferenceComponent, preserved_technical_reference

        photo = self.drawing()
        pen = ImageDraw.Draw(photo)
        pen.rectangle((140, 150, 300, 190), outline="black", width=2)
        pen.rectangle((270, 175, 290, 210), outline="black", width=2)
        analysis = ReferenceAnalysis("pocket", "Pocket", "seams", "astra",
            (ReferenceComponent("zip", "Zip", "surround and pull", (135/512, 145/512, 305/512, 215/512)),), technical_drawing=True)
        original = photo.tobytes()
        provider = self.astra()
        with patch.object(provider, "reviewTechnicalRaster", return_value=[]) as review, patch.object(provider.raster, "generateTechnicalRaster") as redraw:
            drawing = provider.generateTechnicalRaster(photo, analysis, lambda _: None)
            self.assertTrue(np.all(np.asarray(drawing)[161:231, 151:321] == 255))
            self.assertEqual(drawing.getpixel((116, 266)), (0, 0, 0))
            review.assert_called_once()
            redraw.assert_not_called()
        self.assertEqual(photo.tobytes(), original)
        child = replace(analysis, category="zip", components=(), isolated=True)
        crop = photo.crop((135, 145, 305, 215))
        preserved = preserved_technical_reference(crop, child)
        self.assertIsNotNone(preserved)
        self.assertEqual(preserved.crop((16, 16, 16 + crop.width, 16 + crop.height)).tobytes(), crop.tobytes())
        dense = Image.new("RGB", (400, 100), "white")
        dense_pen = ImageDraw.Draw(dense)
        for tooth in range(10, 380, 10):
            dense_pen.line((tooth, 10, tooth + 4, 70), fill="black", width=2)
        dense = dense.resize((617, 154), Image.Resampling.BILINEAR)
        self.assertGreater(np.mean((np.asarray(dense) > 32) & (np.asarray(dense) < 245)), .1)
        self.assertIsNotNone(preserved_technical_reference(dense, child), "Antialiased teeth must not force a redraw")
        self.assertIsNone(preserved_technical_reference(photo, replace(analysis, technical_drawing=False)))
        self.assertIsNone(preserved_technical_reference(Image.new("RGB", photo.size, "gray"), analysis))
        self.assertIsNone(preserved_technical_reference(Image.new("RGB", photo.size, "red"), analysis))
        self.assertIsNone(preserved_technical_reference(photo, replace(analysis, category="sleeve")))
        with patch.object(provider, "reviewTechnicalRaster", side_effect=ValueError("Review incomplete")), patch.object(provider.raster, "generateTechnicalRaster") as redraw:
            with self.assertRaisesRegex(ValueError, "Review incomplete"):
                provider.generateTechnicalRaster(photo, analysis, lambda _: None)
            redraw.assert_not_called()
        with patch.object(provider, "reviewTechnicalRaster", side_effect=[["Cut parent seam"], []]), patch.object(provider.raster, "generateTechnicalRaster", return_value=photo) as redraw:
            self.assertIs(provider.generateTechnicalRaster(photo, analysis, lambda _: None), photo)
            redraw.assert_called_once()

    def test_closed_boundary(self):
        fabric, ink = profiles.masks(self.drawing(), "pocket")
        self.assertGreater(fabric.sum(), 70_000)
        self.assertTrue(np.all(fabric[ink]))
        with self.assertRaisesRegex(ValueError, "insufficient"):
            profiles.masks(Image.new("RGB", (512, 512), "white"), "pocket")

    def test_dense_zip_registration(self):
        image = Image.new("RGB", (640, 180), "white")
        pen = ImageDraw.Draw(image)
        pen.rectangle((20, 20, 619, 159), outline="black", width=3)
        for tooth in range(30, 610, 10):
            pen.line((tooth, 30, tooth + 3, 149), fill="black", width=4)
        density = float((np.asarray(image.convert("L")) < 168).mean())
        self.assertGreater(density, .18)
        self.assertLess(density, .35)
        fabric, ink = profiles.masks(image, "zip")
        self.assertTrue(np.all(fabric[ink]))
        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        with patch.dict(os.environ, environment):
            asset = profiles.PocketPlacementProfile().register(image, {"detailType": "zip"})
        profiles.validate_svg(asset["svg"])
        profiles.validate_render(asset["svg"])
        for category in ("pocket", "sleeve"):
            with self.subTest(category=category), self.assertRaisesRegex(ValueError, "excessive"):
                profiles.masks(image, category)
        for color in ("white", "black"):
            with self.subTest(color=color), self.assertRaises(ValueError):
                profiles.masks(Image.new("RGB", image.size, color), "zip")
        with self.assertRaisesRegex(ValueError, "boundary"):
            profiles.masks(image.crop((20, 0, 640, 180)), "zip")
        open_zip = self.drawing()
        ImageDraw.Draw(open_zip).rectangle((190, 90, 260, 110), fill="white")
        with self.assertRaisesRegex(ValueError, "boundary"):
            profiles.masks(open_zip, "zip")

    def test_open_boundary(self):
        image = self.drawing()
        ImageDraw.Draw(image).rectangle((190, 90, 260, 110), fill="white")
        with self.assertRaisesRegex(ValueError, "boundary"):
            profiles.masks(image, "pocket")

    def test_svg_namespace_and_empty(self):
        profiles.validate_svg(profiles.tracer.wrap_svg("test", "M10 10 L20 20 Z", ""))
        with self.assertRaisesRegex(ValueError, "empty"):
            profiles.validate_svg(profiles.tracer.wrap_svg("test", "", ""))

    def test_provider_malformed_analysis(self):
        provider = self.astra()
        for payload in ("[]", "null", '{}', '{"category":"pocket","name":null,"construction":"seams"}'):
            with self.subTest(payload=payload), patch.object(provider.transport, "post", return_value=self.response(payload)):
                with self.assertRaisesRegex(ValueError, "incomplete"):
                    provider.analyzeReference(self.drawing(), "pocket")

    def astra(self, **overrides):
        return AstraProvider({"CERIGA_AZURE_API_KEY": "fixture-secret", "CERIGA_AZURE_ENDPOINT": "https://fixture.openai.azure.com/openai/v1/",
                              "CERIGA_AZURE_REASONING_DEPLOYMENT": "gpt-6-astra", "CERIGA_AZURE_IMAGE_DEPLOYMENT": "image-test", **overrides})

    def response(self, text):
        return {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": text}]}]}

    def test_astra_category_and_contract(self):
        provider = self.astra()
        for category in ("collar", "sleeve", "pocket", "patch"):
            with self.subTest(category=category), patch.object(provider.transport, "post", return_value=self.response(json.dumps({"category": category, "name": "Custom", "construction": "seams"}))) as post:
                analysis = provider.analyzeReference(self.drawing(), category)
                self.assertEqual(analysis.provider, "astra")
                self.assertEqual(post.call_args.args[0], "/openai/v1/responses")
                body = post.call_args.kwargs["json"]
                self.assertEqual(body["model"], "gpt-6-astra")
                self.assertTrue(body["input"][0]["content"][1]["image_url"].startswith("data:image/png;base64,"))
                self.assertIn("stitch row count and placement", body["input"][0]["content"][0]["text"])
                self.assertIn("Exclude labels and tags", body["input"][0]["content"][0]["text"])
                if category == "collar":
                    with self.assertRaisesRegex(ValueError, "requested sleeve, Astra identified collar"):
                        provider.analyzeReference(self.drawing(), "sleeve")

    def test_astra_configuration_no_fallback(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "must-not-be-used"}, clear=True):
            with self.assertRaisesRegex(ValueError, "Astra configuration missing"):
                select_provider("photo")
            self.assertIsInstance(select_provider("drawing"), TechnicalDrawingProvider)
        provider = self.astra(CERIGA_AZURE_IMAGE_DEPLOYMENT="")
        with self.assertRaisesRegex(ValueError, "GPT Image deployment"):
            provider.raster.require_configuration()

    def test_astra_detects_separate_components(self):
        import base64

        provider = self.astra()
        for category, parts in (("pocket", ["zip"]), ("sleeve", ["button", "button", "patch"])):
            payload = {"category": category, "name": "Custom part", "construction": "seams", "bounds": [0.1, 0.1, 0.9, 0.9],
                       "components": [{"category": part, "name": part, "construction": "visible hardware", "bounds": [0.2, 0.2, 0.3, 0.4]} for part in parts]}
            with self.subTest(category=category), patch.object(provider.transport, "post", return_value=self.response(json.dumps(payload))) as post:
                reference = self.drawing().resize((640, 320))
                analysis = provider.analyzeReference(reference, category)
                self.assertEqual([component.category for component in analysis.components], parts)
                self.assertEqual(analysis.bounds, (0.1, 0.1, 0.9, 0.9))
                sent = post.call_args.kwargs["json"]["input"][0]["content"][1]["image_url"].split(",", 1)[1]
                with Image.open(io.BytesIO(base64.b64decode(sent))) as image:
                    self.assertEqual(image.size, reference.size)
                    self.assertEqual(image.tobytes(), reference.convert("RGB").tobytes())
            for bounds in ([0, 0, 0, 1], [-1, 0, 1, 1], [0, 0, float("nan"), 1], [0, 1]):
                payload["components"][0]["bounds"] = bounds
                with patch.object(provider.transport, "post", return_value=self.response(json.dumps(payload))), self.assertRaisesRegex(ValueError, "component bounds"):
                    provider.analyzeReference(self.drawing(), category)

    def test_technical_component_pipeline_preserves_geometry(self):
        import custom_asset_pipeline as pipeline

        photo = self.drawing()
        pen = ImageDraw.Draw(photo)
        pen.rectangle((140, 150, 300, 190), outline="black", width=2)
        pen.rectangle((270, 175, 290, 210), outline="black", width=2)
        for tooth in range(145, 265, 8):
            pen.line((tooth, 157, tooth + 3, 183), fill="black", width=2)
        analysis = {"category": "pocket", "name": "Pocket", "construction": "outer seam", "referenceType": "technical-drawing",
                    "bounds": [100/512, 100/512, 351/512, 401/512], "components": [
                        {"category": "zip", "name": "Zip", "construction": "tape, teeth and pull", "bounds": [135/512, 145/512, 305/512, 215/512]}]}
        provider = self.astra()
        request = {"category": "pocket", "contextCategory": "pocket", "detailType": "pocket", "garmentType": "tshirt", "fit": "slim", "view": "front", "side": "left", "source": "photo"}
        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        with patch.dict(os.environ, environment), tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            image_path = Path(directory) / "composite.png"
            photo.save(image_path)
            with patch.object(pipeline, "select_provider", return_value=provider), patch.object(provider.transport, "post", side_effect=[self.response(json.dumps(analysis)), self.response('{"issues": []}'), self.response('{"issues": []}')]) as post, patch.object(provider.raster, "generateTechnicalRaster", side_effect=AssertionError("Original drawing must not be regenerated")):
                result = pipeline.process(str(image_path), request)
            self.assertEqual(post.call_count, 3)
            assets = [result, *result["additionalAssets"]]
            self.assertEqual([asset["detailType"] for asset in assets], ["pocket", "zip"])
            self.assertTrue(all(asset["validation"]["status"] == "passed" for asset in assets))
            self.assertEqual(assets[1]["registration"]["relativePlacement"]["parentId"], result["id"])
            self.assertAlmostEqual(assets[1]["registration"]["ratio"], (161 + 10) / (61 + 10), delta=.03)

    def test_component_pipeline_is_atomic_and_isolated(self):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis, ReferenceComponent

        for category, parts in (("pocket", ["zip"]), ("sleeve", ["button", "button"])):
            components = tuple(ReferenceComponent(part, f"{part} {index}", "hardware", (.2 + index * .1, .2, .3 + index * .1, .4)) for index, part in enumerate(parts))
            analysis = ReferenceAnalysis(category, category, "seams", "astra", components, (.1, .1, .9, .9))
            provider = Mock()
            provider.analyzeReference.return_value = analysis
            request = {"category": category, "contextCategory": category, "garmentType": "tshirt", "fit": "slim", "view": "front", "side": "left", "source": "photo"}
            def result(photo, options, selected_provider, observed):
                return {"id": observed.name, "category": options["category"], "detailType": options.get("detailType"), "registration": {}}
            with self.subTest(category=category), tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
                image_path = Path(directory) / "reference.png"
                self.drawing().save(image_path)
                with patch.object(pipeline, "find_potrace_executable"), patch.object(pipeline, "select_provider", return_value=provider), patch.object(pipeline, "process_part", side_effect=result) as process_part:
                    output = pipeline.process(str(image_path), request)
                    self.assertEqual([asset["detailType"] for asset in output["additionalAssets"]], parts)
                    self.assertEqual(len({asset["id"] for asset in output["additionalAssets"]}), len(parts))
                    self.assertEqual(process_part.call_count, len(parts) + 1)
                    for call in process_part.call_args_list[1:]:
                        self.assertTrue(call.args[3].isolated)
                        self.assertEqual(call.args[1]["category"], "pocket")
                        self.assertLess(call.args[0].width, self.drawing().width)
                    self.assertEqual(output["additionalAssets"][0]["registration"]["relativePlacement"]["parentId"], category)
                with patch.object(pipeline, "find_potrace_executable"), patch.object(pipeline, "select_provider", return_value=provider), patch.object(pipeline, "process_part", side_effect=[{"id": category}, ValueError("component failed")]):
                    with self.assertRaisesRegex(ValueError, "component failed"):
                        pipeline.process(str(image_path), request)

    def test_component_isolation_prompts(self):
        import base64
        from asset_providers import ReferenceAnalysis, ReferenceComponent, reference_png

        provider = self.astra()
        analysis = ReferenceAnalysis("pocket", "Pocket", "zip fastening", "astra", (ReferenceComponent("zip", "Zip", "teeth", (.2, .2, .4, .5)),))
        encoded = base64.b64encode(reference_png(self.drawing())).decode("ascii")
        with patch.object(provider.transport, "post", return_value={"data": [{"b64_json": encoded}]}) as post:
            provider.raster.generateTechnicalRaster(self.drawing(), analysis, lambda _: None, correction="The horizontal zip remains in the pocket")
            prompt = post.call_args.kwargs["data"]["prompt"]
            self.assertIn("COMPONENT ISOLATION OVERRIDE", prompt)
            self.assertIn("CORRECTION REQUIRED", prompt)
            self.assertIn("The horizontal zip remains in the pocket", prompt)
            self.assertIn('"category": "zip"', prompt)
            self.assertNotIn("preserving opening, flap, gussets, fastening hardware", prompt)
        with patch.object(provider.raster, "generateTechnicalRaster", return_value=self.drawing()), patch.object(provider.transport, "post", return_value=self.response('{"issues": []}')) as post:
            provider.generateTechnicalRaster(self.drawing(), analysis, lambda _: None)
            self.assertIn("COMPONENT ISOLATION OVERRIDE", post.call_args.kwargs["json"]["input"][0]["content"][0]["text"])

    def test_parent_reference_removes_complete_component_region(self):
        import base64
        from asset_providers import ReferenceAnalysis, ReferenceComponent, isolated_parent_reference, reference_png

        photo = self.drawing()
        ImageDraw.Draw(photo).rectangle((140, 150, 300, 210), outline="black", width=3)
        ImageDraw.Draw(photo).line((145, 180, 295, 180), fill="black", width=4)
        original = photo.tobytes()
        analysis = ReferenceAnalysis("pocket", "Pocket", "outer seams", "astra", (ReferenceComponent("zip", "Zip", "surround and teeth", (140/512, 150/512, 300/512, 210/512)),))
        reference = isolated_parent_reference(photo, analysis)
        self.assertTrue(np.all(np.asarray(reference)[147:214, 137:304] == 255))
        self.assertEqual(reference.getpixel((100, 250)), (0, 0, 0))
        self.assertEqual(photo.tobytes(), original, "Original must remain intact for child extraction and review")
        provider = self.astra()
        encoded = base64.b64encode(reference_png(self.drawing())).decode("ascii")
        with patch.object(provider.transport, "post", return_value={"data": [{"b64_json": encoded}]}) as post:
            provider.raster.generateTechnicalRaster(photo, analysis, lambda _: None)
            self.assertEqual(post.call_args.kwargs["files"]["image"][1], reference_png(reference))
        child = ReferenceAnalysis("zip", "Zip", "teeth", "astra", isolated=True)
        self.assertIs(isolated_parent_reference(photo, child), photo)

    def test_patch_upload_processing(self):
        import base64
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis, reference_png

        provider = self.astra()
        analysis = ReferenceAnalysis("patch", "Embroidered patch", "stitched border and emblem", "astra")
        encoded = base64.b64encode(reference_png(self.drawing())).decode("ascii")
        with patch.object(provider.transport, "post", side_effect=[{"data": [{"b64_json": encoded}]}, self.response('{"issues": []}')]) as post:
            drawing = provider.generateTechnicalRaster(self.drawing(), analysis, lambda _: None)
            self.assertIn("PATCH PRESERVATION OVERRIDE", post.call_args_list[0].kwargs["data"]["prompt"])
            self.assertIn("PATCH PRESERVATION OVERRIDE", post.call_args_list[1].kwargs["json"]["input"][0]["content"][0]["text"])
        request = {"category": "pocket", "contextCategory": "pocket", "detailType": "patch", "garmentType": "tshirt", "fit": "slim", "view": "front", "side": "left", "source": "photo"}
        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        with patch.dict(os.environ, environment), tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            image_path = Path(directory) / "patch.png"
            self.drawing().save(image_path)
            with patch.object(pipeline, "select_provider", return_value=provider), patch.object(provider, "analyzeReference", return_value=analysis) as analyze, patch.object(provider, "generateTechnicalRaster", return_value=drawing):
                result = pipeline.process(str(image_path), request)
            self.assertEqual(analyze.call_args.args[1], "patch")
            self.assertEqual(result["detailType"], "patch")
            self.assertEqual(result["registration"]["profile"], "PocketPlacementProfile")
            self.assertEqual(result["registration"]["width"], .15)
            self.assertEqual(result["validation"]["status"], "passed")

    def test_component_review_correction(self):
        from asset_providers import ReferenceAnalysis, ReferenceComponent

        provider = self.astra()
        photo = self.drawing()
        corrected = photo.copy()
        analysis = ReferenceAnalysis("pocket", "Pocket", "zip fastening", "astra", (ReferenceComponent("zip", "Zip", "teeth", (.2, .2, .4, .5)),))
        issue = "The horizontal zip remains in the pocket; remove it and restore the fabric."
        failed = self.response(json.dumps({"issues": [issue]}))
        passed = self.response('{"issues": []}')
        with patch.object(provider.raster, "generateTechnicalRaster", side_effect=[photo, corrected]) as generate, patch.object(provider.transport, "post", side_effect=[failed, passed]) as review:
            self.assertIs(provider.generateTechnicalRaster(photo, analysis, lambda _: None), corrected)
            self.assertEqual(generate.call_count, 2)
            self.assertEqual(review.call_count, 2)
            self.assertIn(issue, generate.call_args.kwargs["correction"])
            self.assertIs(generate.call_args.args[0], photo)
        with patch.object(provider.raster, "generateTechnicalRaster", return_value=photo) as generate, patch.object(provider.transport, "post", return_value=failed) as review:
            with self.assertRaisesRegex(ValueError, "after automatic correction"):
                provider.generateTechnicalRaster(photo, analysis, lambda _: None)
            self.assertEqual(generate.call_count, 2)
            self.assertEqual(review.call_count, 2)

    def test_astra_raster_only(self):
        import base64
        from asset_providers import ReferenceAnalysis, reference_png

        provider = self.astra()
        analysis = ReferenceAnalysis("sleeve", "Custom sleeve", "cuff", "astra")
        encoded = base64.b64encode(reference_png(self.drawing())).decode("ascii")
        with patch.object(provider.transport, "post", return_value={"data": [{"b64_json": encoded}]}) as post:
            self.assertEqual(provider.raster.generateTechnicalRaster(self.drawing(), analysis, lambda _: None).size, (1024, 1024))
            self.assertIn("/deployments/image-test/images/edits?", post.call_args.args[0])
            self.assertIn("RIGHT", post.call_args.kwargs["data"]["prompt"])
            self.assertIn("Depict visible ribbing", post.call_args.kwargs["data"]["prompt"])
            self.assertIn("Exclude labels and tags completely", post.call_args.kwargs["data"]["prompt"])
            self.assertIn("blank rectangles", post.call_args.kwargs["data"]["prompt"])
            self.assertNotIn("Omit all rib texture", post.call_args.kwargs["data"]["prompt"])
            self.assertIn("never SVG", post.call_args.kwargs["data"]["prompt"])
            self.assertIn("image", post.call_args.kwargs["files"])
        for payload in ({}, {"data": [{"url": "https://example.com/image.png"}]}, {"data": [{"b64_json": base64.b64encode(b'<svg/>').decode()}]}):
            with patch.object(provider.transport, "post", return_value=payload), self.assertRaisesRegex(ValueError, "GPT Image generation failed"):
                provider.raster.generateTechnicalRaster(self.drawing(), analysis, lambda _: None)

    def test_astra_review_checks_each_part_before_tracing(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        drawing = self.drawing()
        for category in ("collar", "sleeve", "pocket"):
            analysis = ReferenceAnalysis(category, "Custom part", "stitch rows and ribbing", "astra")
            with self.subTest(category=category), patch.object(provider.raster, "generateTechnicalRaster", return_value=drawing), patch.object(provider.transport, "post", return_value=self.response('{"issues": []}')) as post:
                progress = Mock()
                self.assertIs(provider.generateTechnicalRaster(drawing, analysis, progress), drawing)
                progress.assert_called_with("Checking part isolation and construction detail")
                content = post.call_args.kwargs["json"]["input"][0]["content"]
                self.assertEqual(len([item for item in content if item["type"] == "input_image"]), 2)
                self.assertIn(f"ONLY the {category}", content[0]["text"])
                self.assertIn("blank rectangles", content[0]["text"])
                self.assertIn("missing stitch rows", content[0]["text"])
            for issue in ("Blank neck label rectangle remains", "Hanger remains", "Visible ribbing is missing"):
                with self.subTest(category=category, issue=issue), patch.object(provider.raster, "generateTechnicalRaster", return_value=drawing), patch.object(provider.transport, "post", return_value=self.response(json.dumps({"issues": [issue]}))):
                    with self.assertRaisesRegex(ValueError, issue):
                        provider.generateTechnicalRaster(drawing, analysis, lambda _: None)

    def test_astra_review_fails_closed(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        analysis = ReferenceAnalysis("collar", "Custom collar", "binding", "astra")
        responses = [self.response(text) for text in ("[]", "null", "{}", '{"issues": false}', '{"issues": [null]}', '{"issues": [""]}', "not JSON")]
        responses.extend([{"status": "incomplete"}, {"status": "completed", "output": [{"type": "message", "content": [{"type": "refusal"}]}]}])
        for response in responses:
            with self.subTest(response=response), patch.object(provider.raster, "generateTechnicalRaster", return_value=self.drawing()), patch.object(provider.transport, "post", return_value=response):
                with self.assertRaisesRegex(ValueError, "Technical drawing review"):
                    provider.generateTechnicalRaster(self.drawing(), analysis, lambda _: None)

    def test_astra_transport_errors(self):
        import requests

        provider = self.astra()
        response = Mock(status_code=401)
        response.iter_content.return_value = [json.dumps({"error": {"message": "Invalid key fixture-secret"}}).encode()]
        with patch("asset_providers.requests.post") as post:
            post.return_value.__enter__.return_value = response
            with self.assertRaisesRegex(ValueError, r"HTTP 401.*Invalid key \[redacted\]"):
                provider.transport.post("/openai/v1/responses", "Astra analysis", json={})
            self.assertFalse(post.call_args.kwargs["allow_redirects"])
            self.assertEqual(post.call_args.kwargs["headers"], {"api-key": "fixture-secret"})
        with patch("asset_providers.requests.post", side_effect=requests.Timeout), self.assertRaisesRegex(ValueError, "timed out"):
            provider.transport.post("/openai/v1/responses", "Astra analysis", json={})

    def test_offline_provider(self):
        provider = TechnicalDrawingProvider()
        analysis = provider.analyzeReference(self.drawing(), "pocket")
        with patch("lineart._gemini_once", side_effect=AssertionError("Offline means no inference")):
            self.assertEqual(provider.generateTechnicalRaster(self.drawing(), analysis, lambda _: None).size, (1024, 1024))

    def test_collar_compatibility(self):
        request = {"garmentType": "tshirt", "fit": "regular", "view": "front"}
        with patch.object(profiles.collar, "build_from_drawing", side_effect=AssertionError("No registration on incompatible socket")):
            with self.assertRaisesRegex(ValueError, "verified only"):
                profiles.CollarRegistrationProfile().register(self.drawing(), request)

    def test_preflight_before_inference(self):
        import custom_asset_pipeline as pipeline

        for category, garment, fit, view in [("collar", "tshirtTest", "regular", "front"), ("sleeve", "tshirt", "slim", "back")]:
            with patch.object(pipeline, "select_provider", side_effect=AssertionError("No inference before compatibility")):
                with self.assertRaisesRegex(ValueError, "verified only"):
                    pipeline.process("not-opened", {"category": category, "contextCategory": category, "garmentType": garment, "fit": fit, "view": view, "side": "left", "source": "photo"})

    def test_context_mismatch_before_inference(self):
        import custom_asset_pipeline as pipeline

        with patch.object(pipeline, "select_provider", side_effect=AssertionError("No inference on context mismatch")):
            for context in (None, "collar", "pocket"):
                with self.subTest(context=context), self.assertRaisesRegex(ValueError, "Wrong selected asset type"):
                    pipeline.process("not-opened", {"category": "sleeve", "contextCategory": context, "source": "photo"})

    def test_detail_types(self):
        import custom_asset_pipeline as pipeline

        request = {"category": "pocket", "contextCategory": "pocket", "source": "drawing", "garmentType": "tshirt", "fit": "slim", "view": "front", "side": "left"}
        with patch.object(pipeline, "select_provider", side_effect=AssertionError("No inference for unsupported detail")):
            with self.assertRaisesRegex(ValueError, "Pockets, Buttons, Zips or Patches"):
                pipeline.process("not-opened", {**request, "detailType": "collar"})
        provider = self.astra()
        for detail_type, width in (("pocket", .2), ("button", .06), ("zip", .055), ("patch", .15)):
            with self.subTest(detail_type=detail_type):
                response = self.response(json.dumps({"category": detail_type, "name": "Custom detail", "construction": "closed contour"}))
                with patch.object(provider.transport, "post", return_value=response):
                    analysis = provider.analyzeReference(self.drawing(), detail_type)
                    self.assertEqual(analysis.category, detail_type)
                with patch.object(profiles, "traced", return_value='<svg viewBox="0 0 2048 2048"/>'):
                    result = profiles.PocketPlacementProfile().register(self.drawing(), {**request, "detailType": detail_type})
                    self.assertEqual(result["registration"]["width"], width)

    def test_svg_active_content_rejected(self):
        svg = profiles.tracer.wrap_svg("test", "M10 10 L20 20 Z", "")
        with self.assertRaisesRegex(ValueError, "unsupported"):
            profiles.validate_svg(svg.replace("</svg>", "<script>alert(1)</script></svg>"))

    def test_local_failure_stages(self):
        import custom_asset_pipeline as pipeline

        request = {"category": "pocket", "contextCategory": "pocket", "garmentType": "tshirt", "fit": "slim", "view": "front", "side": "left", "source": "drawing"}
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            image_path = Path(directory) / "reference.png"
            self.drawing().save(image_path)
            with patch.object(pipeline, "find_potrace_executable", side_effect=RuntimeError("Potrace executable not found")), patch.object(pipeline, "select_provider") as select:
                with self.assertRaisesRegex(RuntimeError, "Potrace executable not found"):
                    pipeline.process(str(image_path), request)
                select.assert_not_called()
            with patch.object(pipeline, "find_potrace_executable", return_value="fixture"):
                with patch.object(profiles.tracer, "_run_potrace", side_effect=RuntimeError("Potrace failed: fixture")):
                    with self.assertRaisesRegex(profiles.tracer.TraceError, "Local trace failed: Potrace failed: fixture"):
                        pipeline.process(str(image_path), request)
                with patch.object(profiles.PROFILES["pocket"], "register", side_effect=ValueError("boundary is open")):
                    with self.assertRaisesRegex(ValueError, "Pocket registration failed: boundary is open"):
                        pipeline.process(str(image_path), request)
                    with self.assertRaisesRegex(ValueError, "Zip registration failed: boundary is open"):
                        pipeline.process(str(image_path), {**request, "detailType": "zip"})
                collar_request = {**request, "category": "collar", "contextCategory": "collar", "garmentType": "tshirtTest"}
                with patch.object(profiles.PROFILES["collar"], "register", side_effect=profiles.collar.CollarError("neck opening missing")):
                    with self.assertRaisesRegex(ValueError, "Collar registration failed: neck opening missing"):
                        pipeline.process(str(image_path), collar_request)
                with patch.object(profiles.PROFILES["pocket"], "register", return_value={"svg": profiles.tracer.wrap_svg("empty", "", "")}):
                    with self.assertRaisesRegex(ValueError, "Final asset validation failed: Trace is empty"):
                        pipeline.process(str(image_path), request)
                with patch.object(pipeline, "clean_lineart", side_effect=ValueError("insufficient ink")):
                    with self.assertRaisesRegex(ValueError, "Raster cleanup failed: insufficient ink"):
                        pipeline.process(str(image_path), request)

    def test_sleeve_retains_rows_beyond_armhole(self):
        image = Image.new("RGB", (512, 512), "white")
        ImageDraw.Draw(image).polygon([(100, 100), (350, 100), (350, 300), (300, 420), (100, 420)], fill="white", outline="black", width=3)
        socket = np.zeros((1536, 1024), dtype=bool)
        socket[200:401, 200:401] = True
        body = np.zeros_like(socket)
        body[200:1400, 350:750] = True
        captured = []
        retained = []

        def capture(fabric, ink):
            captured.append(fabric)
            return profiles.tracer.wrap_svg("test", "M10 10 L20 20 Z", "")

        def capture_keep(mask):
            retained.append(mask.copy())
            return "M10 10 L20 20 Z"

        with patch.object(profiles, "raster_catalog", side_effect=lambda category, name: body if category == "Body" else socket), patch.object(profiles, "traced", side_effect=capture), patch.object(profiles.tracer, "trace", side_effect=capture_keep):
            result = profiles.SleeveRegistrationProfile().register(image, {"garmentType": "tshirt", "fit": "slim", "side": "left", "view": "front"})
        self.assertGreater(np.where(captured[0])[0].max(), 480)
        self.assertTrue(retained[0][405:1400, 346:750].all(), "Sleeve replacement must preserve the lower torso and its edge")
        self.assertFalse(retained[0][900, 200], "Old long-sleeve ink must be cleared below the short sleeve")
        self.assertTrue(retained[0][:, 750:].all(), "Opposite side must remain unchanged")
        self.assertFalse(retained[0][300, 200], "Original sleeve must be cleared")
        self.assertEqual(result["registration"]["defaultTransform"]["x"], 0)
        self.assertEqual(result["compatibility"]["fits"], ["slim"])

    def test_cleanup_keeps_short_stitches_and_rib_lines(self):
        import lineart

        image = Image.new("RGB", (512, 512), "white")
        drawing = ImageDraw.Draw(image)
        drawing.rectangle((100, 100, 400, 400), outline="black", width=2)
        for row in (120, 130):
            for column in range(120, 380, 12):
                drawing.line((column, row, column + 3, row), fill=(100, 100, 100), width=1)
        for column in range(120, 380, 8):
            drawing.line((column, 160, column, 185), fill="black", width=1)
        drawing.point((30, 30), fill="black")
        drawing.line((40, 40, 41, 40), fill="black", width=1)
        cleaned = lineart.clean_lineart(image)
        ink = np.asarray(cleaned.convert("L")) < 168
        for row in (120, 130):
            for column in range(120, 380, 12):
                self.assertTrue(ink[row, column:column + 4].all(), "Short stitch dash was discarded")
        for column in range(120, 380, 8):
            self.assertTrue(ink[160:186, column].all(), "Fine rib line was discarded")
        self.assertFalse(ink[:50, :50].any(), "Isolated pixel noise survived cleanup")
        self.assertEqual(set(np.unique(np.asarray(cleaned))), {0, 255})
        _, registered_ink = profiles.masks(cleaned, "pocket")
        self.assertTrue(np.array_equal(registered_ink, ink), "Construction marks were discarded before tracing")

    def test_sparse_ink_cleanup_preserves_white_background(self):
        import lineart

        pixels = np.full((1024, 1024, 3), 254, dtype=np.uint8)
        pixels[:12, :80] = 251
        image = Image.fromarray(pixels)
        ImageDraw.Draw(image).rectangle((420, 60, 650, 940), outline="black", width=1)
        cleaned = lineart.clean_lineart(image)
        ink = np.asarray(cleaned.convert("L")) < 168
        self.assertFalse(ink[:20].any())
        self.assertGreater(ink.sum(), 1500)
        self.assertGreater(profiles.masks(cleaned, "sleeve")[0].sum(), 100_000)

    def test_collar_thin_contours_survive_placement(self):
        from scipy import ndimage

        image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        drawing = ImageDraw.Draw(image)
        drawing.ellipse((120, 160, 900, 820), outline="black", width=1)
        drawing.ellipse((200, 240, 820, 720), outline="black", width=1)
        ink = profiles.collar.place_on_crew(image, (1536, 1024)) >= profiles.collar.STRONG_INK
        self.assertEqual(ndimage.label(ink, np.ones((3, 3)))[1], 2)
        self.assertGreater(profiles.collar._closed_pockets(ink)[1], 0)

    def test_real_pipeline_matrix(self):
        import custom_asset_pipeline as pipeline

        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        collar_image = Image.new("RGB", (1024, 1024), "white")
        collar_draw = ImageDraw.Draw(collar_image)
        collar_draw.ellipse((180, 300, 844, 700), outline="black", width=2)
        collar_draw.ellipse((210, 330, 814, 660), outline="black", width=2)
        sleeve_image = Image.new("RGB", (512, 512), "white")
        ImageDraw.Draw(sleeve_image).polygon([(380, 100), (380, 390), (280, 330), (280, 260)], fill="white", outline="black", width=3)
        cases = [("pocket", "tshirt", "slim", "left", self.drawing()), ("collar", "tshirtTest", "slim", "left", collar_image)]
        cases.append(("collar", "tshirt", "slim", "left", collar_image))
        cases.extend(("sleeve", "tshirt", fit, side, sleeve_image) for fit in ("slim", "regular", "boxy", "oversized") for side in ("left", "right"))
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, environment):
            for category, garment, fit, side, image in cases:
                with self.subTest(category=category, fit=fit, side=side):
                    image_path = Path(directory) / "reference.png"
                    image.save(image_path)
                    request = {"category": category, "contextCategory": category, "garmentType": garment, "fit": fit, "view": "front", "side": side, "source": "drawing", "crop": [0, 0, 1, 1]}
                    with contextlib.redirect_stdout(io.StringIO()), patch("lineart._gemini_once", side_effect=AssertionError("No inference for technical drawings")):
                        result = pipeline.process(str(image_path), request)
                    self.assertEqual(result["validation"]["status"], "passed")
                    if category == "collar":
                        self.assertIn("drawing-fidelity", result["validation"]["checks"])
                    self.assertEqual(result["provenance"], "front")
                    self.assertTrue(result["cleanDrawing"].startswith("data:image/png;base64,"))
                    self.assertTrue(f'fill="{profiles.tracer.INK_COLOR}"' in result["svg"], "Missing tintable ink group")
                    self.assertTrue('fill="#000000"' in result["svg"], "Missing tintable fabric group")


if __name__ == "__main__":
    unittest.main()