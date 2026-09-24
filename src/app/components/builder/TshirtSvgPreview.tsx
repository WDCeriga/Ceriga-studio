import React, {
  useId,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TshirtHemStyles } from '../../data/tshirtHemStyles';
import { washSvg, type GarmentWash, type WashBounds, type WashTool } from '../../data/garmentWash';
import { WashEditor } from './WashFinish';
import { availableStitchRegions, stitchFocus, type TshirtStitching } from '../../data/tshirtStitching';
import { StitchRegionOverlay, TshirtStitchingLayer, useStitchGeometry, type StitchEditor } from './TshirtStitching';
import { GARMENT_PREVIEW_CANVAS_CLASS, GARMENT_PREVIEW_CONTAINER_CLASS } from './measurementPreviewSizing';
import { detailPlacement, detailRotation, zipHardwareGeometry, detailAsset, type GarmentDetail, type DetailBounds } from '../../data/garmentDetails';
import { GarmentDetailsOverlay, type DetailEditorState } from './GarmentDetails';
import { GarmentLabelOverlay } from './GarmentLabelOverlay';
import type { GarmentLabel } from '../../data/garmentLabels';
import { decorationsForView, replaceViewDecorations } from '../../data/garmentView';
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
  type CustomCollarSvgs,
} from '../../data/garmentSvgCatalog';
import {
  mergeCuffSideTransform,
  resolveCuffAlignOffset,
} from '../../data/tshirtCuffDefaults';
import {
  TSHIRT_DETAIL_COLOR,
  constructionColor,
  renderConstructionSvg,
  renderFabricSvg,
  computeSleeveHemAlignOffsetForSide,
  getPotraceSvgBBox,
  isValidBBox,
  splitPotraceSvgBBoxAtCenter,
  tintPotraceSvg,
  type PotraceSvgBBox,
  type SleeveSide,
} from '../../lib/tshirtSvgUtils';
import { cn } from '../ui/utils';
import type { NeckFinish } from '../../data/tshirtNeckFinish';

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
  garmentWash?: GarmentWash;
  showWash?: boolean;
  washTool?: WashTool;
  onWashToolChange?: (tool: WashTool) => void;
  onWashChange?: (wash: GarmentWash) => void;
  garmentType: GarmentSvgGarmentType;
  color: string;
  selection: GarmentAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  /** Thread colour for the dashed topstitch overlay. */
  stitchingColor?: string;
  /** Per-part colour keyed by layer id; wins over the fabric colour and trim colours. */
  partColors?: Partial<Record<string, string>>;
  tshirtHemStyles?: TshirtHemStyles;
  neckFinish?: NeckFinish;
  tshirtStitching?: TshirtStitching;
  stitchEditor?: StitchEditor;
  hemEditor?: { regions: { id: string; name: string }[]; region: string; closeUp: boolean; onSelect: (id: string) => void };
  garmentDetails?: GarmentDetail[];
  garmentLabels?: GarmentLabel[];
  labelReferenceWidthMm?: number;
  labelEditor?: {
    interior: boolean;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onChange: (labels: GarmentLabel[]) => void;
    onFocus: (point: { id: string; x: number; y: number; width: number; height: number }) => void;
  };
  detailView?: 'front' | 'back';
  selectedDetailId?: string | null;
  onDetailSelect?: (id: string | null) => void;
  onDetailsChange?: (details: GarmentDetail[]) => void;
  onDetailBoundsChange?: (bounds: DetailBounds | undefined) => void;
  onBuiltinDetailsChange?: (details: GarmentDetail[]) => void;
  detailEditor?: DetailEditorState;
  layerTransforms?: Partial<Record<string, TshirtLayerTransform>>;
  onLayerTransformChange?: (id: string, transform: TshirtLayerTransform) => void;
  selectedLayerId?: string | null;
  onSelectedLayerChange?: (id: string | null) => void;
  liveCanvasScale?: number;
  className?: string;
  fit?: string;
  customCollar?: CustomCollarSvgs | null;
  customCollars?: CustomCollarSvgs[];
}

