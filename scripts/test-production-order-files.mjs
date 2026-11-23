import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase({automaticAssignment:true}),buyer=randomUUID(),other=randomUUID(),factory=randomUUID();
const create=async p=>(await db.query('select public.create_customer_order($1) result',[p])).rows[0].result;
const input={kind:'production',product_name:'Blank design fixture',garment_type:'T-shirts',order_quantities:{mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:1}},bulkRuns:[]},specifications:{decoration:[],requiredCapabilities:[]}};
try{
 await db.exec(await readFile('supabase/migrations/20261122010000_complete_customer_order_before_assignment.sql','utf8'));
 for(const[id,email]of[[buyer,'buyer@example.invalid'],[other,'other@example.invalid'],[factory,'factory@example.invalid']])await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
 await db.query("insert into public.manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,calendar_workdays) values($1,'Fixture factory','active',true,array['T-shirts'],array[1,2,3,4,5,6,7])",[factory]);
 const id=randomUUID(),path=buyer+'/'+id+'/blank-preview.png';await db.query("insert into storage.objects(bucket_id,name,owner)values('order-uploads',$1,$2)",[path,buyer]);
 await asAccount(db,buyer);const saved=await create({...input,id,quote_request:{storagePaths:[path],fileNames:['blank-preview.png']}});assert.equal(saved.id,id);assert.equal(saved.assigned_manufacturer_id,factory);assert.deepEqual(saved.quote_request.storagePaths,[path]);assert.equal(saved.kind,'production');
 await assert.rejects(db.query('select public.patch_account_order($1,$2)',[id,{specifications:{fit:'changed'}}]),/authorised/);
 await assert.rejects(create({...input,id:randomUUID(),quote_request:{storagePaths:[path]}}),/Files must belong/);
 const missingId=randomUUID();await assert.rejects(create({...input,id:missingId,quote_request:{storagePaths:[buyer+'/'+missingId+'/missing.png']}}),/Files must belong/);
 await assert.rejects(create({...input,quote_request:{storagePaths:'bad'}}),/array/);
 assert.ok((await create(input)).id);
 const pdf=await create({...input,kind:'tech-pack',export_format:'pdf'});assert.equal(pdf.assigned_manufacturer_id,null);assert.equal(pdf.kind,'tech-pack');
 await asAccount(db,other);await assert.rejects(create({...input,id,quote_request:{storagePaths:[path]}}),/Files must belong/);assert.equal((await db.query('select id from public.account_orders where id=$1',[id])).rows.length,0);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role authenticated');await assert.rejects(create(input),/Sign in/);
 console.log('PASS blank design: complete initial uploads before assignment; legacy no-file and PDF flows; invalid/missing/cross-account uploads rejected; assigned edits remain restricted; unauthenticated rejection.');
}finally{await db.close()}
