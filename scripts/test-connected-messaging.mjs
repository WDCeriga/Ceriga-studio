import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const entry='/__connected-messaging-harness.tsx';
const clientFixture=`
const actor=new URLSearchParams(location.search).get('actor')||'a';
const people=[{id:'a',full_name:'Test Brand',role:'brand',email:'brand@example.test'},{id:'b',full_name:'Test Factory',role:'manufacturer',email:'factory@example.test'},{id:'admin',full_name:'Ceriga',role:'brand',email:'admin@example.test'},{id:'worker',full_name:'Test Worker',role:'worker',email:'worker@example.test'}];
const read=()=>JSON.parse(localStorage.getItem('__shared_db')||'{}');const write=db=>localStorage.setItem('__shared_db',JSON.stringify(db));
function query(table){let filters=[],operation='read',payload,single=false;
const q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},neq(k,v){filters.push(row=>row[k]!==v);return q;},in(k,v){filters.push(row=>v.includes(row[k]));return q;},order(){return q;},insert(value){operation='insert';payload=value;return q;},update(value){operation='update';payload=value;return q;},single(){single=true;return q;},then(resolve,reject){return execute().then(resolve,reject);}};
async function execute(){const db=read();let rows=table==='profiles'?people:(db[table]||[]);if(operation==='insert'){
 const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...payload};
 if(table==='admin_chat_threads')Object.assign(row,{recipient_user_id:null,last_message_at:row.created_at,unread_admin:0});
 if(table==='admin_chat_messages'){row.sender_user_id=actor;row.sender=actor==='admin'?'admin':'participant';const thread=(db.admin_chat_threads||[]).find(t=>t.id===row.thread_id);thread.last_message=row.body||'Attachment';thread.last_message_at=row.created_at;thread.unread_admin=actor==='admin'?0:(thread.unread_admin||0)+1;}
 db[table]=[...(db[table]||[]),row];write(db);rows=[row];
 }else if(operation==='update'){let changed=false;rows.forEach(row=>{if(filters.every(f=>f(row))){Object.assign(row,payload);changed=true;}});if(changed)write(db);}
 if(table==='admin_chat_threads')rows=rows.filter(t=>actor==='admin'||(actor!=='a'&&t.participant_user_id==='b'));
 if(table==='admin_chat_messages')rows=rows.filter(m=>(db.admin_chat_threads||[]).some(t=>t.id===m.thread_id&&(actor==='admin'||(actor!=='a'&&t.participant_user_id==='b'))));
 rows=rows.filter(row=>filters.every(f=>f(row)));return {data:single?rows[0]:rows,error:null};}return q;}
export const isSupabaseConfigured=true;
export const getSupabase=()=>({auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},from:query,
rpc:async(name,args)=>{if(name==='messaging_enabled')return {data:actor!=='a',error:null};if(name==='chat_contacts')return {data:actor==='a'?[]:[{id:'b',name:actor==='admin'?'Test Factory':'Ceriga Support',role:'manufacturer'}],error:null};if(name==='start_chat'){if(actor==='a')return {data:null,error:{message:'Messaging unavailable'}};const db=read();let thread=(db.admin_chat_threads||[]).find(t=>t.participant_user_id==='b'&&t.recipient_user_id===null);if(!thread){thread={id:crypto.randomUUID(),participant_user_id:'b',recipient_user_id:null,participant_type:'manufacturer',channel:'ceriga',subject:'Conversation',last_message:'',last_message_at:new Date().toISOString(),unread_admin:0};db.admin_chat_threads=[...(db.admin_chat_threads||[]),thread];write(db);}return {data:thread.id,error:null};}},
channel:()=>{const channel={callback:null,on(_event,_filter,callback){channel.callback=callback;return channel;},subscribe(){channel.listener=event=>{if(event.key==='__shared_db')channel.callback?.();};window.addEventListener('storage',channel.listener);return channel;}};return channel;},removeChannel:async channel=>window.removeEventListener('storage',channel.listener),
storage:{from:()=>({upload:async(path,blob)=>{const db=read();db.files={...(db.files||{}),[path]:btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))};write(db);return {error:null};},createSignedUrl:async path=>({data:{signedUrl:'data:text/plain;base64,'+read().files[path]},error:null})})}});
`;
const server=await createServer({cacheDir:'node_modules/.vite-connected-tests',server:{host:'127.0.0.1',port:5192},plugins:[{
 name:'connected-message-fixtures',enforce:'pre',resolveId(id){if(id===entry)return id;},load(id){const path=id.replaceAll('\\','/');
 if(path.endsWith('/lib/supabaseClient.ts'))return clientFixture;
 if(path.endsWith('/contexts/AuthContext.tsx'))return `export function useAuth(){const id=new URLSearchParams(location.search).get('actor')||'a';return {authReady:true,isAuthenticated:true,usingSupabase:true,user:{id,email:id+'@example.test',name:id,role:id==='b'?'manufacturer':'brand'}};}`;
 if(path.endsWith('/hooks/useSuperadminData.ts'))return `export function useSuperadminData(){return {users:[],manufacturerList:[]};}`;
 if(path.endsWith('/lib/alibabaChat.ts'))return `export const getAlibabaConnectionStatus=async()=>({configured:false});export const syncAlibabaInbox=async()=>({conversations:0});export const sendAlibabaMessage=async()=>{};`;
 if(id===entry)return `import React from 'react';import {createRoot} from 'react-dom/client';import {Toaster} from 'sonner';import {MemberMessages} from '/src/app/components/MemberMessages.tsx';import {SuperAdminMessages} from '/src/app/pages/superadmin/SuperAdminMessages.tsx';import '/src/styles/index.css';const Page=new URLSearchParams(location.search).get('actor')==='admin'?SuperAdminMessages:MemberMessages;createRoot(document.getElementById('root')).render(<><Page/><Toaster/></>);`;
 },configureServer(vite){vite.middlewares.use('/__connected-test',async(req,res,next)=>{try{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__connected-test',`<html><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));}catch(error){next(error);}});}
}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();
 const brand=await context.newPage(),factory=await context.newPage(),team=await context.newPage(),admin=await context.newPage();const errors=[];for(const page of [brand,factory,team,admin])page.on('pageerror',error=>errors.push(error.message));
 const url=server.resolvedUrls.local[0]+'__connected-test';await Promise.all([brand.goto(url+'?actor=a'),factory.goto(url+'?actor=b'),team.goto(url+'?actor=worker'),admin.goto(url+'?actor=admin')]);
 await brand.getByText('Messaging is available to manufacturers, their teams and Ceriga administrators.',{exact:true}).waitFor();assert.equal(await brand.getByRole('button',{name:'New conversation'}).count(),0);
 await factory.getByRole('button',{name:'New conversation',exact:true}).click();await factory.getByRole('dialog').getByRole('button',{name:/Ceriga Support/}).click();await factory.getByRole('dialog').waitFor({state:'detached'});
 await factory.getByRole('textbox',{name:'Message',exact:true}).fill('Factory to Ceriga');await factory.getByRole('button',{name:'Send',exact:true}).click();await team.getByRole('log').getByText('Factory to Ceriga',{exact:true}).waitFor();
 await team.getByRole('textbox',{name:'Message',exact:true}).fill('Teammate reply');await team.getByRole('button',{name:'Send',exact:true}).click();await factory.getByRole('log').getByText('Teammate reply',{exact:true}).waitFor();
 await team.getByLabel('Attach files',{exact:true}).setInputFiles({name:'shared.txt',mimeType:'text/plain',buffer:Buffer.from('Team attachment')});await team.getByRole('button',{name:'Send',exact:true}).click();await factory.getByRole('log').getByRole('link',{name:'shared.txt',exact:true}).waitFor();
 await admin.getByRole('button').filter({hasText:'Test Factory'}).first().click();await admin.getByText('Teammate reply',{exact:true}).waitFor();await admin.getByPlaceholder('Write a message…').fill('Ceriga response');await admin.getByRole('button',{name:'Send',exact:true}).click();await factory.getByRole('log').getByText('Ceriga response',{exact:true}).waitFor();await team.getByRole('log').getByText('Ceriga response',{exact:true}).waitFor();
 await team.reload();await team.getByRole('log').getByText('Ceriga response',{exact:true}).waitFor();assert.equal(await brand.getByRole('log').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: brands blocked; factory, teammate and admin share persisted replies and private attachments');
}finally{await browser?.close();await server.close();}
