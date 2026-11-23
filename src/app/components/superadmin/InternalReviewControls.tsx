import {RejectQuotation} from './RejectQuotation';
import {useCallback,useEffect,useState} from 'react';
import {useCerigaTranslation} from '../../i18n/i18n';
import {getSupabase} from '../../lib/supabaseClient';
import {formatMoney,isCurrency} from '../../lib/currency';
import {OrderCommunication} from '../orders/OrderCommunication';
import {OrderShipping} from '../freight/OrderShipping';
import {FactoryQuoteComparison} from './FactoryQuoteComparison';
import type {SuperAdminOrder} from '../../data/superadminMock';
import type {ManufacturerQuoteTierRow} from '../../lib/ordersDb';

type Context={communicationRead:boolean;communicationWrite:boolean;quotationsRead:boolean;quotationsWrite:boolean;shippingRead:boolean;shippingWrite:boolean;comparing:boolean;quotation:ManufacturerQuoteTierRow[]|null;factoryStatus?:string};
export function InternalReviewControls({orderId,productName}:{orderId:string;productName:string}){
 const {t,label}=useCerigaTranslation();
 const [context,setContext]=useState<Context|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{
  const {data,error}=await getSupabase().rpc('internal_review_context',{p_order:orderId});
  if(error||!data)throw new Error(error?.message??'The database did not confirm this action.');
  return data as Context;
 },[orderId]);
 useEffect(()=>{let current=true;const refresh=()=>{if(document.visibilityState!=='visible')return;void load().then(data=>{if(current){setContext(data);setError('');}}).catch(e=>{if(current){setContext(null);setError(e.message);}});};refresh();const timer=setInterval(refresh,15000);window.addEventListener('ceriga-workers-updated',refresh);window.addEventListener('ceriga-orders-updated',refresh);return()=>{current=false;clearInterval(timer);window.removeEventListener('ceriga-workers-updated',refresh);window.removeEventListener('ceriga-orders-updated',refresh);};},[load]);
 const money=(amount:number,currency:unknown)=>isCurrency(currency)?formatMoney(amount,currency):t('manufacturerOrders.notRecorded');
 return <div className="internal-review-controls">
  {error&&<p role="alert">{label(error)}</p>}
  {context?.communicationRead&&<OrderCommunication key={orderId+':communication'} orderId={orderId} scope="admin" readOnly={!context.communicationWrite}/>}
  {context?.quotationsRead&&<details><summary>{label('Quotation review')}</summary>
   {context.comparing?<FactoryQuoteComparison focusedOrder={orderId} canSelect={context.quotationsWrite} orders={[{id:orderId,productName} as SuperAdminOrder]} onSelect={()=>{void load().then(setContext).catch(e=>setError(e.message));}}/>:<div>{context.quotation?.map(tier=><section key={tier.id}><h3>{label(tier.label)}</h3><p>{tier.totalUnits} &middot; {money(tier.manufacturerQuoteCents,tier.currency)}</p><p>{t('nav.shipping')}: {tier.shipping?money(tier.shipping.priceCents,tier.shipping.currency):t('manufacturerOrders.notRecorded')}</p><p>{t('nav.production')}: {tier.leadTimeDays}</p></section>)}{!context.quotation?.length&&<p>{t('workflow.missingQuote')}</p>}{context.quotationsWrite&&context.factoryStatus==='quoted'&&<RejectQuotation orderId={orderId} allowReassignment={false} onRejected={()=>{void load().then(setContext).catch(e=>setError(e.message));}}/>}</div>}
  </details>}
  {context?.shippingRead&&<details><summary>{t('nav.shipping')}</summary><OrderShipping key={orderId+':shipping'} orderId={orderId} internalStaff/></details>}
 </div>;
}
