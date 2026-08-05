import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DEFAULT_TSHIRT_LAYER_TRANSFORM,
  resolveLayerScale,
  TSHIRT_CANVAS,
  type TshirtLayerTransform,
} from '../../data/tshirtLayerAssets';
import {
  getGarmentSvgConfig,
  garmentSourceLayerId,
  garmentTransformStorageId,
  resolveGarmentLayers,
  type GarmentAssetSelection,
  type GarmentSvgGarmentType,
  type ResolvedGarmentLayer,
} from '../../data/garmentSvgCatalog';
import {
  mergeCuffSideTransform,
  resolveCuffAlignOffset,
} from '../../data/tshirtCuffDefaults';
import {
  TSHIRT_DETAIL_COLOR,
  computeSleeveHemAlignOffsetForSide,
  getPotraceSvgBBox,
  isValidBBox,
  splitPotraceSvgBBoxAtCenter,
  tintPotraceSvg,
  type PotraceSvgBBox,
  type SleeveSide,
} from '../../lib/tshirtSvgUtils';
import { cn } from '../ui/utils';

type GestureMode = 'move' | 'rotate' | 'scale';

/** Edge/corner that stays fixed while the opposite side is dragged. */
type ScaleAnchor =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

const SCALE_MIN = 0.2;
const SCALE_MAX = 3;

function clampScale(value: number) {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
}

function anchorOriginPoint(
  bbox: PotraceSvgBBox,
  anchor: ScaleAnchor,
): { x: number; y: number } {
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  switch (anchor) {
    case 'top':
      return { x: cx, y: bbox.minY };
    case 'bottom':
      return { x: cx, y: bbox.maxY };
    case 'left':
      return { x: bbox.minX, y: cy };
    case 'right':
      return { x: bbox.maxX, y: cy };
    case 'top-left':
      return { x: bbox.minX, y: bbox.minY };
    case 'top-right':
      return { x: bbox.maxX, y: bbox.minY };
    case 'bottom-left':
      return { x: bbox.minX, y: bbox.maxY };
    case 'bottom-right':
      return { x: bbox.maxX, y: bbox.maxY };
  }
}

function viewBoxToCanvasPx(value: number, canvasSize: number) {
  return value * (canvasSize / TSHIRT_CANVAS);
}

function bboxBaseSizePx(bbox: PotraceSvgBBox, canvasSize: number) {
  return {
    width: viewBoxToCanvasPx(bbox.maxX - bbox.minX, canvasSize),
    height: viewBoxToCanvasPx(bbox.maxY - bbox.minY, canvasSize),
  };
}

/** Re-express a center-origin transform so scaling uses a fixed edge/corner pivot. */
function toAnchorOriginTransform(
  t: TshirtLayerTransform,
  bbox: PotraceSvgBBox,
  anchor: ScaleAnchor,
  canvasSize: number,
): TshirtLayerTransform {
  const { x: ox, y: oy } = anchorOriginPoint(bbox, anchor);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const cxPx = viewBoxToCanvasPx(cx, canvasSize);
  const cyPx = viewBoxToCanvasPx(cy, canvasSize);
  const oxPx = viewBoxToCanvasPx(ox, canvasSize);
  const oyPx = viewBoxToCanvasPx(oy, canvasSize);
  const { scaleX, scaleY } = resolveLayerScale(t);

  return {
    ...t,
    x: t.x + cxPx - oxPx + scaleX * (oxPx - cxPx),
    y: t.y + cyPx - oyPx + scaleY * (oyPx - cyPx),
  };
}

/** Convert back to center-origin after scaling from a fixed edge/corner. */
function bakeTransformToCenterOrigin(
  t: TshirtLayerTransform,
  bbox: PotraceSvgBBox,
  anchor: ScaleAnchor,
  canvasSize: number,
): TshirtLayerTransform {
  const { x: ox, y: oy } = anchorOriginPoint(bbox, anchor);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const cxPx = viewBoxToCanvasPx(cx, canvasSize);
  const cyPx = viewBoxToCanvasPx(cy, canvasSize);
  const oxPx = viewBoxToCanvasPx(ox, canvasSize);
  const oyPx = viewBoxToCanvasPx(oy, canvasSize);
  const { scaleX, scaleY } = resolveLayerScale(t);

  return {
    ...t,
    x: t.x + oxPx - cxPx + scaleX * (cxPx - oxPx),
    y: t.y + oyPx - cyPx + scaleY * (cyPx - oyPx),
  };
}

