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
    def garment_manifest_fixture(self):
        manifest = {"garmentType": "shorts", "material": "denim", "subtype": "Layered shorts", "fit": "unknown",
                "construction": "Asymmetric pocket on left leg", "materialEvidence": "Visible denim weave", "view": "front",
                "confidence": .8, "uncertainties": ["Rear construction is not visible"], "regions": [
                    {"id": "left-leg", "name": "Left leg", "semanticType": "panel", "material": "denim", "evidence": "Left silhouette",
                     "colorable": True, "structural": True, "bounds": [.1, .1, .5, .9], "seed": [.3, .7]},
                    {"id": "left-pocket", "name": "Left pocket", "semanticType": "pocket", "material": "denim", "evidence": "Overlay seam",
                     "colorable": True, "structural": True, "bounds": [.15, .2, .4, .5], "seed": [.25, .3], "attachmentTo": "left-leg"},
                ]}
        for region in manifest["regions"]:
            left, top, right, bottom = region["bounds"]
            region.update(outline=[[left, top], [right, top], [right, bottom], [left, bottom]],
                      boundary={"boundaryType": "panel-edge", "confidence": .95, "evidence": region["evidence"]},
                      layerKind="structural", structuralRole="main" if region["semanticType"] == "panel" else "pocket",
                      builderCategory="fabric-colour" if region["semanticType"] == "panel" else "pockets-zips",
                      userFacingName="Main body" if region["semanticType"] == "panel" else "Front pockets",
                      colourGroup="main-body", measurementRole="body", editableIndependently=False)
        return manifest

    def test_garment_manifest_contract(self):
        import copy
        from garment_manifest import identity, validate_manifest

        source = self.garment_manifest_fixture()
        normalized = validate_manifest(source)
        self.assertEqual(normalized["regions"][1]["attachmentTo"], "left-leg")
        self.assertIsNone(normalized["regions"][1]["symmetryPartner"])
        self.assertEqual(normalized["uncertainties"], source["uncertainties"])
        self.assertEqual(identity("analysis", normalized), identity("analysis", validate_manifest(copy.deepcopy(source))))
        self.assertNotEqual(identity("source", b"one"), identity("source", b"two"))
        cases = [{"garmentType": kind} for kind in ("unknown", "", "   ", None, 3, "x" * 121)]
        cases += [{"material": ""}, {"material": None}, {"confidence": float("nan")}, {"regions": []}]
        for mutation in cases:
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_manifest(source | mutation)
        for mutation in ({"id": "left-leg"}, {"seed": [float("nan"), .3]}, {"bounds": [0, 0, 2, 1]},
                         {"attachmentTo": "missing"}, {"symmetryPartner": "left-leg"}, {"colorable": "yes"}):
            candidate = copy.deepcopy(source)
            candidate["regions"][1].update(mutation)
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_manifest(candidate)

    def test_whole_garment_uses_shared_azure(self):
        import base64
        settings = {"CERIGA_AZURE_API_KEY": "test", "CERIGA_AZURE_ENDPOINT": "https://example.test",
                    "CERIGA_AZURE_REASONING_DEPLOYMENT": "astra", "CERIGA_AZURE_IMAGE_DEPLOYMENT": "image"}
        provider = AstraProvider(settings)
        manifest = self.garment_manifest_fixture()
        photo = Image.new("RGB", (160, 100), "white")
        photo.putpixel((0, 0), (0, 0, 0))
        buffer = io.BytesIO()
        photo.save(buffer, format="PNG")
        analysis = {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(manifest)}]}]}
        raster = {"data": [{"b64_json": base64.b64encode(buffer.getvalue()).decode()}]}
        with patch.object(provider.transport, "post", side_effect=[analysis, raster, analysis]) as post:
            result = provider.analyzeGarment(photo)
            drawing = provider.raster.generateWholeGarmentRaster(photo, result, lambda label: None)
            mapped = provider.analyzeGarment(drawing, source_manifest=result)
        self.assertEqual(mapped["regions"], result["regions"])
        self.assertIs(provider.raster.transport, provider.transport)
        self.assertEqual(post.call_count, 3)
        self.assertEqual(post.call_args_list[0].args[1], "Astra whole-garment analysis")
        self.assertEqual(post.call_args_list[2].args[1], "Astra whole-garment registration")
        for call_index in (0, 2):
            self.assertTrue(post.call_args_list[call_index].kwargs["json"]["stream"])
            self.assertFalse(post.call_args_list[call_index].kwargs["json"]["store"])
            image_url = post.call_args_list[call_index].kwargs["json"]["input"][0]["content"][1]["image_url"]
            uploaded = Image.open(io.BytesIO(base64.b64decode(image_url.split(",", 1)[1])))
            self.assertEqual(uploaded.size, photo.size)
            self.assertEqual(uploaded.getpixel((0, 0)), (0, 0, 0))
        prompt = post.call_args_list[1].kwargs["data"]["prompt"]
        self.assertIn("COMPLETE visible garment", prompt)
        self.assertNotIn("COMPONENT ISOLATION OVERRIDE", prompt)
        self.assertNotIn("Exclude labels", prompt)
        self.assertIn("asymmetry", prompt)

    def test_garment_mapping_cannot_promote_source_evidence(self):
        import copy
        provider = AstraProvider({"CERIGA_AZURE_API_KEY": "test", "CERIGA_AZURE_ENDPOINT": "https://example.test",
                                  "CERIGA_AZURE_REASONING_DEPLOYMENT": "astra", "CERIGA_AZURE_IMAGE_DEPLOYMENT": "image"})
        source = self.garment_manifest_fixture()
        source["regions"][1]["boundary"]["confidence"] = .4
        source["regions"][1]["visibleEdges"] = [{"id": "opening", "points": [[.2, .3], [.3, .4]],
            "boundaryType": "pocket-edge", "confidence": .7, "evidence": "Partly hidden source lip", "style": "solid"}]
        mapped = copy.deepcopy(source)
        mapped.update(garmentType="trousers", material="unknown", subtype="Generated guess", fit="slim",
                      construction="Generated construction", materialEvidence="Line art", view="back", confidence=.99,
                      uncertainties=["Redraw uncertainty"])
        mapped["regions"][1]["boundary"] = {"boundaryType": "seam", "confidence": .99, "evidence": "Generated ink"}
        mapped["regions"][1]["visibleEdges"][0].update(confidence=.99, evidence="Redraw only")
        payload = {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(mapped)}]}]}
        with patch.object(provider.transport, "post", return_value=payload):
            result = provider.analyzeGarment(Image.new("RGB", (100, 100), "white"), source_manifest=source)
        self.assertEqual(result["regions"][1]["boundary"], source["regions"][1]["boundary"])
        self.assertEqual(result["regions"][1]["visibleEdges"], source["regions"][1]["visibleEdges"])
        for key in ("garmentType", "material", "subtype", "fit", "construction", "materialEvidence", "view", "confidence"):
            self.assertEqual(result[key], source[key])
        self.assertEqual(result["uncertainties"], source["uncertainties"] + ["Redraw uncertainty"])
        mapped["regions"][1]["visibleEdges"] = []
        payload["output"][0]["content"][0]["text"] = json.dumps(mapped)
        with patch.object(provider.transport, "post", return_value=payload), self.assertRaisesRegex(ValueError, "detail identities"):
            provider.analyzeGarment(Image.new("RGB", (100, 100), "white"), source_manifest=source)

    def test_garment_raster_prompt_excludes_tracing_payload(self):
        provider = AstraProvider({"CERIGA_AZURE_API_KEY": "test", "CERIGA_AZURE_ENDPOINT": "https://example.test",
                                  "CERIGA_AZURE_REASONING_DEPLOYMENT": "astra", "CERIGA_AZURE_IMAGE_DEPLOYMENT": "image"})
        manifest = self.garment_manifest_fixture()
        region = {**manifest["regions"][0], "name": "n" * 1200, "evidence": "e" * 1200, "visibleEdges": ["large coordinate payload" * 1000]}
        manifest.update(construction="c" * 2400, regions=[region] * 64)
        with patch.object(provider.raster, "generateRaster", return_value=Image.new("RGB", (10, 10))) as generate:
            provider.raster.generateWholeGarmentRaster(Image.new("RGB", (10, 10)), manifest, lambda label: None)
        prompt = generate.call_args.args[1]
        self.assertLess(len(prompt), 32000)
        self.assertNotIn("large coordinate payload", prompt)

    def test_garment_semantic_segmentation(self):
        from garment_manifest import segment_drawing, validate_manifest

        image = Image.new("RGB", (200, 200), "white")
        pen = ImageDraw.Draw(image)
        pen.rectangle((20, 20, 180, 180), outline="black", width=2)
        pen.line((100, 20, 100, 180), fill="black", width=2)
        pen.line((40, 24, 45, 24), fill="black", width=1)
        manifest = self.garment_manifest_fixture()
        manifest["regions"][0].update(bounds=[.1, .1, .49, .9], seed=[.3, .5], outline=[[.1, .1], [.49, .1], [.49, .9], [.1, .9]])
        manifest["regions"][1].update(bounds=[.51, .1, .9, .9], seed=[.7, .5], outline=[[.51, .1], [.9, .1], [.9, .9], [.51, .9]])
        masks, contours, stitches, notes = segment_drawing(image, validate_manifest(manifest))
        self.assertEqual(len(masks), 2)
        self.assertFalse(np.any(masks[0] & masks[1]))
        self.assertTrue(masks[0][100, 50])
        self.assertTrue(masks[1][100, 150])
        self.assertGreater(int(stitches.sum()), 0)
        self.assertFalse(np.any(contours & stitches))
        self.assertFalse(notes)
        again = segment_drawing(image, validate_manifest(manifest))
        self.assertTrue(all(np.array_equal(first, second) for first, second in zip(masks, again[0])))
        pen.line((100, 20, 100, 180), fill="white", width=3)
        pen.rectangle((20, 20, 180, 180), outline="black", width=2)
        masks, _contours, _stitches, notes = segment_drawing(image, validate_manifest(manifest))
        self.assertFalse(notes)
        self.assertTrue(all(int(mask.sum()) > 100 for mask in masks))
        self.assertFalse(np.any(masks[0] & masks[1]))
        pen.line((30, 25, 75, 175), fill="black", width=3)
        folded = segment_drawing(image, validate_manifest(manifest))
        self.assertTrue(all(np.array_equal(first, second) for first, second in zip(masks, folded[0])))
        manifest["regions"][1]["boundary"]["confidence"] = .4
        uncertain = segment_drawing(image, validate_manifest(manifest))
        self.assertEqual(int(uncertain[0][1].sum()), 0)
        self.assertTrue(uncertain[3])
        manifest["regions"][1]["visibleEdges"] = [{"id": "pocket-opening", "points": [[.55, .3], [.65, .4], [.8, .42]],
            "boundaryType": "pocket-edge", "confidence": .95, "evidence": "Visible sewn opening; hidden facing unknown", "style": "solid"}]
        detailed = segment_drawing(image, validate_manifest(manifest))
        self.assertEqual(int(detailed[0][1].sum()), 0)
        self.assertTrue(detailed[1][79:81, 128:131].any())
        self.assertFalse(detailed[1][60, 150])
        del manifest["regions"][0]["outline"]
        with self.assertRaisesRegex(ValueError, "outline"):
            validate_manifest(manifest)

    def test_garment_proportions_are_resolution_independent(self):
        from sleeve_style import garment_context

        guidance = {"armhole": [[.2, .2], [.3, .5]], "cuff": [[.05, .3], [.12, .45]],
                    "garment": {"bodyWidth": [[.3, .6], [.7, .6]], "bodyLength": [[.5, .1], [.5, .9]],
                                "shoulders": [[.2, .2], [.8, .2]]}}
        first = garment_context(Image.new("RGB", (500, 600), "white"), guidance, allow_inference=False)
        second = garment_context(Image.new("RGB", (1000, 1200), "white"), guidance, allow_inference=False)
        self.assertEqual(first, second)
        self.assertAlmostEqual(first["bodyAspectRatio"], 2.4)
        self.assertAlmostEqual(first["shoulderSpanToBodyWidth"], 1.5)
        with self.assertRaisesRegex(ValueError, "Photo analysis"):
            garment_context(Image.new("RGB", (500, 600), "white"), {**guidance, "garment": None}, allow_inference=False)
        with self.assertRaises(ValueError):
            garment_context(Image.new("RGB", (500, 600), "white"), {**guidance, "garment": {**guidance["garment"], "bodyWidth": [[.3, .6], [.3, .6]]}})

    def test_uncertain_fabric_retains_traced_detail_layer(self):
        from garment_from_photo import trace_reconstruction

        manifest = self.garment_manifest_fixture()
        manifest["regions"][1]["boundary"]["confidence"] = .4
        manifest["regions"][1]["visibleEdges"] = [{"id": "opening", "points": [[.15, .2], [.25, .4], [.4, .5]],
            "boundaryType": "pocket-edge", "confidence": .95, "evidence": "Visible pocket lip", "style": "solid"}]
        image = Image.new("RGB", (200, 200), "white")
        traced = []
        def capture(name, mask):
            traced.append((name, int(mask.sum())))
            return "<svg/>"
        with patch("garment_from_photo.wrap_fill_svg", side_effect=capture), patch("garment_from_photo.wrap_ink_svg", side_effect=capture), contextlib.redirect_stdout(io.StringIO()):
            result = trace_reconstruction(image, b"synthetic", manifest, image, manifest)
        self.assertEqual([part["id"] for part in result["parts"]], ["left-leg"])
        self.assertEqual(result["detailLayers"][0]["partId"], "left-pocket")
        self.assertEqual(result["proposedBoundaries"][0]["id"], "left-pocket")
        self.assertTrue(any(name == "Left pocket visible edges" and pixels > 0 for name, pixels in traced))

    def test_whole_drawing_torso_measurement(self):
        from sleeve_style import garment_context

        with Image.open(Path(__file__).parent / "refs/sleeve-isolation-tee.jpg") as source:
            guidance = {"armhole": (np.array([[156, 141], [201, 232], [203, 303], [202, 400], [199, 494]]) / source.size).tolist(),
                        "cuff": (np.array([[15, 417], [185, 516]]) / source.size).tolist()}
            measured = garment_context(source, guidance)
        self.assertTrue(.5 < measured["armholeToBodyWidth"] < .7)
        self.assertTrue(45 < measured["sleeveAngle"] < 70)
        with self.assertRaisesRegex(ValueError, "whole garment"):
            garment_context(Image.new("RGB", (968, 989), "white"), guidance)

    def test_reconstruction_analyzes_full_image_despite_crop(self):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis

        request = {"category": "sleeve", "contextCategory": "sleeve", "source": "drawing", "side": "left",
                   "fit": "slim", "garmentType": "tshirt", "view": "front", "sleeveMode": "reconstruction-v1", "crop": [0, 0, .5, .5]}
        provider = Mock()
        provider.analyzeReference.return_value = ReferenceAnalysis("sleeve", "Short sleeve", "Set-in", "local")
        with tempfile.TemporaryDirectory() as folder:
            image_path = Path(folder) / "garment.png"
            Image.new("RGB", (400, 600), "white").save(image_path)
            with patch.object(pipeline, "select_provider", return_value=provider), patch.object(pipeline, "find_potrace_executable"), patch.object(pipeline, "process_part", return_value={"reconstructionDraft": True}), contextlib.redirect_stdout(io.StringIO()):
                pipeline.process(str(image_path), request)
        self.assertEqual(provider.analyzeReference.call_args.args[0].size, (400, 600))

    def reconstructed_reference_draft(self, fit):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis

        path = Path(__file__).parent / "refs/sleeve-isolation-tee.jpg"
        with Image.open(path) as opened:
            source = opened.convert("RGB")
        points = {"outline": [[156, 141], [15, 417], [185, 516], [199, 494], [202, 400], [203, 303], [201, 232]],
                  "armhole": [[156, 141], [201, 232], [203, 303], [202, 400], [199, 494]], "cuff": [[15, 417], [185, 516]]}
        guidance = {**{key: (np.array(value) / source.size).tolist() for key, value in points.items()}, "confidence": "high", "side": "left"}
        request = {"category": "sleeve", "contextCategory": "sleeve", "source": "drawing", "side": "left", "selectionMode": "both",
                   "fit": fit, "garmentType": "tshirt", "view": "front", "sleeveMode": "reconstruction-v1", "confirmIsolation": True}
        request["stageProvenance"] = pipeline.upload_identity(path.read_bytes(), request)
        analysis = ReferenceAnalysis("sleeve", "Short reference sleeve", "Set-in sleeve with plain open hem", "local", technical_drawing=True,
                                     sleeve_outline=tuple(map(tuple, guidance["outline"])), sleeve_guidance=guidance)
        provider = Mock()
        with contextlib.redirect_stdout(io.StringIO()):
            result = pipeline.process_part(source, request, provider, analysis)
        provider.generateTechnicalRaster.assert_not_called()
        return result

    def test_reconstruction_includes_whole_garment_context(self):
        identities = set()
        for fit in ("slim", "regular", "boxy", "oversized"):
            with self.subTest(fit=fit):
                draft = self.reconstructed_reference_draft(fit)
                identities.add(draft["stageProvenance"]["uploadIdentity"])
                self.assertIn("garmentContextId", draft["stageProvenance"])
                self.assertGreater(draft["style"]["sourceGarment"]["armholeToBodyWidth"], .05)
                self.assertEqual(draft["sleeveIsolation"]["contextCrop"], [0, 0, 1, 1])
                for socket in draft["sockets"].values():
                    self.assertGreater(socket["bodyWidth"], 500)
                    self.assertGreater(socket["garment"]["bodyAspectRatio"], 0)
        self.assertEqual(len(identities), 4)

    def registered_reference_pair(self, fit):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis

        source = Image.open(Path(__file__).parent / "refs/sleeve-isolation-tee.jpg").convert("RGB")
        points = {"outline": [[156, 141], [15, 417], [185, 516], [199, 494], [202, 400], [203, 303], [201, 232]],
                  "armhole": [[156, 141], [201, 232], [203, 303], [202, 400], [199, 494]], "cuff": [[15, 417], [185, 516]]}
        source.info["sleeveGuidance"] = {**{key: (np.array(value) / source.size).tolist() for key, value in points.items()}, "confidence": "high", "side": "left"}
        provider = Mock()
        provider.generateTechnicalRaster.return_value = source
        request = {"category": "sleeve", "contextCategory": "sleeve", "source": "drawing", "side": "left", "selectionMode": "both", "fit": fit, "garmentType": "tshirt", "view": "front"}
        request["stageProvenance"] = pipeline.upload_identity((Path(__file__).parent / "refs/sleeve-isolation-tee.jpg").read_bytes(), request)
        with patch.object(profiles.PROFILES["sleeve"], "register", wraps=profiles.PROFILES["sleeve"].register) as register, contextlib.redirect_stdout(io.StringIO()):
            result = pipeline.process_part(source, request, provider, ReferenceAnalysis("sleeve", "Reference sleeve", "Supplied technical drawing", "local"))
        provider.generateTechnicalRaster.assert_called_once()
        provider.analyzeReference.assert_not_called()
        self.assertEqual([call.args[1]["side"] for call in register.call_args_list], ["left", "right"])
        self.assertIs(register.call_args_list[0].args[0], register.call_args_list[1].args[0])
        return result

    def test_both_sleeves_register_same_source(self):
        for fit in ("slim", "regular", "boxy", "oversized"):
            with self.subTest(fit=fit):
                asset = self.registered_reference_pair(fit)
                opposite = asset["oppositeSleeve"]
                self.assertNotEqual(asset["id"], opposite["id"])
                self.assertEqual(opposite["provenance"], "derived")
                for side, sleeve in (("left", asset), ("right", opposite)):
                    self.assertEqual(sleeve["registration"]["side"], side)
                    self.assertEqual(sleeve["registration"]["socket"], f"studio-{fit}-{side}-armhole-v1")
                    self.assertEqual(sleeve["registration"]["status"], "Exact registration")
                    self.assertEqual(sleeve["registration"]["defaultTransform"], profiles.IDENTITY)
                    self.assertEqual(sleeve["cleanDrawing"], asset["cleanDrawing"])

    def test_shoulder_cap_preserves_sleeve_outside_attachment(self):
        fit_cap = profiles.SleeveRegistrationProfile.fit_shoulder_cap
        fitted_count = 0

        def checked_fit(fabric, ink, socket, top, bottom, shoulder):
            nonlocal fitted_count
            fitted, fitted_ink, status = fit_cap(fabric, ink, socket, top, bottom, shoulder)
            self.assertEqual(status, "Exact registration")
            outer = max(0, shoulder - round((bottom - top) * .4))
            floor = top + round((bottom - top) * .25)
            for before, after in ((fabric, fitted), (ink, fitted_ink)):
                self.assertTrue(np.array_equal(before[floor:], after[floor:]), "Cuff, lower construction and length must stay pixel-identical")
                self.assertTrue(np.array_equal(before[:, :outer], after[:, :outer]), "Outer sleeve must stay pixel-identical")
            self.assertEqual(np.where(fabric)[0].max(), np.where(fitted)[0].max())
            self.assertEqual(np.where(fabric)[1].min(), np.where(fitted)[1].min())
            self.assertFalse(fitted[:top].any(), "No source cap may protrude above the shoulder socket")
            self.assertGreater((fabric & ~fitted).sum(), 0)
            self.assertLessEqual((fabric & ~fitted).sum(), fabric.sum() * .2)
            fitted_count += 1
            return fitted, fitted_ink, status

        with patch.object(profiles.SleeveRegistrationProfile, "fit_shoulder_cap", side_effect=checked_fit):
            for fit in ("slim", "regular", "boxy", "oversized"):
                self.registered_reference_pair(fit)
        self.assertEqual(fitted_count, 8)

    def test_shoulder_cap_extreme_mismatch_needs_review(self):
        fabric = np.zeros((400, 400), dtype=bool)
        fabric[10:220, 220:260] = True
        ink = fabric & ~profiles.ndimage.binary_erosion(fabric)
        socket = np.zeros_like(fabric)
        socket[150:301, 220:260] = True
        fitted, fitted_ink, status = profiles.SleeveRegistrationProfile.fit_shoulder_cap(fabric, ink, socket, 150, 300, 259)
        self.assertEqual(status, "Needs review")
        self.assertTrue(np.array_equal(fitted, fabric))
        self.assertTrue(np.array_equal(fitted_ink, ink))
        with patch.object(profiles.SleeveRegistrationProfile, "register_exact", return_value={"registration": {"status": status}}):
            self.assertEqual(profiles.SleeveRegistrationProfile().register(self.drawing(), {})["registration"]["status"], "Needs review")

    def test_sleeve_isolation_connected_garment(self):
        from sleeve_isolation import isolate_sleeve

        drawing = Image.new("RGB", (600, 600), "white")
        pen = ImageDraw.Draw(drawing)
        pen.polygon([(50, 250), (150, 80), (250, 50), (350, 50), (450, 80), (550, 250), (440, 300), (420, 180), (420, 540), (180, 540), (180, 180), (160, 300)], outline="black", width=2)
        pen.line([(150, 80), (180, 180)], fill="black", width=2)
        pen.line([(55, 240), (162, 290)], fill="black", width=2)
        guidance = {"outline": [[50/600, 250/600], [150/600, 80/600], [180/600, 180/600], [160/600, 300/600]],
                    "armhole": [[150/600, 80/600], [180/600, 180/600]], "cuff": [[50/600, 250/600], [160/600, 300/600]], "confidence": "high"}
        isolated, overlay, metadata = isolate_sleeve(drawing, guidance)
        self.assertEqual(metadata["status"], "isolated")
        self.assertLess(metadata["processingCrop"][2], .32)
        self.assertGreater(metadata["diagnostics"]["removedInk"], 1000)
        self.assertGreater(metadata["diagnostics"]["retainedInk"], 500)
        fabric, ink = profiles.masks(isolated, "sleeve")
        self.assertGreater(fabric.sum(), ink.sum() * 2)
        self.assertEqual(overlay.size, drawing.size)

    def test_sleeve_isolation_reference_crops_and_sides(self):
        from PIL import ImageOps
        from sleeve_isolation import isolate_sleeve
        from lineart import clean_lineart

        source = Image.open(Path(__file__).parent / "refs/sleeve-isolation-tee.jpg").convert("RGB")
        points = {
            "outline": [[156, 141], [15, 417], [185, 516], [199, 494], [202, 400], [203, 303], [201, 232]],
            "armhole": [[156, 141], [201, 232], [203, 303], [202, 400], [199, 494]],
            "cuff": [[15, 417], [185, 516]],
        }
        for crop in ((0, 0, 968, 989), (0, 90, 400, 560), (0, 130, 220, 535)):
            for side, fit in ((side, fit) for side in ("left", "right") for fit in (("slim", "regular", "boxy", "oversized") if crop[1] == 0 else ("slim",))):
                with self.subTest(crop=crop, side=side, fit=fit):
                    drawing = source.crop(crop)
                    guidance = {key: ((np.array(value) - crop[:2]) / drawing.size).tolist() for key, value in points.items()}
                    if side == "right":
                        drawing = ImageOps.mirror(drawing)
                        guidance = {key: [[(drawing.width - 1) / drawing.width - horizontal, vertical] for horizontal, vertical in value] for key, value in guidance.items()}
                    guidance.update(confidence="high", side=side)
                    isolated, overlay, metadata = isolate_sleeve(drawing, guidance)
                    self.assertEqual(metadata["status"], "isolated")
                    self.assertGreater(metadata["diagnostics"]["coverage"], .95)
                    tinted = np.any(np.asarray(overlay) != np.asarray(drawing), axis=2)
                    if side == "right":
                        tinted = np.fliplr(tinted)
                    for vertical in (432, 440):
                        region = tinted[vertical-crop[1]:vertical-crop[1]+8, 98:110]
                        self.assertGreater(region.mean(), .95, "Both cuff stitch rows must stay in the retained mask")
                    result = profiles.PROFILES["sleeve"].register(clean_lineart(isolated), {"fit": fit, "side": side, "garmentType": "tshirt", "view": "front"})
                    self.assertEqual(result["registration"]["status"], "Exact registration")
                    self.assertEqual(result["registration"]["defaultTransform"], profiles.IDENTITY)
                    self.assertEqual(result["registration"]["socket"], f"studio-{fit}-{side}-armhole-v1")
                    profiles.validate_svg(result["svg"])
                    profiles.validate_render(result["svg"])
                    import resvg_py

                    def raster(svg):
                        png = resvg_py.svg_to_bytes(svg_string=svg, width=1536, height=1536)
                        return np.asarray(Image.open(io.BytesIO(png)).convert("RGBA").crop((256, 0, 1280, 1536)))[..., 3] >= 128

                    sleeve, keep = raster(result["svg"]), raster(result["keepSvg"])
                    body = profiles.raster_catalog("Body", "Body" + ("" if fit == "slim" else f" ({fit})"))
                    suffix = side.title()
                    tag = "" if fit == "slim" else f" ({fit})"
                    socket = profiles.raster_catalog(f"{suffix} sleeve", f"{suffix} sleeve{tag}") | profiles.raster_catalog(f"{suffix} cuff", f"{suffix} cuff{tag}")
                    if side == "right":
                        sleeve, keep, body, socket = (np.fliplr(mask) for mask in (sleeve, keep, body, socket))
                    composite = sleeve | (body & keep)
                    top, bottom = np.array(result["registration"]["anchors"]["target"])
                    for row in (int(top[1]), int(top[1]) + 1, int(bottom[1]) - 1, int(bottom[1])):
                        column = max(int(np.flatnonzero(socket[row])[-1]) + 1, int(np.flatnonzero(body[row])[0]))
                        self.assertTrue(sleeve[row, column-2:column+1].any(), f"Missing sleeve endpoint on {fit}/{side} at {row}")
                        self.assertTrue(composite[row, column:column+3].all(), f"Open attachment endpoint on {fit}/{side} at {row}")
                    for row in range(int(top[1]) + 4, int(bottom[1]) - 3):
                        column = max(int(np.flatnonzero(socket[row])[-1]) + 1, int(np.flatnonzero(body[row])[0]))
                        self.assertTrue(composite[row, column-2:column+5].all(), f"Attachment gap on {fit}/{side} at {row}")
                        self.assertLessEqual((sleeve[row] & body[row] & keep[row]).sum(), 2, f"Attachment overlap on {fit}/{side} at {row}")
                        self.assertTrue(np.array_equal((body & keep)[row, column+3:], body[row, column+3:]), "Unrelated body pixels must not change")

    def test_sleeve_isolation_lengths_and_unusual_outline(self):
        from sleeve_isolation import isolate_sleeve

        for length, cuff_height in ((120, 180), (340, 100), (260, 280)):
            with self.subTest(length=length, cuff_height=cuff_height):
                drawing = Image.new("RGB", (600, 600), "white")
                points = [(400-length, 300-cuff_height/2), (400, 180), (400, 400), (400-length, 300+cuff_height/2)]
                pen = ImageDraw.Draw(drawing)
                pen.polygon(points, outline="black", width=2)
                pen.line([(400, 180), (550, 160), (550, 540), (400, 540), (400, 400)], fill="black", width=2)
                pen.line([(410-length, 305-cuff_height/2), (410-length, 295+cuff_height/2)], fill="black", width=2)
                guidance = {"outline": (np.array(points)/600).tolist(), "armhole": [[400/600, .3], [400/600, 400/600]],
                            "cuff": [[(400-length)/600, (300-cuff_height/2)/600], [(400-length)/600, (300+cuff_height/2)/600]], "confidence": "high"}
                isolated, _, metadata = isolate_sleeve(drawing, guidance)
                fabric, ink = profiles.masks(isolated, "sleeve")
                self.assertGreater(fabric.sum(), ink.sum()*2)
                self.assertLess(metadata["processingCrop"][2], .68)
                self.assertGreater(metadata["diagnostics"]["removedInk"], 1000)

    def test_sleeve_isolation_cached_photo_confirmation(self):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis

        drawing = Image.new("RGB", (400, 400), "white")
        ImageDraw.Draw(drawing).rectangle((70, 80, 300, 320), outline="black", width=2)
        guidance = {"outline": [[.175, .2], [.75, .2], [.75, .8], [.175, .8]], "armhole": [[.75, .2], [.75, .8]],
                    "cuff": [[.175, .2], [.175, .8]], "confidence": "low", "side": "left"}
        drawing.info["sleeveGuidance"] = guidance
        provider = Mock()
        provider.generateTechnicalRaster.return_value = drawing
        analysis = ReferenceAnalysis("sleeve", "Sleeve", "cuff", "astra")
        request = {"category": "sleeve", "source": "photo", "view": "front", "side": "left", "crop": [0, 0, 1, 1]}
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory, contextlib.redirect_stdout(io.StringIO()), patch.object(pipeline.PROFILES["sleeve"], "register", return_value={"svg": "tested separately"}) as register, patch.object(pipeline, "validate_svg"), patch.object(pipeline, "validate_render"):
            pending = pipeline.process_part(drawing, request, provider, analysis, cache=Path(directory))
            self.assertTrue(pending["isolationPending"])
            register.assert_not_called()
            for replacement, changed_request in ((Image.new("RGB", drawing.size, "white"), request),
                                                 (drawing, {**request, "crop": [0, 0, .8, 1]}),
                                                 (drawing, {**request, "side": "right"})):
                with self.assertRaisesRegex(ValueError, "does not belong to this upload"):
                    pipeline.process_part(replacement, {**changed_request, "resumeIsolation": True, "confirmIsolation": True}, provider, analysis, cache=Path(directory))
            register.assert_not_called()
            adjusted = {**guidance, "cuff": [[.18, .2], [.18, .8]]}
            result = pipeline.process_part(drawing, {**request, "resumeIsolation": True, "confirmIsolation": True, "isolationGuidance": adjusted}, provider, analysis, cache=Path(directory))
            provider.generateTechnicalRaster.assert_called_once()
            provider.analyzeReference.assert_not_called()
            register.assert_called_once()
            self.assertEqual(result["validation"]["status"], "passed")
            self.assertEqual(result["stageProvenance"]["uploadIdentity"], pending["stageProvenance"]["uploadIdentity"])
            self.assertEqual(result["stageProvenance"]["normalizedAssetId"], pipeline.hashlib.sha256(result["cleanDrawing"].encode()).hexdigest())

    def test_sleeve_isolation_technical_reference_needs_no_generation(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        analysis = ReferenceAnalysis("sleeve", "Sleeve", "double hem", "astra", technical_drawing=True,
                                     sleeve_guidance={"side": "left", "confidence": "medium"})
        with patch.object(provider.raster, "generateTechnicalRaster") as generate, patch.object(provider, "reviewTechnicalRaster") as review:
            source = self.drawing()
            drawing = provider.generateTechnicalRaster(source, analysis, lambda _: None)
            self.assertTrue(np.array_equal(np.asarray(drawing), np.asarray(source)))
            self.assertEqual(drawing.info["sleeveGuidance"], analysis.sleeve_guidance)
            generate.assert_not_called()
            review.assert_not_called()

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

    def standing_collar_drawing(self, height=400):
        image = Image.new("L", (400, height), 0)
        pen = ImageDraw.Draw(image)
        for points, width in [
            ([(65, 40), (335, 40), (350, 330), (300, 348), (200, 360), (100, 348), (50, 330), (65, 40)], 2),
            ([(65, 40), (155, 62), (170, 78), (200, 85), (230, 78), (245, 62), (335, 40)], 2),
            ([(170, 78), (165, 118)], 2),
            ([(230, 78), (235, 118)], 2),
            ([(52, 323), (100, 340), (200, 352), (300, 340), (348, 323)], 1),
        ]:
            pen.line([(column, round(row * height / 400)) for column, row in points], fill=255, width=width)
        return image

    def test_standing_collar_broad_panel_is_fabric(self):
        image = self.standing_collar_drawing()
        ink = np.asarray(image) > 0
        empty = np.zeros_like(ink)
        fabric, strokes, opening = profiles.collar.seated_collar(ink, empty, empty)
        self.assertTrue(fabric[200, 200], "Broad standing panel was discarded")
        self.assertTrue(opening[55, 200], "Dipped opening must stay transparent")
        self.assertFalse(np.any(fabric & opening))
        self.assertTrue(np.array_equal(strokes, ink))
        self.assertGreater(int(fabric.sum()), 60000)
        topology = profiles.collar.collar_topology(ink)
        combined = topology["outerBoundary"] | topology["innerBoundary"] | topology["attachmentInk"] | topology["constructionInk"]
        self.assertTrue(np.array_equal(combined, ink))
        self.assertTrue(topology["constructionInk"][100, 165:172].any())
        socket = np.zeros((800, 600), dtype=bool)
        socket[440:460, 150:450] = True
        placement = profiles.collar.standing_collar_placement(topology, socket, socket.shape)
        self.assertIsNotNone(placement)
        scale, left, top = placement
        attachment_rows, attachment_columns = np.where(topology["attachment"])
        original_top = float(459 - np.mean(attachment_rows * scale))
        outer_rows = np.flatnonzero(topology["outer"].any(axis=1))
        self.assertLessEqual(abs(top - original_top), float(np.ptp(outer_rows) * scale * 0.05))
        self.assertLessEqual(float(np.abs(attachment_rows * scale + top - 459).max()),
                     float(np.abs(attachment_rows * scale + original_top - 459).max()))
        self.assertAlmostEqual(scale, 299 / np.ptp(attachment_columns))
        self.assertAlmostEqual(float(attachment_columns.min() * scale + left), 150, places=5)
        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        with patch.dict(os.environ, environment):
            svg = profiles.collar.registered_collar_svg(fabric, ink, "Standing collar fixture", socket.shape, placement)
            profiles.collar.validate_collar_fidelity(svg, fabric, ink, opening, socket.shape, placement)
            profiles.validate_svg(svg)
            profiles.validate_render(svg)
        root = profiles.collar.ET.fromstring(svg)
        groups = root.findall("{http://www.w3.org/2000/svg}g")
        self.assertEqual(groups[1].get("fill"), "none")
        self.assertEqual(groups[1].get("transform"), groups[0].get("transform"))
        self.assertEqual({path.get("data-topology") for path in groups[1]},
                         {"outerBoundary", "innerBoundary", "attachmentInk", "constructionInk"})
        self.assertTrue(all(path.get("fill") == "none" for path in groups[1]))
        previews = profiles.collar.topology_previews(topology)
        self.assertEqual(set(previews), {"fabric", "opening", "outerBoundary", "innerBoundary", "attachment", "constructionInk"})
        for key, data_url in previews.items():
            decoded = Image.open(io.BytesIO(profiles.collar.base64.b64decode(data_url.split(",", 1)[1])))
            self.assertTrue(np.array_equal(np.asarray(decoded) == 0, topology[key]))

    def registered_standing_collar_fixture(self, filename="approved-standing-collar.png"):
        with Image.open(Path(__file__).parent / "refs" / filename) as reference:
            drawing = reference.convert("RGB")
        executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
        environment = {"POTRACE": str(executable)} if executable.exists() else {}
        with patch.dict(os.environ, environment), contextlib.redirect_stdout(io.StringIO()):
            result = profiles.PROFILES["collar"].register(drawing, {"garmentType": "tshirt", "fit": "slim", "view": "front"})
        buffer = io.BytesIO()
        drawing.save(buffer, format="PNG")
        clean_drawing = "data:image/png;base64," + profiles.collar.base64.b64encode(buffer.getvalue()).decode("ascii")
        import resvg_py

        png = resvg_py.svg_to_bytes(svg_string=result["svg"], width=1536, height=1536)
        rendered = Image.open(io.BytesIO(png)).convert("RGBA").crop((256, 0, 1280, 1536))
        socket = profiles.raster_catalog("Neck", "Crew neck")
        columns = np.flatnonzero(socket.any(axis=0))
        target_rows = socket.shape[0] - 1 - np.argmax(socket[::-1, columns], axis=0)
        attachment_png = result["collarTopology"]["previews"]["attachment"].split(",", 1)[1]
        attachment = np.asarray(Image.open(io.BytesIO(profiles.collar.base64.b64decode(attachment_png)))) == 0
        placed = profiles.collar.place_region(attachment, socket.shape, tuple(result["collarTopology"]["placement"]))
        overlay = Image.new("RGBA", rendered.size, "white")
        overlay.alpha_composite(rendered)
        pixels = np.array(overlay)
        pixels[target_rows, columns] = (220, 38, 38, 255)
        pixels[placed] = (5, 150, 105, 255)
        overlay_buffer = io.BytesIO()
        Image.fromarray(pixels).crop((310, 90, 720, 380)).resize((820, 580)).save(overlay_buffer, format="PNG")
        return {**result, "cleanDrawing": clean_drawing,
            "attachmentOverlay": "data:image/png;base64," + profiles.collar.base64.b64encode(overlay_buffer.getvalue()).decode("ascii")}

    def test_standing_collar_catalog_registration(self):
        result = self.registered_standing_collar_fixture()
        self.assertEqual(result["collarTopology"]["version"], 1)
        self.assertEqual(len(result["collarTopology"]["previews"]), 6)
        checks = result["collarTopology"]["attachmentChecks"]
        self.assertEqual(checks["mode"], "constrained-cubic-spline-attachment")
        self.assertTrue(checks["bodyScaleLocked"])
        self.assertTrue(checks["openingUnchanged"])
        self.assertTrue(checks["outsideAttachmentUnchanged"])
        self.assertEqual(checks["attachmentZoneFraction"], 0.15)
        self.assertLess(checks["maxAnchorDistance"], 1e-5)
        self.assertLessEqual(checks["maxRasterAttachmentDistance"], 2)
        self.assertLess(checks["maxLocalMovement"], 22)
        self.assertLessEqual(checks["maxAttachmentDistance"], 2)
        self.assertGreater(checks["minimumJacobian"], 0.2)
        self.assertLess(checks["constructionInkCoverage"], 0.03)
        profiles.validate_render(result["svg"])
        profiles.validate_render(result["bodySvg"])
        drawing = Image.fromarray(255 - np.asarray(self.standing_collar_drawing())).convert("RGB")
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(profiles.collar.CollarError, "retain its height"):
            profiles.PROFILES["collar"].register(drawing, {"garmentType": "tshirt", "fit": "slim", "view": "front"})

    def test_captured_standing_collar_catalog_registration(self):
        for filename in ("captured-standing-collar.png", "captured-standing-collar-gap.png",
                         "azure-standing-collar-1.png", "azure-standing-collar-2.png", "azure-standing-collar-3.png"):
            with self.subTest(filename=filename):
                result = self.registered_standing_collar_fixture(filename)
                checks = result["collarTopology"]["attachmentChecks"]
                self.assertEqual(checks["mode"], "constrained-cubic-spline-attachment")
                self.assertTrue(checks["bodyScaleLocked"])
                self.assertTrue(checks["openingUnchanged"])
                self.assertTrue(checks["outsideAttachmentUnchanged"])
                self.assertEqual(checks["attachmentZoneFraction"], 0.15)
                self.assertLessEqual(checks["maxRasterAttachmentDistance"], 2)
                self.assertLess(checks["maxAnchorDistance"], 1e-5)
                self.assertLessEqual(checks["maxAttachmentDistance"], 2)
                self.assertGreater(checks["minimumJacobian"], 0.2)
                self.assertLess(checks["constructionInkCoverage"], 0.03)
                profiles.validate_render(result["svg"])
                profiles.validate_render(result["bodySvg"])

    def test_constrained_attachment_rejects_reversed_anchors(self):
        columns = np.arange(101, dtype=float)
        rows = np.full_like(columns, 20)
        destinations = np.column_stack((100 - columns, rows))
        with self.assertRaisesRegex(profiles.collar.CollarError, "Needs Review: no smooth attachment fit"):
            profiles.collar.constrained_attachment_curve(columns, rows, destinations, 30, 120, destinations)

    def test_approved_collar_topology_preserves_original_ink(self):
        with Image.open(Path(__file__).parent / "refs/approved-standing-collar.png") as reference:
            keyed = profiles.collar.crop_ink(profiles.collar.keep_strong_ink(profiles.collar.key_white(reference.convert("RGB"))), pad=8)
        ink = np.asarray(keyed.getchannel("A")) >= profiles.collar.STRONG_INK
        topology = profiles.collar.collar_topology(ink)
        self.assertTrue(topology["fabric"][250, 340])
        self.assertTrue(topology["opening"][60, 340])
        self.assertFalse(np.any(topology["fabric"] & topology["opening"]))
        self.assertGreater(int(topology["fabric"].sum()), 180000)
        combined = topology["outerBoundary"] | topology["innerBoundary"] | topology["attachmentInk"] | topology["constructionInk"]
        self.assertTrue(np.array_equal(combined, ink))

    def test_attachment_rejects_excessive_local_deformation(self):
        ink = np.asarray(self.standing_collar_drawing(height=180)) > 0
        topology = profiles.collar.collar_topology(ink)
        socket = profiles.raster_catalog("Neck", "Crew neck")
        placement = profiles.collar.standing_collar_placement(topology, socket, socket.shape)
        with self.assertRaisesRegex(profiles.collar.CollarError, "Needs Review: attachment needs more than a small local correction"):
            profiles.collar.fit_attachment_zone(topology, socket, placement)

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
            payload = {"category": category, "name": "Custom", "construction": "seams"}
            if category == "sleeve":
                payload["sleeveOutline"] = [[.2, .2], [.7, .2], [.7, .8], [.2, .8]]
            with self.subTest(category=category), patch.object(provider.transport, "post", return_value=self.response(json.dumps(payload))) as post:
                analysis = provider.analyzeReference(self.drawing(), category)
                self.assertEqual(analysis.provider, "astra")
                self.assertEqual(post.call_args.args[0], "/openai/v1/responses")
                body = post.call_args.kwargs["json"]
                self.assertEqual(body["model"], "gpt-6-astra")
                self.assertTrue(body["input"][0]["content"][1]["image_url"].startswith("data:image/png;base64,"))
                self.assertIn("stitch row count and placement", body["input"][0]["content"][0]["text"])
                self.assertIn("Exclude labels and tags", body["input"][0]["content"][0]["text"])
                if category == "sleeve":
                    self.assertIn("sleeveOutline", body["input"][0]["content"][0]["text"])
                    self.assertIn("actual sewn armhole seam", body["input"][0]["content"][0]["text"])
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
            if category == "sleeve":
                payload["sleeveOutline"] = [[.1, .1], [.9, .1], [.9, .9], [.1, .9]]
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
            def result(photo, options, selected_provider, observed, *, cache=None):
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

    def test_sleeve_reference_excludes_shoulder(self):
        import base64
        from asset_providers import isolated_parent_reference, reference_png

        photo = Image.new("RGB", (512, 512), "white")
        pen = ImageDraw.Draw(photo)
        outline = [(180, 100), (270, 180), (270, 420), (70, 420), (100, 210)]
        pen.polygon(outline, outline="black", width=3)
        pen.line([(180, 100), (360, 40), (270, 180)], fill="black", width=3)
        pen.line((80, 390, 265, 390), fill="black", width=3)
        original = photo.tobytes()
        payload = {"category": "sleeve", "name": "Sleeve", "construction": "diagonal armhole and cuff seam",
                   "sleeveOutline": [[horizontal / 512, vertical / 512] for horizontal, vertical in outline]}
        provider = self.astra()
        with patch.object(provider.transport, "post", return_value=self.response(json.dumps(payload))):
            analysis = provider.analyzeReference(photo, "sleeve")
        self.assertEqual(analysis.sleeve_outline, tuple(tuple(point) for point in payload["sleeveOutline"]))
        reference = isolated_parent_reference(photo, analysis)
        self.assertEqual(photo.getpixel((270, 70)), (0, 0, 0))
        self.assertEqual(reference.getpixel((270, 70)), (255, 255, 255))
        self.assertEqual(reference.getpixel((150, 390)), (0, 0, 0))
        self.assertEqual(photo.tobytes(), original)
        encoded = base64.b64encode(reference_png(reference)).decode("ascii")
        with patch.object(provider.transport, "post", return_value={"data": [{"b64_json": encoded}]}) as post:
            provider.raster.generateTechnicalRaster(photo, analysis, lambda _: None)
            self.assertEqual(post.call_args.kwargs["files"]["image"][1], reference_png(reference))
        with patch.object(provider.transport, "post", return_value=self.response(json.dumps({"reference": self.sleeve_geometry(), "generated": self.sleeve_geometry(), "issues": []}))) as post:
            provider.reviewTechnicalRaster(photo, reference, analysis)
            content = post.call_args.kwargs["json"]["input"][0]["content"]
            self.assertEqual(content[1]["image_url"].split(",", 1)[1], base64.b64encode(reference_png(photo)).decode("ascii"))
        missing_outline = {key: value for key, value in payload.items() if key != "sleeveOutline"}
        with patch.object(provider.transport, "post", return_value=self.response(json.dumps(missing_outline))):
            with self.assertRaisesRegex(ValueError, "sleeve outline"):
                provider.analyzeReference(photo, "sleeve")
        for invalid in (None, [], [[0, 0]] * 4, [[0, 0], [1, 0], [float("nan"), 1]], [[False, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 2]]):
            with self.subTest(outline=invalid), patch.object(provider.transport, "post", return_value=self.response(json.dumps({**payload, "sleeveOutline": invalid}))):
                with self.assertRaisesRegex(ValueError, "sleeve outline"):
                    provider.analyzeReference(photo, "sleeve")

    def sleeve_geometry(self, length=.5, upper=.3, cuff=.2):
        return {"confidence": "high", "centerline": [[.8, .5], [.8-length, .5]],
                "upper": [[.8, .5-upper/2], [.8, .5+upper/2]],
                "armhole": [[.8, .5-upper/2], [.8, .5+upper/2]],
                "cuff": [[.8-length, .5-cuff/2], [.8-length, .5+cuff/2]],
                "outline": [[.8, .5-upper/2], [.8-length, .5-cuff/2], [.8-length, .5+cuff/2], [.8, .5+upper/2]]}

    def test_sleeve_reference_relative_measurements(self):
        from asset_providers import sleeve_measurements, compare_sleeve_measurements

        styles = {"short wide": (.2, .5, .45), "long narrow": (.65, .12, .08),
                  "flared": (.4, .2, .5), "oversized": (.55, .6, .55), "standard": (.4, .3, .22),
                  "cap": (.1, .45, .4), "broad cuff": (.3, .2, .6), "narrow cuff": (.4, .4, .08)}
        for name, dimensions in styles.items():
            with self.subTest(style=name):
                geometry = self.sleeve_geometry(*dimensions)
                reference = sleeve_measurements(geometry, (1000, 500))
                rotated = {key: [[1-vertical, horizontal] for horizontal, vertical in points]
                           for key, points in geometry.items() if key != "confidence"}
                rotated["confidence"] = "high"
                generated = sleeve_measurements(rotated, (1000, 2000))
                result = compare_sleeve_measurements(reference, generated, [])
                self.assertEqual(result["status"], "Good match")
                self.assertLess(max(result["relativeDrift"].values()), 1e-12)

            asymmetric = self.sleeve_geometry(.4, .3, .4)
            asymmetric["cuff"] = [[.25, .25], [.45, .75]]
            asymmetric["outline"][1:3] = asymmetric["cuff"]
            asymmetric["centerline"][-1] = [.35, .5]
            reference = sleeve_measurements(asymmetric, (1000, 1000))
            mirrored = {key: [[1-horizontal, vertical] for horizontal, vertical in points]
                    for key, points in asymmetric.items() if key != "confidence"}
            mirrored["confidence"] = "high"
            self.assertEqual(compare_sleeve_measurements(reference, sleeve_measurements(mirrored, (750, 750)), [])["status"], "Good match")

    def test_sleeve_reference_drift_levels(self):
        from asset_providers import sleeve_measurements, compare_sleeve_measurements

        reference = sleeve_measurements(self.sleeve_geometry(.5, .3, .3), (1000, 1000))
        for cuff, expected in ((.33, "Good match"), (.39, "Needs review"), (.6, "Rejected")):
            generated = sleeve_measurements(self.sleeve_geometry(.5, .3, cuff), (1000, 1000))
            result = compare_sleeve_measurements(reference, generated, [])
            self.assertEqual(result["status"], expected)
        generated["confidence"] = "low"
        self.assertEqual(compare_sleeve_measurements(reference, generated, [])["status"], "Needs review")
        for geometry in (self.sleeve_geometry(.2, .3, .3), self.sleeve_geometry(.5, .3, .55)):
            self.assertEqual(compare_sleeve_measurements(reference, sleeve_measurements(geometry, (1000, 1000)), [])["status"], "Rejected")
        tapered = sleeve_measurements(self.sleeve_geometry(.5, .4, .28), (1000, 1000))
        rectangular = sleeve_measurements(self.sleeve_geometry(.5, .4, .4), (1000, 1000))
        self.assertEqual(compare_sleeve_measurements(tapered, rectangular, [])["status"], "Rejected")
        for kind in ("missing_opening", "broken_topology", "contamination", "wrong_object", "cap_lost", "construction_changed"):
            evidence = {"kind": kind, "severity": "major", "confidence": "high", "referenceEvidence": "complete sleeve with opening and cuff seam", "drawingEvidence": "opening replaced by torso geometry"}
            self.assertEqual(compare_sleeve_measurements(reference, reference, [evidence])["status"], "Rejected")
        with self.assertRaisesRegex(ValueError, "specific evidence"):
            compare_sleeve_measurements(reference, reference, ["too wide for a normal sleeve"])

    def test_sleeve_review_correction(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        photo = self.drawing()
        corrected = photo.copy()
        analysis = ReferenceAnalysis("sleeve", "Long sleeve", "horizontal stripes and solid curved cuff joins", "astra")
        issues = ["Extra torso-side outline beside sleeve", "Invented vertical cuff ribbing and dashed stitch rows"]
        evidence = [{"kind": kind, "severity": "major", "confidence": "high", "referenceEvidence": "sleeve boundary and curved cuff joins", "drawingEvidence": issue}
                for kind, issue in zip(("contamination", "construction_changed"), issues)]
        failed = self.response(json.dumps({"reference": self.sleeve_geometry(), "generated": self.sleeve_geometry(), "issues": evidence}))
        passed = self.response(json.dumps({"reference": None, "generated": self.sleeve_geometry(), "issues": []}))
        with patch.object(provider.raster, "generateTechnicalRaster", side_effect=[photo, corrected]) as generate, patch.object(provider.transport, "post", side_effect=[failed, passed]) as review:
            self.assertIs(provider.generateTechnicalRaster(photo, analysis, lambda _: None), corrected)
            self.assertEqual(generate.call_count, 2)
            self.assertEqual(review.call_count, 2)
            self.assertIs(generate.call_args.args[0], photo)
            for issue in issues:
                self.assertIn(issue, generate.call_args.kwargs["correction"])
            self.assertIn("target fixed", review.call_args.kwargs["json"]["input"][0]["content"][0]["text"])
        with patch.object(provider.raster, "generateTechnicalRaster", return_value=photo) as generate, patch.object(provider.transport, "post", return_value=failed) as review:
            with self.assertRaisesRegex(ValueError, "after automatic correction"):
                provider.generateTechnicalRaster(photo, analysis, lambda _: None)
            self.assertEqual(generate.call_count, 2)
            self.assertEqual(review.call_count, 2)

    def test_sleeve_review_continues_without_normalizing(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        analysis = ReferenceAnalysis("sleeve", "Wide sleeve", "short with broad cuff", "astra")
        for cuff, status in ((.45, "Good match"), (.58, "Needs review")):
            photo = self.drawing()
            verdict = {"reference": self.sleeve_geometry(.2, .5, .45), "generated": self.sleeve_geometry(.2, .5, cuff), "issues": []}
            with patch.object(provider.raster, "generateTechnicalRaster", return_value=photo) as generate, patch.object(provider.transport, "post", return_value=self.response(json.dumps(verdict))) as review:
                result = provider.generateTechnicalRaster(photo, analysis, lambda _: None)
                self.assertEqual(result.info["sleeveReview"]["status"], status)
                self.assertEqual(generate.call_count, 1)
                self.assertEqual(review.call_count, 1)

    def test_sleeve_review_requires_valid_measurements(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        analysis = ReferenceAnalysis("sleeve", "Sleeve", "cuff", "astra")
        for geometry in (None, {}, {**self.sleeve_geometry(), "cuff": [[.1, .1], [.1, .1]]},
                         {**self.sleeve_geometry(), "upper": [[True, 0], [1, 1]]}):
            payload = {"reference": geometry, "generated": self.sleeve_geometry(), "issues": []}
            with self.subTest(geometry=geometry), patch.object(provider.transport, "post", return_value=self.response(json.dumps(payload))), patch.object(provider.raster, "generateTechnicalRaster", return_value=self.drawing()) as generate:
                with self.assertRaises(ValueError):
                    provider.generateTechnicalRaster(self.drawing(), analysis, lambda _: None)
                self.assertEqual(generate.call_count, 1)

    def test_sleeve_review_survives_cleanup_and_registration(self):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis, compare_sleeve_measurements, sleeve_measurements

        photo = self.drawing()
        reference = sleeve_measurements(self.sleeve_geometry(.5, .3, .3), photo.size)
        generated = sleeve_measurements(self.sleeve_geometry(.5, .3, .39), photo.size)
        photo.info["sleeveReview"] = compare_sleeve_measurements(reference, generated, [])
        provider = Mock()
        provider.generateTechnicalRaster.return_value = photo
        analysis = ReferenceAnalysis("sleeve", "Sleeve", "broad cuff", "astra")
        request = {"category": "sleeve", "source": "photo", "view": "front", "confirmIsolation": True}
        with contextlib.redirect_stdout(io.StringIO()), patch.object(pipeline, "clean_lineart", return_value=photo.copy()), patch.object(pipeline.PROFILES["sleeve"], "register", return_value={"svg": "verified by existing registration tests"}), patch.object(pipeline, "validate_svg"), patch.object(pipeline, "validate_render"):
            result = pipeline.process_part(photo, request, provider, analysis)
        self.assertEqual(result["sleeveReview"]["status"], "Needs review")
        self.assertEqual(result["validation"]["status"], "passed")
        self.assertTrue(result["cleanDrawing"].startswith("data:image/png;base64,"))

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
            self.assertIn("not the sleeve's own underarm boundary", post.call_args.kwargs["data"]["prompt"])
            self.assertIn("do not assume a generic ribbed cuff", post.call_args.kwargs["data"]["prompt"])
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
        for category in ("pocket",):
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

    def test_collar_source_evidence_and_statuses(self):
        from asset_providers import ReferenceAnalysis

        provider = self.astra()
        analysis = ReferenceAnalysis("collar", "Mock neck", "Generic ribbed collar expectation", "astra")
        evidence = {"construction": "high mock-neck", "texture": "smooth knit", "opening": "soft folded opening",
                    "height": "high collar", "attachment": "curved neckline seam", "seams": "visible base seam only"}
        difference = {"feature": "inner collar texture", "referenceEvidence": "Inner back face is smooth",
                      "drawingEvidence": "Dense vertical lines cover inner back face", "severity": "major", "confidence": "high", "basis": "visible"}
        for differences, confidence, expected in [([], "high", "Good Match"), ([], "low", "Needs Review"),
                ([difference], "high", "Rejected"), ([{**difference, "severity": "minor"}], "high", "Needs Review"),
                ([{**difference, "basis": "ambiguous"}], "high", "Needs Review"),
                ([{**difference, "basis": "preset"}], "high", "Good Match")]:
            drawing = self.drawing()
            response = {"reference": evidence, "generated": evidence, "confidence": confidence, "differences": differences}
            with self.subTest(expected=expected, differences=differences), patch.object(provider.raster, "generateTechnicalRaster", return_value=drawing), patch.object(provider.transport, "post", return_value=self.response(json.dumps(response))) as post:
                result = provider.generateTechnicalRaster(self.drawing(), analysis, lambda _: None)
                self.assertEqual(result.info["collarReview"]["status"], expected)
                content = post.call_args.kwargs["json"]["input"][0]["content"]
                self.assertEqual(len([item for item in content if item["type"] == "input_image"]), 2)
                self.assertIn("source image is the sole construction truth", content[0]["text"])
                self.assertNotIn(analysis.construction, content[0]["text"])

    def test_collar_rejection_exposes_images_before_tracing(self):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis

        drawing = self.drawing()
        drawing.info["collarReview"] = {"status": "Rejected", "differences": [{"feature": "invented ribbing"}]}
        provider = Mock()
        provider.generateTechnicalRaster.return_value = drawing
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(pipeline.PROFILES["collar"], "register") as register:
            with self.assertRaisesRegex(ValueError, "materially differs"):
                pipeline.process_part(drawing, {"category": "collar", "source": "photo", "view": "front"}, provider,
                                      ReferenceAnalysis("collar", "Mock neck", "smooth knit", "astra"))
            register.assert_not_called()
        comparison = next(json.loads(line) for line in output.getvalue().splitlines() if json.loads(line)["type"] == "collar-review")
        self.assertTrue(comparison["sourceCrop"].startswith("data:image/png;base64,"))
        self.assertTrue(comparison["cleanDrawing"].startswith("data:image/png;base64,"))
        self.assertEqual(comparison["review"]["differences"][0]["feature"], "invented ribbing")

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

    def streamed_response(self, events):
        response = Mock(status_code=200, headers={"Content-Type": "text/event-stream; charset=utf-8"})
        response.iter_content.return_value = [b"data: " + json.dumps(event).encode() + b"\n\n" for event in events]
        return response

    def test_astra_stream_uses_only_completed_manifest(self):
        provider = self.astra()
        manifest = self.garment_manifest_fixture()
        terminal = self.response(json.dumps(manifest))
        response = self.streamed_response([
            {"type": "response.created", "response": {"status": "in_progress"}},
            {"type": "response.output_text.delta", "delta": "not a complete manifest"},
            {"type": "response.completed", "response": terminal},
        ])
        with patch("asset_providers.requests.post") as post:
            post.return_value.__enter__.return_value = response
            result = provider.analyzeGarment(self.drawing())
        self.assertEqual(result["garmentType"], manifest["garmentType"])
        self.assertEqual(len(result["regions"]), 2)
        self.assertTrue(post.call_args.kwargs["json"]["stream"])
        self.assertFalse(post.call_args.kwargs["json"]["store"])
        self.assertEqual(post.call_args.kwargs["timeout"], (15, 240))
        response.iter_content.assert_called_once_with(1024)

    def test_astra_stream_handles_chunk_boundaries_and_utf8(self):
        provider = self.astra()
        terminal = self.response("Café")
        event = json.dumps({"type": "response.completed", "response": terminal}, ensure_ascii=False, indent=2)
        body = (": heartbeat\r\nevent: response.completed\r\n" +
                "\r\n".join("data: " + line for line in event.splitlines()) + "\r\n\r\n").encode()
        for chunk_size in (1, 7, 1024):
            response = self.streamed_response([])
            response.iter_content.return_value = [body[index:index + chunk_size] for index in range(0, len(body), chunk_size)]
            with self.subTest(chunk_size=chunk_size), patch("asset_providers.requests.post") as post:
                post.return_value.__enter__.return_value = response
                self.assertEqual(provider.transport.post("/openai/v1/responses", "Astra analysis", json={"stream": True}), terminal)

    def test_astra_stream_rejects_partial_and_malformed_events(self):
        provider = self.astra()
        bodies = [b"", b'data: {"type":"response.output_text.delta","delta":"{}"}\n\n',
                  b"data: not-json\n\n", b"data: []\n\n", b"data: \xff\n\n", b'data: {"type":[]}\n\n',
                  b'data: {"type":"response.completed","response":null}\n\n',
                  b'data: {"type":"response.completed","response":{"status":"in_progress"}}\n\n',
                  b'data: {"type":"response.completed","response":{"status":"completed"}}']
        for body in bodies:
            response = self.streamed_response([])
            response.iter_content.return_value = [body]
            with self.subTest(body=body), patch("asset_providers.requests.post") as post:
                post.return_value.__enter__.return_value = response
                with self.assertRaisesRegex(ValueError, "stream"):
                    provider.analyzeGarment(self.drawing())

    def test_astra_stream_rejects_incomplete_and_redacts_errors(self):
        provider = self.astra()
        secret_error = {"message": "fixture-secret https://example.test/private data:image/png;base64,private"}
        cases = [({"type": "response.incomplete", "response": {"status": "incomplete"}}, "did not complete"),
                 ({"type": "response.failed", "response": {"status": "failed", "error": secret_error}}, "redacted"),
                 ({"type": "error", **secret_error}, "redacted")]
        for event, message in cases:
            with self.subTest(event_type=event["type"]), patch("asset_providers.requests.post") as post:
                post.return_value.__enter__.return_value = self.streamed_response([event])
                with self.assertRaisesRegex(ValueError, message) as caught:
                    provider.analyzeGarment(self.drawing())
                for private in ("fixture-secret", "https://example.test", "base64,private"):
                    self.assertNotIn(private, str(caught.exception))

    def test_astra_stream_limits_size_and_closes_connection(self):
        provider = self.astra()
        response = self.streamed_response([])
        response.iter_content.return_value = [b"x" * (24 * 1024 * 1024 + 1)]
        with patch("asset_providers.requests.post") as post:
            post.return_value.__enter__.return_value = response
            with self.assertRaisesRegex(ValueError, "exceeds 24 MB"):
                provider.transport.post("/openai/v1/responses", "Astra analysis", json={"stream": True})
            post.return_value.__exit__.assert_called_once()

    def test_astra_stream_accepts_json_fallback_and_rejects_http_errors(self):
        provider = self.astra()
        terminal = self.response("complete")
        for status, payload in ((200, terminal), (429, {"error": {"message": "Retry later"}})):
            response = Mock(status_code=status, headers={"Content-Type": "application/json"})
            response.iter_content.return_value = [json.dumps(payload).encode()]
            with self.subTest(status=status), patch("asset_providers.requests.post") as post:
                post.return_value.__enter__.return_value = response
                if status == 200:
                    self.assertEqual(provider.transport.post("/openai/v1/responses", "Astra analysis", json={"stream": True}), terminal)
                else:
                    with self.assertRaisesRegex(ValueError, "HTTP 429.*Retry later"):
                        provider.transport.post("/openai/v1/responses", "Astra analysis", json={"stream": True})

    def test_astra_stream_does_not_retry_interrupted_requests(self):
        import requests
        provider = self.astra()
        for failure in (requests.ConnectTimeout(), requests.ReadTimeout(), requests.ConnectionError()):
            response = self.streamed_response([])
            response.iter_content.side_effect = failure
            with self.subTest(failure=type(failure).__name__), patch("asset_providers.requests.post") as post:
                post.return_value.__enter__.return_value = response
                with self.assertRaises(ValueError):
                    provider.transport.post("/openai/v1/responses", "Astra analysis", json={"stream": True})
                post.assert_called_once()
                post.return_value.__exit__.assert_called_once()

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

    def test_wide_sleeve_fits_canvas(self):
        image = Image.new("RGB", (1024, 512), "white")
        pen = ImageDraw.Draw(image)
        pen.polygon([(180, 150), (900, 100), (900, 400), (180, 350)], outline="black", width=3)
        pen.line((205, 150, 205, 350), fill="black", width=3)
        pen.line((220, 148, 220, 352), fill="black", width=3)
        for fit, side in ((fit, side) for fit in ("slim", "regular", "boxy", "oversized") for side in ("left", "right")):
            captured = []

            def capture(fabric, ink):
                captured.append((fabric.copy(), ink.copy()))
                return profiles.tracer.wrap_svg("test", "M10 10 L20 20 Z", "")

            with self.subTest(fit=fit, side=side), patch.object(profiles, "traced", side_effect=capture), patch.object(profiles.tracer, "trace", return_value="M10 10 L20 20 Z"):
                result = profiles.SleeveRegistrationProfile().register(image, {"garmentType": "tshirt", "fit": fit, "side": side, "view": "front"})
                self.assertEqual(result["registration"]["status"], "Exact registration")
                fabric, ink = captured[0]
                if side == "right":
                    fabric, ink = np.fliplr(fabric), np.fliplr(ink)
                self.assertFalse(fabric[:3].any() or fabric[-3:].any() or fabric[:, :3].any() or fabric[:, -3:].any())
                for horizontal, vertical in result["registration"]["anchors"]["target"]:
                    if side == "right":
                        horizontal = fabric.shape[1] - 1 - horizontal
                    self.assertTrue(fabric[vertical, horizontal], "Armhole endpoints must remain attached")
                self.assertGreater(np.where(fabric)[0].max(), result["registration"]["anchors"]["target"][1][1] + 100)
                interior = profiles.ndimage.binary_erosion(fabric, iterations=5)
                self.assertGreater((ink & interior).sum(), 100, "Cuff construction must survive placement")
                cuff_rows, cuff_columns = np.where(ink & interior)
                self.assertGreater(np.ptp(cuff_columns), np.ptp(cuff_rows), "Lowered cuff must turn across the sleeve, not collapse into a diagonal tip")
            if fit == "boxy" and captured:
                executable = profiles.ROOT / ".venv/tools/potrace-1.16.win64/potrace.exe"
                environment = {"POTRACE": str(executable)} if executable.exists() else {}
                with patch.dict(os.environ, environment):
                    svg = profiles.traced(*captured[0])
                profiles.validate_svg(svg)
                profiles.validate_render(svg)

    def test_overlong_sleeve_is_not_clipped(self):
        image = Image.new("RGB", (1024, 512), "white")
        ImageDraw.Draw(image).rectangle((100, 180, 900, 300), outline="black", width=3)
        with patch.object(profiles, "traced") as trace:
            with self.assertRaisesRegex(ValueError, "cannot fit.*retaining its length"):
                profiles.SleeveRegistrationProfile().register_exact(image, {"garmentType": "tshirt", "fit": "boxy", "side": "left", "view": "front"})
            trace.assert_not_called()

    def test_overlong_sleeve_adaptive_preview(self):
        image = Image.new("RGB", (1024, 512), "white")
        pen = ImageDraw.Draw(image)
        pen.rectangle((100, 180, 900, 300), outline="black", width=3)
        pen.line((120, 180, 120, 300), fill="black", width=3)
        captured = []
        def capture(fabric, ink):
            captured.append((fabric.copy(), ink.copy()))
            return profiles.tracer.wrap_svg("test", "M10 10 L20 20 Z", "")
        with patch.object(profiles, "traced", side_effect=capture), patch.object(profiles.tracer, "trace", return_value="M10 10 L20 20 Z"):
            result = profiles.SleeveRegistrationProfile().register(image, {"garmentType": "tshirt", "fit": "boxy", "side": "left", "view": "front"})
        self.assertIn(result["registration"]["status"], ("Adaptive registration", "Needs review"))
        fabric, ink = captured[0]
        self.assertFalse(fabric[:4].any() or fabric[-4:].any() or fabric[:, :4].any() or fabric[:, -4:].any())
        self.assertEqual(profiles.ndimage.label(fabric, structure=np.ones((3, 3)))[1], 1)
        for horizontal, vertical in result["registration"]["anchors"]["target"]:
            self.assertTrue(fabric[vertical, horizontal])
        self.assertGreater((ink & profiles.ndimage.binary_erosion(fabric, iterations=5)).sum(), 100)

    def test_sleeve_adapter_shapes_and_mirroring(self):
        catalog = profiles.raster_catalog

        def symmetric_catalog(category, name):
            if category.startswith("Right"):
                return np.fliplr(catalog(category.replace("Right", "Left"), name.replace("Right", "Left")))
            if category == "Body":
                body = catalog(category, name).copy()
                body[:, body.shape[1] // 2:] = np.fliplr(body[:, :body.shape[1] // 2])
                return body
            return catalog(category, name)

        shapes = {
            "very-wide": [(80, 130), (900, 130), (900, 370), (80, 370)],
            "narrow-long": [(220, 180), (900, 180), (900, 300), (220, 300)],
            "angled": [(100, 100), (240, 100), (740, 180), (900, 180), (900, 300), (740, 300), (240, 220), (100, 220)],
        }
        for name, points in shapes.items():
            image = Image.new("RGB", (1024, 512), "white")
            pen = ImageDraw.Draw(image)
            pen.polygon(points, outline="black", width=3)
            pen.line((points[0][0] + 15, points[0][1], points[-1][0] + 15, points[-1][1]), fill="black", width=3)
            captured = []
            def capture(fabric, ink):
                captured.append((fabric.copy(), ink.copy()))
                return profiles.tracer.wrap_svg("test", "M10 10 L20 20 Z", "")
            with self.subTest(shape=name), patch.object(profiles, "raster_catalog", side_effect=symmetric_catalog), patch.object(profiles, "traced", side_effect=capture), patch.object(profiles.tracer, "trace", return_value="M10 10 L20 20 Z"):
                for side in ("left", "right"):
                    result = profiles.SleeveRegistrationProfile().register_adaptive(image, {"garmentType": "tshirt", "fit": "boxy", "side": side, "view": "front"})
                    registration = result["registration"]
                    self.assertIn(registration["status"], ("Adaptive registration", "Needs review"))
                    self.assertEqual(registration["adaptation"]["capFraction"], .2)
                    self.assertGreaterEqual(registration["adaptation"]["scaleReduction"], registration["adaptation"]["minimumScaleReduction"])
                    self.assertFalse(registration["adaptation"]["bodyArmholeAdjusted"])
                    fabric, ink = captured[-1]
                    self.assertEqual(profiles.ndimage.label(fabric, structure=np.ones((3, 3)))[1], 1)
                    self.assertFalse(fabric[:4].any() or fabric[-4:].any() or fabric[:, :4].any() or fabric[:, -4:].any())
                    self.assertGreater((ink & profiles.ndimage.binary_erosion(fabric, iterations=5)).sum(), 60)
                    for horizontal, vertical in registration["anchors"]["target"]:
                        self.assertTrue(fabric[vertical, horizontal])
                self.assertTrue(np.array_equal(captured[0][0], np.fliplr(captured[1][0])))
                self.assertTrue(np.array_equal(captured[0][1], np.fliplr(captured[1][1])))

    def test_sleeve_fallback_only_handles_canvas_failure(self):
        profile = profiles.SleeveRegistrationProfile()
        request = {"garmentType": "tshirt", "fit": "boxy", "side": "left", "view": "front"}
        for message in ("Armhole connection failed", "Trace is empty", "Could not identify sleeve boundary"):
            with self.subTest(error=message), patch.object(profile, "register_exact", side_effect=ValueError(message)), patch.object(profile, "register_adaptive") as fallback:
                with self.assertRaisesRegex(ValueError, message):
                    profile.register(self.drawing(), request)
                fallback.assert_not_called()
        exact = {"svg": "unchanged", "registration": {"defaultTransform": profiles.IDENTITY}}
        with patch.object(profile, "register_exact", return_value=exact), patch.object(profile, "register_adaptive") as fallback:
            self.assertIs(profile.register(self.drawing(), request), exact)
            self.assertEqual(exact["svg"], "unchanged")
            fallback.assert_not_called()

    def test_sleeve_adapter_rejects_excessive_shrinkage(self):
        image = Image.new("RGB", (1024, 512), "white")
        ImageDraw.Draw(image).rectangle((30, 180, 990, 240), outline="black", width=3)
        with patch.object(profiles, "traced") as trace:
            with self.assertRaisesRegex(ValueError, "Rejected:.*excessive shrinkage"):
                profiles.SleeveRegistrationProfile().register(image, {"garmentType": "tshirt", "fit": "boxy", "side": "left", "view": "front"})
            trace.assert_not_called()

    def test_sleeve_adapter_rigid_body(self):
        fabric = np.zeros((320, 900), dtype=bool)
        fabric[100:221, 50:801] = True
        ink = np.zeros_like(fabric)
        ink[100:221, 70:74] = True
        cap_start = 650
        target = np.array([[200., 500.], [500., 540.]])
        parameters = np.array([0., 1.])
        center = np.array([520., 360.])
        direction, across = np.array([1., 0.]), np.array([0., 1.])
        bounds = np.array([[200., 280.], [1300., 540.]])
        output, output_ink, rigid = profiles.SleeveRegistrationProfile.render_adapter(
            fabric, ink, (1536, 1536), cap_start, 100, 220, target, parameters, center, direction, across, 1.25, bounds)
        rows, columns = np.where(rigid)
        self.assertAlmostEqual(float(np.ptp(rows)), (650 - 50) * 1.25, delta=2)
        self.assertAlmostEqual(float(np.ptp(columns)), 120 * 1.25, delta=2)
        self.assertAlmostEqual(float(rigid.sum()), fabric[:, :651].sum() * 1.25 ** 2, delta=1000)
        seam_rows, seam_columns = np.where(output_ink & rigid)
        self.assertLessEqual(np.ptp(seam_rows), 5)
        self.assertGreaterEqual(np.ptp(seam_columns), 149)
        self.assertEqual(profiles.ndimage.label(output, structure=np.ones((3, 3)))[1], 1)

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
                    (image.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if category == "sleeve" and side == "right" else image).save(image_path)
                    request = {"category": category, "contextCategory": category, "garmentType": garment, "fit": fit, "view": "front", "side": side, "source": "drawing", "crop": [0, 0, 1, 1]}
                    with contextlib.redirect_stdout(io.StringIO()), patch("lineart._gemini_once", side_effect=AssertionError("No inference for technical drawings")):
                        result = pipeline.process(str(image_path), request)
                        if category == "sleeve" and result.get("isolationPending"):
                            result = pipeline.process(str(image_path), {**request, "resumeIsolation": True, "confirmIsolation": True})
                    self.assertEqual(result["validation"]["status"], "passed")
                    if category == "collar":
                        self.assertIn("drawing-fidelity", result["validation"]["checks"])
                    self.assertEqual(result["provenance"], "front")
                    self.assertTrue(result["cleanDrawing"].startswith("data:image/png;base64,"))
                    self.assertTrue(f'fill="{profiles.tracer.INK_COLOR}"' in result["svg"], "Missing tintable ink group")
                    self.assertTrue('fill="#000000"' in result["svg"], "Missing tintable fabric group")


if __name__ == "__main__":
    unittest.main()