import * as Menu from '@radix-ui/react-dropdown-menu';
import {MoreHorizontal,ListChecks,GripVertical} from 'lucide-react';
import {SHAPE_ASSETS} from '../printsStudio/studioAssets';
import './studio-layers.css';
import { duplicateStudioArtwork } from '../../../lib/studioArtwork';
import { useEffect, useRef, useState } from 'react';
import { Layers, ChevronDown, Eye, EyeOff, Lock, Unlock, Trash2, ArrowUp, ArrowDown, Group, Ungroup, Merge, Copy } from 'lucide-react';
import type { DesignElement } from '../PrintStudioEditor';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import { groupDesignLayers, groupLayersIssue, ungroupDesignLayer, ungroupLayersIssue } from '../../../lib/designGroups';
import { mergeLayersIssue, replaceMergedLayers } from '../../../lib/mergeDesignLayers';
import { StudioLayerThumb } from './StudioObjectPanel';
export function StudioLayerDock({elements,side,selectedId,onSelect,onChange,full=false}:{full?:boolean;elements:DesignElement[];side:'front'|'back';selectedId:string|null;onSelect:(id:string|null)=>void;onChange:(els:DesignElement[],id?:string)=>void}) {
 const latest=useRef(elements);latest.current=elements;const studio=usePrintsStudio();const [open,setOpen]=useState(false),[multiple,setMultiple]=useState(false),[checked,setChecked]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[drag,setDrag]=useState<string|null>(null);
 useEffect(()=>{if(full)setOpen(true)},[full]);
 const layers=elements.filter(el=>(el.side??'front')===side).slice().reverse();const ids=checked.filter(id=>layers.some(el=>el.id===id));
 const patch=(id:string,p:Partial<DesignElement>)=>onChange(elements.map(el=>el.id===id?{...el,...p}:el));
 const move=(id:string,direction:number)=>{const i=elements.findIndex(el=>el.id===id);const order=elements.filter(el=>(el.side??'front')===side);const n=order.indexOf(elements[i])+direction;if(n<0||n>=order.length)return;const j=elements.findIndex(el=>el.id===order[n].id);const next=[...elements];[next[i],next[j]]=[next[j],next[i]];onChange(next)};
 const merge=async()=>{const renderer=studio.layerRenderer.current;if(!renderer||mergeLayersIssue(elements,ids))return;setBusy(true);setError('');try{const snapshot=elements;const artwork=await renderer(ids),id=crypto.randomUUID();if(latest.current!==snapshot)throw new Error('Artwork changed during merging. Select the layers and try again.');onChange(replaceMergedLayers(elements,ids,artwork,id),id);setChecked([])}catch(e){setError(e instanceof Error?e.message:'Could not merge layers.')}finally{setBusy(false)}};
 const name=(el:DesignElement)=>el.layerName||(el.type==='text'?el.content.trim()||'Empty text':el.type==='shape'?SHAPE_ASSETS.find(asset=>asset.id===el.content)?.label||'Shape':el.type==='image'?'Uploaded artwork':el.type==='customArea'?'Custom shape':el.type.charAt(0).toUpperCase()+el.type.slice(1));
 const detail=(el:DesignElement)=>el.type==='group'?`${el.children?.length??0} layers`:el.hidden?'Hidden':el.locked?'Locked':el.type==='shape'?'Shape':el.type==='customArea'?'Custom shape':el.type==='image'?'Image':el.type==='drawing'?'Drawing':el.type==='text'?'Text':'Artwork';
 return <section className="studio-layer-dock studio-layers-v2" data-full={full}>
 <div className="layer-dock-title"><button className="studio-layer-heading" aria-expanded={open} onClick={()=>setOpen(!open)}><Layers size={15}/><strong>Layers</strong><small>{layers.length}</small><span>{side==='front'?'Front':'Back'}</span><ChevronDown size={14} style={{transform:open?'none':'rotate(-90deg)'}}/></button>{open&&layers.length>1&&<button className="layer-multiselect" aria-label="Select multiple layers" aria-pressed={multiple} title="Select multiple layers" onClick={()=>{setMultiple(!multiple);setChecked([])}}><ListChecks size={16}/></button>}</div>
 {open&&<><div className="studio-layer-list">{!layers.length?<div className="studio-layer-empty"><Layers size={22}/><strong>No layers yet</strong><span>Add a shape, text or artwork to get started.</span></div>:layers.map((el,index)=>{const label=name(el);return <div className="studio-layer-row" key={el.id} data-selected={el.id===selectedId} data-hidden={el.hidden} draggable={!busy} onDragStart={e=>{setDrag(el.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!drag||drag===el.id)return;const a=elements.findIndex(item=>item.id===drag),b=elements.findIndex(item=>item.id===el.id);if(a<0||b<0)return;const next=[...elements];const [item]=next.splice(a,1);next.splice(b,0,item);onChange(next);setDrag(null)}}>
 {multiple?<input aria-label={`Include ${label} in selection`} type="checkbox" checked={ids.includes(el.id)} onChange={e=>setChecked(e.target.checked?[...ids,el.id]:ids.filter(id=>id!==el.id))}/>:<GripVertical className="layer-drag-grip" size={12} aria-hidden="true"/>}
 <button className="studio-layer-select" aria-label={`Select ${label}`} aria-pressed={el.id===selectedId} onClick={()=>{studio.setTool('select');onSelect(el.id)}}><StudioLayerThumb element={el}/><span><strong>{label}</strong><small>{detail(el)}</small></span></button>
 <button className="layer-visibility" aria-label={`${el.hidden?'Show':'Hide'} ${label}`} title={el.hidden?'Show layer':'Hide layer'} onClick={()=>patch(el.id,{hidden:!el.hidden})}>{el.hidden?<EyeOff size={15}/>:<Eye size={15}/>}</button>
 <Menu.Root><Menu.Trigger asChild><button className="layer-more" aria-label={`Actions for ${label}`} title="Layer actions"><MoreHorizontal size={17}/></button></Menu.Trigger><Menu.Portal><Menu.Content className="layer-actions-menu" side="top" align="end" sideOffset={6} collisionPadding={12}>
 <Menu.Label>{label}</Menu.Label>
 <Menu.Item onSelect={()=>{const copy=duplicateStudioArtwork(el);copy.layerName=`${label} copy`;onChange([...elements,copy],copy.id)}}><Copy size={14}/>Duplicate</Menu.Item>
 <Menu.Item disabled={index===0} onSelect={()=>move(el.id,1)}><ArrowUp size={14}/>Bring forward</Menu.Item><Menu.Item disabled={index===layers.length-1} onSelect={()=>move(el.id,-1)}><ArrowDown size={14}/>Send backward</Menu.Item>
 <Menu.Item onSelect={()=>patch(el.id,{locked:!el.locked})}>{el.locked?<Unlock size={14}/>:<Lock size={14}/>}{el.locked?'Unlock':'Lock'}</Menu.Item>
 <Menu.Item disabled={el.id==='print-drawing-layer'||el.id==='print-distress-layer'} onSelect={()=>{patch(el.id,{side:side==='front'?'back':'front'});if(selectedId===el.id)onSelect(null)}}><Layers size={14}/>Move to {side==='front'?'back':'front'}</Menu.Item>
 {el.type==='group'&&<Menu.Item disabled={!!ungroupLayersIssue(el)} onSelect={()=>{onChange(ungroupDesignLayer(elements,el.id,()=>crypto.randomUUID()));if(selectedId===el.id)onSelect(null)}}><Ungroup size={14}/>Ungroup</Menu.Item>}
 <Menu.Separator/><Menu.Item className="layer-delete" onSelect={()=>{onChange(elements.filter(item=>item.id!==el.id));setChecked(ids.filter(id=>id!==el.id));if(selectedId===el.id)onSelect(null)}}><Trash2 size={14}/>Delete layer</Menu.Item>
 </Menu.Content></Menu.Portal></Menu.Root></div>})}</div>
 {multiple&&<div className="studio-layer-batch"><span>{ids.length} selected</span><button disabled={ids.length<2||!!groupLayersIssue(elements,ids)} title={groupLayersIssue(elements,ids)??'Group editable layers'} onClick={()=>{const id=crypto.randomUUID();onChange(groupDesignLayers(elements,ids,id),id);setChecked([]);setMultiple(false)}}><Group size={14}/>Group</button><button disabled={ids.length<2||busy||!!mergeLayersIssue(elements,ids)} title={mergeLayersIssue(elements,ids)??'Merge into one image'} onClick={()=>void merge()}><Merge size={14}/>{busy?'Merging…':'Merge'}</button></div>}{error&&<p role="alert">{error}</p>}</>}
 </section>;
}
