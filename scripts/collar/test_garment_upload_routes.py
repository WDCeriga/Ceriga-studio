"""Offline upload routing tests; Azure is mocked, keying/Potrace are real."""
import copy
import unittest
from unittest.mock import Mock, patch

from PIL import Image

import garment_from_photo as upload
import garment_trace_only as trace
from test_garment_trace_only import fixture, image_bytes, from_url


class UploadRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.drawing = fixture()
        cls.drawing_bytes = image_bytes(cls.drawing)
        cls.photo_bytes = image_bytes(Image.new("RGB", (320, 400), (80, 100, 180)))
        cls.analysis = {"garmentType": "jacket", "material": "woven", "subtype": "asymmetric jacket",
                        "fit": "regular", "construction": "Asymmetric pockets, centre zip and stand collar",
                        "materialEvidence": "Unknown fibre", "confidence": .9, "uncertainties": []}

    def test_clean_auto_and_manual_never_create_provider(self):
        with patch("asset_providers.AstraProvider", side_effect=AssertionError("Clean source must stay local")), \
             patch.object(upload, "reconstruct", side_effect=AssertionError("Legacy reconstruction forbidden")):
            for mode in ("auto", "trace-only"):
                result = upload.process_upload(self.drawing_bytes, input_type=mode)
                self.assertEqual(result["processingMode"], "trace-only")
                self.assertFalse(result["process"]["externalServicesUsed"])
                self.assertEqual(from_url(result["tracePreview"]["sourceRaster"]).tobytes(), self.drawing.tobytes())
                self.assertEqual(result["manifest"]["frontView"]["processingMode"], "trace-only")

    def test_photo_analysis_then_redraw_then_shared_trace(self):
        stages = []
        provider = Mock()
        provider.analyzeGarment.side_effect = lambda photo: (stages.append("analyse") or copy.deepcopy(self.analysis))
        provider.raster.generateWholeGarmentRaster.side_effect = lambda photo, analysis, progress: (stages.append("redraw") or self.drawing.copy())
        real_trace = trace.trace_only

        def shared_trace(data, **kwargs):
            stages.append("trace")
            self.assertEqual(data, self.drawing_bytes, "Only the generated drawing, never the photograph, is traced")
            return real_trace(data, **kwargs)

        with patch("asset_providers.AstraProvider", return_value=provider), \
             patch.object(trace, "trace_only", side_effect=shared_trace), \
             patch.object(upload, "reconstruct", side_effect=AssertionError("Must not use legacy polygon reconstruction")):
            result = upload.process_upload(self.photo_bytes, input_type="photo", view="back")
        self.assertEqual(stages, ["analyse", "redraw", "trace"])
        provider.analyzeGarment.assert_called_once()
        provider.raster.generateWholeGarmentRaster.assert_called_once()
        self.assertEqual(result["source"], "azure-garment-reconstruction-v1", "Retain editor-compatible wire discriminator")
        self.assertEqual(result["processingMode"], "photo")
        self.assertEqual(result["inputDetection"]["mode"], "photo")
        self.assertEqual(result["manifest"]["garmentType"], "jacket")
        self.assertEqual(result["manifest"]["view"], "back")
        self.assertEqual(result["manifest"]["backView"]["processingMode"], "photo")
        self.assertEqual(result["sourceManifest"]["construction"], self.analysis["construction"])
        self.assertTrue(result["process"]["externalServicesUsed"])
        self.assertEqual(result["tracePreview"]["comparisonSource"], "technical-redraw")
        self.assertEqual(from_url(result["tracePreview"]["sourceRaster"]).size, (320, 400))
        self.assertEqual(from_url(result["tracePreview"]["technicalRaster"]).size, self.drawing.size)
        self.assertEqual(result["sourceImages"]["back"], result["sourceImage"])
        self.assertEqual(result["manifest"]["backView"]["sourceImage"], result["sourceImage"])
        self.assertEqual(result["manifest"]["backView"]["tracePreview"], result["tracePreview"])
        self.assertFalse(any("no reconstruction or semantic analysis" in note for note in result["reviewNotes"]))
        self.assertEqual(result["tracePreview"]["tracedSvg"], real_trace(self.drawing_bytes, view="back")["tracePreview"]["tracedSvg"])

    def test_photo_override_wins_even_for_clean_drawing(self):
        with patch.object(upload, "redraw_photo", return_value={"manifest": {"frontView": {}}, "tracePreview": {}}) as redraw:
            upload.process_upload(self.drawing_bytes, input_type="photo")
        redraw.assert_called_once_with(self.drawing_bytes, view="front")

    def test_photo_auto_routes_to_redraw(self):
        with patch.object(upload, "redraw_photo", return_value={"manifest": {"frontView": {}}, "tracePreview": {}}) as redraw:
            result = upload.process_upload(self.photo_bytes)
        redraw.assert_called_once()
        self.assertEqual(result["inputDetection"]["mode"], "photo")

    def test_provider_failure_never_falls_back_to_source_photo_trace(self):
        provider = Mock()
        provider.analyzeGarment.side_effect = RuntimeError("Unavailable")
        with patch("asset_providers.AstraProvider", return_value=provider), patch.object(trace, "trace_only") as shared_trace:
            with self.assertRaisesRegex(RuntimeError, "Unavailable"):
                upload.process_upload(self.photo_bytes, input_type="photo")
        shared_trace.assert_not_called()
        provider.raster.generateWholeGarmentRaster.assert_not_called()

    def test_invalid_route_stops_before_provider(self):
        with patch("asset_providers.AstraProvider", side_effect=AssertionError("Must not start provider")):
            for kwargs in ({"input_type": "unknown"}, {"view": "side"}):
                with self.assertRaises(upload.GarmentError):
                    upload.process_upload(self.photo_bytes, **kwargs)


if __name__ == "__main__":
    unittest.main()
