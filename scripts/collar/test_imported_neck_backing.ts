import { strict as assert } from 'node:assert';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { canAcceptImportedConstruction, importedGarmentLayers, type ImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
import { importedNeckBackingLayer } from '../../src/app/data/importedGarmentNeckBacking';
import { createPanelledHoodieFixture } from '../../src/app/data/panelledHoodieRegressionFixture';

let checks = 0;
const check = (condition: unknown, message: string) => { checks++; assert.ok(condition, message); };
const contains = (svg: string, x: number, y: number) => {
  const rings = [...svg.matchAll(/M([^Z]+)Z/g)].map(match => match[1].split('L').map(pair => pair.split(',').map(Number)));
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y * 2048) !== (yj > y * 2048) && x * 2048 < (xj - xi) * (y * 2048 - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const fixture = () => {
  const garment = createGarmentRegressionFixture('tee', true);
  const template = garment.parts.find(part => part.semanticType === 'body')!;
  const part = (id: string, semanticType: ImportedPart['semanticType'], outline: ImportedPoint[], layerOrder: number, structuralRole = id): ImportedPart => ({
    ...template, id, name: id, semanticType, structuralRole, outline, layerOrder,
    svg: `<svg viewBox="0 0 2048 2048"><polygon points="${outline.map(([x, y]) => `${x * 2048},${y * 2048}`).join(' ')}"/></svg>`,
  });
  garment.parts = [
    part('body', 'body', [[.36,.09],[.23,.17],[.27,.92],[.73,.92],[.77,.17],[.64,.09],[.61,.16],[.55,.20],[.45,.20],[.39,.16]], 2, 'main torso'),
    part('front-neckband', 'neckband', [[.39,.075],[.405,.13],[.45,.175],[.48,.185],[.52,.185],[.55,.175],[.595,.13],[.61,.075],[.64,.09],[.61,.16],[.55,.20],[.45,.20],[.39,.16],[.36,.09]], 5, 'round neckline binding beneath placket'),
    part('rear-binding', 'neckband', [[.39,.075],[.5,.084],[.61,.075],[.605,.10],[.5,.106],[.395,.10]], 1, 'rear neckline finish'),
    part('front-placket', 'placket', [[.48,.182],[.52,.182],[.52,.42],[.5,.44],[.48,.42]], 9, 'partial front button-closure overlay'),
    part('button', 'button', [[.49,.22],[.51,.22],[.51,.24],[.49,.24]], 10),
    ...garment.parts.filter(part => part.view === 'back'),
  ];
  garment.manifest = { ...garment.manifest, garmentType: 'long-sleeve-top' };
  return garment;
};

const henley = fixture(), before = JSON.stringify(henley);
const layer = importedNeckBackingLayer(henley, 'front')!;
check(!!layer, 'Henley opening has no backing');
check(contains(layer.svgRaw, .5, .14), 'Exposed inner back neck remains empty');
check(!contains(layer.svgRaw, .5, .08), 'Exterior above rear binding was filled');
check(!contains(layer.svgRaw, .5, .10), 'Rear binding was filled');
check(!contains(layer.svgRaw, .5, .183), 'Placket top was filled');
check(!contains(layer.svgRaw, .5, .23), 'Button or button hole was filled');
check(!contains(layer.svgRaw, .5, .6), 'Whole body was lightened');
check(!contains(layer.svgRaw, .445, .18), 'Front binding was covered');
check(!layer.washable && !layer.constructionSvg && !layer.stitchSvg && layer.zIndex < 1, 'Backing invents details or covers source parts');
check(importedNeckBackingLayer(henley, 'back') === null, 'Rear view lightened');
check(importedGarmentLayers(henley, 'front').filter(l => l.id === 'innerBackNeck').length === 1, 'Backing is absent/duplicated in imported rendering');
const recoloured = importedGarmentLayers(henley, 'front', { body: '#204060', 'front-neckband': '#bb2211' });
check(recoloured.find(l => l.id === 'innerBackNeck')?.tint === '#204060', 'Backing does not follow the independently coloured body');
check(recoloured.find(l => l.id === 'front-neckband')?.tint === '#bb2211', 'Neckband lost its independent colour');
check(importedNeckBackingLayer({ ...henley, parts: henley.parts.map(p => p.id === 'body' ? { ...p, colorable: false } : p) }, 'front', { body: '#204060' })?.tint === henley.parts[0].color, 'Non-colourable body override leaked');
check(JSON.stringify(henley) === before, 'Source parts, manifest or persistence mutated');
assert.deepEqual(importedGarmentLayers(henley, 'back').filter(l => l.kind === 'solid').map(l => l.tint), henley.parts.filter(p => p.view === 'back').map(p => p.color));
checks++;

const plain = createGarmentRegressionFixture('tee');
check(contains(importedNeckBackingLayer(plain, 'front')!.svgRaw, .5, .195), 'Plain U-neck opening unsupported');
const shifted = structuredClone(henley);
for (const part of shifted.parts) part.outline = part.outline?.map(([x, y]) => [.13 + x * .7, .08 + y * .8]);
const shiftedLayer = importedNeckBackingLayer(shifted, 'front')!;
check(!!shiftedLayer && contains(shiftedLayer.svgRaw, .13 + .5 * .7, .08 + .14 * .8), 'Backing uses fixed screen coordinates');
check(!contains(shiftedLayer.svgRaw, .13 + .5 * .7, .08 + .08 * .8), 'Transformed rear exterior filled');
const reversed = structuredClone(henley);
for (const part of reversed.parts) part.outline?.reverse();
check(contains(importedNeckBackingLayer(reversed, 'front')!.svgRaw, .5, .14), 'Outline winding changes backing');
for (const type of ['shorts', 'trousers', 'jeans', 'skirt', 'hoodie'] as const) check(importedNeckBackingLayer(createGarmentRegressionFixture(type), 'front') === null, `${type} gained a guessed neckline`);
const changed = (id: string, patch: Partial<ImportedPart>): ImportedGarment => ({ ...henley, parts: henley.parts.map(p => p.id === id ? { ...p, ...patch } : p) });
for (const garment of [
  { ...henley, parts: henley.parts.filter(p => p.id !== 'body') },
  { ...henley, parts: henley.parts.filter(p => p.id !== 'front-neckband') },
  changed('front-neckband', { outline: undefined }),
  changed('front-neckband', { outline: [[.4,.1],[.6,.1],[.6,.2],[.4,.2]] }),
  changed('front-neckband', { outline: [[.4,.1],[.6,.2],[.4,.2],[.6,.1]] }),
  changed('front-neckband', { outline: [[.4,.1],[NaN,.2],[.6,.1]] }),
  changed('front-neckband', { transform: { x: 0, y: 0, scale: 1, rotation: 10 } }),
  changed('front-placket', { outline: undefined }),
  changed('rear-binding', { outline: undefined }),
  { ...henley, parts: [...henley.parts, { ...henley.parts[0], id: 'inner-neck', structuralRole: 'neck interior' }] },
]) check(importedNeckBackingLayer(garment, 'front') === null, 'Insufficient/ambiguous geometry fabricated a backing');
const hoodFixture = () => {
  const garment = createGarmentRegressionFixture('hoodie', true);
  const template = garment.parts.find(part => part.semanticType === 'hood' && part.view === 'front')!;
  const panel = (id: string, outline: ImportedPoint[]): ImportedPart => ({ ...template, id, name: id, structuralRole: 'hood panel', outline,
    svg: `<svg viewBox="0 0 2048 2048"><polygon points="${outline.map(([x, y]) => `${x * 2048},${y * 2048}`).join(' ')}"/></svg>` });
  const left: ImportedPoint[] = [[.3,.03],[.5,.03],[.5,.09],[.42,.09],[.42,.27],[.5,.27],[.5,.33],[.3,.33]];
  garment.parts = [...garment.parts.filter(part => part.view !== 'front' || !['hood', 'neckband'].includes(part.semanticType)),
    panel('left-hood', left), panel('right-hood', left.map(([x, y]) => [1 - x, y]))];
  return garment;
};
const hoodie = hoodFixture(), hoodBefore = JSON.stringify(hoodie);
const hoodLayer = importedNeckBackingLayer(hoodie, 'front')!;
check(!!hoodLayer && contains(hoodLayer.svgRaw, .5, .15), 'Multi-panel hood aperture remains empty');
check(hoodLayer.svgRaw.includes('data-derived-hood-backing'), 'Hood derivation marker missing');
for (const [x, y] of [[.5,.02],[.25,.15],[.75,.15],[.5,.4],[.35,.15],[.5,.06],[.5,.3],[.5,.6]]) {
  check(!contains(hoodLayer.svgRaw, x, y), 'Hood exterior, observed hood fabric or body was filled');
}
check(importedNeckBackingLayer(hoodie, 'back') === null, 'Hood backing appeared in rear view');
check(!hoodLayer.washable && !hoodLayer.constructionSvg && !hoodLayer.stitchSvg && hoodLayer.zIndex < Math.min(...hoodie.parts.filter(p => p.view === 'front').map(p => p.layerOrder)), 'Hood backing obscures/invents source details');
check(JSON.stringify(hoodie) === hoodBefore, 'Hood union mutated source outlines or manifests');
const bodyId = hoodie.parts.find(p => p.semanticType === 'body' && p.view === 'front')!.id;
const hoodColours = importedGarmentLayers(hoodie, 'front', { [bodyId]: '#204060', 'left-hood': '#bb2211', 'right-hood': '#1122bb' });
check(hoodColours.find(l => l.id === 'innerBackNeck')?.tint === '#204060', 'Hood backing lost body colour binding');
check(hoodColours.find(l => l.id === 'left-hood')?.tint === '#bb2211' && hoodColours.find(l => l.id === 'right-hood')?.tint === '#1122bb', 'Hood panel colours changed');
const hoodPart = hoodie.parts.find(p => p.id === 'left-hood')!;
const obstacle = (id: string, semanticType: ImportedPart['semanticType'], outline: ImportedPoint[]): ImportedPart => ({ ...hoodPart, id, name: id, semanticType, structuralRole: id, outline });
const lining = obstacle('observed-lining', 'lining', [[.45,.12],[.50,.12],[.50,.19],[.45,.19]]);
const trim = obstacle('drawcord-hardware', 'button', [[.53,.12],[.55,.12],[.55,.18],[.53,.18]]);
const lined = { ...hoodie, parts: [...hoodie.parts, lining, trim] };
const linedLayer = importedNeckBackingLayer(lined, 'front')!;
check(!!linedLayer && contains(linedLayer.svgRaw, .52, .15), 'Partial lining hides valid remaining aperture');
check(!contains(linedLayer.svgRaw, .48, .15), 'Observed lining replaced');
check(!contains(linedLayer.svgRaw, .54, .15), 'Drawcord hardware or holes filled');
const fullyLined = { ...hoodie, parts: [...hoodie.parts, { ...lining, outline: [[.42,.09],[.58,.09],[.58,.27],[.42,.27]] as ImportedPoint[] }] };
check(importedNeckBackingLayer(fullyLined, 'front') === null, 'Fully observed lining gained redundant backing');
const threePanels = { ...hoodie, parts: [...hoodie.parts.filter(p => p.id !== 'right-hood'),
  obstacle('right-hood-top', 'hood', [[.5,.03],[.7,.03],[.7,.18],[.58,.18],[.58,.09],[.5,.09]]),
  obstacle('right-hood-bottom', 'hood', [[.58,.18],[.7,.18],[.7,.33],[.5,.33],[.5,.27],[.58,.27]]),
] };
check(contains(importedNeckBackingLayer(threePanels, 'front')!.svgRaw, .5, .15), 'Three-panel hood unsupported');
const movedHood = structuredClone(hoodie);
for (const part of movedHood.parts) part.outline = part.outline?.map(([x, y]) => [.13 + x * .7, .08 + y * .8]).reverse() as ImportedPoint[];
check(contains(importedNeckBackingLayer(movedHood, 'front')!.svgRaw, .13 + .5 * .7, .08 + .15 * .8), 'Hood backing assumes fixed location, scale or winding');
const changeHood = (patch: Partial<ImportedPart>): ImportedGarment => ({ ...hoodie, parts: hoodie.parts.map(p => p.id === 'right-hood' ? { ...p, ...patch } : p) });
for (const garment of [
  { ...hoodie, parts: hoodie.parts.filter(p => p.id !== 'right-hood') },
  changeHood({ outline: hoodie.parts.find(p => p.id === 'right-hood')!.outline!.map(([x,y]) => [x + .0001,y]) }),
  changeHood({ outline: undefined }),
  changeHood({ outline: [[.5,.03],[.7,.33],[.5,.33],[.7,.03]] }),
  changeHood({ transform: { x: 0, y: 0, scale: 1, rotation: 1 } }),
  { ...hoodie, parts: [...hoodie.parts, { ...lining, outline: undefined }] },
  { ...hoodie, parts: [...hoodie.parts, obstacle('ambiguous-hood-bridge', 'hood', [[.4,.16],[.6,.16],[.6,.18],[.4,.18]])] },
]) check(importedNeckBackingLayer(garment, 'front') === null, 'Open/invalid/ambiguous hood geometry fabricated a closed aperture');
const observedHood = createPanelledHoodieFixture();
check(canAcceptImportedConstruction(observedHood), 'Captured regression fixture cannot enter offline editor/back workflows');
check(observedHood.parts.every(p => p.boundary?.evidence.includes('Regression fixture scaffolding') && p.boundary.evidence.includes('not captured analysis confidence')) && observedHood.fixtureProvenance?.synthetic, 'Fixture acceptance metadata masquerades as captured confidence');
const lowConfidenceFixture = createPanelledHoodieFixture([{ ...observedHood.parts[0], boundary: { boundaryType: 'panel-edge', confidence: .2, evidence: 'Explicit low-confidence input' } }]);
check(lowConfidenceFixture.parts[0].boundary?.confidence === .2 && !canAcceptImportedConstruction(lowConfidenceFixture), 'Fixture silently upgrades supplied confidence');
check(observedHood.parts.length === 19 && observedHood.manifest.frontView?.partIds.length === 19 && !observedHood.manifest.backView, 'Shared captured fixture is not normalized or loses captured geometry');
check(observedHood.parts.filter(p => p.semanticType === 'sleeve').length === 4 && observedHood.parts.filter(p => p.semanticType === 'hem').length === 2 && observedHood.parts.filter(p => p.semanticType === 'pocket').length === 2 && observedHood.parts.filter(p => p.semanticType === 'zip').length === 3 && observedHood.parts.some(p => p.id === 'right-bottom-corner'), 'Full captured fixture omitted sleeves, sleeve finishes, pockets, closure hardware or corner insert');
const capturedZipper = observedHood.parts.find(p => p.id === 'front-zipper')!;
check(capturedZipper.layerKind === 'detail' && capturedZipper.attachmentTo === 'left-lower-front' && capturedZipper.structuralRole === 'full-length front closure hardware', 'Captured closure metadata was changed');
check(observedHood.parts.find(p => p.id === 'hood-crown')?.attachmentTo === 'hood-interior' && !observedHood.parts.some(p => p.id === 'hood-interior'), 'Missing source interior was invented as a current part');
check(observedHood.parts.find(p => p.id === 'left-lower-front')?.geometryBounds.join(',') === '0.299,0.467,0.496,0.903', 'Shared fixture inherited synthetic body geometry');
check(!observedHood.sourceImage && !observedHood.cleanDrawing && Object.values(observedHood.sourceImages ?? {}).every(image => !image), 'Shared fixture retains image references');
const fixtureCopy = createPanelledHoodieFixture(observedHood.parts);
assert.deepEqual(fixtureCopy.parts.map(p => p.outline), observedHood.parts.map(p => p.outline));
checks++;
fixtureCopy.parts.find(p => p.id === 'hood-crown')!.outline![0][0] = 0;
check(observedHood.parts.find(p => p.id === 'hood-crown')!.outline![0][0] === .439 && createPanelledHoodieFixture().parts.find(p => p.id === 'hood-crown')!.outline![0][0] === .439, 'Shared fixture mutates caller/default capture');
const observedBefore = JSON.stringify(observedHood);
const observedLayer = importedNeckBackingLayer(observedHood, 'front')!;
check(!!observedLayer && contains(observedLayer.svgRaw, .5, .18), 'Observed zipper-closed hood opening remains empty with a panelled torso');
check(contains(observedLayer.svgRaw, .5, .25), 'Observed lower aperture remains empty above zipper');
for (const [x, y] of [[.5,.01],[.37,.16],[.63,.16],[.5,.07],[.4,.24],[.5,.27],[.5,.33],[.4,.5],[.6,.7]]) {
  check(!contains(observedLayer.svgRaw, x, y), 'Observed hood backing fills exterior, crown, side, zipper or torso');
}
const observedColours = importedGarmentLayers(observedHood, 'front', { 'hood-crown': '#204060', 'left-hood-side': '#bb2211', 'left-lower-front': '#aa88bb' });
check(observedColours.find(l => l.id === 'innerBackNeck')?.tint === '#204060', 'Panelled torso backing fails to follow its hood crown');
check(observedColours.find(l => l.id === 'left-hood-side')?.tint === '#bb2211' && observedColours.find(l => l.id === 'left-lower-front')?.tint === '#aa88bb', 'Derived hood changes independent source colours');
check(JSON.stringify(observedHood) === observedBefore, 'Observed source geometry was changed or missing interior fabricated');
const observedLined = { ...observedHood, parts: [...observedHood.parts, lining, trim] };
const observedLinedLayer = importedNeckBackingLayer(observedLined, 'front')!;
check(contains(observedLinedLayer.svgRaw, .52, .15) && !contains(observedLinedLayer.svgRaw, .48, .15) && !contains(observedLinedLayer.svgRaw, .54, .15), 'Observed hood backing replaces existing lining or trim');
const movedObserved = structuredClone(observedHood);
for (const part of movedObserved.parts) part.outline = part.outline?.map(([x, y]) => [.13 + x * .7, .08 + y * .8]).reverse() as ImportedPoint[];
check(contains(importedNeckBackingLayer(movedObserved, 'front')!.svgRaw, .13 + .5 * .7, .08 + .18 * .8), 'Observed zipper closure assumes fixed location, scale or winding');
for (const garment of [
  { ...observedHood, parts: observedHood.parts.filter(p => p.id !== 'front-zipper') },
  { ...observedHood, parts: observedHood.parts.map(p => p.id === 'front-zipper' ? { ...p, outline: p.outline!.map(([x, y]) => [x + .01, y] as ImportedPoint) } : p) },
  { ...observedHood, parts: observedHood.parts.map(p => p.id === 'front-zipper' ? { ...p, outline: undefined } : p) },
  { ...observedHood, parts: observedHood.parts.map(p => p.id === 'front-zipper' ? { ...p, transform: { x: 0, y: 0, scale: 1, rotation: 1 } } : p) },
]) check(importedNeckBackingLayer(garment, 'front') === null, 'Missing, open or invalid source closure fabricated an enclosed hood');
check(importedNeckBackingLayer(observedHood, 'back') === null, 'Observed rear view was lightened');
console.log(`Imported neck/hood backing: ${checks} checks passed`);
