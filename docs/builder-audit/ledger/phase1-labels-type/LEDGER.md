# Change ledger: phase1-labels-type

Base commit: e9a9dc9 · 2026-11-20 18:53

## 00-preexisting (21 files)
- `scripts/verify-tank-top.mjs` · sha256 A09BDA3125AE
- `src/app/components/builder/ArtworkSurfaceSvg.tsx` · sha256 AAED88C25D5E
- `src/app/components/builder/GarmentDetails.tsx` · sha256 1431D6886236
- `src/app/components/builder/OrderQuantitiesStudio.tsx` · sha256 B98835D16BDB
- `src/app/components/builder/PackagingArtwork.tsx` · sha256 EF28A774A93D
- `src/app/components/builder/TankDetailsLibrary.tsx` · sha256 3BA89EBFEBA5
- `src/app/components/builder/shell/MaterialsInspector.tsx` · sha256 3515D7447C1B
- `src/app/components/builder/shell/SurfaceAddMenu.tsx` · sha256 03EBBACBD88F
- `src/app/components/builder/shell/TankControls.tsx` · sha256 468AEF11FE6A
- `src/app/components/builder/shell/builder-experience.css` · sha256 2E247EF1A3B4
- `src/app/data/garmentDetails.ts` · sha256 43DAA9B9F56B
- `src/app/data/tankHem.ts` · sha256 D3AD5C69048A
- `src/app/data/tankRacerback.ts` · sha256 F139D44FB074
- `src/app/data/tankTop.ts` · sha256 EEB625866413
- `src/app/data/tankTrims.ts` · sha256 985EC2A678C2
- `src/app/data/tankTshirtNecks.ts` · sha256 5867547F17D4
- `src/app/lib/surfaceColourLinks.ts` · sha256 5C9156DE7D01
- `src/app/lib/surfaceNativeExport.tsx` · sha256 EE94334B6673
- `src/app/pages/Builder.tsx` · sha256 B0AF6FB48CC8
- `src/app/components/builder/printsStudio/ImageArtwork.tsx` · sha256 F790046AEAC5
- `src/app/components/builder/tank-details.css` · sha256 4BF861237AE1

## 01-claude-setup (9 files)
- `.gitignore` · sha256 201543FAB7DD
- `package.json` · sha256 536DB710EE2B
- `package-lock.json` · sha256 535BCDBC237C
- `skills-lock.json` · sha256 B46AF5D54948
- `tsconfig.json` · sha256 734854F7D6AC
- `src/figma-assets.d.ts` · sha256 CF5A4698846C
- `scripts/typecheck.mjs` · sha256 6EE9946AA14F
- `scripts/change-ledger.ps1` · sha256 FF4F1E3A7118
- `typecheck-baseline.json` · sha256 2AED2CA5E50F

## 02-phase0 (5 files)
- `src/app/components/builder/TshirtSvgPreview.tsx` · sha256 95FDEBE8F9FF
- `src/app/components/builder/shell/FitMeasurementsInspector.tsx` · sha256 EF0A4E8D7ED8
- `src/app/components/builder/shell/builder-shell.css` · sha256 B5E07032CE5E
- `src/app/routes.tsx` · sha256 5D602CC11041
- `src/app/components/builder/BuilderLoadingFallback.tsx` · sha256 8410A87BC766

## 03-phase1 (31 files)
- `src/app/components/builder/design-system/Canvas.tsx` · sha256 AB02784D08BD
- `src/app/components/builder/design-system/Controls.tsx` · sha256 49F897D7453B
- `src/app/components/builder/design-system/Inspector.tsx` · sha256 9ECD379A3843
- `src/app/components/builder/design-system/Overlays.tsx` · sha256 E0F900C89C79
- `src/app/components/builder/design-system/cx-primitives.css` · sha256 F4635173BC0D
- `src/app/components/builder/design-system/cx-tokens.css` · sha256 CEDB10AC74EE
- `src/app/components/builder/design-system/index.ts` · sha256 9D0636A1C27B
- `src/app/components/builder/design-system/States.tsx` · sha256 6269454172D6
- `src/app/components/builder/design-system/FitSilhouette.tsx` · sha256 E66F654A219C
- `src/app/components/builder/design-system/fitSilhouettes.ts` · sha256 70EDF8D24232
- `scripts/build-fit-silhouettes.mjs` · sha256 B8F33311E711
- `src/app/components/builder/shell/builder-shell-cx.css` · sha256 B02AAD78504F
- `src/app/components/builder/shell/builder-light.css` · sha256 5322706B879E
- `src/app/components/builder/shell/builder-scale.css` · sha256 767C406C4676
- `src/app/components/builder/shell/FabricBlendEditor.tsx` · sha256 F2F81F4B03A5
- `src/app/components/builder/TrouserDetailsLibrary.tsx` · sha256 50C6AF144631
- `src/app/components/builder/shell/NeckConstructionInspector.tsx` · sha256 6FDD8923EA00
- `src/app/components/builder/shell/PanellingStudioInspector.tsx` · sha256 A90A82F60CC2
- `src/app/components/builder/shell/TrouserConstructionInspector.tsx` · sha256 45EE741136E1
- `src/app/components/builder/GarmentLabelsPreview.tsx` · sha256 9D4DA12EBF69
- `src/app/components/builder/shell/builder-shell-cx.reskin-retired.css` · sha256 5F1F64A52014
- `src/app/components/builder/shell/BuilderShell.tsx` · sha256 24C7B08AFD1B
- `src/app/components/builder/shell/PrintDesignStudio.tsx` · sha256 F68923E2D631
- `src/app/components/builder/shell/ShoulderConstructionPicker.tsx` · sha256 9286B354CA72
- `src/app/components/builder/shell/TorsoCropControl.tsx` · sha256 7CB41DD6BAF0
- `src/app/components/builder/shell/SweatpantsControls.tsx` · sha256 0192F98BAB1C
- `src/app/components/builder/design-system/GarmentPreviews.tsx` · sha256 D9C45A7CFB5F
- `src/app/components/builder/design-system/PresetArt.tsx` · sha256 5CF4C031967A
- `src/app/components/builder/shell/MeasurementSupportingPanels.tsx` · sha256 D85991B1EFE2
- `src/app/components/builder/shell/AdvancedSizingEditor.tsx` · sha256 EFA00FE352E3
- `src/app/pages/dev/BuilderPrimitives.tsx` · sha256 886BC6039264

## 01-claude-setup: skills (.claude/, untracked)
- 75 files under `.claude/skills/` (installed via `npx skills add` / `playwright-cli install --skills`)

## docs/builder-audit (untracked)
- 201 files: audit, evidence sheets, phase comparisons, ledgers

## Unassigned changes (new phase work, or anything unexpected)
- none
