import { SliderValueInput } from '../SliderValueInput';
import {useEffect,useRef,useState,useId,type ReactNode,type CSSProperties} from 'react';
import { ChevronDown } from 'lucide-react';
import { PaintInput } from '../PrintStudioColorPopover';
export function StudioRange({label,value,onChange,min=0,max=100,unit='%',step=1}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:string;step?:number}) {
 const id=useId();
 return <div className="studio-range"><div className="studio-range-heading"><label htmlFor={id}>{label}</label><SliderValueInput label={label} value={value} onChange={onChange} min={min} max={max} step={step} unit={unit}/></div><input id={id} aria-label={label} type="range" style={{'--range-fill':`${Math.max(0,Math.min(100,(value-min)/(max-min)*100))}%`} as CSSProperties} min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/></div>;
}
export function StudioFold({title,hint,children,open=false}:{title:string;hint?:string;children:ReactNode;open?:boolean}) {
 const [expanded,setExpanded]=useState(open);
 return <details className="studio-fold" open={expanded} onToggle={event=>{if(event.currentTarget.open!==expanded)setExpanded(event.currentTarget.open)}}><summary><span>{title}{hint&&<small>{hint}</small>}</span><ChevronDown size={15}/></summary>{expanded&&<div>{children}</div>}</details>;
}
export function StudioPaint({label,value,onChange,allowGradients=true}:{label:string;value:string;onChange:(s:string)=>void;allowGradients?:boolean}) {return <div className="studio-paint"><PaintInput value={value} allowGradients={allowGradients} onChange={event=>onChange(event.target.value)} className="studio-paint-swatch"/><span>{label}<small>{value.startsWith('#')?value.toUpperCase():'Gradient'}</small></span></div>}
export function StudioNumber({label,value,onChange,min=0,max=2000,unit='px',step=.1}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:string;step?:number}) {
 const format=(n:number)=>String(Number(n.toFixed(Math.min(6,String(step).split('.')[1]?.length??0))));
 const cancelled=useRef(false);const [draft,setDraft]=useState(format(value));useEffect(()=>setDraft(format(value)),[value,step]);
 const commit=()=>{if(cancelled.current){cancelled.current=false;return}const n=Number(draft);if(draft.trim()&&Number.isFinite(n)){const next=Math.max(min,Math.min(max,n));setDraft(String(next));if(next!==value)onChange(next)}else setDraft(format(value))};
 return <label className="studio-number"><span>{label}</span><div><input aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){cancelled.current=true;setDraft(format(value));e.currentTarget.blur()}}}/><small>{unit}</small></div></label>;
}
