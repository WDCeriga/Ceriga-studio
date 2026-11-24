import {sampleCanvasColor} from '../../../lib/canvasEyedropper';
import {canEditPoints,withEditablePoints} from '../../../lib/pointEditing';
import {loadFontLibrary} from '../printsStudio/designLibrary';
import {useEffect,useRef} from 'react';
import {MousePointer2,MousePointer,PenTool,Pencil,Square,Type,Eraser,Pipette,Layers,FlipHorizontal2,Hand} from 'lucide-react';
import {toast} from 'sonner';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {shapeToEditablePath} from '../../../lib/shapeGeometry';
import {PaintInput} from '../PrintStudioColorPopover';
import {ArtworkHistoryControls} from './ArtworkHistoryControls';
import type {DrawHistory} from './DrawPaintStudio';
export function AddArtworkMenu({ onActivate }: { onActivate?: () => void }) {
  const workspace = useAssetWorkspaceContext();
  if (!workspace || workspace.project) return null;

  return <>
    <h2>Asset Studio</h2>
    <button type="button" className="asset-workspace-nav" disabled={!workspace.authReady || workspace.busy} onClick={() => {
      if (workspace.recovery) workspace.resume();
      else workspace.enter();
      onActivate?.();
    }}>
      <Layers size={19} strokeWidth={1.7} aria-hidden="true" />
      <span>{workspace.recovery ? 'Resume draft' : 'Open Asset Studio'}</span>
    </button>
  </>;
}
export function UnifiedArtworkTools({elements,selectedId,onChange,onSelect,history,pan}:{elements:DesignElement[];selectedId:string|null;onChange:(elements:DesignElement[],id?:string)=>void;onSelect:(id:string|null)=>void;history?:DrawHistory;pan?:{active:boolean;onChange:(active:boolean)=>void}}){
 // Undo/redo sit in the Builder top bar on garments; the Asset Workspace replaces that bar, so it keeps them on the rail.
 const assetProject=useAssetWorkspaceContext()?.project;
 const picker=useRef<AbortController|null>(null);useEffect(()=>()=>picker.current?.abort(),[]);const studio=usePrintsStudio(),selected=elements.find(element=>element.id===selectedId),editable=selected&&!selected.locked;
 const select=()=>{pan?.onChange(false);studio.setTool('select');studio.setPathEditingId(null);studio.setLogoRegionEditing(null);studio.setCropEditingId(null);studio.setWarpEditingId(null);studio.setDistortEditingId(null);studio.setAdjustLettersId(null);};
 const direct=()=>{if(!editable||!selected)return;select();if(selected.type==='customArea'){studio.setTool('customAreaEdit');return;}if(!canEditPoints(selected,Boolean(assetProject)))return;const snapshot=elements;void withEditablePoints(selected,loadFontLibrary()).then(next=>{if(!next)return;if(next!==selected)onChange(snapshot.map(element=>element.id===next.id?next:element),next.id);studio.setPathEditingId(next.id);}).catch(error=>toast.error(error instanceof Error?error.message:'Could not show points for this artwork.'));};
 const tool=(kind:'pen'|'pencil'|'shape'|'type'|'eraser')=>{select();if(kind==='pen'||kind==='pencil'||kind==='shape'){studio.setPanel('shapes');studio.setPenTargetId(null);studio.setSelectionIds([]);if(kind==='shape')studio.setLiveShape('rect');studio.setTool(kind==='pen'?'shapePolygon':kind==='pencil'?'shapePencil':'shapeLive')}else{studio.setPanel(kind==='type'?'text':'brush');studio.setTool(kind==='type'?'textPlace':'eraser')}onSelect(null);};
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="listbox"]'))return;if(event.key==='Escape'){event.preventDefault();/* Escape steps back: from a tool to Select, then clears the selection (plan §6.5). */if(studio.tool==='select'&&!studio.pathEditingId&&(selected||studio.selectionIds.length)){studio.setSelectionIds([]);onSelect(null);}else select()}else if(event.key.toLowerCase()==='a'&&editable){event.preventDefault();direct()}else if(event.key.toLowerCase()==='t'){event.preventDefault();tool('type')}else if(event.key.toLowerCase()==='b'){event.preventDefault();tool('pencil')}else if(event.key.toLowerCase()==='s'){event.preventDefault();tool('shape')}else if(event.key.toLowerCase()==='e'){event.preventDefault();tool('eraser')}else if(event.key.toLowerCase()==='i'){event.preventDefault();document.querySelector<HTMLButtonElement>('[aria-label="Eyedropper"]')?.click()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[studio.tool,studio.pathEditingId,selected,elements]);
 const paint=(color:string)=>{studio.setColor(color);if(!editable||selected.type==='image')return;onChange(elements.map(element=>element.id!==selected.id?element:element.type==='text'?{...element,color,textAppearance:element.textAppearance?.map(item=>item.type==='fill'?{...item,colour:color,preserveCharacterColours:false}:item)}:element.type==='shape'?{...element,color,...(element.shapeFilled?{shapeFillColor:color}:{shapeStrokeColor:color})}:{...element,color}));};
 return <div className="shape-canvas-tools artwork-canvas-tools" role="toolbar" aria-label="Artwork tools" onKeyDownCapture={event=>{if((event.key==='Backspace'||event.key==='Delete')&&event.target instanceof HTMLButtonElement)event.target.blur();}}>
 {pan&&<button type="button" aria-label="Pan canvas" title="Hand (H · hold Space)" aria-pressed={pan.active} onClick={()=>{if(!pan.active)select();pan.onChange(!pan.active);}}><Hand size={18}/><span>Hand</span></button>}
 <button aria-label="Select artwork" title="Select (V)" aria-pressed={!pan?.active&&studio.tool==='select'&&!studio.pathEditingId} onClick={select}><MousePointer2 size={18}/><span>Select</span></button>
 <button aria-label="Direct select" title="Edit points (A)" disabled={!editable||!(canEditPoints(selected,Boolean(assetProject))||selected.type==='customArea')} aria-pressed={Boolean(studio.pathEditingId)||studio.tool==='customAreaEdit'} onClick={direct}><MousePointer size={18}/><span>Points</span></button>
 <i/>
 <button aria-label="Pen tool" title="Pen (P)" aria-pressed={studio.tool==='shapePolygon'} onClick={()=>tool('pen')}><PenTool size={18}/><span>Pen</span></button>
 <button aria-label="Pencil tool" title="Pencil (B)" aria-pressed={studio.tool==='shapePencil'} onClick={()=>tool('pencil')}><Pencil size={18}/><span>Pencil</span></button>
 <button aria-label="Shape tool" title="Shape (S)" aria-pressed={studio.tool==='shapeLive'} onClick={()=>tool('shape')}><Square size={18}/><span>Shape</span></button>
 <button aria-label="Type tool" title="Type (T)" aria-pressed={studio.tool==='textPlace'} onClick={()=>tool('type')}><Type size={18}/><span>Type</span></button>
 <button aria-label="Eraser tool" title="Eraser (E)" aria-pressed={studio.tool==='eraser'} onClick={()=>tool('eraser')}><Eraser size={18}/><span>Eraser</span></button>
 <button type="button" aria-label="Mirror new artwork" title="Mirror while drawing" aria-pressed={studio.symmetry} onClick={()=>studio.patchBrush({symmetry:!studio.symmetry})}><FlipHorizontal2 size={18}/><span>Mirror</span></button>
 <i/><button aria-label="Eyedropper" title="Eyedropper (I)" onClick={async()=>{picker.current?.abort();const controller=new AbortController();picker.current=controller;try{paint(await sampleCanvasColor(controller.signal))}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))toast.error(error instanceof Error?error.message:'Could not sample this colour.')}}}><Pipette size={18}/><span>Pick</span></button>
 <div className="shape-tool-paint"><PaintInput ariaLabel="Artwork ink colour" value={selected?.shapeFilled?selected.shapeFillColor??selected.color??studio.color:selected?.shapeStrokeColor??selected?.color??studio.color} onChange={event=>paint(event.target.value)}/><span>Colour</span></div>
 <ArtworkHistoryControls history={assetProject?history:undefined}/>
 </div>;
}
