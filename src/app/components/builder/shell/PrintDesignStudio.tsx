import {AddArtworkMenu,UnifiedArtworkTools} from './UnifiedArtworkTools';
import {FontDropDialog} from './FontUploadControls';
import {useArtworkNavigation} from './useArtworkNavigation';
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
import { useEffect, useLayoutEffect, useMemo, useState, useRef, Fragment, type ReactNode } from 'react';
import { Brush, Shapes, Type, Grid3X3, ImagePlus, Sparkles, ChevronLeft,Library } from 'lucide-react';
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
 {id:'shapes',label:'Shapes & paths',hint:'Geometry and paths',icon:Shapes,group:'CREATE'},
 {id:'text',label:'Typography',hint:'Text and lettering',icon:Type,group:'CREATE'},
 {id:'brush',label:'Sketch',hint:'Brushes and markup',icon:Brush,group:'CREATE'},
 {id:'upload',label:'Import & trace',hint:'Images and reference tracing',icon:ImagePlus,group:'CREATE'},
 {id:'library',label:'Artwork library',hint:'Reusable designs',icon:Library,group:'REUSE'},
 {id:'patterns',label:'Patterns & repeats',hint:'Repeats and fabric fills',icon:Grid3X3,group:'FINISH'},
 {id:'distress',label:'Finishes & texture',hint:'Print finishes and wear',icon:Sparkles,group:'FINISH'},
] as const;
export function PrintDesignNavigation({onActivate}:{onActivate?:()=>void}){
 const studio=usePrintsStudio(),items=PRINT_TOOL_GROUPS;
 return <div className="print-family-navigation">{items.map(({id,label,icon:Icon,group},index)=><Fragment key={id}>{items[index-1]?.group!==group&&<h2>{group}</h2>}<button className={studio.panel===id?'is-selected':''} aria-current={studio.panel===id?'true':undefined} onClick={()=>{studio.setPanel(id);onActivate?.();}}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></button></Fragment>)}<AddArtworkMenu onActivate={onActivate}/></div>;
}


