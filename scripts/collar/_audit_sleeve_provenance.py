import base64
import hashlib
import json
import os
from pathlib import Path

from test_custom_assets import CustomAssetsTests


def capture():
    reference = Path(__file__).parent / "refs/sleeve-isolation-tee.jpg"
    local_potrace = reference.parents[3] / ".venv/tools/potrace-1.16.win64/potrace.exe"
    if local_potrace.exists() and not os.environ.get("POTRACE_EXE"):
        os.environ.setdefault("POTRACE", str(local_potrace))
    asset = CustomAssetsTests().registered_reference_pair("slim")
    provenance = asset["stageProvenance"]
    assert provenance["sourceImageHash"] == hashlib.sha256(reference.read_bytes()).hexdigest()
    for field, content in {
        "detectedRasterId": asset["sleeveIsolation"]["contextDrawing"],
        "isolationId": asset["sleeveIsolation"]["rawIsolation"],
        "normalizedAssetId": asset["cleanDrawing"],
        "tracedSvgId": asset["svg"],
        "finalSvgId": asset["svg"],
    }.items():
        assert provenance[field] == hashlib.sha256(content.encode()).hexdigest(), field
    opposite = asset["oppositeSleeve"]
    for field in ("sourceImageHash", "uploadIdentity", "isolationId", "normalizedAssetId", "registrationInputId"):
        assert opposite["stageProvenance"][field] == provenance[field], field
    assert opposite["stageProvenance"]["tracedSvgId"] == hashlib.sha256(opposite["svg"].encode()).hexdigest()
    output = reference.parents[3] / "_debug_sleeve_provenance.json"
    output.write_text(json.dumps({
        "mode": "Deterministic local replay: original raster unchanged, manually specified detection landmarks, real isolation, normalization and registration. Not an Azure detection replay.",
        "original": "data:image/jpeg;base64," + base64.b64encode(reference.read_bytes()).decode("ascii"),
        "asset": asset,
    }), encoding="utf-8")
    print(json.dumps({"capture": str(output), "hashesVerified": True, "canonicalRasterShared": True,
                      "provenance": provenance, "registration": asset["registration"]}, indent=2))


if __name__ == "__main__":
    capture()