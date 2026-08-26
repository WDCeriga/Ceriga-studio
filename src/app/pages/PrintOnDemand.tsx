import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Check,
  CreditCard,
  ImagePlus,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ORDER_SIZE_KEYS, type OrderSizeKey } from '../data/builderSteps';
import { emptySizeBreakdown, sumBreakdown, type SizeBreakdown } from '../data/orderQuantities';
import { products } from '../data/products';
import {
  createPrintOnDemandOrder,
  formatEuro,
  POD_UNIT_PRICE_CENTS,
} from '../data/userOrders';
import { cn } from '../components/ui/utils';

/**
 * Layout aligned with consumer POD norms (Printful / Shopify personalizers):
 * pick product → studio with large photo mockup + option rail.
 * Preview uses real garment photography with color tint + chest print overlay.
 */

type PodBase = 'tshirt' | 'hoodie';
type DesignMode = 'image' | 'text';
type Phase = 'pick' | 'studio';

/** Real blank photos (Unsplash / catalog). Light blanks tint via multiply. */
const POD_BLANK_PHOTOS: Record<PodBase, { light: string; dark: string; alt: string }> = {
  tshirt: {
    light:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=85',
    dark:
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1400&q=85',
    alt: 'Cotton t-shirt blank',
  },
  hoodie: {
    light:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1400&q=85',
    dark:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1400&q=85',
    alt: 'Pullover hoodie blank',
  },
};

/** Chest print zone as % of the photo frame — tuned per garment photo. */
const PRINT_ZONE: Record<PodBase, string> = {
  tshirt: 'inset-[26%_30%_36%]',
  hoodie: 'inset-[32%_29%_30%]',
};

const DARK_COLORS = new Set(['#161618', '#2D3748', '#1E3A5F']);

const BASES: {
  id: PodBase;
  productId: string;
  label: string;
  blurb: string;
  detail: string;
}[] = [
  {
    id: 'tshirt',
    productId: 'ts-001',
    label: 'T-Shirt',
    blurb: 'Soft cotton tee',
    detail: 'Crew neck · short sleeve · front print',
  },
  {
    id: 'hoodie',
    productId: 'hd-001',
    label: 'Hoodie',
    blurb: 'Classic pullover',
    detail: 'Hood · long sleeve · front print',
  },
];

const COLORS: { hex: string; name: string }[] = [
  { hex: '#161618', name: 'Black' },
  { hex: '#F5F5F5', name: 'White' },
  { hex: '#2D3748', name: 'Charcoal' },
  { hex: '#1E3A5F', name: 'Navy' },
  { hex: '#6B7280', name: 'Heather grey' },
  { hex: '#CC2D24', name: 'Ceriga red' },
];

const TEXT_COLORS: { hex: string; name: string }[] = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#161618', name: 'Black' },
  { hex: '#CC2D24', name: 'Red' },
  { hex: '#E8A868', name: 'Warm' },
];

const SIZE_LABEL: Record<OrderSizeKey, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: 'XXL',
};

function isNearWhite(hex: string): boolean {
  const h = hex.toUpperCase();
  return h === '#F5F5F5' || h === '#FFFFFF';
}

