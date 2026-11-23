import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Grid3x3 } from 'lucide-react';
import { activeVanishingPoints, DEFAULT_GUIDES, guidePaths, guidesActive, guidesFromBox, hasLineGuides, rulerTicks, skeletonCurves, skeletonPoint, type CustomGuide, type GuideSkeleton, type SkeletonKind, type StudioGuides as Guides, type SymmetryMode } from '../geometry/studioGuides';
import { getGuides, setGuideEditing, setGuides, useGuideEditing, useGuides } from '../state/studioGuides';
import { artworkBounds } from '../../../../lib/artworkGeometry';
import type { DesignElement } from '../../PrintStudioEditor';
import './studio-guides.css';

const SKELETONS: { id: SkeletonKind; label: string }[] = [{ id: 'arch', label: 'Arch' }, { id: 'wave', label: 'Wave' }, { id: 'banner', label: 'Banner' }, { id: 'circle', label: 'Circle' }, { id: 'ribbon', label: 'Ribbon' }, { id: 'perspective', label: 'Depth' }];
const skeletonIcon = (kind: SkeletonKind) => { const shape: GuideSkeleton = { on: true, kind, x: 50, y: 50, width: kind === 'circle' ? 86 : 84, height: kind === 'circle' ? 34 : 34, bend: kind === 'circle' ? 60 : 55, rows: 1 }; return skeletonCurves(shape, 44, 30, 28).map(curve => curve.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')).join(''); };
/** Move from the centre, size from the corner and bend from the top of the frame. */
function SkeletonHandles({ width, height, colour }: { width: number; height: number; colour: string }) {
  const frame = useRef<HTMLDivElement>(null), skeleton = useGuides().skeleton, top = skeletonPoint(skeleton, width, height, .5, 0), corner = skeletonPoint(skeleton, width, height, 0, 1), place = (point: { x: number; y: number }) => ({ left: `${point.x / width * 100}%`, top: `${point.y / height * 100}%`, color: colour });
  const begin = (kind: 'move' | 'size' | 'bend', event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation();
    const box = frame.current?.getBoundingClientRect(); if (!box?.width) return;
    const start = getGuides().skeleton, sx = event.clientX, sy = event.clientY, id = event.pointerId;
    const move = (next: PointerEvent) => { if (next.pointerId !== id) return; const dx = (next.clientX - sx) / box.width * 100, dy = (next.clientY - sy) / box.height * 100, now = getGuides(), patch = kind === 'move' ? { x: Math.round(Math.max(-50, Math.min(150, start.x + dx))), y: Math.round(Math.max(-50, Math.min(150, start.y + dy))) } : kind === 'size' ? { width: Math.round(Math.max(10, Math.min(150, start.width - dx * 2))), height: Math.round(Math.max(4, Math.min(100, start.height + dy * 2))) } : { bend: Math.round(Math.max(-100, Math.min(100, start.bend - dy / Math.max(1, start.height) * 110))) }; setGuides({ ...now, skeleton: { ...now.skeleton, ...patch } }); };
    const end = (next: PointerEvent) => { if (next.pointerId !== id) return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };
  return <div ref={frame} data-editor-chrome className="cx-guide-handles">
    <button type="button" data-guide-handle data-skeleton-handle="move" aria-label="Move layout" title="Move layout" style={{ left: `${skeleton.x}%`, top: `${skeleton.y}%`, color: colour, cursor: 'move' }} onPointerDown={event => begin('move', event)} />
    <button type="button" data-guide-handle data-skeleton-handle="bend" aria-label="Bend layout" title="Bend layout" style={{ ...place(top), cursor: 'ns-resize' }} onPointerDown={event => begin('bend', event)} />
    <button type="button" data-guide-handle data-skeleton-handle="size" aria-label="Resize layout" title="Resize layout" style={{ ...place(corner), borderRadius: 4, cursor: 'nesw-resize' }} onPointerDown={event => begin('size', event)} />
  </div>;
}

/** Drag from a ruler to add a guide, drag a guide to move it, drag it off the canvas to remove it. */
function moveCustomGuide(id: string, axis: CustomGuide['axis'], size: number, frame: HTMLElement, pointerId: number) {
  const place = (event: PointerEvent) => { const box = frame.getBoundingClientRect(), at = axis === 'x' ? (event.clientX - box.left) / box.width * size : (event.clientY - box.top) / box.height * size; return Math.round(at); };
  const move = (event: PointerEvent) => { if (event.pointerId !== pointerId) return; event.preventDefault(); const now = getGuides(); setGuides({ ...now, customGuides: now.customGuides.map(item => item.id === id ? { ...item, at: place(event) } : item) }); };
  const finish = (event: PointerEvent) => { if (event.pointerId !== pointerId) return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); const at = place(event), now = getGuides(); if (event.type === 'pointercancel' || at < 0 || at > size) setGuides({ ...now, customGuides: now.customGuides.filter(item => item.id !== id) }); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
}
function StudioRulers({ width, height, scale, guides, editing }: { width: number; height: number; scale: number; guides: Guides; editing: boolean }) {
  const frame = useRef<HTMLDivElement>(null), thick = 18 / Math.max(.01, scale), font = 9.5 / Math.max(.01, scale), line = 1 / Math.max(.01, scale);
  const across = rulerTicks(width, scale, guides.rulers.unit), down = rulerTicks(height, scale, guides.rulers.unit), topRuler = useRef<SVGSVGElement>(null), leftRuler = useRef<SVGSVGElement>(null);
  // Zoomed or panned, the canvas edge leaves the screen, so the rulers stay pinned to the visible area.
  useEffect(() => {
    let raf = 0, lastX = NaN, lastY = NaN;
    const pin = () => {
      const node = frame.current, stage = node?.closest('.print-garment-stage')?.getBoundingClientRect();
      if (node && stage) {
        const box = node.getBoundingClientRect(), unit = box.width / Math.max(1, width), rail = document.querySelector('.print-design-canvas > .artwork-canvas-tools')?.getBoundingClientRect(), leftEdge = Math.max(stage.left, rail && rail.bottom > stage.top ? rail.right + 6 : stage.left);
        const y = Math.max(0, Math.min(height - thick, (stage.top - box.top) / unit)), x = Math.max(0, Math.min(width - thick, (leftEdge - box.left) / unit));
        if (y !== lastY) { lastY = y; if (topRuler.current) topRuler.current.style.transform = `translateY(${y}px)`; }
        if (x !== lastX) { lastX = x; if (leftRuler.current) leftRuler.current.style.transform = `translateX(${x}px)`; }
      }
      raf = requestAnimationFrame(pin);
    };
    raf = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(raf);
  }, [width, height, thick]);
  const pull = (axis: CustomGuide['axis'], event: ReactPointerEvent) => { if (event.button !== 0 || !frame.current) return; event.preventDefault(); event.stopPropagation(); const id = crypto.randomUUID(), size = axis === 'x' ? width : height, box = frame.current.getBoundingClientRect(), at = Math.round(axis === 'x' ? (event.clientX - box.left) / box.width * width : (event.clientY - box.top) / box.height * height), now = getGuides(); setGuides({ ...now, customGuides: [...now.customGuides, { id, axis, at }] }); moveCustomGuide(id, axis, size, frame.current, event.pointerId); };
  return <div ref={frame} data-editor-chrome className="cx-rulers">
    <svg ref={topRuler} data-guide-control data-ruler="top" aria-label="Top ruler" role="img" viewBox={`0 0 ${width} ${thick}`} preserveAspectRatio="none" style={{ height: thick, cursor: 'row-resize' }} onPointerDown={event => pull('y', event)}>{across.minor.map(at => <line key={at} x1={at} x2={at} y1={thick * .72} y2={thick} strokeWidth={line} />)}{across.major.map(tick => <g key={tick.at}><line x1={tick.at} x2={tick.at} y1={0} y2={thick} strokeWidth={line} /><text x={tick.at + 3 * line} y={font} fontSize={font}>{tick.label}</text></g>)}</svg>
    <svg ref={leftRuler} data-guide-control data-ruler="left" aria-label="Left ruler" role="img" viewBox={`0 0 ${thick} ${height}`} preserveAspectRatio="none" style={{ width: thick, cursor: 'col-resize' }} onPointerDown={event => pull('x', event)}>{down.minor.map(at => <line key={at} y1={at} y2={at} x1={thick * .72} x2={thick} strokeWidth={line} />)}{down.major.map(tick => <g key={tick.at}><line y1={tick.at} y2={tick.at} x1={0} x2={thick} strokeWidth={line} /><text transform={`translate(${font} ${tick.at + 3 * line}) rotate(90)`} fontSize={font}>{tick.label}</text></g>)}</svg>
    {/* Guides only take the pointer while the Guides menu is open, so drawing across one never grabs it. */}
    {editing && guides.customGuides.map(guide => <button key={guide.id} type="button" data-guide-control data-custom-guide={guide.axis} aria-label={`Move ${guide.axis === 'x' ? 'vertical' : 'horizontal'} guide`} title="Drag to move, or off the canvas to remove" style={guide.axis === 'x' ? { left: `${guide.at / width * 100}%`, top: 0, bottom: 0, width: 9 / scale, marginLeft: -4.5 / scale, cursor: 'col-resize' } : { top: `${guide.at / height * 100}%`, left: 0, right: 0, height: 9 / scale, marginTop: -4.5 / scale, cursor: 'row-resize' }} onPointerDown={event => { if (event.button !== 0 || !frame.current) return; event.preventDefault(); event.stopPropagation(); moveCustomGuide(guide.id, guide.axis, guide.axis === 'x' ? width : height, frame.current, event.pointerId); }} />)}
  </div>;
}

/** Sits beside the artboard rather than inside it, so saved assets and print files can never include it. */
export function StudioGuidesOverlay({ width, height, scale = 1 }: { width: number; height: number; scale?: number }) {
  const guides = useGuides(), editing = useGuideEditing(), layer = useRef<HTMLDivElement>(null), paths = useMemo(() => guidesActive(guides) ? guidePaths(guides, width, height) : null, [guides, width, height]);
  if (!paths) return null;
  const drag = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    const box = layer.current?.getBoundingClientRect();
    if (!box?.width || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const now = getGuides(), points = now.perspective.points.map((point, i) => i === index ? { x: Math.round(Math.max(-100, Math.min(200, (event.clientX - box.left) / box.width * 100))), y: Math.round(Math.max(-100, Math.min(200, (event.clientY - box.top) / box.height * 100))) } : point);
    setGuides({ ...now, perspective: { ...now.perspective, points } });
  };
  return <>
    <svg data-editor-chrome data-studio-guides className="cx-guides" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ color: guides.colour, opacity: guides.opacity / 100 }}>
      <path d={paths.minor} strokeWidth=".5" opacity=".45" /><path d={paths.major} strokeWidth=".75" opacity=".8" /><path d={paths.axis} strokeWidth="1.25" />
    </svg>
    {editing && guides.perspective.on && <div ref={layer} data-editor-chrome className="cx-guide-handles">{activeVanishingPoints(guides.perspective).map((index, order) => { const point = guides.perspective.points[index]; return <button key={index} type="button" data-guide-handle aria-label={`Vanishing point ${order + 1}`} title="Drag vanishing point" style={{ left: `${point.x}%`, top: `${point.y}%`, color: guides.colour }} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => drag(index, event)} />; })}</div>}
    {editing && guides.skeleton.on && <SkeletonHandles width={width} height={height} colour={guides.colour} />}
    {(guides.rulers.on || guides.customGuides.length > 0) && <div className={guides.rulers.on ? undefined : 'cx-rulers-off'}><StudioRulers width={width} height={height} scale={scale} guides={guides} editing={editing} /></div>}
  </>;
}

