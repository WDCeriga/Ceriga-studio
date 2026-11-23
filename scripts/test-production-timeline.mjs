process.on('uncaughtException',e=>{console.error(e.message,e.where??'',e.stack?.split('\n').slice(-2).join('\n'));process.exit(1)});
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {testDatabase,asAccount} from './support/testDatabase.mjs';
const db=await testDatabase(),root='10000000-0000-0000-0000-000000000001',factory='20000000-0000-0000-0000-000000000002',other='30000000-0000-0000-0000-000000000003',buyer='40000000-0000-0000-0000-000000000004',staff='50000000-0000-0000-0000-000000000005';let groups=0;
const actor=async id=>asAccount(db,id,id===root?'owner@ceriga.io':id+'@example.invalid'),rpc=async(name,args=[]) =>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})v`,args)).rows[0].v,board=()=>rpc('production_board'),ok=s=>{groups++;console.log('PASS '+s);};
const action=(o,a,data={},request=crypto.randomUUID())=>rpc('production_action',[o.id,a,data,o.plan.revision,o.version,request]);
try{
 for(const id of[root,factory,other,buyer,staff])await db.query('insert into auth.users(id,email,email_confirmed_at,encrypted_password)values($1,$2,now(),$3)',[id,id===root?'owner@ceriga.io':id+'@example.invalid','synthetic-password-hash']);
 await db.query("insert into manufacturer_profiles(user_id,factory_name,onboarding_complete,status,typical_lead_days,monthly_capacity)values($1,'Timeline factory',true,'active',10,1000),($2,'Other factory',true,'active',10,1000)",[factory,other]);
 await db.query("update profiles set role='manufacturer'where id=any($1::uuid[])",[[factory,other]]);await actor(factory);assert.equal((await board()).orders.length,0);let settings=await rpc('production_template');assert.equal(settings.revision,0);assert.deepEqual(settings.config.stages.map(stage=>stage.id),['preparation','cutting_sewing','finishing']);assert.ok(settings.config.stages.every(s=>!s.automatic));let config=settings.config;config={...config,timezone:'Europe/London',workdays:[1,2,3,4,5],stages:config.stages.map((s,i)=>({...s,duration:1,unit:'working_hours',starts:i===0?'production_approval':'previous_stage'}))};settings=await rpc('production_template',[config,0,true]);assert.equal(settings.revision,1);assert.equal((await rpc('production_template')).config.timezone,'Europe/London');await assert.rejects(()=>rpc('production_template',[config,0,true]),/changed/);await assert.rejects(()=>rpc('production_template',[{...config,timezone:'Fake/Timezone'},1,true]),/timezone/);ok('honest empty board, persistent defaults, all three active stages, optimistic settings conflict and validation');
 await actor(root);await db.exec('reset role');const calc=async(start,duration,unit,blocks=[])=>new Date(await rpc('production_add_time',[factory,config,start,duration,unit,blocks])).toISOString();assert.equal(await calc('2026-10-23T15:00:00Z',2,'working_hours'),'2026-10-26T10:00:00.000Z');assert.equal(await calc('2026-10-24T11:00:00Z',1,'calendar_days'),'2026-10-25T12:00:00.000Z');assert.equal(await calc('2026-10-24T11:00:00Z',24,'hours'),'2026-10-25T11:00:00.000Z');await db.query("insert into manufacturer_availability(manufacturer_id,kind,starts_on,ends_on,reason,status)values($1,'time_off','2026-10-26','2026-10-26','Closure','approved'),($1,'time_off','2028-02-29','2028-02-29','Leap closure','approved')",[factory]);assert.equal(await calc('2026-10-23T15:00:00Z',2,'working_hours'),'2026-10-27T10:00:00.000Z');assert.equal(await calc('2028-02-28T16:00:00Z',2,'working_hours'),'2028-03-01T10:00:00.000Z');assert.equal(await calc('2026-11-02T09:00:00Z',2,'working_hours',[{start:'2026-11-02T10:00:00Z',end:'2026-11-03T10:00:00Z'}]),'2026-11-03T11:00:00.000Z');assert.equal(await rpc('production_add_time',[factory,config,'2026-11-02T09:00:00Z',2,'working_hours',[{start:'2026-11-02T10:00:00Z',end:null}]]),null);ok('working hours, weekends, inclusive closures, leap day, DST calendar-vs-clock days and known/unknown pause intervals');
 const makeOrder=async(f,name)=>{await actor(root);await db.exec('reset role');const id=(await db.query("insert into orders(user_id,kind,product_name,garment_type,status,status_label)values($1,'production',$2,'T-shirt','submitted','Submitted')returning id",[buyer,name])).rows[0].id;await db.query("select set_config('app.routing_write',$1,false)",[id]);await db.query("select set_config('app.workflow_write',$1,false)",[id]);await db.query("update orders set assigned_manufacturer_id=$2,status='processing',factory_status='in_production',production_released_at=now(),payment_verified_at=now(),paid_amount_cents=100,selected_price_option_id='bulk',price_options=$3 where id=$1",[id,f,JSON.stringify([{id:'bulk',totalUnits:100,priceCents:100,currency:'GBP'}])]);return id;};
 const one=await makeOrder(factory,'One shirt'),two=await makeOrder(factory,'Two shirts'),foreign=await makeOrder(other,'Foreign shirt');await actor(factory);let rows=(await board()).orders;assert.equal(rows.length,2);let o=rows.find(o=>o.id===one);assert.equal(o.stage,'preparation');const request=crypto.randomUUID();await action(o,'advance',{},request);assert.equal((await action(o,'advance',{},request)).replayed,true);await assert.rejects(()=>action(o,'advance'),/changed/);o=(await board()).orders.find(o=>o.id===one);assert.equal(o.stage,'cutting_sewing');assert.equal(o.version,1);const moved=await action(o,'advance');o=(await board()).orders.find(o=>o.id===one);assert.equal(o.stage,'finishing');await action(o,'undo',{event:moved.id});o=(await board()).orders.find(o=>o.id===one);assert.equal(o.stage,'cutting_sewing');assert.equal(o.version,3);await action(o,'stage',{stage:'preparation',reason:'Repeat fabric checks before cutting'});o=(await board()).orders.find(o=>o.id===one);assert.equal(o.stage,'preparation');await assert.rejects(()=>action(o,'stage',{stage:'finishing',reason:'Would skip sewing'}),/cannot be skipped/);await assert.rejects(()=>action(o,'stage',{stage:'cutting_sewing',reason:''}),/Explain/);ok('one-click start/advance, idempotent retry, stale-update denial, append-only undo and skipped-prerequisite protection');
 let t=(await board()).orders.find(o=>o.id===two);assert.equal(t.stage,'preparation');rows=(await board()).orders;const bulk=rows.map(o=>({id:o.id,version:o.version,revision:o.plan.revision}));assert.equal(await rpc('production_bulk',[bulk,crypto.randomUUID()]),2);rows=(await board()).orders;assert.ok(rows.every(o=>o.stage==='cutting_sewing'));const before=rows.find(o=>o.id===one);await assert.rejects(()=>rpc('production_bulk',[[{id:one,version:before.version,revision:before.plan.revision},{id:foreign,version:0,revision:1}],crypto.randomUUID()]),/authorised|eligible/);assert.equal((await board()).orders.find(o=>o.id===one).version,before.version);await actor(other);assert.equal((await board()).orders.length,1);await assert.rejects(()=>action(before,'advance'),/authorised/);assert.equal((await db.query('select *from order_production_timelines where order_id=$1',[one])).rows.length,0);await actor(factory);ok('atomic bulk stage updates, mixed/cross-factory denial with rollback, RLS and assigned-record isolation');
 o=(await board()).orders.find(o=>o.id===one);const preview=await action(o,'preview_block',{reason:'Awaiting materials',category:'materials',until:null});assert.equal(preview.proposed,null);await action(o,'block',{reason:'Awaiting materials',category:'materials',until:null});o=(await board()).orders.find(o=>o.id===one);assert.equal(o.plan.uncertain,true);assert.equal(o.plan.expected_completion,null);await assert.rejects(()=>action(o,'advance'),/blockers/);await action(o,'resume');o=(await board()).orders.find(o=>o.id===one);assert.equal(o.plan.blocks[0].resolved,true);assert.ok(o.plan.expected_completion);await assert.rejects(()=>action(o,'estimate',{reason:'',completion:new Date(Date.now()+86400000).toISOString()}),/Explain/);await action(o,'estimate',{reason:'Updated factory delivery estimate\nCheck delivery dock C:\\receiving',completion:new Date(Date.now()+7*86400000).toISOString()});o=(await board()).orders.find(o=>o.id===one);assert.ok(o.plan.override_completion);ok('unknown delay preview, persistence, blocked advancement, explicit resolution, recalculation and reasoned estimate overrides');

 // Existing orders keep their captured timing rules when defaults change.
 settings=await rpc('production_template');
 const updated={...config,startEvent:'materials',factors:[{id:'large',factor:'quantity',stage:'cutting_sewing',op:'gte',value:50,effect:'add_time',duration:2,unit:'working_hours',notes:''}],stages:config.stages.map(s=>({...s,automatic:true,starts:'previous_estimate'}))};
 await rpc('production_template',[updated,settings.revision,true]);
 o=(await board()).orders.find(o=>o.id===one);assert.equal(o.plan.template_revision,1);
 const change=await action(o,'preview_rules');assert.equal(change.proposed,null);
 await assert.rejects(()=>action(o,'apply_rules',{templateRevision:change.templateRevision,previewHash:'stale'}),/preview/);
 await action(o,'apply_rules',{templateRevision:change.templateRevision,previewHash:change.previewHash});
 o=(await board()).orders.find(o=>o.id===one);assert.equal(o.plan.template_revision,2);assert.equal(o.plan.expected_completion,null);
 await action(o,'facts',{facts:{materials:true,complexity:'standard'}});
 o=(await board()).orders.find(o=>o.id===one);assert.ok(o.plan.facts._materialsAt);assert.ok(o.plan.expected_completion);
 assert.equal(o.plan.schedule.find(s=>s.stage==='cutting_sewing').duration,1);
 ok('default snapshots, explicit preview/hash/apply and material prerequisites');

 await actor(root);await db.exec('reset role');
 await db.query("insert into manufacturer_team_members(manufacturer_id,user_id,role,permissions)values($1,$2,'staff',array['view_orders','production'])",[factory,staff]);
 await db.query('insert into manufacturer_team_order_assignments(manufacturer_id,user_id,order_id)values($1,$2,$3)',[factory,staff,two]);
 await actor(staff);const assigned=(await board()).orders;assert.equal(assigned.length,1);assert.equal(assigned[0].id,two);
 const staffWrite=await action(assigned[0],'facts',{facts:{}});
 assert.equal((await db.query('select actor_id from production_timeline_events where id=$1',[staffWrite.id])).rows[0].actor_id,staff);
 await assert.rejects(()=>action(o,'advance'),/authorised/);
 await assert.rejects(()=>rpc('production_template',[config,2,true]),/settings permission/);
 await actor(root);await db.exec('reset role');
 await db.query('update manufacturer_team_members set removed_at=now()where manufacturer_id=$1 and user_id=$2',[factory,staff]);
 await actor(staff);await assert.rejects(()=>board(),/permission/);
 ok('scoped team assignment, real submitting actor, settings denial and access revocation');

 await actor(factory);const prior=await rpc('production_template');
 const calendarRev=(await db.query('select calendar_revision from manufacturer_profiles where user_id=$1',[factory])).rows[0].calendar_revision;
 await rpc('save_calendar_schedule',[[1,2,3,4,5,6],'UTC',calendarRev]);
 const defaults=await rpc('production_template');assert.equal(defaults.revision,prior.revision+1);assert.equal(defaults.config.timezone,'UTC');
 assert.deepEqual(defaults.config.workdays,[1,2,3,4,5,6]);
 assert.equal((await board()).orders.find(o=>o.id===one).plan.config.timezone,'Europe/London');
 ok('shared calendar/settings workweek and timezone; existing order snapshots preserved');

 // Automatic progression is opt-in and may reach QC, but never approves QC.
 o=(await board()).orders.find(o=>o.id===one);await action(o,'automation',{enabled:false});
 await actor(root);await db.exec('reset role');
 await db.query("update order_production_timelines set stage_started_at=now()-interval '30 days',facts=facts||jsonb_build_object('_materialsAt',now()-interval '30 days')where order_id=$1",[one]);
 await rpc('production_scheduler');
 assert.equal((await db.query("select count(*)n from production_timeline_events where order_id=$1 and kind='automatic'",[one])).rows[0].n,0);
 await actor(factory);o=(await board()).orders.find(o=>o.id===one);assert.equal(o.stage,'cutting_sewing');await action(o,'automation',{enabled:true});
 await assert.rejects(()=>rpc('production_scheduler'),/permission denied/);
 await actor(root);await db.exec('reset role');await rpc('production_scheduler');await rpc('production_scheduler');
 const automatic=(await db.query("select *from production_timeline_events where order_id=$1 and kind='automatic'order by created_at,id",[one])).rows;
 assert.equal(automatic.length,2);assert.ok(automatic.some(e=>e.explanation.includes('QC approval is still required')));
 const latest=(await db.query('select stage from order_production_updates where order_id=$1 order by version desc limit 1',[one])).rows[0];assert.equal(latest.stage,'quality_control');
 assert.notEqual((await db.query('select qc_status from orders where id=$1',[one])).rows[0].qc_status,'approved');
 await db.exec(await fs.readFile('supabase/migrations/20261028010000_three_stage_production.sql','utf8'));
 assert.equal((await db.query("select count(*)n from production_timeline_events where order_id=$1 and kind='automatic'",[one])).rows[0].n,2);
 assert.equal((await db.query("select count(*)n from cron.job where jobname='ceriga-production-timeline'")).rows[0].n,1);
 await actor(buyer);await assert.rejects(()=>board(),/permission/);
 ok('opt-in confirmed three-stage automation, retry deduplication, mandatory QC, private scheduler and repeatable migration');
 console.log(groups+' production timeline scenario groups passed');
}finally{await db.close();}
