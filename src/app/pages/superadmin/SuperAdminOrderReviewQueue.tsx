import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Calculator,
  CheckCircle2,
  Package,
  Send,
  Shirt,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MOCK_SUPER_ORDERS,
  STATUS_LABELS,
  formatMoney,
  getOrderQuoteTiers,
  resolveMarginForManufacturer,
  withCalculatedQuoteTiers,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import { formatOrderQuantitiesSummary } from '../../data/orderQuantities';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getReviewQueue(startOrderId?: string | null) {
  const pending = MOCK_SUPER_ORDERS.filter((o) => o.status === 'pending_review').sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  if (!startOrderId) return pending;
  const start = pending.find((o) => o.id === startOrderId);
  if (!start) return pending;
  return [start, ...pending.filter((o) => o.id !== startOrderId)];
}

function PricingReviewForm({
  order,
  onSubmit,
  onSkip,
}: {
  order: SuperAdminOrder;
  onSubmit: (priceCents: number) => void;
  onSkip?: () => void;
}) {
  const resolved = resolveMarginForManufacturer(order.manufacturerId, order.manufacturerName);
  const marginPercent = order.cerigaMarginPercent ?? resolved.platformMarginPercent;
  const quoteTiers = useMemo(
    () => withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent),
    [order, marginPercent],
  );

  const [finalByTier, setFinalByTier] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const tier of withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent)) {
      const cents = tier.finalPriceCents ?? tier.calculatedPriceCents;
      next[tier.id] = cents != null ? (cents / 100).toFixed(2) : '';
    }
    setFinalByTier(next);
  }, [order.id, marginPercent, order]);

  const handleSubmit = () => {
    const priced: number[] = [];
    for (const tier of quoteTiers) {
      const n = Number(finalByTier[tier.id]);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error(`Enter a valid final price for ${tier.label}`);
        return;
      }
      priced.push(Math.round(n * 100));
    }
    if (priced.length === 0) {
      toast.error('No quote tiers on this order');
      return;
    }
    const bulkIdx = quoteTiers.findIndex((t) => t.kind === 'bulk');
    const primary = priced[bulkIdx >= 0 ? bulkIdx : 0];
    onSubmit(primary);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2D24]/15">
            <Calculator className="h-4 w-4 text-[#CC2D24]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Review pricing</h2>
            <p className="text-[11px] text-white/40">
              {marginPercent}% Ceriga margin · {resolved.planName} plan · {quoteTiers.length} tiers
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          onClick={() => {
            const next: Record<string, string> = {};
            for (const tier of quoteTiers) {
              next[tier.id] =
                tier.calculatedPriceCents != null
                  ? (tier.calculatedPriceCents / 100).toFixed(2)
                  : '';
            }
            setFinalByTier(next);
          }}
        >
          Use calculated for all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 lg:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {quoteTiers.map((tier) => (
            <div
              key={tier.id}
              className="rounded-xl border border-white/[0.08] bg-black/25 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{tier.label}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {tier.totalUnits > 0 ? `${tier.totalUnits} units` : '—'}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase',
                    tier.kind === 'sample'
                      ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
                  )}
                >
                  {tier.kind}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                  <p className="text-white/35">Factory</p>
                  <p className="mt-0.5 font-medium tabular-nums text-white/80">
                    {formatMoney(tier.manufacturerQuoteCents)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                  <p className="text-white/35">Calculated</p>
                  <p className="mt-0.5 font-medium tabular-nums text-white/80">
                    {tier.calculatedPriceCents != null
                      ? formatMoney(tier.calculatedPriceCents)
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <Label htmlFor={`queue-final-${tier.id}`} className="text-[11px] text-white/50">
                  Final to brand (£)
                </Label>
                <Input
                  id={`queue-final-${tier.id}`}
                  value={finalByTier[tier.id] ?? ''}
                  onChange={(e) =>
                    setFinalByTier((prev) => ({ ...prev, [tier.id]: e.target.value }))
                  }
                  className="mt-1 h-10 border-white/12 bg-black/40 text-base tabular-nums text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-5 py-4 lg:px-6">
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={handleSubmit}>
          <Send className="mr-2 h-4 w-4" />
          Submit all & next
        </Button>
        {onSkip ? (
          <Button
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            onClick={onSkip}
          >
            Skip for now
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SuperAdminOrderReviewQueue() {
  const navigate = useNavigate();
  const location = useLocation();
  const startOrderId = (location.state as { startOrderId?: string } | null)?.startOrderId;

  const reviewQueue = useMemo(() => getReviewQueue(startOrderId), [startOrderId]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  const remaining = reviewQueue.filter((o) => !completedIds.has(o.id));
  const current = remaining[0] ?? null;
  const totalCount = reviewQueue.length;
  const doneCount = completedIds.size;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 100;

  useEffect(() => {
    if (reviewQueue.length === 0 && !finished) {
      setFinished(true);
    }
  }, [reviewQueue.length, finished]);

  useEffect(() => {
    if (remaining.length === 0 && doneCount > 0 && !finished) {
      setFinished(true);
    }
  }, [remaining.length, doneCount, finished]);

  const handleSubmit = (priceCents: number) => {
    if (!current) return;
    setCompletedIds((prev) => new Set([...prev, current.id]));
    toast.success(`${current.id} sent to brand · ${formatMoney(priceCents)}`);
  };

  const exitToOrders = () => navigate('/superadmin/orders');

  if (reviewQueue.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400/80" />
        <h1 className="mt-4 text-xl font-semibold text-white">Nothing to review</h1>
        <Button className="mt-6 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={exitToOrders}>
          Back to orders
        </Button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-white">Review complete</h1>
        <p className="mt-2 text-sm text-white/45">{doneCount} order{doneCount === 1 ? '' : 's'} priced</p>
        <Button className="mt-8 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={exitToOrders}>
          Back to orders
        </Button>
      </div>
    );
  }

  if (!current) return null;

  const queueIndex = doneCount + 1;
  const quantityLines = current.orderQuantities
    ? formatOrderQuantitiesSummary(current.orderQuantities)
    : [];

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={exitToOrders}
          className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
        >
          <X className="h-4 w-4" />
          Exit review
        </button>
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Price review queue
          </span>
          <span className="text-xs tabular-nums text-white/45">
            {queueIndex} of {totalCount} · {doneCount} done · {remaining.length} left
          </span>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#CC2D24] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.35fr)]">
        {/* Left: context */}
        <aside className="flex min-h-0 flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-[#CC2D24]/25 bg-[#111113]">
            <div className="border-b border-white/[0.06] bg-gradient-to-br from-[#CC2D24]/14 via-transparent to-transparent px-5 py-5">
              <p className="font-mono text-xs text-[#CC2D24]">{current.id}</p>
              <h1 className="mt-1 text-xl font-semibold leading-snug text-white sm:text-2xl">
                {current.productName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-[#CC2D24]/40 bg-[#CC2D24]/15 px-2.5 py-0.5 text-[10px] font-medium text-red-200">
                  {STATUS_LABELS[current.status]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/60">
                  {current.kind === 'custom_clothing' ? (
                    <Shirt className="h-3 w-3" />
                  ) : (
                    <Package className="h-3 w-3" />
                  )}
                  {current.kind === 'custom_clothing' ? 'Custom clothing' : 'Tech pack'}
                </span>
              </div>
            </div>

            <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                { label: 'Customer', value: current.userName, sub: current.userEmail },
                {
                  label: 'Manufacturer',
                  value: current.manufacturerName ?? '—',
                },
                {
                  label: 'Delivery',
                  value: `${current.deliveryCity}, ${current.deliveryCountry}`,
                  sub: formatDate(current.createdAt),
                },
              ].map((item) => (
                <div key={item.label} className="bg-[#111113] px-5 py-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {item.label}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-white">{item.value}</div>
                  {'sub' in item && item.sub ? (
                    <div className="truncate text-[11px] text-white/40">{item.sub}</div>
                  ) : null}
                </div>
              ))}
            </div>

            {quantityLines.length > 0 ? (
              <div className="border-t border-white/[0.06] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Brand requested
                </p>
                <ul className="mt-2 space-y-1 text-[12px] text-white/65">
                  {quantityLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="border-t border-white/[0.06] px-5 py-3">
              <Link
                to={`/superadmin/orders/${current.id}`}
                className="text-[12px] text-white/45 hover:text-white"
              >
                Open full order →
              </Link>
            </div>
          </div>

          {remaining.length > 1 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Up next
              </p>
              <ul className="mt-3 space-y-2">
                {remaining.slice(1, 5).map((o, i) => (
                  <li
                    key={o.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-white/85">{o.productName}</p>
                      <p className="font-mono text-[10px] text-white/35">{o.id}</p>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                      #{queueIndex + i + 1}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* Right: pricing workspace */}
        <section className="min-h-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] xl:min-h-0">
          <PricingReviewForm
            key={current.id}
            order={current}
            onSubmit={handleSubmit}
            onSkip={() => {
              setCompletedIds((prev) => new Set([...prev, current.id]));
              toast.info(`Skipped ${current.id} for now`);
            }}
          />
        </section>
      </div>
    </div>
  );
}
