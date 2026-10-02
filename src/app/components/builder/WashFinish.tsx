import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Brush, Eraser, Trash2, Shuffle, Eye, EyeOff, RotateCcw, Shapes } from 'lucide-react';
import { WASH_TYPES, WASH_PLACEMENTS, updateWashView, type GarmentWash, type WashBounds, type WashPoint, type WashStroke, type WashShape, type WashTool } from '../../data/garmentWash';
import { HOODIE_WASH_REGIONS, clearHoodieWashOverride, defaultHoodieWash, resolveHoodieWash, updateHoodieWash, type HoodieWash, type HoodieWashTarget } from '../../data/hoodieWash';
import type { GarmentView } from '../../data/garmentView';

export type HoodieWashTool = WashTool & { shape: WashShape['kind'] };
const fieldClass = 'w-full min-w-0 rounded border border-white/15 bg-[#202023] px-2 py-2 text-xs text-white';
const buttonClass = 'inline-flex h-8 items-center justify-center gap-2 rounded border border-white/15 px-2 text-xs text-white/80 hover:bg-white/10 aria-pressed:bg-white/20 aria-pressed:border-white/60 disabled:opacity-30';

function WashSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Record<string, string>; onChange: (value: string) => void;
}) {
  return <label className="block space-y-2 text-xs text-white/70"><span>{label}</span>
    <select aria-label={label} className={fieldClass} value={value} onChange={event => onChange(event.target.value)}>
      {Object.entries(options).map(([optionValue, title]) => <option key={optionValue} value={optionValue}>{title}</option>)}
    </select></label>;
}

function Range({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return <label className="block space-y-1.5 text-[11px] text-white/65"><span className="flex justify-between gap-2"><span>{label}</span><output>{Math.round(value)}</output></span>
    <input aria-label={label} type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} className="block w-full accent-[#b9ccff]" /></label>;
}

