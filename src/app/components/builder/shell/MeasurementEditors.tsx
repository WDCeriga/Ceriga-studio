import {useRef,useState} from 'react';
import {formatMeasurementDisplay,parseMeasurementInput,type MeasurementUnit} from '../../../lib/measurements';
import {formatToleranceMagnitude} from '../../../lib/measurementTolerances';
import {type MeasurementGuideId} from '../measurementGuides';
import {NEW_MEASUREMENT_LABELS} from './NewMeasurementOverlay';
/** Keep uncommitted text local so Backspace, decimals and replacement never fight formatting. */
export function MeasurementValueField({id,size,value,unit,onFocus,onCommit,ariaLabel,tolerance=false}:{id:MeasurementGuideId;size:string;value:string;unit:MeasurementUnit;onFocus:()=>void;onCommit:(value:string)=>void;ariaLabel?:string;tolerance?:boolean}){
 const [draft,setDraft]=useState<string|null>(null);const [error,setError]=useState('');const cancelled=useRef(false);
 const display=(raw:string)=>tolerance?formatToleranceMagnitude(raw,unit):formatMeasurementDisplay(raw,unit);
 const commit=()=>{if(cancelled.current){cancelled.current=false;setDraft(null);setError('');return}if(draft===null)return;const raw=draft.trim().replace(',','.');if(raw!==''&&(!/^\d+(?:\.\d*)?$/.test(raw)&&!/^\.\d+$/.test(raw)||!Number.isFinite(Number(raw)))){setError(tolerance?'Enter a non-negative tolerance.':'Enter a valid measurement.');return}onCommit(parseMeasurementInput(raw,unit));setDraft(null);setError('')};
 const visibleValue=draft??display(value);const showUnit=!tolerance||visibleValue.trim()!=='';
 return <div className="measurement-value-editor"><label className="new-measure-value">{tolerance&&showUnit&&<span className="tolerance-sign" aria-hidden="true">±</span>}<input type="text" inputMode="decimal" aria-label={ariaLabel??NEW_MEASUREMENT_LABELS.find(m=>m.id===id)?.label+' '+size.toUpperCase()+' in '+unit} placeholder={tolerance?'Not set':undefined} aria-invalid={Boolean(error)} value={visibleValue} onFocus={()=>{setDraft(display(value));onFocus()}} onChange={e=>{setDraft(e.target.value);setError('')}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){cancelled.current=true;setDraft(null);setError('');e.currentTarget.blur()}}}/>{showUnit&&<span>{unit}</span>}</label>{error&&<small role="alert">{error}</small>}</div>
}
export function NewSegmentedControl({
  values,
  value,
  onChange,
  label
}: {
  values: readonly string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return <div className="builder-segment" role="group" aria-label={label}>{values.map(v => <button key={v} aria-label={label === 'Units' ? v === 'cm' ? 'Centimetres' : 'Inches' : v} aria-pressed={value === v} onClick={() => onChange(v)}>{v}</button>)}</div>;
}
