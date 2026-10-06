import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const geometry = await build({ entryPoints: ['src/app/lib/artworkCrop.ts'], bundle: true, format: 'cjs', platform: 'node', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', geometry.outputFiles[0].text)(require, module, module.exports);
const { normalizeCrop, adjustCrop, buildArtworkClipPath } = module.exports;
const zero = { cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
assert.deepEqual(normalizeCrop({}), zero);
assert.deepEqual(normalizeCrop({ cropTop: -5, cropLeft: NaN, cropBottom: Infinity }), zero);
assert.deepEqual(normalizeCrop({ cropTop: 80, cropBottom: 80, cropLeft: 120, cropRight: 20 }), { cropTop: 80, cropBottom: 19, cropLeft: 99, cropRight: 0 });
assert.equal(buildArtworkClipPath({}), undefined);
assert.equal(buildArtworkClipPath({ cropLeft: 15, cornerRadius: 12 }), 'inset(0% 0% 0% 15% round 12px)');
assert.equal(buildArtworkClipPath({ cropLeft: 15, cornerRadius: 12 }, { ignoreCrop: true }), 'inset(0% 0% 0% 0% round 12px)');
const initial = { cropTop: 20, cropRight: 20, cropBottom: 20, cropLeft: 20 };
for (const handle of ['move', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
  for (const dx of [-300, -10, 0, 10, 300]) for (const dy of [-300, -10, 0, 10, 300]) {
    const result = adjustCrop(initial, handle, dx, dy);
    assert(Object.values(result).every(value => Number.isFinite(value) && value >= 0));
    assert(result.cropLeft + result.cropRight <= 99);
    assert(result.cropTop + result.cropBottom <= 99);
    if (handle === 'move') {
      assert.equal(result.cropLeft + result.cropRight, 40);
      assert.equal(result.cropTop + result.cropBottom, 40);
    }
  }
}
assert.deepEqual(adjustCrop(initial, 'nw', 10, 5), { ...initial, cropLeft: 30, cropTop: 25 });
assert.deepEqual(adjustCrop(initial, 'se', 10, 5), { ...initial, cropRight: 10, cropBottom: 15 });

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { CropEditingOverlay, CropEditorControls } from './src/app/components/builder/printsStudio/CropEditor';
    import { InlineElementToolbar } from './src/app/components/builder/InlineElementToolbar';
    import { LabelPreview, PackagingPreview } from './src/app/components/builder/LabelsPackagingStep';
    const root = createRoot(document.getElementById('root'));
    function Fixture({ mode, type = 'image', locked = false }) {
      const [element, setElement] = useState({ id: 'asset', type, content: type === 'text' ? 'Crop me' : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>', x: 100, y: 80, width: 200, height: 120, rotation: 0, flipX: true, cropTop: 20, cropRight: 20, cropBottom: 20, cropLeft: 20, locked });
      const [selected, select] = useState('asset');
      const [draft, change] = useState({ cropTop: 20, cropRight: 20, cropBottom: 20, cropLeft: 20 });
      window.cropState = element;
      window.cropDraft = draft;
      const props = { elements: [element], onElementsChange: next => { window.cropWrites = (window.cropWrites || 0) + 1; setElement(next[0]); }, selectedId: selected, onSelectedIdChange: select };
      if (mode === 'label') return <LabelPreview {...props} />;
      if (mode === 'packaging') return <PackagingPreview {...props} />;
      if (mode === 'toolbar') return <InlineElementToolbar element={element} variant="slim" onPatch={() => {}} onDuplicate={() => {}} onDelete={() => {}} onRequestCrop={() => window.cropRequested = true} />;
      return <><div id="preview" style={{ position: 'relative', width: 200, height: 120, margin: 150, transform: mode === 'perspective' ? 'perspective(450px) rotateY(35deg) rotateX(-20deg) rotate(15deg) scale(1.4, 0.9)' : 'rotate(31deg) scale(1.6, 0.8)' }}><CropEditingOverlay element={draft} onChange={change} width={200} height={120} /></div><CropEditorControls draft={draft} onChange={change} onApply={() => setElement(old => ({...old, ...draft}))} onCancel={() => change(element)} /></>;
    }
    window.renderCrop = (mode, type, locked) => { window.cropWrites = 0; window.cropRequested = false; flushSync(() => root.render(<Fixture key={Math.random()} mode={mode} type={type} locked={locked} />)); };
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<style>body{margin:0}.relative{position:relative}.absolute{position:absolute}.fixed{position:fixed}.z-30{z-index:30}.z-\\[200\\]{z-index:200}.pointer-events-auto{pointer-events:auto}.inset-0{inset:0}.w-full{width:100%}.h-full{height:100%}.overflow-visible{overflow:visible}.overflow-hidden{overflow:hidden}.pointer-events-none{pointer-events:none}button{min-height:30px}[data-label-packaging-surface]{width:400px;height:240px}</style><div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const type of ['image', 'text', 'shape', 'pattern', 'distress', 'customArea']) {
    await page.evaluate(type => window.renderCrop('toolbar', type), type);
    await page.getByTitle('Crop', { exact: true }).click();
    assert.equal(await page.evaluate(() => window.cropRequested), true, type);
    await page.evaluate(type => window.renderCrop('toolbar', type, true), type);
    assert.equal(await page.getByTitle('Crop', { exact: true }).isDisabled(), true, type);
  }
  const screenPoints = points => page.locator('svg[data-crop-editor]').evaluate((svg, points) => points.map(({ x, y }) => {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [name, value] of Object.entries({ x, y, width: 0.0001, height: 0.0001 })) marker.setAttribute(name, String(value));
    svg.appendChild(marker);
    const rect = marker.getBoundingClientRect();
    marker.remove();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }), points);
  for (const mode of ['overlay', 'perspective']) {
  await page.evaluate(mode => window.renderCrop(mode), mode);
  assert.equal(await page.getByRole('button', { name: /^Resize crop/ }).count(), 8);
  const points = await screenPoints([{ x: 160, y: 96 }, { x: 180, y: 108 }]);
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 6 });
  await page.mouse.up();
  const changed = await page.evaluate(() => window.cropDraft);
  assert(Math.abs(changed.cropRight - 10) < 0.01, JSON.stringify(changed));
  assert(Math.abs(changed.cropBottom - 10) < 0.01, JSON.stringify(changed));
  const movePoints = await screenPoints([{ x: 100, y: 60 }, { x: 104, y: 62.4 }]);
  await page.mouse.move(movePoints[0].x, movePoints[0].y);
  await page.mouse.down();
  await page.mouse.move(movePoints[1].x, movePoints[1].y, { steps: 4 });
  await page.mouse.up();
  assert(Math.abs(await page.evaluate(() => window.cropDraft.cropLeft) - 22) < 0.01);
  assert(Math.abs(await page.evaluate(() => window.cropDraft.cropTop) - 22) < 0.01);
  await page.getByRole('button', { name: 'Move crop rectangle' }).press('ArrowRight');
  assert(Math.abs(await page.evaluate(() => window.cropDraft.cropLeft) - 23) < 0.01);
  await page.getByRole('button', { name: 'Reset crop' }).click();
  assert.deepEqual(await page.evaluate(() => window.cropDraft), zero);
  }
  for (const mode of ['label', 'packaging']) for (const type of ['image', 'text']) {
    await page.evaluate(({ mode, type }) => window.renderCrop(mode, type), { mode, type });
    await page.getByTitle('Crop', { exact: true }).click();
    assert.equal(await page.locator('svg[data-crop-editor]').count(), 1);
    await page.getByRole('button', { name: 'Reset crop' }).click();
    assert.equal(await page.evaluate(() => window.cropWrites), 0);
    await page.getByRole('button', { name: 'Cancel crop' }).click();
    assert.equal(await page.evaluate(() => window.cropState.cropLeft), 20);
    await page.getByTitle('Crop', { exact: true }).click();
    await page.getByRole('button', { name: 'Resize crop left', exact: true }).press('ArrowRight');
    assert.equal(await page.evaluate(() => window.cropWrites), 0);
    await page.getByRole('button', { name: 'Apply crop' }).click();
    assert.equal(await page.evaluate(() => window.cropState.cropLeft), 21);
    assert.equal(await page.evaluate(() => window.cropWrites), 1);
    assert.equal(await page.locator('svg[data-crop-editor]').count(), 0);
    const clip = await page.locator('[data-surface-id="asset"] > div').first().evaluate(el => el.style.clipPath);
    assert.equal(clip, 'inset(20% 20% 20% 21%)');
    if (type === 'image') assert.equal(await page.locator('[data-surface-id="asset"] img').evaluate(el => el.style.clipPath), '');
    await page.getByTitle('Crop', { exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Move crop rectangle' }).getAttribute('x'), '42');
    await page.getByRole('button', { name: 'Reset crop' }).click();
    await page.getByRole('button', { name: 'Apply crop' }).click();
    assert.equal(await page.evaluate(() => window.cropState.cropLeft), 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['label', 'packaging']) for (const type of ['image', 'text']) {
    await page.evaluate(({ mode, type }) => window.renderCrop(mode, type), { mode, type });
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    await page.getByRole('button', { name: 'Reset crop' }).click();
    await page.getByRole('button', { name: 'Apply crop' }).click();
    assert.equal(await page.evaluate(() => window.cropState.cropTop), 0);
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel crop' }).click();
    assert.equal(await page.locator('svg[data-crop-editor]').count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log('Crop geometry, transformed drag/resize, all-type toolbar, locked assets, desktop/mobile labels and packaging draft apply/cancel/reset/reopen passed.');
} finally { await browser.close(); }
