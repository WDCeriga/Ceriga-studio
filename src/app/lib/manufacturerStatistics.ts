export type ManufacturerReport={admin:boolean;days:number;since:string;generatedAt:string;orders:number;production:number;completed:number;quotesSubmitted:number;quoteDeadlineSamples:number;quotesOnTime:number;pendingQc:number;changesRequired:number;pipeline:{status:string;n:number}[];monthlyOrders:{month:string;orders:number}[]};
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export function parseManufacturerReport(value:unknown):ManufacturerReport{
 const r=value as ManufacturerReport;if(!r||r.admin!==false)throw new Error('Factory reporting is unavailable for this account.');
 if(!['orders','production','completed','quotesSubmitted','quoteDeadlineSamples','quotesOnTime','pendingQc','changesRequired'].every(k=>count(r[k as keyof ManufacturerReport]))||!Number.isFinite(Date.parse(r.since))||!Number.isFinite(Date.parse(r.generatedAt))||!count(r.days)||!Array.isArray(r.pipeline)||!r.pipeline.every(p=>p&&typeof p.status==='string'&&count(p.n))||!Array.isArray(r.monthlyOrders)||!r.monthlyOrders.every(p=>p&&/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)&&count(p.orders))||r.quotesOnTime>r.quoteDeadlineSamples||r.quoteDeadlineSamples>r.quotesSubmitted)throw new Error('The reporting response is incomplete. Refresh or contact Ceriga.');
 return r;
}
export const reportingPeriods=[{days:7,label:'Last 7 days'},{days:30,label:'Last 30 days'},{days:90,label:'Last 90 days'},{days:365,label:'Last 12 months'},{days:3650,label:'Last 10 years'}];
const statusLabels:Record<string,string>={submitted:'Submitted',awaiting_payment:'Awaiting payment',priced:'Quotation issued',paid:'Paid',processing:'Processing',shipping:'Shipping',ready:'Ready',completed:'Completed'};
export function reportStatusLabel(status:string){return statusLabels[status]||status.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase());}
export function reportPipeline(report:ManufacturerReport){const keys=Object.keys(statusLabels);return [...report.pipeline].sort((a,b)=>{const x=keys.indexOf(a.status),y=keys.indexOf(b.status);return (x<0?99:x)-(y<0?99:y)||a.status.localeCompare(b.status);});}
export function quotationPunctuality(report:ManufacturerReport){return report.quoteDeadlineSamples?Math.round(report.quotesOnTime/report.quoteDeadlineSamples*100):null;}
export function reportVolume(report:ManufacturerReport){
 const yearly=report.days>365,totals=new Map<string,number>();for(const row of report.monthlyOrders){const key=yearly?row.month.slice(0,4):row.month;totals.set(key,(totals.get(key)||0)+row.orders);}
 const first=report.since.slice(0,7),last=report.generatedAt.slice(0,7),cursor=new Date(first+'-01T12:00:00Z'),end=new Date(last+'-01T12:00:00Z'),result:{key:string;label:string;count:number}[]=[];
 for(let i=0;cursor<=end&&i<122;i++,cursor.setUTCMonth(cursor.getUTCMonth()+1)){const month=cursor.toISOString().slice(0,7),key=yearly?month.slice(0,4):month;if(result.some(r=>r.key===key))continue;result.push({key,label:yearly?key:cursor.toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}),count:totals.get(key)||0});}
 return result;
}
