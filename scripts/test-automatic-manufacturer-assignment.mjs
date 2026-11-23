import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { asAccount, testDatabase } from './support/testDatabase.mjs';

const db = await testDatabase({ automaticAssignment: true });
const [buyer, admin, factory, alternative] = Array.from({length:4}, () => randomUUID());
const query = async (sql, args=[]) => (await db.query(sql,args)).rows[0]?.result;
const mode = value => query('select public.admin_assignment_mode($1) result', [value]);
const submit = (garment='T-shirts', kind='production') => query('select public.create_customer_order($1) result', [{
  kind, product_name:'Automatic assignment fixture', garment_type:garment,
  order_quantities:{mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:1}},bulkRuns:[]},
}]);

try {
  await db.exec(await readFile('supabase/migrations/20261113120000_route_pending_manufacturer_orders.sql','utf8'));
  for (const [id,email] of [[buyer,'buyer@example.invalid'],[admin,'owner@ceriga.io'],[factory,'factory@example.invalid'],[alternative,'alternative@example.invalid']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  }
  await db.query(`insert into public.manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,calendar_workdays)
    values($1,'Factory','active',true,array['T-shirts'],array[1,2,3,4,5,6,7])`,[factory]);
  await asAccount(db,buyer);
  await assert.rejects(mode('manual'),/Superadmin/);
  await assert.rejects(query('select public.rank_manufacturers_for_order($1,current_date+3)',[randomUUID()]),/permission denied/);
  const auto = await submit();
  assert.equal(auto.assigned_manufacturer_id,factory);
  assert.equal(auto.factory_status,'new');
  assert.ok(auto.due_quote_by);
  assert.equal((await submit('Unsupported garment')).assigned_manufacturer_id,null);
  assert.equal((await submit('T-shirts','tech-pack')).assigned_manufacturer_id,null);
  await assert.rejects(db.query("update public.orders set assigned_manufacturer_id=$2 where id=$1",[auto.id,alternative]),/permission denied|superadmin|controlled|authorised/i);

  await asAccount(db,admin,'owner@ceriga.io');
  assert.equal(await mode(null),'automatic');
  const event = await query("select details result from public.order_routing_events where order_id=$1 and event_type='assigned'",[auto.id]);
  assert.equal(event.assignmentMode,'automatic');
  assert.equal(await mode('manual'),'manual');
  await db.query(`insert into public.manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,calendar_workdays)
    values($1,'Alternative','active',true,array['T-shirts'],array[1,2,3,4,5,6,7])`,[alternative]);
  await query('select public.admin_assign_matched_manufacturer($1,$2,current_date+3,$3) result',[auto.id,alternative,'Factory confirmed availability']);
  const history = await query('select public.admin_manufacturer_assignment_history($1) result',[auto.id]);
  assert.ok(history.some(row=>row.manufacturerId===alternative && row.overrideReason==='Factory confirmed availability'));
  await asAccount(db,buyer);
  const manual = await submit();
  assert.equal(manual.assigned_manufacturer_id,null);
  await asAccount(db,admin,'owner@ceriga.io');
  assert.equal(await mode('automatic'),'automatic');
  assert.ok(await query('select assigned_manufacturer_id result from public.account_orders where id=$1',[manual.id]));
  await asAccount(db,buyer);
  assert.ok((await submit()).assigned_manufacturer_id);
  console.log('PASS automatic assignment, no match, manual queue, re-enable, admin override and permission isolation.');
} catch (error) {
  console.error(error.message,error.where ?? '');
  process.exitCode=1;
} finally {
  await db.close();
}
