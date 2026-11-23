import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useState } from 'react';
import { QC_STAGES, measurementResult, type CheckResult, type Defect, type Inspection, type Requirement, type QcStage } from '../../data/qualityControl';
import { qcAction } from '../../lib/qualityControlDb';
export const qcInput = 'mt-1 w-full rounded-lg border border-white/15 bg-[#17171b] px-3 py-2 text-sm text-white disabled:opacity-50';
export const qcButton = 'rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40';
export const qcPrimary = 'rounded-lg bg-[#CC2D24] px-4 py-2 text-sm font-medium text-white hover:bg-[#b52720] disabled:opacity-40';
type Props = { orderId: string; requirement: Requirement; inspection?: Inspection; defect?: Defect; onSaved: (id: string, submitted: boolean) => Promise<void>; onCancel: () => void };
export function InspectionEditor({ orderId, requirement, inspection, defect, onSaved, onCancel }: Props) {
  useCerigaTranslation();

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
  catch(cause){setError(cause instanceof Error?cause.message:cerigaTranslate("interface.text_0651b6cef1b49141"));}finally{setBusy(false);}
 };
 return <section className="rounded-xl border border-sky-400/25 bg-sky-400/[0.03] p-4 sm:p-5"><h3 className="text-lg font-semibold">{inspection?cerigaTranslate("interface.text_4a1cb57bb451aa22"):cerigaTranslate("interface.text_73bd2ebd703a6f77")}</h3><p className="mt-1 text-xs text-white/45">{cerigaTranslate("interface.text_fcd4dc60063950e9")}{" "}{requirement.version}{cerigaTranslate("interface.text_fc1032cf61124145")}</p>
  <fieldset disabled={busy} className="mt-4 space-y-4">
   <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-white/60">{cerigaTranslate("interface.text_de838855e4a6e04e")}<select className={qcInput} value={stage} disabled={!!defect} onChange={e=>{setStage(e.target.value as QcStage);setConfirm(false);}}>{Object.entries(QC_STAGES).filter(([key])=>key!=='reinspection'||!!defect).map(([key,label])=><option key={key} value={key}>{cerigaTranslateLabel(label)}</option>)}</select></label><label className="text-xs text-white/60">{cerigaTranslate("interface.text_d11ab523a43bf1d3")}<input className={qcInput} value={batch} maxLength={200} onChange={e=>{setBatch(e.target.value);setConfirm(false);}} /></label><label className="text-xs text-white/60">{cerigaTranslate("interface.text_447c3f14aac4c121")}<input className={qcInput} value={sizeColour} onChange={e=>{setSizeColour(e.target.value);setConfirm(false);}} /></label></div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(counts).map(([key,value])=><label key={key} className="text-xs capitalize text-white/60">{key}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}<input className={qcInput} type="number" min={key==='produced'||key==='inspected'?1:0} step="1" value={value} onChange={e=>{setCounts(c=>({...c,[key]:Number(e.target.value)}));setConfirm(false);}} /></label>)}</div>
   <p className="text-xs text-white/45">{cerigaTranslate("interface.text_668845db0d0696da")}</p>
   {!checks.length&&<p className="text-amber-200">{cerigaTranslate("interface.text_13dc19a4f4262e9f")}</p>}
   {checks.map(check=>{const a=answer(check.id),computed=a.result==='na'?null:measurementResult(check,a.actual);return <div key={check.id} className="rounded-lg border border-white/10 p-4"><h4 className="font-medium">{cerigaTranslateLabel(check.label)}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-white/55">{check.criteria}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/60">{cerigaTranslate("interface.text_6e7d50e84f4731ef")}<select className={qcInput} value={computed||a.result} onChange={e=>update(check.id,{result:e.target.value as CheckResult['result']})}><option value="">{cerigaTranslate("interface.text_bf0e064c66c7fd59")}</option><option value="pass" disabled={check.target!=null}>{cerigaTranslate("interface.text_ebdf8cc00bc4d9ce")}</option><option value="fail" disabled={check.target!=null}>{cerigaTranslate("interface.text_09230b3dbc35635f")}</option><option value="na">{cerigaTranslate("interface.text_5237c96ac1a23b98")}</option></select></label>
    {check.target!=null&&a.result!=='na'&&<label className="text-xs text-white/60">{cerigaTranslate("interface.text_3f47ce1a92fa69a1")}{check.unit}{cerigaTranslate("interface.text_d2a99fd602d6cc6d")}{" "}{check.target} ±{check.tolerance}<input className={qcInput} type="number" step="any" value={a.actual??''} onChange={e=>update(check.id,{actual:e.target.value===''?'':Number(e.target.value)})}/></label>}</div>
    <label className="mt-3 block text-xs text-white/60">{cerigaTranslate("interface.text_8de99354c082c442")}<textarea className={qcInput} value={a.note} onChange={e=>update(check.id,{note:e.target.value})}/></label>
    {(computed||a.result)==='fail'&&<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/60">{cerigaTranslate("interface.text_5e9f98120dbe5682")}<select className={qcInput} value={a.severity} onChange={e=>update(check.id,{severity:e.target.value as CheckResult['severity']})}>{['minor','major','critical'].map(s=><option key={s} value={s}>{cerigaTranslateLabel(s)}</option>)}</select></label><label className="text-xs text-white/60">{cerigaTranslate("interface.text_de3a94fd1f92c21f")}<input className={qcInput} type="number" min="1" max={counts.inspected} step="1" value={a.affected_units} onChange={e=>update(check.id,{affected_units:Number(e.target.value)})}/></label></div>}
   </div>;})}
   <label className="block text-xs text-white/60">{cerigaTranslate("interface.text_cfca367d98ec8904")}<textarea className={qcInput} value={notes} onChange={e=>{setNotes(e.target.value);setConfirm(false);}}/></label>
  </fieldset>
  {error&&<p role="alert" className="mt-3 text-sm text-red-300">{cerigaTranslateLabel(error)}</p>}
  {confirm&&<p role="alert" className="mt-3 rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">{cerigaTranslate("interface.text_fea41b1cc411e8b2")}</p>}
  <div className="mt-4 flex flex-wrap gap-2"><button className={qcButton} disabled={busy||!batch.trim()} onClick={()=>void save(false)}>{busy?cerigaTranslate("common.saving"):cerigaTranslate("adminOrders.saveDraft")}</button><button className={qcPrimary} disabled={busy||!checks.length||!batch.trim()} onClick={()=>void save(true)}>{confirm?cerigaTranslate("interface.text_f6b1272e1a828e9e"):cerigaTranslate("interface.text_4175be101f5fec10")}</button><button className={qcButton} disabled={busy} onClick={onCancel}>{cerigaTranslate("common.cancel")}</button></div>
 </section>;
}
