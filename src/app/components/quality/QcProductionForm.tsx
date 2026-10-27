import{createTaskLimiter}from '../../lib/privateAssetUrls';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, RefreshCw, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { qcAction } from '../../lib/qualityControlDb';
import { prepareQcFile, uploadReportFile } from '../../lib/qcReportFiles';
import { getSupabase } from '../../lib/supabaseClient';
import type { ProducedLine, ProductionReport, ReportContext, ReportEvidence } from '../../data/qualityControl';
import { evidenceUrl, QcPhotoGallery } from './QcPhotoGallery';

const input='mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#CC2D24] disabled:opacity-50';
const confirmation='I confirm that the submitted photos and information accurately represent the completed production and that any known production issues have been disclosed.';
type UploadItem={key:string;role:'photo'|'support';file?:File;record?:ReportEvidence;preview?:string;status:'uploading'|'ready'|'error';error?:string};
export function QcProductionForm({orderId,context,initial,evidence,onSubmitted}:{orderId:string;context:ReportContext;initial?:ProductionReport;evidence:ReportEvidence[];onSubmitted:()=>Promise<void>}) {
 const [summary,setSummary]=useState(initial?.production_summary||'');
 const [lines,setLines]=useState<ProducedLine[]>(()=>context.ordered_lines.map(line=>({...line,produced:initial?.produced_lines.find(r=>r.id===line.id)?.produced??line.ordered})));
 const [issues,setIssues]=useState<boolean|null>(initial?.has_issues??null),[description,setDescription]=useState(initial?.issue_description||''),[measurement,setMeasurement]=useState(initial?.measurement_notes||''),[confirmed,setConfirmed]=useState(false);
 const [items,setItems]=useState<UploadItem[]>(()=>[...(initial?.photo_ids||[]),...(initial?.supporting_ids||[])].flatMap(id=>{const record=evidence.find(e=>e.id===id);return record?[{key:id,role:record.file_role,record,status:'ready' as const}]:[];}));
 const [submitting,setSubmitting]=useState(false),[uploading,setUploading]=useState(0),[error,setError]=useState(''),[saveState,setSaveState]=useState(''),[dragging,setDragging]=useState(false),[preview,setPreview]=useState<{photos:ReportEvidence[];urls:Record<string,string>;index:number}|null>(null);
 const draft=useRef(initial?.qc_status==='not_submitted'&&!initial.draft_superseded&&initial.order_snapshot===context.snapshot?initial.id:undefined);
 const creating=useRef<Promise<string>|null>(null),queue=useRef<Promise<unknown>>(Promise.resolve()),objectUrls=useRef(new Set<string>()),mounted=useRef(true),submitInFlight=useRef(false),edited=useRef(false);
 const limitUpload=useRef(createTaskLimiter(3));
 const photos=items.filter(i=>i.role==='photo'),supports=items.filter(i=>i.role==='support');
 const total=lines.reduce((sum,line)=>sum+(Number.isInteger(line.produced)?line.produced:0),0),ordered=context.ordered_lines.reduce((sum,line)=>sum+line.ordered,0);
 const discrepancy=lines.some(line=>line.produced!==line.ordered);
 const ensureDraft=useCallback(async()=>{if(draft.current)return draft.current;if(!creating.current)creating.current=qcAction(orderId,'start_report').then(id=>{draft.current=id;return id;}).finally(()=>{creating.current=null;});return creating.current;},[orderId]);
 const payload=useRef<object>({});payload.current={production_summary:summary,produced_lines:lines,has_issues:discrepancy?true:issues,issue_description:description,measurement_notes:measurement,photo_ids:items.filter(i=>i.record?.file_role==='photo').map(i=>i.record!.id),supporting_ids:items.filter(i=>i.record?.file_role==='support').map(i=>i.record!.id)};
 const touch=()=>{edited.current=true;setConfirmed(false);setError('');};
 const save=useCallback(()=>{
  const task=queue.current.catch(()=>undefined).then(async()=>{if(submitInFlight.current||!mounted.current)return;setSaveState('Saving draft…');const id=await ensureDraft();await qcAction(orderId,'save_report',{...payload.current,id});if(mounted.current)setSaveState('Draft saved');});
  queue.current=task;void task.catch(cause=>{if(mounted.current){setSaveState('Draft not saved');setError(cause instanceof Error?cause.message:'Could not save draft');}});return task;
 },[orderId,ensureDraft]);
 useEffect(()=>{if(!edited.current||uploading||submitting)return;const timer=setTimeout(()=>void save(),1000);return()=>clearTimeout(timer);},[summary,lines,issues,description,measurement,items,uploading,submitting,save]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const url of objectUrls.current)URL.revokeObjectURL(url);};},[]);
 useEffect(()=>{let current=true;void Promise.all(items.filter(i=>i.record&&!i.preview).map(async item=>({key:item.key,url:await evidenceUrl(item.record!.path)}))).then(rows=>{if(current&&rows.length)setItems(previous=>previous.map(i=>({...i,preview:rows.find(r=>r.key===i.key)?.url||i.preview})));}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Could not display photos');});return()=>{current=false;};},[items.map(i=>i.key+!!i.preview).join('|')]);

 const remove=async(item:UploadItem)=>{
  if(submitting||item.status==='uploading')return;
  touch();
  try {
   if(item.record){const id=await ensureDraft();await qcAction(orderId,'remove_report_evidence',{id,evidence_id:item.record.id});
    if(item.record.inspection_id===id)await getSupabase().storage.from('qc-evidence').remove([item.record.path]);}
   setItems(previous=>previous.filter(i=>i.key!==item.key));
  } catch(cause){setError(cause instanceof Error?cause.message:'Could not remove this file');}
 };
 const upload=async(file:File,role:'photo'|'support',key:string,replace?:UploadItem)=>{
  setUploading(count=>count+1);setError('');
  try {
   const prepared=await prepareQcFile(file,role==='photo');const id=await ensureDraft();const record=await uploadReportFile(orderId,id,prepared,role);
   if(!mounted.current)return;
   setItems(previous=>previous.map(i=>i.key===key?{...i,record,status:'ready',error:undefined}:i));
   if(replace?.record){await qcAction(orderId,'remove_report_evidence',{id,evidence_id:replace.record.id});if(replace.record.inspection_id===id)await getSupabase().storage.from('qc-evidence').remove([replace.record.path]);setItems(previous=>previous.filter(i=>i.key!==replace.key));}
  } catch(cause){if(mounted.current)setItems(previous=>previous.map(i=>i.key===key?{...i,status:'error',error:cause instanceof Error?cause.message:'Upload failed'}:i));}
  finally{if(mounted.current)setUploading(count=>count-1);}
 };
 const addFiles=(files:File[],role:'photo'|'support',replace?:UploadItem)=>{
  if(submitting)return;
  if(items.filter(i=>i.role===role).length+files.length>(role==='photo'?40:20)){setError('You can attach up to 40 photos and 20 supporting files.');return;}
  touch();for(const file of files){const key=crypto.randomUUID();const url=file.type.startsWith('image/')?URL.createObjectURL(file):undefined;if(url)objectUrls.current.add(url);setItems(previous=>[...previous,{key,role,file,preview:url,status:'uploading'}]);void limitUpload.current(async()=>{if(mounted.current)await upload(file,role,key,replace);});}
 };
 const submit=async()=>{
  if(submitInFlight.current)return;
  if(uploading||items.some(i=>i.status!=='ready')){setError('Wait for uploads to finish, and retry or remove failed uploads.');return;}
  if(!items.some(i=>i.record?.file_role==='photo')){setError('Upload at least one production photo.');return;}
  if(!summary.trim()){setError('Production Summary is required.');return;}
  if(!Number.isInteger(total)||total<=0||lines.some(l=>!Number.isInteger(l.produced)||l.produced<0)){setError('Enter whole-number quantities with a positive total.');return;}
  if(!discrepancy&&issues===null){setError('Please declare whether there were production issues.');return;}
  if((discrepancy||issues)&&!description.trim()){setError('Describe production issues and quantity discrepancies.');return;}
  if(!confirmed){setError('Confirm the accuracy of your submission.');return;}
  submitInFlight.current=true;setSubmitting(true);setError('');
  try{await queue.current.catch(()=>undefined);const id=await ensureDraft();await qcAction(orderId,'submit_report',{...payload.current,id,manufacturer_confirmed:true});toast.success('Production report submitted for quality review');await onSubmitted();}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not submit your production report');submitInFlight.current=false;setSubmitting(false);}
 };
 return <form className="space-y-6" onSubmit={e=>{e.preventDefault();void submit();}}>
  <fieldset disabled={submitting} className="space-y-6">
   <section aria-labelledby="qc-photos"><h3 id="qc-photos" className="text-sm font-semibold">Production Photos <span className="text-red-400">*</span></h3>
    <label className={`mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${dragging?'border-red-400 bg-red-500/10':'border-white/20 bg-black/10 hover:border-red-400/50'}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(Array.from(e.dataTransfer.files),'photo');}}>
     <Upload className="mb-2 h-6 w-6 text-red-400"/><span className="text-sm">Drop production photos here or choose images</span><span className="mt-1 text-xs text-white/40">JPG, PNG or WebP · multiple images · large photos are optimised</span><input aria-label="Upload production photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>{addFiles(Array.from(e.target.files||[]),'photo');e.target.value='';}}/>
    </label>
    <p className="mt-2 text-xs leading-relaxed text-white/45">Useful photos: front, back, print or embroidery close-ups, stitching, labels and the overall finished production. No need to label each image.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map((item,index)=><div key={item.key} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20"><button type="button" aria-label={`Enlarge photo ${index+1}`} className="block w-full" disabled={!item.preview} onClick={()=>setPreview({photos:photos.map(i=>({...i.record,id:i.key,path:i.record?.path||'',file_name:i.record?.file_name||i.file?.name||'Photo',file_role:'photo',check_id:''} as ReportEvidence)),urls:Object.fromEntries(photos.filter(i=>i.preview).map(i=>[i.key,i.preview!])),index})}>{item.preview?<img src={item.preview} alt={`Production photo ${index+1}`} className="aspect-[4/3] w-full object-cover"/>:<div className="flex aspect-[4/3] items-center justify-center text-xs text-white/40">Loading…</div>}</button>
     <button type="button" className="absolute right-1 top-1 rounded-full bg-black/80 p-1.5 text-white disabled:opacity-40" aria-label={`Remove photo ${index+1}`} disabled={item.status==='uploading'} onClick={()=>void remove(item)}><X className="h-4 w-4"/></button>
     <div className="flex items-center justify-between gap-1 p-2 text-xs text-white/60">{item.status==='uploading'?<span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/>Uploading…</span>:item.status==='error'?<button type="button" className="text-red-300" onClick={()=>{setItems(rows=>rows.map(i=>i.key===item.key?{...i,status:'uploading'}:i));void upload(item.file!,'photo',item.key);}}>Retry upload</button>:<span>Photo {index+1}</span>}
      {item.status==='ready'&&<label className="cursor-pointer text-red-300">Replace<input aria-label={`Replace photo ${index+1}`} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={e=>{if(e.target.files?.[0])addFiles([e.target.files[0]],'photo',item);e.target.value='';}}/></label>}</div>{item.error&&<p role="alert" className="p-2 text-xs text-red-300">{item.error}</p>}</div>)}</div>
   </section>
   <label className="block text-sm font-semibold">Production Summary <span className="text-red-400">*</span><textarea required maxLength={6000} rows={4} className={input} value={summary} onChange={e=>{touch();setSummary(e.target.value);}} placeholder="Briefly describe the completed production, overall garment quality, materials, printing/embroidery and any relevant observations."/></label>
   <section aria-labelledby="qc-produced"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="qc-produced" className="text-sm font-semibold">Quantity Produced <span className="text-red-400">*</span></h3><p className="text-xs text-white/50">Ordered Quantity: {ordered} units</p></div>
    {lines.length===1?<input aria-label="Quantity Produced" className={input} type="number" min="1" step="1" required value={Number.isNaN(lines[0].produced)?'':lines[0].produced} onChange={e=>{touch();setLines(rows=>rows.map(l=>({...l,produced:e.target.value===''?NaN:Number(e.target.value)})));}}/>:<div className="mt-2 space-y-2">{lines.map(line=><label key={line.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/15 px-3 py-2"><span className="min-w-0 text-xs text-white/70">{line.label}<span className="mt-0.5 block text-white/40">Ordered: {line.ordered}</span></span><input aria-label={`Quantity produced: ${line.label}`} type="number" min="0" step="1" required className="w-24 shrink-0 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm" value={Number.isNaN(line.produced)?'':line.produced} onChange={e=>{touch();setLines(rows=>rows.map(l=>l.id===line.id?{...l,produced:e.target.value===''?NaN:Number(e.target.value)}:l));}}/></label>)}<p className="text-right text-xs text-white/55">Total produced: {total} units</p></div>}
    {discrepancy&&<p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">One or more produced quantities differ from the order. Explain each difference in Production Issues. This does not prevent review.</p>}
   </section>
   <section><h3 className="text-sm font-semibold">Were there any production issues? <span className="text-red-400">*</span></h3><div className="mt-3 flex flex-wrap gap-3">{[{value:false,label:'No issues'},{value:true,label:'Yes, there were issues'}].map(choice=><label key={choice.label} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75"><input type="radio" name="production-issues" checked={discrepancy?choice.value:issues===choice.value} disabled={discrepancy&&!choice.value} className="accent-[#CC2D24]" onChange={()=>{touch();setIssues(choice.value);}}/>{choice.label}</label>)}</div>
    {(issues||discrepancy)&&<label className="mt-3 block text-sm font-medium">Describe the Production Issues<textarea required maxLength={6000} rows={3} className={input} value={description} onChange={e=>{touch();setDescription(e.target.value);}} placeholder="Explain any defects, incorrect measurements, printing problems, damaged garments, quantity shortages or other production issues."/></label>}
   </section>
   <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-sm text-white/65">Additional Information (Optional)</summary><div className="mt-3 space-y-3"><label className="block text-xs text-white/60">Measurement information<textarea className={input} rows={3} maxLength={10000} value={measurement} onChange={e=>{touch();setMeasurement(e.target.value);}} placeholder="Any measurements or additional observations you would like to share."/></label><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs"><ImagePlus className="h-4 w-4"/>Add supporting files<input type="file" multiple className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>{addFiles(Array.from(e.target.files||[]),'support');e.target.value='';}}/></label>
    {supports.map(item=><div key={item.key} className="space-y-1"><div className="flex items-center justify-between gap-2 text-xs text-white/60"><span className="break-all">{item.record?.file_name||item.file?.name}{item.status==='uploading'?' · Uploading…':''}</span><div className="flex gap-2">{item.status==='error'&&<button type="button" className="text-red-300" onClick={()=>{setItems(rows=>rows.map(i=>i.key===item.key?{...i,status:'uploading'}:i));void upload(item.file!,'support',item.key);}}>Retry</button>}<button type="button" disabled={item.status==='uploading'} aria-label={`Remove ${item.record?.file_name||item.file?.name}`} onClick={()=>void remove(item)}><X className="h-4 w-4"/></button></div></div>{item.error&&<p role="alert" className="text-xs text-red-300">{item.error}</p>}</div>)}</div></details>
   <label className="flex cursor-pointer items-start gap-3 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/75"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#CC2D24]"/><span>{confirmation}</span></label>
  </fieldset>
  {error&&<p role="alert" className="rounded-lg border border-red-400/20 p-3 text-sm text-red-300">{error}</p>}
  <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={submitting||uploading>0||!confirmed} className="min-h-11 rounded-xl bg-[#CC2D24] px-5 py-3 text-sm font-semibold text-white hover:bg-[#b92820] disabled:opacity-40">{submitting?'Submitting…':initial?.submitted_at||(initial?.report_version||0)>1?'Resubmit for Review':'Submit for Quality Review'}</button><span className="text-xs text-white/40" role="status">{uploading?`${uploading} upload${uploading===1?'':'s'} in progress`:saveState}</span></div>
  {preview&&<QcPhotoGallery photos={preview.photos} previewUrls={preview.urls} startAt={preview.index} hideThumbnails onClose={()=>setPreview(null)}/>}
 </form>;
}
