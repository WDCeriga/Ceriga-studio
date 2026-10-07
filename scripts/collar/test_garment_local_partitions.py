"""Offline source-evidence, coverage and short-gap recovery regressions."""
from __future__ import annotations

import unittest

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from garment_local_partitions import recover_partitions


class LocalPartitionTests(unittest.TestCase):
    @staticmethod
    def fixture(gap=3, open_silhouette=False):
        image = Image.new("1", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((180, 180, 840, 900), outline=1, width=3)
        # Shaped pocket: its diagonal opening and corners are real ink, not a box.
        draw.line([(330, 700), (410, 550), (620, 550), (670, 700), (620, 800), (360, 800), (330, 700)], fill=1, width=3)
        if gap:
            draw.rectangle((505, 548, 505 + gap - 1, 552), fill=0)
        if open_silhouette:
            draw.rectangle((505, 178, 505 + gap - 1, 184), fill=0)
        ink = np.asarray(image, dtype=bool)
        labels, _ = ndimage.label(~ink)
        border = set(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
        eligible = [i for i in range(1, int(labels.max()) + 1) if i not in border]
        return ink, labels, eligible

    def test_small_gap_recovers_shaped_pocket_without_losing_original_pixels(self):
        ink, labels, eligible = self.fixture()
        self.assertEqual(len(eligible), 1)
        before = ink.copy()
        result, evidence = recover_partitions(ink, labels, eligible)
        self.assertEqual(len(evidence), 2)
        np.testing.assert_array_equal(ink, before)
        np.testing.assert_array_equal(result == 0, labels == 0)
        np.testing.assert_array_equal(np.isin(result, list(evidence)), labels == eligible[0])
        pocket = result == result[680, 500]
        self.assertFalse(pocket[555, 335])
        self.assertTrue(pocket[680, 500])
        self.assertFalse(pocket[500, 500])
        self.assertTrue(all(item["maximumGapPixels"] <= 6 for item in evidence.values()))
        repeated, repeated_evidence = recover_partitions(ink, labels, eligible)
        np.testing.assert_array_equal(result, repeated)
        self.assertEqual(evidence, repeated_evidence)

    def test_large_missing_boundary_not_fabricated(self):
        ink, labels, eligible = self.fixture(gap=24)
        result, evidence = recover_partitions(ink, labels, eligible)
        self.assertEqual(evidence, {})
        np.testing.assert_array_equal(result, labels)

    def test_silhouette_never_repaired(self):
        ink, labels, eligible = self.fixture(open_silhouette=True)
        self.assertEqual(eligible, [])
        result, evidence = recover_partitions(ink, labels, eligible)
        self.assertEqual(evidence, {})
        np.testing.assert_array_equal(result, labels)

    def test_complete_cells_unchanged(self):
        ink, labels, eligible = self.fixture(gap=0)
        result, evidence = recover_partitions(ink, labels, eligible)
        self.assertEqual(evidence, {})
        np.testing.assert_array_equal(result, labels)


if __name__ == "__main__":
    unittest.main()
