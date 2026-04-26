import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  FlipHorizontal2,
  Copy,
  Square,
  Lock,
  Unlock,
  RotateCw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Italic,
  Check,
  GripVertical,
} from 'lucide-react';
import imgBlackTshirt from 'figma:asset/5ee0ca76b195616586aa1b9f9185c6dec1cdd3a7.png';
import {
  snapDragInZone,
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
import { InlineElementToolbar } from './InlineElementToolbar';

export interface DesignElement {
  id: string;
  type: 'image' | 'text';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  /** Text blocks only */
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  /** Letter spacing in px */
  letterSpacing?: number;
  /** Outline width in px (0 = none) */
  borderWidth?: number;
  borderColor?: string;
  /** 0–100 */
  opacity?: number;
  /** Mirror artwork horizontally (images) */
  flipHorizontal?: boolean;
  /** Drop shadow blur (0 = none); follows glyph / image alpha */
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetY?: number;
  /** When true, print cannot be dragged on the preview */
  locked?: boolean;
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
}

interface PrintsDesignStepProps {
  elements: DesignElement[];
  onChange: (elements: DesignElement[]) => void;
  /** When set with `onSelectedLayerIdChange`, selection is controlled (sync with live preview). */
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
  /** Narrow / phone: horizontal scroll rows for key actions (Canva-style). */
  usePhoneStrips?: boolean;
}

interface PrintsDesignPreviewProps {
  elements: DesignElement[];
  onChange?: (elements: DesignElement[]) => void;
  editable?: boolean;
  className?: string;
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
  /** Parent scale (e.g. live preview `previewZoom/100`); inverses for toolbar and handles. */
  liveCanvasScale?: number;
  /** Phone: when the config sheet is collapsed, pin the *text* formatting bar above the soft keyboard. */
  phoneConfigSheetCollapsed?: boolean;
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

const DESIGN_PRESETS = ['Center Chest', 'Left Chest', 'Back Graphic', 'Full Front'];
export const PRINT_METHODS = [
  'DTG',
  'DTF',
  'Screen Print',
  'Embroidery',
  'Puff Print',
  'Heat Transfer',
] as const;

export const DEFAULT_PRINT_METHOD = PRINT_METHODS[0];

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
  type?: 'image' | 'text';
  borderWidth?: number;
  shadowBlur?: number;
}): boolean {
  if (el.type !== 'image') return false;
  return (el.borderWidth ?? 0) > 0 || (el.shadowBlur ?? 0) > 0;
}

/** CSS `filter` value pointing at the per-element SVG `<filter>` — or undefined when unused. */
export function getImageFilterStyle(el: {
  id: string;
  type?: 'image' | 'text';
  borderWidth?: number;
  shadowBlur?: number;
}): string | undefined {
  return hasImageFx(el) ? `url(#fx-${el.id})` : undefined;
}

