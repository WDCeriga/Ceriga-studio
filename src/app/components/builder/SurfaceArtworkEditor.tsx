import {useEffect,useRef,useState,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {PrintsDesignPreview,type DesignElement} from './PrintStudioEditor';
import {PrintsStudioProvider,usePrintsStudio} from './printsStudio/PrintsStudioContext';
import {ArtworkProvider} from './printsStudio/ArtworkContext';
import {AssetWorkspaceProvider} from './printsStudio/AssetWorkspace';
import {PrintDesignInspector,PrintDesignNavigation} from './shell/PrintDesignStudio';
import {UnifiedArtworkTools} from './shell/UnifiedArtworkTools';
import type {DrawHistory} from './shell/DrawPaintStudio';
import {editSurfaceDocument} from '../../lib/surfaceDocumentEditing';
import {surfaceFingerprint,type SurfaceArtwork} from '../../lib/artworkSurface';
import './surface-artwork-editor.css';
export type SurfaceEditorProps={value:SurfaceArtwork;title:string;history:DrawHistory;onCommit:(value:SurfaceArtwork)=>void;onPreview?:(value:SurfaceArtwork|null)=>void;preview?:(value:SurfaceArtwork)=>ReactNode;onClose:()=>void};
/** Generic host: the engine knows only one Surface and its native ArtworkDocument. */
export function SurfaceArtworkEditor(props:SurfaceEditorProps){return <PrintsStudioProvider workspaceId={props.value.surface.id}><AssetWorkspaceProvider value={null}><SurfaceEditor {...props}/></AssetWorkspaceProvider></PrintsStudioProvider>}
function SurfaceEditor({value,title,history,onCommit,onPreview,preview,onClose}:SurfaceEditorProps){
 const studio=usePrintsStudio(),[draft,setDraft]=useState(value),[selected,setSelected]=useState<string|null>(null),transient=useRef(false),gesture=useRef(false),pending=useRef<SurfaceArtwork|null>(null),commitRef=useRef(onCommit);commitRef.current=onCommit;
 const finish=()=>{gesture.current=false;const value=pending.current;pending.current=null;if(value){transient.current=false;commitRef.current(value);onPreview?.(null)}};
 useEffect(()=>{const finishPointer=()=>queueMicrotask(()=>{if(gesture.current&&(!(document.activeElement instanceof HTMLInputElement)||document.activeElement.type==='range')&&document.activeElement?.tagName!=='TEXTAREA')finish()});window.addEventListener('pointerup',finishPointer);return()=>window.removeEventListener('pointerup',finishPointer)},[]);
 useEffect(()=>{setDraft(value);transient.current=false},[value]);
 useEffect(()=>{studio.setUnitsPerCm(value.surface.units==='mm'?10:1);studio.setTool('select');return()=>onPreview?.(null)},[value.surface.id]);
 const change=(elements:DesignElement[],id?:string,options?:{transient?:boolean})=>{
  const bounded=elements.map(e=>draft.document.elements.some(old=>old.id===e.id)?e:{...e,x:value.surface.width/2,y:value.surface.height/2,width:Math.min(e.width,value.surface.width*.6),height:Math.min(e.height,value.surface.height*.6),fontSize:e.fontSize?Math.min(e.fontSize,value.surface.height*.3):undefined,frameId:draft.document.elements.find(item=>item.id===selected)?.frameId});
  const next={...draft,document:editSurfaceDocument(value,bounded)};setDraft(next);if(id!==undefined)setSelected(id);
  if(options?.transient||gesture.current){if(gesture.current)pending.current=next;transient.current=true;onPreview?.(next);return;}
  transient.current=false;onPreview?.(null);if(surfaceFingerprint(next.document.elements)!==surfaceFingerprint(value.document.elements))onCommit(next);
 };
 const live=(elements:DesignElement[]|null)=>{if(elements){const next={...value,document:editSurfaceDocument(value,elements)};onPreview?.(next)}else if(!transient.current)onPreview?.(null)};
 return <div className="surface-artwork-editor builder-context ceriga-builder-shell" role="dialog" aria-modal="true" aria-label={title} data-shared-surface-editor={value.surface.kind}>
 <header><strong>{title}</strong><span>{value.surface.width} × {value.surface.height} {value.surface.units}</span><button onClick={onClose} aria-label="Close shared editor"><X size={18}/></button></header>
 <ArtworkProvider sourceElements={draft.document.elements} overrides={{}} onOverrides={()=>{}} onSelectArtwork={setSelected}><nav><PrintDesignNavigation/></nav><main>
 <div className="surface-artwork-editor-board"><PrintsDesignPreview editable={!value.document.readOnly} assetMode canvasToolbar={false} canvasLockedBadges={false} canvasSize={{width:value.surface.width,height:value.surface.height}} garmentPreview={null} elements={draft.document.elements} onChange={change} selectedLayerId={selected} onSelectedLayerIdChange={setSelected} onLiveChange={live}/><UnifiedArtworkTools elements={draft.document.elements} selectedId={selected} onSelect={setSelected} onChange={change} history={history}/></div>{preview&&<div className="surface-artwork-editor-preview" aria-label="Live surface preview">{preview(draft)}</div>}
 </main><aside aria-disabled={value.document.readOnly} onPointerDownCapture={event=>{if((event.target as Element).closest('input[type="range"],[role="slider"]'))gesture.current=true}} onFocusCapture={event=>{if((event.target as Element).matches('input,textarea'))gesture.current=true}} onBlurCapture={finish}><PrintDesignInspector elements={draft.document.elements} onChange={change} selectedId={selected} onSelect={setSelected} side="front"/></aside></ArtworkProvider></div>;
}
