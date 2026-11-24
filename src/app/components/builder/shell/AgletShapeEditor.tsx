import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ImagePlus, PenLine, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { tipOutlineFromFile } from '../../../lib/tipShape';
import { CUSTOM_TIP_PRESETS, DEFAULT_CUSTOM_TIP, TIP_FINISHES, TIP_MATERIALS, customTipMarkup, customTipPath, type CustomTip, type TipMaterial } from '../../../data/hoodieTrimAssets';

const SWATCH_STYLE = { '--detail-fill': '#e9e6df', '--detail-outline': '#1f1f1d', '--detail-stitch': '#f4f1ea', '--detail-hardware': '#c9c9c4' } as CSSProperties;
import './aglet-shape-editor.css';

const MIN_HALF_WIDTH = 1;
const snap = (value: number) => Math.round(value * 4) / 4;

/** Draw the drawstring tip. Both sides stay matched and the top stays open for the cord. */
export function AgletShapeEditor({ value, onChange }: { value?: CustomTip; onChange: (next: CustomTip) => void }) {
  const shape = value ?? DEFAULT_CUSTOM_TIP, svg = useRef<SVGSVGElement>(null), upload = useRef<HTMLInputElement>(null), [selected, setSelected] = useState<number | null>(null), [reading, setReading] = useState(false);
  const fromImage = async (file?: File) => {
    if (!file) return; setReading(true);
    try { onChange({ ...shape, outline: await tipOutlineFromFile(file) }); setSelected(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not use this image.'); }
    finally { setReading(false); if (upload.current) upload.current.value = ''; }
  };
  const material = shape.material ?? 'metal';
  const setPoint = (index: number, x: number, y: number) => {
    const previous = shape.half[index - 1], next = shape.half[index + 1], lowest = index === 0 ? 0 : (previous?.y ?? 0) + .25, highest = next ? next.y - .25 : 16;
    onChange({ ...shape, half: shape.half.map((point, i) => i === index ? { x: snap(Math.max(index === 0 ? MIN_HALF_WIDTH : 0, Math.min(8, x))), y: index === 0 ? 0 : snap(Math.max(lowest, Math.min(highest, y))) } : point) });
  };
  const drag = (index: number, event: ReactPointerEvent<SVGCircleElement>) => {
    event.preventDefault(); event.stopPropagation(); setSelected(index);
    const matrix = svg.current?.getScreenCTM()?.inverse(); if (!matrix) return;
    const pointer = event.pointerId, move = (next: PointerEvent) => { if (next.pointerId !== pointer) return; const p = new DOMPoint(next.clientX, next.clientY).matrixTransform(matrix); setPoint(index, Math.abs(p.x), p.y); };
    const end = (next: PointerEvent) => { if (next.pointerId !== pointer) return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };
  const addPoint = () => {
    let at = 0, longest = -1;
    for (let i = 0; i < shape.half.length - 1; i++) { const a = shape.half[i], b = shape.half[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y); if (length > longest) { longest = length; at = i; } }
    const a = shape.half[at], b = shape.half[at + 1], half = [...shape.half]; half.splice(at + 1, 0, { x: snap((a.x + b.x) / 2), y: snap((a.y + b.y) / 2) });
    onChange({ ...shape, half }); setSelected(at + 1);
  };
  const removePoint = () => { if (selected === null || selected === 0 || shape.half.length <= 2) return; onChange({ ...shape, half: shape.half.filter((_, i) => i !== selected) }); setSelected(null); };
  return <div className="aglet-shape-editor">
    <div className="aglet-shape-presets" role="group" aria-label="Tip shape starting points">{CUSTOM_TIP_PRESETS.map(preset => <button key={preset.id} type="button" aria-label={`${preset.label} tip shape`} title={preset.label} onClick={() => { onChange({ ...shape, ...preset.shape, outline: undefined }); setSelected(null); }}><svg viewBox="-9 -1 18 18" aria-hidden="true"><path d={customTipPath(preset.shape)} /></svg><span>{preset.label}</span></button>)}</div>
    <svg ref={svg} className="aglet-shape-canvas" viewBox="-10 -4 20 22" role="img" aria-label="Custom drawstring tip shape">
      <path className="aglet-grid" d="M-10 0H10M-10 8H10M-10 16H10M0 -4V18" />
      <rect className="aglet-cord" x="-1.3" y="-4" width="2.6" height="5" rx=".4" />
      <g style={SWATCH_STYLE} dangerouslySetInnerHTML={{ __html: customTipMarkup(shape) }} />
      {!shape.outline && shape.half.map((point, index) => <g key={index}><circle className="aglet-mirror" cx={-point.x} cy={point.y} r=".45" /><circle data-aglet-point={index} className="aglet-point" data-selected={selected === index || undefined} cx={point.x} cy={point.y} r=".72" onPointerDown={event => drag(index, event)} /></g>)}
    </svg>
    <input ref={upload} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Tip shape image" onChange={event => void fromImage(event.target.files?.[0])} />
    <div className="aglet-actions"><button type="button" disabled={reading} onClick={() => upload.current?.click()}><ImagePlus size={14} />{reading ? 'Reading…' : 'Upload shape'}</button>{shape.outline && <button type="button" onClick={() => onChange({ ...shape, outline: undefined })}><PenLine size={14} />Draw instead</button>}</div>
    {!shape.outline && <><label className="aglet-range"><span>Corners</span><input type="range" aria-label="Tip corner rounding" min={0} max={100} value={Math.round(shape.round * 100)} onChange={event => onChange({ ...shape, round: event.currentTarget.valueAsNumber / 100 })} /><output>{Math.round(shape.round * 100)}%</output></label>
    <div className="aglet-actions"><button type="button" onClick={addPoint}><Plus size={14} />Add point</button><button type="button" disabled={selected === null || selected === 0 || shape.half.length <= 2} onClick={removePoint}><Trash2 size={14} />Remove</button></div></>}
    <div className="aglet-materials" role="group" aria-label="Tip material">{(Object.keys(TIP_MATERIALS) as TipMaterial[]).map(id => <button key={id} type="button" aria-pressed={material === id} onClick={() => onChange({ ...shape, material: id })}><svg viewBox="-6 -1 12 18" aria-hidden="true" style={SWATCH_STYLE} dangerouslySetInnerHTML={{ __html: customTipMarkup({ ...DEFAULT_CUSTOM_TIP, half: CUSTOM_TIP_PRESETS[0].shape.half, round: .5, material: id, finish: shape.finish }) }} /><span>{TIP_MATERIALS[id]}</span></button>)}</div>
    {material === 'metal' ? <div className="aglet-finishes" role="group" aria-label="Metal finish">{(Object.keys(TIP_FINISHES) as (keyof typeof TIP_FINISHES)[]).map(id => <button key={id} type="button" aria-pressed={(shape.finish ?? 'polished') === id} onClick={() => onChange({ ...shape, finish: id })}>{TIP_FINISHES[id]}</button>)}</div>
      : <label className="aglet-colour"><span>Colour</span><input type="color" aria-label="Tip colour" value={/^#[0-9a-f]{6}$/i.test(shape.colour ?? '') ? shape.colour : ({ rubber: '#2b2b2a', leather: '#7a4a2c', fauxLeather: '#5b3a28', wood: '#a8743f' } as Record<string, string>)[material] ?? '#e9e6df'} onChange={event => onChange({ ...shape, colour: event.target.value })} /></label>}
  </div>;
}
