# Change ledger: artwork-phase0-g

Base commit: e9a9dc9 · 2026-11-21 00:59

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
- `src/app/pages/Builder.tsx` · sha256 7E1E98F554DD
- `src/app/components/builder/printsStudio/ImageArtwork.tsx` · sha256 F790046AEAC5
- `src/app/components/builder/tank-details.css` · sha256 4BF861237AE1

## 01-claude-setup (9 files)
- `.gitignore` · sha256 201543FAB7DD
- `package.json` · sha256 B790248086B9
- `package-lock.json` · sha256 535BCDBC237C
- `skills-lock.json` · sha256 B46AF5D54948
- `tsconfig.json` · sha256 734854F7D6AC
- `src/figma-assets.d.ts` · sha256 CF5A4698846C
- `scripts/typecheck.mjs` · sha256 17486224AAA3
- `scripts/change-ledger.ps1` · sha256 9B03AA9B6D6A
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
- `src/app/components/builder/shell/builder-shell-cx.css` · sha256 ACCE87F471CE
- `src/app/components/builder/shell/builder-light.css` · sha256 6D6EE4C1D2C5
- `src/app/components/builder/shell/builder-scale.css` · sha256 767C406C4676
- `src/app/components/builder/shell/FabricBlendEditor.tsx` · sha256 F2F81F4B03A5
- `src/app/components/builder/TrouserDetailsLibrary.tsx` · sha256 50C6AF144631
- `src/app/components/builder/shell/NeckConstructionInspector.tsx` · sha256 6FDD8923EA00
- `src/app/components/builder/shell/PanellingStudioInspector.tsx` · sha256 A90A82F60CC2
- `src/app/components/builder/shell/TrouserConstructionInspector.tsx` · sha256 45EE741136E1
- `src/app/components/builder/GarmentLabelsPreview.tsx` · sha256 9D4DA12EBF69
- `src/app/components/builder/shell/builder-shell-cx.reskin-retired.css` · sha256 5F1F64A52014
- `src/app/components/builder/shell/BuilderShell.tsx` · sha256 24C7B08AFD1B
- `src/app/components/builder/shell/PrintDesignStudio.tsx` · sha256 4A676323A332
- `src/app/components/builder/shell/ShoulderConstructionPicker.tsx` · sha256 9286B354CA72
- `src/app/components/builder/shell/TorsoCropControl.tsx` · sha256 7CB41DD6BAF0
- `src/app/components/builder/shell/SweatpantsControls.tsx` · sha256 0192F98BAB1C
- `src/app/components/builder/design-system/GarmentPreviews.tsx` · sha256 D9C45A7CFB5F
- `src/app/components/builder/design-system/PresetArt.tsx` · sha256 5CF4C031967A
- `src/app/components/builder/shell/MeasurementSupportingPanels.tsx` · sha256 D85991B1EFE2
- `src/app/components/builder/shell/AdvancedSizingEditor.tsx` · sha256 EFA00FE352E3
- `src/app/pages/dev/BuilderPrimitives.tsx` · sha256 886BC6039264

## 04-artwork-phase0 (38 files)
- `src/app/components/builder/shell/DrawingRefinementControls.tsx` · sha256 7220673ADACA
- `src/app/components/builder/artwork-engine/state/focus.ts` · sha256 DE8CA3739C10
- `src/app/components/builder/artwork-engine/geometry/pivot.ts` · sha256 3640DB7CA0B6
- `src/app/components/builder/shell/ShapesStudio.tsx` · sha256 B44947269A41
- `src/app/components/builder/shell/VectorEffectsPanel.tsx` · sha256 F0374FAD7529
- `src/app/components/builder/artwork-engine/geometry/spacing.ts` · sha256 2499A2E49C63
- `src/app/components/builder/artwork-engine/geometry/readout.ts` · sha256 ABFB0C4DC679
- `src/app/components/builder/artwork-engine/interaction/SpacingHints.tsx` · sha256 981F2BBAD194
- `src/app/components/builder/shell/ArtworkObjectControls.tsx` · sha256 FE5BF3921F8E
- `src/app/components/builder/artwork-engine/geometry/placement.ts` · sha256 26E85F826ED7
- `src/app/components/builder/shell/ArtworkSelectionPanel.tsx` · sha256 0E7D964419B0
- `src/app/components/builder/artwork-engine/state/sharedProperties.ts` · sha256 565B9B69C2FC
- `src/app/components/builder/artwork-engine/interaction/ContextToolbar.tsx` · sha256 4D7AF1537704
- `src/app/components/builder/artwork-engine/interaction/context-toolbar.css` · sha256 BDC9B531F56D
- `src/app/components/builder/artwork-engine/interaction/contextActions.tsx` · sha256 AF0D23FA56EE
- `src/app/components/builder/artwork-engine/interaction/ArtworkContextBar.tsx` · sha256 EBB203AF54D3
- `src/app/components/builder/printsStudio/ArtworkSelectionTools.tsx` · sha256 7B6F28B2865D
- `src/app/components/builder/shell/ArtworkPrintMethod.tsx` · sha256 5EEA0199CB8E
- `src/app/components/builder/shell/TextInspector.tsx` · sha256 45405C823C15
- `src/app/components/builder/shell/ArtworkImageEditor.tsx` · sha256 7BA8C323A373
- `src/app/components/builder/shell/SharedArtworkObjectPanel.tsx` · sha256 1B3326F1B129
- `src/app/components/builder/shell/StudioObjectPanel.tsx` · sha256 2170BFD816B2
- `src/app/components/builder/artwork-engine/README.md` · sha256 20A35C670722
- `src/app/components/builder/artwork-engine/index.ts` · sha256 964086D70C2D
- `src/app/components/builder/artwork-engine/interaction/index.ts` · sha256 9B2F1B31F5FB
- `src/app/components/builder/artwork-engine/interaction/SelectionChrome.tsx` · sha256 90C7DE695045
- `src/app/components/builder/artwork-engine/interaction/selection-chrome.css` · sha256 86B322A4508A
- `src/app/components/builder/artwork-engine/geometry/colour.ts` · sha256 29D159699D28
- `src/app/components/builder/artwork-engine/state/scene.ts` · sha256 E5481707E5F6
- `src/app/components/builder/artwork-engine/state/useNewObjectInk.ts` · sha256 832190715D27
- `src/app/components/builder/artwork-engine/state/workspaceState.ts` · sha256 89D3B25A3A39
- `src/app/components/builder/artwork-engine/state/useArtworkWorkspaceState.ts` · sha256 6A33BC7EED75
- `src/app/components/builder/SelectionTransformControls.tsx` · sha256 E22486ADBC33
- `src/app/components/builder/selection-transform-controls.css` · sha256 2B797E545588
- `src/app/components/builder/PrintStudioEditor.tsx` · sha256 E363EA494E6C
- `src/app/components/builder/printsStudio/LiveShapeDraft.tsx` · sha256 E9C82C422A37
- `src/app/components/builder/shell/UnifiedArtworkTools.tsx` · sha256 B6042AB791E1
- `scripts/verify-artwork-engine.mjs` · sha256 26437920EA21

## 01-claude-setup: skills (.claude/, untracked)
- 75 files under `.claude/skills/` (installed via `npx skills add` / `playwright-cli install --skills`)

## docs/builder-audit (untracked)
- 255 files: audit, evidence sheets, phase comparisons, ledgers

## Unassigned changes (new phase work, or anything unexpected)
- none
