import assert from 'node:assert/strict';
import {chromium} from '../node_modules/.cache/artwork-e2e/node_modules/playwright/index.mjs';

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('crash',()=>errors.push('Browser page crashed'));
 await page.goto((process.env.STUDIO_URL??'http://127.0.0.1:5173')+'/builder/tk-001?builder=redesign');
 for(let cycle=0;cycle<3;cycle++){
  for(const fit of ['Slim','Regular','Boxy','Oversized']){
   const button=page.getByRole('group',{name:'Fit preset',exact:true}).getByRole('button',{name:fit,exact:true});
   await button.click({timeout:10000});
   await page.waitForTimeout(200);
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   // A queued browser task must still complete after Oversized renders.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  await page.getByRole('button',{name:cycle%2?'Front':'Back',exact:true}).click({timeout:10000});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS 12 fit switches across front/back, including repeated Oversized, with responsive rendering and no crashes');
}finally{await browser.close()}
