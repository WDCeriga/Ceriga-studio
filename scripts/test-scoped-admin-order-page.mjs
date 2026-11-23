process.on('uncaughtException',e=>{console.error(e.message,e.where??'');process.exit(1)});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase();const [admin,buyer,factory]=Array.from({length:3},()=>randomUUID());
const page=(query={})=>db.query('select public.admin_order_page($1) value',[query]).then(r=>r.rows[0].value);
try{
 for(const id of [admin,buyer,factory])await db.query('insert into auth.users(id,email)values($1,$2)',[id,id===admin?'owner@ceriga.io':id+'@example.invalid']);
 await db.query("insert into manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,moq)values($1,'Distinct factory','active',true,array['T-shirts'],1)",[factory]);
 await asAccount(db,buyer);await assert.rejects(page(),/Superadmin/);
 await db.exec('reset role');
 for(let i=0;i<31;i++)await db.query("insert into orders(user_id,kind,product_name,garment_type,status,status_label,created_at)values($1,'production',$2,'T-shirts','submitted','Submitted',now()-make_interval(days=>$3))",[buyer,'Paged fixture '+String(i).padStart(2,'0'),i]);
 await asAccount(db,admin,'owner@ceriga.io');
 let result=await page();assert.equal(result.rows.length,25);assert.equal(result.total,31);assert.equal(result.totalAll,31);
 const second=await page({offset:25});assert.equal(second.rows.length,6);assert.ok(second.rows.every(row=>!result.rows.some(first=>first.id===row.id)));
 result=await page({search:'Paged fixture 30'});assert.equal(result.total,1);assert.equal(result.rows[0].product_name,'Paged fixture 30');assert.equal(result.totalAll,31);
 assert.equal((await page({search:'Not present'})).total,0);
 assert.equal((await page({stage:'review'})).total,0);
 assert.equal((await page({kind:'techpack'})).total,0);
 result=await page({sort:'date',direction:'asc'});assert.equal(result.rows[0].product_name,'Paged fixture 30');
 await assert.rejects(page({sort:'unsafe_sql'}),/Invalid order filters/);
 await asAccount(db,factory);await assert.rejects(page(),/Superadmin/);
 console.log('PASS bounded server pages, whole-dataset counts, filtering/search, stable sorting, empty results, invalid query rejection and customer/factory denial.');
}finally{await db.close();}
