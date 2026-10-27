import {StudioFold,StudioRange} from './StudioControls';
export function TorsoCropControl({value=0,onChange}:{value?:number;onChange:(value:number)=>void}){
 return <StudioFold title="Body length" hint={value?`${value}% shorter`:'Original length'}><div className="typography-segments" role="group" aria-label="Body length presets">{[[0,'Original'],[14,'Cropped'],[24,'Extra cropped']].map(([n,label])=><button key={n} aria-pressed={value===n} onClick={()=>onChange(Number(n))}>{label}</button>)}</div><StudioRange label="Shorten body" value={value} min={0} max={30} step={1} onChange={onChange}/><p className="typography-help">Shortens the body and moves its hem. Sleeves, shoulders and collar keep their length and position.</p></StudioFold>;
}
