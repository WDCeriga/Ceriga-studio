import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import {useFactoryAccess} from '../../contexts/FactoryAccessContext';
import {getSupabase} from '../../lib/supabaseClient';
import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router';
import {useAuth} from '../../contexts/AuthContext';
import {getOrder} from '../../lib/ordersDb';
import type {UserOrder} from '../../data/userOrders';
import {ProductionWorkspace} from '../../components/manufacturer/ProductionWorkspace';
import {ProductionProgress} from '../../components/manufacturer/ProductionProgress';

export function ManufacturerProductionOrder(){
  useCerigaTranslation();

 const{orderId}=useParams();const{user}=useAuth();const{access}=useFactoryAccess();
 const[order,setOrder]=useState<UserOrder|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let current=true,inFlight=false;setOrder(null);setError('');setLoading(true);
  const load=async()=>{if(!orderId||inFlight)return;inFlight=true;try{const next=await getOrder(orderId);if(current){setOrder(next);setError(next?'':cerigaTranslate("interface.text_606ed6595e237ed2"));}}catch(cause){if(current)setError(cause instanceof Error?cause.message:cerigaTranslate("interface.text_d885b854e6ea8c9e"));}finally{inFlight=false;if(current)setLoading(false);}};
  void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,20000);window.addEventListener('ceriga-orders-updated',refresh);return()=>{current=false;clearInterval(timer);window.removeEventListener('ceriga-orders-updated',refresh);};
 },[orderId,user?.id,access?.factoryId]);
 const selected=order?.priceOptions?.find(option=>option.id===order.selectedPriceOptionId);
 const available=!!order?.productionReleasedAt&&order.status==='processing'&&order.factoryStatus==='in_production'&&!['pending_review','approved'].includes(order.qcStatus||'');
 return <div className="production-order-detail mx-auto max-w-6xl space-y-5"><Link to="/manufacturer/production" className="inline-block text-sm text-white/50 hover:text-white">{cerigaTranslate("interface.text_9f031812e42e3f57")}</Link><header><p className="text-xs uppercase tracking-wider text-red-400">{cerigaTranslate("nav.production")}</p><h1 className="mt-2 text-2xl font-semibold">{order?.productName||cerigaTranslate("interface.text_ac2ba66053dafdd9")}</h1>{order&&<><p className="mt-2 text-sm text-white/55">{order.garmentType}{selected?cerigaTranslate("interface.text_95eda77fb341e4e6",{value0:(selected.label),value1:(selected.totalUnits)}):''}</p><p className="mt-1 break-all text-xs text-white/35">{cerigaTranslate("adminOrders.order")}{" "}{order.id}</p></>}</header>{loading&&<p role="status" className="text-sm text-white/50">{cerigaTranslate("interface.text_a68228fc092dc261")}</p>}{error&&<p role="alert" className="rounded-xl border border-red-400/25 p-4 text-sm text-red-200">{cerigaTranslateLabel(error)}</p>}{order&&!error&&<>{!order.productionReleasedAt?<p className="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">{cerigaTranslate("interface.text_5cb468b907eb5baa")}</p>:available?<ProductionWorkspace key={order.id} onlyOrder={order.id}/>:<><ProductionProgress key={order.id} orderId={order.id}/><ReadOnlyTimelineHistory orderId={order.id}/></>}<div className="border-t border-white/10 pt-4 text-sm text-white/55">{cerigaTranslate("interface.text_7b3dd803ba4d7deb")}{" "}<Link className="text-red-300 underline" to={`/manufacturer/quality/${order.id}`}>{cerigaTranslate("interface.text_8e30c83ac528a302")}</Link>{" "}{cerigaTranslate("interface.text_13b28c1f485d5bd2")}</div></>}</div>;
}

function ReadOnlyTimelineHistory({orderId}:{orderId:string}){
  useCerigaTranslation();
const[rows,setRows]=useState<any[]>([]),[error,setError]=useState('');useEffect(()=>{let active=true;void getSupabase().from('production_timeline_events').select('id,kind,explanation,created_at').eq('order_id',orderId).order('created_at',{ascending:false}).limit(100).then(({data,error})=>{if(active){setRows(data||[]);setError(error?.message||'');}});return()=>{active=false;};},[orderId]);return <details className="rounded-xl border border-white/10 p-4"><summary>{cerigaTranslate("interface.text_7a78648b4c5a85b6")}</summary>{error&&<p role="alert" className="mt-3 text-red-200">{cerigaTranslateLabel(error)}</p>}{rows.map(r=><p key={r.id} className="mt-3 border-t border-white/10 pt-3 text-sm"><time className="text-white/40">{new Date(r.created_at).toLocaleString(cerigaLocale())}</time> · {r.kind}<br/>{r.explanation}</p>)}{!rows.length&&!error&&<p className="mt-3 text-sm text-white/40">{cerigaTranslate("interface.text_9a63d15dbd8f6327")}</p>}</details>;}