function resolveScalingTransform(
  base: TshirtLayerTransform,
  bbox: PotraceSvgBBox,
  anchor: ScaleAnchor,
  dx: number,
  dy: number,
  canvasSize: number,
): TshirtLayerTransform {
  const anchorSpace = toAnchorOriginTransform(base, bbox, anchor, canvasSize);
  return applyScaleFromPointerDelta(anchorSpace, bbox, anchor, dx, dy, canvasSize);
}

/** Scale so the dragged edge/corner follows the pointer 1:1 in canvas space. */
function applyScaleFromPointerDelta(
  origin: TshirtLayerTransform,
  bbox: PotraceSvgBBox,
  anchor: ScaleAnchor,
  dx: number,
  dy: number,
  canvasSize: number,
): TshirtLayerTransform {
  const { scaleX: sx0, scaleY: sy0 } = resolveLayerScale(origin);
  const { width: baseW, height: baseH } = bboxBaseSizePx(bbox, canvasSize);
  let sx = sx0;
  let sy = sy0;

  switch (anchor) {
    case 'top':
      sy = clampScale(sy0 + dy / baseH);
      break;
    case 'bottom':
      sy = clampScale(sy0 - dy / baseH);
      break;
    case 'left':
      sx = clampScale(sx0 + dx / baseW);
      break;
    case 'right':
      sx = clampScale(sx0 - dx / baseW);
      break;
    case 'bottom-left':
      sx = clampScale(sx0 - dx / baseW);
      sy = clampScale(sy0 + dy / baseH);
      break;
    case 'bottom-right':
      sx = clampScale(sx0 + dx / baseW);
      sy = clampScale(sy0 + dy / baseH);
      break;
    case 'top-left':
      sx = clampScale(sx0 - dx / baseW);
      sy = clampScale(sy0 - dy / baseH);
      break;
    case 'top-right':
      sx = clampScale(sx0 + dx / baseW);
      sy = clampScale(sy0 - dy / baseH);
      break;
  }

  return { ...origin, scaleX: sx, scaleY: sy, scale: (sx + sy) / 2 };
}

/** Selected layer + its handles render above all garment layers. */
const SELECTED_LAYER_Z = 200;

export interface TshirtSvgPreviewProps {
  garmentType: GarmentSvgGarmentType;
  color: string;
  selection: GarmentAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  layerTransforms?: Partial<Record<string, TshirtLayerTransform>>;
  onLayerTransformChange?: (id: string, transform: TshirtLayerTransform) => void;
  selectedLayerId?: string | null;
  onSelectedLayerChange?: (id: string | null) => void;
  liveCanvasScale?: number;
  className?: string;
}

function mergeTransform(id: string, map?: Partial<Record<string, TshirtLayerTransform>>) {
  return { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, ...map?.[id] };
}

function mergeSleeveSideTransform(
  side: SleeveSide,
  map?: Partial<Record<string, TshirtLayerTransform>>,
): TshirtLayerTransform {
  const sideId = side === 'left' ? 'sleeveLeft' : 'sleeveRight';
  return {
    ...DEFAULT_TSHIRT_LAYER_TRANSFORM,
    ...map?.sleeves,
    ...map?.[sideId],
  };
}

function mergeSleeveHemSideTransform(
  side: SleeveSide,
  sleeveAssetId: string | undefined,
  hemAssetId: string | undefined,
  map?: Partial<Record<string, TshirtLayerTransform>>,
): TshirtLayerTransform {
  return mergeCuffSideTransform(side, sleeveAssetId, hemAssetId, map as Partial<Record<string, TshirtLayerTransform>>);
}

function transformStorageId(id: string): string {
  return garmentTransformStorageId(id);
}

function sleeveSideClipStyle(side: SleeveSide): CSSProperties {
  return side === 'left'
    ? { clipPath: 'inset(0 50% 0 0)' }
    : { clipPath: 'inset(0 0 0 50%)' };
}

interface ExpandedPreviewLayer {
  id: string;
  sourceLayer: ResolvedGarmentLayer;
  side?: SleeveSide;
  transform: TshirtLayerTransform;
  alignOffset?: { x: number; y: number };
  bbox: PotraceSvgBBox | null;
}

