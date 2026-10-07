import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { importedGarmentLayers, mergeImportedGarmentView, normalizeImportedGarment, type ImportedGarment } from '../../src/app/data/importedGarment';
import { constructionRegionSvg, constructionRegionsForView, paintConstructionRegion, reviewConstructionRegions, type ConstructionRegions } from '../../src/app/data/importedConstructionRegions';
import { constructionBrushPath, enclosedConstructionArea, selectUnassignedConstructionArea } from '../../src/app/lib/constructionRegionPainting';
import { ImportedConstructionRegionReview } from '../../src/app/components/builder/ImportedConstructionRegionReview';

function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;
function fixture(view: 'front' | 'back' = 'front'): ImportedGarment {
  const base = createGarmentRegressionFixture('tee'), template = base.parts.find(part => part.layerKind === 'structural')!;
  const ink = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="M1000 100H1400V500H1000Z" fill="none" stroke="black" stroke-width="8"/></svg>';
  const data: ConstructionRegions = { version: 1, status: 'reviewed', constructionInk: ink, seams: [], warnings: [], hardware: [], closures: [], stitchingPaths: [],
    regions: [
      { id: `${view}-pocket`, label: 'Pocket', semanticType: 'pocket', builderCategory: 'pockets-zips', path: rect(100, 100, 800, 550) },
      { id: `${view}-hem`, label: 'Hem', semanticType: 'hem', builderCategory: 'hem-cuffs', path: rect(100, 650, 800, 150) },
      { id: `${view}-button`, label: 'Button', semanticType: 'button', builderCategory: 'trims-details', path: rect(400, 400, 50, 50) },
    ].map((region, i) => ({ ...region, view, confidence: .7, zIndex: i, editableIndependently: true, parentRegionId: null, mirroredPairId: null,
      colourGroupId: region.id, fabricGroupId: region.id, candidateIds: [] })) as ConstructionRegions['regions'] };
  const parts = data.regions.map(region => ({ ...template, id: region.id, view, color: '#123456', svg: constructionRegionSvg(region.path) }));
  parts.push({ ...template, id: `${view}-ink`, view, structuralRole: 'source-ink', colorable: false, svg: ink, constructionSvg: ink, color: '#000000' });
  return normalizeImportedGarment({ ...base, parts, detailLayers: [], processingMode: 'trace-only', constructionRegions: data,
    manifest: { ...base.manifest, view, frontView: undefined, backView: undefined }, accepted: true, reviewed: true });
}

