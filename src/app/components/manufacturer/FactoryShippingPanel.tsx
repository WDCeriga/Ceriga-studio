import {ChevronDown} from 'lucide-react';
import '../dashboard/manufacturer-dashboard.css';
import '../quality/manufacturer-quality.css';
import './manufacturer-delivery.css';
import{Link,useParams}from'react-router';import{OrderQualityControl}from'../quality/OrderQualityControl';
import{useEffect,useState}from'react';import{getSupabase}from'../../lib/supabaseClient';import{QualityControlQueue}from'../quality/QualityControlQueue';
type Carrier={id:string;name:string;modes:string;notes:string};
export function FactoryShippingPanel(){
 const{orderId}=useParams();const[carriers,setCarriers]=useState<Carrier[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{if(orderId){setLoading(false);return;}let active=true;setLoading(true);void getSupabase().rpc('portal_configuration').then(({data,error})=>{if(!active)return;if(error)setError(error.message);else{setCarriers(Array.isArray(data?.shipping_carriers)?data.shipping_carriers:[]);setError('');}setLoading(false);}).catch(cause=>{if(active){setError(cause instanceof Error?cause.message:'Could not load the carrier directory');setLoading(false);}});return()=>{active=false;};},[retry,orderId]);
 if(orderId)return <div className="factory-home manufacturer-quality-page manufacturer-delivery-page mx-auto max-w-6xl space-y-6"><Link to="/manufacturer/shipping" className="qc-back-link">← All deliveries</Link><header className="fh-heading"><div><span className="fh-eyebrow">WORKSPACE / DELIVERY</span><h1>Delivery details<span>.</span></h1><p>Confirm the destination, record the handover and follow completion.</p></div></header><OrderQualityControl key={orderId} orderId={orderId} view="delivery"/></div>;
 return <div className="delivery-workspace"><QualityControlQueue shipping/><details className="factory-home delivery-carriers"><summary><span className="delivery-carrier-label">Carrier directory <ChevronDown size={14}/></span><span>{loading?'Loading…':error?'Unavailable':carriers.length+' carriers'}</span></summary><p>The directory is maintained by Ceriga. Arrange booking and final rates directly with your carrier.</p>{loading&&<p role="status">Loading carriers…</p>}{error&&<p role="alert" className="delivery-config-error">{error}<button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}<ul>{carriers.map(c=><li key={c.id}><h3>{c.name}</h3><p>{c.modes}</p>{c.notes&&<p>{c.notes}</p>}</li>)}</ul>{!loading&&!error&&!carriers.length&&<p>No carriers have been configured by Ceriga.</p>}</details></div>;
}
