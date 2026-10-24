import {useEffect,useRef,useState} from 'react';
import './shell/slider-value-input.css';

/** Draft input allows clearing/typing negative values before committing to the slider. */
export function SliderValueInput({label,value,onChange,min=0,max=100,step=1,unit=''}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number;unit?:string}){
 const cancelled=useRef(false);const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{if(cancelled.current){cancelled.current=false;return}const number=Number(draft);if(!draft.trim()||!Number.isFinite(number)){setDraft(String(value));return}const bounded=Math.max(min,Math.min(max,number));const snapped=step>0?Number((min+Math.round((bounded-min)/step)*step).toFixed(6)):bounded;const next=Math.max(min,Math.min(max,snapped));setDraft(String(next));if(next!==value)onChange(next)};
 return <span className="studio-slider-value"><input aria-label={`${label} value`} title={`Enter ${label.toLowerCase()}`} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} onChange={event=>setDraft(event.target.value)} onFocus={event=>event.currentTarget.select()} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelled.current=true;setDraft(String(value));event.currentTarget.blur()}}}/>{unit&&<small>{unit}</small>}</span>;
}
