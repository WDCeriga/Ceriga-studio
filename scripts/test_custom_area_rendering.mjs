import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { CustomAreaGraphic } from './src/app/components/builder/printsStudio/CustomAreaGraphic';
    import { CustomAreaAppearanceControls } from './src/app/components/builder/printsStudio/CustomAreaAppearanceControls';
    import { artworkEffectPadding } from './src/app/lib/textEffectRendering';
    window.areaPadding = artworkEffectPadding;
    const root = createRoot(document.getElementById('root'));
    const controls = createRoot(document.getElementById('controls'));
    window.renderArea = (patch = {}) => {
      const element = { id: 'area', type: 'customArea', content: '', x: 0, y: 0, width: 200, height: 200,
        customAreaViewWidth: 100, customAreaViewHeight: 100, rotation: 0, color: '#ff0000', ...patch };
      const points = patch.customAreaPoints ?? [
        { x: 0, y: 40, out: { x: 30, y: 0 } }, { x: 100, y: 40, in: { x: 70, y: 0 } },
        { x: 100, y: 100 }, { x: 0, y: 100 }
      ];
      const source = JSON.stringify(points);
      flushSync(() => root.render(<CustomAreaGraphic element={element} points={points} editing selectedPoint={0} garmentMask={patch.garmentMask} />));
      flushSync(() => controls.render(<CustomAreaAppearanceControls element={element} onChange={patch => window.lastPatch = patch} />));
      return source === JSON.stringify(points);
    };
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<style>#root{width:200px;height:200px}#root svg{width:100%;height:100%}</style><div id="root"></div><div id="controls"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const render = patch => page.evaluate(patch => window.renderArea(patch), patch);
  const pixels = positions => page.locator('[data-custom-area-svg]').evaluate(async (svg, positions) => {
    const copy = svg.cloneNode(true);
    copy.setAttribute('width', '200'); copy.setAttribute('height', '200');
    const image = new Image();
    const markup = new XMLSerializer().serializeToString(copy);
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="-100 -100 400 400">${markup}</svg>`);
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return positions.map(([x, y]) => Array.from(context.getImageData(x * 2 + 100, y * 2 + 100, 1, 1).data));
  }, positions);
  assert.equal(await render({}), true, 'Renderer must not mutate source geometry');
  assert.equal(await page.locator('[data-custom-area-svg]').getAttribute('viewBox'), '0 0 100 100');
  assert.match(await page.locator('clipPath path').getAttribute('d'), /C/);
  assert.deepEqual(await pixels([[50, 20], [5, 5]]), [[255, 0, 0, 255], [0, 0, 0, 0]], 'Cubic fill follows curve, not its polygon chord');
  assert.equal(await page.locator('[data-editor-chrome], [data-custom-area-point]').count(), 0);
  const triangle = [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 0, y: 100 }];
  for (const flipHorizontal of [false, true]) {
    await render({ customAreaPoints: triangle, flipHorizontal });
    const result = await pixels([[10, 75], [90, 75]]);
    assert.equal(result[flipHorizontal ? 1 : 0][3], 255);
    assert.equal(result[flipHorizontal ? 0 : 1][3], 0, 'Flip must include the clipping path');
  }
  await render({ customAreaPoints: triangle, flipVertical: true });
  assert.equal((await pixels([[30, 10]]))[0][3], 255, 'Vertical flip must move the silhouette');
  const texture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
    const context = canvas.getContext('2d'); context.fillStyle = '#00ff00'; context.fillRect(0, 0, 8, 8);
    return canvas.toDataURL();
  });
  for (const source of ['customAreaImage', 'customAreaTexture']) {
    await render({ [source]: texture, customAreaFillTransform: { scale: 400, rotation: 45, x: 2, y: 3, opacity: 100 } });
    assert.deepEqual(await pixels([[50, 50], [5, 5]]), [[0, 255, 0, 255], [0, 0, 0, 0]], `${source} must never spill`);
    await render({ [source]: texture, customAreaFillTransform: { scale: 100, rotation: 0, x: 0, y: 0, opacity: 0 } });
    assert.deepEqual((await pixels([[50, 50]]))[0], source === 'customAreaImage' ? [0, 0, 0, 0] : [255, 0, 0, 255]);
  }
  for (const style of ['solid', 'dashed', 'dotted']) {
    await render({ customAreaOutline: { enabled: true, color: '#0000ff', width: 4, opacity: 50, style } });
    const outline = page.locator('[data-custom-area-outline]');
    assert.equal(await outline.getAttribute('stroke-width'), '8');
    assert.equal(await outline.getAttribute('stroke-opacity'), '0.5');
    assert.equal(await outline.getAttribute('stroke-dasharray'), style === 'solid' ? null : style === 'dashed' ? '12 8' : '0 12');
    assert.equal((await pixels([[5, 5]]))[0][3], 0);
  }
  const overflow = {
    type: 'customArea', width: 200, height: 200, customAreaViewWidth: 100, customAreaViewHeight: 100,
    customAreaPoints: [{ x: -30, y: 30, out: { x: -30, y: -20 } }, { x: 130, y: 30, in: { x: 130, y: -20 } }, { x: 130, y: 100 }, { x: -30, y: 100 }],
  };
  for (const customAreaPattern of ['stripes-h', 'camo']) {
    await render({ ...overflow, customAreaPattern });
    for (const x of [-20, 120]) {
      const samples = await pixels(Array.from({ length: 40 }, (_, index) => [x, 45 + index]));
      assert.ok(samples.some(pixel => pixel[3] > 200), `${customAreaPattern} must fill edited geometry outside its reference viewport`);
    }
    assert.equal((await pixels([[-40, 60]]))[0][3], 0, 'Extended pattern stays inside cubic clip');
  }
  assert.equal(await page.evaluate(area => window.areaPadding(area), overflow), 60);
  assert.equal(await page.evaluate(area => window.areaPadding({ type: 'group', width: 400, height: 400, groupSourceWidth: 200, groupSourceHeight: 200, children: [area] }), overflow), 120);
  await render({ customAreaTexture: texture, customAreaViewWidth: 100.49, customAreaViewHeight: 100.51 });
  assert.equal(await page.getByLabel('Fill horizontal position', { exact: true }).inputValue(), '0');
  assert.equal(await page.getByLabel('Fill vertical position', { exact: true }).inputValue(), '0');
  await render({ garmentMask: 'linear-gradient(black, black)' });
  assert.match(await page.locator('[data-custom-area-svg]').getAttribute('style'), /mask-image/);
  await page.getByLabel('Custom Area outline', { exact: true }).click();
  assert.equal(await page.evaluate(() => window.lastPatch.customAreaOutline.enabled), true);
  await page.getByLabel('Custom Area texture', { exact: true }).selectOption('denim-fabric');
  assert.match(await page.evaluate(() => window.lastPatch.customAreaTexture), /^data:image\/png/);
  await render({ customAreaTexture: texture });
  await page.getByLabel('Fill scale', { exact: true }).press('End');
  assert.equal(await page.evaluate(() => window.lastPatch.customAreaFillTransform.scale), 400);
  await page.getByLabel('Upload Custom Area texture').setInputFiles({ name: 'texture.png', mimeType: 'image/png', buffer: Buffer.from(texture.split(',')[1], 'base64') });
  await page.waitForFunction(() => window.lastPatch.customAreaTexture?.startsWith('data:image/png'));
  await page.getByLabel('Upload Custom Area texture').setInputFiles({ name: 'texture.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  assert.match(await page.getByRole('alert').textContent(), /Choose a PNG/);
  assert.deepEqual(errors, []);
  console.log('Custom Area renderer and appearance controls: passed');
} finally {
  await browser.close();
}
