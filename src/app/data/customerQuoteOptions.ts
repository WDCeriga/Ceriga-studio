import type { UserOrder } from './userOrders';
export function customerQuoteOptions(order: UserOrder) {
 const plan=order.orderQuantities;
 if(plan?.sample) return [plan.sample,...plan.bulkRuns].map((line,index)=>({id:line.id,kind:line.kind,label:line.kind==='sample'?'Samples':`Bulk option ${index}`,quantity:line.targetTotal??Object.values(line.bySize||{}).reduce((sum,n)=>sum+n,0)})).filter(option=>option.quantity>0);
 const quantity=order.quoteRequest?.quantity||'';
 return /^[1-9]\d*$/.test(quantity)?[{id:'factory-quote',kind:'bulk' as const,label:'Production',quantity:Number(quantity)}]:[];
}
