import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Factory,
  FileText,
  Flag,
  Mail,
  MapPin,
  Package,
  Phone,
  Send,
  Shirt,
  Truck,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MOCK_SUPER_ORDERS,
  STATUS_LABELS,
  formatMoney,
  getOrderQuoteTiers,
  getSuperAdminOrder,
  resolveMarginForManufacturer,
  withCalculatedQuoteTiers,
  type CustomerTechPackRef,
  type OrderStatus,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import { formatDeliveryLines, type OrderDeliveryInfo } from '../../data/orderDelivery';
import { formatOrderQuantitiesSummary } from '../../data/orderQuantities';
import { getProductById } from '../../data/products';
import { ProductionQcGallery } from '../../components/orders/ProductionQcGallery';
import {
  clearQcBrandFlag,
  flagQcForBrand,
  getProductionPulse,
} from '../../data/superadminOpsMock';
import { PRODUCTION_STAGE_LABEL } from '../../data/productionFloor';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';

const KIND_STYLE = {
  techpack: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  custom_clothing: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
} as const;

const EXPORT_LABEL = {
  pdf: 'PDF export',
  pdf_bundle: 'PDF + ZIP bundle',
} as const;

const TECHPACK_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'submitted', label: 'Payment' },
  { status: 'paid', label: 'Processing' },
  { status: 'completed', label: 'Ready' },
];

const CUSTOM_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'submitted', label: 'Submitted' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'pending_review', label: 'Review' },
  { status: 'sent_to_brand', label: 'To brand' },
  { status: 'in_production', label: 'Production' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'completed', label: 'Done' },
];

const STATUS_RANK: Record<OrderStatus, number> = {
  draft: 0,
  submitted: 1,
  assigned: 2,
  priced: 2,
  pending_review: 3,
  sent_to_brand: 4,
  paid: 4,
  in_production: 5,
  shipped: 6,
  completed: 7,
};

function statusTone(status: OrderStatus) {
  if (status === 'pending_review') return 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-200';
  if (status === 'sent_to_brand' || status === 'paid' || status === 'completed')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'assigned' || status === 'in_production')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  if (status === 'draft') return 'border-white/15 bg-white/5 text-white/55';
  return 'border-white/15 bg-white/5 text-white/60';
}

function techPackStatusLabel(status: OrderStatus) {
  if (status === 'completed') return 'Download ready';
  if (status === 'paid') return 'Processing export';
  if (status === 'submitted') return 'Awaiting payment';
  return STATUS_LABELS[status];
}

function customStatusLabel(status: OrderStatus) {
  if (status === 'draft') return 'Draft';
  return STATUS_LABELS[status];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function orderInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`Copied ${label}`);
}

function displayPrice(order: SuperAdminOrder) {
  if (order.finalPriceCents != null) return formatMoney(order.finalPriceCents);
  if (order.calculatedPriceCents != null) return formatMoney(order.calculatedPriceCents);
  return null;
}

function mockQuantity(productName: string) {
  const match = productName.match(/(\d[\d,]*)\s*(units?|hoodies?|pcs?|pieces?)/i);
  return match ? match[1].replace(/,/g, '') : null;
}

export function SuperAdminOrderDetail() {
  const { id } = useParams();
  const [tick, setTick] = useState(0);
  void tick;
  const order = id ? getSuperAdminOrder(id) ?? MOCK_SUPER_ORDERS.find((o) => o.id === id) : undefined;

  if (!order) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <Package className="h-10 w-10 text-white/25" />
        <h2 className="mt-4 text-lg font-semibold text-white">Order not found</h2>
        <Button asChild className="mt-6 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
          <Link to="/superadmin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to orders
          </Link>
        </Button>
      </div>
    );
  }

  if (order.kind === 'techpack') {
    return <TechPackOrderDetail order={order} />;
  }

  return <CustomClothingOrderDetail order={order} onOpsChange={() => setTick((n) => n + 1)} />;
}

function OrderBackLink() {
  return (
    <Link
      to="/superadmin/orders"
      className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Orders
    </Link>
  );
}

