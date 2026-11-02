export type LogisticsStatus='collection_scheduled'|'ready_for_collection'|'collected'|'in_transit'|'customs_clearance'|'out_for_delivery'|'delivered'|'exception';
const transitions:Record<string,LogisticsStatus[]>={
 collection_scheduled:['ready_for_collection','collected','in_transit','exception'],
 ready_for_collection:['collection_scheduled','collected','in_transit','exception'],
 collected:['in_transit','customs_clearance','out_for_delivery','exception'],
 in_transit:['customs_clearance','out_for_delivery','delivered','exception'],
 customs_clearance:['in_transit','out_for_delivery','delivered','exception'],
 out_for_delivery:['delivered','exception'],delivered:[],
};
/** Events are returned newest first by the permission-scoped backend. Exceptions pause, rather than reset, progress. */
export function nextLogisticsStatuses(events:{status:string}[]):LogisticsStatus[]{const previous=events.find(e=>e.status!=='exception')?.status;return previous?(events[0]?.status==='exception'?[previous as LogisticsStatus,...(transitions[previous]||[])]:transitions[previous]||[]):['collection_scheduled','ready_for_collection','collected','in_transit','exception'];}
export function savedTrackingDetails(events:{details:Record<string,string>}[]){return Object.fromEntries(['tracking','carrier','eta','collectionAt','proof'].map(k=>[k,events.find(e=>e.details[k])?.details[k]||'']));}
