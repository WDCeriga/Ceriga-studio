import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundled = await build({ entryPoints: ['src/app/lib/drawingBrush.ts'], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'brush' });
const nodeBundle = await build({ entryPoints: ['src/app/lib/drawingBrush.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { DEFAULT_BRUSH_SETTINGS, createBrushStamps } = await import(`data:text/javascript;base64,${Buffer.from(nodeBundle.outputFiles[0].text).toString('base64')}`);
const point = x => ({ x, y: 100, p: 0.5, tilt: 0 });
const settings = { ...DEFAULT_BRUSH_SETTINGS, brushSize: 10, brushSpacing: 200 };
const sparse = [point(0), point(200)];
const dense = Array.from({ length: 41 }, (_, i) => point(i * 5));
const plan = (points, patch = {}, scale = 1, seed = 73) => createBrushStamps(points, { ...settings, ...patch }, scale, seed);
assert.deepEqual(plan(sparse), plan(dense), 'Stamp placement must not depend on event frequency');
assert.deepEqual(plan(sparse).samples.map(p => p.x), Array.from({ length: 11 }, (_, i) => i * 20));
assert.equal(plan([point(0)]).samples.length, 1);
assert.equal(plan([]).samples.length, 0);
for (const scale of [0, -1, NaN, Infinity]) assert.equal(plan(sparse, {}, scale).samples.length, 0);
assert(plan(sparse, { brushSpacing: 10 }).samples.length > plan(sparse, { brushSpacing: 100 }).samples.length);
assert(plan(sparse, { brushSpacing: 100 }).samples.length > plan(sparse).samples.length);
const scatter = { scatterEnabled: true, scatterCount: 4, scatterSpread: 150, scatterSize: 60 };
const marks = plan(sparse, scatter).samples;
assert.equal(marks.length, 44);
assert.deepEqual(plan(sparse, scatter), plan(dense, scatter));
assert.deepEqual(plan(sparse, scatter), plan(sparse, scatter), 'Repainting must not rerandomize marks');
assert.notDeepEqual(plan(sparse, scatter, 1, 0), plan(sparse, scatter, 1, 74));
assert(marks.some(p => p.y < 95) && marks.some(p => p.y > 105));
assert(marks.every(p => Math.hypot(p.x - p.distance, p.y - 100) <= 15.00001));
assert(marks.every(p => p.sizeScale >= 0.51 && p.sizeScale <= 0.69 && p.opacity >= 0.75 && p.opacity <= 1));
assert.deepEqual(plan([point(0), point(100)], scatter).samples, marks.slice(0, 24), 'Extending a stroke must preserve existing marks');
const double = plan(sparse.map(p => ({ ...p, x: p.x * 2, y: p.y * 2 })), scatter, 2).samples;
marks.forEach((p, i) => { assert(Math.abs(double[i].x / 2 - p.x) < 1e-8); assert(Math.abs(double[i].y / 2 - p.y) < 1e-8); });
assert(plan(sparse, { ...scatter, scatterSpread: 0 }).samples.every(p => p.y === 100));
assert(plan(sparse, { brushSpacing: NaN, scatterEnabled: true, scatterCount: Infinity }).samples.every(p => Number.isFinite(p.x)));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<canvas width="512" height="512"></canvas>');
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const points = [{ x: 80, y: 256, p: .5, tilt: 0 }, { x: 432, y: 256, p: .5, tilt: 0 }];
    const render = (preset, patch) => {
      ctx.clearRect(0, 0, 512, 512);
      brush.renderBrushStroke(ctx, points, { ...brush.DEFAULT_BRUSH_SETTINGS, ...preset.settings, brushPreset: preset.id, brushSize: 16, color: '#000000', grain: 0, pressure: false, pencil: { tiltShading: false }, ...patch }, 1, 83);
      const pixels = ctx.getImageData(0, 0, 512, 512).data;
      let ink = 0, offPath = 0;
      for (let i = 3; i < pixels.length; i += 4) { ink += pixels[i]; if (Math.abs(Math.floor(i / 4 / 512) - 256) > 20) offPath += pixels[i]; }
      return { ink, offPath };
    };
    return brush.BRUSH_PRESETS.map(preset => ({ id: preset.id,
      low: render(preset, { brushSpacing: 12 }), high: render(preset, { brushSpacing: 300 }),
      scatter: render(preset, { brushSpacing: 300, scatterEnabled: true, scatterSpread: 250, scatterCount: 6 }),
    }));
  });
  for (const result of results) {
    assert(result.low.ink > result.high.ink, `${result.id}: spacing must separate marks`);
    assert(result.high.ink > 0 && result.scatter.offPath > 0, `${result.id}: visible and scattered marks`);
  }
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189'}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible(); step++) await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: 'Brush', exact: true }).first().click();
  await page.getByLabel('Brush preset', { exact: true }).selectOption('pen');
  const setRange = (name, value) => page.getByRole('slider', { name, exact: true }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await setRange('Spacing', 250);
  await setRange('Brush size', 8);
  await setRange('Stabilisation Strength', 0);
  await setRange('Stroke smoothing', 0);
  await page.getByRole('switch', { name: 'Scatter', exact: true }).click();
  assert.equal(await page.getByRole('slider', { name: 'Scatter opacity', exact: true }).inputValue(), '100');
  for (const [name, value] of [['Scatter spread', 80], ['Scatter count', 3], ['Scatter size', 65], ['Opacity', 75]]) {
    await setRange(name, value);
    assert.equal(await page.getByRole('slider', { name, exact: true }).inputValue(), String(value));
  }
  const canvas = page.locator('[data-print-draw-layer]');
  const box = await canvas.boundingBox();
  const checksum = () => canvas.evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.reduce((sum, value, i) => sum + (i % 4 === 3 ? value : 0), 0));
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .43);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .55, box.y + box.height * .43, { steps: 15 });
  assert(await checksum() > 0, 'Marks must render before pointer release');
  const fullInk = await checksum();
  await setRange('Opacity', 5);
  await page.waitForFunction(fullInk => {
    const canvas = document.querySelector('[data-print-draw-layer]');
    const ink = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.reduce((sum, value, i) => sum + (i % 4 === 3 ? value : 0), 0);
    return ink > 0 && ink < fullInk / 5;
  }, fullInk);
  assert(await checksum() < fullInk / 5, 'The shared Opacity must update scatter while the pointer is stationary');
  await setRange('Opacity', 75);
  await page.mouse.move(box.x + box.width * .58, box.y + box.height * .43);
  await page.waitForTimeout(650);
  assert(await checksum() > 0, 'Holding a scattered stroke must not replace it with a solid quick shape');
  await page.mouse.up();
  await page.locator('[data-print-id]').first().waitFor();
  const drawingCount = await page.locator('[data-print-id]').count();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.locator('[data-print-id]').count(), drawingCount - 1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.locator('[data-print-id]').count(), drawingCount);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('slider', { name: 'Spacing', exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.getByRole('slider', { name: 'Spacing', exact: true }).inputValue(), '250');
  assert.equal(await page.getByRole('slider', { name: 'Scatter count', exact: true }).inputValue(), '3');
  assert.deepEqual(errors, []);
  console.log('Brush distribution passed: event-independent spacing, seeded scatter, density/size/opacity, all brush renderers, live drawing changes, hold protection, Undo/Redo and mobile controls.');
} finally { await browser.close(); }
