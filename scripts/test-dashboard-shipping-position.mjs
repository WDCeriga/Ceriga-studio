import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const entry = '/__dashboard-shipping-harness.tsx';
const server = await createServer({ cacheDir: 'node_modules/.vite-shipping-position', server: { host: '127.0.0.1', port: 5193 }, plugins: [{
  name: 'shipping-dashboard-fixture', enforce: 'pre', resolveId(id) { if (id === entry) return id; },
  load(id) { if (id === entry) return `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router';import {ManufacturerDashboard} from '/src/app/pages/manufacturer/ManufacturerDashboard.tsx';import {createDefaultCompleteProfile,loadCompleteManufacturerProfile,saveCompleteManufacturerProfile,getProfileStorageKey} from '/src/app/data/manufacturerOnboardingStore.ts';import '/src/styles/index.css';
  if(!localStorage.getItem(getProfileStorageKey())) saveCompleteManufacturerProfile(createDefaultCompleteProfile({shippingDestinations:[],shippingMethods:[]}),undefined,{syncWorkspace:false});
  function shipping(done){saveCompleteManufacturerProfile({...loadCompleteManufacturerProfile(),shippingDestinations:done?['UK']:[],shippingMethods:done?['Courier shipping']:[]},undefined,{syncWorkspace:false});}
  createRoot(document.getElementById('root')).render(<MemoryRouter><button onClick={()=>shipping(true)}>Complete shipping fixture</button><button onClick={()=>shipping(false)}>Clear shipping fixture</button><ManufacturerDashboard/></MemoryRouter>);`; },
  configureServer(vite) { vite.middlewares.use('/__dashboard-shipping', async (req, res, next) => { try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/__dashboard-shipping', `<html><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`)); } catch (error) { next(error); } }); },
}] });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + '__dashboard-shipping');
  const position = () => page.getByRole('heading', { name: /Manufacturing Profile Strength/ }).evaluate(element => {
    const card = element.closest('.space-y-5');
    return { index: [...card.parentElement.children].indexOf(card), last: card === card.parentElement.lastElementChild };
  });
  await page.getByRole('heading', { name: /Manufacturing Profile Strength/ }).waitFor();
  assert.equal((await position()).index, 1, 'incomplete shipping keeps the card below the header');
  await page.getByRole('button', { name: 'Complete shipping fixture' }).click();
  assert.equal((await position()).last, true, 'completed shipping moves the card to the dashboard bottom');
  assert.equal(await page.getByRole('heading', { name: /Manufacturing Profile Strength/ }).count(), 1);
  await page.reload(); await page.getByRole('heading', { name: /Manufacturing Profile Strength/ }).waitFor();
  assert.equal((await position()).last, true, 'the position persists after reload');
  await page.getByRole('button', { name: 'Clear shipping fixture' }).click();
  assert.equal((await position()).index, 1, 'removing shipping returns the card to the top');
  assert.deepEqual(errors, []); console.log('PASS: shipping completeness controls dashboard placement, updates immediately and survives reload');
} finally { await browser?.close(); await server.close(); }
