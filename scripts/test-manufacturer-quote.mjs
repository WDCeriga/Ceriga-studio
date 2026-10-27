// Isolated fixtures only; never connects to production.
// Runtime: npm install --prefix .tmp-workflow-test --no-save --package-lock=false @electric-sql/pglite@0.3.14
import fs from 'node:fs/promises';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
const {testDatabase}=await import('./support/testDatabase.mjs');
const db=await testDatabase();
await db.exec(`insert into auth.users(id,email)values('11111111-1111-1111-1111-111111111111','buyer@example.invalid'),('22222222-2222-2222-2222-222222222222','factory@example.invalid'),('33333333-3333-3333-3333-333333333333','other@example.invalid'),('44444444-4444-4444-4444-444444444444','owner@ceriga.io');
insert into public.manufacturer_profiles(user_id,factory_name,onboarding_complete,status)values('22222222-2222-2222-2222-222222222222','Factory',true,'active');
insert into public.orders(id,user_id,assigned_manufacturer_id,kind,product_name,garment_type,status,status_label)values('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','production','Quote test','Hoodies','submitted','Awaiting quote');`);
await db.exec(`update public.orders set order_quantities='{"mode":"custom_clothing","sample":{"id":"sample","kind":"sample","targetTotal":6,"bySize":{"s":6}},"bulkRuns":[]}'::jsonb;`);
await db.exec("update public.profiles set preferred_currency='GBP'where id='22222222-2222-2222-2222-222222222222'");
const quote=JSON.stringify([{id:'sample',kind:'sample',label:'Samples',totalUnits:999,unitPriceCents:2000,manufacturerQuoteCents:1,currency:'GBP',leadTimeDays:14}]);
const claims=async id=>db.exec(`reset role;select set_config('app.routing_write','',false);select set_config('request.jwt.claims','{"sub":"${id}","email":"test@example.invalid","role":"authenticated"}',false);set role authenticated;`);
import assert from 'node:assert/strict';
for(const id of ['11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333']) {
 await claims(id);await assert.rejects(db.query('select public.reject_order_quotation($1,$2)', ['55555555-5555-5555-5555-555555555555','Unauthorised rejection']),/not assigned|Permission denied|Order access denied/);await assert.rejects(db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',quote]),/not assigned|Permission denied|Order access denied/);
}
await claims('22222222-2222-2222-2222-222222222222');
await assert.rejects(db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555','[]']),/every customer/);
await assert.rejects(db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',quote.replace('2000','0')]),/Each option/);
await assert.rejects(db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',quote.replace('GBP','USD')]),/Each option/);
await db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',quote]);
await db.exec(`reset role;select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","email":"owner@ceriga.io","role":"authenticated"}',false);set role authenticated;`);
const result=await db.query('select factory_status,manufacturer_quote,quoted_at,status,total,paid_amount_cents from public.account_orders');
assert.equal(result.rows.length,1);assert.equal(result.rows[0].factory_status,'quoted');assert.equal(result.rows[0].manufacturer_quote[0].manufacturerQuoteCents,12000);assert.ok(result.rows[0].quoted_at);assert.equal(result.rows[0].status,'submitted');assert.equal(result.rows[0].total,null);assert.equal(result.rows[0].paid_amount_cents,null);
assert.equal(result.rows[0].manufacturer_quote[0].totalUnits,6);assert.equal(result.rows[0].manufacturer_quote[0].unitPriceCents,2000);
await db.exec(`reset role;select set_config('request.jwt.claims','{}',false);select set_config('app.routing_write','55555555-5555-5555-5555-555555555555',false);update public.orders set status='priced';`);
await claims('22222222-2222-2222-2222-222222222222');
await assert.rejects(db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',quote]),/no longer accepting/);

for(const currency of ['EUR','USD','GBP']) {
 await db.exec(`reset role;select set_config('request.jwt.claims','{}',false);select set_config('app.routing_write','55555555-5555-5555-5555-555555555555',false);update public.orders set status='submitted',factory_status='new',manufacturer_quote=null; update public.profiles set preferred_currency='${currency}' where id='22222222-2222-2222-2222-222222222222';`);
 await claims('22222222-2222-2222-2222-222222222222');
 const requested=JSON.parse(quote);requested[0].currency=currency;
 await db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',JSON.stringify(requested)]);
 const stored=(await db.query('select manufacturer_quote from public.account_orders')).rows[0].manufacturer_quote[0];
 assert.equal(stored.currency,currency);assert.equal(stored.manufacturerQuoteCents,12000);
 await db.exec(`reset role;select set_config('request.jwt.claims','{}',false);update public.profiles set preferred_currency='${currency==='EUR'?'USD':'EUR'}' where id='22222222-2222-2222-2222-222222222222';`);
 await claims('22222222-2222-2222-2222-222222222222');
 await db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',JSON.stringify(requested)]);
 requested[0].currency=currency==='EUR'?'USD':'EUR';
 await assert.rejects(db.query('select public.submit_manufacturer_quote($1,$2)', ['55555555-5555-5555-5555-555555555555',JSON.stringify(requested)]),/quotation currency/);
}
console.log('PASS: EUR/USD/GBP account currency, unchanged amounts, saved quote currency preserved after settings changes, wrong-currency rejection');
await db.close();
console.log('PASS: saved customer quantities enforced; unit prices multiplied server-side despite tampered totals; customer/other-factory denial; invalid quote/reason; price/payment unchanged; released orders locked');
