import { servesDestination } from './shippingDestinations';
import type { ManufacturerAccount } from '../lib/superadminDb';
import type { SuperAdminOrder } from './superadminMock';
const normalise=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const garment=(value:string)=>normalise(value).replace(/s$/,'');
const aliases:Record<string,string>={regular:'regularfit',slim:'slimfit',relaxed:'relaxedfit',oversizedfit:'oversized',boxy:'boxyfit',crew:'crewneck',crewneckline:'crewneck',vneck:'vneck',dropped:'dropshoulder',droppedshoulder:'dropshoulder',setin:'setinsleeves',raglan:'raglansleeve',short:'shortsleeve',long:'longsleeve',threequarter:'threequartersleeve',jersey:'singlejersey',fleece:'brushedfleece',twill:'canvastwill',dtg:'directtogarment',dtgdirecttogarment:'directtogarment',dtf:'directtofilm',dtfdirecttofilm:'directtofilm',screenprint:'screenprinting',screen:'screenprinting',puffprint:'puffprinting',embroidery:'standardflatembroidery',heat:'heattransfer',cutsew:'cutandsew',hoodsingle:'singlelayerhood',hooddouble:'doublelayerhood',fullzip:'fullzipfront',halfzip:'halfzipfront'};
const token=(value:string)=>{const key=normalise(value);return aliases[key]||key;};
const tie=(seed:string)=>{let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619);value^=value>>>16;value=Math.imul(value,0x7feb352d);return value>>>0;};
/** Quote assignment checks saved requirements; unknown details need review, not a false capability rejection. */
export function checkManufacturerProduction(order:SuperAdminOrder,factory:ManufacturerAccount){
 const failures:string[]=[];const reasons:string[]=[];const warnings:string[]=[];const spec=order.specifications;
 if(factory.acceptingNewOrders===false)failures.push('Factory is not accepting new orders');
 if(factory.unavailableUntil&&factory.unavailableUntil>=new Date().toISOString().slice(0,10))warnings.push(`Factory reports unavailability until ${factory.unavailableUntil}; confirm the production window before commitment`);
 if(factory.calendar){
  const c=factory.calendar;
  if(!c.scheduleKnown)warnings.push('Working schedule is not recorded; availability is unconfirmed');
  if(c.closures.length)warnings.push(`Recorded closures: ${c.closures.slice(0,3).map(r=>`${r.start} to ${r.end}`).join(', ')}. No required production window is saved for this quotation; confirm scheduling`);
  if(c.workload==='busy'||c.workload==='full')warnings.push(`${c.workload==='full'?'Fully booked':'Busy'} estimated completion-month workload (${c.utilisation??'unknown'}%); this is not a capacity commitment`);
  if(c.unscheduled>0)warnings.push(`${c.unscheduled} active production orders have no expected completion date`);
  if(c.utilisation!==null)reasons.push(`Current completion-month workload estimate: ${c.utilisation}%`);
 }else warnings.push('Calendar availability is not verified; confirm production scheduling');
 if(!factory.onboardingComplete||factory.status==='paused')failures.push('Factory is not active and onboarded');
 if(!order.garmentType||!factory.garments.some(g=>garment(g)===garment(order.garmentType!)))failures.push('Garment category is not offered');
 const detail=Object.entries(factory.garmentDetails||{}).find(([g])=>garment(g)===garment(order.garmentType||''))?.[1];
 if(!detail?.confirmed)warnings.push('Garment specifications have not been confirmed in onboarding; verify fabric, styles and construction with the manufacturer before production');
 const missing=[!spec?.fabricType&&'fabric',!spec?.gsm&&'GSM',!Array.isArray(spec?.requiredCapabilities)&&!Array.isArray(order.requiredCapabilities)&&'decoration methods'].filter(Boolean);
 if(missing.length)warnings.push(`Order does not specify ${missing.join(', ')}. These details are not verified and must be clarified during quotation`);
 if(detail?.confirmed&&spec){
  const materials=[...(detail.materials||[]),...(detail.customMaterials||[])].map(token);
  if(spec.fabricType&&!materials.includes(token(spec.fabricType)))failures.push(`Fabric not supported: ${spec.fabricType}`);else if(spec.fabricType)reasons.push(`Fabric: ${spec.fabricType}`);
  if(spec.gsm){
   if(!Number.isFinite(spec.gsm)||spec.gsm<=0)failures.push('Order fabric weight must be a positive GSM value');
   else if((detail.minGsm!=null&&spec.gsm<detail.minGsm)||(detail.maxGsm!=null&&spec.gsm>detail.maxGsm))failures.push(`Fabric weight outside confirmed range: ${spec.gsm} GSM`);
   else if(detail.minGsm!=null&&detail.maxGsm!=null)reasons.push(`${spec.gsm} GSM within ${detail.minGsm}–${detail.maxGsm}`);
   else warnings.push(`Manufacturer has not recorded a complete GSM range; confirm support for ${spec.gsm} GSM`);
  }
  const options=[...(detail.styles||[]),...(detail.customStyles||[]),...(detail.constructionDetails||[]),...(detail.customConstructionDetails||[]),...(factory.capabilities||[])].map(token);
  for(const value of [spec.fit,spec.neckType,spec.sleeveType,spec.sleeveLength,...(spec.constructionDetails||[])].filter(Boolean) as string[]){if(!options.includes(token(value)))failures.push(`Style/construction not confirmed: ${value}`);else reasons.push(`Supports ${value}`);}
 }
 const required=[...new Set([...(spec?.requiredCapabilities||[]),...(order.requiredCapabilities||[])])];
 for(const requirement of required){if(!(factory.capabilities||[]).some(value=>token(value)===token(requirement)))failures.push(`Decoration not offered: ${requirement}`);else reasons.push(`Supports ${requirement}`);}
 const plan=order.orderQuantities;const units=(line:{targetTotal?:number;bySize?:Record<string,number>})=>line.targetTotal??Object.values(line.bySize||{}).reduce((a,b)=>a+b,0);
 const lines=[...(plan?.sample?[plan.sample]:[]),...(plan?.bulkRuns||[])].filter(line=>units(line)>0);
 if(!lines.length)failures.push('Sample/bulk quantities are not recorded');
 const capacity=factory.availableCapacity??factory.monthlyCapacity;
 const moq=Object.entries(factory.garmentMoqOverrides||{}).find(([g])=>garment(g)===garment(order.garmentType||''))?.[1]??factory.moq;
 for(const line of lines){const quantity=units(line);if(!Number.isInteger(quantity)||quantity<=0)failures.push('Invalid quantity');
  if(factory.maxSingleOrderQuantity!=null&&quantity>factory.maxSingleOrderQuantity)failures.push(`Quantity ${quantity} exceeds the single-order ceiling ${factory.maxSingleOrderQuantity}`);
  if(capacity==null)warnings.push('Available capacity is not recorded; confirm scheduling during quotation');
  else if(capacity<quantity)failures.push(`${line.kind} quantity ${quantity} exceeds available capacity ${capacity}`);
  if(line.kind==='bulk'){
   if(moq==null)warnings.push('Bulk MOQ is not recorded; confirm the minimum during quotation');
   else if(quantity<moq)failures.push(`Bulk quantity ${quantity} does not meet MOQ ${moq}`);
  }
  // A decoration-specific minimum applies to samples as well as bulk, unless the factory records a lower minimum.
  for(const row of factory.methodMoqs||[])if(required.some(r=>token(r)===token(row.method))&&quantity<row.moq)failures.push(`${line.kind} quantity ${quantity} is below ${row.method} minimum ${row.moq}`);
  reasons.push(`${line.kind==='sample'?'Sample':'Bulk'}: ${quantity} units checked`);
 }
 if(order.deliveryCountry&&factory.shippingRegions?.length&&!servesDestination(factory.shippingRegions,order.deliveryCountry))failures.push('Delivery destination is not served');
 if((order.rejectedManufacturerIds||[]).includes(factory.userId)||(order.factoryQuoteStatus==='rejected'&&order.manufacturerId===factory.userId))failures.push('Previously rejected for this order');
 return {eligible:failures.length===0,failures:[...new Set(failures)],reasons,warnings:[...new Set(warnings)]};
}
export function recommendManufacturers(order:SuperAdminOrder,factories:ManufacturerAccount[]) {
 if(order.kind!=='custom_clothing')return [];
 const results=factories.map(factory=>({factory,match:checkManufacturerProduction(order,factory),performance:factory.quoteStats&&factory.quoteStats.observed>=3?factory.quoteStats.onTime/factory.quoteStats.observed:null})).filter(item=>item.match.eligible);
 const usePerformance=results.length>0&&results.every(result=>result.performance!=null);
 const horizon=new Date();horizon.setUTCDate(horizon.getUTCDate()+30);const horizonDate=horizon.toISOString().slice(0,10);
 const schedulingPenalty=(factory:ManufacturerAccount)=>{const c=factory.calendar;if(!c)return 1;return(c.scheduleKnown?0:1)+(c.workload==='full'?4:c.workload==='busy'?2:0)+(c.closures.some(r=>r.start<=horizonDate)?3:0);};
 results.sort((a,b)=>{const scheduling=schedulingPenalty(a.factory)-schedulingPenalty(b.factory);if(scheduling)return scheduling;if(a.match.warnings.length!==b.match.warnings.length)return a.match.warnings.length-b.match.warnings.length;if(usePerformance&&a.performance!==b.performance)return b.performance!-a.performance!;return (a.factory.assignedOrders??0)-(b.factory.assignedOrders??0)||tie(order.id+':'+a.factory.userId)-tie(order.id+':'+b.factory.userId);});
 return results.slice(0,2).map(({factory,match,performance})=>({factory,reasons:[`Produces ${order.garmentType}`,...match.reasons,`Active assignments: ${factory.assignedOrders??0}`,...(performance!=null?[`Measured on-time quotes: ${Math.round(performance*100)}% (${factory.quoteStats!.observed} quotes)`]:[])],warning:match.warnings.length?`Suitable for quotation with details to clarify: ${match.warnings.join(' · ')}`:'Matches saved requirements. Confirm artwork details and current availability during quotation.'}));
}
export function recommendManufacturer(order:SuperAdminOrder,factories:ManufacturerAccount[]){return recommendManufacturers(order,factories)[0]??null;}
