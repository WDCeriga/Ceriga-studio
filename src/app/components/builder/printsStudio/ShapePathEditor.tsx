import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import type { ShapePath } from '../../../lib/shapeGeometry';
import { deleteShapePoints, moveShapePoints, pathSegmentPoint, shapePointMapping, smoothShapePoints, splitShapeSegment } from '../../../lib/shapePathEditing';

type Point = { x: number; y: number };
const button = 'rounded border border-white/25 bg-black/90 px-2 py-1 text-[10px] text-white disabled:opacity-40';

export function ShapePathEditor({ element, scale, onChange, onPreview, onDone }: {
  element: DesignElement; scale: number; onChange: (path: ShapePath) => void;
  onPreview: (path: ShapePath | null) => void; onDone: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [subpath, setSubpath] = useState(-1);
  const [selection, setSelection] = useState<number[]>([]);
  const cancelDrag = useRef<(() => void) | null>(null);
  const path = element.shapePath!;
  const activePath = subpath < 0 ? path : path.subpaths?.[subpath] ?? path;
  const latest = useRef({ path, activePath, onChange, onPreview, onDone, selection, subpath });
  latest.current = { path, activePath, onChange, onPreview, onDone, selection, subpath };
  const mapping = shapePointMapping(element);
  const radius = 4 / Math.max(0.1, scale) * 100 / Math.max(element.width, element.height);
  function replace(next: ShapePath, base = path): ShapePath {
    return subpath < 0 ? next : { ...base, subpaths: base.subpaths?.map((part, index) => index === subpath ? next : part) };
  }
  function apply(next: ShapePath) { onChange(replace(next)); }
  useEffect(() => () => { cancelDrag.current?.(); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const state = latest.current;
      const store = (next: ShapePath) => state.onChange(state.subpath < 0 ? next : { ...state.path, subpaths: state.path.subpaths?.map((part, index) => index === state.subpath ? next : part) });
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancelDrag.current?.(); state.onDone(); }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); event.stopImmediatePropagation();
        store(deleteShapePoints(state.activePath, state.selection)); setSelection([]);
      }
      if (event.key.startsWith('Arrow') && state.selection.length) {
        const step = event.shiftKey ? 5 : 1;
        const delta = { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 };
        event.preventDefault(); event.stopImmediatePropagation(); store(moveShapePoints(state.activePath, state.selection, delta));
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  function clientPoint(clientX: number, clientY: number): Point {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return mapping.inverse(point);
  }
  function drag(event: ReactPointerEvent, index: number, handle?: 'in' | 'out') {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    cancelDrag.current?.();
    const indices = handle ? selection : event.shiftKey ? selection.includes(index) ? selection.filter(i => i !== index) : [...selection, index] : selection.includes(index) ? selection : [index];
    if (!handle) setSelection(indices);
    if (!handle && !indices.includes(index)) return;
    const start = clientPoint(event.clientX, event.clientY), base = activePath;
    let finalPath: ShapePath | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const point = clientPoint(e.clientX, e.clientY);
      const next = handle ? { ...base, nodes: base.nodes.map((node, i) => i === index ? { ...node, [handle]: point } : node) }
        : moveShapePoints(base, indices, { x: point.x - start.x, y: point.y - start.y });
      finalPath = replace(next);
      onPreview(finalPath);
    };
    const clean = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel);
      cancelDrag.current = null;
    };
    const cancel = () => { clean(); latest.current.onPreview(null); };
    const end = (e: PointerEvent) => { if (e.pointerId !== event.pointerId) return; clean(); if (finalPath) onChange(finalPath); onPreview(null); };
    cancelDrag.current = cancel;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel);
  }
  function segment(index: number) {
    const a = activePath.nodes[index], b = activePath.nodes[(index + 1) % activePath.nodes.length];
    return Array.from({ length: 33 }, (_, i) => mapping.project(pathSegmentPoint(a, b, i / 32))).map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  }
  return <div data-shape-path-editor data-editor-chrome className="pointer-events-none absolute inset-0 z-50">
    <div className="pointer-events-auto absolute bottom-full left-0 mb-3 flex w-max max-w-[320px] flex-wrap gap-1" style={{ transformOrigin: 'bottom left', scale: 1 / scale }}>
      {path.subpaths?.length ? <select className={button} aria-label="Path contour" value={subpath} onChange={event => { setSubpath(Number(event.target.value)); setSelection([]); }}>
        <option value={-1}>Outer path</option>{path.subpaths.map((_, index) => <option key={index} value={index}>Inner path {index + 1}</option>)}
      </select> : null}
      <button className={button} disabled={!selection.length} onClick={() => apply(smoothShapePoints(activePath, selection, true))}>Curve points</button>
      <button className={button} disabled={!selection.length} onClick={() => apply(smoothShapePoints(activePath, selection, false))}>Corner points</button>
      <button className={button} disabled={!selection.length} onClick={() => { apply(deleteShapePoints(activePath, selection)); setSelection([]); }}>Delete points</button>
      <button className={button} onClick={onDone}>Done</button>
    </div>
    <svg ref={svg} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-label="Editable shape path">
      {activePath.nodes.slice(0, activePath.closed ? undefined : -1).map((_, index) => <path key={index} d={segment(index)} fill="none" stroke="#ff6259" strokeWidth={1 / scale} vectorEffect="non-scaling-stroke"
        className="pointer-events-auto cursor-copy" style={{ strokeWidth: 7 / scale, stroke: '#ff625955' }}
        onPointerDown={event => event.stopPropagation()}
        onDoubleClick={event => {
          event.preventDefault(); event.stopPropagation();
          const point = clientPoint(event.clientX, event.clientY);
          let nearest = 0.5, distance = Infinity;
          for (let i = 1; i < 100; i++) { const p = pathSegmentPoint(activePath.nodes[index], activePath.nodes[(index + 1) % activePath.nodes.length], i / 100); const d = Math.hypot(p.x - point.x, p.y - point.y); if (d < distance) { distance = d; nearest = i / 100; } }
          apply(splitShapeSegment(activePath, index, nearest)); setSelection([index + 1]);
        }} />)}
      {activePath.nodes.map((node, index) => {
        const p = mapping.project(node);
        return <g key={index}>
          {selection.includes(index) && (['in', 'out'] as const).map(handle => {
            if (!node[handle]) return null;
            const h = mapping.project(node[handle]);
            return <g key={handle}><line x1={p.x} y1={p.y} x2={h.x} y2={h.y} stroke="#60a5fa" strokeWidth={1 / scale} vectorEffect="non-scaling-stroke" />
              <circle aria-label={`Curve ${handle} handle ${index + 1}`} data-shape-curve-handle={handle} cx={h.x} cy={h.y} r={radius * 0.85} fill="#60a5fa" stroke="white" strokeWidth={1 / scale} vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-move" onPointerDown={event => drag(event, index, handle)} /></g>;
          })}
          <circle role="button" aria-label={`Shape anchor ${index + 1}`} aria-pressed={selection.includes(index)} data-shape-anchor={index} cx={p.x} cy={p.y} r={radius} fill={selection.includes(index) ? '#ff3b30' : 'white'} stroke="#ff3b30" strokeWidth={1.5 / scale} vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-move" onPointerDown={event => drag(event, index)} />
        </g>;
      })}
    </svg>
  </div>;
}

