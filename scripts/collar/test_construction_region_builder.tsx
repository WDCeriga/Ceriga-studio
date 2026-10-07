import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportedGarmentEditor } from '../../src/app/components/builder/ImportedGarmentEditor';
import { normalizeImportedGarment } from '../../src/app/data/importedGarment';
import { ConstructionRegionHitTargets } from '../../src/app/components/builder/ConstructionRegionHitTargets';
import { FabricControls } from '../../src/app/components/builder/FabricControls';
import { assignFabric, fabricPartsFromLayers, setFabricGroupLinked } from '../../src/app/data/garmentFabrics';
import type { ResolvedGarmentLayer } from '../../src/app/data/garmentSvgCatalog';
import type { ImportedGarment } from '../../src/app/data/importedGarment';
import { reconcileImportedRegionAssignments } from '../../src/app/data/importedRegionAssignments';

export function runConstructionRegionBuilderTests() {
  let checks = 0;
  const check = (value: unknown, message: string) => { if (!value) throw new Error(message); checks++; };
  const layer = (id: string, role: string, group?: string): ResolvedGarmentLayer => ({
    id, assetId: id, category: role, displayName: id, svgRaw: '<svg/>', kind: 'solid', zIndex: 1,
    washable: false, fabricRegion: { role, group },
  });
  const layers = [layer('front-upper-body', 'body'), layer('front-lower-body', 'body'),
    layer('front-left-sleeve', 'sleeve', 'front-sleeves'), layer('front-right-sleeve', 'sleeve', 'front-sleeves'),
    layer('back-left-sleeve', 'sleeve', 'back-sleeves'), layer('back-right-sleeve', 'sleeve', 'back-sleeves'),
    { ...layer('front-source-ink', 'panel'), fabricRegion: undefined },
    { ...layer('zip-slider', 'zip'), fabricRegion: undefined }];
  const original = JSON.stringify(layers);
  const parts = fabricPartsFromLayers(layers, 'hoodie');
  check(parts.length === 6, 'Only semantic fabric fill layers are fabric targets, regardless of wash setting');
  const upper = assignFabric(undefined, parts, 'front-upper-body', 'nylon-taslan');
  const body = assignFabric(upper, parts, 'front-lower-body', 'french-terry');
  check(body.assignments['front-upper-body'] === 'nylon-taslan' && body.assignments['front-lower-body'] === 'french-terry', 'Chest panels need separate fabrics');
  const paired = assignFabric(body, parts, 'front-left-sleeve', 'mesh');
  check(paired.assignments['front-right-sleeve'] === 'mesh', 'Explicit symmetry fabric groups link by default');
  check(!paired.assignments['back-left-sleeve'], 'Front/back must not be linked by semantic role alone');
  const unlinked = assignFabric(setFabricGroupLinked(paired, parts, 'front-sleeves', false), parts, 'front-left-sleeve', 'single-jersey');
  check(unlinked.assignments['front-right-sleeve'] === 'mesh', 'Unlinked fabric assignments remain independent');
  const independent = fabricPartsFromLayers([layer('left-cuff', 'cuff'), layer('right-cuff', 'cuff')], 'hoodie');
  check(independent.every(part => !part.group), 'Do not reinfer deliberately unlinked semantic pairs');
  check(JSON.stringify(layers) === original, 'Fabric assignment must not alter authoritative ink or geometry');
  const controls = renderToStaticMarkup(<FabricControls parts={parts} value={body} selectedPartId="front-upper-body" onChange={() => {}} />);
  check(controls.includes('100% nylon') && controls.includes('140 GSM'), 'Fabric controls must follow the selected chest panel');
  const regions = [{ id: 'upper', label: 'Upper front panel', path: 'M 0 0 L 100 0 Q 70 50 0 40 Z', editableIndependently: true, zIndex: 1 },
    { id: 'lower', label: 'Lower front panel', path: 'M 0 40 Q 70 50 100 0 L 100 100 L 0 100 Z', editableIndependently: true, zIndex: 2 },
    { id: 'ink', label: 'Construction ink', path: 'M 0 0 L 1 1 Z', editableIndependently: false, zIndex: 3 }];
  const hits = renderToStaticMarkup(<ConstructionRegionHitTargets regions={regions} selectedId="upper" />);
  check(hits.includes('data-construction-region-hit="upper"') && hits.includes('data-construction-region-hit="lower"'), 'Chest panels need distinct click targets');
  check(hits.includes('Q 70 50') && !hits.includes('<rect'), 'Click geometry must follow the curved seam, not bounding boxes');
  check(!hits.includes('data-construction-region-hit="ink"'), 'Source ink must not intercept fabric clicks');
  check(hits.includes('fill-rule="evenodd"') && hits.includes('pointer-events="fill"'), 'Opening holes must remain non-selectable');
  check(hits.includes('aria-label="Select Upper front panel"') && hits.includes('aria-pressed="true"'), 'Semantic selection must be accessible');
  const fixture = (entries: { id: string; view: 'front' | 'back'; candidateIds: string[]; fabricGroupId?: string }[]) => ({
    manifest: { view: 'front' }, parts: entries.map(entry => ({ ...entry, colorable: true })),
    constructionRegions: { version: 1, regions: entries.filter(entry => entry.view === 'front') },
  }) as unknown as ImportedGarment;
  const previous = fixture([{ id: 'body', view: 'front', candidateIds: ['a', 'b'], fabricGroupId: 'old-pair' }]);
  const split = fixture([{ id: 'upper', view: 'front', candidateIds: ['a'] }, { id: 'lower', view: 'front', candidateIds: ['b'] }]);
  const restored = reconcileImportedRegionAssignments(previous, split, { body: '#123456', label: '#ffffff' }, { assignments: { body: 'nylon-taslan' }, unlinkedGroups: ['old-pair'] });
  check(restored.partColors?.upper === '#123456' && restored.partColors?.lower === '#123456', 'Source-cell split children inherit external colour overrides');
  check(restored.fabricAssignments?.assignments.upper === 'nylon-taslan' && restored.fabricAssignments.assignments.lower === 'nylon-taslan', 'Split children inherit external fabric assignments');
  check(!restored.partColors?.body && restored.partColors?.label === '#ffffff' && restored.fabricAssignments?.unlinkedGroups.length === 0, 'Remove obsolete region/group IDs without deleting unrelated overrides');
  const merged = reconcileImportedRegionAssignments(split, fixture([{ id: 'upper', view: 'front', candidateIds: ['a', 'b'] }]), { upper: '#ff0000', lower: '#00ff00' }, { assignments: { upper: 'mesh', lower: 'denim-twill' }, unlinkedGroups: [] });
  check(merged.partColors?.upper === '#ff0000' && !merged.partColors.lower && merged.fabricAssignments?.assignments.upper === 'mesh', 'Merge retains selected target overrides and removes vanished IDs');
  return { checks };
}

