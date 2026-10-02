import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { assetHashes } from './export_hoodie_test.mjs';

const protectedAssets = assetHashes();
const server = await createServer({ server: { host: '127.0.0.1', port: 5190, strictPort: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/builder/hd-001`);
  for (let step = 0; step < 6; step++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('[data-wash-panel]').waitFor();
  const sources = () => page.locator('[data-layer-id] > div > div:first-child').evaluateAll(nodes => nodes.map(node => node.innerHTML));
  const before = await sources();
  assert.equal(await page.locator('[data-wash-layer]').count(), 0);
  assert.equal(await page.getByRole('combobox', { name: 'Wash region', exact: true }).locator('option').count(), 7);
  await page.getByRole('combobox', { name: 'Wash style', exact: true }).selectOption('vintage');
  assert.equal(await page.locator('[data-wash-layer]').count(), 8);
  assert.deepEqual(await sources(), before);
  const washMarkup = () => page.locator('[data-wash-layer]').evaluateAll(nodes => nodes.map(node => node.outerHTML));
  await page.getByRole('spinbutton', { name: 'Pattern seed', exact: true }).fill('321');
  const seeded = await washMarkup();
  await page.getByRole('button', { name: 'Randomize pattern', exact: true }).click();
  assert.notDeepEqual(await washMarkup(), seeded);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await washMarkup(), seeded);
  await page.getByRole('button', { name: 'Show wash', exact: true }).click();
  assert.equal(await page.locator('[data-wash-layer]').count(), 0);
  await page.getByRole('button', { name: 'Show wash', exact: true }).click();
  assert.deepEqual(await washMarkup(), seeded);
  await page.getByRole('combobox', { name: 'Wash region', exact: true }).selectOption('hood');
  await page.getByRole('checkbox', { name: 'Override global wash', exact: true }).check();
  await page.getByRole('combobox', { name: 'Wash style', exact: true }).selectOption('none');
  assert.equal(await page.locator('[data-wash-layer="hood"]').count(), 0);
  assert.equal(await page.locator('[data-wash-layer]').count(), 7);
  await page.getByRole('checkbox', { name: 'Override global wash', exact: true }).uncheck();
  assert.deepEqual(await washMarkup(), seeded);
  await page.getByRole('combobox', { name: 'Wash region', exact: true }).selectOption('global');
  await page.getByRole('combobox', { name: 'Wash placement', exact: true }).selectOption('custom');
  const canvas = page.locator('[data-wash-editor]');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .38, bounds.y + bounds.height * .5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .62, bounds.y + bounds.height * .6, { steps: 8 });
  await page.mouse.up();
  const painted = await washMarkup();
  assert.equal(await page.locator('[data-wash-layer="base"] [data-wash-stroke]').count(), 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.locator('[data-wash-stroke]').count(), 0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.deepEqual(await washMarkup(), painted);
  await page.getByRole('checkbox', { name: 'Mirror new marks', exact: true }).check();
  await page.getByRole('button', { name: 'Erase wash', exact: true }).click();
  await page.mouse.move(bounds.x + bounds.width * .45, bounds.y + bounds.height * .55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .55, { steps: 3 });
  await page.mouse.up();
  assert.equal(await page.locator('[data-wash-layer="base"] [data-wash-stroke="1"][stroke="black"]').count(), 2);
  const erased = await washMarkup();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await canvas.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  assert.deepEqual(await washMarkup(), erased);
  await page.getByRole('checkbox', { name: 'Mirror new marks', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Shape wash', exact: true }).click();
  await page.getByRole('combobox', { name: 'Wash shape', exact: true }).selectOption('band');
  await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .65);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .8, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.locator('[data-wash-layer="base"] linearGradient').count(), 1);
  const shaped = await washMarkup();
  await page.getByRole('button', { name: 'Reset wash', exact: true }).click();
  assert.equal(await page.locator('[data-wash-layer]').count(), 0);
  assert.deepEqual(await sources(), before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await washMarkup(), shaped);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.locator('[data-wash-layer]').count(), 0);
  const directory = '.tmp-hoodie-assembly/wash-review';
  fs.mkdirSync(directory, { recursive: true });
  await page.getByRole('combobox', { name: 'Wash style', exact: true }).selectOption('vintage');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const controls = page.locator('[data-wash-panel] select');
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width, `${width}: control overflow`);
    }
    await page.getByRole('combobox', { name: 'Wash region', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/controls-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: wash controls, eight layers, six regions, seeded history, before/after, overrides, brush/shape gestures, Reset/Undo/Redo, unchanged base colours and mobile bounds.');
  const results = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const { defaultGarmentWash, washSvg, washSource } = await import('/src/app/data/garmentWash.ts');
    const { getHoodBundleAsset } = await import('/src/app/data/hoodBundles.ts');
    const raster = async source => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 512, 512);
      return context.getImageData(0, 0, 512, 512).data;
    };
    const results = [];
    for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
      const assets = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit);
      const tested = new Set();
      for (const asset of assets) {
        const descriptor = getHoodBundleAsset(asset.id);
        const label = `${fit}/${descriptor.bundle.styleId}/${descriptor.variant.frontConstruction}`;
        const layers = catalog.resolveGarmentLayers({ garmentType: 'hoodie', fit,
          selection: { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: asset.id } });
        for (const layer of layers.filter(layer => layer.kind === 'solid')) {
          if (tested.has(layer.svgRaw)) continue;
          tested.add(layer.svgRaw);
          const wash = { ...defaultGarmentWash(), type: 'vintage', intensity: 100, blend: 100 };
          const bounds = { minX: 0, minY: 0, maxX: 2048, maxY: 2048 };
          const svg = washSvg(layer.svgRaw, '#345678', bounds, layer.id, wash, 'front', 'test');
          if (svg !== washSvg(layer.svgRaw, '#345678', bounds, layer.id, JSON.parse(JSON.stringify(wash)), 'front', 'test')) throw Error(`${label}: not deterministic`);
          const mask = await raster(washSource(layer.svgRaw));
          const effect = await raster('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
          let painted = 0;
          let bleed = 0;
          let ink = 0;
          for (let offset = 0; offset < mask.length; offset += 4) {
            if (effect[offset + 3] > 0) painted++;
            if (effect[offset + 3] > 1 && mask[offset + 3] === 0) bleed++;
            if (effect[offset + 3] > 1 && mask[offset] === 0 && mask[offset + 3] === 255) ink++;
          }
          if (painted < 10 || bleed || ink) throw Error(`${label}/${layer.id}: ${JSON.stringify({ painted, bleed, ink })}`);
          results.push({ label, layer: layer.id, painted });
        }
      }
    }
    return results;
  });
  assert(results.length >= 50);
  await page.evaluate(async () => {
    const React = await import('/node_modules/.vite/deps/react.js');
    const { createRoot } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { flushSync } = await import('/node_modules/.vite/deps/react-dom.js');
    const { TshirtSvgPreview } = await import('/src/app/components/builder/TshirtSvgPreview.tsx');
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const { defaultGarmentWash } = await import('/src/app/data/garmentWash.ts');
    const { getHoodBundleAsset } = await import('/src/app/data/hoodBundles.ts');
    document.getElementById('root').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'wash-review';
    host.style.cssText = 'width:640px;height:640px;background:white;';
    document.body.append(host);
    const root = createRoot(host);
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.renderWashReview = async (fit, family, construction, visible, roundTrip = false) => {
      const hood = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit).find(asset => {
        const descriptor = getHoodBundleAsset(asset.id);
        return descriptor.bundle.styleId === family && descriptor.variant.frontConstruction === construction;
      });
      const props = { garmentType: 'hoodie', fit, color: '#445957', hoodieAssemblyVersion: 1,
        selection: { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: hood.id },
        partColors: { hood: '#5c6678', sleeveLeft: '#477364', sleeveRight: '#477364', sleeveHemLeft: '#30453e', sleeveHemRight: '#30453e', bodyHem: '#30453e', pocket: '#83505b' },
        hoodieStitching: { global: { style: 'double', color: '#f4d474' } },
        hoodieWash: { global: { ...defaultGarmentWash(), type: 'mineral', placement: 'full', intensity: 85, blend: 90, tone: 70, seed: 321 }, regions: {} },
        showWash: visible };
      flushSync(() => root.render(React.createElement(TshirtSvgPreview, roundTrip ? JSON.parse(JSON.stringify(props)) : props)));
      await frames();
    };
  });
  const variants = [['regular', 'standard'], ['regular', 'crossover'], ['oversized-deep', 'standard'], ['oversized-deep', 'crossover'], ['scuba', 'standard']];
  const fits = ['slim', 'regular', 'boxy', 'cropped', 'baggy'];
  for (const fit of fits) {
    const tiles = [];
    for (const [index, [family, construction]] of variants.entries()) {
      const render = (visible, roundTrip = false) => page.evaluate(async args => window.renderWashReview(...args), [fit, family, construction, visible, roundTrip]);
      await render(false);
      await page.locator('#wash-review [data-stitch-ready="true"]').waitFor();
      const source = await sources();
      const stitchMarkup = () => page.locator('#wash-review [data-hoodie-stitches]').evaluateAll(nodes => nodes.map(node => node.outerHTML));
      const stitches = await stitchMarkup();
      const clean = await page.locator('#wash-review').screenshot();
      await render(true);
      assert.deepEqual(await sources(), source, `${fit}/${family}/${construction}: base colours changed`);
      assert.deepEqual(await stitchMarkup(), stitches, 'Wash must not mutate stitches');
      assert.equal(await page.locator('#wash-review [data-wash-layer]').count(), 8);
      const finished = await page.locator('#wash-review').screenshot();
      const cleanPixels = await sharp(clean).removeAlpha().raw().toBuffer();
      const finishPixels = await sharp(finished).removeAlpha().raw().toBuffer();
      let changed = 0;
      for (let offset = 0; offset < cleanPixels.length; offset += 3) {
        if (Math.abs(cleanPixels[offset] - finishPixels[offset]) > 4) changed++;
      }
      assert(changed > 200, `${fit}/${family}/${construction}: blank wash`);
      const markup = await page.locator('#wash-review [data-wash-layer]').evaluateAll(nodes => nodes.map(node => node.outerHTML));
      await render(true, true);
      assert.deepEqual(await page.locator('#wash-review [data-wash-layer]').evaluateAll(nodes => nodes.map(node => node.outerHTML)), markup, 'Restored preview must match');
      const label = Buffer.from(`<svg width="640" height="36"><rect width="640" height="36" fill="white"/><text x="12" y="24" font-size="17">${fit} / ${family} / ${construction}: before | after</text></svg>`);
      const tile = await sharp({ create: { width: 640, height: 356, channels: 4, background: '#fff' } }).composite([
        { input: label, left: 0, top: 0 },
        { input: await sharp(clean).resize(320).png().toBuffer(), left: 0, top: 36 },
        { input: await sharp(finished).resize(320).png().toBuffer(), left: 320, top: 36 },
      ]).png().toBuffer();
      fs.writeFileSync(`${directory}/${fit}-${family}-${construction}.png`, finished);
      tiles.push({ input: tile, left: 0, top: index * 356 });
    }
    await sharp({ create: { width: 640, height: variants.length * 356, channels: 4, background: '#fff' } }).composite(tiles).png().toFile(`${directory}/${fit}-comparison.png`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), protectedAssets);
  console.log(`PASS: ${results.length} unique fabric masks across five fits and all supported hood constructions; seeded JSON round trips, no exterior or ink bleed, unchanged assets.`);
  console.log(`PASS: 25 assembled previews, preserved part colours/stitches, nonblank wash and restored-state equality. Review images: ${directory}`);
} finally {
  await browser?.close();
  await server.close();
}