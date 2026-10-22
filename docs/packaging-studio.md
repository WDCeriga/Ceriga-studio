# Packaging studio

The redesigned Builder uses three tools: Packaging type, Design, and Material & size. The legacy packaging data remains compatible. Each template keeps its own design when switching variations. The page uses the existing physical panel geometry and print-safe constraints, with 18 illustrated variations across bags, mailers, boxes and unbranded bulk packing.

Artwork is selected and dragged on its print surface. Right-panel tools edit text, fonts, image scale, alignment, position and rotation. Front/back and box interior/exterior views share saved panel artwork. Starting-size buttons fill a draft; Apply dimensions commits it and refits artwork. The dimensions describe a request, not an inferred garment fit. Only transparent materials expose appearance presets; only boxes expose interior colour; only mailers reserve a shipping-label area.

Production notes are managed through Packaging’s Upload reference and remain linked to the exported design. Named presets live in Packaging type. Page-specific reference uploads use the Builder reference system. Manufacturing claims and legal marks are never added automatically. Review & Export uses the same packaging data and artwork renderer.

Verification: `node scripts/verify-packaging-studio.mjs` checks template geometry, 784 constrained placements, variation preservation, dimensions and 46 rendered views. Browser checks cover text creation, dimension application, view switching and the persistent phone inspector.

Packaging uses the same plain white canvas, top-right view selector, bottom-left shared zoom and compact preview toggles as the garment workspace. There is no separate background picker, footer bar, or Production tool. Template cards have bounded illustrations. Shared material selectors and colour popovers are used in the inspector.

Uploaded artwork has a right-panel thumbnail and selector. Size, Placement & alignment and Advanced settings are collapsible. Selected logos and text have corner resize handles even when print-safe guides are hidden; Smaller/Larger buttons and exact width scale text and images proportionally. Phone label Artwork hides zoom; label creation actions remain in Design, and every Builder canvas is white.
