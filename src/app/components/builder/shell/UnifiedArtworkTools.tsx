import {sampleCanvasColor} from '../../../lib/canvasEyedropper';
import {useEffect,useRef} from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {MousePointer2,MousePointer,PenTool,Pencil,Square,Type,Eraser,Pipette,Plus,Upload,Library,Brush} from 'lucide-react';
import {toast} from 'sonner';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {useArtwork} from '../printsStudio/ArtworkContext';
import {shapeToEditablePath} from '../../../lib/shapeGeometry';
import {PaintInput} from '../PrintStudioColorPopover';
import {ArtworkHistoryControls} from './ArtworkHistoryControls';
import type {DrawHistory} from './DrawPaintStudio';
export function AddArtworkMenu({onActivate}:{onActivate?:()=>void}){
 const studio=usePrintsStudio(),workspace=useAssetWorkspaceContext(),artwork=useArtwork();
 const start=(kind:'upload'|'text'|'shapes'|'brush'|'library')=>{studio.setPanel(kind);if(kind==='upload')studio.imageUploader.current?.();if(kind==='text'||kind==='shapes'||kind==='brush'){if(workspace?.project)workspace.select(null);else artwork?.onSelectArtwork(null);studio.setTool(kind==='text'?'textPlace':kind==='shapes'?'shapeLive':'brush')}onActivate?.();};
 return <div className="asset-workspace-entry"><Menu.Root><Menu.Trigger className="studio-outline-action" style={{width:'100%'}}><Plus size={16}/>Add artwork</Menu.Trigger><Menu.Portal><Menu.Content className="layer-actions-menu" side="right" align="end" sideOffset={6}>{([{id:'upload',label:'Upload',icon:Upload},{id:'text',label:'Text',icon:Type},{id:'shapes',label:'Shape',icon:Square},{id:'brush',label:'Sketch',icon:Brush},{id:'library',label:'From library',icon:Library}] as const).map(({id,label,icon:Icon})=><Menu.Item key={id} onSelect={()=>start(id)}><Icon size={15}/>{label}</Menu.Item>)}{workspace&&!workspace.project&&<><Menu.Separator/><Menu.Item disabled={!workspace.authReady||workspace.busy} onSelect={()=>{workspace.enter();onActivate?.()}}>Create reusable asset</Menu.Item>{workspace.recovery&&<Menu.Item onSelect={()=>{workspace.resume();onActivate?.()}}>Resume asset draft</Menu.Item>}</>}</Menu.Content></Menu.Portal></Menu.Root></div>;
}
export function UnifiedArtworkTools({elements,selectedId,onChange,onSelect,history}:{elements:DesignElement[];selectedId:string|null;onChange:(elements:DesignElement[],id?:string)=>void;onSelect:(id:string|null)=>void;history?:DrawHistory}){
 const picker=useRef<AbortController|null>(null);useEffect(()=>()=>picker.current?.abort(),[]);const studio=usePrintsStudio(),selected=elements.find(element=>element.id===selectedId),editable=selected&&!selected.locked;
 const select=()=>{studio.setTool('select');studio.setPathEditingId(null);studio.setLogoRegionEditing(null);studio.setCropEditingId(null);studio.setWarpEditingId(null);studio.setDistortEditingId(null);studio.setAdjustLettersId(null);};
 const direct=()=>{if(!editable)return;select();if(selected.type==='shape'&&!selected.booleanOperation){if(!selected.shapePath)onChange(elements.map(element=>element.id===selected.id?{...element,shapePath:shapeToEditablePath(element),shapeCornerRadius:0,shapeParameters:undefined}:element));studio.setPathEditingId(selected.id)}else if(selected.type==='customArea')studio.setTool('customAreaEdit');};
 const tool=(kind:'pen'|'pencil'|'shape'|'type'|'eraser')=>{select();if(kind==='pen'||kind==='pencil'||kind==='shape'){studio.setPanel('shapes');studio.setPenTargetId(null);studio.setSelectionIds([]);if(kind==='shape')studio.setLiveShape('rect');studio.setTool(kind==='pen'?'shapePolygon':kind==='pencil'?'shapePencil':'shapeLive')}else{studio.setPanel(kind==='type'?'text':'brush');studio.setTool(kind==='type'?'textPlace':'eraser')}onSelect(null);};
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="listbox"]'))return;if(event.key==='Escape'){event.preventDefault();select()}else if(event.key.toLowerCase()==='a'&&editable){event.preventDefault();direct()}else if(event.key.toLowerCase()==='t'){event.preventDefault();tool('type')}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[studio.tool,studio.pathEditingId,selected,elements]);
 const paint=(color:string)=>{studio.setColor(color);if(!editable||selected.type==='image')return;onChange(elements.map(element=>element.id!==selected.id?element:element.type==='text'?{...element,color,textAppearance:element.textAppearance?.map(item=>item.type==='fill'?{...item,colour:color,preserveCharacterColours:false}:item)}:element.type==='shape'?{...element,color,...(element.shapeFilled?{shapeFillColor:color}:{shapeStrokeColor:color})}:{...element,color}));};
 return <div className="shape-canvas-tools artwork-canvas-tools" role="toolbar" aria-label="Artwork tools">
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
