import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { asAccount, testDatabase } from './support/testDatabase.mjs';

const db = await testDatabase();
const factory = '11111111-1111-1111-1111-111111111111';
const second = '22222222-2222-2222-2222-222222222222';
const buyer = '33333333-3333-3333-3333-333333333333';
const other = '44444444-4444-4444-4444-444444444444';
const staff = '55555555-5555-5555-5555-555555555555';
const admin = '66666666-6666-6666-6666-666666666666';
const emails = new Map([[factory,'factory@example.invalid'],[second,'second@example.invalid'],[buyer,'private@example.invalid'],[other,'other@example.invalid'],[staff,'staff@example.invalid'],[admin,'owner@ceriga.io']]);
const as = id => asAccount(db,id,emails.get(id));
const reset = () => db.exec("reset role;select set_config('request.jwt.claims','{}',false)");
const rpc = async (name,args=[]) => (await db.query('select public.' + name + '(' + args.map((_,i)=>'$'+(i+1)).join(',') + ') as result',args)).rows[0].result;
const options = (kind, units) => JSON.stringify([{id:kind,kind,totalUnits:units,priceCents:1000}]);
const base = {kind:'production',product_name:'Hoodie',garment_type:'Hoodie',contact_name:'Hidden Brand',contact_email:emails.get(buyer),contact_phone:'55512345678',delivery_address:{firstName:'Hidden',email:emails.get(buyer),address1:'Private address',country:'UK'}};
const order = async (specs = {}) => rpc('create_customer_order',[{...base,specifications:specs}]);
const bulk = units => ({mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:0}},bulkRuns:[{id:'bulk',kind:'bulk',targetTotal:units,bySize:{m:units}}]});
const list = (search='',customer=null,type='all',page=1) => rpc('factory_order_history_list',[search,'all',customer,'all',type,'all',null,'newest',page]);
const mockups = async (...ids) => (await db.query('select * from public.factory_order_mockups($1)',[ids])).rows;
const assign = async (id,factoryId,kind,units,status='processing') => {
  await reset();
  await db.query("select set_config('app.routing_write',$1,false),set_config('app.workflow_write',$1,false),set_config('app.delivery_write',$1,false),set_config('app.qc_write',$1,false)",[id]);
  // Fixture setup only. Existing QC and delivery workflow tests exercise dispatch guards.
  await db.exec('alter table orders disable trigger orders_qc_guard_dispatch');
  await db.query(`update orders set assigned_manufacturer_id=$2, assigned_at=now(), status=$3,
    factory_status=case when $3='completed' then 'completed' else 'in_production' end, production_released_at=now(),
    qc_status=case when $3='completed' then 'approved' else 'not_submitted' end, completed_at=case when $3='completed' then now() else null end,
    price_options=$4,selected_price_option_id=$5 where id=$1`,[id,factoryId,status,options(kind,units),kind]);
  await db.exec('alter table orders enable trigger orders_qc_guard_dispatch');
};

