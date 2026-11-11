process.on('uncaughtException',e=>{console.error(e.message,e.where||'',e.internalQuery||'');process.exit(1)});
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {testDatabase,asAccount}from './support/testDatabase.mjs';
const db=await testDatabase();const migration=await fs.readFile('supabase/migrations/20261101010000_freight_quotation_integration.sql','utf8');await db.exec(migration);
const simplified = await fs.readFile("supabase/migrations/20261104010000_simplify_manufacturer_shipping_terms.sql", "utf8");
await db.exec(simplified);
const fulfilment = await fs.readFile('supabase/migrations/20261105010000_manufacturer_fulfilment_pipeline.sql','utf8');
await db.exec(fulfilment);
await db.exec(await fs.readFile('supabase/migrations/20261105020000_include_released_orders_in_fulfilment.sql','utf8'));
const board = (filter='active',search='') => rpc('factory_fulfilment_board','$1,$2,0',[search,filter]);
const buyer='11111111-1111-1111-1111-111111111111',factory='22222222-2222-2222-2222-222222222222',other='33333333-3333-3333-3333-333333333333',admin='44444444-4444-4444-4444-444444444444',oid='66666666-6666-6666-6666-666666666666';
const actor=async(id)=>asAccount(db,id,id===admin?'owner@ceriga.io':id===factory?'factory@example.invalid':'account@example.invalid');
const rpc=async(name,args,vals=[])=>(await db.query(`select public.${name}(${args}) result`,vals)).rows[0].result;
await db.exec(`insert into auth.users(id,email)values('${buyer}','buyer@example.invalid'),('${factory}','factory@example.invalid'),('${other}','other@example.invalid'),('${admin}','owner@ceriga.io');insert into manufacturer_profiles(user_id,factory_name,onboarding_complete,status)values('${factory}','Freight factory',true,'active');update profiles set preferred_currency='USD'where id='${factory}';update profiles set preferred_currency='GBP'where id='${buyer}';insert into orders(id,user_id,kind,product_name,garment_type,status,status_label,order_quantities)values('${oid}','${buyer}','production','Freight test','T-shirts','submitted','Submitted','{"sample":{"id":"sample","kind":"sample","targetTotal":10}}');select set_config('app.routing_write','${oid}',false);update orders set assigned_manufacturer_id='${factory}',factory_status='new'where id='${oid}';update currency_rate_cache set rates='{"EUR":"1","USD":"1.2","GBP":"0.8"}',retrieved_at=now(),rate_date=current_date;`);
const terms={priceCents:1200,currency:'USD',provider:'Factory carrier',method:'Air',origin:'Porto, Portugal',destination:'London, UK',transitDays:5,weightKg:12,lengthCm:50,widthCm:40,heightCm:30,cartons:2,insurance:'Included up to 1000',services:'Door to door',tradeTerms:'DAP; duties charged to recipient',validUntil:'2099-01-01'};
const core = Object.fromEntries(['priceCents','currency','provider','method','origin','destination'].map(key => [key, terms[key]]));
const tier={id:'sample',kind:'sample',totalUnits:10,unitPriceCents:1000,currency:'USD',leadTimeDays:7,shipping:core};
await actor(factory);assert.deepEqual((await board()).orders,[]);await assert.rejects(rpc('submit_manufacturer_quote','$1,$2::jsonb',[oid,JSON.stringify([{...tier,shipping:null}])]),/shipping|provider/i);await rpc('submit_manufacturer_quote','$1,$2::jsonb',[oid,JSON.stringify([tier])]);
const own=await rpc('freight_context','$1',[oid]);assert.deepEqual(own.manufacturerQuotes[0].shipping,core);assert.equal(own.quotes.length,0);
await actor(other);await assert.rejects(board(),/authorised factory/);await assert.rejects(rpc('freight_context','$1',[oid]),/access denied/);await assert.rejects(rpc('freight_add_quote','$1,$2,$3::jsonb',[oid,'sample',JSON.stringify(terms)]),/authorization/);assert.equal((await db.query('select *from freight_forwarders')).rows.length,0);
await actor(admin);await assert.rejects(rpc('publish_order_quote','$1,$2::jsonb',[oid,'[{"id":"sample","cents":12000}]']),/Confirm valid shipping/);
let q=await rpc('freight_add_quote','$1,$2,$3::jsonb',[oid,'sample',JSON.stringify(terms)]);await rpc('freight_select','$1,$2',[oid,q]);
const factoryPreview = await rpc('freight_prepare_prices','$1,$2::jsonb',[oid,'[{"id":"sample","cents":12000}]']);
assert.equal(factoryPreview[0].publicShipping.transitDays,null);
assert.equal(factoryPreview[0].publicShipping.provider,core.provider);
const f=(await db.query("insert into freight_forwarders(company_name)values('Alternative')returning id")).rows[0].id;const alt={...terms,provider:'Alternative',priceCents:1000,transitDays:3};q=await rpc('freight_add_quote','$1,$2,$3::jsonb,$4',[oid,'sample',JSON.stringify(alt),f]);await rpc('freight_select','$1,$2',[oid,q]);
await actor(factory);await rpc('submit_manufacturer_quote','$1,$2::jsonb',[oid,JSON.stringify([tier])]);await actor(admin);await assert.rejects(rpc('freight_select','$1,$2',[oid,q]),/earlier manufacturer quotation/);q=await rpc('freight_add_quote','$1,$2,$3::jsonb,$4',[oid,'sample',JSON.stringify(alt),f]);assert.equal(await rpc('freight_add_quote','$1,$2,$3::jsonb,$4',[oid,'sample',JSON.stringify(alt),f]),q);await rpc('freight_select','$1,$2',[oid,q]);await actor(buyer);await assert.rejects(rpc('freight_prepare_prices','$1,$2::jsonb',[oid,'[]']),/authorization/);await assert.rejects(rpc('freight_publish_base','$1,$2::jsonb',[oid,'[]']),/permission/);await actor(admin);await assert.rejects(rpc('freight_add_quote','$1,$2,$3::jsonb,$4',[oid,'sample',JSON.stringify({...alt,validUntil:'2000-01-01'}),f]),/expired/);
await rpc('publish_order_quote','$1,$2::jsonb',[oid,'[{"id":"sample","cents":12000,"feesCents":300,"taxCents":200,"dutiesCents":100,"otherCents":100}]']);let order=(await db.query('select *from account_orders where id=$1',[oid])).rows[0];const option=order.price_options[0];assert.equal(option.priceCents,9133);assert.equal(option.shipping.priceCents,667);assert.equal(option.shipping.provider,'Alternative');assert.equal(option.currency,'GBP');assert.equal((await db.query('select options from account_quote_history where order_id=$1',[oid])).rows.length,1);assert.deepEqual((await db.query('select options from account_quote_history where order_id=$1',[oid])).rows[0].options,order.price_options);
await assert.rejects(rpc('freight_select','$1,$2',[oid,q]),/locked/);await actor(buyer);const visible=await rpc('freight_context','$1',[oid]);assert.equal(visible.quotes.length,0);assert.equal(visible.manufacturerQuotes,null);assert.equal((await db.query('select *from order_freight_quotes')).rows.length,0);await assert.rejects(rpc('submit_order_to_manufacturer','$1,$2',[oid,'sample']),/payment|disabled/i);
await db.exec('reset role');await db.exec('update order_payment_controls set enabled=true;grant all on all tables in schema public to service_role;set role service_role');await assert.rejects(rpc('confirm_order_payment','$1,$2,$3,$4,$5,now()',[oid,'sample','wrong',8000,'GBP']),/match/);await rpc('confirm_order_payment','$1,$2,$3,$4,$5,now()',[oid,'sample','correct',9133,'GBP']);await rpc('confirm_order_payment','$1,$2,$3,$4,$5,now()',[oid,'sample','correct',9133,'GBP']);
await actor(admin);await assert.rejects(rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'ready_for_collection','{}']),/approved QC/);await assert.rejects(rpc('freight_select','$1,$2',[oid,q]),/amendment/);await rpc('freight_select','$1,$2,$3',[oid,q,'Carrier confirmed revised collection terms; Ceriga absorbs costs']);assert.deepEqual((await db.query('select price_options from account_orders where id=$1',[oid])).rows[0].price_options,order.price_options);

