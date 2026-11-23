process.on('uncaughtException',e=>{console.error(e.message,e.where??'');process.exit(1)});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase();
const migration=await readFile('supabase/migrations/20261123020000_internal_release_and_shipping_defaults.sql','utf8');
const [admin,buyer,factory,other]=Array.from({length:4},()=>randomUUID());
const defaults=(data=null,expected=null)=>db.query('select public.factory_shipping_defaults($1,$2) value',[data,expected]).then(r=>r.rows[0].value);
try{
 for(const [id,email] of [[admin,'owner@ceriga.io'],[buyer,'buyer@example.invalid'],[factory,'factory@example.invalid'],[other,'other@example.invalid']])await db.query('insert into auth.users(id,email)values($1,$2)',[id,email]);
 for(const id of [factory,other])await db.query("insert into manufacturer_profiles(user_id,factory_name,onboarding_complete,status,country,profile_details)values($1,'Factory',true,'active','Portugal',$2)",[id,{country:'Portugal',shippingMethods:['Sea freight'],shippingProvidersByMethod:{'Sea freight':'Existing provider'}}]);
 await asAccount(db,buyer);await assert.rejects(defaults(),/permission/);
 await asAccount(db,factory);let saved=await defaults();assert.deepEqual(saved.shippingMethods,['Sea freight']);
 const patch={shippingMethods:['Air freight'],shippingProvidersByMethod:{'Air freight':'Factory carrier'}};
 const next=await defaults(patch,saved.revision);assert.deepEqual(next.shippingMethods,['Air freight']);
 await assert.rejects(defaults(patch,saved.revision),/changed/);
 await assert.rejects(defaults({...patch,shippingMethods:['Unsupported']},next.revision),/method/);
 await assert.rejects(defaults({...patch,user_id:other},next.revision),/valid shipping/);
 await asAccount(db,other);assert.deepEqual((await defaults()).shippingMethods,['Sea freight']);
 await asAccount(db,admin,'owner@ceriga.io');
 assert.equal((await db.query("select profile_details->>'country'country from manufacturer_profiles where user_id=$1",[factory])).rows[0].country,'Portugal');
 assert.ok((await db.query("select *from manufacturer_team_audit where manufacturer_id=$1 and action='update_shipping_defaults'",[factory])).rows.length);
 await assert.rejects(db.query('select public.production_release_authorized(o)from orders o'),/permission denied/);
 await db.exec('reset role');await db.exec(migration);
 const order=randomUUID();await db.query("insert into orders(id,user_id,kind,product_name,garment_type,status,status_label)values($1,$2,'production','Release fixture','T-shirts','submitted','Submitted')",[order,buyer]);
 let row=(await db.query('select public.production_release_authorized(o) allowed from orders o where id=$1',[order])).rows[0];assert.equal(row.allowed,false);
 // Evaluate the private helper with explicit fixture values, not fabricated live receipts.
 row=(await db.query(`select public.production_release_authorized(jsonb_populate_record(null::public.orders,jsonb_build_object('id',$1::uuid,'kind','production','assigned_manufacturer_id',$2::uuid,'production_released_at',now(),'manufacturer_submitted_at',now()))) allowed`,[order,factory])).rows[0];assert.equal(row.allowed,true);
 row=(await db.query(`select public.production_release_authorized(jsonb_populate_record(null::public.orders,jsonb_build_object('id',$1::uuid,'kind','production','assigned_manufacturer_id',$2::uuid,'production_released_at',now(),'payment_verified_at',now()))) allowed`,[order,factory])).rows[0];assert.equal(row.allowed,false);
 await asAccount(db,buyer);await assert.rejects(db.query("select public.freight_logistics_update($1,gen_random_uuid(),'collection_scheduled','{}')",[order]),/authorization/);
 await asAccount(db,admin,'owner@ceriga.io');await assert.rejects(db.query("select public.freight_logistics_update($1,gen_random_uuid(),'collection_scheduled','{}')",[order]),/approved QC/);
 console.log('PASS scoped defaults persist without replacing profile, stale edits and invalid payloads rejected, factory isolation/audit, private release eligibility and retained QC/authorization gates.');
}finally{await db.close();}