type EditorProps = { elements: DesignElement[]; onChange: (elements: DesignElement[], selectedId?: string,options?:{transient?:boolean}) => void; selectedId: string | null; onSelect: (id: string | null) => void; side: 'front' | 'back' };
export function PrintDesignInspector(props: EditorProps & {hemWear?:HemWearBinding}) {
 const studio=usePrintsStudio(),workspace=useAssetWorkspaceContext();
 props=workspace?.project?{...props,elements:workspace.project.elements,onChange:workspace.change,selectedId:workspace.selectedId,onSelect:workspace.select,side:'front'}:props;
 const ordered=useMemo(()=>orderDesignLayers(props.elements),[props.elements]);
 const write=props.onChange;props={...props,elements:ordered,onChange:(elements,id,options)=>write(orderDesignLayers(elements),id,options)};
 const inspectorScroll=useRef<HTMLDivElement>(null);
 const [mode,setMode]=useState<'create'|'edit'>('create');const family=PRINT_TOOL_GROUPS.find(item=>item.id===studio.panel)??PRINT_TOOL_GROUPS[0];const selected=props.elements.find(el=>el.id===props.selectedId);
 useLayoutEffect(()=>setMode('create'),[studio.panel,studio.panelRequest]);useLayoutEffect(()=>setMode(props.selectedId?'edit':'create'),[props.selectedId]);
 useLayoutEffect(()=>{const main=inspectorScroll.current;if(main)main.scrollTop=0},[props.selectedId,studio.panel,mode,studio.pathEditingId,studio.logoRegionEditing?.regionId,studio.tool==='shapePolygon']);
 return <HemWearContext.Provider value={workspace?.project?null:props.hemWear??null}><div className="studio-inspector-v2 studio-clean" data-mode={mode} data-family={studio.panel}>{<InspectorHeading className="studio-inspector-header" eyebrow={mode==='create'?'ARTWORK STUDIO':undefined} title={mode==='edit'&&selected?selected.logoTrace?(selected.logoTrace.selectedRegion?'Shape':'Logo'):selected.type==='text'?'Text':selected.type==='image'?'Artwork':selected.type==='customArea'?'Custom shape':selected.type==='distress'?'Wear mark':selected.type.charAt(0).toUpperCase()+selected.type.slice(1):family.label} description={mode==='create'?(studio.panel==='text'?'Create type that belongs on your garment.':studio.panel==='shapes'?'Start with a shape or draw your own.':studio.panel==='library'?'Reuse and organise your artwork.':studio.panel==='upload'?'Upload, outline or trace a reference.':studio.panel==='patterns'?'Build a repeat that belongs on fabric.':studio.panel==='distress'?'Set the finish. Add character and texture.':'Choose a brush. Make it yours.'):undefined} leading={mode==='edit'?<button className="studio-back" title="Back to tools" aria-label="Back to tools" onClick={()=>setMode('create')}><ChevronLeft size={15}/><span>Tools</span></button>:undefined}/>}<div className="studio-inspector-main" ref={inspectorScroll}><PrintsDesignStep elements={props.elements} onChange={props.onChange} selectedLayerId={props.selectedId} onSelectedLayerIdChange={props.onSelect} garmentSide={props.side} renderTools={api=><StudioCreationPanel api={api}/>} renderSelection={(element,update,fonts)=><StudioObjectPanel element={element} update={update} fonts={fonts}/>}/></div><StudioLayerDock {...props} onSelect={id=>{props.onSelect(id);if(id)setMode('edit')}}/></div></HemWearContext.Provider>;
}
export function PrintDesignCanvas({ garment, side, onSide, zoom, onZoom, onFit, history,drawingBounds,referenceWidthCm, ...props }: EditorProps & { garment: ReactNode; side: 'front' | 'back'; onSide:(side:'front'|'back')=>void; zoom:number; onZoom:(n:number)=>void; onFit:()=>void; history?:DrawHistory;drawingBounds?:GarmentDrawingBounds;referenceWidthCm?:number }) {
  const studio = usePrintsStudio();
  const responsive = useResponsiveBuilder();
  const phone=useBuilderWidth()<768;
  const [artworkView,setArtworkView] = useState(false);
  const workspace = useAssetWorkspaceContext();
  const project = workspace?.project;
  const [assetZoom,setAssetZoom]=useState(100);
  if(project){zoom=assetZoom;onZoom=value=>setAssetZoom(Number.isFinite(value)?Math.max(.01,Math.min(1000000,value)):100);}
  const elements = project?.elements ?? props.elements;
  const selectedId = project ? workspace!.selectedId : props.selectedId;
  const write = project ? workspace!.change : props.onChange;
  const pendingDrawing=useRef<string|null>(null);
  const change = (next:DesignElement[],id?:string,options?:{transient?:boolean})=>{
    if(studio.tool==='brush'){const drawn=next.find(el=>el.type==='drawing'&&elements.find(old=>old.id===el.id)?.content!==el.content);if(drawn)pendingDrawing.current=drawn.id;}
    write(orderDesignLayers(!project&&studio.tool==='brush'?next.map(element=>element.type==='drawing'&&!elements.some(old=>old.id===element.id)?{...element,sketchOnly:true}:element):next),id,options);
  };
  const select = project ? workspace!.select : props.onSelect;
  useEffect(()=>{const shortcuts=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;const key=event.key.toLowerCase();if(key==='v'){event.preventDefault();studio.setTool('select')}if(key==='p'){event.preventDefault();select(null);studio.setPanel('shapes');studio.setPenTargetId(null);studio.setSelectionIds([]);studio.setTool('shapePolygon')}if(key==='b'||key==='e'){event.preventDefault();select(null);studio.setPanel('brush');studio.setTool(key==='b'?'brush':'eraser')}};window.addEventListener('keydown',shortcuts);return()=>window.removeEventListener('keydown',shortcuts)},[studio.setTool,studio.setPanel,select]);
  const touchSurface = useRef<HTMLDivElement>(null);
  const navigation = useCanvasTouchNavigation(touchSurface, responsive.canvasFocus, zoom, onZoom, project ? {min:.01,max:1000000} : undefined);
  const fitCanvas = () => { navigation.reset(); if(project)setAssetZoom(100);else onFit(); };
  useArtworkNavigation(touchSurface,{pasteboardPan:Boolean(project),zoom,pan:navigation.pan,onPan:navigation.setPan,onZoom,onFit:fitCanvas,selection:studio.selectionIds.length?studio.selectionIds:selectedId?[selectedId]:[],minZoom:project ? .01 : 50,maxZoom:project?1000000:200,penActive:studio.tool==='shapePolygon'||studio.tool==='shapePencil'});
  useEffect(()=>navigation.reset(),[side,project?.id,artworkView]);
  useEffect(()=>{pendingDrawing.current=null},[side,project?.id]);
  useEffect(()=>{if(studio.tool!=='brush')pendingDrawing.current=null},[studio.tool]);
  const garmentFrame=!artworkView&&!project&&drawingBounds?garmentFrameStyle(drawingBounds,phone):null;

  return <div onPointerDownCapture={event=>{
    const target=event.target as Element,id=pendingDrawing.current;
    if(studio.tool!=='brush'||!id||!elements.some(el=>el.id===id)||target.closest('[data-print-design-zone],button,input,select,textarea,label,summary,a,[role="button"],[role="slider"],[role="dialog"],[role="listbox"],[role="menu"],[data-editor-chrome]'))return;
    event.preventDefault();event.stopPropagation();pendingDrawing.current=null;studio.setTool('select');select(id);responsive.setInspectorSnap('half');
  }} className="print-design-canvas" data-asset-workspace={Boolean(project)} data-artwork-family={studio.panel} data-draw-studio={studio.panel==='brush'}>{project&&<AssetWorkspaceHeader/>}<AssetWorkspaceDialogs/><FontDropDialog/>{!project&&<><button type="button" className="artwork-view-toggle" aria-pressed={artworkView} disabled={!artworkView&&!artworkViewBounds(elements,side)} title={artworkView?'Return to garment':'View artwork without the garment'} onClick={()=>setArtworkView(value=>!value)}>Artwork view</button><GarmentViewSwitch value={side} onChange={onSide}/></>}<div className="studio-canvas-heading" aria-hidden="true" style={{pointerEvents:'none'}}/><UnifiedArtworkTools elements={elements} selectedId={selectedId} onChange={change} onSelect={select} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>{phone&&selectedId&&elements.some(el=>el.id===selectedId)&&<div className="phone-artwork-selection" role="group" aria-label="Selected artwork actions"><button onClick={()=>responsive.setInspectorSnap('half')}>Edit artwork</button><button aria-label="Deselect artwork" onClick={()=>select(null)}>Done</button></div>}<button className="touch-canvas-fit" onClick={fitCanvas} aria-label="Fit artwork and garment to canvas">Fit</button><div ref={touchSurface} className="print-garment-stage"><div data-unified-garment-frame={garmentFrame?true:undefined} className={garmentFrame?'new-drawing-frame':undefined} style={garmentFrame?{...garmentFrame,transform:`translate3d(${navigation.pan.x}px,${navigation.pan.y}px,0) ${garmentFrame.transform}`}:{transform:`translate3d(${navigation.pan.x}px,${navigation.pan.y}px,0)`}}><PrintsDesignPreview referenceWidthCm={referenceWidthCm} artworkView={artworkView&&!project} canvasToolbar={false} assetMode={Boolean(project)} canvasSize={project ? {width:project.width,height:project.height} : {width:800,height:700}} garmentPreview={garment} garmentSide={project ? 'front' : side} elements={elements} onChange={change} selectedLayerId={selectedId} onSelectedLayerIdChange={id=>{select(id);if(id&&window.innerWidth>=768)responsive.setInspectorSnap('half')}} editable={!responsive.canvasFocus} liveCanvasScale={(!garmentFrame&&phone?1.35:1)*zoom / 100}/></div></div><footer className="print-canvas-footer">{studio.panel==='brush'&&<DrawPaintQuickSettings/>}<>{studio.panel==='shapes'&&<ShapeCanvasActions elements={elements} selectedId={selectedId} onChange={change} onSelect={select}/>}</><CanvasZoom value={zoom} min={project ? .01 : 50} max={project?1000000:200} factor={project?1.25:undefined} onChange={onZoom} onFit={fitCanvas}/></footer></div>;
}
