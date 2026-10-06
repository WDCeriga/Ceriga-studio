import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const startedAt = new Date().toISOString();
const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { toCanvas } from 'html-to-image';
    import { ImageAdjustmentDefs } from './src/app/components/builder/printsStudio/ImageAdjustmentDefs';
    import { imageAdjustmentFilter } from './src/app/lib/imageAdjustments';
    const root = createRoot(document.getElementById('root'));
    window.captureAdjustment = async () => {
      const canvas = await toCanvas(document.getElementById('root'), { pixelRatio: 1, width: 256, height: 256, skipFonts: true });
      return Array.from(canvas.getContext('2d').getImageData(0, 0, 256, 256).data);
    };
    window.renderAdjustment = (source, settings) => flushSync(() => root.render(<>
      <ImageAdjustmentDefs element={{ id: 'test', ...settings }} />
      <div id="photo" style={{width:256,height:256,filter:imageAdjustmentFilter({id:'test',...settings})}}>
        <img src={source} style={{width:256,height:256,display:'block'}} />
      </div>
    </>));
  `, loader: 'tsx', resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
});
const fixture = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <defs><filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
  <path fill="#333" d="M32 32h64v64H32z"/><path fill="#999" d="M96 32h64v64H96z"/>
  <path fill="#ddd" d="M160 32h64v64h-64z"/><path fill="#9b6654" d="M32 96h192v48H32z"/>
  <path fill="#888" d="M32 144h192v80H32z"/>
  <path fill="#ddd" filter="url(#soft)" d="M64 144h16v80H64zM112 144h16v80h-16zM160 144h16v80h-16z"/>
  <path fill="#999" opacity=".5" d="M8 112h16v16H8z"/>
</svg>`;
const source = `data:image/svg+xml;base64,${Buffer.from(fixture).toString('base64')}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;background:transparent}</style><div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const render = async settings => {
    await page.evaluate(async ({ source, settings }) => {
      window.renderAdjustment(source, settings);
      await document.querySelector('img').decode();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { source, settings });
    const png = await page.locator('#photo').screenshot({ omitBackground: true });
    return sharp(png).ensureAlpha().raw().toBuffer();
  };
  const pixel = (pixels, horizontal, vertical) => [...pixels.subarray((vertical * 256 + horizontal) * 4, (vertical * 256 + horizontal) * 4 + 4)];
  const difference = (first, second, left = 32, top = 32, right = 224, bottom = 224) => {
    let total = 0;
    for (let vertical = top; vertical < bottom; vertical++) for (let horizontal = left; horizontal < right; horizontal++) {
      const offset = (vertical * 256 + horizontal) * 4;
      for (let channel = 0; channel < 3; channel++) total += Math.abs(first[offset + channel] - second[offset + channel]);
    }
    return total / ((right - left) * (bottom - top) * 3);
  };
  const original = await render({});
  const settings = {
    filterExposure: 1, filterBrightness: 130, filterContrast: 140, filterSaturate: 0,
    filterTemperature: 100, filterTint: 100, filterHighlights: -100, filterHue: 90,
    filterNoise: 100, filterGrain: 100, filterSharpen: 100,
  };
  const rendered = {};
  for (const [key, value] of Object.entries(settings)) {
    const pixels = await render({ [key]: value });
    rendered[key] = pixels;
    const change = difference(original, pixels);
    assert.ok(change > 0.1, `${key} must visibly change pixels (${change})`);
    assert.equal(pixel(pixels, 4, 4)[3], 0, `${key} must preserve transparent margins`);
    assert.ok(Math.abs(pixel(pixels, 16, 120)[3] - pixel(original, 16, 120)[3]) <= 1, `${key} must preserve partial alpha`);
    console.log(`${key}: mean pixel change ${change.toFixed(2)}`);
  }
  assert.ok(pixel(rendered.filterExposure, 48, 48)[0] > pixel(original, 48, 48)[0]);
  assert.ok(pixel(rendered.filterTemperature, 128, 48)[0] > pixel(rendered.filterTemperature, 128, 48)[2]);
  assert.ok(pixel(rendered.filterTint, 128, 48)[0] > pixel(rendered.filterTint, 128, 48)[1]);
  assert.deepEqual(pixel(rendered.filterHighlights, 48, 48), pixel(original, 48, 48));
  assert.ok(pixel(rendered.filterHighlights, 192, 48)[0] < pixel(original, 192, 48)[0]);
  assert.ok(difference(rendered.filterNoise, rendered.filterGrain, 96, 32, 160, 96) > 1);
  for (const key of ['filterNoise', 'filterGrain']) {
    const repeated = await render({ [key]: 100 });
    let maximumDifference = 0;
    for (let index = 0; index < repeated.length; index++) maximumDifference = Math.max(maximumDifference, Math.abs(repeated[index] - rendered[key][index]));
    assert.ok(difference(repeated, rendered[key]) < 0.05 && maximumDifference <= 2, `${key} must retain its seeded pattern across renders`);
  }
  const edgeContrast = pixels => pixel(pixels, 66, 184)[0] - pixel(pixels, 62, 184)[0];
  let previousContrast = edgeContrast(original);
  for (const blur of [25, 50, 100]) {
    const contrast = edgeContrast(await render({ filterBlur: blur }));
    assert.ok(contrast < previousContrast, `Blur ${blur}% should soften more (${contrast} < ${previousContrast})`);
    if (blur === 50) assert.ok(contrast >= edgeContrast(original) * 0.5, '50% blur must retain recognizable image detail');
    previousContrast = contrast;
  }
  const sharpened = rendered.filterSharpen;
  assert.ok(pixel(sharpened, 66, 184)[0] - pixel(sharpened, 62, 184)[0]
    > pixel(original, 66, 184)[0] - pixel(original, 62, 184)[0], 'Sharpen should increase edge contrast');
  const combined = await render(settings);
  const exported = Buffer.from(await page.evaluate(() => window.captureAdjustment()));
  assert.ok(difference(combined, exported) < 2, 'Export must retain the composed SVG effects');
  assert.deepEqual(await render({}), original, 'Reset must restore identical original pixels');
  assert.equal(await page.locator('img').getAttribute('src'), source, 'Original upload must not be rewritten');
  assert.deepEqual(errors, []);
  console.log('Passed: live effects, selective highlights, progressive blur, sharpening, stable textures, alpha, and pixel-exact reset.');

  const editor = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  editor.on('pageerror', error => errors.push(error.message));
  await editor.goto(`${process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5176'}/builder/hd-001`);
  for (let step = 0; step < 8 && !await editor.getByRole('button', { name: 'Images', exact: true }).isVisible(); step++) {
    await editor.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await editor.getByRole('button', { name: 'Images', exact: true }).click();
  const chooser = editor.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Upload image', exact: true }).click();
  await (await chooser).setFiles({ name: 'adjustment-test.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(fixture) });
  const artwork = editor.getByAltText('Artwork', { exact: true });
  await artwork.waitFor();
  const upload = await artwork.getAttribute('src');
  const setSlider = async (label, value) => {
    await editor.getByRole('slider', { name: label, exact: true }).evaluate((input, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  await setSlider('Blur', 50);
  assert.match(await artwork.locator('..').getAttribute('style'), /blur\(2px\)/);
  await editor.getByRole('button', { name: 'Reset Blur', exact: true }).click();
  assert.equal(await editor.getByRole('slider', { name: 'Blur', exact: true }).inputValue(), '0');
  await setSlider('Exposure', 1);
  assert.equal(await editor.locator('filter[id^="adjust-"] feFuncR').first().getAttribute('slope'), '2');
  await editor.getByRole('slider', { name: 'Exposure', exact: true }).dblclick();
  assert.equal(await editor.getByRole('slider', { name: 'Exposure', exact: true }).inputValue(), '0');
  for (const [label, value] of Object.entries({ Exposure: 0.7, Temperature: 30, Tint: -25, Highlights: -40, Hue: 45, Noise: 20, Grain: 25, Sharpen: 30 })) {
    await setSlider(label, value);
    assert.equal(Number(await editor.getByRole('slider', { name: label, exact: true }).inputValue()), value);
  }
  assert.equal(await artwork.getAttribute('src'), upload);
  await editor.getByRole('button', { name: 'Reset All', exact: true }).click();
  assert.equal(await editor.locator('filter[id^="adjust-"]').count(), 0);
  assert.equal(await artwork.getAttribute('src'), upload);
  await editor.getByRole('button', { name: 'Undo', exact: true }).click();
  await editor.locator('filter[id^="adjust-"]').waitFor({ state: 'attached' });
  assert.equal(await artwork.getAttribute('src'), upload);
  await editor.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await editor.locator('filter[id^="adjust-"]').count(), 0);
  const layer = editor.locator('[data-print-id]').filter({ has: artwork });
  const selectedPosition = await artwork.boundingBox();
  const zonePosition = await editor.locator('[data-print-design-zone]').boundingBox();
  await editor.mouse.click(zonePosition.x + 2, zonePosition.y + 2);
  await layer.locator('[data-handles]').waitFor({ state: 'detached' });
  const releasedPosition = await artwork.boundingBox();
  for (const coordinate of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(releasedPosition[coordinate] - selectedPosition[coordinate]) < 0.5,
      `Deselecting artwork must preserve ${coordinate}: ${selectedPosition[coordinate]} -> ${releasedPosition[coordinate]}`);
  }
  await artwork.click();
  await layer.locator('[data-handles]').first().waitFor();
  for (const degrees of [1, 2, 359]) {
    await setSlider('Rotation', degrees);
    assert.ok((await layer.getAttribute('style')).includes(`rotate(${degrees}deg)`), 'Settings rotation must remain exact near upright');
    assert.equal(await editor.locator('[data-rotation-snap]').count(), 0);
  }
  await setSlider('Rotation', 10);
  const box = await layer.boundingBox();
  const handle = await layer.getByRole('button', { name: 'Rotate', exact: true }).boundingBox();
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  const angle = Math.atan2(start.y - center.y, start.x - center.x);
  const rotate = async delta => editor.mouse.move(center.x + radius * Math.cos(angle + delta * Math.PI / 180), center.y + radius * Math.sin(angle + delta * Math.PI / 180));
  await editor.mouse.move(start.x, start.y);
  await editor.mouse.down();
  await rotate(-8);
  await editor.locator('[data-rotation-snap]').waitFor();
  assert.match(await layer.getAttribute('style'), /rotate\(0deg\)/);
  const guide = await editor.locator('[data-rotation-snap]').boundingBox();
  assert.ok(guide.height > guide.width * 10, 'Canvas snap guide must be vertical');
  await rotate(20);
  assert.equal(await editor.locator('[data-rotation-snap]').count(), 0);
  assert.ok(Math.abs(Number((await layer.getAttribute('style')).match(/rotate\(([\d.]+)deg\)/)[1]) - 30) < 0.1);
  await rotate(-12);
  await editor.locator('[data-rotation-snap]').waitFor();
  await editor.mouse.up();
  assert.equal(await editor.locator('[data-rotation-snap]').count(), 0);
  assert.match(await layer.getAttribute('style'), /rotate\(0deg\)/);
  await editor.getByRole('slider', { name: 'Exposure', exact: true }).scrollIntoViewIfNeeded();
  await editor.screenshot({ path: '.tmp-image-adjustments-desktop.png' });
  await editor.setViewportSize({ width: 390, height: 844 });
  await editor.getByRole('slider', { name: 'Exposure', exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const label of ['Blur', 'Exposure', 'Temperature', 'Sharpen']) {
    const slider = editor.getByRole('slider', { name: label, exact: true });
    await slider.scrollIntoViewIfNeeded();
    const rect = await slider.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 390, `${label} must fit mobile width`);
  }
  await editor.getByRole('button', { name: 'Reset All', exact: true }).scrollIntoViewIfNeeded();
  await editor.screenshot({ path: '.tmp-image-adjustments-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Passed: editor upload, live slider updates, individual/double-click/global reset, undo/redo, rotation snap feedback, export, and mobile controls.');
} finally {
  await browser.close();
}
writeFileSync('.tmp-image-adjustments-results.json', JSON.stringify({ startedAt, completedAt: new Date().toISOString(), status: 'passed', checks: ['pixel-effects', 'alpha', 'reset', 'export', 'editor-sliders', 'undo-redo', 'rotation-snap', 'mobile-layout'] }, null, 2));