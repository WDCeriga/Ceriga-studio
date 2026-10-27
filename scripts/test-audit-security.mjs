import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{testDatabase,asAccount}from './support/testDatabase.mjs';
const db=await testDatabase();
const buyer='11111111-1111-1111-1111-111111111111',factory='22222222-2222-2222-2222-222222222222',other='33333333-3333-3333-3333-333333333333',admin='44444444-4444-4444-4444-444444444444';
try{
 await db.exec(`insert into auth.users(id,email)values('${buyer}','buyer@example.invalid'),('${factory}','factory@example.invalid'),('${other}','other@example.invalid'),('${admin}','owner@ceriga.io');insert into public.manufacturer_profiles(user_id,factory_name,status,onboarding_complete)values('${factory}','Audit Factory','active',true);`);
 await asAccount(db,buyer);await assert.rejects(db.query("update public.profiles set role='manufacturer',message_credits=999999 where id=$1",[buyer]),/roles|entitlements/);
 const input={kind:'production',product_name:'Private quote',garment_type:'T-shirts',order_quantities:{sample:{id:'sample',kind:'sample',targetTotal:2,bySize:{m:2}},bulkRuns:[]}};
 const oid=(await db.query('select public.create_customer_order($1::jsonb) o',[JSON.stringify(input)])).rows[0].o.id;
 await asAccount(db,admin,'owner@ceriga.io');await db.query('select public.assign_order_manufacturer($1,$2,current_date+3)',[oid,factory]);
 await asAccount(db,factory);await db.query('select public.submit_manufacturer_quote($1,$2::jsonb)',[oid,JSON.stringify([{id:'sample',kind:'sample',unitPriceCents:1000,currency:'EUR',leadTimeDays:14}])]);
 await assert.rejects(db.query("update public.orders set tracking='FORGED'where id=$1",[oid]),/authorised/);
 await assert.rejects(db.query("update public.manufacturer_profiles set status='paused'where user_id=$1",[factory]),/Only Ceriga/);
 await asAccount(db,admin,'owner@ceriga.io');await db.query('select public.publish_order_quote($1,$2::jsonb)',[oid,JSON.stringify([{id:'sample',cents:3000}])]);
 const adminView=(await db.query('select *from public.account_orders where id=$1',[oid])).rows[0];assert.equal(adminView.price_options[0].currencySnapshot.markupCents,1000);
 await asAccount(db,factory);await assert.rejects(db.query('select price_options from public.orders where id=$1',[oid]),/permission denied/);let row=(await db.query('select *from public.account_orders where id=$1',[oid])).rows[0];assert.equal(row.price_options[0].priceCents,undefined);assert.equal(row.price_options[0].currencySnapshot,undefined);assert.equal(row.manufacturer_quote[0].manufacturerQuoteCents,2000);
 await asAccount(db,buyer);row=(await db.query('select *from public.account_orders where id=$1',[oid])).rows[0];assert.equal(row.price_options[0].priceCents,3000);assert.equal(row.manufacturer_quote,null);assert.equal(row.price_options[0].currencySnapshot.markupCents,undefined);assert.equal(row.price_options[0].currencySnapshot.originalManufacturerCents,undefined);
 await assert.rejects(db.query('delete from public.orders where id=$1',[oid]),/cancelled|history/);
 await asAccount(db,other);assert.equal((await db.query('select *from public.account_orders where id=$1',[oid])).rows.length,0);
 await asAccount(db,admin,'owner@ceriga.io');await db.query('select public.admin_update_profile($1,$2::jsonb)',[buyer,JSON.stringify({message_credits:5})]);assert.equal((await db.query('select message_credits from public.profiles where id=$1',[buyer])).rows[0].message_credits,5);
 await db.exec('reset role');assert.ok((await db.query("select count(*)::int n from public.portal_notifications where order_id=$1 and title='New order assigned'",[oid])).rows[0].n===1);
 // Reapplying the migration must not restore raw financial SELECT or duplicate triggers.
 await db.exec(await fs.readFile('supabase/migrations/20261022050000_audit_security_and_routing.sql','utf8'));await asAccount(db,buyer);await assert.rejects(db.query('select manufacturer_quote from public.orders'),/permission denied/);
 console.log('PASS: private financial projections, role/credit protection, factory eligibility, guarded writes/deletion, assignment notification, admin update and repeatable migration.');
}finally{await db.close();}
