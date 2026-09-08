import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Check,
  CreditCard,
  ImagePlus,
  Minus,
  Move,
  MoveDiagonal,
  Plus,
  RotateCw,
  Square,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { ORDER_SIZE_KEYS, type OrderSizeKey } from '../data/builderSteps';
import {
  emptySizeBreakdown,
  sumBreakdown,
  type SizeBreakdown,
} from '../data/orderQuantities';
import {
  createPrintOnDemandOrder,
  formatEuro,
  POD_UNIT_PRICE_CENTS,
  type PodPlacement,
} from '../data/userOrders';
import { cn } from '../components/ui/utils';

/**
 * Print on demand — pick a blank, then a studio with a real photo mockup
 * (per-color garment photography, front + angle shots) and an option rail.
 * Photos live in /public/blanks/<base>/<colorSlug>/{front,angle}.jpg
 * (sourced from the Ceriga Blanks catalog).
 */

type PodBase = 'tshirt' | 'hoodie';
type DesignMode = 'image' | 'text';
type Phase = 'pick' | 'studio';
type PhotoAngle = 'front' | 'angle';

const BLANKS_ROOT = '/blanks';

const DARK_COLOR_SLUGS = new Set(['black', 'dark-grey', 'coffee']);

/** Scale bounds. 100 = print fills the chest zone edge-to-edge. */
const SCALE_MIN = 20;
const SCALE_MAX = 160;
const SCALE_STEP = 2;
/** Offset bounds in % of the print zone (0 = centered). */
const OFFSET_LIMIT = 50;
const OFFSET_STEP = 1;
/** Rotation bounds in degrees. */
const ROTATE_LIMIT = 180;
const ROTATE_STEP = 5;

const DEFAULT_PLACEMENT: PodPlacement = {
  offsetX: 0,
  offsetY: 0,
  scale: 100,
  rotation: 0,
};

/** Clamp to [-limit, limit] keeping integer-ness. */
function clampSigned(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, Math.round(value)));
}

function normalizePlacement(placement: PodPlacement): PodPlacement {
  return {
    offsetX: clampSigned(placement.offsetX, OFFSET_LIMIT),
    offsetY: clampSigned(placement.offsetY, OFFSET_LIMIT),
    scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(placement.scale))),
    rotation: clampSigned(placement.rotation, ROTATE_LIMIT),
  };
}

interface BlankColor {
  /** Folder under public/blanks/<base>/ */
  slug: string;
  name: string;
  /** Swatch hex sampled from the actual garment photo. */
  swatch: string;
}

interface BlankSpec {
  id: PodBase;
  productId: string;
  label: string;
  blurb: string;
  detail: string;
  /** Chest print zone as % insets of the photo frame. */
  zone: { top: string; right: string; bottom: string; left: string };
  colors: BlankColor[];
}

const BASES: BlankSpec[] = [
  {
    id: 'tshirt',
    productId: 'ts-001',
    label: 'T-Shirt',
    blurb: 'Soft cotton tee',
    detail: 'Crew neck · short sleeve · front print',
    zone: { top: '26%', right: '27%', bottom: '40%', left: '27%' },
    colors: [
      { slug: 'black', name: 'Black', swatch: '#1E1E1E' },
      { slug: 'white', name: 'White', swatch: '#E8E7EC' },
      { slug: 'dark-grey', name: 'Olive', swatch: '#53504B' },
      { slug: 'royal-blue', name: 'Royal blue', swatch: '#3A4A63' },
      { slug: 'grey', name: 'Heather grey', swatch: '#AEB0AE' },
      { slug: 'red', name: 'Red', swatch: '#CF2A2C' },
    ],
  },
  {
    id: 'hoodie',
    productId: 'hd-001',
    label: 'Hoodie',
    blurb: 'Heavyweight pullover',
    detail: 'Hood · kangaroo pocket · front print',
    zone: { top: '24%', right: '26%', bottom: '34%', left: '26%' },
    colors: [
      { slug: 'black', name: 'Black', swatch: '#1F2126' },
      { slug: 'white', name: 'White', swatch: '#E1E4E8' },
      { slug: 'dark-grey', name: 'Slate', swatch: '#505261' },
      { slug: 'grey', name: 'Cream', swatch: '#E4DCD5' },
      { slug: 'sand', name: 'Sand', swatch: '#DACEBB' },
      { slug: 'coffee', name: 'Coffee', swatch: '#5E4735' },
    ],
  },
];