const Slider = ({ label, value, min, max, unit = '', onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) => <label className="cx-guides-range"><span>{label}</span><input type="range" aria-label={label} min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /><output>{value}{unit}</output></label>;
const Section = ({ label, on, onToggle, children }: { label: string; on: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) => <section><label className="cx-guides-head"><span>{label}</span><input type="checkbox" aria-label={label} checked={on} onChange={event => onToggle(event.target.checked)} /></label>{on && <div className="cx-guides-body">{children}</div>}</section>;
const SYMMETRY: { id: SymmetryMode; label: string }[] = [{ id: 'off', label: 'Off' }, { id: 'vertical', label: 'Vertical' }, { id: 'horizontal', label: 'Horizontal' }, { id: 'quadrant', label: 'Quarter' }, { id: 'radial', label: 'Radial' }];

/** Bottom-bar menu for every drawing guide. */
export function GuidesMenu({ selection }: { selection?: DesignElement }) {
  const g = useGuides(), active = guidesActive(g) || g.angle.on;
  const part = <K extends 'grid' | 'isometric' | 'lettering' | 'perspective' | 'symmetry' | 'rulers' | 'skeleton' | 'angle'>(key: K, patch: Partial<Guides[K]>) => setGuides({ ...g, [key]: { ...g[key], ...patch } });
  const perspective = g.perspective, movePoint = (index: number, patch: { x?: number; y?: number }) => part('perspective', { points: perspective.points.map((point, i) => i === index ? { ...point, ...patch } : point) });
  return <Popover.Root modal={false} onOpenChange={setGuideEditing}>
    <Popover.Trigger asChild><button type="button" className="cx-dock-toggle cx-snap-trigger" aria-label="Guides" title="Guides" aria-pressed={active}><Grid3x3 size={15} /><span>Guides</span></button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="cx-guides-panel" side="top" sideOffset={10} align="end" alignOffset={-260} collisionPadding={12} aria-label="Drawing guides" onInteractOutside={event => { if ((event.detail.originalEvent.target as Element | null)?.closest?.('[data-guide-handle],[data-guide-control]')) event.preventDefault(); }}>
      <Section label="Rulers" on={g.rulers.on} onToggle={on => part('rulers', { on })}><div className="cx-guides-seg cx-guides-seg-2" role="group" aria-label="Ruler units">{(['px', 'cm'] as const).map(unit => <button key={unit} type="button" aria-pressed={g.rulers.unit === unit} onClick={() => part('rulers', { unit })}>{unit}</button>)}</div><div className="cx-guides-count"><span>{g.customGuides.length ? `${g.customGuides.length} ruler guide${g.customGuides.length > 1 ? 's' : ''}` : 'Drag from a ruler to add a guide'}</span>{g.customGuides.length > 0 && <button type="button" onClick={() => setGuides({ ...g, customGuides: [] })}>Remove</button>}</div></Section>
      <Section label="Grid" on={g.grid.on} onToggle={on => part('grid', { on })}><Slider label="Grid size" min={10} max={300} unit=" px" value={g.grid.size} onChange={size => part('grid', { size })} /><Slider label="Divisions" min={1} max={12} value={g.grid.divisions} onChange={divisions => part('grid', { divisions })} /></Section>
      <Section label="Isometric" on={g.isometric.on} onToggle={on => part('isometric', { on })}><Slider label="Iso size" min={10} max={200} unit=" px" value={g.isometric.size} onChange={size => part('isometric', { size })} /><Slider label="Angle" min={10} max={70} unit="°" value={g.isometric.angle} onChange={angle => part('isometric', { angle })} /></Section>
      <Section label="Lettering" on={g.lettering.on} onToggle={on => part('lettering', { on })}><Slider label="Rows" min={1} max={12} value={g.lettering.rows} onChange={rows => part('lettering', { rows })} /><Slider label="x-height" min={20} max={90} unit="%" value={g.lettering.xHeight} onChange={xHeight => part('lettering', { xHeight })} /><Slider label="Cap height" min={30} max={100} unit="%" value={g.lettering.capHeight} onChange={capHeight => part('lettering', { capHeight })} /><Slider label="Slant" min={-45} max={45} unit="°" value={g.lettering.slant} onChange={slant => part('lettering', { slant })} /></Section>
      <Section label="Perspective" on={perspective.on} onToggle={on => part('perspective', { on })}><div className="cx-guides-seg cx-guides-seg-3" role="group" aria-label="Vanishing points">{([1, 2, 3] as const).map(count => <button key={count} type="button" aria-pressed={perspective.count === count} onClick={() => part('perspective', { count })}>{count} point{count > 1 ? 's' : ''}</button>)}</div><Slider label="Lines" min={6} max={72} value={perspective.lines} onChange={lines => part('perspective', { lines })} />{activeVanishingPoints(perspective).map((index, order) => <div key={index} className="cx-guides-body"><Slider label={`Point ${order + 1} X`} min={-100} max={200} unit="%" value={perspective.points[index].x} onChange={x => movePoint(index, { x })} /><Slider label={`Point ${order + 1} Y`} min={-100} max={200} unit="%" value={perspective.points[index].y} onChange={y => movePoint(index, { y })} /></div>)}</Section>
      <Section label="Layout" on={g.skeleton.on} onToggle={on => part('skeleton', { on })}><div className="cx-skeletons" role="group" aria-label="Layout shape">{SKELETONS.map(item => <button key={item.id} type="button" aria-label={`${item.label} layout`} aria-pressed={g.skeleton.kind === item.id} onClick={() => part('skeleton', { kind: item.id })}><svg viewBox="0 0 44 30" aria-hidden="true"><path d={skeletonIcon(item.id)} /></svg><span>{item.label}</span></button>)}</div><Slider label="Bend" min={-100} max={100} unit="%" value={g.skeleton.bend} onChange={bend => part('skeleton', { bend })} /><Slider label="Lines" min={1} max={6} value={g.skeleton.rows} onChange={rows => part('skeleton', { rows })} /><Slider label="Width" min={10} max={150} unit="%" value={g.skeleton.width} onChange={width => part('skeleton', { width })} /><Slider label="Height" min={4} max={100} unit="%" value={g.skeleton.height} onChange={height => part('skeleton', { height })} /><Slider label="Across" min={-50} max={150} unit="%" value={g.skeleton.x} onChange={x => part('skeleton', { x })} /><Slider label="Down" min={-50} max={150} unit="%" value={g.skeleton.y} onChange={y => part('skeleton', { y })} /></Section>
      <section><span className="cx-guides-title">Symmetry</span><div className="cx-guides-seg" role="group" aria-label="Symmetry guide">{SYMMETRY.map(item => <button key={item.id} type="button" aria-pressed={g.symmetry.mode === item.id} onClick={() => part('symmetry', { mode: item.id })}>{item.label}</button>)}</div>{g.symmetry.mode === 'radial' && <div className="cx-guides-body"><Slider label="Segments" min={2} max={32} value={g.symmetry.segments} onChange={segments => part('symmetry', { segments })} /></div>}</section>
      <section><label className="cx-guides-head" title="Strokes follow the nearest guide line"><span>Assisted drawing</span><input type="checkbox" aria-label="Assisted drawing" disabled={!hasLineGuides(g)} checked={g.assisted && hasLineGuides(g)} onChange={event => setGuides({ ...g, assisted: event.target.checked })} /></label></section>
      <Section label="Angle snap" on={g.angle.on} onToggle={on => part('angle', { on })}><div className="cx-guides-seg cx-guides-seg-4" role="group" aria-label="Snap angle">{[15, 30, 45, 90].map(step => <button key={step} type="button" aria-pressed={g.angle.step === step} onClick={() => part('angle', { step })}>{step}°</button>)}</div><Slider label="Custom" min={1} max={90} unit="°" value={g.angle.step} onChange={step => part('angle', { step })} /></Section>
      <section><button type="button" className="cx-guides-action" disabled={!selection} title={selection ? 'Add guides along this object' : 'Select an object first'} onClick={() => { if (selection) setGuides({ ...g, customGuides: guidesFromBox(artworkBounds(selection), g.customGuides, () => crypto.randomUUID()) }); }}>Guides from selection</button></section>
      <footer><label className="cx-guides-colour"><span>Colour</span><input type="color" aria-label="Guide colour" value={g.colour} onChange={event => setGuides({ ...g, colour: event.target.value })} /></label><Slider label="Opacity" min={10} max={100} unit="%" value={g.opacity} onChange={opacity => setGuides({ ...g, opacity })} /><button type="button" disabled={!active} onClick={() => setGuides({ ...DEFAULT_GUIDES, colour: g.colour, opacity: g.opacity })}>Clear guides</button></footer>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
