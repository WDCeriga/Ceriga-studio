import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Upload,
  Type,
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
  Palette,
  Check,
} from 'lucide-react';
import imgBlackTshirt from 'figma:asset/5ee0ca76b195616586aa1b9f9185c6dec1cdd3a7.png';
import {
  snapDragInZone,
  GUIDE_COLOR,
  type SnapBox,
  type SnapDragOptions,
} from '../../lib/designSnapGuides';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

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
}

interface PrintsDesignStepProps {
  elements: DesignElement[];
  onChange: (elements: DesignElement[]) => void;
  /** When set with `onSelectedLayerIdChange`, selection is controlled (sync with live preview). */
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
}

interface PrintsDesignPreviewProps {
  elements: DesignElement[];
  onChange?: (elements: DesignElement[]) => void;
  editable?: boolean;
  className?: string;
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
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

/** Print-area inset on the shirt overlay (%). Tuned for chest-centre vs garment art. */
const PREVIEW_ZONE = {
  left: 6,
  top: 7,
  right: 6,
  bottom: 7,
};

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

function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const hn = ((h % 360) + 360) % 360;
  const Hp = hn / 60;
  const X = C * (1 - Math.abs((Hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (Hp >= 0 && Hp < 1) {
    r = C;
    g = X;
  } else if (Hp < 2) {
    r = X;
    g = C;
  } else if (Hp < 3) {
    g = C;
    b = X;
  } else if (Hp < 4) {
    g = X;
    b = C;
  } else if (Hp < 5) {
    r = X;
    b = C;
  } else {
    r = C;
    b = X;
  }
  const m = L - C / 2;
  const R = Math.round(Math.min(255, Math.max(0, (r + m) * 255)));
  const G = Math.round(Math.min(255, Math.max(0, (g + m) * 255)));
  const B = Math.round(Math.min(255, Math.max(0, (b + m) * 255)));
  return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`.toUpperCase();
}

function buildPrintTextColourSwatches(): string[] {
  const set = new Set<string>();
  for (let i = 0; i <= 32; i++) {
    const v = Math.round((i / 32) * 255);
    const x = v.toString(16).padStart(2, '0');
    set.add(`#${x}${x}${x}`);
  }
  for (let h = 0; h < 360; h += 12) {
    for (const s of [38, 58, 78, 95, 100]) {
      for (const l of [26, 40, 52, 64, 76, 86]) {
        set.add(hslToHex(h, s, l));
      }
    }
  }
  return Array.from(set);
}

const PRINT_TEXT_COLOUR_SWATCHES = buildPrintTextColourSwatches();

function normalizeHex6(input: string | undefined, fallback = '#FFFFFF'): string {
  let h = (input ?? fallback).trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    const a = h.slice(1);
    h = `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`;
  }
  if (/^#[0-9A-Fa-f]{6}$/i.test(h)) return h.toUpperCase();
  return fallback.toUpperCase();
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex6(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clamp255(x).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max <= 1e-9 ? 0 : d / max;
  let h = 0;
  if (d > 1e-9) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h: ((h % 360) + 360) % 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}

function PrintTextColourPopover({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const hex = normalizeHex6(value);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsv(r, g, b);
  });
  const svRef = useRef<HTMLDivElement>(null);
  const dragSv = useRef(false);

  useEffect(() => {
    if (!open) return;
    const { r, g, b } = hexToRgb(normalizeHex6(value));
    setHsv(rgbToHsv(r, g, b));
  }, [open, value]);

  const commitHsv = (next: { h?: number; s?: number; v?: number }) => {
    const n = { ...hsv, ...next };
    setHsv(n);
    const rgb = hsvToRgb(n.h, n.s, n.v);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const pickSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const sx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const sy = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    commitHsv({ s: sx, v: 1 - sy });
  };

  const hue = hsv.h;
  const rgb = hexToRgb(hex);

  const commitRgb = (r: number, g: number, b: number) => {
    onChange(rgbToHex(r, g, b));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-10 w-14 shrink-0 overflow-hidden rounded-xl border border-white/18 bg-black/40 shadow-inner transition hover:border-white/38"
          aria-label="Open text colour picker"
        >
          <span className="absolute inset-0" style={{ backgroundColor: hex }} aria-hidden />
          <Palette
            className="absolute bottom-1 right-1 h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(calc(100vw-2rem),260px)] border border-white/12 bg-[#121212] p-3 text-white shadow-xl"
      >
        <div className="relative touch-none">
          <div
            ref={svRef}
            role="presentation"
            className="relative h-36 w-full cursor-crosshair overflow-hidden rounded-lg border border-white/10"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${Math.round(hue)}, 100%, 50%)`,
            }}
            onPointerDown={(e) => {
              dragSv.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              pickSv(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!dragSv.current) return;
              pickSv(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              dragSv.current = false;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* released */
              }
            }}
            onPointerCancel={() => {
              dragSv.current = false;
            }}
          />
          <div
            className="pointer-events-none absolute h-3 w-3 rounded-full border-2 border-white shadow-md"
            style={{
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(hue)}
            onChange={(e) => commitHsv({ h: Number(e.target.value) })}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full accent-[#CC2D24]"
            style={{
              background:
                'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
            }}
            aria-label="Hue"
          />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/45">RGB</span>
            <span className="font-mono text-[10px] text-white/55">{hex}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['R', 'r', rgb.r] as const,
                ['G', 'g', rgb.g] as const,
                ['B', 'b', rgb.b] as const,
              ]
            ).map(([label, key, channel]) => (
              <div key={key}>
                <label className="mb-1 block text-center text-[9px] font-medium text-white/40">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={channel}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(255, Math.round(Number(e.target.value) || 0)));
                    const next = { ...rgb, [key]: n };
                    commitRgb(next.r, next.g, next.b);
                  }}
                  className="h-8 w-full rounded-lg border border-white/12 bg-black/50 px-1 text-center font-mono text-[11px] tabular-nums text-white outline-none focus:border-[#CC2D24]/80 focus:ring-1 focus:ring-[#CC2D24]/35"
                />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-white/40">
          Drag the square for saturation and brightness, use the strip for hue, or type RGB values.
        </p>
      </PopoverContent>
    </Popover>
  );
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
}: {
  onRotatePointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent, h: ResizeHandle) => void;
}) {
  const dot =
    'absolute z-30 flex h-3.5 w-3.5 touch-none items-center justify-center rounded-full border-2 bg-[#0a0a0b] active:scale-95';
  const dotStyle = { borderColor: HANDLE_RED, boxShadow: `0 0 0 1px ${HANDLE_RED}40` };
  return (
    <div data-handles className="contents">
      <div
        className="pointer-events-none absolute inset-[-7px] rounded-2xl border bg-gradient-to-b from-[#CC2D24]/12 to-transparent"
        style={{ borderColor: `${HANDLE_RED}aa` }}
      />
      <button
        type="button"
        aria-label="Resize NW — scale"
        className={cn(dot, '-left-2 -top-2 cursor-nwse-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'nw')}
      />
      <button
        type="button"
        aria-label="Resize NE — scale"
        className={cn(dot, '-right-2 -top-2 cursor-nesw-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'ne')}
      />
      <button
        type="button"
        aria-label="Resize SW — scale"
        className={cn(dot, '-bottom-2 -left-2 cursor-nesw-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'sw')}
      />
      <button
        type="button"
        aria-label="Resize SE — scale"
        className={cn(dot, '-bottom-2 -right-2 cursor-nwse-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'se')}
      />
      <button
        type="button"
        aria-label="Stretch width — east"
        className={cn(dot, '-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'e')}
      />
      <button
        type="button"
        aria-label="Stretch width — west"
        className={cn(dot, '-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'w')}
      />
      <button
        type="button"
        aria-label="Stretch height — north"
        className={cn(dot, '-top-2 left-1/2 -translate-x-1/2 cursor-ns-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 'n')}
      />
      <button
        type="button"
        aria-label="Stretch height — south"
        className={cn(dot, '-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize')}
        style={dotStyle}
        onPointerDown={(e) => onResizePointerDown(e, 's')}
      />
      <button
        type="button"
        aria-label="Rotate"
        className="absolute -bottom-11 left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 touch-none items-center justify-center rounded-full border-2 bg-[#0a0a0b] text-[#CC2D24] active:scale-95"
        style={{ borderColor: HANDLE_RED, boxShadow: '0 6px 22px rgba(0,0,0,0.45)' }}
        onPointerDown={onRotatePointerDown}
      >
        <RotateCw className="h-4 w-4" />
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
    <div className={cn('rounded-2xl border border-white/[0.07] bg-black/30 p-4', className)}>
      <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/38">{title}</div>
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

export function PrintsDesignStep({
  elements,
  onChange,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
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
  const selected = useMemo(
    () => elements.find((item) => item.id === selectedId) ?? null,
    [elements, selectedId],
  );

  useEffect(() => {
    if (elements.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && !elements.some((e) => e.id === selectedId)) {
      setSelectedId(elements[0]!.id);
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
    setSelectedId(remaining[0]?.id ?? null);
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

  return (
    <div className="space-y-3.5">
      <PrintPanel title="Add artwork">
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
            </div>

            {selected.type === 'text' && (
              <>
                <div>
                  <Label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                    Font
                  </Label>
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
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <PrintTextColourPopover
                      value={selected.color ?? '#FFFFFF'}
                      onChange={(h) => updateSelected({ color: h })}
                    />
                    <Input
                      key={`hex-${selectedId}-${normalizeHex6(selected.color)}`}
                      type="text"
                      defaultValue={normalizeHex6(selected.color)}
                      onBlur={(e) => updateSelected({ color: normalizeHex6(e.target.value) })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          updateSelected({
                            color: normalizeHex6((e.target as HTMLInputElement).value),
                          });
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="#FFFFFF"
                      spellCheck={false}
                      className="h-10 min-w-0 flex-1 border-white/12 bg-black/35 font-mono text-[11px] text-white placeholder:text-white/28"
                      aria-label="Hex colour"
                    />
                  </div>
                  <div className="flex max-h-[min(52vh,420px)] flex-wrap gap-1.5 overflow-y-auto pr-0.5 [-webkit-overflow-scrolling:touch]">
                    {PRINT_TEXT_COLOUR_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateSelected({ color })}
                        className={cn(
                          'h-7 w-7 shrink-0 rounded-md border transition-all',
                          normalizeHex6(selected.color) === color
                            ? 'border-[#FF3B30] ring-2 ring-[#FF3B30]/40'
                            : 'border-white/15 hover:border-white/35',
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={`Colour ${color}`}
                      />
                    ))}
                  </div>
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
                <div className="flex max-h-[min(36vh,360px)] flex-wrap gap-1.5 overflow-y-auto pr-0.5 [-webkit-overflow-scrolling:touch]">
                  {PRINT_TEXT_COLOUR_SWATCHES.map((color) => (
                    <button
                      key={`outline-${color}`}
                      type="button"
                      onClick={() => updateSelected({ borderColor: color })}
                      className={cn(
                        'h-7 w-7 shrink-0 rounded-md border transition-all',
                        normalizeHex6(selected.borderColor ?? '#FFFFFF') === color
                          ? 'border-[#FF3B30] ring-2 ring-[#FF3B30]/40'
                          : 'border-white/15 hover:border-white/35',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Outline colour ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

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
        <div className="space-y-2">
          {elements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/12 px-3 py-6 text-center text-[11px] leading-relaxed text-white/38">
              Upload artwork or add text, then drag on the preview.
            </div>
          ) : (
            elements.map((element) => (
              <button
                key={element.id}
                type="button"
                onClick={() => setSelectedId(element.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                  selectedId === element.id
                    ? 'border-[#FF3B30] bg-[#FF3B30]/10'
                    : 'border-white/10 bg-black/25 hover:border-white/18',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/55">
                  {element.type === 'image' ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <Type className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-white">
                    {element.type === 'image' ? 'Uploaded artwork' : element.content}
                  </div>
                  <div className="text-[10px] text-white/40">
                    <span className="text-white/50">{element.printMethod ?? DEFAULT_PRINT_METHOD}</span>
                    {' · '}
                    {Math.round(element.x)}, {Math.round(element.y)} · {Math.round(element.rotation)}°
                  </div>
                </div>
              </button>
            ))
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
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
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
  const deleteRef = useRef<HTMLDivElement>(null);
  const deleteHoverRef = useRef(false);
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const dragStartClientRef = useRef({ x: 0, y: 0 });
  const dragDidMoveRef = useRef(false);
  const textTapRef = useRef<{ id: string; alreadySelected: boolean } | null>(null);
  const editDraftRef = useRef('');
  const [alignmentGuides, setAlignmentGuides] = useState<{
    vertical: number[];
    horizontal: number[];
  } | null>(null);

  useLayoutEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useLayoutEffect(() => {
    if (!editingTextId) return;
    editAreaRef.current?.focus();
    editAreaRef.current?.select();
  }, [editingTextId]);

  useEffect(() => {
    if (!editingTextId || selectedId === editingTextId) return;
    const fn = onChangeRef.current;
    const el = elementsRef.current.find((item) => item.id === editingTextId);
    const draft = editDraftRef.current.trim();
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

  useEffect(() => {
    if (elements.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && !elements.some((e) => e.id === selectedId)) {
      setSelectedId(elements[0]!.id);
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
          updateElement(manip.id, { width: nw, height: nh, fontSize: nfs });
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
      if (h === 'e') updateElement(manip.id, { width: clamp(manip.startW + dx, 48, 440) });
      else if (h === 'w') updateElement(manip.id, { width: clamp(manip.startW - dx, 48, 440) });
      else if (h === 's')
        updateElement(manip.id, { height: clamp(manip.startH + dy, 28, 360) });
      else if (h === 'n')
        updateElement(manip.id, { height: clamp(manip.startH - dy, 28, 360) });
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

    const handleMove = (e: PointerEvent) => {
      const zone = zoneRef.current;
      if (!zone) return;

      const zr = zone.getBoundingClientRect();
      const current = elementsRef.current.find((item) => item.id === draggingId);
      if (!current || current.locked) return;

      if (
        Math.hypot(
          e.clientX - dragStartClientRef.current.x,
          e.clientY - dragStartClientRef.current.y,
        ) > 5
      ) {
        dragDidMoveRef.current = true;
      }

      const node = zone.querySelector(`[data-print-id="${draggingId}"]`) as HTMLElement | null;
      const br = node?.getBoundingClientRect();
      const w = br?.width ?? Math.max(32, current.width);
      const h = br?.height ?? Math.max(24, current.height);

      const p = clientToZonePoint(zone, e.clientX, e.clientY);
      const nx = p.x - dragOffset.x;
      const ny = p.y - dragOffset.y;
      const halfW = w / 2;
      const halfH = h / 2;

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
        zr.width,
        zr.height,
        draggingId,
        snapBoxes,
        PREVIEW_SNAP_CENTER_NUDGE,
      );
      setAlignmentGuides({
        vertical: snapped.verticalLines,
        horizontal: snapped.horizontalLines,
      });

      updateElement(draggingId, {
        x: snapped.x,
        y: snapped.y,
      });

      if (deleteRef.current) {
        const dr = deleteRef.current.getBoundingClientRect();
        const over =
          e.clientX >= dr.left &&
          e.clientX <= dr.right &&
          e.clientY >= dr.top &&
          e.clientY <= dr.bottom;
        deleteHoverRef.current = over;
        setIsOverDeleteZone(over);
      }
    };

    const handleUp = () => {
      if (draggingId && deleteHoverRef.current) {
        removeElement(draggingId);
      } else if (
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
      textTapRef.current = null;
      deleteHoverRef.current = false;
      dragDidMoveRef.current = false;
      setDraggingId(null);
      setIsOverDeleteZone(false);
      setAlignmentGuides(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingId, dragOffset, editable, manip]);

  return (
    <div
      className={cn(
        'relative mx-auto flex h-full max-h-full w-full max-w-full flex-col items-center justify-center',
        className,
      )}
    >
      <div
        className={cn(
          'relative min-h-0 w-full flex-1',
          narrowViewport && editable && 'overflow-hidden rounded-xl border border-white/[0.07]',
        )}
      >
        <div className="relative h-full w-full">
        <img
          src={imgBlackTshirt}
          alt="Garment preview"
          className="h-auto max-h-full w-full object-contain opacity-0"
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={imgBlackTshirt}
            alt="Garment"
            className="h-full max-h-full w-full object-contain"
          />

          <div
            ref={zoneRef}
            data-print-design-zone
            className="absolute overflow-visible"
            style={{
              left: `${PREVIEW_ZONE.left}%`,
              right: `${PREVIEW_ZONE.right}%`,
              top: `${PREVIEW_ZONE.top}%`,
              bottom: `${PREVIEW_ZONE.bottom}%`,
            }}
            onPointerDown={(e) => {
              if (!editable) return;
              if (e.target === e.currentTarget) setSelectedId(null);
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

            return (
              <div
                key={element.id}
                data-print-id={element.id}
                className={cn(
                  'absolute',
                  editable && !isEditingText && (locked ? 'cursor-default' : 'cursor-move'),
                  editable && !isEditingText && 'select-none touch-none',
                )}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.type === 'text' ? 'max-content' : element.width,
                  maxWidth: element.type === 'text' ? element.width : undefined,
                  minHeight: element.type === 'text' ? element.height : undefined,
                  minWidth: element.type === 'text' ? 0 : undefined,
                  height: element.type === 'image' ? element.height : undefined,
                  opacity: op,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                  boxShadow:
                    element.type === 'image' && bw > 0 ? `0 0 0 ${bw}px ${bc}` : undefined,
                }}
                onPointerDown={(e) => {
                  if (!editable) return;
                  if ((e.target as HTMLElement).closest('[data-handles]')) return;
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
                }}
              >
                {element.type === 'image' ? (
                  <img
                    src={element.content}
                    alt="Artwork"
                    className="h-full w-full object-contain"
                    style={{
                      transform: element.flipHorizontal ? 'scaleX(-1)' : undefined,
                    }}
                  />
                ) : isEditingText ? (
                  <textarea
                    ref={editAreaRef}
                    value={editDraft}
                    onChange={(ev) => {
                      setEditDraft(ev.target.value);
                      editDraftRef.current = ev.target.value;
                    }}
                    onBlur={() => {
                      const next = editDraftRef.current.trim() || element.content;
                      updateElement(element.id, { content: next });
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
                    className="z-40 min-h-[1.5em] w-full resize-none rounded-md border border-[#CC2D24]/60 bg-black/80 px-1.5 py-1 font-semibold text-white outline-none ring-2 ring-[#CC2D24]/35 [overflow-wrap:anywhere]"
                    style={{
                      color: element.color ?? '#FFFFFF',
                      fontFamily: element.fontFamily ?? 'Inter',
                      fontSize: displayFont,
                      lineHeight: 1.15,
                      maxWidth: element.width,
                      minHeight: element.height,
                      textAlign: element.textAlign ?? 'center',
                      fontStyle: element.fontStyle ?? 'normal',
                      textTransform: element.textTransform ?? 'none',
                      letterSpacing:
                        element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
                    }}
                    rows={3}
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
                        minHeight: element.height,
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
                  <PrintTransformOverlay
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

      {editable && draggingId ? (
        <div className="pointer-events-none flex w-full flex-shrink-0 justify-center pt-2 md:pt-2.5">
          <div
            ref={deleteRef}
            className={`flex min-w-[170px] max-md:min-w-[132px] items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] transition-all duration-200 max-md:gap-1.5 max-md:rounded-xl max-md:px-2.5 max-md:py-1.5 max-md:shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${
              isOverDeleteZone
                ? 'scale-105 border-[#FF3B30] bg-[#FF3B30]/15 text-white max-md:scale-100'
                : 'border-white/20 bg-black/60 text-white/70'
            }`}
          >
            <Trash2
              className={`h-4 w-4 max-md:h-3 max-md:w-3 ${isOverDeleteZone ? 'animate-pulse' : ''}`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] max-md:text-[8px] max-md:tracking-[0.14em]">
              {isOverDeleteZone ? 'Release to delete' : 'Drag here to delete'}
            </span>
          </div>
        </div>
      ) : null}
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