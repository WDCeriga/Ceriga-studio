import {useEffect,useState} from 'react';
import {Lock,Unlock} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {PatternControls} from '../printsStudio/PatternControls';
import {PatternGraphic} from '../printsStudio/PatternGraphic';
import {beginPatternDrag} from '../printsStudio/studioAssets';
import {patternDefinition} from '../../../lib/patternCatalog';
import {ArtworkPrintMethod} from './ArtworkPrintMethod';
import {StudioFold,StudioNumber} from './StudioControls';
import './patterns-studio.css';

export function PatternObjectEditor({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}) {
 const definition=patternDefinition(element.content);
 const [reference,setReference]=useState(element.patternReferenceSize);
 useEffect(()=>{
  const zone=document.querySelector('[data-print-design-zone]');if(!zone)return;
  const refresh=()=>{const node=Array.from(zone.querySelectorAll<HTMLElement>('[data-print-id]')).find(node=>node.dataset.printId===element.id);setReference(node?.dataset.patternReferenceSize?Number(node.dataset.patternReferenceSize):element.patternReferenceSize);};
  refresh();const observer=new MutationObserver(refresh);observer.observe(zone,{subtree:true,childList:true,attributes:true,attributeFilter:['data-pattern-reference-size']});return()=>observer.disconnect();
 },[element.id,element.patternReferenceSize]);
 const previewElement={...element,patternReferenceSize:reference};
 return <div className="pattern-object-editor">
  <div className="pattern-editor-identity"><div className="pattern-editor-thumb"><PatternGraphic element={previewElement}/></div><input aria-label="Pattern layer name" placeholder={definition?.label??'Pattern'} value={element.layerName??''} onChange={event=>update({layerName:event.target.value||undefined})}/><button aria-label={element.locked?'Unlock pattern':'Lock pattern'} onClick={()=>update({locked:!element.locked})}>{element.locked?<Lock size={16}/>:<Unlock size={16}/>}</button></div>
  <div className="pattern-editor-preview" role="img" aria-label={`Drag configured ${definition?.label??'pattern'} to another garment part`} draggable={!element.locked} onDragStart={event=>beginPatternDrag(event.dataTransfer,element.content,element)}><PatternGraphic element={previewElement}/><span>{definition?.label??'Custom repeat'}</span></div>
  <p className="pattern-editor-tip">Edit the repeat on your garment. Scale stays consistent when you apply it to another part.</p>
  <StudioFold title="Coverage" hint={element.patternTarget?'Assigned garment part':'Free pattern area'}><button className="studio-outline-action" disabled={element.locked} onClick={()=>{const zone=document.querySelector<HTMLElement>('[data-print-design-zone]');if(!zone)return;update({patternCoverage:'garment',printMethod:'Fabric Print',patternTarget:undefined,x:zone.clientWidth/2,y:zone.clientHeight/2,width:zone.clientWidth,height:zone.clientHeight,rotation:0,patternKeepNeckPlain:true})}}>Apply across whole garment</button>{!element.patternTarget&&<label className="studio-switch"><span>Keep collar plain</span><input type="checkbox" disabled={element.locked} checked={element.patternKeepNeckPlain??false} onChange={e=>update({patternKeepNeckPlain:e.target.checked})}/></label>}</StudioFold>
  <PatternControls element={previewElement} onChange={update}/>
  <ArtworkPrintMethod element={element} update={update} initiallyOpen={false}/>
  {!element.patternTarget&&<fieldset disabled={element.locked}><StudioFold title="Artwork position & size" hint="Move or resize this pattern layer"><div className="pattern-size-grid">{(['width','height','x','y'] as const).map(key=><StudioNumber key={key} label={{width:'Width',height:'Height',x:'Position X',y:'Position Y'}[key]} value={element[key]} min={key==='width'||key==='height'?1:-2000} onChange={value=>update({[key]:value})}/>)}</div><StudioNumber label="Layer rotation" value={element.rotation} min={-360} max={360} unit="°" onChange={rotation=>update({rotation})}/></StudioFold></fieldset>}
 </div>;
}
