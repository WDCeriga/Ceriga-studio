import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Calculator,
  CheckCircle2,
  MapPin,
  Package,
  Send,
  Shirt,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MOCK_SUPER_ORDERS,
  STATUS_LABELS,
  applyCerigaMargin,
  formatMoney,
  resolveMarginForManufacturer,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

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
  const calculatedCents =
    order.calculatedPriceCents ??
    (order.manufacturerQuoteCents != null
      ? applyCerigaMargin(order.manufacturerQuoteCents, marginPercent)
      : null);

  const initialFinal = order.finalPriceCents ?? calculatedCents;
  const [finalCents, setFinalCents] = useState(
    initialFinal != null ? (initialFinal / 100).toFixed(2) : '',
  );

  useEffect(() => {
    const next =
      order.finalPriceCents ??
      order.calculatedPriceCents ??
      (order.manufacturerQuoteCents != null
        ? applyCerigaMargin(order.manufacturerQuoteCents, marginPercent)
        : null);
    setFinalCents(next != null ? (next / 100).toFixed(2) : '');
  }, [order.id, order.finalPriceCents, order.calculatedPriceCents, order.manufacturerQuoteCents, marginPercent]);

  const editedCents = useMemo(() => {
    const n = Number(finalCents);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  }, [finalCents]);

  const priceChanged =
    calculatedCents != null && editedCents != null && editedCents !== calculatedCents;

  const handleSubmit = () => {
    if (!editedCents) {
      toast.error('Enter a valid final price');
      return;
    }
    onSubmit(editedCents);
  };

  return (
    <div className="space-y-5">
      {order.manufacturerQuoteCents != null ? (
        <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-white/45">Manufacturer quote</span>
            <span className="tabular-nums font-medium text-white">
              {formatMoney(order.manufacturerQuoteCents)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 text-sm">
            <span className="text-white/45">Ceriga margin</span>
            <span className="text-white">
              {marginPercent}% · {resolved.planName} plan
            </span>
          </div>
          {calculatedCents != null ? (
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/10 pt-3">
              <span className="text-sm font-medium text-white">Calculated price</span>
              <span className="text-lg font-semibold tabular-nums text-white">
                {formatMoney(calculatedCents)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="queue-final-price" className="text-white/55">
            Final price to brand (£)
          </Label>
          {calculatedCents != null ? (
            <button
              type="button"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
              onClick={() => setFinalCents((calculatedCents / 100).toFixed(2))}
            >
              Use calculated
            </button>
          ) : null}
        </div>
        <Input
          id="queue-final-price"
          value={finalCents}
          onChange={(e) => setFinalCents(e.target.value)}
          className="h-12 border-white/12 bg-black/40 text-xl tabular-nums text-white"
          placeholder="0.00"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        {priceChanged && editedCents != null ? (
          <p className="text-xs text-amber-200/80">
            Custom price — {formatMoney(editedCents)} (calculated was{' '}
            {formatMoney(calculatedCents!)})
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button className="flex-1 bg-[#CC2D24] hover:bg-[#CC2D24]/90 sm:flex-none" onClick={handleSubmit}>
          <Send className="mr-2 h-4 w-4" />
          Submit & next
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
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
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
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-white">Review complete</h1>
        <Button className="mt-8 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={exitToOrders}>
          Back to orders
        </Button>
      </div>
    );
  }

  if (!current) return null;

  const queueIndex = doneCount + 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={exitToOrders}
          className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
        >
          <X className="h-4 w-4" />
          Exit review
        </button>
        <span className="text-xs tabular-nums text-white/45">
          {queueIndex} of {totalCount}
        </span>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/40">
          <span>Price review queue</span>
          <span>
            {doneCount} done · {remaining.length} left
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#CC2D24] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#CC2D24]/25 bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-[#CC2D24]/14 via-transparent to-transparent px-6 py-5">
          <p className="font-mono text-xs text-[#CC2D24]">{current.id}</p>
          <h1 className="mt-1 text-xl font-semibold text-white">{current.productName}</h1>
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

        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-3">
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
            <div key={item.label} className="bg-[#111113] px-4 py-3">
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

        <div className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2D24]/15">
              <Calculator className="h-4 w-4 text-[#CC2D24]" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">Review pricing</h2>
            </div>
          </div>

          <PricingReviewForm
            key={current.id}
            order={current}
            onSubmit={handleSubmit}
            onSkip={() => {
              setCompletedIds((prev) => new Set([...prev, current.id]));
              toast.info(`Skipped ${current.id} for now`);
            }}
          />
        </div>
      </div>

      <p className="text-center text-xs text-white/30">
        <Link to={`/superadmin/orders/${current.id}`} className="text-white/45 hover:text-white">
          Open full order
        </Link>
      </p>
    </div>
  );
}