function layerTransformStyle(
  t: TshirtLayerTransform,
  bbox?: PotraceSvgBBox | null,
  alignOffset?: { x: number; y: number },
  scaleFixedAnchor?: ScaleAnchor | null,
): CSSProperties {
  const { scaleX, scaleY } = resolveLayerScale(t);
  const alignX = alignOffset ? `${(alignOffset.x / TSHIRT_CANVAS) * 100}%` : null;
  const alignY = alignOffset ? `${(alignOffset.y / TSHIRT_CANVAS) * 100}%` : null;

  let originX = '50%';
  let originY = '50%';
  if (bbox) {
    if (scaleFixedAnchor) {
      const pt = anchorOriginPoint(bbox, scaleFixedAnchor);
      originX = `${(pt.x / TSHIRT_CANVAS) * 100}%`;
      originY = `${(pt.y / TSHIRT_CANVAS) * 100}%`;
    } else {
      originX = `${((bbox.minX + bbox.maxX) / 2 / TSHIRT_CANVAS) * 100}%`;
      originY = `${((bbox.minY + bbox.maxY) / 2 / TSHIRT_CANVAS) * 100}%`;
    }
  }

  return {
    transform:
      alignX != null && alignY != null
        ? `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${scaleX}, ${scaleY}) translate(${alignX}, ${alignY})`
        : `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${scaleX}, ${scaleY})`,
    transformOrigin: `${originX} ${originY}`,
  };
}

function bboxToPercentRect(bbox: PotraceSvgBBox): React.CSSProperties {
  return {
    left: `${(bbox.minX / TSHIRT_CANVAS) * 100}%`,
    top: `${(bbox.minY / TSHIRT_CANVAS) * 100}%`,
    width: `${((bbox.maxX - bbox.minX) / TSHIRT_CANVAS) * 100}%`,
    height: `${((bbox.maxY - bbox.minY) / TSHIRT_CANVAS) * 100}%`,
  };
}

function resolveLayerFill(layer: ResolvedGarmentLayer, fabricColor: string): string {
  if (layer.kind === 'detail') return layer.tint ?? TSHIRT_DETAIL_COLOR;
  return layer.tint ?? fabricColor;
}

