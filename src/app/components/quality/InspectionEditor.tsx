import { useState } from 'react';
import { QC_STAGES, measurementResult, type CheckResult, type Defect, type Inspection, type Requirement, type QcStage } from '../../data/qualityControl';
import { qcAction } from '../../lib/qualityControlDb';
export const qcInput = 'mt-1 w-full rounded-lg border border-white/15 bg-[#17171b] px-3 py-2 text-sm text-white disabled:opacity-50';
export const qcButton = 'rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40';
export const qcPrimary = 'rounded-lg bg-[#CC2D24] px-4 py-2 text-sm font-medium text-white hover:bg-[#b52720] disabled:opacity-40';
type Props = { orderId: string; requirement: Requirement; inspection?: Inspection; defect?: Defect; onSaved: (id: string, submitted: boolean) => Promise<void>; onCancel: () => void };
export function InspectionEditor({ orderId, requirement, inspection, defect, onSaved, onCancel }: Props) {
 const [stage,setStage]=useState<QcStage>(inspection?.stage || (defect ? 'reinspection' : 'sample'));
 const [batch,setBatch]=useState(inspection?.batch || '');
 const [sizeColour,setSizeColour]=useState(inspection?.size_colour || '');
 const [counts,setCounts]=useState({produced:inspection?.produced || defect?.affected_units || 1,inspected:inspection?.inspected || defect?.affected_units || 1,accepted:inspection?.accepted || 0,rejected:inspection?.rejected || 0,held:inspection?.held || 0});
 const [notes,setNotes]=useState(inspection?.notes || '');
 const [answers,setAnswers]=useState<CheckResult[]>(inspection?.checks || []);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const checks=requirement.checks.filter(check=>stage==='reinspection' ? check.id===defect?.check_id : check.stage===stage);
 const answer=(id:string):CheckResult=>answers.find(a=>a.id===id) || {id,result:'',note:'',severity:'major',affected_units:1};
 const update=(id:string,patch:Partial<CheckResult>)=>{setConfirm(false);setAnswers(previous=>[...previous.filter(a=>a.id!==id),{...answer(id),...patch}]);};
 const save=async(submit:boolean)=>{
  if(submit&&!confirm){setConfirm(true);return;}
  setBusy(true);setError('');
  try {const id=await qcAction(orderId,submit?'submit_inspection':'save_inspection',{id:inspection?.id,stage,batch,size_colour:sizeColour,...counts,notes,parent_defect_id:defect?.id,checks:checks.map(c=>{const a=answer(c.id);return {...a,result:a.result==='na'?'na':measurementResult(c,a.actual)||a.result};})});await onSaved(id,submit);}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not save inspection');}finally{setBusy(false);}
 };
 return <section className="rounded-xl border border-sky-400/25 bg-sky-400/[0.03] p-4 sm:p-5"><h3 className="text-lg font-semibold">{inspection?'Edit inspection draft':'New inspection'}</h3><p className="mt-1 text-xs text-white/45">Requirements version {requirement.version}. Save a draft before attaching evidence. Submitted inspections remain in the history.</p>
  <fieldset disabled={busy} className="mt-4 space-y-4">
   <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-white/60">Stage<select className={qcInput} value={stage} disabled={!!defect} onChange={e=>{setStage(e.target.value as QcStage);setConfirm(false);}}>{Object.entries(QC_STAGES).filter(([key])=>key!=='reinspection'||!!defect).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs text-white/60">Batch / lot reference<input className={qcInput} value={batch} maxLength={200} onChange={e=>{setBatch(e.target.value);setConfirm(false);}} /></label><label className="text-xs text-white/60">Sizes and colours inspected<input className={qcInput} value={sizeColour} onChange={e=>{setSizeColour(e.target.value);setConfirm(false);}} /></label></div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(counts).map(([key,value])=><label key={key} className="text-xs capitalize text-white/60">{key} units<input className={qcInput} type="number" min={key==='produced'||key==='inspected'?1:0} step="1" value={value} onChange={e=>{setCounts(c=>({...c,[key]:Number(e.target.value)}));setConfirm(false);}} /></label>)}</div>
   <p className="text-xs text-white/45">Accepted + rejected + held must equal inspected. Final shipment approval requires every unit in the shipment batch to be inspected and accepted.</p>
   {!checks.length&&<p className="text-amber-200">No approved checks for this stage. Ask Ceriga to update the requirements.</p>}
   {checks.map(check=>{const a=answer(check.id),computed=a.result==='na'?null:measurementResult(check,a.actual);return <div key={check.id} className="rounded-lg border border-white/10 p-4"><h4 className="font-medium">{check.label}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-white/55">{check.criteria}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/60">Result<select className={qcInput} value={computed||a.result} onChange={e=>update(check.id,{result:e.target.value as CheckResult['result']})}><option value="">Select result</option><option value="pass" disabled={check.target!=null}>Pass</option><option value="fail" disabled={check.target!=null}>Fail</option><option value="na">Not applicable</option></select></label>
    {check.target!=null&&a.result!=='na'&&<label className="text-xs text-white/60">Actual measurement ({check.unit}) · target {check.target} ±{check.tolerance}<input className={qcInput} type="number" step="any" value={a.actual??''} onChange={e=>update(check.id,{actual:e.target.value===''?'':Number(e.target.value)})}/></label>}</div>
    <label className="mt-3 block text-xs text-white/60">Notes / reason<textarea className={qcInput} value={a.note} onChange={e=>update(check.id,{note:e.target.value})}/></label>
    {(computed||a.result)==='fail'&&<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/60">Severity<select className={qcInput} value={a.severity} onChange={e=>update(check.id,{severity:e.target.value as CheckResult['severity']})}>{['minor','major','critical'].map(s=><option key={s}>{s}</option>)}</select></label><label className="text-xs text-white/60">Affected units<input className={qcInput} type="number" min="1" max={counts.inspected} step="1" value={a.affected_units} onChange={e=>update(check.id,{affected_units:Number(e.target.value)})}/></label></div>}
   </div>;})}
   <label className="block text-xs text-white/60">Inspection notes<textarea className={qcInput} value={notes} onChange={e=>{setNotes(e.target.value);setConfirm(false);}}/></label>
  </fieldset>
  {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  {confirm&&<p role="alert" className="mt-3 rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">Submit this inspection permanently? Results cannot be edited afterwards. Failures create defects and place remaining shipments on hold.</p>}
  <div className="mt-4 flex flex-wrap gap-2"><button className={qcButton} disabled={busy||!batch.trim()} onClick={()=>void save(false)}>{busy?'Saving…':'Save draft'}</button><button className={qcPrimary} disabled={busy||!checks.length||!batch.trim()} onClick={()=>void save(true)}>{confirm?'Confirm submission':'Submit inspection'}</button><button className={qcButton} disabled={busy} onClick={onCancel}>Cancel</button></div>
 </section>;
}
