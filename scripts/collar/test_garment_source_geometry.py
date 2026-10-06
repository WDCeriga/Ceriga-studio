"""Source-photo geometry regressions, with no image-model calls."""
import contextlib
import copy
import io
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

from garment_from_photo import reconstruct
from garment_source_geometry import SourceGeometryError, frame_source, segment_source
from test_generic_garment_import import garment_fixture, provider_fixture, response


def tank_fixture():
    manifest = garment_fixture("vest", "cotton")
    body = manifest["regions"][0]
    body["outline"] = [[.28,.25],[.35,.27],[.36,.48],[.45,.6],[.55,.6],[.64,.5],[.65,.24],
                       [.72,.22],[.74,.49],[.83,.64],[.78,.85],[.2,.87],[.17,.63],[.26,.48]]
    body.update(bounds=[.17,.22,.83,.87], seed=[.5,.75], visibleEdges=[])
    rear = copy.deepcopy(body)
    rear.update(id="visible-inner-back", name="Visible inner back fabric", semanticType="lining", structural=False,
                layerKind="detail", structuralRole="visible-inner-back", measurementRole="none", attachmentTo="body",
                outline=[[.28,.16],[.36,.22],[.64,.2],[.72,.14],[.7,.4],[.65,.55],[.5,.61],[.34,.51],[.29,.35]],
                bounds=[.28,.14,.72,.61], seed=[.5,.4])
    manifest.update(regions=[rear, body], isolatedOnPlainBackground=True)
    image = Image.new("RGB", (300, 400), "white")
    for region in manifest["regions"]:
        ImageDraw.Draw(image).polygon([(round(x*299),round(y*399)) for x,y in region["outline"]], fill=(205,200,190))
    return image, manifest


