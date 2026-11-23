import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import {OrderShipping} from '../freight/OrderShipping';
import { OrderCompletion } from './OrderCompletion';
import { transactionMoney,displayMoney,useCurrency } from '../../lib/accountCurrency';
import { offerExpiresAt, offerExpired } from '../../lib/orderOffer';
import { submitOrderToManufacturer } from '../../lib/manufacturerSubmission';
import {formatMoney as originalMoney} from '../../lib/currency';
import { formatMoney } from '../../lib/currency';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Truck,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { OrderQuantitiesSummary } from '../builder/OrderQuantitiesStep';
import { downloadTechPackPdf } from '../../lib/techPackPdf';
import { resolveTechPackData } from '../../lib/techPackResolve';
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
import { podPlacementSummary } from './podPlacement';
import { cn } from '../ui/utils';

export function OrderDetailShell({
  order,
  children,
}: {
  order: UserOrder;
  children: React.ReactNode;
}) {
  useCerigaTranslation();

  useCurrency();
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#09090B] text-white">
      <div className="border-b border-[#252528] px-4 pb-4 pt-4 sm:px-5 md:px-7">
        <Link
          to="/orders"
          className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />{cerigaTranslate("orders.back")}</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
              {order.kind === 'tech-pack'
                ? cerigaTranslate("adminOrders.techpack")
                : order.quoteRequest
                  ? cerigaTranslate("interface.text_22eb010c3a30619f")
                  : cerigaTranslate("adminOrders.clothing")}
            </p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-white sm:text-[1.65rem]">
              {order.productName}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-white/40">{order.id}</p>
            <p className="mt-1 text-xs text-white/45">{cerigaTranslate("interface.text_cfa70d64a48226d4")}{" "}{order.orderDate} · {order.garmentType}
            </p>
          </div>
          <Badge
            className={cn(
              'shrink-0 text-[10px]',
              ORDER_STATUS_COLORS[order.status] ?? 'bg-white/10 text-white/60',
            )}
          >
            {cerigaTranslateLabel(order.statusLabel)}
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
  useCurrency();
  return (
    <div className={cn('rounded-xl border border-[#252528] bg-white/[0.03] p-4 sm:p-5', className)}>
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
  useCerigaTranslation();

  useCurrency();
  if (!canEditOrder(order) || !order.productId) return null;
  return (
    <Button
      asChild
      variant="outline"
      className="h-9 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
    >
      <Link to={`/builder/${order.productId}`} state={{ returnToOrderId: order.id }}>
        <Pencil className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_6e635526dde79d29")}</Link>
    </Button>
  );
}

function PriceValidityNotice({ pricedAt,expiresAt }: { pricedAt?: string;expiresAt?:string }) {
  useCurrency();
  return (
    <div className="flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden />
      <p className="text-[11px] leading-relaxed text-amber-100/85">
        {priceValidityDisclaimer(pricedAt,expiresAt)}
      </p>
    </div>
  );
}

function PriceOptionCard({
  orderId,
  option,
  selected,
  paid,
  paymentPlaceholder,
  expired,
}: {
  orderId: string;
  option: OrderPriceOption;
  selected?: boolean;
  paid?: boolean;
  paymentPlaceholder?: boolean;
  expired?: boolean;
}) {
  useCerigaTranslation();

  useCurrency();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    try { await submitOrderToManufacturer(orderId, option.id); setSubmitted(true); toast.success(cerigaTranslate("interface.text_b8d36a78ef1cb01d")); }
    catch(cause) { toast.error(cerigaTranslateLabel(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_9b4ed1b5279a5485"))); }
    finally { setSubmitting(false); }
  };
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        selected || paid
          ? 'border-[#CC2D24]/40 bg-[#CC2D24]/10'
          : 'border-[#252528] bg-black/20 hover:border-white/20',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{cerigaTranslateLabel(option.label)}</p>
          <p className="mt-0.5 text-xs text-white/45">{option.description}</p>
          <p className="mt-2 text-lg font-bold tabular-nums text-white">
            {displayMoney(option.priceCents,option.currency)}
          </p>
        </div>
        {paid ? (
          <Badge className="bg-emerald-500/20 text-emerald-300">{cerigaTranslate("adminOrders.paid")}</Badge>
        ) : paymentPlaceholder ? (
          <Button type="button" disabled={expired || submitting || submitted} onClick={() => void submit()} className="h-10 bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90"><Send className="mr-2 h-3.5 w-3.5" />{expired ? cerigaTranslate("interface.text_a207710042eeb089") : submitting ? cerigaTranslate("interface.text_49195f559e4a9f5b") : submitted ? cerigaTranslate("adminOrders.submitted") : cerigaTranslate("interface.text_e6bcdfe53363e709")}</Button>
        ) : (
          <Button
            asChild
            className="h-9 bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90"
          >
            <Link to={checkoutPath(orderId, option.id)}>
              <CreditCard className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_723afa394daeea97")}</Link>
          </Button>
        )}
      </div>
      {option.shipping&&<div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/60"><p>{option.shipping.method}{option.shipping.transitDays ? cerigaTranslate("interface.text_1a3bd4904503e045",{value0:(option.shipping.transitDays)}) : ''} · {option.shipping.provider}</p><p>{cerigaTranslate("interface.text_9fc8134bf2e90ee4")}{" "}{originalMoney(option.shipping.manufacturingCents,option.shipping.currency)}{" "}{cerigaTranslate("interface.text_3694665a3c9849f3")}{" "}{originalMoney(option.shipping.priceCents,option.shipping.currency)}{" "}{cerigaTranslate("interface.text_d4f540c5d72742f4")}{" "}{originalMoney(option.shipping.serviceFeeCents,option.shipping.currency)}{" "}{cerigaTranslate("interface.text_4b94d9152a5a098e")}{" "}{originalMoney(option.shipping.taxCents+option.shipping.dutiesCents,option.shipping.currency)}{" "}{cerigaTranslate("interface.text_330674397afd6bab")}{" "}{originalMoney(option.shipping.otherCents,option.shipping.currency)}</p><p>{option.shipping.tradeTerms}</p><p className="mt-1">{cerigaTranslate("interface.text_3b02c7be3fe04fac")}{" "}{originalMoney(option.priceCents,option.currency!)}.</p></div>}
    </div>
  );
}

export function ProductionAwaitingQuote({ order }: { order: UserOrder }) {
  useCerigaTranslation();

  useCurrency();
  const qr = order.quoteRequest;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed text-white/70">
          {qr
            ? cerigaTranslate("interface.text_a8434ac1d28e830c")
            : cerigaTranslate("interface.text_ef04c6b67a2ad637")}
        </p>
        <div className="mt-4">
          <EditOrderButton order={order} />
        </div>
      </Panel>
      {qr ? (
        <Panel title={cerigaTranslate("interface.text_b8415494efa442ff")}>
          <dl className="space-y-2.5 text-sm">
            {qr.fileNames && qr.fileNames.length > 0 ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_abc7e9892806b047")}</dt>
                <dd className="mt-0.5 text-white/80">{qr.fileNames.join(', ')}</dd>
              </div>
            ) : null}
            {qr.quantity ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("orders.quantity")}</dt>
                <dd className="mt-0.5 text-white/80">{qr.quantity}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</dd>
              </div>
            ) : null}
            {qr.timeline ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_100c4368208b89f2")}</dt>
                <dd className="mt-0.5 text-white/80">{qr.timeline}</dd>
              </div>
            ) : null}
            {qr.notes ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("adminOrders.notes")}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-white/80">{qr.notes}</dd>
              </div>
            ) : null}
            {qr.pod ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_1b808aeb7a0111e3")}</dt>
                <dd className="mt-0.5 text-white/80">
                  {qr.pod.designMode === 'text'
                    ? cerigaTranslate("interface.text_1f44cf5bb37f0dc1",{value0:(qr.pod.text ?? '')})
                    : cerigaTranslate("interface.text_00d1dd84994d0277")}
                  {podPlacementSummary(qr.pod.placement) ? (
                    <span className="text-white/50"> · {podPlacementSummary(qr.pod.placement)}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      ) : null}
      {order.orderQuantities ? (
        <Panel title={cerigaTranslate("interface.text_ff0e1bb45025e334")}>
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
    </div>
  );
}

export function ProductionPriced({ order }: { order: UserOrder }) {
  useCerigaTranslation();

  useCurrency();
  const options = order.priceOptions ?? [];
  const expired=offerExpired(order);
  const expiry=offerExpiresAt(order);
  const isPod = Boolean(order.quoteRequest?.pod);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed text-white/70">
          {isPod
            ? cerigaTranslate("interface.text_e31fde72159ee06a")
            : (options.length ? cerigaTranslate("interface.text_b5317b3df5372afd") : cerigaTranslate("interface.text_1e7671c9c33b8f00"))}
        </p>
        {options.length > 0 && <div className="mt-3">
          <PriceValidityNotice pricedAt={order.pricedAt} expiresAt={order.quoteExpiresAt} />
        </div>}
      </Panel>
      {order.quoteRequest?.pod ? (
        <Panel title={cerigaTranslate("interface.text_1b808aeb7a0111e3")}>
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_baaddf70fb5d432b")}</dt>
              <dd className="mt-0.5 text-white/80">
                {order.quoteRequest.pod.designMode === 'text'
                  ? cerigaTranslate("interface.text_1f44cf5bb37f0dc1",{value0:(order.quoteRequest.pod.text ?? '')})
                  : cerigaTranslate("interface.text_901e08dcd7809c5c")}
              </dd>
            </div>
            {order.specifications?.colorName ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_6b73191a0a4b6742")}</dt>
                <dd className="mt-0.5 text-white/80">{order.specifications.colorName}</dd>
              </div>
            ) : null}
            {order.quoteRequest.fileNames && order.quoteRequest.fileNames.length > 0 ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_50009ce1da4d15e1")}</dt>
                <dd className="mt-0.5 text-white/80">{order.quoteRequest.fileNames.join(', ')}</dd>
              </div>
            ) : null}
            {order.quoteRequest.pod.placement ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_4df9939944a7b324")}</dt>
                <dd className="mt-0.5 text-white/80">{podPlacementSummary(order.quoteRequest.pod.placement)}</dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      ) : null}
      {order.orderQuantities ? (
        <Panel title={cerigaTranslate("interface.text_d3c316ac6d5c5087")}>
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
      {options.length>0 && <Panel><p className={expired?'text-sm text-amber-200':'text-sm text-white/60'}>{expired?cerigaTranslate("interface.text_661c52dc108ea42b"):cerigaTranslate("interface.text_7c1fcb973ff50a11",{value0:(expiry?.toLocaleString('en-GB'))})}</p></Panel>}
      <Panel title={cerigaTranslate("interface.text_d9f2c788a3b116e4")}>
        <div className="space-y-3">
          {!options.length && <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-sm text-white/70">{cerigaTranslate("interface.text_363e8203698acdb3")}</p><p id="quote-payment-pending" className="mt-1 text-xs text-white/45">{cerigaTranslate("interface.text_7330e41c73bc7fc4")}</p></div>
            <Button type="button" disabled aria-describedby="quote-payment-pending" className="h-10 bg-[#CC2D24] text-xs font-semibold disabled:opacity-60"><Send className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_155f816c0407310c")}</Button>
          </div>}
          {options.map((opt) => (
            <PriceOptionCard key={opt.id} orderId={order.id} option={opt} paymentPlaceholder expired={expired} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ProductionPaidOrFulfilment({ order }: { order: UserOrder }) {
  useCerigaTranslation();

  useCurrency();
  const selected = order.selectedPriceOptionId
    ? getPriceOption(order, order.selectedPriceOptionId)
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <OrderShipping orderId={order.id}/>
      <Panel>
        <p className="text-sm text-white/70">
          {order.status === 'completed'
            ? cerigaTranslate("interface.text_454ed0962571de61")
            : order.status === 'shipping'
              ? cerigaTranslate("interface.text_9370db87b200527d")
              : order.manufacturerSubmittedAt ? cerigaTranslate("interface.text_9bd6a78c4b84924e") : cerigaTranslate("interface.text_331d5ee0853c496e")}
        </p>
        {selected ? (
          <div className="mt-4 rounded-lg border border-[#252528] bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">{order.manufacturerSubmittedAt ? cerigaTranslate("interface.text_f4481405f72d8d94") : cerigaTranslate("interface.text_3ee7954e63c134e9")}</p>
            <p className="mt-1 text-sm font-semibold text-white">{cerigaTranslateLabel(selected.label)}</p>
            <p className="text-xs text-white/45">{selected.description}</p>
            <p className="mt-2 text-sm font-bold tabular-nums text-white">
              {transactionMoney(order.paidAmountCents ?? selected.priceCents,order.paidCurrency??selected.currency)}
            </p>
          </div>
        ) : null}
      </Panel>

      <OrderCompletion order={order}/>
      {order.tracking ? (
        <Panel title={cerigaTranslate("adminOrders.tracking")}>
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
        <Panel title={cerigaTranslate("interface.text_d3c316ac6d5c5087")}>
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
    </div>
  );
}

export function TechPackAwaitingPayment({ order }: { order: UserOrder }) {
  useCerigaTranslation();

  useCurrency();
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
        <p className="text-sm leading-relaxed text-white/70">{cerigaTranslate("interface.text_e9b7a86fd4c8edc1")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <EditOrderButton order={order} />
        </div>
      </Panel>
      <Panel title={cerigaTranslate("adminOrders.payment")}>
        <PriceValidityNotice pricedAt={order.pricedAt} />
        <div className="mt-3">
          <PriceOptionCard orderId={order.id} option={option} />
        </div>
      </Panel>
      {order.orderQuantities ? (
        <Panel title={cerigaTranslate("interface.text_13c3044603c0ad4f")}>
          <OrderQuantitiesSummary plan={order.orderQuantities} />
        </Panel>
      ) : null}
    </div>
  );
}

export function TechPackPaid({ order }: { order: UserOrder }) {
  useCerigaTranslation();

  useCurrency();
  const revisionAvailable = canUseFreeRevision(order);
  const [exporting, setExporting] = useState(false);

  const startRevision = () => {
    void updateUserOrder(order.id, { revisionUsed: true });
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const { data } = await resolveTechPackData({
        projectId: order.productId,
        productId: order.productId,
        productName: order.productName,
        specifications: order.specifications,
        orderQuantities: order.orderQuantities,
      });
      await downloadTechPackPdf(data);
      toast.success(cerigaTranslate("interface.text_fd9b10ceead5a657"));
    } catch (err) {
      console.error('Tech pack export failed', err);
      toast.error(cerigaTranslate("interface.text_4e2811a6ee9ccc94"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <p className="text-sm text-white/70">
          {order.downloadReady
            ? cerigaTranslate("interface.text_f0ccda5129af339a")
            : cerigaTranslate("interface.text_6dd7f999aeab601b")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {order.downloadReady ? (
            <Button
              type="button"
              className="h-9 bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90"
              onClick={() => void handleDownload()}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-2 h-3.5 w-3.5" />
              )}
              {exporting ? cerigaTranslate("interface.text_d20a4476a0a85978") : cerigaTranslate("interface.text_b08090da84243f2c")}
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
                <RefreshCw className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_72846c8b079aab13")}</Link>
            </Button>
          ) : null}
        </div>
        {revisionAvailable ? (
          <p className="mt-3 text-[11px] text-white/40">{cerigaTranslate("interface.text_2500953956d5641e")}</p>
        ) : order.revisionUsed ? (
          <p className="mt-3 text-[11px] text-amber-300/80">{cerigaTranslate("interface.text_7579b11c64c6d12d")}</p>
        ) : null}
      </Panel>

      <Panel title={cerigaTranslate("interface.text_9ca0326b9c886506")}>
        <div className="flex items-center gap-3 text-sm">
          <FileText className="h-4 w-4 text-white/45" />
          <span className="text-white/75">
            {order.exportFormat === 'pdf_bundle' ? cerigaTranslate("interface.text_378dcb1df68c653b") : cerigaTranslate("interface.text_7c0e5a8781d64a5f")}
          </span>
          {order.paidAmountCents != null ? (
            <span className="ml-auto font-semibold tabular-nums text-white">
              {transactionMoney(order.paidAmountCents,order.paidCurrency)}
            </span>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

export function OrderDetailContent({ order }: { order: UserOrder }) {
  useCurrency();
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
