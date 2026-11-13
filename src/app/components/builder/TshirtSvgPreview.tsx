import { hoodiePartColour } from '../../data/interiorColour';
import {poloRepairPanel} from '../../lib/poloPanelRepair';
import {withGarmentOutlineOwnership} from '../../data/garmentOutlineOwnership';
import {withCleanSleeveOpenings} from '../../data/cleanSleeveOpenings';
import {fabricRings} from '../../data/regularConstruction';
import { frontRawNeckEdge, rawNeckBoundary, rawNeckEdgeInk } from '../../data/rawNeckEdge';
import { flattenPathContours } from '../../features/panelling/panellingGeometry';
import svgpath from 'svgpath';
import {withDistressedHem} from '../../data/distressedHem';
import {withTorsoCrop} from '../../data/torsoCrop';
import {withRoundedShoulderCaps} from '../../data/tshirtShoulderGeometry';
import {refreshCroppedTshirtHem,refreshRawTshirtCuffs,registerTshirtBottomHem,withTshirtCasing} from '../../data/tshirtLiveHems';
import {withoutBodyHemFoldInk} from '../../data/tshirtHemInk';
import {PanellingReadOnlyOverlay} from './shell/PanellingReadOnlyOverlay';
import {withPanellingFabricParts} from '../../features/panelling/panellingMaterials';
import {washAvailability} from '../../data/washCapabilities';
import {stitchRegionsWithInk,chooseStitchFocusRegion} from '../../data/tshirtStitching';
import {getGarmentAsset} from '../../data/garmentSvgCatalog';
import {withRegularConstruction} from '../../data/regularConstruction';
import {withTshirtSurfaceQuality} from '../../data/tshirtSurfaceQuality';
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
import { resolveHemSettings, type TshirtHemStyles } from '../../data/tshirtHemStyles';
import { fabricPartsFromLayers, resolvePartMaterial, type FabricPart, type FabricAssignments, type GarmentFabric } from '../../data/garmentFabrics';
import { importedGarmentLayers } from '../../data/importedGarment';
import { renderTexturedFabricSvg } from '../../lib/fabricRendering';
import { getFabricScanAssetRevision, preloadFabricScanSurfaces } from '../../lib/fabricTextureScans';
import { partTextureIntensity, type FabricTextureIntensity } from '../../data/fabricTextureIntensity';
import { washSvg, type GarmentWash, type WashBounds, type WashTool } from '../../data/garmentWash';
import { WashEditor } from './WashFinish';
import { ConstructionRegionHitTargets } from './ConstructionRegionHitTargets';
import { useMaterialDrop, type MaterialDropHandler } from './materialDrop';
import { availableStitchRegions, stitchFocus, type TshirtStitching } from '../../data/tshirtStitching';
import { StitchRegionOverlay, TshirtStitchingLayer, useStitchGeometry, type StitchEditor } from './TshirtStitching';
import { GARMENT_PREVIEW_CANVAS_CLASS, GARMENT_PREVIEW_CONTAINER_CLASS } from './measurementPreviewSizing';
import { garmentPreviewBounds, garmentPreviewLayerBounds } from './garmentPreviewBounds';
import { anchorHoodTrim, detailPlacement, detailRotation, zipHardwareGeometry, detailAsset, type GarmentDetail, type DetailBounds } from '../../data/garmentDetails';
import { GarmentDetailsOverlay, type DetailEditorState } from './GarmentDetails';
import { reanchorOpening, compileOpeningGeometry, constructOpenings, openingLayerClip, openingPolygonPath, panellingFullZipCut, zipTapeMouth, type OpeningSource } from '../../data/garmentOpenings';
import { joinHoodFaceToZip } from '../../data/regularHoodie';
import { OpeningConstruction } from './OpeningConstruction';
import { GarmentLabelOverlay } from './GarmentLabelOverlay';
import type { GarmentLabel } from '../../data/garmentLabels';
import { decorationsForView } from '../../data/garmentView';
import {
  DEFAULT_TSHIRT_LAYER_TRANSFORM,
  resolveLayerScale,
  TSHIRT_CANVAS,
  type TshirtLayerTransform,
} from '../../data/tshirtLayerAssets';
import {
  getGarmentSvgConfig,
  getGarmentAssetRevision,
  garmentSourceLayerId,
  garmentTransformStorageId,
  resolveGarmentLayers,
  resolveGarmentPackFit,
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
  inlineTshirtKeepMasks,
  renderConstructionSvg,
  computeSleeveHemAlignOffsetForSide,
  getPotraceSvgBBoxFast,
  isValidBBox,
  splitPotraceSvgBBoxAtCenter,
  type PotraceSvgBBox,
  type SleeveSide,
} from '../../lib/tshirtSvgUtils';
import { cn } from '../ui/utils';
import {useTechnicalDrawing,normalizeTechnicalSvg,TechnicalDrawingContext,RegularConstructionContext,TshirtPreviewInkContext} from '../../lib/technicalDrawing';
import {TechnicalLinework} from '../../features/panelling/TechnicalLinework';
import type { PanelRegion,BoundaryLoop } from '../../features/panelling/panellingTypes';
import { livePanellingMarkup } from '../../features/panelling/livePanellingGeometry';
import type { NeckFinish } from '../../data/tshirtNeckFinish';
import { toast } from 'sonner';
import type { MeasurementSource } from './measurementGeometry';
import { applyGarmentPanels, GarmentPanelOverlay, type GarmentPanel, type GarmentPanellingEditor } from '../../data/garmentPanelling';
import { prepareTshirtCollarContours } from '../../data/tshirtCollarContours';
import { prepareRearCollarProfile } from '../../data/tshirtBackView';
import { prepareTshirtNeckFinish } from '../../data/tshirtNeckFinish';
import { preloadTshirtNeckPack, tshirtNeckPackKind } from '../../data/tshirtNeckPack';
import { hoodieNeckline } from '../../data/hoodieNecklines';
import { preloadTshirtSleeveAssets, tshirtSleeveAssetsReady, tshirtSleeveVariant } from '../../data/tshirtLongSleeves';

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

import { activeCustomAssets, customAssetTransforms } from '../../data/customAssets';
import { CustomAssetEditorOverlay } from './CustomAssetEditor';
import { collarEditGeometry, type CollarManualEdits } from '../../data/customCollarEditing';
import type { AssetUserTransform } from '../../data/customAssetEditing';

export interface TshirtSvgPreviewProps {
  regularConstruction?: boolean;
  constructionPanels?: GarmentPanel[];
  panellingEditor?: GarmentPanellingEditor;
  creationEditing?: boolean;
  technicalView?: boolean;
  onMaterialDrop?: MaterialDropHandler;
  fabricAssignments?: FabricAssignments;
  fabricTextureIntensity?: FabricTextureIntensity;
  canvasOverlay?: React.ReactNode;
  /** Resolved live geometry, mounted in the same canvas as the material and construction layers. */
  renderPanellingOverlay?: (geometryMarkup: string) => React.ReactNode;
  semanticPanels?: PanelRegion[];
  savedPanelling?: {seams:import('../../features/panelling/panellingTypes').PanellingSeam[];mirror:boolean;boundaries?:BoundaryLoop[]};
  customAssetState?: import('../../data/customAssets').CustomAssetState;
  onCustomAssetTransformChange?: (id: string, transform?: AssetUserTransform) => void;
  onCustomCollarEditsChange?: (id: string, edits?: CollarManualEdits) => void;
  onCustomAssetCanvasSizeChange?: (size: number) => void;
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
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    onChange?: (labels: GarmentLabel[]) => void;
    onFocus?: (point: { id: string; x: number; y: number; width: number; height: number }) => void;
  };
  detailView?: 'front' | 'back';
  selectedDetailId?: string | null;
  onDetailSelect?: (id: string | null) => void;
  onDetailsChange?: (details: GarmentDetail[]) => void;
  onDetailBoundsChange?: (bounds: DetailBounds | undefined) => void;
  renderMeasurements?: (sources: MeasurementSource[], bounds: DetailBounds | undefined) => React.ReactNode;
  onBuiltinDetailsChange?: (details: GarmentDetail[]) => void;
  detailEditor?: DetailEditorState;
  layerTransforms?: Partial<Record<string, TshirtLayerTransform>>;
  onLayerTransformChange?: (id: string, transform: TshirtLayerTransform) => void;
  partFocus?:string;
  showSelectionHint?:boolean;
  materialHighlightIds?:string[];
  selectedLayerId?: string | null;
  selectionContext?: string;
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
  if (!t.x && !t.y && !t.rotation && scaleX === 1 && scaleY === 1 && !alignOffset?.x && !alignOffset?.y) return {};
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
  if (layer.id === 'innerBackNeck' && !layer.fabricRegion?.hoodieColour) return layer.tint ?? bodyColor;
  if (layer.colorBinding === 'body') return bodyColor;
  if (layer.id === 'outline') return constructionColor(bodyColor);
  if (layer.kind === 'detail') return constructionColor(bodyColor, layer.tint ?? TSHIRT_DETAIL_COLOR);
  return layer.tint ?? (layer.fabricRegion?.hoodieColour ? hoodiePartColour(bodyColor, layer.fabricRegion.hoodieColour) : fabricColor);
}

