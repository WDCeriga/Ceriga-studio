import {sampleCanvasColor} from '../../../lib/canvasEyedropper';
import {useEffect,useRef} from 'react';
import {MousePointer2,MousePointer,PenTool,Pencil,Square,Type,Eraser,Pipette,Layers,ArrowUpRight} from 'lucide-react';
import {toast} from 'sonner';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {shapeToEditablePath} from '../../../lib/shapeGeometry';
import {PaintInput} from '../PrintStudioColorPopover';
import {ArtworkHistoryControls} from './ArtworkHistoryControls';
import type {DrawHistory} from './DrawPaintStudio';
export function AddArtworkMenu({onActivate}:{onActivate?:()=>void}){
 const workspace=useAssetWorkspaceContext();
 if(!workspace||workspace.project)return null;
 return <div className="asset-workspace-entry"><button className="asset-workspace-launch" disabled={!workspace.authReady||workspace.busy} onClick={()=>{workspace.recovery?workspace.resume():workspace.enter();onActivate?.();}}><Layers size={17} strokeWidth={1.6}/><span>Asset workspace</span><ArrowUpRight size={14} strokeWidth={1.6}/></button></div>;
}
export function UnifiedArtworkTools({elements,selectedId,onChange,onSelect,history}:{elements:DesignElement[];selectedId:string|null;onChange:(elements:DesignElement[],id?:string)=>void;onSelect:(id:string|null)=>void;history?:DrawHistory}){
 const picker=useRef<AbortController|null>(null);useEffect(()=>()=>picker.current?.abort(),[]);const studio=usePrintsStudio(),selected=elements.find(element=>element.id===selectedId),editable=selected&&!selected.locked;
 const select=()=>{studio.setTool('select');studio.setPathEditingId(null);studio.setLogoRegionEditing(null);studio.setCropEditingId(null);studio.setWarpEditingId(null);studio.setDistortEditingId(null);studio.setAdjustLettersId(null);};
 const direct=()=>{if(!editable)return;select();if(selected.type==='shape'&&!selected.booleanOperation){if(!selected.shapePath)onChange(elements.map(element=>element.id===selected.id?{...element,shapePath:shapeToEditablePath(element),shapeCornerRadius:0,shapeParameters:undefined}:element));studio.setPathEditingId(selected.id)}else if(selected.type==='customArea')studio.setTool('customAreaEdit');};
 const tool=(kind:'pen'|'pencil'|'shape'|'type'|'eraser')=>{select();if(kind==='pen'||kind==='pencil'||kind==='shape'){studio.setPanel('shapes');studio.setPenTargetId(null);studio.setSelectionIds([]);if(kind==='shape')studio.setLiveShape('rect');studio.setTool(kind==='pen'?'shapePolygon':kind==='pencil'?'shapePencil':'shapeLive')}else{studio.setPanel(kind==='type'?'text':'brush');studio.setTool(kind==='type'?'textPlace':'eraser')}onSelect(null);};
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="listbox"]'))return;if(event.key==='Escape'){event.preventDefault();select()}else if(event.key.toLowerCase()==='a'&&editable){event.preventDefault();direct()}else if(event.key.toLowerCase()==='t'){event.preventDefault();tool('type')}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[studio.tool,studio.pathEditingId,selected,elements]);
 const paint=(color:string)=>{studio.setColor(color);if(!editable||selected.type==='image')return;onChange(elements.map(element=>element.id!==selected.id?element:element.type==='text'?{...element,color,textAppearance:element.textAppearance?.map(item=>item.type==='fill'?{...item,colour:color,preserveCharacterColours:false}:item)}:element.type==='shape'?{...element,color,...(element.shapeFilled?{shapeFillColor:color}:{shapeStrokeColor:color})}:{...element,color}));};
 return <div className="shape-canvas-tools artwork-canvas-tools" role="toolbar" aria-label="Artwork tools" onKeyDownCapture={event=>{if((event.key==='Backspace'||event.key==='Delete')&&event.target instanceof HTMLButtonElement)event.target.blur();}}>
 <button aria-label="Select artwork" title="Select (V)" aria-pressed={studio.tool==='select'&&!studio.pathEditingId} onClick={select}><MousePointer2 size={18}/><span>Select</span></button>
 <button aria-label="Direct select" title="Edit points (A)" disabled={!editable||!['shape','customArea'].includes(selected.type)||!!selected.booleanOperation} aria-pressed={Boolean(studio.pathEditingId)||studio.tool==='customAreaEdit'} onClick={direct}><MousePointer size={18}/><span>Points</span></button>
 <i/>
 <button aria-label="Pen tool" title="Pen (P)" aria-pressed={studio.tool==='shapePolygon'} onClick={()=>tool('pen')}><PenTool size={18}/><span>Pen</span></button>
 <button aria-label="Pencil tool" title="Pencil" aria-pressed={studio.tool==='shapePencil'} onClick={()=>tool('pencil')}><Pencil size={18}/><span>Pencil</span></button>
 <button aria-label="Shape tool" title="Draw a shape" aria-pressed={studio.tool==='shapeLive'} onClick={()=>tool('shape')}><Square size={18}/><span>Shape</span></button>
 <button aria-label="Type tool" title="Type (T)" aria-pressed={studio.tool==='textPlace'} onClick={()=>tool('type')}><Type size={18}/><span>Type</span></button>
 <button aria-label="Eraser tool" title="Eraser (E)" aria-pressed={studio.tool==='eraser'} onClick={()=>tool('eraser')}><Eraser size={18}/><span>Eraser</span></button>
 <i/><button aria-label="Eyedropper" title="Sample a colour" onClick={async()=>{picker.current?.abort();const controller=new AbortController();picker.current=controller;try{paint(await sampleCanvasColor(controller.signal))}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))toast.error(error instanceof Error?error.message:'Could not sample this colour.')}}}><Pipette size={18}/><span>Pick</span></button>
 <div className="shape-tool-paint"><PaintInput ariaLabel="Artwork ink colour" value={selected?.shapeFilled?selected.shapeFillColor??selected.color??studio.color:selected?.shapeStrokeColor??selected?.color??studio.color} onChange={event=>paint(event.target.value)}/><span>Colour</span></div>
 <ArtworkHistoryControls history={history}/>
 </div>;
}
