import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const harness = '/__garment-moq-harness.tsx';
const server = await createServer({
  cacheDir: 'node_modules/.vite-garment-moq-tests',
  define: Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].map(key => [`import.meta.env.${key}`, '""'])),
  server: { host: '127.0.0.1', port: 5195 },
  plugins: [{ name: 'garment-moq-test',
    resolveId: id => id === harness ? id : undefined,
    load: id => id === harness ? `
      import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router';
      import {ManufacturerOnboarding} from '/src/app/pages/manufacturer/ManufacturerOnboarding.tsx';
      import '/src/styles/index.css';
      createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/manufacturer/onboarding?step=3']}><ManufacturerOnboarding/></MemoryRouter>);
    ` : undefined,
    configureServer(vite) {
      vite.middlewares.use('/__garment-moq-test', async (req, res, next) => {
        try {res.setHeader('Content-Type', 'text/html');res.end(await vite.transformIndexHtml('/__garment-moq-test', `<html><body><div id="root"></div><script type="module" src="${harness}"></script></body></html>`));}
        catch (error) {next(error);}
      });
    },
  }],
});
let browser;
try {
  const store = await server.ssrLoadModule('/src/app/data/manufacturerOnboardingStore.ts');
  const db = await server.ssrLoadModule('/src/app/data/manufacturerCustomisationDb.ts');
  const fixture = store.createDefaultCompleteProfile({ generalMoq: 12, garments: ['Hoodies', 'Sweatshirts', 'T-shirts', 'Joggers'], completedSteps: [0,1,2,3] });
  assert.deepEqual(fixture.garmentMoqOverrides, {});
  const legacy = store.createDefaultCompleteProfile({ generalMoq: 12, garmentMoqOverrides: { Hoodies: 30, Sweatshirts: 26, 'T-shirts': 50 } });
  assert.deepEqual(legacy.garmentMoqOverrides, {});
  assert.deepEqual(legacy.confirmedGarmentMoqOverrides, []);
  let row;
  const client = {auth:{getUser:async()=>({data:{user:{id:'moq-tests'}},error:null})},from:()=>({
    upsert:async value => {row=structuredClone(value);return {error:null};},
    select:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})}),
  })};
  const custom = {...fixture, generalMoq:20, garmentMoqOverrides:{Hoodies:30,Sweatshirts:26},confirmedGarmentMoqOverrides:['Hoodies','Sweatshirts']};
  await db.saveCustomisationSettingsToDb(custom, client);
  const restored = await db.loadCustomisationSettingsFromDb(client);
  assert.equal(restored.generalMoq,20);assert.deepEqual(restored.garmentMoqOverrides,custom.garmentMoqOverrides);
  assert.deepEqual(restored.confirmedGarmentMoqOverrides,custom.confirmedGarmentMoqOverrides);
  delete row.settings.generalMoq;delete row.settings.garmentMoqOverrides;delete row.settings.confirmedGarmentMoqOverrides;
  assert.equal(Object.hasOwn(await db.loadCustomisationSettingsFromDb(client),'garmentMoqOverrides'),false);
  await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const key='ceriga_mfg_full_profile_moq_tests';
  await page.addInitScript(({fixture,key})=>{
    localStorage.setItem('user',JSON.stringify({id:'moq-tests',email:'moq@example.test'}));
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));
  },{fixture,key});
  await page.goto(server.resolvedUrls.local[0]+'__garment-moq-test');
  const input = garment=>page.getByRole('spinbutton',{name:`${garment} MOQ`,exact:true});
  for(const garment of fixture.garments)assert.equal(await input(garment).inputValue(),'12');
  assert.equal(await page.getByText('Using General MOQ',{exact:true}).count(),4);
  await input('Hoodies').fill('30');await input('Sweatshirts').fill('26');
  // General MOQ is the first capacity number field in the existing layout.
  const generalInput=page.locator('input[type="number"]').first();
  await generalInput.fill('20');
  for(const [garment,value] of Object.entries({Hoodies:'30',Sweatshirts:'26','T-shirts':'20',Joggers:'20'}))assert.equal(await input(garment).inputValue(),value);
  assert.equal(await page.getByText('Custom MOQ',{exact:true}).count(),2);
  await page.reload();await input('Hoodies').waitFor();assert.equal(await input('Hoodies').inputValue(),'30');assert.equal(await input('Joggers').inputValue(),'20');
  await input('Hoodies').locator('xpath=../..').getByRole('button',{name:'Reset to General MOQ'}).click();
  assert.equal(await input('Hoodies').inputValue(),'20');
  await generalInput.fill('22');assert.equal(await input('Hoodies').inputValue(),'22');assert.equal(await input('Sweatshirts').inputValue(),'26');
  await page.evaluate(({key})=>{const p=JSON.parse(localStorage.getItem(key));p.garments.push('Jackets');localStorage.setItem(key,JSON.stringify(p));},{key});
  await page.reload();await input('Jackets').waitFor();assert.equal(await input('Jackets').inputValue(),'22');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  assert.deepEqual(saved.garmentMoqOverrides,{Sweatshirts:26});
  assert.equal(saved.monthlyCapacity,fixture.monthlyCapacity);assert.equal(saved.currentAvailableMonthlyCapacity,fixture.currentAvailableMonthlyCapacity);
  assert.equal(saved.maxSingleOrderQuantity,fixture.maxSingleOrderQuantity);assert.equal(saved.acceptingNewOrders,fixture.acceptingNewOrders);
  await page.evaluate(({key,legacy})=>localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)),...legacy,garments:['Hoodies','Sweatshirts','T-shirts']})),{key,legacy});
  await page.reload();await input('Hoodies').waitFor();
  for (const garment of ['Hoodies','Sweatshirts','T-shirts']) assert.equal(await input(garment).inputValue(),'12');
  assert.equal(await page.getByText('Saved MOQ — review required',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Keep as Custom MOQ'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Reset to General MOQ'}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: all garments inherit, intentional overrides persist, reset restores inheritance, new categories inherit, obsolete seeded values inherit without buttons, cloud round trips preserve provenance, capacity fields unchanged.');
} finally {await browser?.close();await server.close();}