function InlineSvg({
  paintMask,
  raw,
  fill,
  fabricColor,
  linework = false,
  regions,
  edgeSealWidth = 0,
  fabric,
  interior = false,
  textureIntensity = 40,
}: {
  fabric?: GarmentFabric;
  interior?: boolean;
  textureIntensity?: number;
  raw: string;
  paintMask?: string;
  fill: string;
  fabricColor?: string;
  linework?: boolean;
  regions?: { raw: string; color: string }[];
  /** Extra same-colour coverage under construction seams, in SVG user units. */
  edgeSealWidth?: number;
}) {
  const id = useId().replace(/:/g, '');
  const technical=useTechnicalDrawing();
  // Preserve every original asset path and collar join; normalize paint only.
  const source=raw;
  const fabricScanRevision = getFabricScanAssetRevision();
  const markup = useMemo(
    () => inlineTshirtKeepMasks(linework ? renderConstructionSvg(raw, fabricColor ?? fill, fill, id, regions)
      : renderTexturedFabricSvg(source, fill, fabric, id, interior, edgeSealWidth, textureIntensity)),
    [raw,source, fill, fabricColor, linework, regions, id, edgeSealWidth, fabric, interior, textureIntensity, fabricScanRevision],
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: (()=>{const painted=technical&&!raw.includes('data-hem-fray')?normalizeTechnicalSvg(markup,1,linework?'outline':'construction',linework):markup;if(!paintMask)return painted;const maskId=new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+paintMask+'</svg>','image/svg+xml').querySelector('mask')?.id;return maskId?painted.replace(/(<svg[^>]*>)/,'$1'+paintMask+'<g mask="url(#'+maskId+')">').replace(/<\/svg>\s*$/,'</g></svg>'):painted;})() }}
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
  openingCut,
  materialHighlight,
  fabric,
  fabricAssignments,
  fabricTextureIntensity,
  interior,
  textureIntensity,
  technicalView,
  appearanceColor,
  partColors,
  materialParts,
  constructionPanels,
  panellingEditor,
  semanticPanels,
}: {
  materialHighlight?: boolean;
  constructionPanels?: GarmentPanel[];
  panellingEditor?: GarmentPanellingEditor;
  semanticPanels?: PanelRegion[];
  partColors?: Partial<Record<string, string>>;
  materialParts: FabricPart[];
  technicalView?: boolean;
  appearanceColor?: string;
  fabricAssignments?: FabricAssignments;
  fabricTextureIntensity?: FabricTextureIntensity;
  textureIntensity?: number;
  fabric?: GarmentFabric;
  interior?: boolean;
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
  openingCut?: ReturnType<typeof constructOpenings>['removed'];
}) {
  const technicalDrawing=useTechnicalDrawing();
  const fill = appearanceColor ?? resolveLayerFill(layer, fabricColor, bodyColor);
  const registeredFabric = /data-(?:clean-sleeve-opening|live-hem-finish|shoulder-construction|raster-neck)=/.test(layer.svgRaw);
  const sealFabricEdge = technicalDrawing && layer.kind === 'solid'
    && !['neck', 'innerBackNeck'].includes(layer.id)
    && !/data-(?:distressed-hem|no-fabric-edge-seal)/.test(layer.svgRaw);
  const regions = useMemo(() => layers.filter(part => part.kind === 'solid' && !['base', 'outline', 'innerBackNeck'].includes(part.id))
    .flatMap(part => [{ raw: part.svgRaw, color: partColors?.[part.id] ?? resolveLayerFill(part, fabricColor, bodyColor) }, ...(part.colourPanels ?? []).map(panel => ({ raw: panel.svgRaw, color: partColors?.[panel.id] ?? panel.tint ?? partColors?.[part.id] ?? resolveLayerFill(part, fabricColor, bodyColor) }))]), [layers, fabricColor, bodyColor, partColors]);
  const washId = useId();
  const origin = bbox ? (scaleFixedAnchor ? anchorOriginPoint(bbox, scaleFixedAnchor) : { x: bbox.centerX, y: bbox.centerY }) : { x: 1024, y: 1024 };
  const scale = resolveLayerScale(transform);
  const placementTransform = new DOMMatrix().translate(origin.x + transform.x * 2048 / canvasSize, origin.y + transform.y * 2048 / canvasSize)
    .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY).translate((alignOffset?.x ?? 0) - origin.x, (alignOffset?.y ?? 0) - origin.y).inverse().toString();
  const finish = useMemo(() => (!garmentWash||washAvailability(garmentWash.type,fabric?.composition??'').available) && washBounds && layer.kind === 'solid' && layer.washable !== false && !['outline', 'innerBackNeck'].includes(layer.id)
    ? washSvg(layer.svgRaw, fill, washBounds, layer.id, garmentWash, detailView, washId, placementTransform) : '',
    [layer.svgRaw, layer.kind, layer.id, layer.washable, fill, washBounds, garmentWash, detailView, washId, placementTransform,fabric?.composition]);
  // Selection raises handles and hit targets only. Raising the fabric itself
  // covers its construction outline and stitches with the selected colour.
  const zIndex = layer.zIndex;
  const highlightMarkup = useMemo(() => materialHighlight
    ? renderTexturedFabricSvg(layer.svgRaw, '#7c8b9b38', undefined, 'material-highlight')
    : '', [layer.svgRaw, materialHighlight]);
  const openingClipId = `${washId.replace(/:/g, '')}-opening`;
  const openingClip = useMemo(() => openingCut?.length ? openingLayerClip(openingCut, new DOMMatrix(placementTransform)) : '', [openingCut, placementTransform]);
  const layerPanellingEditor = panellingEditor && {
    ...panellingEditor,
    onCreateZip: (panelId: string, start: [number, number], end: [number, number]) => {
      const sourceToGarment = new DOMMatrix(placementTransform).inverse();
      const mappedStart = sourceToGarment.transformPoint(new DOMPoint(start[0], start[1]));
      const mappedEnd = sourceToGarment.transformPoint(new DOMPoint(end[0], end[1]));
      panellingEditor.onCreateZip(panelId, [mappedStart.x, mappedStart.y], [mappedEnd.x, mappedEnd.y]);
    },
  };

  return (
    <>
    <div
      className="pointer-events-none absolute inset-0 touch-none"
      style={{
        ...layerTransformStyle(transform, bbox, alignOffset, scaleFixedAnchor),
        zIndex,
      }}
      data-layer-id={layerId}
      data-fabric-id={fabric?.id}
      data-asset={layer.displayName}
    >
      {openingClip && <svg className="absolute h-0 w-0" aria-hidden><defs><clipPath id={openingClipId} clipPathUnits="objectBoundingBox"><path d={openingClip} transform="scale(0.00048828125)" clipRule="evenodd" /></clipPath></defs></svg>}
      <div className="absolute inset-0" data-opening-cut={openingClip ? layerId : undefined} style={openingClip ? { clipPath: `url(#${openingClipId})` } : undefined}>
      <div className="absolute inset-0"
        style={clipSide ? sleeveSideClipStyle(clipSide) : undefined}
      >
        <InlineSvg
          paintMask={layer.necklinePaintMask}
          raw={['neck','innerBackNeck'].includes(layer.id)&&!layer.svgRaw.includes('data-no-fabric-edge-seal')?layer.svgRaw.replace('<svg ','<svg data-no-fabric-edge-seal="true" '):layer.svgRaw}
          edgeSealWidth={sealFabricEdge ? (registeredFabric ? 6 : 36) : 0}
          fabric={fabric}
          interior={interior}
          textureIntensity={textureIntensity}
          fill={['outline', 'hoodFaceOutline', 'hoodFaceSeams'].includes(layer.id) ? '#141414' : fill}
          fabricColor={bodyColor}
          linework={layer.id === 'outline' || layer.kind === 'detail'}
          regions={regions}
        />
        {semanticPanels?.filter(panel => panel.parentId === layerId && (panel.seamIds.length>0||panel.fillOverride)).map(panel => {
          const panelPart=materialParts.find(part=>part.id===panel.id);
          const material=panelPart?resolvePartMaterial(fabricAssignments,panelPart,materialParts):undefined;
          const panelFabric=technicalView?undefined:material?.fabric??fabric;
          return <div key={panel.id} data-semantic-panel-fill={panel.id} data-fabric-id={panelFabric?.id} className="pointer-events-none absolute inset-0" style={{maskImage:`url("data:image/svg+xml,${encodeURIComponent(layer.svgRaw)}")`,WebkitMaskImage:`url("data:image/svg+xml,${encodeURIComponent(layer.svgRaw)}")`,maskSize:'100% 100%',WebkitMaskSize:'100% 100%',maskRepeat:'no-repeat',WebkitMaskRepeat:'no-repeat'}}>
            <InlineSvg raw={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="${panel.path}" transform="${placementTransform}" fill="#000000" fill-rule="evenodd"/></svg>`}
              fill={partColors?.[panel.id]??panel.fillOverride??fill} fabric={panelFabric} interior={material?.interior??interior} textureIntensity={partTextureIntensity(fabricTextureIntensity,panel.id)} fabricColor={bodyColor} />
          </div>;
        })}
        {layer.colourPanels?.map(panel => {
          const panelPart = materialParts.find(part => part.id === panel.id);
          const material = panelPart ? resolvePartMaterial(fabricAssignments, panelPart, materialParts) : undefined;
          const panelFabric = technicalView ? undefined : material?.fabric ?? fabric;
          return <div key={panel.id} data-colour-panel={panel.id} data-fabric-id={panelFabric?.id} className="pointer-events-none absolute inset-0"><InlineSvg raw={panel.svgRaw} fill={partColors?.[panel.id] ?? (panel.tint || fill)} fabricColor={bodyColor} fabric={panelFabric} interior={material?.interior ?? interior} textureIntensity={partTextureIntensity(fabricTextureIntensity, panel.id)} /></div>;
        })}
        {finish && <div className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full" aria-hidden dangerouslySetInnerHTML={{ __html: finish }} />}
        {highlightMarkup && <div aria-hidden="true" data-material-piece-highlight={layerId}
          className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: highlightMarkup }} />}
        {layer.constructionSvg && <div className="absolute inset-0"><InlineSvg raw={layer.constructionSvg} fill="#141414" fabricColor={fill} linework regions={regions} /></div>}
        {layer.stitchSvg && <div className="absolute inset-0 [&_path]:[stroke:var(--imported-thread)] [&_path]:[stroke-width:var(--imported-thread-weight)] [&_path]:[stroke-linejoin:round]" style={{ '--imported-thread': layer.stitchColor ?? '#b09c72', '--imported-thread-weight': Math.max(0, (layer.stitchWeight ?? 1) - 1) * 20 } as CSSProperties}><InlineSvg raw={layer.stitchSvg} fill={layer.stitchColor ?? '#b09c72'} fabricColor={fill} linework /></div>}
      </div>
      </div>
    </div>
    {(constructionPanels?.length || panellingEditor?.enabled) && layer.panellingClipSvgRaw && (
      <div
        className="pointer-events-none absolute inset-0 touch-none"
        data-panelling-overlay-layer={layerId}
        style={{
          ...layerTransformStyle(transform, bbox, alignOffset, scaleFixedAnchor),
          zIndex: 1000,
          ...(clipSide ? sleeveSideClipStyle(clipSide) : {}),
          ...(openingClip ? { clipPath: `url(#${openingClipId})` } : {}),
        }}
      >
        <GarmentPanelOverlay panels={constructionPanels ?? []} view={detailView} parentPartId={layerId}
          sourceSvgRaw={layer.panellingClipSvgRaw} editor={layerPanellingEditor} />
      </div>
    )}
    </>
  );
}