const TEXT_COLORS: { hex: string; name: string }[] = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#161618', name: 'Black' },
  { hex: '#CC2D24', name: 'Ceriga red' },
  { hex: '#E8A868', name: 'Warm sand' },
];

/** Default text color for contrast on the current garment (white on dark, black on light). */
function defaultTextColorFor(colorSlug: string): string {
  return DARK_COLOR_SLUGS.has(colorSlug) ? '#FFFFFF' : '#161618';
}

const SIZE_LABEL: Record<OrderSizeKey, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: 'XXL',
};

function blankPhoto(base: PodBase, colorSlug: string, angle: PhotoAngle): string {
  return `${BLANKS_ROOT}/${base}/${colorSlug}/${angle}.jpg`;
}

/** Warm up every photo of a base once so color/angle swaps never flash. */
function preloadBlankPhotos(base: PodBase) {
  const spec = BASES.find((b) => b.id === base);
  if (!spec) return;
  for (const c of spec.colors) {
    for (const angle of ['front', 'angle'] as PhotoAngle[]) {
      const src = blankPhoto(base, c.slug, angle);
      const img = new Image();
      img.src = src;
    }
  }
}

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#252528] px-4 py-4 last:border-b-0 sm:px-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="ceriga-mono flex h-5 w-5 items-center justify-center rounded-full border border-[#2E2E32] bg-[#0E0E10] text-[9px] text-[#8A8A90]">
          {step}
        </span>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A3A3A8]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** One row of the Position & size section: label, stepper + readout, slider. */
function PlacementControl({
  icon,
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#8A8A90]">
          {icon({ className: 'h-3 w-3 text-[#6B6B72]' })}
          {label}
        </span>
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => onChange(value - step)}
            className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[#2E2E32] text-[#A3A3A8] hover:border-[#3A3A40] hover:text-white"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="ceriga-mono w-12 text-center text-[11px] tabular-nums text-[#F0EEEE]">
            {display}
          </span>
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => onChange(value + step)}
            className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[#2E2E32] text-[#A3A3A8] hover:border-[#3A3A40] hover:text-white"
          >
            <Plus className="h-3 w-3" />
          </button>
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0] ?? value)}
        aria-label={label}
        className={cn(
          '[&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-[#252528]',
          '[&_[data-slot=slider-range]]:bg-[#CC2D24]',
          '[&_[data-slot=slider-thumb]]:border-[#F0EEEE] [&_[data-slot=slider-thumb]]:bg-[#F0EEEE]',
        )}
      />
    </div>
  );
}

type DragMode = 'move' | 'scale' | 'rotate';

interface DragState {
  mode: DragMode;
  rect: DOMRect;
  /** Angular origin for rotate gestures — the print's own center. */
  origin: { x: number; y: number };
  start: { x: number; y: number };
  startPlacement: PodPlacement;
}