class SourceGeometryTests(unittest.TestCase):
    def test_original_asymmetry_and_physical_aspect_ratio_survive(self):
        photo, manifest = tank_fixture()
        before = copy.deepcopy(manifest)
        _, mapped = frame_source(photo, manifest)
        source = manifest["regions"][1]["outline"]
        target = mapped["regions"][1]["outline"]
        sx = (target[1][0]-target[0][0]) / ((source[1][0]-source[0][0])*299)
        sy = (target[1][1]-target[0][1]) / ((source[1][1]-source[0][1])*399)
        self.assertAlmostEqual(sx, sy)
        self.assertNotEqual(target[0][1], target[7][1])
        self.assertEqual(manifest, before)

    def test_visible_rear_fabric_and_true_background_are_distinct(self):
        photo, manifest = tank_fixture()
        _, mapped, (masks, _, _, _) = segment_source(photo, manifest, 400)
        framed, _ = frame_source(photo, manifest, 400)
        observed = np.linalg.norm(np.asarray(framed,dtype=float)-255, axis=2)>12
        traced = np.logical_or.reduce(masks)
        self.assertGreater((traced & observed).sum()/(traced | observed).sum(), .985)
        rear = mapped["regions"][0]
        x,y = rear["seed"]
        self.assertTrue(traced[round(y*399),round(x*399)], "Visible rear fabric was cut out as a neck opening")
        self.assertFalse(traced[0].any(), "Background above the garment was filled")
        self.assertFalse(traced[:,0].any(), "Armhole/exterior background was filled")

    def test_floating_band_with_missing_rear_fabric_is_rejected(self):
        photo, manifest = tank_fixture()
        rear = manifest["regions"][0]
        rear["outline"] = [[.28,.16],[.36,.22],[.64,.2],[.72,.14],[.71,.17],[.64,.23],[.36,.25],[.29,.19]]
        rear.update(bounds=[.28,.14,.72,.25], seed=[.5,.22])
        with self.assertRaisesRegex(SourceGeometryError, "omit visible garment fabric"):
            segment_source(photo, manifest, 400)

    def test_small_outline_error_snaps_to_source_exterior(self):
        photo, manifest = tank_fixture()
        manifest["regions"][1]["outline"][10][0] -= .006
        _, _, (masks, _, _, _) = segment_source(photo, manifest, 400)
        framed, _ = frame_source(photo, manifest, 400)
        observed = np.linalg.norm(np.asarray(framed,dtype=float)-255, axis=2)>12
        traced = np.logical_or.reduce(masks)
        self.assertGreater((traced & observed).sum()/(traced | observed).sum(), .985)

    def test_observed_curved_hem_repairs_a_larger_source_outline_miss(self):
        photo, manifest = tank_fixture()
        body = manifest["regions"][1]
        body["outline"][10][1] -= .045
        body["outline"][11][1] -= .045
        _, _, (masks, _, _, _) = segment_source(photo, manifest, 400)
        framed, _ = frame_source(photo, manifest, 400)
        observed = np.linalg.norm(np.asarray(framed,dtype=float)-255, axis=2)>12
        traced = np.logical_or.reduce(masks)
        self.assertGreater((traced & observed).sum()/observed.sum(), .985)

    def test_pixel_repair_does_not_invent_a_partition_seam(self):
        manifest = garment_fixture("vest", "cotton")
        first = manifest["regions"][0]
        first.update(outline=[[.3,.3],[.5,.3],[.5,.8],[.3,.8]],
                     bounds=[.3,.3,.5,.8], seed=[.4,.6], visibleEdges=[])
        second = copy.deepcopy(first)
        second.update(id="right-body", outline=[[.5,.3],[.7,.3],[.7,.8],[.5,.8]],
                      bounds=[.5,.3,.7,.8], seed=[.6,.6])
        manifest.update(regions=[first, second], isolatedOnPlainBackground=True)
        photo = Image.new("RGB", (300,300), "white")
        ImageDraw.Draw(photo).rectangle((90,90,209,254), fill=(205,200,190))
        _, mapped, (masks, contours, _, _) = segment_source(photo, manifest, 400)
        x = round(mapped["regions"][0]["bounds"][2] * 399)
        y = round(mapped["regions"][0]["bounds"][3] * 399)
        self.assertTrue(np.logical_or.reduce(masks)[y+12,x])
        self.assertFalse(contours[y+12,x-2:x+3].any(), "Nearest-piece ownership created an unevidenced seam")
        self.assertTrue(contours[y-12,x-2:x+3].any(), "Existing construction boundary was removed")

    def test_print_does_not_become_construction_ink(self):
        photo, manifest = tank_fixture()
        printed = photo.copy()
        ImageDraw.Draw(printed).text((135,295), "LABEL", fill="black")
        ImageDraw.Draw(printed).rectangle((135,270,160,285), fill="white")
        clean = segment_source(photo, manifest, 400)[2]
        dirty = segment_source(printed, manifest, 400)[2]
        for first, second in zip(clean[:3], dirty[:3]):
            if isinstance(first,list):
                self.assertTrue(all(np.array_equal(a,b) for a,b in zip(first,second)))
            else:
                self.assertTrue(np.array_equal(first,second))

    def test_true_enclosed_neck_opening_stays_empty(self):
        photo, manifest = tank_fixture()
        rear = manifest["regions"][0]
        rear.update(outline=[[.28,.18],[.72,.18],[.72,.28],[.28,.28]],
                    bounds=[.28,.18,.72,.28], seed=[.5,.23])
        photo.paste("white", (0, 0, photo.width, photo.height))
        for region in manifest["regions"]:
            ImageDraw.Draw(photo).polygon([(round(x*299),round(y*399)) for x,y in region["outline"]], fill=(205,200,190))
        _, mapped, (masks, _, _, _) = segment_source(photo, manifest, 400)
        body = mapped["regions"][1]
        x = body["seed"][0]
        y = (mapped["regions"][0]["bounds"][3] + body["outline"][3][1]) / 2
        self.assertFalse(np.logical_or.reduce(masks)[round(y*399),round(x*399)])

    def test_uniform_near_white_background_supports_edge_refinement(self):
        photo, manifest = tank_fixture()
        rgb = np.asarray(photo).copy()
        rgb[np.all(rgb == 255, axis=2)] = 243
        _, _, (_, _, _, notes) = segment_source(Image.fromarray(rgb), manifest, 400)
        self.assertIn("visible exterior edges follow", notes[-1])

    def test_worn_or_nonplain_photo_does_not_use_background_threshold(self):
        photo, manifest = tank_fixture()
        manifest["isolatedOnPlainBackground"] = False
        _, _, (_, _, _, notes) = segment_source(photo, manifest, 400)
        self.assertIn("unavailable", notes[-1])

    def test_failed_coverage_rechecks_original_photo_without_redraw(self):
        photo, manifest = tank_fixture()
        missing = copy.deepcopy(manifest)
        missing["regions"] = missing["regions"][1:]
        buffer = io.BytesIO()
        photo.save(buffer,format="PNG")
        provider = provider_fixture()
        with patch("asset_providers.AstraProvider",return_value=provider), \
             patch.object(provider.transport,"post",side_effect=[response(missing),response(manifest)]) as post, \
             contextlib.redirect_stdout(io.StringIO()):
            result = reconstruct(buffer.getvalue())
        self.assertTrue(result["ok"])
        self.assertEqual(post.call_count,2)
        for call in post.call_args_list:
            self.assertEqual(call.args[0],"/openai/v1/responses")
        prompt = post.call_args_list[1].kwargs["json"]["input"][0]["content"][0]["text"]
        self.assertIn("previous analysis failed",prompt)
        self.assertIn("omit visible garment fabric",prompt)


if __name__ == "__main__":
    unittest.main()