export function HoodieWashPanel({ settings, onChange, target, onTargetChange, tool, onToolChange, showWash, onShowWashChange, regions }: {
  settings?: HoodieWash; onChange: (settings: HoodieWash | undefined) => void;
  target: HoodieWashTarget; onTargetChange: (target: HoodieWashTarget) => void;
  tool: HoodieWashTool; onToolChange: (tool: HoodieWashTool) => void; showWash: boolean; onShowWashChange: (show: boolean) => void;
  regions: string[];
}) {
  const view: GarmentView = 'front';
  const wash = resolveHoodieWash(settings, target);
  const changeWash = (next: GarmentWash) => onChange(updateHoodieWash(settings, target, next));
  const change = (patch: Partial<GarmentWash>) => changeWash({ ...wash, ...patch });
  const local = wash.views[view];
  const placement = local.placement ?? wash.placement;
  const override = target === 'global' || Boolean(settings?.regions[target]);
  return <div className="space-y-4" data-wash-panel="">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/50">Front surface</span>
      <button type="button" className={buttonClass} title="Reset wash" aria-label="Reset wash" onClick={() => { onChange(undefined); onTargetChange('global'); onShowWashChange(true); }}><RotateCcw size={15} /></button>
    </div>
    <WashSelect label="Wash region" value={target} options={{ global: 'Global', ...Object.fromEntries(Object.entries(HOODIE_WASH_REGIONS).filter(([region]) => regions.includes(region))) }} onChange={value => onTargetChange(value as HoodieWashTarget)} />
    {target !== 'global' && <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={override} onChange={event => onChange(event.target.checked
      ? updateHoodieWash(settings, target, structuredClone(wash))
      : clearHoodieWashOverride(settings ?? defaultHoodieWash(), target))} />Override global wash</label>}
    <fieldset disabled={!override} className="min-w-0 space-y-4 disabled:opacity-50">
      <WashSelect label="Wash style" value={wash.type} options={WASH_TYPES} onChange={type => change({ type: type as GarmentWash['type'] })} />
      {wash.type !== 'none' && <>
        <button type="button" className={buttonClass} title={showWash ? 'Show before' : 'Show after'} aria-label="Show wash" aria-pressed={showWash} onClick={() => onShowWashChange(!showWash)}>{showWash ? <Eye size={14} /> : <EyeOff size={14} />}{showWash ? 'After' : 'Before'}</button>
        <WashSelect label="Wash placement" value={placement} options={WASH_PLACEMENTS} onChange={value => changeWash(updateWashView(wash, view, { ...local, placement: value as GarmentWash['placement'] }))} />
        <Range label="Intensity" value={wash.intensity} onChange={intensity => change({ intensity })} />
        {!['full', 'custom', 'sleeves', 'hood'].includes(placement) && <><Range label="Spread / Size" value={wash.spread} onChange={spread => change({ spread })} /><Range label="Placement softness" value={wash.softness} onChange={softness => change({ softness })} /></>}
        <WashSelect label="Wash colour mode" value={wash.mode} options={{ natural: 'Natural Fade', tinted: 'Tinted Fade', bleach: 'Bleach Fade' }} onChange={mode => change({ mode: mode as GarmentWash['mode'] })} />
        {wash.mode === 'tinted' && <label className="flex items-center justify-between text-xs text-white/70">Fade colour<input aria-label="Fade colour" type="color" value={wash.colour} onChange={event => change({ colour: event.target.value })} className="h-8 w-10 cursor-pointer bg-transparent" /></label>}
        {wash.mode !== 'tinted' && <Range label={wash.mode === 'bleach' ? 'Bleach strength' : 'Lighten / Darken'} min={wash.mode === 'bleach' ? 0 : -100} value={wash.mode === 'bleach' ? Math.abs(wash.tone) : wash.tone} onChange={tone => change({ tone })} />}
        <Range label="Blend strength" value={wash.blend} onChange={blend => change({ blend })} />
        <Range label="Noise scale" value={wash.noiseScale} onChange={noiseScale => change({ noiseScale })} />
        <Range label="Contrast" value={wash.contrast} onChange={contrast => change({ contrast })} />
        <div className="flex items-end gap-2"><label className="min-w-0 flex-1 space-y-1 text-[11px] text-white/60">Pattern seed<input aria-label="Pattern seed" type="number" min="0" max="99999" value={wash.seed} className={fieldClass} onChange={event => change({ seed: Math.max(0, Math.min(99999, Math.trunc(Number(event.target.value)))) })} /></label>
          <button type="button" title="Randomize pattern" aria-label="Randomize pattern" className={buttonClass} onClick={() => change({ seed: crypto.getRandomValues(new Uint32Array(1))[0] % 100000 })}><Shuffle size={15} /></button></div>
        <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={wash.autoWear} onChange={event => change({ autoWear: event.target.checked })} />Auto Wear</label>
        {(wash.autoWear || wash.type === 'stone') && <Range label="Wear strength" value={wash.wearStrength} onChange={wearStrength => change({ wearStrength })} />}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex gap-1" role="group" aria-label="Wash tools">
            <button type="button" className={buttonClass} title="Paint wash" aria-label="Paint wash" aria-pressed={tool.mode === 'brush' && !tool.erase} onClick={() => onToolChange({ ...tool, mode: 'brush', erase: false })}><Brush size={16} /></button>
            <button type="button" className={buttonClass} title="Erase wash" aria-label="Erase wash" aria-pressed={tool.mode === 'brush' && tool.erase} onClick={() => onToolChange({ ...tool, mode: 'brush', erase: true })}><Eraser size={16} /></button>
            <button type="button" className={buttonClass} title="Shape wash" aria-label="Shape wash" aria-pressed={tool.mode === 'shape'} onClick={() => onToolChange({ ...tool, mode: 'shape', erase: false })}><Shapes size={16} /></button>
            <button type="button" className={`${buttonClass} ml-auto`} disabled={!local.strokes.length && !local.shapes.length} title="Clear wash marks" aria-label="Clear wash marks" onClick={() => changeWash(updateWashView(wash, view, { ...local, strokes: [], shapes: [] }))}><Trash2 size={15} /></button>
          </div>
          {tool.mode === 'shape' && <WashSelect label="Wash shape" value={tool.shape} options={{ circle: 'Circle', oval: 'Oval', rectangle: 'Rectangle', band: 'Band' }} onChange={shape => onToolChange({ ...tool, shape: shape as WashShape['kind'] })} />}
          <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={wash.symmetry} onChange={event => change({ symmetry: event.target.checked })} />Mirror new marks</label>
          {tool.mode === 'brush' && <Range label="Brush size" value={tool.size} min={1} max={50} onChange={size => onToolChange({ ...tool, size })} />}
          <Range label="Mark strength" value={tool.strength} onChange={strength => onToolChange({ ...tool, strength })} />
          <Range label="Mark softness" value={tool.softness} onChange={softness => onToolChange({ ...tool, softness })} />
        </div>
      </>}
    </fieldset>
  </div>;
}

