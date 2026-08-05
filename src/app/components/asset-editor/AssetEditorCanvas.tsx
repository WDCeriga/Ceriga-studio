import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ASSET_EDITOR_CANVAS,
  DEFAULT_EDITOR_VIEWBOX,
  editorZoomPercent,
  pointsToSmoothPathD,
  snapPoint,
  type AssetEditorSelection,
  type AssetEditorTool,
  type DrawableAssetDocument,
  type DrawnPoint,
  type EditorReferenceLayer,
  type EditorViewBox,
  screenToCanvas,
  zoomViewBoxAtScreenPoint,
} from '../../lib/assetEditor';

interface AssetEditorCanvasProps {
  document: DrawableAssetDocument;
  referenceLayers?: EditorReferenceLayer[];
  tool: AssetEditorTool;
  selection: AssetEditorSelection | null;
  snapGrid: number;
  draftPoints: DrawnPoint[];
  connectionDraftAnchorId: string | null;
  onSelect: (selection: AssetEditorSelection | null) => void;
  onDraftPointsChange: (points: DrawnPoint[]) => void;
  onFinishStroke: (points: DrawnPoint[]) => void;
  onPlaceAnchor: (point: DrawnPoint) => void;
  onConnectionAnchorPick: (anchorId: string) => void;
  onMovePoint: (strokeId: string, pointIndex: number, point: DrawnPoint) => void;
  onMoveAnchor: (anchorId: string, point: DrawnPoint) => void;
  showPointHandles?: boolean;
}

const HIT_RADIUS = 22;
const HANDLE_RADIUS = 9;
const HANDLE_HIT_RADIUS = 24;

function screenHitRadius(viewBox: EditorViewBox): number {
  return HIT_RADIUS * (viewBox.width / ASSET_EDITOR_CANVAS);
}

