import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { assetHashes } from './export_hoodie_test.mjs';

const originalAssets = assetHashes();
const directory = '.tmp-hoodie-assembly/measurements-review';
fs.mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/scripts/collar/measurements-review.html`);
  await page.locator('[data-hoodie-measurements-ready]').waitFor();
  const geometry = await page.evaluate(async () => {
    const { buildHoodieMeasurements, sampleMeasurementShape } = await import('/src/app/components/builder/measurementGeometry.ts');
    const { hoodieNeckGeometry } = await import('/src/app/data/hoodieNeckGeometry.ts');
    const { getDefaultGarmentSelection, resolveGarmentLayers } = await import('/src/app/data/garmentSvgCatalog.ts');
    const { HOOD_BUNDLES } = await import('/src/app/data/hoodBundles.ts');
    const records = [];
    for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) for (const bundle of HOOD_BUNDLES) {
      for (const variant of bundle.variants.filter(item => item.fit === fit)) {
        const sources = resolveGarmentLayers({ garmentType: 'hoodie', fit, selection: { ...getDefaultGarmentSelection('hoodie', fit), Hood: variant.views.front.assetId } })
          .map(source => ({ ...source, matrix: 'matrix(1,0,0,1,0,0)' }));
        const snapshot = await buildHoodieMeasurements(sources, fit, 'front', 56);
        if (snapshot.measurements.length !== 12) throw Error(`${fit}/${bundle.styleId}: expected 12 measurements`);
        const hoodSource = sources.find(source => source.id === 'hood');
        const opening = await hoodieNeckGeometry(hoodSource.svgRaw, hoodSource.assetId);
        const hoodHeight = snapshot.measurements.find(measurement => measurement.id === 'hoodHeight');
        const backToFront = snapshot.measurements.find(measurement => measurement.id === 'hoodBackToFrontLength');
        if (hoodHeight.start.y !== opening.openingBounds.minY) throw Error('Hood height must start at the front opening top');
        if (JSON.stringify(backToFront.end) !== JSON.stringify(hoodHeight.start) || backToFront.start.y >= backToFront.end.y) throw Error('Missing rear-to-front hood separation');
        for (const measurement of snapshot.measurements) {
          if (!(measurement.valueCm > 0) || !Number.isFinite(measurement.valueCm)) throw Error(`Invalid dimension ${measurement.id}`);
          if (['pocketHeight', 'waistbandHeight', 'hoodHeight', 'bodyLength'].includes(measurement.id) && measurement.start.x !== measurement.end.x) throw Error(`Diagonal height ${measurement.id}`);
          const source = sources.find(item => item.id === measurement.sourceId);
          const raster = await sampleMeasurementShape(source.svgRaw);
          const { x, y } = measurement.start;
          if (!raster.pixels[(Math.round(y) * 2048 + Math.round(x)) * 4 + 3]) throw Error(`Start off source geometry: ${measurement.id}`);
        }
        const moved = sources.map(source => ({ ...source, matrix: 'matrix(1.1,0,0,1.1,17,-12)' }));
        const transformed = await buildHoodieMeasurements(moved, fit, 'front', 56);
        for (const [index, measurement] of transformed.measurements.entries()) {
          const original = snapshot.measurements[index];
          if (Math.abs(measurement.start.x - (original.start.x * 1.1 + 17)) > .001 || Math.abs(measurement.valueCm - original.valueCm) > .001) throw Error(`Transform not honored: ${measurement.id}`);
        }
        if ((await buildHoodieMeasurements(sources, fit, 'back', 56)).measurements.length) throw Error('Invented back dimensions');
        records.push({ fit, hood: bundle.styleId, construction: variant.frontConstruction, measurements: snapshot.measurements });
      }
    }
    return records;
  });
  assert.equal(geometry.length, 25);
  for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
    const entries = geometry.filter(item => item.fit === fit && item.construction === 'standard');
    assert.equal(new Set(entries.map(item => item.measurements.find(measurement => measurement.id === 'hoodHeight').valueCm.toFixed(2))).size, 3);
    assert.equal(new Set(entries.map(item => JSON.stringify(item.measurements.filter(measurement => measurement.id.startsWith('hood'))))).size, 3);
    await page.getByRole('button', { name: fit[0].toUpperCase() + fit.slice(1), exact: true }).click();
    for (const hood of ['regular', 'deep', 'scuba']) {
      await page.getByLabel('Hood', { exact: true }).selectOption(hood);
      await page.locator(`[data-hoodie-measurements-ready="${fit}"]`).waitFor();
      assert.equal(await page.locator('[data-measurement-row]').count(), 12);
      await page.screenshot({ path: `${directory}/${fit}-${hood}.png` });
    }
  }
  assert.equal(new Set(geometry.filter(item => item.hood === 'regular' && item.construction === 'standard').map(item => JSON.stringify(item.measurements.find(measurement => measurement.id === 'chestWidth').start))).size, 5);
  await page.locator('[data-measurement-row="chestWidth"]').hover();
  assert.equal(await page.locator('[data-measurement-guide="chestWidth"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-measurement-guide="hoodHeight"] foreignObject').hover();
  assert.equal(await page.locator('[data-measurement-row="hoodHeight"]').getAttribute('aria-selected'), 'true');
  const centimetres = Number(await page.getByLabel('Chest width value', { exact: true }).inputValue());
  await page.getByRole('button', { name: 'in', exact: true }).click();
  assert(Math.abs(Number(await page.getByLabel('Chest width value', { exact: true }).inputValue()) - centimetres / 2.54) < .01);
  await page.getByLabel('Chest width tolerance', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'cm', exact: true }).click();
  assert.equal(await page.getByLabel('Chest width tolerance', { exact: true }).inputValue(), '1.27');
  await page.getByLabel('Patch', { exact: true }).check();
  await page.locator('[data-asset-measurement-row]').waitFor();
  assert.equal(await page.locator('[data-measurement-row]').count(), 12);
  await page.locator('[data-asset-measurement-row]').hover();
  assert.equal(await page.locator('[data-asset-measurement]').getAttribute('stroke'), '#FF3B30');
  await page.screenshot({ path: `${directory}/custom-patch.png` });
  await page.getByLabel('View', { exact: true }).selectOption('back');
  assert.equal(await page.locator('[data-measurement-guide], [data-layer-id], [data-measurement-row]').count(), 0);
  await page.getByLabel('View', { exact: true }).selectOption('front');
  await page.locator('[data-hoodie-measurements-ready]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${directory}/mobile-review.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/builder/hd-001`);
  await page.locator('[data-hoodie-measurements-ready]').waitFor();
  assert.equal(await page.locator('[data-measurement-row]').count(), 12);
  await page.getByRole('button', { name: 'Back', exact: true }).filter({ hasNot: page.locator('svg') }).click();
  assert.equal(await page.locator('[data-measurement-guide], [data-layer-id], [data-measurement-row]').count(), 0);
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await page.locator('[data-hoodie-measurements-ready]').waitFor();
  await page.screenshot({ path: `${directory}/builder-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${directory}/builder-mobile.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), originalAssets);
  fs.writeFileSync(`${directory}/geometry.json`, JSON.stringify(geometry, null, 2));
  console.log('PASS: 25 hoodie constructions, 12 geometry dimensions including front hood height and rear-to-front separation, transformed anchors, front/back, units, tolerances, linked hover, custom patch, desktop/mobile, unchanged assets.');
} finally {
  await browser?.close();
  await server.close();
}