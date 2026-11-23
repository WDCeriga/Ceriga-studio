process.on('uncaughtException',e=>{console.error(e.message,e.where??'');process.exit(1)});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase();
const [admin,buyer,factory,other]=Array.from({length:4},()=>randomUUID());
const actor=id=>asAccount(db,id,id===admin?'owner@ceriga.io':'fixture@example.invalid');
let order;
const work=(kind,action='read',row=null,data={})=>db.query('select public.internal_order_work($1,$2,$3,$4,$5,$6) value',[order,kind,action,row?.id??null,row?.revision??null,data]).then(r=>r.rows[0].value);
const message=async(scope,action,id,version,proposal=null)=>{
 const actual=version===0?0:(await db.query('select public.order_communication_history($1,$2) value',[order,scope])).rows[0].value.find(row=>row.id===id).version;
 return db.query('select public.order_communication_localized_action($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[order,scope,action,id,actual,'Please confirm this quantity.','moq',proposal,[],false,'en']);
};
try{
 for(const id of [admin,buyer,factory,other])await db.query('insert into auth.users(id,email)values($1,$2)',[id,id===admin?'owner@ceriga.io':id+'@example.invalid']);
 await db.query("insert into manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,moq,calendar_workdays)values($1,'Factory','active',true,array['T-shirts'],1,array[1,2,3,4,5,6,7])",[factory]);
 await actor(buyer);
 order=(await db.query('select public.create_customer_order($1) value',[{kind:'production',product_name:'Internal work fixture',garment_type:'T-shirts',order_quantities:{mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:1}},bulkRuns:[]}}])).rows[0].value.id;
 await assert.rejects(work('shipping_preparation'),/access denied/);
 await actor(admin);await db.query('select public.assign_order_manufacturer($1,$2,current_date+3)',[order,factory]);
 let draft=await work('shipping_preparation','create');assert.equal(draft.state,'draft');
 assert.equal((await work('shipping_preparation','create')).id,draft.id);
 const saved=await work('shipping_preparation','save',draft,{carrier:'Selected carrier',collection_at:'2099-01-01T10:00:00Z',note:'Draft preparation; no transport booked.'});
 await assert.rejects(work('shipping_preparation','save',draft,{note:'Stale overwrite'}),/changed/);
 assert.equal((await work('shipping_preparation'))[0].details.carrier,'Selected carrier');
 await assert.rejects(work('amendment','create',null,{request_id:randomUUID()}),/accepted proposal/);
 const request=randomUUID();await actor(factory);await message('manufacturer','submit',request,0,{field:'quantity',current:'1',proposed:'2'});
 await actor(admin);await message('admin','approve',request,1,{field:'quantity',current:'1',proposed:'2'});
 await actor(buyer);await message('customer','accept',request,2);
 await actor(admin);await assert.rejects(work('amendment','create',null,{request_id:request}),/share/);
 await message('admin','share_reply',request,3);
 const before=(await db.query('select order_quantities,specifications,price_options,status from account_orders where id=$1',[order])).rows[0];
 let revision=await work('amendment','create',null,{request_id:request});assert.equal(revision.request_id,request);
 assert.equal((await work('amendment','create',null,{request_id:request})).id,revision.id);
 await assert.rejects(work('amendment','resolve',revision),/reference/);
 revision=await work('amendment','save',revision,{note:'Revision review required',reference:'Existing quotation revision / test-reference'});
 await work('amendment','resolve',revision);
 assert.deepEqual((await db.query('select order_quantities,specifications,price_options,status from account_orders where id=$1',[order])).rows[0],before);
 assert.ok((await db.query("select *from admin_record_activity where record_id=$1 and action='internal_work_insert'",[order])).rows.length);
 for(const id of [factory,buyer,other]){
  await actor(id);await assert.rejects(work('shipping_preparation'),/access denied/);
  assert.equal((await db.query('select *from order_internal_work where order_id=$1',[order])).rows.length,0);
 }
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/20261123030000_internal_order_coordination.sql','utf8'));
 await actor(admin);assert.equal((await work('amendment')).length,1);
 assert.equal((await work('shipping_preparation'))[0].revision,saved.revision);
 console.log('PASS independent shipping draft, accepted/shared consent requirement, idempotent linked revision, stale-write rejection, audit, record isolation and no silent commercial changes.');
}finally{await db.close();}
