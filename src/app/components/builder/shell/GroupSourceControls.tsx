import {refreshBoolean} from '../../../lib/booleanArtwork';
import {useState} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {shapeToEditablePath} from '../../../lib/shapeGeometry';
import {StudioFold,StudioNumber,StudioPaint} from './StudioControls';
import {MaterialSelect} from './MaterialSelect';
import {ClothingFontPicker} from './ClothingFontPicker';
import {fontIdentity} from '../../../lib/workspaceFonts';
export function GroupSourceControls({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}){
 const studio=usePrintsStudio(),[path,setPath]=useState<string[]>([]),[selected,setSelected]=useState('');let parent=element,scale=1;
 for(const id of path){const next=parent.children?.find(child=>child.id===id);if(!next)break;scale*=Math.min(parent.width/(parent.groupSourceWidth??parent.width),parent.height/(parent.groupSourceHeight??parent.height));parent=next;}
 scale*=Math.min(parent.width/(parent.groupSourceWidth??parent.width),parent.height/(parent.groupSourceHeight??parent.height));
 const child=parent.children?.find(item=>item.id===selected)??parent.children?.[0],units=studio.unitsPerCm/Math.max(.0001,scale);
 if(!child)return null;
 const change=(patch:Partial<DesignElement>)=>{const visit=(root:DesignElement):DesignElement=>refreshBoolean({...root,children:root.children?.map(item=>item.id===child.id?refreshBoolean({...item,...patch}):item.children?visit(item):item)});update({children:visit(element).children});};
 return <><div className="path-workflow-actions">{path.length>0&&<button onClick={()=>{setPath(path.slice(0,-1));setSelected('');studio.setLogoRegionEditing(null)}}>Back to parent group</button>}</div><label className="studio-field">Source<MaterialSelect aria-label="Group source" value={child.id} onChange={event=>{setSelected(event.target.value);studio.setLogoRegionEditing(null)}}>{parent.children?.map((item,index)=><option key={item.id} value={item.id}>{item.layerName??item.type+' '+(index+1)}</option>)}</MaterialSelect></label>
 <label className="studio-field">Name<input aria-label="Group source name" value={child.layerName??''} onChange={event=>change({layerName:event.target.value})}/></label>
 <fieldset disabled={child.locked}><div className="studio-two-columns">{(['x','y','width','height'] as const).map(key=><StudioNumber key={key} label={`Source ${key}`} unit="cm" min={key==='width'||key==='height'?.01:-200} max={200} value={child[key]/units} onChange={value=>change({[key]:value*units})}/>)}</div><StudioNumber label="Source rotation" unit="°" min={-360} max={360} value={child.rotation} onChange={rotation=>change({rotation})}/>
 {child.type==='text'&&<><label className="studio-field">Text<textarea aria-label="Group source text" style={{resize:'none'}} value={child.content} onChange={event=>change({content:event.target.value})}/></label><ClothingFontPicker value={child.fontFamily??'Inter'} onChange={fontFamily=>change({fontFamily,...fontIdentity(fontFamily)})}/></>}
 {child.type==='shape'&&<><StudioPaint label="Source fill" value={child.shapeFillColor??child.color??'#171717'} onChange={shapeFillColor=>change({shapeFillColor,shapeFilled:true})}/><button className="studio-outline-action" disabled={!!child.booleanOperation} title={child.booleanOperation?'Edit the source shapes to update this live boolean':undefined} onClick={()=>{if(child.booleanOperation)return;if(!child.shapePath)change({shapePath:shapeToEditablePath(child),shapeCornerRadius:0});studio.setTool('select');studio.setPathEditingId(null);studio.setLogoRegionEditing({rootId:element.id,regionId:child.id})}}>Edit source points on canvas</button></>}
 {child.children&&<button className="studio-outline-action" onClick={()=>{setPath([...path,child.id]);setSelected('');studio.setLogoRegionEditing(null)}}>Edit its shapes</button>}
 </fieldset><label className="studio-switch">Show source<input type="checkbox" checked={!child.hidden} onChange={event=>change({hidden:!event.target.checked})}/></label><label className="studio-switch">Lock source<input type="checkbox" checked={child.locked??false} onChange={event=>change({locked:event.target.checked})}/></label>
 </>;
}
