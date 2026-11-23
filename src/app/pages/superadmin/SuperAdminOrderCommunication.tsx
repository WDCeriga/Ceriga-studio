import {activeLocale,useCerigaTranslation} from '../../i18n/i18n';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router';
import {categories,OrderCommunication} from '../../components/orders/OrderCommunication';
import {getSupabase} from '../../lib/supabaseClient';
import {orderReference} from '../../lib/factoryOrderHistory';
import './superadmin-communication-review.css';

type QueueItem={id:string;order_id:string;factory_name:string;category:keyof typeof categories;status:string;created_at:string;updated_at?:string;waiting_on?:string;amendment?:boolean;owner_name?:string};
export function SuperAdminOrderCommunication(){
 const {t,label}=useCerigaTranslation();
 const [params]=useSearchParams();
 const initial=params.get('order');
 const [page,setPage]=useState(0);
 const [queue,setQueue]=useState<{pending:number;rows:QueueItem[]}>();
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<string|null>(initial&&/^[0-9a-f-]{36}$/i.test(initial)?initial:null);
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  const run=++sequence.current;
  try{
   const {data,error}=await getSupabase().rpc('order_communication_queue',{p_offset:page*25});
   if(run!==sequence.current)return;
   if(error)throw new Error(error.message);
   if(!data||!Array.isArray(data.rows))throw new Error('The database did not confirm this action.');
   setQueue(data);setError('');
  }catch(cause){if(run===sequence.current)setError(cause instanceof Error?cause.message:t('interface.text_d52278e62f654bc7'));}
 },[page]);
 useEffect(()=>{
  void load();
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  const timer=setInterval(refresh,30000);
  window.addEventListener('focus',refresh);
  window.addEventListener('ceriga-orders-updated',refresh);
  return()=>{sequence.current++;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('ceriga-orders-updated',refresh);};
 },[load]);
 const next=()=>{
  const ids=[...new Set(queue?.rows.map(row=>row.order_id)??[])];
  const index=ids.indexOf(selected??'');
  setSelected(ids[index+1]??ids[0]??null);
 };
 return <div className="communication-review">
  <header className="communication-review-heading"><div><h1>{label('Customer requests')}</h1><p>{queue?t('interface.text_43361c12ed073c79',{value0:queue.pending}):t('interface.text_8e472e53778c5556')}</p></div><button type="button" onClick={()=>void load()}>{t('interface.text_e47e62c4d3c9fc92')}</button></header>
  {error&&<p role="alert">{label(error)}</p>}
  {!queue&&!error&&<p role="status">{t('messages.loading')}</p>}
  <div className="communication-review-columns">
   <section aria-label={label('Customer requests')} className="communication-review-list">
    {queue?.rows.length===0&&<p>{t('interface.text_5d84afcdca80ca2d')}</p>}
    {queue?.rows.map(row=><button type="button" key={row.id} aria-pressed={selected===row.order_id} onClick={()=>setSelected(row.order_id)}>
      <strong>{orderReference(row.order_id)}</strong><span>{label(categories[row.category])}</span>
      <small>{row.amendment?t('workflow.awaitingAmendment'):t('workflow.waitingOn')+' '+label('Ceriga')}{row.owner_name?' · '+row.owner_name:''}</small>
      <time dateTime={row.updated_at??row.created_at}>{new Date(row.updated_at??row.created_at).toLocaleString(activeLocale())}</time>
    </button>)}
    <nav aria-label={label('Pagination')}>
     {page>0&&<button type="button" onClick={()=>setPage(page-1)}>{t('common.previous')}</button>}
     {queue&&queue.pending>(page+1)*25&&<button type="button" onClick={()=>setPage(page+1)}>{t('common.next')}</button>}
    </nav>
   </section>
   {selected&&<section className="communication-review-context">
    <header><Link to={'/superadmin/orders/'+selected+'#order-specifications'}>{orderReference(selected)} &middot; {label('Order specifications & tech pack')}</Link><button type="button" onClick={next}>{t('common.next')}</button></header>
    <OrderCommunication key={selected} orderId={selected} scope="admin" onChange={()=>void load()}/>
   </section>}
  </div>
 </div>;
}
