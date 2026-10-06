import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';

async function assertSamePixels(actual, expected, label) {
  const decode = url => sharp(Buffer.from(url.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = await decode(actual), b = await decode(expected);
  assert.equal(a.info.width, b.info.width, `${label}: width`);
  assert.equal(a.info.height, b.info.height, `${label}: height`);
  assert(a.data.equals(b.data), `${label}: pixel data must be identical`);
}

const baseUrl = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function testDistress(deviceScaleFactor) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible().catch(() => false); step += 1) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Distressing', exact: true }).click();
  for (const name of ['Holes', 'Abrasion', 'Rips & tears']) await page.getByRole('button', { name, exact: true }).waitFor();
  assert.equal(await page.locator('[data-distress-preview]').count(), 3);
  for (const description of ['Open punctures · frayed edges', 'Faded patches · surface wear', 'Long tears · exposed threads']) {
    await page.getByText(description, { exact: true }).waitFor();
  }
  assert.equal(await page.getByRole('button', { name: 'Holes', exact: true }).getAttribute('aria-pressed'), 'true');

  await page.getByRole('button', { name: 'Rips & tears', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Rips & tears', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Holes', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  assert.equal(await page.locator('[data-distress-preview]').count(), 4);
  await page.getByRole('slider', { name: 'Rip length', exact: true }).waitFor();
  assert.equal(await page.getByRole('slider', { name: 'Edge roughness', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Holes', exact: true }).click();
  await page.getByRole('slider', { name: 'Edge roughness', exact: true }).waitFor();
  assert.equal(await page.getByRole('slider', { name: 'Wear spread', exact: true }).count(), 0);

  const setRange = async (label, value) => page.getByRole('slider', { name: label, exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await setRange('Count', 8);
  await setRange('Size', 6);
  await setRange('Opacity', 52);
  const brushPreview = page.locator('[data-distress-scatter-controls] [data-distress-preview="holes"]');
  assert.equal(await brushPreview.locator('[data-distress-mark]').count(), 8);
  const fabricIds = await page.locator('[data-distress-preview] pattern').evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(new Set(fabricIds).size, 4, 'Every swatch must have its own SVG fabric definition');
  const firstHole = brushPreview.locator('[data-distress-mark] path').first();
  const edgeBefore = await firstHole.getAttribute('d');
  await setRange('Edge roughness', 100);
  assert.notEqual(await firstHole.getAttribute('d'), edgeBefore, 'Edge roughness should visibly change the preview');
  await setRange('Edge roughness', 42);
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Eraser', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-distress-scatter-controls]').count(), 0);
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Brush', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('slider', { name: 'Count', exact: true }).inputValue(), '8');

  const zone = page.locator('[data-print-design-zone]');
  const box = await zone.boundingBox();
  const canvas = page.locator('[data-print-draw-layer]');
  await canvas.waitFor();
  const brushAtChest = async () => page.mouse.move(box.x + box.width * .5, box.y + box.height * .43);
  const assertPreviewMatchesPaint = async (x, y) => {
    await page.mouse.move(x, y);
    const result = await page.evaluate(async ({ x, y }) => {
      const canvas = document.querySelector('[data-print-draw-layer]');
      const swatch = document.querySelector('[data-distress-scatter-controls] [data-distress-preview]');
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const svg = swatch.cloneNode(true);
      svg.querySelectorAll('defs, rect, :scope > path').forEach(node => node.remove());
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
      svg.setAttribute('width', canvas.width);
      svg.setAttribute('height', canvas.height);
      svg.querySelector('g').setAttribute('transform',
        `translate(${(x - rect.left) * scale} ${(y - rect.top) * scale}) scale(${scale}) translate(-80 -48)`);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      await image.decode();
      const expected = document.createElement('canvas');
      expected.width = canvas.width;
      expected.height = canvas.height;
      expected.getContext('2d').drawImage(image, 0, 0);
      const a = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const b = expected.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let error = 0, ink = 0;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] || b[i + 3]) {
          ink++;
          for (let channel = 0; channel < 3; channel++) {
            error += Math.abs(a[i + channel] * a[i + 3] / 255 - b[i + channel] * b[i + 3] / 255);
          }
          error += Math.abs(a[i + 3] - b[i + 3]);
        }
        if (a[i + 3] > 12) {
          const px = i / 4 % canvas.width, py = Math.floor(i / 4 / canvas.width);
          minX = Math.min(minX, px); minY = Math.min(minY, py);
          maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
        }
      }
      const crop = document.createElement('canvas');
      crop.width = maxX - minX + 7;
      crop.height = maxY - minY + 7;
      crop.getContext('2d').drawImage(canvas, minX - 3, minY - 3, crop.width, crop.height, 0, 0, crop.width, crop.height);
      return { error: error / (ink * 4), ink, png: crop.toDataURL() };
    }, { x, y });
    // SVG and Canvas antialias thin fibres differently; allow under 3.2% per-channel error.
    assert(result.ink > 0 && result.error < 8,
      `Settings SVG and actual garment brush must match (mean pixel error ${result.error})`);
    return result.png;
  };
  const previewChecksum = () => canvas.evaluate(node => {
    const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    return Array.from(data).reduce((sum, value, index) => sum + value * ((index % 13) + 1), 0);
  });
  await brushAtChest();
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-print-draw-layer]');
    return node instanceof HTMLCanvasElement && node.getContext('2d').getImageData(0, 0, node.width, node.height).data.some((value, index) => index % 4 === 3 && value > 0);
  });
  const previewBefore = await previewChecksum();
  await setRange('Count', 18);
  await page.waitForFunction((previous) => {
    const node = document.querySelector('[data-print-draw-layer]');
    if (!(node instanceof HTMLCanvasElement)) return false;
    const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    return Array.from(data).reduce((sum, value, index) => sum + value * ((index % 13) + 1), 0) !== previous;
  }, previewBefore);
  await setRange('Count', 8);
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .015);
  assert.equal(await page.getByAltText('Distress', { exact: true }).count(), 0, 'Marks outside garment alpha must be clipped');

  const expectedHoles = await assertPreviewMatchesPaint(box.x + box.width * .5, box.y + box.height * .43);
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .43);
  await page.getByAltText('Distress', { exact: true }).first().waitFor();
  assert.equal(await page.getByAltText('Distress', { exact: true }).first().getAttribute('src'), expectedHoles,
    'Placed holes must be the exact brush preview, not a newly randomized image');
  const distressImages = page.getByAltText('Distress', { exact: true });
  const layerId = index => distressImages.nth(index).evaluate(image => image.closest('[data-print-id]').getAttribute('data-print-id'));
  const firstLayerId = await layerId(0);
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .43);
  assert.equal(await distressImages.count(), 1, 'Repeated passes must accumulate on one layer');
  assert.equal(await layerId(0), firstLayerId, 'Appending must preserve the layer identity');
  assert.notEqual(await distressImages.first().getAttribute('src'), expectedHoles, 'Repeated passes must build up the existing pixels');
  const combinedHoles = await distressImages.first().getAttribute('src');
  const addLayer = page.getByRole('button', { name: 'Add new distress layer', exact: true });
  await addLayer.click();
  assert.equal(await distressImages.count(), 1, 'New layers should materialize on the first painted mark, not create empty artwork');
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .43);
  await distressImages.nth(1).waitFor();
  assert.notEqual(await layerId(1), firstLayerId);
  assert.equal(await distressImages.first().getAttribute('src'), combinedHoles, 'A new layer must leave the old layer untouched');
  assert.equal(await distressImages.nth(1).getAttribute('src'), expectedHoles);
  await page.getByRole('button', { name: 'Abrasion', exact: true }).click();
  await addLayer.click();
  const expectedAbrasion = await assertPreviewMatchesPaint(Math.round(box.x + box.width * .53), Math.round(box.y + box.height * .44));
  await page.mouse.click(Math.round(box.x + box.width * .53), Math.round(box.y + box.height * .44));
  await page.getByAltText('Distress', { exact: true }).nth(2).waitFor();
  await assertSamePixels(await page.getByAltText('Distress', { exact: true }).nth(2).getAttribute('src'), expectedAbrasion, 'Placed abrasion matches preview');
  await page.getByRole('button', { name: 'Rips & tears', exact: true }).click();
  await addLayer.click();
  const expectedRips = await assertPreviewMatchesPaint(Math.round(box.x + box.width * .47), Math.round(box.y + box.height * .45));
  await page.mouse.click(Math.round(box.x + box.width * .47), Math.round(box.y + box.height * .45));
  await page.getByAltText('Distress', { exact: true }).nth(3).waitFor();
  await assertSamePixels(await page.getByAltText('Distress', { exact: true }).nth(3).getAttribute('src'), expectedRips, 'Placed rips match preview');
  const images = await page.getByAltText('Distress', { exact: true }).evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
  assert.equal(images[0], combinedHoles);
  assert.equal(images[1], expectedHoles);
  assert.equal(images.length, 4, 'Only explicit new-layer actions should separate distress passes');
  const currentLayerId = await layerId(3);
  await page.getByRole('button', { name: 'Abrasion', exact: true }).click();
  await page.mouse.click(Math.round(box.x + box.width * .56), Math.round(box.y + box.height * .5));
  assert.equal(await distressImages.count(), 4, 'Changing texture must keep painting on the same layer');
  assert.equal(await layerId(3), currentLayerId);
  const mixedTexture = await distressImages.nth(3).getAttribute('src');
  assert.notEqual(mixedTexture, images[3]);
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.mouse.click(Math.round(box.x + box.width * .56), Math.round(box.y + box.height * .5));
  assert.equal(await distressImages.count(), 4, 'Temporarily selecting artwork must not create a new distress layer');
  assert.equal(await layerId(3), currentLayerId);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await distressImages.nth(3).getAttribute('src'), mixedTexture, 'Undo must remove only the latest pass');
  await distressImages.nth(3).evaluate(image => image.decode());
  await page.mouse.click(Math.round(box.x + box.width * .56), Math.round(box.y + box.height * .54));
  assert.equal(await distressImages.count(), 4, 'Painting after undo must retain the active layer');
  assert.equal(await layerId(3), currentLayerId);
  const beforeErase = await distressImages.nth(3).getAttribute('src');
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await page.mouse.click(Math.round(box.x + box.width * .47), Math.round(box.y + box.height * .45));
  await page.waitForFunction(previous => document.querySelectorAll('img[alt="Distress"]')[3]?.getAttribute('src') !== previous, beforeErase);
  await distressImages.nth(3).evaluate(image => image.decode());
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.mouse.click(Math.round(box.x + box.width * .56), Math.round(box.y + box.height * .57));
  assert.equal(await distressImages.count(), 4, 'Painting after erasing must retain the active layer');
  assert.equal(await layerId(3), currentLayerId);
  const frontContents = await distressImages.evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
  const frontButton = page.getByRole('button', { name: 'Front', exact: true });
  await frontButton.locator('..').getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal(await distressImages.count(), 0);
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .43);
  await distressImages.first().waitFor();
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .43);
  assert.equal(await distressImages.count(), 1, 'The reverse side must have its own shared layer');
  await addLayer.click();
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .43);
  assert.equal(await distressImages.count(), 2);
  await frontButton.click();
  assert.deepEqual(await distressImages.evaluateAll(nodes => nodes.map(node => node.getAttribute('src'))), frontContents);
  await page.mouse.click(Math.round(box.x + box.width * .56), Math.round(box.y + box.height * .57));
  assert.equal(await distressImages.count(), 4, 'A new back layer must not reset the active front layer');
  assert.equal(await layerId(3), currentLayerId);
  assert.notEqual(images[0], images[2]);
  assert.notEqual(images[2], images[3]);
  const png = Buffer.from(images[0].split(',')[1], 'base64');
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let alpha = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 8) alpha += 1;
  assert(alpha > 0 && info.width > 1 && info.height > 1);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Holes', 'Abrasion', 'Rips & tears']) {
    const card = page.getByRole('button', { name, exact: true });
    await card.scrollIntoViewIfNeeded();
    const bounds = await card.boundingBox();
    assert(bounds && bounds.width >= 200 && bounds.x >= 0 && bounds.x + bounds.width <= 390,
      `${name} should remain readable without horizontal overflow on mobile`);
  }
  await page.getByRole('button', { name: 'Abrasion', exact: true }).click();
  await page.getByRole('slider', { name: 'Wear spread', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
  console.log(`Passed (DPR ${deviceScaleFactor}): responsive distress controls, exact preview placement, clipping, shared layers, and explicit new layers.`);
}
try {
  for (const scale of [1, 2]) await testDistress(scale);
} finally {
  await browser.close();
}