import type {UserOrder} from '../data/userOrders';
export type OrderGroup='quotation'|'production'|'quality'|'delivery'|'completed'|'declined';
export const orderGroups:{key:OrderGroup|'all';label:string}[]=[{key:'all',label:'All orders'},{key:'quotation',label:'Quotations'},{key:'production',label:'Production'},{key:'quality',label:'Quality control'},{key:'delivery',label:'Delivery'},{key:'completed',label:'Completed'},{key:'declined',label:'Declined'}];
export function manufacturerOrderState(o:UserOrder,now=Date.now()){
 const detail='/manufacturer/orders/'+o.id;
 let group:OrderGroup='quotation',label='Quotation requested',action='Prepare quote',permission='quote',href='/manufacturer/quotations/'+o.id,attention=true;
 if(['completed','ready'].includes(o.status)||o.factoryStatus==='completed'){group='completed';label='Completed';action='View order';permission='view_orders';href=detail;attention=false;}
 else if(o.status==='shipping'){group='delivery';label='Dispatched';action='View delivery';permission='shipping';href='/manufacturer/fulfilment/'+o.id;attention=false;}
 else if(o.factoryStatus==='rejected'){group='declined';label='Declined';action='View order';permission='view_orders';href=detail;attention=false;}
 else if(o.productionReleasedAt&&['paid','processing'].includes(o.status)){
  if(o.qcStatus==='approved'){group='delivery';label='Ready for dispatch';action='Prepare delivery';permission='shipping';href='/manufacturer/fulfilment/'+o.id;}
  else if(o.qcStatus==='changes_required'){group='quality';label='QC changes requested';action='Update QC';permission='qc';href='/manufacturer/fulfilment/'+o.id;}
  else if(o.qcStatus==='pending_review'){group='quality';label='QC under review';action='View QC';permission='view_orders';href='/manufacturer/fulfilment/'+o.id;attention=false;}
  else{group='production';label='In production';action='Open production';permission='production';href='/manufacturer/fulfilment/'+o.id;attention=false;}
 }else if(o.status==='priced'||['paid','processing'].includes(o.status)){label=o.status==='priced'?'Awaiting customer':'Awaiting production release';action='View order';permission='view_orders';href=detail;attention=false;}
 else if(o.factoryStatus==='quoted'){label='Quote under review';action='View quotation';attention=false;}
 else if(o.factoryStatus==='clarifying'){label='Quotation revision';action='Revise quote';}
 else if(o.factoryStatus==='reviewing'){label='Preparing quotation';}
 const quoteDue=group==='quotation'&&attention&&o.dueQuoteBy?o.dueQuoteBy:null;
 return {group,label,action,permission,href,detail,attention,quoteDue,overdue:!!quoteDue&&(quoteDue.length===10?new Date(quoteDue+'T23:59:59.999').getTime():Date.parse(quoteDue))<now};
}
