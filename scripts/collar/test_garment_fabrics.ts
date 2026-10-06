import { FABRIC_LIBRARY, FABRIC_PRESETS, applyFabricPreset, assignFabric, fabricPartsFromLayers, fabricTargets, resolvePartFabric, setFabricGroupLinked, type FabricAssignments } from '../../src/app/data/garmentFabrics';
import { getDefaultGarmentSelection, resolveGarmentLayers, type ResolvedGarmentLayer } from '../../src/app/data/garmentSvgCatalog';
import { createGarmentRegressionFixture, createCroppedTankFixture } from '../../src/app/data/garmentRegressionFixtures';

export function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function verifyFabricModel() {
  check(FABRIC_LIBRARY.length === 14 && new Set(FABRIC_LIBRARY.map(f => f.id)).size === 14, 'Expected 14 distinct fabrics');
  for (const fabric of FABRIC_LIBRARY) {
    check(fabric.composition && fabric.gsm > 0 && fabric.scale > 0 && fabric.structure && fabric.drape && fabric.thickness && fabric.stretch, `Missing metadata: ${fabric.id}`);
    check(fabric.roughness >= 0 && fabric.roughness <= 1 && fabric.sheen >= 0 && fabric.sheen <= 1, 'Invalid rendering metadata');
    check(fabric.textureType !== ('cotton' as string), 'Composition must not be a texture');
  }
  const layers = resolveGarmentLayers({ garmentType: 'tshirt', selection: getDefaultGarmentSelection('tshirt', 'regular'), fit: 'regular' });
  const before = JSON.stringify(layers), parts = fabricPartsFromLayers(layers, 'tshirt');
  check(parts.some(part => part.id === 'base') && parts.some(part => part.id === 'neck'), 'Missing tee solids');
  check(!parts.some(part => ['outline', 'stitching'].includes(part.id)), 'Ink exposed as a fabric target');
  check(fabricTargets(parts).some(target => target.id === 'group:sleeves') && fabricTargets(parts).some(target => target.id === 'sleeveLeft'), 'Missing group or side targets');
  const original: FabricAssignments = { assignments: { unrelated: 'denim-twill' }, unlinkedGroups: [] };
  const linked = assignFabric(original, parts, 'sleeveLeft', 'mesh');
  check(linked.assignments.sleeveRight === 'mesh' && linked.assignments.unrelated === 'denim-twill', 'Linked assignment or preservation failed');
  check(!original.assignments.sleeveLeft, 'Input state mutated');
  const unlinked = setFabricGroupLinked(linked, parts, 'sleeves', false);
  const mixed = assignFabric(unlinked, parts, 'sleeveLeft', 'single-jersey');
  check(mixed.assignments.sleeveRight === 'mesh' && mixed.assignments.sleeveLeft === 'single-jersey', 'Unlinked assignment leaked');
  const relinked = setFabricGroupLinked(mixed, [...parts].reverse(), 'sleeves', true);
  check(relinked.assignments.sleeveLeft === relinked.assignments.sleeveRight && relinked.assignments.sleeveLeft === 'single-jersey', 'Relink must choose stable first assigned ID');
  check(!relinked.unlinkedGroups.includes('sleeves'), 'Relink flag not cleared');
  check(JSON.stringify(assignFabric(mixed, parts, 'base', 'not-a-fabric')) === JSON.stringify(mixed), 'Unknown fabric changed state');
  check(JSON.stringify(assignFabric(mixed, parts, 'missing', 'mesh')) === JSON.stringify(mixed), 'Unknown target changed state');
  check(!resolvePartFabric(undefined, parts[0]), 'Legacy projects must remain untextured');
  const preset = applyFabricPreset(mixed, parts, 'jersey-mesh');
  check(preset.assignments.base === 'single-jersey' && preset.assignments.sleeveLeft === 'mesh' && preset.assignments.neck === 'rib-1x1', 'Tee preset incorrect');
  check(preset.assignments.unrelated === 'denim-twill' && preset.unlinkedGroups.includes('sleeves'), 'Preset lost unrelated state');
  const restored = JSON.parse(JSON.stringify(preset));
  check(parts.every(part => resolvePartFabric(restored, part)?.id === preset.assignments[part.id]), 'JSON round trip failed');
  for (const fit of ['slim', 'boxy', 'oversized']) {
    const other = fabricPartsFromLayers(resolveGarmentLayers({ garmentType: 'tshirt', selection: getDefaultGarmentSelection('tshirt', fit), fit, view: typeof DOMParser === 'undefined' ? 'front' : 'back' }), 'tshirt');
    check(other.filter(part => ['base', 'neck', 'sleeveLeft', 'sleeveRight'].includes(part.id)).every(part => !!resolvePartFabric(restored, part)), `Fit/back lost source IDs: ${fit}`);
  }
  const hoodie = fabricPartsFromLayers(resolveGarmentLayers({ garmentType: 'hoodie', selection: getDefaultGarmentSelection('hoodie') }), 'hoodie');
  check(hoodie.some(part => part.id === 'sleeveLeft') && hoodie.some(part => part.id === 'sleeveRight') && !hoodie.some(part => part.id === 'sleeves'), 'Combined sleeve source was not expanded');
  const hoodState = applyFabricPreset(undefined, hoodie, 'terry-fleece');
  check(hoodState.assignments.base === 'french-terry' && hoodState.assignments.hood === 'french-terry' && hoodState.assignments.sleeveLeft === 'heavyweight-fleece', 'Hoodie preset incorrect');
  for (const type of ['shorts', 'trousers', 'jacket', 'skirt', 'dress'] as const) {
    const imported = createGarmentRegressionFixture(type);
    const resolved = resolveGarmentLayers({ garmentType: 'tshirt', selection: {}, customAssetState: { importedGarment: imported } });
    const importedParts = fabricPartsFromLayers(resolved, 'tshirt');
    check(importedParts.length >= imported.parts.length, `Non-tee parts omitted: ${type}`);
    check(imported.parts.every(part => importedParts.some(candidate => candidate.id === part.id)), 'Imported source IDs changed');
  }
  const tank = createCroppedTankFixture();
  const tankLayers = resolveGarmentLayers({ garmentType: 'tshirt', selection: {}, customAssetState: { importedGarment: tank } });
  check(!fabricPartsFromLayers(tankLayers, 'tshirt').some(part => /buckle/.test(part.id)), 'Hardware misclassified as fabric');
  const solid: ResolvedGarmentLayer = { id: 'lining', category: 'lining', displayName: 'Hood lining', kind: 'solid', assetId: 'lining', svgRaw: '', zIndex: 0 };
  const trimParts = fabricPartsFromLayers([solid, { ...solid, id: 'left-cuff', category: 'cuff', displayName: 'Left cuff' }, { ...solid, id: 'right-cuff', category: 'cuff', displayName: 'Right cuff' }, { ...solid, id: 'waistband', category: 'waistband', displayName: 'Waistband' }], 'hoodie');
  check(trimParts.find(part => part.id === 'lining')?.interior, 'Identified lining lost interior status');
  const trimPreset = applyFabricPreset(undefined, trimParts, 'terry-fleece');
  check(trimPreset.assignments['left-cuff'] === 'rib-1x1' && trimPreset.assignments.waistband === 'rib-1x1', 'Rib trim preset failed');
  check(fabricTargets(trimParts).some(target => target.id === 'group:cuffs'), 'Missing cuff group');
  const teeDefault = applyFabricPreset(undefined, parts, 'tshirt-default').assignments;
  check(teeDefault.base === 'single-jersey' && teeDefault.sleeveLeft === 'single-jersey' && teeDefault.neck === 'rib-1x1', 'T-shirt default must not substitute the mesh demonstration');
  const hoodieDefault = applyFabricPreset(undefined, [...hoodie, ...trimParts], 'hoodie-default').assignments;
  check(hoodieDefault.base === 'french-terry' && hoodieDefault.sleeveLeft === 'french-terry' && hoodieDefault.hood === 'french-terry' && hoodieDefault['left-cuff'] === 'rib-1x1' && hoodieDefault.waistband === 'rib-1x1', 'Hoodie default must preserve terry body/sleeves and rib trims');
  const heavy = applyFabricPreset(undefined, [...parts, ...trimParts], 'heavy-sweatshirt').assignments;
  check(heavy.base === 'heavyweight-fleece' && heavy.sleeveLeft === 'heavyweight-fleece' && heavy.neck === 'rib-2x2' && heavy.bodyHem === 'rib-2x2' && heavy['left-cuff'] === 'rib-2x2', 'Heavy sweatshirt must use fleece with 2x2 rib trims');
  const panelLayer: ResolvedGarmentLayer = { ...solid, id: 'body-panel-source', category: 'body', displayName: 'Body', colourPanels: JSON.parse('[{"id":"body-panel-a","svgRaw":""},{"id":"body-panel-b","svgRaw":""}]') };
  const pairedLayers = [panelLayer, { ...solid, id: 'left-pocket', category: 'pocket', displayName: 'Left pocket' }, { ...solid, id: 'right-pocket', category: 'pocket', displayName: 'Right pocket' }];
  const combined = fabricPartsFromLayers([...pairedLayers, ...pairedLayers], 'jacket');
  check(combined.length === 5 && new Set(combined.map(part => part.id)).size === combined.length, 'Front/back concatenation duplicated source or panel IDs');
  const panel = combined.find(part => part.id === 'body-panel-a')!;
  check(panel.parentId === panelLayer.id && combined.some(part => part.id === 'body-panel-b'), 'Untinted panel identities missing');
  const parentFabric = assignFabric(undefined, combined, panelLayer.id, 'single-jersey');
  check(resolvePartFabric({ assignments: { [panelLayer.id]: 'single-jersey' }, unlinkedGroups: [] }, panel)?.id === 'single-jersey', 'Panel did not inherit its parent fabric');
  const panelFabric = assignFabric(parentFabric, combined, panel.id, 'mesh');
  check(panelFabric.assignments[panel.id] === 'mesh' && panelFabric.assignments['body-panel-b'] === 'single-jersey', 'Panel override leaked to its sibling');
  check(assignFabric(panelFabric, combined, panelLayer.id, 'waffle').assignments[panel.id] === 'waffle', 'Whole-part assignment failed to update child panels');
  const leftPocket = combined.find(part => part.id === 'left-pocket')!;
  check(leftPocket.group && leftPocket.group === combined.find(part => part.id === 'right-pocket')?.group, 'Other explicit left/right pairs not inferred');
  check(assignFabric(undefined, combined, 'left-pocket', 'denim-twill').assignments['right-pocket'] === 'denim-twill', 'Inferred pair did not default to linked');
  check(JSON.stringify(layers) === before, 'Source layers or colours mutated');
  return { fabrics: FABRIC_LIBRARY.length, presets: FABRIC_PRESETS.length, teeParts: parts.length, hoodieParts: hoodie.length, checks: 'metadata, assignments, linking, presets, persistence, source IDs, five imported families, hardware, lining' };
}
