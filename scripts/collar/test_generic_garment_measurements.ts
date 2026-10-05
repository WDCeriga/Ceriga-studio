import { strict as assert } from 'node:assert';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportedSizeTable } from '../../src/app/components/builder/ImportedSizeTable';
import { createGarmentRegressionFixture, garmentRegressionFixture, garmentRegressionFixtures, type GarmentRegressionType } from '../../src/app/data/garmentRegressionFixtures';
import { hasImportedGarmentView, importedGarmentLayers, importedPartDimensions, mergeImportedGarmentView, normalizeImportedGarment, recolorImportedParts, type ImportedGarment, type ImportedMeasurementLandmark, type ImportedPoint } from '../../src/app/data/importedGarment';
import { deriveImportedMeasurementSchema, importedMeasurementCanvasPoints, importedMeasurementGuides } from '../../src/app/data/importedGarmentMeasurements';

let assertions = 0;
function check(value: unknown, message: string): asserts value { assertions++; assert.ok(value, message); }
const close = (a: number, b: number) => Math.abs(a - b) < 1e-7;
function onSegment(point: ImportedPoint, start: ImportedPoint, end: ImportedPoint) {
  return Math.abs(Math.hypot(point[0] - start[0], point[1] - start[1]) + Math.hypot(point[0] - end[0], point[1] - end[1]) - Math.hypot(end[0] - start[0], end[1] - start[1])) < 1e-8;
}
function onGeometry(garment: ImportedGarment, landmark: ImportedMeasurementLandmark) {
  if (landmark.source === 'detail-edge') {
    const edge = garment.detailLayers?.filter(detail => detail.partId === landmark.partId).flatMap(detail => detail.visibleEdges).find(edge => edge.id === landmark.edgeId);
    return edge?.points.slice(1).some((end, index) => onSegment(landmark.point, edge.points[index], end));
  }
  const outline = garment.parts.find(part => part.id === landmark.partId)?.outline;
  return outline?.some((start, index) => onSegment(landmark.point, start, outline[(index + 1) % outline.length]));
}

