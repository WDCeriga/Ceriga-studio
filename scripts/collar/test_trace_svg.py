import re
import unittest
import xml.etree.ElementTree as ET
from unittest.mock import patch

import numpy as np
from PIL import Image

import trace_svg as tracer


class TraceSvgTests(unittest.TestCase):
    def test_single_upsample_polarity_and_placement(self):
        mask = np.zeros((32, 48), dtype=bool)
        mask[4:12, 6:18] = True
        with patch.object(tracer, "_run_potrace", wraps=tracer._run_potrace) as run:
            path = tracer.trace(mask)
        self.assertEqual(run.call_args.args[0].shape, (96, 144))
        self.assertEqual(path.count("M"), 1)
        coordinates = np.array(re.findall(r"-?\d+(?:\.\d+)?", path), dtype=float).reshape(-1, 2) / 10
        np.testing.assert_allclose(coordinates.min(axis=0), [256, 1194.7], atol=1)
        np.testing.assert_allclose(coordinates.max(axis=0), [768, 1536], atol=1)

    def test_holes_empty_masks_and_curves(self):
        mask = np.zeros((60, 80), dtype=bool)
        rows, columns = np.indices(mask.shape)
        distance = (columns - 28) ** 2 + (rows - 20) ** 2
        mask[(distance < 225) & (distance > 36)] = True
        path = tracer.trace(mask)
        self.assertEqual(path.count("M"), 2)
        self.assertIn("C", path)
        self.assertEqual(tracer.trace(np.zeros_like(mask)), "")

    def test_relative_curves(self):
        path = tracer._transform_svg_path_d("M30 60 c30 0 60 30 90 60 l30 0z", (2048, 2048))
        self.assertEqual(path, "M10 20 C20 20 30 30 40 40 L50 40 Z")

    def test_source_dimensions_and_evenodd(self):
        alpha = Image.new("L", (48, 32))
        alpha.paste(255, (6, 4, 18, 12))
        with patch.object(tracer, "_run_potrace", wraps=tracer._run_potrace) as run:
            root = ET.fromstring(tracer.source_svg("Test", alpha))
        self.assertEqual(root.attrib["viewBox"], "0 0 48 32")
        self.assertEqual(run.call_args.args[0].shape, (96, 144))
        path = root.find(".//{http://www.w3.org/2000/svg}path")
        self.assertEqual(path.attrib["fill-rule"], "evenodd")

    def test_luminance_ramp(self):
        image = Image.fromarray(np.array([[0, 120, 183, 246, 255]], dtype=np.uint8))
        alpha = np.asarray(tracer.to_transparent(image))[:, :, 3]
        np.testing.assert_array_equal(alpha, [[255, 255, 128, 0, 0]])


if __name__ == "__main__":
    unittest.main()