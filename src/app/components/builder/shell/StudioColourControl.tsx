import {AdvancedColorPopover} from '../PrintStudioColorPopover';
export function StudioColourControl({title,value,onChange,compact=false,onOpen}:{title:string;value:string;onChange:(value:string)=>void;compact?:boolean;onOpen?:()=>void;material?:boolean}){
 return <AdvancedColorPopover value={value} onChange={onChange} onOpenChange={open=>{if(open)onOpen?.()}}><button type="button" className={compact?'panelling-colour-trigger':'studio-colour-control'} aria-label={title}><i style={{background:value}}/>{!compact&&<span>{title}<small>{value.toUpperCase()}</small></span>}</button></AdvancedColorPopover>;
}