const expected: Record<'shorts' | 'tee' | 'hoodie', string[]> = {
  shorts: ['waist', 'hip', 'front-rise', 'outseam', 'inseam', 'leg-opening', 'waistband-height', 'pocket-opening'],
  tee: ['chest', 'body-length', 'shoulder-width', 'sleeve-length', 'cuff-opening', 'neck-opening', 'hem-width'],
  hoodie: ['chest', 'body-length', 'shoulder-width', 'sleeve-length', 'cuff-opening', 'neck-opening', 'hood-height', 'hem-width', 'pocket-opening'],
};
for (const fixture of garmentRegressionFixtures) {
  const garment = fixture.garment, type = garment.manifest.garmentType as keyof typeof expected;
  const before = JSON.stringify(garment), guides = importedMeasurementGuides(garment);
  assert.deepEqual(guides.map(guide => guide.id), expected[type]);
  check(garment.fixtureProvenance?.synthetic && fixture.synthetic, `${fixture.id}: provenance must disclose synthetic geometry`);
  check(guides.every(guide => guide.length > 0 && guide.status === 'uncalibrated' && guide.millimetres === null), `${fixture.id}: all supported measurements need geometry, never inferred millimetres`);
  for (const definition of deriveImportedMeasurementSchema(garment)) {
    check(definition.startLandmark && definition.endLandmark, `${fixture.id}:${definition.id} missing endpoints`);
    check(onGeometry(garment, definition.startLandmark), `${fixture.id}:${definition.id} start is not real geometry`);
    check(onGeometry(garment, definition.endLandmark), `${fixture.id}:${definition.id} end is not real geometry`);
    assert.deepEqual(definition.points[0], definition.startLandmark.point);
    assert.deepEqual(definition.points.at(-1), definition.endLandmark.point);
    check(definition.confidence > 0 && definition.confidence <= 1 && definition.unit === 'mm', 'Invalid schema metadata');
    check(definition.calibrationDependency.view === definition.view, 'Calibration dependency lost view scope');
    check(garment.parts.find(part => part.id === definition.startLandmark!.partId)?.view === definition.view, 'Endpoint came from another view');
  }
  const both = fixture.id.endsWith('both');
  check(hasImportedGarmentView(garment, 'front') && hasImportedGarmentView(garment, 'back') === both, 'View availability wrong');
  check(Boolean(garment.manifest.backView) === both, 'Back metadata fabricated');
  check(importedGarmentLayers(garment, 'back').length > 0 === both, 'Back rendered from front-only source');
  if (!both) {
    assert.deepEqual(importedMeasurementGuides(garment, 'back'), []);
    assert.deepEqual(garment.manifest.views, ['front']);
  } else {
    const back = importedMeasurementGuides(garment, 'back');
    check(back.every(guide => guide.view === 'back' && guide.length > 0), `${fixture.id}: back geometry missing`);
    check(back.every(guide => guide.id !== 'front-rise'), 'Back displayed front rise');
    if (type === 'shorts') check(back.some(guide => guide.id === 'back-rise'), 'Back rise missing');
    const width = type === 'shorts' ? 'waist' : 'chest';
    check(close(back.find(guide => guide.id === width)!.length, guides.find(guide => guide.id === width)!.length * .8), 'Back width copied rather than independently derived');
  }
  const dimension = type === 'shorts' ? 'waist' : 'chest';
  const calibrated = { ...garment, measurementCalibration: { measurementId: dimension, millimetres: 400 } };
  const measured = importedMeasurementGuides(calibrated);
  check(close(measured.find(guide => guide.id === dimension)!.millimetres!, 400), 'Supplied dimension changed');
  check(measured.find(guide => guide.id === dimension)!.status === 'supplied', 'Supplied status lost');
  check(measured.filter(guide => guide.id !== dimension).every(guide => guide.status === 'estimated' && guide.millimetres! > 0), 'Calibration did not scale supported same-view guides');
  check(importedMeasurementGuides(calibrated, 'back').every(guide => guide.millimetres === null), 'Front scale leaked to an independent back image');
  const canvas = importedMeasurementCanvasPoints(guides[0]);
  check(close(canvas[0][0], guides[0].points[0][0] * 2048), 'Canvas not mapped to existing 2048 square');
  check(close(importedMeasurementCanvasPoints(guides[0], 512)[0][0], guides[0].points[0][0] * 512), 'Explicit review canvas size ignored');
  check(garment.parts.every(part => part.svg.includes('viewBox="0 0 2048 2048"')), 'Fixture SVG differs from existing canvas coordinates');
  assert.deepEqual(normalizeImportedGarment(garment), garment);
  check(JSON.stringify(garment) === before, 'Derivation or normalization mutated input');
}

