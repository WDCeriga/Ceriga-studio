import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const harness = '/__delete-actions.tsx';
const server = await createServer({
  cacheDir: 'node_modules/.vite-delete-tests',
  server: { host: '127.0.0.1', port: 5189 },
  plugins: [{
    name: 'delete-action-fixtures',
    enforce: 'pre',
    resolveId(id) { if (id === harness) return id; },
    load(id) {
      if (id.replaceAll('\\', '/').endsWith('/lib/supabaseClient.ts')) return `export const isSupabaseConfigured = true; export const getSupabase = () => globalThis.__testClient;`;
      if (id.replaceAll('\\', '/').endsWith('/hooks/useSuperadminData.ts')) return `
        import {useState} from 'react';
        import {MOCK_SUPER_ORDERS,MOCK_SUPER_USERS} from '/src/app/data/superadminMock.ts';
        export function useSuperadminData() {
          const [orders,setOrders]=useState(MOCK_SUPER_ORDERS.slice(0,1));
          const [users,setUsers]=useState(MOCK_SUPER_USERS.slice(0,1));
          const [manufacturerList,setManufacturers]=useState([{userId:'test-manufacturer',name:'Test Factory',email:'factory@example.test',status:'active',location:'London',country:'UK',garmentTypes:[],specialties:[],certifications:[],assignedOrders:0,moq:10,leadTimeDays:10,capacityUnitsPerMonth:100}]);
          return {orders,users,manufacturerList,manufacturers:[],loading:false,error:null,refresh:async()=>{},patchProfile:async()=>true,
            deleteOrder:async id=>{window.__deletions.push(id);setOrders(previous=>previous.filter(item=>item.id!==id));},
            deleteAccount:async id=>{window.__deletions.push(id);setUsers(previous=>previous.filter(item=>item.id!==id));setManufacturers(previous=>previous.filter(item=>item.userId!==id));}};
        }`;
      if (id !== harness) return;
      return `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {MemoryRouter} from 'react-router';
        import {Toaster} from 'sonner';
        import {SuperAdminOrders} from '/src/app/pages/superadmin/SuperAdminOrders.tsx';
        import {SuperAdminUsers} from '/src/app/pages/superadmin/SuperAdminUsers.tsx';
        import {SuperAdminManufacturers} from '/src/app/pages/superadmin/SuperAdminManufacturers.tsx';
        import {ManufacturerTeam} from '/src/app/pages/manufacturer/ManufacturerTeam.tsx';
        import {DeleteRecordButton} from '/src/app/components/DeleteRecordButton.tsx';
        import * as team from '/src/app/data/manufacturerPortalMock.ts';
        import * as db from '/src/app/lib/superadminDb.ts';
        import '/src/styles/index.css';
        window.__team=team;window.__db=db;window.__deletions=[];
        const pages={orders:SuperAdminOrders,users:SuperAdminUsers,manufacturers:SuperAdminManufacturers,team:ManufacturerTeam,
          failure:()=> <DeleteRecordButton label="Failure fixture" description="Confirm test deletion" onDelete={async()=>{throw new Error('Permission denied');}}/>};
        const Page=pages[new URLSearchParams(location.search).get('page')] || pages.orders;
        createRoot(document.getElementById('root')).render(<MemoryRouter><Page/><Toaster/></MemoryRouter>);
      `;
    },
    configureServer(vite) {
      vite.middlewares.use('/__delete-test', async (req, res, next) => {
        try {
          res.setHeader('Content-Type','text/html');
          res.end(await vite.transformIndexHtml('/__delete-test', `<html><body><div id="root"></div><script type="module" src="${harness}"></script></body></html>`));
        } catch(error) { next(error); }
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel:'msedge',headless:true });
  const page = await browser.newPage();
  const errors=[];page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('user', JSON.stringify({id:'delete-tests',email:'delete-tests@example.test',name:'Test Admin'})));
  const url=server.resolvedUrls.local[0]+'__delete-test';
  for (const name of ['orders','users','manufacturers']) {
    await page.goto(url+'?page='+name);
    const button=page.getByRole('button',{name:/^Delete /}).first();
    await button.click();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.__deletions),[]);
    await button.click();
    await page.getByRole('button',{name:'Delete',exact:true}).click();
    await button.waitFor({state:'detached'});
    assert.equal((await page.evaluate(()=>window.__deletions)).length,1, name+' deletes exactly once');
    assert.equal(await page.getByRole('button',{name:/^Delete /}).count(),0,name+' removes final record');
  }
  await page.goto(url+'?page=failure');
  await page.getByRole('button',{name:'Delete Failure fixture'}).click();
  await page.getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByText('Permission denied',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Delete Failure fixture'}).isEnabled(),true);
  await page.goto(url+'?page=team');
  await page.getByRole('heading',{name:'Team & roles'}).waitFor();
  await page.evaluate(()=>window.__team.inviteTeamMember({name:'Disposable Member',email:'remove@example.test',role:'viewer'}));
  await page.reload();
  await page.getByRole('button',{name:'Delete Disposable Member'}).click();
  await page.getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByText('Disposable Member',{exact:true}).waitFor({state:'detached'});
  await page.reload();
  assert.equal(await page.getByText('Disposable Member',{exact:true}).count(),0,'team deletion persists');
  const guards=await page.evaluate(()=>{
    const api=window.__team;
    const acting=api.getActingFactoryMember();
    let selfProtected=false, permissionProtected=false;
    try {api.deleteTeamMember(acting.id);}catch{selfProtected=true;}
    api.inviteTeamMember({name:'Protected',email:'protected@example.test',role:'viewer'});
    const target=api.getFactoryWorkspace().team.find(item=>item.email==='protected@example.test');
    api.updateTeamMemberPermissions(acting.id,['view_stats']);
    try {api.deleteTeamMember(target.id);}catch{permissionProtected=true;}
    api.resetTeamMemberPermissions(acting.id);
    return {selfProtected,permissionProtected};
  });
  assert.deepEqual(guards,{selfProtected:true,permissionProtected:true});
  const results=await page.evaluate(async()=>{
    const db=window.__db;
    const results=[];
    window.__testClient={from:()=>({delete:()=>({eq:()=>({select:async()=>({data:[{id:'order'}],error:null})})})})};
    await db.adminDeleteOrder('order');results.push('order deleted');
    window.__testClient={from:()=>({delete:()=>({eq:()=>({select:async()=>({data:[],error:null})})})})};
    try {await db.adminDeleteOrder('missing');}catch{results.push('empty delete rejected');}
    window.__testClient={functions:{invoke:async()=>({data:{deleted:true},error:null})}};
    await db.adminDeleteAccount('account');results.push('account deleted');
    window.__testClient={functions:{invoke:async()=>({error:{message:'generic',context:new Response(JSON.stringify({error:'Account owns orders'}))}})}};
    try {await db.adminDeleteAccount('blocked');}catch(error){results.push(error.message);}
    window.__testClient={from:()=>({select:()=>({eq(){return this;},not:async()=>({data:[],error:null}),order:async()=>({data:[],error:null})})})};
    results.push((await db.fetchAllUsers()).length);
    results.push((await db.fetchManufacturerList()).length);
    window.__testClient={from:()=>({select:()=>({order:async()=>({data:null,error:{code:'PGRST205',message:"Could not find the table 'public.profiles' in the schema cache"}})})})};
    try {await db.fetchAllUsers();}catch(error){results.push(error.message.includes('repair_user_profiles.sql'));}
    window.__testClient={from:()=>({select:()=>({order:async()=>({data:null,error:{message:'Permission denied for profiles'}})})})};
    try {await db.fetchAllUsers();}catch(error){results.push(error.message);}
    window.__testClient={from:()=>({select:()=>({order:async()=>({data:[{id:'legacy',full_name:null,email:null,role:'brand',created_at:null,updated_at:null}],error:null})})})};
    const legacy=(await db.fetchAllUsers())[0];
    results.push([legacy.name,legacy.email,legacy.credits,legacy.createdAt,legacy.lastActive]);
    window.__testClient={from:table=>({select:columns=>{
      if(columns.includes('manufacturer_profiles (')) throw new Error('Undeclared embedded relationship');
      if(table==='manufacturer_profiles') return Promise.resolve({data:[{user_id:'factory-account',factory_name:'Actual Factory',onboarding_complete:true,moq:25,monthly_capacity:400,garments:['Hoodies']}],error:null});
      if(table==='orders') return {not:async()=>({data:[{assigned_manufacturer_id:'factory-account'}],error:null})};
      return {eq(){return this;},order:async()=>({data:[{id:'factory-account',email:'factory@example.test',created_at:'2026-10-17',updated_at:'2026-10-17'}],error:null})};
    }})};
    const manufacturer=(await db.fetchManufacturerList())[0];
    const account=(await db.fetchManufacturerAccounts())[0];
    results.push([manufacturer.name,manufacturer.assignedOrders,manufacturer.status,account.factoryName,account.moq]);
    return results;
  });
  assert.deepEqual(results,['order deleted','empty delete rejected','account deleted','Account owns orders',0,0,true,'Permission denied for profiles',['User','',0,'',''],['Actual Factory',1,'active','Actual Factory',25]]);
  assert.deepEqual(errors,[]);
  console.log('PASS: all admin delete controls, cancel, last-row removal, errors, team persistence/permissions and database deletion results');
} finally {
  await browser?.close();
  await server.close();
}
