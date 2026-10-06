import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { textCurveRadius, updateTextCurve, type TextCurvePatch } from '../../lib/textCurveControls';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Move,
  Plus,
  BringToFront,
  SendToBack,
  Minus,
  Copy,
  Square,
  Lock,
  Unlock,
  RotateCw,
  RotateCcw,
  Scan,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Italic,
  List,
  ListOrdered,
  Check,
  GripVertical,
  Brush,
  Link2,
  Unlink2,
  Eye,
  EyeOff,
  PenTool,
  ImagePlus,
  Waves,
} from 'lucide-react';
import {
  snapDragInZone,
  getRenderedTextBoxInZone,
  measureHalfExtentsInZone,
  GUIDE_COLOR,
  type SnapBox,
  type SnapDragOptions,
} from '../../lib/designSnapGuides';
import {
  getListReorderRowOffsetY,
  listDragTargetIndexFromDelta,
  reorderDesignElements,
} from '../../lib/designLayerOrder';
import { StudioColorField } from './StudioColorField';
import { STUDIO_TEXT_MAIN_COLORS, STUDIO_TEXT_POPULAR_COLORS } from '../../data/studioColorPresets';
import {
  completeTextListInputMarker,
  continueTextListInput,
  formatTextListInput,
  parseTextListInput,
  type TextListKind,
} from '../../lib/textListEditing';
import { InlineElementToolbar } from './InlineElementToolbar';
import { FlipControls } from './printsStudio/FlipControls';
import { artworkFlipStyle } from '../../lib/artworkFlip';
import { canMergeLayer, mergeLayersIssue, flattenDesignLayers, replaceMergedLayers } from '../../lib/mergeDesignLayers';
import { PATTERN_CATALOG } from '../../lib/patternCatalog';
import { changePatternType, initialPatternSettings, patternAppearance, type PatternPatch, type CustomPatternSource } from '../../lib/patternEditing';
import { canGroupLayer, groupLayersIssue, groupDesignLayers, ungroupLayersIssue, ungroupDesignLayer, toggleLayerSelection } from '../../lib/designGroups';
import { DesignGroupArtwork } from './printsStudio/DesignGroupArtwork';
import { normalizeCrop, buildArtworkClipPath, type CropInsets } from '../../lib/artworkCrop';
import { CropEditorControls, CropEditingOverlay as InteractiveCropOverlay } from './printsStudio/CropEditor';
import { PrintsStudioToolbar } from './printsStudio/PrintsStudioToolbar';
import { ASSET_LIBRARY_DRAG_MIME, useAssetWorkspaceContext } from './printsStudio/AssetWorkspace';
import { PrintsDrawLayer } from './printsStudio/PrintsDrawLayer';
import { DRAWING_LAYER_ID, DISTRESS_LAYER_ID, usePrintsStudio } from './printsStudio/PrintsStudioContext';
import {
  hydrateFontLibrary,
  loadUploadLibrary,
  saveFontToLibrary,
  saveUploadToLibrary,
  type SavedUpload,
} from './printsStudio/designLibrary';
import {
  STUDIO_DRAG_MIME,
  canFillShape,
  decodeStudioDrag,
  defaultPatternCount,
  defaultStudioSize,
  type StudioAssetKind,
} from './printsStudio/studioAssets';
import { StudioGraphic } from './printsStudio/StudioGraphic';
import { DesignAssetSurface } from './printsStudio/DesignAssetSurface';
import { artworkAtPoint } from '../../lib/artworkHitTesting';
import { drawingMaskCss, useGarmentDrawingMask } from './printsStudio/useGarmentDrawingMask';
import { targetContains, useGarmentPatternTargets } from './printsStudio/useGarmentPatternTargets';
import type { Quad } from '../../lib/designGeometry';
import { parsePaint, paintCss, paintDataUrl, solidPaint } from '../../lib/studioPaint';
import { DEFAULT_IMAGE_ADJUSTMENTS, IMAGE_ADJUSTMENTS, imageAdjustmentFilter, snapImageRotation, type ImageAdjustmentValues } from '../../lib/imageAdjustments';
import { ImageAdjustmentDefs } from './printsStudio/ImageAdjustmentDefs';
import type { ImageFilterSettings } from '../../lib/imageFilters';
import type { TextEffect } from '../../lib/textEffects';
import { TextEffectsPanel } from './printsStudio/TextEffectsPanel';
import { ShapeEffectsPanel } from './printsStudio/ShapeEffectsPanel';
import { ShapePropertiesPanel } from './printsStudio/ShapePropertiesPanel';
import { ShapePathEditor, ShapePolygonDraft } from './printsStudio/ShapePathEditor';
import { shapeToEditablePath, type ShapePath } from '../../lib/shapeGeometry';
import { FilteredImage } from './printsStudio/FilteredImage';
import { CustomAreaGraphic } from './printsStudio/CustomAreaGraphic';
import { TextArtwork } from './printsStudio/TextArtwork';
import { createWarpSettings, resizeWarpGrid, warpGrid, type WarpPreset, type WarpSettings } from '../../lib/warpGeometry';
import { customAreaBounds, customAreaGeometryPatch, customAreaPath, customAreaTransformedPath, customAreaViewport, nearestCustomAreaSegment, splitCustomAreaSegment, type CustomAreaPoint } from '../../lib/customAreaGeometry';
import { shapePointMapping } from '../../lib/shapePathEditing';
import { CustomAreaPathEditor } from './printsStudio/CustomAreaPathEditor';
import { CustomAreaPathControls } from './printsStudio/CustomAreaPathControls';
import { CustomAreaAppearanceControls } from './printsStudio/CustomAreaAppearanceControls';

export interface DesignElement extends ImageAdjustmentValues {
  id: string;
  layerName?: string;
  imageFilter?: ImageFilterSettings;
  textEffects?: TextEffect[];
  type: 'image' | 'text' | 'drawing' | 'shape' | 'pattern' | 'distress' | 'customArea' | 'group';
  children?: DesignElement[];
  groupSourceWidth?: number;
  groupSourceHeight?: number;
  /** Retains the original coordinate system after ungrouping transformed artwork. */
  groupTransformEnvelope?: boolean;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shapeGeometry?: 'bounds';
  shapeFilled?: boolean;
  shapeParameters?: Record<string, number | string>;
  shapePath?: ShapePath;
  shapeFillColor?: string;
  shapeStrokeColor?: string;
  shapeEffects?: TextEffect[];
  perspective?: Quad;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  /** Text blocks only */
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  /** Letter spacing in px */
  letterSpacing?: number;
  /** Text line height in percent of font size. */
  lineSpacing?: number;
  textFillMode?: 'filled' | 'outline' | 'fill-outline';
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  textLinePosition?: 'top' | 'middle' | 'bottom' | 'none';
  textLineColor?: string;
  textLineThickness?: number;
  textLineOffset?: number;
  textCurveAmount?: number;
  textCurveShape?: 'arc' | 'circle';
  textCurveDirection?: 'up' | 'down';
  textCurveRadius?: number;
  textCurveSpacing?: number;
  textCurveSide?: 'inside' | 'outside';
  textCurveOriginalBox?: {
    width: number;
    height: number;
    autoWidth?: boolean;
    autoHeight?: boolean;
    aspectLocked?: boolean;
    textCurveRadius?: number;
  };
  verticalText?: boolean;
  textList?: 'none' | 'bulleted' | 'numbered';
  textListLineStyles?: TextListKind[];
  textListIndent?: number;
  /** Outline width in px (0 = none) */
  borderWidth?: number;
  borderColor?: string;
  /** 0–100 */
  opacity?: number;
  /** Mirror artwork contents without moving garment or Custom Area clipping boundaries. */
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  /** Drop shadow blur (0 = none); follows glyph / image alpha */
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowEdge?: 'sharp' | 'round';
  textShadowEnabled?: boolean;
  /** When true, print cannot be dragged on the preview */
  locked?: boolean;
  hidden?: boolean;
  /** Print process for this layer (DTG, DTF, etc.) */
  printMethod?: string;
  /** Image only — rounds the rendered artwork corners (px). */
  cornerRadius?: number;
  /** Image only — crop insets as a percentage (0–100) of the raw artwork. */
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
  /** Text only — when true (default), the wrapper hugs the rendered glyphs so
   *  there's no empty space below short text. The moment the user resizes the
   *  box (handles or numeric adjusters) this flips to false and `height` is
   *  honoured literally, so people can intentionally add padding around the text. */
  autoHeight?: boolean;
  /** Text only — mirror of autoHeight for the horizontal axis. When true (default)
   *  the wrapper sizes to the text content (capped at `width` for wrap). When the
   *  user changes width via handles or adjusters we lock to `element.width` literally
   *  so a 300px wide box renders as 300px even when the text only spans 40px. */
  autoWidth?: boolean;
  /** Image / drawing — CSS brightness (100 = unchanged). */
  filterBrightness?: number;
  /** Image / drawing — CSS contrast (100 = unchanged). */
  filterContrast?: number;
  /** Image / drawing — CSS saturation (100 = unchanged). */
  filterSaturate?: number;
  filterBlur?: number;
  /** Pattern tile count / grid density (e.g. 4 = 4×4 checks). */
  patternCount?: number;
  patternScale?: number;
  patternSpacing?: number;
  patternRotation?: number;
  patternThickness?: number;
  patternRandomise?: boolean;
  patternSeed?: number;
  patternSpacingX?: number;
  patternSpacingY?: number;
  patternColors?: string[];
  patternRoughness?: number;
  patternVariation?: number;
  patternSource?: string;
  patternSourceName?: string;
  patternSourceWidth?: number;
  patternSourceHeight?: number;
  patternRepeat?: 'grid' | 'brick' | 'half-drop' | 'mirror' | 'random';
  patternRandomPosition?: number;
  patternRandomRotation?: number;
  patternMinScale?: number;
  patternMaxScale?: number;
  patternTarget?: string;
  customAreaPoints?: CustomAreaPoint[];
  customAreaViewWidth?: number;
  customAreaViewHeight?: number;
  customAreaOutline?: { enabled: boolean; color: string; width: number; opacity: number; style: 'solid' | 'dashed' | 'dotted' };
  customAreaTexture?: string;
  customAreaFillTransform?: { scale: number; rotation: number; x: number; y: number; opacity: number };
  customAreaOpen?: boolean;
  customAreaName?: string;
  customAreaPattern?: string;
  customAreaImage?: string;
  warp?: WarpSettings;
  /** When true, width and height stay proportional while resizing. Images default on. */
  aspectLocked?: boolean;
  /** Front or back of the garment. Missing values are treated as front. */
  side?: 'front' | 'back';
}

export function designElementSide(el: Pick<DesignElement, 'side'>): 'front' | 'back' {
  return el.side ?? 'front';
}

interface PrintsDesignStepProps {
  elements: DesignElement[];
  /** Merge supplies selection atomically so Undo never restores a deleted selection. */
  onChange: (elements: DesignElement[], selectedLayerId?: string) => void;
  /** When set with `onSelectedLayerIdChange`, selection is controlled (sync with live preview). */
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
  /** Narrow / phone: horizontal scroll rows for key actions (Canva-style). */
  usePhoneStrips?: boolean;
  /** Live garment side so new artwork and the layers list stay on Front or Back. */
  garmentSide?: 'front' | 'back';
}

export type PrintsCanvasSize = { width: number; height: number };

interface PrintsDesignPreviewProps {
  assetMode?: boolean;
  canvasSize?: PrintsCanvasSize;
  onCanvasSizeChange?: (size: PrintsCanvasSize) => void;
  garmentInteractive?: boolean;
  garmentPreview: ReactNode | ((sceneScale: number) => ReactNode);
  elements: DesignElement[];
  onChange?: (elements: DesignElement[], selectedLayerId?: string) => void;
  editable?: boolean;
  className?: string;
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
  /** Parent scale (e.g. live preview `previewZoom/100`); inverses for toolbar and handles. */
  liveCanvasScale?: number;
  /** Phone: when the config sheet is collapsed, pin the *text* formatting bar above the soft keyboard. */
  phoneConfigSheetCollapsed?: boolean;
  /** Which garment face is on screen. Artwork on the other face is hidden. */
  garmentSide?: 'front' | 'back';
}

const FONT_OPTIONS = [
  'Inter',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Impact',
  'Montserrat',
  'Poppins',
];

export const PRINT_METHODS = [
  'DTG',
  'DTF',
  'Screen Print',
  'Embroidery',
  'Puff Print',
  'Heat Transfer',
] as const;

export const DEFAULT_PRINT_METHOD = PRINT_METHODS[0];

const WARP_PRESETS: { id: WarpPreset; label: string }[] = [
  { id: 'arc', label: 'Arc' }, { id: 'arc-lower', label: 'Arc Lower' },
  { id: 'arc-upper', label: 'Arc Upper' }, { id: 'arch', label: 'Arch' },
  { id: 'bulge', label: 'Bulge' }, { id: 'squeeze', label: 'Squeeze' },
  { id: 'wave', label: 'Wave' }, { id: 'flag', label: 'Flag' },
  { id: 'fish', label: 'Fish' }, { id: 'rise', label: 'Rise' },
];

/** Longer labels for consistent terminology in the UI (abbrev + plain English). */
export const PRINT_METHOD_DESCRIPTIONS: Record<(typeof PRINT_METHODS)[number], string> = {
  DTG: 'Direct-to-garment (DTG)',
  DTF: 'Direct-to-film (DTF)',
  'Screen Print': 'Screen print (ink through mesh)',
  Embroidery: 'Embroidery (stitched thread)',
  'Puff Print': 'Puff print (raised specialty ink)',
  'Heat Transfer': 'Heat transfer (vinyl / film)',
};

/** Print-area inset on the shirt overlay (%). */
const PREVIEW_ZONE = {
  left: 5,
  top: 6,
  right: 5,
  bottom: 7,
};

/**
 * True shape-following outline + drop shadow for images using SVG filter primitives.
 *
 * `feMorphology operator="dilate"` grows the non-transparent silhouette by `radius` px
 * and we colour it with a flood + composite. This gives a smooth, pixel-precise outline
 * that hugs the artwork (rounded corners, transparent PNGs, etc.) with no visible stepping
 * — unlike a stack of CSS `drop-shadow`s which produces a staggered, blocky result.
 */
export function hasImageFx(el: {
  type?: DesignElement['type'];
  borderWidth?: number;
  shadowBlur?: number;
  textShadowEnabled?: boolean;
}): boolean {
  if (el.type !== 'image' && el.type !== 'drawing' && el.type !== 'text') return false;
  if (el.type === 'text') return el.textShadowEnabled ?? (el.shadowBlur ?? 0) > 0;
  return (el.borderWidth ?? 0) > 0 || (el.shadowBlur ?? 0) > 0;
}

/** CSS `filter` value pointing at the per-element SVG `<filter>` — or undefined when unused. */
export function getImageFilterStyle(el: {
  id: string;
  type?: 'image' | 'text' | 'drawing';
  borderWidth?: number;
  shadowBlur?: number;
  textShadowEnabled?: boolean;
}): string | undefined {
  return hasImageFx(el) ? `url(#fx-${el.id})` : undefined;
}

export function getArtworkAdjustFilter(el: ImageAdjustmentValues & { id?: string }): string | undefined {
  return imageAdjustmentFilter(el);
}