function WorkflowPipeline({
  order,
  steps,
  accent = 'red',
}: {
  order: SuperAdminOrder;
  steps: { status: OrderStatus; label: string }[];
  accent?: 'red' | 'violet';
}) {
  const currentRank = STATUS_RANK[order.status];

  const stepState = (stepStatus: OrderStatus) => {
    const stepRank = STATUS_RANK[stepStatus];
    if (order.status === stepStatus) return 'current' as const;
    if (currentRank > stepRank) return 'done' as const;
    return 'upcoming' as const;
  };

  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Progress</p>
      <div className="mt-4 flex items-start gap-0.5 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const state = stepState(step.status);
          return (
            <div key={step.status} className="flex min-w-[52px] flex-1 items-center">
              <div className="flex w-full flex-col items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border transition',
                    state === 'done' && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
                    state === 'current' &&
                      (accent === 'violet'
                        ? 'border-violet-400/50 bg-violet-500/20 text-violet-200'
                        : 'border-[#CC2D24]/50 bg-[#CC2D24]/20 text-red-200'),
                    state === 'upcoming' && 'border-white/10 bg-white/[0.03] text-white/25',
                  )}
                >
                  {state === 'done' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : state === 'current' ? (
                    <Circle className="h-2.5 w-2.5 fill-current" />
                  ) : (
                    <Circle className="h-2.5 w-2.5" />
                  )}
                </span>
                <span
                  className={cn(
                    'w-full truncate text-center text-[9px] font-medium leading-tight',
                    state === 'current' ? 'text-white' : 'text-white/35',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    'mb-5 h-px w-full min-w-[8px] flex-1',
                    currentRank > STATUS_RANK[step.status] ? 'bg-emerald-500/35' : 'bg-white/10',
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderHero({
  order,
  isTechPack,
  statusLabel,
  children,
}: {
  order: SuperAdminOrder;
  isTechPack: boolean;
  statusLabel: string;
  children?: ReactNode;
}) {
  const gradient = isTechPack
    ? 'from-violet-500/14 via-violet-500/[0.03] to-transparent'
    : 'from-[#CC2D24]/14 via-[#CC2D24]/[0.02] to-transparent';
  const accentColor = isTechPack ? 'text-violet-300' : 'text-[#CC2D24]';
  const accentBg = isTechPack ? 'bg-violet-500/15' : 'bg-[#CC2D24]/15';
  const price = displayPrice(order);
  const steps = isTechPack ? TECHPACK_STEPS : CUSTOM_STEPS;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className={cn('px-6 py-6 sm:px-8', 'bg-gradient-to-br', gradient)}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10',
                accentBg,
                accentColor,
              )}
            >
              {isTechPack ? <Package className="h-6 w-6" /> : <Shirt className="h-6 w-6" />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn('font-mono text-xs', accentColor)}>{order.id}</p>
                <button
                  type="button"
                  className="rounded-md p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
                  onClick={() => copyText(order.id, 'order ID')}
                  aria-label="Copy order ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {order.productName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                    statusTone(order.status),
                  )}
                >
                  {statusLabel}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                    KIND_STYLE[order.kind],
                  )}
                >
                  {isTechPack ? <Package className="h-3 w-3" /> : <Shirt className="h-3 w-3" />}
                  {isTechPack ? 'Tech pack' : 'Custom clothing'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Customer',
              value: order.userName,
              sub: order.userEmail,
              icon: User,
            },
            isTechPack
              ? {
                  label: 'Garment',
                  value: order.garmentType ?? '—',
                  sub: order.exportFormat ? EXPORT_LABEL[order.exportFormat] : 'PDF export',
                  icon: FileText,
                }
              : {
                  label: 'Manufacturer',
                  value: order.manufacturerName ?? 'Unassigned',
                  icon: Factory,
                },
            {
              label: isTechPack ? 'Billing' : 'Delivery',
              value: isTechPack
                ? price ?? 'Pending'
                : order.delivery
                  ? `${order.delivery.address1}, ${order.delivery.city}`
                  : `${order.deliveryCity}, ${order.deliveryCountry}`,
              sub: isTechPack
                ? undefined
                : order.delivery
                  ? `${order.delivery.postcode} · ${order.delivery.country}`
                  : formatDate(order.createdAt),
              icon: isTechPack ? Calculator : MapPin,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3.5"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white">{item.value}</div>
              {'sub' in item && item.sub ? (
                <div className="mt-0.5 truncate text-xs text-white/40">{item.sub}</div>
              ) : null}
            </div>
          ))}
        </div>

        <WorkflowPipeline
          order={order}
          steps={steps}
          accent={isTechPack ? 'violet' : 'red'}
        />
      </div>
    </div>
  );
}

