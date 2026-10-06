import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible().catch(() => false); step += 1) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Shapes and lines', exact: true }).click();
  await page.getByRole('button', { name: 'Star', exact: true }).click();
  await page.getByRole('button', { name: 'Warp', exact: true }).click();
  await page.getByRole('button', { name: 'Arc', exact: true }).waitFor();
  assert.equal(await page.locator('[data-handles]').count(), 0, 'Warp mode must replace standard transform controls');
  assert.equal(await page.locator('[data-inline-toolbar]').count(), 0, 'Warp mode must hide the standard floating toolbar');
  assert.equal(await page.getByRole('button', { name: /^(Arc|Arc Lower|Arc Upper|Arch|Bulge|Squeeze|Wave|Flag|Fish|Rise)$/ }).count(), 10);
  const setRange = async (label, value) => page.getByRole('slider', { name: label, exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const presetCanvas = page.locator('[data-warp-canvas]');
  await page.waitForFunction(() => document.querySelector('[data-warp-canvas]')?.width > 0);
  const presetChecksum = await presetCanvas.evaluate(node => {
    const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    return Array.from(data).reduce((sum, value, index) => sum + value * ((index % 17) + 1), 0);
  });
  await page.getByRole('button', { name: 'Wave', exact: true }).click();
  await page.waitForFunction((previous) => {
    const canvas = document.querySelector('[data-warp-canvas]');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return Array.from(data).reduce((sum, value, index) => sum + value * ((index % 17) + 1), 0) !== previous;
  }, presetChecksum);
  await setRange('Bend', 55);
  await setRange('Horizontal Distortion', -20);
  await setRange('Vertical Distortion', 15);

  await page.getByRole('button', { name: 'Freeform', exact: true }).click();
  const gridSelector = page.getByLabel('Warp grid density');
  assert.equal(await gridSelector.inputValue(), '3');
  assert.equal(await page.locator('[data-warp-point]').count(), 9);
  await gridSelector.selectOption('4');
  assert.equal(await page.locator('[data-warp-point]').count(), 16);
  await gridSelector.selectOption('2');
  assert.equal(await page.locator('[data-warp-point]').count(), 4);
  await gridSelector.selectOption('3');
  assert.equal(await page.locator('[data-warp-point]').count(), 9);

  const canvas = page.locator('[data-warp-canvas]');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-warp-canvas]');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
  });
  const readback = () => canvas.evaluate(node => {
    const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    return Array.from(data).reduce((sum, value, index) => sum + value * ((index % 17) + 1), 0);
  });
  const area = page.locator('[data-print-id]').filter({ has: canvas });
  const boundsBefore = await area.locator('[data-visible-bounds]').getAttribute('style');
  const checksumBefore = await readback();
  const handle = await page.locator('[data-warp-point="1"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 24, { steps: 4 });
  await page.waitForFunction((previous) => {
    const canvas = document.querySelector('[data-warp-canvas]');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const next = Array.from(data).reduce((sum, value, index) => sum + value * ((index % 17) + 1), 0);
    return next !== previous;
  }, checksumBefore);
  const liveChecksum = await readback();
  await page.mouse.up();
  const boundsAfter = await area.locator('[data-visible-bounds]').getAttribute('style');
  assert.notEqual(liveChecksum, checksumBefore, 'The visible design must warp before pointer release');
  assert.notEqual(boundsAfter, boundsBefore, 'The selection bounds must follow warped alpha');

  const pointAfter = await page.locator('[data-warp-point="1"]').getAttribute('cy');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction((previous) => document.querySelector('[data-warp-point="1"]')?.getAttribute('cy') !== previous, pointAfter);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.waitForFunction((value) => document.querySelector('[data-warp-point="1"]')?.getAttribute('cy') === value, pointAfter);

  await page.getByRole('button', { name: 'Duplicate', exact: true }).first().click();
  assert.equal(await page.locator('[data-warp-canvas]').count(), 2);
  const visibleCount = async () => page.locator('[data-warp-canvas]').count();
  await page.getByRole('button', { name: /^back$/i }).last().click();
  assert.equal(await visibleCount(), 0);
  await page.getByRole('button', { name: /^front$/i }).last().click();
  assert.equal(await visibleCount(), 2);
  await page.locator('[data-warp-canvas]').first().click({ force: true });
  await page.getByRole('button', { name: 'Warp', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Warp', exact: true }).click();
  assert.equal(await page.locator('[data-warp-canvas]').count(), 1);
  assert(await page.locator('[data-handles]').count() > 0, 'Exiting Warp must restore standard transform controls');
  assert(await page.locator('[data-inline-toolbar]').count() > 0, 'Exiting Warp must restore the floating toolbar');

  await page.getByRole('button', { name: 'Typography', exact: true }).click();
  await page.getByPlaceholder('Type, then add').fill('WARP TEXT');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Warp', exact: true }).click();
  const textCanvas = page.locator('[data-warp-canvas]').last();
  await textCanvas.waitFor();
  await page.waitForFunction((selector) => {
    const canvas = document.querySelectorAll(selector);
    const node = canvas[canvas.length - 1];
    return node instanceof HTMLCanvasElement && node.width > 0 && node.height > 0 && node.getContext('2d')?.getImageData(0, 0, node.width, node.height).data.some((value, index) => index % 4 === 3 && value > 0);
  }, '[data-warp-canvas]');

  await page.getByRole('button', { name: 'Images', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload image', exact: true }).click();
  await (await chooser).setFiles({
    name: 'warp-upload.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="48"><path fill="#ee3344" d="M0 0h80v48H0z"/><circle cx="40" cy="24" r="14" fill="#fff"/></svg>'),
  });
  await page.getByRole('button', { name: 'Warp', exact: true }).click();
  const imageCanvas = page.locator('[data-warp-canvas]').last();
  await imageCanvas.waitFor();
  await page.waitForFunction((selector) => {
    const canvases = document.querySelectorAll(selector);
    const node = canvases[canvases.length - 1];
    return node instanceof HTMLCanvasElement && node.getContext('2d')?.getImageData(0, 0, node.width, node.height).data.some((value, index) => index % 4 === 3 && value > 0);
  }, '[data-warp-canvas]');
  assert.deepEqual(errors, []);
  console.log('Passed: warp presets, real-time freeform mesh, live selection bounds, undo/redo, duplication, side retention, reset, text, and uploaded images.');
} finally {
  await browser.close();
}