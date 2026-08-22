"""Save the slim crew masks the upload pipeline aligns collars to."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ASSETS = Path.home() / ".cursor" / "projects" / "c-Users-richy-CerigaStudio-Ceriga-studio" / "assets"
if not ASSETS.exists():
    ASSETS = HERE.parents[2] / ".cursor" / "projects" / "c-Users-richy-CerigaStudio-Ceriga-studio" / "assets"

sys.path.insert(0, str(ASSETS))

import build_vneck as VN  # noqa: E402

OUT = HERE / "refs"
OUT.mkdir(exist_ok=True)


def main() -> None:
    crew = VN.crew_pieces()
    np.savez_compressed(
        OUT / "crew_masks.npz",
        collar=crew["collar"].astype(np.uint8),
        body=crew["body"].astype(np.uint8),
        interior=crew["interior"].astype(np.uint8),
        ink=crew["ink"].astype(np.uint8),
        hole=crew["hole"].astype(np.uint8),
    )
    print(f"wrote {OUT / 'crew_masks.npz'}  {crew['interior'].shape}")


if __name__ == "__main__":
    main()
