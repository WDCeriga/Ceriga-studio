import { strict as assert } from 'node:assert';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { importedGarmentLayers, mergeImportedGarmentView, normalizeImportedGarment, type ImportedGarment, type ImportedTracePreview } from '../../src/app/data/importedGarment';
import { importedColourPanels } from '../../src/app/data/importedGarmentColourPanels';
import { importedNeckBackingLayer } from '../../src/app/data/importedGarmentNeckBacking';
import { ImportedGarmentEditor } from '../../src/app/components/builder/ImportedGarmentEditor';

const preview: ImportedTracePreview = {
  sourceRaster: 'data:image/png;base64,source', cleanedRaster: 'data:image/png;base64,clean',
  keyedRaster: 'data:image/png;base64,key', overlayRaster: 'data:image/png;base64,overlay',
  tracedSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 785"><path d="M1 1L2 2Z"/></svg>',
  metrics: { subpaths: 120 },
};
const front: ImportedGarment = { ...createGarmentRegressionFixture('tee'), processingMode: 'trace-only', tracePreview: preview,
  inputDetection: { mode: 'trace-only', confidence: .99, reason: 'Clean raster ink' } };
const normalized = normalizeImportedGarment(front);
assert.equal(normalized.manifest.frontView?.processingMode, 'trace-only');
assert.deepEqual(normalized.manifest.frontView?.tracePreview, preview);
assert.deepEqual(normalizeImportedGarment(JSON.parse(JSON.stringify(normalized))).tracePreview, preview);
assert.equal(importedNeckBackingLayer(normalized, 'front'), null, 'Clean trace must never synthesize neck backing');
assert.deepEqual(importedColourPanels(normalized), [], 'Clean trace must not synthesize semantic colour partitions');
assert.ok(!importedGarmentLayers(normalized, 'front').some(layer => layer.id === 'innerBackNeck'));
assert.ok(importedGarmentLayers(normalized, 'front').every(layer => layer.washable === false), 'source ink must not become fabric or receive wash effects');
const back = createGarmentRegressionFixture('tee', true);
back.manifest.backView = { ...back.manifest.backView!, processingMode: 'trace-only', tracePreview: { ...preview, sourceRaster: 'back-source' } };
const merged = mergeImportedGarmentView(normalized, back, 'back');
assert.deepEqual(merged.manifest.frontView?.tracePreview, preview);
assert.equal(merged.manifest.backView?.tracePreview?.sourceRaster, 'back-source');
assert.deepEqual(normalizeImportedGarment(JSON.parse(JSON.stringify(merged))).manifest.backView?.tracePreview, merged.manifest.backView?.tracePreview);
const photoPreview: ImportedTracePreview = { ...preview, sourceRaster: 'original-photo', technicalRaster: 'redraw', comparisonSource: 'technical-redraw' };
const photo = normalizeImportedGarment({ ...createGarmentRegressionFixture('tee'), processingMode: 'photo', tracePreview: photoPreview });
photo.parts = photo.parts.map(part => ({ ...part, structuralRole: 'source-ink', colorable: false }));
assert.ok(importedGarmentLayers(photo, 'front').every(layer => layer.washable === false), 'Photo trace ink must not receive fabric/wash effects');
const mixed = normalizeImportedGarment(JSON.parse(JSON.stringify(mergeImportedGarmentView(merged, photo, 'front'))));
assert.deepEqual(mixed.manifest.frontView?.tracePreview, photoPreview);
assert.equal(mixed.manifest.backView?.processingMode, 'trace-only');
assert.equal(mixed.manifest.backView?.tracePreview?.sourceRaster, 'back-source');
const replacement = { ...createGarmentRegressionFixture('tee'), processingMode: 'photo' as const };
const replaced = mergeImportedGarmentView(merged, replacement, 'front');
assert.equal(replaced.processingMode, 'photo');
assert.equal(replaced.tracePreview, undefined, 'Replacing primary image retained an obsolete trace');
assert.equal(replaced.manifest.backView?.processingMode, 'trace-only');
assert.equal(replaced.manifest.backView?.tracePreview?.sourceRaster, 'back-source');
const markup = renderToStaticMarkup(createElement(ImportedGarmentEditor, {
  value: normalized, view: 'front', step: 1, colors: {}, selectedId: null,
  onSelect() {}, onChange() {}, onColor() {}, onResetColors() {}, onReplace() {},
}));
assert.match(markup, /Input type/);
assert.match(markup, /Photo \/ reference \(redraw\)/);
assert.match(markup, /Clean mockup \/ technical drawing \(trace only\)/);
assert.match(markup, /Review source/);
assert.match(markup, /Use traced mockup/);
assert.ok(!markup.includes('Generate estimated back'), 'Clean trace offers invented hidden geometry');
console.log('PASS trace-only input controls, faithful layer guards, preview persistence and per-view replacement');
