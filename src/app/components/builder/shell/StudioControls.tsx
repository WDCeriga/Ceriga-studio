import {useEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import { ChevronDown } from 'lucide-react';
import { PaintInput } from '../PrintStudioColorPopover';
export function StudioRange({label,value,onChange,min=0,max=100,unit='%',step=1}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:string;step?:number}) {
 return <label className="studio-range"><span>{label}<output>{Number(value.toFixed(1))}<small>{unit}</small></output></span><input aria-label={label} type="range" style={{'--range-fill':`${Math.max(0,Math.min(100,(value-min)/(max-min)*100))}%`} as CSSProperties} min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/></label>;
}
export function StudioFold({title,hint,children,open=false}:{title:string;hint?:string;children:ReactNode;open?:boolean}) {
 const [expanded,setExpanded]=useState(open);
 return <details className="studio-fold" open={expanded} onToggle={event=>{if(event.currentTarget.open!==expanded)setExpanded(event.currentTarget.open)}}><summary><span>{title}{hint&&<small>{hint}</small>}</span><ChevronDown size={15}/></summary>{expanded&&<div>{children}</div>}</details>;
}
export function StudioPaint({label,value,onChange}:{label:string;value:string;onChange:(s:string)=>void}) {return <div className="studio-paint"><PaintInput value={value} allowGradients onChange={event=>onChange(event.target.value)} className="studio-paint-swatch"/><span>{label}<small>{value.startsWith('#')?value.toUpperCase():'Gradient'}</small></span></div>}
export function StudioNumber({label,value,onChange,min=0,max=2000,unit='px'}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:string}) {
 const cancelled=useRef(false);const [draft,setDraft]=useState(String(Number(value.toFixed(1))));useEffect(()=>setDraft(String(Number(value.toFixed(1)))),[value]);
 const commit=()=>{if(cancelled.current){cancelled.current=false;return}const n=Number(draft);if(draft.trim()&&Number.isFinite(n)){const next=Math.max(min,Math.min(max,n));setDraft(String(next));if(next!==value)onChange(next)}else setDraft(String(Number(value.toFixed(1))))};
 return <label className="studio-number"><span>{label}</span><div><input aria-label={label} type="number" min={min} max={max} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){cancelled.current=true;setDraft(String(Number(value.toFixed(1))));e.currentTarget.blur()}}}/><small>{unit}</small></div></label>;
}
