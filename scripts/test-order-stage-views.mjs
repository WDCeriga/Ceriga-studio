import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as Router from 'react-router';
import * as Icons from 'lucide-react';
const orderId='stage-order',factory='factory';
const workspace={order:{id:orderId,productName:'Stage-specific garment',garmentType:'T-shirt',assignedManufacturerId:factory,status:'processing',delivery:{firstName:'Delivery',lastName:'Recipient',address1:'123 Dispatch Road',city:'London',country:'GB',email:'dispatch@example.invalid',phone:'0123456789'}},context:{snapshot:'same',status:'approved',manufacturer_name:'Test factory',can_submit:false},reports:[{id:'report',report_version:1,qc_status:'approved',order_snapshot:'same',manufacturer_id:factory,photo_ids:[],supporting_ids:[],production_summary:'QC summary marker',produced_lines:[{id:'line',label:'T-shirt M',ordered:100,produced:100}],has_issues:false,manufacturer_confirmed:true,submitted_at:'2026-10-24T10:00:00Z'}],evidence:[],releases:[{id:'release',quantity:100,revoked_at:null,dispatched_at:null}],legacy:[]};
const path='src/app/components/quality/OrderQualityControl.tsx';
const{code}=await transformWithEsbuild(await readFile(path,'utf8'),path,{format:'cjs',target:'es2022'});
const imports={
 '../../contexts/FactoryAccessContext':{useFactoryAccess:()=>({access:{factoryId:factory,permissions:['shipping','qc']}})},
 react:{...React,useEffect:()=>{},useState:initial=>React.useState(initial===null?workspace:initial)},
 'react-router':Router,'lucide-react':Icons,sonner:{toast:{}},
 '../../contexts/AuthContext':{useAuth:()=>({user:{id:factory},authReady:true})},
 '../../lib/supabaseClient':{isSupabaseConfigured:true},'../../lib/qualityControlDb':{},'../../lib/ordersDb':{},'../../lib/qcReportWorkspace':{},
 '../../data/qualityControl':{QC_REPORT_STATUS:{approved:'Approved'},QC_STAGES:{},qcLabel:v=>v},
 './QcPhotoGallery':{QcPhotoGallery:()=>null},'./QcProductionForm':{QcProductionForm:()=>null},
 '../orders/OrderCompletion':{OrderCompletion:()=>React.createElement('div',null,'Delivery completion marker')},
 '../../data/orderDelivery':{formatDeliveryLines:delivery=>[delivery.address1,delivery.city]},
};
const module={exports:{}};new Function('React','require','module','exports',code)(React,name=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];},module,module.exports);
const render=view=>renderToStaticMarkup(React.createElement(Router.MemoryRouter,null,React.createElement(module.exports.OrderQualityControl,{orderId,view})));
const qc=render('quality');assert.match(qc,/QC summary marker/);assert.match(qc,/manufacturer\/shipping\/stage-order/);assert.doesNotMatch(qc,/123 Dispatch Road|Record Dispatch|Delivery completion marker|Carrier tracking/);
const delivery=render('delivery');assert.match(delivery,/123 Dispatch Road/);assert.match(delivery,/Record Dispatch/);assert.match(delivery,/Delivery completion marker/);assert.doesNotMatch(delivery,/QC summary marker|Production Summary|Previous submissions|Submit for Quality Review/);
const all=render('all');assert.match(all,/QC summary marker/);assert.match(all,/Record Dispatch/);
const routes=await readFile('src/app/routes.tsx','utf8');for(const stage of['quality','shipping','production'])assert.ok(routes.includes(`/manufacturer/${stage}/:orderId`));
const queuePath='src/app/components/quality/QualityControlQueue.tsx',queueCode=(await transformWithEsbuild(await readFile(queuePath,'utf8'),queuePath,{format:'cjs',target:'es2022'})).code;
const queueRows=[{id:'ready',product_name:'Approved garment',status:'processing',qc_status:'approved'},{id:'pending',product_name:'Pending garment',status:'processing',qc_status:'pending_review'},{id:'shipped',product_name:'Shipped garment',status:'shipping',qc_status:'approved'}];
const queueImports={...imports,react:{...React,useEffect:()=>{},useState:initial=>React.useState(Array.isArray(initial)?queueRows:initial)}};const queueModule={exports:{}};
new Function('React','require','module','exports',queueCode)(React,name=>{if(!(name in queueImports))throw Error(name);return queueImports[name];},queueModule,queueModule.exports);
const deliveryQueue=renderToStaticMarkup(React.createElement(Router.MemoryRouter,null,React.createElement(queueModule.exports.QualityControlQueue,{shipping:true})));
assert.match(deliveryQueue,/manufacturer\/shipping\/ready/);assert.doesNotMatch(deliveryQueue,/Pending garment|manufacturer\/orders\//);
const qcQueue=renderToStaticMarkup(React.createElement(Router.MemoryRouter,null,React.createElement(queueModule.exports.QualityControlQueue)));
assert.match(qcQueue,/manufacturer\/quality\/pending/);assert.doesNotMatch(qcQueue,/Shipped garment|manufacturer\/orders\//);
console.log('PASS: QC contains only review content; delivery contains address/dispatch/completion only; full-order compatibility retained; three stage-specific detail routes registered.');
