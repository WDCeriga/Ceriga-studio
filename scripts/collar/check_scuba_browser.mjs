import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const { chromium } = process.env.CERIGA_NODE_MODULES
  ? require(path.join(process.env.CERIGA_NODE_MODULES, 'playwright')) : require('playwright');
const only = process.argv.find((argument) => argument.startsWith('--variant='))?.split('=')[1];
const selected = [{ id: 'scuba', label: 'Scuba Hood' }].filter((variant) => !only || variant.id === only);
assert(selected.length > 0, 'Unknown hood variant');
const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://localhost:5173'}/builder/hd-001`);
  await page.getByText('Neck / Collar', { exact: true }).first().waitFor();
  fs.mkdirSync('.tmp-scuba-proof/browser', { recursive: true });
  const transitions = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const fits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'];
    let count = 0;
    for (const fit of fits) {
      const hoods = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit);
      const labels = hoods.map(catalog.getGarmentAssetOptionLabel).sort();
      if (JSON.stringify(labels) !== JSON.stringify(['Regular Hood', 'Scuba Hood'])) throw Error('Unexpected hood choices');
      const scuba = hoods.find(asset => catalog.getGarmentAssetOptionLabel(asset) === 'Scuba Hood');
      for (const sleeve of catalog.getGarmentAssetsForFit('hoodie', 'Left sleeve', fit)) {
        const selection = catalog.applyGarmentFitAndLinks('hoodie', {
          ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: scuba.id, 'Left sleeve': sleeve.id,
        }, fit);
        for (const nextFit of fits) {
          const next = catalog.applyGarmentFitAndLinks('hoodie', JSON.parse(JSON.stringify(selection)), nextFit);
          const layers = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection: next, fit: nextFit });
          if (layers.length !== 8 || !next.Hood.includes('Scuba hood')) throw Error('Scuba fit transition lost');
          const nextSleeve = catalog.getGarmentAssetsForFit('hoodie', 'Left sleeve', nextFit).find(asset => asset.id === next['Left sleeve']);
          if (catalog.getGarmentAssetOptionLabel(nextSleeve) !== catalog.getGarmentAssetOptionLabel(sleeve)) throw Error('Sleeve construction lost');
          count++;
        }
      }
    }
    return count;
  });
  const tiles = [];
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (const variant of selected) {
  await page.getByRole('button', { name: variant.label, exact: true }).click();
  await page.getByRole('textbox', { name: 'Hex colour', exact: true }).fill('#E97766');
  await page.getByRole('textbox', { name: 'Hex colour', exact: true }).press('Enter');
  for (const fit of ['Boxy', 'Cropped', 'Baggy', 'Regular', 'Slim']) {
    await page.getByRole('button', { name: /^Measurement$/i }).first().click();
    await page.getByRole('button', { name: fit, exact: true }).click();
    await page.getByText('Neck / Collar', { exact: true }).first().click();
    const hood = page.getByRole('button', { name: variant.label, exact: true });
    assert((await hood.getAttribute('class')).includes('border-[#FF3B30]'), `${fit}: ${variant.label} selection lost`);
    await page.getByRole('button', { name: 'Regular Hood', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Funnel Hybrid Hood', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Scuba Hood', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Oversized Hood', exact: true }).count(), 0);
    await page.waitForFunction((label) => Array.from(document.querySelectorAll('svg')).some((svg) =>
      svg.querySelector('title')?.textContent?.endsWith(`- ${label}`) &&
      svg.querySelector('g')?.getAttribute('fill')?.toLowerCase() === '#e97766'), variant.label);
    const bodyColours = await page.locator('[data-layer-id="base"] svg').evaluateAll((svgs) => svgs
      .map((svg) => svg.querySelector('g')?.getAttribute('fill')?.toLowerCase()));
    assert(bodyColours.length > 0 && bodyColours.every((colour) => colour !== '#e97766'), `${fit}: hood colour changed body`);
    if (variant.id === 'scuba') {
      const inkColours = await page.locator('svg').evaluateAll((svgs) => svgs
        .filter((svg) => svg.querySelector('title')?.textContent?.endsWith('- Scuba Hood'))
        .map((svg) => svg.querySelectorAll('g')[1]?.getAttribute('fill')));
      assert(inkColours.length > 0 && inkColours.every((colour) => colour === '#000000'), `${fit}: Scuba ink changed colour`);
    }
    await page.screenshot({ path: `.tmp-scuba-proof/browser/${variant.id}-${fit.toLowerCase()}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    for (const [constructionIndex, construction] of ['Set-in Sleeve', 'Raglan Sleeve', 'Dropped Shoulder Sleeve'].entries()) {
      await page.getByRole('button', { name: construction, exact: true }).click();
      const layers = await page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => ({
        id: node.getAttribute('data-layer-id'),
        fills: Array.from(node.querySelectorAll('svg > g')).map(group => group.getAttribute('fill')),
        title: node.querySelector('title')?.textContent,
      })));
      assert.equal(layers.length, 8);
      const scuba = layers.find(layer => layer.title?.endsWith('- Scuba Hood'));
      assert.deepEqual(scuba.fills.map(colour => colour.toLowerCase()), ['#e97766', '#000000']);
      for (const layer of layers.filter(layer => layer !== scuba)) assert.notEqual(layer.fills[0].toLowerCase(), '#e97766');
      for (const cuff of ['sleeveHemLeft', 'sleeveHemRight']) assert(layers.some(layer => layer.id === cuff));
      const serialized = await page.locator('[data-layer-id] svg').evaluateAll(svgs => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${svgs.map(svg => svg.innerHTML).join('')}</svg>`);
      const filename = `.tmp-scuba-proof/browser/${fit.toLowerCase()}-${constructionIndex}`;
      fs.writeFileSync(`${filename}.svg`, serialized);
      const monochrome = serialized.replace(/fill="#[0-9a-f]{6}"/gi, match => /#000000|#141414/i.test(match) ? 'fill="#000000"' : 'fill="#ffffff"');
      await sharp(Buffer.from(monochrome)).flatten({ background: 'white' }).png().toFile(`${filename}.png`);
      tiles.push({ input: await sharp(Buffer.from(monochrome)).resize(410, 410).flatten({ background: 'white' }).png().toBuffer(),
        left: ['Boxy', 'Cropped', 'Baggy', 'Regular', 'Slim'].indexOf(fit) * 410, top: constructionIndex * 410 });
      results.push({ variant: variant.id, fit, construction, selection: true, independentColour: true, separateCuffs: true, serialized: true });
    }
    await page.getByText('Neck / Collar', { exact: true }).first().click();
    console.log(`${fit}: ${variant.label} selected and independently coloured, Regular Hood available`);
  }
  }
  await page.getByRole('button', { name: 'Regular Hood', exact: true }).click();
  await page.getByRole('button', { name: 'Scuba Hood', exact: true }).click();
  await sharp({ create: { width: 2050, height: 1230, channels: 4, background: 'white' } }).composite(tiles).png().toFile('.tmp-scuba-proof/browser/all-constructions.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.tmp-scuba-proof/browser/mobile.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile overflow');
  assert.deepEqual(errors, []);
  fs.writeFileSync(`.tmp-scuba-proof/browser/results-${only || 'all'}.json`, JSON.stringify({ completedAt: new Date().toISOString(), transitions, results, errors }, null, 2));
  console.log('Page errors:', JSON.stringify(errors));
} finally { await browser.close(); }
