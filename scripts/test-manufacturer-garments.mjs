import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const harnessId = '/__garment-harness.tsx';
const server = await createServer({
  cacheDir: 'node_modules/.vite-garment-tests',
  define: Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].map(key => [`import.meta.env.${key}`, '""'])),
  server: { host: '127.0.0.1', port: 5191 },
  plugins: [{
    name: 'garment-onboarding-test',
    resolveId: id => id === harnessId ? id : undefined,
    load: id => id === harnessId ? `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { MemoryRouter } from 'react-router';
      import { ManufacturerOnboarding } from '/src/app/pages/manufacturer/ManufacturerOnboarding.tsx';
      import '/src/styles/index.css';
      createRoot(document.getElementById('root')).render(
        <MemoryRouter initialEntries={['/manufacturer/onboarding?step=1']}><ManufacturerOnboarding /></MemoryRouter>
      );` : undefined,
    configureServer(vite) {
      vite.middlewares.use('/__garment-test', async (req, res, next) => {
        try {
          const html = await vite.transformIndexHtml('/__garment-test', `<html><body style="background:#09090b"><div id="root"></div><script type="module" src="${harnessId}"></script></body></html>`);
          res.setHeader('Content-Type', 'text/html'); res.end(html);
        } catch (error) { next(error); }
      });
    },
  }],
});
let browser;
try {
  const defaults = await server.ssrLoadModule('/src/app/data/manufacturerGarmentDefaults.ts');
  const types = await server.ssrLoadModule('/src/app/data/manufacturerOnboardingTypes.ts');
  const store = await server.ssrLoadModule('/src/app/data/manufacturerOnboardingStore.ts');
  const matching = await server.ssrLoadModule('/src/app/data/manufacturerMatching.ts');
  assert.deepEqual(Object.keys(defaults.GARMENT_DEFAULTS).sort(), [...types.ALL_GARMENT_CATEGORIES].sort());
  for (const category of types.ALL_GARMENT_CATEGORIES) {
    const a = defaults.createGarmentDetail(category), b = defaults.createGarmentDetail(category);
    assert.equal(a.confirmed, false); assert.notEqual(a.styles, b.styles); assert.notEqual(a.materials, b.materials);
    if (category !== 'Other') {
      assert(a.styles.length >= 4); assert(a.materials.length >= 3);
      assert(a.minGsm > 0 && a.maxGsm > a.minGsm);
    }
  }
  const legacy = { category: 'Hoodies', styles: [], materials: ['Custom hemp'], minGsm: 520, maxGsm: 620 };
  const initialized = defaults.initializeGarmentDetails(['Hoodies', 'Jeans'], { Hoodies: legacy });
  assert.deepEqual(initialized.Hoodies, legacy);
  assert.notDeepEqual(initialized.Jeans.materials, defaults.createGarmentDetail('Hoodies').materials);
  assert.deepEqual(defaults.createGarmentDetail('Zip-ups').styles, defaults.createGarmentDetail('Zip-up hoodies').styles);
  assert.equal(defaults.garmentReviewError({ ...initialized.Jeans, minGsm: 600, maxGsm: 200 }), 'Minimum GSM cannot exceed maximum GSM.');

  const fixture = store.createDefaultCompleteProfile({
    userId: 'garment-tests', contactEmail: 'garment-test@example.test',
    garments: ['Hoodies', 'T-shirts'], garmentDetails: defaults.initializeGarmentDetails(['Hoodies', 'T-shirts']),
  });
  const order = { garmentCategory: 'Hoodies', quantity: 100, minGsm: 900 };
  const pending = matching.evaluateManufacturerMatch(fixture, order);
  assert.equal(pending.matched, false); assert(!pending.warnings.some(warning => warning.includes('GSM')));
  const confirmedProfile = { ...fixture, garmentDetails: { ...fixture.garmentDetails, Hoodies: { ...fixture.garmentDetails.Hoodies, confirmed: true } } };
  assert.equal(matching.evaluateManufacturerMatch(confirmedProfile, { ...order, minGsm: 350 }).matched, true);
  assert(matching.evaluateManufacturerMatch(confirmedProfile, order).warnings.some(warning => warning.includes('GSM')));

  const memory = new Map();
  globalThis.window = {};
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  localStorage.setItem('user', JSON.stringify({ id: 'garment-tests', email: fixture.contactEmail }));
  localStorage.setItem(store.getProfileStorageKey(fixture.contactEmail), JSON.stringify({ ...fixture, garmentDetails: { Hoodies: legacy } }));
  assert.deepEqual(store.loadCompleteManufacturerProfile().garmentDetails.Hoodies, legacy);
  store.saveCompleteManufacturerProfile(confirmedProfile);
  assert.deepEqual(store.loadCompleteManufacturerProfile().garmentDetails, confirmedProfile.garmentDetails);
  delete globalThis.window; delete globalThis.localStorage;
  console.log('PASS: all 20 defaults, separate arrays, legacy preservation, account storage, and confirmation-gated matching.');

  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ fixture }) => {
    if (!localStorage.getItem('user')) {
      localStorage.setItem('user', JSON.stringify({ id: 'garment-tests', email: fixture.contactEmail }));
      localStorage.setItem('ceriga_mfg_full_profile_garment_tests', JSON.stringify(fixture));
    }
  }, { fixture });
  const url = server.resolvedUrls.local[0] + '__garment-test';
  await page.goto(url);
  const hoodieStyles = page.getByRole('group', { name: 'Supported styles & fits for Hoodies', exact: true });
  await hoodieStyles.getByRole('button', { name: 'Pullover', exact: true }).click();
  assert.equal(await hoodieStyles.getByRole('button', { name: 'Pullover', exact: true }).getAttribute('aria-pressed'), 'false');
  await hoodieStyles.getByRole('textbox').fill('Raglan pullover');
  await hoodieStyles.getByRole('button', { name: 'Add', exact: true }).click();
  const construction = page.getByRole('group', { name: 'Construction details', exact: true });
  await construction.getByRole('textbox').fill('Bound shoulder seams');
  await construction.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('spinbutton').first().fill('310');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to Production Capabilities', exact: true }).click();
  await page.getByText('Review and confirm each selected garment category before continuing.', { exact: true }).waitFor();
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('ceriga_mfg_full_profile_garment_tests')));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ceriga_mfg_full_profile_garment_tests')).garmentDetails.Hoodies.confirmed === true);
  const hoodieBefore = (await snapshot()).garmentDetails.Hoodies;
  await page.getByRole('button', { name: /^Hoodies/ }).first().click();
  await page.getByRole('button', { name: /^Hoodies/ }).first().click();
  assert.equal(await page.getByRole('checkbox').isChecked(), true);
  await page.reload();
  await page.getByRole('group', { name: 'Supported styles & fits for Hoodies', exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox').isChecked(), true);
  assert.deepEqual((await snapshot()).garmentDetails.Hoodies, hoodieBefore);
  // Editing one panel leaves other saved panels byte-for-byte unchanged.
  const teeBefore = (await snapshot()).garmentDetails['T-shirts'];
  await page.getByRole('group', { name: 'Supported styles & fits for Hoodies', exact: true }).getByRole('button', { name: 'Boxy fit', exact: true }).click();
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^T-shirts.*Collapse|^T-shirts.*Configure/ }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to Production Capabilities', exact: true }).click();
  await page.getByRole('heading', { name: /3\. Production Capabilities/ }).waitFor();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('heading', { name: '2. Products & Garments', exact: true }).waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ceriga_mfg_full_profile_garment_tests')).garmentDetails['T-shirts'].confirmed === true);
  const final = await snapshot();
  assert.deepEqual(final.garmentDetails['T-shirts'], { ...teeBefore, confirmed: true });
  assert(final.garmentDetails.Hoodies.customStyles.includes('Raglan pullover'));
  assert(final.garmentDetails.Hoodies.customConstructionDetails.includes('Bound shoulder seams'));
  assert.equal(final.garmentDetails.Hoodies.minGsm, 310);
  assert.deepEqual(errors, []);
  console.log('PASS: browser custom options, deselection/reselection, reload, confirmation reset, validation, and step navigation.');
} finally {
  if (browser) await browser.close();
  await server.close();
}
