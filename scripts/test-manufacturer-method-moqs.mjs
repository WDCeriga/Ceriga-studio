import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Always isolate tests from any configured production Supabase project.
const define = Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].map(key => [`import.meta.env.${key}`, '""']));
const harnessId = '/__method-moq-harness.tsx';
const server = await createServer({ define, cacheDir: 'node_modules/.vite-method-moq-tests', server: { host: '127.0.0.1', port: 5192 }, plugins: [{
  name: 'method-moq-test',
  resolveId: id => id === harnessId ? id : undefined,
  load: id => id === harnessId ? `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router';
    import {ManufacturerOnboarding} from '/src/app/pages/manufacturer/ManufacturerOnboarding.tsx';
    import '/src/styles/index.css';
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/manufacturer/onboarding?step=3']}><ManufacturerOnboarding/></MemoryRouter>);` : undefined,
  configureServer(vite) {
    vite.middlewares.use('/__method-moq-test', async (req, res, next) => {
      try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/__method-moq-test', `<html><body style="background:#09090b"><div id="root"></div><script type="module" src="${harnessId}"></script></body></html>`)); }
      catch (error) { next(error); }
    });
  },
}] });
let browser;
try {
  const methods = await server.ssrLoadModule('/src/app/data/manufacturerMethodConstraints.ts');
  const store = await server.ssrLoadModule('/src/app/data/manufacturerOnboardingStore.ts');
  const defaults = await server.ssrLoadModule('/src/app/data/manufacturerGarmentDefaults.ts');
  const matching = await server.ssrLoadModule('/src/app/data/manufacturerMatching.ts');
  const db = await server.ssrLoadModule('/src/app/data/manufacturerCustomisationDb.ts');
  const fixture = store.createDefaultCompleteProfile({
    userId: 'method-tests', contactEmail: 'method-tests@example.test', garments: ['Hoodies'],
    garmentDetails: { Hoodies: { ...defaults.createGarmentDetail('Hoodies'), confirmed: true } },
    capabilitiesMap: { 'Screen printing': 'in_house', 'Standard / flat embroidery': 'in_house', 'Acid wash': 'outsourced', 'Fabric distressing': 'in_house', 'Custom puff printing': 'in_house' },
    customCapabilities: ['Custom puff printing'],
    capabilityCatalog: [{ id: 'custom:test-puff', name: 'Custom puff printing', category: 'printing', custom: true }],
    customMethodMoqs: [{ method: 'Screen printing', moq: 50 }, { method: 'Retired treatment', moq: 123 }],
    generalMoq: 1, garmentMoqOverrides: { Hoodies: 1 }, monthlyCapacity: 10000,
  });
  const catalog = methods.getCapabilityCatalog(fixture), selected = methods.getSelectedMethods(fixture);
  assert.equal(selected.length, 5); assert.deepEqual([...new Set(selected.map(method => method.category))].sort(), ['distressing','embroidery','printing','washing']);
  const screen = selected.find(method => method.name === 'Screen printing');
  assert.equal(methods.linkLegacyMethodConstraints(fixture)[0].capabilityId, screen.id);
  assert.deepEqual(methods.linkLegacyMethodConstraints(fixture)[1], fixture.customMethodMoqs[1]);
  assert.equal(methods.getSelectedMethods({ ...fixture, capabilitiesMap: { ...fixture.capabilitiesMap, ' screen printing ': 'in_house' } }).length, 5);
  assert.equal(methods.addCustomCapabilityDefinition(fixture, ' SCREEN PRINTING ', 'custom').definition.id, screen.id);
  assert.equal(methods.getActiveMethodConstraints(fixture).length, 1);
  const inactive = { ...fixture, capabilitiesMap: { ...fixture.capabilitiesMap } }; delete inactive.capabilitiesMap['Screen printing'];
  assert.equal(methods.getActiveMethodConstraints(inactive).length, 0); assert.equal(inactive.customMethodMoqs.length, 2);
  assert.equal(matching.evaluateManufacturerMatch(fixture, { garmentCategory: 'Hoodies', quantity: 20, requiredCapabilities: [screen.id] }).matched, false);
  assert.equal(matching.evaluateManufacturerMatch(fixture, { garmentCategory: 'Hoodies', quantity: 50, requiredCapabilities: [screen.id] }).matched, true);
  assert.equal(matching.evaluateManufacturerMatch(inactive, { garmentCategory: 'Hoodies', quantity: 20, requiredCapabilities: ['Acid wash'] }).matched, true);
  for (const value of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.equal(methods.isValidMethodMoq(value), false);
  for (const value of [1, 20, 100]) assert.equal(methods.isValidMethodMoq(value), true);

  let savedRow = null, failWrite = false;
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'method-tests' } }, error: null }) }, from(table) {
    assert.equal(table, 'manufacturer_customisation_settings');
    return {
      async upsert(row, options) { assert.equal(options.onConflict, 'user_id'); if (failWrite) return { error: { message: 'Test DB unavailable' } }; savedRow = structuredClone(row); return { error: null }; },
      select: () => ({ eq: (field, id) => { assert.equal(field, 'user_id'); assert.equal(id, 'method-tests'); return { maybeSingle: async () => ({ data: savedRow, error: null }) }; } }),
    };
  } };
  await db.saveCustomisationSettingsToDb(fixture, client);
  assert.equal(savedRow.user_id, 'method-tests'); assert.equal(savedRow.settings.customMethodMoqs[0].capabilityId, screen.id);
  const restored = await db.loadCustomisationSettingsFromDb(client);
  assert.deepEqual(restored.capabilitiesMap, fixture.capabilitiesMap); assert.deepEqual(restored.customMethodMoqs, methods.linkLegacyMethodConstraints(fixture));
  failWrite = true; await assert.rejects(db.saveCustomisationSettingsToDb(fixture, client), /local draft is retained/);
  failWrite = false; await db.saveCustomisationSettingsToDb(fixture, client);
  console.log('PASS: selected categories, custom IDs, duplicate prevention, legacy linking, inactive records, matching, and mocked database save/load/failure handling.');

  await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const key = 'ceriga_mfg_full_profile_method_tests';
  await page.addInitScript(({ fixture, key }) => { if (!localStorage.getItem('user')) { localStorage.setItem('user', JSON.stringify({ id: 'method-tests', email: fixture.contactEmail })); localStorage.setItem(key, JSON.stringify(fixture)); } }, { fixture, key });
  await page.goto(server.resolvedUrls.local[0] + '__method-moq-test');
  await page.getByRole('heading', { name: '4. Capacity, Timelines & Pricing', exact: true }).waitFor({ timeout: 30000 });
  const section = page.getByRole('region', { name: 'Customisation Method Constraints', exact: true });
  const choose = async name => {
    await section.getByRole('combobox', { name: 'Customisation method', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search selected methods', exact: true }).fill(name);
    await page.getByRole('option', { name: new RegExp('^' + name) }).click();
  };
  await section.getByRole('combobox', { name: 'Customisation method', exact: true }).click();
  assert.equal(await page.getByRole('option', { name: 'Screen printing', exact: true }).count(), 0);
  assert.equal(await page.getByRole('option', { name: 'DTG (Direct to Garment)', exact: true }).count(), 0);
  await page.getByRole('combobox', { name: 'Search selected methods', exact: true }).fill('Custom puff');
  await page.getByRole('option', { name: 'Custom puff printing Custom', exact: true }).click();
  for (const value of ['-1', '1.5']) {
    await section.getByRole('spinbutton', { name: 'Method MOQ', exact: true }).fill(value);
    await section.getByRole('button', { name: 'Add', exact: true }).click();
    await section.getByRole('alert').getByText('MOQ must be a positive whole number.').waitFor();
  }
  await section.getByRole('spinbutton').fill('30'); await section.getByRole('button', { name: 'Add', exact: true }).click();
  await section.getByRole('button', { name: 'Edit Custom puff printing MOQ', exact: true }).click();
  await section.getByRole('spinbutton').fill('40'); await section.getByRole('button', { name: 'Save changes', exact: true }).click();
  await section.getByRole('combobox', { name: 'Customisation method', exact: true }).click();
  assert.equal(await page.getByRole('option', { name: 'Custom puff printing Custom', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('Screen printing', { exact: true }).locator('..').getByRole('checkbox').uncheck();
  await page.getByRole('combobox', { name: 'Custom capability category', exact: true }).selectOption('embroidery');
  await page.getByPlaceholder('Add technique name...').fill('Raised stitch');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to Capacity & Pricing', exact: true }).click();
  await section.getByText('Inactive: method is no longer selected or could not be linked. Retained for your records; excluded from matching.', { exact: true }).first().waitFor();
  await choose('Raised stitch'); await section.getByRole('spinbutton').fill('20'); await section.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).customMethodMoqs.length === 4, key);
  await page.reload(); await section.getByRole('button', { name: 'Edit Raised stitch MOQ', exact: true }).waitFor();
  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(saved.garmentMoqOverrides.Hoodies, 1);
  assert.equal(saved.customMethodMoqs.find(constraint => constraint.method === 'Custom puff printing').moq, 40);
  const raised = saved.capabilityCatalog.find(method => method.name === 'Raised stitch');
  assert.equal(raised.category, 'embroidery'); assert.equal(saved.customMethodMoqs.find(constraint => constraint.method === 'Raised stitch').capabilityId, raised.id);
  assert.equal(methods.getActiveMethodConstraints(saved).length, 2); assert.equal(saved.customMethodMoqs.length, 4);
  await section.getByRole('button', { name: 'Remove Raised stitch MOQ', exact: true }).click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).customMethodMoqs.length === 3, key);
  await page.evaluate(key => { const saved = JSON.parse(localStorage.getItem(key)); saved.capabilitiesMap = {}; localStorage.setItem(key, JSON.stringify(saved)); }, key);
  await page.reload(); await section.getByText('Select methods in Production Capabilities to add method-specific MOQs.').waitFor();
  await section.getByRole('combobox', { name: 'Customisation method', exact: true }).click();
  await page.getByText('No methods selected in Production Capabilities.', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: browser search, grouped custom methods, excluded assigned/unselected methods, positive integer validation, edit/remove, capability changes, reload, empty state, and unchanged garment MOQs.');
} catch (error) {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({path: '.tmp-method-moq-test.png'});
      console.error(await page.locator('[data-slot="popover-content"], [cmdk-list], [cmdk-item]').evaluateAll(nodes => nodes.map(node => ({type:node.getAttribute('data-slot') ?? node.getAttribute('role'),text:node.textContent,box:node.getBoundingClientRect().toJSON()}))));
    }
  }
  throw error;
} finally { if (browser) await browser.close(); await server.close(); }