const both = createGarmentRegressionFixture('shorts', true);
const frontCalibrated: ImportedGarment = { ...both, measurementCalibration: { measurementId: 'waist', millimetres: 400, view: 'front' } };
const common: ImportedGarment = { ...frontCalibrated, commonCalibrationDimensions: [{ measurementId: 'waist', views: ['front', 'back'], evidence: 'Synthetic test asserts equal physical flat waist dimension despite different image scale.' }] };
const commonBack = importedMeasurementGuides(common, 'back');
check(commonBack.find(guide => guide.id === 'waist')?.status === 'calibrated', 'Common dimension should calibrate, not claim directly supplied back value');
check(close(commonBack.find(guide => guide.id === 'waist')!.millimetres!, 400), 'Common dimension reused front pixels instead of back geometry');
check(importedMeasurementGuides({ ...common, commonCalibrationDimensions: [{ ...common.commonCalibrationDimensions![0], evidence: ' ' }] }, 'back').every(guide => guide.millimetres === null), 'Empty evidence permitted cross-view calibration');
const backCalibrated: ImportedGarment = { ...both, measurementCalibration: { measurementId: 'waist', millimetres: 500, view: 'back' } };
check(importedMeasurementGuides(backCalibrated).every(guide => guide.millimetres === null), 'Back calibration leaked to front');
check(importedMeasurementGuides(backCalibrated, 'back').find(guide => guide.id === 'waist')?.millimetres === 500, 'Explicit back calibration ignored');
for (const value of [NaN, Infinity, 0, -10]) check(importedMeasurementGuides({ ...both, measurementCalibration: { measurementId: 'waist', millimetres: value } }).every(guide => guide.millimetres === null), 'Invalid calibration accepted');
check(importedMeasurementGuides({ ...both, measurementCalibration: { measurementId: 'missing', millimetres: 500 } }).every(guide => guide.millimetres === null), 'Unavailable calibration accepted');
const first = both.parts[0], backPart = both.parts.find(part => part.view === 'back')!;
const partCalibrated: ImportedGarment = { ...both, calibration: { partId: first.id, axis: 'width', millimetres: 400 } };
check(importedPartDimensions(partCalibrated, backPart) === null, 'Legacy per-part scale crossed views');
check(importedPartDimensions(partCalibrated, first)?.width === 400, 'Legacy per-part same-view scale broken');

for (const type of ['trousers', 'jeans', 'jacket', 'skirt', 'dress'] as GarmentRegressionType[]) {
  const garment = createGarmentRegressionFixture(type, true), guides = importedMeasurementGuides(garment);
  check(guides.length > 0 && guides.every(guide => guide.length > 0), `${type}: supported geometry did not generate rows`);
  if (['skirt', 'dress', 'jacket'].includes(type)) check(guides.every(guide => !['inseam', 'outseam', 'leg-opening'].includes(guide.id)), `${type}: shorts rows leaked`);
  for (const definition of deriveImportedMeasurementSchema(garment)) {
    check(definition.startLandmark && onGeometry(garment, definition.startLandmark), `${type}: invalid start`);
    check(definition.endLandmark && onGeometry(garment, definition.endLandmark), `${type}: invalid end`);
  }
}

const shorts = createGarmentRegressionFixture('shorts');
const withoutDetails = { ...shorts, detailLayers: [] };
check(importedMeasurementGuides(withoutDetails).find(guide => guide.id === 'pocket-opening')?.status === 'unavailable', 'Missing pocket edges fabricated');
check(importedMeasurementGuides(withoutDetails).find(guide => guide.id === 'leg-opening')?.length! > 0, 'Hem-outline fallback missing');
const missingGeometry = { ...shorts, parts: shorts.parts.map(part => ({ ...part, outline: undefined })) };
check(importedMeasurementGuides(missingGeometry).every(guide => guide.status === 'unavailable' && guide.points.length === 0), 'SVG bounds were substituted for missing outlines');
const invalidGeometry = { ...shorts, parts: shorts.parts.map(part => ({ ...part, outline: [[NaN, 0], [1, 0], [0, 1]] as ImportedPoint[] })) };
check(importedMeasurementGuides(invalidGeometry).every(guide => guide.status === 'unavailable'), 'Non-finite geometry accepted');
const renamed: ImportedGarment = { ...shorts, parts: shorts.parts.map((part, index) => ({ ...part, id: `arbitrary-${index}`, name: 'Unrelated name', colourGroup: `independent-${index}`, editableIndependently: true })),
  detailLayers: shorts.detailLayers?.map(detail => ({ ...detail, partId: `arbitrary-${shorts.parts.findIndex(part => part.id === detail.partId)}` })), sourceManifest: { ...shorts.sourceManifest, regions: [] } };
