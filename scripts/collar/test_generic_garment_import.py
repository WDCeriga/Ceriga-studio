"""Offline import regressions: synthetic references and mocked Azure responses, real SVG tracing."""

import base64
import contextlib
import copy
import io
import json
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

from asset_providers import AstraProvider
from garment_from_photo import reconstruct, trace_reconstruction
from garment_manifest import detail_ink, outline_mask, segment_drawing, validate_manifest
import test_custom_assets


def garment_fixture(kind, material, view="front"):
    manifest = test_custom_assets.CustomAssetsTests().garment_manifest_fixture()
    manifest.update(garmentType=kind, material=material, subtype=kind, view=view,
                    construction="Synthetic construction fixture", materialEvidence=f"Fixture fabric: {material}")
    if kind != "shorts":
        parts = [
            ("body", "body", "fabric-colour", [.3, .3, .7, .9]),
            ("left-sleeve", "sleeve", "sleeves", [.1, .3, .3, .5]),
            ("right-sleeve", "sleeve", "sleeves", [.7, .3, .9, .5]),
            ("neckband", "neckband", "neck-hood", [.4, .25, .6, .3]),
        ]
        if kind == "hoodie":
            parts += [("hood", "hood", "neck-hood", [.35, .05, .65, .25]),
                      ("cuff", "cuff", "hem-cuffs", [.05, .3, .1, .5]),
                      ("pocket", "pocket", "pockets-zips", [.4, .6, .6, .75])]
        template = manifest["regions"][0]
        manifest["regions"] = []
        for identifier, semantic, category, bounds in parts:
            left, top, right, bottom = bounds
            region = copy.deepcopy(template)
            region.update(id=identifier, name=identifier, semanticType=semantic, builderCategory=category,
                          structuralRole=semantic, measurementRole=semantic, userFacingName=identifier,
                          attachmentTo=None if identifier == "body" else "body", bounds=bounds,
                          seed=[(left + right) / 2, (top + bottom) / 2],
                          outline=[[left, top], [right, top], [right, bottom], [left, bottom]])
            manifest["regions"].append(region)
    for region in manifest["regions"]:
        region["material"] = material
        region["visibleEdges"] = [{"id": "finished-edge", "points": region["outline"][:2],
                                   "boundaryType": "hem-edge", "style": "solid", "confidence": .95,
                                   "evidence": "Synthetic finished edge"}]
    return manifest


def response(manifest):
    return {"status": "completed", "output": [{"type": "message", "content": [
        {"type": "output_text", "text": json.dumps(manifest)}]}]}


def provider_fixture():
    return AstraProvider({"CERIGA_AZURE_API_KEY": "test", "CERIGA_AZURE_ENDPOINT": "https://example.test",
                          "CERIGA_AZURE_REASONING_DEPLOYMENT": "astra", "CERIGA_AZURE_IMAGE_DEPLOYMENT": "image"})


