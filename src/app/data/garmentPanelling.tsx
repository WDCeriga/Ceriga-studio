import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export type GarmentPanelPoint = [number, number];
export type GarmentPanelTool = 'select' | 'pen';
export type GarmentPanelShape = 'rectangle' | 'circle' | 'star';
export type GarmentPanelType = 'cut-replace' | 'overlay';
export type GarmentPanelEdgeConstruction =
  | 'seam'
  | 'single-topstitch'
  | 'flatlock'
  | 'overlock'
  | 'raw'
  | 'binding'
  | 'tape'
  | 'welded'
  | 'zip'
  | 'outline'
  | 'none';

export interface GarmentPanel {
  id: string;
  name: string;
  parentPartId: string;
  view: 'front' | 'back';
  geometry: { type: 'polygon'; points: GarmentPanelPoint[] };
  panelType: GarmentPanelType;
  colour?: string;
  fabricId?: string;
  materialGroup?: string;
  layerOrder: number;
  symmetryLink?: string;
  edgeConstruction: GarmentPanelEdgeConstruction;
  boundaryPath?: string;
  edges?: { id: string; path: string; construction: GarmentPanelEdgeConstruction }[];
}

export function smoothPanelPoints(controls: GarmentPanelPoint[], samplesPerCurve = 8): GarmentPanelPoint[] {
  if (controls.length < 3) return controls;
  const points: GarmentPanelPoint[] = [];
  for (let index = 0; index < controls.length; index++) {
    const p0 = controls[(index - 1 + controls.length) % controls.length];
    const p1 = controls[index];
    const p2 = controls[(index + 1) % controls.length];
    const p3 = controls[(index + 2) % controls.length];
    for (let sample = 0; sample < samplesPerCurve; sample++) {
      const t = sample / samplesPerCurve;
      const t2 = t * t, t3 = t2 * t;
      points.push([
        .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return points;
}

function clipCanvasHalfPlane(a: GarmentPanelPoint, b: GarmentPanelPoint, sign: 1 | -1): GarmentPanelPoint[] {
  const rectangle: GarmentPanelPoint[] = [[0, 0], [2048, 0], [2048, 2048], [0, 2048]];
  const side = (point: GarmentPanelPoint) => ((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])) * sign;
  const clipped: GarmentPanelPoint[] = [];
  for (let index = 0; index < rectangle.length; index++) {
    const current = rectangle[index];
    const previous = rectangle[(index + rectangle.length - 1) % rectangle.length];
    const currentSide = side(current), previousSide = side(previous);
    if ((currentSide >= 0) !== (previousSide >= 0)) {
      const ratio = previousSide / (previousSide - currentSide);
      clipped.push([previous[0] + (current[0] - previous[0]) * ratio, previous[1] + (current[1] - previous[1]) * ratio]);
    }
    if (currentSide >= 0) clipped.push(current);
  }
  return clipped;
}

export function splitPanelAtLine(start: GarmentPanelPoint, end: GarmentPanelPoint) {
  return { first: clipCanvasHalfPlane(start, end, 1), second: clipCanvasHalfPlane(start, end, -1) };
}

export function clipPanelEdgeToFabric(start: GarmentPanelPoint, end: GarmentPanelPoint, fabric: number[][][][]): [GarmentPanelPoint, GarmentPanelPoint] | null {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const cuts = [0, 1];
  for (const polygon of fabric) for (const ring of polygon) {
    for (let index = 0; index < ring.length - 1; index++) {
      const [cx, cy] = ring[index], [ex, ey] = ring[index + 1];
      const edgeX = ex - cx, edgeY = ey - cy;
      const denominator = cross(dx, dy, edgeX, edgeY);
      if (Math.abs(denominator) < 1e-8) continue;
      const offsetX = cx - start[0], offsetY = cy - start[1];
      const alongPanel = cross(offsetX, offsetY, edgeX, edgeY) / denominator;
      const alongRing = cross(offsetX, offsetY, dx, dy) / denominator;
      if (alongPanel >= 0 && alongPanel <= 1 && alongRing >= 0 && alongRing <= 1) cuts.push(alongPanel);
    }
  }
  const uniqueCuts = [...new Set(cuts)].sort((a, b) => a - b);
  const insideRing = (point: GarmentPanelPoint, ring: number[][]) => {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [x, y] = ring[index], [previousX, previousY] = ring[previous];
      if ((y > point[1]) !== (previousY > point[1]) &&
        point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x) inside = !inside;
    }
    return inside;
  };
  const insideFabric = (point: GarmentPanelPoint) => fabric.some(polygon =>
    insideRing(point, polygon[0]) && !polygon.slice(1).some(hole => insideRing(point, hole)));
  const intervals: [number, number][] = [];
  for (let index = 0; index < uniqueCuts.length - 1; index++) {
    const from = uniqueCuts[index], to = uniqueCuts[index + 1], middle = (from + to) / 2;
    if (insideFabric([start[0] + dx * middle, start[1] + dy * middle])) intervals.push([from, to]);
  }
  const longest = intervals.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  if (!longest) return null;
  return [
    [start[0] + dx * longest[0], start[1] + dy * longest[0]],
    [start[0] + dx * longest[1], start[1] + dy * longest[1]],
  ];
}

export function panelEdgeDefinitions(panel: GarmentPanel): { id: string; path: string; construction: GarmentPanelEdgeConstruction; start: GarmentPanelPoint; end: GarmentPanelPoint }[] {
  const points = panel.geometry.points;
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const id = `edge-${index}`;
    const saved = panel.edges?.find(edge => edge.id === id);
    return { id, path: `M${point[0]},${point[1]}L${next[0]},${next[1]}`, construction: saved?.construction ?? panel.edgeConstruction, start: point, end: next };
  });
}

