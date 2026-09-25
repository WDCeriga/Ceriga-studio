import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildReplacement, validateReplacement, installReplacement } from './replace_scuba_from_lineart.mjs';
import { fits, readAsset } from './hood_render.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

const assetId = 'hoodie/Hood/Reference Scuba hood v1 (boxy)';
const installed = 'src/assets/studio-hoodie/hoods/supplied-scuba-20260925';
const before = assetHashes();
await validateReplacement(installed);
const stage = await buildReplacement(path.join(installed, 'source.png'));
for (const fit of fits) {
  assert.equal(fs.readFileSync(path.join(stage, `${fit}.svg`), 'utf8'), readAsset('Hood', fit, 'Scuba hood'), 'Regeneration must be deterministic');
}
assert.equal(fs.readFileSync(path.join(stage, 'hood-source.svg'), 'utf8'), fs.readFileSync(path.join(installed, 'hood-source.svg'), 'utf8'));
await assert.rejects(installReplacement(stage), /already installed/);
const manifestPath = path.join(stage, 'replacement.json');
const manifestText = fs.readFileSync(manifestPath, 'utf8');
for (const mutate of [
  manifest => { manifest.sourceSha256 = '0'.repeat(64); },
  manifest => { manifest.fits.boxy.svgSha256 = '0'.repeat(64); },
  manifest => { manifest.fits.boxy.regularSha256 = '0'.repeat(64); },
  manifest => { delete manifest.fits.boxy.bodies['Raglan Body']; },
]) {
  const manifest = JSON.parse(manifestText);
  mutate(manifest);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  await assert.rejects(installReplacement(stage), { code: 'ERR_ASSERTION' });
}
fs.writeFileSync(manifestPath, manifestText);
assert.deepEqual(assetHashes(), before, 'Rejected installs changed assets');