assert.deepEqual(importedMeasurementGuides(renamed), importedMeasurementGuides(shorts));
const roleOnly: ImportedGarment = { ...shorts, manifest: { ...shorts.manifest, garmentType: 'unclassified item' } };
assert.deepEqual(importedMeasurementGuides(roleOnly), importedMeasurementGuides(shorts));
const linked = recolorImportedParts(both, both.parts[0].id, '#123456', 'group');
check(linked[both.parts.find(part => part.view === 'back' && part.structuralRole === 'leg')!.id] === '#123456', 'Logical front/back role/material colours not linked');
check(both.manifest.symmetryGroups!.every(group => new Set(group.partIds.map(id => both.parts.find(part => part.id === id)!.view)).size === 1), 'Symmetry group copied geometry between views');
const sameFabricTee = garmentRegressionFixture('tshirt', true);
sameFabricTee.parts = sameFabricTee.parts.map(part => ({ ...part, colourGroup: 'main-body', editableIndependently: false }));
const sameFabricBody = sameFabricTee.parts.find(part => part.semanticType === 'body')!;
sameFabricTee.parts.push(...(['hem', 'cuff', 'pocket'] as const).map(semanticType => ({ ...sameFabricBody, id: `test-${semanticType}`, semanticType, structuralRole: semanticType, measurementRole: 'body' as const })));
const sameFabric = normalizeImportedGarment(sameFabricTee);
for (const role of ['body', 'sleeve', 'neckband', 'hem', 'cuff', 'pocket']) {
  const selected = sameFabric.parts.find(part => part.semanticType === role)!;
  const changed = recolorImportedParts(sameFabric, selected.id, '#123456', 'group');
  for (const part of sameFabric.parts) {
    check((changed[part.id] ?? part.color) === (part.semanticType === role ? '#123456' : part.color), `Shared fabric colour leaked from ${role} into ${part.semanticType}`);
  }
}
check(sameFabric.manifest.colourGroups!.every(group => new Set(group.partIds.map(id => sameFabric.parts.find(part => part.id === id)!.semanticType)).size === 1), 'Manifest merged independently colourable construction roles');
const independentSleeve = sameFabric.parts.find(part => part.semanticType === 'sleeve')!;
const independentGarment = { ...sameFabric, parts: sameFabric.parts.map(part => part.id === independentSleeve.id ? { ...part, editableIndependently: true } : part) };
const independentColours = recolorImportedParts(independentGarment, independentSleeve.id, '#ff1234', 'group');
check(independentGarment.parts.every(part => (independentColours[part.id] ?? part.color) === (part.id === independentSleeve.id ? '#ff1234' : part.color)), 'Explicit independent region recoloured its peers');
const materialColours = recolorImportedParts(sameFabric, sameFabricBody.id, '#abcdef', 'material');
check(sameFabric.parts.every(part => materialColours[part.id] === '#abcdef'), 'Explicit material-wide editing stopped working');
const declaredOnly = { ...shorts, manifest: { ...shorts.manifest, views: ['front', 'back'] as const } };
check(!hasImportedGarmentView(declaredOnly as unknown as ImportedGarment, 'back'), 'Manifest declaration fabricated view availability');
const shifted = { ...shorts, parts: shorts.parts.map(part => ({ ...part, outline: part.outline!.map(([x, y]) => [x * .7 + .1, y * .7 + .1] as ImportedPoint) })),
  detailLayers: shorts.detailLayers?.map(detail => ({ ...detail, visibleEdges: detail.visibleEdges.map(edge => ({ ...edge, points: edge.points.map(([x, y]) => [x * .7 + .1, y * .7 + .1] as ImportedPoint) })) })) };
check(importedMeasurementGuides(shifted).every((guide, index) => close(guide.length, importedMeasurementGuides(shorts)[index].length * .7)), 'Measurements use fixed screen coordinates or stale schema');

