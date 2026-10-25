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
 return <div className="pattern-object-editor">
  <div className="pattern-editor-identity"><div className="pattern-editor-thumb"><PatternGraphic element={element}/></div><input aria-label="Pattern layer name" placeholder={definition?.label??'Pattern'} value={element.layerName??''} onChange={event=>update({layerName:event.target.value||undefined})}/><button aria-label={element.locked?'Unlock pattern':'Lock pattern'} onClick={()=>update({locked:!element.locked})}>{element.locked?<Lock size={16}/>:<Unlock size={16}/>}</button></div>
  <div className="pattern-editor-preview" role="img" aria-label={`Drag configured ${definition?.label??'pattern'} to another garment part`} draggable={!element.locked} onDragStart={event=>beginPatternDrag(event.dataTransfer,element.content,element)}><PatternGraphic element={element}/><span>{definition?.label??'Custom repeat'}</span></div>
  <p className="pattern-editor-tip">Changes preview on your garment. Drag this swatch to reuse the repeat.</p>
  <PatternControls element={element} onChange={update}/>
  <ArtworkPrintMethod element={element} update={update} initiallyOpen={false}/>
  {!element.patternTarget&&<fieldset disabled={element.locked}><StudioFold title="Artwork position & size" hint="Move or resize this pattern layer"><div className="pattern-size-grid">{(['width','height','x','y'] as const).map(key=><StudioNumber key={key} label={{width:'Width',height:'Height',x:'Position X',y:'Position Y'}[key]} value={element[key]} min={key==='width'||key==='height'?1:-2000} onChange={value=>update({[key]:value})}/>)}</div><StudioNumber label="Layer rotation" value={element.rotation} min={-360} max={360} unit="°" onChange={rotation=>update({rotation})}/></StudioFold></fieldset>}
 </div>;
}