export interface GarmentPanellingEditor {
  enabled: boolean;
  tool: GarmentPanelTool;
  targetPartId: string;
  finishRequest: number;
  selectedPanelId: string | null;
  selectedEdgeId: string | null;
  zipRequest?: { panelId: string; edgeId: string; parentPartId: string; nonce: number };
  onSelect: (id: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onCreate: (points: GarmentPanelPoint[]) => void;
  onCreateZip: (panelId: string, start: GarmentPanelPoint, end: GarmentPanelPoint) => void;
  onZipRequestHandled: () => void;
  onDraftPointCountChange: (count: number) => void;
  onMoveAnchor: (panelId: string, anchorIndex: number, point: GarmentPanelPoint) => void;
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function panelPath(points: GarmentPanelPoint[]): string {
  if (!points.length) return '';
  return `M${points.map(([x, y]) => `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`).join('L')}Z`;
}

export function panelShapePoints(shape: GarmentPanelShape, first: GarmentPanelPoint, second: GarmentPanelPoint): GarmentPanelPoint[] {
  const left = Math.min(first[0], second[0]);
  const right = Math.max(first[0], second[0]);
  const top = Math.min(first[1], second[1]);
  const bottom = Math.max(first[1], second[1]);
  if (shape === 'rectangle') return [[left, top], [right, top], [right, bottom], [left, bottom]];
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const radiusX = Math.max(1, (right - left) / 2);
  const radiusY = Math.max(1, (bottom - top) / 2);
  const count = shape === 'star' ? 10 : 32;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    const radius = shape === 'star' && index % 2 ? .43 : 1;
    return [centerX + Math.cos(angle) * radiusX * radius, centerY + Math.sin(angle) * radiusY * radius];
  });
}

