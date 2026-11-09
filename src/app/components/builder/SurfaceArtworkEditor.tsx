import {restoreArtworkSource} from '../../lib/artworkColourSlots';
import {resolveSurfaceColours} from '../../lib/surfaceColourLinks';
import {SurfaceAddMenu} from './shell/SurfaceAddMenu';
import {createPortal} from 'react-dom';
import {ArtworkSurfaceContext} from './printsStudio/ArtworkSurfaceContext';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {CanvasZoom} from './shell/CanvasZoom';
import {PrintsDesignPreview,type DesignElement} from './PrintStudioEditor';
import {PrintsStudioProvider,usePrintsStudio} from './printsStudio/PrintsStudioContext';
import {ArtworkProvider} from './printsStudio/ArtworkContext';
import {AssetWorkspaceProvider} from './printsStudio/AssetWorkspace';
import {PrintDesignInspector,PrintDesignNavigation} from './shell/PrintDesignStudio';
import {UnifiedArtworkTools} from './shell/UnifiedArtworkTools';
import {useArtworkNavigation} from './shell/useArtworkNavigation';
import type {DrawHistory} from './shell/DrawPaintStudio';
import {editSurfaceDocument} from '../../lib/surfaceDocumentEditing';
import {surfaceFingerprint,type SurfaceArtwork} from '../../lib/artworkSurface';
import './surface-artwork-editor.css';
const EMPTY_SURFACE_OVERRIDES={};
export const ProductArtworkHistoryContext=createContext<DrawHistory|undefined>(undefined);
export type SurfaceEditorProps={artboardBackground?:ReactNode;selectedId?:string|null;embedded?:boolean;controlsHost?:HTMLElement|null;onSelection?:(id:string|null)=>void;value:SurfaceArtwork;title:string;history:DrawHistory;onCommit:(value:SurfaceArtwork)=>void;onPreview?:(value:SurfaceArtwork|null)=>void;preview?:(value:SurfaceArtwork)=>ReactNode;onClose:()=>void};
/** Generic host: the engine knows only one Surface and its native ArtworkDocument. */
export function SurfaceArtworkEditor(props:SurfaceEditorProps){return <PrintsStudioProvider workspaceId={props.value.surface.id}><AssetWorkspaceProvider value={null}><SurfaceEditor {...props}/></AssetWorkspaceProvider></PrintsStudioProvider>}
function SurfaceEditor({artboardBackground,value,title,history,onCommit,onPreview,preview,onClose,embedded,controlsHost,onSelection,selectedId:externalSelected}:SurfaceEditorProps){
 const [zoom,setZoom]=useState(100);
 const [pan,setPan]=useState({x:0,y:0});
 const [panMode,setPanMode]=useState(false);
 const viewport=useRef<HTMLDivElement>(null);
 const studio=usePrintsStudio(),[draft,setDraft]=useState(value),[selected,setSelected]=useState<string|null>(null),transient=useRef(false),gesture=useRef(false),pending=useRef<SurfaceArtwork|null>(null),commitRef=useRef(onCommit);commitRef.current=onCommit;
 useEffect(()=>{if(externalSelected!==undefined)setSelected(externalSelected&&value.document.elements.some(e=>e.id===externalSelected)?externalSelected:null)},[externalSelected,value.document.elements]);
 const rendered=useMemo(()=>draft.document.elements.map(element=>resolveSurfaceColours(draft.surface,element)),[draft.document.elements,draft.surface]);
 const finish=()=>{gesture.current=false;const value=pending.current;pending.current=null;if(value){transient.current=false;commitRef.current(value);onPreview?.(null)}};
 useEffect(()=>{const finishPointer=()=>queueMicrotask(()=>{if(gesture.current&&(!(document.activeElement instanceof HTMLInputElement)||document.activeElement.type==='range')&&document.activeElement?.tagName!=='TEXTAREA')finish()});window.addEventListener('pointerup',finishPointer);return()=>window.removeEventListener('pointerup',finishPointer)},[]);
 useEffect(()=>{setDraft(value);transient.current=false},[value]);
 const fitCanvas=()=>{setZoom(100);setPan({x:0,y:0});};
 useArtworkNavigation(viewport,{
  scopeKeysToCanvas:true,panMode,zoom,pan,onZoom:setZoom,onPan:setPan,onFit:fitCanvas,minZoom:10,maxZoom:1600,
  selection:studio.selectionIds.length?studio.selectionIds:selected?[selected]:[],
  penActive:studio.tool==='shapePolygon'||studio.tool==='shapePencil',
 });
 useEffect(()=>{fitCanvas();setPanMode(false);studio.setUnitsPerCm(value.surface.units==='mm'?10:1);studio.setTool('select');return()=>onPreview?.(null)},[value.surface.id]);
 useEffect(()=>{if(studio.tool!=='select')setPanMode(false)},[studio.tool]);
 const change=(elements:DesignElement[],id?:string,options?:{transient?:boolean})=>{

  elements=elements.map(element=>{const source=draft.document.elements.find(old=>old.id===element.id),display=rendered.find(old=>old.id===element.id);return JSON.stringify(source?.surfaceColourLinks)!==JSON.stringify(element.surfaceColourLinks)?element:restoreArtworkSource(element,source,display)});
  const bounded=elements.map(e=>draft.document.elements.some(old=>old.id===e.id)||e.width<=value.surface.width*2&&e.height<=value.surface.height*2&&e.x<=value.surface.width*2&&e.y<=value.surface.height*2?e:{...e,x:value.surface.width/2,y:value.surface.height/2,width:Math.min(e.width,value.surface.width*.6),height:Math.min(e.height,value.surface.height*.6),fontSize:e.fontSize?Math.min(e.fontSize,value.surface.height*.3):undefined,frameId:draft.document.elements.find(item=>item.id===selected)?.frameId});
  const next={...draft,document:editSurfaceDocument(value,bounded)};setDraft(next);if(id!==undefined){setSelected(id);onSelection?.(id)}
  if(options?.transient||gesture.current){if(gesture.current)pending.current=next;transient.current=true;onPreview?.(next);return;}
  transient.current=false;onPreview?.(null);if(surfaceFingerprint(next.document.elements)!==surfaceFingerprint(value.document.elements))onCommit(next);
 };
 const select=(id:string|null)=>{setSelected(id);onSelection?.(id)};
 const live=(elements:DesignElement[]|null)=>{if(!onPreview)return;if(elements){const next={...value,document:editSurfaceDocument(value,elements)};onPreview?.(next)}else if(!transient.current)onPreview?.(null)};
 const canvas=<>
  <div ref={viewport} className="relative h-full w-full" data-surface-pan-viewport data-pan-tool={panMode} tabIndex={-1}>
   <PrintsDesignPreview canvasPan={pan} liveCanvasScale={zoom/100} garmentPreview={null} artboardBackground={artboardBackground} editable={!value.document.readOnly} assetMode canvasToolbar={false} canvasLockedBadges={false} canvasSize={{width:value.surface.width,height:value.surface.height}} elements={rendered} onChange={change} selectedLayerId={selected} onSelectedLayerIdChange={select} onLiveChange={live}/></div>
  <div className="label-canvas-actions" style={{position:'absolute',top:12,right:12,zIndex:60}}><SurfaceAddMenu value={draft} onCommit={next=>{setDraft(next);onCommit(next)}} onSelect={select}/></div><div className="surface-editor-zoom" onPointerDown={event=>event.stopPropagation()}><CanvasZoom value={zoom} min={10} max={1600} factor={1.25} onChange={setZoom} onFit={fitCanvas}/></div><UnifiedArtworkTools elements={rendered} selectedId={selected} onSelect={select} onChange={change} history={history} pan={{active:panMode,onChange:setPanMode}}/>
 </>;
 if(embedded){const inspector=<aside onPointerDown={event=>event.stopPropagation()} aria-disabled={value.document.readOnly} onPointerDownCapture={event=>{if((event.target as Element).closest('input[type="range"],[role="slider"]'))gesture.current=true}} onFocusCapture={event=>{if((event.target as Element).matches('input,textarea'))gesture.current=true}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))finish()}}><PrintDesignInspector elements={rendered} onChange={change} selectedId={selected} onSelect={select} side="front"/></aside>;return <ArtworkProvider sourceElements={draft.document.elements} overrides={EMPTY_SURFACE_OVERRIDES} onOverrides={()=>{}} onSelectArtwork={select}><ArtworkSurfaceContext.Provider value={draft}><div className="relative h-full w-full" data-shared-surface-editor={value.surface.kind}>{canvas}{controlsHost&&(selected||studio.tool!=='select')&&createPortal(inspector,controlsHost)}</div></ArtworkSurfaceContext.Provider></ArtworkProvider>;}
 return <div className="surface-artwork-editor builder-context ceriga-builder-shell" role="dialog" aria-modal="true" aria-label={title} data-shared-surface-editor={value.surface.kind}>
 <header><strong>{title}</strong><span>{value.surface.width} × {value.surface.height} {value.surface.units}</span><button onClick={onClose} aria-label="Close shared editor"><X size={18}/></button></header>
 <ArtworkProvider sourceElements={draft.document.elements} overrides={EMPTY_SURFACE_OVERRIDES} onOverrides={()=>{}} onSelectArtwork={setSelected}><nav><PrintDesignNavigation/></nav><main>
 <ArtworkSurfaceContext.Provider value={draft}><div className="surface-artwork-editor-board">{canvas}</div>{preview&&<div className="surface-artwork-editor-preview" aria-label="Live surface preview">{preview(draft)}</div>}
 </ArtworkSurfaceContext.Provider></main><aside onPointerDown={event=>event.stopPropagation()} aria-disabled={value.document.readOnly} onPointerDownCapture={event=>{if((event.target as Element).closest('input[type="range"],[role="slider"]'))gesture.current=true}} onFocusCapture={event=>{if((event.target as Element).matches('input,textarea'))gesture.current=true}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))finish()}}><PrintDesignInspector elements={rendered} onChange={change} selectedId={selected} onSelect={select} side="front"/></aside></ArtworkProvider></div>;
}

export function EmbeddedSurfaceArtworkEditor(props:Omit<SurfaceEditorProps,'history'|'onClose'>){const history=useContext(ProductArtworkHistoryContext);return <SurfaceArtworkEditor {...props} embedded history={history??{canUndo:false,canRedo:false,onUndo:()=>{},onRedo:()=>{}}} onClose={()=>{}}/>;}
