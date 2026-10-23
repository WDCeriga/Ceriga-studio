import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MousePointer2, Brush, Eraser, Shapes, Type, Grid3X3, ImagePlus, Sparkles, Layers, SlidersHorizontal, Search, Plus, Copy, Trash2, X } from 'lucide-react';
import { PrintsDesignStep, PrintsDesignPreview, type DesignElement } from '../PrintStudioEditor';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import { BRUSH_PRESETS, DEFAULT_BRUSH_SETTINGS, renderBrushStroke } from '../../../lib/drawingBrush';
import { useAssetWorkspaceContext, AssetWorkspaceHeader, AssetWorkspaceDialogs } from '../printsStudio/AssetWorkspace';
import { CanvasZoom } from './CanvasZoom';
import { useResponsiveBuilder } from './responsiveBuilder';
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
    const settings = { ...DEFAULT_BRUSH_SETTINGS, ...preset.settings, brushPreset: preset.id, brushSize: 9, color: '#405b6f', opacity: 100, pressure: true, stabilization: 28, pencil: {pencilOnly:false, tiltShading:true, doubleTapTogglesEraser:true}, grain: preset.grain };
    const points = Array.from({ length: 48 }, (_, i) => ({ x: 15 + i * 3.2, y: 25 + Math.sin(i / 47 * Math.PI * 2) * 8, p: .5 + Math.sin(i / 47 * Math.PI) * .5, tilt: 0 }));
    renderBrushStroke(ctx, points, settings, 1, 73);
  }, [preset]);
  return <canvas ref={ref} width={188} height={50} aria-hidden="true"/>;
}
export function PrintBrushLibrary() {
  const studio = usePrintsStudio();
  const [family, setFamily] = useState('All'), [query, setQuery] = useState('');
  const presets = BRUSH_PRESETS.filter(p => (!FAMILIES[family].length || FAMILIES[family].includes(p.id)) && p.label.toLowerCase().includes(query.toLowerCase()));
  return <section className="print-brush-library"><div className="print-section-heading"><h3>Brush library</h3><span>{BRUSH_PRESETS.length} brushes</span></div><label className="print-search"><Search size={15}/><input aria-label="Search brushes" placeholder="Find a brush or material" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="print-brush-families" role="group" aria-label="Brush families">{Object.keys(FAMILIES).map(name => <button key={name} aria-pressed={family === name} onClick={() => setFamily(name)}>{name}</button>)}</div><div className="print-brush-swatches">{presets.map(p => <button key={p.id} aria-label={`Use ${p.label} brush`} aria-pressed={studio.brushPreset === p.id} onClick={() => { studio.setBrushPreset(p.id); studio.setTool('brush'); }}><BrushSwatch preset={p}/><span>{p.label}</span>{studio.brushPreset === p.id && <i/>}</button>)}</div>{!presets.length && <p className="print-empty">No brushes match this search.</p>}</section>;
}

