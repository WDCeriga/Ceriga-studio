import {useEffect,useRef,useState} from 'react';
import {useCerigaTranslation} from '../../i18n/i18n';
import {getSupabase} from '../../lib/supabaseClient';
import {ALL_SHIPPING_METHODS} from '../../data/manufacturerOnboardingTypes';

type Defaults={revision:string;shippingMethods:string[];shippingProvidersByMethod:Record<string,string>};
export function FactoryShippingDefaults(){
 const {t,label}=useCerigaTranslation();
 const [saved,setSaved]=useState<Defaults|null>(null),[draft,setDraft]=useState<Defaults|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const lock=useRef(false);
 const read=async()=>{
  const {data,error}=await getSupabase().rpc('factory_shipping_defaults');
  if(error||!data)throw new Error(error?.message??'The database did not confirm this action.');
  return data as Defaults;
 };
 useEffect(()=>{let active=true;void read().then(data=>{if(active){setSaved(data);setDraft(data);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const save=async()=>{
  if(!draft||!saved||lock.current)return;lock.current=true;setBusy(true);setError('');setFeedback('');
  try{
   const {data,error}=await getSupabase().rpc('factory_shipping_defaults',{p_expected:saved.revision,p_data:{shippingMethods:draft.shippingMethods,shippingProvidersByMethod:draft.shippingProvidersByMethod}});
   if(error||!data)throw new Error(error?.message??'The database did not confirm this action.');
   setSaved(data);setDraft(data);setFeedback(t('interface.text_47b26ff1544bd907'));
   window.dispatchEvent(new Event('ceriga-manufacturer-profile-changed'));
  }catch(e){setError(e instanceof Error?e.message:'The request could not be completed.');}finally{lock.current=false;setBusy(false);}
 };
 const dirty=Boolean(draft&&saved&&JSON.stringify(draft)!==JSON.stringify(saved));
 return <details id="shipping-defaults" className="factory-shipping-defaults" open={typeof window!=='undefined'&&window.location?.hash==='#shipping-defaults'?true:undefined}>
  <summary>{t('workflow.shippingDefaults')}</summary>
  {error&&<p role="alert">{label(error)}</p>}
  {!draft&&!error&&<p role="status">{t('messages.loading')}</p>}
  {draft&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}>
   {ALL_SHIPPING_METHODS.map(method=><div key={method}>
    <label><input type="checkbox" checked={draft.shippingMethods.includes(method)} onChange={e=>setDraft(current=>current?{...current,shippingMethods:e.target.checked?[...current.shippingMethods,method]:current.shippingMethods.filter(m=>m!==method)}:current)}/>{label(method)}</label>
    {draft.shippingMethods.includes(method)&&<label>{label('Shipping provider')}<input required maxLength={200} value={draft.shippingProvidersByMethod[method]??''} onChange={e=>setDraft(current=>current?{...current,shippingProvidersByMethod:{...current.shippingProvidersByMethod,[method]:e.target.value}}:current)}/></label>}
   </div>)}
  </fieldset><div className="factory-shipping-actions"><button type="submit" disabled={busy||!dirty||!draft.shippingMethods.length}>{busy?t('common.saving'):t('common.save')}</button><button type="button" disabled={busy||!dirty} onClick={()=>{setDraft(saved);setError('');}}>{t('common.cancel')}</button></div></form>}
  {feedback&&<p role="status">{feedback}</p>}
 </details>;
}
