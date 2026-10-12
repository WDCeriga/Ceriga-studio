import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ForwardedRef, type PointerEvent as ReactPointerEvent } from 'react';
import { closestBoundaryPoint, distance, flattenSeam, pointInSurface, sampleSvgBoundaries, seamPath } from './panellingGeometry';
import { linkedMirrorSeams } from './panellingMirroring';
import { convertSeamToCurve, insertSeamAnchor, moveSeamAnchor, setAnchorMode, snapAnchor } from './panellingSeams';
import type { BoundaryLoop, PanellingPoint, PanellingSeam, PanelRegion, SeamAnchor } from './panellingTypes';

type Tool = 'pen' | 'select';
type SelectedAnchor = { seamId: string; anchorId: string };
type Drag = SelectedAnchor & { pointerId: number; mode: 'anchor' | 'handle'; handle?: 'incoming' | 'outgoing' };
const VIEW_SIZE = 2048;

export interface PanellingCanvasSelection extends SelectedAnchor {
  mode: NonNullable<SeamAnchor['handleMode']>;
  hasCurve: boolean;
}
export interface PanellingCanvasHandle {
  finish: () => void;
  cancel: () => void;
  undo: () => void;
  loadSeam: (seam: PanellingSeam) => void;
  convertSelectedToCurve: () => void;
  setSelectedAnchorMode: (mode: NonNullable<SeamAnchor['handleMode']>) => void;
}
interface PanellingCanvasProps {
  garmentMarkup: string;
  parentSurfaceId: string;
  parentLabel: string;
  parentFill: string;
  boundaries: BoundaryLoop[];
  symmetryAxis: number;
  seams: PanellingSeam[];
  panels: PanelRegion[];
  mirror: boolean;
  tool: Tool;
  selectedPanelId: string | null;
  onSeamsChange: (seams: PanellingSeam[]) => void;
  onPanelSelect: (id: string | null) => void;
  onBoundariesChange: (boundaries: BoundaryLoop[]) => void;
  onDrawingStateChange: (active: boolean) => void;
  onSelectionChange: (selection: PanellingCanvasSelection | null) => void;
}

function boundariesPath(boundaries: BoundaryLoop[]) {
  return boundaries.map(boundary => `M ${boundary.points.map(point => `${point.x} ${point.y}`).join(' L ')} Z`).join(' ');
}

function nearestAnchor(seams: PanellingSeam[], point: PanellingPoint, radius: number) {
  let match: { seamId: string; anchor: SeamAnchor; distance: number } | undefined;
  for (const seam of seams) for (const anchor of seam.anchors) {
    const current = distance(anchor, point);
    if (current <= radius && (!match || current < match.distance)) match = { seamId: seam.id, anchor, distance: current };
  }
  return match;
}

function nearestHandle(seams: PanellingSeam[], point: PanellingPoint, radius: number) {
  for (const seam of seams) for (const anchor of seam.anchors) {
    for (const handle of ['incoming', 'outgoing'] as const) {
      if (anchor[handle] && distance(anchor[handle]!, point) <= radius) return { seamId: seam.id, anchor, handle };
    }
  }
  return undefined;
}

function nearestSeam(seams: PanellingSeam[], point: PanellingPoint, radius: number) {
  let match: { seam: PanellingSeam; distance: number } | undefined;
  for (const seam of seams) {
    const points = flattenSeam(seam);
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index], b = points[index + 1], dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
      const current = distance(point, { x: a.x + t * dx, y: a.y + t * dy });
      if (current <= radius && (!match || current < match.distance)) match = { seam, distance: current };
    }
  }
  return match?.seam;
}

