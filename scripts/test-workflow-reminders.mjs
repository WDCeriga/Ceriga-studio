process.on('uncaughtException',e=>{console.error(e.message,e.where??'');process.exit(1)});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase();const [admin,buyer,factory]=Array.from({length:3},()=>randomUUID());
const health=settings=>db.query('select public.admin_workflow_health($1) value',[settings??null]).then(r=>r.rows[0].value);
try{
 for(const id of [admin,buyer,factory])await db.query('insert into auth.users(id,email)values($1,$2)',[id,id===admin?'owner@ceriga.io':id+'@example.invalid']);
 await db.query("insert into manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,moq,calendar_workdays)values($1,'Factory','active',true,array['T-shirts'],1,array[1,2,3,4,5,6,7])",[factory]);
 await asAccount(db,buyer);await assert.rejects(health(),/Superadmin/);
 const order=(await db.query('select public.create_customer_order($1) value',[{kind:'production',product_name:'Reminder fixture',garment_type:'T-shirts',order_quantities:{mode:'custom_clothing',sample:{id:'sample',kind:'sample',bySize:{m:1}},bulkRuns:[]}}])).rows[0].value.id;
 await asAccount(db,admin,'owner@ceriga.io');await db.query('select public.assign_order_manufacturer($1,$2,current_date+1)',[order,factory]);
 let context=await health();assert.equal(context.settings.enabled,true);assert.ok(context.jobs.some(j=>j.name==='ceriga-internal-workflow-reminders'));
 await assert.rejects(health({...context.settings,repeatHours:0,_expected:context.settings}),/interval/);
 await assert.rejects(db.query('select public.internal_workflow_reminders()'),/permission denied/);
 await db.exec('reset role');
 const run=()=>db.query('select public.internal_workflow_reminders() value').then(r=>r.rows[0].value);
 assert.equal(await run(),1);assert.equal(await run(),0);
 assert.equal((await db.query("select count(*) n from internal_reminder_dispatches where order_id=$1",[order])).rows[0].n,1);
 const notifications=(await db.query("select *from portal_notifications where order_id=$1 and title='Quotation reminder'",[order])).rows;
 assert.equal(notifications.length,1);assert.equal(notifications[0].audience,'manufacturer');assert.equal(notifications[0].user_id,factory);
 assert.equal((await db.query('select status,production_released_at from orders where id=$1',[order])).rows[0].production_released_at,null);
 await asAccount(db,admin,'owner@ceriga.io');await health({...context.settings,enabled:false,_expected:context.settings});
 await assert.rejects(health({...context.settings,_expected:context.settings}),/changed/);
 await db.exec('reset role');assert.equal(await run(),0);
 for(const[hour,expected]of[[21,false],[22,true],[0,true],[6,false]]){
  const quiet=(await db.query("select public.internal_reminder_quiet($1,$2) value",[{quietStartUTC:22,quietEndUTC:6},`2026-11-23T${String(hour).padStart(2,'0')}:00:00Z`])).rows[0].value;
  assert.equal(quiet,expected);
 }
 assert.equal((await db.query("select public.internal_reminder_quiet($1,now()) value",[{quietStartUTC:0,quietEndUTC:0}])).rows[0].value,false);
 await asAccount(db,buyer);assert.equal((await db.query('select *from internal_reminder_dispatches')).rows.length,0);
 console.log('PASS configurable internal reminders, private health, scheduler execute denial, repeat-window dedup, correct recipient, disable switch, no release mutation or customer notification.');
}finally{await db.close();}