function LayerHitTarget({ surfaceHighlight, onDragHighlight, layerId, displayName, raw, side, zIndexBase, bbox, transform, alignOffset, selected, hovered, onHover, onPointerDown, onMaterialDrop }: {
  surfaceHighlight?: boolean;
  onDragHighlight?: (id: string, active: boolean) => void;
  layerId: string;
  displayName: string;
  raw: string;
  onMaterialDrop?: MaterialDropHandler;
  side?: SleeveSide;
  zIndexBase: number;
  bbox: PotraceSvgBBox;
  transform: TshirtLayerTransform;
  alignOffset?: { x: number; y: number };
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { dragHovered, handlers } = useMaterialDrop(layerId, onMaterialDrop);
  useEffect(() => {
    if (!dragHovered || !onDragHighlight) return;
    onDragHighlight(layerId, true);
    return () => onDragHighlight(layerId, false);
  }, [dragHovered, layerId, onDragHighlight]);
  const uid = useId().replace(/:/g, '');
  const markup = useMemo(() => renderTexturedFabricSvg(raw, '#7c8b9b38', undefined, 'selection-' + uid), [raw, uid]);
  return <div className="pointer-events-none absolute inset-0" style={{ ...layerTransformStyle(transform, bbox, alignOffset), zIndex: 100 + zIndexBase * 2 }}>
    <div data-tshirt-hit-target={layerId} data-construction-region-hit={layerId} role="button" tabIndex={0}
      aria-label={`Select ${displayName}`} aria-pressed={selected}
      className="pointer-events-none absolute inset-0 cursor-pointer [&>svg]:h-full [&>svg]:w-full [&_path]:[pointer-events:fill] [&_polygon]:[pointer-events:fill] [&_rect]:[pointer-events:fill]"
      style={{ ...(side ? sleeveSideClipStyle(side) : undefined), ...(surfaceHighlight ? { opacity: 0 } : {}) }}
      {...handlers}
      data-material-highlight-active={selected || hovered || dragHovered ? true : undefined}
      data-selection-highlight={selected ? 'selected' : hovered || dragHovered ? 'hover' : undefined}
      onPointerMove={event => { if (event.pointerType !== 'touch') onHover(layerId); }}
      onPointerLeave={() => onHover(null)} onPointerCancel={() => onHover(null)} onPointerDown={onPointerDown}
      onKeyDown={event => { if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPointerDown(event as unknown as ReactPointerEvent<HTMLDivElement>); } }}
      dangerouslySetInnerHTML={{ __html: markup }} />
  </div>;
}

function SeamPanelMaterialTarget({panel,selected,hovered,onHover,onSelect,onMaterialDrop}:{panel:PanelRegion;selected:boolean;hovered:boolean;onHover:(id:string|null)=>void;onSelect?:(id:string)=>void;onMaterialDrop?:MaterialDropHandler}){
 const {dragHovered,handlers}=useMaterialDrop(panel.id,onMaterialDrop);
 return <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:175}}><path d={panel.path} className="seam-panel-material-target" fill="#7c8b9b38" stroke="#525252" strokeWidth="3" fillRule="evenodd" style={{pointerEvents:'fill',cursor:'pointer'}} data-tshirt-hit-target={panel.id} data-construction-region-hit={panel.id} data-material-highlight-active={selected||hovered||dragHovered?true:undefined} data-selection-highlight={selected?'selected':hovered||dragHovered?'hover':undefined} role="button" tabIndex={0} aria-label={'Select '+panel.label} aria-pressed={selected} {...handlers} onPointerMove={event=>{if(event.pointerType!=='touch')onHover(panel.id)}} onPointerLeave={()=>onHover(null)} onPointerCancel={()=>onHover(null)} onPointerDown={event=>{event.stopPropagation();onSelect?.(panel.id)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect?.(panel.id)}}}/></svg>;
}