export async function verifyLegacyConstructionRegionButton(garment: ImportedGarment) {
  const original = JSON.stringify(garment);
  const responseGarment = normalizeImportedGarment(JSON.parse(original));
  const view = responseGarment.manifest.view;
  const key = view === 'front' ? 'frontView' : 'backView';
  const trace: ImportedGarment = { ...responseGarment, constructionRegions: undefined,
    manifest: { ...responseGarment.manifest, [key]: { ...responseGarment.manifest[key], constructionRegions: undefined } } };
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;width:1000px';
  document.body.append(host);
  const root = createRoot(host), originalFetch = window.fetch;
  let updated: ImportedGarment | undefined, requests = 0;
  function Harness() {
    const [value, setValue] = React.useState(trace);
    return <ImportedGarmentEditor value={value} view={view} step={2} selectedId={null}
      onChange={next => { updated = next; setValue(next); }} onSelect={() => {}} onColor={() => {}}
      onReplace={() => {}} onResetColors={() => {}} />;
  }
  try {
    window.fetch = async (input, init) => {
      if (input !== '/api/garment-construction-regions') return originalFetch(input, init);
      requests++;
      return new Response(JSON.stringify({ type: 'result', garment: responseGarment }) + '\n', { status: 200 });
    };
    flushSync(() => root.render(<Harness />));
    const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Construction regions');
    if (!button) throw new Error('Construction regions button missing');
    button.click();
    for (let attempt = 0; attempt < 100 && !updated; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
    if (!updated) throw new Error(host.textContent || 'Construction analysis did not finish');
    await new Promise(resolve => setTimeout(resolve, 50));
    const ids = updated.sourceManifest.regions.map(region => region.id);
    if (new Set(ids).size !== ids.length || ids.length !== responseGarment.sourceManifest.regions.length)
      throw new Error('Source evidence was duplicated or lost');
    if (!document.querySelector('[role="dialog"]')?.textContent?.includes('Construction regions'))
      throw new Error('Construction review did not open');
    if (responseGarment.parts.some(part => JSON.stringify(part) !== JSON.stringify(updated!.parts.find(candidate => candidate.id === part.id))))
      throw new Error('Re-analysis changed normalized garment geometry');
    if (JSON.stringify(garment) !== original) throw new Error('Input garment mutated');
    return { requests, sourceRegions: ids.length, reviewOpened: true, geometryPreserved: true };
  } finally {
    window.fetch = originalFetch;
    flushSync(() => root.unmount());
    host.remove();
  }
}
