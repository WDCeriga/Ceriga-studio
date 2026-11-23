process.on('uncaughtException',e=>{console.error(e.message,e.where??'');process.exit(1)});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase();const [admin,buyer,factory,other]=Array.from({length:4},()=>randomUUID());let order;
const draft=(action='read',data=null,base=null,revision=null)=>db.query('select public.factory_quote_draft($1,$2,$3,$4,$5) value',[order,action,data,base,revision]).then(r=>r.rows[0].value);
try{
 for(const id of [admin,buyer,factory,other])await db.query('insert into auth.users(id,email)values($1,$2)',[id,id===admin?'owner@ceriga.io':id+'@example.invalid']);
 await db.query("insert into manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,moq,calendar_workdays)values($1,'Factory','active',true,array['T-shirts'],1,array[1,2,3,4,5,6,7]),($2,'Other','active',true,array['T-shirts'],1,array[1,2,3,4,5,6,7])",[factory,other]);
 await asAccount(db,buyer);order=(await db.query('select public.create_customer_order($1) value',[{kind:'production',product_name:'Draft fixture',garment_type:'T-shirts',delivery_address:{country:'GB'},order_quantities:{mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:1}},bulkRuns:[]}}])).rows[0].value.id;
 await asAccount(db,admin,'owner@ceriga.io');await db.query('select public.assign_order_manufacturer($1,$2,current_date+3)',[order,factory]);
 await asAccount(db,factory);assert.equal(await draft(),null);
 const base={at:null,status:'new'},payload={rows:[{id:'sample',unitPrice:'1.00',days:'3'}],shipping:{},currency:'EUR',comments:'Personal draft'};
 const saved=await draft('save',payload,base,0);assert.equal(saved.revision,1);
 assert.deepEqual((await draft()).payload,payload);
 await assert.rejects(draft('save',payload,base,0),/changed/);
 for(const id of [buyer,other]){await asAccount(db,id);await assert.rejects(draft(),/access denied/);assert.equal((await db.query('select *from factory_quote_drafts where order_id=$1',[order])).rows.length,0);}
 await asAccount(db,factory);
 const tier={id:'sample',kind:'sample',label:'Sample',totalUnits:1,unitPriceCents:100,manufacturerQuoteCents:100,currency:'EUR',leadTimeDays:3,shipping:{priceCents:0,currency:'EUR',provider:'Factory carrier',method:'Air freight',origin:'Portugal',destination:'GB'}};
 const submit=expected=>db.query('select public.submit_factory_quote_checked($1,$2,$3,false,\'\') value',[order,[tier],expected]).then(r=>r.rows[0].value);
 await assert.rejects(submit({at:null,status:'reviewing'}),/changed/);
 assert.equal(await submit(base),order);
 assert.equal(await draft(),null);
 await assert.rejects(submit(base),/changed/);
 await asAccount(db,admin,'owner@ceriga.io');assert.equal((await db.query('select manufacturer_quote from account_orders where id=$1',[order])).rows[0].manufacturer_quote[0].manufacturerQuoteCents,100);
 console.log('PASS per-account private persistent drafts, empty reads, stale draft rejection, checked submission, cleared draft after persistence and stale resubmission denial.');
}finally{await db.close();}
