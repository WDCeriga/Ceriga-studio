import {AdvancedColorPopover} from './PrintStudioColorPopover';
export function TrimColorFamilyPicker({label,value,onChange,onClear}:{label:string;value?:string;onChange:(hex:string)=>void;onClear?:()=>void}){
 return <div className="trim-colour-field"><AdvancedColorPopover value={value??'#FFFFFF'} onChange={onChange}><button type="button" className="trim-colour-trigger" aria-label={label}><i style={{background:value??'#FFFFFF'}}/><span>{label.replace(/ colour$/,'')}<small>{(value??'#FFFFFF').toUpperCase()}</small></span></button></AdvancedColorPopover>{onClear&&<button type="button" className="trim-colour-reset" aria-label={`Reset ${label.toLowerCase()}`} onClick={onClear}>Reset</button>}</div>;
}
