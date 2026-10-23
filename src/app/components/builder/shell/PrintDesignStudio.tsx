import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MousePointer2, Brush, Eraser, Shapes, Type, Grid3X3, ImagePlus, Sparkles, Layers, SlidersHorizontal, Search, Plus, Copy, Trash2, X, Star, ChevronLeft, ChevronRight, Maximize2, Minimize2, Check } from 'lucide-react';
import { PrintsDesignStep, PrintsDesignPreview, type DesignElement } from '../PrintStudioEditor';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import { BRUSH_PRESETS, DEFAULT_BRUSH_SETTINGS, renderBrushStroke } from '../../../lib/drawingBrush';
import { useAssetWorkspaceContext, AssetWorkspaceHeader, AssetWorkspaceDialogs } from '../printsStudio/AssetWorkspace';
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
  return <div className="print-family-navigation">{PRINT_TOOL_GROUPS.map(({ id, label, icon: Icon }) => <button key={id} className={studio.panel === id ? 'is-selected' : ''} aria-current={studio.panel === id ? 'true' : undefined} onClick={() => { studio.setPanel(id); studio.setTool('select'); onActivate?.(); }}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></button>)}</div>;
}

const FAMILIES: Record<string, string[]> = {
  'All': [],
  'Ink & pencil': ['pencil', 'pen', 'fine-liner', 'technical-pen', 'ink-pen', 'calligraphy', 'marker', 'highlighter'],
  'Paint': ['paint', 'dry-brush', 'wet-brush', 'gouache', 'watercolour', 'oil-paint', 'sponge', 'airbrush'],
  'Texture': ['crayon', 'chalk', 'charcoal', 'pastel', 'spray', 'graffiti-marker', 'graffiti-mop', 'splatter', 'drip-paint', 'halftone-brush', 'noise-brush', 'grain-brush', 'rough-edge-brush', 'pixel-brush', 'distress-brush'],
  'Thread': ['stitching', 'embroidery', 'running-stitch', 'chain-stitch', 'cross-stitch', 'zigzag-stitch', 'satin-stitch', 'fill-stitch', 'chain-embroidery', 'chenille'],
};
function BrushSwatch({ preset }: { preset: typeof BRUSH_PRESETS[number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const settings = { ...DEFAULT_BRUSH_SETTINGS, ...preset.settings, brushPreset: preset.id, brushSize: 9, color: '#2e3e4c', opacity: 100, pressure: true, stabilization: 28, pencil: {pencilOnly:false, tiltShading:true, doubleTapTogglesEraser:true}, grain: preset.grain };
    const points = Array.from({ length: 48 }, (_, i) => ({ x: 15 + i * 3.2, y: 25 + Math.sin(i / 47 * Math.PI * 2) * 8, p: .5 + Math.sin(i / 47 * Math.PI) * .5, tilt: 0 }));
    renderBrushStroke(ctx, points, settings, 1, 73);
  }, [preset]);
  return <canvas ref={ref} width={188} height={50} aria-hidden="true"/>;
}
export function PrintBrushLibrary({onEdit,onPick}:{onEdit?:()=>void;onPick?:()=>void}) {
 const studio=usePrintsStudio();const [family,setFamily]=useState('Ink & pencil'),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
 const [saved,setSaved]=useState<string[]>(()=>{try{const parsed=JSON.parse(localStorage.getItem('ceriga.print.savedBrushes')??'[]');return Array.isArray(parsed)?parsed.filter(id=>BRUSH_PRESETS.some(p=>p.id===id)):[]}catch{return []}});
 const presets=BRUSH_PRESETS.filter(p=>(family==='Saved'?saved.includes(p.id):family==='All'||FAMILIES[family].includes(p.id))&&p.label.toLowerCase().includes(query.toLowerCase()));
 const save=(id:string)=>{const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);try{localStorage.setItem('ceriga.print.savedBrushes',JSON.stringify(next))}catch{}};
 return <section className="studio-brush-library"><div className="studio-library-filter"><select aria-label="Brush medium" value={family} onChange={e=>setFamily(e.target.value)}>{[...Object.keys(FAMILIES),'Saved'].map(name=><option key={name}>{name}</option>)}</select><button aria-label="Search brushes" aria-expanded={searchOpen} onClick={()=>{setSearchOpen(!searchOpen);if(searchOpen)setQuery('')}}><Search size={16}/></button></div>{searchOpen&&<label className="studio-search"><Search size={14}/><input autoFocus aria-label="Find brush" placeholder="Search brushes" value={query} onChange={e=>setQuery(e.target.value)}/></label>}<div className="studio-brush-results">{presets.map(p=><div className="studio-brush-row" data-active={studio.brushPreset===p.id} key={p.id}><button className="studio-brush-pick" aria-label={`Use ${p.label} brush`} aria-pressed={studio.brushPreset===p.id} onClick={()=>{onPick?.();studio.setBrushPreset(p.id);studio.setTool('brush')}}><span>{p.label}</span><BrushSwatch preset={p}/></button><div className="studio-brush-row-actions"><button title="Save brush" aria-label={`Save ${p.label} brush`} aria-pressed={saved.includes(p.id)} onClick={()=>save(p.id)}><Star size={12} fill={saved.includes(p.id)?'currentColor':'none'}/></button>{studio.brushPreset===p.id&&<button title="Brush settings" aria-label={`Edit ${p.label} brush settings`} onClick={onEdit}><SlidersHorizontal size={14}/></button>}</div></div>)}{!presets.length&&<p className="studio-no-results">{family==='Saved'&&!saved.length?'Save a brush to keep it here.':'No matching brushes.'}</p>}</div></section>;
}

