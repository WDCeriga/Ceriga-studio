import { ShapeCanvasActions,ShapeCanvasTools } from './ShapesStudio';
import { DrawPaintCanvasTools, DrawPaintQuickSettings, type DrawHistory } from './DrawPaintStudio';
import { useEffect, useLayoutEffect, useState, useRef, type ReactNode } from 'react';
import { Brush, Shapes, Type, Grid3X3, ImagePlus, Sparkles, ChevronLeft } from 'lucide-react';
import { PrintsDesignStep, PrintsDesignPreview, type DesignElement } from '../PrintStudioEditor';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import { useAssetWorkspaceContext, AssetWorkspaceHeader, AssetWorkspaceDialogs } from '../printsStudio/AssetWorkspace';
import { CanvasZoom } from './CanvasZoom';
import { useResponsiveBuilder } from './responsiveBuilder';
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
  return <div className="print-family-navigation">{PRINT_TOOL_GROUPS.map(({ id, label, icon: Icon }) => <button key={id} className={studio.panel === id ? 'is-selected' : ''} aria-current={studio.panel === id ? 'true' : undefined} onClick={() => { studio.setPanel(id); studio.setTool('select'); onActivate?.(); }}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></button>)}</div>;
}

type EditorProps = { elements: DesignElement[]; onChange: (elements: DesignElement[], selectedId?: string) => void; selectedId: string | null; onSelect: (id: string | null) => void; side: 'front' | 'back' };
export function PrintDesignInspector(props: EditorProps) {
 const studio=usePrintsStudio(),workspace=useAssetWorkspaceContext();
 props=workspace?.project?{...props,elements:workspace.project.elements,onChange:workspace.change,selectedId:workspace.selectedId,onSelect:workspace.select,side:'front'}:props;
 const inspectorScroll=useRef<HTMLDivElement>(null);
 const [mode,setMode]=useState<'create'|'edit'>('create');const family=PRINT_TOOL_GROUPS.find(item=>item.id===studio.panel)!;const selected=props.elements.find(el=>el.id===props.selectedId);
 useLayoutEffect(()=>setMode('create'),[studio.panel,studio.panelRequest]);useLayoutEffect(()=>setMode(props.selectedId?'edit':'create'),[props.selectedId]);
 useLayoutEffect(()=>{const main=inspectorScroll.current;if(main)main.scrollTop=0},[props.selectedId,studio.panel,mode]);
 return <div className="studio-inspector-v2 studio-clean" data-mode={mode} data-family={studio.panel}><header className="studio-inspector-header">{mode==='edit'&&<button className="studio-back" title="Back to tools" aria-label="Back to tools" onClick={()=>setMode('create')}><ChevronLeft size={17}/></button>}{['brush','shapes'].includes(studio.panel)&&mode==='create'&&<span className="draw-studio-eyebrow">ARTWORK STUDIO</span>}<h2>{mode==='edit'&&selected?selected.type==='text'?'Text':selected.type==='image'?'Artwork':selected.type==='customArea'?'Custom shape':selected.type.charAt(0).toUpperCase()+selected.type.slice(1):family.label}</h2>{['brush','shapes'].includes(studio.panel)&&mode==='create'&&<p className="draw-studio-intro">{studio.panel==='shapes'?'Start with a shape or draw your own.':'Choose a brush. Make it yours.'}</p>}</header><div className="studio-inspector-main" ref={inspectorScroll}><PrintsDesignStep elements={props.elements} onChange={props.onChange} selectedLayerId={props.selectedId} onSelectedLayerIdChange={props.onSelect} garmentSide={props.side} renderTools={api=><StudioCreationPanel api={api}/>} renderSelection={(element,update,fonts)=><StudioObjectPanel element={element} update={update} fonts={fonts}/>}/></div><StudioLayerDock {...props} onSelect={id=>{props.onSelect(id);if(id)setMode('edit')}}/></div>;
}
export function PrintDesignCanvas({ garment, side, onSide, zoom, onZoom, onFit, history, ...props }: EditorProps & { garment: ReactNode; side: 'front' | 'back'; onSide:(side:'front'|'back')=>void; zoom:number; onZoom:(n:number)=>void; onFit:()=>void; history?:DrawHistory }) {
  const studio = usePrintsStudio();
  const responsive = useResponsiveBuilder();
  const workspace = useAssetWorkspaceContext();
  const project = workspace?.project;
  const elements = project?.elements ?? props.elements;
  const selectedId = project ? workspace!.selectedId : props.selectedId;
  const change = project ? workspace!.change : props.onChange;
  const select = project ? workspace!.select : props.onSelect;
  useEffect(()=>{const shortcuts=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;const key=event.key.toLowerCase();if(key==='v'){event.preventDefault();studio.setTool('select')}if(key==='b'||key==='e'){event.preventDefault();select(null);studio.setPanel('brush');studio.setTool(key==='b'?'brush':'eraser')}};window.addEventListener('keydown',shortcuts);return()=>window.removeEventListener('keydown',shortcuts)},[studio.setTool,studio.setPanel,select]);
  const drawing = studio.tool === 'brush' || studio.tool === 'eraser';
  return <div className="print-design-canvas" data-draw-studio={studio.panel==='brush'}>{project&&<AssetWorkspaceHeader/>}<AssetWorkspaceDialogs/><div className="studio-canvas-heading"><div className="studio-canvas-heading-actions">{!project&&<div className="new-view-switch" role="group" aria-label="Garment view"><button aria-pressed={side==='front'} onClick={()=>onSide('front')}>Front</button><button aria-pressed={side==='back'} onClick={()=>onSide('back')}>Back</button></div>}</div></div>{studio.panel==='brush'&&<DrawPaintCanvasTools onSelectTool={()=>select(null)} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>}{studio.panel==='shapes'&&<ShapeCanvasTools elements={elements} selectedId={selectedId} onChange={change} onSelect={select}/>}<div className="print-garment-stage"><div><PrintsDesignPreview canvasToolbar={false} assetMode={Boolean(project)} canvasSize={project ? {width:project.width,height:project.height} : {width:800,height:700}} garmentPreview={garment} garmentSide={project ? 'front' : side} elements={elements} onChange={change} selectedLayerId={selectedId} onSelectedLayerIdChange={id=>{select(id);if(id)responsive.setInspectorSnap('half')}} editable liveCanvasScale={zoom / 100}/></div></div><footer className="print-canvas-footer">{studio.panel==='brush'&&drawing&&<DrawPaintQuickSettings/>}<>{studio.panel==='shapes'&&<ShapeCanvasActions elements={elements} selectedId={selectedId} onChange={change} onSelect={select} history={project?{onUndo:workspace!.undo,onRedo:workspace!.redo,canUndo:workspace!.canUndo,canRedo:workspace!.canRedo}:history}/>}</><CanvasZoom value={zoom} min={50} max={200} onChange={onZoom} onFit={onFit}/></footer></div>;
}