export function composeArtworkFilter(
  el: Parameters<typeof getImageFilterStyle>[0] & Parameters<typeof getArtworkAdjustFilter>[0],
): string | undefined {
  const parts = [getArtworkAdjustFilter(el), getImageFilterStyle(el)].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

/** Renders the per-element `<svg>` `<defs>` block. Place inside the same DOM subtree as the img. */
export function ImageFxDefs({
  element,
}: {
  element: {
    id: string;
    type?: 'image' | 'text' | 'drawing';
    borderWidth?: number;
    borderColor?: string;
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowOpacity?: number;
    shadowEdge?: 'sharp' | 'round';
    textShadowEnabled?: boolean;
  };
}) {
  if (!hasImageFx(element)) return null;
  const bw = element.type === 'text' ? 0 : Math.max(0, element.borderWidth ?? 0);
  const bc = element.borderColor ?? '#FFFFFF';
  const sb = Math.max(0, element.shadowBlur ?? 0);
  const hasShadow = sb > 0 || (element.type === 'text' && element.textShadowEnabled === true);
  const sc = element.shadowColor ?? '#000000';
  const sx = element.type === 'text'
    ? Math.max(-8, Math.min(8, element.shadowOffsetX ?? 0))
    : element.shadowOffsetX ?? 0;
  const so = element.type === 'text'
    ? Math.max(-8, Math.min(8, element.shadowOffsetY ?? 2))
    : element.shadowOffsetY ?? 6;
  const shadowOpacity = Math.max(0, Math.min(100, element.shadowOpacity ?? 100)) / 100;
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id={`fx-${element.id}`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
          colorInterpolationFilters="sRGB"
        >
          {bw > 0 ? (
            <>
              <feMorphology
                in="SourceAlpha"
                operator="dilate"
                radius={bw}
                result="outlineMask"
              />
              {parsePaint(bc) ? <feImage href={paintDataUrl(bc)} x="-50%" y="-50%" width="200%" height="200%" preserveAspectRatio="none" result="outlineFill" /> : <feFlood floodColor={bc} result="outlineFill" />}
              <feComposite
                in="outlineFill"
                in2="outlineMask"
                operator="in"
                result="outlineShape"
              />
            </>
          ) : null}
          {hasShadow ? (
            <>
              {element.shadowEdge === 'round' ? (
                <feMorphology
                  in="SourceAlpha"
                  operator="dilate"
                  radius={Math.max(0.5, sb * 0.08)}
                  result="shadowSource"
                />
              ) : null}
              <feGaussianBlur
                in={element.shadowEdge === 'round' ? 'shadowSource' : 'SourceAlpha'}
                stdDeviation={sb / 2}
                result="shadowBlur"
              />
              <feOffset in="shadowBlur" dx={sx} dy={so} result="shadowOffset" />
              {parsePaint(sc) ? <feImage href={paintDataUrl(sc)} x="-50%" y="-50%" width="200%" height="200%" preserveAspectRatio="none" result="shadowFill" /> : <feFlood floodColor={sc} result="shadowFill" />}
              <feComponentTransfer in="shadowFill" result="shadowFillOpacity">
                <feFuncA type="linear" slope={shadowOpacity} />
              </feComponentTransfer>
              <feComposite
                in="shadowFillOpacity"
                in2="shadowOffset"
                operator="in"
                result="shadowShape"
              />
            </>
          ) : null}
          <feMerge>
            {hasShadow ? <feMergeNode in="shadowShape" /> : null}
            {bw > 0 ? <feMergeNode in="outlineShape" /> : null}
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Canva-style crop-editing HUD: renders on top of the artwork while the user has the Crop
 * panel open. The image beneath is shown uncropped so the user can see what's being removed;
 * here we paint a dim veil over the regions that will be clipped out and highlight the "keep"
 * rectangle with a dashed outline + corner brackets.
 */
export function CropEditingOverlay({
  element,
}: {
  element: {
    cropTop?: number;
    cropRight?: number;
    cropBottom?: number;
    cropLeft?: number;
  };
}) {
  return <InteractiveCropOverlay element={element} />;
}

/**
 * Shared non-destructive crop insets with pixel-based corner rounding.
 *
 * Pass `ignoreCrop: true` to get only the rounded-corner part (useful while actively editing a
 * crop so the user can see the full artwork).
 */
export function buildImageClipPath(
  el: {
    cornerRadius?: number;
    cropTop?: number;
    cropRight?: number;
    cropBottom?: number;
    cropLeft?: number;
  },
  opts?: { ignoreCrop?: boolean },
): string | undefined {
  return buildArtworkClipPath(el, opts);
}

/** Align snap “middle” guides with the visible shirt centre (mockup perspective). */
const PREVIEW_SNAP_CENTER_NUDGE: SnapDragOptions = {
  centerNudgeFractionX: -0.008,
  centerNudgeFractionY: 0.014,
};

/** Map pointer position to design coordinates inside the print zone (handles CSS transforms). */
function clientToZonePoint(zone: HTMLElement, clientX: number, clientY: number) {
  const zr = zone.getBoundingClientRect();
  const zw = zone.offsetWidth;
  const zh = zone.offsetHeight;
  if (zr.width < 1 || zr.height < 1 || zw < 1 || zh < 1) {
    return { x: clientX - zr.left, y: clientY - zr.top };
  }
  return {
    x: ((clientX - zr.left) / zr.width) * zw,
    y: ((clientY - zr.top) / zr.height) * zh,
  };
}

function zonePointToClient(zone: HTMLElement, x: number, y: number) {
  const zr = zone.getBoundingClientRect();
  const zw = zone.offsetWidth;
  const zh = zone.offsetHeight;
  if (zr.width < 1 || zr.height < 1 || zw < 1 || zh < 1) {
    return { x: zr.left + x, y: zr.top + y };
  }
  return {
    x: zr.left + (x / zw) * zr.width,
    y: zr.top + (y / zh) * zr.height,
  };
}

function zoneScaleFactor(zone: HTMLElement): number {
  const zr = zone.getBoundingClientRect();
  const zw = zone.offsetWidth;
  if (zw <= 0) return 1;
  return zr.width / zw;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w';

const HANDLE_RED = '#CC2D24';

export type PrintManip =
  | {
      kind: 'rotate';
      id: string;
      startRot: number;
      cx: number;
      cy: number;
      startAngle: number;
    }
  | {
      kind: 'resize';
      id: string;
      handle: ResizeHandle;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
      startFontSize: number;
      isImage: boolean;
      aspectLocked: boolean;
    };

export function PrintTransformOverlay({
  onRotatePointerDown,
  onResizePointerDown,
  /** Counter parent scale (e.g. live preview zoom) so handles stay a usable on-screen size. */
  uiInverseScale = 1,
  /** Larger resize/rotate affordances (tablet / coarse UI). Ignored when `compactHandles` is true. */
  comfortableTouch = false,
  /** Smaller handles + frame on phone so short text boxes are not covered (default on narrow in callers). */
  compactHandles = false,
  /** Phone + text: only corner scale + right-edge width (no rotate, other edges, or extra corners). */
  phoneTextMinimal = false,
  tight = false,
}: {
  onRotatePointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent, h: ResizeHandle) => void;
  uiInverseScale?: number;
  comfortableTouch?: boolean;
  compactHandles?: boolean;
  phoneTextMinimal?: boolean;
  tight?: boolean;
}) {
  const inv = !tight && uiInverseScale > 0 && Math.abs(uiInverseScale - 1) > 0.001 ? uiInverseScale : 1;
  const invStyle =
    inv === 1
      ? undefined
      : ({ transform: `scale(${inv})`, transformOrigin: '50% 50%' } as const);

  if (phoneTextMinimal) {
    return (
      <div
        data-handles
        className="pointer-events-none absolute inset-0 z-50"
        style={invStyle}
      >
        <div
          className="pointer-events-none absolute rounded-md border-2 bg-gradient-to-b from-[#CC2D24]/10 to-transparent"
          style={{ borderColor: `${HANDLE_RED}cc`, inset: tight ? 0 : '-1px', borderRadius: tight ? 0 : undefined }}
        />
        <button
          type="button"
          aria-label="Scale from corner"
          className="pointer-events-auto absolute -left-1.5 -top-1.5 z-[60] h-3 w-3 touch-none rounded-full before:absolute before:inset-0.5 before:rounded-full before:border before:border-zinc-300/95 before:bg-white before:shadow-sm active:scale-95"
          onPointerDown={(e) => onResizePointerDown(e, 'nw')}
        />
        <button
          type="button"
          aria-label="Stretch width"
          className="pointer-events-auto absolute -right-1 top-1/2 z-[60] h-7 w-2 -translate-y-1/2 touch-none rounded-full border-2 border-zinc-300/95 bg-white shadow-sm active:scale-95"
          onPointerDown={(e) => onResizePointerDown(e, 'e')}
        />
      </div>
    );
  }

  const large = comfortableTouch && !compactHandles;
  const dot = cn(
    /** `pointer-events-auto`: parent `data-handles` uses `pointer-events-none` so handles stay above the inline toolbar without stealing clicks from the pill. */
    'pointer-events-auto absolute z-[60] flex touch-none items-center justify-center rounded-full before:absolute before:rounded-full before:border before:border-[#CC2D24] before:bg-[#09090B] active:scale-95',
    compactHandles ? 'h-2.5 w-2.5 before:inset-0.5' : large ? 'h-5 w-5 before:inset-1' : 'h-3.5 w-3.5 before:inset-[3px]',
  );
  /** Single red ring (border only) — avoid border + box-shadow or duplicate rings on mobile. */
  const dotStyle = compactHandles ? undefined : { borderColor: HANDLE_RED };
  const off = compactHandles
    ? { box: 'inset-[-4px]', rot: '-bottom-7 h-6 w-6', rotIcon: 'h-3 w-3' as const }
    : large
      ? { box: 'inset-[-9px]', rot: '-bottom-12 h-11 w-11', rotIcon: 'h-5 w-5' as const }
      : { box: 'inset-[-7px]', rot: '-bottom-11 h-9 w-9', rotIcon: 'h-4 w-4' as const };
  return (
    <div
      data-handles
      className="pointer-events-none absolute inset-0 z-50"
      style={invStyle}
    >
      <div
        className={cn(
          'pointer-events-none absolute rounded-2xl border bg-gradient-to-b from-[#CC2D24]/12 to-transparent',
          off.box,
        )}
        style={{ borderColor: `${HANDLE_RED}aa`, inset: tight ? 0 : undefined, borderRadius: tight ? 0 : undefined }}
      />
      <button
        type="button"
        aria-label="Resize NW — scale"
        className={cn(
          dot,
          compactHandles ? '-left-1.5 -top-1.5' : large ? '-left-2.5 -top-2.5' : '-left-2 -top-2',
          'cursor-nwse-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'nw')}
      />
      <button
        type="button"
        aria-label="Resize NE — scale"
        className={cn(
          dot,
          compactHandles ? '-right-1.5 -top-1.5' : large ? '-right-2.5 -top-2.5' : '-right-2 -top-2',
          'cursor-nesw-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'ne')}
      />
      <button
        type="button"
        aria-label="Resize SW — scale"
        className={cn(
          dot,
          compactHandles ? '-bottom-1.5 -left-1.5' : large ? '-bottom-2.5 -left-2.5' : '-bottom-2 -left-2',
          'cursor-nesw-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'sw')}
      />
      <button
        type="button"
        aria-label="Resize SE — scale"
        className={cn(
          dot,
          compactHandles ? '-bottom-1.5 -right-1.5' : large ? '-bottom-2.5 -right-2.5' : '-bottom-2 -right-2',
          'cursor-nwse-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'se')}
      />
      <button
        type="button"
        aria-label="Stretch width — east"
        className={cn(
          dot,
          compactHandles
            ? '-right-1.5 top-1/2 -translate-y-1/2'
            : large
              ? '-right-2.5 top-1/2 -translate-y-1/2'
              : '-right-2 top-1/2 -translate-y-1/2',
          'cursor-ew-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'e')}
      />
      <button
        type="button"
        aria-label="Stretch width — west"
        className={cn(
          dot,
          compactHandles
            ? '-left-1.5 top-1/2 -translate-y-1/2'
            : large
              ? '-left-2.5 top-1/2 -translate-y-1/2'
              : '-left-2 top-1/2 -translate-y-1/2',
          'cursor-ew-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'w')}
      />
      <button
        type="button"
        aria-label="Stretch height — north"
        className={cn(
          dot,
          compactHandles
            ? '-top-1.5 left-1/2 -translate-x-1/2'
            : large
              ? '-top-2.5 left-1/2 -translate-x-1/2'
              : '-top-2 left-1/2 -translate-x-1/2',
          'cursor-ns-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'n')}
      />
      <button
        type="button"
        aria-label="Stretch height — south"
        className={cn(
          dot,
          compactHandles
            ? '-bottom-1.5 left-1/2 -translate-x-1/2'
            : large
              ? '-bottom-2.5 left-1/2 -translate-x-1/2'
              : '-bottom-2 left-1/2 -translate-x-1/2',
          'cursor-ns-resize',
        )}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 's')}
      />
      <button
        type="button"
        aria-label="Rotate"
        className={cn(
          'pointer-events-auto absolute left-1/2 z-[60] flex -translate-x-1/2 touch-none items-center justify-center rounded-full border-2 bg-[#09090B] text-[#CC2D24] shadow-lg active:scale-95',
          off.rot,
        )}
        style={{ borderColor: HANDLE_RED }}
        onPointerDown={onRotatePointerDown}
      >
        <RotateCw className={off.rotIcon} />
      </button>
    </div>
  );
}

export function PrintPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-white/[0.07] bg-black/30 p-3', className)}>
      <div className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/38">
        {title}
      </div>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  step = 1,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix: string;
  step?: number;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tabular-nums text-white/65">{value}{suffix}</span>
          {onReset && <button type="button" aria-label={`Reset ${label}`} title={`Reset ${label}`}
            onClick={onReset} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/55 hover:bg-white/10 hover:text-white">
            <RotateCcw className="h-3 w-3" />
          </button>}
        </div>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onDoubleClick={onReset}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[#FF3B30] disabled:opacity-40"
      />
    </div>
  );
}

export function SidebarNumberField({
  label,
  suffix,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
        {label}
      </span>
      <div
        className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[#252528] bg-black/40 px-2.5 transition-colors focus-within:border-[#CC2D24]/55 focus-within:bg-black/60"
        /* `min-w-0` on the label + this row + `shrink-0` on the unit keeps the
         *  suffix inside the field in a 2-col grid. Without it, `type="number"`
         *  (often end-aligned) + flex-1 can push `px` into the column gutter. */
      >
        <input
          type="number"
          value={draft}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (!Number.isFinite(n)) setDraft(String(value));
            else if (n !== value) onChange(n);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 flex-1 bg-transparent text-left text-[11px] font-semibold tabular-nums text-white outline-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-[9px] font-medium tabular-nums leading-none text-white/45">
          {suffix}
        </span>
      </div>
    </label>
  );
}

export function PrintsDesignStep({
  elements,
  onChange,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
  usePhoneStrips = false,
  garmentSide = 'front',
}: PrintsDesignStepProps) {
  const assetWorkspace = useAssetWorkspaceContext();
  const assetMode = Boolean(assetWorkspace?.project);
  const [fallbackSelectedId, setFallbackSelectedId] = useState<string | null>(null);
  const selectionControlled = onSelectedLayerIdChange !== undefined;
  const selectedId = selectionControlled ? (selectedLayerIdProp ?? null) : fallbackSelectedId;
  const setSelectedId = useCallback(
    (id: string | null) => {
      onSelectedLayerIdChange?.(id);
      if (!selectionControlled) setFallbackSelectedId(id);
    },
    [onSelectedLayerIdChange, selectionControlled],
  );
  const [textInput, setTextInput] = useState('');
  const [importedFontFamilies, setImportedFontFamilies] = useState<string[]>([]);
  const [previousUploads, setPreviousUploads] = useState<SavedUpload[]>(() =>
    typeof window === 'undefined' ? [] : loadUploadLibrary(),
  );
  const [listDraggingId, setListDraggingId] = useState<string | null>(null);
  const [listDragOverId, setListDragOverId] = useState<string | null>(null);
  const [listDragDeltaY, setListDragDeltaY] = useState<number>(0);
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const listRowRefs = useRef(new Map<string, HTMLDivElement | null>());
  const listReorderActiveRef = useRef(false);
  const listDragSourceIdRef = useRef<string | null>(null);
  const listDragOverIdRef = useRef<string | null>(null);
  const listDragStartYRef = useRef(0);
  const listDragRowHeightRef = useRef(0);
  /** Index in `elements` at drag start — target slot is derived from `deltaY / rowH`. */
  const listDragFromIndexRef = useRef(0);
  const selected = useMemo(
    () => elements.find((item) => item.id === selectedId) ?? null,
    [elements, selectedId],
  );
  const sideElements = useMemo(
    () => elements.filter((item) => designElementSide(item) === garmentSide && !item.customAreaOpen),
    [elements, garmentSide],
  );
  const studio = usePrintsStudio();
  const setSelectedIdRef = useRef(setSelectedId);
  setSelectedIdRef.current = setSelectedId;
  const studioPanelRef = useRef(studio.panel);
  useEffect(() => {
    if (selectedId?.startsWith('asset-')) studio.setTool('select');
  }, [selectedId, studio.setTool]);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const mergeIssue = mergeLayersIssue(elements, mergeIds);
  const groupIssue = groupLayersIssue(elements, mergeIds);
  const ungroupIssue = ungroupLayersIssue(selected);
  const groupSelectedLayers = () => {
    if (groupIssue || merging) return;
    const id = `group-${crypto.randomUUID()}`;
    studio.setTool('select');
    onChange(groupDesignLayers(elements, mergeIds, id), id);
    if (!selectionControlled) setSelectedId(id);
    setMergeIds([]); setMergeError(null);
  };
  const ungroupSelectedLayer = () => {
    if (ungroupIssue || !selected || merging) return;
    const next = ungroupDesignLayer(elements, selected.id, () => `group-${crypto.randomUUID()}`);
    const nextIds = next.filter(element => !elements.some(old => old.id === element.id)).map(element => element.id);
    studio.setTool('select');
    onChange(next, nextIds[0] ?? null);
    if (!selectionControlled) setSelectedId(nextIds[0] ?? null);
    setMergeIds(nextIds); setMergeError(null);
  };
  const activeSideRef = useRef(garmentSide);
  activeSideRef.current = garmentSide;
  useEffect(() => { setMergeIds([]); setMergeError(null); }, [garmentSide]);
  useEffect(() => {
    setMergeIds(previous => previous.filter(id => elements.some(element => element.id === id && (canGroupLayer(element) || canMergeLayer(element)))));
  }, [elements]);
  const mergeSelectedLayers = async () => {
    if (mergeIssue || merging) return;
    const renderer = studio.layerRenderer.current;
    if (!renderer) { setMergeError('The garment preview is not ready.'); return; }
    const snapshot = elements;
    const side = garmentSide;
    setMerging(true); setMergeError(null);
    studio.setTool('select'); studio.setCropEditingId(null);
    studio.setWarpEditingId(null); studio.setDistortEditingId(null);
    try {
      const artwork = await renderer(mergeIds);
      if (elementsRef.current !== snapshot || activeSideRef.current !== side) throw new Error('The design changed during merging. Select the layers and try again.');
      const id = `merged-${crypto.randomUUID()}`;
      onChangeRef.current(replaceMergedLayers(snapshot, mergeIds, artwork, id), id);
      if (!selectionControlled) setSelectedId(id);
      setMergeIds([]);
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'The layers could not be merged. Nothing was changed.');
    } finally { setMerging(false); }
  };

  useEffect(() => {
    void hydrateFontLibrary().then((names) => {
      if (names.length) setImportedFontFamilies((prev) => Array.from(new Set([...names, ...prev])));
    });
  }, []);

  useLayoutEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (elements.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && !elements.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [elements, selectedId, setSelectedId]);

  useEffect(() => {
    if (studioPanelRef.current === studio.panel) return;
    studioPanelRef.current = studio.panel;
    const current = elementsRef.current.find(element => element.id === selectedId);
    if (studio.panel === 'patterns' && (current?.type === 'pattern' || current?.customAreaPattern)) return;
    setSelectedIdRef.current(null);
  }, [studio.panel, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const el = elements.find((item) => item.id === selectedId);
    if (el && designElementSide(el) !== garmentSide) setSelectedId(null);
  }, [garmentSide, selectedId, elements, setSelectedId]);

  const allFontOptions = useMemo(
    () => [...importedFontFamilies, ...FONT_OPTIONS.filter((f) => !importedFontFamilies.includes(f))],
    [importedFontFamilies],
  );

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    onChange(elements.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)));
  };

  const startCustomArea = () => {
    setSelectedId(null);
    studio.setCustomAreaPointSelection(null);
  };

  const updateFontSize = (delta: number) => {
    if (!selected || selected.type !== 'text') return;
    const next = Math.max(12, Math.min(96, (selected.fontSize ?? 30) + delta));
    if (selected.textCurveShape === 'circle' && (selected.textCurveAmount ?? 0) > 0) {
      const radius = textCurveRadius(selected);
      const size = Math.ceil((radius + next) * 2);
      updateSelected({ fontSize: next, width: size, height: size });
      return;
    }
    updateSelected({
      fontSize: next,
      width: Math.max(110, Math.min(260, (selected.width || 170) + delta * 2)),
      height: Math.max(40, next + 18),
    });
  };

  const updateCurve = (patch: TextCurvePatch) => {
    if (!selected || selected.type !== 'text') return;
    updateSelected(updateTextCurve(selected, patch));
  };

  const handleUploadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
        const zone = document.querySelector('[data-print-design-zone]') as HTMLElement | null;
        let ix = 155;
        let iy = 165;
        if (zone && zone.clientWidth > 0 && zone.clientHeight > 0) {
          ix = zone.clientWidth / 2;
          iy = zone.clientHeight / 2;
        }
        const next: DesignElement = {
          id: `${Date.now()}`,
          type: 'image',
          content: event.target?.result as string,
          x: ix,
          y: iy,
          width: narrow ? 96 : 130,
          height: narrow ? 96 : 130,
          rotation: 0,
          borderWidth: 0,
          opacity: 100,
          flipHorizontal: false,
          shadowBlur: 0,
          shadowColor: 'rgba(0,0,0,0.55)',
          shadowOffsetY: 6,
          locked: false,
          aspectLocked: true,
          printMethod: DEFAULT_PRINT_METHOD,
          side: garmentSide,
        };
        setPreviousUploads(saveUploadToLibrary(file.name, next.content));
        onChange([...elements, next]);
        setSelectedId(next.id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleAddText = () => {
    if (!textInput.trim()) return;
    const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
    const zone = document.querySelector('[data-print-design-zone]') as HTMLElement | null;
    let cx = 155;
    let cy = 170;
    if (zone && zone.clientWidth > 0 && zone.clientHeight > 0) {
      cx = zone.clientWidth / 2;
      cy = zone.clientHeight / 2;
    }
    const listInput = parseTextListInput(textInput);
    const next: DesignElement = {
      id: `${Date.now()}`,
      type: 'text',
      content: listInput.content,
      textListLineStyles: listInput.lineStyles,
      x: cx,
      y: cy,
      width: narrow ? 132 : 170,
      height: narrow ? 44 : 60,
      autoHeight: true,
      autoWidth: true,
      rotation: 0,
      fontSize: narrow ? 22 : 30,
      fontFamily: 'Inter',
      color: '#FFFFFF',
      borderWidth: 0,
      borderColor: '#FFFFFF',
      opacity: 100,
      flipHorizontal: false,
      shadowBlur: 0,
      shadowColor: 'rgba(0,0,0,0.55)',
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowOpacity: 70,
      shadowEdge: 'round',
      textShadowEnabled: false,
      locked: false,
      textAlign: 'center',
      fontStyle: 'normal',
      textTransform: 'none',
      letterSpacing: 0,
      lineSpacing: 115,
      fontWeight: 'normal',
      textFillMode: 'filled',
      textUnderline: false,
      textStrikethrough: false,
      textLinePosition: 'none',
      textLineColor: '#FFFFFF',
      textLineThickness: 0.5,
      textLineOffset: 0,
      textCurveAmount: 0,
      textCurveShape: 'arc',
      textCurveDirection: 'up',
      textCurveRadius: 260,
      textCurveSpacing: 0,
      textCurveSide: 'outside',
      verticalText: false,
      textList: 'none',
      textListIndent: 18,
      printMethod: DEFAULT_PRINT_METHOD,
      side: garmentSide,
    };
    onChange([...elements, next]);
    setSelectedId(next.id);
    setTextInput('');
  };

  const capturePatternLayer = async (id: string): Promise<CustomPatternSource> => {
    const source = elements.find(element => element.id === id && canMergeLayer(element));
    const renderer = studio.layerRenderer.current;
    if (!source || !renderer) throw new Error('Select a visible compatible design layer.');
    const snapshot = elements;
    const side = garmentSide;
    studio.setTool('select'); studio.setCropEditingId(null); studio.setWarpEditingId(null); studio.setDistortEditingId(null);
    const artwork = await renderer([id]);
    if (elementsRef.current !== snapshot || activeSideRef.current !== side) throw new Error('The design changed while preparing the source. Choose the layer again.');
    return { src: artwork.content, name: source.type === 'text' ? source.content : `${source.type} layer`, width: artwork.width, height: artwork.height };
  };

  const placeStudioAsset = (kind: StudioAssetKind, id: string, settings?: PatternPatch) => {
    studio.setPathEditingId(null);
    if (kind === 'shape' && id === 'custom-polygon') {
      setSelectedId(null);
      studio.setCropEditingId(null); studio.setWarpEditingId(null); studio.setDistortEditingId(null);
      studio.setTool('shapePolygon');
      return;
    }
    const appearance = kind === 'pattern' ? { ...initialPatternSettings(id, studio.color), ...patternAppearance(settings) } : {};
    if (kind === 'pattern' && id === 'custom' && !appearance.patternSource) return;
    const zone = document.querySelector('[data-print-design-zone]') as HTMLElement | null;
    const size = defaultStudioSize(kind, id);
    const next: DesignElement = {
      id: `${Date.now()}`,
      type: kind,
      content: id,
      x: zone && zone.clientWidth ? zone.clientWidth / 2 : 155,
      y: zone && zone.clientHeight ? zone.clientHeight / 2 : 165,
      width: size.width,
      height: size.height,
      rotation: 0,
      color: studio.color,
      borderWidth: kind === 'shape' ? 4 : 0,
      opacity: 100,
      locked: false,
      printMethod: kind === 'distress' ? undefined : DEFAULT_PRINT_METHOD,
      patternCount: kind === 'pattern' ? defaultPatternCount(id) : undefined,
      aspectLocked: kind === 'shape' || kind === 'pattern' || kind === 'distress' ? false : undefined,
      side: garmentSide,
      ...appearance,
    };
    onChange([...elements, next]);
    setSelectedId(next.id);
    studio.setTool('select');
  };

  const reuseUpload = (item: SavedUpload) => {
    const zone = document.querySelector('[data-print-design-zone]') as HTMLElement | null;
    const next: DesignElement = {
      id: `${Date.now()}`,
      type: 'image',
      content: item.dataUrl,
      x: zone && zone.clientWidth ? zone.clientWidth / 2 : 155,
      y: zone && zone.clientHeight ? zone.clientHeight / 2 : 165,
      width: 130,
      height: 130,
      rotation: 0,
      opacity: 100,
      locked: false,
      aspectLocked: true,
      printMethod: DEFAULT_PRINT_METHOD,
      side: garmentSide,
    };
    onChange([...elements, next]);
    setSelectedId(next.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const remaining = elements.filter((item) => item.id !== selectedId);
    onChange(remaining);
    setSelectedId(null);
  };

  const removeElementById = (id: string) => {
    const remaining = elements.filter((item) => item.id !== id);
    const nextSelectedId = selectedId === id ? null : selectedId;
    onChange(remaining, nextSelectedId);
    setSelectedId(nextSelectedId);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const duplicateSource = (element: DesignElement): DesignElement => ({
      ...element, id: crypto.randomUUID(),
      ...(element.children ? { children: element.children.map(duplicateSource) } : {}),
    });
    const copy: DesignElement = {
      ...duplicateSource(selected),
      x: selected.x + 14,
      y: selected.y + 14,
      locked: false,
    };
    onChange([...elements, copy], copy.id);
    setSelectedId(copy.id);
  };

  const importFontFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.woff,.woff2,.ttf,.otf,font/woff,font/woff2';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const unique = await saveFontToLibrary(file);
      if (!unique) return;
      setImportedFontFamilies((prev) => (prev.includes(unique) ? prev : [...prev, unique]));
      if (selectedId && elements.find((x) => x.id === selectedId)?.type === 'text') {
        updateSelected({ fontFamily: unique });
      }
    };
    input.click();
  };

  const layer = (dir: 'front' | 'back') => {
    if (!selectedId) return;
    const arr = [...elements];
    const idx = arr.findIndex((item) => item.id === selectedId);
    if (idx < 0) return;
    const [item] = arr.splice(idx, 1);
    if (dir === 'front') arr.push(item);
    else arr.unshift(item);
    onChange(arr);
  };

  const onListGripPointerDown = (e: React.PointerEvent, elementId: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (listReorderActiveRef.current) return;
    listReorderActiveRef.current = true;
    listDragSourceIdRef.current = elementId;
    listDragOverIdRef.current = elementId;
    listDragStartYRef.current = e.clientY;

    const sourceNode = listRowRefs.current.get(elementId);
    const parent = sourceNode?.parentElement;
    let rowHeight = sourceNode?.getBoundingClientRect().height ?? 44;
    if (parent) {
      const gapStr = getComputedStyle(parent).rowGap || getComputedStyle(parent).gap;
      const gap = Number.parseFloat(gapStr) || 0;
      rowHeight += gap;
    }
    listDragRowHeightRef.current = rowHeight;
    const visible = elementsRef.current.filter((x) => designElementSide(x) === garmentSide);
    listDragFromIndexRef.current = visible.findIndex((x) => x.id === elementId);
    if (listDragFromIndexRef.current < 0) listDragFromIndexRef.current = 0;

    setListDraggingId(elementId);
    setListDragOverId(elementId);
    setListDragDeltaY(0);

    const onMove = (ev: PointerEvent) => {
      const d = ev.clientY - listDragStartYRef.current;
      setListDragDeltaY(d);
      const els = elementsRef.current.filter((x) => designElementSide(x) === garmentSide);
      const n = els.length;
      const s = listDragFromIndexRef.current;
      const h = listDragRowHeightRef.current;
      const ti = listDragTargetIndexFromDelta(s, d, h, n);
      const over = els[ti]!.id;
      if (over !== listDragOverIdRef.current) {
        listDragOverIdRef.current = over;
        setListDragOverId(over);
      }
    };

    const finish = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (!listReorderActiveRef.current) return;
      listReorderActiveRef.current = false;
      const fromId = listDragSourceIdRef.current;
      const toId = listDragOverIdRef.current;
      listDragSourceIdRef.current = null;
      listDragOverIdRef.current = null;
      setListDraggingId(null);
      setListDragOverId(null);
      setListDragDeltaY(0);
      if (!fromId || !toId || fromId === toId) return;
      const els = elementsRef.current;
      const from = els.findIndex((x) => x.id === fromId);
      const to = els.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return;
      const fn = onChangeRef.current;
      if (!fn) return;
      fn(reorderDesignElements(els, from, to));
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const rotNorm = selected
    ? ((Math.round(selected.rotation) % 360) + 360) % 360
    : 0;

  return (
    <div className="space-y-3.5">
      <PrintsStudioToolbar
        compact={usePhoneStrips}
        layout="workspace"
        onPlaceAsset={placeStudioAsset}
        onUpload={handleUploadImage}
        previousUploads={previousUploads}
        onReuseUpload={reuseUpload}
        textInput={textInput}
        onTextInput={setTextInput}
        onAddText={handleAddText}
        onImportFont={importFontFile}
        fontLibrary={importedFontFamilies}
        selectedElement={selected}
        onUpdateSelected={updateSelected}
        onStartCustomArea={startCustomArea}
        patternDocumentKey={`${assetWorkspace?.project?.id ?? 'garment'}:${garmentSide}`}
        patternLayers={sideElements.filter(element => canMergeLayer(element) && element.type !== 'pattern').map(element => ({ id: element.id, name: element.type === 'text' ? element.content.slice(0, 50) : `${element.type} — ${element.id.slice(-6)}` }))}
        onCapturePatternLayer={capturePatternLayer}
      />

      {selected ? (
        <PrintPanel title="Selected element">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/45">
              {selected.type === 'image'
                ? 'Image'
                : selected.type === 'drawing'
                  ? selected.id === DISTRESS_LAYER_ID
                    ? 'Distressing'
                    : 'Drawing'
                  : selected.type === 'shape'
                    ? 'Shape'
                    : selected.type === 'pattern'
                      ? 'Pattern'
                      : selected.type === 'customArea'
                        ? 'Custom Area'
                      : selected.type === 'distress'
                        ? 'Distressing'
                        : selected.type === 'group' ? 'Group' : 'Text'}
            </span>
            <Button
              onClick={deleteSelected}
              variant="outline"
              className="h-8 border-white/18 px-2.5 text-[10px] !text-white hover:bg-white/10"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>

          <div className="space-y-5">
            <label className="block space-y-2 text-[10px] font-medium uppercase tracking-wider text-white/50">
              Layer name
              <Input aria-label="Layer name" maxLength={120} value={selected.layerName ?? ''} placeholder={selected.type === 'text' ? selected.content : selected.type} onChange={event => updateSelected({ layerName: event.target.value || undefined })} />
            </label>
            {selected.type === 'shape' && <>
              <ShapePropertiesPanel element={selected} onChange={updateSelected} />
              <div className="space-y-2 rounded-xl border border-white/15 p-3">
                <Button type="button" disabled={selected.locked} aria-pressed={studio.pathEditingId === selected.id}
                  onClick={() => {
                    if (studio.pathEditingId === selected.id) { studio.setPathEditingId(null); return; }
                    if (!selected.shapePath) updateSelected({ shapePath: shapeToEditablePath(selected) });
                    studio.setTool('select'); studio.setCropEditingId(null); studio.setWarpEditingId(null); studio.setDistortEditingId(null);
                    studio.setPathEditingId(selected.id);
                  }} className="h-8 text-[10px]">
                  {studio.pathEditingId === selected.id ? 'Done Editing Path' : selected.shapePath ? 'Edit Path' : 'Convert to Editable Path'}
                </Button>
                <p className="text-[10px] text-white/50">Shift-click anchors to select several. Drag anchors or curve handles. Double-click a segment to add a point. Delete removes selected points. Escape exits.</p>
              </div>
              <ShapeEffectsPanel element={selected} onChange={updateSelected}
                images={[
                  ...elements.filter(item => item.type === 'image').map(item => ({ name: item.layerName ?? 'Uploaded image', src: item.content })),
                  ...previousUploads.map(item => ({ name: item.name, src: item.dataUrl })),
                  ...(assetWorkspace?.library ?? []).map(item => ({ name: item.name, src: item.preview })),
                ]} />
            </>}
            {canFillShape(selected) ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Solid fill</span>
                  <Button type="button" variant="outline" size="sm" aria-label="Solid fill"
                    aria-pressed={selected.shapeFilled ?? false} disabled={selected.locked}
                    onClick={() => updateSelected({ shapeFilled: !selected.shapeFilled })}
                    className="h-7 border-white/18 px-2 text-[9px] !text-white hover:bg-white/10">
                    {selected.shapeFilled ? 'On' : 'Off'}
                  </Button>
                </div>
                <p className="text-[10px] text-white/45">Fill the inside using the shape colour.</p>
              </div>
            ) : null}
            {selected.type === 'customArea' ? (
              <div className="space-y-3 rounded-xl border border-[#252528] bg-black/20 p-3">
                <Label className="block text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">
                  Custom Area Properties
                </Label>
                <Input aria-label="Custom Area name" value={selected.customAreaName ?? 'Custom Area'}
                  onChange={(event) => updateSelected({ customAreaName: event.target.value })}
                  className="h-9 border-white/12 bg-black/35 text-[11px] text-white" />
                <div>
                  <Label className="mb-2 block text-[9px] font-semibold uppercase tracking-wide text-white/45">Fill</Label>
                  <StudioColorField allowGradients value={selected.color ?? '#E53935'}
                    onChange={(color) => updateSelected({ color, customAreaPattern: undefined, customAreaImage: undefined, customAreaTexture: undefined })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS} popularColors={STUDIO_TEXT_POPULAR_COLORS}
                    mainLabel="Area fill" popularLabel="Quick colours" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-white/45" htmlFor="custom-area-pattern">Pattern fill</label>
                  <select id="custom-area-pattern" aria-label="Custom Area pattern"
                    value={selected.customAreaPattern ?? 'none'}
                    onChange={(event) => { updateSelected(event.target.value === 'none' ? { customAreaPattern: undefined } : changePatternType(selected, event.target.value)); if (event.target.value === 'custom') studio.setPanel('patterns'); }}
                    className="h-9 w-full rounded-lg border border-white/12 bg-black/35 px-2 text-[11px] text-white">
                    <option value="none">None</option>{PATTERN_CATALOG.map(pattern => <option key={pattern.id} value={pattern.id}>{pattern.label}</option>)}
                  </select>
                </div>
                <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/12 bg-black/25 text-[10px] font-semibold text-white/75 hover:text-white">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {selected.customAreaImage ? 'Replace image fill' : 'Add image fill'}
                  <input aria-label="Custom Area image fill" type="file" accept="image/*" className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => updateSelected({ customAreaImage: String(reader.result ?? ''), customAreaPattern: undefined, customAreaTexture: undefined });
                      reader.readAsDataURL(file);
                      event.target.value = '';
                    }} />
                </label>
                {selected.customAreaImage ? <button type="button" onClick={() => updateSelected({ customAreaImage: undefined })} className="text-[10px] text-white/50 hover:text-white">Remove image fill</button> : null}
                <CustomAreaPathControls element={selected} onChange={updateSelected} />
                <fieldset disabled={selected.locked}><CustomAreaAppearanceControls element={selected} onChange={updateSelected} /></fieldset>
                <SliderField label="Grain" value={selected.filterGrain ?? 0} min={0} max={100} suffix="%"
                  onChange={(value) => updateSelected({ filterGrain: value })} />
                <SliderField label="Texture" value={selected.filterNoise ?? 0} min={0} max={100} suffix="%"
                  onChange={(value) => updateSelected({ filterNoise: value })} />
              </div>
            ) : null}
            <div data-distortion-settings>
              <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                Transform
              </Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" title="Distort" aria-label="Distort"
                  aria-pressed={studio.distortEditingId === selected.id} disabled={selected.locked === true}
                  className={cn('h-8 border-white/18 px-2.5 text-[10px] !text-white hover:bg-white/10', studio.distortEditingId === selected.id && 'border-[#FF3B30] bg-[#FF3B30]/12')}
                  onClick={() => { studio.setTool('select'); studio.setWarpEditingId(null); studio.setDistortEditingId(studio.distortEditingId === selected.id ? null : selected.id); }}>
                  <Scan className="mr-1 h-3 w-3" />
                  Distort
                </Button>
                <Button type="button" variant="outline" title="Reset perspective" aria-label="Reset perspective"
                  disabled={selected.locked === true || !selected.perspective}
                  className="h-8 border-white/18 px-2.5 text-[10px] !text-white hover:bg-white/10"
                  onClick={() => { studio.setDistortEditingId(null); updateSelected({ perspective: undefined }); }}>
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Reset
                </Button>
                <Button type="button" variant="outline" title="Warp" aria-label="Warp"
                  aria-pressed={studio.warpEditingId === selected.id} disabled={selected.locked === true}
                  className={cn('h-8 border-white/18 px-2.5 text-[10px] !text-white hover:bg-white/10', studio.warpEditingId === selected.id && 'border-[#FF3B30] bg-[#FF3B30]/12')}
                  onClick={() => {
                    if (studio.warpEditingId === selected.id) studio.setWarpEditingId(null);
                    else {
                      studio.setDistortEditingId(null);
                      studio.setWarpEditingId(selected.id);
                      if (!selected.warp) updateSelected({ warp: createWarpSettings() });
                    }
                  }}>
                  <Waves className="mr-1 h-3 w-3" /> Warp
                </Button>
              </div>
            </div>
            {selected.warp && studio.warpEditingId === selected.id ? (() => {
              const settings = selected.warp!;
              const updateWarp = (patch: Partial<WarpSettings>) => updateSelected({ warp: { ...settings, ...patch } });
              return <div className="space-y-3 rounded-xl border border-[#252528] bg-black/20 p-3" data-warp-properties>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">Warp</Label>
                  <Button type="button" variant="outline" size="sm" aria-label="Reset Warp"
                    className="h-7 border-white/18 px-2 text-[9px] !text-white hover:bg-white/10"
                    onClick={() => { updateSelected({ warp: undefined }); studio.setWarpEditingId(null); }}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset Warp
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['preset', 'freeform'] as const).map((mode) => <button key={mode} type="button"
                    aria-pressed={settings.mode === mode}
                    onClick={() => updateWarp(mode === 'freeform'
                      ? { mode, points: settings.mode === 'preset' ? warpGrid(settings) : settings.points }
                      : { mode })}
                    className={cn('h-9 rounded-lg border text-[10px] font-semibold', settings.mode === mode ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white' : 'border-white/10 bg-black/25 text-white/65')}>
                    {mode === 'preset' ? 'Preset Warp' : 'Freeform'}
                  </button>)}
                </div>
                {settings.mode === 'preset' ? <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WARP_PRESETS.map((preset) => <button key={preset.id} type="button"
                      aria-pressed={settings.preset === preset.id} onClick={() => updateWarp({ preset: preset.id, bend: settings.bend === 0 ? 50 : settings.bend })}
                      className={cn('h-8 rounded-lg border px-2 text-[10px] font-medium', settings.preset === preset.id ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white' : 'border-white/10 bg-black/25 text-white/65')}>
                      {preset.label}
                    </button>)}
                  </div>
                  <SliderField label="Bend" value={settings.bend} min={-100} max={100} suffix="%" onChange={(bend) => updateWarp({ bend })} />
                  <SliderField label="Horizontal Distortion" value={settings.horizontalDistortion} min={-100} max={100} suffix="%" onChange={(horizontalDistortion) => updateWarp({ horizontalDistortion })} />
                  <SliderField label="Vertical Distortion" value={settings.verticalDistortion} min={-100} max={100} suffix="%" onChange={(verticalDistortion) => updateWarp({ verticalDistortion })} />
                </> : <>
                  <div className="space-y-1">
                    <label htmlFor="warp-grid-density" className="text-[9px] font-semibold uppercase tracking-wide text-white/45">Warp grid</label>
                    <select id="warp-grid-density" aria-label="Warp grid density" value={settings.gridSize}
                      onChange={(event) => {
                        const gridSize = Number(event.target.value) as 2 | 3 | 4;
                        updateWarp({ gridSize, points: resizeWarpGrid(settings, gridSize) });
                      }}
                      className="h-9 w-full rounded-lg border border-white/12 bg-black/35 px-2 text-[11px] text-white">
                      <option value={2}>2 × 2</option><option value={3}>3 × 3</option><option value={4}>4 × 4</option>
                    </select>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/48">Drag the mesh points on the design to reshape it.</p>
                </>}
              </div>;
            })() : null}
            {!assetMode && selected.type !== 'distress' ? (
            <div>
              <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                Printing method
              </Label>
              <p className="mb-2 text-[9px] leading-snug text-white/42">
                Each layer uses one process. DTG = direct-to-garment; DTF = direct-to-film — hover a button for full
                wording.
              </p>
              {usePhoneStrips ? (
                <div className="-mx-0.5 flex gap-2.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                  {PRINT_METHODS.map((method) => (
                    <button
                      key={method}
                      type="button"
                      title={PRINT_METHOD_DESCRIPTIONS[method]}
                      onClick={() => updateSelected({ printMethod: method })}
                      className={cn(
                        'shrink-0 snap-start rounded-full border px-3.5 py-2.5 text-[11px] font-semibold leading-tight transition',
                        (selected.printMethod ?? DEFAULT_PRINT_METHOD) === method
                          ? 'border-[#FF3B30] bg-[#FF3B30]/12 text-white'
                          : 'border-[#252528] bg-black/30 text-white/70 hover:border-white/20 hover:text-white',
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-2">
                {PRINT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    title={PRINT_METHOD_DESCRIPTIONS[method]}
                    onClick={() => updateSelected({ printMethod: method })}
                    className={cn(
                      'min-h-9 rounded-xl border px-2 py-2 text-left text-[10px] font-medium transition',
                      (selected.printMethod ?? DEFAULT_PRINT_METHOD) === method
                        ? 'border-[#FF3B30] bg-[#FF3B30]/12 text-white'
                        : 'border-[#252528] bg-black/25 text-white/68 hover:border-white/20 hover:text-white',
                    )}
                  >
                    <span className="block">{method}</span>
                    <span className="mt-0.5 block text-[8px] font-normal leading-tight text-white/38">
                      {PRINT_METHOD_DESCRIPTIONS[method]}
                    </span>
                  </button>
                ))}
              </div>
              )}
            </div>
            ) : null}

            {selected.type === 'text' && (
              <div className="flex flex-col gap-4">
                <div className="order-1">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Font
                  </Label>
                  {usePhoneStrips ? (
                    <div className="-mx-0.5 flex max-w-full gap-2.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                      {allFontOptions.map((font) => (
                        <button
                          key={font}
                          type="button"
                          onClick={() => updateSelected({ fontFamily: font })}
                          className={cn(
                            'flex min-h-11 min-w-0 shrink-0 snap-start items-center rounded-xl border px-3.5 py-2.5 text-[11px] transition',
                            selected.fontFamily === font
                              ? 'border-[#FF3B30] bg-[#FF3B30]/12 text-white'
                              : 'border-[#252528] bg-black/25 text-white/68 hover:border-white/20 hover:text-white',
                          )}
                          style={{ fontFamily: font }}
                        >
                          {font.startsWith('Custom ') ? font.split('-')[0]?.trim() ?? font : font}
                        </button>
                      ))}
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {allFontOptions.map((font) => (
                      <button
                        key={font}
                        type="button"
                        onClick={() => updateSelected({ fontFamily: font })}
                        className={cn(
                          'h-9 rounded-xl border px-2 text-[10px] transition',
                          selected.fontFamily === font
                            ? 'border-[#FF3B30] bg-[#FF3B30]/12 text-white'
                            : 'border-[#252528] bg-black/25 text-white/68 hover:border-white/20 hover:text-white',
                        )}
                        style={{ fontFamily: font }}
                      >
                        {font.startsWith('Custom ') ? font.split('-')[0]?.trim() ?? font : font}
                      </button>
                    ))}
                  </div>
                  )}
                </div>

                <div className="order-4">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Alignment
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['left', AlignLeft],
                        ['center', AlignCenter],
                        ['right', AlignRight],
                        ['justify', AlignJustify],
                      ] as const
                    ).map(([align, Icon]) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateSelected({ textAlign: align })}
                        className={cn(
                          'flex h-9 min-w-[2.5rem] flex-1 items-center justify-center rounded-xl border text-white/70 transition-colors',
                          (selected.textAlign ?? 'center') === align
                            ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                            : 'border-[#252528] bg-black/25 hover:border-white/20 hover:text-white',
                        )}
                        aria-label={`Align ${align}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="order-5 grid grid-cols-3 gap-1.5">
                  {([
                    ['Bold', selected.fontWeight === 'bold', { fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' }],
                    ['Underline', selected.textUnderline === true, { textUnderline: !selected.textUnderline }],
                    ['Strikethrough', selected.textStrikethrough === true, { textStrikethrough: !selected.textStrikethrough }],
                  ] as const).map(([label, active, patch]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateSelected(patch)}
                      className={cn(
                        'h-9 rounded-lg border px-1.5 text-[10px] font-semibold text-white/75',
                        active ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white' : 'border-[#252528] bg-black/25',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="order-9">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Fill style
                  </Label>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ['Filled', 'filled'],
                      ['Outline only', 'outline'],
                      ['Fill + outline', 'fill-outline'],
                    ] as const).map(([label, value]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={(selected.textFillMode ?? ((selected.borderWidth ?? 0) > 0 ? 'fill-outline' : 'filled')) === value}
                        onClick={() => updateSelected({
                          textFillMode: value,
                          ...(value === 'filled' ? {} : {
                            borderWidth: (selected.borderWidth ?? 0) || 0.25,
                            borderColor: selected.borderColor ?? '#FFFFFF',
                          }),
                        })}
                        className={cn(
                          'min-h-9 rounded-lg border px-1 text-[9px] font-medium text-white/70',
                          (selected.textFillMode ?? ((selected.borderWidth ?? 0) > 0 ? 'fill-outline' : 'filled')) === value
                            ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                            : 'border-[#252528] bg-black/25',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {(selected.textFillMode ?? ((selected.borderWidth ?? 0) > 0 ? 'fill-outline' : 'filled')) !== 'filled' ? (
                    <>
                      <div className="mt-3">
                        <SliderField
                          label="Outline thickness"
                          value={selected.borderWidth ?? 0.25}
                          min={0}
                          max={4}
                          suffix="px"
                          step={0.05}
                          onChange={value => updateSelected({ borderWidth: value })}
                        />
                      </div>
                      <div className="mt-3">
                        <span className="mb-2 block text-[9px] uppercase tracking-wider text-white/40">Outline colour</span>
                        <StudioColorField
                          value={selected.borderColor ?? selected.color ?? '#FFFFFF'}
                          onChange={value => updateSelected({ borderColor: value })}
                          mainColors={STUDIO_TEXT_MAIN_COLORS}
                          popularColors={STUDIO_TEXT_POPULAR_COLORS}
                          mainLabel="Outline colours"
                          popularLabel="Popular"
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="order-11 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    aria-label="Vertical text"
                    aria-pressed={selected.verticalText === true}
                    onClick={() => updateSelected({ verticalText: !selected.verticalText })}
                    className={cn(
                      'h-9 rounded-lg border text-[10px] font-medium',
                      selected.verticalText ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white' : 'border-[#252528] bg-black/25 text-white/70',
                    )}
                  >
                    Vertical
                  </button>
                  {(['bulleted', 'numbered'] as const).map((kind) => {
                    const Icon = kind === 'bulleted' ? List : ListOrdered;
                    const active = selected.textList === kind || selected.textListLineStyles?.includes(kind) === true;
                    const allActive = selected.textListLineStyles?.length
                      ? selected.textListLineStyles.every((lineKind) => lineKind === kind)
                      : selected.textList === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        aria-label={kind === 'bulleted' ? 'Bullet list' : 'Numbered list'}
                        aria-pressed={active}
                        onClick={() => updateSelected({
                          textList: allActive ? 'none' : kind,
                          textListLineStyles: undefined,
                        })}
                        className={cn(
                          'flex h-9 items-center justify-center rounded-lg border',
                          active ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white' : 'border-[#252528] bg-black/25 text-white/70',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
                {(selected.textList !== 'none' && selected.textList !== undefined) || selected.textListLineStyles?.some((kind) => kind !== 'none') ? (
                  <div className="order-12">
                    <SliderField
                      label="List indentation"
                      value={selected.textListIndent ?? 18}
                      min={0}
                      max={64}
                      suffix="px"
                      onChange={value => updateSelected({ textListIndent: value })}
                    />
                  </div>
                ) : null}

                <div className="order-last space-y-3 rounded-xl border border-[#252528] bg-black/20 p-3">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
                    <span>Curved text</span>
                    <span>{selected.textCurveAmount ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selected.textCurveAmount ?? 0}
                    aria-label="Curve amount"
                    onChange={event => updateCurve({ textCurveAmount: Number(event.target.value) })}
                    className="h-2 w-full cursor-pointer accent-[#FF3B30]"
                  />
                  <label className="flex flex-col gap-1 text-[9px] uppercase text-white/40">
                    Curve shape
                    <select
                      value={selected.textCurveShape ?? 'arc'}
                      onChange={event => updateCurve({
                        textCurveShape: event.target.value as 'arc' | 'circle',
                        ...(event.target.value === 'circle' ? { textCurveAmount: 100 } : {}),
                      })}
                      className="h-8 rounded-lg border border-[#252528] bg-[#111] px-2 text-[10px] normal-case text-white"
                    >
                      <option value="arc">Arc</option>
                      <option value="circle">Circle</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-white/40">
                      Direction
                      <select
                        value={selected.textCurveDirection ?? 'up'}
                        onChange={event => updateSelected({ textCurveDirection: event.target.value as 'up' | 'down' })}
                        className="h-8 rounded-lg border border-[#252528] bg-[#111] px-2 text-[10px] normal-case text-white"
                      >
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-white/40">
                      Curve side
                      <select
                        value={selected.textCurveSide ?? 'outside'}
                        onChange={event => updateSelected({ textCurveSide: event.target.value as 'inside' | 'outside' })}
                        className="h-8 rounded-lg border border-[#252528] bg-[#111] px-2 text-[10px] normal-case text-white"
                      >
                        <option value="outside">Outside</option>
                        <option value="inside">Inside</option>
                      </select>
                    </label>
                  </div>
                  <SliderField
                    label="Radius"
                    value={textCurveRadius(selected)}
                    min={selected.textCurveShape === 'circle' ? 32 : 80}
                    max={selected.textCurveShape === 'circle' ? 160 : 500}
                    suffix="px"
                    step={1}
                    onChange={value => updateCurve({ textCurveRadius: value })}
                  />
                  <SliderField
                    label="Curve spacing"
                    value={Math.max(-0.5, Math.min(8, selected.textCurveSpacing ?? 0))}
                    min={-0.5}
                    max={8}
                    suffix="px"
                    step={0.25}
                    onChange={value => updateSelected({ textCurveSpacing: value })}
                  />
                </div>

                <div className="order-5 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateSelected({
                        fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic',
                      })
                    }
                    className={cn(
                      'h-9 flex-1 border-white/18 bg-white/[0.04] px-2 text-[10px] !text-white hover:bg-white/10',
                      selected.fontStyle === 'italic' && 'border-[#FF3B30] bg-[#FF3B30]/12',
                    )}
                  >
                    <Italic className="mr-1 h-3.5 w-3.5" />
                    Italic
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const cur = selected.textTransform ?? 'none';
                      const next =
                        cur === 'none' ? 'uppercase' : cur === 'uppercase' ? 'lowercase' : 'none';
                      updateSelected({ textTransform: next });
                    }}
                    className="h-9 flex-1 border-white/18 bg-white/[0.04] px-2 text-[10px] !text-white hover:bg-white/10"
                  >
                    {(selected.textTransform ?? 'none') === 'uppercase'
                      ? 'AA'
                      : (selected.textTransform ?? 'none') === 'lowercase'
                        ? 'aa'
                        : 'Aa'}
                  </Button>
                </div>

                <div className="order-6">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label className="mb-0 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                      Letter spacing
                    </Label>
                    <span className="text-[10px] tabular-nums text-white/45">
                      {selected.letterSpacing ?? 0}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-2}
                    max={16}
                    step={0.5}
                    value={selected.letterSpacing ?? 0}
                    onChange={(e) => updateSelected({ letterSpacing: Number(e.target.value) })}
                    className="h-2 w-full cursor-pointer accent-[#FF3B30]"
                  />
                </div>

                <div className="order-7">
                  <SliderField
                    label="Line spacing"
                    value={selected.lineSpacing ?? 115}
                    min={80}
                    max={240}
                    suffix="%"
                    onChange={value => updateSelected({ lineSpacing: value })}
                  />
                </div>

                <div className="order-10 space-y-3 rounded-xl border border-[#252528] bg-black/20 p-3">
                  <div>
                    <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                      Line position
                    </Label>
                    <select
                      value={selected.textLinePosition ?? 'none'}
                      onChange={event => updateSelected({ textLinePosition: event.target.value as NonNullable<DesignElement['textLinePosition']> })}
                      className="h-9 w-full rounded-lg border border-[#252528] bg-[#111] px-2 text-[10px] text-white"
                    >
                      <option value="none">Off</option>
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                  <SliderField
                    label="Line thickness"
                    value={selected.textLineThickness ?? 0.5}
                    min={0.1}
                    max={4}
                    step={0.1}
                    suffix="px"
                    onChange={value => updateSelected({ textLineThickness: value })}
                  />
                  <SliderField
                    label="Line offset"
                    value={selected.textLineOffset ?? 0}
                    min={-20}
                    max={30}
                    suffix="px"
                    onChange={value => updateSelected({ textLineOffset: value })}
                  />
                  <StudioColorField
                    value={selected.textLineColor ?? selected.borderColor ?? '#FFFFFF'}
                    onChange={value => updateSelected({ textLineColor: value })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                    mainLabel="Line colours"
                    popularLabel="Popular"
                  />
                </div>

                <div className="order-2">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Font size
                  </Label>
                  <NumberStepper
                    value={selected.fontSize ?? 30}
                    onDecrease={() => updateFontSize(-1)}
                    onIncrease={() => updateFontSize(1)}
                  />
                </div>

                <div className="order-3">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Text colour
                  </Label>
                  <StudioColorField allowGradients
                    value={selected.color ?? '#FFFFFF'}
                    onChange={(h) => updateSelected({ color: h })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                  />
                </div>

                <div className="order-8 space-y-3 rounded-xl border border-[#252528] bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Text shadow</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={selected.textShadowEnabled === true}
                      onClick={() => updateSelected({
                        textShadowEnabled: !selected.textShadowEnabled,
                        shadowBlur: !selected.textShadowEnabled && (selected.shadowBlur ?? 0) === 0
                          ? 6
                          : selected.shadowBlur ?? 0,
                        shadowOpacity: selected.shadowOpacity ?? 70,
                        shadowColor: selected.shadowColor ?? '#000000',
                      })}
                      className="h-7 border-white/18 px-2 text-[9px] !text-white hover:bg-white/10"
                    >
                      {selected.textShadowEnabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <StudioColorField
                    value={selected.shadowColor ?? '#000000'}
                    onChange={value => updateSelected({ shadowColor: value })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                    mainLabel="Shadow colours"
                    popularLabel="Popular"
                  />
                  <SliderField
                    label="Opacity"
                    value={selected.shadowOpacity ?? 70}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={value => updateSelected({ shadowOpacity: value })}
                  />
                  <SliderField
                    label="Offset X"
                    value={Math.max(-8, Math.min(8, selected.shadowOffsetX ?? 0))}
                    min={-8}
                    max={8}
                    suffix="px"
                    step={0.25}
                    onChange={value => updateSelected({ shadowOffsetX: value })}
                  />
                  <SliderField
                    label="Offset Y"
                    value={Math.max(-8, Math.min(8, selected.shadowOffsetY ?? 2))}
                    min={-8}
                    max={8}
                    suffix="px"
                    step={0.25}
                    onChange={value => updateSelected({ shadowOffsetY: value })}
                  />
                  <SliderField
                    label="Softness / blur"
                    value={selected.shadowBlur ?? 0}
                    min={0}
                    max={40}
                    suffix="px"
                    onChange={value => updateSelected({ shadowBlur: value })}
                  />
                  <label className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-white/45">
                    Edge
                    <select
                      value={selected.shadowEdge ?? 'sharp'}
                      onChange={event => updateSelected({ shadowEdge: event.target.value as 'sharp' | 'round' })}
                      className="h-8 rounded-lg border border-[#252528] bg-[#111] px-2 text-[10px] normal-case text-white"
                    >
                      <option value="sharp">Sharp</option>
                      <option value="round">Round</option>
                    </select>
                  </label>
                </div>
                <div className="order-11">
                  <TextEffectsPanel element={selected} onChange={updateSelected}
                    images={elements.filter(item => item.type === 'image').map(item => ({ name: item.layerName ?? 'Uploaded image', src: item.content }))} />
                </div>
              </div>
            )}

            {!selected.patternTarget ? <div>
              <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                Rotation
              </Label>
              <div className="rounded-xl border border-[#252528] bg-black/20 px-3 py-3">
                <div className="mb-2 flex justify-between text-[10px] tabular-nums text-white/55">
                  <span>0°</span>
                  <span className="font-semibold text-white/80">{rotNorm}°</span>
                  <span>359°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={rotNorm}
                  onChange={(e) => updateSelected({ rotation: Number(e.target.value) })}
                  className="rotation-scroller h-3 w-full cursor-pointer"
                  aria-label="Rotation"
                />
              </div>
            </div> : null}

            <SliderField
              label="Opacity"
              value={selected.opacity ?? 100}
              min={15}
              max={100}
              suffix="%"
              onChange={(n) => updateSelected({ opacity: n })}
            />

            {selected.type === 'image' || selected.type === 'drawing' ? (
              <div className="space-y-3 border-y border-[#252528] py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Image adjustments</span>
                  <button type="button" onClick={() => updateSelected({ ...DEFAULT_IMAGE_ADJUSTMENTS })}
                    className="flex h-8 shrink-0 items-center gap-1 text-[10px] text-white/65 hover:text-white">
                    <RotateCcw className="h-3 w-3" /> Reset All
                  </button>
                </div>
                {IMAGE_ADJUSTMENTS.map(setting => <SliderField
                  key={setting.key} label={setting.label} value={selected[setting.key] ?? setting.default}
                  min={setting.min} max={setting.max} step={setting.step} suffix={setting.suffix}
                  onChange={value => updateSelected({ [setting.key]: value })}
                  onReset={() => updateSelected({ [setting.key]: setting.default })}
                />)}
              </div>
            ) : null}

            {selected.type !== 'text' && selected.type !== 'shape' && selected.type !== 'pattern' && selected.type !== 'distress' && selected.id !== DISTRESS_LAYER_ID ? (
            <div className="rounded-xl border border-[#252528] bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Border</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateSelected({
                    borderWidth: (selected.borderWidth ?? 0) > 0 ? 0 : 2,
                    borderColor: selected.borderColor ?? '#FFFFFF',
                  })}
                  className="h-7 border-white/18 px-2 text-[9px] !text-white hover:bg-white/10"
                >
                  <Square className="mr-1 h-3 w-3" />
                  {(selected.borderWidth ?? 0) > 0 ? 'Off' : 'On'}
                </Button>
              </div>
              <SliderField
                label="Thickness"
                value={selected.borderWidth ?? 0}
                min={0}
                max={8}
                suffix="px"
                onChange={(n) => updateSelected({ borderWidth: n })}
              />
              <div className="mt-3">
                <span className="mb-2 block text-[9px] uppercase tracking-wider text-white/40">Colour</span>
                <StudioColorField allowGradients
                  value={selected.borderColor ?? '#FFFFFF'}
                  onChange={(h) => updateSelected({ borderColor: h })}
                  mainColors={STUDIO_TEXT_MAIN_COLORS}
                  popularColors={STUDIO_TEXT_POPULAR_COLORS}
                />
              </div>
              {selected.type === 'image' ? (
                <div className="mt-3">
                  <SliderField
                    label="Corner rounding"
                    value={selected.cornerRadius ?? 0}
                    min={0}
                    max={50}
                    suffix="px"
                    onChange={(n) => updateSelected({ cornerRadius: n })}
                  />
                </div>
              ) : null}
            </div>
            ) : null}

            {!selected.patternTarget ? <div className="rounded-xl border border-[#252528] bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Size &amp; rotation
                </span>
                <button
                  type="button"
                  title={
                    (selected.aspectLocked ?? selected.type === 'image')
                      ? 'Width and height are linked'
                      : 'Width and height are independent'
                  }
                  onClick={() =>
                    updateSelected({
                      aspectLocked: !(selected.aspectLocked ?? selected.type === 'image'),
                    })
                  }
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[9px] font-semibold uppercase tracking-wide',
                    (selected.aspectLocked ?? selected.type === 'image')
                      ? 'border-[#FF3B30]/60 bg-[#FF3B30]/15 text-white'
                      : 'border-white/15 bg-black/30 text-white/70 hover:text-white',
                  )}
                >
                  {(selected.aspectLocked ?? selected.type === 'image') ? (
                    <Link2 className="h-3 w-3" />
                  ) : (
                    <Unlink2 className="h-3 w-3" />
                  )}
                  {(selected.aspectLocked ?? selected.type === 'image') ? 'Linked' : 'Unlinked'}
                </button>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <SidebarNumberField
                  label="Width"
                  suffix="px"
                  value={Math.round(selected.width || 0)}
                  onChange={(v) => {
                    const next = Math.max(8, Math.min(1200, v));
                    const linked = selected.aspectLocked ?? selected.type === 'image';
                    const ratio = selected.height ? selected.width / selected.height : 0;
                    const patch =
                      linked && ratio > 0
                        ? { width: next, height: Math.round(next / ratio) }
                        : { width: next };
                    updateSelected(
                      selected.type === 'text' ? { ...patch, autoWidth: false } : patch,
                    );
                  }}
                />
                <SidebarNumberField
                  label="Height"
                  suffix="px"
                  value={Math.round(selected.height || 0)}
                  onChange={(v) => {
                    const next = Math.max(8, Math.min(1200, v));
                    const linked = selected.aspectLocked ?? selected.type === 'image';
                    const ratio = selected.height ? selected.width / selected.height : 0;
                    const patch =
                      linked && ratio > 0
                        ? { height: next, width: Math.round(next * ratio) }
                        : { height: next };
                    updateSelected(
                      selected.type === 'text' ? { ...patch, autoHeight: false } : patch,
                    );
                  }}
                />
                <SidebarNumberField
                  label="Rotate"
                  suffix="°"
                  value={Math.round(selected.rotation ?? 0)}
                  onChange={(v) => updateSelected({ rotation: ((v % 360) + 360) % 360 })}
                />
                {selected.type === 'image' ? (
                  <SidebarNumberField
                    label="Scale"
                    suffix="%"
                    value={100}
                    onChange={(v) => {
                      const pct = Math.max(10, Math.min(400, v)) / 100;
                      updateSelected({
                        width: Math.round((selected.width || 0) * pct),
                        height: Math.round((selected.height || 0) * pct),
                      });
                    }}
                  />
                ) : null}
              </div>
            </div> : <p className="text-[10px] text-white/50">This fill follows its garment section. Use the Patterns controls to change the repeat without moving its boundary.</p>}

            {selected.type === 'image' ? (
              <div className="rounded-xl border border-[#252528] bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                    Drop shadow
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateSelected({
                        shadowBlur: (selected.shadowBlur ?? 0) > 0 ? 0 : 10,
                        shadowColor: selected.shadowColor ?? '#000000',
                        shadowOffsetY: selected.shadowOffsetY ?? 6,
                      })
                    }
                    className="h-7 border-white/18 px-2 text-[9px] !text-white hover:bg-white/10"
                  >
                    {(selected.shadowBlur ?? 0) > 0 ? 'Off' : 'On'}
                  </Button>
                </div>
                <SliderField
                  label="Shadow blur"
                  value={selected.shadowBlur ?? 0}
                  min={0}
                  max={40}
                  suffix="px"
                  onChange={(n) => updateSelected({ shadowBlur: n })}
                />
                <div className="mt-3">
                  <SliderField
                    label="Offset Y"
                    value={selected.shadowOffsetY ?? 6}
                    min={-20}
                    max={30}
                    suffix="px"
                    onChange={(n) => updateSelected({ shadowOffsetY: n })}
                  />
                </div>
                <div className="mt-3">
                  <span className="mb-2 block text-[9px] uppercase tracking-wider text-white/40">
                    Colour
                  </span>
                  <StudioColorField allowGradients
                    value={selected.shadowColor ?? '#000000'}
                    onChange={(h) => updateSelected({ shadowColor: h })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                  />
                </div>
              </div>
            ) : null}

            <Button type="button" variant="outline" disabled={selected.locked}
              onClick={() => { studio.setTool('select'); studio.setCropEditingId(selected.id); }}>
              Crop artwork
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <FlipControls element={selected} onChange={updateSelected} />
              <Button
                variant="outline"
                onClick={duplicateSelected}
                className="h-9 border-white/18 px-2 text-[10px] !text-white hover:bg-white/10"
              >
                <Copy className="mr-1.5 h-3 w-3" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                onClick={() => layer('front')}
                className="h-9 border-white/18 px-2 text-[10px] !text-white hover:bg-white/10"
              >
                <BringToFront className="mr-1.5 h-3 w-3" />
                Top
              </Button>
              <Button
                variant="outline"
                onClick={() => layer('back')}
                className="h-9 border-white/18 px-2 text-[10px] !text-white hover:bg-white/10"
              >
                <SendToBack className="mr-1.5 h-3 w-3" />
                Bottom
              </Button>
              <Button
                variant="outline"
                onClick={() => updateSelected({ locked: !selected.locked })}
                className="col-span-2 h-9 border-white/18 px-2 text-[10px] !text-white hover:bg-white/10"
              >
                {selected.locked ? (
                  <>
                    <Unlock className="mr-1.5 h-3 w-3" />
                    Unlock position
                  </>
                ) : (
                  <>
                    <Lock className="mr-1.5 h-3 w-3" />
                    Lock position
                  </>
                )}
              </Button>
              <div className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/25 px-3 py-2.5 text-[10px] text-white/55">
                <Move className="h-3.5 w-3.5 shrink-0 text-white/45" />
                Drag to move · corners scale · sides stretch · double-click text to edit
              </div>
            </div>
          </div>
        </PrintPanel>
      ) : null}

      <PrintPanel title={`Layers (${sideElements.length})`}>
        <div className="mb-3 space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(groupIssue) || merging} onClick={groupSelectedLayers} title={groupIssue ?? 'Group editable children to move, resize, rotate or warp together'}>Group</Button>
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(ungroupIssue) || merging} onClick={ungroupSelectedLayer} title={ungroupIssue ?? 'Restore children without flattening artwork'}>Ungroup</Button>
          </div>
          <p className="text-[10px] text-white/50">Check layers or Shift-click their names, then Group to transform together. Grouping retains editable sources.</p>
          {mergeIds.length > 1 && groupIssue ? <p className="text-[10px] text-white/50">{groupIssue}</p> : null}
          {selected?.type === 'group' ? <div className="space-y-2 rounded border border-white/10 p-2">
            <p className="text-[10px] text-white/50">{ungroupIssue ?? 'Resized, flipped, cropped, distorted or warped children retain editable transform envelopes when ungrouped.'}</p>
            {(selected.children ?? []).map((child, index) => <label key={child.id} className="block text-[10px] text-white/60">
              Source {index + 1}: {child.layerName ?? child.type}
              {child.type === 'text' ? <Input disabled={Boolean(selected.locked || child.locked)} aria-label={`Edit group source ${index + 1} text`} value={child.content} onChange={event => updateSelected({ children: selected.children!.map(item => item.id === child.id ? { ...item, content: event.target.value } : item) })} /> : null}
              {child.color !== undefined ? <Input disabled={Boolean(selected.locked || child.locked)} aria-label={`Edit group source ${index + 1} color`} value={child.color} onChange={event => updateSelected({ children: selected.children!.map(item => item.id === child.id ? { ...item, color: event.target.value } : item) })} /> : null}
            </label>)}
          </div> : null}
          <Button type="button" variant="outline" className="w-full" disabled={Boolean(mergeIssue) || merging}
            onClick={() => void mergeSelectedLayers()} title={mergeIssue ?? 'Flatten selected layers into one editable image'}>
            {merging ? 'Merging…' : 'Merge Layers'}{mergeIds.length > 0 ? ` (${mergeIds.length})` : ''}
          </Button>
          <p className="text-[10px] text-white/50">{mergeIssue ?? 'Appearance is flattened; Undo restores the original layers.'}</p>
          {mergeError ? <p role="alert" className="text-xs text-red-400">{mergeError}</p> : null}
        </div>
        <div className={cn('space-y-2', listDraggingId && 'list-reorder-active')}>
          {sideElements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 px-3 py-4 text-center text-[11px] leading-relaxed text-white/38">
            Pick a tool, then draw, drop a shape, or upload artwork onto the {assetMode ? 'artboard' : 'garment'}.
            </div>
          ) : (
            (() => {
              const sourceIndex = listDraggingId
                ? sideElements.findIndex((el) => el.id === listDraggingId)
                : -1;
              const targetIndex =
                listDraggingId && listDragOverId
                  ? sideElements.findIndex((el) => el.id === listDragOverId)
                  : -1;
              const rowH = listDragRowHeightRef.current;
              return sideElements.map((element, index) => {
                const isDragging = listDraggingId === element.id;
                let rowTransform: string | undefined;
                if (isDragging) {
                  rowTransform = `translateY(${listDragDeltaY}px)`;
                } else if (
                  sourceIndex >= 0 &&
                  targetIndex >= 0 &&
                  rowH > 0
                ) {
                  const off = getListReorderRowOffsetY(
                    index,
                    sourceIndex,
                    targetIndex,
                    listDragDeltaY,
                    rowH,
                    sideElements.length,
                  );
                  if (off !== 0) rowTransform = `translateY(${off}px)`;
                }

                return (
                <div
                  key={element.id}
                  ref={(node) => {
                    if (node) listRowRefs.current.set(element.id, node);
                    else listRowRefs.current.delete(element.id);
                  }}
                  style={{ transform: rowTransform, position: 'relative' }}
                  className={cn(
                    'drag-list-row flex w-full items-stretch gap-1 rounded-lg border',
                    isDragging
                      ? 'drag-list-floating border-white/30'
                      : selectedId === element.id
                        ? 'border-[#FF3B30] bg-[#FF3B30]/10'
                        : 'border-[#252528] bg-black/25 hover:border-white/18',
                  )}
                >
                  <input type="checkbox" aria-label={`Select layer ${index + 1} for group or merge`} className="ml-2 shrink-0"
                    checked={mergeIds.includes(element.id)} disabled={(!canGroupLayer(element) && !canMergeLayer(element)) || merging}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setMergeIds(previous => checked ? [...previous, element.id] : previous.filter(id => id !== element.id));
                      setMergeError(null);
                    }} />
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={(ev) => onListGripPointerDown(ev, element.id)}
                    className="flex shrink-0 cursor-grab touch-none select-none items-center rounded-l-[8px] px-1 text-white/35 hover:bg-white/[0.06] hover:text-white/60 active:cursor-grabbing"
                    aria-label="Drag to reorder layer"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      studio.setTool('select');
                      if (event.shiftKey && (canGroupLayer(element) || canMergeLayer(element)) && !merging) {
                        setMergeIds(previous => toggleLayerSelection(previous.length ? previous : selectedId && selectedId !== element.id && elements.some(item => item.id === selectedId && canGroupLayer(item)) ? [selectedId] : [], element.id));
                        setMergeError(null);
                      }
                      setSelectedId(element.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-0.5 pr-2 text-left"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-white/55">
                      {element.type === 'image' ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : element.type === 'customArea' ? (
                        <PenTool className="h-3.5 w-3.5" />
                      ) : element.type === 'drawing' || element.type === 'distress' ? (
                        <Brush className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-white">
                        {element.type === 'group' ? `${element.layerName ?? 'Group'} (${element.children?.length ?? 0})` : element.layerName ?? (element.type === 'image'
                          ? 'Uploaded artwork'
                          : element.id === DISTRESS_LAYER_ID
                            ? 'Distressing'
                            : element.type === 'drawing'
                              ? 'Drawing'
                              : element.type === 'shape'
                                ? 'Shape'
                                : element.type === 'customArea'
                                  ? element.customAreaName || 'Custom Area'
                                  : element.type === 'pattern'
                                  ? 'Pattern'
                                  : element.type === 'distress'
                                    ? 'Distressing'
                                    : element.content)}
                      </div>
                      <div className="truncate text-[9.5px] text-white/40">
                        {element.type !== 'distress' ? (
                          <>
                            <span className="text-white/55">
                              {element.printMethod ?? DEFAULT_PRINT_METHOD}
                            </span>
                            {' · '}
                          </>
                        ) : null}
                        {Math.round(element.x)}, {Math.round(element.y)} ·{' '}
                        {Math.round(element.rotation)}°
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`${element.hidden ? 'Show' : 'Hide'} ${element.type === 'customArea' ? 'Custom Area' : element.type} layer`}
                    title={element.hidden ? 'Show layer' : 'Hide layer'}
                    onClick={() => { studio.setTool('select'); onChange(elements.map(item => item.id === element.id ? { ...item, hidden: !item.hidden } : item)); }}
                    className="flex shrink-0 items-center justify-center border-l border-[#252528] px-2 text-white/50 hover:text-white"
                  >{element.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                  <button
                    type="button"
                    className="flex shrink-0 items-center justify-center rounded-r-[8px] border-l border-[#252528] px-2 text-white/35 transition hover:bg-white/[0.08] hover:text-[#FF3B30]"
                    aria-label="Delete layer"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeElementById(element.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              );
              });
            })()
          )}
        </div>
      </PrintPanel>

      <style>{`
        .rotation-scroller {
          -webkit-appearance: none;
          appearance: none;
          height: 10px;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,59,48,0.35) 50%, rgba(255,255,255,0.06) 100%);
        }
        .rotation-scroller::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          border: 2px solid rgba(255,59,48,0.9);
          margin-top: -4px;
        }
        .rotation-scroller::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          border: 2px solid rgba(255,59,48,0.9);
        }
        .rotation-scroller::-moz-range-track {
          height: 10px;
          border-radius: 9999px;
          background: transparent;
        }
      `}</style>
    </div>
  );
}

export function PrintsDesignPreview({
  assetMode = false,
  canvasSize,
  onCanvasSizeChange,
  garmentInteractive = false,
  garmentPreview,
  elements,
  onChange,
  editable = false,
  className,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
  liveCanvasScale: liveCanvasScaleProp,
  phoneConfigSheetCollapsed = false,
  garmentSide = 'front',
}: PrintsDesignPreviewProps) {
  const studio = usePrintsStudio();
  const assetWorkspace = useAssetWorkspaceContext();
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<PrintsCanvasSize>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setFrameSize(previous => previous.width === frame.clientWidth && previous.height === frame.clientHeight
      ? previous : { width: frame.clientWidth, height: frame.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const validCanvasSize = canvasSize && Number.isFinite(canvasSize.width) && Number.isFinite(canvasSize.height) && canvasSize.width > 0 && canvasSize.height > 0 ? canvasSize : null;
  useLayoutEffect(() => {
    if (editable && !validCanvasSize && frameSize.width > 0 && frameSize.height > 0) onCanvasSizeChange?.(frameSize);
  }, [editable, validCanvasSize, frameSize, onCanvasSizeChange]);
  const sceneScale = validCanvasSize && frameSize.width > 0 && frameSize.height > 0
    ? Math.min(frameSize.width / validCanvasSize.width, frameSize.height / validCanvasSize.height) : 1;
  const [importedFontFamilies, setImportedFontFamilies] = useState<string[]>([]);
  useEffect(() => {
    void hydrateFontLibrary().then((names) => {
      if (names.length) setImportedFontFamilies((prev) => Array.from(new Set([...names, ...prev])));
    });
  }, []);
  const previewFontOptions = useMemo(
    () => [...importedFontFamilies, ...FONT_OPTIONS.filter((f) => !importedFontFamilies.includes(f))],
    [importedFontFamilies],
  );
  const [fallbackSelectedId, setFallbackSelectedId] = useState<string | null>(null);
  const selectionControlled = onSelectedLayerIdChange !== undefined;
  const selectedId = selectionControlled ? (selectedLayerIdProp ?? null) : fallbackSelectedId;
  const setSelectedId = useCallback(
    (next: string | null | ((prev: string | null) => string | null)) => {
      if (selectionControlled) {
        const resolved =
          typeof next === 'function' ? next(selectedLayerIdProp ?? null) : next;
        onSelectedLayerIdChange?.(resolved);
      } else {
        setFallbackSelectedId((prev) => (typeof next === 'function' ? next(prev) : next));
      }
    },
    [onSelectedLayerIdChange, selectionControlled, selectedLayerIdProp],
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liveShapePath, setLiveShapePath] = useState<{ id: string; path: ShapePath } | null>(null);
  useEffect(() => {
    if (studio.pathEditingId && !elements.some(item => item.id === studio.pathEditingId && item.id === selectedId && item.type === 'shape' && item.shapePath && !item.locked && designElementSide(item) === garmentSide)) studio.setPathEditingId(null);
  }, [elements, selectedId, garmentSide, studio.pathEditingId, studio.setPathEditingId]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  /** Live x/y while a drag is in progress. Kept *local* so the parent never
   *  re-renders per frame — that's the main reason dragging used to feel glitchy. */
  const [dragLivePos, setDragLivePos] = useState<{ x: number; y: number } | null>(null);
  const dragLivePosRef = useRef<{ x: number; y: number } | null>(null);
  const [manip, setManip] = useState<PrintManip | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editAreaRef = useRef<HTMLTextAreaElement>(null);
  const [narrowViewport, setNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setNarrowViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const zoneRef = useRef<HTMLDivElement>(null);
  const [zoneEl, setZoneEl] = useState<HTMLDivElement | null>(null);
  const drawingMask = useGarmentDrawingMask(zoneEl, garmentSide, assetMode);
  const patternTargets = useGarmentPatternTargets(zoneEl, garmentSide);
  useEffect(() => {
    if (!editable) return;
    const render = async (ids: string[]) => {
      const zone = zoneRef.current;
      if (!zone) throw new Error('The garment preview is not ready.');
      return flattenDesignLayers(zone, elements.filter(element => designElementSide(element) === garmentSide), ids);
    };
    studio.layerRenderer.current = render;
    return () => { if (studio.layerRenderer.current === render) studio.layerRenderer.current = null; };
  }, [editable, elements, garmentSide, studio.layerRenderer]);
  const [patternHover, setPatternHover] = useState<{ kind: 'part' | 'area'; id: string } | null>(null);
  const findPatternTarget = (clientX: number, clientY: number) => {
    const zone = zoneRef.current;
    if (!zone) return null;
    const point = clientToZonePoint(zone, clientX, clientY);
    for (const area of [...elements].reverse()) {
      if (area.type !== 'customArea' || area.hidden || area.locked || area.customAreaOpen || designElementSide(area) !== garmentSide) continue;
      const local = customAreaLocalPoint(point, area);
      const context = document.createElement('canvas').getContext('2d');
      if (context?.isPointInPath(new Path2D(customAreaPath(area.customAreaPoints ?? [])), local.x, local.y)
        && (assetMode || patternTargets.some(target => targetContains(target, point.x, point.y)))) return { kind: 'area' as const, id: area.id };
    }
    const part = patternTargets.find(target => targetContains(target, point.x, point.y));
    return part ? { kind: 'part' as const, id: part.id } : null;
  };
  useEffect(() => {
    const clear = () => setPatternHover(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear); };
  }, []);
  const [customAreaDraft, setCustomAreaDraft] = useState<CustomAreaPoint[]>([]);
  const [customAreaCursor, setCustomAreaCursor] = useState<CustomAreaPoint | null>(null);
  const [liveCustomAreaPoints, setLiveCustomAreaPoints] = useState<{ id: string; points: CustomAreaPoint[] } | null>(null);
  const customAreaDraftIdRef = useRef<string | null>(null);
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const garmentSideRef = useRef(garmentSide);
  const dragStartClientRef = useRef({ x: 0, y: 0 });
  const dragDidMoveRef = useRef(false);
  const dragPointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const textTapRef = useRef<{ id: string; alreadySelected: boolean } | null>(null);
  const editDraftRef = useRef('');
  const beginTextEditing = (element: DesignElement) => {
    const draft = formatTextListInput(element.content, element.textListLineStyles, element.textList ?? 'none');
    setEditingTextId(element.id);
    setEditDraft(draft);
    editDraftRef.current = draft;
  };
  const [alignmentGuides, setAlignmentGuides] = useState<{
    vertical: number[];
    horizontal: number[];
  } | null>(null);
  /** Last guides actually committed to state so we can skip redundant setState
   *  calls during drag — identical guides don't need a re-render. */
  const guidesRef = useRef<{ vertical: number[]; horizontal: number[] } | null>(null);

  useLayoutEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useLayoutEffect(() => {
    garmentSideRef.current = garmentSide;
  }, [garmentSide]);

  const visibleElements = useMemo(
    () => elements.filter((item) => designElementSide(item) === garmentSide && !item.hidden && !item.customAreaOpen),
    [elements, garmentSide],
  );

  useEffect(() => {
    if (!selectedId) return;
    const el = elements.find((item) => item.id === selectedId);
    if (el && designElementSide(el) !== garmentSide) setSelectedId(null);
  }, [garmentSide, selectedId, elements, setSelectedId]);

  useLayoutEffect(() => {
    if (!editingTextId) return;
    const ta = editAreaRef.current;
    if (!ta) return;
    ta.focus();
    if (narrowViewport) {
      const len = ta.value.length;
      requestAnimationFrame(() => {
        try {
          ta.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      });
    } else {
      ta.select();
    }
    if (narrowViewport) {
      requestAnimationFrame(() => {
        ta.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      });
    }
  }, [editingTextId, narrowViewport]);

  /** Keep the text-edit textarea's height locked to its content so there's no
   *  extra space below the caret — feels like typing directly on the canvas.
   *  If the user has manually sized this element (autoHeight === false) we
   *  respect that as a floor so the intentional padding is preserved. */
  useLayoutEffect(() => {
    const ta = editAreaRef.current;
    if (!ta || !editingTextId) return;
    const el = elementsRef.current.find((item) => item.id === editingTextId);
    const floor = el && el.autoHeight === false ? el.height : 0;
    ta.style.height = '0px';
    const contentH = ta.scrollHeight;
    ta.style.height = `${Math.max(contentH, floor)}px`;
  }, [editDraft, editingTextId]);

  useEffect(() => {
    if (elements.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && !elements.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [elements, selectedId, setSelectedId]);

  const updateElement = (id: string, patch: Partial<DesignElement>, select = false) => {
    const fn = onChangeRef.current;
    if (!fn) return;
    fn(elementsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)), select ? id : undefined);
  };

  useEffect(() => {
    const openArea = elements.find((element) => element.customAreaOpen);
    if (openArea) {
      customAreaDraftIdRef.current = openArea.id;
      setCustomAreaDraft(openArea.customAreaPoints ?? []);
      studio.setTool('customArea');
      return;
    }
    const restored = elements.find(item => item.id === customAreaDraftIdRef.current && item.type === 'customArea');
    customAreaDraftIdRef.current = null;
    setCustomAreaDraft([]);
    if (restored) { setSelectedId(restored.id); studio.setTool('customAreaEdit'); }
  }, [elements]);

  useEffect(() => {
    if (studio.tool === 'customArea') return;
    const draftId = customAreaDraftIdRef.current;
    if (!draftId) return;
    customAreaDraftIdRef.current = null;
    onChangeRef.current?.(elementsRef.current.filter((element) => element.id !== draftId));
    setCustomAreaDraft([]);
    setCustomAreaCursor(null);
  }, [studio.tool]);

  const closeCustomArea = () => {
    const area = elementsRef.current.find(item => item.id === customAreaDraftIdRef.current && item.customAreaOpen);
    const draft = area?.customAreaPoints ?? [];
    if (!area || draft.length < 3) return;
    const bounds = customAreaBounds(draft);
    const name = `Custom Area ${elementsRef.current.filter(item => item.type === 'customArea').length}`;
    updateElement(area.id, {
      ...bounds, customAreaOpen: false, customAreaName: name, content: name,
      customAreaViewWidth: bounds.width, customAreaViewHeight: bounds.height,
      customAreaPoints: draft.map(vertex => ({ x: vertex.x - (bounds.x - bounds.width / 2), y: vertex.y - (bounds.y - bounds.height / 2) })),
    }, true);
    setSelectedId(area.id); studio.setCustomAreaPointSelection({ id: area.id, index: 0 });
    setCustomAreaDraft([]); setCustomAreaCursor(null); customAreaDraftIdRef.current = null;
    studio.setTool('customAreaEdit');
  };

  const handleCustomAreaPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || event.button !== 0 || !zoneRef.current) return;
    const zone = zoneRef.current;
    const point = clientToZonePoint(zone, event.clientX, event.clientY);
    if (studio.tool === 'customArea') {
      event.preventDefault();
      event.stopPropagation();
      const openArea = elementsRef.current.find((element) => element.id === customAreaDraftIdRef.current && element.customAreaOpen);
      const draft = openArea?.customAreaPoints ?? customAreaDraft;
      const start = draft[0];
      const closeRadius = 18 / zoneScaleFactor(zone);
      if (draft.length >= 3 && start && Math.hypot(start.x - point.x, start.y - point.y) <= closeRadius && openArea) {
        closeCustomArea();
        return;
      }
      const nextPoints = [...draft, point];
      setCustomAreaDraft(nextPoints);
      if (openArea) updateElement(openArea.id, { customAreaPoints: nextPoints });
      else {
        const areaCount = elementsRef.current.filter((element) => element.type === 'customArea').length;
        const name = `Custom Area ${areaCount + 1}`;
        const next: DesignElement = {
          id: `custom-area-${Date.now()}`, type: 'customArea', customAreaOpen: true,
          customAreaName: name, content: name, customAreaPoints: nextPoints,
          x: point.x, y: point.y, width: 1, height: 1, rotation: 0,
          color: studio.color, opacity: 100, side: garmentSide,
        };
        customAreaDraftIdRef.current = next.id;
        onChangeRef.current?.([...elementsRef.current, next]);
      }
      return;
    }
    if (studio.tool !== 'customAreaAddPoint') return;
    const area = elementsRef.current.find((element) => element.id === selectedId && element.type === 'customArea');
    if (!area || area.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const localPoint = customAreaLocalPoint(point, area);
    const points = area.customAreaPoints ?? [];
    const nearest = nearestCustomAreaSegment(points, localPoint);
    const nextPoints = splitCustomAreaSegment(points, nearest.index, nearest.t);
    updateElement(area.id, customAreaGeometryPatch(nextPoints, area));
    studio.setCustomAreaPointSelection({ id: area.id, index: nearest.index + 1 });
    studio.setTool('customAreaEdit');
  };

  const customAreaLocalPoint = (point: CustomAreaPoint, area: DesignElement): CustomAreaPoint => {
    const radians = -area.rotation * Math.PI / 180;
    const dx = point.x - area.x;
    const dy = point.y - area.y;
    const local = shapePointMapping(area).inverse({
      x: (dx * Math.cos(radians) - dy * Math.sin(radians) + area.width / 2) / area.width * 100,
      y: (dx * Math.sin(radians) + dy * Math.cos(radians) + area.height / 2) / area.height * 100,
    });
    const viewport = customAreaViewport(area);
    return { x: local.x / 100 * viewport.width, y: local.y / 100 * viewport.height };
  };


  const removeElement = (id: string) => {
    const fn = onChangeRef.current;
    if (!fn) return;
    fn(elementsRef.current.filter((item) => item.id !== id));
    setSelectedId((sid) => (sid === id ? null : sid));
  };

  useEffect(() => {
    if (!editingTextId || selectedId === editingTextId) return;
    const el = elementsRef.current.find((item) => item.id === editingTextId);
    const draft = editDraftRef.current;
    if (draft.length === 0 && el?.type === 'text') {
      removeElement(editingTextId);
      setEditingTextId(null);
      return;
    }
    const fn = onChangeRef.current;
    const next = parseTextListInput(draft);
    if (fn && el) {
      fn(
        elementsRef.current.map((item) =>
          item.id === editingTextId
            ? {
                ...item,
                content: next.content,
                textListLineStyles: next.lineStyles,
              }
            : item,
        ),
      );
    }
    setEditingTextId(null);
  }, [selectedId, editingTextId]);

  const duplicateElement = (id: string) => {
    const fn = onChangeRef.current;
    if (!fn) return;
    const src = elementsRef.current.find((item) => item.id === id);
    if (!src) return;
    const copy: DesignElement = {
      ...src,
      id: `${Date.now()}`,
      x: src.x + 14,
      y: src.y + 14,
      locked: false,
    };
    fn([...elementsRef.current, copy], copy.id);
    setSelectedId(copy.id);
  };

  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"], select')) return;
      if (editingTextId || studio.pathEditingId || studio.tool === 'shapePolygon') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (studio.tool === 'customArea' && customAreaDraftIdRef.current) {
          removeElement(customAreaDraftIdRef.current);
          customAreaDraftIdRef.current = null;
          setCustomAreaDraft([]);
          studio.setTool('select');
          return;
        }
        if (studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint') {
          studio.setCustomAreaPointSelection(null);
          studio.setTool('select');
          return;
        }
        setSelectedId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint') { e.preventDefault(); return; }
        if (!selectedId) return;
        e.preventDefault();
        removeElement(selectedId);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const d =
        e.key === 'ArrowLeft'
          ? ([-step, 0] as const)
          : e.key === 'ArrowRight'
            ? ([step, 0] as const)
            : e.key === 'ArrowUp'
              ? ([0, -step] as const)
              : e.key === 'ArrowDown'
                ? ([0, step] as const)
                : null;
      if (!d || !selectedId) return;
      const el = elementsRef.current.find((x) => x.id === selectedId);
      if (!el || el.locked) return;
      e.preventDefault();
      updateElement(selectedId, { x: el.x + d[0], y: el.y + d[1] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, selectedId, editingTextId, setSelectedId, studio.tool, studio.pathEditingId, studio.setTool, studio.setCustomAreaPointSelection]);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  useEffect(() => {
    if (!manip || !editable) return;

    const onMove = (e: PointerEvent) => {
      if (manip.kind === 'rotate') {
        const cur = Math.atan2(e.clientY - manip.cy, e.clientX - manip.cx);
        const deltaDeg = ((cur - manip.startAngle) * 180) / Math.PI;
        let next = manip.startRot + deltaDeg;
        next = ((next % 360) + 360) % 360;
        if (elementsRef.current.find(element => element.id === manip.id)?.type === 'image') next = snapImageRotation(next);
        updateElement(manip.id, { rotation: next });
        return;
      }
      const z = zoneRef.current;
      const s = z ? zoneScaleFactor(z) : 1;
      const angle = (elementsRef.current.find(element => element.id === manip.id)?.rotation ?? 0) * Math.PI / 180;
      const screenX = (e.clientX - manip.startX) / s;
      const screenY = (e.clientY - manip.startY) / s;
      const dx = 2 * (screenX * Math.cos(angle) + screenY * Math.sin(angle));
      const dy = 2 * (-screenX * Math.sin(angle) + screenY * Math.cos(angle));
      const h = manip.handle;
      const corners: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
      if (corners.includes(h)) {
        let dw = 0;
        let dh = 0;
        switch (h) {
          case 'se':
            dw = dx;
            dh = dy;
            break;
          case 'nw':
            dw = -dx;
            dh = -dy;
            break;
          case 'ne':
            dw = dx;
            dh = -dy;
            break;
          case 'sw':
            dw = -dx;
            dh = dy;
            break;
          default:
            break;
        }
        const sw = (manip.startW + dw) / manip.startW;
        const sh = (manip.startH + dh) / manip.startH;
        if (manip.aspectLocked) {
          const s = Math.sqrt(Math.max(0.15, Math.min(6, sw * sh)));
          const nw = clamp(manip.startW * s, manip.isImage ? 32 : 48, manip.isImage ? 520 : 440);
          const nh = clamp(manip.startH * s, manip.isImage ? 32 : 28, manip.isImage ? 520 : 320);
          if (manip.isImage) {
            updateElement(manip.id, { width: nw, height: nh });
          } else {
            const nfs = clamp(Math.round(manip.startFontSize * s), 12, 120);
            updateElement(manip.id, {
              width: nw,
              height: nh,
              fontSize: nfs,
              autoHeight: false,
              autoWidth: false,
            });
          }
        } else {
          const nw = clamp(manip.startW + dw, manip.isImage ? 32 : 48, manip.isImage ? 520 : 440);
          const nh = clamp(manip.startH + dh, manip.isImage ? 32 : 28, manip.isImage ? 520 : 320);
          updateElement(
            manip.id,
            manip.isImage
              ? { width: nw, height: nh }
              : { width: nw, height: nh, autoHeight: false, autoWidth: false },
          );
        }
        return;
      }
      if (manip.isImage) {
        if (h === 'e') updateElement(manip.id, { width: clamp(manip.startW + dx, 32, 520) });
        else if (h === 'w') updateElement(manip.id, { width: clamp(manip.startW - dx, 32, 520) });
        else if (h === 's') updateElement(manip.id, { height: clamp(manip.startH + dy, 32, 520) });
        else if (h === 'n') updateElement(manip.id, { height: clamp(manip.startH - dy, 32, 520) });
        return;
      }
      if (h === 'e')
        updateElement(manip.id, {
          width: clamp(manip.startW + dx, 48, 440),
          autoWidth: false,
        });
      else if (h === 'w')
        updateElement(manip.id, {
          width: clamp(manip.startW - dx, 48, 440),
          autoWidth: false,
        });
      else if (h === 's')
        updateElement(manip.id, {
          height: clamp(manip.startH + dy, 28, 360),
          autoHeight: false,
        });
      else if (h === 'n')
        updateElement(manip.id, {
          height: clamp(manip.startH - dy, 28, 360),
          autoHeight: false,
        });
    };

    const onUp = () => setManip(null);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [manip, editable]);

  useEffect(() => {
    if (!draggingId || !editable) return;
    if (!onChangeRef.current) return;
    if (manip) return;

    /* Throttle the position update to animation frames. pointermove fires at
     * the device's input rate (120 Hz+) and each run does DOM measurement +
     * snap math; without batching we burn frames and the element stutters. */
    let rafId: number | null = null;
    let latestClientX = 0;
    let latestClientY = 0;
    let pending = false;

    const arraysSame = (a: number[], b: number[]) => {
      if (a === b) return true;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    const applyMove = () => {
      rafId = null;
      if (!pending) return;
      pending = false;
      const zone = zoneRef.current;
      if (!zone) return;

      const current = elementsRef.current.find((item) => item.id === draggingId);
      if (!current || current.locked) return;

      /** On phone, finger/joint movement often exceeds 5px on a "tap" — be lenient so
       *  “tap again to edit text” (pointerup) still runs instead of a bogus drag. */
      const moveSlop = narrowViewport ? 20 : 5;
      if (
        Math.hypot(
          latestClientX - dragStartClientRef.current.x,
          latestClientY - dragStartClientRef.current.y,
        ) > moveSlop
      ) {
        dragDidMoveRef.current = true;
      }

      const p = clientToZonePoint(zone, latestClientX, latestClientY);
      const nx = p.x - dragOffset.x;
      const ny = p.y - dragOffset.y;
      const boxH =
        current.type === 'image'
          ? current.height
          : Math.max(current.height ?? 0, (current.fontSize ?? 20) + 18);
      let halfW = current.width / 2;
      let halfH = boxH / 2;
      if (current.type === 'text') {
        const node = zone.querySelector(`[data-print-id="${draggingId}"]`) as HTMLElement | null;
        if (node) {
          const m = measureHalfExtentsInZone(zone, node);
          halfW = m.halfW;
          halfH = m.halfH;
        }
      }

      const snapBoxes: SnapBox[] = elementsRef.current
        .filter((el) => designElementSide(el) === garmentSideRef.current)
        .map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height:
          el.type === 'image'
            ? el.height
            : Math.max(el.height ?? 0, (el.fontSize ?? 20) + 18),
      }));
      const snapped = snapDragInZone(
        nx,
        ny,
        halfW,
        halfH,
        zone.offsetWidth,
        zone.offsetHeight,
        draggingId,
        snapBoxes,
        PREVIEW_SNAP_CENTER_NUDGE,
      );

      /* Skip setAlignmentGuides when the guide lines haven't actually changed —
       * React still does work for a same-value setState and we call this on
       * every pointermove frame. */
      const prevGuides = guidesRef.current;
      const vSame =
        prevGuides != null && arraysSame(prevGuides.vertical, snapped.verticalLines);
      const hSame =
        prevGuides != null && arraysSame(prevGuides.horizontal, snapped.horizontalLines);
      if (!vSame || !hSame) {
        const nextGuides = {
          vertical: snapped.verticalLines,
          horizontal: snapped.horizontalLines,
        };
        guidesRef.current = nextGuides;
        setAlignmentGuides(nextGuides);
      }

      /* Keep live position local so only PrintsDesignPreview re-renders per
       * frame instead of bubbling through the parent's setState → full-tree
       * re-render. The committed element.x/y is written once on pointerup. */
      const prev = dragLivePosRef.current;
      if (!prev || prev.x !== snapped.x || prev.y !== snapped.y) {
        const nextPos = { x: snapped.x, y: snapped.y };
        dragLivePosRef.current = nextPos;
        setDragLivePos(nextPos);
      }
    };

    const handleMove = (e: PointerEvent) => {
      latestClientX = e.clientX;
      latestClientY = e.clientY;
      pending = true;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(applyMove);
    };

    const handleUp = () => {
      const cap = dragPointerCaptureRef.current;
      dragPointerCaptureRef.current = null;
      if (cap) {
        try {
          if (cap.el.hasPointerCapture(cap.pointerId)) {
            cap.el.releasePointerCapture(cap.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
      if (
        draggingId &&
        !dragDidMoveRef.current &&
        textTapRef.current?.id === draggingId &&
        textTapRef.current.alreadySelected
      ) {
        const el = elementsRef.current.find((item) => item.id === draggingId);
        if (el?.type === 'text') {
          beginTextEditing(el);
        }
      }
      /* Commit the live drag position to the real element state — this is the
       * only place we bubble x/y through the parent's onChange during a drag. */
      const liveEnd = dragLivePosRef.current;
      if (draggingId && liveEnd && dragDidMoveRef.current) {
        updateElement(draggingId, { x: liveEnd.x, y: liveEnd.y });
      }
      dragLivePosRef.current = null;
      guidesRef.current = null;
      textTapRef.current = null;
      dragDidMoveRef.current = false;
      setDraggingId(null);
      setDragLivePos(null);
      setAlignmentGuides(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [draggingId, dragOffset, editable, manip, narrowViewport]);

  const selectedElement = editable ? elements.find((el) => el.id === selectedId) ?? null : null;
  const showInlineToolbar = Boolean(
    editable &&
      selectedElement &&
      !studio.cropEditingId &&
      studio.warpEditingId !== selectedElement.id &&
      !studio.drawing,
  );
  const showCanvasChromeToolbar = Boolean(
    showInlineToolbar && selectedElement && !selectedElement.patternTarget,
  );
  const { cropEditingId, setCropEditingId } = studio;
  const [cropDraft, setCropDraft] = useState<CropInsets>(() => normalizeCrop({}));
  useLayoutEffect(() => {
    if (!editable || !cropEditingId) return;
    const element = elements.find(item => item.id === cropEditingId);
    if (element) setCropDraft(normalizeCrop(element));
  }, [cropEditingId, editable]);
  useEffect(() => {
    if (!editable || !cropEditingId) return;
    if (!selectedElement || selectedElement.id !== cropEditingId || selectedElement.locked
      || designElementSide(selectedElement) !== garmentSide || studio.drawing) setCropEditingId(null);
  }, [editable, cropEditingId, selectedElement, garmentSide, studio.drawing, setCropEditingId]);
  useEffect(() => {
    if (!editable || !cropEditingId) return;
    setDistortEditingId(null); setWarpEditingId(null);
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setCropEditingId(null); }
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [editable, cropEditingId]);
  const applyCrop = () => {
    if (editable && selectedElement && !selectedElement.locked && cropEditingId === selectedElement.id) {
      updateElement(selectedElement.id, normalizeCrop(cropDraft));
    }
    setCropEditingId(null);
  };
  const { distortEditingId, setDistortEditingId } = studio;
  const { warpEditingId, setWarpEditingId } = studio;
  useEffect(() => { setDistortEditingId(null); }, [selectedId, garmentSide, selectedElement?.locked, setDistortEditingId]);
  useEffect(() => { setWarpEditingId(null); }, [selectedId, garmentSide, selectedElement?.locked, setWarpEditingId]);
  useEffect(() => { if (studio.drawing) setDistortEditingId(null); }, [studio.drawing, setDistortEditingId]);
  useEffect(() => { if (studio.drawing) setWarpEditingId(null); }, [studio.drawing, setWarpEditingId]);
  useEffect(() => { if (distortEditingId) setCropEditingId(null); }, [distortEditingId]);

  const liveCanvasS = (liveCanvasScaleProp && liveCanvasScaleProp > 0 ? liveCanvasScaleProp : 1) * sceneScale;
  const uiInvRaw = 1 / liveCanvasS;
  /** On phone, avoid over-scaling handles when the preview is zoomed out. */
  const uiInv = narrowViewport ? Math.min(uiInvRaw, 2.25) : uiInvRaw;

  return (
    <div
      className={cn(
        'relative mx-auto flex h-full max-h-full w-full max-w-full flex-col items-center justify-center',
        className,
      )}
    >
      {editable && cropEditingId && selectedElement?.id === cropEditingId ? (
        <div data-editor-chrome data-crop-editor className="absolute inset-x-0 top-0 z-[210] flex justify-center p-2">
          <CropEditorControls draft={cropDraft} onChange={setCropDraft} onApply={applyCrop} onCancel={() => setCropEditingId(null)} />
        </div>
      ) : null}
      {narrowViewport && showCanvasChromeToolbar && selectedElement && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-2 pt-2 max-sm:px-20 sm:px-3 sm:pt-2"
              style={{
                /** Sits below navbar + clears front/back column on the right. */
                top: 'calc(env(safe-area-inset-top, 0px) + 5.75rem)',
              }}
            >
              <div className="pointer-events-auto mx-auto w-full min-w-0 max-w-[min(18.5rem,calc(100vw-5.75rem))] sm:mx-auto sm:w-max sm:max-w-[calc(100vw-1rem)]">
                <InlineElementToolbar allowGradients
                  element={selectedElement}
                  onPatch={(patch) => updateElement(selectedElement.id, patch)}
                  onDuplicate={() => duplicateElement(selectedElement.id)}
                  onDelete={() => removeElement(selectedElement.id)}
                  fontOptions={previewFontOptions}
                  compact
                  comfortableCompact
                  variant="slim"
                  className="!max-w-[min(18.5rem,calc(100vw-5.75rem))] sm:!max-w-[min(22rem,calc(100vw-2rem))]"
                  onRequestCrop={() => setCropEditingId(selectedElement.id)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
      <div
        ref={frameRef}
        className={cn(
          'relative min-h-0 w-full flex-1',
          narrowViewport && editable && 'overflow-hidden rounded-xl',
        )}
      >
        <div data-design-canvas className="relative h-full w-full" style={validCanvasSize ? {
          position: 'absolute', width: validCanvasSize.width, height: validCanvasSize.height,
          left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${sceneScale})`,
        } : undefined}>
        <div className="absolute inset-0 flex min-h-0 flex-col">
          {narrowViewport &&
          editable &&
          selectedElement?.type === 'text' &&
          editingTextId !== selectedElement.id ? (
            <p className="pointer-events-none absolute inset-x-0 top-0 z-50 px-2 pb-1.5 text-center text-[10px] leading-tight text-white/48">
              Tap the text on the design again to edit, or drag to move it.
            </p>
          ) : null}
          {editable &&
          !narrowViewport &&
          showCanvasChromeToolbar &&
          selectedElement &&
          (selectedElement.type !== 'text' || editingTextId !== selectedElement.id) ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[100] flex justify-center overflow-visible px-2 pt-2 pb-1">
              {/*
                Do not set overflow-x on this wrapper: overflow-x other than visible forces overflow-y
                to auto and clips the colour/font popovers (absolutely positioned under the bar).
                Horizontal scroll is handled inside InlineElementToolbar on the button row.
              */}
              <div className="pointer-events-auto min-w-0 max-w-full [-webkit-overflow-scrolling:touch]">
                <InlineElementToolbar allowGradients
                  element={selectedElement}
                  onPatch={(patch) => updateElement(selectedElement.id, patch)}
                  onDuplicate={() => duplicateElement(selectedElement.id)}
                  onDelete={() => removeElement(selectedElement.id)}
                  fontOptions={previewFontOptions}
                  variant="slim"
                  onRequestCrop={() => setCropEditingId(selectedElement.id)}
                />
              </div>
            </div>
          ) : null}
          <div
            className="relative z-0 min-h-0 flex-1"
            onPointerMove={(event) => {
              const root = editable && !studio.drawing && studio.tool === 'select' && zoneRef.current
                ? artworkAtPoint(zoneRef.current, event.clientX, event.clientY) : null;
              const element = elements.find(item => item.id === root?.dataset.printId);
              event.currentTarget.style.cursor = draggingId ? 'grabbing' : element && !element.locked ? 'grab' : '';
            }}
            onPointerDownCapture={(e) => {
              if (!editable || cropEditingId || studio.drawing || studio.pathEditingId || studio.tool === 'shapePolygon' || studio.tool === 'customArea' || studio.tool === 'customAreaAddPoint') return;
              if ((e.target as Element).closest('[data-handles], [data-editor-chrome], [data-inline-toolbar], [data-inline-toolbar-popover], textarea')) return;
              const zone = zoneRef.current;
              if (!zone) return;
              const root = artworkAtPoint(zone, e.clientX, e.clientY);
              const element = elements.find(item => item.id === root?.dataset.printId);
              if (!root || !element) { setSelectedId(null); if (studio.tool === 'customAreaEdit') studio.setTool('select'); return; }
              if (studio.tool === 'customAreaEdit') {
                if (element.id === selectedId) { studio.setCustomAreaPointSelection(null); return; }
                studio.setTool('select');
              }
              e.stopPropagation();
              const wasSel = selectedId === element.id;
              setSelectedId(element.id);
              textTapRef.current = { id: element.id, alreadySelected: wasSel };
              dragStartClientRef.current = { x: e.clientX, y: e.clientY };
              dragDidMoveRef.current = false;
              if (element.locked || (element.patternTarget && patternTargets.some(target => target.id === element.patternTarget))) return;
              e.preventDefault();
              const ptr = clientToZonePoint(zone, e.clientX, e.clientY);
              setManip(null);
              setDraggingId(element.id);
              setDragOffset({ x: ptr.x - element.x, y: ptr.y - element.y });
              try {
                root.setPointerCapture(e.pointerId);
                dragPointerCaptureRef.current = { el: root, pointerId: e.pointerId };
              } catch {
                dragPointerCaptureRef.current = null;
              }
            }}
            onDoubleClick={(e) => {
              if (!editable || cropEditingId || studio.drawing || studio.pathEditingId || studio.tool === 'shapePolygon' || !zoneRef.current || studio.tool === 'customArea' || studio.tool === 'customAreaAddPoint') return;
              if ((e.target as Element).closest('[data-editor-chrome], [data-handles], textarea')) return;
              const root = artworkAtPoint(zoneRef.current, e.clientX, e.clientY);
              const element = elements.find(item => item.id === root?.dataset.printId);
              if (element?.type !== 'text' || element.locked) return;
              e.stopPropagation(); e.preventDefault();
              setSelectedId(element.id);
              beginTextEditing(element);
              setDraggingId(null);
              textTapRef.current = null;
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
          {assetMode ? <div data-asset-artboard-background className="pointer-events-none absolute inset-0 border border-white/35" style={{ backgroundColor: '#ededed', backgroundImage: 'conic-gradient(#cfcfcf 25%, transparent 0 50%, #cfcfcf 0 75%, transparent 0)', backgroundSize: '24px 24px', boxShadow: '0 8px 32px #0008' }} /> : (
          <div className="absolute inset-0 z-0 flex items-center justify-center" style={{ pointerEvents: garmentInteractive ? 'auto' : 'none' }} data-print-garment-preview>
            {typeof garmentPreview === 'function' ? garmentPreview(sceneScale) : garmentPreview}
          </div>
          )}

          <div
            ref={(node) => {
              zoneRef.current = node;
              setZoneEl(node);
            }}
            data-print-design-zone
            data-asset-artboard={assetMode ? '' : undefined}
            className={cn('absolute z-10', assetMode ? 'overflow-hidden' : 'overflow-visible', editable && 'touch-none', editable && studio.tool === 'customArea' && 'cursor-crosshair')}
            onPointerDown={handleCustomAreaPointerDown}
            onPointerMove={(event) => {
              if (studio.tool === 'customArea' && zoneRef.current) setCustomAreaCursor(clientToZonePoint(zoneRef.current, event.clientX, event.clientY));
            }}
            onDragOver={(e) => {
              if (!editable) return;
              if (![STUDIO_DRAG_MIME, ASSET_LIBRARY_DRAG_MIME, 'text/plain'].some((t) => e.dataTransfer.types.includes(t))) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (e.dataTransfer.types.includes('application/x-ceriga-pattern')) {
                const target = findPatternTarget(e.clientX, e.clientY);
                setPatternHover(target);
                e.dataTransfer.dropEffect = target ? 'copy' : 'none';
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPatternHover(null);
            }}
            onDrop={(e) => {
              if (!editable || !onChange) return;
              const assetId = e.dataTransfer.getData(ASSET_LIBRARY_DRAG_MIME);
              if (assetId) {
                e.preventDefault();
                const asset = assetWorkspace?.library.find(item => item.id === assetId);
                if (asset && zoneRef.current) assetWorkspace?.insert(asset, clientToZonePoint(zoneRef.current, e.clientX, e.clientY));
                return;
              }
              const payload = decodeStudioDrag(
                e.dataTransfer.getData(STUDIO_DRAG_MIME) || e.dataTransfer.getData('text/plain'),
              );
              if (!payload) return;
              e.preventDefault();
              if (payload.kind === 'shape' && payload.id === 'custom-polygon') {
                setSelectedId(null); studio.setPathEditingId(null); studio.setTool('shapePolygon'); return;
              }
              const zone = zoneRef.current;
              if (!zone) return;
              const pt = clientToZonePoint(zone, e.clientX, e.clientY);
              const target = payload.kind === 'pattern' ? findPatternTarget(e.clientX, e.clientY) : null;
              setPatternHover(null);
              if (payload.kind === 'pattern' && !target && !assetMode) return;
              const appearance = payload.kind === 'pattern' ? { ...initialPatternSettings(payload.id, studio.color), ...patternAppearance(payload.settings) } : {};
              if (payload.kind === 'pattern' && payload.id === 'custom' && !appearance.patternSource) return;
              if (target?.kind === 'area') {
                onChange(elements.map(element => element.id === target.id ? {
                  ...element, customAreaPattern: payload.id, customAreaImage: undefined, customAreaTexture: undefined,
                  ...appearance, flipHorizontal: element.flipHorizontal, flipVertical: element.flipVertical,
                } : element));
                setSelectedId(target.id);
                studio.setTool('select');
                return;
              }
              const part = target?.kind === 'part' ? patternTargets.find(part => part.id === target.id) : undefined;
              const size = part?.bounds ?? defaultStudioSize(payload.kind, payload.id);
              const next: DesignElement = {
                id: `${Date.now()}`,
                type: payload.kind,
                content: payload.id,
                x: part?.bounds.x ?? pt.x,
                y: part?.bounds.y ?? pt.y,
                patternTarget: part?.id,
                patternSeed: payload.kind === 'pattern' ? Date.now() : undefined,
                width: size.width,
                height: size.height,
                rotation: 0,
                color: studio.color,
                borderWidth: payload.kind === 'shape' ? 4 : 0,
                opacity: 100,
                locked: false,
                printMethod: payload.kind === 'distress' ? undefined : DEFAULT_PRINT_METHOD,
                patternCount: payload.kind === 'pattern' ? defaultPatternCount(payload.id) : undefined,
                aspectLocked: payload.kind === 'shape' || payload.kind === 'pattern' || payload.kind === 'distress' ? false : undefined,
                side: garmentSide,
                ...appearance,
              };
              onChange([...elements, next]);
              setSelectedId(next.id);
              studio.setTool('select');
            }}
            style={{
              left: assetMode ? 0 : `${PREVIEW_ZONE.left}%`,
              right: assetMode ? 0 : `${PREVIEW_ZONE.right}%`,
              top: assetMode ? 0 : `${PREVIEW_ZONE.top}%`,
              bottom: assetMode ? 0 : `${PREVIEW_ZONE.bottom}%`,
              pointerEvents: editable ? undefined : 'none',
            }}
          >
          {patternHover && (() => {
            const part = patternHover.kind === 'part' ? patternTargets.find(target => target.id === patternHover.id) : undefined;
            const area = patternHover.kind === 'area' ? elements.find(element => element.id === patternHover.id) : undefined;
            return <div className="pointer-events-none absolute inset-0 z-[30]" data-pattern-drop-target={patternHover.id}>
              {part ? <div className="absolute inset-0 bg-[#FF3B30]/40" style={{ maskImage: `url("${part.url}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat' }} /> : null}
              {area ? <svg className="absolute overflow-visible" viewBox={`0 0 ${area.width} ${area.height}`} style={{ left: area.x, top: area.y, width: area.width, height: area.height, transform: `translate(-50%, -50%) rotate(${area.rotation}deg)`, maskImage: drawingMask ? drawingMaskCss(drawingMask, area.width, area.height, area.x, area.y, area.rotation) : undefined }}>
                <path d={customAreaTransformedPath(area)} fill="rgba(255,59,48,0.35)" stroke="#FF3B30" strokeWidth="2" />
              </svg> : null}
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/85 px-3 py-1 text-xs text-white" role="status">Fill {part?.label ?? area?.customAreaName ?? 'Custom Area'}</span>
            </div>;
          })()}
          {editable && alignmentGuides ? (
            <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
              {alignmentGuides.vertical.map((lx, i) => (
                <div
                  key={`v-${i}-${lx}`}
                  className="absolute top-0 h-full w-0 -translate-x-1/2 border-l border-dashed"
                  style={{ left: `${lx}px`, borderColor: GUIDE_COLOR }}
                />
              ))}
              {alignmentGuides.horizontal.map((ly, i) => (
                <div
                  key={`h-${i}-${ly}`}
                  className="absolute left-0 w-full -translate-y-1/2 border-t border-dashed"
                  style={{ top: `${ly}px`, borderColor: GUIDE_COLOR }}
                />
              ))}
            </div>
          ) : null}
          {editable && (studio.tool === 'brush' || studio.tool === 'eraser') && elements
            .filter(element => element.id === DRAWING_LAYER_ID && designElementSide(element) === garmentSide)
            .map(element => <ImageAdjustmentDefs key={element.id} element={element} />)}
          {editable ? (
            <PrintsDrawLayer
              zone={zoneEl}
              garmentMask={drawingMask}
              elements={elements}
              onChange={onChange}
              editable={editable}
              garmentSide={garmentSide}
              adjustFilter={getArtworkAdjustFilter(
                elements.find((el) => el.type === 'drawing' && designElementSide(el) === garmentSide) ?? {},
              )}
            />
          ) : null}
          {editable && studio.tool === 'shapePolygon' && <ShapePolygonDraft key={garmentSide}
            width={zoneEl?.clientWidth ?? 1} height={zoneEl?.clientHeight ?? 1} color={studio.color}
            onCancel={() => studio.setTool('select')}
            onComplete={points => {
              const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
              const width = Math.max(1, Math.max(...points.map(p => p.x)) - minX), height = Math.max(1, Math.max(...points.map(p => p.y)) - minY);
              const next: DesignElement = { id: crypto.randomUUID(), type: 'shape', content: 'custom-polygon',
                x: minX + width / 2, y: minY + height / 2, width, height, rotation: 0, color: studio.color,
                shapeFilled: true, borderWidth: 2, opacity: 100, side: garmentSide, aspectLocked: false,
                shapePath: { closed: true, nodes: points.map(p => ({ x: (p.x - minX) / width * 100, y: (p.y - minY) / height * 100 })) } };
              onChange?.([...elements, next]); setSelectedId(next.id); studio.setTool('select');
            }} />}
          {editable && studio.tool === 'customArea' && customAreaDraft.length >= 3 && <button type="button" data-editor-chrome
            className="pointer-events-auto absolute bottom-2 left-1/2 z-50 -translate-x-1/2 rounded bg-zinc-950 px-3 py-2 text-xs text-white"
            onPointerDown={event => event.stopPropagation()} onClick={closeCustomArea}>Close Path</button>}
          {editable && studio.tool === 'customArea' && customAreaDraft.length > 0 ? (
            <svg className="pointer-events-none absolute inset-0 z-40 h-full w-full overflow-visible" viewBox={`0 0 ${zoneEl?.clientWidth ?? 1} ${zoneEl?.clientHeight ?? 1}`} preserveAspectRatio="none" aria-label="Custom Area in progress">
              {customAreaDraft.length > 0 ? <polyline points={[...customAreaDraft, ...(customAreaCursor ? [customAreaCursor] : [])].map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#CC2D24" strokeWidth={2} strokeDasharray="5 4" /> : null}
              {customAreaDraft.map((point, index) => {
                const close = index === 0 && customAreaDraft.length >= 3 && customAreaCursor !== null && zoneEl !== null
                  && Math.hypot(point.x - customAreaCursor.x, point.y - customAreaCursor.y) <= 18 / zoneScaleFactor(zoneEl);
                return <circle key={index} cx={point.x} cy={point.y} r={close ? 11 : index === 0 ? 7 : 5}
                  fill={close ? '#CC2D24' : '#FFFFFF'} stroke="#09090B" strokeWidth={2} />;
              })}
            </svg>
          ) : null}
          {editable && studio.drawing ? (
            <div className="pointer-events-none absolute bottom-2 left-1/2 z-[20] -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-medium tracking-wide text-white/80 backdrop-blur-md">
              {studio.tool === 'eraser' || studio.tool === 'distressEraser'
                ? 'Eraser'
                : studio.tool === 'distress'
                  ? 'Distress brush'
                  : 'Brush'}
              {' · '}
              {studio.tool === 'eraser' || studio.tool === 'distressEraser' || studio.tool === 'distress'
                ? studio.eraserSize
                : studio.brushSize}px · {studio.opacity}%
            </div>
          ) : null}
          {visibleElements.map((element) => {
            const selected = selectedId === element.id;

            const bw = element.borderWidth ?? 0;
            const bc = element.borderColor ?? '#FFFFFF';
            const op = (element.opacity ?? 100) / 100;
            const locked = element.locked === true;
            const isEditingText = editingTextId === element.id;
            const displayFont = element.fontSize ?? 30;
            /** iOS zooms the page on focus if input font is under 16px — avoid while editing. */
            const editFontSize = narrowViewport ? Math.max(16, displayFont) : displayFont;

            const patternPart = element.patternTarget ? patternTargets.find(target => target.id === element.patternTarget) : undefined;
            if (element.patternTarget && !patternPart) return null;
            const visualElement = patternPart ? { ...element, ...patternPart.bounds, rotation: 0 }
              : element.type === 'customArea' && liveCustomAreaPoints?.id === element.id
                ? { ...element, customAreaViewWidth: customAreaViewport(element).width, customAreaViewHeight: customAreaViewport(element).height, customAreaPoints: liveCustomAreaPoints.points }
                : liveShapePath?.id === element.id ? { ...element, shapePath: liveShapePath.path } : element;
            const isHeld = draggingId === element.id && editable && !locked;
            const liveX =
              isHeld && dragLivePos ? dragLivePos.x : visualElement.x;
            const liveY =
              isHeld && dragLivePos ? dragLivePos.y : visualElement.y;
            const isArtwork =
              element.type === 'image' ||
              element.type === 'drawing' ||
              element.type === 'shape' ||
              element.type === 'pattern' ||
              element.type === 'customArea' ||
              element.type === 'group' ||
              element.type === 'distress';
            const hideDrawingOnCanvas = editable && (
              (element.id === DRAWING_LAYER_ID && (studio.tool === 'brush' || studio.tool === 'eraser')) ||
              (element.id === DISTRESS_LAYER_ID && (studio.tool === 'distress' || studio.tool === 'distressEraser')));

            if (hideDrawingOnCanvas) return null;

            return (
              <div
                key={element.id}
                data-print-id={element.id}
                data-artwork-hit-disabled={element.id === DRAWING_LAYER_ID ? '' : undefined}
                className={cn(
                  'absolute canvas-element-drag',
                  draggingId === element.id && 'z-[15]',
                  isHeld && 'canvas-element-held',
                  element.id === DRAWING_LAYER_ID && 'pointer-events-none',
                  editable && !isEditingText && (locked ? 'cursor-default' : 'cursor-grab'),
                  editable && !isEditingText && 'select-none touch-none',
                )}
                style={{
                  left: liveX,
                  top: liveY,
                  // Text: design `width` is the wrap width; with `autoHeight` the box grows with lines.
                  width: visualElement.width,
                  maxWidth: element.type === 'text' ? element.width : undefined,
                  minWidth: element.type === 'text' ? 0 : undefined,
                  height: isArtwork
                      ? visualElement.height
                      : element.autoHeight === false
                        ? element.height
                        : undefined,
                  opacity: op,
                  pointerEvents: 'none',
                  transform: `translate(-50%, -50%) rotate(${visualElement.rotation}deg)`,
                }}
              >
                {editable && selected && element.type === 'image' && manip?.kind === 'rotate' && manip.id === element.id && element.rotation === 0 && (
                  <div data-editor-chrome data-rotation-snap className="pointer-events-none absolute inset-y-0 left-1/2 z-50 border-l border-emerald-400">
                    <span role="status" className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-emerald-950 px-2 py-1 text-[10px] font-semibold text-emerald-200" style={{ scale: uiInv }}>0°</span>
                  </div>
                )}
                {editable && selected && !locked && studio.pathEditingId === element.id && visualElement.shapePath && <ShapePathEditor
                  key={element.id} element={visualElement} scale={1 / uiInv}
                  onChange={shapePath => updateElement(element.id, { shapePath })}
                  onPreview={path => setLiveShapePath(path ? { id: element.id, path } : null)}
                  onDone={() => studio.setPathEditingId(null)} />}
                {editable && selected && !locked && !cropEditingId && element.type === 'customArea' && (studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint') && <CustomAreaPathEditor
                  key={element.id} element={element} scale={1 / uiInv}
                  onChange={points => updateElement(element.id, customAreaGeometryPatch(points, element))}
                  onPreview={points => setLiveCustomAreaPoints(points ? { id: element.id, points } : null)} />}
                <DesignAssetSurface element={visualElement} selected={selected && editable && !locked && !isEditingText && !cropEditingId && studio.pathEditingId !== element.id && !(element.type === 'customArea' && (studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint')) && !patternPart}
                  cropping={editable && cropEditingId === element.id}
                  cropOverlay={<InteractiveCropOverlay element={cropDraft} onChange={setCropDraft} width={visualElement.width} height={visualElement.height} />}
                  garmentMask={patternPart ?? drawingMask} position={{ x: liveX, y: liveY }}
                  distort={distortEditingId === element.id && !studio.drawing}
                  warpEditing={warpEditingId === element.id && !studio.drawing}
                  onWarpChange={(warp) => updateElement(element.id, { warp })}
                  scale={1 / uiInv} onChange={patch => updateElement(element.id, patch)}
                  overlay={<PrintTransformOverlay tight compactHandles={narrowViewport && element.type !== 'text'}
                    phoneTextMinimal={narrowViewport && element.type === 'text'} uiInverseScale={uiInv}
                    onRotatePointerDown={event => {
                      event.stopPropagation(); event.preventDefault();
                      const zone = zoneRef.current;
                      if (!zone) return;
                      const center = zonePointToClient(zone, element.x, element.y);
                      setDraggingId(null);
                      setManip({ kind: 'rotate', id: element.id, startRot: element.rotation, cx: center.x, cy: center.y,
                        startAngle: Math.atan2(event.clientY - center.y, event.clientX - center.x) });
                    }}
                    onResizePointerDown={(event, handle) => {
                      event.stopPropagation(); event.preventDefault(); setDraggingId(null);
                      const root = (event.currentTarget as HTMLElement).closest('[data-print-id]');
                      const content = root?.querySelector('[data-asset-content]') as HTMLElement | null;
                      setManip({ kind: 'resize', id: element.id, handle, startX: event.clientX, startY: event.clientY,
                        startW: element.width, startH: content?.offsetHeight || element.height, startFontSize: element.fontSize ?? 30,
                        isImage: element.type !== 'text', aspectLocked: element.aspectLocked ?? element.type === 'image' });
                    }} />}
                >
                {isArtwork ? (
                  <>
                    <ImageFxDefs element={element} />
                    <ImageAdjustmentDefs element={element} />
                    {element.type === 'group' ? <DesignGroupArtwork element={visualElement} /> : element.type === 'customArea' ? (
                      <CustomAreaGraphic
                        element={visualElement}
                        points={visualElement.customAreaPoints ?? []}
                        garmentMask={drawingMask ? drawingMaskCss(drawingMask, visualElement.width, visualElement.height, liveX, liveY, visualElement.rotation) : undefined}
                      />
                    ) : element.type === 'shape' ||
                    element.type === 'pattern' ||
                    (element.type === 'distress' && !element.content.startsWith('data:')) ? (
                      <div className={cn('h-full w-full', element.type !== 'shape' && 'overflow-hidden')}>
                        <StudioGraphic element={visualElement} />
                      </div>
                    ) : (
                    <div className="relative h-full w-full" style={{ filter: composeArtworkFilter(element) }}>
                    <FilteredImage
                      source={element.content}
                      settings={element.type === 'image' ? element.imageFilter : undefined}
                      alt={element.type === 'drawing' ? 'Drawing' : element.type === 'distress' ? 'Distress' : 'Artwork'}
                      className="h-full w-full object-fill"
                      style={{
                        ...artworkFlipStyle(element),
                        opacity: element.color ? 0 : undefined,
                      }}
                    />
                    {element.color && <div className="pointer-events-none absolute inset-0" style={{ background: paintCss(element.color), maskImage: `url("${element.content}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat', ...artworkFlipStyle(element) }} />}
                    </div>
                    )}
                  </>
                ) : isEditingText ? (
                  <textarea
                    ref={editAreaRef}
                    value={editDraft}
                    inputMode="text"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCorrect="off"
                    onChange={(ev) => {
                      const marker = (ev.nativeEvent as InputEvent).isComposing ? null : completeTextListInputMarker(
                        ev.target.value,
                        ev.target.selectionStart,
                      );
                      if (marker) {
                        editDraftRef.current = marker.content;
                        // Commit before moving the caret so rapid typing cannot race a deferred selection.
                        flushSync(() => setEditDraft(marker.content));
                        editAreaRef.current?.setSelectionRange(marker.caret, marker.caret);
                        return;
                      }
                      setEditDraft(ev.target.value);
                      editDraftRef.current = ev.target.value;
                    }}
                    onBlur={() => {
                      const draft = editDraftRef.current;
                      if (draft.trim().length === 0) {
                        removeElement(element.id);
                        setEditingTextId(null);
                        return;
                      }
                      const parsed = parseTextListInput(draft);
                      updateElement(element.id, {
                        content: parsed.content,
                        textListLineStyles: parsed.lineStyles,
                      });
                      setEditingTextId(null);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Escape') {
                        ev.preventDefault();
                        const original = formatTextListInput(element.content, element.textListLineStyles, element.textList ?? 'none');
                        setEditDraft(original);
                        editDraftRef.current = original;
                        setEditingTextId(null);
                      } else if (ev.key === 'Enter' && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                        const result = continueTextListInput(
                          ev.currentTarget.value,
                          ev.currentTarget.selectionStart,
                          ev.currentTarget.selectionEnd,
                        );
                        if (result) {
                          ev.preventDefault();
                          editDraftRef.current = result.content;
                          flushSync(() => setEditDraft(result.content));
                          editAreaRef.current?.setSelectionRange(result.caret, result.caret);
                        }
                      }
                      ev.stopPropagation();
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    rows={1}
                    className="pointer-events-auto z-40 block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-[3px] bg-transparent px-[3px] py-0 font-semibold caret-[#FF3B30] [overflow-wrap:anywhere] focus:outline-none focus:ring-0"
                    style={{
                      color: solidPaint(element.color),
                      fontFamily: element.fontFamily ?? 'Inter',
                      fontSize: editFontSize,
                      fontWeight: element.fontWeight === 'bold' ? 700 : element.fontWeight === 'normal' ? 400 : 600,
                      lineHeight: `${element.lineSpacing ?? 115}%`,
                      width: '100%',
                      maxWidth: '100%',
                      minHeight: element.autoHeight === false ? element.height : undefined,
                      textAlign: element.textAlign ?? 'center',
                      fontStyle: element.fontStyle ?? 'normal',
                      textTransform: element.textTransform ?? 'none',
                      writingMode: element.verticalText ? 'vertical-rl' : undefined,
                      textOrientation: element.verticalText ? 'upright' : undefined,
                      letterSpacing:
                        element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
                      outline: '1px solid rgba(255, 59, 48, 0.55)',
                      outlineOffset: '2px',
                    }}
                  />
                ) : (
                  <div className="relative w-full min-w-0 max-w-full">
                    <ImageFxDefs element={element} />
                    <TextArtwork
                      element={element}
                      fontSize={displayFont}
                      onDoubleClick={(ev) => {
                        if (!editable || locked) return;
                        ev.stopPropagation();
                        ev.preventDefault();
                        setSelectedId(element.id);
                        beginTextEditing(element);
                        setDraggingId(null);
                        textTapRef.current = null;
                      }}
                    />
                  </div>
                )}
                </DesignAssetSurface>
                {locked && editable ? (
                  <div className="pointer-events-none absolute -right-0.5 -top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[#CC2D24]/50 bg-black/80 text-[#CC2D24]">
                    <Lock className="h-2.5 w-2.5" />
                  </div>
                ) : null}
              </div>
            );
          })}
          </div>
            </div>
          </div>
        </div>
        </div>
      </div>

    </div>
  );
}

function NumberStepper({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/15 bg-white/5">
      <button
        onClick={onDecrease}
        className="flex h-9 w-9 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-[52px] text-center text-sm font-semibold text-white">{value}</div>
      <button
        onClick={onIncrease}
        className="flex h-9 w-9 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}