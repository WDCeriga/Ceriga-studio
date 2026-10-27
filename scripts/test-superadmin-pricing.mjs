import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const entry='/__pricing-harness.tsx';
const server=await createServer({cacheDir:'node_modules/.vite-pricing-tests',server:{host:'127.0.0.1',port:5190},plugins:[{
  name:'pricing-fixtures',enforce:'pre',
  resolveId(id){if(id===entry)return id;},
  load(id){
    const path=id.replaceAll('\\','/');
    if(path.endsWith('/hooks/useSuperadminData.ts'))return `
      import {useState,useEffect} from 'react';
      export function useSuperadminData(){const [loading,setLoading]=useState(true);useEffect(()=>{setLoading(false);},[]);return {orders:[],loading};}`;
    if(path.endsWith('/lib/superadminDb.ts'))return `
      export async function getPlatformSetting(){await new Promise(resolve=>setTimeout(resolve,25));if(window.__loadFailure)throw {message:'Pricing read failed'};return JSON.parse(localStorage.getItem('__pricing_fixture')||'null');}
      export async function setPlatformSetting(key,value){if(window.__saveFailure)throw {message:'Pricing save failed'};localStorage.setItem('__pricing_fixture',JSON.stringify(value));}`;
    if(id===entry)return `
      import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router';import {Toaster} from 'sonner';
      import {SuperAdminPricing} from '/src/app/pages/superadmin/SuperAdminPricing.tsx';
      import {getPricingConfig} from '/src/app/data/superadminPricingMock.ts';
      import '/src/styles/index.css';window.__getPricingConfig=getPricingConfig;
      createRoot(document.getElementById('root')).render(<MemoryRouter><SuperAdminPricing/><Toaster/></MemoryRouter>);`;
  },
  configureServer(vite){vite.middlewares.use('/__pricing-test',async(req,res,next)=>{try{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__pricing-test',`<html><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));}catch(error){next(error);}});},
}]});
let browser;
try{
  await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.__loadFailure=true;window.__saveFailure=false;});
  let rateRequests=0;
  await page.route('https://api.frankfurter.dev/**',route=>{rateRequests++;return route.abort();});
  await page.goto(server.resolvedUrls.local[0]+'__pricing-test');
  await page.getByRole('alert').filter({hasText:'Pricing read failed'}).waitFor({timeout:10000}).catch(async error=>{console.log({errors,body:(await page.locator('body').innerText()).slice(0,500)});throw error;});
  assert.equal(await page.getByRole('button',{name:'Save all rules'}).isEnabled(),false);
  await page.evaluate(()=>{window.__loadFailure=false;});await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.getByRole('button',{name:'Save all rules'}).waitFor();assert.equal(await page.getByRole('button',{name:'Save all rules'}).isEnabled(),true);
  const calculator=page.getByRole('region',{name:'Quote calculator',exact:true});
  assert.equal(await calculator.getByLabel('Currency',{exact:true}).inputValue(),'USD');
  assert.equal(await calculator.getByRole('button',{name:'Add row',exact:true}).count(),0);
  assert.equal(await calculator.getByRole('table').count(),0);
  await calculator.getByLabel('Price per item (USD)',{exact:true}).fill('50');
  await calculator.getByLabel('Quantity',{exact:true}).fill('30');
  const finalPrice=calculator.locator('div').filter({has:page.locator('dt').filter({hasText:/^Final price$/})}).last().locator('dd');
  assert.match(await finalPrice.innerText(),/1\.602,00/);
  await calculator.getByLabel('Results currency',{exact:true}).selectOption('USD');
  assert.equal(await finalPrice.innerText(),'US$1,800.00');
  await calculator.getByLabel('Results currency',{exact:true}).selectOption('GBP');
  await calculator.getByText('Fixed rate: 1 GBP = 1.18 EUR',{exact:true}).waitFor();
  assert.equal(await calculator.getByLabel('Results GBP → EUR rate',{exact:true}).count(),0);
  assert.equal(await finalPrice.innerText(),'£1,357.63');
  const amounts=await calculator.locator('dd').allTextContents();
  assert.deepEqual(amounts,['£37.71','£7.54','£45.25','£1,357.63','£226.27']);
  assert.equal(await calculator.getByRole('button',{name:'Refresh GBP rate',exact:true}).count(),0);
  await calculator.getByLabel('Results currency',{exact:true}).selectOption('EUR');
  await calculator.getByLabel('Currency',{exact:true}).selectOption('EUR');
  assert.equal(await calculator.getByLabel('EUR → EUR rate',{exact:true}).isDisabled(),true);
  assert.match(await finalPrice.innerText(),/1\.800,00/);
  await calculator.getByLabel('Currency',{exact:true}).selectOption('GBP');
  assert.equal(await calculator.getByLabel('GBP → EUR rate',{exact:true}).count(),0);
  assert.match(await finalPrice.innerText(),/2\.124,00/);
  assert.equal(await calculator.getByText('Fixed rate: 1 GBP = 1.18 EUR',{exact:true}).count(),1);
  await calculator.getByLabel('Quantity',{exact:true}).fill('1.5');
  await calculator.getByRole('alert').filter({hasText:'whole-number quantity'}).waitFor();
  assert.equal(await finalPrice.innerText(),'—');
  await calculator.getByLabel('Quantity',{exact:true}).fill('1');
  await calculator.getByLabel('Currency',{exact:true}).selectOption('USD');
  assert.equal(await calculator.getByLabel('USD → EUR rate',{exact:true}).inputValue(),'0.89');
  await page.locator('input[value="29.00"]').fill('35');
  await page.evaluate(()=>{window.__saveFailure=true;});await page.getByRole('button',{name:'Save all rules'}).click();
  await page.getByText('Pricing save failed',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__getPricingConfig().techPack.pdfCents),2900,'failed save does not change active prices');
  assert.equal(await page.evaluate(()=>localStorage.getItem('__pricing_fixture')),null);
  await page.evaluate(()=>{window.__saveFailure=false;});await page.getByRole('button',{name:'Save all rules'}).click();
  await page.getByText('Pricing rules saved',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('__pricing_fixture')).techPack.pdfCents),3500);
  assert.equal(await page.evaluate(()=>window.__getPricingConfig().techPack.pdfCents),3500);
  await page.reload();await page.getByRole('button',{name:'Retry',exact:true}).waitFor();await page.evaluate(()=>{window.__loadFailure=false;});await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('input[value="35.00"]').waitFor();
  assert.deepEqual(errors,[],'loading-to-ready renders must not violate hook order');
  assert.equal(rateRequests,0,'fixed GBP rate requires no exchange-rate requests');
  console.log('PASS: pricing loading, hook order, retry, failed-save isolation and persisted save/reload');
}finally{await browser?.close();await server.close();}