class GenericGarmentImportTests(unittest.TestCase):
    def test_classified_garments_do_not_require_denim(self):
        for kind in ("tshirt", "long-sleeve-top", "hoodie", "sweatshirt", "shorts", "trousers", "jeans",
                     "jacket", "vest", "skirt", "dress", "other", "jumpsuit"):
            for material in ("cotton", "fleece", "unknown"):
                with self.subTest(kind=kind, material=material):
                    manifest = garment_fixture(kind, material)
                    result = validate_manifest(manifest)
                    self.assertEqual(result["garmentType"], kind)
                    self.assertEqual(result["material"], material)

    def test_generic_reconstruction(self):
        for kind, material in (("shorts", "denim"), ("shorts", "cotton"), ("tshirt", "cotton"), ("hoodie", "fleece"), ("jacket", "woven")):
            for view in ("front", "back"):
                with self.subTest(kind=kind, material=material, view=view):
                    manifest = garment_fixture(kind, material, view)
                    image = Image.new("RGB", (200, 200), "white")
                    pen = ImageDraw.Draw(image)
                    for region in manifest["regions"]:
                        pen.polygon([(round(x * 199), round(y * 199)) for x, y in region["outline"]], outline="black", width=2)
                    buffer = io.BytesIO()
                    image.save(buffer, format="PNG")
                    provider = provider_fixture()
                    with patch("asset_providers.AstraProvider", return_value=provider), \
                         patch.object(provider.transport, "post", return_value=response(manifest)) as post, \
                         contextlib.redirect_stdout(io.StringIO()):
                        result = reconstruct(buffer.getvalue())
                    self.assertTrue(result["ok"])
                    self.assertEqual(result["source"], "azure-garment-reconstruction-v1")
                    self.assertEqual(result["manifest"]["garmentType"], kind)
                    self.assertEqual(result["manifest"]["material"], material)
                    self.assertEqual(result["manifest"]["view"], view)
                    self.assertEqual({part["id"] for part in result["parts"]}, {region["id"] for region in manifest["regions"]})
                    from garment_source_geometry import frame_source
                    _, aligned = frame_source(image, manifest)
                    by_id = {region["id"]: region for region in aligned["regions"]}
                    for part in result["parts"]:
                        self.assertEqual(part["view"], view)
                        original = outline_mask(by_id[part["id"]], (512, 512))
                        cleaned = outline_mask(part, (512, 512))
                        # Narrow cuffs move with balanced sleeves, affecting overlap more than bodies.
                        minimum_overlap = .85 if part["semanticType"] == "cuff" else .9
                        self.assertGreater((original & cleaned).sum() / (original | cleaned).sum(), minimum_overlap)
                        source = next(region for region in manifest["regions"] if region["id"] == part["id"])
                        retained = next(region for region in result["sourceManifest"]["regions"] if region["id"] == part["id"])
                        self.assertEqual(retained["outline"], source["outline"])
                        self.assertEqual(part["color"], "#f4f3ef")
                        self.assertEqual(part["builderCategory"], by_id[part["id"]]["builderCategory"])
                        self.assertIn("<path", part["svg"])
                        self.assertEqual(part["measurement"]["unit"], "relative")
                    self.assertTrue(result["detailLayers"])
                    for detail in result["detailLayers"]:
                        self.assertEqual(detail["userFacingName"], by_id[detail["partId"]]["userFacingName"])
                        self.assertEqual(detail["view"], view)
                    self.assertEqual(post.call_count, 1, "Source tracing must not call image generation or redraw registration")
                    analysis_prompt = post.call_args_list[0].kwargs["json"]["input"][0]["content"][0]["text"]
                    self.assertIn("hoodie", analysis_prompt)
                    self.assertIn("sleeve/cuff/collar", analysis_prompt)
                    self.assertIn("independently colorable regions", analysis_prompt)
                    self.assertIn("identical fabric and colour", analysis_prompt)
                    self.assertIn("never a guessed strip width", analysis_prompt)
                    self.assertIn("never link all same-material regions together", analysis_prompt)
                    self.assertNotIn("Main fabric pieces share colourGroup main-body", analysis_prompt)
                    self.assertNotIn("shorts or unknown", analysis_prompt)
                    self.assertIn("SOURCE-LOCKED TRACING", analysis_prompt)
                    self.assertIn("visible-inner-back", analysis_prompt)
                    self.assertIn("fabric visible behind that scoop is NOT empty background", analysis_prompt)

    def test_mocked_multi_family_construction_edges_survive_analysis_and_registration(self):
        """Authored responses test the contract, not live recognition of these garments."""
        cases = (
            ("vest", (
                ("left-strap-join", "seam", "solid", [[.32, .12], [.32, .18]], "Left binding-to-clasp sewn join"),
                ("right-strap-join", "seam", "solid", [[.68, .13], [.68, .19]], "Right binding-to-clasp sewn join"),
                ("bound-armhole", "hem-edge", "solid", [[.3, .2], [.28, .3], [.22, .4]], "Finished armhole binding lip"),
            )),
            ("hoodie", (
                ("shoulder-join", "seam", "solid", [[.35, .2], [.22, .26]], "Sewn shoulder attachment"),
                ("cuff-join", "seam", "solid", [[.12, .65], [.22, .67]], "Sleeve-to-cuff seam"),
                ("pocket-opening", "pocket-edge", "solid", [[.35, .5], [.3, .65]], "Visible kangaroo pocket lip"),
            )),
            ("trousers", (
                ("waistband-join", "waistband-edge", "solid", [[.25, .2], [.5, .22], [.75, .2]], "Waistband attachment seam"),
                ("fly-edge", "fly-edge", "solid", [[.5, .22], [.52, .3], [.49, .36]], "Finished fly overlap"),
                ("leg-hem-stitch", "hem-edge", "stitch", [[.25, .85], [.42, .86]], "Visible folded leg hem stitching"),
            )),
            ("jacket", (
                ("yoke-join", "seam", "solid", [[.25, .3], [.5, .33], [.75, .3]], "Sewn yoke panel join"),
                ("placket-edge", "panel-edge", "solid", [[.53, .2], [.53, .8]], "Finished fastening placket lip"),
                ("pocket-flap", "pocket-edge", "solid", [[.6, .4], [.72, .4], [.72, .44]], "Visible flap edge up to occlusion"),
            )),
            ("dress", (
                ("waist-join", "seam", "solid", [[.3, .45], [.5, .46], [.7, .45]], "Bodice-to-skirt sewn join"),
                ("skirt-panel-join", "seam", "solid", [[.4, .46], [.33, .86]], "Visible skirt panel seam"),
                ("lower-hem", "hem-edge", "stitch", [[.2, .87], [.5, .9], [.8, .87]], "Folded lower hem stitch row"),
            )),
        )
        for kind, edges in cases:
            with self.subTest(kind=kind):
                manifest = garment_fixture(kind, "cotton")
                # A continuous parent can own observed seams without guessed closed panel cuts.
                parent = copy.deepcopy(manifest["regions"][0])
                parent.update(id="body", name="Visible fabric", semanticType="body", structuralRole="body",
                              bounds=[.05, .05, .95, .95], seed=[.5, .7], attachmentTo=None,
                              outline=[[.05, .05], [.95, .05], [.95, .95], [.05, .95]],
                              visibleEdges=[dict(id=identifier, boundaryType=boundary, style=style,
                                                 points=points, evidence=evidence, confidence=.92)
                                            for identifier, boundary, style, points, evidence in edges])
                manifest.update(regions=[parent], construction="; ".join(edge[-1] for edge in edges),
                                uncertainties=["Hidden seam continuations and full panel extents are unresolved"])
                provider = provider_fixture()
                image = Image.new("RGB", (100, 100), "white")
                with patch.object(provider.transport, "post", return_value=response(manifest)) as post, \
                     patch.object(provider.raster, "generateWholeGarmentRaster") as raster:
                    source = provider.analyzeGarment(image)
                    self.assertEqual(post.call_count, 1)
                    self.assertEqual(source["regions"][0]["visibleEdges"], parent["visibleEdges"])
                    mapped = copy.deepcopy(source)
                    for edge in mapped["regions"][0]["visibleEdges"]:
                        edge.update(points=[[x + .01, y] for x, y in edge["points"]],
                                    evidence="Redraw-only claim", confidence=.99)
                    post.return_value = response(mapped)
                    registered = provider.analyzeGarment(image, source_manifest=source)
                    self.assertEqual(post.call_count, 2)
                    raster.assert_not_called()
                self.assertEqual(registered["construction"], source["construction"])
                self.assertEqual(registered["uncertainties"], source["uncertainties"])
                for observed, geometry, actual in zip(source["regions"][0]["visibleEdges"],
                                                     mapped["regions"][0]["visibleEdges"],
                                                     registered["regions"][0]["visibleEdges"]):
                    self.assertEqual(actual, {**observed, "points": geometry["points"]})
                mapped["regions"][0]["visibleEdges"].pop(0)
                with patch.object(provider.transport, "post", return_value=response(mapped)), \
                     self.assertRaisesRegex(ValueError, "detail identities"):
                    provider.analyzeGarment(image, source_manifest=source)

    def test_whole_garment_prompts_exclude_surface_artwork(self):
        provider = provider_fixture()
        manifest = garment_fixture("trousers", "cotton")
        image = Image.new("RGB", (200, 200), "white")
        with patch.object(provider.transport, "post", return_value=response(manifest)) as post:
            source = provider.analyzeGarment(image)
            provider.analyzeGarment(image, source_manifest=source)
        with patch.object(provider.raster, "generateRaster", return_value=image) as generate:
            provider.raster.generateWholeGarmentRaster(image, source, lambda label: None)
        prompts = [call.kwargs["json"]["input"][0]["content"][0]["text"] for call in post.call_args_list]
        prompts.append(generate.call_args.args[1])
        for prompt in prompts:
            with self.subTest(stage=prompt[:40]):
                self.assertIn("CONSTRUCTION ONLY", prompt)
                self.assertIn("logos", prompt)
                self.assertIn("printed", prompt)
                self.assertIn("embroidery artwork", prompt)
                self.assertIn("blank fabric", prompt)
                for requirement in ("physical labels", "cropped", "tank", "strap", "scoop", "armhole",
                                    "far-side", "functional hardware", "cutouts", "semanticType panel",
                                    "structuralRole hardware or buckle", "shoulder-strap or armhole-binding"):
                    self.assertIn(requirement, prompt)

    def test_surface_artwork_is_not_construction_ink(self):
        manifest = garment_fixture("trousers", "cotton")
        body = manifest["regions"][0]
        body.update(bounds=[.1, .1, .9, .9], outline=[[.1, .1], [.9, .1], [.9, .9], [.1, .9]],
                    visibleEdges=[{"id": "hem-thread", "points": [[.15, .85], [.85, .85]],
                                   "boundaryType": "hem-edge", "style": "stitch", "confidence": .95,
                                   "evidence": "Sewn hem stitching"}])
        regions = [body]
        for identifier, semantic, bounds in (("graphic", "decoration", [.2, .2, .4, .4]),
                                             ("label", "label", [.5, .2, .7, .4]),
                                             ("button", "button", [.5, .5, .7, .7])):
            left, top, right, bottom = bounds
            region = copy.deepcopy(body)
            region.update(id=identifier, name=identifier, semanticType=semantic, structural=False,
                          layerKind="detail", attachmentTo="body", bounds=bounds,
                          outline=[[left, top], [right, top], [right, bottom], [left, bottom]],
                          seed=[(left + right) / 2, (top + bottom) / 2], visibleEdges=[])
            if semantic == "decoration":
                region["visibleEdges"] = [{"id": "printed-line", "points": [[.2, .3], [.4, .3]],
                    "boundaryType": "panel-edge", "style": "solid", "confidence": .99,
                    "evidence": "Printed motif, not a sewn panel"}]
            if semantic == "button":
                region["visibleEdges"] = [{"id": "button-thread", "points": [[.55, .6], [.65, .6]],
                    "boundaryType": "hardware-edge", "style": "solid", "confidence": .95,
                    "evidence": "Visible button attachment thread"}]
            regions.append(region)
        manifest["regions"] = regions
        manifest = validate_manifest(manifest)
        clean = Image.new("RGB", (200, 200), "white")
        printed = clean.copy()
        pen = ImageDraw.Draw(printed)
        for box in ((45, 45, 70, 70), (105, 45, 130, 70), (105, 105, 130, 110)):
            pen.rectangle(box, fill="black")
        pen.line((42, 41, 46, 41), fill="black")
        masks, contours, stitches, notes = segment_drawing(printed, manifest)
        baseline = segment_drawing(clean, manifest)
        self.assertFalse(masks[1].any(), "A printed motif must not become a garment piece")
        self.assertFalse(contours[38:82, 38:82].any(), "Printed outlines and edges must be absent")
        self.assertFalse(stitches[38:82, 38:82].any(), "Print fragments must not become stitching")
        self.assertFalse(contours[45:71, 105:131].any(), "Keep label shape, not its lettering")
        self.assertFalse(contours[105:111, 105:131].any(), "Hardware branding is not construction")
        self.assertTrue(contours[119:121, 109:130].any(), "Keep evidenced button attachment thread")
        self.assertFalse(masks[2].any(), "Physical labels must not become blank pieces")
        self.assertFalse(contours[38:82, 98:142].any(), "Remove the entire physical label")
        self.assertTrue(stitches[168:171, 30:170].any(), "Keep evidenced hem stitching")
        self.assertTrue(np.array_equal(contours, baseline[1]))
        self.assertTrue(np.array_equal(stitches, baseline[2]))
        self.assertTrue(all(np.array_equal(a, b) for a, b in zip(masks, baseline[0])))
        self.assertTrue(any("decoration" in note for note in notes))
        self.assertFalse(any(layer.any() for layer in detail_ink(manifest["regions"][1], printed.size)))
        buffer = io.BytesIO()
        printed.save(buffer, format="PNG")
        with contextlib.redirect_stdout(io.StringIO()):
            result = trace_reconstruction(printed, buffer.getvalue(), manifest, printed, manifest)
            clean_result = trace_reconstruction(printed, buffer.getvalue(), manifest, clean, manifest)
        self.assertEqual({part["id"] for part in result["parts"]}, {"body", "button"})
        self.assertNotIn("label", {detail["partId"] for detail in result["detailLayers"]})
        self.assertNotIn("graphic", {detail["partId"] for detail in result["detailLayers"]})
        self.assertEqual(result["detailLayers"], clean_result["detailLayers"])
        self.assertEqual(result["lineArtSvg"], clean_result["lineArtSvg"])
        for part, original in zip(result["parts"], clean_result["parts"]):
            for key in ("svg", "constructionSvg", "stitchSvg", "outline"):
                self.assertEqual(part[key], original[key])

    def hardware_fixture(self):
        manifest = garment_fixture("cropped-tank", "cotton")
        body = manifest["regions"][0]
        hardware = copy.deepcopy(body)
        hardware.update(id="shoulder-fastener", name="Shoulder fastener", semanticType="panel",
                        structuralRole="buckle", material="metal", structural=False, layerKind="detail", attachmentTo="body",
                        bounds=[.35, .35, .65, .65], seed=[.37, .37],
                        outline=[[.35, .35], [.65, .35], [.65, .65], [.35, .65]],
                        boundary={"boundaryType": "hardware-edge", "confidence": .95,
                                  "evidence": "Visible metal fastener perimeter"},
                        cutouts=[{"id": "slot", "outline": [[.43, .43], [.57, .43], [.57, .57], [.43, .57]],
                                  "confidence": .95, "evidence": "Visible open slot inside metal frame"}],
                        visibleEdges=[])
        manifest["regions"] = [body, hardware]
        return manifest

    def test_invalid_source_hardware_reanalyzes_once_with_validation_feedback(self):
        from garment_source_geometry import SourceGeometryError

        corrected = self.hardware_fixture()
        invalid = copy.deepcopy(corrected)
        invalid["regions"][1].update(structural=True, layerKind="structural")
        image = Image.new("RGB", (100, 100), "white")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        provider = provider_fixture()
        expected = {"ok": True}
        for second_response, succeeds in ((corrected, True), (invalid, False)):
            with self.subTest(succeeds=succeeds), \
                 patch("asset_providers.AstraProvider", return_value=provider), \
                 patch.object(provider.transport, "post", side_effect=[response(invalid), response(second_response)]) as post, \
                 patch.object(provider.raster, "generateWholeGarmentRaster") as raster, \
                 patch("garment_technical_flat.supports_technical_flat", return_value=False), \
                 patch("garment_source_geometry.segment_source", return_value=(image, corrected, ())) as segment, \
                 patch("garment_from_photo.trace_reconstruction", return_value=expected) as trace, \
                 contextlib.redirect_stdout(io.StringIO()):
                if succeeds:
                    self.assertEqual(reconstruct(buffer.getvalue()), expected)
                    segment.assert_called_once()
                    trace.assert_called_once()
                    self.assertFalse(trace.call_args.args[2]["regions"][1]["structural"])
                else:
                    with self.assertRaisesRegex(SourceGeometryError, "Hardware is a detail layer"):
                        reconstruct(buffer.getvalue())
                    segment.assert_not_called()
                    trace.assert_not_called()
                self.assertEqual(post.call_count, 2, "Only one corrective source reanalysis is allowed")
                raster.assert_not_called()
                first, second = [call.kwargs["json"]["input"][0]["content"] for call in post.call_args_list]
                self.assertEqual(first[1], second[1], "Reanalysis must use the same original image")
                self.assertIn("Reinspect the ORIGINAL photo", second[0]["text"])
                self.assertIn("Hardware is a detail layer, never a structural fabric polygon.", second[0]["text"])

    def test_source_transport_and_json_failures_are_not_reanalyzed(self):
        from garment_source_geometry import SourceGeometryError

        image = Image.new("RGB", (100, 100), "white")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        malformed = response(self.hardware_fixture())
        malformed["output"][0]["content"][0]["text"] = "{broken json"
        for outcome in (TimeoutError("Transport timeout"), ValueError("Transport response failure"), malformed):
            provider = provider_fixture()
            with self.subTest(outcome=type(outcome).__name__), \
                 patch("asset_providers.AstraProvider", return_value=provider), \
                 patch.object(provider.transport, "post", side_effect=[outcome]) as post, \
                 patch("garment_from_photo.trace_reconstruction") as trace, \
                 contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises((TimeoutError, ValueError)) as raised:
                    reconstruct(buffer.getvalue())
                self.assertNotIsInstance(raised.exception, SourceGeometryError)
                if isinstance(outcome, Exception):
                    self.assertIs(raised.exception, outcome)
                else:
                    self.assertIn("invalid garment JSON", str(raised.exception))
                post.assert_called_once()
                trace.assert_not_called()

    def test_invalid_registration_hardware_remains_non_geometry_error(self):
        from garment_source_geometry import SourceGeometryError

        source = self.hardware_fixture()
        invalid = copy.deepcopy(source)
        invalid["regions"][1].update(structural=True, layerKind="structural")
        provider = provider_fixture()
        with patch.object(provider.transport, "post", return_value=response(invalid)) as post:
            with self.assertRaisesRegex(ValueError, "Hardware is a detail layer") as raised:
                provider.analyzeGarment(Image.new("RGB", (100, 100)), source_manifest=source)
            self.assertNotIsInstance(raised.exception, SourceGeometryError)
            post.assert_called_once()

    def test_hardware_cutouts_are_traced_not_filled_or_inferred_from_pixels(self):
        manifest = validate_manifest(self.hardware_fixture())
        clean = Image.new("RGB", (200, 200), "white")
        dirty = clean.copy()
        pen = ImageDraw.Draw(dirty)
        pen.rectangle((90, 90, 110, 110), fill="black")
        pen.line((70, 62, 75, 62), fill="black")  # Artwork beside a real body boundary.
        masks, contours, stitches, _ = segment_drawing(dirty, manifest)
        self.assertTrue(masks[1][75, 75])
        self.assertFalse(masks[1][100, 100], "A mechanical slot must be transparent")
        self.assertTrue(masks[0][100, 100], "Do not cut the continuous fabric below hardware")
        self.assertTrue(contours[85:88, 95:105].any(), "Retain the inside metal edge")
        baseline = segment_drawing(clean, manifest)
        self.assertTrue(np.array_equal(contours, baseline[1]))
        self.assertTrue(np.array_equal(stitches, baseline[2]), "Do not copy raster marks near seams")
        with contextlib.redirect_stdout(io.StringIO()):
            result = trace_reconstruction(dirty, b"synthetic", manifest, dirty, manifest)
            filled = copy.deepcopy(manifest)
            filled["regions"][1]["cutouts"] = []
            solid = trace_reconstruction(clean, b"synthetic", filled, clean, filled)
        self.assertIn('fill-rule="evenodd"', result["parts"][1]["svg"])
        self.assertLess(result["parts"][1]["area"], solid["parts"][1]["area"])
        self.assertNotEqual(result["parts"][1]["svg"], solid["parts"][1]["svg"])
        import resvg_py
        rendered = Image.open(io.BytesIO(resvg_py.svg_to_bytes(
            svg_string=result["parts"][1]["svg"], width=200, height=200))).convert("RGBA")
        self.assertEqual(rendered.getpixel((100, 100))[3], 0, "Real traced slot must render transparent")
        self.assertGreater(rendered.getpixel((75, 75))[3], 0, "Metal frame must remain filled")

    def test_registration_preserves_cutout_identity_and_source_evidence(self):
        source = self.hardware_fixture()
        mapped = copy.deepcopy(source)
        mapped["regions"][1]["cutouts"][0].update(confidence=.99, evidence="Generated guess",
            outline=[[.44, .44], [.56, .44], [.56, .56], [.44, .56]])
        source["regions"][1]["cutouts"][0]["confidence"] = .7
        provider = provider_fixture()
        with patch.object(provider.transport, "post", return_value=response(mapped)):
            result = provider.analyzeGarment(Image.new("RGB", (200, 200), "white"), source_manifest=source)
        cutout = result["regions"][1]["cutouts"][0]
        self.assertEqual(cutout["confidence"], .7)
        self.assertEqual(cutout["evidence"], source["regions"][1]["cutouts"][0]["evidence"])
        self.assertEqual(cutout["outline"], mapped["regions"][1]["cutouts"][0]["outline"])
        masks, _, _, notes = segment_drawing(Image.new("RGB", (200, 200), "white"), result)
        self.assertFalse(masks[1].any(), "Uncertain openings must not become solid metal")
        self.assertTrue(any("opening" in note for note in notes))
        mapped["regions"][1]["cutouts"] = []
        with patch.object(provider.transport, "post", return_value=response(mapped)), \
             self.assertRaisesRegex(ValueError, "cutout identities"):
            provider.analyzeGarment(Image.new("RGB", (200, 200), "white"), source_manifest=source)

    def test_invalid_hardware_cutouts_are_rejected(self):
        for change in ("outside", "duplicate", "fabric", "confidence", "unknown-enum", "fabric-boundary"):
            with self.subTest(change=change):
                manifest = self.hardware_fixture()
                hardware = manifest["regions"][1]
                if change == "outside":
                    hardware["cutouts"][0]["outline"] = [[.1, .1], [.2, .1], [.2, .2]]
                elif change == "duplicate":
                    hardware["cutouts"] *= 2
                elif change == "fabric":
                    hardware.update(semanticType="panel", structural=True, layerKind="structural")
                elif change == "unknown-enum":
                    hardware["semanticType"] = "hardware"
                elif change == "fabric-boundary":
                    hardware["boundary"]["boundaryType"] = "panel-edge"
                else:
                    hardware["cutouts"][0]["confidence"] = True
                with self.assertRaises(ValueError):
                    validate_manifest(manifest)

    def test_legacy_label_and_decoration_detail_edges_are_omitted(self):
        for semantic in ("label", "decoration"):
            manifest = garment_fixture("cropped-tank", "cotton")
            region = manifest["regions"][1]
            region.update(semanticType=semantic)
            region["visibleEdges"].append({**region["visibleEdges"][0], "id": "attachment-thread", "style": "stitch"})
            self.assertFalse(any(layer.any() for layer in detail_ink(region, (200, 200))))
            provider = provider_fixture()
            with patch.object(provider.raster, "generateRaster", return_value=Image.new("RGB", (200, 200))) as generate:
                provider.raster.generateWholeGarmentRaster(Image.new("RGB", (200, 200)), manifest, lambda label: None)
            observations = json.loads(generate.call_args.args[1].split("source evidence overrides uncertainty: ", 1)[1])
            self.assertNotIn(semantic, {piece["type"] for piece in observations["regions"]})
            manifest["regions"][1]["boundary"]["confidence"] = .3
            with contextlib.redirect_stdout(io.StringIO()):
                result = trace_reconstruction(Image.new("RGB", (200, 200), "white"), b"fixture",
                                              manifest, Image.new("RGB", (200, 200), "white"), manifest)
            self.assertNotIn(region["id"], {part["id"] for part in result["parts"]})
            self.assertNotIn(region["id"], {part["partId"] for part in result["detailLayers"]})
            self.assertNotIn(region["id"], {part["id"] for part in result["proposedBoundaries"]})

    def test_unclassified_reference_stops_before_redraw(self):
        from garment_source_geometry import SourceGeometryError

        buffer = io.BytesIO()
        Image.new("RGB", (100, 100), "white").save(buffer, format="PNG")
        for kind in ("unknown", " UNKNOWN ", "none", "not-a-garment", "", "   ", None, 3, "x" * 121):
            provider = provider_fixture()
            manifest = garment_fixture("unknown", "unknown")
            if kind is None:
                del manifest["garmentType"]
            else:
                manifest["garmentType"] = kind
            with self.subTest(kind=kind), \
                 patch("asset_providers.AstraProvider", return_value=provider), \
                 patch.object(provider.transport, "post", return_value=response(manifest)) as post, \
                 patch("garment_from_photo.trace_reconstruction") as trace, \
                 contextlib.redirect_stdout(io.StringIO()), \
                 self.assertRaisesRegex(ValueError, "garment type could not be identified") as raised:
                reconstruct(buffer.getvalue())
            self.assertNotIsInstance(raised.exception, SourceGeometryError)
            post.assert_called_once()
            trace.assert_not_called()


if __name__ == "__main__":
    unittest.main()
