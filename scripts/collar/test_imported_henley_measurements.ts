import { strict as assert } from 'node:assert';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { normalizeImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
import { deriveImportedMeasurementSchema, importedMeasurementGuides } from '../../src/app/data/importedGarmentMeasurements';

const fixture = createGarmentRegressionFixture('tee', true);
const body = fixture.parts.find(part => part.id === 'front:body')!;
const placketOutline: ImportedPoint[] = [[.48, .21], [.5, .208], [.52, .21], [.52, .43], [.5, .46], [.48, .43]];
const placket: ImportedPart = { ...body, id: 'front:placket', name: 'Button placket', semanticType: 'placket',
  structuralRole: 'partial front closure overlay on main body', measurementRole: 'placket length and width',
  attachmentTo: body.id, outline: placketOutline, bounds: [.48, .208, .52, .46], geometryBounds: [.48, .208, .52, .46] };
const henley = normalizeImportedGarment({ ...fixture, manifest: { ...fixture.manifest, garmentType: 'long-sleeve-top' },
  parts: [...fixture.parts.map(part => part.semanticType === 'body' ? { ...part,
    structuralRole: 'main front torso, continuous beneath placket and hem overlay', measurementRole: 'torso width and body length' }
    : part.semanticType === 'sleeve' ? { ...part, measurementRole: 'body attachment and sleeve width' } : part), placket] });
const source = JSON.stringify(henley);
const schema = deriveImportedMeasurementSchema(henley, 'front');
const get = (id: string) => schema.find(item => item.id === id)!;
for (const id of ['chest', 'body-length', 'shoulder-width', 'hem-width']) {
  assert.ok(get(id).startLandmark && get(id).endLandmark, `${id}: descriptive overlay text must not hide explicit body geometry`);
  assert.equal(get(id).startLandmark!.partId, body.id);
  assert.equal(get(id).endLandmark!.partId, body.id);
}
assert.deepEqual(get('chest').points, [[.32, .4], [.68, .4]], 'Chest should use the lower sleeve/body junctions, not a fixed body-height percentage');
assert.match(get('chest').method, /armhole/i);
for (const id of ['placket-length', 'placket-width']) {
  assert.equal(get(id).startLandmark?.partId, placket.id);
  assert.equal(get(id).endLandmark?.partId, placket.id);
  assert.equal(get(id).view, 'front');
}
const guides = importedMeasurementGuides(henley, 'front');
assert.ok(Math.abs(guides.find(g => g.id === 'placket-length')!.length - .252) < 1e-8, 'Include the pointed end in placket length');
assert.ok(Math.abs(guides.find(g => g.id === 'placket-width')!.length - .04) < 1e-8);
assert.ok(guides.every(g => g.millimetres === null), 'Geometry must not invent physical scale');
const backSchema = deriveImportedMeasurementSchema(henley, 'back');
assert.ok(!backSchema.some(g => g.id.startsWith('placket-')), 'Front closure measurements must not leak to back');
for (const id of ['chest', 'body-length', 'shoulder-width', 'hem-width'])
  assert.equal(backSchema.find(g => g.id === id)?.startLandmark?.partId, 'back:body', `Back ${id} must retain its own body geometry`);
const calibrated = importedMeasurementGuides({ ...henley, measurementCalibrations: { front: { view: 'front', measurementId: 'placket-width', millimetres: 40 } } }, 'front');
assert.equal(calibrated.find(g => g.id === 'placket-width')!.status, 'supplied');
assert.equal(calibrated.find(g => g.id === 'chest')!.status, 'estimated');
assert.ok(Math.abs(calibrated.find(g => g.id === 'placket-length')!.millimetres! - 252) < 1e-8);
assert.ok(!deriveImportedMeasurementSchema(fixture).some(g => g.id.startsWith('placket-')), 'Plain shirts must not get placket rows');
const detailPlacket = { ...henley, parts: henley.parts.map(p => p.id === placket.id ? { ...p, layerKind: 'detail' as const, structural: false } : p) };
assert.ok(deriveImportedMeasurementSchema(detailPlacket, 'front').find(g => g.id === 'placket-length')?.startLandmark, 'Visible placket overlays can be detail parts');
const renamedType = { ...henley, manifest: { ...henley.manifest, garmentType: 'jacket' } };
assert.ok(deriveImportedMeasurementSchema(renamedType, 'front').find(g => g.id === 'placket-length')?.startLandmark, 'Closure rows must depend on construction, not the Henley name');
const fallback = { ...henley, parts: henley.parts.filter(p => p.semanticType !== 'sleeve') };
assert.ok(deriveImportedMeasurementSchema(fallback, 'front').find(g => g.id === 'chest')?.startLandmark);
assert.match(deriveImportedMeasurementSchema(fallback, 'front').find(g => g.id === 'chest')!.method, /estimated/i);

// A traced lower edge contains many short segments; sampling density must not change its length.
const curved: ImportedPoint[] = [[.3, .2], [.7, .2], [.7, .8], [.65, .82], [.55, .84], [.45, .84], [.35, .82], [.3, .8]];
const dense: ImportedPoint[] = curved.flatMap((point, index) => {
  const next = curved[(index + 1) % curved.length];
  return [point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] as ImportedPoint];
});
const hemLength = (outline: ImportedPoint[]) => importedMeasurementGuides({ ...fixture, detailLayers: [],
  parts: [{ ...body, outline }] }, 'front').find(g => g.id === 'hem-width')!.length;
assert.ok(hemLength(curved) > .4, 'Measure the complete curved hem, not one tiny segment');
assert.ok(Math.abs(hemLength(curved) - hemLength(dense)) < 1e-8, 'Hem must be invariant under contour resampling');
const sampledSides: ImportedPoint[] = [curved[0], curved[1], [.7, .73], [.7, .77], ...curved.slice(2), [.3, .77], [.3, .73]];
assert.ok(Math.abs(hemLength(curved) - hemLength(sampledSides)) < 1e-8, 'Dense lower side-seam samples must not be counted as hem length');
const reversed = [...sampledSides].reverse();
assert.ok(Math.abs(hemLength(curved) - hemLength(reversed)) < 1e-8, 'Hem detection must support both contour directions');
const wrapped = [...sampledSides.slice(5), ...sampledSides.slice(0, 5)];
assert.ok(Math.abs(hemLength(curved) - hemLength(wrapped)) < 1e-8, 'A hem crossing the polygon closing vertex must stay continuous');
const cuff: ImportedPart = { ...body, id: 'front:cuff', semanticType: 'cuff', structuralRole: 'cuff',
  attachmentTo: 'front:left-sleeve', outline: curved.map(([x, y]) => [x / 5, .5 + y / 5]) };
const cuffGuide = importedMeasurementGuides({ ...fixture, detailLayers: [], parts: [...fixture.parts, cuff] }, 'front').find(g => g.id === 'cuff-opening')!;
assert.ok(cuffGuide.length > .08, 'Cuff opening must cover its full multi-segment lower edge');
assert.equal(JSON.stringify(henley), source, 'Measurements must not mutate the import');
console.log('PASS Henley measurements: explicit semantic roles, armhole chest, construction-driven placket rows, full sampled hems/cuffs, calibration and view isolation.');