function sourceContents(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

const PEN_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M4 28l4-10L21 5l6 6-13 13-10 4z' fill='%23fff' stroke='%230f172a' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='M8 18l6 6M21 5l6 6M4 28l4-10' fill='none' stroke='%230f172a' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 4 28, crosshair";

export function GarmentPanelOverlay({ panels, view, parentPartId, sourceSvgRaw, editor }: {
  panels: GarmentPanel[];
  view: 'front' | 'back';
  parentPartId: string;
  sourceSvgRaw: string;
  editor?: GarmentPanellingEditor;
}) {
  const clipId = useId().replace(/:/g, '');
  const [draft, setDraft] = useState<GarmentPanelPoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<GarmentPanelPoint | null>(null);
  const [anchorDraft, setAnchorDraft] = useState<GarmentPanelPoint | null>(null);
  const pointer = useRef<{ id: number; start: GarmentPanelPoint; anchor?: { panelId: string; index: number } } | null>(null);
  const handledZipRequest = useRef<number | null>(null);
  const handledFinishRequest = useRef(editor?.finishRequest ?? 0);
  const visiblePanels = panels.filter(panel => panel.view === view && panel.parentPartId === parentPartId);
  const selectedPanel = visiblePanels.find(panel => panel.id === editor?.selectedPanelId);

  useEffect(() => {
    setDraft([]);
    setHoverPoint(null);
    setAnchorDraft(null);
    pointer.current = null;
    editor?.onDraftPointCountChange(0);
  }, [editor?.enabled, editor?.tool, editor?.targetPartId, editor?.selectedPanelId, parentPartId, view]);

  useEffect(() => {
    const request = editor?.zipRequest;
    if (!request || request.parentPartId !== parentPartId || handledZipRequest.current === request.nonce) return;
    const panel = visiblePanels.find(item => item.id === request.panelId);
    const edge = panel && panelEdgeDefinitions(panel).find(item => item.id === request.edgeId);
    if (!panel || !edge) return;
    handledZipRequest.current = request.nonce;
    editor.onCreateZip(panel.id, edge.start, edge.end);
    editor.onZipRequestHandled();
  }, [editor?.zipRequest?.nonce, editor, parentPartId, visiblePanels]);

  const pointAt = (event: ReactPointerEvent<SVGSVGElement>): GarmentPanelPoint => {
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) throw new Error('Panel drawing canvas is not ready.');
    const local = point.matrixTransform(matrix.inverse());
    return [Math.max(0, Math.min(2048, local.x)), Math.max(0, Math.min(2048, local.y))];
  };
  const complete = (points: GarmentPanelPoint[]) => {
    if (points.length < 3) return;
    const area = Math.abs(points.reduce((sum, [x, y], index) => {
      const next = points[(index + 1) % points.length];
      return sum + x * next[1] - next[0] * y;
    }, 0)) / 2;
    if (area < 800) return;
    editor?.onCreate(points);
    setDraft([]);
    editor?.onDraftPointCountChange(0);
    setHoverPoint(null);
  };
  useEffect(() => {
    if (!editor || handledFinishRequest.current === editor.finishRequest) return;
    handledFinishRequest.current = editor.finishRequest;
    if (editor.tool === 'pen') complete(draft);
  }, [editor?.finishRequest]);
  const edgeDistance = (point: GarmentPanelPoint, start: GarmentPanelPoint, end: GarmentPanelPoint) => {
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared)) : 0;
    return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
  };
  const panelAt = (point: GarmentPanelPoint) => [...visiblePanels].reverse().find(panel => {
    let inside = false;
    const points = panel.geometry.points;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
      const [x, y] = points[index], [previousX, previousY] = points[previous];
      if ((y > point[1]) !== (previousY > point[1]) &&
        point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x) inside = !inside;
    }
    return inside;
  });
  const isCloseToFirstPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const firstPoint = draft[0];
    const matrix = event.currentTarget.getScreenCTM();
    if (!firstPoint || !matrix) return false;
    const screenPoint = new DOMPoint(firstPoint[0], firstPoint[1]).matrixTransform(matrix);
    return Math.hypot(event.clientX - screenPoint.x, event.clientY - screenPoint.y) <= 14;
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editor?.enabled || event.button !== 0) return;
    const point = pointAt(event);
    if (editor.tool === 'pen') {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      const close = draft.length >= 3 && isCloseToFirstPoint(event);
      if (close) complete(draft);
      else {
        const next = [...draft, point];
        setDraft(next);
        editor.onDraftPointCountChange(next.length);
      }
    } else if (editor.tool === 'select') {
      event.preventDefault();
      event.stopPropagation();
      const edgeHit = visiblePanels.flatMap(panel => panelEdgeDefinitions(panel).map(edge => ({
        panel, edge, distance: edgeDistance(point, edge.start, edge.end),
      }))).filter(hit => hit.distance <= 28).sort((a, b) => a.distance - b.distance)[0];
      if (edgeHit) {
        editor.onSelect(edgeHit.panel.id);
        editor.onSelectEdge(edgeHit.edge.id);
        return;
      }
      const panel = panelAt(point);
      editor.onSelect(panel?.id ?? null);
      editor.onSelectEdge(null);
    }
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = pointer.current;
    const point = pointAt(event);
    if (!active || active.id !== event.pointerId) {
      setHoverPoint(editor?.tool === 'pen' ? point : null);
      return;
    }
    if (active.anchor) setAnchorDraft(point);
  };
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.anchor) {
      editor?.onMoveAnchor(active.anchor.panelId, active.anchor.index, pointAt(event));
      setAnchorDraft(null);
      return;
    }
  };
  const pathData = (points: GarmentPanelPoint[], close = false) => points.length
    ? `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join('')}${close ? 'Z' : ''}`
    : '';
  const previewPath = draft.length
    ? `${draft.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join('')}${hoverPoint ? `L${hoverPoint[0]},${hoverPoint[1]}` : ''}`
    : '';

  const cursor = editor?.tool === 'pen' ? PEN_CURSOR
    : editor?.tool === 'select' ? 'default' : 'crosshair';

  return <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    aria-label="Garment panel editor" data-panelling-tool={editor?.enabled ? editor.tool : undefined}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
    onPointerLeave={() => setHoverPoint(null)}
    onPointerCancel={() => { pointer.current = null; setAnchorDraft(null); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { setDraft([]); editor?.onDraftPointCountChange(0); setHoverPoint(null); }
      if (event.key === 'Enter' && editor?.tool === 'pen') complete(draft);
    }} tabIndex={editor?.enabled ? 0 : -1} style={{ pointerEvents: editor?.enabled && editor.targetPartId === parentPartId ? 'auto' : 'none',
      touchAction: 'none', cursor, outline: 'none' }}>
    <defs>
      <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
        <g dangerouslySetInnerHTML={{ __html: sourceContents(sourceSvgRaw) }} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      {visiblePanels.map(panel => {
        const path = panelPath(panel.geometry.points);
        const selected = panel.id === editor?.selectedPanelId;
        const edges = panelEdgeDefinitions(panel);
        return <g key={panel.id} data-garment-panel={panel.id}>
          {editor?.enabled && editor.tool === 'select' && <path d={path} fill={selected ? '#38bdf866' : 'transparent'} stroke={selected ? '#38bdf8' : 'transparent'} strokeWidth={selected ? 4 : 0}
            pointerEvents="fill" onPointerDown={event => { event.stopPropagation(); editor.onSelect(panel.id); editor.onSelectEdge(null); }} />}
          {edges.map(edge => {
            const style = panelBoundaryStyle(edge.construction);
            const edgeSelected = selected && editor?.selectedEdgeId === edge.id;
            return <path key={edge.id} d={edge.path} fill="none" stroke={edgeSelected ? '#38bdf8' : style?.stroke ?? 'transparent'}
              strokeWidth={edgeSelected ? 8 : style?.width ?? 12} strokeDasharray={style?.dash} strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" pointerEvents={editor?.enabled && editor.tool === 'select' ? 'stroke' : 'none'}
              onPointerDown={event => { if (!editor?.enabled || editor.tool !== 'select') return; event.preventDefault(); event.stopPropagation(); editor.onSelect(panel.id); editor.onSelectEdge(edge.id); }} />;
          })}
        </g>;
      })}
      {draft.length > 0 && <g pointerEvents="none" data-panel-draft="">
        {draft.length >= 3 && <path d={pathData([...draft, ...(hoverPoint ? [hoverPoint] : [])], true)}
          fill="#38bdf855" stroke="#080808" strokeWidth={3.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        <path d={pathData([...draft, ...(hoverPoint ? [hoverPoint] : [])])}
          fill="none" stroke="#050505" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={previewPath} fill="none" stroke="#00d9ff" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </g>}
    </g>
    {selectedPanel && editor?.enabled && editor.tool === 'select' && selectedPanel.geometry.points.map((point, index) => {
      const displayPoint = pointer.current?.anchor?.panelId === selectedPanel.id && pointer.current.anchor.index === index && anchorDraft
        ? anchorDraft : point;
      return <rect key={index} x={displayPoint[0] - 44} y={displayPoint[1] - 44} width={88} height={88}
        fill="#f8fafc" stroke="#075985" strokeWidth={4} vectorEffect="non-scaling-stroke"
        pointerEvents="all" onPointerDown={event => {
          event.stopPropagation();
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) return;
          svg.setPointerCapture(event.pointerId);
          pointer.current = { id: event.pointerId, start: point, anchor: { panelId: selectedPanel.id, index } };
        }} />;
    })}
    {draft.map((point, index) => <g key={index} pointerEvents="none">
      <rect x={point[0] - 44} y={point[1] - 44} width={88} height={88}
        fill="#ffffff" stroke="#075985" strokeWidth={4} vectorEffect="non-scaling-stroke" />
      <circle cx={point[0]} cy={point[1]} r={12} fill="#00a9d6" />
    </g>)}
    {editor?.tool === 'pen' && hoverPoint && <rect x={hoverPoint[0] - 36} y={hoverPoint[1] - 36} width={72} height={72}
      fill="#00e5ff55" stroke="#080808" strokeWidth={3} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
  </svg>;
}

export function GarmentPanellingSidebar({ panels, view, targetPartId, tool, edgeConstruction, selectedPanelId,
  availableParts, draftPointCount, onFinishDrawing, onTargetPartChange, onToolChange, onEdgeConstructionChange, onSelect,
  onUpdatePanel, onDeletePanel }: {
  panels: GarmentPanel[];
  view: 'front' | 'back';
  targetPartId: string;
  tool: GarmentPanelTool;
  edgeConstruction: GarmentPanelEdgeConstruction;
  selectedPanelId: string | null;
  draftPointCount: number;
  availableParts: { id: string; label: string }[];
  onFinishDrawing: () => void;
  onTargetPartChange: (id: string) => void;
  onToolChange: (tool: GarmentPanelTool) => void;
  onEdgeConstructionChange: (edge: GarmentPanelEdgeConstruction) => void;
  onSelect: (id: string | null) => void;
  onUpdatePanel: (id: string, patch: Partial<GarmentPanel>) => void;
  onDeletePanel: (id: string) => void;
}) {
  const visible = panels.filter(panel => panel.view === view);
  const selected = visible.find(panel => panel.id === selectedPanelId);
  const control = 'rounded border border-white/15 bg-[#202024] px-2.5 py-2 text-[11px] text-white';
  return <div className="space-y-4">
    <section className="space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-3">
      <label className="block text-[10px] uppercase tracking-wider text-white/55" htmlFor="panelling-parent-part">Parent garment part</label>
      <select id="panelling-parent-part" className={`${control} w-full`} value={targetPartId} onChange={event => onTargetPartChange(event.target.value)}>
        {availableParts.map(part => <option key={part.id} value={part.id}>{part.label}</option>)}
      </select>
    </section>
    <section className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-white/55">Tools</p>
      <div className="grid grid-cols-2 gap-2">
        <Button aria-pressed={tool === 'pen'} variant={tool === 'pen' ? 'default' : 'outline'} size="sm" onClick={() => onToolChange('pen')}>Point tool</Button>
        <Button variant={tool === 'select' ? 'default' : 'outline'} size="sm" onClick={() => onToolChange('select')}>Select / edit</Button>
      </div>
      {tool === 'pen' && <div className="flex gap-2">
        <Button className="flex-1" disabled={draftPointCount < 3} onClick={onFinishDrawing}>Finish panel</Button>
        <Button variant="outline" onClick={() => { onToolChange('select'); }}>Cancel</Button>
      </div>}
      {tool === 'pen'
        ? <ol className="list-inside list-decimal space-y-1 text-[10px] leading-relaxed text-white/55">
            <li>Click the garment to place corner points.</li>
            <li>Click the first point to close, or finish the panel.</li>
            <li>Cancel discards the in-progress panel.</li>
          </ol>
        : <p className="text-[10px] leading-relaxed text-white/55">Click a panel to select it. Drag its anchor points to reshape it.</p>}
    </section>
    {tool === 'pen' && <section className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-white/55">New panel boundary</p>
      <select className={`${control} w-full`} value={edgeConstruction} onChange={event => onEdgeConstructionChange(event.target.value as GarmentPanelEdgeConstruction)}>
        <option value="seam">Standard seam</option><option value="outline">Outline only</option>
      </select>
    </section>}
    <section>
      <p className="mb-2 text-[10px] uppercase tracking-wider text-white/55">Panels · {view}</p>
      <div className="space-y-1">
        {visible.map((panel, index) => <button key={panel.id} type="button" onClick={() => { onSelect(panel.id); onToolChange('select'); }}
          className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs ${panel.id === selectedPanelId ? 'bg-sky-400/15 text-sky-100' : 'bg-white/5 text-white/75 hover:bg-white/10'}`}>
          <span>{panel.name || `Panel ${index + 1}`}</span><span className="text-[9px] uppercase text-white/40">{panel.edgeConstruction === 'outline' ? 'outline' : 'seam'}</span>
        </button>)}
        {!visible.length && <p className="text-[11px] text-white/40">No panels on this view yet.</p>}
      </div>
    </section>
    {selected && <section className="space-y-3 border-t border-white/10 pt-3">
      <p className="text-[10px] uppercase tracking-wider text-white/55">Selected panel</p>
      <Input aria-label="Panel name" value={selected.name} onChange={event => onUpdatePanel(selected.id, { name: event.target.value })} />
      <label className="flex items-center justify-between text-[11px] text-white/65">{selected.colour ? 'Panel colour' : 'Inherit parent colour'}
        <Input aria-label="Panel colour" type="color" value={selected.colour ?? '#ffffff'} onChange={event => onUpdatePanel(selected.id, { colour: event.target.value })} className="h-8 w-12 p-1" />
      </label>
      {selected.colour && <Button variant="outline" size="sm" onClick={() => onUpdatePanel(selected.id, { colour: undefined })}>Inherit parent colour</Button>}
      <label className="block text-[10px] uppercase tracking-wider text-white/55" htmlFor="panelling-selected-boundary">Boundary treatment</label>
      <select id="panelling-selected-boundary" className={`${control} w-full`}
        value={selected.edgeConstruction === 'outline' ? 'outline' : 'seam'}
        onChange={event => onUpdatePanel(selected.id, { edgeConstruction: event.target.value as GarmentPanelEdgeConstruction, edges: undefined })}>
        <option value="seam">Standard seam</option><option value="outline">Outline only</option>
      </select>
      <Button variant="destructive" size="sm" className="w-full" onClick={() => onDeletePanel(selected.id)}>Delete panel</Button>
    </section>}
  </div>;
}

function clippedPanelSvg(source: string, panel: GarmentPanel): string {
  const clipId = `garment-panel-${panel.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const shape = escapeAttribute(panelPath(panel.geometry.points));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${shape}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#${clipId})">${sourceContents(source)}</g></svg>`;
}

function parentMaskSvg(svg: string, paths: string[], id: string): string {
  if (!paths.length) return svg;
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return svg;
  const cuts = paths.map(path => `<path d="${escapeAttribute(path)}" fill="black" fill-rule="evenodd"/>`).join('');
  const start = svg.indexOf(root) + root.length;
  const end = svg.toLowerCase().lastIndexOf('</svg>');
  if (end < start) return svg;
  return `${svg.slice(0, start)}<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><rect width="2048" height="2048" fill="white"/>${cuts}</mask></defs><g mask="url(#${id})">${svg.slice(start, end)}</g>${svg.slice(end)}`;
}

function parentLayerId(parentPartId: string): string {
  return parentPartId === 'sleeveLeft' || parentPartId === 'sleeveRight' ? 'sleeves' : parentPartId;
}

export function panelColourOverrides(panels: GarmentPanel[]): Record<string, string> {
  return Object.fromEntries(panels.flatMap(panel => panel.colour ? [[panel.id, panel.colour]] : []));
}

export function applyGarmentPanels(
  layers: ResolvedGarmentLayer[],
  panels: GarmentPanel[],
  view: 'front' | 'back',
): ResolvedGarmentLayer[] {
  return layers.map(layer => {
    const matching = panels.filter(panel => panel.view === view && parentLayerId(panel.parentPartId) === layer.id);
    if (!matching.length) return ['base', 'sleeves'].includes(layer.id)
      ? { ...layer, panellingClipSvgRaw: layer.svgRaw }
      : layer;
    const cutPanels = matching.filter(panel => panel.panelType === 'cut-replace');
    const source = layer.svgRaw;
    const colourPanels = matching.map(panel => ({
      id: panel.id,
      svgRaw: clippedPanelSvg(source, panel),
        tint: panel.colour ?? '',
      parentPartId: panel.parentPartId,
      name: panel.name,
      materialCategory: 'panels' as const,
    }));
    const svgRaw = cutPanels.length
      ? parentMaskSvg(source, cutPanels.map(panel => panelPath(panel.geometry.points)), `panel-cut-${layer.id}-${view}`)
      : source;
    return { ...layer, svgRaw, panellingClipSvgRaw: source, colourPanels: [...(layer.colourPanels ?? []), ...colourPanels] };
  });
}

export function panelBoundaryStyle(construction: GarmentPanelEdgeConstruction): { stroke: string; width: number; dash?: string } | null {
  switch (construction) {
    case 'seam': return { stroke: '#080808', width: 2.5 };
    case 'single-topstitch': return { stroke: '#d7c8a2', width: 2, dash: '5 5' };
    case 'flatlock': return { stroke: '#3b3b3b', width: 3.5 };
    case 'overlock': return { stroke: '#171717', width: 2, dash: '2 4' };
    case 'raw': return { stroke: '#685d50', width: 2, dash: '2 5' };
    case 'binding': return { stroke: '#e9e0ce', width: 4 };
    case 'tape': return { stroke: '#505c68', width: 4 };
    case 'welded': return { stroke: '#575f67', width: 2.5 };
    case 'outline': return { stroke: '#080808', width: 2 };
    case 'zip':
      return null;
    case 'none': return { stroke: '#080808', width: 2 };
  }
}

export function splitPanelPoints(splitX: number): { left: GarmentPanelPoint[]; right: GarmentPanelPoint[]; boundary: string } {
  const x = Math.max(1, Math.min(2047, splitX));
  return {
    left: [[0, 0], [x, 0], [x, 2048], [0, 2048]],
    right: [[x, 0], [2048, 0], [2048, 2048], [x, 2048]],
    boundary: `M${x},0L${x},2048`,
  };
}