export function ShapePolygonDraft({ width, height, color, onComplete, onCancel }: {
  width: number; height: number; color: string; onComplete: (points: Point[]) => void; onCancel: () => void;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point>();
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest('input, textarea, select')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onCancel(); }
      if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); event.stopImmediatePropagation(); setPoints(previous => previous.slice(0, -1)); }
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [onCancel]);
  function point(event: ReactPointerEvent) {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }
  return <div data-shape-polygon-draft data-editor-chrome className="pointer-events-auto absolute inset-0 z-[60] cursor-crosshair">
    <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/85 p-2 text-[11px] text-white">Click to add points; click the first point to close. Escape cancels.</div>
    <svg ref={svg} viewBox={`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`} className="h-full w-full overflow-visible" preserveAspectRatio="none"
      onPointerMove={event => setCursor(point(event))}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); setPoints(previous => [...previous, point(event)]); }}>
      <polyline points={[...points, ...(cursor ? [cursor] : [])].map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={/^#[0-9a-f]{3,8}$/i.test(color) ? color : '#ff3b30'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {points.map((p, index) => <circle key={index} aria-label={index === 0 ? 'Close custom polygon' : `Draft point ${index + 1}`} cx={p.x} cy={p.y} r={6} fill={index === 0 && points.length >= 3 ? '#ff3b30' : 'white'} stroke="#ff3b30" strokeWidth={2}
        onPointerDown={event => { event.preventDefault(); event.stopPropagation(); if (index === 0 && points.length >= 3) onComplete(points); }} />)}
    </svg>
  </div>;
}