export function verifyConstructionRegionPainting() {
  let checks = 0;
  const verify = (condition: unknown, message: string) => { check(condition, message); checks++; };
  const front = fixture(), original = JSON.stringify(front), ink = front.parts.find(part => part.id === 'front-ink')!;
  const path = rect(150, 600, 100, 100);
  const edited = paintConstructionRegion(front, 'front', 'front-hem', path, 'paint').garment;
  verify(!edited.accepted && !edited.reviewed && constructionRegionsForView(edited, 'front')!.status === 'needs-review', 'Geometry must invalidate acceptance');
  verify(edited.parts.find(part => part.id === 'front-ink') === ink, 'Source ink object changed');
  verify(edited.parts.find(part => part.id === 'front-hem')!.area * 2048 ** 2 === 125000, 'Hem did not gain pocket overlap');
  verify(edited.parts.find(part => part.id === 'front-pocket')!.area * 2048 ** 2 === 435000, 'Pocket did not lose hem overlap');
  verify(edited.parts.find(part => part.id === 'front-hem')!.color === '#123456', 'Existing colour reset');
  verify(constructionRegionsForView(edited, 'front')!.regions.filter(region => region.geometrySource === 'manual').length === 2, 'Manual provenance missing');
  verify(JSON.stringify(front) === original, 'Input was mutated');
  const hole = paintConstructionRegion(front, 'front', 'front-pocket', rect(200, 200, 100, 100), 'erase').garment;
  verify(hole.parts.find(part => part.id === 'front-pocket')!.area * 2048 ** 2 === 430000, 'Erase did not preserve a hole');
  const restored = paintConstructionRegion(hole, 'front', 'front-pocket', rect(200, 200, 100, 100), 'paint').garment;
  verify(restored.parts.find(part => part.id === 'front-pocket')!.area * 2048 ** 2 === 440000, 'Painting a hole toggled existing fill');
  const protectedPaint = paintConstructionRegion(front, 'front', 'front-hem', rect(390, 390, 70, 70), 'paint').garment;
  verify(protectedPaint.parts.find(part => part.id === 'front-hem')!.area * 2048 ** 2 === 122400, 'Brush overwrote protected hardware');
  verify(protectedPaint.parts.find(part => part.id === 'front-button')!.svg === front.parts.find(part => part.id === 'front-button')!.svg, 'Hardware geometry changed');
  const created = paintConstructionRegion(front, 'front', null, rect(1010, 110, 380, 380), 'paint', 'Missed lining');
  const newPart = created.garment.parts.find(part => part.id === created.regionId)!;
  verify(newPart.colorable && newPart.name === 'Missed lining' && newPart.view === 'front', 'New region is not independently colourable');
  verify(newPart.colourGroup !== front.parts[0].colourGroup && newPart.fabricGroup !== front.parts[0].fabricGroup, 'New region inherited linked materials');
  const reviewed = reviewConstructionRegions(normalizeImportedGarment(JSON.parse(JSON.stringify(created.garment))), 'front');
  verify(importedGarmentLayers(reviewed, 'front', { [created.regionId]: '#ff0000' }).find(layer => layer.id === created.regionId)?.tint === '#ff0000', 'New region does not colour after save/reload');
  const combined = mergeImportedGarmentView(front, fixture('back'), 'back');
  const backBefore = JSON.stringify(constructionRegionsForView(combined, 'back'));
  verify(JSON.stringify(constructionRegionsForView(paintConstructionRegion(combined, 'front', 'front-hem', path, 'paint').garment, 'back')) === backBefore, 'Editing front changed back');
  const withCandidate = fixture();
  constructionRegionsForView(withCandidate, 'front')!.seams = [{ id: 'old', label: 'Old seam', regionId: 'front-hem', parts: [] }];
  constructionRegionsForView(withCandidate, 'front')!.candidates = [{ id: 'old-cell', label: 'Old cell', path, bounds: [], area: 10000, confidence: .7, regionId: 'front-hem' }];
  const invalidated = constructionRegionsForView(paintConstructionRegion(withCandidate, 'front', 'front-hem', path, 'paint').garment, 'front')!;
  verify(!invalidated.seams.length && !invalidated.candidates?.length, 'Stale splits survived a manual correction');
  const throws = (action: () => unknown, message: string) => { let failed = false; try { action(); } catch { failed = true; } verify(failed, message); };
  throws(() => paintConstructionRegion(front, 'front', 'front-button', path, 'paint'), 'Hardware accepted as fabric');
  for (const semanticType of ['drawstring', 'rivet', 'zip', 'label', 'decoration'] as const) {
    const protectedGarment = fixture();
    constructionRegionsForView(protectedGarment, 'front')!.regions[2].semanticType = semanticType;
    throws(() => paintConstructionRegion(protectedGarment, 'front', 'front-button', path, 'paint'), `${semanticType} accepted as fabric`);
    const painted = paintConstructionRegion(protectedGarment, 'front', 'front-hem', rect(390, 390, 70, 70), 'paint').garment;
    verify(painted.parts.find(part => part.id === 'front-hem')!.area * 2048 ** 2 === 122400, `Brush overwrote ${semanticType}`);
  }
  verify(paintConstructionRegion(front, 'front', 'front-hem', rect(150, 700, 20, 20), 'paint').garment === front, 'No-op paint invalidated review');
  verify(paintConstructionRegion(front, 'front', 'front-hem', rect(1500, 1500, 20, 20), 'erase').garment === front, 'No-op erase invalidated review');
  const clipped = paintConstructionRegion(front, 'front', null, rect(-20, -20, 40, 40), 'paint');
  verify(clipped.garment.parts.find(part => part.id === clipped.regionId)!.area * 2048 ** 2 === 400, 'Brush escaped drawing bounds');
  const second = paintConstructionRegion(created.garment, 'front', null, rect(1500, 110, 50, 50), 'paint');
  verify(second.regionId !== created.regionId && second.garment.parts.some(part => part.id === created.regionId), 'New region ID collided');
  throws(() => paintConstructionRegion(front, 'front', 'front-hem', rect(0, 0, 2048, 2048), 'erase'), 'Erasing an entire region should fail safely');
  throws(() => paintConstructionRegion(front, 'back', 'front-hem', path, 'paint'), 'Wrong-view edit accepted');
  throws(() => paintConstructionRegion(front, 'front', null, path, 'paint', ''), 'Blank region name accepted');
  const brush = constructionBrushPath([[150, 610], [300, 610]], 20);
  verify(paintConstructionRegion(front, 'front', 'front-hem', brush, 'paint').garment.parts.find(part => part.id === 'front-hem')!.area > 120000 / 2048 ** 2, 'Continuous brush stroke did not paint');
  const blocked = new Uint8Array(32 * 32);
  for (let i = 4; i <= 20; i++) { blocked[4 * 32 + i] = blocked[20 * 32 + i] = blocked[i * 32 + 4] = blocked[i * 32 + 20] = 1; }
  blocked[10 * 32 + 10] = 1;
  const enclosed = enclosedConstructionArea(blocked, 32, [600, 600]);
  verify((enclosed.match(/M/g) ?? []).length === 2, 'Area selection filled a protected island');
  throws(() => enclosedConstructionArea(blocked, 32, [0, 0]), 'Background selection accepted');
  throws(() => enclosedConstructionArea(blocked, 32, [4 * 64, 4 * 64]), 'Line selection accepted');
  blocked[4 * 32 + 8] = 0;
  throws(() => enclosedConstructionArea(blocked, 32, [600, 600]), 'Open boundary flood was not rejected');
  return { checks };
}