function blankPhotoFor(base: PodBase, colorHex: string): string {
  const photos = POD_BLANK_PHOTOS[base];
  return DARK_COLORS.has(colorHex) ? photos.dark : photos.light;
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

function LiveMockup({
  base,
  colorHex,
  designMode,
  imagePreview,
  text,
  textColor,
  large,
}: {
  base: PodBase;
  colorHex: string;
  designMode: DesignMode;
  imagePreview: string | null;
  text: string;
  textColor: string;
  large?: boolean;
}) {
  const hasPrint =
    (designMode === 'image' && Boolean(imagePreview)) ||
    (designMode === 'text' && text.trim().length > 0);
  const photoSrc = blankPhotoFor(base, colorHex);
  const showTint = !isNearWhite(colorHex) && !DARK_COLORS.has(colorHex);
  const meta = POD_BLANK_PHOTOS[base];

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        large ? 'h-full min-h-[320px]' : 'aspect-[4/5]',
      )}
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 40%, #1A1A1E 0%, #09090B 75%)',
      }}
    >
      <div
        className={cn(
          'relative mx-auto flex h-full w-full items-center justify-center',
          large ? 'max-w-[560px] p-4 sm:p-6 lg:p-8' : 'max-w-[360px] p-3',
        )}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[8px] bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <img
            key={photoSrc}
            src={photoSrc}
            alt={meta.alt}
            className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300"
            draggable={false}
          />

          {/* Fabric color wash on light blanks */}
          {showTint ? (
            <div
              className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-70 transition-colors duration-300"
              style={{ backgroundColor: colorHex }}
              aria-hidden
            />
          ) : null}

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/30"
            aria-hidden
          />

          <div
            className={cn(
              'pointer-events-none absolute flex items-center justify-center rounded-[2px] border border-dashed transition-colors duration-300',
              PRINT_ZONE[base],
              hasPrint ? 'border-white/15' : 'border-white/35 bg-black/25',
            )}
            aria-hidden
          >
            {designMode === 'image' && imagePreview ? (
              <img
                src={imagePreview}
                alt=""
                className="max-h-[94%] max-w-[94%] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
              />
            ) : null}
            {designMode === 'text' && text.trim() ? (
              <p
                className="max-w-[94%] break-words text-center font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold uppercase leading-[1.05] tracking-[-0.03em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] sm:text-xl lg:text-2xl"
                style={{ color: textColor }}
              >
                {text.trim()}
              </p>
            ) : null}
            {!hasPrint ? (
              <p className="px-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                Print area
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintOnDemand() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('pick');
  const [base, setBase] = useState<PodBase>('tshirt');
  const [color, setColor] = useState(COLORS[0]!);
  const [designMode, setDesignMode] = useState<DesignMode>('image');
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [bySize, setBySize] = useState<SizeBreakdown>(() => emptySizeBreakdown());
  const [submitting, setSubmitting] = useState(false);

  const product = products.find((p) => p.id === (base === 'hoodie' ? 'hd-001' : 'ts-001'));
  const units = sumBreakdown(bySize);
  const unitCents = POD_UNIT_PRICE_CENTS[base];
  const totalCents = unitCents * units;

  const designReady = useMemo(() => {
    if (designMode === 'text') return text.trim().length > 0;
    return Boolean(imageFile);
  }, [designMode, text, imageFile]);

  const canPay = designReady && units >= 1;

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
        productId: base === 'hoodie' ? 'hd-001' : 'ts-001',
        productName: product?.name ?? (base === 'hoodie' ? 'Print hoodie' : 'Print tee'),
        garmentType: base,
        color: color.hex,
        colorName: color.name,
        bySize,
        designMode,
        text,
        textColor,
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

        <div className="grid flex-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {BASES.map((b) => {
            const catalog = products.find((p) => p.id === b.productId);
            const src = catalog?.image ?? POD_BLANK_PHOTOS[b.id].light;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBase(b.id);
                  setPhase('studio');
                }}
                className="group flex flex-col overflow-hidden rounded-[10px] border border-[#252528] bg-[#161618] text-left transition-all duration-300 hover:border-[#CC2D24]/45 hover:bg-[#121214]"
              >
                <div className="relative h-[220px] overflow-hidden bg-[#111113] sm:h-[260px]">
                  <img
                    src={src}
                    alt={b.label}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#161618] via-transparent to-transparent opacity-80" />
                </div>
                <div className="flex flex-1 flex-col border-t border-[#252528] p-5">
                  <div className="text-[17px] font-semibold tracking-tight text-[#F0EEEE]">
                    {b.label}
                  </div>
                  <p className="mt-1 text-[13px] text-[#6B6B72]">{b.blurb}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#8A8A90]">{b.detail}</p>
                  <div className="mt-auto flex items-center justify-between pt-5">
                    <span className="ceriga-mono text-[12px] text-[#A3A3A8]">
                      from {formatEuro(POD_UNIT_PRICE_CENTS[b.id])}
                      <span className="text-[#6B6B72]"> / unit</span>
                    </span>
                    <span className="text-[13px] font-medium text-[#F0EEEE] transition-transform duration-300 group-hover:translate-x-0.5">
                      Start designing →
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
              {base === 'hoodie' ? 'Hoodie' : 'T-Shirt'}
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
              colorHex={color.hex}
              designMode={designMode}
              imagePreview={imagePreview}
              text={text}
              textColor={textColor}
              large
            />
          </div>
        </div>

        <aside className="flex min-h-0 w-full flex-col bg-[#0E0E10] lg:w-[min(100%,400px)] lg:shrink-0 xl:w-[420px]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 lg:pb-4">
            <Section step="1" title="Color">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => {
                  const selected = color.hex === c.hex;
                  const light = c.hex === '#F5F5F5';
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={selected}
                      onClick={() => setColor(c)}
                      className={cn(
                        'relative h-10 w-10 rounded-full border-2 transition-transform duration-200',
                        selected
                          ? 'scale-110 border-[#F0EEEE]'
                          : light
                            ? 'border-[#3A3A40] hover:border-[#6B6B72]'
                            : 'border-transparent hover:scale-105',
                      )}
                      style={{ backgroundColor: c.hex }}
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
                        onClick={() => setTextColor(c.hex)}
                        aria-label={c.name}
                        className={cn(
                          'h-8 w-8 rounded-full border-2',
                          textColor === c.hex ? 'border-[#F0EEEE]' : 'border-white/15',
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <Section step="3" title="Sizes">
              <div className="grid grid-cols-3 gap-2">
                {ORDER_SIZE_KEYS.map((size) => {
                  const qty = bySize[size] || 0;
                  return (
                    <div
                      key={size}
                      className={cn(
                        'rounded-[8px] border p-2',
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
