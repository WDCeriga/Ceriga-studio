import {InternalWorkPanel} from '../../components/superadmin/InternalWorkPanel';
import { formatQuantityLine as cerigaQuantityLine } from '../../i18n/i18n';
import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { AdminRecordControls } from '../../components/superadmin/AdminRecordControls';
import { OrderCommunication } from '../../components/orders/OrderCommunication';
import { InternalOrderTask } from '../../components/superadmin/InternalOrderTask';
import { AdminFactoryDocuments } from '../../components/superadmin/AdminFactoryDocuments';
import './superadmin-order-detail.css';
import {FreightTotalPreview} from '../../components/freight/FreightTotalPreview';
import {FreightReview} from '../../components/freight/FreightReview';
import { ProductionProgress } from '../../components/manufacturer/ProductionProgress';
import { amountToCents } from '../../lib/currency';
import { formatMoney as originalMoney } from '../../lib/currency';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import { RejectQuotation } from '../../components/superadmin/RejectQuotation';
import { OrderRoutingHistory } from '../../components/superadmin/OrderRoutingHistory';
import { useMemo, useState, useRef, type ReactNode } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
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
import { Loader2 } from 'lucide-react';
import {
  STATUS_LABELS,
  formatMoney,
  getOrderQuoteTiers,
  resolveMarginForManufacturer,
  withCalculatedQuoteTiers,
  type CustomerTechPackRef,
  type OrderStatus,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import { downloadTechPackPdf } from '../../lib/techPackPdf';
import { resolveTechPackData } from '../../lib/techPackResolve';
import type { UserOrder } from '../../data/userOrders';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { formatDeliveryLines, type OrderDeliveryInfo } from '../../data/orderDelivery';
import { formatOrderQuantitiesSummary } from '../../data/orderQuantities';
import { getProductById } from '../../data/products';
import { ProductionQcGallery } from '../../components/orders/ProductionQcGallery';
import { OrderQualityControl } from '../../components/quality/OrderQualityControl';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
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
  return new Date(iso).toLocaleDateString(cerigaLocale(), {
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

async function copyText(text: string, label: string) {
  try{await navigator.clipboard.writeText(text);toast.success(cerigaTranslate("interface.text_80d930b333bbfcc5",{value0:(label)}));}catch{toast.error(cerigaTranslate("interface.text_82fa53d778b3773a",{value0:(label)}));}
}

function displayPrice(order: SuperAdminOrder) {
  if (order.finalPriceCents != null) return displayMoney(order.finalPriceCents,order.currency);
  if (order.calculatedPriceCents != null) return displayMoney(order.calculatedPriceCents,order.manufacturerCurrency);
  return null;
}

function mockQuantity(productName: string) {
  const match = productName.match(/(\d[\d,]*)\s*(units?|hoodies?|pcs?|pieces?)/i);
  return match ? match[1].replace(/,/g, '') : null;
}

export function SuperAdminOrderDetail() {
  useCerigaTranslation();

  useCurrency();
  const { id } = useParams();
  const { orders, patchOrder, refresh,loading,error } = useSuperadminData({scope:'orders',orderId:id});
  const order = id ? orders.find((o) => o.id === id) : undefined;

  if (!order) {
    return (
      <div role={error?'alert':loading?'status':undefined} className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <Package className="h-10 w-10 text-white/25" />
        <h2 className="mt-4 text-lg font-semibold text-white">
          {error?cerigaTranslateLabel(error):loading?cerigaTranslate("interface.text_5a5f7fb48c3b602b") : cerigaTranslate("interface.text_30658cae73f22632")}
        </h2>
        {error&&<Button className="mt-4" onClick={()=>void refresh()}>{cerigaTranslate('common.retry')}</Button>}
        {loading ? null : (
          <Button asChild className="mt-6 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/superadmin/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />{cerigaTranslate("orders.back")}</Link>
          </Button>
        )}
      </div>
    );
  }

  const actions = <AdminRecordControls entity="order" id={order.id} onSaved={refresh} />;
  if (order.kind === 'techpack') {
    return <TechPackOrderDetail order={order} actions={actions} />;
  }

  return (
    <CustomClothingOrderDetail
      order={order}
      actions={actions}
      onOpsChange={async(patch) => {
        const saved=await patchOrder(order.id,patch);if(!saved)throw new Error('Order update was not saved. Please try again.');
      }}
      onOpsSubmitPricing={async (rows) => {
        const ok = await patchOrder(order.id, {
          approvedPrices: rows.map(row=>({id:row.id,cents:row.cents,...row.charges})),
          status: 'sent_to_brand',
          statusLabel: 'Quote sent to brand',
        });
        return ok;
      }}
    />
  );
}

function OrderBackLink() {
  useCerigaTranslation();

  useCurrency();
  return (
    <Link
      to="/superadmin/orders"
      className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />{cerigaTranslate("nav.orders")}</Link>
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
  useCerigaTranslation();

  useCurrency();
  const currentRank = STATUS_RANK[order.status];

  const stepState = (stepStatus: OrderStatus) => {
    const stepRank = STATUS_RANK[stepStatus];
    if (order.status === stepStatus) return 'current' as const;
    if (currentRank > stepRank) return 'done' as const;
    return 'upcoming' as const;
  };

  return (
    <div className="od-workflow mt-6 border-t border-[#252528] pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("adminOrders.progress")}</p>
      <div className="od-workflow-track mt-4 flex items-start gap-0.5 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const state = stepState(step.status);
          return (
            <div key={step.status} data-step-state={state} aria-current={state==='current'?'step':undefined} className="flex min-w-[52px] flex-1 items-center">
              <div className="flex w-full flex-col items-center gap-2">
                <span
                  className={cn(
                    'od-step-marker flex h-8 w-8 items-center justify-center rounded-full border transition',
                    state === 'done' && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
                    state === 'current' &&
                      (accent === 'violet'
                        ? 'border-violet-400/50 bg-violet-500/20 text-violet-200'
                        : 'border-[#CC2D24]/50 bg-[#CC2D24]/20 text-red-200'),
                    state === 'upcoming' && 'border-[#252528] bg-white/[0.03] text-white/25',
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
                  {cerigaTranslateLabel(step.label)}
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
  useCerigaTranslation();

  useCurrency();
  const gradient = isTechPack
    ? 'from-violet-500/14 via-violet-500/[0.03] to-transparent'
    : 'from-[#CC2D24]/14 via-[#CC2D24]/[0.02] to-transparent';
  const accentColor = isTechPack ? 'text-violet-300' : 'text-[#CC2D24]';
  const accentBg = isTechPack ? 'bg-violet-500/15' : 'bg-[#CC2D24]/15';
  const price = displayPrice(order);
  const steps = isTechPack ? TECHPACK_STEPS : CUSTOM_STEPS;

  return (
    <div data-physical={!isTechPack} className="od-hero overflow-hidden rounded-2xl border border-[#252528] bg-[#111113]">
      <div className="od-hero-body">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#252528]',
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
                  aria-label={cerigaTranslate("adminOrders.copy")}
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
                  {cerigaTranslateLabel(statusLabel)}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                    KIND_STYLE[order.kind],
                  )}
                >
                  {isTechPack ? <Package className="h-3 w-3" /> : <Shirt className="h-3 w-3" />}
                  {isTechPack ? cerigaTranslate("adminOrders.techpack") : cerigaTranslate("adminOrders.clothing")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        </div>

        <div className="od-hero-facts mt-5 grid gap-3 sm:grid-cols-3">
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
                  sub: order.exportFormat ? EXPORT_LABEL[order.exportFormat] : cerigaTranslate("interface.text_1236501cbaea69ff"),
                  icon: FileText,
                }
              : {
                  label: 'Manufacturer',
                  value: order.manufacturerName ?? cerigaTranslate("adminOrders.unassigned"),
                  icon: Factory,
                },
            {
              label: isTechPack ? cerigaTranslate("adminOrders.billing") : cerigaTranslate("nav.delivery"),
              value: isTechPack
                ? price ?? cerigaTranslate("orders.pending")
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
              className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3.5"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                <item.icon className="h-3.5 w-3.5" />
                {cerigaTranslateLabel(item.label)}
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
  useCerigaTranslation();

  useCurrency();
  return (
    <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("adminOrders.customer")}</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#252528] bg-white/[0.04] text-sm font-bold text-white/75">
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
            <User className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("common.profile")}</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => {
            window.location.href = `mailto:${encodeURIComponent(order.userEmail)}?subject=${encodeURIComponent(`Ceriga order ${order.id}`)}`;
          }}
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}

function DeliveryCard({ order }: { order: SuperAdminOrder }) {
  useCerigaTranslation();

  useCurrency();
  const delivery: OrderDeliveryInfo | undefined = order.delivery;
  return (
    <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("nav.delivery")}</h2>
      {delivery ? (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_2b5c3d26721ae9c3")}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_56ef8f20955f2564")}</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_4e80e96365cc0517")}</p>
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
  useCerigaTranslation();

  useCurrency();
  const tiers = getOrderQuoteTiers(order);
  const hasQuote = tiers.length > 0;
  const awaitingQuote = Boolean(order.manufacturerName) && !hasQuote;

  return (
    <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("adminOrders.factory")}</h2>
      {order.manufacturerName ? (
        <div className="mt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Factory className="h-4 w-4 text-amber-200" />
            </span>
            <div>
              <p className="font-medium text-white">{order.manufacturerName}</p>
              {order.dueQuoteBy && !hasQuote ? (
                <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("manufacturerOrders.quoteDue")}{" "}{new Date(order.dueQuoteBy).toLocaleDateString(cerigaLocale(), {
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
                  : 'border-[#252528] bg-white/[0.03] text-white/50',
            )}
          >
            {hasQuote
              ? cerigaTranslate("interface.plural_6908bca22f99f40a",{value0:(tiers.length),count:Number(tiers.length)})
              : awaitingQuote
                ? cerigaTranslate("interface.text_b43312d5304c5eaf")
                : cerigaTranslate("interface.text_fb8d687288430613")}
          </div>
          {order.factoryRejectReason ? (
            <p className="mt-2 text-[11px] text-red-200/80">{cerigaTranslate("interface.text_85be99c92549ca81")}{" "}{order.factoryRejectReason}</p>
          ) : null}
          {hasQuote ? (
            <ul className="mt-3 space-y-1.5">
              {tiers.map((tier) => (
                <li
                  key={tier.id}
                  className="flex items-center justify-between gap-2 text-[11px] text-white/50"
                >
                  <span>
                    {cerigaTranslateLabel(tier.label)}
                    {tier.totalUnits > 0 ? ` · ${tier.totalUnits}u` : ''}
                  </span>
                  <span className="tabular-nums text-white/75">
                    {displayMoney(tier.manufacturerQuoteCents,tier.currency)}<span className="mt-1 block text-[11px] font-normal text-white/45">{cerigaTranslate("interface.text_71cd5f2db91a7385")}{" "}{tier.currency?originalMoney(tier.manufacturerQuoteCents,tier.currency):cerigaTranslate("interface.text_7e1bb820a1eb1b10")}</span>{tier.payableCurrency&&tier.payablePriceCents!=null&&<span className="mt-1 block text-[11px] font-normal text-white/60">{cerigaTranslate("interface.text_d8e76aca7a91f729")}{" "}{originalMoney(tier.payablePriceCents,tier.payableCurrency)}{" "}{cerigaTranslate("interface.text_f832bb4f4783ada1")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            to="/superadmin/assignment"
            className="mt-3 inline-flex text-[11px] text-[#CC2D24] hover:underline"
          >{cerigaTranslate("interface.text_f22813a13bf672c3")}</Link>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-white/45">{cerigaTranslate("interface.text_6369a2e68384742f")}</p>
          <Link
            to="/superadmin/assignment"
            className="mt-2 inline-flex text-[11px] text-[#CC2D24] hover:underline"
          >{cerigaTranslate("interface.text_d7417aad37cda733")}</Link>
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
  useCerigaTranslation();

  useCurrency();
  const pulse = getProductionPulse(order.id);
  const [flagOpen, setFlagOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_e1a7cfbb2c6700c7")}</h2>
          <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_36ca255e28f39199")}</p>
        </div>
        {pulse.flagged ? (
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/[0.03] text-white/80"
            onClick={() => {
              clearQcBrandFlag(order.id);
              toast.success(cerigaTranslate("interface.text_1c0885a69cc91a16"));
              onOpsChange?.();
            }}
          >{cerigaTranslate("interface.text_eaf05d552ed6174f")}</Button>
        ) : (
          <Button
            size="sm"
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            onClick={() => setFlagOpen(true)}
          >
            <Flag className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_be3ece5c6d23b291")}</Button>
        )}
      </div>

      {pulse.job ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#252528] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">{cerigaTranslate("interface.text_de838855e4a6e04e")}</p>
            <p className="mt-0.5 text-sm font-medium text-white">
              {cerigaTranslateLabel(PRODUCTION_STAGE_LABEL[pulse.job.stage])}
            </p>
          </div>
          <div className="rounded-xl border border-[#252528] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">{cerigaTranslate("interface.text_5e20d20e3978dcf8")}</p>
            <p className="mt-0.5 text-sm font-medium text-white">
              {pulse.job.assigneeName ?? cerigaTranslate("adminOrders.unassigned")}
            </p>
          </div>
          <div className="rounded-xl border border-[#252528] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">{cerigaTranslate("interface.text_f88e7bfd339f8f17")}</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-white">{pulse.photoCount}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/40">{cerigaTranslate("interface.text_cef537b0f6f48057")}</p>
      )}

      {pulse.flagged ? (
        <p className="mt-3 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[12px] text-violet-100">{cerigaTranslate("interface.text_66c4900d1a56293e")}{pulse.flaggedAt ? ` · ${pulse.flaggedAt}` : ''}
          {pulse.flagNote ? ` — ${pulse.flagNote}` : ''}
        </p>
      ) : null}

      <ConfirmDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        title={cerigaTranslate("interface.text_a695604c101170fa")}
        description={cerigaTranslate("interface.text_e4f9bbd73d121f3a")}
        confirmLabel={cerigaTranslate("interface.text_be3ece5c6d23b291")}
        onConfirm={() => {
          flagQcForBrand(order.id, 'Please review published QC photos');
          toast.success(cerigaTranslate("interface.text_c24a181a403f83df"));
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

/** Generate + download the real tech pack PDF for an order (live from the linked project). */
async function exportOrderTechPackPdf(order: SuperAdminOrder): Promise<void> {
  const techPack = order.customerTechPack;
  const techPackLike = order as unknown as {
    specifications?: Parameters<typeof resolveTechPackData>[0]['specifications'];
    orderQuantities?: Parameters<typeof resolveTechPackData>[0]['orderQuantities'];
  };
  const { data } = await resolveTechPackData({
    projectId: techPack?.projectId,
    productId: techPack?.builderProductId,
    productName: techPack?.name ?? order.productName,
    specifications: techPackLike.specifications,
    orderQuantities: techPackLike.orderQuantities ?? order.orderQuantities,
  });
  await downloadTechPackPdf(data);
}

/** Download button used across the tech pack surfaces. */
function TechPackDownloadButton({
  order,
  label = 'Download PDF',
  size,
  variant = 'outline',
  className,
}: {
  order: SuperAdminOrder;
  label?: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'default';
  className?: string;
}) {
  useCerigaTranslation();

  useCurrency();
  const [exporting, setExporting] = useState(false);
  const handle = async () => {
    setExporting(true);
    try {
      await exportOrderTechPackPdf(order);
      toast.success(cerigaTranslate("interface.text_fd9b10ceead5a657"));
    } catch (err) {
      console.error('Tech pack export failed', err);
      toast.error(cerigaTranslate("interface.text_4e2811a6ee9ccc94"));
    } finally {
      setExporting(false);
    }
  };
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() => void handle()}
      disabled={exporting}
    >
      {exporting ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-2 h-3.5 w-3.5" />
      )}
      {exporting ? cerigaTranslate("interface.text_d20a4476a0a85978") : label}
    </Button>
  );
}

function exportFormatLabel(format?: CustomerTechPackRef['exportFormat']) {
  if (format === 'pdf_bundle') return 'PDF + ZIP bundle';
  return 'PDF export';
}

function TechPackViewerDialog({
  techPack,
  customerName,
  order,
  open,
  onOpenChange,
}: {
  techPack: CustomerTechPackRef;
  customerName: string;
  order: SuperAdminOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useCerigaTranslation();

  useCurrency();
  const product = getProductById(techPack.builderProductId);
  const builderHref = builderUrl(techPack);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#252528] bg-[#111113] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">{techPack.name}</DialogTitle>
          <DialogDescription className="text-white/45">{cerigaTranslate("interface.text_03960b7892291a6c")}{" "}{customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {product?.image ? (
            <div className="overflow-hidden rounded-xl border border-[#252528] bg-black/40">
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

          <dl className="divide-y divide-white/[0.06] rounded-xl border border-[#252528] bg-black/25">
            {[
              { label: 'Garment', value: techPack.garmentType },
              { label: 'Blueprint', value: product?.name ?? techPack.builderProductId },
              { label: 'Format', value: exportFormatLabel(techPack.exportFormat) },
              { label: 'Pages', value: techPack.pageCount ? cerigaTranslate("interface.text_33ba9ffc8e6096fd",{value0:(techPack.pageCount)}) : '—' },
              {
                label: 'Last exported',
                value: techPack.lastExportedAt ? formatDate(techPack.lastExportedAt) : '—',
              },
              { label: 'Project ID', value: techPack.projectId, mono: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-white/45">{cerigaTranslateLabel(row.label)}</dt>
                <dd className={cn('text-right font-medium text-white/85', row.mono && 'font-mono text-xs')}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-xl border border-[#252528] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_df498282bede20a9")}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/60">
              <li>{cerigaTranslate("interface.text_19200d3db3e5efac")}</li>
              <li>{cerigaTranslate("interface.text_7512424a9bd76e56")}</li>
              <li>{cerigaTranslate("interface.text_ddad9fb24ffa3f5a")}</li>
              <li>{cerigaTranslate("interface.text_d25a20d319b653c6")}</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1 bg-[#CC2D24] hover:bg-[#CC2D24]/90" asChild>
              <a href={builderHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_28516bcfe43e79de")}</a>
            </Button>
            <TechPackDownloadButton
              order={order}
              className="flex-1 border-white/15 text-white hover:bg-white/10"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductionSpecCard({ order }: { order: SuperAdminOrder }) {
  useCerigaTranslation();

  useCurrency();
  const qty = mockQuantity(order.productName);
  const techPack = order.customerTechPack;
  const [viewerOpen, setViewerOpen] = useState(false);
  const product = techPack ? getProductById(techPack.builderProductId) : undefined;

  return (
    <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_1720732f3fd319fb")}</h2>

      {techPack ? (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_8091194c4abb4e0f")}</p>
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
                  className="h-16 w-16 shrink-0 rounded-lg border border-[#252528] object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                  <FileText className="h-6 w-6 text-violet-300" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white group-hover:text-violet-100">{techPack.name}</p>
                <p className="mt-1 text-xs text-white/45">
                  {techPack.garmentType} · {cerigaTranslateLabel(exportFormatLabel(techPack.exportFormat))}
                  {techPack.pageCount ? cerigaTranslate("interface.text_cbb67f1b26438459",{value0:(techPack.pageCount)}) : ''}
                </p>
                {techPack.lastExportedAt ? (
                  <p className="mt-1 text-[11px] text-white/35">{cerigaTranslate("interface.text_391065e4dc23592a")}{" "}{formatDate(techPack.lastExportedAt)}
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
              <FileText className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_d97ec00f47fd96a9")}</Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 text-white hover:bg-white/10"
              asChild
            >
              <a href={builderUrl(techPack)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_28516bcfe43e79de")}</a>
            </Button>
            <TechPackDownloadButton
              order={order}
              size="sm"
              label={cerigaTranslate("interface.text_1d393b0081b632c5")}
              className="border-white/15 text-white hover:bg-white/10"
            />
          </div>

          <TechPackViewerDialog
            techPack={techPack}
            customerName={order.userName}
            order={order}
            open={viewerOpen}
            onOpenChange={setViewerOpen}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">{cerigaTranslate("interface.text_df108974640c479e")}</p>
        </div>
      )}

      <dl className="mt-5 divide-y divide-white/[0.06] rounded-xl border border-[#252528] bg-black/20">
        {[
          { label: 'Product', value: order.productName },
          { label: 'Quantity', value: qty ? cerigaTranslate("interface.text_44b3c2a4a47289c6",{value0:(qty)}) : '—' },
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
            <dt className="shrink-0 text-white/45">{cerigaTranslateLabel(row.label)}</dt>
            <dd className="text-right font-medium text-white/85">{row.value}</dd>
          </div>
        ))}
      </dl>

      {order.notes ? (
        <div className="mt-4 rounded-xl border border-[#252528] bg-white/[0.02] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("adminOrders.notes")}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{order.notes}</p>
        </div>
      ) : null}
    </section>
  );
}

function TechPackOrderDetail({ order, actions }: { order: SuperAdminOrder; actions: ReactNode }) {
  useCerigaTranslation();

  useCurrency();
  const isReady = order.status === 'completed';
  const isPaid = order.status === 'paid' || isReady;
  const exportLabel = order.exportFormat ? EXPORT_LABEL[order.exportFormat] : 'PDF export';
  const price = displayPrice(order);

  return (
    <div className="admin-order-detail space-y-6">
      <OrderBackLink />
      {order.routingVersion===2 && <OrderRoutingHistory orderId={order.id} />}
      {order.quoteExpiresAt && <p className="rounded-lg border border-amber-500/20 p-3 text-sm text-amber-200">{cerigaTranslate("interface.text_14dbbdb2de98b6ba")}{" "}{new Date(order.quoteExpiresAt).toLocaleString(cerigaLocale())}{cerigaTranslate("interface.text_f46c191399dd8703")}</p>}

      <OrderHero order={order} isTechPack statusLabel={techPackStatusLabel(order.status)}>
        {actions}
        {isReady ? (
          <TechPackDownloadButton
            order={order}
            variant="default"
            className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
          />
        ) : null}
      </OrderHero>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
                <FileText className="h-4 w-4 text-violet-300" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_6e4e19b0b873d745")}</h2>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Format', value: exportLabel },
                { label: 'Garment', value: order.garmentType ?? '—' },
                { label: 'Amount', value: price ?? cerigaTranslate("adminOrders.awaitPayment") },
                { label: 'Region', value: `${order.deliveryCity}, ${order.deliveryCountry}` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-[#252528] bg-white/[0.02] px-4 py-3"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {cerigaTranslateLabel(row.label)}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-white">{row.value}</dd>
                </div>
              ))}
            </dl>

            {isReady ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white">{cerigaTranslate("interface.text_8b10ded78074384c")}</p>
                </div>
              </div>
            ) : !isPaid ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <Clock className="h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-medium text-white">{cerigaTranslate("interface.text_f6d939c193739283")}</p>
                </div>
              </div>
            ) : null}

            {isReady ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
                  onClick={() => toast.message(cerigaTranslate("interface.text_098b899e25e31499"))}
                >
                  <Download className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_6183be0883d2a89c")}</Button>
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/10"
                  onClick={() => {
                    window.location.href = `mailto:${encodeURIComponent(order.userEmail)}?subject=${encodeURIComponent(`Download link for order ${order.id}`)}`;
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_25a200daeda8bad0")}</Button>
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
  actions,
  onOpsChange,
  onOpsSubmitPricing,
}: {
  order: SuperAdminOrder;
  actions: ReactNode;
  onOpsChange?: (patch: {
    tracking?: string | null;
    opsNotes?: string | null;
  }) => Promise<void>;
  onOpsSubmitPricing?: (rows: {
    id: string;
    label: string;
    cents: number;
    calculated: number | null;
    charges?: Record<string,number>;
  }[]) => Promise<boolean | void>;
}) {
  useCerigaTranslation();

  useCurrency();
  const resolved = resolveMarginForManufacturer(order.manufacturerId, order.manufacturerName);
  const marginPercent = order.cerigaMarginPercent ?? resolved.platformMarginPercent;

  const quoteTiers = useMemo(
    () => withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent),
    [order, marginPercent],
  );

  const [finalByTier, setFinalByTier] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const tier of withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent)) {
      const cents = tier.manufacturingSubtotalCents ?? tier.calculatedPriceCents;
      init[tier.id] = cents != null ? (cents / 100).toFixed(2) : '';
    }
    return init;
  });
  const pricingLock=useRef(false);
  const [savingPricing,setSavingPricing]=useState(false);
  const [shippingReady,setShippingReady]=useState(false);
  const [charges,setCharges]=useState<Record<string,Record<string,string>>>({});
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [savingTracking, setSavingTracking] = useState(false);
  const trackingLock=useRef(false);
  const [submitted, setSubmitted] = useState(false);

  const canReview = order.status === 'pending_review' && quoteTiers.length > 0;
  const awaitingQuote = Boolean(order.manufacturerName) && quoteTiers.length === 0;
  const quantityLines = order.orderQuantities
    ? formatOrderQuantitiesSummary(order.orderQuantities, cerigaQuantityLine).map(cerigaTranslateLabel)
    : [];

  const parseTierFinals = () => {
    const rows: { id: string; label: string; cents: number; calculated: number | null; charges:Record<string,number> }[] = [];
    for (const tier of quoteTiers) {
      const n = amountToCents(finalByTier[tier.id]??'');
      if (!Number.isSafeInteger(n) || n==null || n <= 0) return null;
      rows.push({
        id: tier.id,
        label: tier.label,
        cents: n!,
        calculated: tier.calculatedPriceCents ?? null,
        charges:Object.fromEntries(['feesCents','taxCents','dutiesCents','otherCents'].map(k=>[k,amountToCents(charges[tier.id]?.[k]||'0')??NaN])),
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
    if(pricingLock.current)return;
    if(!shippingReady){toast.error(cerigaTranslate("interface.text_56bd263bb5dc4df6"));return;}
    const rows = parseTierFinals();
    if (!rows || rows.length === 0) {
      toast.error(cerigaTranslate("interface.text_efd731e9508cd365"));
      return;
    }
    pricingLock.current=true;setSavingPricing(true);
    void (async () => { try {
      const ok = await onOpsSubmitPricing?.(rows);
      if (ok === false) {
        toast.error(cerigaTranslate("interface.text_66dc71aa4bf00d38"));
        return;
      }
      setSubmitted(true);
      toast.success(cerigaTranslate("interface.text_bb742dc95e400cc4"));
    }catch(e){toast.error(cerigaTranslateLabel(e instanceof Error?e.message:cerigaTranslate("interface.text_689aef46e4ebba56")));}finally{pricingLock.current=false;setSavingPricing(false);}})();
  };

  const navigate=useNavigate();
  const expiredOffer=Boolean(order.quoteExpiresAt && new Date(order.quoteExpiresAt).getTime()<=Date.now());
  const canPrepareQuote=['draft','submitted','assigned','pending_review'].includes(order.status)||(order.status==='sent_to_brand'&&expiredOffer);
  const fulfilment=['paid','in_production','shipped','completed'].includes(order.status);
  const deliveryStage=['shipped','completed'].includes(order.status);
  const pricingLocked = !canPrepareQuote || (!expiredOffer && (
    submitted ||
    (order.status === 'sent_to_brand' && quoteTiers.some(tier=>tier.finalPriceCents!=null)) ||
    quoteTiers.some((t) => t.finalPriceCents != null) ||
    order.finalPriceCents != null));

  return (
    <div className="admin-order-detail space-y-6">
      <OrderBackLink />

      <OrderHero order={order} isTechPack={false} statusLabel={customStatusLabel(order.status)}>
        {actions}
        {canReview && !submitted && shippingReady ? (
          <Button
            className="bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
            onClick={submitToBrand}
          >
            <Send className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_7dad3d5a8fabf751")}</Button>
        ) : null}
      </OrderHero>

      <InternalOrderTask order={order} shippingReady={shippingReady}/>
      {isSupabaseConfigured&&<InternalWorkPanel orderId={order.id} kind="amendment"/>}
      {isSupabaseConfigured && <details className="od-conversation" open={typeof window!=='undefined'&&window.location?.hash==='#customer-communication'?true:undefined}>
        <summary>{cerigaTranslateLabel('Order communication')}</summary>
        <OrderCommunication key={order.id} orderId={order.id} scope="admin" />
      </details>}

      {submitted ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-white">{cerigaTranslate("interface.text_2fca47afd0bffdff")}</p>
            <p className="text-xs text-white/50">
              {quoteTiers.length}{" "}{cerigaTranslate("interface.text_23da944803b4991c")}{" "}{order.userEmail}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {fulfilment&&isSupabaseConfigured&&<div id="current-work" className="od-current-work"><div className="od-stage-heading"><span>{cerigaTranslate("interface.text_89b1b15f967e3553")}</span><h2>{deliveryStage?cerigaTranslate("interface.text_45b41c8d5ff43b57"):cerigaTranslate("interface.text_fa9028fa2df41fe9")}</h2><p>{deliveryStage?cerigaTranslate("interface.text_fb93c5d31ef59008"):cerigaTranslate("interface.text_463c309690425bbe")}</p></div>{!deliveryStage&&<ProductionProgress orderId={order.id}/>}<OrderQualityControl orderId={order.id} view={deliveryStage?'delivery':'quality'}/></div>}
          <details id="quotation-review" className="od-pricing" open={canReview&&quoteTiers.length>0}><summary>{canPrepareQuote?cerigaTranslate("interface.text_a46713fdca737282"):cerigaTranslate("interface.text_823daabd3ff07973")}<span>{canPrepareQuote?cerigaTranslate("interface.text_5e2e997e45799248"):cerigaTranslate("interface.text_f6c4f489151a387b")}</span></summary>
          <section
            className={cn(
              'rounded-2xl border bg-[#111113] p-5 sm:p-6',
              canReview && !submitted
                ? 'border-[#CC2D24]/30 ring-1 ring-[#CC2D24]/15'
                : 'border-[#252528]',
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2D24]/15">
                  <Calculator className="h-4 w-4 text-[#CC2D24]" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {canReview && !submitted ? cerigaTranslate("interface.text_69017a5771a9d89d") : cerigaTranslate("nav.pricing")}
                  </h2>
                  <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_1f5c14216fb866c8")}{" "}{marginPercent}% {resolved.planName}{" "}{cerigaTranslate("interface.text_34e39f662ff56641")}</p>
                </div>
              </div>
              {quoteTiers.length > 0 && !pricingLocked ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={useAllCalculated}
                >{cerigaTranslate("interface.text_3e4323a63fc4a9df")}</button>
              ) : null}
            </div>

            {quantityLines.length > 0 ? (
              <div className="mt-4 rounded-xl border border-[#252528] bg-white/[0.02] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_92291e8eb6925ffd")}</p>
                <ul className="mt-1.5 space-y-0.5 text-[12px] text-white/60">
                  {quantityLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canPrepareQuote&&<FreightReview orderId={order.id} onReady={setShippingReady}/>}
            {!canPrepareQuote&&<details className="od-shipping-audit"><summary>{cerigaTranslate("interface.text_d8fd290490b326d9")}</summary><FreightReview orderId={order.id}/></details>}
            {!pricingLocked&&<FreightTotalPreview orderId={order.id} prices={()=>parseTierFinals()?.map(r=>({id:r.id,cents:r.cents,...r.charges}))||null}/>}
            {canPrepareQuote&&<p className="text-xs text-white/50">{cerigaTranslate("interface.text_9e1847bd1d397ccb")}</p>}
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
                      className="rounded-xl border border-[#252528] bg-black/25 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{cerigaTranslateLabel(tier.label)}</p>
                          <p className="text-[11px] text-white/40">
                            {tier.kind === 'sample' ? cerigaTranslate("interface.text_1405635fe7ab913d") : cerigaTranslate("interface.text_a23e5cc9e908115f")}
                            {tier.totalUnits > 0 ? cerigaTranslate("interface.text_cd5d90c4d566a384",{value0:(tier.totalUnits)}) : ''}
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
                        <div className="rounded-lg border border-[#252528] bg-white/[0.02] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_0de5a45c89895e77")}</p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                            {displayMoney(tier.manufacturerQuoteCents,tier.currency)}<span className="mt-1 block text-[11px] font-normal text-white/45">{cerigaTranslate("interface.text_71cd5f2db91a7385")}{" "}{tier.currency?originalMoney(tier.manufacturerQuoteCents,tier.currency):cerigaTranslate("interface.text_7e1bb820a1eb1b10")}</span>{tier.payableCurrency&&tier.payablePriceCents!=null&&<span className="mt-1 block text-[11px] font-normal text-white/60">{cerigaTranslate("interface.text_d8e76aca7a91f729")}{" "}{originalMoney(tier.payablePriceCents,tier.payableCurrency)}{" "}{cerigaTranslate("interface.text_f832bb4f4783ada1")}</span>}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#252528] bg-white/[0.02] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_f1c6550050537f04")}</p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                            {tier.calculatedPriceCents != null
                              ? displayMoney(tier.calculatedPriceCents,tier.currency)
                              : '—'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#CC2D24]/25 bg-[#CC2D24]/8 px-3 py-2">
                          <Label
                            htmlFor={`final-${tier.id}`}
                            className="text-[9px] font-semibold uppercase tracking-wider text-white/50"
                          >
                            {pricingLocked?(tier.finalPriceCents!=null?cerigaTranslate("interface.text_6d3e027aaa96943f"):cerigaTranslate("interface.text_b6516040373a79b8")):cerigaTranslate("interface.text_fcb8f31a271bca1d")} ({tier.currency ?? cerigaTranslate("interface.text_42e19750d12233c0")})
                          </Label>
                          <Input
                            id={`final-${tier.id}`}
                            value={pricingLocked&&tier.finalPriceCents!=null?(tier.finalPriceCents/100).toFixed(2):finalByTier[tier.id] ?? ''}
                            onChange={(e) =>
                              setFinalByTier((prev) => ({ ...prev, [tier.id]: e.target.value }))
                            }
                            disabled={pricingLocked||savingPricing}
                            className="mt-1 h-8 border-white/12 bg-black/40 text-sm tabular-nums text-white disabled:opacity-50"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {changed && !pricingLocked ? (
                        <p className="mt-2 text-[11px] text-amber-200/80">{cerigaTranslate("interface.text_a2889aff5f141b3d")}</p>
                      ) : null}
                      {!pricingLocked&&<div className="freight-fields">{Object.entries({feesCents:'Shipping service fee',taxCents:'Taxes',dutiesCents:'Known duties',otherCents:'Other known charges'}).map(([k,label])=><label key={k}>{cerigaTranslateLabel(label)} ({tier.currency})<input type="number" min="0" step="0.01" value={charges[tier.id]?.[k]||''} placeholder="0.00" onChange={e=>setCharges(previous=>({...previous,[tier.id]:{...previous[tier.id],[k]:e.target.value}}))}/></label>)}</div>}
                    </div>
                  );
                })}

                {!pricingLocked && order.factoryQuoteStatus==='quoted' && <RejectQuotation orderId={order.id} onRejected={action=>{toast.success(cerigaTranslateLabel(action==='revise'?'Revised quotation requested from manufacturer':'Quotation rejected — choose another manufacturer'));if(action==='reassign')navigate('/superadmin/assignment');}} />}
                {!pricingLocked ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" disabled={savingPricing||!shippingReady} onClick={submitToBrand}>
                      <Send className="mr-2 h-4 w-4" />
                      {savingPricing?cerigaTranslate("authentication.sending"):expiredOffer ? cerigaTranslate("interface.text_e350dac7311bbc08") : canReview ? cerigaTranslate("interface.text_250a02e057466a3b") : cerigaTranslate("interface.text_7af81e30fee5aee2")}
                    </Button>
                    {canReview ? (
                      <Button
                        variant="outline"
                        className="border-white/15 text-white hover:bg-white/10"
                        asChild
                      >
                        <Link to={`/superadmin/assignment?view=pricing&order=${encodeURIComponent(order.id)}`}>{cerigaTranslate("interface.text_f6f3fa20b88d121a")}</Link>
                      </Button>
                    ) : null}
<p className="od-draft-note">{cerigaTranslate("interface.text_85724c38ef350cf1")}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-[#252528] bg-gradient-to-br from-white/[0.03] to-transparent p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <Factory className="h-5 w-5 text-amber-200" />
                  </span>
                  <p className="font-medium text-white">
                    {awaitingQuote
                      ? cerigaTranslate("interface.text_290d42a4f3d0fe0a",{value0:(order.manufacturerName)})
                      : cerigaTranslate("interface.text_3cb401c0f3c81e8e")}
                  </p>
                </div>
              </div>
            )}
          </section>
          </details>
          <details id="order-specifications" className="od-specifications"><summary>{cerigaTranslate("interface.text_8a9ec164c9d0f22d")}<span>{cerigaTranslate("interface.text_709869099cf0baee")}</span></summary><ProductionSpecCard order={order}/></details>
          {!isSupabaseConfigured && <ProductionPulseCard order={order} onOpsChange={onOpsChange} />}
          {!isSupabaseConfigured && <ProductionQcGallery
            orderId={order.id}
            emptyHint="No factory QC photos published for this order yet."
          />}
        </div>

        <div className="space-y-6">
          <CustomerCard order={order} />
          <ManufacturerCard order={order} />
          {!deliveryStage&&<DeliveryCard order={order} />}

          {['paid', 'in_production', 'shipped', 'completed'].includes(order.status) ? (
            <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Truck className="h-4 w-4 text-[#CC2D24]" />{cerigaTranslate("adminOrders.tracking")}</h2>
              <div className="mt-4 space-y-3">
                <Input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="border-white/12 bg-black/40 font-mono text-sm text-white"
                  aria-label={cerigaTranslate("interface.text_655d949d53580045")}
                  placeholder={cerigaTranslate("interface.text_655d949d53580045")}
                />
                <Button
                  variant="outline"
                  className="w-full border-white/15 text-white hover:bg-white/10"
                  disabled={savingTracking}
                  onClick={async() => {
                    if(trackingLock.current)return;trackingLock.current=true;setSavingTracking(true);
                    try{if(!onOpsChange)throw new Error('Order updates are unavailable');await onOpsChange({tracking:tracking.trim()||null});toast.success(cerigaTranslate("interface.text_fbbee35a17c54c96"));}
                    catch(e){toast.error(cerigaTranslateLabel(e instanceof Error?e.message:'Tracking could not be saved'));}
                    finally{trackingLock.current=false;setSavingTracking(false);}
                  }}
                >
                  {savingTracking ? cerigaTranslate("common.saving") : cerigaTranslate("interface.text_84991bae1c6db15b")}
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
              <ArrowLeft className="mr-2 h-4 w-4" />{cerigaTranslate("orders.all")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