export async function verifyConstructionRegionPaintingBrowser() {
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;overflow:auto;width:1100px;background:#222;z-index:99999'; document.body.append(host);
  const root = createRoot(host);
  let garment = fixture(), selected: string | null = 'front-hem', checks = 0;
  const verify = (condition: unknown, message: string) => { check(condition, message); checks++; };
  const render = () => flushSync(() => root.render(<ImportedConstructionRegionReview value={garment} view="front" selectedId={selected} onSelect={id => { selected = id; }} onChange={next => { garment = next; }}/>));
  const button = (text: string) => Array.from(host.querySelectorAll('button')).find(item => item.textContent === text)!;
  const click = (text: string) => { check(button(text), `Missing ${text}`); flushSync(() => button(text).click()); render(); };
  const pointer = (name: string, point: [number, number]) => {
    const svg = host.querySelector<SVGSVGElement>('svg')!;
    svg.setPointerCapture = () => {}; svg.hasPointerCapture = () => false;
    const p = svg.createSVGPoint(); p.x = point[0]; p.y = point[1]; const screen = p.matrixTransform(svg.getScreenCTM()!);
    flushSync(() => svg.dispatchEvent(new PointerEvent(name, { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: screen.x, clientY: screen.y })));
    render();
  };
  try {
    render(); click('Paint into region'); pointer('pointerdown', [150, 610]); pointer('pointermove', [300, 610]); pointer('pointerup', [300, 610]);
    verify(constructionRegionsForView(garment, 'front')!.regions.find(region => region.id === 'front-hem')!.geometrySource === 'manual', 'Pointer stroke not committed');
    const path = constructionRegionsForView(garment, 'front')!.regions.find(region => region.id === 'front-hem')!.path;
    verify(new Path2D(path) instanceof Path2D, 'Saved brush path is not valid SVG');
    click('Undo correction'); verify(garment.accepted, 'Undo did not restore review state');
    click('Erase from region'); pointer('pointerdown', [300, 700]); pointer('pointercancel', [320, 700]); pointer('pointerup', [320, 700]);
    verify(garment.accepted, 'Cancelled stroke was saved');
    pointer('pointerdown', [300, 700]); pointer('pointerup', [300, 700]);
    verify(!garment.accepted, 'Erase stroke not committed'); click('Undo correction');
    click('New colourable region'); click('Select missed area'); pointer('pointerdown', [1200, 300]);
    for (let i = 0; i < 100 && !button('Apply selected area'); i++) await new Promise(resolve => setTimeout(resolve, 10));
    verify(Boolean(button('Apply selected area')), `Missing-area preview not shown: ${host.querySelector('[role="alert"]')?.textContent}`);
    verify(garment.parts.length === fixture().parts.length, 'Area saved before confirmation');
    click('Apply selected area'); verify(selected === 'front-manual-1' && garment.parts.some(part => part.id === selected && part.colorable), 'New missed-area region was not selected and saved');
    const context = document.createElement('canvas').getContext('2d')!;
    const newPath = constructionRegionsForView(garment, 'front')!.regions.find(region => region.id === selected)!.path;
    verify(context.isPointInPath(new Path2D(newPath), 1200, 300, 'evenodd'), 'Missed-area fill excludes the clicked point');
    verify(!context.isPointInPath(new Path2D(newPath), 900, 300, 'evenodd'), 'Missed-area fill leaks outside ink');
    click('Undo correction'); verify(!garment.parts.some(part => part.id === 'front-manual-1'), 'Undo left an orphan new region');
    pointer('pointerdown', [1200, 300]);
    for (let i = 0; i < 100 && !button('Apply selected area'); i++) await new Promise(resolve => setTimeout(resolve, 10));
    verify(Boolean(button('Apply selected area')), 'Second missed-area preview missing');
    click('Cancel area selection'); verify(!button('Apply selected area') && garment.accepted, 'Cancelled area was saved');
    pointer('pointerdown', [1200, 300]); click('Select regions');
    await new Promise(resolve => setTimeout(resolve, 100));
    verify(!button('Apply selected area') && !host.querySelector('[role="status"]'), 'Stale async area selection survived tool change');
    click('Paint into region'); pointer('pointerdown', [150, 610]); pointer('pointerup', [150, 610]);
    const firstCorrection = garment;
    pointer('pointerdown', [350, 610]); pointer('pointerup', [350, 610]);
    click('Undo correction'); verify(garment === firstCorrection, 'Undo did not restore the previous correction');
    click('Undo correction'); verify(garment.accepted, 'Multi-step undo did not restore the original');
    click('Select regions'); click('Select missed area'); pointer('pointerdown', [20, 20]);
    for (let i = 0; i < 100 && !host.querySelector('[role="alert"]'); i++) await new Promise(resolve => setTimeout(resolve, 10));
    verify(host.querySelector('[role="alert"]')?.textContent?.includes('background'), 'Background flood did not report safe fallback');
    const missingPath = await selectUnassignedConstructionArea(constructionRegionsForView(fixture(), 'front')!, [1200, 300]);
    verify(context.isPointInPath(new Path2D(missingPath), 1200, 300, 'evenodd'), 'Raster selector failed');
    return { checks, pointerPaintEraseUndo: true, missedAreaPreviewAndCreation: true };
  } finally { flushSync(() => root.unmount()); host.remove(); }
}
