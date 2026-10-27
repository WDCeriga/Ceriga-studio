import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router';
import {useAuth} from '../../contexts/AuthContext';
import {getOrder} from '../../lib/ordersDb';
import type {UserOrder} from '../../data/userOrders';
import {ProductionProgress} from '../../components/manufacturer/ProductionProgress';

export function ManufacturerProductionOrder(){
 const{orderId}=useParams();const{user}=useAuth();
 const[order,setOrder]=useState<UserOrder|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let current=true,inFlight=false;setOrder(null);setError('');setLoading(true);
  const load=async()=>{if(!orderId||inFlight)return;inFlight=true;try{const next=await getOrder(orderId);if(current){setOrder(next);setError(next?'':'Order not found or no longer assigned to your factory.');}}catch(cause){if(current)setError(cause instanceof Error?cause.message:'Could not load production details');}finally{inFlight=false;if(current)setLoading(false);}};
  void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,20000);window.addEventListener('ceriga-orders-updated',refresh);return()=>{current=false;clearInterval(timer);window.removeEventListener('ceriga-orders-updated',refresh);};
 },[orderId,user?.id]);
 const selected=order?.priceOptions?.find(option=>option.id===order.selectedPriceOptionId);
 const available=!!order?.productionReleasedAt&&order.status==='processing'&&order.factoryStatus==='in_production';
 return <div className="mx-auto max-w-5xl space-y-5 text-white"><Link to="/manufacturer/production" className="inline-block text-sm text-white/50 hover:text-white">← All production orders</Link><header><p className="text-xs uppercase tracking-wider text-red-400">Production</p><h1 className="mt-2 text-2xl font-semibold">{order?.productName||'Production order'}</h1>{order&&<><p className="mt-2 text-sm text-white/55">{order.garmentType}{selected?` · ${selected.label} · ${selected.totalUnits} units`:''}</p><p className="mt-1 break-all text-xs text-white/35">Order {order.id}</p></>}</header>{loading&&<p role="status" className="text-sm text-white/50">Loading production details…</p>}{error&&<p role="alert" className="rounded-xl border border-red-400/25 p-4 text-sm text-red-200">{error}</p>}{order&&!error&&<>{!order.productionReleasedAt?<p className="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">Production has not been authorised for this order.</p>:<ProductionProgress key={order.id} orderId={order.id} editable={available}/>}<div className="border-t border-white/10 pt-4 text-sm text-white/55">When production is finished, <Link className="text-red-300 underline" to={`/manufacturer/quality/${order.id}`}>open quality control</Link> to submit the production report.</div></>}</div>;
}