export function WashEditor({ wash, bounds, view, tool, onDraft, onCommit }: {
  wash: GarmentWash; bounds: WashBounds; view: GarmentView; tool: HoodieWashTool;
  onDraft: (wash: GarmentWash | null) => void; onCommit: (wash: GarmentWash) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<SVGCircleElement>(null);
  const gesture = useRef<{ initial: GarmentWash; stroke: WashStroke; shape?: WashShape; start: WashPoint; pointerId: number } | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    gesture.current = null;
  }, []);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const pointAt = (event: { clientX: number; clientY: number }): WashPoint => {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
    return { x: (point.x - bounds.minX) / width, y: (point.y - bounds.minY) / height };
  };
  const nextWash = () => {
    const active = gesture.current!;
    const local = active.initial.views[view];
    return updateWashView(active.initial, view, active.shape
      ? { ...local, shapes: [...local.shapes, { ...active.shape }] }
      : { ...local, strokes: [...local.strokes, { ...active.stroke, points: [...active.stroke.points] }] });
  };
  const start = (event: ReactPointerEvent) => {
    if (event.button !== 0 || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    const point = pointAt(event);
    const stroke: WashStroke = { id: crypto.randomUUID(), points: [point], size: tool.size / 100, strength: tool.strength, softness: tool.softness, erase: tool.erase, mirror: wash.symmetry };
    gesture.current = { initial: wash, stroke, start: point, pointerId: event.pointerId,
      shape: tool.mode === 'shape' ? { id: stroke.id, kind: tool.shape, x: point.x, y: point.y, width: .001, height: .001, rotation: 0, intensity: tool.strength, softness: tool.softness, mirror: wash.symmetry } : undefined };
    svgRef.current!.setPointerCapture(event.pointerId);
    onDraft(nextWash());
  };
  const move = (event: ReactPointerEvent, endpoint = false) => {
    const point = pointAt(event);
    if (cursorRef.current) {
      cursorRef.current.setAttribute('cx', String(bounds.minX + point.x * width));
      cursorRef.current.setAttribute('cy', String(bounds.minY + point.y * height));
      cursorRef.current.style.visibility = tool.mode === 'brush' ? 'visible' : 'hidden';
    }
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.shape) {
      active.shape = { ...active.shape, x: (point.x + active.start.x) / 2, y: (point.y + active.start.y) / 2,
        width: Math.max(.001, Math.abs(point.x - active.start.x)), height: Math.max(.001, Math.abs(point.y - active.start.y)) };
    } else {
      const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
      for (const sample of [...samples, event.nativeEvent]) {
        const next = pointAt(sample);
        const previous = active.stroke.points[active.stroke.points.length - 1];
        const distance = Math.hypot((next.x - previous.x) * width, (next.y - previous.y) * height);
        if (distance >= (endpoint ? .001 : 2)) active.stroke.points.push(next);
      }
    }
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (gesture.current) onDraft(nextWash()); });
  };
  const finish = (event: ReactPointerEvent, cancel: boolean) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!cancel) move(event, true);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (!cancel) onCommit(nextWash());
    gesture.current = null;
    onDraft(null);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  };
  return <svg ref={svgRef} viewBox="0 0 2048 2048" data-wash-editor="" aria-label={`${view} wash canvas`} className="absolute inset-0 h-full w-full touch-none" style={{ zIndex: 300, cursor: 'crosshair' }}
    onPointerDown={start} onPointerMove={event => move(event)} onPointerLeave={() => { if (cursorRef.current) cursorRef.current.style.visibility = 'hidden'; }} onPointerUp={event => finish(event, false)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
    <circle ref={cursorRef} r={tool.size / 100 * Math.min(width, height) / 2} fill="none" stroke={tool.erase ? '#ffadad' : '#ffffff'} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" style={{ visibility: 'hidden' }} />
  </svg>;
}