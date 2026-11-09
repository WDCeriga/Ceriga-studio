import assert from 'node:assert/strict';
import { DOMMatrix, DOMPoint, createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { surfaceRuntime } from './surface-test-runtime.mjs';

const { api } = await surfaceRuntime(`
  export { LabelArtwork, LegacyLabelArtwork } from './src/app/components/builder/LabelArtwork';
  export { labelPlacement } from './src/app/components/builder/GarmentLabelOverlay';
  export * from './src/app/data/garmentLabels';
  export * from './src/app/lib/surfaceMigration';
`);
const rows = { top: 1, bottom: 1, 'top-bottom': 2 };
for (const kind of ['neck', 'care', 'tag', 'hand']) {
  for (const placement of ['none', 'top', 'bottom', 'top-bottom', 'sides']) {
    const label = { ...api.createGarmentLabel(kind), stitchingPlacement: placement,
      borderEnabled: true, borderVersion: 2, borderStyle: 'solid' };
    const svg = renderToStaticMarkup(createElement(api.LegacyLabelArtwork, { label }));
    assert(svg.includes('data-surface-decoration="border"'));
    const stitching = svg.match(/data-label-stitching="[^"]+"[^>]*><path d="([^"]+)"/);
    assert.equal(Boolean(stitching), placement !== 'none');
    if (rows[placement]) assert.equal((stitching[1].match(/H/g) ?? []).length, rows[placement]);
    if (placement === 'bottom') assert(stitching[1].startsWith(`M1.2 ${label.heightMm - 1.2}H`));
    const saved = api.saveLabelSurface(label, api.readLabelSurface(label));
    assert.equal(JSON.parse(JSON.stringify(saved)).stitchingPlacement, placement);
  }
}

for (const shape of ['rectangle', 'rounded', 'square', 'oval', 'circle', 'horizontal', 'vertical']) {
  const printed = api.normalizeLabel({ ...api.createGarmentLabel('neck'), construction: 'printed',
    shape, stitchingPlacement: 'top-bottom', borderEnabled: true, borderVersion: 2 });
  const svg = renderToStaticMarkup(createElement('svg', null, createElement(api.LegacyLabelArtwork, { label: printed })));
  assert(!svg.includes('data-label-print-background='));
  assert(!svg.includes('data-label-stitching='));
  const saved = api.saveLabelSurface(printed, api.readLabelSurface(printed));
  assert.equal(saved.shape, shape);
  assert.equal(saved.stitchingPlacement, 'top-bottom');
  assert.equal(saved.construction, 'printed');
}
const sewn = { ...api.createGarmentLabel('neck'), borderEnabled: true, borderVersion: 2, stitchingPlacement: 'top-bottom' };
const sewnSurface = api.readLabelSurface(sewn);
const customized = api.saveLabelSurface(sewn, sewnSurface);
const direct = { ...customized, construction: 'printed', method: 'heat' };
const directSurface = api.readLabelSurface(direct);
assert.equal(directSurface.surface.background, 'transparent');
assert(!directSurface.document.elements.some(element => element.surfaceRole === 'border'));
assert(directSurface.document.elements.some(element => element.type === 'text'));
const directSvg = renderToStaticMarkup(createElement('svg', null, createElement(api.LabelArtwork, { label: direct })));
assert(!directSvg.includes('data-label-fabric'));
assert(!directSvg.includes('data-label-stitching'));
const restored = api.readLabelSurface({ ...customized, construction: 'physical' });
assert(restored.document.elements.some(element => element.surfaceRole === 'border'));
console.log('PASS: direct prints omit fabric and stitches, including saved sewn artwork');
globalThis.DOMMatrix = DOMMatrix;
globalThis.DOMPoint = DOMPoint;
const svgRaw = await readFile('src/assets/studio-tshirt/Inner back neck/Inner back neck crew.svg', 'utf8');
const canvas = createCanvas(512, 512), ctx = canvas.getContext('2d');
ctx.drawImage(await loadImage(Buffer.from(svgRaw)), 0, 0, 512, 512);
const masks = { innerBackNeck: { size: 512, pixels: ctx.getImageData(0, 0, 512, 512).data } };
const layers = ['base', 'innerBackNeck'].map(id => ({
  id, bbox: { minX: 500, maxX: 1500 }, matrix: 'matrix(1, 0, 0, 1, 0, 0)', svgRaw,
}));
const neck = api.createGarmentLabel('neck');
const attached = { ...neck, attachToCollarSeam: true };
const placement = api.labelPlacement(attached, layers, 500, masks);
assert(placement.collarClip);
assert.match(placement.collarClip, /L[^ ]+ [1-9]/, 'The clip follows a curved seam');
assert.equal(api.labelPlacement(neck, layers, 500, masks).collarClip, undefined);
assert.equal(api.labelPlacement({ ...attached, offsetYmm: 10 }, layers, 500, masks).collarClip, placement.collarClip);
assert.equal(api.labelSpecification(attached).attachment, 'Sewn into the back collar seam');
assert(!api.canAttachLabelToCollar({ ...attached, construction: 'printed' }));
assert(!api.canAttachLabelToCollar({ ...attached, manualPosition: { x: .5, y: .5 } }));
console.log('PASS: all stitch layouts save, and sewn neck labels follow the crew collar seam');
