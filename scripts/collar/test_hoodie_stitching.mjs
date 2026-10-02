import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { assetHashes } from './export_hoodie_test.mjs';
import { clearStitchOverride, resolveStitchSettings, updateStitchSettings } from '../../src/app/data/hoodieStitching.ts';

let settings = updateStitchSettings({}, { color: '#CC2D24', style: 'double' });
settings = updateStitchSettings(settings, { color: '#FFFFFF' }, 'pocket');
assert.equal(resolveStitchSettings(settings, 'pocket').color, '#FFFFFF');
assert.equal(resolveStitchSettings(settings, 'hem').color, '#CC2D24');
settings = updateStitchSettings(settings, { color: undefined }, 'pocket');
assert.equal(resolveStitchSettings(settings, 'pocket').color, '#CC2D24');
assert.deepEqual(JSON.parse(JSON.stringify(settings)), settings);
assert.equal(clearStitchOverride(settings, 'pocket').pocket, undefined);

const protectedAssets = assetHashes();
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/builder/hd-001`);
  for (let step = 0; step < 7; step++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const sources = () => page.locator('[data-layer-id] > div > div').evaluateAll(nodes => nodes.map(node => node.innerHTML));
  const before = await sources();
  assert.equal(await page.locator('[data-hoodie-stitches]').count(), 0);
  await page.getByRole('switch', { name: 'Visible stitching' }).check();
  await page.locator('[data-stitch-ready="true"]').waitFor();
  assert.equal(await page.locator('[data-hoodie-stitches]').count(), 8);
  assert.deepEqual(await sources(), before);
  await page.getByRole('button', { name: 'Colour #CC2D24', exact: true }).click();
  await page.getByRole('combobox', { name: 'Line weight', exact: true }).selectOption('heavy');
  const patterns = [];
  for (const style of ['standard', 'double', 'triple', 'zigzag', 'overlock', 'coverstitch']) {
    await page.getByRole('combobox', { name: 'Stitch type', exact: true }).selectOption(style);
    const path = page.locator('[data-stitch-region="pocket"]').first();
    assert.equal(await path.getAttribute('stroke'), '#CC2D24');
    assert.equal(await path.getAttribute('stroke-width'), '3.4');
    patterns.push(await path.getAttribute('d'));
  }
  assert.equal(new Set(patterns).size, 6);
  await page.getByRole('combobox', { name: 'Stitching region', exact: true }).selectOption('pocket');
  await page.getByRole('checkbox', { name: 'Override global settings' }).check();
  await page.getByRole('button', { name: 'Colour #FFFFFF', exact: true }).click();
  assert.equal(await page.locator('[data-stitch-region="pocket"]').first().getAttribute('stroke'), '#FFFFFF');
  assert.equal(await page.locator('[data-stitch-region="hem"]').first().getAttribute('stroke'), '#CC2D24');
  await page.getByRole('checkbox', { name: 'Override global settings' }).uncheck();
  assert.equal(await page.locator('[data-stitch-region="pocket"]').first().getAttribute('stroke'), '#CC2D24');
  await page.getByRole('combobox', { name: 'Stitching region', exact: true }).selectOption('global');
  await page.getByRole('switch', { name: 'Visible stitching' }).uncheck();
  assert.equal(await page.locator('[data-stitch-region]').count(), 0);
  await page.getByRole('switch', { name: 'Visible stitching' }).check();
  await page.getByRole('combobox', { name: 'Stitch type', exact: true }).selectOption('none');
  assert.equal(await page.locator('[data-stitch-region]').count(), 0);
  await page.getByRole('button', { name: 'Reset stitching', exact: true }).click();
  assert.equal(await page.locator('[data-hoodie-stitches]').count(), 0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('[data-stitch-ready="true"]').waitFor();
  assert.equal(await page.locator('[data-hoodie-stitches]').count(), 8);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.locator('[data-hoodie-stitches]').count(), 0);
  assert.deepEqual(await sources(), before);
  console.log('PASS: legacy appearance, types, colour, weight, overrides, visibility, Reset and Undo/Redo.');

  const cases = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const bundles = await import('/src/app/data/hoodBundles.ts');
    const { measureHoodieSeams } = await import('/src/app/data/hoodieSeamGeometry.ts');
    const authored = await import('/src/app/data/hoodieAuthoredSeams.ts');
    const results = [];
    for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
      const selection = catalog.getDefaultGarmentSelection('hoodie', fit);
      const hoodPaths = new Set();
      const joins = ['set-in', 'raglan', 'dropped-shoulder'].map(construction => {
        const seams = authored.bodyPanelSeams(fit, 'base', construction);
        if (construction === 'raglan' && seams.some(seam => seam.region === 'shoulder')) throw Error(`${fit}: raglan shoulder`);
        return JSON.stringify(seams.filter(seam => seam.region === 'armhole'));
      });
      if (new Set(joins).size !== 3) throw Error(`${fit}: shared sleeve construction paths`);
      const inspect = async (selected, label) => {
        const layers = catalog.resolveGarmentLayers({ garmentType: 'hoodie', fit, selection: selected });
        const geometry = await measureHoodieSeams(layers);
        const seams = Object.values(geometry).flatMap(panel => panel.seams);
        if (seams.some(seam => /NaN|Infinity/.test(seam.path))) throw Error(`${label}: invalid path`);
        const regions = [...new Set(seams.map(seam => seam.region))];
        if (regions.includes('zip')) throw Error(`${label}: invented zip seam`);
        const descriptor = bundles.getHoodBundleAsset(selected.Hood);
        const expectedHood = descriptor.bundle.styleId === 'oversized-deep'
          ? authored.deepHoodSeams(fit, descriptor.variant.frontConstruction)
          : descriptor.bundle.styleId === 'scuba' ? authored.scubaHoodSeams(fit)
            : authored.regularHoodSeams(fit, descriptor.variant.frontConstruction);
        if (JSON.stringify(geometry.hood.seams) !== JSON.stringify(expectedHood)) throw Error(`${label}: not authored hood geometry`);
        if (label.includes('/')) hoodPaths.add(JSON.stringify(geometry.hood.seams));
        const body = layers.find(layer => layer.id === 'base');
        const construction = body.displayName.startsWith('Raglan') ? 'raglan'
          : body.displayName.startsWith('Dropped') ? 'dropped-shoulder' : 'set-in';
        for (const layer of layers.filter(layer => layer.id !== 'hood')) {
          if (JSON.stringify(geometry[layer.id].seams) !== JSON.stringify(authored.bodyPanelSeams(fit, layer.id, construction))) {
            throw Error(`${fit}/${label}/${layer.id}: not authored panel geometry`);
          }
        }
        if (descriptor.bundle.styleId === 'oversized-deep') {
          const crown = geometry.hood.seams.filter(seam => seam.region === 'hoodCenter');
          if (crown.length !== 2) throw Error(`${label}: missing transverse crown`);
          for (const seam of crown) {
            const coordinates = seam.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
            if (Math.abs(coordinates[6] - coordinates[0]) <= Math.abs(coordinates[7] - coordinates[1])) {
              throw Error(`${label}: vertical Deep crown`);
            }
          }
        }
        return { fit, label, regions };
      };
      for (const hood of catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit)) {
        const descriptor = bundles.getHoodBundleAsset(hood.id);
        results.push(await inspect({ ...selection, Hood: hood.id }, `${descriptor.bundle.styleId}/${descriptor.variant.frontConstruction}`));
      }
      if (hoodPaths.size !== 5) throw Error(`${fit}: shared hood construction paths`);
      for (const sleeve of catalog.getGarmentAssetsForFit('hoodie', 'Left sleeve', fit)) {
        const selected = catalog.applyGarmentFitAndLinks('hoodie', { ...selection, 'Left sleeve': sleeve.id }, fit);
        results.push(await inspect(selected, sleeve.displayName ?? sleeve.id));
      }
    }
    return results;
  });
  assert.equal(cases.filter(entry => entry.label.includes('/')).length >= 25, true);
  for (const entry of cases) {
    for (const region of ['hoodOpening', 'neckline', 'armhole', 'cuffs', 'hem', 'pocket']) {
      assert(entry.regions.includes(region), `${entry.fit} ${entry.label}: missing ${region}`);
    }
  }
  console.log(`PASS: ${cases.length} fit/hood/construction/sleeve geometry cases (placement still requires visual approval).`);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('combobox', { name: 'Stitching region', exact: true }).scrollIntoViewIfNeeded();
    const controls = page.locator('[data-hoodie-stitch-panel] select');
    for (const control of await controls.all()) {
      const bounds = await control.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `${width}px: control overflow`);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), protectedAssets);
  console.log('PASS: desktop/mobile control bounds, no runtime errors, source SVG hashes unchanged.');
} finally {
  await browser?.close();
  await server.close();
}