const tee = createGarmentRegressionFixture('tee');
const torso = tee.parts.find(part => part.structuralRole === 'body')!;
const splitTorso: ImportedGarment = { ...tee, parts: [
  ...tee.parts.filter(part => part.id !== torso.id),
  { ...torso, id: 'arbitrary-a', outline: [[.3, .2], [.5, .2], [.5, .8], [.3, .8]] },
  { ...torso, id: 'arbitrary-b', outline: [[.5, .2], [.7, .2], [.7, .8], [.5, .8]] },
], detailLayers: tee.detailLayers?.filter(detail => detail.partId !== torso.id) };
const splitGuides = importedMeasurementGuides(splitTorso);
check(close(splitGuides.find(guide => guide.id === 'chest')!.length, .4), 'Multi-panel torso measured only one half');
check(close(splitGuides.find(guide => guide.id === 'hem-width')!.length, .4), 'Multi-panel torso hem measured only one half');
check(close(splitGuides.find(guide => guide.id === 'body-length')!.length, .6), 'Multi-panel centre length failed at shared boundary');
const lowConfidence = { ...shorts, parts: shorts.parts.map(part => ({ ...part, boundary: { ...part.boundary!, confidence: .2 } })) };
check(importedMeasurementGuides(lowConfidence).filter(guide => guide.id !== 'pocket-opening' && guide.id !== 'leg-opening').every(guide => guide.confidence <= .2), 'Outline evidence confidence ignored');

const frontEdited: ImportedGarment = { ...shorts, accepted: true, reviewed: true, revision: 3, sourceImage: 'original-front-image',
  parts: shorts.parts.map((part, index) => index === 0 ? { ...part, color: '#abcdef', name: 'User-edited front', transform: { ...part.transform, x: 12 } } : part),
  stitches: { visible: false, color: '#334455', weight: 2 }, stitchOverrides: { [shorts.parts[0].id]: { color: '#123456' } },
  hiddenDetailGroups: ['pockets-zips:Pockets'], measurementCalibration: { measurementId: 'waist', millimetres: 400 },
  calibration: { partId: shorts.parts[0].id, axis: 'width', millimetres: 250 },
};
const backUpload = normalizeImportedGarment({ ...both, manifest: { ...both.manifest, view: 'back' }, sourceImage: 'incoming-back-image',
  parts: both.parts.filter(part => part.view === 'back'), detailLayers: both.detailLayers!.filter(detail => detail.view === 'back'),
  sourceManifest: { ...both.sourceManifest, view: 'back', regions: both.parts.filter(part => part.view === 'back') } });
const previousFront = JSON.stringify(frontEdited), previousIncoming = JSON.stringify(backUpload);
const merged = mergeImportedGarmentView(frontEdited, backUpload, 'back');
assert.deepEqual(merged.parts.filter(part => part.view === 'front'), frontEdited.parts);
assert.deepEqual(merged.detailLayers!.filter(detail => detail.view === 'front'), frontEdited.detailLayers);
assert.deepEqual(merged.stitches, frontEdited.stitches);
assert.deepEqual(merged.stitchOverrides, frontEdited.stitchOverrides);
assert.deepEqual(merged.hiddenDetailGroups, frontEdited.hiddenDetailGroups);
assert.deepEqual(merged.sourceManifest.regions.filter(region => frontEdited.sourceManifest.regions.some(front => front.id === region.id)), frontEdited.sourceManifest.regions);
check(merged.sourceImage === 'original-front-image', 'Later back upload replaced front source image');
check(merged.manifest.backView?.sourceImage === 'incoming-back-image', 'Back source image not preserved per-view');
check(merged.manifest.frontView?.sourceImage === 'original-front-image', 'Front evidence not retained per-view');
check(merged.measurementCalibration?.view === 'front' && merged.measurementCalibration.millimetres === 400, 'Existing unscoped front calibration not pinned before merge');
check(merged.calibration?.partId === frontEdited.calibration!.partId, 'Front part calibration lost');
check(importedMeasurementGuides(merged, 'back').every(guide => guide.millimetres === null), 'View merge calibrated independent back without evidence');
check(!merged.accepted && !merged.reviewed && merged.revision === 4, 'New back upload retained stale acceptance');
check(JSON.stringify(frontEdited) === previousFront && JSON.stringify(backUpload) === previousIncoming, 'View merge mutated input');
check(merged.parts.length === frontEdited.parts.length + backUpload.parts.length, 'Requested view did not append');
assert.throws(() => mergeImportedGarmentView(frontEdited, createGarmentRegressionFixture('hoodie', true), 'back'), /mismatched garment classification/);
assert.throws(() => mergeImportedGarmentView(frontEdited, shorts, 'back'), /does not contain reconstructed back geometry/);
assert.throws(() => mergeImportedGarmentView(frontEdited, { ...backUpload, parts: backUpload.parts.map((part, index) => index === 0 ? { ...part, id: frontEdited.parts[0].id } : part) }, 'back'), /colliding part or detail IDs/);
const replacement = mergeImportedGarmentView({ ...merged, measurementCalibration: { measurementId: 'waist', millimetres: 500, view: 'back' },
  commonCalibrationDimensions: [{ measurementId: 'waist', views: ['front', 'back'], evidence: 'Previous pair only' }] }, backUpload, 'back');
