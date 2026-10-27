import {HemWearContext,type HemWearBinding} from './HemDistressControls';
import {artworkViewBounds} from '../../../lib/artworkViewBounds';
import {garmentFrameStyle,type GarmentDrawingBounds} from '../../../lib/garmentCanvasFrame';
import {WearCanvasTools} from './WearTextureStudio';
import {useCanvasTouchNavigation} from './useCanvasTouchNavigation';
import {InspectorHeading} from './InspectorHeading';
import {ArtworkCanvasTools} from './ArtworkCanvasTools';
import {orderDesignLayers} from '../../../lib/designLayerOrdering';
import {GarmentViewSwitch} from './GarmentViewSwitch';
import {TypographyCanvasTools} from './TypographyStudio';
import { ShapeCanvasActions,ShapeCanvasTools } from './ShapesStudio';
import { DrawPaintCanvasTools, DrawPaintQuickSettings, type DrawHistory } from './DrawPaintStudio';
import { useEffect, useLayoutEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { Brush, Shapes, Type, Grid3X3, ImagePlus, Sparkles, ChevronLeft } from 'lucide-react';
import { PrintsDesignStep, PrintsDesignPreview, type DesignElement } from '../PrintStudioEditor';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import { useAssetWorkspaceContext, AssetWorkspaceEntry, AssetWorkspaceHeader, AssetWorkspaceDialogs } from '../printsStudio/AssetWorkspace';
import { CanvasZoom } from './CanvasZoom';
import { useResponsiveBuilder, useBuilderWidth } from './responsiveBuilder';
import { StudioCreationPanel } from './StudioCreationPanel';
import { StudioObjectPanel } from './StudioObjectPanel';
import { StudioLayerDock } from './StudioLayerDock';
import './print-design-studio.css';

export const PRINT_TOOL_GROUPS = [
  { id: 'brush', label: 'Draw & paint', hint: 'Brushes, ink & textile marks', icon: Brush },
  { id: 'shapes', label: 'Shapes & paths', hint: 'Geometry & custom areas', icon: Shapes },
  { id: 'text', label: 'Typography', hint: 'Type, curves & effects', icon: Type },
  { id: 'upload', label: 'Artwork library', hint: 'Upload & reuse your designs', icon: ImagePlus },
  { id: 'patterns', label: 'Patterns & repeats', hint: 'All-over designs & repeats', icon: Grid3X3 },
  { id: 'distress', label: 'Wear & texture', hint: 'Distressing & fabric character', icon: Sparkles },
] as const;

export function PrintDesignNavigation({ onActivate }: { onActivate?: () => void }) {
  const studio = usePrintsStudio();
  return <div className="print-family-navigation">{PRINT_TOOL_GROUPS.map(({ id, label, icon: Icon }) => <button key={id} className={studio.panel === id ? 'is-selected' : ''} aria-current={studio.panel === id ? 'true' : undefined} onClick={() => { studio.setPanel(id); studio.setTool('select'); onActivate?.(); }}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></button>)}<AssetWorkspaceEntry onActivate={onActivate}/></div>;
}

type EditorProps = { elements: DesignElement[]; onChange: (elements: DesignElement[], selectedId?: string) => void; selectedId: string | null; onSelect: (id: string | null) => void; side: 'front' | 'back' };
export function PrintDesignInspector(props: EditorProps & {hemWear?:HemWearBinding}) {
 const studio=usePrintsStudio(),workspace=useAssetWorkspaceContext();
 props=workspace?.project?{...props,elements:workspace.project.elements,onChange:workspace.change,selectedId:workspace.selectedId,onSelect:workspace.select,side:'front'}:props;
 const ordered=useMemo(()=>orderDesignLayers(props.elements),[props.elements]);
 const write=props.onChange;props={...props,elements:ordered,onChange:(elements,id)=>write(orderDesignLayers(elements),id)};
 const inspectorScroll=useRef<HTMLDivElement>(null);
 const [mode,setMode]=useState<'create'|'edit'>('create');const family=PRINT_TOOL_GROUPS.find(item=>item.id===studio.panel)!;const selected=props.elements.find(el=>el.id===props.selectedId);
 useLayoutEffect(()=>setMode('create'),[studio.panel,studio.panelRequest]);useLayoutEffect(()=>setMode(props.selectedId?'edit':'create'),[props.selectedId]);
 useLayoutEffect(()=>{const main=inspectorScroll.current;if(main)main.scrollTop=0},[props.selectedId,studio.panel,mode]);
 return <HemWearContext.Provider value={workspace?.project?null:props.hemWear??null}><div className="studio-inspector-v2 studio-clean" data-mode={mode} data-family={studio.panel}>{<InspectorHeading className="studio-inspector-header" eyebrow={mode==='create'?'ARTWORK STUDIO':undefined} title={mode==='edit'&&selected?selected.type==='text'?'Text':selected.type==='image'?'Artwork':selected.type==='customArea'?'Custom shape':selected.type==='distress'?'Wear mark':selected.type.charAt(0).toUpperCase()+selected.type.slice(1):family.label} description={mode==='create'?(studio.panel==='text'?'Create type that belongs on your garment.':studio.panel==='shapes'?'Start with a shape or draw your own.':studio.panel==='upload'?'Upload artwork or reuse your saved designs.':studio.panel==='patterns'?'Build a repeat that belongs on fabric.':studio.panel==='distress'?'Paint worn areas or place individual marks.':'Choose a brush. Make it yours.'):undefined} leading={mode==='edit'?<button className="studio-back" title="Back to tools" aria-label="Back to tools" onClick={()=>setMode('create')}><ChevronLeft size={17}/></button>:undefined}/>}<div className="studio-inspector-main" ref={inspectorScroll}><PrintsDesignStep elements={props.elements} onChange={props.onChange} selectedLayerId={props.selectedId} onSelectedLayerIdChange={props.onSelect} garmentSide={props.side} renderTools={api=><StudioCreationPanel api={api}/>} renderSelection={(element,update,fonts)=><StudioObjectPanel element={element} update={update} fonts={fonts}/>}/></div><StudioLayerDock {...props} onSelect={id=>{props.onSelect(id);if(id)setMode('edit')}}/></div></HemWearContext.Provider>;
}
export function PrintDesignCanvas({ garment, side, onSide, zoom, onZoom, onFit, history,drawingBounds, ...props }: EditorProps & { garment: ReactNode; side: 'front' | 'back'; onSide:(side:'front'|'back')=>void; zoom:number; onZoom:(n:number)=>void; onFit:()=>void; history?:DrawHistory;drawingBounds?:GarmentDrawingBounds }) {
  const studio = usePrintsStudio();
  const responsive = useResponsiveBuilder();
  const phone=useBuilderWidth()<768;
  const [artworkView,setArtworkView] = useState(false);
  const workspace = useAssetWorkspaceContext();
  const project = workspace?.project;
  const elements = project?.elements ?? props.elements;
  const selectedId = project ? workspace!.selectedId : props.selectedId;
  const write = project ? workspace!.change : props.onChange;
  const pendingDrawing=useRef<string|null>(null);
  const change = (next:DesignElement[],id?:string)=>{
    if(studio.tool==='brush'){const drawn=next.find(el=>el.type==='drawing'&&elements.find(old=>old.id===el.id)?.content!==el.content);if(drawn)pendingDrawing.current=drawn.id;}
    write(orderDesignLayers(next),id);
  };
  const select = project ? workspace!.select : props.onSelect;
  useEffect(()=>{const shortcuts=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;const key=event.key.toLowerCase();if(key==='v'){event.preventDefault();studio.setTool('select')}if(key==='b'||key==='e'){event.preventDefault();select(null);studio.setPanel('brush');studio.setTool(key==='b'?'brush':'eraser')}};window.addEventListener('keydown',shortcuts);return()=>window.removeEventListener('keydown',shortcuts)},[studio.setTool,studio.setPanel,select]);
  const touchSurface = useRef<HTMLDivElement>(null);
  const navigation = useCanvasTouchNavigation(touchSurface, responsive.canvasFocus, zoom, onZoom);
  const fitCanvas = () => { navigation.reset(); onFit(); };
  useEffect(()=>navigation.reset(),[side,project?.id,artworkView]);
  useEffect(()=>{pendingDrawing.current=null},[side,project?.id]);
  useEffect(()=>{if(studio.tool!=='brush')pendingDrawing.current=null},[studio.tool]);
  const garmentFrame=!artworkView&&!project&&drawingBounds?garmentFrameStyle(drawingBounds,phone):null;

  return <div onPointerDownCapture={event=>{
    const target=event.target as Element,id=pendingDrawing.current;
    if(studio.tool!=='brush'||!id||!elements.some(el=>el.id===id)||target.closest('[data-print-design-zone],button,input,select,textarea,[role="button"],[role="slider"],[data-editor-chrome]'))return;
    event.preventDefault();event.stopPropagation();pendingDrawing.current=null;studio.setTool('select');select(id);responsive.setInspectorSnap('half');
  }} className="print-design-canvas" data-artwork-family={studio.panel} data-draw-studio={studio.panel==='brush'}>{project&&<AssetWorkspaceHeader/>}<AssetWorkspaceDialogs/>{!project&&<><button type="button" className="artwork-view-toggle" aria-pressed={artworkView} disabled={!artworkView&&!artworkViewBounds(elements,side)} title={artworkView?'Return to garment':'View artwork without the garment'} onClick={()=>setArtworkView(value=>!value)}>Artwork view</button><GarmentViewSwitch value={side} onChange={onSide}/></>}<div className="studio-canvas-heading" aria-hidden="true" style={{pointerEvents:'none'}}/>{studio.panel==='distress'&&<WearCanvasTools onSelect={()=>select(null)} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>}{studio.panel==='brush'&&<DrawPaintCanvasTools color={studio.tool==='select'?elements.find(el=>el.id===selectedId)?.color:undefined} onColorChange={color=>{const selected=elements.find(el=>el.id===selectedId);if(studio.tool==='select'&&selected&&!selected.locked)change(elements.map(el=>el.id===selectedId?{...el,color}:el))}} onSelectTool={tool=>{const id=tool==='select'?pendingDrawing.current:null;select(id??null);if(id)pendingDrawing.current=null;}} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>}{studio.panel==='text'&&<TypographyCanvasTools side={project?'front':side} elements={elements} selectedId={selectedId} onChange={change} onSelect={select} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>}{(studio.panel==='upload'||studio.panel==='patterns')&&<ArtworkCanvasTools mode={studio.panel} elements={elements} selectedId={selectedId} onChange={change} onBrowse={()=>{studio.setPanel(studio.panel);responsive.setInspectorSnap('half');}} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>}{studio.panel==='shapes'&&<ShapeCanvasTools history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history} elements={elements} selectedId={selectedId} onChange={change} onSelect={select}/>}{phone&&selectedId&&elements.some(el=>el.id===selectedId)&&<div className="phone-artwork-selection" role="group" aria-label="Selected artwork actions"><button onClick={()=>responsive.setInspectorSnap('half')}>Edit artwork</button><button aria-label="Deselect artwork" onClick={()=>select(null)}>Done</button></div>}<button className="touch-canvas-fit" onClick={fitCanvas} aria-label="Fit artwork and garment to canvas">Fit</button><div ref={touchSurface} className="print-garment-stage"><div data-unified-garment-frame={garmentFrame?true:undefined} className={garmentFrame?'new-drawing-frame':undefined} style={garmentFrame?{...garmentFrame,transform:`translate3d(${navigation.pan.x}px,${navigation.pan.y}px,0) ${garmentFrame.transform}`}:{transform:`translate3d(${navigation.pan.x}px,${navigation.pan.y}px,0)`}}><PrintsDesignPreview artworkView={artworkView&&!project} canvasToolbar={false} assetMode={Boolean(project)} canvasSize={project ? {width:project.width,height:project.height} : {width:800,height:700}} garmentPreview={garment} garmentSide={project ? 'front' : side} elements={elements} onChange={change} selectedLayerId={selectedId} onSelectedLayerIdChange={id=>{select(id);if(id&&window.innerWidth>=768)responsive.setInspectorSnap('half')}} editable={!responsive.canvasFocus} liveCanvasScale={(!garmentFrame&&phone?1.35:1)*zoom / 100}/></div></div><footer className="print-canvas-footer">{studio.panel==='brush'&&<DrawPaintQuickSettings/>}<>{studio.panel==='shapes'&&<ShapeCanvasActions elements={elements} selectedId={selectedId} onChange={change} onSelect={select}/>}</><CanvasZoom value={zoom} min={50} max={200} onChange={onZoom} onFit={fitCanvas}/></footer></div>;
}
