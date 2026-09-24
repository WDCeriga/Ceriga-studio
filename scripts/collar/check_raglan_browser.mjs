import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';

const fits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'];
const dropped = process.argv.includes('--construction=dropped');
const constructionName = dropped ? 'Dropped Shoulder' : 'Raglan';
const constructionId = dropped ? 'dropped-shoulder' : 'raglan';
const optionName = `${constructionName} Sleeve`;
const output = `.tmp-${constructionId}-proof/browser`;
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://localhost:5173'}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  const catalogChecks = await page.evaluate(async (constructionName) => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const fits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'];
    let transitions = 0;
    for (const fit of fits) {
      const defaults = catalog.getDefaultGarmentSelection('hoodie', fit);
      if (catalog.isHoodieRaglanSelection(defaults)) throw Error('Set-in default changed');
      const options = catalog.getGarmentAssetsForFit('hoodie', 'Left sleeve', fit);
      if (options.length !== 3) throw Error('Expected three sleeve constructions');
      const construction = options.find(asset => asset.displayName.startsWith(`${constructionName} `));
      const selection = catalog.applyGarmentFitAndLinks('hoodie', { ...defaults, 'Left sleeve': construction.id }, fit);
      for (const nextFit of fits) {
        const next = catalog.applyGarmentFitAndLinks('hoodie', JSON.parse(JSON.stringify(selection)), nextFit);
        const layers = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection: next, fit: nextFit });
        if (layers.length !== 8 || layers.filter(layer => layer.displayName.startsWith(`${constructionName} `)).length !== 3) throw Error('Construction lost');
        transitions++;
      }
      const hoodLabels = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit).map(catalog.getGarmentAssetOptionLabel).sort();
      if (JSON.stringify(hoodLabels) !== JSON.stringify(['Regular Hood', 'Scuba Hood'])) throw Error('Hood choices regression');
    }
    return { transitions };
  }, constructionName);
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: optionName, exact: true }).click();
  for (const [index, colour] of ['#E97766', '#42B88A'].entries()) {
    const input = page.getByRole('textbox', { name: 'Hex colour', exact: true }).nth(index);
    await input.fill(colour);
    await input.press('Enter');
  }
  await page.getByRole('button', { name: 'Background white', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Hex colour', exact: true }).count(), 3);
  for (const [index, colour] of ['#D5B84C', '#7957A3', '#C75B83'].entries()) {
    const input = page.getByRole('textbox', { name: 'Hex colour', exact: true }).nth(index);
    await input.fill(colour);
    await input.press('Enter');
  }
  for (const fit of fits) {
    await page.getByRole('button', { name: /^Measurement$/i }).click();
    await page.getByRole('button', { name: new RegExp(`^${fit}$`, 'i') }).click();
    await page.getByRole('button', { name: /^Sleeves$/i }).click();
    assert.equal(await page.getByRole('button', { name: optionName, exact: true }).getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => document.querySelector('[data-layer-id="sleeveLeft"] svg > g')?.getAttribute('fill') === '#E97766');
    const colours = await page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => ({
      id: node.getAttribute('data-layer-id'),
      fills: Array.from(node.querySelectorAll('svg > g')).map(group => group.getAttribute('fill')),
    })));
    assert.equal(colours.length, 8);
    assert.deepEqual(colours.find(layer => layer.id === 'sleeveLeft').fills, ['#E97766', '#141414']);
    assert.deepEqual(colours.find(layer => layer.id === 'sleeveRight').fills, ['#42B88A', '#141414']);
    assert.deepEqual(colours.find(layer => layer.id === 'bodyHem').fills, ['#D5B84C', '#141414']);
    assert.deepEqual(colours.find(layer => layer.id === 'sleeveHemLeft').fills, ['#7957A3', '#141414']);
    assert.deepEqual(colours.find(layer => layer.id === 'sleeveHemRight').fills, ['#C75B83', '#141414']);
    assert(!['#E97766', '#42B88A'].includes(colours.find(layer => layer.id === 'base').fills[0]));
    const directory = `src/assets/studio-hoodie/${constructionId}/${fit}`;
    const registration = JSON.parse(fs.readFileSync(`${directory}/validation.json`, 'utf8'));
    const samples = [];
    const shoulderSamples = [];
    for (const side of ['Left', 'Right']) {
      const mask = await sharp(`${directory}/${side} sleeve-fill.png`).greyscale().raw().toBuffer();
      if (dropped) {
        const filename = `${side} sleeve${fit === 'boxy' ? '' : ` (${fit})`}.svg`;
        const original = fs.readFileSync(`src/assets/hoodie-test/${side} sleeve/${filename}`, 'utf8');
        const fabric = original.match(/<g\b[^>]*>[\s\S]*?<\/g>/)[0];
        const rgba = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048">${fabric}</svg>`)).ensureAlpha().raw().toBuffer();
        const bodyMask = await sharp(`${directory}/Body-fill.png`).greyscale().raw().toBuffer();
        const row = registration.bounds[`${side} sleeve`].top + Math.round(registration.shoulderDropPixels * 0.6);
        const columns = [];
        for (let column = 0; column < 2048; column++) {
          const index = row * 2048 + column;
          if (rgba[index * 4 + 3] === 255 && bodyMask[index] === 255 && mask[index] === 0) columns.push(column);
        }
        assert(columns.length > 10, 'Extended body must own original upper sleeve fabric');
        const shoulder = { x: columns[Math.floor(columns.length / 2)], y: row, expected: 'Body', side };
        shoulderSamples.push(shoulder);
        samples.push(shoulder);
      }
      for (const row of [dropped ? registration.seamEnd.y + 40 : registration.neckline.y + 85, Math.round((registration.cut + registration.bounds[`${side} sleeve`].bottom) / 2)]) {
        const columns = [];
        for (let column = 0; column < 2048; column++) if (mask[row * 2048 + column] > 128) columns.push(column);
        assert(columns.length > 10, 'Missing sleeve sample');
        samples.push({ x: columns[Math.floor(columns.length / 2)], y: row, expected: `${side} sleeve` });
      }
      const cuff = registration.bounds[`${side} cuff`];
      samples.push({ x: (cuff.left + cuff.right) / 2, y: (cuff.top + cuff.bottom) / 2, expected: `${side} cuff` });
    }
    samples.push({ x: registration.center, y: registration.underarm.y - 20, expected: 'Body' }, samples[0]);
    for (const sample of samples) {
      const point = await page.locator('[data-layer-id="base"] svg').evaluate((svg, sample) => {
        const box = svg.getBoundingClientRect();
        return { x: box.x + box.width * sample.x / 2048, y: box.y + box.height * sample.y / 2048 };
      }, sample);
      await page.mouse.click(point.x, point.y);
      const selected = await page.getByRole('status', { name: 'Selected garment part' }).innerText();
      if (!selected.startsWith(sample.expected)) {
        await page.screenshot({ path: `${output}/hit-failure.png`, fullPage: true });
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 500), point);
        assert.fail(`${fit}: expected ${sample.expected}, selected ${selected}; point=${JSON.stringify(point)}; hit=${hit}`);
      }
    }
    await page.getByRole('button', { name: 'Deselect', exact: true }).click();
    if (!(await page.getByRole('button', { name: optionName, exact: true }).isVisible())) {
      await page.getByRole('button', { name: /^Sleeves$/i }).click();
    }
    await page.screenshot({ path: `${output}/${fit}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Hex colour', exact: true }).count(), 3, 'Hem and both cuff controls must remain independent');
    await page.getByRole('button', { name: /^Sleeves$/i }).click();
    await page.getByRole('button', { name: 'Set-in Sleeve', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-layer-id]').length === 8);
    for (const shoulder of shoulderSamples) {
      const box = await page.locator('[data-layer-id="base"] svg').boundingBox();
      await page.mouse.click(box.x + box.width * shoulder.x / 2048, box.y + box.height * shoulder.y / 2048);
      const selected = await page.getByRole('status', { name: 'Selected garment part' }).innerText();
      const hit = await page.evaluate(({ box, shoulder }) => document.elementFromPoint(box.x + box.width * shoulder.x / 2048, box.y + box.height * shoulder.y / 2048)?.outerHTML.slice(0, 500), { box, shoulder });
      assert(selected.startsWith(`${shoulder.side} sleeve`), `${fit}: Set-in must restore ${shoulder.side} sleeve ownership; selected=${selected}; hit=${hit}`);
    }
    if (dropped) {
      await page.getByRole('button', { name: 'Raglan Sleeve', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Raglan Sleeve', exact: true }).getAttribute('aria-pressed'), 'true');
    }
    await page.getByRole('button', { name: optionName, exact: true }).click();
    results.push({ fit, clicks: samples.length + shoulderSamples.length, independentCuffColours: true, restoredSetIn: true, extendedBodyOwnership: dropped });
  }
  const serialized = await page.locator('[data-layer-id] svg').evaluateAll(svgs => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${svgs.map(svg => svg.innerHTML).join('')}</svg>`);
  fs.writeFileSync(`${output}/serialized.svg`, serialized);
  await sharp(Buffer.from(serialized)).png().toFile(`${output}/serialized.png`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Sleeves$/i }).click();
  await page.getByRole('button', { name: optionName, exact: true }).waitFor();
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true, animations: 'disabled' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, 'Mobile horizontal overflow');
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ completedAt: new Date().toISOString(), catalogChecks, results, savedSelectionRoundTrip: true, svgSerialization: true, errors }, null, 2));
  console.log(`${constructionName.toUpperCase()} BROWSER VALIDATION COMPLETE`, JSON.stringify(results));
} catch (error) {
  fs.writeFileSync(`${output}/failure.json`, JSON.stringify({ failedAt: new Date().toISOString(), message: error.stack, results, errors }, null, 2));
  throw error;
} finally {
  await browser.close();
}