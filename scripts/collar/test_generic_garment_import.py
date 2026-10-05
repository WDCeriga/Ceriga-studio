"""Offline import regressions: synthetic references and mocked Azure responses, real SVG tracing."""

import base64
import contextlib
import copy
import io
import json
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw

from asset_providers import AstraProvider
from garment_from_photo import reconstruct
from garment_manifest import validate_manifest
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
        for kind, material in (("shorts", "denim"), ("shorts", "cotton"), ("tshirt", "cotton"), ("hoodie", "fleece")):
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
                    raster = {"data": [{"b64_json": base64.b64encode(buffer.getvalue()).decode()}]}
                    with patch("asset_providers.AstraProvider", return_value=provider), \
                         patch.object(provider.transport, "post", side_effect=[response(manifest), raster, response(manifest)]) as post, \
                         contextlib.redirect_stdout(io.StringIO()):
                        result = reconstruct(buffer.getvalue())
                    self.assertTrue(result["ok"])
                    self.assertEqual(result["source"], "azure-garment-reconstruction-v1")
                    self.assertEqual(result["manifest"]["garmentType"], kind)
                    self.assertEqual(result["manifest"]["material"], material)
                    self.assertEqual(result["manifest"]["view"], view)
                    self.assertEqual({part["id"] for part in result["parts"]}, {region["id"] for region in manifest["regions"]})
                    by_id = {region["id"]: region for region in manifest["regions"]}
                    for part in result["parts"]:
                        self.assertEqual(part["view"], view)
                        self.assertEqual(part["outline"], by_id[part["id"]]["outline"])
                        self.assertEqual(part["builderCategory"], by_id[part["id"]]["builderCategory"])
                        self.assertIn("<path", part["svg"])
                        self.assertEqual(part["measurement"]["unit"], "relative")
                    self.assertTrue(result["detailLayers"])
                    for detail in result["detailLayers"]:
                        self.assertEqual(detail["userFacingName"], by_id[detail["partId"]]["userFacingName"])
                        self.assertEqual(detail["view"], view)
                    self.assertEqual(post.call_count, 3)
                    analysis_prompt = post.call_args_list[0].kwargs["json"]["input"][0]["content"][0]["text"]
                    self.assertIn("hoodie", analysis_prompt)
                    self.assertIn("sleeve/cuff/collar", analysis_prompt)
                    self.assertIn("independently colorable regions", analysis_prompt)
                    self.assertIn("identical fabric and colour", analysis_prompt)
                    self.assertIn("never a guessed strip width", analysis_prompt)
                    self.assertIn("never link all same-material regions together", analysis_prompt)
                    self.assertNotIn("Main fabric pieces share colourGroup main-body", analysis_prompt)
                    self.assertNotIn("shorts or unknown", analysis_prompt)
                    raster_prompt = post.call_args_list[1].kwargs["data"]["prompt"]
                    self.assertIn("COMPLETE visible garment", raster_prompt)
                    self.assertIn(f'"garmentType":"{kind}"', raster_prompt)
                    self.assertNotIn("COMPLETE visible denim shorts", raster_prompt)

    def test_unclassified_reference_stops_before_redraw(self):
        provider = provider_fixture()
        manifest = garment_fixture("unknown", "unknown")
        buffer = io.BytesIO()
        Image.new("RGB", (100, 100), "white").save(buffer, format="PNG")
        with patch("asset_providers.AstraProvider", return_value=provider), \
             patch.object(provider.transport, "post", return_value=response(manifest)) as post, \
             contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, "garment type could not be identified"):
            reconstruct(buffer.getvalue())
        self.assertEqual(post.call_count, 1)


if __name__ == "__main__":
    unittest.main()
