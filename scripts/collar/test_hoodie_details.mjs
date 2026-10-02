import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { assetHashes } from './export_hoodie_test.mjs';

const protectedAssets = assetHashes();
const directory = '.tmp-hoodie-assembly/trims-review';
fs.mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = `http://127.0.0.1:${server.httpServer.address().port}/builder/hd-001`;
  await page.goto(url);
  for (let step = 0; step < 5; step++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const sources = () => page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.layerId, style: node.getAttribute('style'), svg: node.querySelector('svg')?.outerHTML,
  })));
  const original = await sources();
  assert.equal(original.length, 8);
  assert(await page.getByTitle('Back editing unavailable: this hoodie pack contains front assets only').isDisabled());
  const target = page.getByRole('combobox', { name: 'Trim attachment layer', exact: true });
  assert.equal(await target.locator('option').count(), 8);
  await page.getByRole('button', { name: 'Add patch', exact: true }).click();
  const detail = () => page.locator('[data-detail-id]').first();
  const style = () => detail().getAttribute('style');
  const patchButton = page.getByRole('button', { name: 'Patch 1 on garment', exact: true });
  const beforeMove = await style();
  const box = await patchButton.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  const moved = await style();
  assert.notEqual(moved, beforeMove);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await style(), beforeMove);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await style(), moved);
  const currentBox = await patchButton.boundingBox();
  await page.mouse.move(currentBox.x + currentBox.width / 2, currentBox.y + currentBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(currentBox.x + currentBox.width / 2 + 15, currentBox.y + currentBox.height / 2);
  await patchButton.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  assert.equal(await style(), moved);
  const height = await detail().evaluate(node => node.style.height);
  await page.getByRole('spinbutton', { name: 'Detail width (%)', exact: true }).fill('25');
  assert.equal(await detail().evaluate(node => node.style.height), height);
  await page.getByRole('spinbutton', { name: 'Detail rotation (deg)', exact: true }).fill('32');
  assert.match(await style(), /rotate\(32deg\)/);
  for (const material of ['embroidered', 'woven', 'chenille', 'pvc', 'leather', 'printed']) {
    await page.getByRole('combobox', { name: 'Patch type', exact: true }).selectOption(material);
    assert.equal(await page.locator('[data-trim-artwork] [data-patch-material]').getAttribute('data-patch-material'), material);
  }
  await page.getByLabel('Patch artwork file').setInputFiles({ name: 'review.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="10" y="10" width="100" height="60" rx="12" fill="#e34a35"/><path d="M30 25H90V55H30Z" fill="#fff"/></svg>') });
  await page.getByRole('button', { name: 'Remove patch artwork', exact: true }).waitFor();
  assert.match(await page.locator('[data-trim-artwork] image').first().getAttribute('href'), /^data:image\/png/);
  for (const attachment of ['hood', 'sleeveLeft', 'sleeveRight', 'sleeveHemLeft', 'sleeveHemRight', 'bodyHem', 'pocket', 'base']) {
    await target.selectOption(attachment);
    assert.equal(await page.locator(`[data-layer-id="${attachment}"] [data-detail-id]`).count(), 1);
  }
  await page.getByRole('button', { name: 'Duplicate Patch 1', exact: true }).click();
  const order = () => page.locator('[data-detail-id]').evaluateAll(nodes => nodes.map(node => node.dataset.detailId));
  const originalOrder = await order();
  await page.getByRole('button', { name: 'Move trim backward', exact: true }).click();
  assert.deepEqual(await order(), [...originalOrder].reverse());
  await page.getByRole('button', { name: 'Move trim forward', exact: true }).click();
  assert.deepEqual(await order(), originalOrder);
  await page.getByRole('button', { name: 'Zips', exact: true }).click();
  await page.getByRole('button', { name: 'Add Zip 01: Classic pull', exact: true }).click();
  await page.getByRole('combobox', { name: 'Zip length preset', exact: true }).selectOption('full');
  assert.deepEqual(await sources(), original);
  const zip = page.locator('[data-detail-variant="zip-01"]');
  const zipHeight = await zip.evaluate(node => node.style.height);
  await page.getByRole('spinbutton', { name: 'Detail width (%)', exact: true }).fill('8');
  assert.equal(await zip.evaluate(node => node.style.height), zipHeight);
  await page.getByRole('spinbutton', { name: 'Detail rotation (deg)', exact: true }).fill('90');
  await page.getByRole('button', { name: 'Pull', exact: true }).click();
  const zipStyle = await zip.getAttribute('style');
  await page.getByRole('slider', { name: 'Zip pull position', exact: true }).fill('55');
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  assert.equal(await zip.getAttribute('style'), zipStyle);
  assert.equal(await page.getByRole('button', { name: 'Select Zip 1 pull', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Hardware', exact: true }).click();
  for (const [number, name] of [['01', 'Snap'], ['02', 'Eyelet'], ['03', 'Rivet']]) {
    await page.getByRole('button', { name: `Add Hardware ${number}: ${name}`, exact: true }).click();
    assert.equal(await page.locator(`[data-detail-variant="hardware-${number}"]`).count(), 1);
  }
  await page.getByRole('button', { name: 'Pockets', exact: true }).click();
  await page.getByRole('button', { name: 'Add Pocket 04: Envelope flap', exact: true }).click();
  assert.deepEqual(await sources(), original);
  const count = await page.locator('[data-detail-id]').count();
  await page.getByRole('button', { name: 'Reset trims', exact: true }).click();
  assert.equal(await page.locator('[data-detail-id]').count(), 0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.locator('[data-detail-id]').count(), count);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.locator('[data-detail-id]').count(), 0);
  await page.getByRole('button', { name: 'Add patch', exact: true }).click();
  await page.getByRole('combobox', { name: 'Patch type', exact: true }).selectOption('chenille');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await target.scrollIntoViewIfNeeded();
    for (const control of await page.locator('[aria-label="Hoodie trims and details"] select').all()) {
      const rect = await control.boundingBox();
      assert(rect && rect.x >= 0 && rect.x + rect.width <= width, `${width}: control overflow`);
    }
    await page.screenshot({ path: `${directory}/controls-${width}.png` });
  }
  console.log('PASS: native pocket/geometry unchanged; eight attachments; move/cancel/Undo/Redo; independent axes; rotation; six patch materials; artwork; zip body/pull; hardware; layer order; Reset; desktop/mobile controls.');

  await page.setViewportSize({ width: 900, height: 900 });
  await page.evaluate(async () => {
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default ?? reactModule;
    const client = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = client.default ?? client;
    const dom = await import('/node_modules/.vite/deps/react-dom.js');
    const { flushSync } = dom.default ?? dom;
    const { TshirtSvgPreview } = await import('/src/app/components/builder/TshirtSvgPreview.tsx');
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const { createGarmentDetail } = await import('/src/app/data/garmentDetails.ts');
    const { defaultGarmentWash } = await import('/src/app/data/garmentWash.ts');
    document.getElementById('root').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'trims-proof';
    host.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:640px;background:white';
    document.body.append(host);
    const root = createRoot(host);
    const patch = { ...createGarmentDetail('patch', [], '#ff0022'), attachment: 'base', x: .5, y: .5, scaleX: 20, scaleY: 20, rotation: 27 };
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.renderTrimsProof = async (fit, hoodId, mode) => {
      const props = { garmentType: 'hoodie', fit, color: '#657e80', hoodieAssemblyVersion: 1,
        selection: { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: hoodId },
        partColors: { hood: '#556a80', pocket: '#c4a84d', bodyHem: '#465a50', sleeveHemLeft: '#465a50', sleeveHemRight: '#465a50' },
        hoodieStitching: { global: { style: 'double', color: '#fff', visible: true } },
        hoodieWash: { global: { ...defaultGarmentWash(), type: 'vintage', intensity: 65 }, regions: {} },
        garmentDetails: mode === 'baseline' ? [] : mode === 'review' ? [{ ...patch, scaleX: 1.2, scaleY: 1, rotation: 0, x: .32, y: .35 }]
          : mode === 'back' ? [{ ...patch, view: 'back' }] : [patch] };
      flushSync(() => root.render(React.createElement(TshirtSvgPreview, mode === 'reload' ? JSON.parse(JSON.stringify(props)) : props)));
      await frames();
    };
    window.nativeTrimMasks = async () => {
      const size = 640;
      const union = document.createElement('canvas'); union.width = union.height = size;
      const upper = document.createElement('canvas'); upper.width = upper.height = size;
      const bodyZ = Number(getComputedStyle(host.querySelector('[data-layer-id="base"]')).zIndex);
      for (const layer of host.querySelectorAll('[data-layer-id]')) {
        const image = new Image();
        image.src = 'data:image/svg+xml,' + encodeURIComponent(layer.querySelector('svg').outerHTML);
        await image.decode();
        const style = getComputedStyle(layer), matrix = new DOMMatrix(style.transform);
        const [originX, originY] = style.transformOrigin.split(' ').map(parseFloat);
        for (const canvas of Number(style.zIndex) > bodyZ ? [union, upper] : [union]) {
          const context = canvas.getContext('2d'); context.save();
          context.translate(originX, originY); context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f); context.translate(-originX, -originY);
          context.drawImage(image, 0, 0, size, size); context.restore();
        }
      }
      return { union: union.toDataURL(), upper: upper.toDataURL() };
    };
  });
  const variants = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    return ['slim', 'regular', 'boxy', 'cropped', 'baggy'].flatMap(fit => catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit).map(asset => ({ fit, id: asset.id })));
  });
  const pixels = async input => sharp(input).ensureAlpha().raw().toBuffer();
  const samePixels = (actual, expected, message) => {
    assert.equal(actual.length, expected.length, message);
    const maximumDelta = actual.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - expected[index])), 0);
    assert(maximumDelta <= 1, `${message}: maximum channel difference ${maximumDelta}`);
  };
  for (const [index, variant] of variants.entries()) {
    const render = mode => page.evaluate(async ({ fit, id, mode }) => window.renderTrimsProof(fit, id, mode), { ...variant, mode });
    await render('baseline');
    await page.locator('#trims-proof [data-stitch-ready="true"]').waitFor();
    const baseline = await pixels(await page.locator('#trims-proof').screenshot());
    const masks = await page.evaluate(() => window.nativeTrimMasks());
    const union = await pixels(Buffer.from(masks.union.split(',')[1], 'base64'));
    const upper = await pixels(Buffer.from(masks.upper.split(',')[1], 'base64'));
    await render('paint');
    const paintedPng = await page.locator('#trims-proof').screenshot();
    const painted = await pixels(paintedPng);
    const artwork = () => page.locator('#trims-proof [data-trim-artwork]').evaluateAll(nodes => nodes.map(node => node.outerHTML));
    const paintedArtwork = await artwork();
    let changed = 0, bleed = 0, overlap = 0;
    for (let offset = 0; offset < baseline.length; offset += 4) {
      const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(baseline[offset + channel] - painted[offset + channel])));
      if (delta < 8) continue;
      changed++;
      if (union[offset + 3] === 0) bleed++;
      if (upper[offset + 3] === 255) overlap++;
    }
    assert(changed > 100, `${variant.id}: no trim rendered`);
    assert.equal(bleed, 0, `${variant.id}: exterior bleed`);
    assert.equal(overlap, 0, `${variant.id}: trim covers an upper native layer`);
    await render('reload');
    assert.deepEqual(await artwork(), paintedArtwork, `${variant.id}: JSON roundtrip changed markup`);
    samePixels(await pixels(await page.locator('#trims-proof').screenshot()), painted, `${variant.id}: JSON roundtrip changed artwork`);
    await render('back');
    samePixels(await pixels(await page.locator('#trims-proof').screenshot()), baseline, `${variant.id}: back detail leaked onto front`);
    await render('review');
    await page.locator('#trims-proof').screenshot({ path: `${directory}/${String(index + 1).padStart(2, '0')}-${variant.fit}.png` });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), protectedAssets);
  console.log(`PASS: ${variants.length} real hoodie variants; pixel-checked silhouette clipping and native-layer occlusion; wash/stitch coexistence; JSON reload; back isolation; source hashes unchanged.`);
  console.log(`Review images: ${directory}`);
} finally {
  await browser?.close();
  await server.close();
}