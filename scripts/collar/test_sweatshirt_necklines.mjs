import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { assetHashes } from './export_hoodie_test.mjs';

const before = assetHashes();
const directory = '.tmp-hoodie-assembly/sweatshirt-necklines';
fs.mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/scripts/collar/sweatshirt-necklines-review.html`);
  await page.locator('[data-case="regular-crew"] [data-layer-id="neck"]').waitFor();
  assert.equal(await page.locator('section[data-case]').count(), 5);
  for (const name of ['boxy-crew', 'boxy-v', 'boxy-deep-v', 'boxy-scoop', 'regular-crew']) {
    await page.locator(`[data-case="${name}"]`).screenshot({ path: `${directory}/${name}.png` });
  }
  const records = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const neck = await import('/src/app/data/hoodieNecklines.ts');
    const { measureHoodieSeams } = await import('/src/app/data/hoodieSeamGeometry.ts');
    const { sampleMeasurementShape, buildHoodieMeasurements } = await import('/src/app/components/builder/measurementGeometry.ts');
    const parser = new DOMParser();
    const result = [];
    for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
      const initial = catalog.getDefaultGarmentSelection('hoodie', fit);
      const original = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection: initial, fit });
      for (const option of neck.SWEATSHIRT_NECKLINES) {
        const selection = neck.selectSweatshirtConstruction(initial, option.id);
        const restored = catalog.applyGarmentFitAndLinks('hoodie', JSON.parse(JSON.stringify(selection)), fit);
        if (restored.NeckConstruction !== option.id) throw Error('Construction lost in snapshot');
        const layers = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection: restored, fit, neckTrimColor: '#a14152' });
        if (layers.some(layer => layer.id === 'hood')) throw Error('Hood stacked');
        const band = layers.find(layer => layer.id === 'neck');
        if (!band || band.tint !== '#a14152') throw Error('Band missing or color lost');
        const svg = parser.parseFromString(band.svgRaw, 'image/svg+xml');
        const donor = parser.parseFromString(neck.sweatshirtDonorRaw(option.id), 'image/svg+xml');
        const pathData = node => Array.from(node.querySelectorAll('path')).map(path => path.getAttribute('d'));
        if (JSON.stringify(pathData(svg.querySelector('g > g'))) !== JSON.stringify(pathData(donor))) throw Error('Default band no longer uses original donor paths');
        for (const layer of original.filter(layer => !['hood', 'base'].includes(layer.id))) {
          if (layers.find(candidate => candidate.id === layer.id)?.svgRaw !== layer.svgRaw) throw Error(`Changed ${layer.id}`);
        }
        const back = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection: neck.selectSweatshirtConstruction(selection, 'hood'), fit });
        if (JSON.stringify(back) !== JSON.stringify(original)) throw Error('Hood return changed original geometry');
        const clean = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection: { ...selection, NeckFinish: 'clean', NeckFinishWidth: '1.4' }, fit }).find(layer => layer.id === 'neck');
        if (clean.svgRaw === band.svgRaw || clean.svgRaw.includes('stroke-opacity=".35"><path')) throw Error('Finish or width ignored');
        if (option.id === 'crew') {
          const seams = await measureHoodieSeams(layers);
          if (!seams.base.seams.length || seams.base.seams.some(seam => seam.region === 'neckline') || seams.hood) throw Error('Wrong hoodless seams');
          const base = layers.find(layer => layer.id === 'base');
          const source = original.find(layer => layer.id === 'base');
          const changed = await sampleMeasurementShape(base.svgRaw);
          const unchanged = await sampleMeasurementShape(source.svgRaw);
          const socket = svg.documentElement.getAttribute('data-socket').split(' ').map(point => point.split(',').map(Number));
          for (let row = 0; row < 2048; row++) for (let column = 0; column < 2048; column++) {
            if (column >= socket[0][0] - 2 && column <= socket[1][0] + 2 && row < 1000) continue;
            const offset = (row * 2048 + column) * 4;
            for (let channel = 0; channel < 4; channel++) if (changed.pixels[offset + channel] !== unchanged.pixels[offset + channel]) throw Error(`${fit}: body changed outside neck socket`);
          }
          const snapshot = await buildHoodieMeasurements(layers.map(layer => ({ ...layer, matrix: 'matrix(1,0,0,1,0,0)' })), fit, 'front', 56);
          if (snapshot.measurements.some(measurement => measurement.id.startsWith('hood'))) throw Error('Hoodless has hood dimensions');
        }
        result.push({ fit, neckline: option.id, socket: svg.documentElement.getAttribute('data-socket') });
      }
    }
    return result;
  });
  assert.equal(records.length, 25);
  fs.writeFileSync(`${directory}/registration.json`, JSON.stringify(records, null, 2));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-case="boxy-crew"]').screenshot({ path: `${directory}/mobile-review.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`${origin}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const construction = page.getByLabel('Neck / Collar', { exact: true });
  await construction.selectOption('crew');
  await page.locator('[data-layer-id="neck"]').waitFor();
  assert.equal(await page.locator('[data-layer-id="hood"]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Regular Hood', exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Ribbed', { exact: true }).isChecked(), true);
  const linkedStyles = () => page.locator('[data-layer-id="base"], [data-layer-id="neck"]').evaluateAll(nodes => nodes.map(node => ({ transform: node.style.transform, origin: node.style.transformOrigin })));
  const registeredStyles = await linkedStyles();
  assert.deepEqual(registeredStyles[0], registeredStyles[1]);
  await page.getByRole('button', { name: 'Select Crew Neck', exact: true }).focus();
  await page.keyboard.press('Enter');
  const handle = await page.getByRole('button', { name: 'Scale', exact: true }).last().boundingBox();
  assert(handle);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 24, handle.y + handle.height / 2 + 18, { steps: 5 });
  await page.mouse.up();
  const editedStyles = await linkedStyles();
  assert.notDeepEqual(editedStyles, registeredStyles, 'Neck selection must edit its linked body');
  assert.deepEqual(editedStyles[0], editedStyles[1], 'Neck must follow body resize');
  await page.getByTitle('Reset position & scale', { exact: true }).click();
  assert.deepEqual(await linkedStyles(), registeredStyles);
  await page.keyboard.press('Control+z');
  assert.deepEqual(await linkedStyles(), editedStyles);
  await page.keyboard.press('Control+Shift+z');
  assert.deepEqual(await linkedStyles(), registeredStyles);
  await page.keyboard.press('Escape');
  await page.getByText('Neck / Collar', { exact: true }).first().click();
  assert.equal(await construction.inputValue(), 'crew');
  await construction.selectOption('v');
  await construction.blur();
  await page.keyboard.press('Control+z');
  assert.equal(await construction.inputValue(), 'crew');
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await construction.inputValue(), 'v');
  await page.getByLabel('Clean', { exact: true }).check();
  for (const fit of ['Slim', 'Regular', 'Boxy', 'Cropped', 'Baggy']) {
    await page.getByRole('button', { name: /^Measurement$/i }).first().click();
    await page.getByRole('button', { name: fit, exact: true }).click();
    await page.getByText('Neck / Collar', { exact: true }).first().click();
    assert.equal(await construction.inputValue(), 'v');
    assert.equal(await page.getByLabel('Clean', { exact: true }).isChecked(), true);
  }
  await construction.selectOption('hood');
  await page.locator('[data-layer-id="hood"]').waitFor();
  assert.equal(await page.locator('[data-layer-id="neck"]').count(), 0);
  await construction.selectOption('deep-v');
  await page.screenshot({ path: `${directory}/builder-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${directory}/builder-mobile.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), before, 'Protected hoodie artwork changed');
  console.log('PASS: 25 registered necklines, original donor paths, unchanged body outside neck, retained parts/seams, snapshots, hood transitions, history, fit persistence, desktop/mobile review.');
} finally {
  await browser?.close();
  await server.close();
}