function CustomerCard({ order }: { order: SuperAdminOrder }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Customer</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-bold text-white/75">
          {orderInitials(order.userName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{order.userName}</p>
          <p className="truncate text-xs text-white/45">{order.userEmail}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white"
        >
          <Link to={`/superadmin/users/${order.userId}`}>
            <User className="mr-2 h-3.5 w-3.5" />
            Profile
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => toast.success(`Mock: email sent to ${order.userEmail}`)}
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}

function DeliveryCard({ order }: { order: SuperAdminOrder }) {
  const delivery: OrderDeliveryInfo | undefined = order.delivery;
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        Delivery
      </h2>
      {delivery ? (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Contact
            </p>
            <p className="mt-1 font-medium text-white">
              {delivery.firstName} {delivery.lastName}
            </p>
            <p className="mt-0.5 text-xs text-white/50">{delivery.email}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
              <Phone className="h-3 w-3" />
              {delivery.phone}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Address
            </p>
            <div className="mt-1 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
              <div className="space-y-0.5 text-white/80">
                {formatDeliveryLines(delivery).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
          {delivery.instructions ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Special instructions
              </p>
              <p className="mt-1 text-white/60">{delivery.instructions}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
          <p className="font-medium text-white">
            {order.deliveryCity}, {order.deliveryCountry}
          </p>
        </div>
      )}
    </section>
  );
}

function ManufacturerCard({ order }: { order: SuperAdminOrder }) {
  const tiers = getOrderQuoteTiers(order);
  const hasQuote = tiers.length > 0;
  const awaitingQuote = Boolean(order.manufacturerName) && !hasQuote;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        Manufacturer
      </h2>
      {order.manufacturerName ? (
        <div className="mt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Factory className="h-4 w-4 text-amber-200" />
            </span>
            <div>
              <p className="font-medium text-white">{order.manufacturerName}</p>
              {order.dueQuoteBy ? (
                <p className="mt-0.5 text-[11px] text-white/40">
                  Quote due {new Date(order.dueQuoteBy).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <div
            className={cn(
              'mt-4 rounded-lg border px-3 py-2.5 text-xs',
              hasQuote
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                : awaitingQuote
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 bg-white/[0.03] text-white/50',
            )}
          >
            {hasQuote
              ? `Quote received · ${tiers.length} tier${tiers.length === 1 ? '' : 's'} (sample + bulk)`
              : awaitingQuote
                ? 'Awaiting pricing submission'
                : 'Not yet engaged'}
          </div>
          {order.factoryRejectReason ? (
            <p className="mt-2 text-[11px] text-red-200/80">Declined: {order.factoryRejectReason}</p>
          ) : null}
          {hasQuote ? (
            <ul className="mt-3 space-y-1.5">
              {tiers.map((tier) => (
                <li
                  key={tier.id}
                  className="flex items-center justify-between gap-2 text-[11px] text-white/50"
                >
                  <span>
                    {tier.label}
                    {tier.totalUnits > 0 ? ` · ${tier.totalUnits}u` : ''}
                  </span>
                  <span className="tabular-nums text-white/75">
                    {formatMoney(tier.manufacturerQuoteCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            to="/superadmin/assignment"
            className="mt-3 inline-flex text-[11px] text-[#CC2D24] hover:underline"
          >
            Open assignment console
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-white/45">No manufacturer assigned yet.</p>
          <Link
            to="/superadmin/assignment"
            className="mt-2 inline-flex text-[11px] text-[#CC2D24] hover:underline"
          >
            Assign in console
          </Link>
        </div>
      )}
    </section>
  );
}

function ProductionPulseCard({
  order,
  onOpsChange,
}: {
  order: SuperAdminOrder;
  onOpsChange?: () => void;
}) {
  const pulse = getProductionPulse(order.id);
  const [flagOpen, setFlagOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Production pulse</h2>
          <p className="mt-0.5 text-[11px] text-white/40">
            Read-only floor status · QC photos below
          </p>
        </div>
        {pulse.flagged ? (
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/[0.03] text-white/80"
            onClick={() => {
              clearQcBrandFlag(order.id);
              toast.success('Cleared brand QC flag');
              onOpsChange?.();
            }}
          >
            Clear flag
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            onClick={() => setFlagOpen(true)}
          >
            <Flag className="mr-1.5 h-3.5 w-3.5" />
            Flag for brand
          </Button>
        )}
      </div>

      {pulse.job ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">Stage</p>
            <p className="mt-0.5 text-sm font-medium text-white">
              {PRODUCTION_STAGE_LABEL[pulse.job.stage]}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">Assignee</p>
            <p className="mt-0.5 text-sm font-medium text-white">
              {pulse.job.assigneeName ?? 'Unassigned'}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">QC photos</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-white">{pulse.photoCount}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/40">
          No production job linked yet — gallery still shows any published QC for this order id.
        </p>
      )}

      {pulse.flagged ? (
        <p className="mt-3 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[12px] text-violet-100">
          Flagged for brand
          {pulse.flaggedAt ? ` · ${pulse.flaggedAt}` : ''}
          {pulse.flagNote ? ` — ${pulse.flagNote}` : ''}
        </p>
      ) : null}

      <ConfirmDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        title="Flag QC for brand?"
        description="Marks this order so ops can push the brand to review published QC photos. Does not auto-message in this mock."
        confirmLabel="Flag for brand"
        onConfirm={() => {
          flagQcForBrand(order.id, 'Please review published QC photos');
          toast.success('Flagged for brand review');
          onOpsChange?.();
        }}
      />
    </section>
  );
}

function builderUrl(techPack: CustomerTechPackRef) {
  const params = new URLSearchParams({ project: techPack.projectId });
  return `/builder/${techPack.builderProductId}?${params.toString()}`;
}

function exportFormatLabel(format?: CustomerTechPackRef['exportFormat']) {
  if (format === 'pdf_bundle') return 'PDF + ZIP bundle';
  return 'PDF export';
}

function TechPackViewerDialog({
  techPack,
  customerName,
  open,
  onOpenChange,
}: {
  techPack: CustomerTechPackRef;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const product = getProductById(techPack.builderProductId);
  const builderHref = builderUrl(techPack);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#111113] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">{techPack.name}</DialogTitle>
          <DialogDescription className="text-white/45">
            Customer tech pack from {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {product?.image ? (
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
              <img
                src={product.image}
                alt={product.name}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02]">
              <FileText className="h-12 w-12 text-white/20" />
            </div>
          )}

          <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-black/25">
            {[
              { label: 'Garment', value: techPack.garmentType },
              { label: 'Blueprint', value: product?.name ?? techPack.builderProductId },
              { label: 'Format', value: exportFormatLabel(techPack.exportFormat) },
              { label: 'Pages', value: techPack.pageCount ? `${techPack.pageCount} pages` : '—' },
              {
                label: 'Last exported',
                value: techPack.lastExportedAt ? formatDate(techPack.lastExportedAt) : '—',
              },
              { label: 'Project ID', value: techPack.projectId, mono: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-white/45">{row.label}</dt>
                <dd className={cn('text-right font-medium text-white/85', row.mono && 'font-mono text-xs')}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Includes</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/60">
              <li>· Flat sketches & construction callouts</li>
              <li>· Measurement tables (graded)</li>
              <li>· Fabric, trim, and colour specifications</li>
              <li>· Print / label placement zones</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1 bg-[#CC2D24] hover:bg-[#CC2D24]/90" asChild>
              <a href={builderHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in builder
              </a>
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/15 text-white hover:bg-white/10"
              onClick={() => toast.success('Mock: tech pack PDF downloaded')}
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductionSpecCard({ order }: { order: SuperAdminOrder }) {
  const qty = mockQuantity(order.productName);
  const techPack = order.customerTechPack;
  const [viewerOpen, setViewerOpen] = useState(false);
  const product = techPack ? getProductById(techPack.builderProductId) : undefined;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-white">Production spec</h2>

      {techPack ? (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Customer tech pack
          </p>
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="group mt-3 w-full rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-transparent p-4 text-left transition hover:border-violet-500/40 hover:from-violet-500/15"
          >
            <div className="flex items-start gap-4">
              {product?.image ? (
                <img
                  src={product.image}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                  <FileText className="h-6 w-6 text-violet-300" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white group-hover:text-violet-100">{techPack.name}</p>
                <p className="mt-1 text-xs text-white/45">
                  {techPack.garmentType} · {exportFormatLabel(techPack.exportFormat)}
                  {techPack.pageCount ? ` · ${techPack.pageCount} pages` : ''}
                </p>
                {techPack.lastExportedAt ? (
                  <p className="mt-1 text-[11px] text-white/35">
                    Exported {formatDate(techPack.lastExportedAt)}
                  </p>
                ) : null}
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/25 transition group-hover:text-violet-300" />
            </div>
          </button>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
              onClick={() => setViewerOpen(true)}
            >
              <FileText className="mr-2 h-3.5 w-3.5" />
              Open tech pack
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 text-white hover:bg-white/10"
              asChild
            >
              <a href={builderUrl(techPack)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Open in builder
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 text-white hover:bg-white/10"
              onClick={() => toast.success('Mock: tech pack PDF downloaded')}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              PDF
            </Button>
          </div>

          <TechPackViewerDialog
            techPack={techPack}
            customerName={order.userName}
            open={viewerOpen}
            onOpenChange={setViewerOpen}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">No tech pack attached to this order yet.</p>
        </div>
      )}

      <dl className="mt-5 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20">
        {[
          { label: 'Product', value: order.productName },
          { label: 'Quantity', value: qty ? `${qty} units` : '—' },
          {
            label: 'Delivery',
            value: order.delivery
              ? [
                  `${order.delivery.firstName} ${order.delivery.lastName}`,
                  order.delivery.address1,
                  order.delivery.address2,
                  `${order.delivery.city} ${order.delivery.postcode}`.trim(),
                  order.delivery.country,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `${order.deliveryCity}, ${order.deliveryCountry}`,
          },
          { label: 'Submitted', value: formatDate(order.createdAt) },
        ].map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="shrink-0 text-white/45">{row.label}</dt>
            <dd className="text-right font-medium text-white/85">{row.value}</dd>
          </div>
        ))}
      </dl>

      {order.notes ? (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Notes</p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{order.notes}</p>
        </div>
      ) : null}
    </section>
  );
}

function TechPackOrderDetail({ order }: { order: SuperAdminOrder }) {
  const isReady = order.status === 'completed';
  const isPaid = order.status === 'paid' || isReady;
  const exportLabel = order.exportFormat ? EXPORT_LABEL[order.exportFormat] : 'PDF export';
  const price = displayPrice(order);

  return (
    <div className="space-y-6">
      <OrderBackLink />

      <OrderHero order={order} isTechPack statusLabel={techPackStatusLabel(order.status)}>
        {isReady ? (
          <Button
            className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
            onClick={() => toast.success('Mock: tech pack PDF downloaded')}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        ) : null}
      </OrderHero>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
                <FileText className="h-4 w-4 text-violet-300" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Digital export</h2>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Format', value: exportLabel },
                { label: 'Garment', value: order.garmentType ?? '—' },
                { label: 'Amount', value: price ?? 'Awaiting payment' },
                { label: 'Region', value: `${order.deliveryCity}, ${order.deliveryCountry}` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-white">{row.value}</dd>
                </div>
              ))}
            </dl>

            {isReady ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white">Export ready for download</p>
                </div>
              </div>
            ) : !isPaid ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <Clock className="h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-medium text-white">Awaiting customer payment</p>
                </div>
              </div>
            ) : null}

            {isReady ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
                  onClick={() => toast.success('Mock: PDF downloaded')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/10"
                  onClick={() => toast.success('Mock: download link resent')}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Resend link
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <CustomerCard order={order} />
        </div>
      </div>
    </div>
  );
}

function CustomClothingOrderDetail({
  order,
  onOpsChange,
}: {
  order: SuperAdminOrder;
  onOpsChange?: () => void;
}) {
  const resolved = resolveMarginForManufacturer(order.manufacturerId, order.manufacturerName);
  const marginPercent = order.cerigaMarginPercent ?? resolved.platformMarginPercent;

  const quoteTiers = useMemo(
    () => withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent),
    [order, marginPercent],
  );

  const [finalByTier, setFinalByTier] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const tier of withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent)) {
      const cents = tier.finalPriceCents ?? tier.calculatedPriceCents;
      init[tier.id] = cents != null ? (cents / 100).toFixed(2) : '';
    }
    return init;
  });
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [submitted, setSubmitted] = useState(false);

  const canReview = order.status === 'pending_review' && quoteTiers.length > 0;
  const awaitingQuote = Boolean(order.manufacturerName) && quoteTiers.length === 0;
  const quantityLines = order.orderQuantities
    ? formatOrderQuantitiesSummary(order.orderQuantities)
    : [];

  const parseTierFinals = () => {
    const rows: { id: string; label: string; cents: number; calculated: number | null }[] = [];
    for (const tier of quoteTiers) {
      const n = Number(finalByTier[tier.id]);
      if (!Number.isFinite(n) || n <= 0) return null;
      rows.push({
        id: tier.id,
        label: tier.label,
        cents: Math.round(n * 100),
        calculated: tier.calculatedPriceCents ?? null,
      });
    }
    return rows;
  };

  const useAllCalculated = () => {
    const next: Record<string, string> = {};
    for (const tier of quoteTiers) {
      next[tier.id] =
        tier.calculatedPriceCents != null
          ? (tier.calculatedPriceCents / 100).toFixed(2)
          : finalByTier[tier.id] ?? '';
    }
    setFinalByTier(next);
  };

  const submitToBrand = () => {
    const rows = parseTierFinals();
    if (!rows || rows.length === 0) {
      toast.error('Enter a valid final price for every quote tier');
      return;
    }
    setSubmitted(true);
    toast.success(
      `Mock: ${rows.length} pricing options sent to brand (${rows
        .map((r) => `${r.label} ${formatMoney(r.cents)}`)
        .join(' · ')})`,
    );
  };

  const pricingLocked =
    submitted ||
    order.status === 'sent_to_brand' ||
    quoteTiers.some((t) => t.finalPriceCents != null) ||
    order.finalPriceCents != null;

  return (
    <div className="space-y-6">
      <OrderBackLink />

      <OrderHero order={order} isTechPack={false} statusLabel={customStatusLabel(order.status)}>
        {canReview && !submitted ? (
          <Button
            className="bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
            onClick={submitToBrand}
          >
            <Send className="mr-2 h-4 w-4" />
            Submit to brand
          </Button>
        ) : null}
      </OrderHero>

      {submitted ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-white">Pricing options sent to brand</p>
            <p className="text-xs text-white/50">
              {quoteTiers.length} tiers · {order.userEmail}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section
            className={cn(
              'rounded-2xl border bg-[#111113] p-5 sm:p-6',
              canReview && !submitted
                ? 'border-[#CC2D24]/30 ring-1 ring-[#CC2D24]/15'
                : 'border-white/[0.08]',
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2D24]/15">
                  <Calculator className="h-4 w-4 text-[#CC2D24]" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {canReview && !submitted ? 'Price review' : 'Pricing'}
                  </h2>
                  <p className="text-[11px] text-white/40">
                    Sample + bulk tiers · {marginPercent}% {resolved.planName} margin
                  </p>
                </div>
              </div>
              {quoteTiers.length > 0 && !pricingLocked ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={useAllCalculated}
                >
                  Use calculated for all
                </button>
              ) : null}
            </div>

            {quantityLines.length > 0 ? (
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Brand requested
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[12px] text-white/60">
                  {quantityLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {quoteTiers.length > 0 ? (
              <div className="mt-5 space-y-3">
                {quoteTiers.map((tier) => {
                  const edited = Number(finalByTier[tier.id]);
                  const editedCents =
                    Number.isFinite(edited) && edited > 0 ? Math.round(edited * 100) : null;
                  const changed =
                    tier.calculatedPriceCents != null &&
                    editedCents != null &&
                    editedCents !== tier.calculatedPriceCents;

                  return (
                    <div
                      key={tier.id}
                      className="rounded-xl border border-white/[0.08] bg-black/25 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{tier.label}</p>
                          <p className="text-[11px] text-white/40">
                            {tier.kind === 'sample' ? 'Sample run' : 'Bulk production'}
                            {tier.totalUnits > 0 ? ` · ${tier.totalUnits} units` : ''}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            tier.kind === 'sample'
                              ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
                          )}
                        >
                          {tier.kind}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                            Mfg quote
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                            {formatMoney(tier.manufacturerQuoteCents)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                            + Margin
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                            {tier.calculatedPriceCents != null
                              ? formatMoney(tier.calculatedPriceCents)
                              : '—'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#CC2D24]/25 bg-[#CC2D24]/8 px-3 py-2">
                          <Label
                            htmlFor={`final-${tier.id}`}
                            className="text-[9px] font-semibold uppercase tracking-wider text-white/50"
                          >
                            To brand (£)
                          </Label>
                          <Input
                            id={`final-${tier.id}`}
                            value={finalByTier[tier.id] ?? ''}
                            onChange={(e) =>
                              setFinalByTier((prev) => ({ ...prev, [tier.id]: e.target.value }))
                            }
                            disabled={pricingLocked}
                            className="mt-1 h-8 border-white/12 bg-black/40 text-sm tabular-nums text-white disabled:opacity-50"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {changed ? (
                        <p className="mt-2 text-[11px] text-amber-200/80">
                          Custom price differs from calculated
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                {!pricingLocked ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={submitToBrand}>
                      <Send className="mr-2 h-4 w-4" />
                      {canReview ? 'Submit all tiers to brand' : 'Send to brand'}
                    </Button>
                    {canReview ? (
                      <Button
                        variant="outline"
                        className="border-white/15 text-white hover:bg-white/10"
                        asChild
                      >
                        <Link to="/superadmin/orders/review" state={{ startOrderId: order.id }}>
                          Review all in queue
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      className="border-white/15 text-white hover:bg-white/10"
                      onClick={() => toast.success('Mock: pricing draft saved')}
                    >
                      Save draft
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <Factory className="h-5 w-5 text-amber-200" />
                  </span>
                  <p className="font-medium text-white">
                    {awaitingQuote
                      ? `Waiting on ${order.manufacturerName} for sample + bulk quotes`
                      : 'No manufacturer quote yet'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <ProductionSpecCard order={order} />
          <ProductionPulseCard order={order} onOpsChange={onOpsChange} />
          <ProductionQcGallery
            orderId={order.id}
            emptyHint="No factory QC photos published for this order yet."
          />
        </div>

        <div className="space-y-6">
          <CustomerCard order={order} />
          <ManufacturerCard order={order} />
          <DeliveryCard order={order} />

          {['paid', 'in_production', 'shipped', 'completed'].includes(order.status) ? (
            <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Truck className="h-4 w-4 text-[#CC2D24]" />
                Tracking
              </h2>
              <div className="mt-4 space-y-3">
                <Input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="border-white/12 bg-black/40 font-mono text-sm text-white"
                  placeholder="Carrier tracking ID"
                />
                <Button
                  variant="outline"
                  className="w-full border-white/15 text-white hover:bg-white/10"
                  onClick={() => toast.success('Mock: tracking saved')}
                >
                  Save tracking
                </Button>
              </div>
            </section>
          ) : null}

          <Button
            variant="outline"
            className="w-full border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link to="/superadmin/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All orders
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
