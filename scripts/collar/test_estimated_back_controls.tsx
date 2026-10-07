import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ImportedConstructionRegionReview } from '../../src/app/components/builder/ImportedConstructionRegionReview';
import { generateEstimatedBack, regenerateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { importedGarmentLayers, mergeImportedGarmentView, recolorImportedParts, type ImportedGarment } from '../../src/app/data/importedGarment';
import { assignFabric, fabricPartsFromLayers, resolvePartFabric, type FabricAssignments } from '../../src/app/data/garmentFabrics';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';

export async function verifyEstimatedBackControls(front: ImportedGarment, colours: Record<string, string> = {}, fabrics?: FabricAssignments, realBack?: ImportedGarment) {
  let checks = 0;
  const check = (ok: unknown, message: string) => { checks++; if (!ok) throw new Error(message); };
  const before = JSON.stringify(front);
  const result = front.manifest.backView?.inference ? regenerateEstimatedBack(front) : generateEstimatedBack(front);
  if (!result.available) throw new Error(result.reason);
  const garment = result.garment;
  const data = garment.manifest.backView!.constructionRegions!;
  check(data?.regions.length >= 7, 'Missing essential rear regions');
  check(data.regions.every(region => !['pocket', 'zip', 'label', 'decoration', 'fly', 'button'].includes(region.semanticType)), 'Unknown rear detail was invented');
  const parts = garment.parts.filter(part => part.view === 'back');
  const layers = importedGarmentLayers(garment, 'back', colours);
  const fabricParts = fabricPartsFromLayers(layers, garment.manifest.garmentType);
  for (const part of parts) {
    const source = garment.parts.find(p => p.id === part.estimatedFromPartId)!;
    check(source?.view === 'front', `${part.id}: no front appearance source`);
    check(layers.find(layer => layer.id === part.id)?.tint === (colours[source.id] ?? source.color), `${part.id}: colour inheritance failed`);
    const changed = recolorImportedParts(garment, part.id, '#b83457', 'group', colours);
    check(changed[part.id] === '#b83457' && changed[source.id] === colours[source.id], `${part.id}: rear colour override touched front`);
    const fabricPart = fabricParts.find(p => p.id === part.id)!;
    check(Boolean(fabricPart), `${part.id}: no fabric target`);
    const sourceFabric = fabrics?.assignments[source.id];
    if (sourceFabric) check(resolvePartFabric(fabrics, fabricPart)?.id === sourceFabric, `${part.id}: fabric inheritance failed`);
    const seeded = { assignments: { ...fabrics?.assignments, [source.id]: 'french-terry' }, unlinkedGroups: fabrics?.unlinkedGroups ?? [] };
    delete seeded.assignments[part.id];
    check(resolvePartFabric(seeded, fabricPart)?.id === 'french-terry', `${part.id}: source fabric default failed`);
    const assigned = assignFabric(seeded, fabricParts, part.id, 'denim-twill');
    check(resolvePartFabric(assigned, fabricPart)?.id === 'denim-twill' && assigned.assignments[source.id] === 'french-terry', `${part.id}: fabric override touched front`);
    const seededColours = { ...colours, [source.id]: '#3b6291' };
    delete seededColours[part.id];
    check(importedGarmentLayers(garment, 'back', seededColours).find(layer => layer.id === part.id)?.tint === '#3b6291', `${part.id}: dynamic front colour inheritance failed`);
  }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;width:900px;';
  document.body.append(host);
  const root = createRoot(host);
  let selected: string | null = null;
  const render = () => flushSync(() => root.render(<ImportedConstructionRegionReview value={garment} view="back" selectedId={selected} onChange={() => {}} onSelect={id => { selected = id; render(); }}/>));
  try {
    render();
    for (const region of data.regions) {
      const hit = host.querySelector(`[data-region-id="${region.id}"]`)!;
      check(Boolean(hit), `${region.id}: no semantic highlight target`);
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      check(selected === region.id && host.querySelector(`[data-region-id="${region.id}"]`)?.getAttribute('aria-pressed') === 'true', `${region.id}: highlight selection failed`);
    }
  } finally { flushSync(() => root.unmount()); host.remove(); }
  const real = realBack ?? createGarmentRegressionFixture('hoodie', true);
  const replaced = mergeImportedGarmentView(garment, real, 'back');
  check(!replaced.manifest.backView?.inference && !replaced.parts.some(p => p.id.startsWith('estimated-back-')), 'Real back did not replace estimate');
  check(JSON.stringify(front) === before, 'Original draft mutated during tests');
  return { checks, regions: data.regions.map(r => ({ id: r.id, type: r.semanticType, label: r.label })) };
}
