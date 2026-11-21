import {Group,Lock} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {groupDesignLayers,groupLayersIssue} from '../../../lib/designGroups';
import {StudioRange} from './StudioControls';
import {inkOf,inkPatch,isInkable,patchSelection,sharedValue} from '../artwork-engine/state/sharedProperties';

/**
 * Multi-selection inspector (Artwork plan C.2 / R6): edit what the selection shares — colour, opacity — in one go.
 * Duplicate, align, distribute and delete live in the context toolbar next to the selection.
 */
export function ArtworkSelectionPanel({elements,ids,onChange,onSelect,onSelection}:{elements:DesignElement[];ids:string[];onChange:(elements:DesignElement[],id?:string)=>void;onSelect:(id:string|null)=>void;onSelection:(ids:string[])=>void}){
 const chosen=elements.filter(e=>ids.includes(e.id)),issue=groupLayersIssue(elements,ids),finish=(next:DesignElement[],ids:string[]=[])=>{onChange(next,ids[0]);onSelection(ids);onSelect(ids[0]??null)};
 const inkable=chosen.filter(isInkable),ink=sharedValue(inkable,inkOf),opacity=sharedValue(chosen,e=>e.opacity??100),locked=chosen.length>0&&chosen.every(e=>e.locked);
 const keep=(next:DesignElement[])=>onChange(next,ids[0]);
 return <section className="cx-multi-panel" aria-label={`${chosen.length} objects selected`}>
  {inkable.length>0&&<div className="cx-multi-panel__row">
   <span>Colour</span>
   <label className="cx-multi-panel__ink" title={ink?ink.toUpperCase():'Mixed colours'} style={{background:ink??'conic-gradient(#f2994a,#eb5757,#9b51e0,#2f80ed,#27ae60,#f2c94c,#f2994a)'}}>
    <input type="color" aria-label="Colour for all selected" value={ink&&/^#[0-9a-f]{6}$/i.test(ink)?ink:'#171717'} onChange={event=>keep(patchSelection(elements,inkable.map(e=>e.id),e=>inkPatch(e,event.target.value)))}/>
   </label>
   <small>{ink?ink.toUpperCase():'Mixed'}</small>
  </div>}
  <StudioRange label={opacity===null?'Opacity · mixed':'Opacity'} value={opacity??100} onChange={value=>keep(patchSelection(elements,ids,{opacity:value}))}/>
  <button className="studio-outline-action cx-multi-panel__group" disabled={Boolean(issue)} title={issue??'Keep elements editable and transform them together'} onClick={()=>{const id=crypto.randomUUID();finish(groupDesignLayers(elements,ids,id),[id])}}><Group size={16}/>Group<span>Ctrl / ⌘ G</span></button>{issue&&<small>{issue}</small>}
  <button className="studio-outline-action" onClick={()=>keep(elements.map(e=>ids.includes(e.id)?{...e,locked:!locked}:e))}><Lock size={15}/>{locked?'Unlock all':'Lock all'}</button>
  <button className="studio-outline-action cx-multi-panel__clear" onClick={()=>{onSelection([]);onSelect(null)}}>Clear selection</button>
 </section>;
}
