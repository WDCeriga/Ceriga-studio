import {useLocation} from 'react-router';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useCerigaTranslation,activeLocale} from '../../i18n/i18n';
import {getSupabase} from '../../lib/supabaseClient';
import './internal-work.css';
const stateLabels:Record<string,string>={draft:'Draft',review:'Review',resolved:'Resolved',cancelled:'Cancelled'};

type Work={id:string;kind:string;state:string;revision:number;owner_id?:string;updated_at:string;details:Record<string,any>};
function WorkContent({orderId,kind}:{orderId:string;kind:'amendment'|'shipping_preparation'}){
 const {t,label}=useCerigaTranslation();
 const [rows,setRows]=useState<Work[]>([]),[draft,setDraft]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const lock=useRef(false),generation=useRef(0),dirty=useRef(false);
 const invoke=async(action:string,work?:Work,data:Record<string,unknown>={})=>{
  const result=await getSupabase().rpc('internal_order_work',{p_order:orderId,p_kind:kind,p_action:action,p_id:work?.id??null,p_expected:work?.revision??null,p_data:data});
  if(result.error||!result.data)throw new Error(result.error?.message??'The database did not confirm this action.');
  return result.data;
 };
 const load=useCallback(async()=>{
  const version=++generation.current;
  try{
   const result=await invoke('read');if(version!==generation.current)return;
   setRows(result);if(!dirty.current){const active=result.find((r:Work)=>['draft','review'].includes(r.state));const next={...(active?.details??{})};if(next.collection_at){const date=new Date(next.collection_at);if(!Number.isNaN(date.getTime()))next.collection_at=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}setDraft(next);}
   setError('');
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'The request could not be completed.');}
  finally{if(version===generation.current)setLoading(false);}
 },[orderId,kind]);
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('ceriga-internal-work-updated',refresh);return()=>{generation.current++;window.removeEventListener('ceriga-internal-work-updated',refresh);};},[load]);
 const active=rows.find(row=>['draft','review'].includes(row.state));
 const act=async(action:string)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await invoke(action,active,action==='save'?Object.fromEntries((kind==='amendment'?['note','reference']:['carrier','collection_at','note']).map(key=>[key,key==='collection_at'&&draft[key]?new Date(draft[key]).toISOString():draft[key]??''])):{});dirty.current=false;await load();window.dispatchEvent(new Event('ceriga-orders-updated'));}
  catch(e){setError(e instanceof Error?e.message:'The request could not be completed.');}
  finally{lock.current=false;setBusy(false);}
 };
 return <section className="internal-work-panel">
  <h3>{t(kind==='amendment'?'workflow.awaitingAmendment':'workflow.prepareShipping')}</h3>
  {loading&&<p role="status">{t('messages.loading')}</p>}
  {error&&<p role="alert">{label(error)} <button type="button" onClick={()=>void load()}>{t('common.retry')}</button></p>}
  {!loading&&!error&&!active&&kind==='shipping_preparation'&&<button type="button" disabled={busy} onClick={()=>void act('create')}>{t('workflow.prepareShipping')}</button>}
  {active&&<><p className="internal-work-meta">{label(stateLabels[active.state])} &middot; {new Date(active.updated_at).toLocaleString(activeLocale())}</p>
   {kind==='amendment'&&<p>{t('workflow.noAutomaticChanges')}</p>}
   {kind==='shipping_preparation'&&<>{active.details.route&&<p>{active.details.route.origin} &rarr; {active.details.route.destination}</p>}{active.details.forecast_at&&<p>{t('workflow.forecast')}: {new Date(active.details.forecast_at).toLocaleString(activeLocale())}</p>}</>}
   <form onSubmit={e=>{e.preventDefault();void act('save');}}>
    {(kind==='amendment'?['reference','note']:['carrier','collection_at','note']).map(key=><label key={key}>{key==='reference'?t('workflow.revisionReference'):key==='carrier'?t('workflow.carrier'):key==='collection_at'?t('workflow.collectionAt'):label('Notes')}
     {key==='note'?<textarea rows={2} maxLength={2000} disabled={busy} value={draft[key]??''} onChange={e=>{dirty.current=true;setDraft(d=>({...d,[key]:e.target.value}));}}/>:<input type={key==='collection_at'?'datetime-local':'text'} disabled={busy} maxLength={key==='reference'?500:200} value={draft[key]??''} onChange={e=>{dirty.current=true;setDraft(d=>({...d,[key]:e.target.value}));}}/>}
    </label>)}
    <div className="internal-work-actions"><button type="submit" disabled={busy||!dirty.current}>{busy?t('common.saving'):t('common.save')}</button><button type="button" disabled={busy} onClick={()=>void act('claim')}>{t('workflow.claim')}</button>
    <details><summary>{label('Actions')}</summary><button type="button" disabled={busy||dirty.current} onClick={()=>void act('review')}>{label('Review')}</button><button type="button" disabled={busy||dirty.current} onClick={()=>void act('resolve')}>{label('Mark as resolved')}</button><button type="button" disabled={busy||dirty.current} onClick={()=>void act('cancel')}>{t('common.cancel')}</button></details></div>
   </form>
   {kind==='amendment'&&<details><summary>{label('Activity History')}</summary><pre>{JSON.stringify({proposal:active.details.proposal,specifications:active.details.specifications,quantities:active.details.quantities},null,2)}</pre></details>}
  </>}
  {rows.filter(row=>['resolved','cancelled'].includes(row.state)).map(row=><details key={row.id}><summary>{label(stateLabels[row.state])} &middot; {new Date(row.updated_at).toLocaleString(activeLocale())}</summary><p>{row.details.note}</p>{row.details.reference&&<p>{row.details.reference}</p>}</details>)}
 </section>;
}

export function InternalWorkPanel({orderId,kind}:{orderId:string;kind:'amendment'|'shipping_preparation'}){
 const {t,label}=useCerigaTranslation();
 const {hash}=useLocation();const target=kind==='amendment'?'#internal-amendment':'#shipping-preparation';
 const [open,setOpen]=useState(hash===target);
 const [availability,setAvailability]=useState({visible:kind==='shipping_preparation'||hash===target,pending:true});
 useEffect(()=>{
  if(kind!=='amendment')return;
  let active=true;const check=()=>void getSupabase().rpc('internal_order_work',{p_order:orderId,p_kind:kind,p_action:'read'}).then(({data,error})=>{
   if(active)setAvailability({visible:!!error||Array.isArray(data)&&data.length>0,pending:!!error||Array.isArray(data)&&data.some((row:Work)=>['draft','review'].includes(row.state))});
  }).catch(()=>{if(active)setAvailability({visible:true,pending:false});});
  check();window.addEventListener('ceriga-internal-work-updated',check);
  return()=>{active=false;window.removeEventListener('ceriga-internal-work-updated',check);};
 },[orderId,kind]);
 useEffect(()=>{if(hash===target)setOpen(true);},[hash,target]);
 if(kind==='amendment'&&!availability.visible&&!open)return null;
 return <details id={kind==='amendment'?'internal-amendment':'shipping-preparation'} className="internal-work-disclosure" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{kind==='amendment'?(availability.pending?t('workflow.awaitingAmendment'):label('Activity History')):t('workflow.prepareShipping')}</summary>{open&&<WorkContent key={orderId+kind} orderId={orderId} kind={kind}/>}</details>;
}
