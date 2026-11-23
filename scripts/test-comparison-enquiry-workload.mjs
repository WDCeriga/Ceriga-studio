import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {testDatabase,asAccount} from './support/testDatabase.mjs';

const db=await testDatabase();
const [admin,buyer,factory,alternative]=Array.from({length:4},()=>randomUUID());
const migration=await readFile('supabase/migrations/20261123010000_comparison_enquiry_workload.sql','utf8');
try {
  for(const [id,email] of [[admin,'owner@ceriga.io'],[buyer,'buyer@example.invalid'],[factory,'factory@example.invalid'],[alternative,'alternative@example.invalid']])
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  for(const id of [factory,alternative]) await db.query(`insert into manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,moq,calendar_workdays)
    values($1,'Comparison fixture','active',true,array['T-shirts'],1,array[1,2,3,4,5,6,7])`,[id]);
  const create=async()=>{
    await asAccount(db,buyer);
    return (await db.query('select public.create_customer_order($1) value',[{kind:'production',product_name:'Enquiry fixture',garment_type:'T-shirts',order_quantities:{mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:1}},bulkRuns:[]}}])).rows[0].value.id;
  };
  const target=await create(),comparison=await create();
  await asAccount(db,admin,'owner@ceriga.io');
  await db.query('select public.admin_request_factory_comparison($1,$2,$3,current_date+3,current_date+3)',[comparison,factory,alternative]);
  const matches=async()=> (await db.query('select public.admin_manufacturer_matching($1,current_date+3) value',[target])).rows[0].value.candidates;
  let rows=await matches();
  for(const id of [factory,alternative]){
    const row=rows.find(r=>r.id===id);
    assert.equal(row.outstanding,1);
    assert.equal(row.paid,0);
    assert.equal(row.active,0);
  }
  // Re-running the additive migration must not duplicate requests or counts.
  await db.exec('reset role');await db.exec(migration);
  await db.query("update order_factory_quotes set status='declined' where order_id=$1 and factory_id=$2",[comparison,factory]);
  await db.query('update order_factory_quotes set due_on=current_date-1 where order_id=$1 and factory_id=$2',[comparison,alternative]);
  await asAccount(db,admin,'owner@ceriga.io');
  rows=await matches();
  assert.equal(rows.find(r=>r.id===factory).outstanding,0);
  assert.equal(rows.find(r=>r.id===alternative).outstanding,0);
  await asAccount(db,buyer);
  await assert.rejects(matches(),/Superadmin/);
  assert.equal((await db.query('select * from order_factory_quotes where order_id=$1',[comparison])).rows.length,0);
  await assert.rejects(db.query('select public.rank_manufacturers_for_order($1,current_date+3)',[target]),/permission denied/);
  console.log('PASS pending dual enquiries count independently; declines/expiry excluded; no paid/active inflation; repeatable migration and privacy.');
} finally {await db.close();}