const output = '.tmp-hoodie-assembly/supplied-scuba-browser';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const baseUrl = process.env.CERIGA_BASE_URL || 'http://localhost:5174';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Background white', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Reference Scuba Hood v1', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Funnel Hybrid Hood', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Regular Hood', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Scuba Hood', exact: true }).count(), 1);
  const hood = page.locator('[data-layer-id="hood"]');
  const style = () => hood.evaluate(node => ({ transform: node.style.transform, origin: node.style.transformOrigin }));
  const others = () => page.locator('[data-layer-id]:not([data-layer-id="hood"])').evaluateAll(nodes => nodes.map(node => node.outerHTML));
  const unchanged = await others();
  const regularStyle = await style();
  await page.getByRole('button', { name: 'Scuba Hood', exact: true }).click();
  const originalStyle = await style();
  assert.deepEqual(await others(), unchanged, 'Selecting a hood changed other parts');
  await page.screenshot({ path: `${output}/supplied-scuba.png`, fullPage: true });
  await page.getByRole('button', { name: 'Select Scuba Hood', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Scale', exact: true }).count(), 8);
  const canvas = await page.locator('[data-layer-id="base"] svg').boundingBox();
  const point = { x: canvas.x + canvas.width * 1024 / 2048, y: canvas.y + canvas.height * 245 / 2048 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 32, point.y + 20, { steps: 5 });
  await page.mouse.up();
  const moved = await style();
  assert.notDeepEqual(moved, originalStyle, 'Hood did not move');
  for (const [name, deltaX, deltaY] of [['Scale', 25, 28], ['Rotate', 30, 35]]) {
    const previous = await style();
    const handle = await page.getByRole('button', { name, exact: true }).last().boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + deltaX, handle.y + deltaY, { steps: 6 });
    await page.mouse.up();
    assert.notDeepEqual(await style(), previous, `Hood did not ${name}`);
  }
  const edited = await style();
  for (const label of ['Regular Hood', 'Scuba Hood']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    assert.equal((await style()).transform, edited.transform, 'Hood swap lost user transform');
  }
  assert.deepEqual(await style(), edited, 'Returning to Scuba changed its pivot');
  for (const colour of ['#CC2D24', '#3B82F6', '#FFFFFF']) {
    const input = page.getByRole('textbox', { name: 'Hex colour', exact: true }).first();
    await input.fill(colour);
    await input.press('Enter');
    await page.waitForFunction(colour => document.querySelector('[data-layer-id="hood"] svg > g')?.getAttribute('fill') === colour, colour);
  }
  await page.getByRole('button', { name: 'Select Scuba Hood', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByTitle('Reset position & scale', { exact: true }).click();
  assert.deepEqual(await style(), originalStyle, 'Reset did not restore neckline registration');
  assert.deepEqual(await others(), unchanged, 'Hood edits changed other parts');
  await page.getByRole('button', { name: 'Regular Hood', exact: true }).click();
  assert.deepEqual(await style(), regularStyle, 'Regular hood placement changed');
  await page.getByRole('button', { name: 'Scuba Hood', exact: true }).click();
  const defaultFront = await hood.innerHTML();
  await page.getByRole('button', { name: 'Back', exact: true }).last().click();
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  assert.equal(await hood.innerHTML(), defaultFront, 'Front/back roundtrip changed hood');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (const label of ['Raglan Sleeve', 'Dropped Shoulder Sleeve', 'Set-in Sleeve']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    assert.equal(await hood.getAttribute('data-asset'), 'Scuba Hood', 'Construction swap lost hood');
    assert.deepEqual(await style(), originalStyle);
  }
  await page.getByRole('button', { name: 'Neck / Collar', exact: true }).click();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });

  const fixture = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  fixture.on('pageerror', error => errors.push(error.message));
  await fixture.goto(`${baseUrl}/builder/hd-001`);
  await fixture.evaluate(async assetId => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    for (const fit of ['boxy', 'cropped', 'baggy', 'regular', 'slim']) {
      const choices = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit);
      if (choices.length !== 2 || catalog.getGarmentAssetOptionLabel(choices[0]) !== 'Regular Hood'
        || catalog.getGarmentAssetOptionLabel(choices[1]) !== 'Scuba Hood') throw new Error(`Wrong options for ${fit}`);
      const selection = { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: choices[1].id };
      const hood = catalog.resolveGarmentLayers({ garmentType: 'hoodie', fit, selection }).find(layer => layer.id === 'hood');
      const archived = await import(`/src/assets/studio-hoodie/hoods/supplied-scuba-20260925/previous/${choices[1].fileName}?raw`);
      if (hood.transformReferenceSvg !== archived.default || hood.svgRaw === archived.default) throw new Error(`Lost pivot or unchanged artwork for ${fit}`);
    }
    const asset = catalog.getGarmentAsset(assetId);
    if (!asset || catalog.isAssetAvailableForFit('hoodie', asset, 'slim')) throw new Error('Wrong fit availability');
    const state = {
      garmentType: 'hoodie', fit: 'boxy', hoodieAssemblyVersion: 1, color: '#FFFFFF',
      selection: { ...catalog.getDefaultGarmentSelection('hoodie', 'boxy'), Hood: assetId },
      partColors: { hood: '#3B82F6' }, layerTransforms: { hood: { x: 21, y: -12, scaleX: 1.12, scaleY: 0.94, rotation: 13 } },
    };
    localStorage.setItem('reference-scuba-test-fixture', JSON.stringify(state));
    const legacy = catalog.resolveGarmentLayers(state).find(layer => layer.id === 'hood');
    const archived = await import('/src/assets/studio-hoodie/hoods/supplied-scuba-20260925/previous/Scuba hood.svg?raw');
    if (legacy.transformReferenceSvg !== archived.default) throw new Error('Legacy reference pivot changed');
  }, assetId);
  await fixture.reload();
  await fixture.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { TshirtSvgPreview } = await import('/src/app/components/builder/TshirtSvgPreview.tsx');
    document.getElementById('root').style.display = 'none';
    const mount = document.createElement('div');
    mount.id = 'saved-hood-fixture';
    mount.style.cssText = 'width:800px;height:800px;background:white;position:relative';
    document.body.append(mount);
    ReactDOM.createRoot(mount).render(React.createElement(TshirtSvgPreview, JSON.parse(localStorage.getItem('reference-scuba-test-fixture'))));
  });
  const restored = fixture.locator('#saved-hood-fixture [data-layer-id="hood"]');
  await restored.waitFor();
  assert.equal(await restored.evaluate(node => node.style.transform), 'translate(21px, -12px) rotate(13deg) scale(1.12, 0.94)');
  assert.equal(await restored.locator('svg > g').first().getAttribute('fill'), '#3B82F6');
  assert((await restored.getAttribute('data-asset')).includes('Reference Scuba'));
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), before);
  console.log('Supplied Scuba: deterministic five-fit traces, rejection/no-overwrite, exactly two options, preserved pivots, move/resize/rotate/colour/Reset, hood and construction swaps, front/back roundtrip, desktop/mobile and legacy serialized state reload passed. Cloud persistence not exercised.');
} finally { await browser.close(); }