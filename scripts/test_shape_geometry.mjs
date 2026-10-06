import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { loader: 'ts', resolveDir: process.cwd(), contents: `
    export * from './src/app/lib/shapeGeometry';
    export { SHAPE_ASSETS, canFillShape, defaultStudioSize } from './src/app/components/builder/printsStudio/studioAssets';
  ` }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const { shapeToEditablePath, shapePathData, shapeControls, shapeParameterValue, shapeIsClosed, SHAPE_ASSETS, canFillShape, defaultStudioSize } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const element = (content, extra = {}) => ({ id: 'test-shape', type: 'shape', content, x: 0, y: 0, width: 200, height: 160, rotation: 0, color: '#e53935', borderWidth: 4, ...extra });
const path = (content, shapeParameters) => shapeToEditablePath(element(content, { shapeParameters }));
const data = (content, shapeParameters) => shapePathData(path(content, shapeParameters));
const open = ['line', 'zigzag', 'squiggly', 'arc', 'spiral', 'wave'];
assert.equal(SHAPE_ASSETS.length, 29);
assert.equal(new Set(SHAPE_ASSETS.map(asset => asset.id)).size, 29);
for (const asset of SHAPE_ASSETS) {
  const result = path(asset.id);
  assert(result.nodes.length > 1, `${asset.id} has geometry`);
  assert(!/NaN|Infinity|undefined/.test(shapePathData(result)), asset.id);
  assert.equal(shapeIsClosed(element(asset.id)), !open.includes(asset.id), asset.id);
  assert.equal(canFillShape(element(asset.id)), !open.includes(asset.id), asset.id);
  for (const item of shapeControls(asset.id)) {
    const params = { [item.key]: item.options ? item.options.find(option => option.value !== item.default).value : item.default === item.max ? item.min : item.max };
    assert.notEqual(data(asset.id, params), data(asset.id), `${asset.id}: ${item.key} modifies geometry`);
    assert(!/NaN|Infinity/.test(data(asset.id, { [item.key]: Number.NaN })));
    if (!item.options) {
      assert.equal(shapeParameterValue(element(asset.id, { shapeParameters: { [item.key]: Infinity } }), item), item.default);
      assert.equal(shapeParameterValue(element(asset.id, { shapeParameters: { [item.key]: -10000 } }), item), item.min);
    }
  }
}
assert.equal(data('triangle'), 'M 50 12 L 90 86 L 10 86 L 50 12 Z');
assert.equal(data('star'), 'M 50 8 L 61 38 L 94 38 L 67 58 L 78 90 L 50 70 L 22 90 L 33 58 L 6 38 L 39 38 L 50 8 Z');
assert.equal(data('arrow'), 'M 8 30 L 62 30 L 62 18 L 92 50 L 62 82 L 62 70 L 8 70 L 8 30 Z');
assert.deepEqual(path('zigzag').nodes.map(n => [n.x, n.y]), [[4, 86], [16, 14], [28, 86], [40, 14], [52, 86], [64, 14], [76, 86], [88, 14], [96, 86]]);
assert.equal(path('star', { points: 7 }).nodes.length, 14);
assert.equal(path('polygon', { sides: 9 }).nodes.length, 9);
assert.equal(path('polygon', { sides: 9, roundness: 40 }).nodes.length, 18);
assert.equal(path('burst', { rays: 19 }).nodes.length, 38);
assert(data('star', { roundness: 40 }).includes('C'));
assert(data('rect', { cornerTopLeft: 12 }).includes('C'));
assert.equal(path('ring').subpaths.length, 1);
assert.equal((data('ring').match(/M /g) ?? []).length, 2);
assert.equal((data('ring').match(/Z/g) ?? []).length, 2);
assert.equal(path('squiggly').nodes[1].out.x, 36.25);
assert.deepEqual(defaultStudioSize('shape', 'line'), { width: 120, height: 22 });
assert.deepEqual(defaultStudioSize('shape', 'zigzag'), { width: 120, height: 40 });
for (const content of ['ellipse', 'circle', 'rect', 'semicircle-open', 'semicircle-closed', 'line']) {
  const result = shapeToEditablePath(element(content, { shapeGeometry: 'bounds' }));
  assert.equal(canFillShape(element(content, { shapeGeometry: 'bounds' })), !['line', 'semicircle-open'].includes(content));
  assert(result.nodes.every(n => n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100));
}
const ring = path('ring');
const converted = shapeToEditablePath(element('custom-polygon', { shapePath: ring }));
assert.deepEqual(converted, ring);
converted.subpaths[0].nodes[0].x = 1;
assert.notEqual(converted.subpaths[0].nodes[0].x, ring.subpaths[0].nodes[0].x, 'Editable copies do not mutate saved geometry');
assert.equal(canFillShape(element('custom-polygon', { shapePath: { closed: false, nodes: [{ x: 0, y: 0 }, { x: 100, y: 100 }] } })), false);
assert.equal(canFillShape(element('custom-polygon', { shapePath: { closed: false, nodes: [], subpaths: [ring] } })), true);
assert.equal(canFillShape({ type: 'text', content: 'star' }), false);
assert.equal(shapePathData({ closed: true, nodes: [{ x: 0, y: 0, in: { x: 0, y: 2 } }, { x: 5, y: 5, out: { x: 3, y: 4 } }] }), 'M 0 0 L 5 5 C 3 4 0 2 0 0 Z');

const browserBundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { StudioGraphic } from './src/app/components/builder/printsStudio/StudioGraphic';
    import { ShapePropertiesPanel } from './src/app/components/builder/printsStudio/ShapePropertiesPanel';
    import { shapeToEditablePath } from './src/app/lib/shapeGeometry';
    const root = createRoot(document.getElementById('root'));
    window.renderShape = (element, convert = false, controls = false) => {
      if (convert) element = {...element, shapePath: shapeToEditablePath(element)};
      window.patch = null;
      flushSync(() => root.render(controls ? <ShapePropertiesPanel element={element} onChange={patch => window.patch = patch} /> : <StudioGraphic element={element} />));
    };
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root" style="width:200px;height:160px"></div>');
  await page.addScriptTag({ content: browserBundle.outputFiles[0].text });
  async function pixels(el, convert = false) {
    await page.evaluate(({ el, convert }) => window.renderShape(el, convert), { el, convert });
    return page.locator('#root svg').evaluate(async svg => {
      const copy = svg.cloneNode(true);
      copy.setAttribute('width', '200'); copy.setAttribute('height', '160');
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 160;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, 200, 160).data);
    });
  }
  for (const geometry of [undefined, 'bounds']) {
    const contents = geometry ? ['ellipse', 'circle', 'rect', 'semicircle-open', 'semicircle-closed', 'line'] : ['ellipse', 'rect', 'line', 'zigzag', 'squiggly', 'triangle', 'star', 'arrow'];
    for (const content of contents) for (const filled of [false, true]) {
      const el = element(content, { shapeGeometry: geometry, shapeFilled: filled });
      const before = await pixels(el), after = await pixels(el, true);
      let difference = 0;
      for (let i = 3; i < before.length; i += 4) difference += Math.abs(before[i] - after[i]);
      // Native ellipse and cubic paths use different edge antialiasing (under 0.4% of this raster).
      const tolerance = ['ellipse', 'circle'].includes(content) ? 128 : 45;
      assert(difference / 255 < tolerance, `${content} ${geometry ?? 'catalog'} filled=${filled}: conversion changes ${difference / 255} pixel-equivalents`);
    }
  }
  for (const asset of SHAPE_ASSETS) {
    const raster = await pixels(element(asset.id, { shapeFilled: true }));
    assert(raster.some((channel, i) => i % 4 === 3 && channel > 0), `${asset.id} renders visible artwork`);
  }
  const ringPixels = await pixels(element('ring', { shapeFilled: true, shapeFillColor: '#00ff00', shapeStrokeColor: '#0000ff' }));
  const rgba = (x, y) => ringPixels.slice((y * 200 + x) * 4, (y * 200 + x) * 4 + 4);
  assert.equal(rgba(100, 80)[3], 0, 'Compound ring preserves its hole');
  assert.deepEqual(rgba(170, 80), [0, 255, 0, 255], 'Fill paint is independent');
  assert.deepEqual(rgba(188, 80), [0, 0, 255, 255], 'Outline paint is independent');
  const noOutline = await pixels(element('ring', { shapeFilled: true, borderWidth: 0, shapeFillColor: '#00ff00', shapeStrokeColor: '#0000ff' }));
  assert(!noOutline.some((v, i) => i % 4 === 2 && v > 0 && noOutline[i + 1] > 0), 'Zero thickness removes the outline');
  await page.evaluate(el => window.renderShape(el, false, true), element('wave'));
  assert.equal(await page.getByRole('slider', { name: 'Shape Frequency', exact: true }).count(), 1);
  assert.equal(await page.getByRole('slider', { name: 'Shape thickness', exact: true }).count(), 1);
  assert.equal(await page.getByLabel('Shape Fill colour', { exact: true }).count(), 0);
  await page.getByRole('slider', { name: 'Shape thickness', exact: true }).fill('8');
  assert.deepEqual(await page.evaluate(() => window.patch), { borderWidth: 8 });
  await page.evaluate(el => window.renderShape(el, false, true), element('star'));
  await page.getByRole('slider', { name: 'Shape Points', exact: true }).fill('8');
  assert.deepEqual(await page.evaluate(() => window.patch), { shapeParameters: { points: 8 } });
  await page.evaluate(el => window.renderShape(el, false, true), element('rect', { shapeGeometry: 'bounds' }));
  assert.equal(await page.getByRole('slider', { name: 'Shape Top left corner', exact: true }).inputValue(), '0');
  await page.evaluate(el => window.renderShape(el, false, true), element('star', { locked: true }));
  assert(await page.getByRole('slider', { name: 'Shape Points', exact: true }).isDisabled());
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
console.log('Passed: 29 shapes, parameter controls, cubic conversion, legacy/bounds raster parity, compound ring holes, independent paints and contextual controls.');
