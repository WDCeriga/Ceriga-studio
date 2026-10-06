import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { PrintsDesignStep } from './src/app/components/builder/PrintsDesignStep';
    import { InlineElementToolbar } from './src/app/components/builder/InlineElementToolbar';
    import { PrintsStudioProvider, DISTRESS_LAYER_ID } from './src/app/components/builder/printsStudio/PrintsStudioContext';
    const root = createRoot(document.getElementById('root'));
    window.renderControls = (kind, compact, shape = 'rect', locked = false) => {
      const type = kind === 'distress-layer' ? 'drawing' : kind;
      const element = { id: kind === 'distress-layer' ? DISTRESS_LAYER_ID : 'asset', type,
        content: type === 'text' ? 'Text' : type === 'shape' ? shape : type === 'pattern' ? 'dots' : '',
        x: 100, y: 100, width: 200, height: 150, rotation: 0, borderWidth: 4, borderColor: '#123456', opacity: 75, locked };
      window.controlWrites = [];
      window.originalElement = JSON.stringify(element);
      window.controlElement = element;
      flushSync(() => root.render(<PrintsStudioProvider key={kind + compact}>
        <div id="quick"><InlineElementToolbar element={element} compact={compact}
          onPatch={patch => window.controlWrites.push(patch)} onDuplicate={() => {}} onDelete={() => {}} /></div>
        <div id="sidebar"><PrintsDesignStep elements={[element]} selectedLayerId={element.id}
          onSelectedLayerIdChange={() => {}} onChange={next => window.controlWrites.push(next)} usePhoneStrips={compact} /></div>
      </PrintsStudioProvider>));
    };
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189');
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const compact of [false, true]) {
    await page.setViewportSize(compact ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    for (const kind of ['image', 'drawing', 'shape', 'pattern', 'distress', 'distress-layer', 'text']) {
      await page.evaluate(({ kind, compact }) => window.renderControls(kind, compact), { kind, compact });
      const quick = page.locator('#quick');
      assert.equal(await quick.getByTitle('Adjustments', { exact: true }).count(), 0);
      assert.equal(await quick.getByTitle('Outline & corners', { exact: true }).count(), 0);
      assert.equal(await quick.getByTitle('Crop', { exact: true }).count(), 1);
      if (kind === 'text') assert.equal(await quick.getByTitle('Effects', { exact: true }).count(), 1);
      const expectedBorder = kind === 'image' || kind === 'drawing';
      assert.equal(await page.locator('#sidebar').getByText('Border', { exact: true }).count(), Number(expectedBorder), kind);
      if (kind === 'image') assert.equal(await page.locator('#sidebar').getByText('Image adjustments', { exact: true }).count(), 1);
      assert.deepEqual(await page.evaluate(() => window.controlWrites), [], 'Viewing controls must not modify artwork');
      assert.equal(await page.evaluate(() => JSON.stringify(window.controlElement) === window.originalElement), true);
      const fill = page.getByRole('button', { name: 'Solid fill', exact: true });
      assert.equal(await fill.count(), Number(kind === 'shape'));
      if (kind === 'shape') {
        await fill.click();
        const updated = await page.evaluate(() => window.controlWrites[0][0]);
        assert.equal(updated.shapeFilled, true);
        assert.equal(updated.borderWidth, 4);
      }
    }
    for (const shape of ['line', 'zigzag', 'squiggly']) {
      await page.evaluate(({ compact, shape }) => window.renderControls('shape', compact, shape), { compact, shape });
      assert.equal(await page.getByRole('button', { name: 'Solid fill', exact: true }).count(), 0);
    }
    await page.evaluate(compact => window.renderControls('shape', compact, 'rect', true), compact);
    assert.equal(await page.getByRole('button', { name: 'Solid fill', exact: true }).isDisabled(), true);
  }
  assert.deepEqual(errors, []);
  console.log('Print controls passed: desktop/mobile menu cleanup, type-specific Border panels, preserved image/text controls and unchanged artwork.');
} finally {
  await browser.close();
}
