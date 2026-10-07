"""Source-zip ownership, exact vector/alpha preservation and review regressions."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import unittest
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image
import resvg_py

import garment_construction_regions as segmentation


def render(svg, size=160):
    png = resvg_py.svg_to_bytes(svg_string=svg, width=size, height=size, skip_system_fonts=True)
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))


def fixture(view="front"):
    teeth = ''.join(f'<rect x="55.5" y="{y}.25" width="9" height="2.5"/>' for y in range(41, 120, 6))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">'
           '<g fill="black"><rect x="58.25" y="35.5" width="3.5" height="89"/>'
           f'{teeth}<path d="M15 83.25 H105" stroke="black" stroke-width="2"/>'
           '<path d="M15 15 H105 V145 H15 Z" fill="none" stroke="black"/></g></svg>')
    png = resvg_py.svg_to_bytes(svg_string=svg, width=120, height=160)
    rgba = Image.open(io.BytesIO(png)).convert("RGBA")
    background = Image.new("RGBA", rgba.size, "white")
    background.alpha_composite(rgba)
    construction = (f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">'
                    f'<g transform="translate(256,0) scale(12.8)">{svg}</g></svg>')
    return {"ok": True, "constructionVersion": 2, "lineArtSvg": construction,
            "tracePreview": {"tracedSvg": svg, "cleanedRaster": segmentation._png_url(background)},
            "manifest": {"view": view, f"{view}View": {"view": view}},
            "parts": [{"id": view + "-source-ink", "view": view, "structuralRole": "source-ink",
                       "constructionSvg": construction, "parentGarment": "garment", "layerOrder": 2}],
            "constructionRegions": {"version": 1, "status": "needs-review", "constructionInk": construction,
                                    "regions": [{"id": "unchanged-pocket", "semanticType": "pocket", "colourGroupId": "pocket-colour"}],
                                    "hardware": [], "closures": [], "warnings": []}}


def localization(**updates):
    return {"id": "centre-zip", "label": "Centre zip teeth", "semanticType": "zip",
            "sourceBounds": [54, 34, 66, 128], "evidence": "Visible repeated teeth inside the two source-supported endpoints.",
            "scope": "teeth-only", "confidence": .95, **updates}


class SourceZipTests(unittest.TestCase):
    def test_original_vectors_alpha_holes_and_non_square_frame_preserved(self):
        garment = fixture()
        before = copy.deepcopy(garment)
        result = segmentation.isolate_source_zips(garment, [localization()])
        construction = result["constructionRegions"]
        entry = construction["inkExtractions"][0]
        self.assertEqual(garment, before)
        self.assertEqual(result["parts"], before["parts"])
        self.assertEqual(construction["regions"], before["constructionRegions"]["regions"])
        self.assertEqual(construction["constructionInk"], before["lineArtSvg"])
        self.assertIn(before["lineArtSvg"], entry["inkSvg"])
        original = render(before["lineArtSvg"])
        extracted = render(entry["inkSvg"])
        alpha = render(entry["maskSvg"])
        ownership = render(entry["ownershipSvg"])[:, :, 3]
        self.assertTrue(np.isin(ownership, [0, 255]).all())
        selected = ownership > 0
        self.assertTrue(selected.any())
        np.testing.assert_array_equal(extracted[selected], original[selected])
        self.assertFalse(extracted[~selected].any())
        np.testing.assert_array_equal(alpha[:, :, 3], extracted[:, :, 3])
        self.assertTrue((alpha[:, :, :3][alpha[:, :, 3] > 0] == 255).all())
        self.assertTrue(((extracted[:, :, 3] > 0) & (extracted[:, :, 3] < 255)).any())
        np.testing.assert_array_equal(np.where(selected, 0, original[:, :, 3]) + extracted[:, :, 3], original[:, :, 3])
        self.assertLess(selected.sum(), (66 - 54) * (128 - 34))
        self.assertFalse(selected[83].any(), "Crossing seam must not be recoloured")
        self.assertFalse(selected[:, :74].any(), "Source x54 maps to canvas x74 under letterboxing")
        self.assertEqual(entry["reviewStatus"], "needs-review")
        self.assertFalse(entry["editableIndependently"])
        self.assertFalse(entry["applyFabric"])
        self.assertFalse(entry["provenance"]["automaticOwnershipProven"])
        self.assertIn(83, entry["provenance"]["excludedJunctionRows"])
        self.assertEqual(entry["provenance"]["constructionInkSha256"], hashlib.sha256(before["lineArtSvg"].encode()).hexdigest())
        self.assertEqual(construction["closures"][0]["inkExtractionId"], entry["id"])
        self.assertEqual(result["manifest"]["frontView"]["constructionRegions"], construction)

    def test_source_placement_uses_owned_rows_and_never_claims_full_conversion(self):
        garment = fixture()
        construction = segmentation.isolate_source_zips(garment, [localization()])["constructionRegions"]
        entry = construction["inkExtractions"][0]
        selected = render(entry["ownershipSvg"])[:, 20:140, 3] > 0
        ys, xs = np.where(selected)
        placement = entry["sourcePlacement"]
        pixels = placement["sourcePixels"]
        self.assertEqual(pixels["start"], [float(xs[ys == ys.min()].mean()) + .5, float(ys.min()) + .5])
        self.assertEqual(pixels["end"], [float(xs[ys == ys.max()].mean()) + .5, float(ys.max()) + .5])
        self.assertEqual(pixels["width"], int(xs.max() - xs.min() + 1))
        np.testing.assert_allclose(placement["start"], [(pixels["start"][0] + 20) / 160, pixels["start"][1] / 160])
        np.testing.assert_allclose(placement["end"], [(pixels["end"][0] + 20) / 160, pixels["end"][1] / 160])
        self.assertEqual(placement["width"], pixels["width"] / 160)
        self.assertEqual(placement["extent"], "owned-ink-only")
        self.assertFalse(placement["fullClosureExtentVerified"])
        self.assertEqual(entry["conversion"]["defaultMode"], "preserve-original")
        self.assertTrue(entry["conversion"]["requiresExplicitOptIn"])
        self.assertFalse(entry["conversion"]["canHideWholeOriginal"])
        self.assertEqual(construction["closures"][0]["sourcePlacement"], placement)
        self.assertEqual(construction["closures"][0]["conversion"], entry["conversion"])

    def test_scaled_ownership_is_binary_and_recomposes_without_dark_fringes(self):
        garment = fixture()
        entry = segmentation.isolate_source_zips(garment, [localization()])["constructionRegions"]["inkExtractions"][0]
        for size in (320, 1024, 2048):
            with self.subTest(size=size):
                original = render(garment["lineArtSvg"], size)[:, :, 3]
                owned = render(entry["inkSvg"], size)[:, :, 3]
                alpha = render(entry["maskSvg"], size)[:, :, 3]
                selection = render(entry["ownershipSvg"], size)[:, :, 3]
                self.assertTrue(np.isin(selection, [0, 255]).all())
                np.testing.assert_array_equal(owned, alpha)
                np.testing.assert_array_equal(np.where(selection > 0, 0, original) + owned, original)

    def test_non_round_source_scale_is_not_mistaken_for_alignment_failure(self):
        from garment_trace_only import _builder_svg
        garment = fixture()
        svg = garment["tracePreview"]["tracedSvg"].replace('width="120" height="160" viewBox="0 0 120 160"',
                                                            'width="121" height="163" viewBox="0 0 121 163"')
        png = resvg_py.svg_to_bytes(svg_string=svg, width=121, height=163)
        garment["tracePreview"] = {"tracedSvg": svg, "cleanedRaster": segmentation._png_url(Image.open(io.BytesIO(png)))}
        garment["lineArtSvg"] = _builder_svg(svg, (121, 163))
        garment["parts"][0]["constructionSvg"] = garment["lineArtSvg"]
        garment["constructionRegions"]["constructionInk"] = garment["lineArtSvg"]
        result = segmentation.isolate_source_zips(garment, [localization()])
        self.assertEqual(result["constructionRegions"]["inkExtractions"][0]["provenance"]["sourceHeight"], 163)

    def test_replay_is_deterministic_and_does_not_duplicate_closures_or_parts(self):
        garment = fixture()
        first = segmentation.isolate_source_zips(garment, [localization()])
        second = segmentation.isolate_source_zips(first, [localization()])
        self.assertEqual(first, second)
        self.assertEqual(len(second["constructionRegions"]["closures"]), 1)
        cleared = segmentation.isolate_source_zips(second, [])
        self.assertEqual(cleared["constructionRegions"]["inkExtractions"], [])
        self.assertEqual(cleared["constructionRegions"]["closures"], [])
        self.assertEqual(cleared["parts"], garment["parts"])

    def test_invalid_broad_or_external_geometry_never_becomes_a_fill(self):
        invalid = [localization(sourceBounds=[0, 1, 20, 100]),
                   localization(sourceBounds=[50, 34, 71, 45]),
                   localization(sourceBounds=[54.0, 34, 66, 128]),
                   localization(sourceBounds=[True, 34, 66, 128]),
                   localization(sourceBounds=[54, 34, 66, 161]),
                   localization(sourceBounds=[20, 34, 100, 128]),
                   localization(path="M0 0 H2048 V2048 Z"),
                   localization(reviewStatus="accepted"),
                   localization(semanticType="pocket"), localization(scope="full-fabric-strip"),
                   localization(confidence=float("nan")), localization(confidence=True),
                   localization(evidence=""), localization(sourceBounds=[25, 35, 30, 125])]
        garment = fixture()
        snapshot = copy.deepcopy(garment)
        for item in invalid:
            with self.subTest(item=item), self.assertRaises(segmentation.ConstructionRegionError):
                segmentation.isolate_source_zips(garment, [item])
        self.assertEqual(garment, snapshot)

    def test_duplicate_and_overlapping_ownership_rejected(self):
        for proposals in ([localization(), localization()], [localization(), localization(id="other")]):
            with self.assertRaises(segmentation.ConstructionRegionError):
                segmentation.isolate_source_zips(fixture(), proposals)

    def test_preview_display_mismatch_and_estimated_view_rejected(self):
        for change in (lambda g: g["constructionRegions"].update(constructionInk="different"),
                       lambda g: g["parts"][0].update(constructionSvg=g["lineArtSvg"].replace('y="35.5"', 'y="34.5"')),
                       lambda g: g["tracePreview"].update(tracedSvg=g["tracePreview"]["tracedSvg"].replace('y="35.5"', 'y="34.5"')),
                       lambda g: g["manifest"]["frontView"].update(inference={"kind": "estimated-back"})):
            garment = fixture()
            change(garment)
            with self.assertRaises(segmentation.ConstructionRegionError):
                segmentation.isolate_source_zips(garment, [localization()])

    def test_missing_localization_never_detects_a_zip_from_centre_seam_alone(self):
        result = segmentation.segment_construction(fixture(), analyst=lambda *args, **kwargs: {"regions": []})
        construction = result["constructionRegions"]
        self.assertEqual(construction["inkExtractions"], [])
        self.assertEqual(construction["closures"], [])
        self.assertFalse(construction["inkLocalizationReview"]["automaticOwnershipProven"])

    def test_provider_localization_is_only_a_review_proposal(self):
        analyst = Mock(return_value={"regions": [], "inkLocalizations": [localization()]})
        result = segmentation.segment_construction(fixture(), analyst=analyst)
        analyst.assert_called_once()
        self.assertEqual(result["constructionRegions"]["inkExtractions"][0]["reviewStatus"], "needs-review")
        self.assertEqual(result["parts"][0]["constructionSvg"], fixture()["parts"][0]["constructionSvg"])

    def test_bad_localization_does_not_discard_valid_fabric_regions(self):
        def analyst(technical, overlay, candidates, **kwargs):
            candidate = max(candidates, key=lambda item: item["area"])
            return {"regions": [{"id": "body", "label": "Body", "semanticType": "body",
                                  "candidateIds": [candidate["id"]], "evidence": "Closed source outline", "confidence": .95}],
                    "inkLocalizations": [localization(path="fake")]}
        result = segmentation.segment_construction(fixture(), analyst=analyst)
        self.assertEqual(len(result["constructionRegions"]["regions"]), 1)
        self.assertEqual(result["constructionRegions"]["inkExtractions"], [])
        self.assertTrue(any("localization failed" in warning for warning in result["constructionRegions"]["warnings"]))

    def test_back_proposal_cannot_reuse_front_coordinates_without_a_back_trace(self):
        with self.assertRaises(segmentation.ConstructionRegionError):
            segmentation.isolate_source_zips(fixture(), [localization()], view="back")
        result = segmentation.isolate_source_zips(fixture("back"), [localization()])
        self.assertEqual(result["constructionRegions"]["inkExtractions"][0]["view"], "back")

    def test_cli_ink_only_has_no_provider_call_or_fabric_regrouping(self):
        import contextlib
        output = io.StringIO()
        garment = fixture()
        with (patch("sys.argv", ["regions", "trace.json", "--ink-only", "--analysis", "analysis.json"]),
              patch("pathlib.Path.read_text", side_effect=[json.dumps({"inkLocalizations": [localization()]}), json.dumps(garment)]),
              patch.object(segmentation, "_default_analyst", side_effect=AssertionError("No provider call")),
              contextlib.redirect_stdout(output)):
            segmentation.main()
        result = json.loads(output.getvalue())
        self.assertEqual(result["parts"], garment["parts"])
        self.assertEqual(result["constructionRegions"]["regions"], garment["constructionRegions"]["regions"])
        self.assertEqual(len(result["constructionRegions"]["inkExtractions"]), 1)


if __name__ == "__main__":
    unittest.main()