function distance(a: DrawnPoint, b: DrawnPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearestPoint(
  doc: DrawableAssetDocument,
  point: DrawnPoint,
  hitRadius: number,
): { strokeId: string; pointIndex: number } | null {
  let best: { strokeId: string; pointIndex: number; dist: number } | null = null;

  for (const stroke of doc.strokes) {
    stroke.points.forEach((strokePoint, pointIndex) => {
      const dist = distance(point, strokePoint);
      if (dist <= hitRadius && (!best || dist < best.dist)) {
        best = { strokeId: stroke.id, pointIndex, dist };
      }
    });
  }

  return best ? { strokeId: best.strokeId, pointIndex: best.pointIndex } : null;
}

function findNearestAnchor(doc: DrawableAssetDocument, point: DrawnPoint, hitRadius: number): string | null {
  let best: { id: string; dist: number } | null = null;
  for (const anchor of doc.anchors) {
    const dist = distance(point, anchor);
    if (dist <= hitRadius && (!best || dist < best.dist)) {
      best = { id: anchor.id, dist };
    }
  }
  return best?.id ?? null;
}

function findNearestStroke(doc: DrawableAssetDocument, point: DrawnPoint, hitRadius: number): string | null {
  let best: { id: string; dist: number } | null = null;

  for (const stroke of doc.strokes) {
    for (let i = 0; i < stroke.points.length - 1; i += 1) {
      const a = stroke.points[i];
      const b = stroke.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
      const proj = { x: a.x + t * dx, y: a.y + t * dy };
      const dist = distance(point, proj);
      if (dist <= hitRadius && (!best || dist < best.dist)) {
        best = { id: stroke.id, dist };
      }
    }
  }

  return best?.id ?? null;
}

export function AssetEditorCanvas({
  document,
  referenceLayers = [],
  tool,
  selection,
  snapGrid,
  draftPoints,
  connectionDraftAnchorId,
  onSelect,
  onDraftPointsChange,
  onFinishStroke,
  onPlaceAnchor,
  onConnectionAnchorPick,
  onMovePoint,
  onMoveAnchor,
  showPointHandles = false,
}: AssetEditorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<EditorViewBox>(DEFAULT_EDITOR_VIEWBOX);
  const [cursorPoint, setCursorPoint] = useState<DrawnPoint | null>(null);
  const [dragging, setDragging] = useState<AssetEditorSelection | null>(null);
  const draggingRef = useRef<AssetEditorSelection | null>(null);

  const hitRadius = screenHitRadius(viewBox);
  const handleHitRadius = HANDLE_HIT_RADIUS * (viewBox.width / ASSET_EDITOR_CANVAS);

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number, snap = true): DrawnPoint | null => {
      if (!svgRef.current) return null;
      const point = screenToCanvas(clientX, clientY, svgRef.current);
      return snap && snapGrid > 0 ? snapPoint(point, snapGrid) : point;
    },
    [snapGrid],
  );

  const beginDrag = useCallback(
    (selectionToDrag: AssetEditorSelection) => {
      draggingRef.current = selectionToDrag;
      setDragging(selectionToDrag);
      onSelect(selectionToDrag);
    },
    [onSelect],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = null;
    setDragging(null);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onPointerMove = (event: PointerEvent) => {
      const point = toCanvasPoint(event.clientX, event.clientY, false);
      const active = draggingRef.current;
      if (!point || !active) return;

      if (active.kind === 'point' && active.strokeId != null && active.pointIndex != null) {
        onMovePoint(active.strokeId, active.pointIndex, point);
        return;
      }

      if (active.kind === 'anchor' && active.anchorId) {
        onMoveAnchor(active.anchorId, point);
      }
    };

    const onPointerUp = () => endDrag();

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, endDrag, onMoveAnchor, onMovePoint, toCanvasPoint]);

  const tryStartPointOrAnchorDrag = (point: DrawnPoint): boolean => {
    const pointHit = findNearestPoint(document, point, hitRadius);
    if (pointHit) {
      beginDrag({
        kind: 'point',
        strokeId: pointHit.strokeId,
        pointIndex: pointHit.pointIndex,
      });
      return true;
    }

    const anchorHit = findNearestAnchor(document, point, hitRadius);
    if (anchorHit) {
      beginDrag({ kind: 'anchor', anchorId: anchorHit });
      return true;
    }

    return false;
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = toCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    if (tryStartPointOrAnchorDrag(point)) return;

    if (tool === 'polyline' || tool === 'line') {
      if (tool === 'line' && draftPoints.length === 1) {
        onFinishStroke([draftPoints[0], point]);
        onDraftPointsChange([]);
        return;
      }
      onDraftPointsChange([...draftPoints, point]);
      return;
    }

    if (tool === 'anchor') {
      onPlaceAnchor(point);
      return;
    }

    if (tool === 'connection') {
      const anchorId = findNearestAnchor(document, point, hitRadius);
      if (anchorId) onConnectionAnchorPick(anchorId);
      return;
    }

    if (tool === 'select') {
      const strokeHit = findNearestStroke(document, point, hitRadius);
      if (strokeHit) {
        onSelect({ kind: 'stroke', strokeId: strokeHit });
        return;
      }
      onSelect(null);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = toCanvasPoint(event.clientX, event.clientY, !draggingRef.current);
    if (!point) return;
    setCursorPoint(point);
  };

  const handlePointerUp = () => {
    endDrag();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && draftPoints.length >= 2) {
        onFinishStroke(draftPoints);
        onDraftPointsChange([]);
      }
      if (event.key === 'Escape') {
        onDraftPointsChange([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [draftPoints, onDraftPointsChange, onFinishStroke]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setViewBox((current) =>
        zoomViewBoxAtScreenPoint(current, event.clientX, event.clientY, svg, event.deltaY),
      );
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const zoomLabel = editorZoomPercent(viewBox);

  const gridLines = snapGrid > 0
    ? Array.from({ length: Math.floor(ASSET_EDITOR_CANVAS / snapGrid) + 1 }, (_, index) => index * snapGrid)
    : [];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-[#161b26]">
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md bg-black/50 px-2 py-1 text-xs text-slate-300">
        {zoomLabel}% · scroll zoom · drag points · dbl-click reset
      </div>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full touch-none select-none"
        onDoubleClick={() => setViewBox(DEFAULT_EDITOR_VIEWBOX)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          setCursorPoint(null);
        }}
      >
        <rect x={0} y={0} width={ASSET_EDITOR_CANVAS} height={ASSET_EDITOR_CANVAS} fill="#161b26" />

        {snapGrid > 0 &&
          gridLines.map((value) => (
            <g key={`grid-${value}`} opacity={0.12}>
              <line x1={value} y1={0} x2={value} y2={ASSET_EDITOR_CANVAS} stroke="#94a3b8" strokeWidth={1} />
              <line x1={0} y1={value} x2={ASSET_EDITOR_CANVAS} y2={value} stroke="#94a3b8" strokeWidth={1} />
            </g>
          ))}

        <line
          x1={ASSET_EDITOR_CANVAS / 2}
          y1={0}
          x2={ASSET_EDITOR_CANVAS / 2}
          y2={ASSET_EDITOR_CANVAS}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="12 12"
          strokeWidth={2}
        />

        {referenceLayers.map((layer) => (
          <image
            key={layer.id}
            href={layer.svgDataUrl}
            x={0}
            y={0}
            width={ASSET_EDITOR_CANVAS}
            height={ASSET_EDITOR_CANVAS}
            opacity={layer.opacity}
            pointerEvents="none"
            preserveAspectRatio="xMidYMid meet"
          />
        ))}

        {document.connections.map((connection) => {
          const from = document.anchors.find((anchor) => anchor.id === connection.fromAnchorId);
          const to = document.anchors.find((anchor) => anchor.id === connection.toAnchorId);
          if (!from || !to) return null;
          const selected = selection?.kind === 'connection' && selection.connectionId === connection.id;
          return (
            <g key={connection.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={selected ? '#38bdf8' : '#f59e0b'}
                strokeWidth={4}
                strokeDasharray="10 8"
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 12}
                fill="#fbbf24"
                fontSize={28}
                textAnchor="middle"
              >
                {connection.label}
              </text>
            </g>
          );
        })}

        {document.strokes.map((stroke) => {
          const linearD = stroke.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ');
          const pathD =
            stroke.smooth !== false && stroke.points.length > 2
              ? pointsToSmoothPathD(stroke.points, stroke.closed)
              : `${linearD}${stroke.closed ? ' Z' : ''}`;
          const selected = selection?.kind === 'stroke' && selection.strokeId === stroke.id;
          const pointSelectedOnStroke =
            selection?.kind === 'point' && selection.strokeId === stroke.id;
          const editingPoints = showPointHandles || selected || pointSelectedOnStroke;
          if (!pathD) return null;
          return (
            <g key={stroke.id}>
              <path
                d={pathD}
                fill={stroke.closed ? 'rgba(255,255,255,0.08)' : 'none'}
                stroke={selected ? '#38bdf8' : '#f8fafc'}
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="stroke"
                style={{ cursor: 'pointer' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect({ kind: 'stroke', strokeId: stroke.id });
                }}
              />
              {editingPoints &&
                stroke.points.map((point, pointIndex) => {
                  const pointSelected =
                    selection?.kind === 'point' &&
                    selection.strokeId === stroke.id &&
                    selection.pointIndex === pointIndex;
                  const isDraggingThis =
                    dragging?.kind === 'point' &&
                    dragging.strokeId === stroke.id &&
                    dragging.pointIndex === pointIndex;
                  return (
                    <g key={`${stroke.id}-${pointIndex}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={handleHitRadius}
                        fill="transparent"
                        stroke="none"
                        pointerEvents="all"
                        style={{ cursor: isDraggingThis ? 'grabbing' : 'grab' }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          beginDrag({
                            kind: 'point',
                            strokeId: stroke.id,
                            pointIndex,
                          });
                        }}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={pointSelected ? HANDLE_RADIUS + 2 : HANDLE_RADIUS}
                        fill={pointSelected ? '#38bdf8' : '#e2e8f0'}
                        stroke={pointSelected ? '#ffffff' : '#0f172a'}
                        strokeWidth={pointSelected ? 3 : 2}
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}
            </g>
          );
        })}

        {document.anchors.map((anchor) => {
          const selected = selection?.kind === 'anchor' && selection.anchorId === anchor.id;
          const isDraft = connectionDraftAnchorId === anchor.id;
          const isDraggingThis = dragging?.kind === 'anchor' && dragging.anchorId === anchor.id;
          return (
            <g key={anchor.id}>
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={handleHitRadius}
                fill="transparent"
                stroke="none"
                pointerEvents="all"
                style={{ cursor: isDraggingThis ? 'grabbing' : 'grab' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  beginDrag({ kind: 'anchor', anchorId: anchor.id });
                }}
              />
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={selected || isDraft ? 16 : 12}
                fill={isDraft ? '#f59e0b' : selected ? '#38bdf8' : '#22c55e'}
                stroke="#052e16"
                strokeWidth={3}
                pointerEvents="none"
              />
              <text x={anchor.x + 18} y={anchor.y - 10} fill="#86efac" fontSize={28} pointerEvents="none">
                {anchor.name}
              </text>
              {selected && (
                <text x={anchor.x + 18} y={anchor.y + 16} fill="#94a3b8" fontSize={22} pointerEvents="none">
                  {anchor.role}
                </text>
              )}
            </g>
          );
        })}

        {draftPoints.length > 0 && (
          <path
            d={draftPoints
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
              .join(' ')}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray="12 10"
          />
        )}

        {cursorPoint && (tool === 'polyline' || tool === 'line') && draftPoints.length > 0 && (
          <line
            x1={draftPoints[draftPoints.length - 1].x}
            y1={draftPoints[draftPoints.length - 1].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            stroke="#60a5fa"
            strokeWidth={6}
            strokeDasharray="8 8"
            opacity={0.8}
          />
        )}
      </svg>
    </div>
  );
}
