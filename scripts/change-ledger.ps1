# Snapshot uncommitted work by category so regressions can be traced to the phase that caused them.
# Usage: powershell -File scripts/change-ledger.ps1 -Label <name>   (writes docs/builder-audit/ledger/<name>/)
param([Parameter(Mandatory)][string]$Label)
$ErrorActionPreference = 'Stop'
$root = git rev-parse --show-toplevel
Set-Location $root
$out = "docs/builder-audit/ledger/$Label"
New-Item -ItemType Directory -Force $out | Out-Null

# Category membership. Pre-existing = uncommitted Ceriga work present when the Claude session began (19 Nov 2026).
$categories = [ordered]@{
  '00-preexisting' = @(
    'scripts/verify-tank-top.mjs','src/app/components/builder/ArtworkSurfaceSvg.tsx','src/app/components/builder/GarmentDetails.tsx',
    'src/app/components/builder/OrderQuantitiesStudio.tsx','src/app/components/builder/PackagingArtwork.tsx','src/app/components/builder/TankDetailsLibrary.tsx',
    'src/app/components/builder/shell/MaterialsInspector.tsx','src/app/components/builder/shell/SurfaceAddMenu.tsx','src/app/components/builder/shell/TankControls.tsx',
    'src/app/components/builder/shell/builder-experience.css','src/app/data/garmentDetails.ts','src/app/data/tankHem.ts','src/app/data/tankRacerback.ts',
    'src/app/data/tankTop.ts','src/app/data/tankTrims.ts','src/app/data/tankTshirtNecks.ts','src/app/lib/surfaceColourLinks.ts',
    'src/app/lib/surfaceNativeExport.tsx','src/app/pages/Builder.tsx',
    'src/app/components/builder/printsStudio/ImageArtwork.tsx','src/app/components/builder/tank-details.css')
  '01-claude-setup' = @('.gitignore','package.json','package-lock.json','skills-lock.json','tsconfig.json','src/figma-assets.d.ts','scripts/typecheck.mjs','scripts/change-ledger.ps1','typecheck-baseline.json')
  '02-phase0' = @('src/app/components/builder/TshirtSvgPreview.tsx','src/app/components/builder/shell/FitMeasurementsInspector.tsx',
    'src/app/components/builder/shell/builder-shell.css','src/app/routes.tsx','src/app/components/builder/BuilderLoadingFallback.tsx')
  # routes.tsx also carries the Phase 1 dev-gallery route (one line); its patch stays under 02-phase0.
  '03-phase1' = @('src/app/components/builder/design-system/Canvas.tsx','src/app/components/builder/design-system/Controls.tsx',
    'src/app/components/builder/design-system/Inspector.tsx','src/app/components/builder/design-system/Overlays.tsx',
    'src/app/components/builder/design-system/cx-primitives.css','src/app/components/builder/design-system/cx-tokens.css',
    'src/app/components/builder/design-system/index.ts','src/app/components/builder/design-system/States.tsx','src/app/components/builder/design-system/FitSilhouette.tsx','src/app/components/builder/design-system/fitSilhouettes.ts','scripts/build-fit-silhouettes.mjs','src/app/components/builder/shell/builder-shell-cx.css','src/app/components/builder/shell/builder-light.css','src/app/components/builder/shell/builder-scale.css','src/app/components/builder/shell/FabricBlendEditor.tsx','src/app/components/builder/TrouserDetailsLibrary.tsx','src/app/components/builder/shell/NeckConstructionInspector.tsx','src/app/components/builder/shell/PanellingStudioInspector.tsx','src/app/components/builder/shell/TrouserConstructionInspector.tsx','src/app/components/builder/GarmentLabelsPreview.tsx','src/app/components/builder/shell/builder-shell-cx.reskin-retired.css','src/app/components/builder/shell/BuilderShell.tsx','src/app/components/builder/shell/PrintDesignStudio.tsx','src/app/components/builder/shell/ShoulderConstructionPicker.tsx','src/app/components/builder/shell/TorsoCropControl.tsx','src/app/components/builder/shell/SweatpantsControls.tsx','src/app/components/builder/design-system/GarmentPreviews.tsx','src/app/components/builder/design-system/PresetArt.tsx','src/app/components/builder/shell/MeasurementSupportingPanels.tsx','src/app/components/builder/shell/AdvancedSizingEditor.tsx','src/app/pages/dev/BuilderPrimitives.tsx')
  '04-artwork-phase0' = @('src/app/components/builder/artwork-engine/state/snapping.ts','src/app/components/builder/artwork-engine/interaction/SnapMenu.tsx','src/app/lib/designSnapGuides.ts','src/app/components/builder/shell/DrawingRefinementControls.tsx','src/app/components/builder/artwork-engine/state/focus.ts','src/app/components/builder/artwork-engine/geometry/pivot.ts','src/app/components/builder/shell/ShapesStudio.tsx','src/app/components/builder/shell/VectorEffectsPanel.tsx','src/app/components/builder/artwork-engine/geometry/spacing.ts','src/app/components/builder/artwork-engine/geometry/readout.ts','src/app/components/builder/artwork-engine/interaction/SpacingHints.tsx','src/app/components/builder/shell/ArtworkObjectControls.tsx','src/app/components/builder/artwork-engine/geometry/placement.ts','src/app/components/builder/shell/ArtworkSelectionPanel.tsx','src/app/components/builder/artwork-engine/state/sharedProperties.ts','src/app/components/builder/artwork-engine/interaction/ContextToolbar.tsx','src/app/components/builder/artwork-engine/interaction/context-toolbar.css','src/app/components/builder/artwork-engine/interaction/contextActions.tsx','src/app/components/builder/artwork-engine/interaction/ArtworkContextBar.tsx','src/app/components/builder/printsStudio/ArtworkSelectionTools.tsx','src/app/components/builder/shell/ArtworkPrintMethod.tsx','src/app/components/builder/shell/TextInspector.tsx','src/app/components/builder/shell/ArtworkImageEditor.tsx','src/app/components/builder/shell/SharedArtworkObjectPanel.tsx','src/app/components/builder/shell/StudioObjectPanel.tsx','src/app/components/builder/artwork-engine/README.md','src/app/components/builder/artwork-engine/index.ts','src/app/components/builder/artwork-engine/interaction/index.ts','src/app/components/builder/artwork-engine/interaction/SelectionChrome.tsx','src/app/components/builder/artwork-engine/interaction/selection-chrome.css','src/app/components/builder/artwork-engine/geometry/colour.ts','src/app/components/builder/artwork-engine/state/scene.ts','src/app/components/builder/artwork-engine/state/useNewObjectInk.ts','src/app/components/builder/artwork-engine/state/workspaceState.ts','src/app/components/builder/artwork-engine/state/useArtworkWorkspaceState.ts','src/app/components/builder/SelectionTransformControls.tsx','src/app/components/builder/selection-transform-controls.css','src/app/components/builder/PrintStudioEditor.tsx','src/app/components/builder/printsStudio/LiveShapeDraft.tsx','src/app/components/builder/shell/UnifiedArtworkTools.tsx','scripts/verify-artwork-engine.mjs')
  '05-artwork-phase1' = @('src/app/components/builder/printsStudio/studioAssets.ts','src/app/components/builder/shell/artwork-path-tools.css','src/app/components/builder/shell/shapes-studio.css','src/app/lib/designLayerOrdering.ts','src/app/lib/roundedVectorPath.ts','src/app/lib/shapeGeometry.ts','src/app/lib/studioShapePresets.ts','src/app/components/builder/artwork-engine/geometry/combine.ts','src/app/components/builder/artwork-engine/geometry/repeat.ts','src/app/components/builder/artwork-engine/geometry/shapeBuilder.ts','src/app/components/builder/artwork-engine/geometry/shapes/registry.ts','src/app/components/builder/artwork-engine/inspector/CombineChoices.tsx','src/app/components/builder/artwork-engine/inspector/RepeatControls.tsx','src/app/components/builder/artwork-engine/inspector/repeat-controls.css','src/app/components/builder/artwork-engine/interaction/RepeatCentreHandle.tsx','src/app/components/builder/artwork-engine/interaction/ShapeBuilderOverlay.tsx','src/app/components/builder/artwork-engine/interaction/repeat-centre.css','src/app/components/builder/artwork-engine/interaction/shape-builder.css','src/app/components/builder/artwork-engine/interaction/useCombine.ts','src/app/components/builder/artwork-engine/state/shapeBuilder.ts')
}
$tracked = git ls-files
$status = git status --porcelain=v1 -uall
$changed = $status | ForEach-Object { $_.Substring(3) }
$assigned = @{}
$summary = @("# Change ledger: $Label", '', "Base commit: $(git rev-parse --short HEAD) · $(Get-Date -Format 'yyyy-MM-dd HH:mm')", '')
foreach ($cat in $categories.Keys) {
  $files = $categories[$cat] | Where-Object { $changed -contains $_ }
  $patch = ''
  foreach ($f in $files) {
    $assigned[$f] = $true
    if ($tracked -contains $f) { $patch += (git diff --binary -- $f | Out-String) }
    else { $patch += (git diff --no-index --binary -- /dev/null $f | Out-String) }
  }
  Set-Content "$out/$cat.patch" $patch -Encoding utf8 -NoNewline
  $summary += "## $cat ($($files.Count) files)"
  foreach ($f in $files) { $summary += "- ``$f`` · sha256 $((Get-FileHash $f -Algorithm SHA256).Hash.Substring(0,12))" }
  $summary += ''
}
$skills = $changed | Where-Object { $_ -like '.claude/*' }
$docs = $changed | Where-Object { $_ -like 'docs/builder-audit/*' }
$other = $changed | Where-Object { -not $assigned[$_] -and $_ -notlike '.claude/*' -and $_ -notlike 'docs/builder-audit/*' }
$summary += "## 01-claude-setup: skills (.claude/, untracked)", "- $($skills.Count) files under ``.claude/skills/`` (installed via ``npx skills add`` / ``playwright-cli install --skills``)", ''
$summary += "## docs/builder-audit (untracked)", "- $($docs.Count) files: audit, evidence sheets, phase comparisons, ledgers", ''
$summary += "## Unassigned changes (new phase work, or anything unexpected)"
if ($other) { $other | ForEach-Object { $summary += "- ``$_``" } } else { $summary += '- none' }
Set-Content "$out/LEDGER.md" ($summary -join "`n") -Encoding utf8
Write-Output "Ledger written to $out"
Write-Output ($summary -join "`n")
