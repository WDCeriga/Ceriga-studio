import {ArrowUpRight, RotateCcw} from 'lucide-react';
import {SliderValueInput} from '../SliderValueInput';
import './hem-construction.css';
import './preset-construction.css';

export function ConstructionDimensions({label,cm,defaultCm,maxCm,unit='cm',onChange,onMeasurements}: {
 label:string; cm:number; defaultCm:number; maxCm:number; unit?:'cm'|'in';
 onChange:(cm:number)=>void; onMeasurements:()=>void;
}) {
 const factor=unit==='in'?2.54:1;
 const display=(value:number)=>Number((value/factor).toFixed(unit==='in'?2:1));
 return <details open className="material-section-disclosure hem-construction-editor preset-construction-dimensions">
  <summary>Dimensions <small>{display(cm)} {unit}</small></summary>
  <label className="hem-dimension-label">{label}<SliderValueInput label={label} value={display(cm)} min={display(1)} max={display(maxCm)} step={unit==='in'?.01:.1} unit={unit} onChange={value=>onChange(Math.max(1,Math.min(maxCm,value*factor)))}/></label>
  <div className="hem-depth-slider">
   <div className="hem-depth-track" aria-hidden="true"/>
   {Array.from({length:9},(_,i)=><div className="hem-depth-tick" key={i} style={{left:(i*12.5)+'%'}} aria-hidden="true"><i/><span>{display(1+(maxCm-1)*i/8)}</span></div>)}
   <input type="range" aria-label={label} min={1} max={maxCm} step={.1} value={cm} onChange={event=>onChange(event.currentTarget.valueAsNumber)}/>
  </div>
  <button className="hem-text-action" type="button" onClick={()=>onChange(defaultCm)}><RotateCcw size={12}/>Reset dimensions</button>
  <button className="hem-text-action" type="button" onClick={onMeasurements}>Review garment measurements <ArrowUpRight size={12}/></button>
 </details>;
}
