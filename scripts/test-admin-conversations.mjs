import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const entry='/__conversation-harness.tsx';
const server=await createServer({cacheDir:'node_modules/.vite-conversation-tests',server:{host:'127.0.0.1',port:5191},plugins:[{
  name:'conversation-fixtures',enforce:'pre',resolveId(id){if(id===entry)return id;},
  load(id){const path=id.replaceAll('\\','/');
    if(path.endsWith('/hooks/useSuperadminData.ts'))return `export function useSuperadminData(){return {users:[{id:'test-brand',name:'Test Brand',email:'brand@example.test',role:'brand'}],manufacturerList:[{userId:'test-factory',name:'Test Factory',email:'factory@example.test'}]};}`;
    if(path.endsWith('/lib/alibabaChat.ts'))return `export const getAlibabaConnectionStatus=async()=>({configured:false});export const syncAlibabaInbox=async()=>({conversations:0});`;
    if(path.endsWith('/lib/sharedMessages.ts'))return `export const subscribeChatUpdates=()=>()=>{};`;
    if(path.endsWith('/lib/adminChatDb.ts'))return `
      export const listAdminChatThreads=async()=>JSON.parse(localStorage.getItem('__conversation_fixture')||'[]');
      export const listAdminChatMessages=async()=>[];export const markAdminThreadRead=async()=>{};export const sendAdminChatMessage=async()=>{};
      export async function createAdminChatThread(input){window.__createAttempts=(window.__createAttempts||0)+1;await new Promise(resolve=>setTimeout(resolve,150));if(window.__createFailure)throw {message:'Conversation permission denied'};const row={id:'conversation-fixture',name:input.subject,type:input.participantType==='manufacturer'?'manufacturer':'user',channel:'ceriga',subtitle:'Brand',lastMessage:'No messages yet',lastAt:'Now',unread:0,messages:[]};localStorage.setItem('__conversation_fixture',JSON.stringify([row]));return row;}`;
    if(id===entry)return `import React from 'react';import {createRoot} from 'react-dom/client';import {Toaster} from 'sonner';import {SuperAdminMessages} from '/src/app/pages/superadmin/SuperAdminMessages.tsx';import '/src/styles/index.css';createRoot(document.getElementById('root')).render(<><SuperAdminMessages/><Toaster/></>);`;
  },configureServer(vite){vite.middlewares.use('/__conversation-test',async(req,res,next)=>{try{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__conversation-test',`<html><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));}catch(error){next(error);}});}
}]});
let browser;
try{
  await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'__conversation-test');
  await page.getByRole('button',{name:'Manufacturer',exact:true}).click();
  await page.getByRole('button',{name:'New conversation',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Search manufacturers…').fill('brand@example.test');
  assert.equal(await dialog.getByRole('button',{name:/Test Brand/}).count(),0);
  await dialog.getByPlaceholder('Search manufacturers…').fill('factory@example.test');
  await page.evaluate(()=>{window.__createFailure=true;});
  await dialog.getByRole('button',{name:/Test Factory/}).click();
  assert.equal(await dialog.getByRole('button',{name:/Test Factory/}).isDisabled(),true);
  await dialog.getByRole('alert').filter({hasText:'Conversation permission denied'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('__conversation_fixture')),null);
  await page.evaluate(()=>{window.__createFailure=false;});
  await dialog.getByRole('button',{name:/Test Factory/}).click();
  await dialog.waitFor({state:'detached'});
  await page.getByText('Started conversation with Test Factory',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__createAttempts),2,'one failed attempt and one successful attempt');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('__conversation_fixture')).length),1);
  assert.ok(await page.getByText('Test Factory',{exact:true}).count()>0,'new thread visible after clearing prior filter');
  await page.reload();await page.getByText('Test Factory',{exact:true}).first().waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: recipient search, duplicate-click prevention, readable errors, retry, active-thread filtering and persisted conversations');
}finally{await browser?.close();await server.close();}
