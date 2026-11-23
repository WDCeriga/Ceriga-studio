import {useEffect,useRef,useState} from 'react';
import {activeLocale,useCerigaTranslation} from '../../i18n/i18n';
import {getSupabase} from '../../lib/supabaseClient';
type Settings={enabled:boolean;reviewHours:number;quoteHours:number;repeatHours:number;shippingDays:number;quietStartUTC:number;quietEndUTC:number};
type Health={settings:Settings;jobs:{name:string;schedule:string;active:boolean}[];history:{name:string;status?:string;start_time?:string}[]};
function HealthContent(){
 const {t,label}=useCerigaTranslation();
 const [data,setData]=useState<Health|null>(null),[draft,setDraft]=useState<Settings|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const lock=useRef(false);
 const load=async(settings?:Settings)=>{
  const {data,error}=await getSupabase().rpc('admin_workflow_health',settings?{p_settings:{...settings,_expected:data?.settings}}:{});
  if(error||!data)throw new Error(error?.message??'The database did not confirm this action.');
  return data as Health;
 };
 useEffect(()=>{let active=true;void load().then(result=>{if(active){setData(result);setDraft(result.settings);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const save=async()=>{
  if(lock.current||!draft)return;lock.current=true;setBusy(true);setError('');setSaved(false);
  try{const result=await load(draft);setData(result);setDraft(result.settings);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'The request could not be completed.');}finally{lock.current=false;setBusy(false);}
 };
 const dirty=JSON.stringify(data?.settings)!==JSON.stringify(draft);
 return <div className="st-workflow-health">
  {error&&<p role="alert" className="st-error">{label(error)}</p>}
  {!data&&!error&&<p role="status">{t('messages.loading')}</p>}
  {data&&<><dl>{data.jobs.map(job=>{const run=data.history.find(item=>item.name===job.name);return <div key={job.name}><dt>{t(job.name.includes('production')?'nav.production':job.name.includes('completion')||job.name.includes('delivery')?'nav.delivery':'workflow.reminders')}</dt><dd>{!job.active?label('Paused'):run?.status==='succeeded'?t('workflow.healthy'):run?.status==='failed'?t('workflow.failed'):t('manufacturerOrders.notRecorded')}{run?.start_time&&<time dateTime={run.start_time}> &middot; {new Date(run.start_time).toLocaleString(activeLocale())}</time>}</dd></div>;})}</dl>
   {draft&&<form onSubmit={e=>{e.preventDefault();void save();}}><label className="st-reminders-enabled"><input type="checkbox" disabled={busy} checked={draft.enabled} onChange={e=>{setSaved(false);setDraft(d=>d?{...d,enabled:e.target.checked}:d);}}/>{t('workflow.reminders')}</label>
   <p className="st-note">{t('workflow.quietHelp')}</p><div className="st-reminder-fields">{(['reviewHours','quoteHours','repeatHours','shippingDays','quietStartUTC','quietEndUTC'] as const).map(key=><label key={key}>{t('workflow.'+key)}<input type="number" required disabled={busy} min={key.includes('UTC')||key==='shippingDays'||key==='quoteHours'?0:1} max={key.includes('UTC')?23:key==='shippingDays'?14:168} step={1} value={draft[key]} onChange={e=>{setSaved(false);setDraft(d=>d?{...d,[key]:Number(e.target.value)}:d);}}/></label>)}</div><button type="submit" disabled={busy||!dirty} className="st-primary">{busy?t('common.saving'):t('common.save')}</button>{saved&&<p role="status">{t('interface.text_47b26ff1544bd907')}</p>}</form>}
  </>}
 </div>;
}
export function WorkflowHealth(){
 const {t}=useCerigaTranslation();const [open,setOpen]=useState(false);
 return <details className="st-panel st-workflow-disclosure" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{t('workflow.health')}</summary>{open&&<HealthContent/>}</details>;
}
