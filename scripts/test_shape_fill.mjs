import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { StudioGraphic } from './src/app/components/builder/printsStudio/StudioGraphic';
    import { canFillShape } from './src/app/components/builder/printsStudio/studioAssets';
    import { sourceSignature } from './src/app/components/builder/printsStudio/WarpedArtwork';
    const root = createRoot(document.getElementById('root'));
    window.renderShape = (content, shapeGeometry, shapeFilled) => {
      const element = { id: 'shape', type: 'shape', content, shapeGeometry, shapeFilled,
        x: 0, y: 0, width: 200, height: 160, rotation: 0, color: '#e53935', borderWidth: 4 };
      flushSync(() => root.render(<StudioGraphic element={element} />));
      return { eligible: canFillShape(element), signature: sourceSignature(element) };
    };
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const raster = () => page.locator('#root svg').evaluate(async svg => {
    const copy = svg.cloneNode(true);
    copy.setAttribute('width', '200');
    copy.setAttribute('height', '160');
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 160;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return { center: Array.from(context.getImageData(100, 80, 1, 1).data), png: canvas.toDataURL() };
  });
  for (const [geometry, closed, open] of [
    [undefined, ['ellipse', 'rect', 'triangle', 'star', 'arrow'], ['line', 'zigzag', 'squiggly']],
    ['bounds', ['ellipse', 'circle', 'rect', 'semicircle-closed'], ['line', 'semicircle-open']],
  ]) {
    for (const content of [...closed, ...open]) {
      const before = await page.evaluate(({ content, geometry }) => window.renderShape(content, geometry), { content, geometry });
      const outline = await raster();
      const after = await page.evaluate(({ content, geometry }) => window.renderShape(content, geometry, true), { content, geometry });
      const filled = await raster();
      const eligible = closed.includes(content);
      assert.equal(after.eligible, eligible, content);
      assert.notEqual(before.signature, after.signature, 'Fill changes must invalidate warp and selection captures');
      if (eligible) {
        assert.equal(outline.center[3], 0, `${content}: old artwork stays hollow by default`);
        assert.deepEqual(filled.center, [229, 57, 53, 255], `${content}: completely filled with shape colour`);
      } else assert.equal(outline.png, filled.png, `${content}: open paths must never fill`);
      await page.evaluate(({ content, geometry }) => window.renderShape(content, geometry, false), { content, geometry });
      assert.equal((await raster()).png, outline.png, 'Turning fill off restores the original outline');
    }
  }
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189'}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible(); step++) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  const zone = page.locator('[data-print-design-zone]');
  await zone.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/x-ceriga-asset', JSON.stringify({ kind: 'shape', id: 'star' }));
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
  });
  const polygon = zone.locator('[data-print-id] svg polygon').first();
  const toggle = page.getByRole('button', { name: 'Solid fill', exact: true });
  assert.equal(await polygon.getAttribute('fill'), 'none');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(await polygon.getAttribute('fill'), await polygon.getAttribute('stroke'));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await polygon.getAttribute('fill'), 'none');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.notEqual(await polygon.getAttribute('fill'), 'none');
  await page.getByRole('button', { name: 'Convert to Editable Path', exact: true }).click();
  await zone.locator('[data-shape-path-editor]').waitFor();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await zone.locator('[data-shape-path-editor]').waitFor({ state: 'detached' });
  assert.equal(await zone.locator('[data-handles]').count(), 1, 'Undo conversion restores transform handles');
  assert.equal(await page.getByRole('button', { name: 'Convert to Editable Path', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Edit Path', exact: true }).count(), 1, 'Redo restores editable path');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const effects = page.locator('[data-shape-effects-panel]');
  await effects.locator('summary').click();
  await effects.getByRole('button', { name: 'Add Shadow effect', exact: true }).click();
  await zone.locator('[data-text-effects-canvas]').waitFor();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await zone.locator('[data-text-effects]').count(), 0, 'Undo removes the shape effect');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await zone.locator('[data-text-effects-canvas]').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-text-effects-pending="true"]'));
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).click();
  for (let step = 0; step < 2; step++) await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: /Reset size split|One per size/ }).first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: 'Order', exact: true }).waitFor();
  assert.notEqual(await polygon.getAttribute('fill'), 'none', 'Review must preserve the fill');
  await zone.locator('[data-text-effects-canvas]').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-text-effects-pending="true"]'));
  assert.deepEqual(errors, []);
  console.log('Shape fill passed: every supported closed shape, rejected open paths, exact colour, reversible fill, capture invalidation, real editor Undo/Redo and later previews.');
} finally {
  await browser.close();
}
