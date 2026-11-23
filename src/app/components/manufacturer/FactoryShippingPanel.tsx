import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import {ChevronDown} from 'lucide-react';
import '../dashboard/manufacturer-dashboard.css';
import '../quality/manufacturer-quality.css';
import './manufacturer-delivery.css';
import{Link,useParams}from'react-router';import{OrderQualityControl}from'../quality/OrderQualityControl';
import{useEffect,useState}from'react';import{getSupabase}from'../../lib/supabaseClient';import{QualityControlQueue}from'../quality/QualityControlQueue';
type Carrier={id:string;name:string;modes:string;notes:string};
export function FactoryShippingPanel(){
  useCerigaTranslation();

 const{orderId}=useParams();const[carriers,setCarriers]=useState<Carrier[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{if(orderId){setLoading(false);return;}let active=true;setLoading(true);void getSupabase().rpc('portal_configuration').then(({data,error})=>{if(!active)return;if(error)setError(error.message);else{setCarriers(Array.isArray(data?.shipping_carriers)?data.shipping_carriers:[]);setError('');}setLoading(false);}).catch(cause=>{if(active){setError(cause instanceof Error?cause.message:cerigaTranslate("interface.text_74473fc5ca2f1829"));setLoading(false);}});return()=>{active=false;};},[retry,orderId]);
 if(orderId)return <div className="factory-home manufacturer-quality-page manufacturer-delivery-page mx-auto max-w-6xl space-y-6"><Link to="/manufacturer/shipping" className="qc-back-link">{cerigaTranslate("interface.text_df7d922cbd7976cc")}</Link><header className="fh-heading"><div><span className="fh-eyebrow">{cerigaTranslate("interface.text_9361845e66a37245")}</span><h1>{cerigaTranslate("interface.text_dbebda550bfb1d59")}<span>.</span></h1><p>{cerigaTranslate("interface.text_8f3a757bb9634016")}</p></div></header><OrderQualityControl key={orderId} orderId={orderId} view="delivery"/></div>;
 return <div className="delivery-workspace"><QualityControlQueue shipping/><details className="factory-home delivery-carriers"><summary><span className="delivery-carrier-label">{cerigaTranslate("interface.text_0d698f55b7f576d8")}{" "}<ChevronDown size={14}/></span><span>{loading?cerigaTranslate("common.loading"):error?cerigaTranslate("interface.text_ca184496974204a0"):cerigaTranslate("interface.text_f2371b9222afccd0",{value0:(carriers.length)})}</span></summary><p>{cerigaTranslate("interface.text_933f49fef19c1ef2")}</p>{loading&&<p role="status">{cerigaTranslate("interface.text_761bb4f1036ca666")}</p>}{error&&<p role="alert" className="delivery-config-error">{cerigaTranslateLabel(error)}<button type="button" onClick={()=>setRetry(n=>n+1)}>{cerigaTranslate("common.retry")}</button></p>}<ul>{carriers.map(c=><li key={c.id}><h3>{c.name}</h3><p>{c.modes}</p>{c.notes&&<p>{c.notes}</p>}</li>)}</ul>{!loading&&!error&&!carriers.length&&<p>{cerigaTranslate("interface.text_be7f5b73314c36a9")}</p>}</details></div>;
}
