import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Brush, Eraser, Trash2, Shuffle, Eye, EyeOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { WASH_TYPES, WASH_PLACEMENTS, updateWashView, washStrokePath, washStrokeFilterBounds, type GarmentWash, type WashBounds, type WashPoint, type WashStroke, type WashTool } from '../../data/garmentWash';
import type { GarmentView } from '../../data/garmentView';

const fieldClass = 'w-full min-w-0 rounded border border-white/15 bg-[#202023] px-2 py-2 text-xs text-white';
const buttonClass = 'inline-flex h-8 items-center justify-center gap-2 rounded border border-white/15 px-2 text-xs text-white/80 hover:bg-white/10 aria-pressed:bg-white/20 aria-pressed:border-white/60 disabled:opacity-30';

function WashSelect({ label, ariaLabel, value, options, onChange }: {
  label: string; ariaLabel: string; value: string; options: Record<string, string>; onChange: (value: string) => void;
}) {
  return <div className="space-y-2 text-xs text-white/70">
    <span>{label}</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className={fieldClass}><SelectValue /></SelectTrigger>
      <SelectContent className="z-[400] max-h-72 border-white/15 bg-[#202023] text-white shadow-xl">
        {Object.entries(options).map(([optionValue, title]) => <SelectItem key={optionValue} value={optionValue} className="text-xs text-white focus:bg-[#38383d] focus:text-white data-[state=checked]:bg-[#303035] [&_svg]:text-white">{title}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

function Range({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return <label className="block space-y-1.5 text-[11px] text-white/65"><span className="flex justify-between gap-2"><span>{label}</span><output>{Math.round(value)}</output></span>
    <input aria-label={label} type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} className="block w-full accent-[#b9ccff]" /></label>;
}

export function WashFinishPanel({ wash, onChange, view, tool, onToolChange, showWash, onShowWashChange }: {
  wash: GarmentWash; onChange: (wash: GarmentWash) => void; view: GarmentView;
  tool: WashTool; onToolChange: (tool: WashTool) => void; showWash: boolean; onShowWashChange: (show: boolean) => void;
}) {
  const change = (patch: Partial<GarmentWash>) => onChange({ ...wash, ...patch });
  const local = wash.views[view];
  const placement = local.placement ?? wash.placement;
  return <div className="space-y-5" data-wash-panel="">
    <WashSelect label="Wash style" ariaLabel="Wash style" value={wash.type} options={WASH_TYPES} onChange={type => change({ type: type as GarmentWash['type'] })} />
    {wash.type !== 'none' && <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{view} surface</span>
        <button type="button" className={buttonClass} title={showWash ? 'Show before' : 'Show after'} aria-label="Show wash" aria-pressed={showWash} onClick={() => onShowWashChange(!showWash)}>{showWash ? <Eye size={14} /> : <EyeOff size={14} />}{showWash ? 'After' : 'Before'}</button>
      </div>
      <WashSelect label="Placement" ariaLabel="Wash placement" value={placement} options={WASH_PLACEMENTS} onChange={value => onChange(updateWashView(wash, view, { ...local, placement: value as GarmentWash['placement'] }))} />
      <Range label="Intensity" value={wash.intensity} onChange={intensity => change({ intensity })} />
      {!['full', 'custom', 'sleeves'].includes(placement) && <><Range label="Spread / Size" value={wash.spread} onChange={spread => change({ spread })} /><Range label="Placement softness" value={wash.softness} onChange={softness => change({ softness })} /></>}
      <WashSelect label="Colour mode" ariaLabel="Wash colour mode" value={wash.mode} options={{ natural: 'Natural Fade', tinted: 'Tinted Fade', bleach: 'Bleach Fade' }} onChange={mode => change({ mode: mode as GarmentWash['mode'] })} />
      {wash.mode === 'tinted' && <label className="flex items-center justify-between text-xs text-white/70">Fade colour<input aria-label="Fade colour" type="color" value={wash.colour} onChange={event => change({ colour: event.target.value })} className="h-8 w-10 cursor-pointer bg-transparent" /></label>}
      {wash.mode !== 'tinted' && <Range label={wash.mode === 'bleach' ? 'Bleach strength' : 'Lighten / Darken'} min={wash.mode === 'bleach' ? 0 : -100} value={wash.mode === 'bleach' ? Math.abs(wash.tone) : wash.tone} onChange={tone => change({ tone })} />}
      <Range label="Blend strength" value={wash.blend} onChange={blend => change({ blend })} />
      <Range label="Noise scale" value={wash.noiseScale} onChange={noiseScale => change({ noiseScale })} />
      <Range label="Contrast" value={wash.contrast} onChange={contrast => change({ contrast })} />
      <div className="flex items-end gap-2"><label className="min-w-0 flex-1 space-y-1 text-[11px] text-white/60">Pattern seed<input aria-label="Pattern seed" type="number" min="0" max="99999" value={wash.seed} className={fieldClass} onChange={event => change({ seed: Math.max(0, Math.min(99999, Number(event.target.value))) })} /></label>
        <button type="button" title="Randomize pattern" aria-label="Randomize pattern" className={buttonClass} onClick={() => change({ seed: crypto.getRandomValues(new Uint32Array(1))[0] % 100000 })}><Shuffle size={15} /></button></div>
      <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={wash.autoWear} onChange={event => change({ autoWear: event.target.checked })} />Auto Wear</label>
      {(wash.autoWear || wash.type === 'stone') && <Range label="Wear strength" value={wash.wearStrength} onChange={wearStrength => change({ wearStrength })} />}
      <div className="space-y-4 border-t border-white/10 pt-4">
        <div className="flex gap-1" role="group" aria-label="Wash tools">
          <button type="button" className={buttonClass} title="Paint wash" aria-label="Paint wash" aria-pressed={!tool.erase} onClick={() => onToolChange({ ...tool, mode: 'brush', erase: false })}><Brush size={16} /></button>
          <button type="button" className={buttonClass} title="Erase wash" aria-label="Erase wash" aria-pressed={tool.erase} onClick={() => onToolChange({ ...tool, mode: 'brush', erase: true })}><Eraser size={16} /></button>
          <button type="button" className={`${buttonClass} ml-auto`} disabled={!local.strokes.length} title={`Clear ${view} brush mask`} aria-label="Clear painted wash" onClick={() => onChange(updateWashView(wash, view, { ...local, strokes: [] }))}><Trash2 size={15} /></button>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={wash.symmetry} onChange={event => change({ symmetry: event.target.checked })} />Mirror new marks</label>
        <Range label="Brush size" value={tool.size} min={1} max={50} onChange={size => onToolChange({ ...tool, size })} />
        <Range label="Brush strength" value={tool.strength} onChange={strength => onToolChange({ ...tool, strength })} />
        <Range label="Brush softness" value={tool.softness} onChange={softness => onToolChange({ ...tool, softness })} />
      </div>
    </>}
  </div>;
}

export function WashEditor({ wash, bounds, view, tool, onDraft, onCommit }: {
  wash: GarmentWash; bounds: WashBounds; view: GarmentView; tool: WashTool; onToolChange: (tool: WashTool) => void;
  onDraft: (wash: GarmentWash | null) => void; onCommit: (wash: GarmentWash) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<SVGCircleElement>(null);
  const cursorStyle = useRef('');
  const nativeCursor = useRef(false);
  const gesture = useRef<{ initial: GarmentWash; stroke: WashStroke; index: number; pointerId: number } | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    gesture.current = null;
  }, []);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const updateCursor = (matrix: DOMMatrix) => {
    const radius = tool.size / 100 * Math.min(width, height) / 2;
    const screenRadius = radius * Math.hypot(matrix.a, matrix.b);
    const size = Math.ceil(screenRadius * 2 + 4);
    const key = `${screenRadius}:${tool.erase}`;
    if (cursorStyle.current === key) return;
    cursorStyle.current = key;
    nativeCursor.current = size <= 128;
    if (!nativeCursor.current) {
      svgRef.current!.style.cursor = 'crosshair';
      return;
    }
    const center = Math.floor(size / 2);
    const colour = tool.erase ? '#ffadad' : '#ffffff';
    const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${center}" cy="${center}" r="${screenRadius}" fill="none" stroke="#000000" stroke-opacity=".65" stroke-width="3"/><circle cx="${center}" cy="${center}" r="${screenRadius}" fill="none" stroke="${colour}" stroke-width="1"/><circle cx="${center}" cy="${center}" r="1" fill="${colour}"/></svg>`;
    svgRef.current!.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(image)}") ${center} ${center}, crosshair`;
    if (cursorRef.current) cursorRef.current.style.visibility = 'hidden';
  };
  useLayoutEffect(() => {
    const matrix = svgRef.current?.getScreenCTM();
    if (matrix) updateCursor(matrix);
  });
  const pointAt = (event: { clientX: number; clientY: number }, inverse: DOMMatrix): WashPoint => {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    return { x: (point.x - bounds.minX) / width, y: (point.y - bounds.minY) / height };
  };
  const paint = () => {
    const active = gesture.current;
    if (!active) return;
    const paths = svgRef.current?.parentElement?.querySelectorAll<SVGPathElement>(`[data-wash-stroke="${active.index}"]`);
    const normal = washStrokePath(active.stroke.points, bounds);
    const mirrored = active.stroke.mirror ? washStrokePath(active.stroke.points, bounds, true) : normal;
    const normalBounds = washStrokeFilterBounds(active.stroke, bounds);
    const mirrorBounds = active.stroke.mirror ? washStrokeFilterBounds(active.stroke, bounds, true) : normalBounds;
    svgRef.current?.parentElement?.querySelectorAll<SVGFilterElement>(`[data-wash-filter="${active.index}"]`).forEach(filter => {
      const area = filter.dataset.washMirror === 'true' ? mirrorBounds : normalBounds;
      filter.setAttribute('x', String(area.minX));
      filter.setAttribute('y', String(area.minY));
      filter.setAttribute('width', String(area.maxX - area.minX));
      filter.setAttribute('height', String(area.maxY - area.minY));
    });
    paths?.forEach(path => path.setAttribute('d', path.dataset.washMirror === 'true' ? mirrored : normal));
  };
  useLayoutEffect(paint);
  const start = (event: ReactPointerEvent) => {
    if (event.button !== 0 || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    const point = pointAt(event, svgRef.current!.getScreenCTM()!.inverse());
    const local = wash.views[view];
    const stroke: WashStroke = { id: crypto.randomUUID(), points: [point], size: tool.size / 100, strength: tool.strength, softness: tool.softness, erase: tool.erase, mirror: wash.symmetry };
    gesture.current = { initial: wash, stroke: { ...stroke, points: [...stroke.points] }, index: local.strokes.length, pointerId: event.pointerId };
    svgRef.current!.setPointerCapture(event.pointerId);
    onDraft(updateWashView(wash, view, { ...local, strokes: [...local.strokes, stroke] }));
  };
  const move = (event: ReactPointerEvent, endpoint = false) => {
    const matrix = svgRef.current!.getScreenCTM()!;
    updateCursor(matrix);
    const inverse = matrix.inverse();
    const point = pointAt(event, inverse);
    if (cursorRef.current && !nativeCursor.current) {
      cursorRef.current.setAttribute('cx', String(bounds.minX + point.x * width));
      cursorRef.current.setAttribute('cy', String(bounds.minY + point.y * height));
      cursorRef.current.style.visibility = 'visible';
    }
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of [...samples, event.nativeEvent]) {
      const next = pointAt(sample, inverse);
      const previous = active.stroke.points[active.stroke.points.length - 1];
      const distance = Math.hypot((next.x - previous.x) * width, (next.y - previous.y) * height);
      if (distance >= (endpoint ? .001 : 2)) active.stroke.points.push(next);
    }
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; paint(); });
  };
  const finish = (event: ReactPointerEvent, cancel: boolean) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!cancel) move(event, true);
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (!cancel) {
      const local = active.initial.views[view];
      onCommit(updateWashView(active.initial, view, { ...local, strokes: [...local.strokes, active.stroke] }));
    }
    onDraft(null);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  };
  return <svg ref={svgRef} viewBox="0 0 2048 2048" data-wash-editor="" aria-label={`${view} wash canvas`} className="absolute inset-0 h-full w-full touch-none" style={{ zIndex: 300, cursor: 'crosshair' }}
    onPointerDown={start}
    onPointerMove={move} onPointerLeave={() => { if (cursorRef.current) cursorRef.current.style.visibility = 'hidden'; }} onPointerUp={event => finish(event, false)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
    <circle ref={cursorRef} r={tool.size / 100 * Math.min(width, height) / 2} fill="none" stroke={tool.erase ? '#ffadad' : '#ffffff'} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" style={{ visibility: 'hidden' }} />
  </svg>;
}