import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

const path='supabase/functions/factory-order-document/index.ts';
const {code}=await transformWithEsbuild(await fs.readFile(path,'utf8'),path,{format:'cjs'});
const orderId='11111111-1111-1111-1111-111111111111';
const documentId='22222222-2222-2222-2222-222222222222';
const factoryId='33333333-3333-3333-3333-333333333333';
let handler, auth=true, permission=true, attempts=0, filter=[], missing=false;
const objectPath='private-id/private-order/private-customer-name.png';
const actor={auth:{getUser:async()=>({data:{user:auth?{id:'actor'}:null}})},rpc:async(name,args)=>{
  assert.equal(name,'factory_authorize_order_document');
  assert.deepEqual(args,{p_order:orderId,p_document:documentId});
  return {data:permission?factoryId:null};
}};
const server={from:name=>{
  assert.equal(name,'factory_order_documents');
  const query={select:()=>query,eq:(key,value)=>{filter.push([key,value]);return query;},maybeSingle:async()=>({data:missing?null:{storage_path:objectPath}})};
  return query;
},storage:{from:bucket=>({download:async path=>{
  assert.equal(bucket,'order-uploads');assert.equal(path,objectPath);attempts++;
  return {data:new Blob(['mock png'],{type:'image/png'})};
}})}};
const Deno={env:{get:key=>key},serve:callback=>{handler=callback;}};
new Function('require','Deno',code)(()=>({createClient:(_url,key,options)=>{
  if(key==='SUPABASE_SERVICE_ROLE_KEY')return server;
  assert.equal(options.global.headers['x-ceriga-factory'],factoryId);
  return actor;
}}),Deno);
const request=(body={orderId,documentId,factoryId},authorization='Bearer mock')=>handler(new Request('https://example.invalid',{method:'POST',headers:authorization?{Authorization:authorization}:{},body:JSON.stringify(body)}));
assert.equal((await request({},'')).status,400);
assert.equal((await request(undefined,'')).status,401);
auth=false;assert.equal((await request()).status,401);auth=true;
permission=false;assert.equal((await request()).status,403);permission=true;
missing=true;assert.equal((await request()).status,404);missing=false;
assert.equal(attempts,0);filter=[];
const ok=await request();
assert.equal(ok.status,200);assert.equal(ok.headers.get('content-type'),'application/octet-stream');
assert.equal(ok.headers.get('x-ceriga-file-type'),'image/png');
assert.equal(ok.headers.get('content-disposition'),'attachment');assert.equal(await ok.text(),'mock png');
assert.deepEqual(filter,[['id',documentId],['order_id',orderId],['manufacturer_id',factoryId]]);
assert.doesNotMatch(JSON.stringify([...ok.headers]),/private-customer-name|private-id/);
console.log('PASS factory document proxy validates identity and permission before storage and streams opaque downloads');