try {
  await db.exec(await fs.readFile('supabase/migrations/20261110030000_factory_order_history.sql','utf8'));
  await db.exec(await fs.readFile('supabase/migrations/20261110050000_restore_bulk_quote_options.sql','utf8'));
  for (const [id,email] of emails) await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,email]);
  await db.query("update profiles set role='manufacturer' where id in ($1,$2)",[factory,second]);
  await db.query("update profiles set full_name='Hidden Brand' where id=$1",[buyer]);
  for (const f of [factory,second]) await db.query("insert into manufacturer_profiles(user_id,factory_name,status,onboarding_complete)values($1,'Factory','active',true)",[f]);
  await as(factory);
  assert.deepEqual((await list()).rows,[]);

  await as(buyer);
  const original = await order({fabricType:'Cotton fleece',gsm:320,colorName:'Black',measurements:{sleeve:{value:64,unit:'cm'}},artworkFingerprint:'a'.repeat(64),customSpecification:'Retain exact structured source'});
  await assert.rejects(() => rpc('customer_approve_history_sample',[original.id]),/completed/);
  const path = buyer + '/' + original.id + '/private-name.pdf';
  const mockupPath = buyer + '/' + original.id + '/submitted-mockup.png';
  await rpc('patch_account_order',[original.id,{quote_request:{storagePaths:[path,mockupPath]}}]);
  await assign(original.id,factory,'sample',1,'completed');

  await as(buyer);
  const version = await rpc('customer_approve_history_sample',[original.id]);
  assert.equal(await rpc('customer_approve_history_sample',[original.id]),version);
  assert.equal(await rpc('customer_order_sample_approval',[original.id]),version);
  const followup = await rpc('customer_create_linked_order',[{...base,order_quantities:bulk(150),specifications:{gsm:400}},original.id,true]);
  assert.equal(followup.specifications.gsm,320);
  assert.equal(followup.specifications.customSpecification,'Retain exact structured source');
  await assert.rejects(()=>rpc('patch_account_order',[followup.id,{specifications:{gsm:420}}]),/approved sample/);
  assert.equal(await rpc('customer_approved_sample_file',[path]),true);
  await assign(followup.id,factory,'bulk',150,'completed');

  await as(buyer);
  const repeat = await rpc('customer_create_linked_order',[{...base,order_quantities:bulk(300),specifications:{fabricType:'Cotton fleece',gsm:320,colorName:'Black',measurements:{sleeve:{value:66,unit:'cm'}},artworkFingerprint:'b'.repeat(64)}},followup.id,false]);
  await assign(repeat.id,factory,'bulk',300);
  await as(buyer);
  const independent = await order({fabricType:'Cotton fleece',gsm:320,colorName:'Black'});
  await assign(independent.id,second,'bulk',200);
  await as(other);
  assert.equal(await rpc('customer_order_sample_approval',[original.id]),null);
  await assert.rejects(() => rpc('customer_create_linked_order',[{...base,order_quantities:bulk(10)},original.id,false]),/your production orders/);

  await as(factory);
  const result = await list('320 gsm black');
  assert.equal(result.total,3);
  const item = result.rows.find(row=>row.order_id===repeat.id);
  assert.equal(item.is_returning,true);
  assert.equal(item.prior_count,2);
  assert.equal(item.run_type,'modified_repeat');
  assert.equal(item.previous_order,followup.id);
  assert.equal((await list(item.customer_code,item.customer_code)).total,3);
  assert.equal((await list('',null,'repeat_bulk')).total,1);
  assert.equal((await list('',null,'all',2)).rows.length,0);
  assert.equal((await list(followup.id)).total,2);
  assert.doesNotMatch(JSON.stringify(result),new RegExp(buyer+'|Hidden Brand|private@example'));
  assert.equal(await rpc('factory_save_order_nickname',[repeat.id,'Warehouse hoodie']), 'Warehouse hoodie');
  assert.equal((await list('warehouse hoodie')).total,1);
  await assert.rejects(() => rpc('factory_save_order_nickname',[repeat.id,'x'.repeat(81)]),/80/);
  const history = await rpc('factory_order_history_detail',[repeat.id]);
  assert.equal(history.timeline.length,3);
  assert.equal(history.previousSpecification.measurements.sleeve.value,64);
  assert.equal(history.specification.measurements.sleeve.value,66);
  assert.equal(history.artworkComparison,'Changed');
  assert.doesNotMatch(JSON.stringify(history),new RegExp('a{64}|b{64}'));
  assert.equal((await rpc('factory_order_history_detail',[original.id])).version,version);
  assert.equal((await rpc('factory_order_history_detail',[followup.id])).specification.supportingFiles,'Approved sample v' + version);
  const exposed = (await db.query('select user_id, contact_name, contact_email, contact_phone, delivery_address from account_orders where id=$1',[repeat.id])).rows[0];
  assert.deepEqual(exposed,{user_id:null,contact_name:null,contact_email:null,contact_phone:null,delivery_address:{country:'UK'}});
  assert.equal((await db.query('select * from factory_customer_references')).rows.length,0);
  assert.doesNotMatch(JSON.stringify(await rpc('portal_dashboard')),/Hidden Brand|private@example/);

  await as(second);
  const secondRows = (await list()).rows;
  assert.equal(secondRows.length,1);
  assert.notEqual(secondRows[0].customer_code,item.customer_code);
  await assert.rejects(() => list('',item.customer_code),/unavailable/);
  await assert.rejects(() => rpc('factory_order_history_detail',[repeat.id]),/unavailable/);
  await assert.rejects(() => rpc('factory_save_order_nickname',[repeat.id,'Outside']),/unavailable/);

  await reset();
  await db.query("insert into manufacturer_team_members(manufacturer_id,user_id,role)values($1,$2,'staff')",[factory,staff]);
  await db.query('insert into manufacturer_team_order_assignments(manufacturer_id,user_id,order_id)values($1,$2,$3)',[factory,staff,repeat.id]);
  await as(staff);
  const staffHistory = await rpc('factory_order_history_detail',[repeat.id]);
  assert.equal(staffHistory.previousSpecification,null);
  assert.equal(staffHistory.timeline.length,1);

  await reset();
  await db.query("insert into storage.objects(bucket_id,name,owner)values('order-uploads',$1,$2)",[path,buyer]);
  await db.query("insert into storage.objects(bucket_id,name,owner,metadata)values('order-uploads',$1,$2,'{\"mimetype\":\"image/png\"}')",[mockupPath,buyer]);
  await as(factory);
  assert.deepEqual(await rpc('factory_order_documents_list',[original.id]),[]);
  assert.equal((await db.query("select name from storage.objects where bucket_id='order-uploads'")).rows.length,0);
  await assert.rejects(()=>rpc('admin_share_factory_order_document',[original.id,0,'production']),/Superadmin/);
  await as(admin);
  await rpc('admin_share_factory_order_document',[original.id,0,'production']);
  const files = await rpc('admin_factory_order_share_options',[followup.id]);
  assert.equal(files.documents[0].pinned,true);
  assert.equal(files.documents[0].path,path);
  await rpc('admin_share_factory_order_document',[followup.id,0,'production',true]);
  assert.equal((await db.query('select count(*)::int as count from factory_customer_references')).rows[0].count,2);
  await as(factory);
  const [document] = await rpc('factory_order_documents_list',[original.id]);
  assert.equal(document.purpose,'production');
  assert.equal((await rpc('factory_order_documents_list',[followup.id])).length,1);
  assert.equal(await rpc('factory_authorize_order_document',[original.id,document.id]),factory);
  assert.doesNotMatch(JSON.stringify(document),/private-name|storage_path/);
  assert.deepEqual(await mockups(original.id,followup.id),[]);
  await as(admin);
  await rpc('admin_share_factory_order_document',[original.id,1,'production']);
  await as(factory);
  const [mockup] = await mockups(original.id,followup.id);
  assert.equal(mockup.order_id,original.id);
  assert.notEqual(mockup.document_id,document.id);
  assert.deepEqual(Object.keys(mockup).sort(),['document_id','order_id']);
  assert.equal(await rpc('factory_authorize_order_document',[original.id,mockup.document_id]),factory);
  await as(staff);
  assert.deepEqual(await mockups(original.id),[]);
  await as(second);
  assert.deepEqual(await mockups(original.id),[]);
  await assert.rejects(()=>rpc('factory_authorize_order_document',[original.id,document.id]),/denied/);
  await as(admin);
  await rpc('admin_share_factory_order_document',[original.id,0,null]);
  await as(factory);
  await assert.rejects(()=>rpc('factory_authorize_order_document',[original.id,document.id]),/denied/);
  await reset();
  await db.query("insert into orders(user_id,kind,product_name,garment_type,status,status_label,assigned_manufacturer_id) select $1,'production','Page fixture ' || n,'Hoodie','submitted','Awaiting quote',$2 from generate_series(1,28) n",[buyer,factory]);
  await as(factory);
  assert.equal((await list('page fixture')).rows.length,24);
  assert.equal((await list('page fixture',null,'all',2)).rows.length,4);
  await reset();
  assert.ok((await db.query("select id from manufacturer_team_audit where action='read_order_document' and subject_id=$1",[original.id])).rows.length);
  // Builder IDs look like phone numbers to the general privacy scrubber.
  const bulkIds = ['bulk-1794300000000-a1b2c', 'bulk-1794300000001-d3e4f'];
  await as(buyer);
  const bulkOrder = await rpc('create_customer_order',[{...base,order_quantities:{
    mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:0}},
    bulkRuns:bulkIds.map((id,index)=>({id,kind:'bulk',targetTotal:100*(index+1),bySize:{m:100*(index+1)},privateNote:buyer})),
  }}]);
  await as(admin);
  await rpc('assign_order_manufacturer',[bulkOrder.id,factory,'2099-01-01']);
  await as(factory);
  await rpc('set_account_currency',['EUR']);
  const quantities = (await db.query('select order_quantities from account_orders where id=$1',[bulkOrder.id])).rows[0].order_quantities;
  assert.deepEqual(quantities.bulkRuns.map(run=>run.id),bulkIds);
  assert.doesNotMatch(JSON.stringify(quantities),new RegExp(buyer));
  const quotes = quantities.bulkRuns.map(run=>({id:run.id,currency:'EUR',unitPriceCents:1000,leadTimeDays:14,
    shipping:{priceCents:1000,currency:'EUR',provider:'Carrier',method:'Air',origin:'Portugal',destination:'UK'}}));
  await assert.rejects(()=>rpc('submit_manufacturer_quote',[bulkOrder.id,JSON.stringify([quotes[0],quotes[0]])]),/tier IDs must be unique/);
  await rpc('submit_manufacturer_quote',[bulkOrder.id,JSON.stringify(quotes)]);
  const savedQuote = (await db.query('select manufacturer_quote from account_orders where id=$1',[bulkOrder.id])).rows[0].manufacturer_quote;
  assert.deepEqual(savedQuote.map(tier=>[tier.id,tier.totalUnits]),[[bulkIds[0],100],[bulkIds[1],200]]);
  await as(second);
  assert.equal((await db.query('select id from account_orders where id=$1',[bulkOrder.id])).rows.length,0);

  await db.exec('set role anon');
  await assert.rejects(()=>list(),/permission denied/);
  console.log('PASS anonymous client isolation, explicit product lineage, approved versions, modified repeat comparison, staff scoping, search, audit and document release');
} catch (error) { console.error(error.message, error.where ?? '', error.query ?? ''); process.exitCode=1; } finally { await db.close(); }