// Exercise the retained three-stage production and existing QC release all the way to delivery.
await actor(factory);
assert.equal((await board('production',oid)).orders[0].step,'production');
assert.deepEqual((await board('production','does not exist')).orders,[]);
const productionUpdate=async(action,data={})=>{
 const current=(await rpc('production_board','')).orders.find(row=>row.id===oid);
 return rpc('production_action','$1,$2,$3::jsonb,$4,$5,$6',[oid,action,JSON.stringify(data),current.plan.revision,current.version,crypto.randomUUID()]);
};
await assert.rejects(productionUpdate('comment',{comment:'  '}),/stage comment/);
await productionUpdate('comment',{comment:'Fabric checked and ready.'});
const productionRow=(await board('production',oid)).orders[0];
assert.equal(productionRow.stage,'preparation');
assert.ok(productionRow.history.some(event=>event.explanation.includes('Fabric checked and ready.')));
await productionUpdate('block',{reason:'Material issue',category:'quality',until:null});
await assert.rejects(productionUpdate('advance'),/blockers/);
await productionUpdate('resume');
for(const expected of ['cutting_sewing','finishing']){
 await productionUpdate('advance');
 assert.equal((await board('production',oid)).orders[0].stage,expected);
}
await productionUpdate('automation',{enabled:true});
await db.exec('reset role');
await db.query("update order_production_timelines set stage_started_at=now()-interval '30 days' where order_id=$1",[oid]);
assert.equal(await rpc('production_scheduler',''),1);
await actor(factory);
assert.equal((await board('quality',oid)).orders[0].step,'quality');
assert.ok((await board('quality',oid)).orders[0].history.some(event=>event.kind==='automatic'));
const report=await rpc('qc_action','$1,$2,$3::jsonb',[oid,'start_report','{}']);const qcContext=await rpc('qc_report_context','$1',[oid]);const path=oid+'/'+factory+'/'+crypto.randomUUID()+'/front.jpg';await db.query("insert into storage.objects(bucket_id,name,metadata)values('qc-evidence',$1,'{\"mimetype\":\"image/jpeg\",\"size\":2048}')",[path]);const photo=await rpc('qc_action','$1,$2,$3::jsonb',[oid,'report_evidence',JSON.stringify({id:report,path,file_name:'front.jpg',file_role:'photo'})]);await rpc('qc_action','$1,$2,$3::jsonb',[oid,'submit_report',JSON.stringify({id:report,production_summary:'Completed garments checked against approved specifications.',produced_lines:qcContext.ordered_lines.map(l=>({...l,produced:l.ordered})),has_issues:false,issue_description:'',manufacturer_confirmed:true,photo_ids:[photo],supporting_ids:[]})]);
await actor(admin);await rpc('qc_action','$1,$2,$3::jsonb',[oid,'approve_report',JSON.stringify({id:report})]);
await actor(factory);assert.equal((await board('delivery',oid)).orders[0].step,'delivery');await actor(admin);
const collection=crypto.randomUUID();await rpc('freight_logistics_update','$1,$2,$3,$4::jsonb',[oid,collection,'collection_scheduled',JSON.stringify({collectionAt:'2026-12-01T09:00',note:'Collect from factory loading bay.'})]);await rpc('freight_logistics_update','$1,$2,$3,$4::jsonb',[oid,collection,'collection_scheduled','{}']);assert.equal((await rpc('freight_context','$1',[oid])).events.length,1);
await actor(factory);await assert.rejects(rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'collected','{}']),/authorization/);const factoryShipping=await rpc('freight_context','$1',[oid]);assert.equal(factoryShipping.approved.manufacturingCents,undefined);assert.equal(factoryShipping.approved.priceCents,undefined);
await actor(admin);
await db.exec('reset role');const release=(await db.query('select id from qc_shipment_releases where inspection_id=$1 and revoked_at is null',[report])).rows[0].id;await actor(factory);await rpc('qc_action','$1,$2,$3::jsonb',[oid,'dispatch',JSON.stringify({id:release,tracking:'FREIGHT-TEST-123'})]);
assert.equal((await board('delivery',oid)).orders[0].status,'shipping');
await actor(admin);await rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'in_transit',JSON.stringify({tracking:'FREIGHT-TEST-123',carrier:'Alternative',eta:'2026-12-08'})]);await assert.rejects(rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'exception','{}']),/reason/);await assert.rejects(rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'collection_scheduled',JSON.stringify({collectionAt:'2026-12-02T09:00'})]),/backwards/);await rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'exception',JSON.stringify({note:'Temporary customs delay'})]);await assert.rejects(rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'ready_for_collection','{}']),/backwards/);await rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'out_for_delivery','{}']);await assert.rejects(rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'delivered',JSON.stringify({proof:'javascript:alert(1)'})]),/HTTPS/);await rpc('freight_logistics_update','$1,gen_random_uuid(),$2,$3::jsonb',[oid,'delivered',JSON.stringify({proof:'https://example.invalid/delivery-proof.pdf',note:'Signed for at destination.'})]);assert.equal((await db.query('select status from account_orders where id=$1',[oid])).rows[0].status,'completed');await actor(buyer);assert.equal((await rpc('freight_context','$1',[oid])).events[0].status,'delivered');assert.equal((await db.query('select price_options from account_orders where id=$1',[oid])).rows[0].price_options[0].currencySnapshot.freight,undefined);
await actor(factory);assert.equal((await board('completed',oid)).orders[0].step,'completed');
await actor(admin);
await db.exec('reset role');
const legacyOrder = '77777777-7777-7777-7777-777777777777';
await db.query("select set_config('app.routing_write',$1,false)",[legacyOrder]);
await db.query(`insert into orders
 (id,user_id,kind,product_name,garment_type,status,status_label)
 values ($1,$2,'production','Previously released order','T-shirts','submitted','Submitted')`,
 [legacyOrder,buyer]);
await db.query("update orders set assigned_manufacturer_id=$2, status='processing', factory_status='in_production', production_released_at=now() where id=$1",[legacyOrder,factory]);
await actor(factory);
assert.equal((await board('production',legacyOrder)).orders[0].id,legacyOrder);
console.log('PASS fulfilment: unpaid exclusion, factory access, stage comments, issue pause/resume, final QC, handover and delivery completion.');
console.log('PASS freight end-to-end: existing three production stages -> manufacturer QC evidence -> admin QC approval -> collection -> existing release dispatch -> transit -> delivery/completion; idempotent updates, manufacturer restrictions, private financial metadata and unsafe proof links rejected.');
await db.exec('reset role');await db.exec(migration);await db.exec(await fs.readFile('supabase/migrations/20261102010000_freight_logistics_safety.sql','utf8'));console.log('PASS freight: repeatable schema, required shipping, own submissions, cross-account denial, private forwarder records, mandatory selection, multi-quote comparison, real FX, exact locked total and one immutable snapshot, payment bypass blocked, amount validation, duplicate payment idempotency, QC dispatch gate and controlled no-price-change amendments.');await db.close();