/** Renders the per-element `<svg>` `<defs>` block. Place inside the same DOM subtree as the img. */
export function ImageFxDefs({
  element,
}: {
  element: {
    id: string;
    type?: 'image' | 'text';
    borderWidth?: number;
    borderColor?: string;
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetY?: number;
  };
}) {
  if (!hasImageFx(element)) return null;
  const bw = Math.max(0, element.borderWidth ?? 0);
  const bc = element.borderColor ?? '#FFFFFF';
  const sb = Math.max(0, element.shadowBlur ?? 0);
  const sc = element.shadowColor ?? '#000000';
  const so = element.shadowOffsetY ?? 6;
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id={`fx-${element.id}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
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
              <feFlood floodColor={bc} result="outlineFill" />
              <feComposite
                in="outlineFill"
                in2="outlineMask"
                operator="in"
                result="outlineShape"
              />
            </>
          ) : null}
          {sb > 0 ? (
            <>
              <feGaussianBlur in="SourceAlpha" stdDeviation={sb / 2} result="shadowBlur" />
              <feOffset in="shadowBlur" dx={0} dy={so} result="shadowOffset" />
              <feFlood floodColor={sc} result="shadowFill" />
              <feComposite
                in="shadowFill"
                in2="shadowOffset"
                operator="in"
                result="shadowShape"
              />
            </>
          ) : null}
          <feMerge>
            {sb > 0 ? <feMergeNode in="shadowShape" /> : null}
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
  const t = Math.max(0, Math.min(95, element.cropTop ?? 0));
  const r = Math.max(0, Math.min(95, element.cropRight ?? 0));
  const b = Math.max(0, Math.min(95, element.cropBottom ?? 0));
  const l = Math.max(0, Math.min(95, element.cropLeft ?? 0));
  const veil = 'rgba(4,6,12,0.62)';
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{ zIndex: 2 }}
    >
      {t > 0 ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${t}%`, background: veil }} />
      ) : null}
      {b > 0 ? (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${b}%`, background: veil }} />
      ) : null}
      {l > 0 ? (
        <div style={{ position: 'absolute', top: `${t}%`, bottom: `${b}%`, left: 0, width: `${l}%`, background: veil }} />
      ) : null}
      {r > 0 ? (
        <div style={{ position: 'absolute', top: `${t}%`, bottom: `${b}%`, right: 0, width: `${r}%`, background: veil }} />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: `${t}%`,
          bottom: `${b}%`,
          left: `${l}%`,
          right: `${r}%`,
          border: '1.5px dashed rgba(255,255,255,0.95)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.35)',
          boxSizing: 'border-box',
        }}
      >
        {(
          [
            { top: -1, left: -1, bt: true, bl: true },
            { top: -1, right: -1, bt: true, br: true },
            { bottom: -1, left: -1, bb: true, bl: true },
            { bottom: -1, right: -1, bb: true, br: true },
          ] as const
        ).map((corner, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              width: 14,
              height: 14,
              top: corner.top,
              left: corner.left,
              right: corner.right,
              bottom: corner.bottom,
              borderTop: corner.bt ? '3px solid #FFFFFF' : undefined,
              borderBottom: corner.bb ? '3px solid #FFFFFF' : undefined,
              borderLeft: corner.bl ? '3px solid #FFFFFF' : undefined,
              borderRight: corner.br ? '3px solid #FFFFFF' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Combined `clip-path: inset(t r b l round X%)` from crop fields + corner rounding.
 * Corner radius is stored as a percentage (0–50%) so the rounding scales with the element size,
 * matching Canva's "corner rounding" slider.
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
  const t = opts?.ignoreCrop ? 0 : Math.max(0, Math.min(49, el.cropTop ?? 0));
  const r = opts?.ignoreCrop ? 0 : Math.max(0, Math.min(49, el.cropRight ?? 0));
  const b = opts?.ignoreCrop ? 0 : Math.max(0, Math.min(49, el.cropBottom ?? 0));
  const l = opts?.ignoreCrop ? 0 : Math.max(0, Math.min(49, el.cropLeft ?? 0));
  // Pixel-based corner radius: applies an equal radius to both axes so non-square
  // images still get true round corners (percentages would produce elliptical ones).
  const rad = Math.max(0, Math.min(80, el.cornerRadius ?? 0));
  const hasCrop = t > 0 || r > 0 || b > 0 || l > 0;
  const hasRound = rad > 0;
  if (!hasCrop && !hasRound) return undefined;
  const roundPart = hasRound ? ` round ${rad}px` : '';
  return `inset(${t}% ${r}% ${b}% ${l}%${roundPart})`;
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
}: {
  onRotatePointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent, h: ResizeHandle) => void;
  uiInverseScale?: number;
  comfortableTouch?: boolean;
  compactHandles?: boolean;
  phoneTextMinimal?: boolean;
}) {
  const inv = uiInverseScale > 0 && Math.abs(uiInverseScale - 1) > 0.001 ? uiInverseScale : 1;
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
          className="pointer-events-none absolute rounded-md border-2 border-violet-500 bg-gradient-to-b from-violet-500/10 to-transparent"
          style={{ inset: '-1px' }}
        />
        <button
          type="button"
          aria-label="Scale from corner"
          className="pointer-events-auto absolute -left-1.5 -top-1.5 z-[60] h-3 w-3 touch-none rounded-full border-2 border-zinc-300/95 bg-white shadow-sm active:scale-95"
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
    'pointer-events-auto absolute z-[60] touch-none items-center justify-center rounded-full bg-[#0a0a0b] active:scale-95',
    compactHandles ? 'flex h-2.5 w-2.5 border border-[#CC2D24]' : 'border-2',
    !compactHandles && (large ? 'flex h-5 w-5' : 'flex h-3.5 w-3.5'),
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
        style={{ borderColor: `${HANDLE_RED}aa` }}
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
          'pointer-events-auto absolute left-1/2 z-[60] flex -translate-x-1/2 touch-none items-center justify-center rounded-full border-2 bg-[#0a0a0b] text-[#CC2D24] shadow-lg active:scale-95',
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[10px] font-semibold tabular-nums text-white/65">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
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
        className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 transition-colors focus-within:border-[#CC2D24]/55 focus-within:bg-black/60"
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
            if (Number.isFinite(n)) onChange(n);
            else setDraft(String(value));
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
}: PrintsDesignStepProps) {
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

  const allFontOptions = useMemo(
    () => [...FONT_OPTIONS, ...importedFontFamilies],
    [importedFontFamilies],
  );

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    onChange(elements.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)));
  };

  const updateFontSize = (delta: number) => {
    if (!selected || selected.type !== 'text') return;
    const next = Math.max(12, Math.min(96, (selected.fontSize ?? 30) + delta));
    updateSelected({
      fontSize: next,
      width: Math.max(110, Math.min(260, (selected.width || 170) + delta * 2)),
      height: Math.max(40, next + 18),
    });
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
          printMethod: DEFAULT_PRINT_METHOD,
        };
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
    const next: DesignElement = {
      id: `${Date.now()}`,
      type: 'text',
      content: textInput,
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
      shadowOffsetY: 6,
      locked: false,
      textAlign: 'center',
      fontStyle: 'normal',
      textTransform: 'none',
      letterSpacing: 0,
      printMethod: DEFAULT_PRINT_METHOD,
    };
    onChange([...elements, next]);
    setSelectedId(next.id);
    setTextInput('');
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const remaining = elements.filter((item) => item.id !== selectedId);
    onChange(remaining);
    setSelectedId(null);
  };

  const removeElementById = (id: string) => {
    const remaining = elements.filter((item) => item.id !== id);
    onChange(remaining);
    setSelectedId((sid) => (sid === id ? null : sid));
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: DesignElement = {
      ...selected,
      id: `${Date.now()}`,
      x: selected.x + 14,
      y: selected.y + 14,
      locked: false,
    };
    onChange([...elements, copy]);
    setSelectedId(copy.id);
  };

  const importFontFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.woff,.woff2,.ttf,.otf,font/woff,font/woff2';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\s-]+/g, '') || 'Font';
      const family = `Custom ${base}`.slice(0, 40);
      const unique = `${family}-${Date.now().toString(36)}`;
      try {
        const buf = await file.arrayBuffer();
        const face = new FontFace(unique, buf);
        await face.load();
        document.fonts.add(face);
        setImportedFontFamilies((prev) => (prev.includes(unique) ? prev : [...prev, unique]));
        if (selectedId && elements.find((x) => x.id === selectedId)?.type === 'text') {
          updateSelected({ fontFamily: unique });
        }
      } catch {
        /* invalid font */
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
    listDragFromIndexRef.current = elementsRef.current.findIndex((x) => x.id === elementId);
    if (listDragFromIndexRef.current < 0) listDragFromIndexRef.current = 0;

    setListDraggingId(elementId);
    setListDragOverId(elementId);
    setListDragDeltaY(0);

    const onMove = (ev: PointerEvent) => {
      const d = ev.clientY - listDragStartYRef.current;
      setListDragDeltaY(d);
      const els = elementsRef.current;
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

  const applyPreset = (preset: string) => {
    if (!selectedId) return;

    const placements: Record<string, Partial<DesignElement>> = {
      'Center Chest': { x: 160, y: 150, width: 150, height: 80 },
      'Left Chest': { x: 116, y: 138, width: 95, height: 56 },
      'Back Graphic': { x: 155, y: 150, width: 180, height: 180 },
      'Full Front': { x: 155, y: 172, width: 210, height: 210 },
    };

    updateSelected(placements[preset] || {});
  };

  const rotNorm = selected
    ? ((Math.round(selected.rotation) % 360) + 360) % 360
    : 0;

  const artBtnClass =
    'h-9 shrink-0 min-w-[6.5rem] border-white/18 bg-white/[0.04] px-2.5 text-[10px] !text-white hover:bg-white/10';
  const addTextClass = 'h-9 shrink-0 min-w-[6.5rem] bg-[#FF3B30] px-2.5 text-[10px] text-white hover:bg-[#FF3B30]/90';

  return (
    <div className="space-y-3.5">
      <PrintPanel title="Add artwork">
        {usePhoneStrips ? (
          <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x [-webkit-overflow-scrolling:touch]">
            <Button onClick={handleUploadImage} variant="outline" className={artBtnClass}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Button>
            <Button onClick={handleAddText} className={addTextClass}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add text
            </Button>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleUploadImage}
            variant="outline"
            className="h-9 border-white/18 bg-white/[0.04] px-2 text-[10px] !text-white hover:bg-white/10"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload
          </Button>
          <Button
            onClick={handleAddText}
            className="h-9 bg-[#FF3B30] px-2 text-[10px] text-white hover:bg-[#FF3B30]/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add text
          </Button>
        </div>
        )}
        <div className="mt-3">
          <Label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
            Text content
          </Label>
          <div className="flex gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type, then add"
              className="h-9 flex-1 border-white/12 bg-black/35 text-[11px] text-white placeholder:text-white/28"
              onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
            />
            <Button
              onClick={handleAddText}
              title="Add text to design"
              className="h-9 min-w-9 shrink-0 bg-[#FF3B30] px-2 hover:bg-[#FF3B30]/90"
              aria-label="Add text to design"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={importFontFile}
          className="mt-3 h-9 w-full border-white/18 bg-white/[0.04] px-2 text-[10px] !text-white hover:bg-white/10"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import font
        </Button>
      </PrintPanel>

      <PrintPanel title="Placement presets">
        {usePhoneStrips ? (
          <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
            {DESIGN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className="shrink-0 min-h-11 rounded-full border border-white/12 bg-black/30 px-4 py-2.5 text-left text-xs font-medium text-white/80 transition hover:border-white/25 hover:text-white"
              >
                {preset}
              </button>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          {DESIGN_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2.5 text-left text-[10px] font-medium text-white/72 transition hover:border-white/22 hover:text-white"
            >
              {preset}
            </button>
          ))}
        </div>
        )}
      </PrintPanel>

      {selected ? (
        <PrintPanel title="Selected element">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/45">
              {selected.type === 'image' ? 'Image' : 'Text'}
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
                          : 'border-white/10 bg-black/30 text-white/70 hover:border-white/20 hover:text-white',
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
                        : 'border-white/10 bg-black/25 text-white/68 hover:border-white/20 hover:text-white',
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

            {selected.type === 'text' && (
              <>
                <div>
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
                              : 'border-white/10 bg-black/25 text-white/68 hover:border-white/20 hover:text-white',
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
                            : 'border-white/10 bg-black/25 text-white/68 hover:border-white/20 hover:text-white',
                        )}
                        style={{ fontFamily: font }}
                      >
                        {font.startsWith('Custom ') ? font.split('-')[0]?.trim() ?? font : font}
                      </button>
                    ))}
                  </div>
                  )}
                </div>

                <div>
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
                            : 'border-white/10 bg-black/25 hover:border-white/20 hover:text-white',
                        )}
                        aria-label={`Align ${align}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
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

                <div>
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

                <div>
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Font size
                  </Label>
                  <NumberStepper
                    value={selected.fontSize ?? 30}
                    onDecrease={() => updateFontSize(-1)}
                    onIncrease={() => updateFontSize(1)}
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Text colour
                  </Label>
                  <StudioColorField
                    value={selected.color ?? '#FFFFFF'}
                    onChange={(h) => updateSelected({ color: h })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                  />
                </div>
              </>
            )}

            <div>
              <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                Rotation
              </Label>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
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
            </div>

            <SliderField
              label="Opacity"
              value={selected.opacity ?? 100}
              min={15}
              max={100}
              suffix="%"
              onChange={(n) => updateSelected({ opacity: n })}
            />

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  {selected.type === 'text' ? 'Text outline' : 'Border'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateSelected({
                      borderWidth: (selected.borderWidth ?? 0) > 0 ? 0 : 2,
                      borderColor: selected.borderColor ?? '#FFFFFF',
                    })
                  }
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
                <StudioColorField
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
                    max={80}
                    suffix="px"
                    onChange={(n) => updateSelected({ cornerRadius: n })}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Size &amp; rotation
                </span>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <SidebarNumberField
                  label="Width"
                  suffix="px"
                  value={Math.round(selected.width || 0)}
                  onChange={(v) => {
                    const next = Math.max(8, Math.min(1200, v));
                    const ratio =
                      selected.type === 'image' && selected.height
                        ? selected.width / selected.height
                        : 0;
                    const patch =
                      ratio > 0
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
                    const ratio =
                      selected.type === 'image' && selected.height
                        ? selected.width / selected.height
                        : 0;
                    const patch =
                      ratio > 0
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
            </div>

            {selected.type === 'image' ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
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
                  label="Blur"
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
                  <StudioColorField
                    value={selected.shadowColor ?? '#000000'}
                    onChange={(h) => updateSelected({ shadowColor: h })}
                    mainColors={STUDIO_TEXT_MAIN_COLORS}
                    popularColors={STUDIO_TEXT_POPULAR_COLORS}
                  />
                </div>
              </div>
            ) : null}

            {selected.type === 'image' ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                    Crop
                  </span>
                  {((selected.cropTop ?? 0) > 0 ||
                    (selected.cropRight ?? 0) > 0 ||
                    (selected.cropBottom ?? 0) > 0 ||
                    (selected.cropLeft ?? 0) > 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateSelected({
                          cropTop: 0,
                          cropRight: 0,
                          cropBottom: 0,
                          cropLeft: 0,
                        })
                      }
                      className="h-7 border-white/18 px-2 text-[9px] !text-white hover:bg-white/10"
                    >
                      Reset
                    </Button>
                  )}
                </div>
                <SliderField
                  label="Top"
                  value={selected.cropTop ?? 0}
                  min={0}
                  max={Math.max(0, 95 - (selected.cropBottom ?? 0))}
                  suffix="%"
                  onChange={(n) => updateSelected({ cropTop: n })}
                />
                <div className="mt-3">
                  <SliderField
                    label="Right"
                    value={selected.cropRight ?? 0}
                    min={0}
                    max={Math.max(0, 95 - (selected.cropLeft ?? 0))}
                    suffix="%"
                    onChange={(n) => updateSelected({ cropRight: n })}
                  />
                </div>
                <div className="mt-3">
                  <SliderField
                    label="Bottom"
                    value={selected.cropBottom ?? 0}
                    min={0}
                    max={Math.max(0, 95 - (selected.cropTop ?? 0))}
                    suffix="%"
                    onChange={(n) => updateSelected({ cropBottom: n })}
                  />
                </div>
                <div className="mt-3">
                  <SliderField
                    label="Left"
                    value={selected.cropLeft ?? 0}
                    min={0}
                    max={Math.max(0, 95 - (selected.cropRight ?? 0))}
                    suffix="%"
                    onChange={(n) => updateSelected({ cropLeft: n })}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => updateSelected({ flipHorizontal: !selected.flipHorizontal })}
                className="h-9 border-white/18 px-2 text-[10px] !text-white hover:bg-white/10"
              >
                <FlipHorizontal2 className="mr-1.5 h-3 w-3" />
                Flip
              </Button>
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

      <PrintPanel title={`Elements (${elements.length})`}>
        <div className={cn('space-y-2', listDraggingId && 'list-reorder-active')}>
          {elements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 px-3 py-4 text-center text-[11px] leading-relaxed text-white/38">
              Upload artwork or add text, then drag on the preview.
            </div>
          ) : (
            (() => {
              const sourceIndex = listDraggingId
                ? elements.findIndex((el) => el.id === listDraggingId)
                : -1;
              const targetIndex =
                listDraggingId && listDragOverId
                  ? elements.findIndex((el) => el.id === listDragOverId)
                  : -1;
              const rowH = listDragRowHeightRef.current;
              return elements.map((element, index) => {
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
                    elements.length,
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
                        : 'border-white/10 bg-black/25 hover:border-white/18',
                  )}
                >
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
                    onClick={() => setSelectedId(element.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-0.5 pr-2 text-left"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-white/55">
                      {element.type === 'image' ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-white">
                        {element.type === 'image' ? 'Uploaded artwork' : element.content}
                      </div>
                      <div className="truncate text-[9.5px] text-white/40">
                        <span className="text-white/55">
                          {element.printMethod ?? DEFAULT_PRINT_METHOD}
                        </span>
                        {' · '}
                        {Math.round(element.x)}, {Math.round(element.y)} ·{' '}
                        {Math.round(element.rotation)}°
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="flex shrink-0 items-center justify-center rounded-r-[8px] border-l border-white/10 px-2 text-white/35 transition hover:bg-white/[0.08] hover:text-[#FF3B30]"
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
  elements,
  onChange,
  editable = false,
  className,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
  liveCanvasScale: liveCanvasScaleProp,
  phoneConfigSheetCollapsed = false,
}: PrintsDesignPreviewProps) {
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
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const dragStartClientRef = useRef({ x: 0, y: 0 });
  const dragDidMoveRef = useRef(false);
  const dragPointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const textTapRef = useRef<{ id: string; alreadySelected: boolean } | null>(null);
  const editDraftRef = useRef('');
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

  const updateElement = (id: string, patch: Partial<DesignElement>) => {
    const fn = onChangeRef.current;
    if (!fn) return;
    fn(elementsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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
    const draft = editDraftRef.current.trim();
    if (draft.length === 0 && el?.type === 'text') {
      removeElement(editingTextId);
      setEditingTextId(null);
      return;
    }
    const fn = onChangeRef.current;
    const next = draft.length > 0 ? draft : (el?.content ?? '');
    if (fn && el) {
      fn(
        elementsRef.current.map((item) =>
          item.id === editingTextId ? { ...item, content: next } : item,
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
    fn([...elementsRef.current, copy]);
    setSelectedId(copy.id);
  };

  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"], select')) return;
      if (editingTextId) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
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
  }, [editable, selectedId, editingTextId, setSelectedId]);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  useEffect(() => {
    if (!manip || !editable) return;

    const onMove = (e: PointerEvent) => {
      if (manip.kind === 'rotate') {
        const cur = Math.atan2(e.clientY - manip.cy, e.clientX - manip.cx);
        const deltaDeg = ((cur - manip.startAngle) * 180) / Math.PI;
        let next = manip.startRot + deltaDeg;
        next = ((next % 360) + 360) % 360;
        updateElement(manip.id, { rotation: next });
        return;
      }
      const z = zoneRef.current;
      const s = z ? zoneScaleFactor(z) : 1;
      const dx = (e.clientX - manip.startX) / s;
      const dy = (e.clientY - manip.startY) / s;
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

      const snapBoxes: SnapBox[] = elementsRef.current.map((el) => ({
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
          setEditingTextId(el.id);
          setEditDraft(el.content);
          editDraftRef.current = el.content;
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
  const showInlineToolbar = Boolean(editable && selectedElement);
  /** Phone: text styling is sidebar-only — no floating inline bar. */
  const phoneTextUsesSidebarOnly =
    narrowViewport && showInlineToolbar && selectedElement?.type === 'text';
  const showCanvasChromeToolbar = Boolean(
    showInlineToolbar && selectedElement && !phoneTextUsesSidebarOnly,
  );
  /** Element whose Crop panel is currently open — we render the full image + dim overlay. */
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);

  const liveCanvasS = liveCanvasScaleProp && liveCanvasScaleProp > 0 ? liveCanvasScaleProp : 1;
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
                <InlineElementToolbar
                  element={selectedElement}
                  onPatch={(patch) => updateElement(selectedElement.id, patch)}
                  onDuplicate={() => duplicateElement(selectedElement.id)}
                  onDelete={() => removeElement(selectedElement.id)}
                  compact
                  comfortableCompact
                  variant="slim"
                  className="!max-w-[min(18.5rem,calc(100vw-5.75rem))] sm:!max-w-[min(22rem,calc(100vw-2rem))]"
                  onCropModeChange={(cropping) =>
                    setCropEditingId(cropping ? selectedElement.id : null)
                  }
                />
              </div>
            </div>,
            document.body,
          )
        : null}
      <div
        className={cn(
          'relative min-h-0 w-full flex-1',
          narrowViewport && editable && 'overflow-hidden rounded-xl',
        )}
      >
        <div className="relative h-full w-full">
        <img
          src={imgBlackTshirt}
          alt="Garment preview"
          className="h-auto max-h-full w-full object-contain opacity-0"
        />

        <div className="absolute inset-0 flex min-h-0 flex-col">
          {narrowViewport &&
          editable &&
          selectedElement?.type === 'text' &&
          editingTextId !== selectedElement.id ? (
            <p className="pointer-events-none shrink-0 px-2 pb-1.5 text-center text-[10px] leading-tight text-white/48">
              Tap the text on the design again to edit, or drag to move it.
            </p>
          ) : null}
          {editable &&
          !narrowViewport &&
          showCanvasChromeToolbar &&
          selectedElement &&
          (selectedElement.type !== 'text' || editingTextId !== selectedElement.id) ? (
            <div className="pointer-events-none relative z-[100] flex shrink-0 justify-center overflow-visible px-2 pt-2 pb-1">
              {/*
                Do not set overflow-x on this wrapper: overflow-x other than visible forces overflow-y
                to auto and clips the colour/font popovers (absolutely positioned under the bar).
                Horizontal scroll is handled inside InlineElementToolbar on the button row.
              */}
              <div className="pointer-events-auto min-w-0 max-w-full [-webkit-overflow-scrolling:touch]">
                <InlineElementToolbar
                  element={selectedElement}
                  onPatch={(patch) => updateElement(selectedElement.id, patch)}
                  onDuplicate={() => duplicateElement(selectedElement.id)}
                  onDelete={() => removeElement(selectedElement.id)}
                  variant="slim"
                  onCropModeChange={(cropping) =>
                    setCropEditingId(cropping ? selectedElement.id : null)
                  }
                />
              </div>
            </div>
          ) : null}
          <div
            className="relative z-0 min-h-0 flex-1"
            onPointerDown={(e) => {
              if (!editable) return;
              const t = e.target as HTMLElement;
              if (t.closest('[data-print-id]') || t.closest('[data-handles]')) return;
              if (t.closest('[data-inline-toolbar]')) return;
              if (t.closest('[data-inline-toolbar-popover]')) return;
              setSelectedId(null);
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={imgBlackTshirt}
            alt="Garment"
            className="h-full max-h-full w-full object-contain"
          />

          <div
            ref={zoneRef}
            data-print-design-zone
            className={cn('absolute overflow-visible', editable && 'touch-none')}
            style={{
              left: `${PREVIEW_ZONE.left}%`,
              right: `${PREVIEW_ZONE.right}%`,
              top: `${PREVIEW_ZONE.top}%`,
              bottom: `${PREVIEW_ZONE.bottom}%`,
            }}
          >
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
          {elements.map((element) => {
            const selected = selectedId === element.id;

            const bw = element.borderWidth ?? 0;
            const bc = element.borderColor ?? '#FFFFFF';
            const op = (element.opacity ?? 100) / 100;
            const locked = element.locked === true;
            const isEditingText = editingTextId === element.id;
            const displayFont = (() => {
              const base = element.fontSize ?? 30;
              if (!narrowViewport) return base;
              return Math.max(12, Math.round(base * 0.78));
            })();
            /** iOS zooms the page on focus if input font is under 16px — avoid while editing. */
            const editFontSize = narrowViewport ? Math.max(16, displayFont) : displayFont;

            const isHeld = draggingId === element.id && editable && !locked;
            const liveX =
              isHeld && dragLivePos ? dragLivePos.x : element.x;
            const liveY =
              isHeld && dragLivePos ? dragLivePos.y : element.y;

            return (
              <div
                key={element.id}
                data-print-id={element.id}
                className={cn(
                  'absolute canvas-element-drag',
                  draggingId === element.id && 'z-[15]',
                  isHeld && 'canvas-element-held',
                  editable && !isEditingText && (locked ? 'cursor-default' : 'cursor-grab'),
                  editable && !isEditingText && 'select-none touch-none',
                )}
                style={{
                  left: liveX,
                  top: liveY,
                  width:
                    element.type === 'text'
                      ? element.autoWidth === false
                        ? element.width
                        : 'max-content'
                      : element.width,
                  maxWidth: element.type === 'text' ? element.width : undefined,
                  minWidth: element.type === 'text' ? 0 : undefined,
                  height:
                    element.type === 'image'
                      ? element.height
                      : element.autoHeight === false
                        ? element.height
                        : undefined,
                  opacity: op,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
                onPointerDown={(e) => {
                  if (!editable) return;
                  const t = e.target as HTMLElement;
                  if (t.closest('[data-handles]') || t.closest('[data-inline-toolbar]')) return;
                  e.stopPropagation();
                  const wasSel = selectedId === element.id;
                  setSelectedId(element.id);
                  textTapRef.current = { id: element.id, alreadySelected: wasSel };
                  dragStartClientRef.current = { x: e.clientX, y: e.clientY };
                  dragDidMoveRef.current = false;
                  if (locked) return;
                  e.preventDefault();
                  const zone = zoneRef.current;
                  if (!zone) return;
                  const ptr = clientToZonePoint(zone, e.clientX, e.clientY);
                  setManip(null);
                  setDraggingId(element.id);
                  setDragOffset({ x: ptr.x - element.x, y: ptr.y - element.y });
                  try {
                    const el = e.currentTarget as HTMLElement;
                    el.setPointerCapture(e.pointerId);
                    dragPointerCaptureRef.current = { el, pointerId: e.pointerId };
                  } catch {
                    dragPointerCaptureRef.current = null;
                  }
                }}
              >
                {element.type === 'image' ? (
                  <>
                    <ImageFxDefs element={element} />
                    <img
                      src={element.content}
                      alt="Artwork"
                      className="h-full w-full object-contain"
                      style={{
                        transform: element.flipHorizontal ? 'scaleX(-1)' : undefined,
                        clipPath: buildImageClipPath(element, {
                          ignoreCrop: cropEditingId === element.id,
                        }),
                        filter: getImageFilterStyle(element),
                      }}
                    />
                    {cropEditingId === element.id ? (
                      <CropEditingOverlay element={element} />
                    ) : null}
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
                      setEditDraft(ev.target.value);
                      editDraftRef.current = ev.target.value;
                    }}
                    onBlur={() => {
                      const trimmed = editDraftRef.current.trim();
                      if (trimmed.length === 0) {
                        removeElement(element.id);
                        setEditingTextId(null);
                        return;
                      }
                      updateElement(element.id, { content: trimmed });
                      setEditingTextId(null);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Escape') {
                        setEditDraft(element.content);
                        editDraftRef.current = element.content;
                        setEditingTextId(null);
                      }
                      ev.stopPropagation();
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    rows={1}
                    className="z-40 block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-[3px] bg-transparent px-[3px] py-0 font-semibold caret-[#FF3B30] [overflow-wrap:anywhere] focus:outline-none focus:ring-0"
                    style={{
                      color: element.color ?? '#FFFFFF',
                      fontFamily: element.fontFamily ?? 'Inter',
                      fontSize: editFontSize,
                      lineHeight: 1.15,
                      maxWidth: element.width,
                      minHeight: element.autoHeight === false ? element.height : undefined,
                      textAlign: element.textAlign ?? 'center',
                      fontStyle: element.fontStyle ?? 'normal',
                      textTransform: element.textTransform ?? 'none',
                      letterSpacing:
                        element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
                      outline: '1px solid rgba(255, 59, 48, 0.55)',
                      outlineOffset: '2px',
                    }}
                  />
                ) : (
                  <div className="relative inline-block min-w-0 max-w-full">
                    <div
                      data-text-body
                      onDoubleClick={(ev) => {
                        if (!editable || locked) return;
                        ev.stopPropagation();
                        ev.preventDefault();
                        setSelectedId(element.id);
                        setEditingTextId(element.id);
                        setEditDraft(element.content);
                        editDraftRef.current = element.content;
                        setDraggingId(null);
                        textTapRef.current = null;
                      }}
                      className="whitespace-normal break-words font-semibold [overflow-wrap:anywhere]"
                      style={{
                        color: element.color ?? '#FFFFFF',
                        fontFamily: element.fontFamily ?? 'Inter',
                        fontSize: displayFont,
                        lineHeight: 1.15,
                        maxWidth: element.width,
                        minHeight: element.autoHeight === false ? element.height : undefined,
                        textAlign: element.textAlign ?? 'center',
                        fontStyle: element.fontStyle ?? 'normal',
                        textTransform: element.textTransform ?? 'none',
                        letterSpacing:
                          element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
                        transform: element.flipHorizontal ? 'scaleX(-1)' : undefined,
                        WebkitTextStroke: bw > 0 ? `${bw}px ${bc}` : undefined,
                        paintOrder: bw > 0 ? ('stroke fill' as const) : undefined,
                      }}
                    >
                      {element.content}
                    </div>
                  </div>
                )}
                {selected && editable && !locked && !isEditingText ? (
                  <>
                    <PrintTransformOverlay
                      compactHandles={narrowViewport && element.type !== 'text'}
                      phoneTextMinimal={narrowViewport && element.type === 'text'}
                      uiInverseScale={uiInv}
                      onRotatePointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const z = zoneRef.current;
                        if (!z) return;
                        const c = zonePointToClient(z, element.x, element.y);
                        const startAngle = Math.atan2(e.clientY - c.y, e.clientX - c.x);
                        setDraggingId(null);
                        setManip({
                          kind: 'rotate',
                          id: element.id,
                          startRot: element.rotation,
                          cx: c.x,
                          cy: c.y,
                          startAngle,
                        });
                      }}
                      onResizePointerDown={(e, handle) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDraggingId(null);
                        setManip({
                          kind: 'resize',
                          id: element.id,
                          handle,
                          startX: e.clientX,
                          startY: e.clientY,
                          startW: element.width,
                          startH: element.height,
                          startFontSize: element.fontSize ?? 30,
                          isImage: element.type === 'image',
                        });
                      }}
                    />
                  </>
                ) : null}
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