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
        "outline": "Outline crew",
        "stitch": "Cover stitch crew",
        "seeds": [
            {"category": "Body", "asset": "Body crew", "seeds": [[507, 1071], [241, 220], [749, 204], [626, 247], [644, 190], [362, 162], [357, 198]]},
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
            {"category": "Body", "asset": "Body V-neck (boxy)", "seeds": [[510, 726], [261, 277], [700, 250]]},
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
                    [487, 272],
                    [530, 251],
                    [571, 395],
                    [395, 317],
                    [430, 247],
                    [592, 245],
                    [443, 385],
                    [627, 319],
                    [507, 441],
                    [379, 240],
                    [551, 416],
                    [617, 237],
                    [552, 271],
                    [646, 280],
                ],
            },
            {"category": "Inner back neck", "asset": "Inner back neck V-neck (boxy)", "seeds": [[511, 348]]},
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
        "outline": "Outline scoop",
        "stitch": "Cover stitch scoop",
        "seeds": [
            {"category": "Body", "asset": "Body scoop", "seeds": [[507, 1071], [810, 230]]},
            {"category": "Left sleeve", "asset": "Left sleeve", "seeds": [[133, 507]]},
            {"category": "Right sleeve", "asset": "Right sleeve", "seeds": [[888, 507]]},
            {"category": "Body hem", "asset": "Body hem", "seeds": [[230, 1349]]},
            {"category": "Left cuff", "asset": "Left cuff", "seeds": [[91, 597]]},
            {"category": "Right cuff", "asset": "Right cuff", "seeds": [[944, 592]]},
            {"category": "Neck", "asset": "Scoop neck", "seeds": [[393, 420], [632, 419], [352, 343], [371, 386], [322, 174], [704, 171]]},
            {"category": "Inner back neck", "asset": "Inner back neck scoop", "seeds": [[512, 313]]},
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
            {"category": "Body", "asset": "Body Scoop neck (boxy)", "seeds": [[510, 726], [261, 277], [700, 250]]},
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
            {"category": "Neck", "asset": "Scoop neck (boxy)", "seeds": [[370, 229], [418, 243], [500, 237]]},
            {"category": "Inner back neck", "asset": "Inner back neck Scoop neck (boxy)", "seeds": [[512, 364]]},
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
                    [392, 162],
                    [351, 171],
                    [674, 171],
                    [603, 361],
                    [624, 273],
                    [571, 436],
                    [444, 412],
                    [480, 495],
                    [534, 514],
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
                    [462, 490],
                    [548, 508],
                    [467, 258],
                    [556, 254],
                    [414, 242],
                    [594, 405],
                    [637, 234],
                    [446, 450],
                    [344, 242],
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
                "seeds": [[383, 232], [640, 231], [421, 166], [480, 140], [574, 290]],
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
                    [392, 317],
                    [635, 317],
                    [448, 242],
                    [502, 539],
                    [348, 248],
                    [774, 281],
                    [679, 248],
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
        "outline": "Outline thin crew",
        "stitch": "Cover stitch thin crew",
        "seeds": [
            {
                "category": "Body",
                "asset": "Body thin crew",
                "seeds": [[507, 1071], [688, 177], [366, 163]],
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
                "seeds": [[510, 726], [352, 235], [774, 281]],
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
                "seeds": [[613, 308], [596, 236]],
            },
            {
                "category": "Inner back neck",
                "asset": "Inner back neck Thin crew neck (boxy)",
                "seeds": [[508, 293]],
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
    claimed: dict[int, str] = {}
    named: list[dict] = []
    for entry in part_seeds:
        ids: list[int] = []
        name = f"{entry['category']}/{entry['asset']}"
        for x, y in entry["seeds"]:
            region_id = int(regions.labels[y, x])
            if region_id == 0:
                print(f"  !! {name}: seed ({x}, {y}) is not inside a region")
                continue
            if region_id in claimed:
                print(f"  !! {name}: region {region_id} already taken by {claimed[region_id]}")
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
    G.clip_fills_inside_ink(masks, ink, stitches)
    for part in named:
        part["mask"] = masks[part["category"]]

    missed = [i for i in regions.ids if i not in claimed]
    if missed:
        print("  !! regions with no part:", missed)
        for region_id in missed:
            print(
                f"     region {region_id}: {regions.area(region_id)}px "
                f"at {regions.anchor(region_id)}"
            )

    colour_proof = np.full((*regions.labels.shape, 3), 255, np.uint8)
    for part in named:
        colour_proof[part["mask"]] = PROOF_COLORS.get(part["category"], (80, 80, 80))
    colour_proof[stitches] = (180, 180, 180)
    Image.fromarray(colour_proof).save(SRC / spec["fill_proof"])
    print(f"wrote {spec['fill_proof']}")

    for part in named:
        if part["category"] not in WRITE_CATEGORIES:
            continue
        if not part["ids"]:
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
