import {useEffect,useRef,useState} from 'react';
import {freightRpc,loadFreight,loadForwarders,type Forwarder,type FreightContext,type ShippingTerms} from '../../lib/freight';
import {amountToCents,formatMoney} from '../../lib/currency';
import {useCurrency} from '../../lib/accountCurrency';
import {Money} from '../Money';
import './freight.css';

function AlternativeShippingForm({options,busy,onSave}:{options:NonNullable<FreightContext['manufacturerQuotes']>;busy:boolean;onSave:(option:string,forwarder:string,terms:ShippingTerms)=>void}){
 const [directory,setDirectory]=useState<Forwarder[]|null>(null);
 const [error,setError]=useState('');
 const [option,setOption]=useState(options[0].id);
 const [forwarder,setForwarder]=useState('');
 const accountCurrency=useCurrency();
 const {currency}=accountCurrency;
 const [enteredPrice,setEnteredPrice]=useState({value:'',currency});
 const price=enteredPrice.currency===currency?enteredPrice.value:'';
 useEffect(()=>{
  let active=true;
  loadForwarders().then(rows=>{if(active)setDirectory(rows.filter(row=>row.active));})
   .catch(()=>{if(active)setError('Could not load freight forwarders. Close and reopen this form to retry.');});
  return ()=>{active=false;};
 },[]);
 const tier=options.find(row=>row.id===option)??options[0];
 const route=tier.shipping;
 const provider=directory?.find(row=>row.id===forwarder);
 const method=provider?.methods.trim();
 const origin=route?.origin?.trim();
 const destination=route?.destination?.trim();
 const currencyReady=accountCurrency.ready&&!accountCurrency.saving&&!accountCurrency.error;
 if(error)return <p className="freight-error" role="alert">{error}</p>;
 if(!directory)return <p role="status">Loading freight forwarders…</p>;
 if(!directory.length)return <p>Add an active freight forwarder in the directory first.</p>;
 return <form className="freight-draft" onSubmit={event=>{
  event.preventDefault();
  const priceCents=amountToCents(price);
  if(busy||!currencyReady||!provider||priceCents==null||priceCents<0||priceCents>100000000000||!method||!origin||!destination)return;
  onSave(tier.id,provider.id,{priceCents,currency,provider:provider.company_name,method,origin,destination});
 }}>
  <fieldset disabled={busy} className="freight-fields">
   {options.length>1&&<label>Quotation option<select value={tier.id} onChange={event=>setOption(event.target.value)}>{options.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
   <label>Freight forwarder<select required value={forwarder} onChange={event=>setForwarder(event.target.value)}><option value="">Select a freight forwarder</option>{directory.map(row=><option key={row.id} value={row.id}>{row.company_name}</option>)}</select></label>
   <label>Shipping price{currencyReady?` (${currency})`:''}<input required disabled={!currencyReady} type="number" min="0" max="1000000000" step="0.01" value={price} onChange={event=>setEnteredPrice({value:event.target.value,currency})}/></label>
   {provider&&<p className="freight-help">{method||'Add a shipping method in the freight forwarder directory.'}{provider.typical_delivery.trim()&&` · Typical delivery: ${provider.typical_delivery.trim()}`}</p>}
   {(!origin||!destination)&&<p className="freight-help">Request a manufacturer quotation revision with shipping details before saving an alternative.</p>}
   {!currencyReady&&<p className="freight-help">{accountCurrency.error||'Loading account currency…'}</p>}
  </fieldset>
  <button className="freight-primary" disabled={busy||!currencyReady||!provider||!method||!origin||!destination}>{busy?'Saving…':'Save shipping quotation'}</button>
 </form>;
}

export function FreightReview({orderId,onReady}:{orderId:string;onReady?:(ready:boolean)=>void}){
 const [alternative,setAlternative]=useState(false);
 const[data,setData]=useState<FreightContext|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[reason,setReason]=useState(''),[feedback,setFeedback]=useState('');const lock=useRef(false);
 const refresh=async()=>{const d=await loadFreight(orderId);setData(d);onReady?.(!!d.manufacturerQuotes?.length&&d.manufacturerQuotes.every(t=>d.selections.some(s=>s.option_id===t.id)));};
 useEffect(()=>{let alive=true;setLoading(true);onReady?.(false);loadFreight(orderId).then(d=>{if(!alive)return;setData(d);onReady?.(!!d.manufacturerQuotes?.length&&d.manufacturerQuotes.every(t=>d.selections.some(s=>s.option_id===t.id)));}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[orderId]);
 const run=async(fn:()=>Promise<unknown>,message:string)=>{if(lock.current)return;lock.current=true;setBusy(true);onReady?.(false);setError('');setFeedback('');try{await fn();await refresh();setFeedback(message);}catch(e){setError(e instanceof Error?e.message:'Shipping could not be saved.');}finally{lock.current=false;setBusy(false);}};
 return <section className="freight-panel" aria-busy={busy||loading}><h2>Shipping approval</h2><p className="freight-help">Confirm one arrangement for every sample / bulk option before sending the customer quotation.</p>{loading&&<p role="status">Loading shipping quotes…</p>}{error&&<p className="freight-error" role="alert">{error}<button disabled={busy} onClick={()=>void run(refresh,'Shipping refreshed.')}>Retry</button></p>}{feedback&&<p role="status">{feedback}</p>}
 {data?.manufacturerQuotes?.map(t=><div className="freight-quote" key={t.id}><h3>{t.label}</h3>{t.shipping?<><p>Manufacturer: {t.shipping.provider} · {formatMoney(t.shipping.priceCents,t.shipping.currency)} · {t.shipping.method}{t.shipping.transitDays ? ` · ${t.shipping.transitDays} calendar days` : ''}</p><p className="freight-help">{[`${t.shipping.origin} → ${t.shipping.destination}`, t.shipping.validUntil && `Valid through ${t.shipping.validUntil}`, t.shipping.insurance, t.shipping.services, t.shipping.tradeTerms].filter(Boolean).join(' · ')}</p><button disabled={busy} onClick={()=>void run(async()=>{const id=await freightRpc<string>('freight_add_quote',{p_order:orderId,p_option:t.id,p_terms:t.shipping,p_forwarder:null});await freightRpc('freight_select',{p_order:orderId,p_quote:id,p_amendment_reason:data.paid?reason:null});},'Manufacturer shipping selected.')}>Use manufacturer shipping</button></>:<p className="freight-error">This older quotation has no separate shipping terms. Request a manufacturer revision before issuing new customer pricing.</p>}</div>)}
 {data&&<><div className="freight-actions">{!!data.manufacturerQuotes?.length&&<button type="button" aria-expanded={alternative} disabled={busy} onClick={()=>setAlternative(value=>!value)}>{alternative?'Close alternative shipping':'Find Alternative Shipping'}</button>}<a href="/superadmin/shipping-onboard#forwarders">Manage freight forwarders</a></div>{data.paid&&<label>Paid order amendment reason<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the provider change. Ceriga absorbs any cost difference; the customer's payable price stays locked."/></label>}
 {alternative&&!!data.manufacturerQuotes?.length&&<AlternativeShippingForm key={orderId} options={data.manufacturerQuotes} busy={busy} onSave={(option,forwarder,terms)=>void run(async()=>{
  await freightRpc('freight_add_quote',{p_order:orderId,p_option:option,p_terms:terms,p_forwarder:forwarder});
  setAlternative(false);
 },'Forwarder quotation saved. Select it below to approve.')}/>}
 <div className="freight-quotes">{data.quotes.map(q=>{const selected=data.selections.some(s=>s.quote_id===q.id);return <article className="freight-quote" data-selected={selected} key={q.id}><h3>{q.terms.provider} {selected?'· Selected':''}</h3><p>{data.manufacturerQuotes?.find(t=>t.id===q.option_id)?.label||q.option_id} · {q.source==='manufacturer'?'Manufacturer':'Freight forwarder'}</p><dl>{Object.entries({Cost:formatMoney(q.terms.priceCents,q.terms.currency),'Transit time':q.terms.transitDays && `${q.terms.transitDays} calendar days`,Route:`${q.terms.origin} → ${q.terms.destination}`,Method:q.terms.method,Insurance:q.terms.insurance,'Included services':q.terms.services,'Duty terms':q.terms.tradeTerms,'Valid through':q.terms.validUntil,Shipment:q.terms.weightKg && `${q.terms.weightKg} kg / ${q.terms.cartons} cartons`,Dimensions:q.terms.lengthCm && `${q.terms.lengthCm} × ${q.terms.widthCm} × ${q.terms.heightCm} cm`}).filter(([,value])=>Boolean(value)).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p className="freight-help">Account estimate: <Money cents={q.terms.priceCents} currency={q.terms.currency}/></p><button disabled={busy||selected} onClick={()=>void run(()=>freightRpc('freight_select',{p_order:orderId,p_quote:q.id,p_amendment_reason:data.paid?reason:null}),'Shipping selection saved.')}>{selected?'Selected':'Select shipping'}</button></article>;})}</div>{!data.quotes.length&&<p className="freight-help">No comparison quotes saved.</p>}{data.amendments.length>0&&<p className="freight-help">{data.amendments.length} approved shipping amendment(s). The issued customer price is unchanged.</p>}</>}
 </section>;
}