function LiveMockup({
  base,
  colorSlug,
  colorName,
  designMode,
  imagePreview,
  text,
  textColor,
  placement = DEFAULT_PLACEMENT,
  onPlacementChange,
  editing = false,
  large = false,
}: {
  base: PodBase;
  colorSlug: string;
  colorName: string;
  designMode: DesignMode;
  imagePreview: string | null;
  text: string;
  textColor: string;
  placement?: PodPlacement;
  onPlacementChange?: (p: PodPlacement) => void;
  /** Live drag/resize/rotate on the mockup — enabled in the studio. */
  editing?: boolean;
  large?: boolean;
}) {
  const spec = BASES.find((b) => b.id === base)!;
  const [angle, setAngle] = useState<PhotoAngle>('front');
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<DragState | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const darkGarment = DARK_COLOR_SLUGS.has(colorSlug);
  const hasPrint =
    (designMode === 'image' && Boolean(imagePreview)) ||
    (designMode === 'text' && text.trim().length > 0);
  const canTransform = editing && hasPrint && Boolean(onPlacementChange);

  const endDrag = useCallback(() => {
    dragState.current = null;
    setDragActive(false);
  }, []);

  const beginDrag = useCallback(
    (e: ReactPointerEvent, mode: DragMode) => {
      if (!canTransform || !onPlacementChange) return;
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      // Rotate around the print's own center — computed analytically from the zone
      // rect + current offset, since a rotated element's bounding box is misleading.
      const origin =
        mode === 'rotate'
          ? {
              x: rect.left + rect.width * (0.5 + placement.offsetX / 100),
              y: rect.top + rect.height * (0.5 + placement.offsetY / 100),
            }
          : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      dragState.current = {
        mode,
        rect,
        origin,
        start: { x: e.clientX, y: e.clientY },
        startPlacement: placement,
      };
      setDragActive(true);
      e.preventDefault();
    },
    [canTransform, onPlacementChange, placement],
  );

  // Window-level listeners so drags survive leaving the mockup mid-gesture.
  useEffect(() => {
    if (!dragActive) return;
    const onMove = (ev: PointerEvent) => {
      const st = dragState.current;
      if (!st || !onPlacementChange) return;
      const dx = ev.clientX - st.start.x;
      const dy = ev.clientY - st.start.y;
      const w = st.rect.width;
      const h = st.rect.height;
      const minDim = Math.min(w, h);
      if (st.mode === 'move') {
        onPlacementChange(
          normalizePlacement({
            ...st.startPlacement,
            offsetX: st.startPlacement.offsetX + (dx / w) * 100,
            offsetY: st.startPlacement.offsetY + (dy / h) * 100,
          }),
        );
      } else if (st.mode === 'scale') {
        // 1px ≈ 0.4% of zone size; vertical-only drags also scale.
        const delta = ((dx + dy) / 2 / (minDim / 2)) * 50;
        onPlacementChange(
          normalizePlacement({
            ...st.startPlacement,
            scale: st.startPlacement.scale + delta,
          }),
        );
      } else {
        const radians = Math.atan2(ev.clientY - st.origin.y, ev.clientX - st.origin.x);
        const startRadians = Math.atan2(
          st.start.y - st.origin.y,
          st.start.x - st.origin.x,
        );
        const raw = st.startPlacement.rotation + (radians - startRadians) * (180 / Math.PI);
        // Snap within 6° of 0/±90/±180 so straight prints are easy.
        const snap = Math.round(raw / 90) * 90;
        onPlacementChange(
          normalizePlacement({
            ...st.startPlacement,
            rotation: Math.abs(raw - snap) <= 6 ? snap : raw,
          }),
        );
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [dragActive, onPlacementChange, endDrag]);

  const handleStyle = {
    left: `${50 + placement.offsetX}%`,
    top: `${50 + placement.offsetY}%`,
    width: `${placement.scale}%`,
    height: `${placement.scale}%`,
    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        large ? 'h-full min-h-[320px]' : 'aspect-square',
      )}
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 40%, #16161A 0%, #09090B 78%)',
      }}
    >
      <div
        className={cn(
          'relative mx-auto flex h-full w-full flex-col items-center justify-center',
          large ? 'max-w-[620px] p-4 sm:p-6 lg:p-8' : 'p-3',
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <img
            key={blankPhoto(base, colorSlug, angle)}
            src={blankPhoto(base, colorSlug, angle)}
            alt={`${spec.label} blank in ${colorName}`}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
            draggable={false}
          />

          {/* Soft vignette to seat the photo in the dark UI */}
          <div
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.28)]"
            aria-hidden
          />

          {/* Chest print zone */}
          <div
            ref={zoneRef}
            className="pointer-events-none absolute flex items-center justify-center"
            style={{
              top: spec.zone.top,
              right: spec.zone.right,
              bottom: spec.zone.bottom,
              left: spec.zone.left,
            }}
            aria-hidden={!hasPrint}
          >
            {hasPrint ? (
              <div
                className={cn(
                  'pointer-events-auto absolute flex touch-none select-none items-center justify-center',
                  canTransform && 'cursor-move',
                )}
                style={handleStyle}
                onPointerDown={(e) => canTransform && beginDrag(e, 'move')}
              >
                {designMode === 'image' && imagePreview ? (
                  <img
                    src={imagePreview}
                    alt=""
                    className="max-h-full max-w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
                    draggable={false}
                  />
                ) : null}
                {designMode === 'text' && text.trim() ? (
                  <p
                    className="w-full break-words text-center font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold uppercase leading-[1.05] tracking-[-0.03em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] lg:text-2xl"
                    style={{ color: textColor }}
                  >
                    {text.trim()}
                  </p>
                ) : null}

                {canTransform ? (
                  <>
                    {/* Selection frame */}
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-0 rounded-[3px] border border-dashed',
                        dragActive
                          ? 'border-[#CC2D24]/80'
                          : darkGarment
                            ? 'border-white/55'
                            : 'border-black/40',
                      )}
                    />
                    {/* Resize handle */}
                    <button
                      type="button"
                      aria-label="Resize print"
                      onPointerDown={(e) => {
                        // Keep the wrapper's move-drag from hijacking this gesture.
                        e.stopPropagation();
                        beginDrag(e, 'scale');
                      }}
                      className="absolute -bottom-2 -right-2 flex h-5 w-5 touch-none items-center justify-center rounded-full border border-[#3A3A40] bg-[#161618] text-[#F0EEEE] shadow-md hover:border-[#CC2D24]"
                    >
                      <MoveDiagonal className="h-3 w-3" />
                    </button>
                    {/* Rotate handle */}
                    <button
                      type="button"
                      aria-label="Rotate print"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        beginDrag(e, 'rotate');
                      }}
                      className="absolute -top-7 left-1/2 flex h-6 w-6 -translate-x-1/2 touch-none items-center justify-center rounded-full border border-[#3A3A40] bg-[#161618] text-[#F0EEEE] shadow-md hover:border-[#CC2D24]"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Empty-state guide — colored to stay visible on any garment */}
          {!hasPrint ? (
            <div
              className={cn(
                'pointer-events-none absolute flex items-center justify-center border border-dashed',
                darkGarment ? 'border-white/25 bg-white/5' : 'border-black/15 bg-black/5',
              )}
              style={{
                top: spec.zone.top,
                right: spec.zone.right,
                bottom: spec.zone.bottom,
                left: spec.zone.left,
              }}
              aria-hidden
            >
              <p
                className={cn(
                  'ceriga-mono text-center text-[10px] uppercase tracking-[0.14em]',
                  darkGarment ? 'text-white/55' : 'text-black/40',
                )}
              >
                Print area
              </p>
            </div>
          ) : null}
        </div>

        {/* Angle toggle */}
        <button
          type="button"
          onClick={() => setAngle((a) => (a === 'front' ? 'angle' : 'front'))}
          className="mt-3 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#2E2E32] bg-[#0E0E10]/80 px-3 text-[11px] font-medium text-[#A3A3A8] backdrop-blur-sm transition-colors hover:border-[#3A3A40] hover:text-[#F0EEEE]"
        >
          <RotateCw className="h-3 w-3" />
          {angle === 'front' ? 'View styled' : 'View flat'}
        </button>
      </div>
    </div>
  );
}

