"""Offline technical-flat regressions; source photographs are never fixtures."""
import contextlib
import copy
import io
import re
import unittest
from unittest.mock import patch

import numpy as np
from PIL import ImageDraw
from scipy import ndimage

from garment_from_photo import reconstruct
from garment_manifest import detail_ink, outline_mask, validate_manifest
from garment_source_geometry import frame_source
from garment_technical_flat import balanced, project_manifest, rib_paths, segment_technical, supports_technical_flat
from test_garment_source_geometry import tank_fixture
from test_generic_garment_import import garment_fixture


def jacket_fixture():
    from PIL import Image
    manifest = garment_fixture("hoodie", "woven")
    manifest.update(garmentType="jacket", subtype="hooded jacket with a one-sided sleeve pocket")
    regions = {region["id"]: region for region in manifest["regions"]}
    left, right = regions["left-sleeve"], regions["right-sleeve"]
    left.update(symmetryPartner=right["id"], outline=[[.1,.31],[.3,.3],[.3,.48],[.1,.5]], bounds=[.1,.3,.3,.5])
    right.update(symmetryPartner=left["id"], outline=[[.7,.32],[.9,.34],[.9,.52],[.7,.50]], bounds=[.7,.32,.9,.52], seed=[.8,.4])
    pocket = regions["pocket"]
    pocket.update(id="left-sleeve-pocket", attachmentTo=left["id"], outline=[[.16,.36],[.24,.36],[.24,.43],[.16,.43]],
                  bounds=[.16,.36,.24,.43], seed=[.2,.4], visibleEdges=[])
    regions["cuff"]["attachmentTo"] = left["id"]
    return Image.new("RGB", (400, 400), "white"), validate_manifest(manifest)


def technical_fixture():
    photo, manifest = tank_fixture()
    manifest.update(subtype="cropped scoop-neck rib tank", materialEvidence="Visible vertical rib knit")
    body = manifest["regions"][1]
    hem = copy.deepcopy(body)
    hem.update(id="cropped-hem", semanticType="hem", attachmentTo="body", structural=False,
               layerKind="detail", structuralRole="hem", measurementRole="none",
               outline=[[.2,.85],[.78,.83],[.78,.85],[.2,.87]], bounds=[.2,.83,.78,.87], seed=[.5,.85])
    manifest["regions"].append(hem)
    for side, x, y, partner in [("left", .25, .19, "right-clasp"), ("right", .65, .21, "left-clasp")]:
        clasp = copy.deepcopy(hem)
        clasp.update(id=f"{side}-clasp", semanticType="panel", material="metal", structuralRole="buckle",
                     symmetryPartner=partner, outline=[[x,y],[x+.1,y],[x+.1,y+.08],[x,y+.08]],
                     bounds=[x,y,x+.1,y+.08], seed=[x+.01,y+.01],
                     boundary={"boundaryType":"hardware-edge", "confidence":.95, "evidence":"Visible clasp frame"},
                     cutouts=[{"id":f"{side}-slot", "outline":[[x+.025,y+.02],[x+.075,y+.02],[x+.075,y+.06],[x+.025,y+.06]],
                               "confidence":.95, "evidence":"Visible open slot"}])
        manifest["regions"].append(clasp)
    return photo, validate_manifest(manifest)