type EditorProps = { elements: DesignElement[]; onChange: (elements: DesignElement[], selectedId?: string) => void; selectedId: string | null; onSelect: (id: string | null) => void; side: 'front' | 'back' };
export function PrintDesignInspector(props: EditorProps) {
 const studio=usePrintsStudio(),workspace=useAssetWorkspaceContext();
 props=workspace?.project?{...props,elements:workspace.project.elements,onChange:workspace.change,selectedId:workspace.selectedId,onSelect:workspace.select,side:'front'}:props;
 const [mode,setMode]=useState<'create'|'edit'>('create');const family=PRINT_TOOL_GROUPS.find(item=>item.id===studio.panel)!;const selected=props.elements.find(el=>el.id===props.selectedId);
 useLayoutEffect(()=>setMode('create'),[studio.panel,studio.panelRequest]);useLayoutEffect(()=>setMode(props.selectedId?'edit':'create'),[props.selectedId]);
 return <div className="studio-inspector-v2 studio-clean" data-mode={mode}><header className="studio-inspector-header">{mode==='edit'&&<button className="studio-back" title="Back to tools" aria-label="Back to tools" onClick={()=>setMode('create')}><ChevronLeft size={17}/></button>}<h2>{mode==='edit'&&selected?selected.type==='text'?'Text':selected.type==='image'?'Artwork':selected.type.charAt(0).toUpperCase()+selected.type.slice(1):family.label}</h2></header><div className="studio-inspector-main"><PrintsDesignStep elements={props.elements} onChange={props.onChange} selectedLayerId={props.selectedId} onSelectedLayerIdChange={props.onSelect} garmentSide={props.side} renderTools={api=><StudioCreationPanel api={api}/>} renderSelection={(element,update,fonts)=><StudioObjectPanel element={element} update={update} fonts={fonts}/>}/></div><StudioLayerDock {...props} onSelect={id=>{props.onSelect(id);if(id)setMode('edit')}}/></div>;
}
export function PrintDesignCanvas({ garment, side, onSide, zoom, onZoom, onFit, ...props }: EditorProps & { garment: ReactNode; side: 'front' | 'back'; onSide:(side:'front'|'back')=>void; zoom:number; onZoom:(n:number)=>void; onFit:()=>void }) {
  const studio = usePrintsStudio();
  const responsive = useResponsiveBuilder();
  const workspace = useAssetWorkspaceContext();
  const project = workspace?.project;
  const elements = project?.elements ?? props.elements;
  const selectedId = project ? workspace!.selectedId : props.selectedId;
  const change = project ? workspace!.change : props.onChange;
  const select = project ? workspace!.select : props.onSelect;
  const selected = elements.find(el => el.id === selectedId);
  const [focus,setFocus]=useState(false);const width=useBuilderWidth();
  useEffect(()=>{const shortcuts=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;const key=event.key.toLowerCase();if(key==='v'){event.preventDefault();studio.setTool('select')}if(key==='b'||key==='e'){event.preventDefault();select(null);studio.setPanel('brush');studio.setTool(key==='b'?'brush':'eraser')}if(key==='f'){event.preventDefault();setFocus(value=>!value);responsive.setInspectorSnap('peek')}if(event.key==='Escape'&&focus){event.preventDefault();setFocus(false)}};window.addEventListener('keydown',shortcuts);return()=>window.removeEventListener('keydown',shortcuts)},[studio.setTool,studio.setPanel,focus,select,responsive.setInspectorSnap]);
  const drawing = studio.tool === 'brush' || studio.tool === 'eraser';
  return <div className="print-design-canvas" data-focus={focus}>{project&&<AssetWorkspaceHeader/>}<AssetWorkspaceDialogs/><div className="studio-canvas-heading"><div className="studio-canvas-heading-actions">{!project&&<div className="new-view-switch" role="group" aria-label="Garment view"><button aria-pressed={side==='front'} onClick={()=>onSide('front')}>Front</button><button aria-pressed={side==='back'} onClick={()=>onSide('back')}>Back</button></div>}<button className="studio-focus-toggle" title={focus?'Exit focus mode':'Focus on canvas'} aria-label={focus?'Exit focus mode':'Focus on canvas'} aria-pressed={focus} onClick={()=>{setFocus(!focus);responsive.setInspectorSnap('peek')}}>{focus?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button></div></div>{drawing && focus && <div className="print-quick-settings"><span>{studio.tool === 'eraser' ? 'Eraser' : BRUSH_PRESETS.find(p => p.id === studio.brushPreset)?.label}</span><label>Size<input aria-label="Canvas brush size" type="range" min="2" max="64" value={studio.tool === 'eraser' ? studio.eraserSize : studio.brushSize} onChange={e => studio.tool === 'eraser' ? studio.setEraserSize(+e.target.value) : studio.setBrushSize(+e.target.value)}/><output>{studio.tool === 'eraser' ? studio.eraserSize : studio.brushSize}px</output></label><label>Opacity<input aria-label="Canvas brush opacity" type="range" min="1" max="100" value={studio.opacity} onChange={e => studio.setOpacity(+e.target.value)}/><output>{studio.opacity}%</output></label></div>}<div className="print-garment-stage"><div style={{transform:`scale(${zoom / 100})`}}><PrintsDesignPreview canvasToolbar={false} assetMode={Boolean(project)} canvasSize={project ? {width:project.width,height:project.height} : {width:800,height:700}} garmentPreview={garment} garmentSide={project ? 'front' : side} elements={elements} onChange={change} selectedLayerId={selectedId} onSelectedLayerIdChange={id=>{select(id);if(id)responsive.setInspectorSnap('half')}} editable liveCanvasScale={zoom / 100}/></div></div><footer className="print-canvas-footer"><CanvasZoom value={zoom} min={50} max={200} onChange={onZoom} onFit={onFit}/></footer></div>;
}