export function PrintOnDemand() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('pick');
  const [base, setBase] = useState<PodBase>('tshirt');
  const [colorSlug, setColorSlug] = useState('black');
  const [designMode, setDesignMode] = useState<DesignMode>('image');
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textColorTouched, setTextColorTouched] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [placement, setPlacement] = useState<PodPlacement>(DEFAULT_PLACEMENT);
  const [bySize, setBySize] = useState<SizeBreakdown>(() => emptySizeBreakdown());
  const [submitting, setSubmitting] = useState(false);

  const spec = BASES.find((b) => b.id === base)!;
  const color = spec.colors.find((c) => c.slug === colorSlug) ?? spec.colors[0]!;
  const units = sumBreakdown(bySize);
  const unitCents = POD_UNIT_PRICE_CENTS[base];
  const totalCents = unitCents * units;

  const designReady = useMemo(() => {
    if (designMode === 'text') return text.trim().length > 0;
    return Boolean(imageFile);
  }, [designMode, text, imageFile]);

  const canPay = designReady && units >= 1;

  const patchPlacement = useCallback((patch: Partial<PodPlacement>) => {
    setPlacement((prev) => normalizePlacement({ ...prev, ...patch }));
  }, []);

  const resetPlacement = useCallback(() => {
    setPlacement(DEFAULT_PLACEMENT);
  }, []);

  const pickBase = (id: PodBase) => {
    setBase(id);
    setColorSlug('black');
    preloadBlankPhotos(id);
    setPlacement(DEFAULT_PLACEMENT);
    setPhase('studio');
  };

  const pickColor = (slug: string) => {
    setColorSlug(slug);
    // Keep default text color readable on the new garment unless the user chose one.
    if (!textColorTouched) setTextColor(defaultTextColorFor(slug));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const setSizeQty = (size: OrderSizeKey, raw: string) => {
    const n = Math.max(0, Math.min(999, Number.parseInt(raw, 10) || 0));
    setBySize((prev) => ({ ...prev, [size]: n }));
  };

  const bumpSize = (size: OrderSizeKey, delta: number) => {
    setBySize((prev) => ({
      ...prev,
      [size]: Math.max(0, Math.min(999, (prev[size] || 0) + delta)),
    }));
  };

  const handleCheckout = async () => {
    if (!designReady) {
      toast.error(designMode === 'text' ? 'Add text for your print' : 'Upload a print image');
      return;
    }
    if (units < 1) {
      toast.error('Add at least one unit');
      return;
    }
    setSubmitting(true);
    try {
      const order = await createPrintOnDemandOrder({
        productId: spec.productId,
        productName: spec.label === 'Hoodie' ? 'Print hoodie' : 'Print tee',
        garmentType: base,
        color: color.swatch,
        colorName: color.name,
        bySize,
        designMode,
        text,
        textColor,
        placement,
        imageFile: designMode === 'image' ? imageFile : null,
      });
      toast.success('Order ready — complete payment');
      navigate(`/orders/${order.id}/checkout/pod`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'pick') {
    return (
      <div className="ceriga-page mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-[960px] flex-col px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        <Link
          to="/create"
          className="mb-8 inline-flex w-fit items-center gap-2 text-xs font-medium text-[#8A8A90] transition-colors hover:text-[#F0EEEE]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Create
        </Link>

        <div className="mb-8 max-w-lg">
          <div className="ceriga-page-eyebrow">Print on demand</div>
          <h1 className="ceriga-page-title">Choose a product</h1>
          <p className="ceriga-page-sub">
            Pick a blank, then customize color and front print on a live photo mockup.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {BASES.map((b) => {
            const hero = blankPhoto(b.id, 'black', 'front');
            const swatches = b.colors.slice(0, 5);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => pickBase(b.id)}
                onMouseEnter={() => preloadBlankPhotos(b.id)}
                className="group flex flex-col overflow-hidden rounded-[10px] border border-[#252528] bg-[#161618] text-left transition-all duration-300 hover:border-[#CC2D24]/45 hover:bg-[#121214]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#111113]">
                  <img
                    src={hero}
                    alt={b.label}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#161618] via-transparent to-transparent opacity-70" />
                  <div className="absolute bottom-3 left-4 flex gap-1.5">
                    {swatches.map((c) => (
                      <span
                        key={c.slug}
                        className="h-3.5 w-3.5 rounded-full border border-white/25"
                        style={{ backgroundColor: c.swatch }}
                        title={c.name}
                      />
                    ))}
                    {b.colors.length > swatches.length ? (
                      <span className="ceriga-mono text-[10px] leading-[14px] text-white/70">
                        +{b.colors.length - swatches.length}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col border-t border-[#252528] p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[17px] font-semibold tracking-tight text-[#F0EEEE]">
                      {b.label}
                    </div>
                    <span className="ceriga-mono shrink-0 text-[12px] text-[#A3A3A8]">
                      from {formatEuro(POD_UNIT_PRICE_CENTS[b.id])}
                      <span className="text-[#6B6B72]"> / unit</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#6B6B72]">{b.blurb}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#8A8A90]">{b.detail}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-[#F0EEEE]">
                    Start designing
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4.35rem-env(safe-area-inset-top,0px))] min-h-0 flex-col overflow-hidden bg-[#09090B] lg:h-[100dvh] lg:max-h-[100dvh]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#252528] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setPhase('pick')}
            className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-[#8A8A90] transition-colors hover:text-[#F0EEEE]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Products</span>
          </button>
          <span className="hidden h-4 w-px bg-[#252528] sm:block" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#F0EEEE]">
              {spec.label}
              <span className="font-normal text-[#6B6B72]"> · {color.name}</span>
            </p>
            <p className="ceriga-mono truncate text-[10px] uppercase tracking-[0.08em] text-[#45454B]">
              Front print · {formatEuro(unitCents)} / unit
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-[#6B6B72]">
              {units > 0 ? `${units} units` : 'Add sizes'}
            </p>
            <p className="text-sm font-semibold tabular-nums text-[#F0EEEE]">
              {formatEuro(totalCents)}
            </p>
          </div>
          <Button
            type="button"
            disabled={!canPay || submitting}
            onClick={() => void handleCheckout()}
            className="ceriga-btn-primary h-9 gap-1.5 px-4 text-[12px] disabled:opacity-50"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {submitting ? '…' : 'Pay'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 shrink-0 flex-col border-b border-[#252528] lg:min-w-0 lg:flex-[1.35] lg:border-b-0 lg:border-r">
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-4 sm:top-4">
            <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-white/70 backdrop-blur-sm">
              Front
            </span>
            {!designReady ? (
              <span className="hidden rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-100/80 sm:inline">
                Add a print
              </span>
            ) : null}
          </div>
          <div className="min-h-[42dvh] flex-1 lg:min-h-0">
            <LiveMockup
              base={base}
              colorSlug={color.slug}
              colorName={color.name}
              designMode={designMode}
              imagePreview={imagePreview}
              text={text}
              textColor={textColor}
              placement={placement}
              onPlacementChange={setPlacement}
              editing
              large
            />
          </div>
        </div>

        <aside className="flex min-h-0 w-full flex-col bg-[#0E0E10] lg:w-[min(100%,400px)] lg:shrink-0 xl:w-[420px]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 lg:pb-4">
            <Section step="1" title="Color">
              <div className="flex flex-wrap gap-2">
                {spec.colors.map((c) => {
                  const selected = color.slug === c.slug;
                  const light = !DARK_COLOR_SLUGS.has(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={selected}
                      onClick={() => pickColor(c.slug)}
                      className={cn(
                        'relative h-10 w-10 rounded-full border-2 transition-transform duration-200',
                        selected
                          ? 'scale-110 border-[#F0EEEE]'
                          : light
                            ? 'border-[#3A3A40] hover:border-[#6B6B72]'
                            : 'border-transparent hover:scale-105',
                      )}
                      style={{ backgroundColor: c.swatch }}
                    >
                      {selected ? (
                        <span
                          className={cn(
                            'absolute inset-0 flex items-center justify-center',
                            light ? 'text-[#161618]' : 'text-white',
                          )}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[12px] text-[#6B6B72]">{color.name}</p>
            </Section>

            <Section step="2" title="Front design">
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-[8px] border border-[#252528] bg-[#09090B] p-1">
                {(
                  [
                    { id: 'image' as const, label: 'Image', icon: ImagePlus },
                    { id: 'text' as const, label: 'Text', icon: Type },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const selected = designMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDesignMode(opt.id)}
                      className={cn(
                        'inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] text-[12px] font-medium transition-colors',
                        selected
                          ? 'bg-[#1C1C1E] text-[#F0EEEE] shadow-[inset_0_0_0_1px_rgba(204,45,36,0.4)]'
                          : 'text-[#8A8A90] hover:text-[#F0EEEE]',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {designMode === 'image' ? (
                <label
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed px-4 py-7 transition-colors',
                    imagePreview
                      ? 'border-[#345040] bg-[#0F1612]'
                      : 'border-[#333338] bg-[#111113] hover:border-[#4A4A52]',
                  )}
                >
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt=""
                        className="max-h-20 max-w-[160px] object-contain"
                      />
                      <p className="max-w-full truncate text-center text-[12px] text-[#7FA888]">
                        {imageFile?.name} · tap to replace
                      </p>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6 text-[#E5534A]" strokeWidth={1.5} />
                      <p className="text-center text-[12px] text-[#8A8A90]">
                        Upload PNG or JPG
                        <span className="mt-0.5 block text-[11px] text-[#45454B]">
                          Transparent PNG prints cleanest
                        </span>
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1.5 flex justify-between">
                      <Label
                        htmlFor="pod-text"
                        className="ceriga-mono text-[10px] uppercase tracking-[0.08em] text-[#6B6B72]"
                      >
                        Text
                      </Label>
                      <span className="ceriga-mono text-[10px] text-[#45454B]">
                        {text.length}/40
                      </span>
                    </div>
                    <Input
                      id="pod-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="e.g. CERIGA"
                      maxLength={40}
                      className="h-11 border-[#2E2E32] bg-[#09090B] text-base font-semibold uppercase tracking-wide text-[#F0EEEE] placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-[#45454B]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          setTextColor(c.hex);
                          setTextColorTouched(true);
                        }}
                        aria-label={c.name}
                        title={c.name}
                        className={cn(
                          'h-8 w-8 rounded-full border-2 transition-transform',
                          textColor === c.hex
                            ? 'scale-105 border-[#F0EEEE]'
                            : 'border-white/15 hover:border-white/35',
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <Section step="3" title="Position & size">
              <div className="space-y-4">
                <PlacementControl
                  icon={(props) => <Move {...props} />}
                  label="X position"
                  display={`${placement.offsetX > 0 ? '+' : ''}${placement.offsetX}%`}
                  min={-OFFSET_LIMIT}
                  max={OFFSET_LIMIT}
                  step={OFFSET_STEP}
                  value={placement.offsetX}
                  onChange={(v) => patchPlacement({ offsetX: v })}
                />
                <PlacementControl
                  icon={(props) => <Move {...props} />}
                  label="Y position"
                  display={`${placement.offsetY > 0 ? '+' : ''}${placement.offsetY}%`}
                  min={-OFFSET_LIMIT}
                  max={OFFSET_LIMIT}
                  step={OFFSET_STEP}
                  value={placement.offsetY}
                  onChange={(v) => patchPlacement({ offsetY: v })}
                />
                <PlacementControl
                  icon={(props) => <Square {...props} />}
                  label="Size"
                  display={`${placement.scale}%`}
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={SCALE_STEP}
                  value={placement.scale}
                  onChange={(v) => patchPlacement({ scale: v })}
                />
                <PlacementControl
                  icon={(props) => <RotateCw {...props} />}
                  label="Rotation"
                  display={`${placement.rotation}°`}
                  min={-ROTATE_LIMIT}
                  max={ROTATE_LIMIT}
                  step={ROTATE_STEP}
                  value={placement.rotation}
                  onChange={(v) => patchPlacement({ rotation: v })}
                />
                <div className="flex items-center justify-between pt-0.5">
                  <p className="text-[11px] leading-relaxed text-[#45454B]">
                    Or drag the print on the mockup — corner resizes, top rotates.
                  </p>
                  <button
                    type="button"
                    onClick={resetPlacement}
                    disabled={
                      placement.offsetX === 0 &&
                      placement.offsetY === 0 &&
                      placement.scale === 100 &&
                      placement.rotation === 0
                    }
                    className="shrink-0 rounded-[6px] border border-[#2E2E32] px-2.5 py-1 text-[11px] font-medium text-[#A3A3A8] transition-colors hover:border-[#3A3A40] hover:text-[#F0EEEE] disabled:pointer-events-none disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </Section>

            <Section step="4" title="Sizes">
              <div className="grid grid-cols-3 gap-2">
                {ORDER_SIZE_KEYS.map((size) => {
                  const qty = bySize[size] || 0;
                  return (
                    <div
                      key={size}
                      className={cn(
                        'rounded-[8px] border p-2 transition-colors',
                        qty > 0
                          ? 'border-[#CC2D24]/35 bg-[#121214]'
                          : 'border-[#2E2E32] bg-[#09090B]',
                      )}
                    >
                      <div className="mb-1.5 text-center text-[11px] font-semibold text-[#F0EEEE]">
                        {SIZE_LABEL[size]}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Decrease ${SIZE_LABEL[size]}`}
                          onClick={() => bumpSize(size, -1)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[#2E2E32] text-sm text-[#A3A3A8] hover:border-[#3A3A40] hover:text-white"
                        >
                          −
                        </button>
                        <Input
                          inputMode="numeric"
                          value={qty || ''}
                          onChange={(e) => setSizeQty(size, e.target.value)}
                          placeholder="0"
                          className="h-8 border-[#2E2E32] bg-[#0E0E10] px-1 text-center text-[12px] font-semibold tabular-nums text-[#F0EEEE]"
                        />
                        <button
                          type="button"
                          aria-label={`Increase ${SIZE_LABEL[size]}`}
                          onClick={() => bumpSize(size, 1)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[#2E2E32] text-sm text-[#A3A3A8] hover:border-[#3A3A40] hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <div className="hidden px-4 py-4 lg:block sm:px-5">
              <div className="rounded-[8px] border border-[#252528] bg-[#111113] p-3.5">
                <div className="flex items-center justify-between text-[12px] text-[#8A8A90]">
                  <span>
                    {units || 0} × {formatEuro(unitCents)}
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-[#F0EEEE]">
                    {formatEuro(totalCents)}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={!canPay || submitting}
                  onClick={() => void handleCheckout()}
                  className="ceriga-btn-primary mt-3 h-11 w-full gap-2 text-[13px] disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {submitting
                    ? 'Creating order…'
                    : canPay
                      ? `Pay ${formatEuro(totalCents)}`
                      : !designReady
                        ? 'Add a print to continue'
                        : 'Add sizes to continue'}
                </Button>
                <p className="mt-2 text-center text-[10px] leading-relaxed text-[#45454B]">
                  Fixed price · no quote wait · mock checkout
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#252528] bg-[#09090B]/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="text-[#8A8A90]">
            {units > 0 ? `${units} units` : 'No sizes yet'} · {color.name}
          </span>
          <span className="font-semibold tabular-nums text-[#F0EEEE]">
            {formatEuro(totalCents)}
          </span>
        </div>
        <Button
          type="button"
          disabled={!canPay || submitting}
          onClick={() => void handleCheckout()}
          className="ceriga-btn-primary h-11 w-full gap-2 text-[13px] disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          {submitting
            ? 'Creating order…'
            : canPay
              ? `Pay ${formatEuro(totalCents)}`
              : !designReady
                ? 'Add a print to continue'
                : 'Add sizes to continue'}
        </Button>
      </div>
    </div>
  );
}

export default PrintOnDemand;
