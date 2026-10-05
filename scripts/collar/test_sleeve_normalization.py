import unittest
import contextlib
import io
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from sleeve_normalization import edge_center, normalize_sleeve, registration_raster


class SleeveNormalizationTests(unittest.TestCase):
    def test_cuff_classification_uses_cuff_evidence(self):
        from asset_providers import ReferenceAnalysis
        from sleeve_style import detect_sleeve_style

        normalization = {"validation": {"armholeWidth": 160, "length": 460, "openingWidth": 86}, "landmarks": {"cuff": [[72, 485], [158, 485]]}}
        for description, expected in (("Long sleeve with ribbed neckline, elbow folds and smooth band cuffs", "band"),
                                      ("Long sleeve with folds and no separate cuff", "plain"),
                                      ("Long sleeve with ribbed cuffs", "ribbed"), ("Long sleeve with rolled cuffs", "rolled"),
                                      ("Long sleeve with elasticated cuffs", "elastic")):
            with self.subTest(description=description):
                analysis = ReferenceAnalysis("sleeve", "Sleeve", description, "local")
                self.assertEqual(detect_sleeve_style(normalization, analysis, {})["cuffStyle"], expected)
        evidence = {"style": "band", "confidence": "high", "evidence": "Smooth deep band with curved join and opening, no ribs."}
        analysis = ReferenceAnalysis("sleeve", "Sleeve", "Ribbed neckline and sleeve folds", "local", sleeve_guidance={"cuffConstruction": evidence})
        result = detect_sleeve_style(normalization, analysis, {})
        self.assertEqual(result["cuffStyle"], "band")
        self.assertEqual(result["sourceCuff"], evidence)
        with self.assertRaisesRegex(ValueError, "cuff construction"):
            detect_sleeve_style(normalization, ReferenceAnalysis("sleeve", "Sleeve", "Sleeve", "local"), {"cuffConstruction": {"style": "invented"}})

    def test_reference_normalizes_once_before_both_registrations(self):
        import custom_asset_pipeline as pipeline
        from asset_providers import ReferenceAnalysis

        source = Image.open(Path(__file__).parent / "refs/sleeve-isolation-tee.jpg").convert("RGB")
        points = {"outline": [[156, 141], [15, 417], [185, 516], [199, 494], [202, 400], [203, 303], [201, 232]],
                  "armhole": [[156, 141], [201, 232], [203, 303], [202, 400], [199, 494]], "cuff": [[15, 417], [185, 516]]}
        source.info["sleeveGuidance"] = {**{key: (np.array(value) / source.size).tolist() for key, value in points.items()}, "confidence": "high", "side": "left"}
        provider = Mock()
        provider.generateTechnicalRaster.return_value = source
        request = {"category": "sleeve", "source": "drawing", "side": "left", "selectionMode": "both", "fit": "slim", "garmentType": "tshirt", "view": "front"}
        analysis = ReferenceAnalysis("sleeve", "Reference sleeve", "Supplied drawing", "local")
        output = {"svg": "stub", "keepSvg": "stub"}
        with contextlib.redirect_stdout(io.StringIO()), patch.object(pipeline, "normalize_sleeve", wraps=normalize_sleeve) as normalize, patch.object(pipeline.PROFILES["sleeve"], "register", return_value=output) as register, patch.object(pipeline, "validate_svg"), patch.object(pipeline, "validate_render"):
            result = pipeline.process_part(source, request, provider, analysis)
            normalize.assert_called_once()
            provider.generateTechnicalRaster.assert_called_once()
            self.assertEqual([call.args[1]["side"] for call in register.call_args_list], ["left", "right"])
            self.assertIs(register.call_args_list[0].args[0], register.call_args_list[1].args[0])
            self.assertEqual(result["cleanDrawing"], result["oppositeSleeve"]["cleanDrawing"])
            self.assertNotEqual(result["cleanDrawing"], result["sleeveIsolation"]["rawIsolation"])
            self.assertEqual(result["sleeveIsolation"]["normalization"]["validation"]["status"], "passed")
        with contextlib.redirect_stdout(io.StringIO()), patch.object(pipeline, "normalize_sleeve", side_effect=ValueError("Distorted normalization")), patch.object(pipeline.PROFILES["sleeve"], "register") as register:
            with self.assertRaisesRegex(ValueError, "Distorted normalization"):
                pipeline.process_part(source, request, provider, analysis)
            register.assert_not_called()

    def test_pose_and_shape_matrix(self):
        shapes = {
            "straight": [(130, 110), (290, 110), (290, 320), (130, 320)],
            "tapered": [(110, 110), (310, 110), (270, 320), (150, 320)],
            "flared": [(150, 110), (270, 110), (310, 320), (110, 320)],
            "angled-hem": [(110, 110), (310, 110), (285, 350), (135, 300)],
            "cap": [(110, 160), (310, 160), (275, 240), (145, 240)],
        }
        for name, outline in shapes.items():
            image = Image.new("RGB", (440, 440), "white")
            pen = ImageDraw.Draw(image)
            pen.polygon(outline, outline="black", width=3)
            pen.line([(outline[3][0], outline[3][1] - 12), (outline[2][0], outline[2][1] - 12)], fill="black", width=3)
            edges = {"armhole": np.array(outline[:2], dtype=float), "cuff": np.array([outline[3], outline[2]], dtype=float)}
            baseline, baseline_metadata = normalize_sleeve(image, **edges)
            for angle in (0, 35, 85, 110):
                radians = np.deg2rad(angle)
                rotation = np.array([[np.cos(radians), np.sin(radians)], [-np.sin(radians), np.cos(radians)]])
                posed = image.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC, fillcolor="white")
                translation = (np.array(posed.size) - 1) / 2 - rotation @ ((np.array(image.size) - 1) / 2)
                transformed = {key: points @ rotation.T + translation for key, points in edges.items()}
                for side in ("left", "right"):
                    with self.subTest(shape=name, angle=angle, side=side):
                        source = posed
                        landmarks = {key: points.copy() for key, points in transformed.items()}
                        if side == "right":
                            source = ImageOps.mirror(source)
                            for points in landmarks.values():
                                points[:, 0] = source.width - 1 - points[:, 0]
                        normalized, metadata = normalize_sleeve(source, **landmarks)
                        axis = edge_center(np.array(metadata["landmarks"]["cuff"])) - edge_center(np.array(metadata["landmarks"]["armhole"]))
                        self.assertAlmostEqual(axis[0], 0, places=6)
                        self.assertGreater(axis[1], 0)
                        for key in ("length", "openingWidth", "armholeWidth"):
                            self.assertAlmostEqual(metadata["validation"][key], baseline_metadata["validation"][key], places=6)
                        self.assertGreater(metadata["validation"]["silhouetteIoU"], .95)
                        self.assertEqual(metadata["scale"], 1)
                        self.assertFalse(metadata["validation"]["clipped"])
                        comparable = ImageOps.mirror(normalized) if side == "right" else normalized
                        self.assertLessEqual(abs(comparable.width - baseline.width), 4)
                        self.assertLessEqual(abs(comparable.height - baseline.height), 4)
                        restored = registration_raster(normalized, side).transpose(Image.Transpose.ROTATE_90)
                        self.assertTrue(np.array_equal(np.asarray(restored), np.asarray(comparable)))

    def test_invalid_semantics_stop_normalization(self):
        image = Image.new("RGB", (100, 100), "white")
        for armhole, cuff in (([], []), ([[20, 20], [80, 20]], [[20, 20], [80, 20]]), ([[20, 20], [80, 20]], [[20, 120], [80, 120]])):
            with self.subTest(armhole=armhole, cuff=cuff), self.assertRaises(ValueError):
                normalize_sleeve(image, armhole, cuff)