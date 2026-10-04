import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { assetHashes } from './export_hoodie_test.mjs';

const protectedAssets = assetHashes();
const directory = '.tmp-hoodie-assembly/neck-geometry-review';
fs.mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/scripts/collar/neck-review.html`, { waitUntil: 'domcontentloaded' });
  const metadata = await page.evaluate(async () => {
    const { hoodieNeckGeometry } = await import('/src/app/data/hoodieNeckGeometry.ts');
    const { HOOD_BUNDLES } = await import('/src/app/data/hoodBundles.ts');
    const { resolveGarmentLayers, getDefaultGarmentSelection } = await import('/src/app/data/garmentSvgCatalog.ts');
    const { hoodieNeckLabelPlacement } = await import('/src/app/data/hoodieLabels.ts');
    const { createGarmentLabel } = await import('/src/app/data/garmentLabels.ts');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2048;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = async source => {
      const image = new Image(); image.src = source; await image.decode();
      context.clearRect(0, 0, 2048, 2048); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, 2048, 2048).data;
    };
    const results = [];
    for (const bundle of HOOD_BUNDLES) for (const variant of bundle.variants) {
      const assetId = variant.views.front.assetId;
      const selection = { ...getDefaultGarmentSelection('hoodie', variant.fit), Hood: assetId };
      const layer = resolveGarmentLayers({ garmentType: 'hoodie', fit: variant.fit, selection }).find(candidate => candidate.id === 'hood');
      const region = await hoodieNeckGeometry(layer.svgRaw, assetId);
      const opening = await pixels(region.hoodOpeningMask);
      const surface = await pixels(region.innerBackNeck);
      const front = await pixels(region.frontOcclusionMask);
      const reveal = surface;
      const rear = await pixels(region.rearHoodMask);
      const blocking = await pixels(region.blockingFrontMask);
      let visible = 0;
      for (let offset = 3; offset < surface.length; offset += 4) {
        if ((opening[offset] || reveal[offset]) && !surface[offset]) throw Error(`${assetId}: unfilled opening`);
        if (opening[offset] + front[offset] !== 255 || rear[offset] + blocking[offset] !== 255) throw Error(`${assetId}: partition gap or overlap`);
        visible += Boolean(surface[offset]);
      }
      if (visible < 500) throw Error(`${assetId}: empty surface`);
      const { hoodieNecklineLandmarks } = await import('/src/app/data/hoodieAuthoredSeams.ts');
      const neckline = hoodieNecklineLandmarks(variant.fit);
      if (region.seamY < neckline.sideY || region.seamY >= neckline.frontY) throw Error(`${assetId}: anchor is not at back neckline`);
      const defaultLabel = createGarmentLabel('neck');
      const attached = hoodieNeckLabelPlacement(defaultLabel, region, 1100);
      let total = 0, normalVisible = 0, revealVisible = 0;
      for (let row = Math.ceil(attached.y - attached.halfHeight); row < attached.y + attached.halfHeight; row++) {
        for (let column = Math.ceil(attached.x - attached.halfWidth); column < attached.x + attached.halfWidth; column++) {
          const offset = (row * 2048 + column) * 4 + 3;
          total++;
          normalVisible += Boolean(opening[offset]);
          revealVisible += Boolean(reveal[offset]);
          if (!surface[offset]) throw Error(`${assetId}: label is outside interior fabric`);
        }
      }
      if (normalVisible / total > .35) throw Error(`${assetId}: front label too visible (${normalVisible / total})`);
      if (region.hoodStyle === 'scuba' && normalVisible) throw Error(`${assetId}: scuba exterior must cover neck attachment`);
      if (revealVisible !== total) throw Error(`${assetId}: inspection must expose the label at its existing anchor`);
      const care = { ...createGarmentLabel('care'), position: 'neck-inside' };
      const carePlacement = hoodieNeckLabelPlacement(care, region, 1100);
      if (!carePlacement || carePlacement.scale !== 1 || Math.abs(carePlacement.height - 220) > .001) throw Error(`${assetId}: care label was shrunk to force visibility`);
      if (carePlacement.y - carePlacement.halfHeight < region.seamY) throw Error(`${assetId}: care label is above its attachment`);
      for (const rotation of [-10, 0, 10]) {
        const label = { ...createGarmentLabel('neck'), widthMm: 50, heightMm: 22, rotation, offsetXmm: 100, offsetYmm: -100 };
        const placement = hoodieNeckLabelPlacement(label, region, 1100);
        if (!placement || placement.x - placement.halfWidth < region.bounds.minX - .001
          || placement.x + placement.halfWidth > region.bounds.maxX + .001
          || placement.y - placement.halfHeight < region.bounds.minY - .001
          || placement.y + placement.halfHeight > region.bounds.maxY + .001) throw Error(`${assetId}: unsafe placement`);
      }
      const { hoodOpeningMask, innerBackNeck, frontOcclusionMask, rearHoodMask, blockingFrontMask, ...record } = region;
      results.push({ ...record, normalVisibility: normalVisible / total, revealVisibility: revealVisible / total });
    }
    return results;
  });
  assert.equal(metadata.length, 25);
  fs.writeFileSync(`${directory}/metadata.json`, JSON.stringify(metadata, null, 2));
  if (process.argv.includes('--geometry-only')) {
    assert.deepEqual(assetHashes(), protectedAssets);
    console.log('PASS: 25 neckline anchors, native front/rear masks and inspection surfaces.');
    process.exitCode = 0;
  } else {
  await page.getByLabel('Debug overlays', { exact: true }).uncheck();
  await page.getByLabel('Interior neck', { exact: true }).uncheck();
  const ids = ['regular', 'deep', 'regular-crossover', 'deep-crossover', 'scuba'];
  const rawPixels = image => sharp(image).removeAlpha().raw().toBuffer();
  const compare = (actual, expected) => {
    assert.equal(actual.length, expected.length);
    let changed = 0, maximum = 0;
    for (let offset = 0; offset < actual.length; offset++) {
      const delta = Math.abs(actual[offset] - expected[offset]);
      maximum = Math.max(maximum, delta);
      changed += delta > 3;
    }
    return { changed, maximum };
  };
  for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
    await page.getByLabel('Fit', { exact: true }).selectOption(fit);
    await page.getByLabel('Neck label', { exact: true }).check();
    await page.waitForFunction(fit => [...document.querySelectorAll('[data-inner-back-neck-surface]')].filter(node => {
      const id = node.getAttribute('data-inner-back-neck-surface');
      return fit === 'boxy' ? !id.includes('(') : id.endsWith(`(${fit})`);
    }).length === 5, fit);
    const labeled = new Map();
    for (const id of ids) labeled.set(id, await rawPixels(await page.locator(`#${id} .viewport`).screenshot()));
    await page.locator('[data-hoodie-neck-context]').evaluateAll(nodes => nodes.forEach(node => { node.style.visibility = 'hidden'; }));
    const partitioned = new Map();
    for (const id of ids) partitioned.set(id, await rawPixels(await page.locator(`#${id} .viewport`).screenshot()));
    await page.getByLabel('Neck label', { exact: true }).uncheck();
    for (const id of ids) {
      const native = await rawPixels(await page.locator(`#${id} .viewport`).screenshot());
      const difference = compare(partitioned.get(id), native);
      assert(difference.changed === 0, `${fit}/${id}: native exterior changed ${JSON.stringify(difference)}`);
      assert(compare(labeled.get(id), native).changed < 150, `${fit}/${id}: front label is overly exposed`);
    }
    await page.locator('[data-hoodie-neck-context]').evaluateAll(nodes => nodes.forEach(node => { node.style.visibility = ''; }));
    await page.getByLabel('Interior neck', { exact: true }).check();
    await page.getByLabel('Neck label', { exact: true }).check();
    await page.locator('[data-garment-label]').nth(4).waitFor({ state: 'attached' });
    for (const id of ids) {
      const proof = page.locator(`#${id}`);
      await proof.locator('.camera').evaluate(node => node.style.transition = 'none');
      const attached = await rawPixels(await proof.locator('.viewport').screenshot());
      await proof.locator('[data-hoodie-neck-context]').evaluate(node => { node.style.visibility = 'hidden'; });
      const uncovered = await rawPixels(await proof.locator('.viewport').screenshot());
      const difference = compare(attached, uncovered);
      assert(difference.changed > 5, `${fit}/${id}: inspection label is not visible ${JSON.stringify(difference)}`);
      await proof.locator('[data-hoodie-neck-context]').evaluate(node => { node.style.visibility = ''; });
      await proof.screenshot({ path: `${directory}/${fit}-${id}-inspection.png` });
    }
    await page.getByLabel('Interior neck', { exact: true }).uncheck();
    console.log(`PASS: ${fit}, covered exterior labels and editable interior labels including Scuba`);
  }
  await page.getByLabel('Fit', { exact: true }).selectOption('boxy');
  await page.getByLabel('Neck label', { exact: true }).check();
  await page.getByLabel('Interior neck', { exact: true }).check();
  await page.locator('[data-hoodie-neck-context]').nth(4).waitFor();
  for (const printed of [false, true]) {
    await page.getByLabel('Printed', { exact: true }).setChecked(printed);
    for (const id of ids) await page.locator(`#${id}`).screenshot({ path: `${directory}/${id}-${printed ? 'printed' : 'sewn'}.png` });
  }
  await page.getByLabel('Printed', { exact: true }).uncheck();
  await page.getByLabel('Care label at neck', { exact: true }).check();
  for (const interior of [false, true]) {
    await page.getByLabel('Interior neck', { exact: true }).setChecked(interior);
    for (const id of ids) {
      const proof = page.locator(`#${id}`);
      const care = proof.locator(`[data-garment-label="${id}-care"]`);
      await care.waitFor({ state: 'attached' });
      assert.equal(await proof.locator('[data-layer-id="base"] [data-garment-label]').count(), 0, 'Neck care must not render on the body front');
      const labeled = await rawPixels(await proof.locator('.viewport').screenshot());
      await proof.locator('[data-hoodie-neck-context]').evaluate(node => { node.style.visibility = 'hidden'; });
      const hidden = await rawPixels(await proof.locator('.viewport').screenshot());
      const difference = compare(labeled, hidden);
      assert(interior ? difference.changed > 5 : difference.changed === 0, `${id}: care occlusion in ${interior ? 'inspection' : 'front'} view`);
      await proof.locator('[data-hoodie-neck-context]').evaluate(node => { node.style.visibility = ''; });
      await proof.screenshot({ path: `${directory}/${id}-care-${interior ? 'inspection' : 'front'}.png` });
    }
  }
  await page.getByLabel('Care label at neck', { exact: true }).uncheck();
  await page.getByLabel('Compare views', { exact: true }).check();
  await page.locator('[data-neck-inspection="front-suppressed"]').nth(4).waitFor();
  for (const id of ids) {
    const exterior = page.locator(`#${id}-exterior [data-attachment-layer="innerBackNeck"]`);
    const interior = page.locator(`#${id}-interior [data-attachment-layer="innerBackNeck"]`);
    assert.equal(await exterior.getAttribute('transform'), await interior.getAttribute('transform'), `${id}: inspection moved label`);
    await page.locator(`[data-comparison="${id}"]`).screenshot({ path: `${directory}/${id}-comparison.png` });
  }
  assert.equal(await page.locator('[data-interior-reveal]').count(), 0);
  await page.getByLabel('Compare views', { exact: true }).uncheck();
  await page.getByLabel('Debug overlays', { exact: true }).check();
  await page.locator('[data-neck-debug]').nth(4).waitFor();
  for (const id of ids) await page.locator(`#${id}`).screenshot({ path: `${directory}/${id}-debug.png` });
  await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
  assert.equal(await page.locator('[data-inner-back-neck-panel], [data-back-neck-occluder], [data-neck-error]').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), protectedAssets);
  console.log('PASS: 25 SVG-derived masks; 75 constrained placements; unchanged approved assets; desktop/mobile review captures.');
  }
} finally {
  await browser?.close();
  await server.close();
}