function expandPreviewLayers(
  layers: ResolvedGarmentLayer[],
  layerTransforms: TshirtSvgPreviewProps['layerTransforms'],
  sleeveAssetId: string | undefined,
  hemAssetId: string | undefined,
  sleeveHemAlign: { left: { x: number; y: number }; right: { x: number; y: number } },
  garmentType: GarmentSvgGarmentType,
  importedGarment?: NonNullable<TshirtSvgPreviewProps['customAssetState']>['importedGarment'],
): ExpandedPreviewLayer[] {
  const config = getGarmentSvgConfig(garmentType);
  const expanded: ExpandedPreviewLayer[] = [];

  for (const layer of layers) {
    const fullBbox = garmentPreviewLayerBounds(layer, importedGarment);

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
  importedGarment?: NonNullable<TshirtSvgPreviewProps['customAssetState']>['importedGarment'],
) {
  return expandPreviewLayers(
    layers,
    layerTransforms,
    sleeveAssetId,
    hemAssetId,
    sleeveHemAlign,
    garmentType,
    importedGarment,
  );
}

export function TshirtSvgPreview({
  constructionPanels,
  panellingEditor,
  fabricAssignments,
  fabricTextureIntensity,
  canvasOverlay,
  renderPanellingOverlay,
  semanticPanels,
  savedPanelling,
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
  renderMeasurements,
  onBuiltinDetailsChange,
  detailEditor,
  layerTransforms: builtinLayerTransforms,
  onLayerTransformChange,
  partFocus,
  showSelectionHint=true,
  materialHighlightIds=[],
  selectedLayerId = null,
  selectionContext,
  onSelectedLayerChange,
  liveCanvasScale = 1,
  className,
  fit,
  customCollar,
  customCollars,
  customAssetState,
  creationEditing = false,
  technicalView = false,
  regularConstruction = true,
  onMaterialDrop,
  onCustomAssetTransformChange,
  onCustomCollarEditsChange,
  onCustomAssetCanvasSizeChange,
}: TshirtSvgPreviewProps) {
  const previewInstance=useId();
  const inheritedTechnical=useTechnicalDrawing();
  const regularSleeveCleanup=regularConstruction&&garmentType==='tshirt'&&fit==='regular'&&(!customAssetState?.shoulderConstruction||customAssetState.shoulderConstruction==='set-in');
  const regularCleanup=regularSleeveCleanup&&detailView==='front';
  // Every T-shirt consumer uses the same SVG pipeline; explicit false is reserved for the comparison proof.
  const technical=inheritedTechnical??(garmentType==='tshirt');
  const [, setFabricScanRevision] = useState(0);
  const [washDraft, setWashDraft] = useState<GarmentWash | null>(null);
  const [openingDraft, setOpeningDraft] = useState<GarmentDetail | null>(null);
  const [collarContourRevision, setCollarContourRevision] = useState(0);
  const [collarContourError, setCollarContourError] = useState(false);
  const openingClipPrefix = useId().replace(/:/g, '');
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
  const layerTransforms = useMemo(() => customAssetTransforms(customAssetState ?? {}, garmentType, fit ?? 'slim', detailView ?? 'front', builtinLayerTransforms, canvasSize),
    [customAssetState, garmentType, fit, detailView, builtinLayerTransforms, canvasSize]);
  useEffect(() => { onCustomAssetCanvasSizeChange?.(canvasSize); }, [canvasSize, onCustomAssetCanvasSizeChange]);
  const customEditableIds = creationEditing && onCustomAssetTransformChange ? activeCustomAssets(customAssetState ?? {}, garmentType, fit ?? 'slim', detailView)
    .filter(item => item.definition.category !== 'pocket').map(item => item.definition.registration.layerId) : [];

  const fabricColor = color || '#5C7FB6';
  const bodyColor = partColors?.base ?? fabricColor;
  const editable = (!renderPanellingOverlay || Boolean(onMaterialDrop)) && Boolean(onSelectedLayerChange) && !washEditable && !labelEditor && !stitchEditor;
  const garmentAssetRevision = getGarmentAssetRevision();
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [dragHighlightId, setDragHighlightId] = useState<string | null>(null);
  const highlightDragTarget = useCallback((id: string, active: boolean) => {
    setDragHighlightId(current => active ? id : current === id ? null : current);
  }, []);
  const hoodieMaterialSelection = garmentType === 'hoodie' && Boolean(onMaterialDrop);

  const [visibleSurfaces,setVisibleSurfaces]=useState<BoundaryLoop[]>([]);
  const receiveVisibleSurfaces=useCallback((next:BoundaryLoop[])=>setVisibleSurfaces(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next),[]);
  const bodyHitSvg=useMemo(()=>{const loops=visibleSurfaces.filter(loop=>loop.surfaceId==='base');return loops.length?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="matrix(1 0 0 1 0 0)" fill="#000000"><path fill-rule="evenodd" d="'+loops.map(loop=>'M'+loop.points.map(p=>p.x+','+p.y).join('L')+'Z').join('')+'"/></g></svg>':undefined},[visibleSurfaces]);
  useEffect(() => setHoveredLayerId(null), [selectedLayerId, selectionContext, detailView, editable]);
  useEffect(() => {
    const clearHover = () => setHoveredLayerId(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      clearHover();
      onSelectedLayerChange?.(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', clearHover);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', clearHover);
    };
  }, [onSelectedLayerChange]);

  const structuralHemKey=JSON.stringify(tshirtHemStyles,(key,value)=>['distressAmount','distressDepth','frayAmount','distressSeed'].includes(key)?undefined:value);
  const structuralHemStyles=useMemo(()=>structuralHemKey?JSON.parse(structuralHemKey) as TshirtHemStyles:undefined,[structuralHemKey]);
  const structuralCustomAssetState=useMemo(()=>customAssetState?{torsoCrop:customAssetState.torsoCrop,shoulderConstruction:customAssetState.shoulderConstruction,importedGarment:customAssetState.importedGarment,garmentDetails:customAssetState.garmentDetails,customAssets:customAssetState.customAssets,customAssetInstances:customAssetState.customAssetInstances,customSleevesLinked:customAssetState.customSleevesLinked,customAssetAspectLocked:customAssetState.customAssetAspectLocked}:undefined,[customAssetState?.torsoCrop,customAssetState?.shoulderConstruction,customAssetState?.importedGarment,customAssetState?.garmentDetails,customAssetState?.customAssets,customAssetState?.customAssetInstances,customAssetState?.customSleevesLinked,customAssetState?.customAssetAspectLocked]);
  const sourceResolvedLayers = useMemo(() => {const result=resolveGarmentLayers({
        garmentType,
        view: detailView,
        selection,
        neckTrimColor,
        sleeveTrimColor,
        cuffTrimColor,
        pocketTrimColor,
        stitchingColor,
        partColors,
        tshirtHemStyles:structuralHemStyles,
        neckFinish,
        fit,
        customCollar,
        customCollars,
        customAssetState:structuralCustomAssetState,
      });const joined=regularSleeveCleanup?withRegularConstruction(result):result;return joined;}, [technical,regularSleeveCleanup,garmentType, detailView, selection, neckTrimColor, sleeveTrimColor, cuffTrimColor,
    pocketTrimColor, stitchingColor, partColors, structuralHemStyles, neckFinish, fit, customCollar,
    customCollars, structuralCustomAssetState, collarContourRevision, garmentAssetRevision]);
  const preparedLayers=useMemo(()=>technical&&garmentType==='tshirt'&&!customAssetState?.importedGarment?withTshirtSurfaceQuality(sourceResolvedLayers,fit,neckFinish,detailView,structuralHemStyles):sourceResolvedLayers,[technical,garmentType,customAssetState?.importedGarment,sourceResolvedLayers,fit,neckFinish,detailView,structuralHemStyles]);
  const lastReadyDrawing=useRef<ResolvedGarmentLayer[]>([]);
  const nativeTshirt = garmentType === 'tshirt' && !customAssetState?.importedGarment;
  const sleevePackFit = nativeTshirt ? resolveGarmentPackFit('tshirt', fit) ?? 'slim' : '';
  const sleevePackVariant = nativeTshirt
    ? tshirtSleeveVariant(getGarmentAsset(selection?.['Sleeve length'] ?? '')?.displayName ?? '')
    : undefined;
  const resolvedLayers=useMemo(()=>{
    const selectedNeck=getGarmentAsset(selection?.Neck??'');
    const awaitsTrace=garmentType==='tshirt'&&!customAssetState?.importedGarment&&tshirtNeckPackKind(selectedNeck?.displayName??sourceResolvedLayers.find(l=>l.id==='neck')?.displayName??'')&&!sourceResolvedLayers.some(l=>l.svgRaw.includes('data-raster-neck="true"'));
    // Keep the last complete traced drawing on screen until all new neck parts are ready.
    // Never publish the legacy fallback between the selection change and the async asset load.
    if(awaitsTrace || !tshirtSleeveAssetsReady(sleevePackFit, sleevePackVariant)
      ||(nativeTshirt&&fit==='oversized'&&!sourceResolvedLayers.some(l=>l.svgRaw.includes('data-oversized-reference'))))return lastReadyDrawing.current;
    let ready = preparedLayers;
    if (garmentType === 'tshirt' && !customAssetState?.importedGarment) {
      ready = withTorsoCrop(withCleanSleeveOpenings(withRoundedShoulderCaps(ready)), customAssetState?.torsoCrop);
      ready = refreshCroppedTshirtHem(ready, tshirtHemStyles);
      ready = refreshRawTshirtCuffs(ready, tshirtHemStyles);
      ready = withDistressedHem(ready, tshirtHemStyles);
      ready = withTshirtCasing(ready, tshirtHemStyles, detailView === 'front');
      ready = registerTshirtBottomHem(ready);
      ready = withoutBodyHemFoldInk(ready, tshirtHemStyles);
      if (neckFinish === 'raw' && !/polo/i.test(selectedNeck?.displayName ?? ready.find(layer => layer.id === 'neck')?.displayName ?? '')) {
        const bodyZ = ready.find(layer => layer.id === 'base')?.zIndex ?? 10;
        ready = ready.map(layer => {
          if (layer.id === 'innerBackNeck') return { ...layer, zIndex: bodyZ - 1, tint: lightenHex(bodyColor, .095) };
          if (layer.id !== 'base' || ![layer.svgRaw, layer.panellingClipSvgRaw].some(raw => raw?.includes('data-neck-support'))) return layer;
          const removeBacking = (raw: string) => raw.replace(/<g\b[^>]*data-neck-support="true"[^>]*>[\s\S]*?<\/g>/g, '');
          return { ...layer, svgRaw: removeBacking(layer.svgRaw),
            panellingClipSvgRaw: layer.panellingClipSvgRaw && removeBacking(layer.panellingClipSvgRaw) };
        });
      }
    }
    const rawOpening = neckFinish === 'raw' && !ready.some(layer => layer.id === 'neck');
    const owned=garmentType==='tshirt'&&!rawOpening&&!customAssetState?.importedGarment&&(technical||['slim','regular','boxy','oversized'].includes(fit??''))?withGarmentOutlineOwnership(ready):ready;
    lastReadyDrawing.current=owned;return owned;
  },[technical,garmentType,nativeTshirt,sleevePackFit,sleevePackVariant,customAssetState?.importedGarment,preparedLayers,sourceResolvedLayers,fit,neckFinish,detailView,selection,tshirtHemStyles,customAssetState?.torsoCrop,bodyColor]);
  useEffect(() => {
    if (tshirtSleeveAssetsReady(sleevePackFit, sleevePackVariant)) return;
    let active = true;
    void preloadTshirtSleeveAssets(sleevePackFit, sleevePackVariant).then(() => {
      if (active) setCollarContourRevision(revision => revision + 1);
    }).catch(error => {
      if (active) console.error('Could not load the T-shirt sleeve drawing.', error);
    });
    return () => { active = false; };
  }, [sleevePackFit, sleevePackVariant]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (garmentType === 'hoodie' && selection?.hoodieStyle === 'crewneck') {
        const { label } = hoodieNeckline(selection.hoodieNeckline);
        const finish = neckFinish === 'raw' && /polo/i.test(label) ? 'clean' : neckFinish ?? 'ribbed';
        return preloadTshirtNeckPack('regular', label, detailView, finish);
      }
      const packNeck = getGarmentAsset(selection?.Neck??'') ?? sourceResolvedLayers.find(layer => layer.id === 'neck');
      if (garmentType === 'tshirt' && packNeck && tshirtNeckPackKind(packNeck.displayName)) {
        return preloadTshirtNeckPack(resolveGarmentPackFit(garmentType, fit) ?? 'slim', packNeck.displayName,
          detailView === 'back' ? 'back' : 'front', neckFinish==='raw'&&/polo/i.test(packNeck.displayName)?'clean':neckFinish ?? 'ribbed');
      }
      let prepared = await prepareTshirtCollarContours(sourceResolvedLayers);
      if (garmentType === 'tshirt' && (detailView === 'back' || neckFinish === 'clean' || neckFinish === 'raw')) {
        const neck = sourceResolvedLayers.find(layer => layer.id === 'neck');
        const outline = sourceResolvedLayers.find(layer => layer.id === 'outline');
        if (neck && outline) {
          const bounds = getPotraceSvgBBoxFast(neck.svgRaw);
          if (bounds) {
            const halfWidth = (bounds.maxX - bounds.minX) / 2;
            await prepareRearCollarProfile(neck, 1024 - halfWidth, 1024 + halfWidth, outline);
            prepared = true;
          }
        }
      }
      if (garmentType === 'tshirt' && neckFinish && neckFinish !== 'ribbed') {
        prepared = await prepareTshirtNeckFinish(sourceResolvedLayers, neckFinish) || prepared;
      }
      return prepared;
    })().then(prepared => {
      if (active && (prepared || (garmentType==='tshirt'&&fit==='oversized'&&!sourceResolvedLayers.some(l=>l.svgRaw.includes('data-oversized-reference'))))) {
        setCollarContourError(false);
        setCollarContourRevision(revision => revision + 1);
      }
    }).catch(error => {
      if (!active) return;
      console.error('T-shirt collar contour preparation failed.', error);
      setCollarContourError(true);
    });
    return () => { active = false; };
  }, [sourceResolvedLayers, garmentType, detailView, neckFinish, fit, selection?.hoodieStyle, selection?.hoodieNeckline]);
  const layers = useMemo(
    () => constructionPanels?.length || panellingEditor?.enabled
      ? applyGarmentPanels(resolvedLayers, constructionPanels ?? [], detailView)
      : resolvedLayers,
    [resolvedLayers, constructionPanels, detailView, panellingEditor?.enabled],
  );

  const imported = customAssetState?.importedGarment;
  const constructionRegions = imported?.manifest[detailView === 'back' ? 'backView' : 'frontView']?.constructionRegions
    ?? (imported?.manifest.view === detailView ? imported.constructionRegions : undefined);
  const semanticRegionIds = new Set(constructionRegions?.regions.map(region => region.id));
  const semanticInkIds = new Set(imported?.parts.filter(part => part.structuralRole === 'source-ink').map(part => part.id));
  const fabricParts = useMemo(() => new Map(withPanellingFabricParts(fabricPartsFromLayers(imported
    ? [...importedGarmentLayers(imported, 'front'), ...importedGarmentLayers(imported, 'back')]
    : layers, garmentType),semanticPanels??[]).map(part => [part.id, part])), [layers, garmentType, imported,semanticPanels]);
  const fabricScanSurfaces = useMemo(() => {
    const parts = [...fabricParts.values()];
    const surfaces = new Map<string, { fabric: GarmentFabric; interior: boolean }>();
    for (const part of parts) {
      const { fabric, interior } = resolvePartMaterial(fabricAssignments, part, parts);
      if (fabric) surfaces.set(`${fabric.id}:${interior ? 'reverse' : 'face'}`, { fabric, interior });
    }
    return [...surfaces.values()];
  }, [fabricAssignments, fabricParts]);
  useEffect(() => {
    if (!fabricScanSurfaces.length) return;
    let active = true;
    void preloadFabricScanSurfaces(fabricScanSurfaces).then(() => {
      if (active) setFabricScanRevision(revision => revision + 1);
    }).catch(error => {
      if (!active) return;
      console.error('Could not load assigned fabric texture maps.', error);
      toast.error('Could not load one or more fabric texture maps.');
    });
    return () => { active = false; };
  }, [fabricScanSurfaces]);
  const garmentConfig = getGarmentSvgConfig(garmentType);
  const washBounds = useMemo(() => garmentPreviewBounds(
    layers.filter(layer => layer.kind === 'solid' && !['outline', 'innerBackNeck'].includes(layer.id))
      .map(layer => garmentPreviewLayerBounds(layer, customAssetState?.importedGarment)),
  ), [layers, customAssetState?.importedGarment]);
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

  const layerLayouts = useMemo(() =>
    buildLayerLayouts(
      layers,
      layerTransforms,
      sleeveLayer?.assetId,
      sleeveHemLayer?.assetId,
      sleeveHemAlign,
      garmentType,
      customAssetState?.importedGarment,
    ),
    [layers, layerTransforms, sleeveHemAlign, sleeveLayer?.assetId, sleeveHemLayer?.assetId, garmentType, customAssetState?.importedGarment],
  );

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
          if (hoodieMaterialSelection ? entry.sourceLayer.kind !== 'solid' : ['outline', 'stitching'].includes(entry.sourceLayer.id)) {
            return false;
          }
          return entry.bbox && isValidBBox(entry.bbox);
        })
        .sort((a, b) => b.sourceLayer.zIndex - a.sourceLayer.zIndex),
    [layerLayouts, hoodieMaterialSelection],
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
      if (!creationEditing || !onLayerTransformChange) return;
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
    [creationEditing, layerLayouts, onLayerTransformChange],
  );

  const handleLayerPointerDown = useCallback(
    (layerId: string, e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (hemEditor?.regions.some(region => region.id === layerId)) hemEditor.onSelect(layerId);
      onSelectedLayerChange?.(layerId);
    },
    [onSelectedLayerChange, hemEditor],
  );

  const handleBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-tshirt-hit-target]')) return;
      if (target.closest('[data-tshirt-selection]')) return;
      setHoveredLayerId(null);
      onSelectedLayerChange?.(null);
    },
    [onSelectedLayerChange],
  );

  const layerDisplayMatrix = (layout: typeof layerLayouts[number]) => {
      if (!layout.bbox) return new DOMMatrix();
      const { bbox } = layout;
      const transform = resolveLayerDisplayTransform(layout.id, layout.transform, bbox);
      const { scaleX, scaleY } = resolveLayerScale(transform);
      return new DOMMatrix().translate(bbox.centerX + transform.x * 2048 / canvasSize, bbox.centerY + transform.y * 2048 / canvasSize)
        .rotate(transform.rotation).scale(scaleX, scaleY)
        .translate((layout.alignOffset?.x ?? 0) - bbox.centerX, (layout.alignOffset?.y ?? 0) - bbox.centerY);
  };
  const displayBounds = (id: string) => {
      const layout = layerLayouts.find(item => item.id === id);
      if (!layout?.bbox) return undefined;
      const { bbox } = layout;
      const matrix = layerDisplayMatrix(layout);
      const points = [[bbox.minX, bbox.minY], [bbox.maxX, bbox.minY], [bbox.maxX, bbox.maxY], [bbox.minX, bbox.maxY]]
        .map(([pointX, pointY]) => matrix.transformPoint({ x: pointX, y: pointY }));
      return { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
        minY: Math.min(...points.map(point => point.y)), maxY: Math.max(...points.map(point => point.y)) };
  };
  const openingGeometry = useMemo(() => {
    const sources: OpeningSource[] = [];
    let poloOpeningY:number|undefined;
    for (const layout of layerLayouts) {
      const { sourceLayer, bbox } = layout;
      if (!bbox || sourceLayer.kind !== 'solid') continue;
      const role = layout.id === 'base' || layout.id === 'sleeves' ? 'body' : layout.id === 'neck' || layout.id === 'hood' && detailView === 'front' ? 'neck' : layout.id === 'bodyHem' ? 'hem' : undefined;
      if (!role) continue;
      const transform = resolveLayerDisplayTransform(layout.id, layout.transform, bbox);
      const scale = resolveLayerScale(transform);
      const matrix = new DOMMatrix().translate(bbox.centerX + transform.x * 2048 / canvasSize, bbox.centerY + transform.y * 2048 / canvasSize)
        .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY).translate((layout.alignOffset?.x ?? 0) - bbox.centerX, (layout.alignOffset?.y ?? 0) - bbox.centerY);
      sources.push({ id: layout.id, raw: sourceLayer.panellingClipSvgRaw ?? sourceLayer.svgRaw, role, matrix });
      if(role==='neck'&&/polo/i.test(sourceLayer.displayName)){
        const rings=fabricRings(sourceLayer.svgRaw).sort((a,b)=>{const area=(r:{x:number;y:number}[])=>Math.abs(r.reduce((n,p,i)=>{const q=r[(i+1)%r.length];return n+p.x*q.y-q.x*p.y},0));return area(b)-area(a)});
        if(rings[1]?.length){
          const throat=rings[1].map(point=>matrix.transformPoint(point));
          const center=(Math.min(...throat.map(p=>p.x))+Math.max(...throat.map(p=>p.x)))/2;
          // Stop at the collar opening, before the narrow V-shaped button-placket tail.
          const sides=throat.filter(point=>Math.abs(Math.abs(point.x-center)-40)<4);
          poloOpeningY=Math.max(...(sides.length?sides:throat).map(point=>point.y));
        }
      }
    }
    return {...compileOpeningGeometry(sources),poloOpeningY};
  }, [layerLayouts, resolveLayerDisplayTransform, canvasSize, detailView]);
  const rawNeckEdge = useMemo(() => {
    if (neckFinish !== 'raw' || customAssetState?.importedGarment) return [];
    if (garmentType === 'hoodie' && selection?.hoodieStyle === 'crewneck') {
      const layout = layerLayouts.find(item => item.id === 'neck' && item.sourceLayer.kind === 'detail');
      if (!layout) return [];
      const matrix = layerDisplayMatrix(layout);
      return fabricRings(layout.sourceLayer.svgRaw).flat().map(point => matrix.transformPoint(point));
    }
    if (garmentType !== 'tshirt' || layerLayouts.some(item => item.id === 'neck')) return [];
    const outline = layerLayouts.find(item => item.id === 'outline');
    const edge = outline?.sourceLayer.svgRaw.match(/<path\b[^>]*(?:data-ink-preserve|data-shoulder-neck-boundary)="true"[^>]*\/>/)?.[0];
    if (!outline || !edge) return [];
    const matrix = layerDisplayMatrix(outline);
    return frontRawNeckEdge(fabricRings(`<svg xmlns="http://www.w3.org/2000/svg">${edge}</svg>`))
      .map(point => matrix.transformPoint(point));
  }, [neckFinish, customAssetState?.importedGarment, garmentType, selection?.hoodieStyle, layerLayouts, resolveLayerDisplayTransform, canvasSize]);
  const rawBackLip = useMemo(() => {
    if (detailView !== 'front' || rawNeckEdge.length < 2) return [];
    const back = layerLayouts.find(item => item.id === 'innerBackNeck');
    if (!back) return [];
    const matrix = layerDisplayMatrix(back);
    return rawNeckBoundary(fabricRings(back.sourceLayer.svgRaw), 'back')
      .map(point => matrix.transformPoint(point));
  }, [detailView, rawNeckEdge, layerLayouts, resolveLayerDisplayTransform, canvasSize]);
  const rawBackLipPath = rawBackLip.length > 1
    ? 'M' + rawBackLip.map(({ x, y }) => `${x},${y}`).join('L') : undefined;
  const detailBounds: DetailBounds | undefined = (() => {
    if (customAssetState?.importedGarment) {
      const bounds = layers.filter(layer => layer.kind === 'solid').map(layer => displayBounds(layer.id)).filter(Boolean);
      return bounds.length ? { minX: Math.min(...bounds.map(bound => bound!.minX)), minY: Math.min(...bounds.map(bound => bound!.minY)),
        maxX: Math.max(...bounds.map(bound => bound!.maxX)), maxY: Math.max(...bounds.map(bound => bound!.maxY)) } : undefined;
    }
    const body = displayBounds('base');
    if (!body) return undefined;
    const hoodOpeningY = garmentType === 'hoodie' && detailView === 'front'
      ? (displayBounds('hoodLining') ?? displayBounds('hoodInterior'))?.maxY : undefined;
    const hoodZipY = hoodOpeningY === undefined ? undefined : (displayBounds('hood')?.maxY ?? hoodOpeningY) - 2;
    const frontNeck = garmentType === 'tshirt' && detailView === 'front' ? displayBounds('neck') : undefined;
    const centerEdge = rawNeckEdge.filter(point => Math.abs(point.x - 1024) < 12);
    const rawThroat = detailView === 'front' && centerEdge.length ? Math.max(...centerEdge.map(point => point.y)) : undefined;
    return { ...body, maxY: Math.max(body.maxY, displayBounds('bodyHem')?.maxY ?? body.maxY),
      necklineY: hoodZipY ?? frontNeck?.maxY ?? rawThroat ?? displayBounds('neck')?.maxY, hoodOpeningY, hoodZipY,
      tshirtFront: garmentType === 'tshirt' && detailView === 'front',
      frontNeckCenterX: frontNeck ? (frontNeck.minX + frontNeck.maxX) / 2
        : garmentType === 'tshirt' && detailView === 'front' && neckFinish === 'raw' ? 1024 : undefined,
      polo: /polo/i.test(layers.find(layer => layer.id === 'neck')?.displayName ?? ''), openingGeometry };
  })();
  useEffect(() => { onDetailBoundsChange?.(detailBounds); }, [onDetailBoundsChange, detailBounds?.minX, detailBounds?.minY, detailBounds?.maxX, detailBounds?.maxY, detailBounds?.necklineY, openingGeometry]);
  const liveDetails = useMemo(() => decorationsForView(garmentDetails, detailView).map(detail => {
    const draft = openingDraft ?? detailEditor?.draft;
    const current=draft?.id === detail.id ? draft : detail;
    return detailBounds&&draft?.id!==detail.id?anchorHoodTrim(reanchorOpening(current,detailBounds),detailBounds):current;
  }), [garmentDetails, detailView, openingDraft, detailEditor?.draft,detailBounds?.minX,detailBounds?.maxX,detailBounds?.minY,detailBounds?.necklineY,openingGeometry]);
  useEffect(()=>{
    if(!detailBounds||!onDetailsChange||openingDraft||detailEditor?.draft)return;
    let changed=false;
    const next=garmentDetails.map(detail=>{if((detail.view??'front')!==detailView)return detail;const anchored=anchorHoodTrim(reanchorOpening(detail,detailBounds),detailBounds);if(anchored!==detail)changed=true;return anchored;});
    if(changed)onDetailsChange(next);
  },[garmentDetails,detailView,detailBounds?.minX,detailBounds?.maxX,detailBounds?.minY,detailBounds?.necklineY,openingDraft,detailEditor?.draft,onDetailsChange,openingGeometry]);
  const openingStage = detailEditor?.openingStage ?? 'final';
  const openingCutsVisible = openingStage === 'construction' || openingStage === 'final';
  const openings = useMemo(() => detailBounds && openingCutsVisible ? constructOpenings(liveDetails, detailBounds) : undefined,
    [liveDetails, openingCutsVisible, openingGeometry, detailBounds?.minX, detailBounds?.minY, detailBounds?.maxX, detailBounds?.maxY]);
  const hoodieFront = garmentType === 'hoodie' && detailView === 'front' && !!detailBounds && !customAssetState?.importedGarment;
  const centerFrontZip = hoodieFront ? openings?.active.find(({ opening }) => opening &&
    ['neckline', 'full-front'].includes(opening.attachment) &&
    Math.abs(opening.start.x - (detailBounds!.minX + detailBounds!.maxX) / 2) <= 12 &&
    Math.abs(opening.start.x - opening.end.x) <= 12 && !opening.curve?.length &&
    Math.abs(opening.start.y - (detailBounds!.necklineY ?? opening.start.y)) < opening.width) : undefined;
  const hoodZipMouth = centerFrontZip && detailBounds?.hoodZipY !== undefined ? zipTapeMouth(centerFrontZip) : undefined;
  const poloZip = detailBounds?.polo && openings?.active.find(({ opening }) => opening &&
    ['neckline', 'full-front'].includes(opening.attachment) && !opening.curve?.length &&
    Math.abs(opening.start.x - (detailBounds.frontNeckCenterX ?? (detailBounds.minX + detailBounds.maxX) / 2)) <= 16 &&
    Math.abs(opening.start.x - opening.end.x) <= 12);
  const poloMouth = poloZip ? zipTapeMouth(poloZip) : undefined;
  const poloJoin = poloMouth
    ? [poloMouth.left, poloMouth.right].map((edge, index) => {
        const center = (poloMouth.left.x + poloMouth.right.x) / 2;
        const offset = garmentType === 'tshirt' ? 60 : 40;
        const startX = center + (index === 0 ? -offset : offset);
        const startY = (openingGeometry.poloOpeningY ?? edge.y) - (garmentType === 'tshirt' ? 5 : 0);
        return `M${startX},${startY}Q${(startX + edge.x) / 2},${edge.y} ${edge.x},${edge.y}`;
      }).join('') : undefined;
  const rawHoodLayout = garmentType === 'hoodie' && detailView === 'front' && selection?.hoodOpeningFinish === 'raw'
    ? layerLayouts.find(layout => layout.id === 'hoodFaceOutline') : undefined;
  const rawHoodEdge = rawHoodLayout ? (() => {
    const matrix = layerDisplayMatrix(rawHoodLayout);
    const inverse = matrix.inverse();
    const raw = rawHoodLayout.sourceLayer.svgRaw;
    const facing = hoodZipMouth
      ? joinHoodFaceToZip(raw, inverse.transformPoint(hoodZipMouth.left), inverse.transformPoint(hoodZipMouth.right))
      : raw;
    const path = new DOMParser().parseFromString(facing, 'image/svg+xml').querySelector('path[d]');
    if (!path) return [];
    const d = svgpath(path.getAttribute('d')!).transform(path.getAttribute('transform') ?? '').toString();
    return flattenPathContours(d, 2, true).map(points => points.map(point => matrix.transformPoint(point)));
  })() : [];
  const fullFrontZip = centerFrontZip?.opening && (centerFrontZip.opening.attachment === 'full-front' ||
    centerFrontZip.opening.end.y >= (detailBounds?.maxY ?? Infinity) - 15) ? centerFrontZip.opening : undefined;
  const hoodPocket = hoodieFront && liveDetails.some(detail => !detail.hidden && detail.type === 'pocket' && detail.variant?.startsWith('hoodie-'));
  const addedHoodCord = hoodieFront && liveDetails.some(detail => !detail.hidden && detail.type === 'drawstring');
  const visibleDetailHardware = liveDetails.filter(detail => (openingStage === 'final' || !detail.opening) &&
    (detail.type !== 'drawstring' && detail.type !== 'hoodDetail' || !hoodieFront || detailBounds?.hoodOpeningY !== undefined)).map(detail => {
      if (!fullFrontZip || !detailBounds || !['hoodie-kangaroo', 'hoodie-hidden-zip', 'hoodie-split'].includes(detail.variant ?? '')) return detail;
      const split: GarmentDetail = { ...detail, variant: 'hoodie-split', x: .5, rotation: 0 };
      return { ...split, splitPocketGap: 200 * fullFrontZip.width / detailPlacement(split, detailBounds).width };
    });
  const stockPocket = hoodieFront && fullFrontZip && !hoodPocket && layers.some(layer => layer.id === 'pocket') && detailBounds
    ? ({ id: 'stock-split-pocket', type: 'pocket', variant: 'hoodie-split', name: 'Split kangaroo pocket', x: .5, y: .73, scale: 1,
        fill: partColors?.pocket ?? bodyColor, outline: '#202020', stitch: stitchingColor ?? '#B0B0B0', hardware: '#D4D4D4',
        splitPocketGap: 200 * fullFrontZip.width / ((detailBounds.maxX - detailBounds.minX) * .69), selected: false } satisfies GarmentDetail)
    : undefined;
  const stitchOpeningClip = useMemo(() => openings?.inkCut.length ? openingLayerClip(openings.inkCut) : '', [openings]);
  const backNeckLayer = layers.find(layer => layer.id === 'innerBackNeck');
  const openingInteriorColor = backNeckLayer
    ? resolveLayerFill(backNeckLayer, fabricColor, bodyColor)
    : bodyColor;

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

  const { geometry: stitchGeometry } = useStitchGeometry(layers, fit ?? 'slim', Boolean(stitchEditor),technical);
  const visibleStitchRegions = stitchGeometry ? availableStitchRegions(stitchGeometry, tshirtHemStyles) : [];
  const focusedStitchRegion = stitchEditor&&stitchGeometry?chooseStitchFocusRegion(stitchRegionsWithInk(stitchGeometry,tshirtStitching??{},tshirtHemStyles),stitchEditor.region):undefined;
  const stitchCamera = stitchEditor?.closeUp && stitchGeometry && focusedStitchRegion
    ? stitchFocus(stitchGeometry, focusedStitchRegion) : { x: 1024, y: 1024, scale: 1 };
  const detailCamera = (() => {
    const selected = decorationsForView(garmentDetails, detailView).find(detail => detail.id === selectedDetailId);
    if (!detailEditor?.closeUp || !selected || !detailBounds) return undefined;
    const placement = detailPlacement(selected, detailBounds);
    const radians = detailRotation(selected) * Math.PI / 180;
    let left = placement.left, top = placement.top, width = placement.width, height = placement.height;
    if (selected.type === 'zip') {
      const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(selected).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
      const sourceHeight = sourceWidth * placement.height / placement.width;
      const hardware = zipHardwareGeometry(selected, sourceWidth, sourceHeight);
      const pullY = hardware.pullY + 22 * hardware.hardwareScale;
      if (detailEditor.part === 'pull') {
        const offsetY = ((selected.flipY ? 1 - pullY / sourceHeight : pullY / sourceHeight) - .5) * placement.height;
        return {x:left+width/2-Math.sin(radians)*offsetY,y:top+height/2+Math.cos(radians)*offsetY,scale:Math.min(6, Math.max(1, 700 / Math.max(width, 70 * hardware.hardwareScale * width/sourceWidth)))};
      }
      // Include hardware extending beyond the tape before fitting the whole zip.
      const extra = Math.max(0, hardware.pullY + 70 * hardware.hardwareScale - sourceHeight) * width / sourceWidth;
      height += extra;
      if (selected.flipY) top -= extra;
    }
    const offset = (top + height/2) - (placement.top + placement.height/2);
    const rotatedWidth = Math.abs(Math.cos(radians))*width + Math.abs(Math.sin(radians))*height;
    const rotatedHeight = Math.abs(Math.sin(radians))*width + Math.abs(Math.cos(radians))*height;
    return {x:left+width/2-Math.sin(radians)*offset,y:placement.top+placement.height/2+Math.cos(radians)*offset,
      scale:Math.min(6, 1350 / Math.max(rotatedWidth,rotatedHeight,1))};
  })();
  const hemBounds = hemEditor ? displayBounds(hemEditor.region) : undefined;
  const hemCamera = hemEditor?.closeUp && hemBounds ? {
    x: (hemBounds.minX + hemBounds.maxX) / 2, y: (hemBounds.minY + hemBounds.maxY) / 2,
    scale: Math.min(5, Math.max(1.2, 1500 / Math.max(hemBounds.maxX - hemBounds.minX, hemBounds.maxY - hemBounds.minY))),
  } : undefined;
  const selectedCollar = creationEditing && editable && !hemEditor && onCustomCollarEditsChange && activeCustomAssets(customAssetState ?? {}, garmentType, fit ?? 'slim', detailView)
    .find(item => item.definition.category === 'collar' && item.definition.registration.layerId === selectedLayerId);
  const collarGeometry = selectedCollar ? collarEditGeometry(selectedCollar.definition.svg) : undefined;
  const collarCamera = collarGeometry ? { x: collarGeometry.left + collarGeometry.width / 2,
    y: collarGeometry.top + collarGeometry.height * .8, scale: 3 } : undefined;
  const focusedPart=partFocus?layerLayouts.find(layer=>layer.id===partFocus):undefined;
  const fixedHoodieCloseUp = garmentType === 'hoodie' && !customAssetState?.importedGarment && (partFocus === 'hood' || partFocus === 'neck');
  const partCamera = fixedHoodieCloseUp ? { x: 1024, y: 440, scale: 2 }
    : focusedPart?.bbox ? { x: focusedPart.bbox.centerX, y: focusedPart.bbox.centerY,
      scale: Math.max(1.8, Math.min(4, 1100 / Math.max(focusedPart.bbox.maxX - focusedPart.bbox.minX, focusedPart.bbox.maxY - focusedPart.bbox.minY))) }
      : undefined;
  const previewCamera = partCamera ?? (partFocus ? {x:1024,y:1024,scale:1} : undefined) ?? collarCamera ?? hemCamera ?? detailCamera ?? stitchCamera;

  const panellingGeometry = useMemo(() => {
    if (!renderPanellingOverlay&&!technical&&!['regular','boxy'].includes(fit??'')) return '';
    const fullCut = renderPanellingOverlay && openings && detailBounds ? panellingFullZipCut(openings.active, detailBounds) : '';
    const cuts = openings?.removed.length
      ? Object.fromEntries(openingGeometry.panels.map(panel => [panel.id,
        fullCut && ['base', 'bodyHem'].includes(panel.id) ? fullCut : openingPolygonPath(panel.id === 'neck' ? openings.collarCut : openings.removed)]))
      : {};
    return livePanellingMarkup(layerLayouts.filter(layout => !decorationsForView(garmentDetails, detailView).some(detail => detail.sourceLayerId === layout.id)).map(layout => {
      const {bbox} = layout;
      const transform = resolveLayerDisplayTransform(layout.id, layout.transform, bbox);
      const scale = resolveLayerScale(transform);
      const cx = bbox?.centerX ?? 1024, cy = bbox?.centerY ?? 1024;
      const matrix = new DOMMatrix().translate(cx + transform.x * 2048 / canvasSize, cy + transform.y * 2048 / canvasSize)
        .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY)
        .translate((layout.alignOffset?.x ?? 0) - cx, (layout.alignOffset?.y ?? 0) - cy);
      return { id:layout.id, source:layout.sourceLayer, side:layout.side, matrix:matrix.toString() };
    }), cuts);
  }, [Boolean(renderPanellingOverlay),technical,layerLayouts,resolveLayerDisplayTransform,canvasSize,garmentDetails,detailView,openings,openingGeometry,detailBounds?.frontNeckCenterX]);

  const toolHint = useMemo(() => {
    if (!editable || !selectedLayerId || hemEditor || collarGeometry) return null;
    if (gestureLayerId) return `Adjusting ${selectedDisplayName}…`;
    return creationEditing ? 'Drag to move or use geometry handles' : `${selectedDisplayName} - select and configure`;
  }, [creationEditing, editable, gestureLayerId, selectedDisplayName, selectedLayerId, hemEditor, collarGeometry]);

  return (
    <RegularConstructionContext.Provider value={regularCleanup}><TechnicalDrawingContext.Provider value={technical}><TshirtPreviewInkContext.Provider value={nativeTshirt && !technicalView}><div
      className={cn(
        GARMENT_PREVIEW_CONTAINER_CLASS,
        className,
      )}
      data-tshirt-preview=""
      data-fold-geometry={JSON.stringify(layerLayouts.filter(layout=>layout.bbox&&['neck','base'].includes(layout.id)).map(layout=>{const box=layout.bbox!,t=resolveLayerDisplayTransform(layout.id,layout.transform,box),scale=resolveLayerScale(t);const matrix=new DOMMatrix().translate(box.centerX+t.x*2048/canvasSize,box.centerY+t.y*2048/canvasSize).rotate(t.rotation).scale(scale.scaleX,scale.scaleY).translate((layout.alignOffset?.x??0)-box.centerX,(layout.alignOffset?.y??0)-box.centerY);const points=[[box.minX,box.minY],[box.maxX,box.minY],[box.minX,box.maxY],[box.maxX,box.maxY]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));return {id:layout.id,left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))}}))}
      data-preview-instance={previewInstance}
      onPointerDown={editable ? handleBackgroundPointerDown : undefined}
      onPointerLeave={() => setHoveredLayerId(null)}
      onPointerCancel={() => setHoveredLayerId(null)}
      style={stitchEditor || detailCamera || hemEditor || collarCamera || partFocus ? { overflow: 'hidden' } : undefined}
    >
      <div
        ref={canvasRef}
      data-garment-camera="true"
        data-garment-interior-color={openingInteriorColor}
        className={cn(GARMENT_PREVIEW_CANVAS_CLASS, 'motion-reduce:!transition-none')}
        data-stitch-camera={stitchEditor ? `${focusedStitchRegion}:${stitchEditor.closeUp ? 'close-up' : 'garment'}` : undefined}
        data-detail-camera={detailCamera ? 'close-up' : 'garment'}
        data-part-focus={partFocus}
        data-hem-camera={hemEditor ? `${hemEditor.region}:${hemEditor.closeUp ? 'close-up' : 'garment'}` : undefined}
        style={stitchEditor || detailCamera || hemEditor || collarCamera || partFocus ? {
          width: `calc(min(100cqh, 100cqw) * ${partFocus ? 1 : previewCamera.scale})`,
          height: `calc(min(100cqh, 100cqw) * ${partFocus ? 1 : previewCamera.scale})`,
          transform: `${partFocus ? `scale(${previewCamera.scale}) ` : ''}translate(${(1024 - previewCamera.x) / 2048 * 100}%, ${(1024 - previewCamera.y) / 2048 * 100}%)`,
          transition: partFocus ? 'transform 700ms cubic-bezier(.22,1,.36,1)' : detailCamera || collarCamera ? undefined : 'width 850ms cubic-bezier(.22,.68,0,1), height 850ms cubic-bezier(.22,.68,0,1), transform 850ms cubic-bezier(.22,.68,0,1)',
          transformOrigin: 'center',
        } : undefined}
      >
        {!!openings?.removed.length && <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <path data-opening-interior="" d={openingPolygonPath(openings.removed)} fill={openingInteriorColor} fillRule="evenodd" />
        </svg>}
        {layerLayouts.map(layout => {
          const { id, sourceLayer, side, transform, alignOffset, bbox } = layout;
          if (overriddenTrimIds.has(id)) return null;
          if (id === 'stitchingHoodFacing' && !hoodZipMouth) return null;
          if (hoodieFront && ((hoodPocket || fullFrontZip) && ['pocket', 'hoodiePocketOutline', 'hoodiePocketStitching'].includes(id) ||
            addedHoodCord && id === 'drawstring' || hoodZipMouth && ['hoodOverlap', 'hoodFaceSeams'].includes(id))) return null;
          if (sourceLayer.id === 'stitching' && garmentType === 'tshirt') {
            return <React.Fragment key="stitching">
              {stitchOpeningClip && <svg className="absolute h-0 w-0" aria-hidden><defs><clipPath id={`${openingClipPrefix}-stitch`} clipPathUnits="objectBoundingBox"><path d={stitchOpeningClip} transform="scale(0.00048828125)" clipRule="evenodd" /></clipPath></defs></svg>}
              <div className="pointer-events-none absolute inset-0" style={{ clipPath: stitchOpeningClip ? `url(#${openingClipPrefix}-stitch)` : undefined, zIndex: Math.min(sourceLayer.zIndex,90) }}>
                <TshirtStitchingLayer previewInk={!technicalView && !customAssetState?.importedGarment} layers={layers} fit={fit ?? 'slim'} settings={tshirtStitching ?? {}} hems={tshirtHemStyles} fabricColor={fabricColor} />
              </div>
            </React.Fragment>;
          }
          const rawHem=/^(bodyHem|sleeveHem(?:Left|Right)|underlayerHem(?:Left|Right))$/.test(id)&&resolveHemSettings(tshirtHemStyles,id).finish==='none'&&sourceLayer.hemSource!=='uploaded';
          if(rawHem)return null;
          const scaleFixedAnchor =
            scaleGestureStorageId && transformStorageId(id) === scaleGestureStorageId
              ? activeScaleAnchor
              : null;
          const displayTransform = resolveLayerDisplayTransform(id, transform, bbox);
          const fabricPart = fabricParts.get(id);
          const material = fabricPart ? resolvePartMaterial(fabricAssignments, fabricPart, [...fabricParts.values()]) : undefined;
          const rawBodyEdge = id === 'base' && garmentType === 'tshirt' && detailView === 'front' && rawNeckEdge.length > 1
            ? rawNeckEdge.map(point => layerDisplayMatrix(layout).inverse().transformPoint(point)) : undefined;
          const rawBodyMask = rawBodyEdge && (() => {
            const start = rawBodyEdge[0], end = rawBodyEdge.at(-1)!;
            const cut = `M${start.x},0V${start.y}L${rawBodyEdge.slice(1).map(p => `${p.x},${p.y}`).join('L')}V0Z`;
            const maskId = openingClipPrefix + '-raw-body';
            return `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d="${cut}" fill="black"/></mask></defs>`;
          })();
          const hoodFace = hoodZipMouth && sourceLayer.svgRaw.includes('data-hood-face=');
          const drawingLayer = hoodFace ? (() => {
            const inverse = layerDisplayMatrix(layout).inverse();
            return { ...sourceLayer, svgRaw: joinHoodFaceToZip(sourceLayer.svgRaw,
              inverse.transformPoint(hoodZipMouth.left), inverse.transformPoint(hoodZipMouth.right)) };
          })() : rawBodyMask ? { ...sourceLayer, necklinePaintMask: rawBodyMask } : sourceLayer;

          return (
            <PreviewLayer
              key={`${sourceLayer.category}-${id}`}
              layerId={id}
              materialHighlight={hoodieMaterialSelection && sourceLayer.kind === 'solid' &&
                (selectedLayerId === id || materialHighlightIds.includes(id) ||
                  hoveredLayerId === id || dragHighlightId === id)}
              fabric={technicalView || sourceLayer.svgRaw.includes('data-drawn-hem-ribbing') ||
                garmentType === 'hoodie' && selection?.hoodieStyle === 'crewneck' && id === 'neck' ? undefined : material?.fabric}
              textureIntensity={partTextureIntensity(fabricTextureIntensity, id) *
                (selection.hoodieFit === 'slim' && sourceLayer.assetId?.startsWith('studio-hoodie:') &&
                  /^(bodyHem|sleeveHemLeft|sleeveHemRight)$/.test(id) ? .65 : 1)}
              materialParts={[...fabricParts.values()]}
              partColors={partColors}
              constructionPanels={constructionPanels}
              semanticPanels={semanticPanels}
              panellingEditor={panellingEditor}
              technicalView={technicalView}
              appearanceColor={sourceLayer.kind === 'solid' && id !== 'outline' ? partColors?.[id] : undefined}
              fabricAssignments={fabricAssignments}
              fabricTextureIntensity={fabricTextureIntensity}
              interior={material?.interior}
              openingCut={id === 'outline' ? openings?.collarInkCut
                : hoodieFront && (id === 'hoodieBodyLinework' || id.startsWith('stitching') || sourceLayer.svgRaw.includes('data-hoodie-hem-ribs')) ? openings?.inkCut
                : id === 'neck' || id === 'hoodieNeckRibs' ? openings?.collarCut
                : id === 'innerBackNeck' && detailBounds?.polo || hoodFace && id !== 'hoodFaceOutline' || openingGeometry.panels.some(panel => panel.id === id) ? openings?.removed : undefined}
              layer={drawingLayer}
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

        {!!openings?.placketFill.length&&(()=>{
          const repair='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="white" fill-rule="evenodd" d="'+openingPolygonPath(openings.placketFill)+'"/></svg>';
          const mask='url("data:image/svg+xml,'+encodeURIComponent(repair)+'")';
          const bodyPart=fabricParts.get('base'),bodyMaterial=bodyPart?resolvePartMaterial(fabricAssignments,bodyPart,[...fabricParts.values()]):undefined;
          const panelFill=(id:string,raw:string,fallback:string)=>{const part=fabricParts.get(id),material=part?resolvePartMaterial(fabricAssignments,part,[...fabricParts.values()]):undefined;return <InlineSvg key={id} raw={raw} fill={partColors?.[id]??fallback} fabricColor={bodyColor} fabric={material?.fabric??bodyMaterial?.fabric} interior={material?.interior??bodyMaterial?.interior} textureIntensity={partTextureIntensity(fabricTextureIntensity,id)}/>};
          const collarZ = layers.find(layer => layer.id === 'neck')?.zIndex ?? 32;
          return <div className="pointer-events-none absolute inset-0" data-polo-placket-fill="true" style={{zIndex:collarZ-1,maskImage:mask,WebkitMaskImage:mask,maskSize:'100% 100%',WebkitMaskSize:'100% 100%',maskRepeat:'no-repeat',WebkitMaskRepeat:'no-repeat'}}>
            {panelFill('base',repair.replace('fill="white"','fill="#000000"'),bodyColor)}
            {([-1,1] as const).map(side=>{
              const points=openings.placketFill.flat(2),center=detailBounds?(detailBounds.minX+detailBounds.maxX)/2:1024,top=Math.min(...points.map(point=>point[1]));
              const panel=poloRepairPanel(semanticPanels??[],{x:center+side*110,y:top+60});if(!panel)return null;
              const half='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><rect x="'+(side<0?0:center)+'" y="0" width="'+(side<0?center:2048-center)+'" height="2048" fill="#000000"/></svg>';
              return <div key={'adjacent-'+side} className="absolute inset-0" data-polo-adjacent-panel={panel.id}>{panelFill(panel.id,half,panel.fillOverride??partColors?.base??bodyColor)}</div>;
            })}
            {semanticPanels?.filter(panel=>panel.parentId==='base'&&(panel.seamIds.length>0||panel.fillOverride)).map(panel=><div key={panel.id} className="absolute inset-0" data-polo-panel-repair={panel.id}>{panelFill(panel.id,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="#000000" fill-rule="evenodd" d="'+panel.path+'"/></svg>',panel.fillOverride??partColors?.base??bodyColor)}</div>)}
            {layers.find(layer=>layer.id==='base')?.colourPanels?.map(panel=><div key={panel.id} className="absolute inset-0">{panelFill(panel.id,panel.svgRaw,panel.tint??partColors?.base??bodyColor)}</div>)}
          </div>;
        })()}

        {garmentType==='tshirt'&&(technical||['slim','regular','boxy','oversized'].includes(fit??''))&&
          <TechnicalLinework previewInk={!technicalView && !customAssetState?.importedGarment} completeOutline={!customAssetState?.importedGarment} visibleClip={stitchOpeningClip} onSurfacesChange={receiveVisibleSurfaces} repairOnly geometryMarkup={panellingGeometry} colour={constructionColor(bodyColor)} stitchOnlyHems={['sleeveHemLeft','sleeveHemRight','bodyHem','underlayerHemLeft','underlayerHemRight'].join(',')}/>}
        {poloJoin && <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:115}} aria-hidden="true">
          <path data-polo-zip-join="" d={poloJoin} fill="none" stroke={constructionColor(bodyColor)} strokeWidth="3.5" strokeLinecap="round"/>
        </svg>}
        {(rawNeckEdge.length > 1 || rawHoodEdge.length > 0) && <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:115}} aria-hidden="true">
          {stitchOpeningClip && <defs><clipPath id={openingClipPrefix + '-raw-neck'}><path d={stitchOpeningClip} clipRule="evenodd"/></clipPath></defs>}
          <path data-raw-neck-edge="" d={rawNeckEdgeInk(rawNeckEdge)} fill="none"
            stroke={lightenHex(bodyColor, .58)} strokeWidth="1.65" strokeLinecap="round" opacity=".85"
            clipPath={stitchOpeningClip ? `url(#${openingClipPrefix}-raw-neck)` : undefined}/>
          {rawBackLipPath && <g data-raw-back-neck-edge="">
            <path d={rawBackLipPath} fill="none" stroke={bodyColor} strokeWidth="4.4" strokeLinejoin="round"/>
            <path d={rawNeckEdgeInk(rawBackLip, 1.8)} fill="none" stroke={lightenHex(bodyColor, .55)} strokeWidth="2" strokeLinecap="round"/>
          </g>}
          {rawHoodEdge.length > 0 && <path data-raw-hood-edge="" d={rawHoodEdge.map(rawNeckEdgeInk).join('')} fill="none"
            stroke={lightenHex(partColors?.hood ?? bodyColor, .62)} strokeWidth="1.7" strokeLinecap="round" opacity=".85"
            clipPath={stitchOpeningClip ? `url(#${openingClipPrefix}-raw-neck)` : undefined}/>}
        </svg>}
        {canvasOverlay}
        {savedPanelling?.seams.length? <PanellingReadOnlyOverlay {...savedPanelling}/>:null}
        {renderPanellingOverlay?.(panellingGeometry)}
        {editable && !panellingEditor?.enabled
          ? hitTargets.map(({ id, sourceLayer, side, transform, alignOffset, bbox }) =>
              bbox && !semanticRegionIds.has(id) && !semanticInkIds.has(id) && !overriddenTrimIds.has(id) && !customEditableIds.includes(id) ? (
                <React.Fragment key={`hit-${id}`}>
                <LayerHitTarget
                  surfaceHighlight={hoodieMaterialSelection}
                  onDragHighlight={hoodieMaterialSelection ? highlightDragTarget : undefined}
                  layerId={id}
                  displayName={
                    side
                      ? `${side === 'left' ? 'Left' : 'Right'} ${sourceLayer.displayName}`
                      : sourceLayer.displayName
                  }
                  onMaterialDrop={onMaterialDrop}
                  raw={technical&&id==='base'&&bodyHitSvg?bodyHitSvg:sourceLayer.svgRaw}
                  side={side}
                  zIndexBase={sourceLayer.zIndex}
                  bbox={bbox}
                  transform={technical&&id==='base'&&bodyHitSvg?{x:0,y:0,scale:1,rotation:0}:transform}
                  alignOffset={technical&&id==='base'&&bodyHitSvg?undefined:alignOffset}
                  selected={selectedLayerId === id||materialHighlightIds.includes(id)}
                  hovered={(hoodieMaterialSelection || !selectedLayerId) && hoveredLayerId === id}
                  onHover={setHoveredLayerId}
                  onPointerDown={(e) => handleLayerPointerDown(id, e)}
                />
                {sourceLayer.colourPanels?.map((panel, index) => <LayerHitTarget key={panel.id}
                  layerId={panel.id} displayName={`${sourceLayer.displayName} panel ${index + 1}`}
                  raw={panel.svgRaw} side={side} zIndexBase={sourceLayer.zIndex + 0.5}
                  bbox={bbox} transform={transform} alignOffset={alignOffset}
                  selected={selectedLayerId === panel.id} onMaterialDrop={onMaterialDrop}
                  hovered={!selectedLayerId && hoveredLayerId === panel.id} onHover={setHoveredLayerId}
                  onPointerDown={event => handleLayerPointerDown(panel.id, event)} />)}
                </React.Fragment>
              ) : null,
            )
          : null}

        {editable && constructionRegions && <ConstructionRegionHitTargets
          regions={constructionRegions.regions.filter(region => region.view === detailView)}
          selectedId={selectedLayerId} onSelect={onSelectedLayerChange} onMaterialDrop={onMaterialDrop} />}

        {editable&&onMaterialDrop&&semanticPanels?.filter(panel=>panel.seamIds.length>0).map(panel=><SeamPanelMaterialTarget key={panel.id} panel={panel} selected={selectedLayerId===panel.id} hovered={!selectedLayerId&&hoveredLayerId===panel.id} onHover={setHoveredLayerId} onSelect={onSelectedLayerChange} onMaterialDrop={onMaterialDrop}/>)}

        {stitchEditor && stitchGeometry && focusedStitchRegion && <StitchRegionOverlay geometry={stitchGeometry}
          hems={tshirtHemStyles} editor={{ ...stitchEditor, region: focusedStitchRegion }} />}

        {creationEditing && !washEditable && !labelEditor && !stitchEditor && !hemEditor && selectedLayout?.bbox && selectedLayerId && !semanticRegionIds.has(selectedLayerId) && !semanticInkIds.has(selectedLayerId) && !customEditableIds.includes(selectedLayerId) && selectedDisplayTransform ? (
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
        {creationEditing && editable && !hemEditor && onCustomAssetTransformChange && <CustomAssetEditorOverlay state={customAssetState ?? {}} garmentType={garmentType}
          fit={fit ?? 'slim'} view={detailView} selectedId={selectedLayerId} canvasSize={canvasSize}
          onSelect={id => onSelectedLayerChange?.(id)} onChange={onCustomAssetTransformChange}
          onCollarChange={onCustomCollarEditsChange} cameraScale={previewCamera.scale} />}
        {stockPocket && detailBounds && <GarmentDetailsOverlay view={detailView} details={[stockPocket]} bounds={detailBounds} />}
        {garmentDetails.length > 0 && (() => {
          const bodyBounds = detailBounds;
          return bodyBounds ? <GarmentDetailsOverlay key={detailView} view={detailView}
            details={visibleDetailHardware} bounds={bodyBounds}
            selectedId={selectedDetailId} onSelect={onDetailSelect}
            editor={detailEditor}
            onChange={onDetailsChange ? details => onDetailsChange([...garmentDetails.flatMap(detail => {
              if ((detail.view ?? 'front') !== detailView || (openingStage !== 'final' && detail.opening)) return [detail];
              if (!visibleDetailHardware.some(candidate => candidate.id === detail.id)) return [detail];
              const next = details.find(candidate => candidate.id === detail.id);
              return next ? [{ ...next, variant: detail.variant, splitPocketGap: undefined }] : [];
            }), ...details.filter(candidate => !garmentDetails.some(detail => detail.id === candidate.id)).map(detail => ({...detail,view:detailView}))]) : undefined} /> : null;
        })()}
        {detailBounds && openingStage !== 'before' && liveDetails.some(detail => detail.opening) && <OpeningConstruction stage={openingStage} details={liveDetails} bounds={detailBounds} selectedId={selectedDetailId}
          onSelect={onDetailSelect} stitching={tshirtStitching}
          onDraftChange={draft => { setOpeningDraft(draft); detailEditor?.onDraftChange?.(draft); }}
          onChange={onDetailsChange ? next => onDetailsChange(garmentDetails.map(detail => detail.id === next.id ? next : detail)) : undefined} />}
        {(garmentType === 'tshirt' || customAssetState?.importedGarment) && garmentLabels.length > 0 && <GarmentLabelOverlay
          labels={garmentLabels} view={detailView} referenceWidthMm={labelReferenceWidthMm}
          manualPlacement={Boolean(customAssetState?.importedGarment)} manualBounds={detailBounds}
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
        {renderMeasurements?.(layerLayouts.filter(layout => layout.bbox && layout.sourceLayer.kind === 'solid' && !overriddenTrimIds.has(layout.id)).map(layout => {
          const bbox = layout.bbox!;
          const transform = resolveLayerDisplayTransform(layout.id, layout.transform, bbox);
          const scale = resolveLayerScale(transform);
          const matrix = new DOMMatrix().translate(bbox.centerX + transform.x * 2048 / canvasSize, bbox.centerY + transform.y * 2048 / canvasSize)
            .rotate(transform.rotation).scale(scale.scaleX, scale.scaleY).translate((layout.alignOffset?.x ?? 0) - bbox.centerX, (layout.alignOffset?.y ?? 0) - bbox.centerY);
          const assetName = getGarmentSvgConfig(garmentType).stepCategories[6]?.includes(layout.sourceLayer.category)
            ? `${layout.sourceLayer.category}: ${layout.sourceLayer.displayName}` : undefined;
          return { id: layout.id, svgRaw: layout.sourceLayer.svgRaw, bbox, matrix: matrix.toString(), assetName, shoulderPoint:layout.sourceLayer.measurementShoulder, underarmPoint:layout.sourceLayer.measurementUnderarm };
        }), detailBounds)}
        {washEditable && showWash && garmentWash && washBounds && washTool && onWashChange && onWashToolChange && <WashEditor
          key={detailView} wash={washDraft ?? garmentWash} bounds={washBounds} view={detailView} tool={washTool}
          onToolChange={onWashToolChange} onDraft={setWashDraft} onCommit={onWashChange} />}
      </div>

      {collarContourError && <p role="alert" className="sr-only">
        Garment geometry preparation failed. The original preview is still shown.
      </p>}
      {hemEditor && <div className="pointer-events-none absolute left-2 top-2 z-[260] bg-white/90 px-2 py-1 text-xs text-[#171717]">
        {hemEditor.regions.find(region => region.id === hemEditor.region)?.name}
      </div>}
      {showSelectionHint&&toolHint ? (
        <p className="pointer-events-none absolute -bottom-6 left-1/2 z-10 w-max max-w-full -translate-x-1/2 text-center text-[9px] leading-snug text-white/35">
          {toolHint}
        </p>
      ) : null}
    </div></TshirtPreviewInkContext.Provider></TechnicalDrawingContext.Provider></RegularConstructionContext.Provider>
  );
}
