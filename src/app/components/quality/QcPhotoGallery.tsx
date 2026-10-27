import{privateAssetUrl}from '../../lib/privateAssetUrls';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { qcFileUrl } from '../../lib/qcReportFiles';
import type { ReportEvidence } from '../../data/qualityControl';
export async function evidenceUrl(path:string){return privateAssetUrl('qc-evidence',path,60);}
export function QcPhotoGallery({photos,previewUrls,startAt,onClose,hideThumbnails=false}:{photos:ReportEvidence[];previewUrls?:Record<string,string>;startAt?:number;onClose?:()=>void;hideThumbnails?:boolean}) {
 const [sources,setSources]=useState<Record<string,string>>(previewUrls||{}),[error,setError]=useState(''),[active,setActive]=useState(startAt??-1),[zoom,setZoom]=useState(1);
 const signature=photos.map(p=>p.path).join('|');
 useEffect(()=>{let current=true;const load=()=>{void Promise.all(photos.map(async p=>[p.id,previewUrls?.[p.id]||await evidenceUrl(p.path)] as const)).then(rows=>{if(current){setSources(Object.fromEntries(rows));setError('');}}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Photos could not load');});};load();const timer=window.setInterval(load,45000);return()=>{current=false;clearInterval(timer);};},[signature]);
 const move=(offset:number)=>{setActive(index=>(index+offset+photos.length)%photos.length);setZoom(1);};
 return <>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  {!hideThumbnails&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map((photo,index)=><button type="button" key={photo.id} onClick={()=>{setActive(index);setZoom(1);}} className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left" aria-label={`Enlarge production photo ${index+1}`}>
   {sources[photo.id]?<img src={sources[photo.id]} alt={`Production photo ${index+1}`} className="aspect-[4/3] w-full object-cover transition group-hover:opacity-80" loading="lazy"/>:<div className="flex aspect-[4/3] items-center justify-center text-xs text-white/40">Loading photo…</div>}
  </button>)}</div>}
  <Dialog open={active>=0&&active<photos.length} onOpenChange={open=>{if(!open){setActive(-1);onClose?.();}}}>
   <DialogContent className="max-h-[95dvh] w-[calc(100%-1rem)] border-[#252528] bg-[#111113] p-3 text-white sm:max-w-5xl sm:p-5" onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}}}>
    <DialogTitle className="pr-8 text-sm">Production photo {active+1} of {photos.length}</DialogTitle><DialogDescription className="sr-only">Use Previous and Next to navigate, and Zoom in or Zoom out to inspect garment details.</DialogDescription>
    <div className="flex items-center justify-between gap-2"><div className="flex gap-2"><button className="rounded-lg border border-white/15 p-2" aria-label="Previous photo" disabled={photos.length<2} onClick={()=>move(-1)}><ChevronLeft className="h-4 w-4"/></button><button className="rounded-lg border border-white/15 p-2" aria-label="Next photo" disabled={photos.length<2} onClick={()=>move(1)}><ChevronRight className="h-4 w-4"/></button></div><div className="flex items-center gap-2"><button className="rounded-lg border border-white/15 p-2 disabled:opacity-40" aria-label="Zoom out" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-0.5))}><ZoomOut className="h-4 w-4"/></button><span className="text-xs text-white/50">{zoom*100}%</span><button className="rounded-lg border border-white/15 p-2 disabled:opacity-40" aria-label="Zoom in" disabled={zoom>=4} onClick={()=>setZoom(v=>Math.min(4,v+0.5))}><ZoomIn className="h-4 w-4"/></button></div></div>
    <div className="max-h-[70dvh] overflow-auto rounded-lg bg-black/30">{photos[active]&&sources[photos[active].id]&&<img src={sources[photos[active].id]} alt={`Enlarged production photo ${active+1}`} style={{width:`${zoom*100}%`,maxWidth:'none'}} className="h-auto"/>}</div>
   </DialogContent>
  </Dialog>
 </>;
}