check(!replacement.measurementCalibration && !replacement.commonCalibrationDimensions?.length, 'Replacing measured geometry retained stale calibration evidence');
assert.deepEqual(replacement.parts.filter(part => part.view === 'front'), frontEdited.parts);
check(replacement.parts.length === merged.parts.length, 'Back replacement duplicated parts');
const mergedFromBoth = mergeImportedGarmentView(frontEdited, both, 'back');
assert.deepEqual(mergedFromBoth.parts.filter(part => part.view === 'front'), frontEdited.parts);
check(mergedFromBoth.parts.length === merged.parts.length, 'Combined incoming import overwrote retained view');
const tshirt = garmentRegressionFixture('tshirt', false);
check(tshirt.manifest.garmentType === 'tshirt' && tshirt.fixtureProvenance?.synthetic, 'Requested tshirt fixture contract not available');
check(hasImportedGarmentView(garmentRegressionFixture('hoodie', true), 'back'), 'Requested withBack fixture contract not available');
check(hasImportedGarmentView(mergeImportedGarmentView(tshirt, createGarmentRegressionFixture('tee', true), 'back'), 'back'), 'Equivalent tshirt classification aliases rejected');

const independentScales: ImportedGarment = { ...both, measurementCalibration: { measurementId: 'waist', millimetres: 999, view: 'front' },
  measurementCalibrations: { front: { measurementId: 'waist', millimetres: 420 }, back: { measurementId: 'waist', millimetres: 610, view: 'back' } } };
