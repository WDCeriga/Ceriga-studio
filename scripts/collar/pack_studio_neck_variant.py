"""Pack a neck-variant line art without overwriting the fit's default parts.

Writes only Body / Neck / Inner back neck / Outline / Stitching under the
variant names. Sleeves, cuffs, and hem from the fit's default pack stay on
disk; they are still seeded so those regions are not swallowed by Body.

Usage:
  python scripts/collar/pack_studio_neck_variant.py slim-crew --probe
  python scripts/collar/pack_studio_neck_variant.py slim-crew
  python scripts/collar/pack_studio_neck_variant.py boxy-vneck
  python scripts/collar/pack_studio_neck_variant.py regular-vneck
  python scripts/collar/pack_studio_neck_variant.py oversized-vneck
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import garment_regions as G  # noqa: E402
import trace_svg as T  # noqa: E402

ROOT = HERE.parents[1]
SRC = ROOT / "src" / "assets" / "studio-tshirt"

WRITE_CATEGORIES = {"Body", "Neck", "Inner back neck"}

PROOF_COLORS = {
    "Body": (20, 20, 20),
    "Left sleeve": (30, 90, 220),
    "Right sleeve": (0, 150, 90),
    "Body hem": (0, 200, 220),
    "Left cuff": (240, 140, 0),
    "Right cuff": (150, 60, 200),
    "Neck": (214, 40, 40),
    "Inner back neck": (180, 180, 200),
    "Stitching": (255, 255, 255),
}

VARIANTS: dict[str, dict] = {
    "slim-crew": {
        "art": "slim-crew-composite-bold.png",
        "keyed": "slim-crew-lineart-transparent.png",
        "proof": "slim-crew-closed-regions.png",
        "fill_proof": "slim-crew-fill-proof.png",
        "title": "Slim crew t-shirt",
        "band_width": 62,
        "outline": "Outline crew",
        "stitch": "Cover stitch crew",
        "seeds": [
            {"category": "Body", "asset": "Body crew", "seeds": [[507, 1071], [352, 170], [749, 204]]},
            {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
            {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
            {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
            {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
            {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
            {
                "category": "Neck",
                "asset": "Crew neck",
                "seeds": [[602, 272], [426, 177], [378, 250]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck crew", "seeds": [[485, 254]]},
        ],
    },
    "boxy-vneck": {
        "art": "boxy-vneck-composite-bold.png",
        "keyed": "boxy-vneck-lineart-transparent.png",
        "proof": "boxy-vneck-closed-regions.png",
        "fill_proof": "boxy-vneck-fill-proof.png",
        "title": "Boxy V-neck t-shirt",
        "outline": "Outline V-neck (boxy)",
        "stitch": "Cover stitch V-neck (boxy)",
        "seeds": [
            {"category": "Body", "asset": "Body V-neck (boxy)", "seeds": [[510, 732]]},
            {"category": "Left sleeve", "asset": "Left sleeve (boxy)", "seeds": [[128, 556]]},
            {"category": "Right sleeve", "asset": "Right sleeve (boxy)", "seeds": [[894, 556]]},
            {"category": "Body hem", "asset": "Body hem (boxy)", "seeds": [[227, 1302]]},
            {
                "category": "Left cuff",
                "asset": "Left cuff (boxy)",
                "seeds": [[44, 631], [116, 674], [175, 703]],
            },
            {
                "category": "Right cuff",
                "asset": "Right cuff (boxy)",
                "seeds": [[872, 695], [927, 656], [986, 627]],
            },
            {
                "category": "Neck",
                "asset": "V-neck (boxy)",
                "seeds": [
                    [614, 226],
                    [504, 389],
                    [405, 223],
                    [441, 298],
                    [540, 365],
                    [588, 289],
                    [463, 333],
                    [566, 326],
                    [476, 223],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck V-neck (boxy)", "seeds": [[512, 288]]},
        ],
    },
    "regular-vneck": {
        "art": "regular-vneck-composite-bold.png",
        "keyed": "regular-vneck-lineart-transparent.png",
        "proof": "regular-vneck-closed-regions.png",
        "fill_proof": "regular-vneck-fill-proof.png",
        "title": "Regular V-neck t-shirt",
        "outline": "Outline V-neck (regular)",
        "stitch": "Cover stitch V-neck (regular)",
        "seeds": [
            {
                "category": "Body",
                "asset": "Body V-neck (regular)",
                "seeds": [[511, 781], [833, 411], [190, 410]],
            },
            {"category": "Left sleeve", "asset": "Left sleeve (regular)", "seeds": [[150, 617]]},
            {"category": "Right sleeve", "asset": "Right sleeve (regular)", "seeds": [[872, 616]]},
            {"category": "Body hem", "asset": "Body hem (regular)", "seeds": [[245, 1216]]},
            {"category": "Left cuff", "asset": "Left cuff (regular)", "seeds": [[56, 676]]},
            {"category": "Right cuff", "asset": "Right cuff (regular)", "seeds": [[936, 690]]},
            {
                "category": "Neck",
                "asset": "V-neck (regular)",
                "seeds": [
                    [425, 282],
                    [573, 291],
                    [496, 301],
                    [547, 456],
                    [580, 417],
                    [484, 445],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck V-neck (regular)", "seeds": [[518, 382]]},
        ],
    },
    "oversized-vneck": {
        "art": "oversized-vneck-composite-bold.png",
        "keyed": "oversized-vneck-lineart-transparent.png",
        "proof": "oversized-vneck-closed-regions.png",
        "fill_proof": "oversized-vneck-fill-proof.png",
        "title": "Oversized V-neck t-shirt",
        "outline": "Outline V-neck (oversized)",
        "stitch": "Cover stitch V-neck (oversized)",
        "seeds": [
            {"category": "Body", "asset": "Body V-neck (oversized)", "seeds": [[511, 923]]},
            {"category": "Left sleeve", "asset": "Left sleeve (oversized)", "seeds": [[133, 645]]},
            {"category": "Right sleeve", "asset": "Right sleeve (oversized)", "seeds": [[889, 645]]},
            {"category": "Body hem", "asset": "Body hem (oversized)", "seeds": [[241, 1235]]},
            {"category": "Left cuff", "asset": "Left cuff (oversized)", "seeds": [[34, 706]]},
            {"category": "Right cuff", "asset": "Right cuff (oversized)", "seeds": [[823, 793]]},
            {
                "category": "Neck",
                "asset": "V-neck (oversized)",
                "seeds": [[609, 279], [495, 457], [451, 287], [603, 273]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck V-neck (oversized)", "seeds": [[512, 368]]},
        ],
    },
    "slim-scoop": {
        "art": "slim-scoop-composite-bold.png",
        "keyed": "slim-scoop-lineart-transparent.png",
        "proof": "slim-scoop-closed-regions.png",
        "fill_proof": "slim-scoop-fill-proof.png",
        "title": "Slim scoop t-shirt",
        "band_width": 62,
        "outline": "Outline scoop",
        "stitch": "Cover stitch scoop",
        "seeds": [
            {"category": "Body", "asset": "Body scoop", "seeds": [[507, 1071]]},
            {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
            {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
            {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
            {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
            {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
            {"category": "Neck", "asset": "Scoop neck", "seeds": [[506, 410], [397, 217], [628, 213], [452, 154]]},
            {"category": "Inner back neck", "asset": "Inner back neck scoop", "seeds": [[512, 250]]},
        ],
    },
    "regular-scoop": {
        "art": "regular-scoop-composite-bold.png",
        "keyed": "regular-scoop-lineart-transparent.png",
        "proof": "regular-scoop-closed-regions.png",
        "fill_proof": "regular-scoop-fill-proof.png",
        "title": "Regular scoop t-shirt",
        "outline": "Outline Scoop neck (regular)",
        "stitch": "Cover stitch Scoop neck (regular)",
        "seeds": [
            {"category": "Body", "asset": "Body Scoop neck (regular)", "seeds": [[511, 781], [833, 411], [190, 410]]},
            {"category": "Left sleeve", "asset": "Left sleeve (regular)", "seeds": [[150, 617]]},
            {"category": "Right sleeve", "asset": "Right sleeve (regular)", "seeds": [[872, 616]]},
            {"category": "Body hem", "asset": "Body hem (regular)", "seeds": [[245, 1216]]},
            {"category": "Left cuff", "asset": "Left cuff (regular)", "seeds": [[56, 676]]},
            {"category": "Right cuff", "asset": "Right cuff (regular)", "seeds": [[936, 690]]},
            {"category": "Neck", "asset": "Scoop neck (regular)", "seeds": [[507, 556], [507, 307]]},
            {"category": "Inner back neck", "asset": "Inner back neck Scoop neck (regular)", "seeds": [[514, 421]]},
        ],
    },
    "boxy-scoop": {
        "art": "boxy-scoop-composite-bold.png",
        "keyed": "boxy-scoop-lineart-transparent.png",
        "proof": "boxy-scoop-closed-regions.png",
        "fill_proof": "boxy-scoop-fill-proof.png",
        "title": "Boxy scoop t-shirt",
        "outline": "Outline Scoop neck (boxy)",
        "stitch": "Cover stitch Scoop neck (boxy)",
        "seeds": [
            {"category": "Body", "asset": "Body Scoop neck (boxy)", "seeds": [[510, 726]]},
            {"category": "Left sleeve", "asset": "Left sleeve (boxy)", "seeds": [[128, 556]]},
            {"category": "Right sleeve", "asset": "Right sleeve (boxy)", "seeds": [[894, 556]]},
            {"category": "Body hem", "asset": "Body hem (boxy)", "seeds": [[227, 1302]]},
            {
                "category": "Left cuff",
                "asset": "Left cuff (boxy)",
                "seeds": [[44, 631], [116, 674], [175, 703]],
            },
            {
                "category": "Right cuff",
                "asset": "Right cuff (boxy)",
                "seeds": [[872, 695], [927, 656], [986, 627]],
            },
            {
                "category": "Neck",
                "asset": "Scoop neck (boxy)",
                "seeds": [[529, 382], [485, 377], [431, 314], [601, 297], [611, 223], [403, 244]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Scoop neck (boxy)", "seeds": [[512, 278]]},
        ],
    },
    "oversized-scoop": {
        "art": "oversized-scoop-composite-bold.png",
        "keyed": "oversized-scoop-lineart-transparent.png",
        "proof": "oversized-scoop-closed-regions.png",
        "fill_proof": "oversized-scoop-fill-proof.png",
        "title": "Oversized scoop t-shirt",
        "outline": "Outline Scoop neck (oversized)",
        "stitch": "Cover stitch Scoop neck (oversized)",
        "seeds": [
            {"category": "Body", "asset": "Body Scoop neck (oversized)", "seeds": [[511, 923]]},
            {"category": "Left sleeve", "asset": "Left sleeve (oversized)", "seeds": [[133, 645]]},
            {"category": "Right sleeve", "asset": "Right sleeve (oversized)", "seeds": [[889, 645]]},
            {"category": "Body hem", "asset": "Body hem (oversized)", "seeds": [[241, 1235]]},
            {"category": "Left cuff", "asset": "Left cuff (oversized)", "seeds": [[34, 706]]},
            {"category": "Right cuff", "asset": "Right cuff (oversized)", "seeds": [[823, 793]]},
            {"category": "Neck", "asset": "Scoop neck (oversized)", "seeds": [[464, 530], [475, 299], [486, 273]]},
            {"category": "Inner back neck", "asset": "Inner back neck Scoop neck (oversized)", "seeds": [[508, 410]]},
        ],
    },
    "slim-deep-vneck": {
        "art": "slim-deep-vneck-composite-bold.png",
        "keyed": "slim-deep-vneck-lineart-transparent.png",
        "proof": "slim-deep-vneck-closed-regions.png",
        "fill_proof": "slim-deep-vneck-fill-proof.png",
        "title": "Slim deep V-neck t-shirt",
        "band_width": 62,
        "outline": "Outline deep V-neck",
        "stitch": "Cover stitch deep V-neck",
        "seeds": [
            {"category": "Body", "asset": "Body deep V-neck", "seeds": [[507, 1071]]},
            {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
            {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
            {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
            {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
            {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
            {
                "category": "Neck",
                "asset": "Deep V-neck",
                "seeds": [
                    [511, 546], [474, 177], [382, 196],
                    [648, 167], [592, 383], [426, 365], [620, 292],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck deep V-neck", "seeds": [[513, 287]]},
        ],
    },
    "regular-deep-vneck": {
        "art": "regular-deep-vneck-composite-bold.png",
        "keyed": "regular-deep-vneck-lineart-transparent.png",
        "proof": "regular-deep-vneck-closed-regions.png",
        "fill_proof": "regular-deep-vneck-fill-proof.png",
        "title": "Regular deep V-neck t-shirt",
        "outline": "Outline Deep V-neck (regular)",
        "stitch": "Cover stitch Deep V-neck (regular)",
        "seeds": [
            {"category": "Body", "asset": "Body Deep V-neck (regular)", "seeds": [[511, 781], [833, 411], [190, 410]]},
            {"category": "Left sleeve", "asset": "Left sleeve (regular)", "seeds": [[150, 617]]},
            {"category": "Right sleeve", "asset": "Right sleeve (regular)", "seeds": [[872, 616]]},
            {"category": "Body hem", "asset": "Body hem (regular)", "seeds": [[245, 1216]]},
            {"category": "Left cuff", "asset": "Left cuff (regular)", "seeds": [[56, 676]]},
            {"category": "Right cuff", "asset": "Right cuff (regular)", "seeds": [[936, 690]]},
            {
                "category": "Neck",
                "asset": "Deep V-neck (regular)",
                "seeds": [
                    [511, 574],
                    [458, 289],
                    [401, 358],
                    [630, 328],
                    [588, 444],
                    [640, 281],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Deep V-neck (regular)", "seeds": [[511, 384]]},
        ],
    },
    "boxy-deep-vneck": {
        "art": "boxy-deep-vneck-composite-bold.png",
        "keyed": "boxy-deep-vneck-lineart-transparent.png",
        "proof": "boxy-deep-vneck-closed-regions.png",
        "fill_proof": "boxy-deep-vneck-fill-proof.png",
        "title": "Boxy deep V-neck t-shirt",
        "outline": "Outline Deep V-neck (boxy)",
        "stitch": "Cover stitch Deep V-neck (boxy)",
        "seeds": [
            {"category": "Body", "asset": "Body Deep V-neck (boxy)", "seeds": [[510, 884]]},
            {"category": "Left sleeve", "asset": "Left sleeve (boxy)", "seeds": [[128, 556]]},
            {"category": "Right sleeve", "asset": "Right sleeve (boxy)", "seeds": [[894, 556]]},
            {"category": "Body hem", "asset": "Body hem (boxy)", "seeds": [[227, 1302]]},
            {
                "category": "Left cuff",
                "asset": "Left cuff (boxy)",
                "seeds": [[44, 631], [116, 674], [175, 703]],
            },
            {
                "category": "Right cuff",
                "asset": "Right cuff (boxy)",
                "seeds": [[872, 695], [927, 656], [986, 627]],
            },
            {
                "category": "Neck",
                "asset": "Deep V-neck (boxy)",
                "seeds": [
                    [449, 248],
                    [649, 235],
                    [532, 526],
                    [607, 240],
                    [491, 255],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Deep V-neck (boxy)", "seeds": [[510, 361]]},
        ],
    },
    "oversized-deep-vneck": {
        "art": "oversized-deep-vneck-composite-bold.png",
        "keyed": "oversized-deep-vneck-lineart-transparent.png",
        "proof": "oversized-deep-vneck-closed-regions.png",
        "fill_proof": "oversized-deep-vneck-fill-proof.png",
        "title": "Oversized deep V-neck t-shirt",
        "outline": "Outline Deep V-neck (oversized)",
        "stitch": "Cover stitch Deep V-neck (oversized)",
        "seeds": [
            {"category": "Body", "asset": "Body Deep V-neck (oversized)", "seeds": [[511, 923]]},
            {"category": "Left sleeve", "asset": "Left sleeve (oversized)", "seeds": [[133, 645]]},
            {"category": "Right sleeve", "asset": "Right sleeve (oversized)", "seeds": [[889, 645]]},
            {"category": "Body hem", "asset": "Body hem (oversized)", "seeds": [[241, 1235]]},
            {"category": "Left cuff", "asset": "Left cuff (oversized)", "seeds": [[34, 706]]},
            {"category": "Right cuff", "asset": "Right cuff (oversized)", "seeds": [[823, 793]]},
            {
                "category": "Neck",
                "asset": "Deep V-neck (oversized)",
                "seeds": [
                    [591, 285],
                    [397, 317],
                    [540, 521],
                    [593, 411],
                    [498, 546],
                    [437, 427],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Deep V-neck (oversized)", "seeds": [[512, 387]]},
        ],
    },
    "slim-polo": {
        "art": "slim-polo-composite-bold.png",
        "keyed": "slim-polo-lineart-transparent.png",
        "proof": "slim-polo-closed-regions.png",
        "fill_proof": "slim-polo-fill-proof.png",
        "title": "Slim polo collar t-shirt",
        # Closed donor cells own the full collar and placket; the registered
        # rebuild below replaces the generic ring calculation for this asset.
        "band_width": 24,
        "keep_collar_above_hole": True,
        "outline": "Outline polo collar",
        "stitch": "Cover stitch polo collar",
        "seeds": [
            {"category": "Body", "asset": "Body polo collar", "seeds": [[507, 1071], [749, 204]]},
            {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
            {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
            {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
            {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
            {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
            {
                "category": "Neck",
                "asset": "Polo collar",
                "seeds": [[434, 132], [640, 215], [382, 214], [458, 312], [579, 270]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck polo collar", "seeds": [[511, 234]]},
        ],
    },
    "regular-polo": {
        "art": "regular-polo-composite-bold.png",
        "keyed": "regular-polo-lineart-transparent.png",
        "proof": "regular-polo-closed-regions.png",
        "fill_proof": "regular-polo-fill-proof.png",
        "title": "Regular polo collar t-shirt",
        "outline": "Outline Polo collar (regular)",
        "stitch": "Cover stitch Polo collar (regular)",
        "seeds": [
            {"category": "Body", "asset": "Body Polo collar (regular)", "seeds": [[511, 843], [190, 410]]},
            {"category": "Left sleeve", "asset": "Left sleeve (regular)", "seeds": [[150, 617]]},
            {"category": "Right sleeve", "asset": "Right sleeve (regular)", "seeds": [[872, 616]]},
            {"category": "Body hem", "asset": "Body hem (regular)", "seeds": [[245, 1216]]},
            {"category": "Left cuff", "asset": "Left cuff (regular)", "seeds": [[56, 676]]},
            {"category": "Right cuff", "asset": "Right cuff (regular)", "seeds": [[936, 690]]},
            {
                "category": "Neck",
                "asset": "Polo collar (regular)",
                "seeds": [[390, 362], [632, 362], [439, 288], [488, 268]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Polo collar (regular)", "seeds": [[510, 375]]},
        ],
    },
    "boxy-polo": {
        "art": "boxy-polo-composite-bold.png",
        "keyed": "boxy-polo-lineart-transparent.png",
        "proof": "boxy-polo-closed-regions.png",
        "fill_proof": "boxy-polo-fill-proof.png",
        "title": "Boxy polo collar t-shirt",
        "outline": "Outline Polo collar (boxy)",
        "stitch": "Cover stitch Polo collar (boxy)",
        "seeds": [
            {"category": "Body", "asset": "Body Polo collar (boxy)", "seeds": [[510, 870]]},
            {"category": "Left sleeve", "asset": "Left sleeve (boxy)", "seeds": [[128, 556]]},
            {"category": "Right sleeve", "asset": "Right sleeve (boxy)", "seeds": [[894, 556]]},
            {"category": "Body hem", "asset": "Body hem (boxy)", "seeds": [[227, 1302]]},
            {
                "category": "Left cuff",
                "asset": "Left cuff (boxy)",
                "seeds": [[44, 631], [116, 674], [175, 703]],
            },
            {
                "category": "Right cuff",
                "asset": "Right cuff (boxy)",
                "seeds": [[872, 695], [927, 656], [986, 627]],
            },
            {
                "category": "Neck",
                "asset": "Polo collar (boxy)",
                "seeds": [
                    [635, 298],
                    [391, 298],
                    [503, 526],
                    [548, 450],
                    [495, 213],
                    [432, 236],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Polo collar (boxy)", "seeds": [[513, 334]]},
        ],
    },
    "oversized-polo": {
        "art": "oversized-polo-composite-bold.png",
        "keyed": "oversized-polo-lineart-transparent.png",
        "proof": "oversized-polo-closed-regions.png",
        "fill_proof": "oversized-polo-fill-proof.png",
        "title": "Oversized polo collar t-shirt",
        "outline": "Outline Polo collar (oversized)",
        "stitch": "Cover stitch Polo collar (oversized)",
        "seeds": [
            {"category": "Body", "asset": "Body Polo collar (oversized)", "seeds": [[511, 923]]},
            {"category": "Left sleeve", "asset": "Left sleeve (oversized)", "seeds": [[133, 645]]},
            {"category": "Right sleeve", "asset": "Right sleeve (oversized)", "seeds": [[889, 645]]},
            {"category": "Body hem", "asset": "Body hem (oversized)", "seeds": [[241, 1235]]},
            {"category": "Left cuff", "asset": "Left cuff (oversized)", "seeds": [[34, 706]]},
            {"category": "Right cuff", "asset": "Right cuff (oversized)", "seeds": [[823, 793]]},
            {
                "category": "Neck",
                "asset": "Polo collar (oversized)",
                "seeds": [[404, 350], [617, 350], [485, 281]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck Polo collar (oversized)", "seeds": [[511, 363]]},
        ],
    },
    "slim-thin-crew": {
        "art": "slim-thin-crew-composite-bold.png",
        "keyed": "slim-thin-crew-lineart-transparent.png",
        "proof": "slim-thin-crew-closed-regions.png",
        "fill_proof": "slim-thin-crew-fill-proof.png",
        "title": "Slim thin crew t-shirt",
        # The product point of this neckline is a *thin* band.
        "band_width": 40,
        "outline": "Outline thin crew",
        "stitch": "Cover stitch thin crew",
        "seeds": [
            {
                "category": "Body",
                "asset": "Body thin crew",
                "seeds": [[507, 1071], [749, 204], [664, 166]],
            },
            {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
            {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
            {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
            {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
            {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
            {
                "category": "Neck",
                "asset": "Thin crew neck",
                "seeds": [[602, 232], [488, 174]],
            },
            {"category": "Inner back neck", "asset": "Inner back neck thin crew", "seeds": [[496, 225]]},
        ],
    },
    "regular-thin-crew": {
        "art": "regular-thin-crew-composite-bold.png",
        "keyed": "regular-thin-crew-lineart-transparent.png",
        "proof": "regular-thin-crew-closed-regions.png",
        "fill_proof": "regular-thin-crew-fill-proof.png",
        "title": "Regular thin crew t-shirt",
        "outline": "Outline Thin crew neck (regular)",
        "stitch": "Cover stitch Thin crew neck (regular)",
        "seeds": [
            {"category": "Body", "asset": "Body Thin crew neck (regular)", "seeds": [[511, 781]]},
            {"category": "Left sleeve", "asset": "Left sleeve (regular)", "seeds": [[150, 617]]},
            {"category": "Right sleeve", "asset": "Right sleeve (regular)", "seeds": [[872, 616]]},
            {"category": "Body hem", "asset": "Body hem (regular)", "seeds": [[245, 1216]]},
            {"category": "Left cuff", "asset": "Left cuff (regular)", "seeds": [[56, 676]]},
            {"category": "Right cuff", "asset": "Right cuff (regular)", "seeds": [[936, 690]]},
            {"category": "Neck", "asset": "Thin crew neck (regular)", "seeds": [[612, 271]]},
            {
                "category": "Inner back neck",
                "asset": "Inner back neck Thin crew neck (regular)",
                "seeds": [[513, 338]],
            },
        ],
    },
    "boxy-thin-crew": {
        "art": "boxy-thin-crew-composite-bold.png",
        "keyed": "boxy-thin-crew-lineart-transparent.png",
        "proof": "boxy-thin-crew-closed-regions.png",
        "fill_proof": "boxy-thin-crew-fill-proof.png",
        "title": "Boxy thin crew t-shirt",
        "outline": "Outline Thin crew neck (boxy)",
        "stitch": "Cover stitch Thin crew neck (boxy)",
        "seeds": [
            {
                "category": "Body",
                "asset": "Body Thin crew neck (boxy)",
                "seeds": [[510, 726]],
            },
            {"category": "Left sleeve", "asset": "Left sleeve (boxy)", "seeds": [[128, 556]]},
            {"category": "Right sleeve", "asset": "Right sleeve (boxy)", "seeds": [[894, 556]]},
            {"category": "Body hem", "asset": "Body hem (boxy)", "seeds": [[227, 1302]]},
            {
                "category": "Left cuff",
                "asset": "Left cuff (boxy)",
                "seeds": [[44, 631], [116, 674], [175, 703]],
            },
            {
                "category": "Right cuff",
                "asset": "Right cuff (boxy)",
                "seeds": [[872, 695], [927, 656], [986, 627]],
            },
            {
                "category": "Neck",
                "asset": "Thin crew neck (boxy)",
                "seeds": [[513, 309], [514, 253]],
            },
            {
                "category": "Inner back neck",
                "asset": "Inner back neck Thin crew neck (boxy)",
                "seeds": [[512, 296]],
            },
        ],
    },
    "oversized-thin-crew": {
        "art": "oversized-thin-crew-composite-bold.png",
        "keyed": "oversized-thin-crew-lineart-transparent.png",
        "proof": "oversized-thin-crew-closed-regions.png",
        "fill_proof": "oversized-thin-crew-fill-proof.png",
        "title": "Oversized thin crew t-shirt",
        "outline": "Outline Thin crew neck (oversized)",
        "stitch": "Cover stitch Thin crew neck (oversized)",
        "seeds": [
            {"category": "Body", "asset": "Body Thin crew neck (oversized)", "seeds": [[511, 923]]},
            {"category": "Left sleeve", "asset": "Left sleeve (oversized)", "seeds": [[133, 645]]},
            {"category": "Right sleeve", "asset": "Right sleeve (oversized)", "seeds": [[889, 645]]},
            {"category": "Body hem", "asset": "Body hem (oversized)", "seeds": [[241, 1235]]},
            {"category": "Left cuff", "asset": "Left cuff (oversized)", "seeds": [[34, 706]]},
            {"category": "Right cuff", "asset": "Right cuff (oversized)", "seeds": [[823, 793]]},
            {
                "category": "Neck",
                "asset": "Thin crew neck (oversized)",
                "seeds": [[469, 275], [579, 339]],
            },
            {
                "category": "Inner back neck",
                "asset": "Inner back neck Thin crew neck (oversized)",
                "seeds": [[497, 320]],
            },
        ],
    },
}


def seal_under_ink(mask: np.ndarray, ink: np.ndarray, iterations: int = 2) -> np.ndarray:
    """Grow a fill under the construction lines so colour meets the outline."""
    grown = ndimage.binary_dilation(mask, iterations=iterations)
    return mask | (grown & ink)


def key_lineart(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    boosted = ImageEnhance.Contrast(img).enhance(T.CONTRAST)
    return T.to_transparent(boosted)


def dash_mask(ink: np.ndarray, cfg: G.Settings) -> np.ndarray:
    comps, _count = ndimage.label(ink, np.ones((3, 3), bool))
    boxes = ndimage.find_objects(comps)
    dashes = np.zeros_like(ink)
    for index, box in enumerate(boxes, start=1):
        if box is None:
            continue
        height = box[0].stop - box[0].start
        width = box[1].stop - box[1].start
        if max(height, width) > cfg.dash_len:
            continue
        dashes[comps == index] = True
    return dashes


def wrap_fill_only(title: str, mask: np.ndarray) -> str:
    fill_d = G.trace(mask)
    if not fill_d:
        raise SystemExit(f"empty trace for {title}")
    group = '<g transform="translate(0,2048) scale(0.1,-0.1)"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{G.CANVAS}" height="{G.CANVAS}" '
        f'viewBox="0 0 {G.CANVAS} {G.CANVAS}">\n'
        f"<title>{title}</title>\n"
        f'{group} fill="#000000">\n'
        f'<path d="{fill_d}" fill-rule="evenodd"/>\n'
        "</g>\n"
        "</svg>\n"
    )


def wrap_ink(title: str, mask: np.ndarray) -> str:
    ink_d = G.trace(mask, resample=Image.LANCZOS)
    if not ink_d:
        raise SystemExit(f"empty outline trace for {title}")
    group = '<g transform="translate(0,2048) scale(0.1,-0.1)"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{G.CANVAS}" height="{G.CANVAS}" '
        f'viewBox="0 0 {G.CANVAS} {G.CANVAS}">\n'
        f"<title>{title}</title>\n"
        f'{group} fill="{G.INK_COLOR}">\n'
        f'<path d="{ink_d}" fill="{G.INK_COLOR}" fill-rule="evenodd"/>\n'
        "</g>\n"
        "</svg>\n"
    )


def write_part(category: str, asset: str, svg: str) -> Path:
    folder = SRC / category
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{asset}.svg"
    target.write_text(svg, encoding="utf-8")
    print(f"  {category}/{asset}.svg  {target.stat().st_size / 1024:.0f} KB")
    return target


def pack(variant_id: str, probe_only: bool) -> None:
    if (variant_id.startswith(('regular-', 'oversized-')) or variant_id in ('slim-scoop', 'boxy-scoop', 'boxy-vneck', 'boxy-crew', 'boxy-thin-crew', 'boxy-deep-vneck', 'boxy-polo')) and not probe_only:
        from rebuild_reference_necks import rebuild
        rebuild(variant_id)
        return
    spec = VARIANTS.get(variant_id)
    if spec is None:
        names = ", ".join(VARIANTS)
        raise SystemExit(f"unknown variant {variant_id!r}. Use one of: {names}")

    art_in = SRC / spec["art"]
    keyed_path = SRC / spec["keyed"]
    if not art_in.exists():
        raise SystemExit(f"missing {art_in}")

    print(f"=== {variant_id} ===")
    print("key white (contrast 1.35, luminance ramp)...")
    keyed = key_lineart(art_in)
    keyed.save(keyed_path)

    cfg = G.Settings()
    regions = G.analyse(keyed_path, cfg)
    print(f"{len(regions.ids)} construction regions")
    for region_id in regions.ids:
        x, y = regions.anchor(region_id)
        print(f"  #{region_id:>2d}  {regions.area(region_id):>8d}px  seed ({x}, {y})")

    proof = SRC / spec["proof"]
    G.write_proof(regions, proof)
    print(f"wrote {proof.name}")

    ink = regions.ink if regions.ink is not None else np.zeros_like(regions.labels, bool)
    stitches = G.claim_dash_tips(ink, dash_mask(ink, cfg))
    print(f"stitch dashes: {int(stitches.sum())}px")

    if probe_only:
        return

    part_seeds: list[dict] = spec["seeds"]
    # Claim order matters: the opening-interior pocket belongs to the inner
    # back, the collar band cells to the neck, and everything else is just
    # leftover the body picks up. If the body claims first it can swallow
    # collar band cells, which makes the band vanish into the body colour.
    PART_ORDER = [
        "Inner back neck",
        "Neck",
        "Body hem",
        "Left cuff",
        "Right cuff",
        "Left sleeve",
        "Right sleeve",
        "Body",
    ]
    by_category: dict[str, dict] = {entry["category"]: entry for entry in part_seeds}
    claimed: dict[int, str] = {}
    named: list[dict] = []
    for category in PART_ORDER:
        entry = by_category.get(category)
        if entry is None:
            continue
        ids: list[int] = []
        name = f"{entry['category']}/{entry['asset']}"
        for x, y in entry["seeds"]:
            region_id = int(regions.labels[y, x])
            if region_id == 0:
                print(f"  !! {name}: seed ({x}, {y}) is not inside a region")
                continue
            if region_id in claimed:
                print(f"  !! {name}: seed ({x}, {y}) already taken by {claimed[region_id]}")
                continue
            claimed[region_id] = name
            ids.append(region_id)
        mask = np.zeros(regions.labels.shape, bool)
        for region_id in ids:
            mask |= regions.mask(region_id)
        named.append({**entry, "ids": ids, "mask": mask, "name": name})

    masks = {part["category"]: part["mask"] for part in named}
    for label, count in G.apply_stitch_strip_moves(masks, ink, stitches).items():
        print(f"stitch-strip moved {label}: {count}px")
    print(f"nape ribs Inner->Neck: {G.apply_nape_rib_move(masks)}px")
    # rib_fix=False: clip_neck_to_rib_band's rim-split/annulus heuristics are
    # what paint whole shoulder yokes collar-blue. rebuild_collar_band below
    # replaces them with one deterministic geometric pass.
    G.clip_fills_inside_ink(masks, ink, stitches, rib_fix=False)
    # The inner back must stay exactly the pocket behind the opening that its
    # own seed claimed — never grow by absorption, or it eats collar band cells.
    absorbed = G.absorb_leftovers(
        masks, regions.labels, regions.ids, claimed, avoid={"Inner back neck"},
    )
    for part, px in absorbed.items():
        print(f"absorbed leftover {part}: {px}px")
    for part in named:
        part["mask"] = masks[part["category"]]

    # Every enclosed fabric pixel needs a fill owner. Keep the body as a
    # continuous underlay so small trace gaps cannot expose the white canvas.
    completed = G.complete_garment_coverage(masks, regions.interior, ink)
    if completed:
        print(f"completed unassigned fabric: {completed}px")
    for part in named:
        part["mask"] = masks[part["category"]]

    # Collar rebuild bounded by the drawn ink (the way the V-neck works):
    # walk the collar outward from the opening and stop at the construction
    # outline/seam web, so neck colour never leaves the drawing. Replaces the
    # donor's ragged region claims into one deterministic pass. Polo keeps the
    # collar leaves drawn above the opening.
    moved_px = G.rebuild_collar_band(
        masks,
        ink,
        keep_above_hole=spec.get("keep_collar_above_hole", False),
    )
    print(f"collar rebuild: band {moved_px}px")
    if variant_id in ("slim-polo", "slim-thin-crew", "slim-scoop", "boxy-deep-vneck"):
        from fix_slim_polo_thin import rebuild_fills
        print(f"closed collar cells: {rebuild_fills(variant_id, masks, ink)}px")
    if variant_id == "slim-crew":
        from fix_slim_crew import complete_corner_fills
        print(f"crew attachment rib cells: {complete_corner_fills(masks, ink)}px")
    if variant_id == "slim-deep-vneck":
        from fix_slim_deep_vneck import complete_band_fills
        print(f"deep V rib cells: {complete_band_fills(masks, ink)}px")
    if variant_id in ("slim-scoop", "boxy-vneck", "boxy-deep-vneck", "boxy-scoop", "boxy-thin-crew", "boxy-polo"):
        from fix_slim_polo_thin import rebuild_boxy_clean_fills, clip_boxy_neck_fills
        print(f"boxy clean collar pixels: {rebuild_boxy_clean_fills(variant_id, masks, ink)}px")
        print(f"boxy collar spill clipped: {clip_boxy_neck_fills(variant_id, masks, ink)}px")
    for part in named:
        if part["category"] in ("Neck", "Body", "Inner back neck"):
            part["mask"] = masks[part["category"]]

    # Grow every fabric fill a couple of pixels under the construction ink so
    # parts meet at seams with no white hairline (same step the slim-V default
    # pack runs; without it variant builds show white cracks at shoulders,
    # armholes and the hem).
    from fix_slim_polo_thin import blacken_neck_stitches
    blackened = blacken_neck_stitches(variant_id, stitches)
    if blackened:
        print(f"neck stitch marks moved to outline: {blackened}px")

    construction = ink & ~stitches
    for part in named:
        if part["category"] in ("Body", "Neck", "Inner back neck"):
            part["mask"] = seal_under_ink(part["mask"], construction)
            masks[part["category"]] = part["mask"]

    colour_proof = np.full((*regions.labels.shape, 3), 255, np.uint8)
    # Paint in the app's z-order (bottom -> top) so the proof shows what the
    # builder actually stacks: Body first, Neck after (Neck sits above Body in
    # the app, so at any shared construction-ink pixel the head colour wins).
    # Painting in claim order (Body last) makes Neck look fragmented/broken.
    Z_ORDER = [
        "Body", "Left sleeve", "Right sleeve", "Body hem",
        "Left cuff", "Right cuff", "Inner back neck", "Neck",
    ]
    by_cat = {part["category"]: part["mask"] for part in named}
    for category in Z_ORDER:
        mask = by_cat.get(category)
        if mask is not None:
            colour_proof[mask] = PROOF_COLORS.get(category, (80, 80, 80))
    colour_proof[stitches] = (180, 180, 180)
    Image.fromarray(colour_proof).save(SRC / spec["fill_proof"])
    print(f"wrote {spec['fill_proof']}")

    for part in named:
        if part["category"] not in WRITE_CATEGORIES:
            continue
        if not part["ids"] and not part["mask"].any():
            continue
        write_part(
            part["category"],
            part["asset"],
            wrap_fill_only(f"{spec['title']} - {part['asset']}", part["mask"]),
        )

    construction = ink & ~stitches
    write_part("Outline", spec["outline"], wrap_ink(f"{spec['title']} - Outline", construction))
    if stitches.any():
        write_part(
            "Stitching",
            spec["stitch"],
            wrap_fill_only(f"{spec['title']} - Cover stitch", stitches),
        )
    print("done")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--probe"]
    probe_only = "--probe" in sys.argv
    if not args:
        raise SystemExit("usage: pack_studio_neck_variant.py <variant> [--probe]")
    pack(args[0], probe_only=probe_only)
