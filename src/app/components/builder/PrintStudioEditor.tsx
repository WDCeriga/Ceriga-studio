import {nativeArtworkSource} from '../../lib/nativeArtworkSource';
import {ARTWORK_UPLOAD_DRAG_MIME} from './printsStudio/studioAssets';
import {GroupPathOverlay} from './printsStudio/GroupPathOverlay';
import {ArtworkPlacementZones} from './printsStudio/ArtworkPlacementZones';
import {isEditableLogoGroup,logoPartAtPoint,splitEditableLogoLayers} from '../../lib/editableLogoLayers';
import {artworkClipStyle} from '../../lib/artworkClipping';
import {artworkImagePlacement} from '../../lib/artworkImagePlacement';
import * as ArtworkContextMenu from '@radix-ui/react-context-menu';
import {LogoTraceRegionOverlay} from './printsStudio/LogoTraceRegionOverlay';
import {ReferenceTraceOverlay} from './printsStudio/ReferenceTraceOverlay';
import {GlyphAdjustmentOverlay} from './printsStudio/GlyphAdjustmentOverlay';
import {fontIdentity} from '../../lib/workspaceFonts';
import {writeArtworkClipboard,readArtworkClipboard,pastedArtwork} from '../../lib/artworkClipboard';
import {loadFontLibrary} from './printsStudio/designLibrary';
import {toast} from 'sonner';
import {remapTextStyles,remapTextKerning} from '../../lib/richArtworkText';
import {outlineLettering} from '../../lib/editableLettering';
import {flattenBoolean} from '../../lib/booleanArtwork';
import {TextPlacementDraft} from './printsStudio/TextPlacementDraft';
import {TrackingDrag} from './printsStudio/TrackingDrag';
import {LiveCornerHandle} from './printsStudio/LiveCornerHandle';
import {joinOpenArtwork} from '../../lib/artworkPathCommands';
import {LiveShapeDraft} from './printsStudio/LiveShapeDraft';
import {resizeArtwork} from '../../lib/artworkResize';
import {duplicateStudioArtwork} from '../../lib/studioArtwork';
import {frameGesture} from '../../lib/frameGesture';
import {reversePenPath} from '../../lib/penGeometry';
import {ShapePencilDraft} from './printsStudio/ShapePencilDraft';
import {createPenArtwork} from '../../lib/penArtwork';
import {marqueeArtworkIds,selectionBox,type MarqueeBox} from '../../lib/artworkMarquee';
import {ArtworkDocumentContext} from './printsStudio/ArtworkDocumentContext';
import {mergeNativeLayers} from '../../lib/designGroups';
import {ArtworkPrintMethod} from './shell/ArtworkPrintMethod';
import {DrawingAdvancedEditor} from './shell/DrawingAdvancedEditor';
import {artworkViewBounds} from '../../lib/artworkViewBounds';
import {useGarmentArtworkCamera} from './printsStudio/useGarmentArtworkCamera';
import {CLOTHING_FONT_NAMES} from '../../lib/displayFonts';
import {artworkSceneScale} from '../../lib/garmentCanvasFrame';
import {garmentPatternReference} from '../../lib/patternGeometry';
import {textileInkEffect} from '../../lib/textileInk';
import {paintStainPath} from '../../lib/paintStains';
import {DrawingArtwork} from './printsStudio/DrawingArtwork';
import type {RecordedDrawing} from '../../lib/drawingReplay';
import type {DistressMark,DistressMarkKind} from '../../lib/distressScatter';
import {GarmentWearHostContext} from './printsStudio/GarmentWearAppearance';
import {GarmentPatternReliefContext,GarmentPrintTextureContext,useGarmentPrintTexture} from './printsStudio/GarmentPrintTexture';
import {orderDesignLayers,isBackgroundPattern} from '../../lib/designLayerOrdering';
import {PatternGraphic} from './printsStudio/PatternGraphic';
import {getActivePatternDrag} from './printsStudio/studioAssets';
import {ArtworkAlignmentGuides} from './printsStudio/ArtworkAlignmentGuides';
import { artworkResizeCursor, ARTWORK_ROTATE_CURSOR } from '../../lib/artworkCursors';
import {ShapeAdvancedEditor} from './shell/ShapeAdvancedEditor';
import { studioShapeDefaults } from '../../lib/studioShapePresets';
import { SliderValueInput } from './SliderValueInput';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ComponentProps } from 'react';
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
  measureArtworkBoundsInZone,
  type SnapBox,
  type SnapDragOptions,
} from '../../lib/designSnapGuides';
import {
  getListReorderRowOffsetY,
  listDragTargetIndexFromDelta,
  reorderDesignElements,
} from '../../lib/designLayerOrder';
import { StudioColorField } from './PrintStudioColorField';
import { STUDIO_TEXT_MAIN_COLORS, STUDIO_TEXT_POPULAR_COLORS } from '../../data/studioColorPresets';
import {
  completeTextListInputMarker,
  continueTextListInput,
  formatTextListInput,
  parseTextListInput,
  type TextListKind,
} from '../../lib/textListEditing';
import { InlineElementToolbar } from './PrintStudioElementToolbar';
import { FlipControls } from './printsStudio/FlipControls';
import { artworkFlipStyle } from '../../lib/artworkFlip';
import { canMergeLayer, mergeLayersIssue, flattenDesignLayers } from '../../lib/mergeDesignLayers';
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
import { ShapePathEditor } from './printsStudio/ShapePathEditor';
import { PenPathDraft } from './printsStudio/PenPathDraft';
import { ArtworkSelectionTools } from './printsStudio/ArtworkSelectionTools';
import { cutOrAddPenPath, fitPenPath, reframeEditedPath, shapeWorldPath } from '../../lib/artworkPathOperations';
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
  placementId?:string;
  artworkUnitsPerCm?:number;
  patternTileCm?:{width:number;height:number};
  patternSeamCheck?:{status:'pass'|'risk';message:string;sourceKey:string;checkedAt:string};
  artworkAppearance?:import('../../lib/textAppearance').TextAppearanceItem[];
  colourSlots?:import('../../lib/artworkColourSlots').ArtworkColourSlot[];
  artworkFinish?:import('../../lib/artworkPlacements').ArtworkFinish;
  sketchOnly?:boolean;
  imagePixels?:{width:number;height:number};

  textAppearance?:import('../../lib/textAppearance').TextAppearanceItem[];
  textHeightCm?:number;textCapHeightCm?:number;
  textEffectiveFontSize?:number;
  textLayoutHeight?:number;textLayoutWidth?:number;
  textPrintLimits?:{minCapMm:number;minStrokeMm:number;maxColours:number};
  textUnitsPerCm?:number;textStyleId?:string;textWordSpacing?:number;textSpacingDrag?:'letterSpacing'|'lineSpacing'|'textKerning'|'textWordSpacing';textKerningMode?:'metrics'|'optical';
  textShapeMode?:'none'|'arc'|'warp'|'path'|'badge'|'stack';textStackFit?:boolean;textStackGap?:number;
  textShapeSource?:Pick<DesignElement,'x'|'y'|'width'|'height'|'rotation'|'autoWidth'|'autoHeight'>;
  textBadge?:{top:string;bottom:string;centre:string;radius:number};
  id: string;
  fontId?:string;fontPostscriptName?:string;fontDisplayName?:string;fontAxes?:Record<string,number>;fontFeatures?:Record<string,boolean>;
  textGlyphTransforms?:Record<string,{x:number;y:number;rotation:number;scaleX:number;scaleY:number}>;
  vectorTextEffects?:{id:string;type:'arc'|'arch'|'bulge'|'flag'|'wave'|'rise'|'perspective';enabled:boolean;bend:number;horizontal:number;vertical:number}[];
  logoTrace?:import('../../lib/logoOutlineTypes').LogoTraceState;
  clipToArtworkId?:string;clipToArtworkIds?:string[];clipToRegionKey?:string;artworkClipPaths?:import('../../lib/shapeGeometry').ShapePath[];
  logoTraceRegion?:{key:string;colourKey:string;detached:boolean;visibilityOverride?:boolean};
  imageTrace?:import('../../lib/imageTracing').TraceState;
  tracingReference?:boolean;referenceHidden?:boolean;referenceUnitsPerCm?:number;
  letteringPaints?:{key:string;fill:string}[];
  letteringParts?: {key:string;label:string}[];
  booleanOperation?: 'join'|'subtract'|'intersect'|'exclude'|'divide';
  booleanSourceKey?:string;
  booleanStyleKey?:string;
  shapeFillReference?:string;
  shapeStrokeReference?:string;
  shapeFillRule?:'evenodd'|'nonzero';
  shapeStrokeCap?:'butt'|'round'|'square';
  shapeStrokeJoin?:'miter'|'round'|'bevel';
  shapeStrokeAlign?:'inside'|'center'|'outside';
  shapeOperationSources?: DesignElement[];
  shapeOperationFrame?: {x:number;y:number;width:number;height:number;rotation:number};
  layerName?: string;
  imageFilter?: ImageFilterSettings;
  textEffects?: TextEffect[];
  letteringSource?: DesignElement;
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
  wear?:{kind:DistressMarkKind;sourceWidth:number;sourceHeight:number;marks:DistressMark[]};
  drawing?:RecordedDrawing;
  /** Normalized vector cut-outs preserve the source while erasing. */
  eraseContours?:{x:number;y:number}[][];
  drawingOriginal?:RecordedDrawing;
  shapeBrush?:RecordedDrawing;
  drawingVectorSource?:{content:string;drawing?:RecordedDrawing;color?:string;layerName?:string};
  drawingSmoothness?:number;
  paintStain?:{style:string;seed:number;spread:number};
  shapeStrokeStyle?:'solid'|'dashed'|'dotted'|'double';
  shapeOutlineAccent?:string;
  wearRasterTinted?:boolean;
  wearDetail?:{roughness?:number;fray?:number;bend?:number;skew?:number;seed?:number};
  shapeCornerRadius?:number;
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
  textCharacterStyles?:{start:number;end:number;style:{fontId?:string;fontPostscriptName?:string;fontDisplayName?:string;color?:string;fontSize?:number;fontFamily?:string;fontWeight?:'normal'|'bold';fontStyle?:'normal'|'italic';letterSpacing?:number;baselineShift?:number}}[];
  textPath?:{path:ShapePath;offset:number;flip?:boolean};
  textScaleX?:number;textScaleY?:number;
  textBaselineShift?:number;
  textFrameMode?:'point'|'area';
  textKerningPairs?:{index:number;offset:number}[];
  textKerning?:number;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'title';
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
  /** Whole-garment fills without a single part target; free squares remain placed artwork. */
  patternCoverage?: 'garment';
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
  patternReferenceSize?: number;
  patternCount?: number;
  patternScale?: number;
  patternSpacing?: number;
  patternRotation?: number;
  patternThickness?: number;
  patternRandomise?: boolean;
  patternSeed?: number;
  patternOptions?: Record<string, number | string>;
  patternOffsetX?: number;
  patternOffsetY?: number;
  patternAlignment?: 'independent' | 'continuous';
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
  patternKeepNeckPlain?: boolean;
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

export type PrintStudioToolAPI = ComponentProps<typeof PrintsStudioToolbar> & {garmentPatterns?: DesignElement[];garmentImages?: DesignElement[];onSelectArtwork?:(id:string)=>void;onClearSelection?: () => void; onAddTextPreset?: (preset: Partial<DesignElement>) => void};
interface PrintsDesignStepProps {
  renderTools?: (api: PrintStudioToolAPI) => ReactNode;
  renderSelection?: (element: DesignElement, update: (patch: Partial<DesignElement>) => void, fonts: string[]) => ReactNode;
  elements: DesignElement[];
  /** Merge supplies selection atomically so Undo never restores a deleted selection. */
  onChange: (elements: DesignElement[], selectedLayerId?: string,options?:{transient?:boolean}) => void;
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
  canvasToolbar?: boolean;
  assetMode?: boolean;
  canvasSize?: PrintsCanvasSize;
  referenceWidthCm?:number;
  onCanvasSizeChange?: (size: PrintsCanvasSize) => void;
  garmentInteractive?: boolean;
  onArtworkSelect?: (id:string)=>void;
  garmentPreview: ReactNode | ((sceneScale: number) => ReactNode);
  elements: DesignElement[];
  onChange?: (elements: DesignElement[], selectedLayerId?: string,options?:{transient?:boolean}) => void;
  editable?: boolean;
  className?: string;
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
  /** Parent scale (e.g. live preview `previewZoom/100`); inverses for toolbar and handles. */
  liveCanvasScale?: number;
  /** Phone: when the config sheet is collapsed, pin the *text* formatting bar above the soft keyboard. */
  phoneConfigSheetCollapsed?: boolean;
  /** Isolate the complete design without selecting an object. */
  artworkView?: boolean;
  /** Which garment face is on screen. Artwork on the other face is hidden. */
  garmentSide?: 'front' | 'back';
}

