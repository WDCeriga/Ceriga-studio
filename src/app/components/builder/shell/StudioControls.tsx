import { SliderValueInput } from '../SliderValueInput';
import {createContext,useContext,useEffect,useRef,useState,useId,type ReactNode,type CSSProperties} from 'react';
import { ChevronDown } from 'lucide-react';
import { PaintInput } from '../PrintStudioColorPopover';
// Session-only UI memory survives an embedded inspector closing without touching product data.
const inspectorDisclosureMemory=new Map<string,boolean>();
export const StudioDisclosureContext=createContext<{key:string;values:Map<string,boolean>}>({key:'',values:new Map()});
export function StudioDisclosureScope({scope,children}:{scope:string;children:ReactNode}){const values=inspectorDisclosureMemory;return <StudioDisclosureContext.Provider value={{key:scope,values}}>{children}</StudioDisclosureContext.Provider>}
export function StudioRange({label,value,onChange,min=0,max=100,unit='%',step=1}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:string;step?:number}) {
 const id=useId();
 return <div className="studio-range"><div className="studio-range-heading"><label htmlFor={id}>{label}</label><SliderValueInput label={label} value={value} onChange={onChange} min={min} max={max} step={step} unit={unit}/></div><input id={id} aria-label={label} type="range" style={{'--range-fill':`${Math.max(0,Math.min(100,(value-min)/(max-min)*100))}%`} as CSSProperties} min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/></div>;
}
export function StudioFold({title,hint,children,open=false,value,rowHeight}:{title:string;hint?:string;children:ReactNode;open?:boolean;value?:ReactNode;rowHeight?:number}) {
 const disclosure=useContext(StudioDisclosureContext),key=disclosure.key+'/'+title;
 const [expanded,setExpanded]=useState(()=>disclosure.values.get(key)??open);
 useEffect(()=>setExpanded(disclosure.values.get(key)??open),[key]);
 return <details className="studio-fold" open={expanded} onToggle={event=>{if(event.target===event.currentTarget&&event.currentTarget.open!==expanded){setExpanded(event.currentTarget.open);disclosure.values.set(key,event.currentTarget.open);if(disclosure.values.size>1500)disclosure.values.delete(disclosure.values.keys().next().value!)}}}><summary style={rowHeight?{minHeight:rowHeight,height:rowHeight,padding:'8px 0'}:undefined}><span>{title}{hint&&<small>{hint}</small>}</span>{value!==undefined&&<span className="material-caption" style={{marginLeft:'auto',maxWidth:'58%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11,fontWeight:400}}>{value}</span>}<ChevronDown size={15}/></summary>{expanded&&<div><StudioDisclosureContext.Provider value={{...disclosure,key}}>{children}</StudioDisclosureContext.Provider></div>}</details>;
}
export function StudioPaint({label,value,onChange,allowGradients=true,colourLibrary=true,onReference}:{label:string;value:string;onChange:(s:string)=>void;allowGradients?:boolean;colourLibrary?:boolean;onReference?:(reference:string,hex?:string)=>void}) {return <div className="studio-paint"><PaintInput colourLibrary={colourLibrary} onReference={onReference} value={value} allowGradients={allowGradients} onChange={event=>onChange(event.target.value)} className="studio-paint-swatch"/><span>{label}<small>{value.startsWith('#')?value.toUpperCase():'Gradient'}</small></span></div>}
export function StudioNumber({label,value,onChange,min=0,max=2000,unit='px',step=.1,disabled=false}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:string;step?:number;disabled?:boolean}) {
 const format=(n:number)=>String(Number(n.toFixed(['mm','cm','in'].includes(unit)?1:Math.min(6,String(step).split('.')[1]?.length??0))));
 const cancelled=useRef(false);const [draft,setDraft]=useState(format(value));useEffect(()=>setDraft(format(value)),[value,step,unit]);
 const commit=()=>{if(cancelled.current){cancelled.current=false;return}const n=Number(draft);if(draft.trim()&&Number.isFinite(n)){const next=Math.max(min,Math.min(max,n));setDraft(format(next));if(next!==value)onChange(next)}else setDraft(format(value))};
 return <label className="studio-number"><span>{label}</span><div><input disabled={disabled} aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){cancelled.current=true;setDraft(format(value));e.currentTarget.blur()}}}/><small>{unit}</small></div></label>;
}
