// Isolated fixtures only; never connects to production.
// Runtime: npm install --prefix .tmp-workflow-test --no-save --package-lock=false @electric-sql/pglite@0.3.14
import fs from 'node:fs/promises';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema storage;create schema cron;
create table auth.users(id uuid primary key default gen_random_uuid(),email text,email_confirmed_at timestamptz,invited_at timestamptz,encrypted_password text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values($1,$2,$3)on conflict(jobname)do update set schedule=excluded.schedule,command=excluded.command returning jobid$$;
grant usage on schema public,auth,storage to authenticated,anon,service_role;
grant all on all tables in schema storage to authenticated,service_role;`);
import assert from 'node:assert/strict';
let schema=await fs.readFile('supabase/schema.sql','utf8');
const marker=schema.indexOf('-- Existing records retain NULL version');
let base=schema.slice(0,marker).replace(/begin;\s*$/,'').replace(/create extension if not exists "pgcrypto";/gi,'');
await db.exec(base);
await db.exec(`insert into auth.users(id,email)values
('11111111-1111-1111-1111-111111111111','buyer@example.invalid'),
('22222222-2222-2222-2222-222222222222','factory-a@example.invalid'),
('33333333-3333-3333-3333-333333333333','factory-b@example.invalid'),
('44444444-4444-4444-4444-444444444444','owner@ceriga.io');
insert into public.manufacturer_profiles(user_id,factory_name,onboarding_complete,status)values('22222222-2222-2222-2222-222222222222','Factory A',true,'active'),('33333333-3333-3333-3333-333333333333','Factory B',true,'active');
insert into public.orders(id,user_id,kind,product_name,garment_type,status,status_label,price_options,priced_at)values('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','production','Legacy','Hoodies','priced','Existing offer','[{"id":"legacy","priceCents":9000}]','2026-01-01');`);
const legacyBefore=(await db.query("select row_to_json(o) as row from public.orders o where id='55555555-5555-5555-5555-555555555555'")).rows[0].row;
const migration=await fs.readFile('supabase/migrations/20261021010000_order_routing_and_offers.sql','utf8');
await db.exec(migration);await db.exec(migration);
const legacyAfter=(await db.query("select row_to_json(o) as row from public.orders o where id='55555555-5555-5555-5555-555555555555'")).rows[0].row;
for(const key of Object.keys(legacyBefore))assert.deepEqual(legacyAfter[key],legacyBefore[key],`Legacy ${key} changed`);
assert.equal(legacyAfter.routing_version,null);
const buyer='11111111-1111-1111-1111-111111111111',a='22222222-2222-2222-2222-222222222222',b='33333333-3333-3333-3333-333333333333',admin='44444444-4444-4444-4444-444444444444',id='66666666-6666-6666-6666-666666666666';
const actor=async(who)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:who,email:who===admin?'owner@ceriga.io':'account@example.invalid',role:'authenticated'})]);await db.exec('set role authenticated');};
const rpc=async(name,args)=>db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args);
const quote=JSON.stringify([{id:'sample',unitPriceCents:2000,currency:'GBP',leadTimeDays:14}]);
await actor(buyer);
await db.query(`insert into public.orders(id,user_id,kind,product_name,garment_type,status,status_label,order_quantities,routing_version)values($1,$2,'production','New order','Hoodies','submitted','Awaiting quote','{"mode":"custom_clothing","sample":{"id":"sample","kind":"sample","targetTotal":6,"bySize":{"s":6}},"bulkRuns":[]}',null)`,[id,buyer]);
assert.equal((await db.query('select routing_version from public.orders where id=$1',[id])).rows[0].routing_version,2);
await assert.rejects(rpc('assign_order_manufacturer',[id,a,'2027-01-01']),/Superadmin/);
await assert.rejects(db.query("update public.orders set status='priced' where id=$1",[id]),/authorised/);
await assert.rejects(db.query("update public.orders set kind='tech-pack' where id=$1",[id]),/identity/);
await actor(admin);await rpc('assign_order_manufacturer',[id,a,'2027-01-01']);
await actor(buyer);await assert.rejects(db.query("update public.orders set order_quantities='{}' where id=$1",[id]),/revise/);
await actor(a);await rpc('submit_manufacturer_quote',[id,quote]);
await actor(admin);await rpc('reject_order_quotation',[id,'Quote too expensive']);
await assert.rejects(rpc('assign_order_manufacturer',[id,a,'2027-01-01']),/another manufacturer/);
await rpc('assign_order_manufacturer',[id,b,'2027-01-01']);
let clean=(await db.query('select manufacturer_quote,price_options from public.orders where id=$1',[id])).rows[0];assert.equal(clean.manufacturer_quote,null);assert.equal(clean.price_options,null);
await actor(a);assert.equal((await db.query('select id from public.orders where id=$1',[id])).rows.length,0);await assert.rejects(rpc('submit_manufacturer_quote',[id,quote]),/not assigned/);
await actor(b);await rpc('submit_manufacturer_quote',[id,quote]);
await actor(buyer);await assert.rejects(rpc('publish_order_quote',[id,'[{"id":"sample","cents":15000}]']),/Superadmin/);
await actor(admin);await rpc('publish_order_quote',[id,'[{"id":"sample","cents":15000}]']);
let offer=(await db.query('select price_options,offer_issued_at,quote_expires_at from public.orders where id=$1',[id])).rows[0];
assert.equal(new Date(offer.quote_expires_at)-new Date(offer.offer_issued_at),30*86400000);assert.equal(offer.price_options[0].priceCents,15000);
await assert.rejects(rpc('publish_order_quote',[id,'[{"id":"sample","cents":15000}]']),/already been published/);
await actor(buyer);assert.equal((await db.query('select price_options from public.orders where id=$1',[id])).rows[0].price_options[0].priceCents,15000);
await assert.rejects(rpc('confirm_order_payment',[id,'sample','event-1',15000,'GBP',new Date().toISOString()]),/permission denied/);
await assert.rejects(db.query("update public.orders set status='processing',paid_amount_cents=15000 where id=$1",[id]),/authorised/);
await db.exec("reset role;select set_config('request.jwt.claims','{}',false);set role service_role;");
await assert.rejects(rpc('confirm_order_payment',[id,'sample','event-1',15000,'GBP',new Date().toISOString()]),/disabled/);
await db.exec('reset role;update public.order_payment_controls set enabled=true;set role service_role;');
await assert.rejects(rpc('confirm_order_payment',[id,'sample','event-1',15001,'GBP',new Date().toISOString()]),/does not match/);
await assert.rejects(rpc('confirm_order_payment',[id,'sample','event-1',15000,'EUR',new Date().toISOString()]),/does not match/);
await rpc('confirm_order_payment',[id,'sample','event-1',15000,'GBP',new Date().toISOString()]);
await rpc('confirm_order_payment',[id,'sample','event-1',15000,'GBP',new Date().toISOString()]);
await actor(b);const released=(await db.query('select status,factory_status,production_released_at from public.orders where id=$1',[id])).rows[0];assert.equal(released.status,'processing');assert.equal(released.factory_status,'in_production');assert.ok(released.production_released_at);
await actor(admin);assert.equal((await db.query("select count(*)::int as n from public.order_routing_events where order_id=$1 and event_type='production_released'",[id])).rows[0].n,1);
assert.equal((await db.query('select count(*)::int as n from public.order_verified_payments where order_id=$1',[id])).rows[0].n,1);
await assert.rejects(rpc('assign_order_manufacturer',[id,a,'2027-01-01']),/cannot be assigned/);

const expiredId='77777777-7777-7777-7777-777777777777',declinedId='88888888-8888-8888-8888-888888888888';
async function newOrder(orderId){await actor(buyer);await db.query(`insert into public.orders(id,user_id,kind,product_name,garment_type,status,status_label,order_quantities)values($1,$2,'production','Boundary test','Hoodies','submitted','Awaiting quote','{"mode":"custom_clothing","sample":{"id":"sample","kind":"sample","targetTotal":6,"bySize":{"s":6}},"bulkRuns":[]}')`,[orderId,buyer]);}
await newOrder(expiredId);await actor(admin);await rpc('assign_order_manufacturer',[expiredId,a,'2027-01-01']);await actor(a);await rpc('submit_manufacturer_quote',[expiredId,quote]);await actor(admin);await rpc('publish_order_quote',[expiredId,'[{"id":"sample","cents":15000}]']);
await db.exec(`reset role;select set_config('request.jwt.claims','{}',false);select set_config('app.routing_write','${expiredId}',false);update public.orders set quote_expires_at=now()-interval '1 second',offer_issued_at=now()-interval '31 days' where id='${expiredId}';select set_config('app.routing_write','',false);set role service_role;`);
await assert.rejects(rpc('confirm_order_payment',[expiredId,'sample','expired-event',15000,'GBP',new Date().toISOString()]),/valid payable offer/);
await newOrder(declinedId);await actor(admin);await rpc('assign_order_manufacturer',[declinedId,a,'2027-01-01']);await actor(a);assert.equal((await rpc('reject_order_quotation',[declinedId,'No available capacity'])).rows[0].result,'rejected');
await actor(admin);await assert.rejects(rpc('assign_order_manufacturer',[declinedId,a,'2027-01-01']),/another manufacturer/);await rpc('assign_order_manufacturer',[declinedId,b,'2027-01-01']);
assert.equal((await db.query("select count(*)::int as n from public.order_routing_events where order_id=$1 and event_type='manufacturer_declined'",[declinedId])).rows[0].n,1);
await actor(buyer);assert.equal((await db.query('select id from public.order_verified_payments')).rows.length,0);assert.equal((await db.query('select id from public.order_routing_events')).rows.length,0);
console.log('PASS: offer expiry boundary, manufacturer decline/reroute, private audit and payment receipts isolated');
await db.close();
console.log('PASS: repeatable migration; legacy records unchanged; new order isolation; quote/reject/reroute; declined-factory exclusion; 30-day publication; browser payment denial; disabled payment gate; exact amount/currency verification; idempotent automatic production release');
