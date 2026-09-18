import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { variants } from './rebuild_hood_variants.mjs';
const require = createRequire(import.meta.url);
const { chromium } = process.env.CERIGA_NODE_MODULES
  ? require(path.join(process.env.CERIGA_NODE_MODULES, 'playwright')) : require('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/builder/hd-001');
  await page.getByText('Neck / Collar', { exact: true }).first().waitFor();
  fs.mkdirSync('.tmp-scuba-proof/browser', { recursive: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (const variant of variants) {
  await page.getByRole('button', { name: variant.label, exact: true }).click();
  await page.getByRole('textbox', { name: 'Hex colour', exact: true }).fill('#E97766');
  await page.getByRole('textbox', { name: 'Hex colour', exact: true }).press('Enter');
  for (const fit of ['Boxy', 'Cropped', 'Baggy', 'Regular', 'Slim']) {
    await page.getByRole('button', { name: /^Measurement$/i }).first().click();
    await page.getByRole('button', { name: fit, exact: true }).click();
    await page.getByText('Neck / Collar', { exact: true }).first().click();
    const scuba = page.getByRole('button', { name: variant.label, exact: true });
    assert((await scuba.getAttribute('class')).includes('border-[#FF3B30]'), `${fit}: Scuba selection lost`);
    await page.getByRole('button', { name: 'Regular Hood', exact: true }).waitFor();
    await page.waitForFunction((label) => Array.from(document.querySelectorAll('svg')).some((svg) =>
      svg.querySelector('title')?.textContent?.endsWith(`- ${label}`) &&
      svg.querySelector('g')?.getAttribute('fill')?.toLowerCase() === '#e97766'), variant.label);
    const bodyColours = await page.locator('svg').evaluateAll((svgs) => svgs
      .filter((svg) => svg.querySelector('title')?.textContent?.endsWith('- Body'))
      .map((svg) => svg.querySelector('g')?.getAttribute('fill')?.toLowerCase()));
    assert(bodyColours.length > 0 && bodyColours.every((colour) => colour !== '#e97766'), `${fit}: hood colour changed body`);
    await page.screenshot({ path: `.tmp-scuba-proof/browser/${variant.id}-${fit.toLowerCase()}.png`, fullPage: true, animations: 'disabled' });
    console.log(`${fit}: ${variant.label} selected and independently coloured, Regular Hood available`);
  }
  }
  await page.getByRole('button', { name: 'Regular Hood', exact: true }).click();
  await page.getByRole('button', { name: 'Scuba Hood', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log('Page errors:', JSON.stringify(errors));
} finally { await browser.close(); }