function mergeTransform(id: string, map?: Partial<Record<string, TshirtLayerTransform>>) {
  if (id === 'stitching') return { ...DEFAULT_TSHIRT_LAYER_TRANSFORM };
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

function lightenHex(hex: string, amount = 0.32): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix(parseInt(raw.slice(0, 2), 16));
  const g = mix(parseInt(raw.slice(2, 4), 16));
  const b = mix(parseInt(raw.slice(4, 6), 16));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function resolveLayerFill(
  layer: ResolvedGarmentLayer,
  fabricColor: string,
  bodyColor: string,
): string {
  if (layer.id === 'outline') return constructionColor(bodyColor);
  if (layer.id === 'innerBackNeck') return lightenHex(bodyColor, .12);
  if (layer.kind === 'detail') return constructionColor(bodyColor, layer.tint ?? TSHIRT_DETAIL_COLOR);
  return layer.tint ?? fabricColor;
}

function InlineSvg({
  raw,
  fill,
  fabricColor,
  linework = false,
  regions,
  edgeSealWidth = 0,
}: {
  raw: string;
  fill: string;
  fabricColor?: string;
  linework?: boolean;
  regions?: { raw: string; color: string }[];
  /** Extra same-colour coverage under construction seams, in SVG user units. */
  edgeSealWidth?: number;
}) {
  const id = useId().replace(/:/g, '');
  const markup = useMemo(
    () => linework ? renderConstructionSvg(raw, fabricColor ?? fill, fill, id, regions)
      : edgeSealWidth ? tintPotraceSvg(raw, fill, 'solid', false, edgeSealWidth) : renderFabricSvg(raw, fill),
    [raw, fill, fabricColor, linework, regions, id, edgeSealWidth],
  );

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
  layers,
  fabricColor,
  bodyColor,
  transform,
  bbox,
  alignOffset,
  clipSide,
  scaleFixedAnchor,
  layerId,
  garmentWash,
  washBounds,
  detailView,
  canvasSize,
}: {
  layer: ResolvedGarmentLayer;
  layers: ResolvedGarmentLayer[];
  fabricColor: string;
  bodyColor: string;
  transform: TshirtLayerTransform;
  bbox?: PotraceSvgBBox | null;
  alignOffset?: { x: number; y: number };
  clipSide?: SleeveSide;
  scaleFixedAnchor?: ScaleAnchor | null;
  layerId: string;
  garmentWash?: GarmentWash;
  washBounds?: WashBounds;
  detailView: 'front' | 'back';
  canvasSize: number;
}) {
  const fill = resolveLayerFill(layer, fabricColor, bodyColor);
  const regions = useMemo(() => layers.filter(part => part.kind === 'solid' && !['base', 'outline', 'innerBackNeck'].includes(part.id))
    .map(part => ({ raw: part.svgRaw, color: resolveLayerFill(part, fabricColor, bodyColor) })), [layers, fabricColor, bodyColor]);
  const washId = useId();
  const origin = bbox ? (scaleFixedAnchor ? anchorOriginPoint(bbox, scaleFixedAnchor) : { x: bbox.centerX, y: bbox.centerY }) : { x: 1024, y: 1024 };
  const scale = resolveLayerScale(transform);
  const placementTransform = new DOMMatrix().translate(origin.x + transform.x * 2048 / canvasSize, origin.y + transform.y * 2048 / canvasSize)
    .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY).translate((alignOffset?.x ?? 0) - origin.x, (alignOffset?.y ?? 0) - origin.y).inverse().toString();
  const finish = useMemo(() => washBounds && layer.kind === 'solid' && !['outline', 'innerBackNeck'].includes(layer.id)
    ? washSvg(layer.svgRaw, fill, washBounds, layer.id, garmentWash, detailView, washId, placementTransform) : '',
    [layer.svgRaw, layer.kind, layer.id, fill, washBounds, garmentWash, detailView, washId, placementTransform]);
  // Selection raises handles and hit targets only. Raising the fabric itself
  // covers its construction outline and stitches with the selected colour.
  const zIndex = layer.zIndex;

  return (
    <div
      className="pointer-events-none absolute inset-0 touch-none"
      style={{
        ...layerTransformStyle(transform, bbox, alignOffset, scaleFixedAnchor),
        zIndex,
      }}
      data-layer-id={layerId}
      data-asset={layer.displayName}
    >      <div className="absolute inset-0"
        style={clipSide ? sleeveSideClipStyle(clipSide) : undefined}
      >
        <InlineSvg
          raw={layer.svgRaw}
          fill={layer.id === 'outline' ? '#141414' : fill}
          fabricColor={bodyColor}
          linework={layer.id === 'outline' || layer.kind === 'detail'}
          regions={regions}
        />
        {finish && <div className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full" aria-hidden dangerouslySetInnerHTML={{ __html: finish }} />}
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
  garmentWash,
  showWash = true,
  washTool,
  onWashToolChange,
  onWashChange,
  garmentType,
  color,
  selection,
  neckTrimColor,
  sleeveTrimColor,
  cuffTrimColor,
  pocketTrimColor,
  stitchingColor,
  partColors,
  tshirtHemStyles,
  neckFinish,
  tshirtStitching,
  stitchEditor,
  hemEditor,
  garmentDetails = [],
  garmentLabels = [],
  labelReferenceWidthMm,
  labelEditor,
  detailView = 'front',
  selectedDetailId,
  onDetailSelect,
  onDetailsChange,
  onDetailBoundsChange,
  onBuiltinDetailsChange,
  detailEditor,
  layerTransforms,
  onLayerTransformChange,
  selectedLayerId = null,
  onSelectedLayerChange,
  liveCanvasScale = 1,
  className,
  fit,
  customCollar,
  customCollars,
}: TshirtSvgPreviewProps) {
  const [washDraft, setWashDraft] = useState<GarmentWash | null>(null);
  useEffect(() => setWashDraft(null), [garmentWash, detailView, Boolean(washTool)]);
  const washEditable = Boolean(washTool && onWashChange && garmentWash?.type !== 'none');
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
  const bodyColor = partColors?.base ?? fabricColor;
  const editable = Boolean(onLayerTransformChange) && !washEditable && !labelEditor && !stitchEditor;

  const layers = useMemo(
    () =>
      resolveGarmentLayers({
        garmentType,
        view: detailView,
        selection,
        neckTrimColor,
        sleeveTrimColor,
        cuffTrimColor,
        pocketTrimColor,
        stitchingColor,
        partColors,
        tshirtHemStyles,
        neckFinish,
        fit,
        customCollar,
        customCollars,
      }),
    [garmentType, detailView, selection, neckTrimColor, sleeveTrimColor, cuffTrimColor, pocketTrimColor, stitchingColor, partColors, tshirtHemStyles, neckFinish, fit, customCollar, customCollars],
  );

  const garmentConfig = getGarmentSvgConfig(garmentType);
  const washBounds = useMemo(() => {
    const bounds = layers.filter(layer => layer.kind === 'solid' && !['outline', 'innerBackNeck'].includes(layer.id))
      .map(layer => getPotraceSvgBBox(layer.svgRaw)).filter(isValidBBox);
    return bounds.length ? { minX: Math.min(...bounds.map(bound => bound.minX)), minY: Math.min(...bounds.map(bound => bound.minY)),
      maxX: Math.max(...bounds.map(bound => bound.maxX)), maxY: Math.max(...bounds.map(bound => bound.maxY)) } : undefined;
  }, [layers]);
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
        .filter((entry) => {
          if (['innerBackNeck', 'outline', 'stitching'].includes(entry.sourceLayer.id)) {
            return false;
          }
          return entry.bbox && isValidBBox(entry.bbox);
        })
        .sort((a, b) => b.sourceLayer.zIndex - a.sourceLayer.zIndex),
    [layerLayouts],
  );

  const selectedLayout = useMemo(
    () => layerLayouts.find((entry) => entry.id === selectedLayerId && entry.sourceLayer.id !== 'stitching') ?? null,
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

  const displayBounds = (id: string) => {
      const layout = layerLayouts.find(item => item.id === id);
      if (!layout?.bbox) return undefined;
      const { bbox } = layout;
      const transform = resolveLayerDisplayTransform(layout.id, layout.transform, bbox);
      const { scaleX, scaleY } = resolveLayerScale(transform);
      const matrix = new DOMMatrix().translate(bbox.centerX + transform.x * 2048 / canvasSize, bbox.centerY + transform.y * 2048 / canvasSize)
        .rotate(transform.rotation).scale(scaleX, scaleY)
        .translate((layout.alignOffset?.x ?? 0) - bbox.centerX, (layout.alignOffset?.y ?? 0) - bbox.centerY);
      const points = [[bbox.minX, bbox.minY], [bbox.maxX, bbox.minY], [bbox.maxX, bbox.maxY], [bbox.minX, bbox.maxY]]
        .map(([pointX, pointY]) => matrix.transformPoint({ x: pointX, y: pointY }));
      return { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
        minY: Math.min(...points.map(point => point.y)), maxY: Math.max(...points.map(point => point.y)) };
  };
  const detailBounds = (() => {
    const body = displayBounds('base');
    if (!body) return undefined;
    return { ...body, maxY: Math.max(body.maxY, displayBounds('bodyHem')?.maxY ?? body.maxY), necklineY: displayBounds('neck')?.maxY };
  })();
  useEffect(() => { onDetailBoundsChange?.(detailBounds); }, [onDetailBoundsChange, detailBounds?.minX, detailBounds?.minY, detailBounds?.maxX, detailBounds?.maxY, detailBounds?.necklineY]);

  useEffect(() => {
    if (!onBuiltinDetailsChange || !detailBounds) return;
    const bodyWidth = detailBounds.maxX - detailBounds.minX;
    const bodyHeight = detailBounds.maxY - detailBounds.minY;
    const categories = getGarmentSvgConfig(garmentType).stepCategories[6] ?? [];
    const candidates: GarmentDetail[] = [];
    for (const layout of layerLayouts) {
      if (!layout.bbox || !categories.includes(layout.sourceLayer.category)) continue;
      const { bbox, transform, sourceLayer } = layout;
      const scale = resolveLayerScale(transform);
      const matrix = new DOMMatrix().translate(bbox.centerX + transform.x * 2048 / canvasSize, bbox.centerY + transform.y * 2048 / canvasSize)
        .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY).translate((layout.alignOffset?.x ?? 0) - bbox.centerX, (layout.alignOffset?.y ?? 0) - bbox.centerY);
      const center = matrix.transformPoint({ x: bbox.centerX, y: bbox.centerY });
      candidates.push({ id: `builtin-${detailView}-${layout.id}`, type: 'pocket', name: `${sourceLayer.category}: ${sourceLayer.displayName}`, view: detailView,
        x: (center.x - detailBounds.minX) / bodyWidth, y: (center.y - detailBounds.minY) / bodyHeight,
        scale: 1, scaleX: Math.abs(scale.scaleX), scaleY: Math.abs(scale.scaleY), rotation: transform.rotation,
        flipX: scale.scaleX < 0, flipY: scale.scaleY < 0, lockProportions: /pull|button|toggle|aglet/i.test(sourceLayer.category),
        fill: resolveLayerFill(sourceLayer, fabricColor, bodyColor), outline: '#141414', stitch: '#707070', hardware: '#D4D4D4', selected: false,
        sourceLayerId: layout.id, catalogueAsset: { id: sourceLayer.assetId, crop: bbox, width: (bbox.maxX - bbox.minX) / bodyWidth, ratio: (bbox.maxX - bbox.minX) / (bbox.maxY - bbox.minY) } });
    }
    onBuiltinDetailsChange(candidates);
  }, [onBuiltinDetailsChange, layerLayouts, canvasSize, garmentType, detailView, fabricColor, bodyColor, detailBounds?.minX, detailBounds?.minY, detailBounds?.maxX, detailBounds?.maxY]);
  const overriddenTrimIds = new Set(decorationsForView(garmentDetails, detailView).map(detail => detail.sourceLayerId).filter(Boolean));

  const { geometry: stitchGeometry } = useStitchGeometry(layers, fit ?? 'slim', Boolean(stitchEditor));
  const visibleStitchRegions = stitchGeometry ? availableStitchRegions(stitchGeometry, tshirtHemStyles) : [];
  const focusedStitchRegion = stitchEditor && visibleStitchRegions.includes(stitchEditor.region) ? stitchEditor.region : visibleStitchRegions[0];
  const stitchCamera = stitchEditor?.closeUp && stitchGeometry && focusedStitchRegion
    ? stitchFocus(stitchGeometry, focusedStitchRegion) : { x: 1024, y: 1024, scale: 1 };
  const detailCamera = (() => {
    const selected = decorationsForView(garmentDetails, detailView).find(detail => detail.id === selectedDetailId);
    if (!detailEditor?.closeUp || !selected || !detailBounds) return undefined;
    const placement = detailPlacement(selected, detailBounds);
    if (selected.type !== 'zip') return { x: placement.left + placement.width / 2, y: placement.top + placement.height / 2, scale: Math.min(6, Math.max(2, 700 / Math.max(placement.width, placement.height))) };
    const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(selected).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
    const sourceHeight = sourceWidth * placement.height / placement.width;
    const hardware = zipHardwareGeometry(selected, sourceWidth, sourceHeight);
    const pullY = (hardware.pullY + 22 * hardware.hardwareScale) / sourceHeight;
    const offsetY = ((selected.flipY ? 1 - pullY : pullY) - .5) * placement.height;
    const radians = detailRotation(selected) * Math.PI / 180;
    return { x: placement.left + placement.width / 2 - Math.sin(radians) * offsetY,
      y: placement.top + placement.height / 2 + Math.cos(radians) * offsetY, scale: Math.min(8, Math.max(2, 280 / placement.width)) };
  })();
  const hemBounds = hemEditor ? displayBounds(hemEditor.region) : undefined;
  const hemCamera = hemEditor?.closeUp && hemBounds ? {
    x: (hemBounds.minX + hemBounds.maxX) / 2, y: (hemBounds.minY + hemBounds.maxY) / 2,
    scale: Math.min(5, Math.max(1.2, 1500 / Math.max(hemBounds.maxX - hemBounds.minX, hemBounds.maxY - hemBounds.minY))),
  } : undefined;
  const previewCamera = hemCamera ?? detailCamera ?? stitchCamera;

  const toolHint = useMemo(() => {
    if (!editable || !selectedLayerId || hemEditor) return null;
    if (gestureLayerId) return `Adjusting ${selectedDisplayName}…`;
    return 'Drag to move · corner/edge handles to stretch · ↻ to rotate';
  }, [editable, gestureLayerId, selectedDisplayName, selectedLayerId, hemEditor]);

  return (
    <div
      className={cn(
        GARMENT_PREVIEW_CONTAINER_CLASS,
        className,
      )}
      onPointerDown={editable && !hemEditor ? handleBackgroundPointerDown : undefined}
      style={stitchEditor || detailCamera || hemEditor ? { overflow: 'hidden' } : undefined}
    >
      <div
        ref={canvasRef}
        className={cn(GARMENT_PREVIEW_CANVAS_CLASS, 'motion-reduce:!transition-none')}
        data-stitch-camera={stitchEditor ? `${focusedStitchRegion}:${stitchEditor.closeUp ? 'close-up' : 'garment'}` : undefined}
        data-detail-camera={detailCamera ? 'close-up' : 'garment'}
        data-hem-camera={hemEditor ? `${hemEditor.region}:${hemEditor.closeUp ? 'close-up' : 'garment'}` : undefined}
        style={stitchEditor || detailCamera || hemEditor ? {
          transform: `translate(${(1024 - previewCamera.x) / 2048 * 100 * previewCamera.scale}%, ${(1024 - previewCamera.y) / 2048 * 100 * previewCamera.scale}%) scale(${previewCamera.scale})`,
          transition: detailCamera ? undefined : 'transform 850ms cubic-bezier(.22,.68,0,1)',
          transformOrigin: 'center',
        } : undefined}
      >
        {layerLayouts.map(({ id, sourceLayer, side, transform, alignOffset, bbox }) => {
          if (overriddenTrimIds.has(id)) return null;
          if (sourceLayer.id === 'stitching' && garmentType === 'tshirt') {
            return <TshirtStitchingLayer key="stitching" layers={layers} fit={fit ?? 'slim'} settings={tshirtStitching ?? {}} hems={tshirtHemStyles} fabricColor={fabricColor} />;
          }
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
              layers={layers}
              garmentWash={showWash ? washDraft ?? garmentWash : undefined}
              washBounds={washBounds}
              detailView={detailView}
              canvasSize={canvasSize}
              fabricColor={fabricColor}
              bodyColor={bodyColor}
              transform={displayTransform}
              bbox={bbox}
              alignOffset={alignOffset}
              clipSide={side}
              scaleFixedAnchor={scaleFixedAnchor}
            />
          );
        })}

        {editable && !hemEditor
          ? hitTargets.map(({ id, sourceLayer, side, transform, alignOffset, bbox }) =>
              bbox && !overriddenTrimIds.has(id) ? (
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

        {stitchEditor && stitchGeometry && focusedStitchRegion && <StitchRegionOverlay geometry={stitchGeometry}
          hems={tshirtHemStyles} editor={{ ...stitchEditor, region: focusedStitchRegion }} />}

        {hemEditor && <svg viewBox="0 0 2048 2048" aria-label="Hem selection" className="pointer-events-none absolute inset-0 z-[250] h-full w-full">
          {hemEditor.regions.map(region => {
            const bounds = displayBounds(region.id);
            if (!bounds) return null;
            const active = region.id === hemEditor.region;
            return <g key={region.id}>
              <rect data-hem-hit={region.id} x={bounds.minX - 5} y={bounds.minY - 5} width={bounds.maxX - bounds.minX + 10} height={bounds.maxY - bounds.minY + 10}
                fill="transparent" stroke="none"
                pointerEvents="all" role="button" tabIndex={0} aria-label={`Select ${region.name}`} aria-pressed={active} className="cursor-pointer"
                onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); hemEditor.onSelect(region.id); }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hemEditor.onSelect(region.id); } }} />
            </g>;
          })}
        </svg>}

        {!washEditable && !labelEditor && !stitchEditor && !hemEditor && selectedLayout?.bbox && selectedLayerId && selectedDisplayTransform ? (
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
        {garmentDetails.length > 0 && (() => {
          const bodyBounds = detailBounds;
          return bodyBounds ? <GarmentDetailsOverlay key={detailView} view={detailView}
            details={decorationsForView(garmentDetails, detailView)} bounds={bodyBounds}
            selectedId={selectedDetailId} onSelect={onDetailSelect}
            editor={detailEditor}
            onChange={onDetailsChange ? details => onDetailsChange(replaceViewDecorations(garmentDetails, detailView, details)) : undefined} /> : null;
        })()}
        {garmentType === 'tshirt' && garmentLabels.length > 0 && <GarmentLabelOverlay
          labels={garmentLabels} view={detailView} referenceWidthMm={labelReferenceWidthMm}
          interior={labelEditor?.interior} selectedId={labelEditor?.selectedId}
          onSelect={labelEditor?.onSelect} onChange={labelEditor?.onChange} onFocus={labelEditor?.onFocus}
          layers={layerLayouts.filter(layout => layout.bbox && layout.sourceLayer.kind === 'solid').map(layout => {
            const bbox = layout.bbox!;
            const transform = resolveLayerDisplayTransform(layout.id, layout.transform, bbox);
            const scale = resolveLayerScale(transform);
            const matrix = new DOMMatrix().translate(bbox.centerX + transform.x * 2048 / canvasSize, bbox.centerY + transform.y * 2048 / canvasSize)
              .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY).translate((layout.alignOffset?.x ?? 0) - bbox.centerX, (layout.alignOffset?.y ?? 0) - bbox.centerY);
            return { id: layout.id, svgRaw: layout.sourceLayer.svgRaw, bbox, matrix: matrix.toString() };
          })} />}
        {washEditable && showWash && garmentWash && washBounds && washTool && onWashChange && onWashToolChange && <WashEditor
          key={detailView} wash={washDraft ?? garmentWash} bounds={washBounds} view={detailView} tool={washTool}
          onToolChange={onWashToolChange} onDraft={setWashDraft} onCommit={onWashChange} />}
      </div>

      {hemEditor && <div className="pointer-events-none absolute left-2 top-2 z-[260] bg-white/90 px-2 py-1 text-xs text-[#292929]">
        {hemEditor.regions.find(region => region.id === hemEditor.region)?.name}
      </div>}
      {toolHint ? (
        <p className="pointer-events-none absolute -bottom-6 left-1/2 z-10 w-max max-w-full -translate-x-1/2 text-center text-[9px] leading-snug text-white/35">
          {toolHint}
        </p>
      ) : null}
    </div>
  );
}
