export function GarmentViewSwitch({value,onChange,label='Garment view'}:{value:'front'|'back';onChange:(side:'front'|'back')=>void;label?:string}) {
  return <div className="new-view-switch" role="group" aria-label={label}>{(['front','back'] as const).map(side=><button key={side} type="button" aria-pressed={value===side} onClick={()=>onChange(side)}>{side==='front'?'Front':'Back'}</button>)}</div>;
}
