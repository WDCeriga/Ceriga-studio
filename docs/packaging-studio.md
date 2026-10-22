# Packaging studio

The redesigned Builder uses four tools: Packaging type, Design, Material & size, and Production. The legacy packaging data remains compatible. Each template keeps its own design when switching variations. The page uses the existing physical panel geometry and print-safe constraints, with 18 illustrated variations across bags, mailers, boxes and unbranded bulk packing.

Artwork is selected and dragged on its print surface. Right-panel tools edit text, fonts, image scale, alignment, position and rotation. Front/back and box interior/exterior views share saved panel artwork. Starting-size buttons fill a draft; Apply dimensions commits it and refits artwork. The dimensions describe a request, not an inferred garment fit. Only transparent materials expose appearance presets; only boxes expose interior colour; only mailers reserve a shipping-label area.

Production notes and named presets are saved with the design. Page-specific reference uploads use the Builder reference system. Manufacturing claims and legal marks are never added automatically. Review & Export uses the same packaging data and artwork renderer.

Verification: `node scripts/verify-packaging-studio.mjs` checks template geometry, 784 constrained placements, variation preservation, dimensions and 46 rendered views. Browser checks cover text creation, dimension application, view switching and the persistent phone inspector.
