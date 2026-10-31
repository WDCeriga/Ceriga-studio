import {restoreArtworkSource} from '../../lib/artworkColourSlots';
import {resolveSurfaceColours} from '../../lib/surfaceColourLinks';
import {SurfaceAddMenu} from './shell/SurfaceAddMenu';
import {createPortal} from 'react-dom';
import {ArtworkSurfaceContext} from './printsStudio/ArtworkSurfaceContext';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
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
const EMPTY_SURFACE_OVERRIDES={};
export const ProductArtworkHistoryContext=createContext<DrawHistory|undefined>(undefined);
export type SurfaceEditorProps={embedded?:boolean;controlsHost?:HTMLElement|null;onSelection?:(id:string|null)=>void;value:SurfaceArtwork;title:string;history:DrawHistory;onCommit:(value:SurfaceArtwork)=>void;onPreview?:(value:SurfaceArtwork|null)=>void;preview?:(value:SurfaceArtwork)=>ReactNode;onClose:()=>void};
/** Generic host: the engine knows only one Surface and its native ArtworkDocument. */
export function SurfaceArtworkEditor(props:SurfaceEditorProps){return <PrintsStudioProvider workspaceId={props.value.surface.id}><AssetWorkspaceProvider value={null}><SurfaceEditor {...props}/></AssetWorkspaceProvider></PrintsStudioProvider>}
function SurfaceEditor({value,title,history,onCommit,onPreview,preview,onClose,embedded,controlsHost,onSelection}:SurfaceEditorProps){
 const studio=usePrintsStudio(),[draft,setDraft]=useState(value),[selected,setSelected]=useState<string|null>(null),transient=useRef(false),gesture=useRef(false),pending=useRef<SurfaceArtwork|null>(null),commitRef=useRef(onCommit);commitRef.current=onCommit;
 const rendered=useMemo(()=>draft.document.elements.map(element=>resolveSurfaceColours(draft.surface,element)),[draft.document.elements,draft.surface]);
 const finish=()=>{gesture.current=false;const value=pending.current;pending.current=null;if(value){transient.current=false;commitRef.current(value);onPreview?.(null)}};
 useEffect(()=>{const finishPointer=()=>queueMicrotask(()=>{if(gesture.current&&(!(document.activeElement instanceof HTMLInputElement)||document.activeElement.type==='range')&&document.activeElement?.tagName!=='TEXTAREA')finish()});window.addEventListener('pointerup',finishPointer);return()=>window.removeEventListener('pointerup',finishPointer)},[]);
 useEffect(()=>{setDraft(value);transient.current=false},[value]);
 useEffect(()=>{studio.setUnitsPerCm(value.surface.units==='mm'?10:1);studio.setTool('select');return()=>onPreview?.(null)},[value.surface.id]);
 const change=(elements:DesignElement[],id?:string,options?:{transient?:boolean})=>{
  for(const frame of draft.document.frames){if(frame.leaderId&&draft.document.elements.some(element=>element.id===frame.leaderId)&&!elements.some(element=>element.id===frame.leaderId)&&frame.artworks.some(id=>id!==frame.leaderId&&elements.some(element=>element.id===id))){if(!window.confirm('Delete this section and its contents?'))return;elements=elements.filter(element=>!frame.artworks.includes(element.id));}}
  elements=elements.map(element=>{const source=draft.document.elements.find(old=>old.id===element.id),display=rendered.find(old=>old.id===element.id);return JSON.stringify(source?.surfaceColourLinks)!==JSON.stringify(element.surfaceColourLinks)?element:restoreArtworkSource(element,source,display)});
  const bounded=elements.map(e=>draft.document.elements.some(old=>old.id===e.id)||e.width<=value.surface.width*2&&e.height<=value.surface.height*2&&e.x<=value.surface.width*2&&e.y<=value.surface.height*2?e:{...e,x:value.surface.width/2,y:value.surface.height/2,width:Math.min(e.width,value.surface.width*.6),height:Math.min(e.height,value.surface.height*.6),fontSize:e.fontSize?Math.min(e.fontSize,value.surface.height*.3):undefined,frameId:draft.document.elements.find(item=>item.id===selected)?.frameId});
  const next={...draft,document:editSurfaceDocument(value,bounded)};setDraft(next);if(id!==undefined)setSelected(id);
  if(options?.transient||gesture.current){if(gesture.current)pending.current=next;transient.current=true;onPreview?.(next);return;}
  transient.current=false;onPreview?.(null);if(surfaceFingerprint(next.document.elements)!==surfaceFingerprint(value.document.elements))onCommit(next);
 };
 const select=(id:string|null)=>{setSelected(id);onSelection?.(id)};
 const live=(elements:DesignElement[]|null)=>{if(elements){const next={...value,document:editSurfaceDocument(value,elements)};onPreview?.(next)}else if(!transient.current)onPreview?.(null)};
 if(embedded){const inspector=<aside aria-disabled={value.document.readOnly} onPointerDownCapture={event=>{if((event.target as Element).closest('input[type="range"],[role="slider"]'))gesture.current=true}} onFocusCapture={event=>{if((event.target as Element).matches('input,textarea'))gesture.current=true}} onBlurCapture={finish}><PrintDesignInspector elements={rendered} onChange={change} selectedId={selected} onSelect={select} side="front"/></aside>;return <ArtworkProvider sourceElements={draft.document.elements} overrides={EMPTY_SURFACE_OVERRIDES} onOverrides={()=>{}} onSelectArtwork={select}><ArtworkSurfaceContext.Provider value={draft}><div className="relative h-full w-full" data-shared-surface-editor={value.surface.kind}><PrintsDesignPreview editable={!value.document.readOnly} assetMode canvasToolbar={false} canvasLockedBadges={false} canvasSize={{width:value.surface.width,height:value.surface.height}} elements={rendered} onChange={change} selectedLayerId={selected} onSelectedLayerIdChange={select} onLiveChange={live}/><div className="label-canvas-actions" style={{position:'absolute',top:12,right:12,zIndex:60}}><SurfaceAddMenu value={draft} onCommit={next=>{setDraft(next);onCommit(next)}} onSelect={select}/></div><UnifiedArtworkTools elements={rendered} selectedId={selected} onSelect={select} onChange={change} history={history}/>{controlsHost&&(selected||studio.tool!=='select')&&createPortal(inspector,controlsHost)}</div></ArtworkSurfaceContext.Provider></ArtworkProvider>;}
 return <div className="surface-artwork-editor builder-context ceriga-builder-shell" role="dialog" aria-modal="true" aria-label={title} data-shared-surface-editor={value.surface.kind}>
 <header><strong>{title}</strong><span>{value.surface.width} × {value.surface.height} {value.surface.units}</span><button onClick={onClose} aria-label="Close shared editor"><X size={18}/></button></header>
 <ArtworkProvider sourceElements={draft.document.elements} overrides={EMPTY_SURFACE_OVERRIDES} onOverrides={()=>{}} onSelectArtwork={setSelected}><nav><PrintDesignNavigation/></nav><main>
 <ArtworkSurfaceContext.Provider value={draft}><div className="surface-artwork-editor-board"><PrintsDesignPreview editable={!value.document.readOnly} assetMode canvasToolbar={false} canvasLockedBadges={false} canvasSize={{width:value.surface.width,height:value.surface.height}} garmentPreview={null} elements={rendered} onChange={change} selectedLayerId={selected} onSelectedLayerIdChange={select} onLiveChange={live}/><div className="label-canvas-actions" style={{position:'absolute',top:12,right:12,zIndex:60}}><SurfaceAddMenu value={draft} onCommit={next=>{setDraft(next);onCommit(next)}} onSelect={select}/></div><UnifiedArtworkTools elements={rendered} selectedId={selected} onSelect={select} onChange={change} history={history}/></div>{preview&&<div className="surface-artwork-editor-preview" aria-label="Live surface preview">{preview(draft)}</div>}
 </ArtworkSurfaceContext.Provider></main><aside aria-disabled={value.document.readOnly} onPointerDownCapture={event=>{if((event.target as Element).closest('input[type="range"],[role="slider"]'))gesture.current=true}} onFocusCapture={event=>{if((event.target as Element).matches('input,textarea'))gesture.current=true}} onBlurCapture={finish}><PrintDesignInspector elements={rendered} onChange={change} selectedId={selected} onSelect={select} side="front"/></aside></ArtworkProvider></div>;
}

export function EmbeddedSurfaceArtworkEditor(props:Omit<SurfaceEditorProps,'history'|'onClose'>){const history=useContext(ProductArtworkHistoryContext);return <SurfaceArtworkEditor {...props} embedded history={history??{canUndo:false,canRedo:false,onUndo:()=>{},onRedo:()=>{}}} onClose={()=>{}}/>;}