const FONT_OPTIONS = [
  ...CLOTHING_FONT_NAMES,
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
  'Fabric Print',
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
  'Fabric Print': 'Print fabric before cutting and sewing',
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

const HANDLE_RED = '#262626';

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
  shapeChrome = false,
  hideBounds = false,
  rotation = 0,
  transformLabel,
}: {
  onRotatePointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent, h: ResizeHandle) => void;
  uiInverseScale?: number;
  comfortableTouch?: boolean;
  compactHandles?: boolean;
  phoneTextMinimal?: boolean;
  tight?: boolean;
  shapeChrome?: boolean;
  hideBounds?: boolean;
  rotation?: number;
  transformLabel?:string;
}) {
  const inv = !tight && uiInverseScale > 0 && Math.abs(uiInverseScale - 1) > 0.001 ? uiInverseScale : 1;
  const invStyle =
    inv === 1
      ? undefined
      : ({ transform: `scale(${inv})`, transformOrigin: '50% 50%' } as const);

  if(shapeChrome){const scale=uiInverseScale>0?uiInverseScale:1;return <div data-handles data-editor-chrome data-shape-transform className="shape-transform-guide pointer-events-none absolute inset-0 z-50">
    {!hideBounds&&<div className="shape-transform-bounds"/>}
    {(['nw','n','ne','e','se','s','sw','w'] as ResizeHandle[]).map(handle=>{const x=handle.includes('w')?0:handle.includes('e')?100:50,y=handle.includes('n')?0:handle.includes('s')?100:50;return <button key={handle} aria-label={`Resize ${handle.toUpperCase()}`} className="shape-transform-handle" style={{left:x+'%',top:y+'%',transform:`translate(-50%,-50%) scale(${scale})`,cursor:artworkResizeCursor(handle,rotation)}} onPointerDown={event=>{if(event.button===0)onResizePointerDown(event,handle);}}/>;})}
    {(['nw','ne','se','sw'] as const).map(corner=><button key={'rotate-'+corner} aria-label={`Rotate from ${corner.toUpperCase()} corner`} className="shape-corner-rotate" style={{left:corner.includes('w')?`${-16*scale}px`:`calc(100% + ${16*scale}px)`,top:corner.includes('n')?`${-16*scale}px`:`calc(100% + ${16*scale}px)`,transform:`translate(-50%,-50%) scale(${scale})`,cursor:ARTWORK_ROTATE_CURSOR}} onPointerDown={event=>{if(event.button===0)onRotatePointerDown(event);}}/>)}
    <span className="shape-transform-pivot" style={{transform:`translate(-50%,-50%) scale(${scale})`}}/>
    <span className="shape-rotation-stem" style={{height:10*scale}}/><button aria-label="Rotate" className="shape-rotation-handle" style={{top:`calc(100% + ${22*scale}px)`,transform:`translate(-50%,-50%) scale(${scale})`,cursor:ARTWORK_ROTATE_CURSOR}} onPointerDown={onRotatePointerDown}><RotateCw size={12}/></button>
    {transformLabel&&<span className="shape-transform-readout" style={{top:`calc(100% + ${43*scale}px)`,transform:`translateX(-50%) scale(${scale})`,transformOrigin:'top center'}}>{transformLabel}</span>}
  </div>;}


  if (phoneTextMinimal) {
    return (
      <div
        data-handles
        className="pointer-events-none absolute inset-0 z-50"
        style={invStyle}
      >
        <div
          className="pointer-events-none absolute rounded-md border-2 bg-gradient-to-b from-[#262626]/10 to-transparent"
          style={{ borderColor: `${HANDLE_RED}cc`, inset: tight ? 0 : '-1px', borderRadius: tight ? 0 : undefined }}
        />
        <button
          type="button"
          aria-label="Scale from corner"
          className="pointer-events-auto absolute -left-1.5 -top-1.5 z-[60] h-3 w-3 touch-none rounded-full before:absolute before:inset-0.5 before:rounded-full before:border before:border-zinc-300/95 before:bg-white before:shadow-sm active:scale-95"
          style={{cursor:artworkResizeCursor('nw',rotation)}}
          onPointerDown={(e) => onResizePointerDown(e, 'nw')}
        />
        <button
          type="button"
          aria-label="Stretch width"
          className="pointer-events-auto absolute -right-1 top-1/2 z-[60] h-7 w-2 -translate-y-1/2 touch-none rounded-full border-2 border-zinc-300/95 bg-white shadow-sm active:scale-95"
          style={{cursor:artworkResizeCursor('e',rotation)}}
          onPointerDown={(e) => onResizePointerDown(e, 'e')}
        />
      </div>
    );
  }

  const large = comfortableTouch && !compactHandles;
  const dot = cn(
    /** `pointer-events-auto`: parent `data-handles` uses `pointer-events-none` so handles stay above the inline toolbar without stealing clicks from the pill. */
    'pointer-events-auto absolute z-[60] flex touch-none items-center justify-center rounded-full before:absolute before:rounded-full before:border before:border-[#262626] before:bg-white active:scale-95',
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
          'pointer-events-none absolute rounded-2xl border bg-gradient-to-b from-[#262626]/12 to-transparent',
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
        style={{...dotStyle,cursor:artworkResizeCursor('nw',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('ne',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('sw',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('se',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('e',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('w',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('n',rotation)}}
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
        style={{...dotStyle,cursor:artworkResizeCursor('s',rotation)}}
        onPointerDown={(e) => onResizePointerDown(e, 's')}
      />
      <button
        type="button"
        aria-label="Rotate"
        className={cn(
          'pointer-events-auto absolute left-1/2 z-[60] flex -translate-x-1/2 touch-none items-center justify-center rounded-full border-2 bg-white text-[#262626] shadow-lg active:scale-95',
          off.rot,
        )}
        style={{ borderColor: HANDLE_RED,cursor:ARTWORK_ROTATE_CURSOR }}
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
    <div data-print-panel={title.startsWith("Layers") ? "layers" : "properties"} className={cn('print-property-section', className)}>
      <div className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#737373]">
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">{label}</span>
        <div className="flex items-center gap-2">
          <SliderValueInput label={label} value={value} onChange={onChange} min={min} max={max} step={step} unit={suffix}/>
          {onReset && <button type="button" aria-label={`Reset ${label}`} title={`Reset ${label}`}
            onClick={onReset} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#737373] hover:bg-[#f2f2f2] hover:text-[#262626]">
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
        className="h-2 w-full cursor-pointer accent-[#262626] disabled:opacity-40"
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
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
        {label}
      </span>
      <div
        className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-2.5 transition-colors focus-within:border-[#262626]/55 focus-within:bg-[#fafafa]"
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
          className="min-w-0 flex-1 bg-transparent text-left text-[11px] font-semibold tabular-nums text-[#262626] outline-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-[9px] font-medium tabular-nums leading-none text-[#737373]">
          {suffix}
        </span>
      </div>
    </label>
  );
}

export function PrintsDesignStep({
  renderTools, renderSelection,
  elements,
  onChange,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
  usePhoneStrips = false,
  garmentSide = 'front',
}: PrintsDesignStepProps) {
  const [advancedSelectionOpen,setAdvancedSelectionOpen]=useState(!renderSelection);
  const assetWorkspace = useAssetWorkspaceContext();
  const assetMode = Boolean(assetWorkspace?.project);
  const [fallbackSelectedId, setFallbackSelectedId] = useState<string | null>(null);
  const selectionControlled = onSelectedLayerIdChange !== undefined;
  const selectedId = selectionControlled ? (selectedLayerIdProp ?? null) : fallbackSelectedId;
  useLayoutEffect(()=>setAdvancedSelectionOpen(!renderSelection),[selectedId]);
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
  const mergeIds = studio.selectionIds, setMergeIds = studio.setSelectionIds;
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
    const snapshot = elements;
    const side = garmentSide;
    setMerging(true); setMergeError(null);
    studio.setTool('select'); studio.setCropEditingId(null);
    studio.setWarpEditingId(null); studio.setDistortEditingId(null);
    try {
      if (elementsRef.current !== snapshot || activeSideRef.current !== side) throw new Error('The design changed during merging. Select the layers and try again.');
      const id = `merged-${crypto.randomUUID()}`;
      onChangeRef.current(mergeNativeLayers(snapshot, mergeIds, id), id);
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
    if (studio.panel === 'patterns' && (current?.type === 'pattern' || current?.type==='shape' || current?.type==='text' || current?.customAreaPattern)) return;
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
      reader.onload = async (event) => {
        const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
        const zone = document.querySelector('[data-print-design-zone]') as HTMLElement | null;
        let ix = 155;
        let iy = 165;
        if (zone && zone.clientWidth > 0 && zone.clientHeight > 0) {
          ix = zone.clientWidth / 2;
          iy = zone.clientHeight / 2;
        }
        const source=event.target?.result as string;
        let placement;try{placement=await artworkImagePlacement(source,assetMode?{width:assetWorkspace!.project!.width,height:assetWorkspace!.project!.height}:{width:narrow?96:130,height:narrow?96:130},assetMode)}catch{toast.error('This image could not be opened. Try another image file.');return;}
        const next: DesignElement = {
          id: `${Date.now()}`,
          type: 'image',
          content: event.target?.result as string,
          x: ix,
          y: iy,
          width: placement.width,
          height: placement.height,
          imagePixels:placement.imagePixels,
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
  useEffect(()=>{studio.imageUploader.current=handleUploadImage;return()=>{if(studio.imageUploader.current===handleUploadImage)studio.imageUploader.current=null;};},[handleUploadImage,studio.imageUploader]);


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
      autoWidth: true,textFrameMode:'point',
      rotation: 0,
      fontSize: narrow ? 22 : 30,
      fontFamily: 'Inter',
      color: studio.color,
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

  const addTextPreset = (preset: Partial<DesignElement>) => {
    const zone=document.querySelector('[data-print-design-zone]') as HTMLElement|null;
    const element:DesignElement={id:crypto.randomUUID(),type:'text',content:preset.content??'Your brand',x:(zone?.clientWidth??720)/2,y:(zone?.clientHeight??616)/2,width:300,height:70,rotation:0,color:studio.color,fontFamily:'Inter',fontSize:30,textAlign:'center',autoWidth:true,autoHeight:true,textFrameMode:'point',opacity:100,printMethod:DEFAULT_PRINT_METHOD,side:garmentSide,...preset};
    onChange([...elements,element],element.id);setSelectedId(element.id);studio.setTool('select');
  };
  const capturePatternLayer = async (id: string): Promise<CustomPatternSource> => {
    const ids=id==='@selection'?new Set(studio.selectionIds.length?studio.selectionIds:selectedId?[selectedId]:[]):new Set([id]),sources=elements.filter(element=>ids.has(element.id)&&canMergeLayer(element));
    if(!sources.length)throw new Error('Select visible, unlocked artwork first.');const snapshot=elements,side=garmentSide;
    studio.setTool('select');studio.setCropEditingId(null);studio.setWarpEditingId(null);studio.setDistortEditingId(null);
    const source=await nativeArtworkSource(sources,sources.length===1?sources[0].layerName??sources[0].type:'Artwork selection');
    if(elementsRef.current!==snapshot||activeSideRef.current!==side)throw new Error('The artwork changed. Prepare the repeat source again.');return source;
  };

  const placeStudioAsset = (kind: StudioAssetKind, id: string, settings?: PatternPatch) => {
    studio.setPathEditingId(null);
    if(kind==='shape'&&['rect','ellipse','polygon','star','line'].includes(id)){studio.setLiveShape(id as 'rect'|'ellipse'|'polygon'|'star'|'line');studio.setPanel('shapes');studio.setPathEditingId(null);setSelectedId(null);studio.setTool('shapeLive');return;}
    if (kind === 'shape' && id === 'custom-polygon') {
      studio.setPenTargetId(null); studio.setSelectionIds([]);
      setSelectedId(null);
      studio.setCropEditingId(null); studio.setWarpEditingId(null); studio.setDistortEditingId(null);
      studio.setTool('shapePolygon');
      return;
    }
    if(kind==='pattern' && selected && ['shape','text'].includes(selected.type) && !selected.locked && id!=='custom') {
      const key=selected.type==='text'?'textEffects':'shapeEffects';
      const fill=textileInkEffect(id,settings?.patternColors??[studio.color,'#f1eee2','#a94747','#344357'],4);
      updateSelected({...(selected.type==='shape'?{shapeFilled:true}:{}),[key]:[fill,...(selected[key]??[]).filter(e=>e.id!=='textile-ink')]});return;
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
      borderWidth: 0,
      ...(kind === 'shape' ? {...studioShapeDefaults(id),borderWidth:2,shapeStrokeColor:'#000000',shapeFilled:false} : {}),
      ...(kind==='shape'&&id==='paint-stain'?{shapeGeometry:'bounds' as const,shapeFilled:true,shapeFillColor:studio.color,shapePath:paintStainPath(),paintStain:{style:'splash',seed:37,spread:65},width:110,height:110}:{}),
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

  const reuseUpload = async (item: SavedUpload) => {
    const zone = document.querySelector('[data-print-design-zone]') as HTMLElement | null;
    let placement;try{placement=await artworkImagePlacement(item.dataUrl,assetMode?{width:assetWorkspace!.project!.width,height:assetWorkspace!.project!.height}:{width:130,height:130},assetMode)}catch{toast.error('This saved image could not be opened. Upload the file again.');return;}
    const next: DesignElement = {
      id: `${Date.now()}`,
      type: 'image',
      content: item.dataUrl,
      x: zone && zone.clientWidth ? zone.clientWidth / 2 : 155,
      y: zone && zone.clientHeight ? zone.clientHeight / 2 : 165,
      width: placement.width,
      height: placement.height,
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

  const importFontFile = (rightsAccepted=false) => {
    if(!rightsAccepted){toast.error('Confirm font usage rights in Typography before importing.');return;}
    const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.woff,.woff2,.ttf,.otf';
    input.onchange=async()=>{for(const file of Array.from(input.files??[])){const progress=toast.loading(`Adding ${file.name}…`);try{const family=await saveFontToLibrary(file,true);if(!family)throw new Error('Font could not be imported.');setImportedFontFamilies(prev=>[...new Set([...prev,family])]);if(selectedId&&elements.find(x=>x.id===selectedId)?.type==='text')updateSelected({fontFamily:family,...fontIdentity(family)});toast.success(`Added ${file.name}`,{id:progress});}catch(error){toast.error(error instanceof Error?error.message:'Font import failed.',{id:progress});}}};input.click();
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
    <ArtworkDocumentContext.Provider value={{elements,onChange,onSelect:setSelectedId,side:garmentSide}}><div className="print-imported-editor space-y-3.5">
      <div data-pen-controls-host />
      <div data-print-panel="library">{renderTools ? renderTools({garmentPatterns:sideElements.filter(element=>element.type==='pattern'),garmentImages:sideElements.filter(element=>element.type==='image'),onSelectArtwork:setSelectedId,onPlaceAsset:placeStudioAsset,onUpload:handleUploadImage,previousUploads,onReuseUpload:reuseUpload,textInput,onTextInput:setTextInput,onAddText:handleAddText,onAddTextPreset:addTextPreset,onClearSelection:()=>setSelectedId(null),onImportFont:importFontFile,fontLibrary:importedFontFamilies,selectedElement:selected,onUpdateSelected:updateSelected,onStartCustomArea:startCustomArea,patternDocumentKey:`${assetWorkspace?.project?.id ?? 'garment'}:${garmentSide}`,patternLayers:[...(studio.selectionIds.length>1?[{id:'@selection',name:`Selected artwork (${studio.selectionIds.length})`}]:[]),...sideElements.filter(element=>canMergeLayer(element)&&element.type!=='pattern').map(element=>({id:element.id,name:element.layerName??element.type}))],onCapturePatternLayer:capturePatternLayer}) : <PrintsStudioToolbar
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
      />}</div>

      {selected ? (
        <div data-print-selection-content>{renderSelection?.(selected, updateSelected, allFontOptions)}{!(renderSelection&&(selected.type==='text'||selected.type==='image'||selected.type==='pattern'||selected.logoTrace))&&<details className="studio-deep-controls" open={advancedSelectionOpen} onToggle={event=>{if(event.currentTarget.open!==advancedSelectionOpen)setAdvancedSelectionOpen(event.currentTarget.open)}}><summary><span>{selected.type==='text'?'Effects & reshape':selected.type==='image'?'Image adjustments':selected.type==='shape'||selected.type==='customArea'?'Effects & reshape':'Effects & advanced editing'}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6"/></svg></summary>{advancedSelectionOpen&&(renderSelection&&selected.type==='drawing'?<DrawingAdvancedEditor element={selected} update={updateSelected}/>:renderSelection&&(selected.type==='text'||selected.type==='shape'||selected.type==='customArea')?<ShapeAdvancedEditor element={selected} update={updateSelected} assetMode={assetMode} images={[...elements.filter(item=>item.type==='image').map(item=>({name:item.layerName??'Uploaded image',src:item.content})),...previousUploads.map(item=>({name:item.name,src:item.dataUrl})),...(assetWorkspace?.library??[]).map(item=>({name:item.name,src:item.preview}))]}/>:<PrintPanel title="Selected element">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#737373]">
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
              className="h-8 border-[#e2e2e2] px-2.5 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>

          <div className="print-object-properties space-y-5">
            <label className="block space-y-2 text-[10px] font-medium uppercase tracking-wider text-[#737373]">
              Layer name
              <Input aria-label="Layer name" maxLength={120} value={selected.layerName ?? ''} placeholder={selected.type === 'text' ? selected.content : selected.type} onChange={event => updateSelected({ layerName: event.target.value || undefined })} />
            </label>
            {selected.type === 'shape' && <>
              <ShapePropertiesPanel element={selected} onChange={updateSelected} />
              <div className="space-y-2 rounded-xl border border-[#e2e2e2] p-3">
                <Button type="button" disabled={selected.locked} aria-pressed={studio.pathEditingId === selected.id}
                  onClick={() => {
                    if (studio.pathEditingId === selected.id) { studio.setPathEditingId(null); return; }
                    if(selected.booleanOperation)return;
                    studio.setTool('select'); studio.setCropEditingId(null); studio.setWarpEditingId(null); studio.setDistortEditingId(null);
                    studio.setPathEditingId(selected.id);
                  }} className="h-8 text-[10px]">
                  {studio.pathEditingId === selected.id ? 'Done Editing Path' : selected.shapePath ? 'Edit Path' : 'Convert to Editable Path'}
                </Button>
                <p className="text-[10px] text-[#737373]">Shift-click anchors to select several. Drag anchors or curve handles. Double-click a segment to add a point. Delete removes selected points. Escape exits.</p>
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
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">Solid fill</span>
                  <Button type="button" variant="outline" size="sm" aria-label="Solid fill"
                    aria-pressed={selected.shapeFilled ?? false} disabled={selected.locked}
                    onClick={() => updateSelected({ shapeFilled: !selected.shapeFilled })}
                    className="h-7 border-[#e2e2e2] px-2 text-[9px] !text-[#262626] hover:bg-[#f2f2f2]">
                    {selected.shapeFilled ? 'On' : 'Off'}
                  </Button>
                </div>
                <p className="text-[10px] text-[#737373]">Fill the inside using the shape colour.</p>
              </div>
            ) : null}
            {selected.type === 'customArea' ? (
              <div className="space-y-3 rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
                <Label className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                  Custom Area Properties
                </Label>
                <Input aria-label="Custom Area name" value={selected.customAreaName ?? 'Custom Area'}
                  onChange={(event) => updateSelected({ customAreaName: event.target.value })}
                  className="h-9 border-[#e2e2e2] bg-[#fafafa] text-[11px] text-[#262626]" />
                <div>
                  <Label className="mb-2 block text-[9px] font-semibold uppercase tracking-wide text-[#737373]">Fill</Label>
                  <StudioColorField allowGradients value={selected.color ?? '#E53935'}
                    onChange={(color) => updateSelected({ color, customAreaPattern: undefined, customAreaImage: undefined, customAreaTexture: undefined })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS} popularColors={STUDIO_TEXT_POPULAR_COLORS}
                    mainLabel="Area fill" popularLabel="Quick colours" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-[#737373]" htmlFor="custom-area-pattern">Pattern fill</label>
                  <select id="custom-area-pattern" aria-label="Custom Area pattern"
                    value={selected.customAreaPattern ?? 'none'}
                    onChange={(event) => { updateSelected(event.target.value === 'none' ? { customAreaPattern: undefined } : changePatternType(selected, event.target.value)); if (event.target.value === 'custom') studio.setPanel('patterns'); }}
                    className="h-9 w-full rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-2 text-[11px] text-[#262626]">
                    <option value="none">None</option>{PATTERN_CATALOG.map(pattern => <option key={pattern.id} value={pattern.id}>{pattern.label}</option>)}
                  </select>
                </div>
                <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#e2e2e2] bg-[#fafafa] text-[10px] font-semibold text-[#737373] hover:text-[#262626]">
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
                {selected.customAreaImage ? <button type="button" onClick={() => updateSelected({ customAreaImage: undefined })} className="text-[10px] text-[#737373] hover:text-[#262626]">Remove image fill</button> : null}
                <CustomAreaPathControls element={selected} onChange={updateSelected} />
                <fieldset disabled={selected.locked}><CustomAreaAppearanceControls element={selected} onChange={updateSelected} /></fieldset>
                <SliderField label="Grain" value={selected.filterGrain ?? 0} min={0} max={100} suffix="%"
                  onChange={(value) => updateSelected({ filterGrain: value })} />
                <SliderField label="Texture" value={selected.filterNoise ?? 0} min={0} max={100} suffix="%"
                  onChange={(value) => updateSelected({ filterNoise: value })} />
              </div>
            ) : null}
            <details className="print-transform-details"><summary>Transform & warp</summary>            <div data-distortion-settings>
              <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                Transform
              </Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" title="Distort" aria-label="Distort"
                  aria-pressed={studio.distortEditingId === selected.id} disabled={selected.locked === true}
                  className={cn('h-8 border-[#e2e2e2] px-2.5 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]', studio.distortEditingId === selected.id && 'border-[#262626] bg-[#262626]/12')}
                  onClick={() => { studio.setTool('select'); studio.setWarpEditingId(null); studio.setDistortEditingId(studio.distortEditingId === selected.id ? null : selected.id); }}>
                  <Scan className="mr-1 h-3 w-3" />
                  Distort
                </Button>
                <Button type="button" variant="outline" title="Reset perspective" aria-label="Reset perspective"
                  disabled={selected.locked === true || !selected.perspective}
                  className="h-8 border-[#e2e2e2] px-2.5 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
                  onClick={() => { studio.setDistortEditingId(null); updateSelected({ perspective: undefined }); }}>
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Reset
                </Button>
                <Button type="button" variant="outline" title="Warp" aria-label="Warp"
                  aria-pressed={studio.warpEditingId === selected.id} disabled={selected.locked === true}
                  className={cn('h-8 border-[#e2e2e2] px-2.5 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]', studio.warpEditingId === selected.id && 'border-[#262626] bg-[#262626]/12')}
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
              return <div className="space-y-3 rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3" data-warp-properties>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">Warp</Label>
                  <Button type="button" variant="outline" size="sm" aria-label="Reset Warp"
                    className="h-7 border-[#e2e2e2] px-2 text-[9px] !text-[#262626] hover:bg-[#f2f2f2]"
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
                    className={cn('h-9 rounded-lg border text-[10px] font-semibold', settings.mode === mode ? 'border-[#262626] bg-[#262626]/15 text-[#262626]' : 'border-[#e2e2e2] bg-[#fafafa] text-[#737373]')}>
                    {mode === 'preset' ? 'Preset Warp' : 'Freeform'}
                  </button>)}
                </div>
                {settings.mode === 'preset' ? <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WARP_PRESETS.map((preset) => <button key={preset.id} type="button"
                      aria-pressed={settings.preset === preset.id} onClick={() => updateWarp({ preset: preset.id, bend: settings.bend === 0 ? 50 : settings.bend })}
                      className={cn('h-8 rounded-lg border px-2 text-[10px] font-medium', settings.preset === preset.id ? 'border-[#262626] bg-[#262626]/15 text-[#262626]' : 'border-[#e2e2e2] bg-[#fafafa] text-[#737373]')}>
                      {preset.label}
                    </button>)}
                  </div>
                  <SliderField label="Bend" value={settings.bend} min={-100} max={100} suffix="%" onChange={(bend) => updateWarp({ bend })} />
                  <SliderField label="Horizontal Distortion" value={settings.horizontalDistortion} min={-100} max={100} suffix="%" onChange={(horizontalDistortion) => updateWarp({ horizontalDistortion })} />
                  <SliderField label="Vertical Distortion" value={settings.verticalDistortion} min={-100} max={100} suffix="%" onChange={(verticalDistortion) => updateWarp({ verticalDistortion })} />
                </> : <>
                  <div className="space-y-1">
                    <label htmlFor="warp-grid-density" className="text-[9px] font-semibold uppercase tracking-wide text-[#737373]">Warp grid</label>
                    <select id="warp-grid-density" aria-label="Warp grid density" value={settings.gridSize}
                      onChange={(event) => {
                        const gridSize = Number(event.target.value) as 2 | 3 | 4;
                        updateWarp({ gridSize, points: resizeWarpGrid(settings, gridSize) });
                      }}
                      className="h-9 w-full rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-2 text-[11px] text-[#262626]">
                      <option value={2}>2 × 2</option><option value={3}>3 × 3</option><option value={4}>4 × 4</option>
                    </select>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[#737373]">Drag the mesh points on the design to reshape it.</p>
                </>}
              </div>;
            })() : null}
</details>
            {!renderSelection && !assetMode && selected.type !== 'distress' ? (
              <ArtworkPrintMethod element={selected} update={updateSelected}/>
            ) : null}

            {selected.type === 'text' && (
              <div className="print-text-properties flex flex-col gap-4">
                <label className="print-text-content">Text<textarea aria-label="Edit text content" value={selected.content} onChange={event=>updateSelected({content:event.target.value})} rows={3}/></label>
                <div className="order-1"><label className="print-font-label">Font<select aria-label="Text font" value={selected.fontFamily ?? 'Inter'} onChange={event=>updateSelected({fontFamily:event.target.value})}>{allFontOptions.map(font=><option key={font} value={font}>{font}</option>)}</select></label></div>
                <div className="order-4">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
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
                          'flex h-9 min-w-[2.5rem] flex-1 items-center justify-center rounded-xl border text-[#737373] transition-colors',
                          (selected.textAlign ?? 'center') === align
                            ? 'border-[#262626] bg-[#262626]/15 text-[#262626]'
                            : 'border-[#e2e2e2] bg-[#fafafa] hover:border-[#e2e2e2] hover:text-[#262626]',
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
                        'h-9 rounded-lg border px-1.5 text-[10px] font-semibold text-[#737373]',
                        active ? 'border-[#262626] bg-[#262626]/15 text-[#262626]' : 'border-[#e2e2e2] bg-[#fafafa]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="order-9">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
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
                          'min-h-9 rounded-lg border px-1 text-[9px] font-medium text-[#737373]',
                          (selected.textFillMode ?? ((selected.borderWidth ?? 0) > 0 ? 'fill-outline' : 'filled')) === value
                            ? 'border-[#262626] bg-[#262626]/15 text-[#262626]'
                            : 'border-[#e2e2e2] bg-[#fafafa]',
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
                        <span className="mb-2 block text-[9px] uppercase tracking-wider text-[#737373]">Outline colour</span>
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
                      selected.verticalText ? 'border-[#262626] bg-[#262626]/15 text-[#262626]' : 'border-[#e2e2e2] bg-[#fafafa] text-[#737373]',
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
                          active ? 'border-[#262626] bg-[#262626]/15 text-[#262626]' : 'border-[#e2e2e2] bg-[#fafafa] text-[#737373]',
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

                <div className="order-last space-y-3 rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
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
                    className="h-2 w-full cursor-pointer accent-[#262626]"
                  />
                  <label className="flex flex-col gap-1 text-[9px] uppercase text-[#737373]">
                    Curve shape
                    <select
                      value={selected.textCurveShape ?? 'arc'}
                      onChange={event => updateCurve({
                        textCurveShape: event.target.value as 'arc' | 'circle',
                        ...(event.target.value === 'circle' ? { textCurveAmount: 100 } : {}),
                      })}
                      className="h-8 rounded-lg border border-[#e2e2e2] bg-white px-2 text-[10px] normal-case text-[#262626]"
                    >
                      <option value="arc">Arc</option>
                      <option value="circle">Circle</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-[#737373]">
                      Direction
                      <select
                        value={selected.textCurveDirection ?? 'up'}
                        onChange={event => updateSelected({ textCurveDirection: event.target.value as 'up' | 'down' })}
                        className="h-8 rounded-lg border border-[#e2e2e2] bg-white px-2 text-[10px] normal-case text-[#262626]"
                      >
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[9px] uppercase text-[#737373]">
                      Curve side
                      <select
                        value={selected.textCurveSide ?? 'outside'}
                        onChange={event => updateSelected({ textCurveSide: event.target.value as 'inside' | 'outside' })}
                        className="h-8 rounded-lg border border-[#e2e2e2] bg-white px-2 text-[10px] normal-case text-[#262626]"
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
                      'h-9 flex-1 border-[#e2e2e2] bg-[#f2f2f2] px-2 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]',
                      selected.fontStyle === 'italic' && 'border-[#262626] bg-[#262626]/12',
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
                    className="h-9 flex-1 border-[#e2e2e2] bg-[#f2f2f2] px-2 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
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
                    <Label className="mb-0 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                      Letter spacing
                    </Label>
                    <span className="text-[10px] tabular-nums text-[#737373]">
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
                    className="h-2 w-full cursor-pointer accent-[#262626]"
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

                <div className="order-10 space-y-3 rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
                  <div>
                    <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                      Line position
                    </Label>
                    <select
                      value={selected.textLinePosition ?? 'none'}
                      onChange={event => updateSelected({ textLinePosition: event.target.value as NonNullable<DesignElement['textLinePosition']> })}
                      className="h-9 w-full rounded-lg border border-[#e2e2e2] bg-white px-2 text-[10px] text-[#262626]"
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
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                    Font size
                  </Label>
                  <NumberStepper
                    value={selected.fontSize ?? 30}
                    onDecrease={() => updateFontSize(-1)}
                    onIncrease={() => updateFontSize(1)}
                  />
                </div>

                <div className="order-3">
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                    Text colour
                  </Label>
                  <StudioColorField allowGradients
                    value={selected.color ?? '#FFFFFF'}
                    onChange={(h) => updateSelected({ color: h })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                  />
                </div>

                <div className="order-8 space-y-3 rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">Text shadow</span>
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
                      className="h-7 border-[#e2e2e2] px-2 text-[9px] !text-[#262626] hover:bg-[#f2f2f2]"
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
                  <label className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-[#737373]">
                    Edge
                    <select
                      value={selected.shadowEdge ?? 'sharp'}
                      onChange={event => updateSelected({ shadowEdge: event.target.value as 'sharp' | 'round' })}
                      className="h-8 rounded-lg border border-[#e2e2e2] bg-white px-2 text-[10px] normal-case text-[#262626]"
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
              <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                Rotation
              </Label>
              <div className="rounded-xl border border-[#e2e2e2] bg-[#fafafa] px-3 py-3">
                <div className="mb-2 flex justify-between text-[10px] tabular-nums text-[#737373]">
                  <span>0°</span>
                  <span className="font-semibold text-[#737373]">{rotNorm}°</span>
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
              <div className="space-y-3 border-y border-[#e2e2e2] py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">Image adjustments</span>
                  <button type="button" onClick={() => updateSelected({ ...DEFAULT_IMAGE_ADJUSTMENTS })}
                    className="flex h-8 shrink-0 items-center gap-1 text-[10px] text-[#737373] hover:text-[#262626]">
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
            <div className="rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">Border</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateSelected({
                    borderWidth: (selected.borderWidth ?? 0) > 0 ? 0 : 2,
                    borderColor: selected.borderColor ?? '#FFFFFF',
                  })}
                  className="h-7 border-[#e2e2e2] px-2 text-[9px] !text-[#262626] hover:bg-[#f2f2f2]"
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
                <span className="mb-2 block text-[9px] uppercase tracking-wider text-[#737373]">Colour</span>
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

            {!selected.patternTarget ? <div className="rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">
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
                      ? 'border-[#262626]/60 bg-[#262626]/15 text-[#262626]'
                      : 'border-[#e2e2e2] bg-[#fafafa] text-[#737373] hover:text-[#262626]',
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
            </div> : <p className="text-[10px] text-[#737373]">This fill follows its garment section. Use the Patterns controls to change the repeat without moving its boundary.</p>}

            {selected.type === 'image' ? (
              <div className="rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">
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
                    className="h-7 border-[#e2e2e2] px-2 text-[9px] !text-[#262626] hover:bg-[#f2f2f2]"
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
                  <span className="mb-2 block text-[9px] uppercase tracking-wider text-[#737373]">
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
                className="h-9 border-[#e2e2e2] px-2 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
              >
                <Copy className="mr-1.5 h-3 w-3" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                onClick={() => layer('front')}
                className="h-9 border-[#e2e2e2] px-2 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
              >
                <BringToFront className="mr-1.5 h-3 w-3" />
                Top
              </Button>
              <Button
                variant="outline"
                onClick={() => layer('back')}
                className="h-9 border-[#e2e2e2] px-2 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
              >
                <SendToBack className="mr-1.5 h-3 w-3" />
                Bottom
              </Button>
              <Button
                variant="outline"
                onClick={() => updateSelected({ locked: !selected.locked })}
                className="col-span-2 h-9 border-[#e2e2e2] px-2 text-[10px] !text-[#262626] hover:bg-[#f2f2f2]"
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
              <div className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#e2e2e2] bg-[#fafafa] px-3 py-2.5 text-[10px] text-[#737373]">
                <Move className="h-3.5 w-3.5 shrink-0 text-[#737373]" />
                Drag to move · corners scale · sides stretch · double-click text to edit
              </div>
            </div>
          </div>
        </PrintPanel>)}</details>}</div>
      ) : null}

      {!renderTools&&<PrintPanel title={`Layers (${sideElements.length})`}>
        <details className="print-layer-actions" open={mergeIds.length > 1}><summary>Group & merge layers</summary>        <div className="mb-3 space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(groupIssue) || merging} onClick={groupSelectedLayers} title={groupIssue ?? 'Group editable children to move, resize, rotate or warp together'}>Group</Button>
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(ungroupIssue) || merging} onClick={ungroupSelectedLayer} title={ungroupIssue ?? 'Restore children without flattening artwork'}>Ungroup</Button>
          </div>
          <p className="text-[10px] text-[#737373]">Check layers or Shift-click their names, then Group to transform together. Grouping retains editable sources.</p>
          {mergeIds.length > 1 && groupIssue ? <p className="text-[10px] text-[#737373]">{groupIssue}</p> : null}
          {selected?.type === 'group' ? <div className="space-y-2 rounded border border-[#e2e2e2] p-2">
            <p className="text-[10px] text-[#737373]">{ungroupIssue ?? 'Resized, flipped, cropped, distorted or warped children retain editable transform envelopes when ungrouped.'}</p>
            {(selected.children ?? []).map((child, index) => <label key={child.id} className="block text-[10px] text-[#737373]">
              Source {index + 1}: {child.layerName ?? child.type}
              {child.type === 'text' ? <Input disabled={Boolean(selected.locked || child.locked)} aria-label={`Edit group source ${index + 1} text`} value={child.content} onChange={event => updateSelected({ children: selected.children!.map(item => item.id === child.id ? { ...item, content: event.target.value } : item) })} /> : null}
              {child.color !== undefined ? <Input disabled={Boolean(selected.locked || child.locked)} aria-label={`Edit group source ${index + 1} color`} value={child.color} onChange={event => updateSelected({ children: selected.children!.map(item => item.id === child.id ? { ...item, color: event.target.value } : item) })} /> : null}
            </label>)}
          </div> : null}
          <Button type="button" variant="outline" className="w-full" disabled={Boolean(mergeIssue) || merging}
            onClick={() => void mergeSelectedLayers()} title={mergeIssue ?? 'Combine selected layers while preserving vector sources'}>
            {merging ? 'Merging…' : 'Merge Layers'}{mergeIds.length > 0 ? ` (${mergeIds.length})` : ''}
          </Button>
          <p className="text-[10px] text-[#737373]">{mergeIssue ?? 'Appearance is flattened; Undo restores the original layers.'}</p>
          {mergeError ? <p role="alert" className="text-xs text-red-400">{mergeError}</p> : null}
        </div>
        </details>
        <div className={cn('space-y-2', listDraggingId && 'list-reorder-active')}>
          {sideElements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#e2e2e2] px-3 py-4 text-center text-[11px] leading-relaxed text-[#737373]">
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
                      ? 'drag-list-floating border-[#e2e2e2]'
                      : selectedId === element.id
                        ? 'border-[#262626] bg-[#262626]/10'
                        : 'border-[#e2e2e2] bg-[#fafafa] hover:border-[#e2e2e2]',
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
                    className="flex shrink-0 cursor-grab touch-none select-none items-center rounded-l-[8px] px-1 text-[#737373] hover:bg-[#f2f2f2] hover:text-[#737373] active:cursor-grabbing"
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
                    <div className="print-layer-thumbnail">
                      {element.type === 'image' || (element.type === 'drawing' && element.content.startsWith('data:')) ? <img src={element.content} alt=""/> : element.type === 'text' ? <span style={{fontFamily:element.fontFamily,fontWeight:element.fontWeight}}>{element.content.slice(0,18)}</span> : element.type === 'shape' || element.type === 'pattern' || element.type === 'distress' ? <StudioGraphic element={{...element,color:element.color??'#405b6f'}}/> : element.type === 'customArea' ? <PenTool size={18}/> : <Brush size={18}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-[#262626]">
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
                      <div className="truncate text-[9.5px] text-[#737373]">
                        {element.type !== 'distress' ? (
                          <>
                            <span className="text-[#737373]">
                              {element.printMethod ?? DEFAULT_PRINT_METHOD}
                            </span>
                            {' · '}
                          </>
                        ) : null}
                        {element.type === 'image' ? 'Artwork' : element.type.charAt(0).toUpperCase()+element.type.slice(1)} · {garmentSide === 'front' ? 'Front' : 'Back'}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`${element.hidden ? 'Show' : 'Hide'} ${element.type === 'customArea' ? 'Custom Area' : element.type} layer`}
                    title={element.hidden ? 'Show layer' : 'Hide layer'}
                    onClick={() => { studio.setTool('select'); onChange(elements.map(item => item.id === element.id ? { ...item, hidden: !item.hidden } : item)); }}
                    className="flex shrink-0 items-center justify-center border-l border-[#e2e2e2] px-2 text-[#737373] hover:text-[#262626]"
                  >{element.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                  <button
                    type="button"
                    className="flex shrink-0 items-center justify-center rounded-r-[8px] border-l border-[#e2e2e2] px-2 text-[#737373] transition hover:bg-[#f2f2f2] hover:text-[#262626]"
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
      </PrintPanel>}

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
    </div></ArtworkDocumentContext.Provider>
  );
}

export function PrintsDesignPreview({
  canvasToolbar = true,
  assetMode = false,
  canvasSize,
  onCanvasSizeChange,
  garmentInteractive = false,
  onArtworkSelect,
  garmentPreview,
  elements: sourceElements,
  onChange,
  editable = false,
  className,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
  liveCanvasScale: liveCanvasScaleProp,
  phoneConfigSheetCollapsed = false,
  garmentSide = 'front',
  artworkView = false,
  referenceWidthCm=50,
}: PrintsDesignPreviewProps) {
  const elements=useMemo(()=>orderDesignLayers(sourceElements),[sourceElements]);
  const studio = usePrintsStudio();
  const [contextImageId,setContextImageId]=useState<string|null>(null);
  const assetWorkspace = useAssetWorkspaceContext();
  const frameRef = useRef<HTMLDivElement>(null);
  const hoveredArtworkRef=useRef<HTMLElement|null>(null);
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
  // Garments occupy a square SVG inside the legacy 800 x 700 artwork board.
  // Fit that square, not the board's empty horizontal margin, just as the
  // measurement/material views do. Asset workspaces still fit the full board.
  const sceneScale = validCanvasSize && frameSize.width > 0 && frameSize.height > 0
    ? artworkSceneScale(frameSize,validCanvasSize,assetMode) : 1;
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
  const dragCopyRef=useRef(false),repeatCopyRef=useRef<{source:DesignElement;copyId:string}|null>(null);
  const [marquee,setMarquee]=useState<MarqueeBox|null>(null);
  const marqueeCancel=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>marqueeCancel.current?.(),[]);
  const [penError,setPenError] = useState('');
  const [penResumeStartId,setPenResumeStartId]=useState<string|null>(null);
  useEffect(()=>setPenError(''),[studio.tool,studio.penTargetId]);
  const [liveShapePath, setLiveShapePath] = useState<{ id: string; path: ShapePath; frame?: Partial<DesignElement> } | null>(null);
  useEffect(() => {
    if (studio.pathEditingId && !elements.some(item => item.id === studio.pathEditingId && item.id === selectedId && item.type === 'shape' && !item.booleanOperation && !item.locked && designElementSide(item) === garmentSide)) studio.setPathEditingId(null);
  }, [elements, selectedId, garmentSide, studio.pathEditingId, studio.setPathEditingId]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  /** Live x/y while a drag is in progress. Kept *local* so the parent never
   *  re-renders per frame — that's the main reason dragging used to feel glitchy. */
  const [dragLivePos, setDragLivePos] = useState<{ x: number; y: number } | null>(null);
  const dragLivePosRef = useRef<{ x: number; y: number } | null>(null);
  const [manip, setManip] = useState<PrintManip | null>(null);
  const [liveTransform,setLiveTransform] = useState<{id:string;patch:Partial<DesignElement>}|null>(null);
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
  const bindZone=useCallback((node:HTMLDivElement|null)=>{zoneRef.current=node;setZoneEl(node);},[]);
  const [focusArtwork,setFocusArtwork]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const garmentCamera=useGarmentArtworkCamera(zoneEl,!editable&&!assetMode);
  const drawingMask = useGarmentDrawingMask(zoneEl, garmentSide, assetMode||Boolean(focusArtwork),sceneScale);
  const printTexture=useGarmentPrintTexture(zoneEl,garmentSide,assetMode,sceneScale);
  const patternRelief=useGarmentPrintTexture(zoneEl,garmentSide,assetMode,sceneScale,'pattern',studio.panel==='patterns'||elements.some(function hasPattern(element):boolean{return isBackgroundPattern(element)||!!element.children?.some(hasPattern);}));
  const patternTargets = useGarmentPatternTargets(zoneEl, garmentSide,sceneScale,assetMode||Boolean(focusArtwork));
  useEffect(()=>{const body=patternTargets.find(target=>target.id==='body'||target.id==='base');const calibrated=elements.find(e=>e.tracingReference&&e.referenceUnitsPerCm)?.referenceUnitsPerCm;if(assetMode){studio.setUnitsPerCm(calibrated??10);studio.setPrintArea({x:0,y:0,width:zoneEl?.clientWidth??800,height:zoneEl?.clientHeight??700});}else if(body&&referenceWidthCm>0){studio.setUnitsPerCm(calibrated??body.bounds.width/referenceWidthCm);studio.setPrintArea({x:body.bounds.x-body.bounds.width/2,y:body.bounds.y-body.bounds.height/2,width:body.bounds.width,height:body.bounds.height});}},[patternTargets,referenceWidthCm,assetMode,elements.find(e=>e.tracingReference&&e.referenceUnitsPerCm)?.referenceUnitsPerCm,studio.setUnitsPerCm]);
  const preservePatternCollar=elements.some(element=>element.patternKeepNeckPlain&&!element.patternTarget);
  const collarSafePatternMask=useMemo(()=>{
    if(!drawingMask||assetMode||!preservePatternCollar)return drawingMask;
    const canvas=document.createElement('canvas');canvas.width=drawingMask.canvas.width;canvas.height=drawingMask.canvas.height;
    const context=canvas.getContext('2d')!;context.drawImage(drawingMask.canvas,0,0);context.globalCompositeOperation='destination-out';
    for(const target of patternTargets.filter(t=>['neck','innerBackNeck','hood'].includes(t.id)))context.drawImage(target.canvas,0,0,canvas.width,canvas.height);
    return {...drawingMask,canvas,vectorUrl:undefined,url:canvas.toDataURL('image/png')};
  },[drawingMask,patternTargets,assetMode,preservePatternCollar]);
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
  const [patternHover, setPatternHover] = useState<{ kind: 'part' | 'area' | 'artwork'; id: string } | null>(null);
  const [dragPattern,setDragPattern]=useState<ReturnType<typeof getActivePatternDrag>>(null);
  useEffect(()=>{const clear=()=>{setPatternHover(null);setDragPattern(null);};window.addEventListener('dragend',clear);return()=>window.removeEventListener('dragend',clear);},[]);
  const findPatternTarget = (clientX: number, clientY: number) => {
    const zone = zoneRef.current;
    if (!zone) return null;
    const point = clientToZonePoint(zone, clientX, clientY);
    for(const item of [...elements].reverse()) {
      if(!['shape','text'].includes(item.type)||item.hidden||item.locked||designElementSide(item)!==garmentSide)continue;
      const angle=-item.rotation*Math.PI/180,dx=point.x-item.x,dy=point.y-item.y;
      const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
      if(Math.abs(x)<=item.width/2&&Math.abs(y)<=item.height/2)return {kind:'artwork' as const,id:item.id};
    }
    if(assetMode && !elements.some(e=>e.type==='customArea'))return null;
    for (const area of [...elements].reverse()) {
      if (area.type !== 'customArea' || area.hidden || area.locked || area.customAreaOpen || designElementSide(area) !== garmentSide) continue;
      const local = customAreaLocalPoint(point, area);
      const context = document.createElement('canvas').getContext('2d');
      if (context?.isPointInPath(new Path2D(customAreaPath(area.customAreaPoints ?? [])), local.x, local.y)
        && (assetMode || patternTargets.some(target => targetContains(target, point.x, point.y)))) return { kind: 'area' as const, id: area.id };
    }
    const part = assetMode?undefined:patternTargets.find(target => targetContains(target, point.x, point.y));
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
  useEffect(() => {
    if (!editable || !studio.textEditRequest) return;
    const element = elements.find(item => item.id === studio.textEditRequest && item.type === 'text');
    if (!element || element.locked) return;
    setSelectedId(element.id);
    beginTextEditing(element);
    studio.setTextEditRequest(null);
  }, [editable, elements, studio.textEditRequest, studio.setTextEditRequest]);
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
    () => elements.filter((item) => designElementSide(item) === garmentSide && !item.hidden && !item.referenceHidden && !item.customAreaOpen),
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

  useEffect(()=>{studio.setBooleanPreview([]);studio.setTextSelection(null);},[garmentSide,selectedId]);
  const updateElement = (id: string, patch: Partial<DesignElement>, select = false,transient=false) => {
    const fn = onChangeRef.current;
    if (!fn) return;
    fn(elementsRef.current.map((item) => (item.id === id ? { ...item, ...patch,...(patch.content!==undefined&&item.type==='text'&&patch.textCharacterStyles===undefined?{textCharacterStyles:remapTextStyles(item.content,patch.content,item.textCharacterStyles),textKerningPairs:remapTextKerning(item.content,patch.content,item.textKerningPairs),textGlyphTransforms:undefined,...(item.textBadge?{textBadge:{...item.textBadge,top:patch.content}}:{})}:{}) } : item)), select ? id : undefined,{transient});
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
                content: next.content,...(item.textBadge?{textBadge:{...item.textBadge,top:next.content}}:{}),textCharacterStyles:remapTextStyles(item.content,next.content,item.textCharacterStyles),textKerningPairs:remapTextKerning(item.content,next.content,item.textKerningPairs),textGlyphTransforms:undefined,
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

  useEffect(()=>{
    if(!editable)return;
    const eligible=(event:ClipboardEvent)=>!(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')&&!editingTextId;
    const copy=(event:ClipboardEvent)=>{if(!eligible(event))return;const ids=studio.selectionIds.length?studio.selectionIds:selectedId?[selectedId]:[],sources=elementsRef.current.filter(e=>ids.includes(e.id)&&canGroupLayer(e));if(writeArtworkClipboard(event,sources)&&event.type==='cut'){onChangeRef.current?.(elementsRef.current.filter(e=>!sources.includes(e)));studio.setSelectionIds([]);setSelectedId(null);}};
    const paste=(event:ClipboardEvent)=>{if(!eligible(event))return;const source=readArtworkClipboard(event);if(!source)return;event.preventDefault();const copies=pastedArtwork(source,garmentSideRef.current);onChangeRef.current?.([...elementsRef.current,...copies],copies[0].id);studio.setTool('select');studio.setSelectionIds(copies.length>1?copies.map(e=>e.id):[]);setSelectedId(copies[0].id);};
    document.addEventListener('copy',copy);document.addEventListener('cut',copy);document.addEventListener('paste',paste);return()=>{document.removeEventListener('copy',copy);document.removeEventListener('cut',copy);document.removeEventListener('paste',paste);};
  },[editable,selectedId,editingTextId,studio.selectionIds]);
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"], select,[role="listbox"],[role="combobox"],[role="menu"],[role="dialog"]')) return;
      if(editingTextId)return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='h'){const refs=elementsRef.current.filter(el=>el.tracingReference);if(refs.length){e.preventDefault();const hide=refs.some(el=>!el.referenceHidden);onChangeRef.current?.(elementsRef.current.map(el=>el.tracingReference?{...el,referenceHidden:hide}:el));}return;}
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey){const key=e.key.toLowerCase();
        if(['v','a','p','c','n','m','l','t'].includes(key)&&studio.tool!=='shapePolygon'){
          const current=elementsRef.current.find(el=>el.id===selectedId);
          if(key==='v'){e.preventDefault();studio.setPathEditingId(null);studio.setTool('select');studio.setSelectionAdditive(false);return;}
          if(key==='a'&&current?.type==='shape'&&!current.locked){e.preventDefault();if(!current.shapePath)updateElement(current.id,{shapePath:shapeToEditablePath(current)});studio.setTool('select');studio.setPathEditingId(current.id);return;}
          if(key==='p'||key==='c'||key==='n'){studio.setPenCurvature(key==='c');e.preventDefault();setPenResumeStartId(null);studio.setPanel('shapes');studio.setPathEditingId(null);studio.setPenTargetId(key==='p'&&current?.type==='shape'&&current.shapePath&&!current.shapePath.closed&&!current.shapePath.subpaths?.length?current.id:null);studio.setPenOperation('continue');studio.setTool(key==='n'?'shapePencil':'shapePolygon');return;}
          if(key==='t'){e.preventDefault();studio.setPathEditingId(null);studio.setPanel('text');studio.setTool('textPlace');setSelectedId(null);return;}
          if(key==='m'||key==='l'){e.preventDefault();studio.setPanel('shapes');studio.setLiveShape(key==='m'?'rect':'ellipse');studio.setPathEditingId(null);setSelectedId(null);studio.setTool('shapeLive');return;}
        }
      }
      if (studio.pathEditingId || studio.tool === 'shapePolygon'||studio.tool==='shapePencil'||studio.tool==='shapeLive') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); studio.setTool('select');studio.setSelectionAdditive(false);
        const ids=elementsRef.current.filter(el=>designElementSide(el)===garmentSideRef.current&&canGroupLayer(el)).map(el=>el.id);
        studio.setSelectionIds(ids);setSelectedId(ids[0]??null);return;
      }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){
        e.preventDefault();const sources=elementsRef.current.filter(el=>(studio.selectionIds.length>1?studio.selectionIds.includes(el.id):el.id===selectedId)&&canGroupLayer(el));if(!sources.length)return;
        const previous=repeatCopyRef.current,copies=sources.map(source=>{const copy=duplicateStudioArtwork(source);if(sources.length===1&&previous?.copyId===source.id){copy.x=source.x+(source.x-previous.source.x);copy.y=source.y+(source.y-previous.source.y);copy.width=source.width*source.width/previous.source.width;copy.height=source.height*source.height/previous.source.height;copy.rotation=source.rotation*2-previous.source.rotation;}return copy;});
        repeatCopyRef.current=sources.length===1?{source:structuredClone(sources[0]),copyId:copies[0].id}:null;onChangeRef.current?.([...elementsRef.current,...copies],copies[0].id);setSelectedId(copies[0].id);studio.setSelectionIds(copies.length>1?copies.map(el=>el.id):[]);studio.setSelectionAdditive(false);return;
      }
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='o'){e.preventDefault();const snapshot=elementsRef.current,ids=studio.selectionIds.length?studio.selectionIds:selectedId?[selectedId]:[],sources=snapshot.filter(el=>ids.includes(el.id)&&el.type==='text'&&!el.locked);if(sources.length)void Promise.all(sources.map(async source=>({id:source.id,patch:await outlineLettering(source,loadFontLibrary())}))).then(results=>{if(elementsRef.current!==snapshot)return;const patches=new Map(results.map(result=>[result.id,result.patch]));onChangeRef.current?.(snapshot.map(element=>patches.has(element.id)?{...element,...patches.get(element.id)}:element));}).catch(error=>toast.error(error instanceof Error?error.message:'Could not outline this text.'));return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='j'){e.preventDefault();try{const id=crypto.randomUUID();onChangeRef.current?.(joinOpenArtwork(elementsRef.current,studio.selectionIds,id),id);setSelectedId(id);studio.setSelectionIds([]);}catch{}return;}
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();studio.setSelectionAdditive(false);const ids=studio.selectionIds;
        if(e.shiftKey){const group=elementsRef.current.find(el=>el.id===selectedId);if(!ungroupLayersIssue(group)&&group){onChangeRef.current?.(ungroupDesignLayer(elementsRef.current,group.id,()=>crypto.randomUUID()));studio.setSelectionIds([]);setSelectedId(null);}}
        else if(!groupLayersIssue(elementsRef.current,ids)){const id=crypto.randomUUID();onChangeRef.current?.(groupDesignLayers(elementsRef.current,ids,id),id);studio.setSelectionIds([]);setSelectedId(id);}
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();studio.setSelectionAdditive(false);
        studio.setSelectionIds([]);
        if (studio.tool === 'customArea') {
          if (customAreaDraftIdRef.current) removeElement(customAreaDraftIdRef.current);
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
        if (studio.selectionIds.length>1) { e.preventDefault();onChangeRef.current?.(elementsRef.current.filter(el=>!studio.selectionIds.includes(el.id)||!canGroupLayer(el)));studio.setSelectionIds([]);setSelectedId(null);return;}
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
      if(d&&studio.selectionIds.length>1){e.preventDefault();onChangeRef.current?.(elementsRef.current.map(el=>studio.selectionIds.includes(el.id)&&canGroupLayer(el)?{...el,x:el.x+d[0],y:el.y+d[1]}:el));return;}
      if (!d || !selectedId) return;
      const el = elementsRef.current.find((x) => x.id === selectedId);
      if (!el || el.locked) return;
      e.preventDefault();
      updateElement(selectedId, { x: el.x + d[0], y: el.y + d[1] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, selectedId, editingTextId, setSelectedId, studio.tool, studio.pathEditingId, studio.setTool, studio.setCustomAreaPointSelection, studio.selectionIds]);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  useEffect(() => {
    if (!manip || !editable) return;

    let frame = 0;
    let pending: PointerEvent | null = null;
    let patch: Partial<DesignElement> | null = null;
    const previewUpdate = (id: string, next: Partial<DesignElement>) => {
      patch = {...patch,...next};
      setLiveTransform({id,patch});
    };
    const applyMove = (e: PointerEvent) => {
      if (manip.kind === 'rotate') {
        const cur = Math.atan2(e.clientY - manip.cy, e.clientX - manip.cx);
        const deltaDeg = ((cur - manip.startAngle) * 180) / Math.PI;
        let next = manip.startRot + deltaDeg;
        next = ((next % 360) + 360) % 360;
        if(e.shiftKey)next=Math.round(next/15)*15;else if (elementsRef.current.find(element => element.id === manip.id)?.type === 'image') next = snapImageRotation(next);
        previewUpdate(manip.id, { rotation: next });
        return;
      }
      const zone=zoneRef.current,s=zone?zoneScaleFactor(zone):1,source=elementsRef.current.find(element=>element.id===manip.id);if(!source)return;
      previewUpdate(manip.id,resizeArtwork({...source,width:manip.startW,height:manip.startH,fontSize:manip.startFontSize},manip.handle,{x:(e.clientX-manip.startX)/s,y:(e.clientY-manip.startY)/s},{fromCenter:e.altKey,constrain:e.shiftKey||(manip.handle.length===2&&manip.aspectLocked)}));
    };

    const flush = () => {frame=0;if(pending){const event=pending;pending=null;applyMove(event)}};
    const onMove = (event: PointerEvent) => {pending=event;if(!frame)frame=requestAnimationFrame(flush)};
    const onUp = () => {
      if(frame)cancelAnimationFrame(frame);
      flush();
      if(patch)onChangeRef.current?.(elementsRef.current.map(element=>element.id===manip.id?{...element,...patch}:element));
      setLiveTransform(null);
      setManip(null);
    };
    const onCancel = () => {if(frame)cancelAnimationFrame(frame);pending=null;setLiveTransform(null);setManip(null)};
    const onKey = (event:KeyboardEvent) => {if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel()}};

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      if(frame)cancelAnimationFrame(frame);
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
    let snapHeldOff=false;
    let snapGeometry: {halfW:number;halfH:number;offsetX:number;offsetY:number;boxes:SnapBox[]}|null=null;
    const dragRoots=new Map(Array.from(zoneRef.current?.querySelectorAll<HTMLElement>('[data-print-id]')??[]).map(root=>[root.dataset.printId,root]));
    const copySources=dragCopyRef.current?elementsRef.current.filter(item=>(item.id===draggingId||studio.selectionIds.includes(draggingId)&&studio.selectionIds.includes(item.id))&&canGroupLayer(item)):[];
    const copies=copySources.map(source=>({...duplicateStudioArtwork(source),x:source.x,y:source.y}));
    const copyNodes:HTMLElement[]=[];copySources.forEach((source,index)=>{const root=dragRoots.get(source.id);if(!root)return;const clone=root.cloneNode(true) as HTMLElement;clone.dataset.printId=copies[index].id;clone.dataset.editorChrome='';clone.setAttribute('aria-hidden','true');clone.style.pointerEvents='none';clone.style.zIndex=String((Number(root.style.zIndex)||1)+1);root.parentElement?.appendChild(clone);copyNodes.push(clone);dragRoots.set(source.id,clone);});


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
      // Cache the painted bounds for this gesture; layout caps are not the
      // visible centre of text, especially after its height has been stretched.
      if (!snapGeometry) {
        const roots=new Map(Array.from(zone.querySelectorAll<HTMLElement>('[data-print-id]')).map(node=>[node.dataset.printId,node]));
        const moving=roots.get(draggingId);
        const measured=moving?measureArtworkBoundsInZone(zone,moving):null;
        snapGeometry={halfW:(measured?.width??current.width)/2,halfH:(measured?.height??current.height)/2,offsetX:measured?.offsetX??0,offsetY:measured?.offsetY??0,
          boxes:elementsRef.current.filter(el=>designElementSide(el)===garmentSideRef.current&&!el.hidden&&!el.customAreaOpen&&el.id!==DRAWING_LAYER_ID&&el.id!==DISTRESS_LAYER_ID).map(el=>{
            const node=roots.get(el.id),bounds=node?measureArtworkBoundsInZone(zone,node):null;
            return {id:el.id,x:bounds?.x??el.x,y:bounds?.y??el.y,width:bounds?.width??el.width,height:bounds?.height??el.height};
          })};
      }
      const {halfW,halfH,offsetX,offsetY,boxes:snapBoxes}=snapGeometry;
      const snapped = snapHeldOff?{x:nx+offsetX,y:ny+offsetY,verticalLines:[],horizontalLines:[]}:snapDragInZone(
        nx + offsetX,
        ny + offsetY,
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
      if (!prev || prev.x !== snapped.x - offsetX || prev.y !== snapped.y - offsetY) {
        const nextPos = { x: snapped.x - offsetX, y: snapped.y - offsetY };
        dragLivePosRef.current = nextPos;
        const origin=elementsRef.current.find(item=>item.id===draggingId);
        if(origin){const dx=nextPos.x-origin.x,dy=nextPos.y-origin.y;for(const item of elementsRef.current){if(item.id!==draggingId&&!(studio.selectionIds.includes(draggingId)&&studio.selectionIds.includes(item.id)))continue;const node=dragRoots.get(item.id);if(node){node.style.left=`${item.x+dx}px`;node.style.top=`${item.y+dy}px`;}}}
      }
    };

    const handleMove = (e: PointerEvent) => {
      const samples=e.getCoalescedEvents?.(),last=samples?.at(-1)??e;
      latestClientX = last.clientX;
      latestClientY = last.clientY;snapHeldOff=e.ctrlKey||e.metaKey;
      pending = true;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(applyMove);
    };

    const finishDrag = (commit:boolean) => {
      if(rafId!==null){cancelAnimationFrame(rafId);rafId=null;}if(pending&&commit)applyMove();
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
        commit&&!dragDidMoveRef.current &&
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
      if (commit&&draggingId && liveEnd && dragDidMoveRef.current) {
        const origin=elementsRef.current.find(el=>el.id===draggingId);
        if(origin&&copies.length){const next=copies.map(copy=>({...copy,x:copy.x+liveEnd.x-origin.x,y:copy.y+liveEnd.y-origin.y}));onChangeRef.current?.([...elementsRef.current,...next],next[0].id);setSelectedId(next[0].id);studio.setSelectionIds(next.length>1?next.map(el=>el.id):[]);repeatCopyRef.current=next.length===1?{source:structuredClone(origin),copyId:next[0].id}:null;}
        else if(origin&&studio.selectionIds.includes(draggingId)&&studio.selectionIds.length>1)onChangeRef.current?.(elementsRef.current.map(el=>studio.selectionIds.includes(el.id)&&canGroupLayer(el)?{...el,x:el.x+liveEnd.x-origin.x,y:el.y+liveEnd.y-origin.y}:el));
        else updateElement(draggingId, { x: liveEnd.x, y: liveEnd.y });
      }
      if(!commit){for(const item of elementsRef.current){const root=dragRoots.get(item.id);if(root){root.style.left=`${item.x}px`;root.style.top=`${item.y}px`;}}}
      copyNodes.forEach(node=>node.remove());dragCopyRef.current=false;
      dragLivePosRef.current = null;
      guidesRef.current = null;
      textTapRef.current = null;
      dragDidMoveRef.current = false;
      setDraggingId(null);
      setDragLivePos(null);
      setAlignmentGuides(null);
    };

    const handleUp=()=>finishDrag(true),handleCancel=()=>finishDrag(false),handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();handleCancel();}};
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('keydown',handleKey,true);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);window.removeEventListener('keydown',handleKey,true);
      copyNodes.forEach(node=>node.remove());dragCopyRef.current=false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [draggingId, dragOffset, editable, manip, narrowViewport]);

  const selectedElement = editable ? elements.find((el) => el.id === selectedId) ?? null : null;
  useEffect(()=>{if(!editable)return;if(studio.pathEditingId&&studio.pathEditingId!==selectedId&&!selectedElement?.children?.some(child=>child.id===studio.pathEditingId))studio.setPathEditingId(null);if(studio.logoRegionEditing){const region=selectedElement?.logoTrace?selectedElement.children?.find(child=>child.logoTraceRegion?.key===selectedElement.logoTrace?.selectedRegion):undefined;if(studio.logoRegionEditing.rootId!==selectedId||region&&region.id!==studio.logoRegionEditing.regionId)studio.setLogoRegionEditing(null);}},[editable,selectedId,selectedElement?.logoTrace?.selectedRegion,studio.pathEditingId,studio.logoRegionEditing?.rootId]);

  const showInlineToolbar = Boolean(
    editable &&
      selectedElement &&
      !studio.cropEditingId &&
      studio.warpEditingId !== selectedElement.id &&
      !studio.drawing && !studio.pathEditingId && studio.tool!=='shapePolygon',
  );
  const showCanvasChromeToolbar = Boolean(
    canvasToolbar && showInlineToolbar && selectedElement && !selectedElement.patternTarget && studio.selectionIds.length<2,
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

  useLayoutEffect(()=>{
    const bounds=artworkView&&!assetMode?artworkViewBounds(elementsRef.current,garmentSide):null;
    setFocusArtwork(bounds?{...bounds,x:bounds.x+(zoneEl?.offsetLeft??0),y:bounds.y+(zoneEl?.offsetTop??0)}:null);
  },[artworkView,assetMode,garmentSide,zoneEl]);
  const focusScale=focusArtwork?Math.min(8,Math.max(.1,Math.min(frameSize.width/(focusArtwork.width+100),frameSize.height/(focusArtwork.height+100)))):null;
  const liveCanvasS = focusScale??((liveCanvasScaleProp && liveCanvasScaleProp > 0 ? liveCanvasScaleProp : 1) * sceneScale);
  const uiInvRaw = 1 / liveCanvasS;
  /** On phone, avoid over-scaling handles when the preview is zoomed out. */
  const uiInv = narrowViewport ? Math.min(uiInvRaw, 2.25) : uiInvRaw;

  return (
    <ArtworkContextMenu.Root><ArtworkContextMenu.Trigger asChild><div onContextMenu={event=>{if(!editable||!zoneRef.current){event.preventDefault();return;}const hit=artworkAtPoint(zoneRef.current,event.clientX,event.clientY),image=elementsRef.current.find(element=>element.id===hit?.dataset.printId&&element.type==='image');if(image){setContextImageId(image.id);setSelectedId(image.id);}else{setContextImageId(null);event.preventDefault();}}}
      className={cn(
        'relative mx-auto flex h-full max-h-full w-full max-w-full flex-col items-center justify-center',
        className,
      )}
    >
      {editable && onChange && studio.tool==='select' && !studio.pathEditingId && <ArtworkSelectionTools elements={elements} side={garmentSide} selectedId={selectedId} onChange={onChange} onSelect={setSelectedId}/>}
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
          !editable && 'overflow-hidden',
          narrowViewport && editable && 'overflow-hidden rounded-xl',
        )}
      >

        <GarmentWearHostContext.Provider value={zoneEl}><GarmentPrintTextureContext.Provider value={focusArtwork?null:printTexture}><GarmentPatternReliefContext.Provider value={focusArtwork?null:patternRelief}><div data-design-canvas data-print-fabric-ready={Boolean(printTexture)} className="relative h-full w-full" style={validCanvasSize ? {
          position: 'absolute', width: validCanvasSize.width, height: validCanvasSize.height,
          left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${liveCanvasS})${focusArtwork?` translate(${validCanvasSize.width/2-focusArtwork.x}px,${validCanvasSize.height/2-focusArtwork.y}px)`:``}`, transformOrigin: 'center',
        } : undefined}>
        <div className="absolute inset-0 flex min-h-0 flex-col">
          {narrowViewport &&
          editable &&
          selectedElement?.type === 'text' &&
          editingTextId !== selectedElement.id ? (
            <p className="pointer-events-none absolute inset-x-0 top-0 z-50 px-2 pb-1.5 text-center text-[10px] leading-tight text-[#737373]">
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
              if (manip) {
                event.currentTarget.style.cursor = manip.kind === 'rotate' ? ARTWORK_ROTATE_CURSOR
                  : artworkResizeCursor(manip.handle,elementsRef.current.find(element=>element.id===manip.id)?.rotation ?? 0);
                return;
              }
              if (draggingId) { event.currentTarget.style.cursor='grabbing'; return; }
              const root = editable && !studio.drawing && !studio.pathEditingId&&!marqueeCancel.current&&studio.tool === 'select' && zoneRef.current
                ? artworkAtPoint(zoneRef.current, event.clientX, event.clientY) : null;
              const element = elements.find(item => item.id === root?.dataset.printId);
              const next=element&&!element.locked&&element.id!==selectedId?root:null;if(hoveredArtworkRef.current!==next){hoveredArtworkRef.current?.removeAttribute('data-artwork-hover');next?.setAttribute('data-artwork-hover','');hoveredArtworkRef.current=next;}
              event.currentTarget.style.cursor = draggingId ? 'grabbing' : element && !element.locked ? 'grab' : '';
            }}
            onPointerLeave={()=>{hoveredArtworkRef.current?.removeAttribute('data-artwork-hover');hoveredArtworkRef.current=null;}}
            onPointerDownCapture={(e) => {
              if((e.target as Element).closest('[data-space-pan]'))return;
              if((e.target as Element).closest('[data-measurement-guide]'))return;
              if(!editable&&onArtworkSelect&&zoneRef.current){
                const root=artworkAtPoint(zoneRef.current,e.clientX,e.clientY);
                if(root?.dataset.printId){e.stopPropagation();e.preventDefault();onArtworkSelect(root.dataset.printId)}
                return;
              }
              // Pick a traced piece before the group's point overlay can intercept it.
              if(editable&&e.button===0&&(studio.tool==='select'||studio.logoRegionEditing||studio.pathEditingId)&&zoneRef.current&&!(e.target as Element).closest('[data-shape-anchor],[data-shape-curve-handle],[data-logo-selection]')){
                const zone=zoneRef.current,position=clientToZonePoint(zone,e.clientX,e.clientY),hit=artworkAtPoint(zone,e.clientX,e.clientY),owner=[...elements].reverse().find(element=>isEditableLogoGroup(element)&&!element.hidden&&!element.locked&&(element.side??'front')===garmentSide&&(!hit||hit.dataset.printId===element.id)&&logoPartAtPoint(element,position));
                if(owner){const piece=logoPartAtPoint(owner,position),activeRegion=studio.logoRegionEditing?.rootId===owner.id?owner.children?.find(child=>child.id===studio.logoRegionEditing?.regionId):null,activePieceId=activeRegion?.logoTraceRegion?.key==='silhouette'?owner.id:activeRegion?.id,sameEditingPiece=piece&&(activePieceId===piece.id||studio.pathEditingId===piece.id);if(piece&&onChange&&!sameEditingPiece){e.preventDefault();e.stopPropagation();const next=splitEditableLogoLayers(elements,owner.id),start=position;let patch:Partial<DesignElement>|null=null;studio.setPathEditingId(null);studio.setLogoRegionEditing(null);studio.setPenTargetId(null);studio.setTool('select');studio.setSelectionIds([]);studio.setSelectionAdditive(false);setSelectedId(piece.id);setDraggingId(null);setManip(null);onChange(next,piece.id);
                  const frame=frameGesture((event:PointerEvent)=>{const point=clientToZonePoint(zone,event.clientX,event.clientY);patch={x:piece.x+point.x-start.x,y:piece.y+point.y-start.y};setLiveTransform({id:piece.id,patch});});
                  const move=(event:PointerEvent)=>{if(event.pointerId===e.pointerId)frame.push(event)},cleanup=()=>{frame.cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);setLiveTransform(null)},end=(event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;frame.flush();cleanup();if(patch)onChange(next.map(element=>element.id===piece.id?{...element,...patch}:element),piece.id);},cancel=()=>cleanup();window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);return;
                }}
              }
              let switchingPointSelection=false;
              if(editable&&studio.pathEditingId&&zoneRef.current){
                if((e.target as Element).closest('[data-shape-anchor],[data-shape-curve-handle]'))return;
                const hit=artworkAtPoint(zoneRef.current,e.clientX,e.clientY);
                if(hit?.dataset.printId&&hit.dataset.printId!==studio.pathEditingId){studio.setPathEditingId(null);switchingPointSelection=true;}else return;
              }
              if (!editable || cropEditingId || studio.drawing || studio.pathEditingId&&!switchingPointSelection || (studio.tool === 'shapePolygon'||studio.tool==='shapePencil'||studio.tool==='shapeLive'||studio.tool==='textPlace'||studio.tool==='textTracking') || studio.tool === 'customArea' || studio.tool === 'customAreaAddPoint') return;
              if (!switchingPointSelection&&(e.target as Element).closest('[data-handles], [data-editor-chrome], [data-inline-toolbar], [data-inline-toolbar-popover], textarea')) return;
              const zone = zoneRef.current;
              if (!zone) return;
              const root = artworkAtPoint(zone, e.clientX, e.clientY);
              const element = elements.find(item => item.id === root?.dataset.printId);
              if (!root || !element) {
                if(e.button!==0||e.pointerType==='touch'){studio.setSelectionAdditive(false);studio.setSelectionIds([]);setSelectedId(null);return;}
                e.preventDefault();e.stopPropagation();marqueeCancel.current?.();
                const start=clientToZonePoint(zone,e.clientX,e.clientY),previous=studio.selectionIds,previousId=selectedId,base=e.shiftKey?(previous.length?previous:previousId?[previousId]:[]):[];
                let finalIds=base,moved=false;
                const marqueeQueue=frameGesture((event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;const point=clientToZonePoint(zone,event.clientX,event.clientY),box=selectionBox(start,point);if(!moved&&Math.hypot(event.clientX-e.clientX,event.clientY-e.clientY)<4)return;moved=true;setMarquee(box);finalIds=[...new Set([...base,...marqueeArtworkIds(elementsRef.current,garmentSideRef.current,box)])];studio.setSelectionIds(finalIds);});const move=(event:PointerEvent)=>marqueeQueue.push(event);
                const clean=()=>{marqueeQueue.cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key,true);setMarquee(null);marqueeCancel.current=null;};
                const cancel=()=>{clean();studio.setSelectionIds(previous);setSelectedId(previousId);};
                const end=(event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;marqueeQueue.flush();clean();studio.setSelectionAdditive(false);studio.setSelectionIds(finalIds);setSelectedId(finalIds[0]??null);};
                const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}};
                marqueeCancel.current=cancel;window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key,true);
                if(!e.shiftKey){studio.setSelectionIds([]);setSelectedId(null);}if(studio.tool==='customAreaEdit')studio.setTool('select');return;
              }
              if (studio.tool === 'customAreaEdit') {
                if (element.id === selectedId) { studio.setCustomAreaPointSelection(null); return; }
                studio.setTool('select');
              }
              e.stopPropagation();
              if((e.shiftKey||studio.selectionAdditive)&&canGroupLayer(element)){
                e.preventDefault();const base=studio.selectionIds.length?studio.selectionIds:selectedId&&elements.some(el=>el.id===selectedId&&canGroupLayer(el))?[selectedId]:[];
                const ids=toggleLayerSelection(base,element.id);studio.setSelectionIds(ids);setSelectedId(ids.includes(element.id)?element.id:ids[0]??null);return;
              }
              if(!studio.selectionIds.includes(element.id))studio.setSelectionIds([]);
              const wasSel = selectedId === element.id;
              setSelectedId(element.id);
              textTapRef.current = { id: element.id, alreadySelected: wasSel };
              dragStartClientRef.current = { x: e.clientX, y: e.clientY };
              dragDidMoveRef.current = false;
              if (element.locked || (element.patternTarget && patternTargets.some(target => target.id === element.patternTarget))) return;
              e.preventDefault();
              const ptr = clientToZonePoint(zone, e.clientX, e.clientY);
              setManip(null);dragCopyRef.current=e.altKey;
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
              if (!editable || cropEditingId || studio.drawing || studio.pathEditingId || (studio.tool === 'shapePolygon'||studio.tool==='shapePencil'||studio.tool==='shapeLive'||studio.tool==='textPlace'||studio.tool==='textTracking') || !zoneRef.current || studio.tool === 'customArea' || studio.tool === 'customAreaAddPoint') return;
              if ((e.target as Element).closest('[data-editor-chrome], [data-handles], textarea')) return;
              const root = artworkAtPoint(zoneRef.current, e.clientX, e.clientY);
              const element = elements.find(item => item.id === root?.dataset.printId);
              if(element?.type==='shape'&&!element.locked){e.stopPropagation();e.preventDefault();setDraggingId(null);if(!element.shapePath)updateElement(element.id,{shapePath:shapeToEditablePath(element)});setSelectedId(element.id);studio.setTool('select');studio.setPathEditingId(element.id);return;}
              if (element?.type !== 'text' || element.locked) return;
              e.stopPropagation(); e.preventDefault();
              setSelectedId(element.id);
              beginTextEditing(element);
              setDraggingId(null);
              textTapRef.current = null;
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
          {assetMode ? <div data-asset-artboard-background className="pointer-events-none absolute inset-0 border border-[#e2e2e2]" style={{ backgroundColor: assetWorkspace?.project?.background ?? '#ffffff', backgroundImage: assetWorkspace?.project?.background ? 'none' : 'conic-gradient(#f5f5f5 25%, transparent 0 50%, #f5f5f5 0 75%, transparent 0)', backgroundSize: '16px 16px' }} /> : (
          <div className="absolute inset-0 z-0 flex items-center justify-center" style={{ pointerEvents: focusArtwork?'none':garmentInteractive ? 'auto' : 'none',visibility:focusArtwork?'hidden':undefined }} data-print-garment-preview>
            {typeof garmentPreview === 'function' ? garmentPreview(sceneScale) : garmentPreview}
          </div>
          )}

          <div
            ref={bindZone}
            data-print-design-zone
            data-asset-artboard={assetMode ? '' : undefined}
            className={cn('absolute z-10', assetMode ? 'overflow-hidden' : 'overflow-visible', editable && 'touch-none', editable && studio.tool === 'customArea' && 'cursor-crosshair')}
            onPointerDown={handleCustomAreaPointerDown}
            onPointerMove={(event) => {
              if (studio.tool === 'customArea' && zoneRef.current) setCustomAreaCursor(clientToZonePoint(zoneRef.current, event.clientX, event.clientY));
            }}
            onDragOver={(e) => {
              if (!editable) return;
              if (![ARTWORK_UPLOAD_DRAG_MIME,STUDIO_DRAG_MIME, ASSET_LIBRARY_DRAG_MIME, 'text/plain'].some((t) => e.dataTransfer.types.includes(t))) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (e.dataTransfer.types.includes('application/x-ceriga-pattern')) {
                const target = findPatternTarget(e.clientX, e.clientY);
                setPatternHover(previous=>previous?.kind===target?.kind&&previous?.id===target?.id?previous:target);
                const active=getActivePatternDrag();setDragPattern(previous=>previous===active?previous:active);
                e.dataTransfer.dropEffect = target ? 'copy' : 'none';
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPatternHover(null);
            }}
            onDrop={(e) => {
              if (!editable || !onChange) return;
              const uploaded=e.dataTransfer.getData(ARTWORK_UPLOAD_DRAG_MIME);
              if(uploaded&&zoneRef.current){e.preventDefault();const point=clientToZonePoint(zoneRef.current,e.clientX,e.clientY);void(async()=>{try{const data=JSON.parse(uploaded);if(typeof data.source!=='string')return;const dimensions=await artworkImagePlacement(data.source,assetMode?{width:canvasSize?.width??800,height:canvasSize?.height??700}:{width:160,height:160},assetMode),next:DesignElement={id:crypto.randomUUID(),type:'image',content:data.source,layerName:typeof data.name==='string'?data.name:'Uploaded artwork',x:point.x,y:point.y,rotation:0,side:garmentSide,printMethod:DEFAULT_PRINT_METHOD,...dimensions};onChangeRef.current?.([...elementsRef.current,next],next.id);setSelectedId(next.id);studio.setTool('select')}catch{toast.error('This uploaded artwork could not be placed.')}})();return;}
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
              setPatternHover(null);setDragPattern(null);
              if (payload.kind === 'pattern' && !target && !assetMode) return;
              const appearance = payload.kind === 'pattern' ? { ...initialPatternSettings(payload.id, studio.color), ...patternAppearance(payload.settings) } : {};
              if (payload.kind === 'pattern' && payload.id === 'custom' && !appearance.patternSource) return;
              if(target?.kind==='artwork' && payload.kind==='pattern'){
                onChange(elements.map(element=>{if(element.id!==target.id)return element;const key=element.type==='text'?'textEffects':'shapeEffects';return {...element,...(element.type==='shape'?{shapeFilled:true}:{}),[key]:[textileInkEffect(payload.id,appearance.patternColors??[studio.color,'#f1eee2','#a94747','#344357'],4),...(element[key]??[]).filter(e=>e.id!=='textile-ink')]}}));setSelectedId(target.id);studio.setTool('select');return;
              }
              if (target?.kind === 'area') {
                onChange(elements.map(element => element.id === target.id ? {
                  ...element, customAreaPattern: payload.id, customAreaImage: undefined, customAreaTexture: undefined,
                  printMethod:element.printMethod==='Fabric Print'?DEFAULT_PRINT_METHOD:element.printMethod??DEFAULT_PRINT_METHOD,
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
                borderWidth: 0,
                ...(payload.kind === 'shape' ? studioShapeDefaults(payload.id) : {}),
                opacity: 100,
                locked: false,
                printMethod: payload.kind === 'distress' ? undefined : payload.kind === 'pattern' && part ? 'Fabric Print' : DEFAULT_PRINT_METHOD,
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
              transform:garmentCamera,transformOrigin:'0 0',
              left: assetMode ? 0 : `${PREVIEW_ZONE.left}%`,
              right: assetMode ? 0 : `${PREVIEW_ZONE.right}%`,
              top: assetMode ? 0 : `${PREVIEW_ZONE.top}%`,
              bottom: assetMode ? 0 : `${PREVIEW_ZONE.bottom}%`,
              pointerEvents: editable ? undefined : 'none',
            }}
          >
          {editable&&!assetMode&&<ArtworkPlacementZones elements={elements.map(element=>{const transformed=liveTransform?.id===element.id?{...element,...liveTransform.patch}:element;if(!dragLivePos||!draggingId)return transformed;if(element.id===draggingId)return {...transformed,...dragLivePos};const origin=elements.find(item=>item.id===draggingId);return origin&&studio.selectionIds.includes(draggingId)&&studio.selectionIds.includes(element.id)?{...transformed,x:element.x+dragLivePos.x-origin.x,y:element.y+dragLivePos.y-origin.y}:transformed;})} side={garmentSide}/>}
          {patternHover && (() => {
            const part = patternHover.kind === 'part' ? patternTargets.find(target => target.id === patternHover.id) : undefined;
            const area = patternHover.kind === 'area' ? elements.find(element => element.id === patternHover.id) : undefined;
            const artwork=patternHover.kind==='artwork'?elements.find(element=>element.id===patternHover.id):undefined;
            return <div className="pointer-events-none absolute inset-0 z-[30]" data-pattern-drop-target={patternHover.id} style={{zIndex:0}}>
              {part && dragPattern ? <div className="absolute inset-0" style={{maskImage:`url("${part.url}")`,maskSize:'100% 100%',maskRepeat:'no-repeat'}}><div style={{position:'absolute',left:part.bounds.x,top:part.bounds.y,width:part.bounds.width,height:part.bounds.height,transform:'translate(-50%,-50%)',opacity:(dragPattern.settings?.opacity??100)/100}}><PatternGraphic fabricPreview element={{id:'drag-preview',type:'pattern',content:dragPattern.id,...part.bounds,rotation:0,...initialPatternSettings(dragPattern.id,studio.color),...dragPattern.settings,patternReferenceSize:garmentPatternReference(zoneEl?.clientWidth??800,zoneEl?.clientHeight??700)} as DesignElement}/></div></div> : null}
              {area ? <svg className="absolute overflow-visible" viewBox={`0 0 ${area.width} ${area.height}`} style={{ left: area.x, top: area.y, width: area.width, height: area.height, transform: `translate(-50%, -50%) rotate(${area.rotation}deg)`, maskImage: drawingMask ? drawingMaskCss(drawingMask, area.width, area.height, area.x, area.y, area.rotation) : undefined }}>
                <defs><clipPath id="pattern-hover-area"><path d={customAreaTransformedPath(area)}/></clipPath></defs>{dragPattern&&<g clipPath="url(#pattern-hover-area)"><PatternGraphic fabricPreview element={{...area,type:'pattern',content:dragPattern.id,rotation:0,...initialPatternSettings(dragPattern.id,studio.color),...dragPattern.settings,patternReferenceSize:garmentPatternReference(zoneEl?.clientWidth??800,zoneEl?.clientHeight??700)} as DesignElement}/></g>}<path d={customAreaTransformedPath(area)} fill="none" stroke="#737373" strokeWidth="1"/>
              </svg> : null}
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#fafafa] px-3 py-1 text-xs text-[#262626]" role="status">Fill {artwork?.layerName??(artwork?.type==='text'?'Text':artwork?.content)??part?.label ?? area?.customAreaName ?? 'Custom Area'}</span>
            </div>;
          })()}
          {editable&&studio.booleanPreview.map(preview=><div key={preview.id} data-editor-chrome aria-hidden="true" className="pointer-events-none absolute" style={{left:preview.x,top:preview.y,width:preview.width,height:preview.height,transform:`translate(-50%,-50%) rotate(${preview.rotation}deg)`,opacity:.4,zIndex:95}}><StudioGraphic element={{...preview,shapeFilled:true,shapeFillColor:preview.shapeFillColor??preview.color??'#737373',borderWidth:0,shapeEffects:undefined}}/></div>)}
          {editable&&marquee&&<div data-editor-chrome data-artwork-marquee className="artwork-marquee" style={{left:marquee.x,top:marquee.y,width:marquee.width,height:marquee.height}}/>}
          {editable && alignmentGuides && <ArtworkAlignmentGuides vertical={alignmentGuides.vertical} horizontal={alignmentGuides.horizontal} inverseScale={uiInv}/>}
          {editable && (studio.tool === 'brush' || studio.tool === 'eraser') && elements
            .filter(element => element.id === DRAWING_LAYER_ID && designElementSide(element) === garmentSide)
            .map(element => <ImageAdjustmentDefs key={element.id} element={element} />)}
          {editable ? (
            <PrintsDrawLayer
              onFinishDrawing={id=>{studio.setTool('select');setSelectedId(id);}}
              zone={zoneEl}
              garmentMask={drawingMask}
              displayScale={sceneScale}
              elements={elements}
              onChange={onChange}
              editable={editable}
              garmentSide={garmentSide}
              adjustFilter={getArtworkAdjustFilter(
                elements.find((el) => el.type === 'drawing' && designElementSide(el) === garmentSide) ?? {},
              )}
            />
          ) : null}
          {editable&&studio.tool==='textPlace'&&<TextPlacementDraft width={zoneEl?.clientWidth??800} height={zoneEl?.clientHeight??700} color={studio.color} side={garmentSide} onComplete={text=>{onChange?.([...elements,text],text.id);setSelectedId(text.id);studio.setTool('select');beginTextEditing(text);}}/>}
          {editable&&selectedElement?.type==='group'&&!selectedElement.logoTrace&&studio.logoRegionEditing?.rootId===selectedElement.id&&<GroupPathOverlay root={selectedElement} scale={1/uiInv} onChange={patch=>updateElement(selectedElement.id,patch)} onPreview={(id,path)=>setLiveShapePath(path?{id,path}:null)}/>}
          {editable&&selectedElement?.logoTrace&&(studio.tool==='select'||studio.logoRegionEditing?.rootId===selectedElement.id)&&<LogoTraceRegionOverlay scale={sceneScale} root={selectedElement} elements={elements} onChange={(next,id)=>{onChange?.(next,id);if(id)setSelectedId(id)}}/>}
          {editable&&selectedElement?.type==='text'&&studio.adjustLettersId===selectedElement.id&&<GlyphAdjustmentOverlay element={selectedElement} width={zoneEl?.clientWidth??800} height={zoneEl?.clientHeight??700} onChange={patch=>updateElement(selectedElement.id,patch)} onDone={()=>studio.setAdjustLettersId(null)}/>}
          {editable&&studio.referenceTask&&elements.find(e=>e.id===studio.referenceTask?.id)&&<ReferenceTraceOverlay element={elements.find(e=>e.id===studio.referenceTask?.id)!} width={zoneEl?.clientWidth??800} height={zoneEl?.clientHeight??700} onChange={patch=>updateElement(studio.referenceTask!.id,patch)} onAdd={shape=>{onChange?.([...elements,shape],shape.id);setSelectedId(shape.id);}}/>}
          {editable&&studio.tool==='textTracking'&&selectedElement?.type==='text'&&<TrackingDrag key={selectedElement.textSpacingDrag??'letterSpacing'} property={selectedElement.textSpacingDrag??'letterSpacing'} element={selectedElement} width={zoneEl?.clientWidth??800} height={zoneEl?.clientHeight??700} onCancel={()=>studio.setTool('select')} onComplete={value=>{const property=selectedElement.textSpacingDrag??'letterSpacing',index=studio.textSelection?.id===selectedElement.id?studio.textSelection.start:0;updateElement(selectedElement.id,property==='textKerning'&&index>0?{textKerningPairs:[...(selectedElement.textKerningPairs??[]).filter(pair=>pair.index!==index),{index,offset:value}]}:{[property]:value});studio.setTool('select');}}/>}
          {editable&&studio.tool==='shapeLive'&&<LiveShapeDraft key={studio.liveShape} kind={studio.liveShape} width={zoneEl?.clientWidth??800} height={zoneEl?.clientHeight??700} unitsPerCm={studio.unitsPerCm} color={studio.color} side={garmentSide} onCancel={()=>studio.setTool('select')} onComplete={shape=>{onChange?.([...elements,shape],shape.id);setSelectedId(shape.id);studio.setTool('select');}}/>}
          {editable&&studio.tool==='shapePencil'&&<ShapePencilDraft width={zoneEl?.clientWidth??1} height={zoneEl?.clientHeight??1} onCancel={()=>studio.setTool('select')} onComplete={path=>{const next=createPenArtwork(path,studio.color,garmentSide);onChange?.([...elements,next],next.id);setSelectedId(next.id);studio.setTool('select');}}/>}
          {editable && studio.tool === 'shapePolygon' && <PenPathDraft key={garmentSide + (studio.penTargetId ?? '')}
            width={zoneEl?.clientWidth ?? 1} height={zoneEl?.clientHeight ?? 1} color={studio.color}
            tracingElements={elements.filter(el=>(el.side??'front')===garmentSide&&el.id!==studio.penTargetId)}
            cutting={Boolean(studio.penTargetId)&&studio.penOperation!=='continue'} error={penError} operation={studio.penOperation}
            initialPath={studio.penOperation==='continue'?(()=>{const target=elements.find(el=>el.id===studio.penTargetId);return target?(penResumeStartId===target.id?reversePenPath(shapeWorldPath(target)):shapeWorldPath(target)):undefined;})():undefined}
            openPaths={elements.filter(el=>el.type==='shape'&&!el.locked&&!el.hidden&&(el.side??'front')===garmentSide&&el.shapePath&&!el.shapePath.closed&&!el.shapePath.subpaths?.length&&!el.warp&&!el.perspective&&!el.eraseContours?.length&&!el.shapeBrush).map(el=>({id:el.id,path:shapeWorldPath(el)}))}
            onContinue={(id,fromStart)=>{setPenResumeStartId(fromStart?id:null);setSelectedId(id);studio.setPenTargetId(id);studio.setPenOperation('continue');}}
            snapTargets={elements.filter(el=>(el.side??'front')===garmentSide&&!el.hidden&&el.id!==studio.penTargetId&&!el.patternTarget).flatMap(el=>{const a=el.rotation*Math.PI/180;return [[-.5,-.5],[0,-.5],[.5,-.5],[.5,0],[.5,.5],[0,.5],[-.5,.5],[-.5,0],[0,0]].map(([u,v])=>({x:el.x+u*el.width*Math.cos(a)-v*el.height*Math.sin(a),y:el.y+u*el.width*Math.sin(a)+v*el.height*Math.cos(a)}));})}
            onCancel={() => {studio.setTool('select');studio.setPenTargetId(null);setPenResumeStartId(null);setPenError('');}}
            onComplete={path => {
              const target=elements.find(element=>element.id===studio.penTargetId);
              try {
                if(target){const next=studio.penOperation==='continue'?{...target,...fitPenPath(path,Math.max(1,(target.borderWidth??2)/2+1)),shapeGeometry:'bounds' as const,rotation:0,flipHorizontal:false,flipVertical:false}:cutOrAddPenPath(target,path,studio.penOperation);onChange?.(elements.map(element=>element.id===target.id?next:element));setSelectedId(target.id);}
                else {const next=createPenArtwork(path,studio.color,garmentSide);onChange?.([...elements,next]);setSelectedId(next.id);if(path.closed)studio.setPathEditingId(next.id);}
                studio.setTool('select');studio.setPenTargetId(null);setPenResumeStartId(null);setPenError('');
              } catch(error){setPenError(error instanceof Error?error.message:'Could not apply this path.');}
            }} />}
          {editable && studio.tool === 'customArea' && customAreaDraft.length >= 3 && <button type="button" data-editor-chrome
            className="custom-shape-finish pointer-events-auto absolute bottom-2 left-1/2 z-50" style={{transform:'translateX(-50%)',transformOrigin:'bottom center',scale:String(zoneEl?1/zoneScaleFactor(zoneEl):1)}}
            onPointerDown={event => event.stopPropagation()} onClick={closeCustomArea}>Finish shape</button>}
          {editable && studio.tool === 'customArea' && customAreaDraft.length > 0 ? (
            <svg className="pointer-events-none absolute inset-0 z-40 h-full w-full overflow-visible" viewBox={`0 0 ${zoneEl?.clientWidth ?? 1} ${zoneEl?.clientHeight ?? 1}`} preserveAspectRatio="none" aria-label="Custom Area in progress">
              <polyline points={customAreaDraft.map(point=>`${point.x},${point.y}`).join(' ')} fill="none" stroke="#737373" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
              {customAreaCursor&&<line x1={customAreaDraft.at(-1)!.x} y1={customAreaDraft.at(-1)!.y} x2={customAreaCursor.x} y2={customAreaCursor.y} stroke="#737373" strokeOpacity=".75" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"/>}
              {customAreaDraft.map((point,index)=>{const inv=zoneEl?1/zoneScaleFactor(zoneEl):1,size=3.5*inv,close=index===0&&customAreaDraft.length>=3&&customAreaCursor&&Math.hypot(point.x-customAreaCursor.x,point.y-customAreaCursor.y)<=18*inv;return <g key={index} data-custom-draft-point={index}>{close&&<circle cx={point.x} cy={point.y} r={9*inv} fill="white" fillOpacity=".5" stroke="#737373" strokeWidth="1" vectorEffect="non-scaling-stroke"/>}<rect x={point.x-size} y={point.y-size} width={size*2} height={size*2} rx={inv} fill={index===0?'#262626':'white'} stroke={index===0?'white':'#737373'} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>})}

            </svg>
          ) : null}
          {editable && studio.drawing ? (
            <div data-drawing-status className="pointer-events-none absolute bottom-2 left-1/2 z-[20] -translate-x-1/2 rounded-full border border-[#e2e2e2] bg-[#fafafa] px-3 py-1 text-[10px] font-medium tracking-wide text-[#737373] backdrop-blur-md">
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
          {visibleElements.map((savedElement) => {
            const element=liveTransform?.id===savedElement.id?{...savedElement,...liveTransform.patch}:savedElement;
            const selected = selectedId === element.id && !element.logoTrace?.selectedRegion;

            const bw = element.borderWidth ?? 0;
            const bc = element.borderColor ?? '#FFFFFF';
            const op = (element.opacity ?? 100) / 100;
            const locked = element.locked === true;
            const isEditingText = editingTextId === element.id;
            const displayFont = element.fontSize ?? 30;
            /** iOS zooms the page on focus if input font is under 16px — avoid while editing. */
            const editFontSize = narrowViewport ? Math.max(16, displayFont) : displayFont;

            const patternPart = !focusArtwork&&element.patternTarget ? patternTargets.find(target => target.id === element.patternTarget) : undefined;
            if (element.patternTarget && !patternPart && !focusArtwork) return null;
            const liveElement = patternPart ? { ...element, ...patternPart.bounds, rotation: 0, patternReferenceSize:garmentPatternReference(zoneEl?.clientWidth??800,zoneEl?.clientHeight??700) }
              : element.type === 'customArea' && liveCustomAreaPoints?.id === element.id
                ? { ...element, customAreaViewWidth: customAreaViewport(element).width, customAreaViewHeight: customAreaViewport(element).height, customAreaPoints: liveCustomAreaPoints.points }
                : liveShapePath?.id === element.id ? { ...element, ...liveShapePath.frame, shapePath: liveShapePath.frame?.shapePath??liveShapePath.path } : liveShapePath&&element.children?{...element,children:(function preview(rows:DesignElement[]):DesignElement[]{return rows.map(child=>child.id===liveShapePath.id?{...child,shapePath:liveShapePath.path,shapeCornerRadius:0}:child.children?{...child,children:preview(child.children)}:child)})(element.children)}:element;
            const visualElement = !assetMode && liveElement.type === 'customArea' && liveElement.customAreaPattern
              ? {...liveElement,patternReferenceSize:garmentPatternReference(zoneEl?.clientWidth??800,zoneEl?.clientHeight??700)} : liveElement;
            const isHeld = draggingId === element.id && editable && !locked;
            const liveX =
              isHeld && dragLivePos ? dragLivePos.x : dragLivePos&&draggingId&&studio.selectionIds.includes(draggingId)&&studio.selectionIds.includes(element.id)?visualElement.x+dragLivePos.x-(elements.find(el=>el.id===draggingId)?.x??0):visualElement.x;
            const liveY =
              isHeld && dragLivePos ? dragLivePos.y : dragLivePos&&draggingId&&studio.selectionIds.includes(draggingId)&&studio.selectionIds.includes(element.id)?visualElement.y+dragLivePos.y-(elements.find(el=>el.id===draggingId)?.y??0):visualElement.y;
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
                data-print-id={element.id} data-tracing-reference={element.tracingReference?true:undefined}
                data-pattern-part-mask={patternPart?drawingMaskCss(patternPart,visualElement.width,visualElement.height,visualElement.x,visualElement.y,0):undefined}
                data-pattern-reference-size={visualElement.patternReferenceSize}
                data-pattern-part-label={patternPart?.label}
                data-pattern-part-bounds={patternPart?JSON.stringify(patternPart.bounds):undefined}
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
                  visibility:studio.tool==='shapePolygon'&&studio.penOperation==='continue'&&studio.penTargetId===element.id?'hidden':undefined,
                  zIndex:isBackgroundPattern(element)?0:isHeld?15:1,
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
                  opacity: studio.pathEditingId&&studio.pathEditingId!==element.id?op*.3:op,
                  pointerEvents: 'none',
                  transform: `translate(-50%, -50%) rotate(${visualElement.rotation}deg)`,
                }}
              >
                {editable && selected && element.type === 'image' && manip?.kind === 'rotate' && manip.id === element.id && element.rotation === 0 && (
                  <div data-editor-chrome data-rotation-snap className="pointer-events-none absolute inset-y-0 left-1/2 z-50 border-l border-emerald-400">
                    <span role="status" className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-emerald-950 px-2 py-1 text-[10px] font-semibold text-emerald-200" style={{ scale: uiInv }}>0°</span>
                  </div>
                )}
                {editable&&studio.selectionIds.length>1&&studio.selectionIds.includes(element.id)&&<div data-editor-chrome className="pointer-events-none absolute inset-0 border border-dashed border-[#737373]"/>}
                {editable && selected && !locked && studio.pathEditingId === element.id && element.type==='shape' && !element.booleanOperation && <ShapePathEditor
                  key={element.id} tracingElements={elements.filter(other=>other.id!==element.id&&(other.side??'front')===garmentSide)} element={{...visualElement,shapePath:shapeToEditablePath(visualElement)}} scale={1 / uiInv}
                  onContinue={fromStart=>{setPenResumeStartId(fromStart?element.id:null);studio.setPathEditingId(null);studio.setPenTargetId(element.id);studio.setPenOperation('continue');studio.setTool('shapePolygon');}}
                  onChange={shapePath => updateElement(element.id, {...flattenBoolean(element),...reframeEditedPath(element,shapePath),shapeCornerRadius:0})}
                  onPreview={path => setLiveShapePath(path ? { id: element.id, path, frame:reframeEditedPath(element,path) } : null)}
                  onDone={() => studio.setPathEditingId(null)} />}
                {editable && selected && !locked && !cropEditingId && element.type === 'customArea' && (studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint') && <CustomAreaPathEditor
                  key={element.id} element={element} scale={1 / uiInv}
                  onChange={points => updateElement(element.id, customAreaGeometryPatch(points, element))}
                  onPreview={points => setLiveCustomAreaPoints(points ? { id: element.id, points } : null)} />}
                {editable&&selected&&element.type==='shape'&&!element.shapeFilled&&!(element.borderWidth??0)&&studio.pathEditingId!==element.id&&<div data-editor-chrome className="pointer-events-none absolute inset-0"><StudioGraphic element={{...visualElement,shapeFilled:false,borderWidth:uiInv,shapeStrokeColor:'#737373',shapeEffects:undefined}}/></div>}
                {editable&&selected&&!locked&&element.content==='rect'&&!element.shapePath&&studio.tool==='select'&&<LiveCornerHandle element={visualElement} scale={1/uiInv} onPreview={shapeParameters=>setLiveTransform(shapeParameters?{id:element.id,patch:{shapeParameters}}:null)} onChange={shapeParameters=>updateElement(element.id,{shapeParameters})}/>}
                <DesignAssetSurface clipStyle={artworkClipStyle(visualElement,elements)} interacting={manip?.id===element.id||draggingId===element.id} editingPath={studio.pathEditingId===element.id||studio.logoRegionEditing?.rootId===element.id} element={visualElement} selected={selected && studio.logoRegionEditing?.rootId!==element.id && studio.selectionIds.length<2 && studio.tool!=='shapePolygon' && studio.tool!=='shapePencil' && editable && !locked && !isEditingText && !cropEditingId && studio.pathEditingId !== element.id && !(element.type === 'customArea' && (studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint')) && !patternPart}
                  cropping={editable && cropEditingId === element.id}
                  cropOverlay={<InteractiveCropOverlay element={cropDraft} onChange={setCropDraft} width={visualElement.width} height={visualElement.height} />}
                  garmentMask={patternPart ?? (element.patternKeepNeckPlain?collarSafePatternMask:drawingMask)} position={{ x: liveX, y: liveY }}
                  distort={distortEditingId === element.id && !studio.drawing}
                  warpEditing={warpEditingId === element.id && !studio.drawing}
                  onWarpChange={(warp) => updateElement(element.id, { warp })}
                  scale={1 / uiInv} onChange={patch => updateElement(element.id, patch)}
                  overlay={<PrintTransformOverlay transformLabel={manip?.id===element.id?(manip.kind==='rotate'?`${Math.round(visualElement.rotation)}°`:`${visualElement.width.toFixed(1)} × ${visualElement.height.toFixed(1)} px`):undefined} tight hideBounds={element.type==='shape'&&Boolean(element.shapePath)&&!element.shapePath?.closed} rotation={visualElement.rotation} shapeChrome={element.type==='shape'||element.type==='customArea'} compactHandles={narrowViewport && element.type !== 'text'}
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
                        isImage: element.type !== 'text', aspectLocked: element.aspectLocked ?? true });
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
                    ) : element.type==='drawing'&&element.drawing?<DrawingArtwork element={visualElement}/>:element.type === 'shape' ||
                    element.type === 'pattern' ||
                    element.type === 'distress' ? (
                      <div className={cn('h-full w-full', element.type !== 'shape' && 'overflow-hidden')}>
                        <StudioGraphic element={visualElement} />
                      </div>
                    ) : (
                    <div className="relative h-full w-full" style={{ filter: composeArtworkFilter(element) }}>
                    <FilteredImage
                      source={element.content}
                      settings={element.type === 'image' ? element.imageFilter : undefined}
                      tint={element.imageFilter?element.color:undefined}
                      alt={element.type === 'drawing' ? 'Drawing' : element.type === 'distress' ? 'Distress' : 'Artwork'}
                      className="h-full w-full object-fill"
                      style={{
                        ...artworkFlipStyle(element),
                        opacity: element.color && !element.imageFilter ? 0 : undefined,
                      }}
                    />
                    {element.color && !element.imageFilter && <div className="pointer-events-none absolute inset-0" style={{ background: paintCss(element.color), maskImage: `url("${element.content}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat', ...artworkFlipStyle(element) }} />}
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
                    className="pointer-events-auto z-40 block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-[3px] bg-transparent px-[3px] py-0 font-semibold caret-[#262626] [overflow-wrap:anywhere] focus:outline-none focus:ring-0"
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
                      onFrameChange={frame=>{if(elementsRef.current.find(item=>item.id===element.id)!==element)return;if(element.textFrameMode!=='point'||Math.abs(frame.width-element.width)<.05&&Math.abs(frame.height-element.height)<.05)return;const dx=(element.textAlign==='left'?(frame.width-element.width)/2:element.textAlign==='right'?(element.width-frame.width)/2:0)*(element.flipHorizontal?-1:1),dy=(frame.height-element.height)/2*(element.flipVertical?-1:1),angle=element.rotation*Math.PI/180;updateElement(element.id,{width:frame.width,height:frame.height,x:element.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:element.y+dx*Math.sin(angle)+dy*Math.cos(angle)},false,true);}}
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
                  <div className="pointer-events-none absolute -right-0.5 -top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[#262626]/50 bg-[#fafafa] text-[#262626]">
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
        </div></GarmentPatternReliefContext.Provider></GarmentPrintTextureContext.Provider></GarmentWearHostContext.Provider>
      </div>

    </div></ArtworkContextMenu.Trigger>{contextImageId&&<ArtworkContextMenu.Portal><ArtworkContextMenu.Content className="layer-actions-menu"><ArtworkContextMenu.Item onSelect={()=>{setSelectedId(contextImageId);studio.requestOutline(contextImageId)}}>Outline logo</ArtworkContextMenu.Item></ArtworkContextMenu.Content></ArtworkContextMenu.Portal>}</ArtworkContextMenu.Root>
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
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-[#e2e2e2] bg-[#f2f2f2]">
      <button
        onClick={onDecrease}
        className="flex h-9 w-9 items-center justify-center text-[#737373] transition hover:bg-[#f2f2f2] hover:text-[#262626]"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-[52px] text-center text-sm font-semibold text-[#262626]">{value}</div>
      <button
        onClick={onIncrease}
        className="flex h-9 w-9 items-center justify-center text-[#737373] transition hover:bg-[#f2f2f2] hover:text-[#262626]"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
