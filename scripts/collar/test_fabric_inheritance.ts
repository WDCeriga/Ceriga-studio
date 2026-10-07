import {
  FABRIC_LIBRARY, initializeFabricDefaults, resetFabricDefaults, setGarmentFabric, setCategoryFabric,
  resolvePartFabric, resolvePartMaterial, resolveInteriorColour, fabricCategoryForPart, fabricPartsFromLayers,
  assignFabric, resetPartFabric, setFabricGroupLinked, applyFabricPreset, type FabricPart, type FabricAssignments,
} from '../../src/app/data/garmentFabrics';
import { fabricAssignmentIssues, fabricScanSurface, FABRIC_SOURCES, validateFabricSources } from '../../src/app/lib/fabricTextureScans';
import { getDefaultGarmentSelection, resolveGarmentLayers, type ResolvedGarmentLayer } from '../../src/app/data/garmentSvgCatalog';
import { schematicFabricParts } from '../../src/app/data/schematicFabricParts';
import { check } from './test_garment_fabrics';

export function verifyFabricInheritance() {
  const parts: FabricPart[] = [
    { id: 'base', label: 'Body', role: 'body' },
    { id: 'sleeveLeft', label: 'Left sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'sleeveRight', label: 'Right sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'neck', label: 'Neck', role: 'neck', fallbackFromId: 'base' },
    { id: 'cuffLeft', label: 'Left cuff', role: 'cuff', group: 'cuffs' },
    { id: 'cuffRight', label: 'Right cuff', role: 'cuff', group: 'cuffs' },
    { id: 'waistband', label: 'Waistband', role: 'waistband' },
    { id: 'panel', label: 'Chest panel', role: 'panel', parentId: 'base' },
    { id: 'rear', label: 'Rear body', role: 'body', defaultFromId: 'base' },
    { id: 'inside', label: 'Body interior', role: 'inner', surface: 'reverse', exteriorPartId: 'base' },
    { id: 'lining', label: 'Separate lining', role: 'lining', surface: 'lining', exteriorPartId: 'base' },
  ];
  const part = (id: string) => parts.find(candidate => candidate.id === id)!;
  const id = (state: FabricAssignments | undefined, name: string) => resolvePartFabric(state, part(name), parts)?.id;
  const beforeParts = JSON.stringify(parts);
  const fresh = initializeFabricDefaults('tshirt');
  check(Object.keys(fresh.assignments).length === 0 && fresh.unlinkedGroups.length === 0, 'Defaults duplicated per-part state');
  check(['base', 'sleeveLeft', 'sleeveRight', 'panel', 'rear', 'inside'].every(name => id(fresh, name) === 'single-jersey'), 'Main fabric inheritance failed');
  check(id(fresh, 'neck') === 'single-jersey' && id(fresh, 'cuffLeft') === 'rib-1x1' && id(fresh, 'waistband') === 'rib-1x1', 'Neck inheritance or existing cuff defaults incorrect');
  check(resolvePartFabric(fresh, part('base'))?.gsm === 180 && resolvePartFabric(fresh, part('neck'))?.gsm === 180, 'Default garment weights incorrect');
  check(fresh.interior?.matchExteriorFabric && fresh.interior.matchExteriorColour, 'Interior defaults must match exterior');
  check(!resolvePartFabric(undefined, part('base')) && !id({ assignments: {}, unlinkedGroups: [] }, 'base'), 'Legacy unassigned garment auto-initialized');
  const legacy: FabricAssignments = { assignments: { base: 'denim-twill', sleeveLeft: 'mesh', hiddenPart: 'unknown-old-id' }, unlinkedGroups: ['sleeves'] };
  const legacyJson = JSON.stringify(legacy);
  const restored = initializeFabricDefaults('tshirt', JSON.parse(legacyJson));
  check(id(restored, 'base') === 'denim-twill' && id(restored, 'sleeveLeft') === 'mesh', 'Saved overrides lost on initialization');
  check(JSON.stringify(restored.assignments) === JSON.stringify(legacy.assignments) && restored.unlinkedGroups.includes('sleeves'), 'Legacy/dormant state lost');
  check(JSON.stringify(legacy) === legacyJson && JSON.stringify(initializeFabricDefaults('tshirt', restored)) === JSON.stringify(restored), 'Initialization mutated input or is not idempotent');
  const changed = setGarmentFabric(restored, 'french-terry');
  check(id(changed, 'base') === 'denim-twill' && id(changed, 'sleeveLeft') === 'mesh' && id(changed, 'sleeveRight') === 'french-terry', 'Whole garment overwrote overrides');
  check(id(changed, 'neck') === 'denim-twill' && id(changed, 'waistband') === 'rib-1x1', 'Neck did not inherit body or waistband default changed');
  const neckCategory = setCategoryFabric(changed, 'neck', 'rib-1x1');
  check(id(neckCategory, 'neck') === 'rib-1x1', 'Explicit neck category must override body fallback');
  check(id(assignFabric(neckCategory, parts, 'neck', 'rib-2x2', 'part'), 'neck') === 'rib-2x2', 'Neck part override must win over category');
  check(id(initializeFabricDefaults('tshirt', neckCategory), 'neck') === 'rib-1x1', 'Saved neck category assignment lost');
  check(id(setCategoryFabric(neckCategory, 'neck', undefined), 'neck') === 'denim-twill', 'Cleared neck category did not resume body inheritance');
  check(id(setCategoryFabric(fresh, 'body', 'interlock-jersey'), 'neck') === 'interlock-jersey', 'Neck did not inherit body category material');
  const cyclic: FabricPart = { id: 'cyclic', label: 'Cycle', role: 'neck', fallbackFromId: 'cyclic' };
  check(resolvePartFabric(fresh, cyclic, [cyclic])?.id === 'single-jersey', 'Fallback cycle did not terminate');
  const sleeveCategory = setCategoryFabric(fresh, 'sleeves', 'mesh');
  check(id(sleeveCategory, 'sleeveLeft') === 'mesh' && id(sleeveCategory, 'base') === 'single-jersey', 'Category assignment leaked');
  check(id(setCategoryFabric(sleeveCategory, 'sleeves', undefined), 'sleeveLeft') === 'single-jersey', 'Cleared category did not inherit');
  const panelCategory = setCategoryFabric(fresh, 'panels', 'nylon-taslan');
  check(id(panelCategory, 'panel') === 'nylon-taslan', 'Parent fallback bypassed panel category');
  const explicitPanel = assignFabric(panelCategory, parts, 'panel', 'mesh', 'part');
  check(id(setGarmentFabric(explicitPanel, 'cotton-twill'), 'panel') === 'mesh', 'Explicit panel override overwritten');
  const left = assignFabric(fresh, parts, 'sleeveLeft', 'mesh', 'part');
  check(left.unlinkedGroups.includes('sleeves') && id(left, 'sleeveRight') === 'single-jersey', 'Single-part scope changed partner');
  const linked = setFabricGroupLinked(left, parts, 'sleeves', true);
  check(id(linked, 'sleeveRight') === 'mesh' && !linked.unlinkedGroups.includes('sleeves'), 'Relink failed');
  const resetParts: FabricPart[] = [...parts, { id: 'nestedPanel', role: 'panel', label: 'Nested panel', parentId: 'sleevePanel' }, { id: 'sleevePanel', role: 'panel', label: 'Sleeve panel', parentId: 'sleeveLeft' }];
  const resetSource: FabricAssignments = { ...linked, assignments: { ...linked.assignments, sleevePanel: 'waffle', nestedPanel: 'mesh', neck: 'rib-2x2', dormant: 'unknown-old-id' } };
  const resetSourceJson = JSON.stringify(resetSource);
  const resetGroup = resetPartFabric(resetSource, resetParts, 'sleeveLeft');
  check(['sleeveLeft', 'sleeveRight', 'sleevePanel', 'nestedPanel'].every(name => resetGroup.assignments[name] === undefined), 'Linked reset missed group or nested panel overrides');
  check(resetGroup.assignments.neck === 'rib-2x2' && resetGroup.assignments.dormant === 'unknown-old-id' && JSON.stringify(resetGroup.interior) === JSON.stringify(resetSource.interior) && JSON.stringify(resetGroup.categoryDefaults) === JSON.stringify(resetSource.categoryDefaults) && resetGroup.garmentDefault === resetSource.garmentDefault, 'Part reset changed unrelated material state');
  const resetUnlinked = resetPartFabric({ ...resetSource, unlinkedGroups: ['sleeves'] }, resetParts, 'sleeveLeft');
  check(resetUnlinked.assignments.sleeveRight === 'mesh' && resetUnlinked.assignments.nestedPanel === undefined && resetUnlinked.unlinkedGroups.includes('sleeves'), 'Unlinked reset changed partner or links');
  check(resetPartFabric(resetUnlinked, resetParts, 'group:sleeves').assignments.sleeveRight === undefined, 'Explicit group reset failed while unlinked');
  check(JSON.stringify(resetSource) === resetSourceJson && JSON.stringify(resetPartFabric(resetSource, resetParts, 'missing')) === resetSourceJson, 'Part reset mutated source or invalid target');
  for (const state of [linked, applyFabricPreset(fresh, parts, 'all-single-jersey'), assignFabric(fresh, parts, 'base', 'mesh')]) {
    check(state.garmentDefault === fresh.garmentDefault && JSON.stringify(state.interior) === JSON.stringify(fresh.interior) && JSON.stringify(state.categoryDefaults) === JSON.stringify(fresh.categoryDefaults), 'Existing mutator discarded new fields');
  }
  check(JSON.stringify(setGarmentFabric(fresh, 'unknown')) === JSON.stringify(fresh) && JSON.stringify(setCategoryFabric(fresh, 'neck', 'unknown')) === JSON.stringify(fresh), 'Invalid material changed state');
  const exterior = assignFabric(fresh, parts, 'base', 'french-terry', 'part');
  check(id(exterior, 'inside') === 'french-terry' && resolvePartMaterial(exterior, part('inside'), parts).interior, 'Interior did not use exterior reverse');
  const independent: FabricAssignments = { ...exterior, interior: { matchExteriorFabric: false, matchExteriorColour: false, fabricId: 'single-jersey', colour: '#ff0000' } };
  check(id(independent, 'inside') === 'single-jersey', 'Independent interior fabric ignored');
  check(id(assignFabric(independent, parts, 'inside', 'brushed-fleece', 'part'), 'inside') === 'brushed-fleece', 'Interior surface override ignored');
  check(!id(exterior, 'lining'), 'Separate lining silently inherited shell fabric');
  const nestedLining: FabricPart[] = [part('base'), { ...part('lining'), parentId: 'base' }, { id: 'liningPanel', label: 'Lining panel', role: 'lining', parentId: 'lining' }];
  check(!resolvePartFabric(exterior, nestedLining[2], nestedLining), 'Nested lining inherited through an exterior ancestor');
  const linedParent = assignFabric(exterior, nestedLining, 'lining', 'mesh', 'part');
  check(resolvePartFabric(linedParent, nestedLining[2], nestedLining)?.id === 'mesh', 'Nested lining lost its independent parent fabric');
  const lining = setCategoryFabric(exterior, 'lining', 'mesh');
  const lined = resolvePartMaterial(setGarmentFabric(lining, 'nylon-taslan'), part('lining'), parts);
  check(lined.fabric?.id === 'mesh' && lined.surface === 'lining' && !lined.interior, 'Lining became shell reverse');
  check(!fabricAssignmentIssues([part('lining')], lining).length, 'Lining face incorrectly requires a reverse map');
  check(resolveInteriorColour(fresh.interior, '#111111') === '#111111', 'Matching interior colour lightened');
  check(resolveInteriorColour(independent.interior, '#111111') === '#ff0000', 'Independent interior colour ignored');
  check(resolveInteriorColour(fresh.interior, '#111111', '#008800') === '#008800', 'Explicit interior colour override ignored');
  check(resolveInteriorColour({ ...fresh.interior!, colour: '#ff0000' }, '#111111', undefined, 'lining') === '#ff0000', 'Lining colour incorrectly matched shell');
  check(resolveInteriorColour(undefined, '#111111') === '#111111', 'Legacy colour fallback changed');
  const cycles: FabricPart[] = [{ id: 'a', role: 'body', label: 'A', parentId: 'b' }, { id: 'b', role: 'body', label: 'B', parentId: 'a' }];
  check(resolvePartFabric(fresh, cycles[0], cycles)?.id === 'single-jersey', 'Cycle-safe fallback failed');
  check(!resolvePartFabric(legacy, cycles[0], cycles), 'Cycle fabricated fabric');
  const unknown = { ...fresh, assignments: { base: 'unknown-old-id' } };
  check(!id(unknown, 'base') && fabricAssignmentIssues(parts, unknown).some(issue => issue.partId === 'rear' && issue.reason.includes('Unknown')), 'Unknown inherited ID silently replaced');
  const history = [fresh, left, linked, independent].map(state => JSON.stringify(state));
  check(id(JSON.parse(history[1]), 'sleeveRight') === 'single-jersey' && id(JSON.parse(history[2]), 'sleeveRight') === 'mesh', 'Undo/redo JSON snapshots lost linking state');
  check(id(JSON.parse(history[3]), 'inside') === 'single-jersey', 'Interior persistence failed');
  const reset = resetFabricDefaults('tshirt');
  check(JSON.stringify(reset) === JSON.stringify(fresh) && JSON.stringify(parts) === beforeParts, 'Reset changed geometry/part metadata or failed defaults');
  check(initializeFabricDefaults('hoodie').garmentDefault === 'french-terry', 'Hoodie main default incorrect');

  const layer = (id: string, role: string, label: string, extra = {}): ResolvedGarmentLayer => ({ id, assetId: id, category: role, displayName: label, kind: 'solid', zIndex: 0, svgRaw: '', fabricRegion: { role, ...extra } });
  const mapped = fabricPartsFromLayers([layer('hood', 'hood', 'Hood'), layer('inner', 'inner', 'Hood interior', { interior: true }), layer('lining', 'lining', 'Hood lining', { interior: true }), layer('band', 'neckband', 'Neckband')], 'hoodie');
  check(mapped.find(p => p.id === 'inner')?.surface === 'reverse' && mapped.find(p => p.id === 'inner')?.exteriorPartId === 'hood', 'Imported hood reverse mapping failed');
  check(mapped.find(p => p.id === 'lining')?.surface === 'lining' && fabricCategoryForPart(mapped.find(p => p.id === 'band')!) === 'neck', 'Imported lining/category mapping failed');
  const native = fabricPartsFromLayers(resolveGarmentLayers({ garmentType: 'tshirt', fit: 'regular', selection: getDefaultGarmentSelection('tshirt', 'regular') }), 'tshirt');
  check(resolvePartFabric(fresh, native.find(p => p.id === 'neck')!, native)?.id === 'single-jersey', 'Native neck body fallback missing');
  check(resolvePartFabric(changed, native.find(p => p.id === 'neck')!, native)?.id === 'denim-twill', 'Native neck did not inherit explicit body material');
  check(native.filter(p => p.id.startsWith('sleeveHem')).every(p => resolvePartFabric(fresh, p, native)?.id === 'single-jersey'), 'Plain tee sleeve hems became rib cuffs');
  check(native.filter(p => p.role === 'hem').every(p => resolvePartFabric(fresh, p, native)?.id === 'single-jersey'), 'Plain tee body hem became rib');
  const selfBand = fabricPartsFromLayers([{ ...layer('sleeveHemLeft', 'cuff', 'Plain sleeve hem'), fabricRegion: undefined, colourPanels: [{ id: 'hemPanel', svgRaw: '', tint: '#fff' }] }], 'tshirt');
  check(selfBand.every(p => resolvePartFabric(fresh, p, selfBand)?.id === 'single-jersey'), 'Self-fabric cuff panel lost sleeve category');
  const schematic = schematicFabricParts({ garmentType: 'hoodie', cuffType: 'ribbed', hemType: 'ribbed' });
  check(schematic.find(p => p.id === 'hoodInterior')?.exteriorPartId === 'hood', 'Schematic interior source missing');
  const banded = schematicFabricParts({ garmentType: 'tshirt', cuffType: 'banded' });
  check(banded.filter(p => p.role === 'cuff').every(p => fabricCategoryForPart(p) === 'sleeves'), 'Self-fabric sleeve bands became rib cuffs');

  for (const name of ['single-jersey', 'denim-twill']) {
    const fabric = FABRIC_LIBRARY.find(f => f.id === name)!;
    const face = fabricScanSurface(fabric), reverse = fabricScanSurface(fabric, true);
    check(reverse && face && reverse.image !== face.image, `Dedicated reverse missing: ${name}`);
    check(reverse.sourceType === 'procedural' && reverse.sourceStatus === 'review-required', `Authored reverse misrepresented: ${name}`);
  }
  check(fabricScanSurface(FABRIC_LIBRARY.find(f => f.id === 'denim-twill')!)?.sourceType === 'scan-cc0', 'Denim face provenance changed');
  const denim = FABRIC_SOURCES.find(record => record.fabricPresetId === 'denim-twill')!;
  let rejected = false;
  try { validateFabricSources(FABRIC_SOURCES.map(record => record === denim ? { ...record, reverse: { ...record.reverse!, procedural: undefined } } : record), FABRIC_LIBRARY.map(f => f.id)); } catch { rejected = true; }
  check(rejected, 'Hybrid reverse accepted without authorship');
  return { checks: 'defaults, category/part overrides, legacy persistence, linking, undo/redo/reset, interior/lining, routing, reverse provenance' };
}
