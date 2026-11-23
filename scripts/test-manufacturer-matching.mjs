import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testDatabase, asAccount } from './support/testDatabase.mjs';

const db = await testDatabase();
const [admin,buyer,busy,free,ineligible,closed,unknown] = Array.from({length:7},()=>randomUUID());
const sample = { id:'sample',kind:'sample',targetTotal:1,bySize:{m:1} };
const bulk = { id:'bulk',kind:'bulk',targetTotal:500,bySize:{m:500} };
const plan = {mode:'custom_clothing',sample,bulkRuns:[bulk]};
const migration = await readFile('supabase/migrations/20261113100000_manufacturer_matching.sql','utf8');
const read = async (query,args=[]) => (await db.query(query,args)).rows[0].value;

try {
  await db.exec(migration);
  for (const id of [admin,buyer,busy,free,ineligible,closed,unknown]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,id===admin?'owner@ceriga.io':id+'@example.invalid']);
  }
  for (const id of [busy,free,ineligible,closed,unknown]) {
    await db.query(`insert into public.manufacturer_profiles
      (user_id,factory_name,status,onboarding_complete,garments,capabilities,moq,monthly_capacity,typical_lead_days,calendar_workdays,shipping_regions)
      values($1,$2,$5,true,array['T-shirts'],$3,10,$4,12,array[1,2,3,4,5,6,7],array['UK'])`,
      [id,id,id===ineligible?[]:['Screen printing'],id===unknown?0:2000,id===free?'onboarding':'active']);
  }
  await db.query(`insert into public.manufacturer_availability(manufacturer_id,kind,starts_on,ends_on,reason,status)
    values($1,'time_off',current_date,current_date+20,'Scheduled closure','approved')`,[closed]);
  await asAccount(db,buyer);
  const order = async (quantities=plan) => (await read('select public.create_customer_order($1) value',[{
    kind:'production',product_name:'Matching fixture',garment_type:'T-shirts',delivery_address:{country:'United Kingdom'},
    specifications:{requiredCapabilities:['Screen print']},order_quantities:quantities,
  }])).id;
  const [target,large,small,quote1,quote2,declined] = await Promise.all(Array.from({length:6},()=>order()));
  await assert.rejects(read('select public.admin_manufacturer_matching($1,current_date+3) value',[target]),/Superadmin/);
  await assert.rejects(read('select public.admin_manufacturer_assignment_history($1) value',[target]),/Superadmin/);
  await assert.rejects(read('select public.admin_assign_matched_manufacturer($1,$2,current_date+3) value',[target,free]),/Superadmin/);
  await asAccount(db,admin,'owner@ceriga.io');
  const production = async (id,factory,run,paid) => {
    await db.query("select set_config('app.routing_write',$1,false),set_config('app.workflow_write',$1,false)",[id]);
    await db.query(`update public.orders set assigned_manufacturer_id=$2,status='processing',factory_status='in_production',
      production_released_at=now(),payment_verified_at=case when $4 then now() end,
      selected_price_option_id=$3::jsonb->>'id',price_options=jsonb_build_array($3::jsonb) where id=$1`,
      [id,factory,JSON.stringify({...run,totalUnits:run.targetTotal,leadTimeDays:10}),paid]);
  };
  await production(large,busy,bulk,true);
  await production(small,unknown,sample,false);
  await asAccount(db,admin,'owner@ceriga.io');
  const assign = (id,factory,note=null) => read('select public.admin_assign_matched_manufacturer($1,$2,current_date+3,$3) value',[id,factory,note]);
  await assign(quote1,busy);
  await assign(quote2,busy);
  await assign(declined,free);
  await db.exec('reset role');
  await db.query(`insert into public.order_routing_events(order_id,manufacturer_id,event_type) values($1,$2,'manufacturer_declined')`,[declined,free]);
  await db.query("select set_config('app.routing_write',$1,false),set_config('app.workflow_write',$1,false)",[declined]);
  await db.query("update public.orders set factory_status='rejected' where id=$1",[declined]);
  await asAccount(db,admin,'owner@ceriga.io');
  const result = await read('select public.admin_manufacturer_matching($1,current_date+3) value',[target]);
  const match = id => result.candidates.find(row=>row.id===id);
  assert.equal(match(free).rank,1);
  assert.equal(match(free).active,0);
  assert.equal(match(free).declines,1);
  assert.equal(match(busy).active,1);
  assert.equal(match(busy).bulk,1);
  assert.equal(match(busy).units,500);
  assert.equal(match(busy).opportunities,2);
  assert.equal(match(busy).outstanding,2);
  assert.equal(match(busy).paid,1);
  assert.equal(match(unknown).samples,1);
  assert.equal(match(unknown).units,1);
  assert.equal(match(unknown).capacitySource,'unknown');
  assert.equal(match(unknown).opportunities,0);
  assert.equal(match(unknown).lastAssignment,null);
  assert.equal(match(ineligible).eligible,false);
  assert.equal(match(closed).quoteConflict,true);
  assert.ok(match(closed).rank>match(busy).rank);
  assert.deepEqual(await read('select public.admin_manufacturer_assignment_history($1) value',[target]),[]);
  await assert.rejects(read('select public.admin_manufacturer_matching($1,current_date+3) value',[randomUUID()]),/Production order not found/);
  await assert.rejects(assign(target,ineligible),/Decoration not offered/);
  await assign(target,unknown,'Manual scheduling agreement');
  const history = await read('select public.admin_manufacturer_assignment_history($1) value',[target]);
  assert.equal(history[0].manufacturerId,unknown);
  assert.equal(history[0].overrideReason,'Manual scheduling agreement');
  assert.match(history[0].dueQuoteBy,/^\d{4}-\d{2}-\d{2}$/);
  await db.exec('reset role');
  await db.query(`update public.order_routing_events
    set created_at=now()-interval '10 days',details=details||jsonb_build_object('dueQuoteBy',current_date-3)
    where order_id=$1 and event_type='assigned'`,[quote1]);
  await asAccount(db,admin,'owner@ceriga.io');
  const expiredHistory = await read('select public.admin_manufacturer_assignment_history($1) value',[quote1]);
  assert.ok(expiredHistory.some(event=>event.event==='request_expired' && event.manufacturerId===busy));
  const unassigned = await read('select public.admin_manufacturer_assignment_history($1) value',[large]);
  assert.ok(unassigned.some(event=>event.event==='matching_payment_confirmed'));
  console.log('PASS: workload, sample/bulk, capability, unknown capacity, unpaid opportunities, declines, deadline conflicts, overrides and private access.');
} catch (error) {
  console.error(error.message, error.where ?? '', error.detail ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
