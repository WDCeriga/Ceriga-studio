import {useState,type ReactNode} from 'react';
import {LabelArtwork} from '../LabelArtwork';
import {LABEL_FOLDS,type GarmentLabel} from '../../../data/garmentLabels';
export function LabelFinishPreview({label,garment}:{label:GarmentLabel;garment?:()=>ReactNode}) {
  const [open,setOpen]=useState(false),[view,setView]=useState<'label'|'garment'>('label');
  return <details className="label-section label-finish-preview" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>Finished preview<small>{label.construction==='printed'?'Direct print':LABEL_FOLDS[label.fold]}</small></summary>{open&&<>
    {garment&&<div className="label-preview-tabs" role="group" aria-label="Label preview"><button type="button" aria-pressed={view==='label'} onClick={()=>setView('label')}>Label</button><button type="button" aria-pressed={view==='garment'} onClick={()=>setView('garment')}>On garment</button></div>}
    <div className="label-finish-art">{view==='garment'&&garment?garment():<svg viewBox={`0 0 ${label.widthMm} ${label.heightMm}`} role="img" aria-label="Current label with its construction and artwork"><LabelArtwork label={label}/></svg>}</div>
    <p className="material-caption">Live preview · changes appear here as you edit.</p>
  </>}</details>;
}