type EditorProps = { elements: DesignElement[]; onChange: (elements: DesignElement[], selectedId?: string) => void; selectedId: string | null; onSelect: (id: string | null) => void; side: 'front' | 'back' };
export function PrintDesignInspector(props: EditorProps) {
  const studio = usePrintsStudio();
  const workspace = useAssetWorkspaceContext();
  const activeProps = workspace?.project ? {...props, elements: workspace.project.elements, onChange: workspace.change, selectedId: workspace.selectedId, onSelect: workspace.select, side: 'front' as const} : props;
  props = activeProps;
  const [tab, setTab] = useState('library');
  useEffect(() => { setTab('library'); }, [studio.panel]);
  useEffect(() => { if (props.selectedId) setTab('properties'); }, [props.selectedId]);
  const family = PRINT_TOOL_GROUPS.find(item => item.id === studio.panel)!;
  const selected = props.elements.find(item => item.id === props.selectedId);
  return <div className="print-design-inspector" data-print-tab={tab}><header className="materials-heading"><span className="builder-eyebrow">PRINT & DESIGN STUDIO</span><h2>{family.label}</h2><p>{family.hint}. Design directly on your garment.</p></header><div className="print-inspector-tabs" role="tablist" aria-label="Design inspector">{[{id:'library', label:'Tools', icon:Plus},{id:'properties',label:'Properties',icon:SlidersHorizontal},{id:'layers',label:'Layers',icon:Layers}].map(({id,label,icon:Icon}) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={15}/>{label}{id === 'layers' && <small>{props.elements.filter(el => (el.side ?? 'front') === props.side).length}</small>}</button>)}</div>{tab === 'properties' && !selected && <div className="print-empty"><MousePointer2 size={24}/><h3>Select your artwork</h3><p>Click a design on the canvas or choose a layer to adjust its appearance and placement.</p><button onClick={() => setTab('layers')}>View layers</button></div>}{studio.panel === 'brush' && tab === 'library' && <PrintBrushLibrary/>}<div className="print-editor-content"><PrintsDesignStep elements={props.elements} onChange={props.onChange} selectedLayerId={props.selectedId} onSelectedLayerIdChange={props.onSelect} garmentSide={props.side}/></div></div>;
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
  const drawing = studio.tool === 'brush' || studio.tool === 'eraser';
  return <div className="print-design-canvas">{project && <AssetWorkspaceHeader/>}<AssetWorkspaceDialogs/><div className="print-canvas-topbar"><div className="print-cursor-tools" role="toolbar" aria-label="Canvas tools">{[{id:'select',label:'Select',icon:MousePointer2},{id:'brush',label:'Draw',icon:Brush},{id:'eraser',label:'Erase',icon:Eraser}].map(({id,label,icon:Icon}) => <button key={id} title={label} aria-label={label} aria-pressed={studio.tool === id} onClick={() => { studio.setTool(id as 'select'|'brush'|'eraser'); if(id !== 'select')studio.setPanel('brush'); }}><Icon size={17}/><span>{label}</span></button>)}</div><div className="new-view-switch" role="group" aria-label="Garment view"><button aria-pressed={side === 'front'} onClick={() => onSide('front')}>Front</button><button aria-pressed={side === 'back'} onClick={() => onSide('back')}>Back</button></div></div>{drawing && <div className="print-quick-settings"><span>{studio.tool === 'eraser' ? 'Eraser' : BRUSH_PRESETS.find(p => p.id === studio.brushPreset)?.label}</span><label>Size<input aria-label="Canvas brush size" type="range" min="2" max="64" value={studio.tool === 'eraser' ? studio.eraserSize : studio.brushSize} onChange={e => studio.tool === 'eraser' ? studio.setEraserSize(+e.target.value) : studio.setBrushSize(+e.target.value)}/><output>{studio.tool === 'eraser' ? studio.eraserSize : studio.brushSize}px</output></label><label>Opacity<input aria-label="Canvas brush opacity" type="range" min="1" max="100" value={studio.opacity} onChange={e => studio.setOpacity(+e.target.value)}/><output>{studio.opacity}%</output></label></div>}<div className="print-garment-stage"><div style={{transform:`scale(${zoom / 100})`}}><PrintsDesignPreview canvasToolbar={false} assetMode={Boolean(project)} canvasSize={project ? {width:project.width,height:project.height} : {width:800,height:700}} garmentPreview={garment} garmentSide={project ? 'front' : side} elements={elements} onChange={change} selectedLayerId={selectedId} onSelectedLayerIdChange={id=>{select(id);if(id)responsive.setInspectorSnap('half')}} editable liveCanvasScale={zoom / 100}/></div></div>{selected && <div className="print-selection-actions" role="toolbar" aria-label="Selected artwork actions"><span>{selected.type === 'text' ? selected.content.slice(0,26) : selected.layerName ?? selected.type}</span><button aria-label="Duplicate selected artwork" title="Duplicate" onClick={()=>{const id=`print-${crypto.randomUUID()}`;change([...elements,{...structuredClone(selected),id,x:selected.x+12,y:selected.y+12}],id)}}><Copy size={16}/></button><button aria-label="Delete selected artwork" title="Delete" onClick={()=>{change(elements.filter(el=>el.id!==selected.id));select(null)}}><Trash2 size={16}/></button><button aria-label="Deselect artwork" title="Deselect" onClick={()=>select(null)}><X size={16}/></button></div>}<footer className="print-canvas-footer"><CanvasZoom value={zoom} min={50} max={200} onChange={onZoom} onFit={onFit}/><span>{project ? 'Asset artboard' : side === 'front' ? 'Front' : 'Back'} · {props.elements.filter(el => (el.side ?? 'front') === side).length} layers</span></footer></div>;
}
