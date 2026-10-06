import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import { bendCustomAreaSegment, customAreaViewport, moveCustomAreaHandle, moveCustomAreaPoints, nearestCustomAreaSegment, splitCustomAreaSegment, type CustomAreaPoint } from '../../../lib/customAreaGeometry';
import { pathSegmentPoint, shapePointMapping } from '../../../lib/shapePathEditing';
import { usePrintsStudio } from './PrintsStudioContext';

type Hover = ReturnType<typeof nearestCustomAreaSegment>;
export function CustomAreaPathEditor({ element, scale, onChange, onPreview }: {
  element: DesignElement; scale: number; onChange: (points: CustomAreaPoint[]) => void; onPreview: (points: CustomAreaPoint[] | null) => void;
}) {
  const studio = usePrintsStudio();
  const svg = useRef<SVGSVGElement>(null);
  const cancelDrag = useRef<(() => void) | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [preview, setPreview] = useState<CustomAreaPoint[] | null>(null);
  const points = element.customAreaPoints ?? [];
  const shown = preview ?? points;
  const viewport = customAreaViewport(element);
  const mapping = shapePointMapping(element);
  const stored = studio.customAreaPointSelection;
  const selection = stored?.id === element.id ? (stored.indices ?? [stored.index]).filter(i => i >= 0 && i < points.length) : [];
  const choose = (indices: number[]) => studio.setCustomAreaPointSelection(indices.length ? { id: element.id, index: indices[0], indices } : null);
  const latest = useRef({ points, selection, onChange, onPreview, choose, done: () => studio.setTool('select') });
  latest.current = { points, selection, onChange, onPreview, choose, done: () => studio.setTool('select') };
  const project = (point: { x: number; y: number }) => mapping.project({ x: point.x / viewport.width * 100, y: point.y / viewport.height * 100 });
  const clientPoint = (x: number, y: number) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = mapping.inverse(new DOMPoint(x, y).matrixTransform(matrix.inverse()));
    return { x: point.x / 100 * viewport.width, y: point.y / 100 * viewport.height };
  };
  useEffect(() => () => cancelDrag.current?.(), []);
  useEffect(() => { cancelDrag.current?.(); setHover(null); }, [element.customAreaPoints]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const state = latest.current;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { cancelDrag.current?.(); return; }
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancelDrag.current?.(); state.done(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (state.selection.length && state.points.length - state.selection.length >= 3) {
          state.onChange(state.points.filter((_, i) => !state.selection.includes(i))); state.choose([]);
        }
      }
      if (event.key.startsWith('Arrow') && state.selection.length) {
        event.preventDefault(); event.stopImmediatePropagation();
        const step = event.shiftKey ? 10 : 1;
        state.onChange(moveCustomAreaPoints(state.points, state.selection, { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 }));
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);

  function drag(event: ReactPointerEvent, target: { index: number; handle?: 'in' | 'out'; segment?: Hover }) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); cancelDrag.current?.(); setHover(null);
    const base = points, start = clientPoint(event.clientX, event.clientY);
    let indices = selection;
    if (!target.segment && !target.handle) {
      indices = event.shiftKey || event.ctrlKey || event.metaKey ? selection.includes(target.index) ? selection.filter(i => i !== target.index) : [...selection, target.index]
        : selection.includes(target.index) ? selection : [target.index];
      choose(indices);
      if (!indices.includes(target.index)) return;
    }
    let finalPoints: CustomAreaPoint[] | null = null;
    let moved = false;
    const show = (next: CustomAreaPoint[] | null) => { setPreview(next); latest.current.onPreview(next); };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      if (!moved && Math.hypot(pointer.clientX - event.clientX, pointer.clientY - event.clientY) < 3) return;
      moved = true;
      const point = clientPoint(pointer.clientX, pointer.clientY), delta = { x: point.x - start.x, y: point.y - start.y };
      finalPoints = target.segment ? bendCustomAreaSegment(base, target.index, target.segment.t, delta)
        : target.handle ? moveCustomAreaHandle(base, target.index, target.handle, point) : moveCustomAreaPoints(base, indices, delta);
      show(finalPoints);
    };
    const clean = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); cancelDrag.current = null; };
    const cancel = () => { clean(); show(null); };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      clean();
      if (finalPoints) latest.current.onChange(finalPoints);
      else if (target.segment) { latest.current.onChange(splitCustomAreaSegment(base, target.index, target.segment.t)); choose([target.index + 1]); }
      show(null);
      if (studio.tool === 'customAreaAddPoint') studio.setTool('customAreaEdit');
    };
    cancelDrag.current = cancel;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel);
  }
  const rx = 5 / Math.max(0.1, scale) * 100 / element.width, ry = 5 / Math.max(0.1, scale) * 100 / element.height;
  const stroke = 1.5 / Math.max(0.1, scale);
  return <svg ref={svg} data-editor-chrome data-custom-area-path-editor aria-label="Editable Custom Area path" viewBox="0 0 100 100" preserveAspectRatio="none"
    className="pointer-events-none absolute inset-0 z-50 h-full w-full overflow-visible" onPointerLeave={() => { if (!cancelDrag.current) setHover(null); }}>
    {shown.map((a, index) => {
      const b = shown[(index + 1) % shown.length];
      const d = Array.from({ length: 65 }, (_, i) => project(pathSegmentPoint(a, b, i / 64))).map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
      return <g key={index}>
        <path d={d} fill="none" stroke="#ff6259" strokeWidth={stroke} vectorEffect="non-scaling-stroke" />
        <path data-custom-area-segment={index} d={d} fill="none" stroke="transparent" strokeWidth={12 / scale} vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-crosshair"
          onPointerMove={event => { if (!cancelDrag.current) setHover(nearestCustomAreaSegment(points, clientPoint(event.clientX, event.clientY), index)); }}
          onPointerDown={event => drag(event, { index, segment: nearestCustomAreaSegment(points, clientPoint(event.clientX, event.clientY), index) })} />
      </g>;
    })}
    {hover && !preview && (() => { const p = project(hover.point); return <g data-custom-area-insert className="pointer-events-auto cursor-copy"
      onPointerDown={event => drag(event, { index: hover.index, segment: hover })}>
      <ellipse cx={p.x} cy={p.y} rx={rx * 1.5} ry={ry * 1.5} fill="#fff" stroke="#ff6259" strokeWidth={stroke} vectorEffect="non-scaling-stroke" />
      <path d={`M ${p.x - rx} ${p.y} H ${p.x + rx} M ${p.x} ${p.y - ry} V ${p.y + ry}`} stroke="#c22" strokeWidth={stroke} vectorEffect="non-scaling-stroke" />
    </g>; })()}
    {shown.map((node, index) => { const p = project(node), selected = selection.includes(index); return <g key={index}>
      {selected && (['in', 'out'] as const).map(handle => {
        if (!node[handle]) return null;
        const h = project(node[handle]);
        return <g key={handle}><line x1={p.x} y1={p.y} x2={h.x} y2={h.y} stroke="#60a5fa" strokeWidth={stroke} vectorEffect="non-scaling-stroke" />
          <ellipse data-custom-area-handle={`${index}-${handle}`} cx={h.x} cy={h.y} rx={rx * .8} ry={ry * .8} fill="#60a5fa" stroke="white" strokeWidth={stroke} vectorEffect="non-scaling-stroke"
            className="pointer-events-auto cursor-move" onPointerDown={event => drag(event, { index, handle })} />
        </g>;
      })}
      <ellipse data-custom-area-point={index} aria-label={`Custom Area point ${index + 1}`} cx={p.x} cy={p.y} rx={rx * (selected ? 1.25 : 1)} ry={ry * (selected ? 1.25 : 1)}
        fill={selected ? '#ff6259' : '#fff'} stroke="#09090b" strokeWidth={stroke} vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-move"
        onPointerDown={event => drag(event, { index })} onClick={event => event.stopPropagation()} />
    </g>; })}
  </svg>;
}
