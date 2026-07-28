import { Link } from 'react-router';
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Download,
  FileText,
  Pencil,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { OrderQuantitiesSummary } from '../builder/OrderQuantitiesStep';
import {
  canEditOrder,
  canUseFreeRevision,
  checkoutPath,
  formatEuro,
  getPriceOption,
  ORDER_STATUS_COLORS,
  priceValidityDisclaimer,
  updateUserOrder,
  type OrderPriceOption,
  type UserOrder,
} from '../../data/userOrders';
import { ProductionQcGallery } from './ProductionQcGallery';
import { cn } from '../ui/utils';

export function OrderDetailShell({
  order,
  children,
}: {
  order: UserOrder;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F] text-white">
      <div className="border-b border-white/10 px-4 pb-4 pt-4 sm:px-5 md:px-7">
        <Link
          to="/orders"
          className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
              {order.kind === 'tech-pack' ? 'Tech pack' : 'Custom clothing'}
            </p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-white sm:text-[1.65rem]">
              {order.productName}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-white/40">{order.id}</p>
            <p className="mt-1 text-xs text-white/45">
              Placed {order.orderDate} · {order.garmentType}
            </p>
          </div>
          <Badge
            className={cn(
              'shrink-0 text-[10px]',
              ORDER_STATUS_COLORS[order.status] ?? 'bg-white/10 text-white/60',
            )}
          >
            {order.statusLabel}
          </Badge>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-5 md:px-7 md:py-6">{children}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5', className)}>
      {title ? (
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/55">
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}

function EditOrderButton({ order }: { order: UserOrder }) {
  if (!canEditOrder(order) || !order.productId) return null;
  return (
    <Button
      asChild
      variant="outline"
      className="h-9 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
    >
      <Link to={`/builder/${order.productId}`} state={{ returnToOrderId: order.id }}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit order
      </Link>
    </Button>
  );
}

function PriceValidityNotice({ pricedAt }: { pricedAt?: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden />
      <p className="text-[11px] leading-relaxed text-amber-100/85">
        {priceValidityDisclaimer(pricedAt)}
      </p>
    </div>
  );
}

function PriceOptionCard({
  orderId,
  option,
  selected,
  paid,
}: {
  orderId: string;
  option: OrderPriceOption;
  selected?: boolean;
  paid?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        selected || paid
          ? 'border-[#CC2D24]/40 bg-[#CC2D24]/10'
          : 'border-white/10 bg-black/20 hover:border-white/20',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{option.label}</p>
          <p className="mt-0.5 text-xs text-white/45">{option.description}</p>
          <p className="mt-2 text-lg font-bold tabular-nums text-white">
            {formatEuro(option.priceCents)}
          </p>
        </div>
        {paid ? (
          <Badge className="bg-emerald-500/20 text-emerald-300">Paid</Badge>
        ) : (
          <Button
            asChild
            className="h-9 bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90"
          >
            <Link to={checkoutPath(orderId, option.id)}>
              <CreditCard className="mr-2 h-3.5 w-3.5" />
              Pay
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProductionAwaitingQuote({ order }: { order: UserOrder }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed text-white/70">
          Your order is with our team and manufacturer. We&apos;ll price your sample and bulk tiers
          soon. You can still change your spec until pricing is sent.
        </p>
        <div className="mt-4">
          <EditOrderButton order={order} />
        </div>
      </Panel>
      {order.orderQuantities ? (
        <Panel title="Quantities submitted">
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
    </div>
  );
}

export function ProductionPriced({ order }: { order: UserOrder }) {
  const options = order.priceOptions ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed text-white/70">
          Your quote is ready. Choose sample only or one of the bulk production runs — each option
          has its own payment link.
        </p>
        <div className="mt-3">
          <PriceValidityNotice pricedAt={order.pricedAt} />
        </div>
      </Panel>
      {order.orderQuantities ? (
        <Panel title="Order breakdown">
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
      <Panel title="Pricing options">
        <div className="space-y-3">
          {options.map((opt) => (
            <PriceOptionCard key={opt.id} orderId={order.id} option={opt} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ProductionPaidOrFulfilment({ order }: { order: UserOrder }) {
  const selected = order.selectedPriceOptionId
    ? getPriceOption(order, order.selectedPriceOptionId)
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm text-white/70">
          {order.status === 'completed'
            ? 'This order is complete.'
            : order.status === 'shipping'
              ? 'Your order is on the way.'
              : 'Payment received — your order is in production.'}
        </p>
        {selected ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">You paid for</p>
            <p className="mt-1 text-sm font-semibold text-white">{selected.label}</p>
            <p className="text-xs text-white/45">{selected.description}</p>
            <p className="mt-2 text-sm font-bold tabular-nums text-white">
              {formatEuro(order.paidAmountCents ?? selected.priceCents)}
            </p>
          </div>
        ) : null}
      </Panel>

      {order.tracking ? (
        <Panel title="Tracking">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-400" />
            <span className="font-mono text-sm text-blue-300">{order.tracking}</span>
          </div>
        </Panel>
      ) : null}

      {['processing', 'shipping', 'completed'].includes(order.status) ? (
        <ProductionQcGallery orderId={order.id} />
      ) : null}

      {order.orderQuantities ? (
        <Panel title="Order breakdown">
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
    </div>
  );
}

export function TechPackAwaitingPayment({ order }: { order: UserOrder }) {
  const cents = (order.total ?? 29) * 100;
  const option: OrderPriceOption = {
    id: 'techpack',
    kind: 'sample',
    label: order.exportFormat === 'pdf_bundle' ? 'PDF + bundle' : 'Tech pack PDF',
    description: 'Digital export · instant delivery after payment',
    totalUnits: 0,
    priceCents: cents,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed text-white/70">
          Complete payment to unlock your tech pack download. You can still edit your project before
          you pay.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <EditOrderButton order={order} />
        </div>
      </Panel>
      <Panel title="Payment">
        <PriceValidityNotice pricedAt={order.pricedAt} />
        <div className="mt-3">
          <PriceOptionCard orderId={order.id} option={option} />
        </div>
      </Panel>
      {order.orderQuantities ? (
        <Panel title="Quantities on file">
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
    </div>
  );
}

export function TechPackPaid({ order }: { order: UserOrder }) {
  const revisionAvailable = canUseFreeRevision(order);

  const startRevision = () => {
    updateUserOrder(order.id, { revisionUsed: true });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm text-white/70">
          {order.downloadReady
            ? 'Your tech pack is ready to download.'
            : 'Payment received — we are preparing your files.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {order.downloadReady ? (
            <Button
              type="button"
              className="h-9 bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90"
              onClick={() => {
                /* mock download */
              }}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Download tech pack
            </Button>
          ) : null}
          {revisionAvailable && order.productId ? (
            <Button
              asChild
              variant="outline"
              className="h-9 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
              onClick={startRevision}
            >
              <Link
                to={`/builder/${order.productId}`}
                state={{ freeRevision: true, orderId: order.id }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Use free revision
              </Link>
            </Button>
          ) : null}
        </div>
        {revisionAvailable ? (
          <p className="mt-3 text-[11px] text-white/40">
            Includes 1 free revision — edit your spec and re-export once at no extra charge.
          </p>
        ) : order.revisionUsed ? (
          <p className="mt-3 text-[11px] text-amber-300/80">
            Free revision used. Contact support for further changes.
          </p>
        ) : null}
      </Panel>

      <Panel title="Export details">
        <div className="flex items-center gap-3 text-sm">
          <FileText className="h-4 w-4 text-white/45" />
          <span className="text-white/75">
            {order.exportFormat === 'pdf_bundle' ? 'PDF + asset bundle' : 'PDF tech pack'}
          </span>
          {order.paidAmountCents != null ? (
            <span className="ml-auto font-semibold tabular-nums text-white">
              {formatEuro(order.paidAmountCents)}
            </span>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

export function OrderDetailContent({ order }: { order: UserOrder }) {
  if (order.kind === 'tech-pack') {
    if (order.status === 'awaiting_payment' || order.status === 'submitted') {
      return <TechPackAwaitingPayment order={order} />;
    }
    return <TechPackPaid order={order} />;
  }

  if (order.status === 'submitted') {
    return <ProductionAwaitingQuote order={order} />;
  }
  if (order.status === 'priced') {
    return <ProductionPriced order={order} />;
  }
  return <ProductionPaidOrFulfilment order={order} />;
}
