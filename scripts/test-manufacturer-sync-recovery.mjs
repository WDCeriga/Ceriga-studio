import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Replace the client module entirely: these configured-backend tests must never
// contact the real project or rely on offline-mode behaviour.
const harness = '/__sync-recovery.tsx';
const server = await createServer({
  cacheDir: 'node_modules/.vite-sync-recovery-tests',
  server: { host: '127.0.0.1', port: 5194 },
  plugins: [{
    name: 'sync-recovery', enforce: 'pre',
    resolveId: id => id === harness ? id : undefined,
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/app/lib/supabaseClient.ts')) return;
      return `
        export const isSupabaseConfigured = true;
        export function getSupabase() { return {
          auth: { getUser: async () => ({data:{user:{id:'sync-tests'}},error:null}) },
          from(table) { return {
            select() { return {eq() {return {maybeSingle:async () => {
              const resource = table === 'manufacturer_customisation_settings' ? 'methods' : 'pricing';
              if (window.syncFailure === resource) return {data:null,error:{message:resource === 'methods' ? "Could not find the table 'public.manufacturer_customisation_settings' in the schema cache" : "Could not find the 'pricing' column in the schema cache"}};
              return {data:null,error:null};
            }}}}; },
            async upsert(row) { (window.syncWrites ??= []).push({table,row});return {error:null}; }
          }; }
        }; }
      `;
    },
    load: id => id === harness ? `
      import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router';
      import {ManufacturerOnboarding} from '/src/app/pages/manufacturer/ManufacturerOnboarding.tsx';
      import '/src/styles/index.css';
      createRoot(document.getElementById('root')).render(<MemoryRouter><ManufacturerOnboarding/></MemoryRouter>);
    ` : undefined,
    configureServer(vite) {
      vite.middlewares.use('/__sync-test', async (req, res, next) => {
        try { res.setHeader('Content-Type', 'text/html');res.end(await vite.transformIndexHtml('/__sync-test', `<html><body><div id="root"></div><script type="module" src="${harness}"></script></body></html>`)); }
        catch (error) { next(error); }
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const failure of ['methods', 'pricing']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(failure => {
      window.syncFailure = failure;
      localStorage.setItem('user', JSON.stringify({ id: 'sync-tests', email: 'sync@example.test' }));
    }, failure);
    await page.goto(server.resolvedUrls.local[0] + '__sync-test');
    await page.getByRole('heading', { name: /Set [Uu]p / }).waitFor().catch(async error => { console.error(errors, await page.locator('body').innerText()); throw error; });
    await page.getByRole('alert').getByText('You can continue editing.', { exact: false }).waitFor();
    const name = page.locator('input').first();
    await name.fill('Recovery Factory');
    await page.waitForFunction(() => window.syncWrites?.length > 0);
    const writes = await page.evaluate(() => window.syncWrites);
    assert(writes.every(write => write.table === (failure === 'methods' ? 'manufacturer_profiles' : 'manufacturer_customisation_settings')));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ceriga_mfg_full_profile_sync_tests')).factoryName), 'Recovery Factory');
    await page.reload();
    await page.getByRole('heading', { name: 'Set up Recovery Factory', exact: true }).waitFor();
    await page.getByRole('alert').waitFor();
    await page.evaluate(() => { window.syncFailure = null; window.syncWrites = []; });
    await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
    await page.getByRole('alert').waitFor({ state: 'detached' });
    await page.getByText('All changes autosaved', { exact: true }).waitFor();
    assert.equal(new Set((await page.evaluate(() => window.syncWrites)).map(write => write.table)).size, 2);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: missing method table and pricing column do not block onboarding; drafts survive reload, healthy resources save independently, and retry restores cloud sync.');
} finally { await browser?.close(); await server.close(); }
