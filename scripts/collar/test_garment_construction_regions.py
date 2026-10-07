"""Offline geometry, provider contract and unchanged trace regressions."""
from __future__ import annotations

import copy
import io
import json
import re
import unittest
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image
import resvg_py

import garment_construction_regions as segmentation
from asset_providers import AstraProvider
from garment_trace_only import trace_only


def fixture_svg(kind="hoodie"):
    sleeves = ('<path d="M90 90 L25 135 L45 180 L90 160 M230 90 L295 135 L275 180 L230 160"/>' if kind == "tee" else
               '<path d="M90 90 L25 135 L45 285 L90 265 M230 90 L295 135 L275 285 L230 265"/>'
               '<path d="M42 262 L90 242 M278 262 L230 242"/>')
    top = ('<path d="M125 90 Q160 135 195 90 M119 90 Q160 148 201 90"/>' if kind == "tee" else
           '<path d="M100 90 Q90 15 160 20 Q230 15 220 90 M125 90 Q160 45 195 90"/>')
    chest = '' if kind == "tee" else '<path d="M90 170 Q160 205 230 170"/>'
    pockets = ('' if kind != "jacket" else
               '<path d="M108 220 H145 V285 H108 Z M175 220 H212 V285 H175 Z M108 233 H145 M175 233 H212"/>'
               '<path d="M153 90 V350 M167 90 V350"/><circle cx="160" cy="230" r="4"/>')
    stitches = ''.join(f'<path d="M{x} 340 h3"/>' for x in range(100, 220, 8))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400">'
            f'<g fill="none" stroke="black" stroke-width="2"><path d="M90 90 H230 V350 Q160 365 90 350 Z"/>'
            f'{sleeves}{top}{chest}{pockets}<path d="M90 330 H230 M115 245 Q127 260 130 278"/>{stitches}</g></svg>')


def garment_fixture(kind="hoodie", view="front"):
    png = resvg_py.svg_to_bytes(svg_string=fixture_svg(kind), width=320, height=400)
    with Image.open(io.BytesIO(png)) as image:
        white = Image.new("RGBA", image.size, "white")
        white.alpha_composite(image.convert("RGBA"))
        buffer = io.BytesIO()
        white.convert("RGB").save(buffer, format="PNG")
    return trace_only(buffer.getvalue(), view=view)


def group(identifier, candidate_ids, kind="body", **kwargs):
    return {"id": identifier, "label": identifier.replace("-", " ").title(), "semanticType": kind,
            "builderCategory": segmentation._category(kind), "candidateIds": candidate_ids,
            "confidence": .95, "evidence": "Visible continuous sewn construction perimeter in the supplied technical raster.",
            **kwargs}


def render_region(region):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="{region["path"]}" fill="black" fill-rule="evenodd"/></svg>'
    png = resvg_py.svg_to_bytes(svg_string=svg, width=2048, height=2048)
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))[:, :, 3] >= 128


class ConstructionRegionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hoodie = garment_fixture()
        cls.tee = garment_fixture("tee")
        cls.jacket = garment_fixture("jacket")

    def test_component_defaults_link_inner_hood_and_hem_separately(self):
        regions = [dict(id=name, semanticType=kind, builderCategory=category,
                        colourGroupId="front-colour-original", fabricGroupId="front-fabric-original",
                        parentRegionId=parent)
                   for name, kind, category, parent in [
                       ("body", "body", "fabric-colour", None),
                       ("sleeve-left", "sleeve", "sleeves", "body"),
                       ("sleeve-right", "sleeve", "sleeves", "body"),
                       ("inset", "panel", "custom-details", "sleeve-left"),
                       ("lining-left", "lining", "neck-hood", None),
                       ("lining-right", "lining", "neck-hood", None),
                       ("hem-left", "hem", "hem-cuffs", "body"),
                       ("hem-right", "hem", "hem-cuffs", "body"),
                       ("kangaroo-pocket", "pocket", "fabric-colour", "body"),
                   ]]
        segmentation._component_defaults(regions, "front")
        self.assertEqual(regions[3]["builderCategory"], "sleeves")
        self.assertEqual(regions[8]["builderCategory"], "pockets-zips")
        self.assertNotEqual(regions[8]["colourGroupId"], regions[0]["colourGroupId"])
        self.assertNotEqual(regions[8]["fabricGroupId"], regions[0]["fabricGroupId"])
        for field in ("colourGroupId", "fabricGroupId"):
            self.assertNotEqual(regions[0][field], regions[1][field])
            self.assertEqual(regions[1][field], regions[2][field])
        self.assertEqual(regions[4]["colourGroupId"], regions[5]["colourGroupId"])
        self.assertEqual(regions[6]["colourGroupId"], regions[7]["colourGroupId"])
        self.assertNotEqual(regions[4]["colourGroupId"], regions[6]["colourGroupId"])
        snapshot = copy.deepcopy(regions)
        segmentation._component_defaults(regions, "front")
        self.assertEqual(regions, snapshot)

    def test_drawstring_is_colourable_trim_not_body_fabric(self):
        def analyst(technical, overlay, candidates, **kwargs):
            return {"regions": [group("drawcord", [candidates[0]["id"]], "drawstring")]}
        result = segmentation.segment_construction(self.hoodie, analyst=analyst)
        region = result["constructionRegions"]["regions"][0]
        self.assertEqual(region["semanticType"], "drawstring")
        self.assertEqual(region["builderCategory"], "trims-details")
        self.assertFalse(region["applyFabric"])
        self.assertTrue(region["editableIndependently"])
        part = next(p for p in result["parts"] if p.get("semanticType") == "drawstring")
        self.assertTrue(part["colorable"])
        self.assertFalse(part["structural"])
        self.assertEqual(part["layerKind"], "detail")
        self.assertFalse(part["applyFabric"])
        self.assertEqual(result["lineArtSvg"], self.hoodie["lineArtSvg"])

    def test_closed_hardware_surfaces_are_editable_source_cells_not_fabric_or_ink_replacements(self):
        for kind in sorted(segmentation.HARDWARE):
            with self.subTest(kind=kind):
                def analyst(technical, overlay, candidates, **kwargs):
                    candidate = min(candidates, key=lambda cell: cell["area"])
                    return {"regions": [group("hardware", [candidate["id"]], kind, editableIndependently=False)]}
                result = segmentation.segment_construction(self.jacket, analyst=analyst)
                construction = result["constructionRegions"]
                hardware = construction["hardware"][0]
                part = next(p for p in result["parts"] if p.get("semanticType") == kind)
                cell = next(c for c in construction["candidates"] if c["id"] == hardware["candidateIds"][0])
                self.assertEqual(part["path"], cell["path"])
                self.assertEqual(hardware["path"], cell["path"])
                self.assertTrue(hardware["colorable"] and hardware["editableIndependently"])
                self.assertTrue(part["colorable"] and part["editableIndependently"])
                self.assertFalse(part["applyFabric"])
                self.assertFalse(part["structural"])
                self.assertEqual(part["layerKind"], "detail")
                self.assertEqual(part["geometryRole"], "closed-source-cell")
                self.assertEqual(construction["inkExtractions"], [])
                self.assertEqual(construction["regions"], [])
                self.assertEqual(result["lineArtSvg"], self.jacket["lineArtSvg"])
                self.assertEqual(construction["constructionInk"], self.jacket["lineArtSvg"])
                rerun = segmentation.segment_construction(result, analyst=analyst)
                self.assertEqual(result["parts"], rerun["parts"])
                if kind == "zip":
                    self.assertEqual(construction["closures"][0]["id"], part["id"])
                    self.assertNotIn("inkExtractionId", construction["closures"][0])

    def test_low_confidence_hardware_is_not_installed(self):
        def analyst(technical, overlay, candidates, **kwargs):
            return {"regions": [group("uncertain-button", [candidates[0]["id"]], "button", confidence=.6)]}
        result = segmentation.segment_construction(self.jacket, analyst=analyst)
        self.assertEqual(result["constructionRegions"]["hardware"], [])
        self.assertFalse(any(p.get("semanticType") == "button" for p in result["parts"]))

    def test_photo_analysis_uses_cleaned_trace_frame_not_original_photo(self):
        garment = copy.deepcopy(self.hoodie)
        garment["tracePreview"]["sourceRaster"] = segmentation._png_url(Image.new("RGB", (100, 200), "red"))
        seen = {}
        def analyst(technical, overlay, candidates, **kwargs):
            seen["size"] = technical.size
            return {"regions": []}
        segmentation.segment_construction(garment, analyst=analyst)
        self.assertEqual(seen["size"], (320, 400))

    def test_cli_streams_result_without_output_file(self):
        import contextlib
        output = io.StringIO()
        with (patch("sys.argv", ["regions", "trace.json", "--view", "front"]),
              patch("pathlib.Path.read_text", return_value=json.dumps(self.tee)),
              patch.object(segmentation, "_default_analyst", return_value={"regions": []}),
              contextlib.redirect_stdout(output)):
            segmentation.main()
        result = json.loads(output.getvalue())
        self.assertEqual(result["type"], "result")
        self.assertTrue(result["ok"])
        self.assertIn("constructionRegions", result)

    def test_curved_chest_seam_independent_and_preserved(self):
        before = copy.deepcopy(self.hoodie)
        seen = {}
        def analyst(technical, overlay, candidates, *, view):
            seen.update(technical=technical, overlay=overlay, candidates=candidates)
            body = [c for c in candidates if .225 < c["seed"][0] < .775 and c["bounds"][0] > .31
                    and c["bounds"][1] > .22 and c["bounds"][2] < .69 and c["area"] > 4000]
            body.sort(key=lambda c: c["seed"][1])
            self.assertEqual(len(body), 2)
            return {"regions": [group("upper-chest", [body[0]["id"]]), group("lower-body", [body[1]["id"]])]}
        result = segmentation.segment_construction(self.hoodie, analyst=analyst)
        regions = result["constructionRegions"]["regions"]
        self.assertEqual(len(regions), 2, result["constructionRegions"]["warnings"])
        self.assertEqual(self.hoodie, before)
        for key in ("tracePreview", "lineArtSvg", "sourceManifest", "sourceImage", "cleanDrawing", "provenance"):
            self.assertEqual(result[key], before[key])
        ink = result["parts"][0].copy()
        ink["layerOrder"] = before["parts"][0]["layerOrder"]
        self.assertEqual(ink, before["parts"][0])
        self.assertGreater(result["parts"][0]["layerOrder"], max(p["layerOrder"] for p in result["parts"][1:]))
        self.assertEqual(result["constructionRegions"], result["manifest"]["frontView"]["constructionRegions"])
        self.assertNotEqual(regions[0]["colourGroupId"], regions[1]["colourGroupId"])
        self.assertNotEqual(regions[0]["fabricGroupId"], regions[1]["fabricGroupId"])
        self.assertNotEqual(regions[0]["colourGroupId"], regions[0]["fabricGroupId"])
        self.assertFalse((render_region(regions[0]) & render_region(regions[1])).any())
        self.assertFalse(np.array_equal(seen["technical"], seen["overlay"]))
        self.assertTrue(all("path" not in c and "outline" not in c for c in seen["candidates"]))
        self.assertEqual(result["constructionRegions"]["stitchingPaths"], [])
        self.assertEqual(result["constructionRegions"]["status"], "needs-review")

    def test_tee_no_fragment_explosion_and_repeatable(self):
        def analyst(technical, overlay, candidates, **kwargs):
            return {"regions": [group("main-body", [c["id"] for c in candidates if c["area"] > 10000])]}
        one = segmentation.segment_construction(self.tee, analyst=analyst)
        two = segmentation.segment_construction(self.tee, analyst=analyst)
        self.assertEqual(one, two)
        self.assertEqual(len(one["constructionRegions"]["regions"]), 1)
        self.assertLess(len(one["constructionRegions"]["candidates"]), 12)
        self.assertEqual(one["partCount"], 2)
        rerun = segmentation.segment_construction(one, analyst=analyst)
        self.assertEqual(rerun["partCount"], 2)
        self.assertEqual(one["constructionRegions"], rerun["constructionRegions"])
        for region in one["constructionRegions"]["regions"]:
            self.assertRegex(region["id"], r"^[a-z][a-z0-9-]{0,63}$")
            self.assertTrue(region["path"].endswith("Z"))
            self.assertTrue(region["outline"])

    def test_utility_jacket_groups_hardware_and_retains_candidates(self):
        def analyst(technical, overlay, candidates, **kwargs):
            # Fixture-specific positions classify only genuinely enclosed source cells.
            pockets = [c for c in candidates if 350 < c["area"] < 2600 and .53 < c["seed"][1] < .73]
            tiny = [c for c in candidates if c["area"] < 70]
            selected = [group(f"pocket-{i}", [c["id"]], "pocket") for i, c in enumerate(pockets)]
            selected += [group(f"hardware-{i}", [c["id"]], "button") for i, c in enumerate(tiny)]
            used = {cid for r in selected for cid in r["candidateIds"]}
            selected += [group("body", [c["id"] for c in candidates if c["area"] > 2600 and c["id"] not in used])]
            return {"regions": selected}
        result = segmentation.segment_construction(self.jacket, analyst=analyst)
        construction = result["constructionRegions"]
        self.assertGreaterEqual(len(construction["regions"]), 3, construction["warnings"])
        self.assertLess(len(construction["regions"]), 16)
        self.assertTrue(construction["hardware"])
        hardware_parts = [p for p in result["parts"] if p.get("semanticType") == "button"]
        self.assertTrue(hardware_parts)
        self.assertTrue(all(p["colorable"] and p["editableIndependently"] and not p["applyFabric"] for p in hardware_parts))
        self.assertTrue(all(p["layerKind"] == "detail" and not p["structural"] for p in hardware_parts))
        self.assertTrue(all(c["path"] for c in construction["candidates"]))
        installed = [render_region(r) for r in construction["regions"]]
        self.assertLessEqual(np.sum(installed, axis=0).max(), 1)
        for hardware in construction["hardware"]:
            self.assertFalse((np.any(installed, axis=0) & render_region(hardware)).any())

    def test_geometry_holes_exterior_and_exact_pixel_cells(self):
        ink = np.zeros((80, 120), dtype=bool)
        ink[10, 10:111] = ink[70, 10:111] = True
        ink[10:71, 10] = ink[10:71, 110] = True
        ink[25, 35:71] = ink[55, 35:71] = True
        ink[25:56, 35] = ink[25:56, 70] = True
        labels, candidates, _ = segmentation._candidate_cells(ink, "back", 0)
        self.assertEqual(len(candidates), 2)
        outside, opening = sorted(candidates, key=lambda c: -c["area"])
        regions, _, _ = segmentation._classify({"regions": [group("body", [outside["id"]])],
                                                "excluded": [{"candidateIds": [opening["id"]], "reason": "opening"}]}, candidates, labels, "back")
        self.assertEqual(len(regions), 1)
        path = regions[0]["path"]
        self.assertEqual(path.count("Z"), 2)
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="{path}" fill-rule="evenodd"/></svg>'
        rendered = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=svg, width=120, height=120))).convert("RGBA")
        mask = np.asarray(rendered)[20:100, :, 3] >= 128
        np.testing.assert_array_equal(mask, labels == outside["_label"])
        self.assertFalse(mask[35, 50])
        self.assertFalse(mask[5, 5])
        self.assertTrue(regions[0]["id"].startswith("back-"))

    def test_failures_do_not_guess_or_mutate(self):
        before = copy.deepcopy(self.tee)
        failures = [Mock(side_effect=RuntimeError("private-token")), Mock(return_value={"regions": [group("bad", ["invented-cell"])]})]
        for analyst in failures:
            result = segmentation.segment_construction(self.tee, analyst=analyst)
            self.assertEqual(result["constructionRegions"]["regions"], [])
            self.assertEqual(result["partCount"], 1)
            self.assertTrue(any("failed" in w for w in result["constructionRegions"]["warnings"]))
            self.assertNotIn("private-token", json.dumps(result))
            self.assertEqual(result["lineArtSvg"], before["lineArtSvg"])
        self.assertEqual(self.tee, before)

    def test_overlap_and_ai_paths_rejected_or_ignored(self):
        def duplicate(*args, **kwargs):
            candidate = args[2][0]["id"]
            return {"regions": [group("one", [candidate]), group("two", [candidate])]}
        result = segmentation.segment_construction(self.tee, analyst=duplicate)
        self.assertEqual(result["constructionRegions"]["regions"], [])
        def hostile(*args, **kwargs):
            candidate = max(args[2], key=lambda c: c["area"])
            return {"regions": [group("safe", [candidate["id"]], path="M0 0 L2048 0 L2048 2048 Z", outline=[[0, 0]])]}
        result = segmentation.segment_construction(self.tee, analyst=hostile)
        self.assertNotEqual(result["constructionRegions"]["regions"][0]["path"], "M0 0 L2048 0 L2048 2048 Z")

    def test_missing_trace_estimated_view_and_misalignment_fail_before_provider(self):
        analyst = Mock()
        for transform in (lambda g: g.pop("tracePreview"),
                          lambda g: g["manifest"]["frontView"].update(inference={"kind": "estimated-back"}),
                          lambda g: g["tracePreview"].update(tracedSvg=fixture_svg().replace("0 0 320 400", "0 0 400 320"))):
            garment = copy.deepcopy(self.tee)
            transform(garment)
            with self.assertRaises(segmentation.ConstructionRegionError):
                segmentation.segment_construction(garment, analyst=analyst)
        analyst.assert_not_called()

    def test_gap_bridging_never_closes_exterior(self):
        ink = np.zeros((40, 40), dtype=bool)
        ink[5, 5:35] = ink[34, 5:35] = True
        ink[5:35, 5] = ink[5:35, 34] = True
        ink[5, 20] = False
        _, cells, _ = segmentation._candidate_cells(ink, "front", 1)
        self.assertEqual(cells, [])
        ink[5, 20] = True
        ink[20, 5:35] = True
        ink[20, 20] = False
        _, base, _ = segmentation._candidate_cells(ink, "front", 0)
        _, bridged, warnings = segmentation._candidate_cells(ink, "front", 1)
        self.assertEqual(len(base), 1)
        self.assertEqual(len(bridged), 2)
        self.assertTrue(any("Bridged" in w for w in warnings))

    def test_default_provider_mock_two_images_no_redraw(self):
        settings = {"CERIGA_AZURE_ENDPOINT": "https://example.test", "CERIGA_AZURE_API_KEY": "test-key",
                    "CERIGA_AZURE_REASONING_DEPLOYMENT": "astra"}
        payload = {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": '{"regions":[],"warnings":["Review required"]}'}]}]}
        with (patch("lineart.load_secrets", return_value=settings),
              patch("asset_providers.AzureTransport.post", return_value=payload) as post,
              patch("asset_providers.AzureImageRasterProvider.generateTechnicalRaster", side_effect=AssertionError("No redraw"))):
            result = segmentation.segment_construction(self.tee)
        self.assertIn("Review required", result["constructionRegions"]["warnings"])
        request = post.call_args.kwargs["json"]
        content = request["input"][0]["content"]
        self.assertEqual(sum(c["type"] == "input_image" for c in content), 2)
        self.assertEqual(request["model"], "astra")
        self.assertFalse(request["store"])
        self.assertIn("candidateIds", content[0]["text"])
        self.assertIn("Drawstrings/drawcords are supported colourable trim", content[0]["text"])
        self.assertIn("independently of body/hood fabric", content[0]["text"])
        self.assertIn("hardware semantic types but never fabric", content[0]["text"])
        self.assertIn("Exclude background, neck/arm openings, open hardware holes", content[0]["text"])
        provider = AstraProvider(settings)
        with patch.object(provider.transport, "post", return_value={"status": "failed"}):
            with self.assertRaises(ValueError):
                provider.analyzeConstructionRegions(Image.new("RGB", (20, 20)), Image.new("RGB", (20, 20)), [], view="front")


if __name__ == "__main__":
    unittest.main()