check(importedMeasurementGuides(independentScales, 'front').find(guide => guide.id === 'waist')?.millimetres === 420, 'Front scoped map did not override singleton');
check(importedMeasurementGuides(independentScales, 'back').find(guide => guide.id === 'waist')?.millimetres === 610, 'Independent back calibration lost');
check(importedMeasurementGuides(independentScales, 'back').find(guide => guide.id === 'waist')?.status === 'supplied', 'Direct back calibration should be supplied');
const frontLegacyBackMap: ImportedGarment = { ...independentScales, measurementCalibrations: { back: independentScales.measurementCalibrations!.back } };
check(importedMeasurementGuides(frontLegacyBackMap, 'front').find(guide => guide.id === 'waist')?.millimetres === 999, 'Matching-view legacy fallback lost');
check(importedMeasurementGuides(frontLegacyBackMap, 'back').find(guide => guide.id === 'waist')?.millimetres === 610, 'Legacy singleton overrode independent back map');
check(importedMeasurementGuides({ ...independentScales, measurementCalibrations: { front: { measurementId: 'waist', millimetres: NaN } } }, 'front').every(guide => guide.millimetres === null), 'Invalid map entry silently used legacy value');
check(importedMeasurementGuides({ ...independentScales, measurementCalibrations: { front: { measurementId: 'waist', millimetres: 700, view: 'back' } } }, 'front').every(guide => guide.millimetres === null), 'Mismatched calibration map view leaked scale');
const commonFromMap: ImportedGarment = { ...common, measurementCalibration: undefined, measurementCalibrations: { front: { measurementId: 'waist', millimetres: 450 } } };
check(importedMeasurementGuides(commonFromMap, 'back').find(guide => guide.id === 'waist')?.millimetres === 450, 'Explicit shared-dimension calibration from map failed');
check(importedMeasurementGuides(commonFromMap, 'back').find(guide => guide.id === 'waist')?.status === 'calibrated', 'Evidence-backed common dimension lost calibrated status');
const replaceMapBack = mergeImportedGarmentView(independentScales, backUpload, 'back');
check(replaceMapBack.measurementCalibrations?.front?.millimetres === 420 && !replaceMapBack.measurementCalibrations.back, 'View replacement lost front map or kept stale back map');
check(importedMeasurementGuides(replaceMapBack, 'back').every(guide => guide.millimetres === null), 'Replaced back inherited legacy front singleton');
const calibratedIncoming = mergeImportedGarmentView(independentScales, { ...backUpload, measurementCalibrations: { back: { measurementId: 'waist', millimetres: 720 } } }, 'back');
check(calibratedIncoming.measurementCalibrations?.front?.millimetres === 420 && calibratedIncoming.measurementCalibrations.back?.millimetres === 720, 'Incoming scoped back calibration did not replace only its own view');

for (const fixture of garmentRegressionFixtures) {
  for (const view of ['front', 'back'] as const) {
    const guides = importedMeasurementGuides(fixture.garment, view);
    const html = renderToStaticMarkup(createElement(ImportedSizeTable, { value: fixture.garment, view, guides, unit: 'cm', onChange: () => {} }));
    check((html.match(/data-size-measurement-row=/g) ?? []).length === guides.length, 'Size rows must come from the current garment/view schema');
    check((html.match(/type="number"/g) ?? []).length === guides.length * 6, 'Every detected measurement needs six size cells');
    check((html.match(/value=""/g) ?? []).length === guides.length * 6, 'Size values must not be fabricated from photo geometry');
    for (const guide of guides) check(html.includes(`data-size-measurement-row="${guide.id}"`), 'Size table omitted detected measurement');
  }
}
const sized: ImportedGarment = { ...tshirt, sizeMeasurements: { front: { chest: { M: 525 } }, back: { chest: { M: 540 } } } };
const savedSizes = normalizeImportedGarment(JSON.parse(JSON.stringify(sized)));
assert.deepEqual(savedSizes.sizeMeasurements, sized.sizeMeasurements);
const sizedMerged = mergeImportedGarmentView(savedSizes, garmentRegressionFixture('tshirt', true), 'back');
assert.deepEqual(sizedMerged.sizeMeasurements, sized.sizeMeasurements);
check(importedMeasurementGuides(sized).every(guide => guide.millimetres === null), 'Size specifications must not calibrate a photo');
for (const unit of ['cm', 'mm'] as const) {
  const html = renderToStaticMarkup(createElement(ImportedSizeTable, { value: sized, view: 'front', guides: importedMeasurementGuides(sized), unit, onChange: () => {} }));
  check(html.includes(`value="${unit === 'cm' ? '52.5' : '525'}"`), 'Stored size value not converted for display');
  check(!html.includes('value="540"') && !html.includes('value="54"'), 'Back size value leaked to front');
}

console.log(`PASS generic garment measurements: ${assertions} checks; garment/view-specific XS–XXL tables, serialization, independent size specifications, geometry provenance, calibration and view merges.`);