function InlineSvg({ raw, fill }: { raw: string; fill: string }) {
  const markup = useMemo(() => tintPotraceSvg(raw, fill, 'solid'), [raw, fill]);

  return (
    <div
      className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** Base handle caps in px; `cqmin` scales them down on thin/small selection boxes. */
const SEL_HANDLE = {
  corner: 6,
  edgeLong: 10,
  edgeShort: 4,
  rotate: 16,
  stem: 10,
} as const;

function SelectionHandle({
  anchor,
  variant = 'corner',
  scaleAnchor = 'top-left',
  onPointerDown,
}: {
  anchor: CSSProperties;
  variant?: 'corner' | 'edge-h' | 'edge-v';
  scaleAnchor?: ScaleAnchor;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>, fixedAnchor: ScaleAnchor) => void;
}) {
  const size: CSSProperties =
    variant === 'edge-h'
      ? {
          width: `min(${SEL_HANDLE.edgeLong}px, 42cqmin)`,
          height: `min(${SEL_HANDLE.edgeShort}px, 16cqmin)`,
        }
      : variant === 'edge-v'
        ? {
            width: `min(${SEL_HANDLE.edgeShort}px, 16cqmin)`,
            height: `min(${SEL_HANDLE.edgeLong}px, 42cqmin)`,
          }
        : {
            width: `min(${SEL_HANDLE.corner}px, 28cqmin)`,
            height: `min(${SEL_HANDLE.corner}px, 28cqmin)`,
          };

  const cursor =
    variant === 'edge-v' ? 'ew-resize' : variant === 'edge-h' ? 'ns-resize' : 'nwse-resize';

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label="Scale"
      className={cn(
        'absolute rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]',
        onPointerDown ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      style={{
        ...anchor,
        ...size,
        border: '1px solid rgba(0,0,0,0.2)',
        cursor: onPointerDown ? cursor : undefined,
      }}
      onPointerDown={
        onPointerDown
          ? (e) => {
              e.stopPropagation();
              onPointerDown(e, scaleAnchor);
            }
          : undefined
      }
    />
  );
}

function SelectionOutline({
  bbox,
  transform,
  alignOffset,
  scaleFixedAnchor,
  zIndex,
  onMove,
  onScale,
  onRotate,
}: {
  bbox: PotraceSvgBBox;
  transform: TshirtLayerTransform;
  alignOffset?: { x: number; y: number };
  scaleFixedAnchor?: ScaleAnchor | null;
  zIndex: number;
  onMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onScale?: (e: ReactPointerEvent<HTMLDivElement>, anchor: ScaleAnchor) => void;
  onRotate?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const rect = bboxToPercentRect(bbox);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-tshirt-selection=""
      style={{ ...layerTransformStyle(transform, bbox, alignOffset, scaleFixedAnchor), zIndex }}
    >
      <div className="absolute [container-type:size]" style={rect}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ outline: '1px solid rgba(91, 140, 245, 0.85)', outlineOffset: '-1px' }}
        />

        {onMove ? (
          <div
            className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing pointer-events-auto"
            onPointerDown={(e) => {
              e.stopPropagation();
              onMove(e);
            }}
          />
        ) : null}

        <SelectionHandle anchor={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }} scaleAnchor="bottom-right" onPointerDown={onScale} />
        <SelectionHandle anchor={{ right: 0, top: 0, transform: 'translate(50%, -50%)' }} scaleAnchor="bottom-left" onPointerDown={onScale} />
        <SelectionHandle anchor={{ left: 0, bottom: 0, transform: 'translate(-50%, 50%)' }} scaleAnchor="top-right" onPointerDown={onScale} />
        <SelectionHandle anchor={{ right: 0, bottom: 0, transform: 'translate(50%, 50%)' }} scaleAnchor="top-left" onPointerDown={onScale} />

        <SelectionHandle
          anchor={{ left: '50%', top: 0, transform: 'translate(-50%, -50%)' }}
          variant="edge-h"
          scaleAnchor="bottom"
          onPointerDown={onScale}
        />
        <SelectionHandle
          anchor={{ left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }}
          variant="edge-h"
          scaleAnchor="top"
          onPointerDown={onScale}
        />
        <SelectionHandle
          anchor={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
          variant="edge-v"
          scaleAnchor="right"
          onPointerDown={onScale}
        />
        <SelectionHandle
          anchor={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
          variant="edge-v"
          scaleAnchor="left"
          onPointerDown={onScale}
        />

        {onRotate ? (
          <div className="pointer-events-none absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center">
            <div className="w-px bg-black/15" style={{ height: SEL_HANDLE.stem }} />
            <div
              role="button"
              tabIndex={-1}
              aria-label="Rotate"
              className="mt-0.5 cursor-grab rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] active:cursor-grabbing pointer-events-auto"
              style={{
                width: SEL_HANDLE.rotate,
                height: SEL_HANDLE.rotate,
                border: '1px solid rgba(0,0,0,0.2)',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onRotate(e);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewLayer({
  layer,
  fabricColor,
  transform,
  bbox,
  alignOffset,
  clipSide,
  scaleFixedAnchor,
  selectedLayerId,
  layerId,
}: {
  layer: ResolvedGarmentLayer;
  fabricColor: string;
  transform: TshirtLayerTransform;
  bbox?: PotraceSvgBBox | null;
  alignOffset?: { x: number; y: number };
  clipSide?: SleeveSide;
  scaleFixedAnchor?: ScaleAnchor | null;
  selectedLayerId?: string | null;
  layerId: string;
}) {
  const fill = resolveLayerFill(layer, fabricColor);
  const zIndex = layerId === selectedLayerId ? SELECTED_LAYER_Z : layer.zIndex;

  return (
    <div
      className="pointer-events-none absolute inset-0 touch-none"
      style={{
        ...layerTransformStyle(transform, bbox, alignOffset, scaleFixedAnchor),
        zIndex,
      }}
      data-layer-id={layerId}
      data-asset={layer.displayName}
    >
      <div
        className="absolute inset-0"
        style={clipSide ? sleeveSideClipStyle(clipSide) : undefined}
      >
        <InlineSvg raw={layer.svgRaw} fill={fill} />
      </div>
    </div>
  );
}

function LayerHitTarget({
  layerId,
  displayName,
  zIndexBase,
  bbox,
  transform,
  alignOffset,
  selected,
  onPointerDown,
}: {
  layerId: string;
  displayName: string;
  zIndexBase: number;
  bbox: PotraceSvgBBox;
  transform: TshirtLayerTransform;
  alignOffset?: { x: number; y: number };
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const rect = bboxToPercentRect(bbox);
  const zIndex = selected ? SELECTED_LAYER_Z + 10 : 100 + zIndexBase;

  return (
    <div
      className="absolute inset-0 touch-none"
      style={{
        ...layerTransformStyle(transform, bbox, alignOffset),
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <div
        data-tshirt-hit-target=""
        role="button"
        tabIndex={0}
        aria-label={`Select ${displayName}`}
        className={cn(
          'absolute cursor-pointer rounded-sm touch-none',
          selected ? '' : 'hover:bg-white/[0.04]',
        )}
        style={{ ...rect, pointerEvents: 'auto' }}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onPointerDown(e as unknown as ReactPointerEvent<HTMLDivElement>);
        }}
      />
    </div>
  );
}

function expandPreviewLayers(
  layers: ResolvedGarmentLayer[],
  layerTransforms: TshirtSvgPreviewProps['layerTransforms'],
  sleeveAssetId: string | undefined,
  hemAssetId: string | undefined,
  sleeveHemAlign: { left: { x: number; y: number }; right: { x: number; y: number } },
  garmentType: GarmentSvgGarmentType,
): ExpandedPreviewLayer[] {
  const config = getGarmentSvgConfig(garmentType);
  const expanded: ExpandedPreviewLayer[] = [];

  for (const layer of layers) {
    const fullBbox = getPotraceSvgBBox(layer.svgRaw);

    if (config.splitSleeves && layer.id === 'sleeves') {
      const { left, right } = splitPotraceSvgBBoxAtCenter(layer.svgRaw);
      if (left && isValidBBox(left)) {
        expanded.push({
          id: 'sleeveLeft',
          sourceLayer: layer,
          side: 'left',
          transform: mergeSleeveSideTransform('left', layerTransforms),
          bbox: left,
        });
      }
      if (right && isValidBBox(right)) {
        expanded.push({
          id: 'sleeveRight',
          sourceLayer: layer,
          side: 'right',
          transform: mergeSleeveSideTransform('right', layerTransforms),
          bbox: right,
        });
      }
      continue;
    }

    if (config.splitSleeveHems && layer.id === 'sleeveHem') {
      const { left, right } = splitPotraceSvgBBoxAtCenter(layer.svgRaw);
      if (left && isValidBBox(left)) {
        expanded.push({
          id: 'sleeveHemLeft',
          sourceLayer: layer,
          side: 'left',
          transform: mergeSleeveHemSideTransform('left', sleeveAssetId, hemAssetId, layerTransforms),
          alignOffset: sleeveHemAlign.left,
          bbox: left,
        });
      }
      if (right && isValidBBox(right)) {
        expanded.push({
          id: 'sleeveHemRight',
          sourceLayer: layer,
          side: 'right',
          transform: mergeSleeveHemSideTransform('right', sleeveAssetId, hemAssetId, layerTransforms),
          alignOffset: sleeveHemAlign.right,
          bbox: right,
        });
      }
      continue;
    }

    expanded.push({
      id: layer.id,
      sourceLayer: layer,
      transform: mergeTransform(layer.id, layerTransforms),
      bbox: fullBbox,
    });
  }

  return expanded;
}

function buildLayerLayouts(
  layers: ResolvedGarmentLayer[],
  layerTransforms: TshirtSvgPreviewProps['layerTransforms'],
  sleeveAssetId: string | undefined,
  hemAssetId: string | undefined,
  sleeveHemAlign: { left: { x: number; y: number }; right: { x: number; y: number } },
  garmentType: GarmentSvgGarmentType,
) {
  return expandPreviewLayers(
    layers,
    layerTransforms,
    sleeveAssetId,
    hemAssetId,
    sleeveHemAlign,
    garmentType,
  );
}

export function TshirtSvgPreview({
  garmentType,
  color,
  selection,
  neckTrimColor,
  sleeveTrimColor,
  cuffTrimColor,
  pocketTrimColor,
  layerTransforms,
  onLayerTransformChange,
  selectedLayerId = null,
  onSelectedLayerChange,
  liveCanvasScale = 1,
  className,
}: TshirtSvgPreviewProps) {
  const gestureRef = useRef<{
    layerId: string;
    storageId: string;
    pointerId: number;
    startX: number;
    startY: number;
    origin: TshirtLayerTransform;
    bbox: PotraceSvgBBox;
    mode: GestureMode;
    scaleAnchor?: ScaleAnchor;
  } | null>(null);

  const [gestureLayerId, setGestureLayerId] = useState<string | null>(null);
  const [activeScaleAnchor, setActiveScaleAnchor] = useState<ScaleAnchor | null>(null);
  const [scaleGestureStorageId, setScaleGestureStorageId] = useState<string | null>(null);
  const [scaleGestureOrigin, setScaleGestureOrigin] = useState<TshirtLayerTransform | null>(null);
  const [scaleGestureBbox, setScaleGestureBbox] = useState<PotraceSvgBBox | null>(null);
  const [scaleDragDelta, setScaleDragDelta] = useState({ dx: 0, dy: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(TSHIRT_CANVAS);

  const fabricColor = color || '#5C7FB6';
  const editable = Boolean(onLayerTransformChange);

  const layers = useMemo(
    () =>
      resolveGarmentLayers({
        garmentType,
        selection,
        neckTrimColor,
        sleeveTrimColor,
        cuffTrimColor,
        pocketTrimColor,
      }),
    [garmentType, selection, neckTrimColor, sleeveTrimColor, cuffTrimColor, pocketTrimColor],
  );

  const garmentConfig = getGarmentSvgConfig(garmentType);
  const sleeveLayer = layers.find((layer) => layer.id === 'sleeves');
  const sleeveHemLayer = layers.find((layer) => layer.id === 'sleeveHem');

  const sleeveHemAlign = useMemo(() => {
    if (!garmentConfig.splitSleeveHems || !sleeveLayer || !sleeveHemLayer) {
      return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    }
    const sleeveAssetId = sleeveLayer.assetId;
    const hemAssetId = sleeveHemLayer.assetId;
    return {
      left: resolveCuffAlignOffset(
        computeSleeveHemAlignOffsetForSide(sleeveLayer.svgRaw, sleeveHemLayer.svgRaw, 'left'),
        sleeveAssetId,
        hemAssetId,
        'left',
      ),
      right: resolveCuffAlignOffset(
        computeSleeveHemAlignOffsetForSide(sleeveLayer.svgRaw, sleeveHemLayer.svgRaw, 'right'),
        sleeveAssetId,
        hemAssetId,
        'right',
      ),
    };
  }, [garmentConfig.splitSleeveHems, sleeveLayer?.assetId, sleeveHemLayer?.assetId, sleeveLayer?.svgRaw, sleeveHemLayer?.svgRaw]);

  const [layerLayouts, setLayerLayouts] = useState(() =>
    buildLayerLayouts(
      layers,
      layerTransforms,
      sleeveLayer?.assetId,
      sleeveHemLayer?.assetId,
      sleeveHemAlign,
      garmentType,
    ),
  );

  useLayoutEffect(() => {
    setLayerLayouts(
      buildLayerLayouts(
        layers,
        layerTransforms,
        sleeveLayer?.assetId,
        sleeveHemLayer?.assetId,
        sleeveHemAlign,
        garmentType,
      ),
    );
  }, [layers, layerTransforms, sleeveHemAlign, sleeveLayer?.assetId, sleeveHemLayer?.assetId, garmentType]);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const updateSize = () => {
      const size = el.clientWidth;
      if (size > 0) setCanvasSize(size);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hitTargets = useMemo(
    () =>
      [...layerLayouts]
        .filter((entry) => entry.bbox && isValidBBox(entry.bbox))
        .sort((a, b) => b.sourceLayer.zIndex - a.sourceLayer.zIndex),
    [layerLayouts],
  );

  const selectedLayout = useMemo(
    () => layerLayouts.find((entry) => entry.id === selectedLayerId) ?? null,
    [layerLayouts, selectedLayerId],
  );

  const resolveLayerDisplayTransform = useCallback(
    (
      id: string,
      transform: TshirtLayerTransform,
      bbox: PotraceSvgBBox | null,
    ): TshirtLayerTransform => {
      if (
        !scaleGestureStorageId ||
        !activeScaleAnchor ||
        !scaleGestureOrigin ||
        !scaleGestureBbox ||
        !bbox ||
        transformStorageId(id) !== scaleGestureStorageId
      ) {
        return transform;
      }

      return resolveScalingTransform(
        scaleGestureOrigin,
        scaleGestureBbox,
        activeScaleAnchor,
        scaleDragDelta.dx,
        scaleDragDelta.dy,
        canvasSize,
      );
    },
    [
      activeScaleAnchor,
      canvasSize,
      scaleDragDelta.dx,
      scaleDragDelta.dy,
      scaleGestureBbox,
      scaleGestureOrigin,
      scaleGestureStorageId,
    ],
  );

  const selectedDisplayTransform = useMemo(() => {
    if (!selectedLayout?.bbox) return null;
    return resolveLayerDisplayTransform(
      selectedLayout.id,
      selectedLayout.transform,
      selectedLayout.bbox,
    );
  }, [resolveLayerDisplayTransform, selectedLayout]);

  const selectedDisplayName = useMemo(() => {
    if (!selectedLayout) return 'part';
    if (selectedLayout.side) {
      return `${selectedLayout.side === 'left' ? 'Left' : 'Right'} ${selectedLayout.sourceLayer.displayName}`;
    }
    return selectedLayout.sourceLayer.displayName;
  }, [selectedLayout]);

  const finishGesture = useCallback(
    (pointerId: number, e?: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== pointerId) return;

      if (
        gesture.mode === 'scale' &&
        gesture.scaleAnchor &&
        gesture.bbox &&
        scaleGestureOrigin &&
        e &&
        onLayerTransformChange
      ) {
        const s = Math.max(0.0001, liveCanvasScale);
        const dx = (e.clientX - gesture.startX) / s;
        const dy = (e.clientY - gesture.startY) / s;
        const scaled = resolveScalingTransform(
          scaleGestureOrigin,
          gesture.bbox,
          gesture.scaleAnchor,
          dx,
          dy,
          canvasSize,
        );
        onLayerTransformChange(
          gesture.storageId,
          bakeTransformToCenterOrigin(scaled, gesture.bbox, gesture.scaleAnchor, canvasSize),
        );
      }

      gestureRef.current = null;
      setGestureLayerId(null);
      setActiveScaleAnchor(null);
      setScaleGestureStorageId(null);
      setScaleGestureOrigin(null);
      setScaleGestureBbox(null);
      setScaleDragDelta({ dx: 0, dy: 0 });
    },
    [canvasSize, liveCanvasScale, onLayerTransformChange, scaleGestureOrigin],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || !onLayerTransformChange) return;

      const s = Math.max(0.0001, liveCanvasScale);
      const dx = (e.clientX - gesture.startX) / s;
      const dy = (e.clientY - gesture.startY) / s;

      if (gesture.mode === 'move') {
        onLayerTransformChange(gesture.storageId, {
          ...gesture.origin,
          x: gesture.origin.x + dx,
          y: gesture.origin.y + dy,
        });
        return;
      }

      if (gesture.mode === 'rotate') {
        onLayerTransformChange(gesture.storageId, {
          ...gesture.origin,
          rotation: gesture.origin.rotation + dx * 0.4,
        });
        return;
      }

      if (gesture.mode === 'scale' && gesture.scaleAnchor) {
        setScaleDragDelta({ dx, dy });
        return;
      }
    },
    [liveCanvasScale, onLayerTransformChange],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      finishGesture(e.pointerId, e);
    },
    [finishGesture],
  );

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const startGesture = useCallback(
    (
      layerId: string,
      e: ReactPointerEvent<Element>,
      mode: GestureMode,
      scaleAnchor?: ScaleAnchor,
    ) => {
      if (!onLayerTransformChange) return;
      const layout = layerLayouts.find((entry) => entry.id === layerId);
      if (!layout?.bbox) return;

      const storageId = transformStorageId(layerId);

      e.preventDefault();
      e.stopPropagation();
      setGestureLayerId(layerId);

      if (mode === 'scale' && scaleAnchor) {
        setScaleGestureOrigin({ ...layout.transform });
        setScaleGestureBbox(layout.bbox);
        setActiveScaleAnchor(scaleAnchor);
        setScaleGestureStorageId(storageId);
        setScaleDragDelta({ dx: 0, dy: 0 });
      } else {
        setScaleGestureOrigin(null);
        setScaleGestureBbox(null);
        setActiveScaleAnchor(null);
        setScaleGestureStorageId(null);
        setScaleDragDelta({ dx: 0, dy: 0 });
      }

      gestureRef.current = {
        layerId,
        storageId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...layout.transform },
        bbox: layout.bbox,
        mode,
        scaleAnchor: mode === 'scale' ? scaleAnchor : undefined,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [layerLayouts, onLayerTransformChange],
  );

  const handleLayerPointerDown = useCallback(
    (layerId: string, e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      onSelectedLayerChange?.(layerId);
    },
    [onSelectedLayerChange],
  );

  const handleBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-tshirt-hit-target]')) return;
      if (target.closest('[data-tshirt-selection]')) return;
      onSelectedLayerChange?.(null);
    },
    [onSelectedLayerChange],
  );

  const toolHint = useMemo(() => {
    if (!editable || !selectedLayerId) return null;
    if (gestureLayerId) return `Adjusting ${selectedDisplayName}…`;
    return 'Drag to move · corner/edge handles to stretch · ↻ to rotate';
  }, [editable, gestureLayerId, selectedDisplayName, selectedLayerId]);

  return (
    <div
      className={cn(
        'relative flex h-full w-full min-h-0 [container-type:size] items-center justify-center',
        className,
      )}
      onPointerDown={editable ? handleBackgroundPointerDown : undefined}
    >
      <div
        ref={canvasRef}
        className="relative aspect-square h-[min(100cqh,100cqw)] w-[min(100cqh,100cqw)] shrink-0"
      >
        {layerLayouts.map(({ id, sourceLayer, side, transform, alignOffset, bbox }) => {
          const scaleFixedAnchor =
            scaleGestureStorageId && transformStorageId(id) === scaleGestureStorageId
              ? activeScaleAnchor
              : null;
          const displayTransform = resolveLayerDisplayTransform(id, transform, bbox);

          return (
            <PreviewLayer
              key={`${sourceLayer.category}-${id}`}
              layerId={id}
              layer={sourceLayer}
              fabricColor={fabricColor}
              transform={displayTransform}
              bbox={bbox}
              alignOffset={alignOffset}
              clipSide={side}
              scaleFixedAnchor={scaleFixedAnchor}
              selectedLayerId={selectedLayerId}
            />
          );
        })}

        {editable
          ? hitTargets.map(({ id, sourceLayer, side, transform, alignOffset, bbox }) =>
              bbox ? (
                <LayerHitTarget
                  key={`hit-${id}`}
                  layerId={id}
                  displayName={
                    side
                      ? `${side === 'left' ? 'Left' : 'Right'} ${sourceLayer.displayName}`
                      : sourceLayer.displayName
                  }
                  zIndexBase={sourceLayer.zIndex}
                  bbox={bbox}
                  transform={transform}
                  alignOffset={alignOffset}
                  selected={selectedLayerId === id}
                  onPointerDown={(e) => handleLayerPointerDown(id, e)}
                />
              ) : null,
            )
          : null}

        {selectedLayout?.bbox && selectedLayerId && selectedDisplayTransform ? (
          <SelectionOutline
            bbox={selectedLayout.bbox}
            transform={selectedDisplayTransform}
            alignOffset={selectedLayout.alignOffset}
            scaleFixedAnchor={activeScaleAnchor}
            zIndex={SELECTED_LAYER_Z + 20}
            onMove={editable ? (e) => startGesture(selectedLayerId, e, 'move') : undefined}
            onScale={editable ? (e, anchor) => startGesture(selectedLayerId, e, 'scale', anchor) : undefined}
            onRotate={editable ? (e) => startGesture(selectedLayerId, e, 'rotate') : undefined}
          />
        ) : null}
      </div>

      {toolHint ? (
        <p className="pointer-events-none absolute -bottom-6 left-1/2 z-10 w-max max-w-full -translate-x-1/2 text-center text-[9px] leading-snug text-white/35">
          {toolHint}
        </p>
      ) : null}
    </div>
  );
}
