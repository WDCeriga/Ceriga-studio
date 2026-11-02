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
 const{orderId}=useParams();const{user}=useAuth();const{access}=useFactoryAccess();
 const[order,setOrder]=useState<UserOrder|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let current=true,inFlight=false;setOrder(null);setError('');setLoading(true);
  const load=async()=>{if(!orderId||inFlight)return;inFlight=true;try{const next=await getOrder(orderId);if(current){setOrder(next);setError(next?'':'Order not found or no longer assigned to your factory.');}}catch(cause){if(current)setError(cause instanceof Error?cause.message:'Could not load production details');}finally{inFlight=false;if(current)setLoading(false);}};
  void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,20000);window.addEventListener('ceriga-orders-updated',refresh);return()=>{current=false;clearInterval(timer);window.removeEventListener('ceriga-orders-updated',refresh);};
 },[orderId,user?.id,access?.factoryId]);
 const selected=order?.priceOptions?.find(option=>option.id===order.selectedPriceOptionId);
 const available=!!order?.productionReleasedAt&&order.status==='processing'&&order.factoryStatus==='in_production'&&!['pending_review','approved'].includes(order.qcStatus||'');
 return <div className="production-order-detail mx-auto max-w-6xl space-y-5"><Link to="/manufacturer/production" className="inline-block text-sm text-white/50 hover:text-white">← All production orders</Link><header><p className="text-xs uppercase tracking-wider text-red-400">Production</p><h1 className="mt-2 text-2xl font-semibold">{order?.productName||'Production order'}</h1>{order&&<><p className="mt-2 text-sm text-white/55">{order.garmentType}{selected?` · ${selected.label} · ${selected.totalUnits} units`:''}</p><p className="mt-1 break-all text-xs text-white/35">Order {order.id}</p></>}</header>{loading&&<p role="status" className="text-sm text-white/50">Loading production details…</p>}{error&&<p role="alert" className="rounded-xl border border-red-400/25 p-4 text-sm text-red-200">{error}</p>}{order&&!error&&<>{!order.productionReleasedAt?<p className="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">Production has not been authorised for this order.</p>:available?<ProductionWorkspace key={order.id} onlyOrder={order.id}/>:<><ProductionProgress key={order.id} orderId={order.id}/><ReadOnlyTimelineHistory orderId={order.id}/></>}<div className="border-t border-white/10 pt-4 text-sm text-white/55">When production is finished, <Link className="text-red-300 underline" to={`/manufacturer/quality/${order.id}`}>open quality control</Link> to submit the production report.</div></>}</div>;
}

function ReadOnlyTimelineHistory({orderId}:{orderId:string}){const[rows,setRows]=useState<any[]>([]),[error,setError]=useState('');useEffect(()=>{let active=true;void getSupabase().from('production_timeline_events').select('id,kind,explanation,created_at').eq('order_id',orderId).order('created_at',{ascending:false}).limit(100).then(({data,error})=>{if(active){setRows(data||[]);setError(error?.message||'');}});return()=>{active=false;};},[orderId]);return <details className="rounded-xl border border-white/10 p-4"><summary>Scheduling and automatic estimate history</summary>{error&&<p role="alert" className="mt-3 text-red-200">{error}</p>}{rows.map(r=><p key={r.id} className="mt-3 border-t border-white/10 pt-3 text-sm"><time className="text-white/40">{new Date(r.created_at).toLocaleString()}</time> · {r.kind}<br/>{r.explanation}</p>)}{!rows.length&&!error&&<p className="mt-3 text-sm text-white/40">No scheduled changes recorded for this historical order.</p>}</details>;}
