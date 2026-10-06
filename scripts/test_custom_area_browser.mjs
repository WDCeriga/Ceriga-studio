import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible().catch(() => false); step += 1) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Shapes and lines', exact: true }).click();
  await page.getByRole('button', { name: 'Custom Area', exact: true }).click();

  const zone = page.locator('[data-print-design-zone]');
  let zoneBox = await zone.boundingBox();
  const clickAt = async (x, y, pointCount) => {
    await page.mouse.click(zoneBox.x + zoneBox.width * x, zoneBox.y + zoneBox.height * y);
    if (pointCount) await page.locator(`[data-print-design-zone] > svg[aria-label="Custom Area in progress"] circle:nth-of-type(${pointCount})`).waitFor();
  };
  await clickAt(.25, .3, 1);
  await clickAt(.7, .3, 2);
  await clickAt(.68, .52, 3);
  assert.equal(await page.locator('[data-print-design-zone] > svg[aria-label="Custom Area in progress"] circle').count(), 3);
  await clickAt(.25, .3);
  await page.getByRole('textbox', { name: 'Custom Area name' }).waitFor();
  const closedPoints = await page.locator('[data-custom-area-point]').count();
  assert.equal(closedPoints, 3, 'Closed area must show three anchors');
  assert.equal(await page.getByRole('button', { name: 'Done Editing Path' }).getAttribute('aria-pressed'), 'true');

  await page.getByRole('button', { name: 'Open colour picker' }).nth(1).click();
  await page.getByLabel('Paint type').selectOption('radial');
  assert.equal(await page.locator('[data-custom-area-svg] radialGradient').count(), 1);
  await page.getByLabel('Custom Area pattern').selectOption('checks');
  assert.equal(await page.locator('[data-custom-area-svg] pattern rect').count(), 2);
  const setRange = async (label, value) => page.getByRole('slider', { name: label, exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await setRange('Opacity', 70);
  await setRange('Grain', 35);
  assert.equal(await page.getByRole('slider', { name: 'Opacity', exact: true }).inputValue(), '70');
  assert.equal(await page.getByRole('slider', { name: 'Grain', exact: true }).inputValue(), '35');

  const imageFill = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#16a085"/></svg>';
  await page.getByLabel('Custom Area image fill').setInputFiles({
    name: 'area-fill.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(imageFill),
  });
  await page.locator('[data-custom-area-svg] image').waitFor();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('[data-custom-area-svg] image').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.locator('[data-custom-area-svg] image').waitFor();

  await page.getByRole('button', { name: 'Add Point', exact: true }).click();
  zoneBox = await zone.boundingBox();
  await page.mouse.click(zoneBox.x + zoneBox.width * .1, zoneBox.y + zoneBox.height * .8);
  await page.locator('[data-custom-area-point="3"]').waitFor();
  assert.equal(await page.locator('[data-custom-area-point]').count(), 4);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('[data-custom-area-point="3"]').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.locator('[data-custom-area-point="3"]').waitFor();
  await page.getByRole('button', { name: 'Delete Point', exact: true }).click();
  await page.locator('[data-custom-area-point="3"]').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('[data-custom-area-point="3"]').waitFor();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.locator('[data-custom-area-point="3"]').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Add Point', exact: true }).click();
  zoneBox = await zone.boundingBox();
  await page.mouse.click(zoneBox.x + zoneBox.width * .12, zoneBox.y + zoneBox.height * .76);
  await page.locator('[data-custom-area-point="3"]').waitFor();

  const area = page.locator('[data-print-id]').filter({ has: page.locator('[data-custom-area-svg]') });
  const beforeMove = await area.boundingBox();
  const point = await page.locator('[data-custom-area-point="1"]').boundingBox();
  await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
  await page.mouse.down();
  await page.mouse.move(zoneBox.x + zoneBox.width * .93, zoneBox.y + zoneBox.height * .9, { steps: 6 });
  await page.mouse.up();
  const afterMove = await area.boundingBox();
  assert(Math.abs(beforeMove.width - afterMove.width) > 1 || Math.abs(beforeMove.height - afterMove.height) > 1,
    'Dragging a point outside the initial bounds must expand the editable area');
  assert.notEqual(await page.locator('[data-custom-area-svg] clipPath path').getAttribute('d'), '');

  await page.getByRole('textbox', { name: 'Custom Area name' }).fill('Chest Panel');
  assert.equal(await page.getByRole('button', { name: /Chest Panel/ }).count(), 1);
  assert(await page.locator('[data-custom-area-svg]').evaluate((node) => getComputedStyle(node).maskImage.startsWith('url(')),
    'Custom Area fill must use a garment-boundary mask');
  await page.getByRole('button', { name: 'Hide Custom Area layer', exact: true }).click();
  assert.equal(await page.locator('[data-custom-area-svg]').count(), 0);
  await page.getByRole('button', { name: 'Show Custom Area layer', exact: true }).click();
  assert.equal(await page.locator('[data-custom-area-svg]').count(), 1);

  await page.getByRole('button', { name: /^back$/i }).last().click();
  assert.equal(await page.locator('[data-custom-area-svg]').count(), 0);
  await page.getByRole('button', { name: /^front$/i }).last().click();
  assert.equal(await page.locator('[data-custom-area-svg]').count(), 1);
  await page.mouse.click(zoneBox.x + zoneBox.width * .97, zoneBox.y + zoneBox.height * .96);
  assert.equal(await page.locator('[data-custom-area-point]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: custom-area creation, fills, garment clipping, point edit/add/delete, undo/redo, visibility, naming, and garment-side isolation.');
} finally {
  await browser.close();
}