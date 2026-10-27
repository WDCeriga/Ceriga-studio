import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
import {testDatabase,asAccount} from './support/testDatabase.mjs';
import {exportSandboxViewer} from './support/exportSandboxViewer.mjs';

// This script has no Supabase connection, credentials, email sender or payment provider.
const base=path.resolve('.sandbox'),output=path.resolve(process.argv[2]||'.sandbox/order-batch-20261025');
if(!output.startsWith(base+path.sep))throw Error('Output must be a dedicated directory inside .sandbox');
await fs.mkdir(output,{recursive:true});
const exists=async file=>{try{await fs.access(file);return true;}catch{return false;}};
if(await exists(path.join(output,'manifest.json'))){await exportSandboxViewer(output);console.log('Batch already exists; no duplicate accounts or orders created. '+output);process.exit(0);}
const dbDir=path.join(output,'database'),ready=path.join(output,'schema-ready.json');
const db=await exists(ready)?new PGlite(dbDir):await testDatabase({dataDir:dbDir});
await fs.writeFile(ready,JSON.stringify({schemaHash:createHash('sha256').update(await fs.readFile('supabase/schema.sql')).digest('hex')}));
const accounts=[
 {id:randomUUID(),role:'brand',name:'TEST — Northline Brand',email:'northline@ceriga.test'},
 {id:randomUUID(),role:'brand',name:'TEST — Studio Coast',email:'coast@ceriga.test'},
 {id:randomUUID(),role:'manufacturer',name:'TEST — Red Loom Factory',email:'redloom@ceriga.test'},
 {id:randomUUID(),role:'manufacturer',name:'TEST — Atlantic Garments',email:'atlantic@ceriga.test'},
 {id:randomUUID(),role:'superadmin',name:'TEST — Sandbox Admin',email:'admin@ceriga.test'},
];
const admin=accounts[4],factories=accounts.slice(2,4),brands=accounts.slice(0,2);
const stages=[['Awaiting assignment',4],['Quotation requested',4],['Reassignment required',2],['Quotation revision requested',3],['Quotation awaiting admin review',3],['Awaiting customer submission',3],['Production: preparation',3],['Production: cutting',3],['Production: sewing',3],['Production: finishing',2],['QC awaiting submission',2],['QC pending review',2],['QC changes required',2],['Ready for dispatch',2],['Shipping',1],['Completed',1]];
const actor=account=>asAccount(db,account.id,account.email);
const rpc=async(name,args=[])=>{const values=args.map((_,i)=>'$'+(i+1)).join(',');return(await db.query(`select public.${name}(${values}) result`,args)).rows[0].result;};
const qc=(order,action,data={})=>rpc('qc_action',[order,action,JSON.stringify(data)]);
const add=(value,days)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
function testImage(back=false){
 const size=420,raw=Buffer.alloc(size*(size*3+1));const glyphs=['11111/00100/00100/00100/00100/00100/00100','11111/10000/10000/11110/10000/10000/11111','11111/10000/10000/11111/00001/00001/11111','11111/00100/00100/00100/00100/00100/00100'].map(s=>s.split('/'));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const garment=(x>=125&&x<=295&&y>=110&&y<=350)||(y>=85&&y<=180&&((x>=65&&x<=150)||(x>=270&&x<=355)));
  let rgb=garment?(back?[52,88,115]:[165,48,47]):[20,20,23];
  if(garment&&((x>=125&&x<=129)||(x>=291&&x<=295)||y>=344))rgb=[210,210,215];
  const tx=Math.floor((x-144)/5),ty=Math.floor((y-203)/5),letter=Math.floor(tx/6),column=tx%6;
  if(letter>=0&&letter<4&&column>=0&&column<5&&ty>=0&&ty<7&&glyphs[letter][ty][column]==='1')rgb=[245,245,245];
  const offset=y*(size*3+1)+1+x*3;raw[offset]=rgb[0];raw[offset+1]=rgb[1];raw[offset+2]=rgb[2];
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const images=[testImage(false),testImage(true)];
let transaction=false;
try{
 const existing=(await db.query('select count(*)::int n from public.orders')).rows[0].n;
 assert.equal(existing,0,'This is not an empty sandbox. Refusing to append a duplicate batch.');
 await db.exec('begin');transaction=true;
 for(const account of accounts){
  await db.query('insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)values($1,$2,$3,now())',[account.id,account.email,JSON.stringify({full_name:account.name,ceriga_test:true})]);
  await db.query('update public.profiles set full_name=$2,role=$3 where id=$1',[account.id,account.name,account.role==='manufacturer'?'manufacturer':'brand']);
 }
 await db.query('insert into public.superadmin_emails(email)values($1)on conflict do nothing',[admin.email]);
 for(let i=0;i<factories.length;i++)await db.query("insert into public.manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,capabilities,shipping_regions,monthly_capacity,moq,country,city)values($1,$2,'active',true,array['T-shirts','Hoodies'],array['Cut and sew','Screen printing','Embroidery'],array['UK','European Union (EU)'],$3,50,$4,$5)",[factories[i].id,factories[i].name,i?800:1000,i?'Portugal':'UK',i?'Porto':'Manchester']);
 const today=String((await db.query('select current_date::text d')).rows[0].d),targets=[];let index=0;
 for(const factory of factories){await actor(factory);await rpc('save_calendar_schedule',[[1,2,3,4,5],factory===factories[0]?'Europe/London':'Europe/Lisbon',0]);}
 const evidence=async(order,factory,report)=>{
  const ids=[];for(let i=0;i<2;i++){
   const fileName=i?'TEST-back.png':'TEST-front.png',objectPath=`${order}/${factory.id}/sandbox/${fileName}`,absolute=path.join(output,'storage','qc-evidence',objectPath);await fs.mkdir(path.dirname(absolute),{recursive:true});await fs.writeFile(absolute,images[i]);
   await db.query("insert into storage.objects(bucket_id,name,metadata)values('qc-evidence',$1,$2)",[objectPath,JSON.stringify({mimetype:'image/png',size:images[i].length})]);
   ids.push(await qc(order,'report_evidence',{id:report,path:objectPath,file_name:fileName,file_role:'photo'}));
  }return ids;
 };
 for(const [target,count]of stages)for(let n=0;n<count;n++,index++){
  const brand=brands[index%2],factory=factories[Math.floor(index/2)%2],bulk=index%2===0,quantity=bulk?[100,250,500][index%3]:6,option=bulk?'bulk-1':'sample',garment=index%3?'T-shirts':'Hoodies';
  const keys=['xs','s','m','l','xl','xxl'],sizes=n=>Object.fromEntries(keys.map((key,i)=>[key,Math.floor(n/6)+(i<n%6?1:0)]));
  const sample={id:'sample',kind:'sample',targetTotal:6,bySize:sizes(6)};const line=bulk?{id:option,kind:'bulk',targetTotal:quantity,bySize:sizes(quantity)}:sample;
  const plan={mode:'custom_clothing',sample,bulkRuns:bulk?[line]:[]};const requirements=[sample,...plan.bulkRuns];
  await actor(brand);
  const order=(await rpc('create_customer_order',[JSON.stringify({kind:'production',product_name:`TEST ${String(index+1).padStart(3,'0')} — ${garment==='Hoodies'?'Heavyweight Hoodie':'Cotton T-Shirt'}`,garment_type:garment,order_quantities:plan,specifications:{fabricType:'Cotton',gsm:garment==='Hoodies'?320:180,requiredCapabilities:[]},contact_name:brand.name,contact_email:brand.email,delivery_address:{name:brand.name,addressLine1:'TEST ADDRESS — DO NOT SHIP',city:'Test City',country:'UK',postalCode:'TEST ONLY'}})])).id;
  targets.push({id:order,target,brandId:brand.id,manufacturerId:target==='Awaiting assignment'?null:factory.id,quantity,option});
  if(target==='Awaiting assignment')continue;
  await actor(admin);await rpc('assign_order_manufacturer',[order,factory.id,add(today,3+index%4)]);
  if(target==='Quotation requested')continue;
  await actor(factory);
  if(target==='Reassignment required'){await rpc('reject_order_quotation',[order,'TEST — Factory cannot meet the requested production window.']);continue;}
  const unit=garment==='Hoodies'?2500:1200;
  await rpc('submit_manufacturer_quote',[order,JSON.stringify(requirements.map(row=>({id:row.id,kind:row.kind,unitPriceCents:unit+(row.kind==='sample'?1200:0),currency:'EUR',leadTimeDays:10+index%15})))]);
  if(target==='Quotation awaiting admin review')continue;
  await actor(admin);
  if(target==='Quotation revision requested'){await rpc('review_manufacturer_quotation',[order,'TEST — Please revise the lead time and confirm packaging costs.','revise']);continue;}
  await rpc('publish_order_quote',[order,JSON.stringify(requirements.map(row=>({id:row.id,cents:Math.round(row.targetTotal*(unit+(row.kind==='sample'?1200:0))*1.3)})))]);
  if(target==='Awaiting customer submission')continue;
  await actor(brand);await rpc('submit_order_to_manufacturer',[order,option]);
  await actor(factory);
  const productionStages=['preparation','cutting','sewing','finishing','quality_control'];const endStage=target.startsWith('Production: ')?target.replace('Production: ',''):'quality_control';
  let version=0;
  for(const stage of productionStages){await rpc('update_order_production',[order,stage,'TEST — Automated sandbox production update.',add(today,5+index%22),target==='Production: sewing'&&n===0?'TEST — Fabric delivery needs review.':'',version++]);if(stage===endStage)break;}
  if(target.startsWith('Production: '))continue;
  if(target==='QC awaiting submission')continue;
  const report=await qc(order,'start_report'),photoIds=await evidence(order,factory,report),context=await rpc('qc_report_context',[order]);
  const hasIssues=target==='QC changes required'||(target==='QC pending review'&&n===0);
  const payload={id:report,production_summary:'TEST — Synthetic production report for workflow evaluation. Images are generated test illustrations, not factory production photographs.',produced_lines:context.ordered_lines.map((l,i)=>({...l,produced:l.ordered-(hasIssues&&i===0?1:0)})),has_issues:hasIssues,issue_description:hasIssues?'TEST — One garment needs rework; quantity discrepancy disclosed.':'',manufacturer_confirmed:true,photo_ids:photoIds,supporting_ids:[]};
  await qc(order,'submit_report',payload);
  if(target==='QC pending review')continue;
  await actor(admin);
  if(target==='QC changes required'){await qc(order,'request_report_changes',{id:report,feedback:'TEST — Correct the quantity discrepancy and upload a clearer print close-up.'});continue;}
  // Include a genuine correction/resubmission history on the completed order.
  let approved=report;
  if(target==='Completed'){
   await qc(order,'request_report_changes',{id:report,feedback:'TEST — Add a clearer construction image.'});await actor(factory);approved=await qc(order,'start_report');await qc(order,'submit_report',{...payload,id:approved,production_summary:'TEST — Revised production report with retained test evidence; correction completed.'});await actor(admin);
  }
  await qc(order,'approve_report',{id:approved});
  if(target==='Ready for dispatch')continue;
  await actor(factory);const release=(await db.query('select id from public.qc_shipment_releases where order_id=$1 and revoked_at is null',[order])).rows[0].id;
  await qc(order,'dispatch',{id:release,tracking:`TEST-NOT-A-CARRIER-${String(index+1).padStart(3,'0')}`});
  if(target==='Shipping')continue;
  await actor(admin);await rpc('confirm_order_delivery',[order,'TEST — Simulated delivery confirmed in an isolated sandbox. No goods shipped.']);
 }
 for(let i=0;i<factories.length;i++){await actor(factories[i]);await rpc('save_calendar_availability',[JSON.stringify([{start:add(today,i?7:10),end:add(today,i?11:14)}]),i?'TEST — Factory maintenance':'TEST — Factory holiday',null,null,false]);}
 await actor(admin);
 const dashboard=await rpc('portal_dashboard',[true,30,'','all','desc']),calendar=await rpc('production_calendar',[today,add(today,30),true,null,'','','all','all','all']);
 await db.exec('reset role');
 const orders=(await db.query(`select o.id,o.product_name,o.status,o.factory_status,o.qc_status,o.created_at,o.due_quote_by,o.quote_expires_at,o.production_released_at,o.manufacturer_submitted_at,o.completed_at,o.selected_price_option_id,o.order_quantities,o.price_options,o.factory_reject_reason,o.user_id,p.full_name brand,o.assigned_manufacturer_id,m.factory_name manufacturer,u.stage production_stage,u.expected_completion,u.delay_reason,
 case when o.status='completed'then 'Completed'when o.status='shipping'then 'Shipping'when o.status='processing'and o.qc_status='approved'then 'Ready for dispatch'when o.qc_status='changes_required'then 'QC changes required'when o.qc_status='pending_review'then 'QC pending review'when o.status='processing'and u.stage='quality_control'then 'QC awaiting submission'when o.status='processing'then 'Production: '||u.stage when o.status='priced'then 'Awaiting customer submission'when o.factory_status='clarifying'then 'Quotation revision requested'when o.factory_status='rejected'then 'Reassignment required'when o.factory_status='quoted'then 'Quotation awaiting admin review'when o.assigned_manufacturer_id is not null then 'Quotation requested'else 'Awaiting assignment'end actual_stage
 from public.orders o join public.profiles p on p.id=o.user_id left join public.manufacturer_profiles m on m.user_id=o.assigned_manufacturer_id left join lateral(select stage,expected_completion,delay_reason from public.order_production_updates where order_id=o.id order by version desc limit 1)u on true order by o.product_name`)).rows;
 assert.equal(orders.length,40);for(const target of targets)assert.equal(orders.find(o=>o.id===target.id).actual_stage,target.target,`Unexpected persisted stage for ${target.id}`);
 assert.equal((await db.query('select count(*)::int n from public.order_verified_payments')).rows[0].n,0,'No verified payments should be fabricated');assert.deepEqual(dashboard.revenue,[]);
 const details={};for(const order of orders){details[order.id]={order,production:(await db.query('select *from public.order_production_updates where order_id=$1 order by version',[order.id])).rows,qc:(await db.query('select *from public.qc_inspections where order_id=$1 order by report_version',[order.id])).rows,evidence:(await db.query('select *from public.qc_evidence where order_id=$1',[order.id])).rows,events:(await db.query('select *from public.order_routing_events where order_id=$1 order by created_at',[order.id])).rows};}
 for(const factory of factories){await actor(factory);const visible=(await db.query('select id,assigned_manufacturer_id from public.account_orders')).rows;assert.ok(visible.every(o=>o.assigned_manufacturer_id===factory.id));await db.exec('savepoint permission_probe');await assert.rejects(rpc('portal_dashboard',[true,30,'','all','desc']),/denied/);await db.exec('rollback to savepoint permission_probe;release savepoint permission_probe');}
 for(const brand of brands){await actor(brand);assert.ok((await db.query('select user_id from public.account_orders')).rows.every(o=>o.user_id===brand.id));}
 await db.exec('reset role');const notifications=(await db.query('select count(*)::int n from public.portal_notifications')).rows[0].n;await db.exec('commit');transaction=false;
 const stageCounts=Object.fromEntries(stages.map(([stage])=>[stage,orders.filter(o=>o.actual_stage===stage).length]));
 const manifest={environment:'ISOLATED LOCAL TEST DATABASE',createdAt:new Date().toISOString(),accounts,orders:orders.length,stageCounts,notifications,externalNotificationsSent:0,paymentsCharged:0,verifiedPayments:0,authentication:'Synthetic auth identities in the isolated database; not live Supabase logins.',productionRelease:'Existing customer-submit-without-payment workflow; no verified payment or revenue is fabricated.',checks:['40 persisted orders match their intended stages','Manufacturer order isolation','Brand order isolation','Super Admin access denied for manufacturers','No verified payment records or revenue','QC correction history preserved','Real database workflow functions used']};
 await fs.writeFile(path.join(output,'snapshot.json'),JSON.stringify({manifest,orders,details,dashboard,calendar},null,2));await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 await exportSandboxViewer(output);
 console.log(JSON.stringify({output,accounts:accounts.length,orders:orders.length,stageCounts,checks:manifest.checks},null,2));
}catch(error){if(transaction)await db.exec('rollback');console.error(error.message,error.where||'');process.exitCode=1;}finally{await db.close();}