function PanellingCanvasInner({ garmentMarkup, parentSurfaceId, parentLabel, parentFill, boundaries, symmetryAxis, seams, panels, mirror, tool, selectedPanelId, onSeamsChange, onPanelSelect, onBoundariesChange, onDrawingStateChange, onSelectionChange }: PanellingCanvasProps, ref: ForwardedRef<PanellingCanvasHandle>) {
  const frameRef = useRef<HTMLDivElement>(null);
  const garmentRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<{ start: PanellingPoint; pointerId: number; dragged: boolean } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const continuationRef = useRef<{ seamId: string; at: 'start' | 'end' } | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<{ start: PanellingPoint; current: PanellingPoint; dragged: boolean } | null>(null);
  const [active, setActive] = useState<SeamAnchor[]>([]);
  const [cursor, setCursor] = useState<SeamAnchor | null>(null);
  const [selected, setSelected] = useState<SelectedAnchor | null>(null);
  const [snapFeedback, setSnapFeedback] = useState<PanellingPoint | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(760);
  const hitRadius = 14 * VIEW_SIZE / canvasWidth;
  const visibleSeams = linkedMirrorSeams(seams, symmetryAxis, mirror);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setCanvasWidth(Math.max(1, entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { onDrawingStateChange(active.length > 0); }, [active.length, onDrawingStateChange]);

  useEffect(() => {
    const svg = garmentRef.current?.querySelector('svg');
    if (!svg) return;
    try { onBoundariesChange(sampleSvgBoundaries(svg, parentSurfaceId)); }
    catch { onBoundariesChange([]); }
  }, [garmentMarkup, parentSurfaceId, onBoundariesChange]);

  const updateSelection = (selection: SelectedAnchor | null, sourceSeams = seams) => {
    setSelected(selection);
    if (!selection) { onSelectionChange(null); return; }
    const anchor = sourceSeams.find(seam => seam.id === selection.seamId)?.anchors.find(point => point.id === selection.anchorId);
    onSelectionChange(anchor ? { ...selection, mode: anchor.handleMode ?? 'corner', hasCurve: Boolean(anchor.incoming || anchor.outgoing) } : null);
  };

  const finish = () => {
    if (active.length < 2) { setActive([]); return; }
    const continuation = continuationRef.current && seams.find(seam => seam.id === continuationRef.current?.seamId);
    if (continuation && continuationRef.current) {
      const extension = continuationRef.current.at === 'end'
        ? active.slice(1)
        : active.slice(1).reverse().map(anchor => ({ ...anchor, incoming: anchor.outgoing, outgoing: anchor.incoming }));
      const anchors = continuationRef.current.at === 'end' ? [...continuation.anchors, ...extension] : [...extension, ...continuation.anchors];
      onSeamsChange(seams.map(seam => seam.id === continuation.id ? { ...seam, anchors } : seam));
    } else {
      const id = crypto.randomUUID();
      onSeamsChange([...seams, { id, label: `${parentLabel} seam ${seams.length + 1}`, parentSurfaceId, anchors: active, construction: 'standard', ...(mirror ? { mirrorGroupId: id, mirrorLinked: true } : {}) }]);
    }
    continuationRef.current = null;
    setActive([]);
    setCursor(null);
    updateSelection(null);
  };

  const cancel = () => {
    setActive([]);
    setCursor(null);
    setDrawingPreview(null);
    drawingRef.current = null;
    continuationRef.current = null;
  };

  const convertSelectedToCurve = () => {
    if (!selected) return;
    const seam = seams.find(item => item.id === selected.seamId);
    const index = seam?.anchors.findIndex(anchor => anchor.id === selected.anchorId) ?? -1;
    if (!seam || index < 0) return;
    let next = seam;
    if (index > 0) next = convertSeamToCurve(next, index - 1);
    if (index < next.anchors.length - 1) next = convertSeamToCurve(next, index);
    onSeamsChange(seams.map(item => item.id === seam.id ? next : item));
    updateSelection(selected, [next]);
  };

  const setSelectedAnchorMode = (mode: NonNullable<SeamAnchor['handleMode']>) => {
    if (!selected) return;
    const seam = seams.find(item => item.id === selected.seamId);
    if (!seam) return;
    const next = setAnchorMode(seam, selected.anchorId, mode);
    onSeamsChange(seams.map(item => item.id === seam.id ? next : item));
    updateSelection(selected, [next]);
  };

  useImperativeHandle(ref, () => ({
    finish,
    cancel,
    undo: () => active.length ? setActive(current => current.slice(0, -1)) : onSeamsChange(seams.slice(0, -1)),
    loadSeam: seam => onSeamsChange([...seams, seam]),
    convertSelectedToCurve,
    setSelectedAnchorMode,
  }), [active, seams, selected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (active.length) setActive(current => current.slice(0, -1));
        else onSeamsChange(seams.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active.length, seams, onSeamsChange]);

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): PanellingPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * VIEW_SIZE / bounds.width, y: (event.clientY - bounds.top) * VIEW_SIZE / bounds.height };
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !boundaries.length) return;
    const point = pointFromEvent(event), edge = closestBoundaryPoint(point, boundaries);
    if (!pointInSurface(point, boundaries) && (!edge || edge.distance > hitRadius)) return;
    if (tool === 'select') {
      const handle = nearestHandle(seams, point, hitRadius);
      if (handle) {
        dragRef.current = { pointerId: event.pointerId, seamId: handle.seamId, anchorId: handle.anchor.id, mode: 'handle', handle: handle.handle };
        updateSelection({ seamId: handle.seamId, anchorId: handle.anchor.id });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const anchor = nearestAnchor(seams, point, hitRadius);
      if (anchor) {
        dragRef.current = { pointerId: event.pointerId, seamId: anchor.seamId, anchorId: anchor.anchor.id, mode: 'anchor' };
        updateSelection({ seamId: anchor.seamId, anchorId: anchor.anchor.id });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const segment = nearestSeam(seams, point, hitRadius);
      if (segment) {
        const next = insertSeamAnchor(segment, point);
        onSeamsChange(seams.map(seam => seam.id === segment.id ? next : seam));
        const inserted = next.anchors.find(candidate => !segment.anchors.some(existing => existing.id === candidate.id));
        if (inserted) {
          dragRef.current = { pointerId: event.pointerId, seamId: segment.id, anchorId: inserted.id, mode: 'anchor' };
          updateSelection({ seamId: segment.id, anchorId: inserted.id });
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        return;
      }
      onPanelSelect(null);
      updateSelection(null);
      return;
    }

    const endpoint = nearestAnchor(seams.filter(seam => seam.anchors.length > 1), point, hitRadius);
    if (!active.length && endpoint) {
      const seam = seams.find(item => item.id === endpoint.seamId);
      const at = seam?.anchors[0]?.id === endpoint.anchor.id ? 'start' : seam?.anchors.at(-1)?.id === endpoint.anchor.id ? 'end' : null;
      if (seam && at) {
        setActive([endpoint.anchor]);
        continuationRef.current = { seamId: seam.id, at };
        updateSelection({ seamId: seam.id, anchorId: endpoint.anchor.id });
        return;
      }
    }
    drawingRef.current = { start: point, pointerId: event.pointerId, dragged: false };
    setDrawingPreview({ start: point, current: point, dragged: false });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event), snapped = snapAnchor(point, boundaries, seams);
    setCursor(snapped);
    setSnapFeedback(distance(point, snapped) > .5 ? snapped : null);
    const drawing = drawingRef.current;
    if (drawing?.pointerId === event.pointerId) {
      if (distance(drawing.start, point) > 8 * VIEW_SIZE / canvasWidth) drawing.dragged = true;
      setDrawingPreview({ start: drawing.start, current: point, dragged: drawing.dragged });
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextPoint = snapAnchor(point, boundaries, seams);
    onSeamsChange(seams.map(seam => {
      if (seam.id !== drag.seamId) return seam;
      if (drag.mode === 'anchor') return moveSeamAnchor(seam, drag.anchorId, nextPoint);
      return { ...seam, anchors: seam.anchors.map(anchor => {
        if (anchor.id !== drag.anchorId || !drag.handle) return anchor;
        if (anchor.handleMode === 'independent') return { ...anchor, [drag.handle]: nextPoint };
        const opposite = drag.handle === 'incoming' ? 'outgoing' : 'incoming';
        const oldOpposite = anchor[opposite], length = oldOpposite ? distance(anchor, oldOpposite) : distance(anchor, nextPoint);
        const dx = nextPoint.x - anchor.x, dy = nextPoint.y - anchor.y, magnitude = Math.hypot(dx, dy) || 1;
        return { ...anchor, [drag.handle]: nextPoint, [opposite]: { x: anchor.x - dx / magnitude * length, y: anchor.y - dy / magnitude * length } };
      }) };
    }));
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drawing = drawingRef.current;
    if (drawing?.pointerId === event.pointerId) {
      const end = pointFromEvent(event), anchor = snapAnchor(drawing.start, boundaries, seams);
      if (drawing.dragged) {
        const handle = end;
        setActive(points => [...points, { ...anchor, handleMode: 'smooth', outgoing: handle, incoming: { x: 2 * anchor.x - handle.x, y: 2 * anchor.y - handle.y } }]);
      } else setActive(points => [...points, { ...anchor, handleMode: 'corner' }]);
      drawingRef.current = null;
      setDrawingPreview(null);
    }
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const pending = drawingPreview ? (() => {
    const anchor = snapAnchor(drawingPreview.start, boundaries, seams);
    if (!drawingPreview.dragged) return { ...anchor, handleMode: 'corner' as const };
    const handle = drawingPreview.current;
    return { ...anchor, handleMode: 'smooth' as const, outgoing: handle,
      incoming: { x: 2 * anchor.x - handle.x, y: 2 * anchor.y - handle.y } };
  })() : null;
  const activePreview = !drawingPreview && active.length && cursor ? [...active.slice(-1), { ...cursor, id: 'cursor' }] : [];
  const pendingPath = pending ? [...active, pending] : [];
  const mirroredPreview = mirror && activePreview.length
    ? linkedMirrorSeams([{ id: 'active', label: 'Preview', anchors: activePreview, construction: 'standard' }], symmetryAxis, true)[1]?.anchors ?? []
    : [];

  return <div className="panelling-canvas-frame" ref={frameRef}>
    <div className="panelling-body" ref={garmentRef} dangerouslySetInnerHTML={{ __html: garmentMarkup }} />
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className={`panelling-overlay ${tool === 'pen' ? 'pen-mode' : 'select-mode'}`} role="application" aria-label={`T-shirt ${parentLabel} seam drawing canvas`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      <defs><clipPath id="panelling-parent-clip"><path d={boundariesPath(boundaries)} fillRule="evenodd" clipRule="evenodd" /></clipPath></defs>
      <g clipPath="url(#panelling-parent-clip)">
        {panels.map(panel => <path key={panel.id} data-panel-id={panel.id} d={panel.path} fill={panel.fillOverride ?? parentFill} fillOpacity={panel.fillOverride ? 1 : .035} stroke="none" onClick={event => { event.stopPropagation(); onPanelSelect(panel.id); }} />)}
        {visibleSeams.map(seam => <g key={seam.id}>
          <path d={seamPath(seam.anchors)} fill="none" stroke="transparent" strokeWidth={hitRadius * 2} vectorEffect="non-scaling-stroke" pointerEvents={tool === 'select' ? 'stroke' : 'none'} data-seam-id={seam.id} />
          <path d={seamPath(seam.anchors)} fill="none" stroke="#242924" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>)}
        {active.length > 1 && <path d={seamPath(active)} fill="none" stroke="#263126" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {pendingPath.length > 0 && <path d={seamPath(pendingPath)} fill="none" stroke="#d6ed80" strokeWidth="2" strokeDasharray="7 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {activePreview.length > 0 && <path d={seamPath(activePreview)} fill="none" stroke="#d6ed80" strokeWidth="2" strokeDasharray="7 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {mirroredPreview.length > 0 && <path d={seamPath(mirroredPreview)} fill="none" stroke="#d6ed80" strokeWidth="2" strokeDasharray="7 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {visibleSeams.filter(seam => selected?.seamId === seam.id || tool === 'select').map(seam => seam.anchors.map(anchor => <g key={anchor.id}>
          {anchor.incoming && <><line x1={anchor.x} y1={anchor.y} x2={anchor.incoming.x} y2={anchor.incoming.y} stroke="#99b84d" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.incoming.x} cy={anchor.incoming.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#748e38" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          {anchor.outgoing && <><line x1={anchor.x} y1={anchor.y} x2={anchor.outgoing.x} y2={anchor.outgoing.y} stroke="#99b84d" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.outgoing.x} cy={anchor.outgoing.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#748e38" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          <circle cx={anchor.x} cy={anchor.y} r={(selected?.seamId === seam.id && selected.anchorId === anchor.id ? 4.5 : 3.5) * VIEW_SIZE / canvasWidth} fill="#fff" stroke={selected?.anchorId === anchor.id ? '#a4c64d' : '#263126'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>))}
        {active.map(anchor => <g key={anchor.id}>
          {anchor.incoming && <><line x1={anchor.x} y1={anchor.y} x2={anchor.incoming.x} y2={anchor.incoming.y} stroke="#99b84d" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.incoming.x} cy={anchor.incoming.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#748e38" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          {anchor.outgoing && <><line x1={anchor.x} y1={anchor.y} x2={anchor.outgoing.x} y2={anchor.outgoing.y} stroke="#99b84d" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.outgoing.x} cy={anchor.outgoing.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#748e38" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          <circle cx={anchor.x} cy={anchor.y} r={3.5 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#263126" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>)}
        {pending && <g>
          {pending.incoming && <><line x1={pending.x} y1={pending.y} x2={pending.incoming.x} y2={pending.incoming.y} stroke="#99b84d" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={pending.incoming.x} cy={pending.incoming.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#748e38" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          {pending.outgoing && <><line x1={pending.x} y1={pending.y} x2={pending.outgoing.x} y2={pending.outgoing.y} stroke="#99b84d" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={pending.outgoing.x} cy={pending.outgoing.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#748e38" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          <circle cx={pending.x} cy={pending.y} r={3.5 * VIEW_SIZE / canvasWidth} fill="#fff" stroke="#263126" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>}
        {snapFeedback && <circle cx={snapFeedback.x} cy={snapFeedback.y} r={9 * VIEW_SIZE / canvasWidth} fill="none" stroke="#d6ed80" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />}
      </g>
    </svg>
    <div className="canvas-scale">{parentLabel.toUpperCase()} / FRONT <span>STANDARD SEAM</span></div>
  </div>;
}

export const PanellingCanvas = forwardRef(PanellingCanvasInner);