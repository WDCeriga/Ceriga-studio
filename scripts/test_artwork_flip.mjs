import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { StudioGraphic } from './src/app/components/builder/printsStudio/StudioGraphic';
    import { TextArtwork } from './src/app/components/builder/printsStudio/TextArtwork';
    import { CustomAreaGraphic } from './src/app/components/builder/printsStudio/CustomAreaGraphic';
    import { FlipControls } from './src/app/components/builder/printsStudio/FlipControls';
    import { InlineElementToolbar } from './src/app/components/builder/InlineElementToolbar';
    import { PrintsDesignPreview } from './src/app/components/builder/PrintsDesignStep';
    import { LabelPreview, PackagingPreview } from './src/app/components/builder/LabelsPackagingStep';
    import { PrintsStudioProvider } from './src/app/components/builder/printsStudio/PrintsStudioContext';
    import { sourceSignature } from './src/app/components/builder/printsStudio/WarpedArtwork';
    import { artworkFlipStyle } from './src/app/lib/artworkFlip';
    const root = createRoot(document.getElementById('root'));
    function Fixture({ initial, mode }) {
      const [element, setElement] = useState(initial);
      const patch = change => setElement(old => ({ ...old, ...change }));
      window.flipState = element;
      window.flipSignature = sourceSignature(element);
      window.patchFlip = patch;
      const props = { elements: [element], onElementsChange: next => setElement(next[0]), selectedId: null, onSelectedIdChange: () => {} };
      return <>
        <div id="controls"><FlipControls element={element} onChange={patch} /></div>
        <div id="inline" hidden={mode === 'graphic'}><InlineElementToolbar element={element} onPatch={patch} onDuplicate={() => {}} onDelete={() => {}} variant="slim" /></div>
        {mode === 'prints' ? <PrintsStudioProvider><PrintsDesignPreview elements={[element]} onChange={next => setElement(next[0])}
          garmentPreview={<div data-layer-id="base"><svg viewBox="0 0 400 400" width="400" height="400"><rect width="400" height="400" fill="white" /></svg></div>} /></PrintsStudioProvider>
        : mode === 'label' ? <LabelPreview {...props} />
        : mode === 'packaging' ? <PackagingPreview {...props} />
        : <div id="art" style={{width:160,height:120,position:'relative',background:'white'}}>
          {element.type === 'text' ? <TextArtwork element={element} fontSize={24} />
          : element.type === 'customArea' ? <CustomAreaGraphic element={element} points={element.customAreaPoints} editing={true} selectedPoint={null} onSelectPoint={() => {}} onPointPointerDown={() => {}} />
          : <StudioGraphic element={element} />}
        </div>}
      </>;
    }
    window.renderFlip = (initial, mode = 'graphic') => flushSync(() => root.render(<Fixture key={Math.random()} initial={initial} mode={mode} />));
    window.flipStyle = artworkFlipStyle;
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`<style>
    body{margin:0} .relative{position:relative} .absolute{position:absolute} .inset-0{inset:0}
    .w-full{width:100%} .h-full{height:100%} .overflow-visible{overflow:visible} .overflow-hidden{overflow:hidden}
    .block{display:block} .pointer-events-none{pointer-events:none} button{min-height:30px}
  </style><div id="root"></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const base = { id: 'flip-test', type: 'shape', content: 'arrow', x: 180, y: 160, width: 160, height: 120,
    rotation: 0, color: '#c02030', fontSize: 24, fontFamily: 'Arial', autoHeight: false };
  const render = async (patch, mode = 'graphic') => {
    await page.evaluate(({ element, mode }) => window.renderFlip(element, mode), { element: { ...base, ...patch }, mode });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  };
  const flip = async (axis, inline = false) => {
    await page.locator(inline ? '#inline' : '#controls').getByRole('button', { name: `Flip ${axis}` }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const pixels = async () => sharp(await page.locator('#art').screenshot()).ensureAlpha().raw().toBuffer();
  function mirroredDifference(original, actual, horizontal, vertical) {
    let difference = 0;
    for (let y = 0; y < 120; y++) for (let x = 0; x < 160; x++) {
      const a = (y * 160 + x) * 4;
      const b = ((vertical ? 119 - y : y) * 160 + (horizontal ? 159 - x : x)) * 4;
      for (let c = 0; c < 3; c++) difference += Math.abs(actual[a + c] - original[b + c]);
    }
    return difference / (160 * 120 * 3);
  }
  const cases = [
    {}, { content: 'triangle' }, { type: 'distress', content: 'rips' }, { type: 'distress', content: 'holes' },
    { type: 'pattern', content: 'diagonal' }, { type: 'pattern', content: 'dots', patternRandomise: true, patternSeed: 24 },
    { type: 'text', content: 'First\nSecond', textAlign: 'left', textList: 'numbered', textLinePosition: 'top', textLineOffset: 6 },
    { type: 'text', content: 'Curved', textCurveAmount: 55 },
  ];
  for (const patch of cases) {
    await render(patch);
    const original = await pixels();
    const originalSignature = await page.evaluate(() => window.flipSignature);
    for (const [horizontal, vertical, axis] of [[true, false, 'horizontally'], [true, true, 'vertically'], [false, true, 'horizontally'], [false, false, 'vertically']]) {
      await flip(axis);
      const state = await page.evaluate(() => JSON.parse(JSON.stringify(window.flipState)));
      assert.equal(Boolean(state.flipHorizontal), horizontal);
      assert.equal(Boolean(state.flipVertical), vertical);
      assert.equal(state.x, base.x);
      assert.equal(state.y, base.y);
      assert.equal(state.rotation, 0);
      const difference = mirroredDifference(original, await pixels(), horizontal, vertical);
      assert(difference < 2,
        `${patch.type ?? 'shape'} ${patch.content ?? 'arrow'} must mirror complete artwork (${horizontal}, ${vertical}, difference ${difference})`);
      if (horizontal || vertical) assert.notEqual(await page.evaluate(() => window.flipSignature), originalSignature);
    }
  }
  const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><path fill="red" d="M0 0h80v60H0z"/><path fill="blue" d="M80 60h80v60H80z"/></svg>').toString('base64');
  const points = [{ x: 8, y: 8 }, { x: 140, y: 20 }, { x: 45, y: 110 }];
  for (const fill of [{ customAreaImage: image }, { customAreaPattern: 'dots', patternRandomise: true, patternSeed: 12 }, { color: 'paint:' + JSON.stringify({ kind: 'linear', angle: 90, x: .5, y: .5, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] }) }]) {
    await render({ type: 'customArea', customAreaPoints: points, customAreaViewWidth: 160, customAreaViewHeight: 120, ...fill });
    const boundary = await page.locator('#art clipPath path').getAttribute('d');
    const before = await pixels();
    await flip('horizontally');
    await flip('vertically');
    assert.deepEqual(await page.locator('#art clipPath path').getAttribute('d'), boundary, 'Flips must preserve editable source anchors');
    const difference = mirroredDifference(before, await pixels(), true, true);
    assert(difference < 2, `Custom Area boundary and fill must flip together (${Object.keys(fill)}, difference ${difference})`);
    assert.equal(await page.locator('[data-pattern]').evaluateAll(nodes => nodes.filter(node => node.style.transform).length), 0, 'Do not double-flip patterns');
  }
  for (const mode of ['prints', 'label', 'packaging']) {
    const types = mode === 'prints' ? ['image', 'drawing', 'distress', 'shape', 'pattern', 'text'] : ['image', 'text'];
    for (const type of types) {
      const content = ['image', 'drawing', 'distress'].includes(type) ? image : type === 'text' ? 'Flip me' : type === 'pattern' ? 'diagonal' : 'arrow';
      await render({ type, content, color: type === 'image' ? undefined : '#c02030', rotation: 23 }, mode);
      const surface = page.locator(mode === 'prints' ? '[data-print-id]' : '[data-surface-id]').first();
      await surface.waitFor({ state: 'attached' });
      const placement = await surface.getAttribute('style');
      await flip('horizontally', true);
      await flip('vertically', true);
      const reflections = await surface.evaluate(node => [...node.querySelectorAll('*')].filter(child => child.style?.transform === 'scale(-1, -1)').length);
      assert(reflections > 0, `${mode} ${type} must render both flip axes`);
      assert.equal(await surface.getAttribute('style'), placement, 'Flips must not change placement or rotation');
    }
  }
  await render({ type: 'image', content: image, color: undefined,
    warp: { mode: 'preset', preset: 'wave', bend: 35, horizontalDistortion: 0, verticalDistortion: 0, gridSize: 3, points: [] } }, 'prints');
  const checksum = () => page.locator('[data-warp-canvas]').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return data.reduce((sum, value, index) => sum + value * (index % 31 + 1), 0);
  });
  await page.waitForFunction(() => document.querySelector('[data-warp-canvas]')?.width > 0);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-warp-canvas]');
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0);
  });
  for (const axis of ['horizontally', 'vertically']) {
    const before = await checksum();
    await flip(axis);
    await page.waitForFunction(previous => {
      const canvas = document.querySelector('[data-warp-canvas]');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return data.reduce((sum, value, index) => sum + value * (index % 31 + 1), 0) !== previous;
    }, before);
  }
  await render({ locked: true });
  assert(await page.locator('#controls').getByRole('button', { name: 'Flip horizontally' }).isDisabled());
  assert(await page.locator('#inline').getByRole('button', { name: 'Flip vertically', includeHidden: true }).isDisabled());
  assert.equal(await page.evaluate(() => window.flipStyle({})), undefined, 'Legacy elements remain unflipped');
  assert.deepEqual(errors, []);
  console.log('Artwork flip passed: both axes, repeat toggles, pixels, text decorations, whole Custom Area reflections, all artwork types, both editors, compact controls, locks and signatures.');
} finally {
  await browser.close();
}