class TechnicalFlatTests(unittest.TestCase):
    def test_clean_projection_supports_other_families_and_asymmetric_designs(self):
        _, manifest = technical_fixture()
        self.assertTrue(supports_technical_flat(manifest))
        for patch_values in [{"view":"back"}, {"garmentType":"jacket"}, {"garmentType":"trousers"},
                             {"garmentType":"hoodie"}, {"construction":"Asymmetric one-shoulder tank"}, {"subtype":"crew-neck vest"}]:
            self.assertTrue(supports_technical_flat({**manifest, **patch_values}))

    def test_jacket_pairs_are_balanced_without_duplicating_one_sided_features(self):
        photo, source = jacket_fixture()
        before = copy.deepcopy(source)
        _, aligned = frame_source(photo, source)
        projected = project_manifest(aligned)
        by_id = {region["id"]: region for region in projected["regions"]}
        body = by_id["body"]
        axis = sum(next(region for region in aligned["regions"] if region["id"] == "body")["bounds"][::2]) / 2
        left, right = by_id["left-sleeve"], by_id["right-sleeve"]
        reflected = np.asarray(left["outline"])[::-1].copy()
        reflected[:, 0] = 2 * axis - reflected[:, 0]
        np.testing.assert_allclose(reflected, right["outline"], atol=1e-8)
        self.assertEqual(source, before)
        self.assertEqual(set(by_id), {region["id"] for region in source["regions"]})
        pocket = by_id["left-sleeve-pocket"]
        self.assertEqual(pocket["attachmentTo"], left["id"])
        self.assertIsNone(pocket["symmetryPartner"])
        pocket_mask = outline_mask(pocket, (512, 512))
        self.assertGreater((pocket_mask & outline_mask(left, (512, 512))).sum() / pocket_mask.sum(), .98)
        self.assertEqual(body["semanticType"], "body")

    def test_pairing_does_not_create_a_false_attachment_cycle(self):
        photo, source = jacket_fixture()
        regions = {region["id"]: region for region in source["regions"]}
        regions["right-sleeve"]["attachmentTo"] = "left-sleeve-pocket"
        validate_manifest(source)
        _, aligned = frame_source(photo, source)
        projected = project_manifest(aligned)
        self.assertEqual([region["attachmentTo"] for region in projected["regions"]],
                         [region["attachmentTo"] for region in source["regions"]])

    def test_children_can_precede_their_paired_parents(self):
        photo, source = jacket_fixture()
        source["regions"] = list(reversed(source["regions"]))
        _, aligned = frame_source(photo, source)
        projected = project_manifest(aligned)
        pocket = next(region for region in projected["regions"] if region["id"] == "left-sleeve-pocket")
        sleeve = next(region for region in projected["regions"] if region["id"] == "left-sleeve")
        mask = outline_mask(pocket, (512, 512))
        self.assertGreater((mask & outline_mask(sleeve, (512, 512))).sum() / mask.sum(), .98)

    def test_intentional_asymmetry_is_cleaned_not_mirrored(self):
        photo, source = jacket_fixture()
        source["construction"] = "Intentional asymmetric sleeves and offset closure"
        _, aligned = frame_source(photo, source)
        projected = project_manifest(aligned)
        left, right = [next(region for region in projected["regions"] if region["id"] == identifier)
                       for identifier in ("left-sleeve", "right-sleeve")]
        self.assertGreater(right["bounds"][1] - left["bounds"][1], .01)

    def test_generic_projection_keeps_hardware_dimensions_and_slots(self):
        photo, source = technical_fixture()
        source.update(garmentType="jacket", subtype="jacket with two clasps")
        _, aligned = frame_source(photo, source)
        projected = project_manifest(aligned)
        for old, new in zip(aligned["regions"][-2:], projected["regions"][-2:]):
            np.testing.assert_allclose(np.diff(old["outline"], axis=0), np.diff(new["outline"], axis=0), atol=1e-10)
            np.testing.assert_allclose(np.diff(old["cutouts"][0]["outline"], axis=0),
                                       np.diff(new["cutouts"][0]["outline"], axis=0), atol=1e-10)
        validate_manifest(projected)

    def test_bodyless_and_back_garments_use_generic_projection(self):
        photo, source = jacket_fixture()
        source.update(garmentType="trousers", view="back", subtype="synthetic paired leg panels")
        for region in source["regions"]:
            if region["semanticType"] == "body":
                region["semanticType"] = "panel"
        _, mapped, (masks, _, _, _) = segment_technical(photo, source, 256)
        self.assertEqual(mapped["view"], "back")
        self.assertEqual(len(masks), len(source["regions"]))
        self.assertTrue(all(mask.any() for mask in masks))

    def test_jacket_svg_uses_clean_stroked_contours_and_real_curves(self):
        import xml.etree.ElementTree as ET
        photo, manifest = jacket_fixture()
        buffer = io.BytesIO(); photo.save(buffer, format="PNG")
        with patch("asset_providers.AstraProvider") as provider, contextlib.redirect_stdout(io.StringIO()):
            provider.return_value.analyzeGarment.return_value = manifest
            result = reconstruct(buffer.getvalue())
        for part in result["parts"]:
            fill = ET.fromstring(part["svg"]).find(".//{*}path")
            strokes = [path for path in ET.fromstring(part["constructionSvg"]).findall(".//{*}path") if path.get("stroke")]
            self.assertEqual(len(strokes), 1)
            self.assertEqual(strokes[0].get("d"), fill.get("d"))
            self.assertEqual(strokes[0].get("fill"), "none")
            self.assertEqual(strokes[0].get("stroke-width"), "28")
            self.assertRegex(fill.get("d"), "[cC]")
        self.assertTrue(all(part["view"] == "front" for part in result["parts"]))

    def test_balancing_preserves_source_crop_and_construction_identity(self):
        photo, source = technical_fixture()
        before = copy.deepcopy(source)
        _, original = frame_source(photo, source)
        projected = project_manifest(original)
        self.assertEqual(source, before)
        for old, new in zip(original["regions"], projected["regions"]):
            for key in ["id", "attachmentTo", "symmetryPartner", "evidence", "boundary", "semanticType"]:
                self.assertEqual(old[key], new[key])
            self.assertLessEqual(len(new["outline"]), 256)
            points = np.asarray(new["outline"])
            np.testing.assert_allclose(new["bounds"], np.r_[points.min(axis=0),points.max(axis=0)])
        a, b = [outline_mask(item["regions"][1], (512,512)) for item in (original, projected)]
        self.assertGreater((a & b).sum()/(a | b).sum(), .85)
        np.testing.assert_allclose(original["regions"][1]["bounds"], projected["regions"][1]["bounds"], atol=.035)

    def test_balancing_accepts_either_source_polygon_winding(self):
        left = [[.2,.2],[.3,.2],[.3,.8],[.2,.8]]
        right = [[.8,.2],[.7,.2],[.7,.8],[.8,.8]]
        expected = outline_mask({'outline':left}, (512,512))
        for polygon in (right, right[::-1]):
            projected = balanced(left, polygon, .5)
            mask = outline_mask({'outline':projected.tolist()}, (512,512))
            self.assertGreater((expected & mask).sum()/(expected | mask).sum(), .98,
                               'Reversed source winding must not collapse or cross a narrow binding')

    def test_symmetric_hardware_preserves_real_slots(self):
        photo, manifest = technical_fixture()
        _, projected, (masks, _, _, _) = segment_technical(photo, manifest, 512)
        axis = sum(projected["regions"][1]["bounds"][::2])/2
        left, right = projected["regions"][-2:]
        reflected = np.asarray(left["outline"])[::-1].copy()
        reflected[:,0] = 2*axis-reflected[:,0]
        np.testing.assert_allclose(reflected, right["outline"], atol=.001)
        for region, mask in zip(projected["regions"][-2:], masks[-2:]):
            self.assertEqual(len(region["cutouts"]), 1)
            slot = outline_mask(region["cutouts"][0], (512,512))
            self.assertFalse((slot & mask).any())
            self.assertTrue(mask.any())

    def test_paired_clasp_hinges_keep_their_observed_side(self):
        photo, manifest = technical_fixture()
        for clasp in manifest['regions'][-2:]:
            x, y, _, _ = clasp['bounds']
            clasp['visibleEdges'] = [{'id':clasp['id']+'-hinge',
                'points':[[x+.087,y+.012],[x+.087,y+.066]], 'boundaryType':'hardware-edge',
                'style':'solid', 'confidence':.95, 'evidence':'The same manufactured clasp has a right-side hinge'}]
        _, projected, (masks, _, _, _) = segment_technical(photo, validate_manifest(manifest), 512)
        for clasp, mask in zip(projected['regions'][-2:], masks[-2:]):
            edge = clasp['visibleEdges'][0]
            self.assertGreater(np.asarray(edge['points'])[:,0].mean(), (clasp['bounds'][0]+clasp['bounds'][2])/2)
            ink, _ = detail_ink(clasp, (512,512))
            self.assertGreater((ink & ndimage.binary_dilation(mask)).sum()/ink.sum(), .95,
                               'A visible hinge must not be averaged into the open slot and disappear')

    def test_hem_is_level_and_openings_are_not_filled(self):
        photo, manifest = technical_fixture()
        _, projected, (masks, _, _, _) = segment_technical(photo, manifest, 512)
        body = masks[1]
        xs = np.flatnonzero(body.any(axis=0))
        bottom = [np.flatnonzero(body[:,x])[-1] for x in xs[len(xs)//5:-len(xs)//5]]
        self.assertLessEqual(max(bottom)-min(bottom), 3)
        self.assertFalse(body[:int(projected["regions"][1]["bounds"][1]*511),256].any())
        self.assertTrue(masks[0].any(), "Visible inner-back fabric must not become a hole")

    def test_photo_shadows_print_and_texture_do_not_supply_ink(self):
        photo, manifest = technical_fixture()
        dirty = photo.copy()
        pen = ImageDraw.Draw(dirty)
        pen.rectangle((20,90,290,340), fill="black")
        pen.text((150,150), "PRINT", fill="white")
        first = segment_technical(photo, manifest, 256)
        second = segment_technical(dirty, manifest, 256)
        for a,b in zip(first[2][:3],second[2][:3]):
            np.testing.assert_array_equal(a,b)

    def test_hidden_rear_edge_does_not_draw_across_front(self):
        photo, manifest = technical_fixture()
        _, projected, (masks, contours, _, _) = segment_technical(photo, manifest, 512)
        rear_edge = masks[0] & ~ndimage.binary_erosion(masks[0])
        hidden = rear_edge & ndimage.binary_erosion(masks[1],iterations=5)
        for overlay in masks[2:]:
            hidden &= ~ndimage.binary_dilation(overlay,iterations=3)
        self.assertTrue(hidden.any())
        self.assertFalse((contours & hidden).any())

    def test_short_shoulder_join_follows_balanced_fabric_without_mirroring_missing_evidence(self):
        photo, manifest = technical_fixture()
        for side, x, y, partner in [('left', .24, .10, 'right-strap'), ('right', .68, .16, 'left-strap')]:
            strap = copy.deepcopy(manifest['regions'][2])
            strap.update(id=f'{side}-strap', semanticType='panel', structuralRole='shoulder-strap',
                         symmetryPartner=partner, outline=[[x,y],[x+.05,y],[x+.05,y+.15],[x,y+.15]],
                         bounds=[x,y,x+.05,y+.15], seed=[x+.025,y+.075], cutouts=[], visibleEdges=[])
            if side == 'left':
                strap['visibleEdges'] = [{'id':'left-short-join', 'points':[[x+.025,y+.008],[x+.025,y+.14]],
                    'boundaryType':'seam', 'style':'solid', 'confidence':.95,
                    'evidence':'Visible short sewn shoulder join from neckline to fastening'}]
            manifest['regions'].append(strap)
        _, framed = frame_source(photo, validate_manifest(manifest))
        projected = project_manifest(framed)
        left, right = projected['regions'][-2:]
        self.assertEqual(right['visibleEdges'], [], 'Missing source evidence must not be mirrored into a new seam')
        self.assertEqual(left['visibleEdges'][0]['id'], 'left-short-join')
        ink, _ = detail_ink(left, (512,512))
        mask = outline_mask(left, (512,512))
        self.assertGreater(ink.sum(), 20)
        self.assertGreater((ink & ndimage.binary_dilation(mask)).sum()/ink.sum(), .98,
                           'Balancing fabric must not leave its short join outside the mask where clipping deletes it')

    def test_ribs_are_even_presentational_paths_inside_fabric(self):
        photo, manifest = technical_fixture()
        _, _, (masks, _, _, _) = segment_technical(photo, manifest, 256)
        mask = masks[1]
        paths = rib_paths(mask)
        self.assertGreater(len(paths), 100)
        xs = set()
        for x,start,end in re.findall(r"M([\d.]+),([\d.]+)V([\d.]+)", paths):
            x,start,end = map(float,(x,start,end))
            xs.add(x)
            self.assertTrue(mask[int((start+end)/2*256/2048),int(x*256/2048)])
        self.assertEqual(len(set(np.diff(sorted(xs)))), 1)

    def test_reconstruct_selects_technical_path_and_ribs_are_not_seams(self):
        photo, manifest = technical_fixture()
        image = io.BytesIO(); photo.save(image,format="PNG")
        with patch("asset_providers.AstraProvider") as provider, patch("garment_source_geometry.segment_source", side_effect=AssertionError("Photo snapping must not run")), contextlib.redirect_stdout(io.StringIO()):
            provider.return_value.analyzeGarment.return_value = manifest
            result = reconstruct(image.getvalue())
        self.assertFalse(result["accepted"])
        self.assertTrue(any('data-texture="rib"' in part["svg"] for part in result["parts"]))
        self.assertFalse(any('data-texture="rib"' in part["constructionSvg"] for part in result["parts"]))
        self.assertTrue(any("Technical flat" in note for note in result["reviewNotes"]))


if __name__ == "__main__":
    unittest.main()
