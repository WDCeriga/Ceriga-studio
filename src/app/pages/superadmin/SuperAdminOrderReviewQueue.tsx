import { formatQuantityLine as cerigaQuantityLine } from '../../i18n/i18n';
import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import './superadmin-quotation-review.css';
import {FreightTotalPreview} from '../../components/freight/FreightTotalPreview';
import {FreightReview} from '../../components/freight/FreightReview';
import { amountToCents } from '../../lib/currency';
import { formatMoney as originalMoney } from '../../lib/currency';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import type { ApprovedTierPrice } from '../../lib/customerQuote';
import { RejectQuotation } from '../../components/superadmin/RejectQuotation';
import { FactoryQuoteComparison } from '../../components/superadmin/FactoryQuoteComparison';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
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
  STATUS_LABELS,
  formatMoney,
  getOrderQuoteTiers,
  resolveMarginForManufacturer,
  withCalculatedQuoteTiers,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { formatOrderQuantitiesSummary } from '../../data/orderQuantities';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(cerigaLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getReviewQueue(all: SuperAdminOrder[], startOrderId?: string | null) {
  const pending = all.filter((o) => o.status === 'pending_review').sort((a, b) =>
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
  onRejected,
}: {
  order: SuperAdminOrder;
  onSubmit: (prices: ApprovedTierPrice[]) => Promise<boolean>;
  onSkip?: () => void;
  onRejected: (action: 'revise' | 'reassign') => void;
}) {
  useCerigaTranslation();

  useCurrency();
  const resolved = resolveMarginForManufacturer(order.manufacturerId, order.manufacturerName);
  const marginPercent = order.cerigaMarginPercent ?? resolved.platformMarginPercent;
  const quoteTiers = useMemo(
    () => withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent),
    [order, marginPercent],
  );

  const saveLock=useRef(false);
  const [saving,setSaving]=useState(false);
  const [shippingReady,setShippingReady]=useState(false);
  const [charges,setCharges]=useState<Record<string,Record<string,string>>>({});
  const [finalByTier, setFinalByTier] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const tier of withCalculatedQuoteTiers(getOrderQuoteTiers(order), marginPercent)) {
      const cents = tier.manufacturingSubtotalCents ?? tier.calculatedPriceCents;
      next[tier.id] = cents != null ? (cents / 100).toFixed(2) : '';
    }
    setFinalByTier(next);
  }, [order.id, marginPercent]);

  const buildPrices=()=>quoteTiers.map(t=>({id:t.id,cents:amountToCents(finalByTier[t.id]||''),...Object.fromEntries(['feesCents','taxCents','dutiesCents','otherCents'].map(k=>[k,amountToCents(charges[t.id]?.[k]||'0')??NaN]))}));
  const handleSubmit = async () => {
    if(saveLock.current)return;
    if(!shippingReady){toast.error(cerigaTranslate("interface.text_f769f65bc1f441f6"));return;}
    const priced: number[] = [];
    for (const tier of quoteTiers) {
      const n = amountToCents(finalByTier[tier.id]??'');
      if (!Number.isSafeInteger(n) || n==null || n <= 0) {
        toast.error(cerigaTranslate("interface.text_4a23a63af392fade",{value0:(tier.label)}));
        return;
      }
      priced.push(n!);
    }
    if (priced.length === 0) {
      toast.error(cerigaTranslate("interface.text_1e0180b459bfbbc8"));
      return;
    }

    saveLock.current=true;setSaving(true);
    try{await onSubmit(buildPrices() as ApprovedTierPrice[]);}catch(e){toast.error(cerigaTranslateLabel(e instanceof Error?e.message:cerigaTranslate("interface.text_76a02656cefafe3d")));}finally{saveLock.current=false;setSaving(false);}
  };

  return (
    <div className="qr-workspace">
      <div className="qr-workspace-heading flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2D24]/15">
            <Calculator className="h-4 w-4 text-[#CC2D24]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_5ebcecaa2ee38772")}</h2>
            <p className="text-[11px] text-white/40">
              {marginPercent}{cerigaTranslate("interface.text_11c0dab952599d11")}{" "}{resolved.planName}{" "}{cerigaTranslate("interface.text_a096c030358a4246")}{" "}{quoteTiers.length} {quoteTiers.length===1?cerigaTranslate("interface.text_a11a75e0feeecc1a"):cerigaTranslate("interface.text_a793ab8fcc2afce5")}
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
        >{cerigaTranslate("interface.text_02b44eb2aa2f4953")}</button>
      </div>

      <div className="qr-workspace-body">
        <div className="qr-review-stages">
          <div className="qr-stage-title"><span>01</span><div><h3>{cerigaTranslate("interface.text_13c74bfde8982be5")}</h3><p>{cerigaTranslate("interface.text_e836406ab60eb518")}</p></div></div>
          {quoteTiers.map((tier) => (
            <div
              key={tier.id}
              className="qr-price-option"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{cerigaTranslateLabel(tier.label)}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {tier.totalUnits > 0 ? cerigaTranslate("interface.text_44b3c2a4a47289c6",{value0:(tier.totalUnits)}) : '—'}
                    {tier.leadTimeDays ? cerigaTranslate("interface.text_8b6d5b4dd6888da2",{value0:(tier.kind === 'sample' ? cerigaTranslate("manufacturerOrders.sample") : cerigaTranslate("interface.text_3140100df131cf30")),value1:(tier.leadTimeDays)}) : ''}
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
                  <p className="text-white/35">{cerigaTranslate("interface.text_c4b97afe643da8e9")}</p>
                  <p className="mt-0.5 font-medium tabular-nums text-white/80">
                    {tier.currency?originalMoney(tier.manufacturerQuoteCents,tier.currency):cerigaTranslate("interface.text_7e1bb820a1eb1b10")}<span className="mt-1 block text-[11px] font-normal text-white/45">{cerigaTranslate("interface.text_ed520f76d5f3ecc1")}{" "}{displayMoney(tier.manufacturerQuoteCents,tier.currency)}</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                  <p className="text-white/35">{cerigaTranslate("adminOrders.calculated")}</p>
                  <p className="mt-0.5 font-medium tabular-nums text-white/80">
                    {tier.calculatedPriceCents != null
                      ? (tier.currency?originalMoney(tier.calculatedPriceCents,tier.currency):cerigaTranslate("interface.text_7e1bb820a1eb1b10"))
                      : '—'}
                    {tier.calculatedPriceCents!=null&&<span className="mt-1 block text-[11px] font-normal text-white/45">{cerigaTranslate("interface.text_ed520f76d5f3ecc1")}{" "}{displayMoney(tier.calculatedPriceCents,tier.currency)}</span>}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <Label htmlFor={`queue-final-${tier.id}`} className="text-[11px] text-white/50">{cerigaTranslate("interface.text_360c3d38385e242c")}{tier.currency ?? cerigaTranslate("interface.text_42e19750d12233c0")})
                </Label>
                <Input
                  id={`queue-final-${tier.id}`}
                  disabled={saving}
                  inputMode="decimal"
                  value={finalByTier[tier.id] ?? ''}
                  onChange={(e) =>
                    setFinalByTier((prev) => ({ ...prev, [tier.id]: e.target.value }))
                  }
                  className="mt-1 h-10 border-white/12 bg-black/40 text-base tabular-nums text-white"
                  placeholder="0.00"
                />
              </div>
              <details className="qr-charge-details"><summary>{cerigaTranslate("interface.text_8a35b97d5ba1fe04")}<span>{cerigaTranslate("interface.text_560511c796ad2e2b")}</span></summary><div className="freight-fields">{Object.entries({feesCents:'Shipping service fee',taxCents:'Taxes',dutiesCents:'Known duties',otherCents:'Other charges'}).map(([k,label])=><label key={k}>{cerigaTranslateLabel(label)} ({tier.currency})<input type="number" disabled={saving} min="0" step="0.01" placeholder="0.00" value={charges[tier.id]?.[k]||''} onChange={e=>setCharges(previous=>({...previous,[tier.id]:{...previous[tier.id],[k]:e.target.value}}))}/></label>)}</div></details>
            </div>
          ))}
          <div className="qr-stage-title"><span>02</span><div><h3>{cerigaTranslate("interface.text_bf4b948644914f05")}</h3><p>{cerigaTranslate("interface.text_54d431a3e84e9069")}</p></div></div>
          <FreightReview key={order.id} orderId={order.id} onReady={setShippingReady}/>
          <div className="qr-stage-title"><span>03</span><div><h3>{cerigaTranslate("interface.text_75c8d0b017fa0aa8")}</h3><p>{cerigaTranslate("interface.text_b6fc0e46e3327ab0")}</p></div></div>
          <FreightTotalPreview orderId={order.id} prices={buildPrices} disabled={!shippingReady} revisionKey={JSON.stringify({finalByTier,charges,shippingReady})}/>
        </div>
      </div>

      <div className="qr-action-bar">
        <RejectQuotation key={order.id} orderId={order.id} onRejected={onRejected} />
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" title={!shippingReady?cerigaTranslate("interface.text_59e1243a97e00d9e"):cerigaTranslate("interface.text_4cb24b1cc16f190b")} disabled={saving||!shippingReady} onClick={()=>void handleSubmit()}>
          <Send className="mr-2 h-4 w-4" />
          {saving?cerigaTranslate("authentication.sending"):cerigaTranslate("interface.text_4b37cd78dbf7dedf")}
        </Button>
        {onSkip ? (
          <Button
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            disabled={saving}
            onClick={onSkip}
          >{cerigaTranslate("interface.text_b58eb52c8810b978")}</Button>
        ) : null}
      </div>
    </div>
  );
}

export function SuperAdminOrderReviewQueue() {
  const [params, setParams] = useSearchParams();
  const data = useSuperadminData();
  return <>
    <FactoryQuoteComparison orders={data.orders} focusedOrder={params.get('order') ?? undefined} onSelect={orderId => {
      setParams(previous => {
        const next = new URLSearchParams(previous);
        next.set('order', orderId);
        return next;
      }, { replace: true });
      void data.refresh();
    }} />
    <PriceReviewQueue data={data} />
  </>;
}

function PriceReviewQueue({ data }: { data: ReturnType<typeof useSuperadminData> }) {
  useCerigaTranslation();

  useCurrency();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { orders, loading, error, refresh, patchOrder } = data;
  const startOrderId = params.get('order') ?? undefined;

  const reviewQueue = useMemo(
    () => getReviewQueue(orders, startOrderId),
    [orders, startOrderId],
  );
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  const remaining = reviewQueue.filter((o) => !completedIds.has(o.id));
  const current = remaining[0] ?? null;
  const doneCount = completedIds.size;
  const totalCount = doneCount+remaining.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 100;



  useEffect(() => {
    if (remaining.length === 0 && doneCount > 0 && !finished) {
      setFinished(true);
    }
  }, [remaining.length, doneCount, finished]);

  const handleSubmit = async (prices: ApprovedTierPrice[]):Promise<boolean> => {
    if (!current) return false;
      const ok = await patchOrder(current.id, {
        approvedPrices: prices,
        status: 'sent_to_brand',
        statusLabel: 'Quote sent to brand',
      });
      if (!ok) {
        toast.error(cerigaTranslate("interface.text_874056ba556615b6"));
        return false;
      }
      setCompletedIds((prev) => new Set([...prev, current.id]));
      toast.success(cerigaTranslate("interface.text_4c17534dfa3f1436"));
      return true;
  };

  const exitReview = () => navigate('/superadmin/assignment');

  if (error && reviewQueue.length === 0 && doneCount === 0) {
    return (
      <div className="quotation-review qr-empty flex flex-col items-center gap-4 py-12 text-center">
        <p role="alert">{cerigaTranslate("interface.text_2f96785bc72c4b0c")}{" "}{cerigaTranslateLabel(error)}</p>
        <Button onClick={() => void refresh()}>{cerigaTranslate("interface.text_942087cc2d41e013")}</Button>
      </div>
    );
  }

  if (reviewQueue.length === 0 && doneCount===0) {
    return (
      <div className="quotation-review qr-empty flex min-h-[50vh] flex-col items-center justify-center text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400/80" />
        <h2 className="mt-4 text-xl font-semibold text-white">
          {loading ? cerigaTranslate("interface.text_2dcda4a64d75775b") : cerigaTranslate("interface.text_1a60b0977a4f386c")}
        </h2>
        {!loading ? (
          <Button className="mt-6 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={exitReview}>{cerigaTranslate("interface.text_0735025fd4ed2d8f")}</Button>
        ) : null}
      </div>
    );
  }

  if (finished) {
    return (
      <div className="quotation-review qr-empty flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-white">{cerigaTranslate("interface.text_73e01b91e2286677")}</h2>
        <p className="mt-2 text-sm text-white/45">{doneCount}{" "}{cerigaTranslate("interface.plural_noun_3eeb7e96e59ce40f",{count:Number(doneCount)})}{" "}{cerigaTranslate("interface.text_b0cfabd9846a106c")}</p>
        <Button className="mt-8 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={exitReview}>{cerigaTranslate("interface.text_0735025fd4ed2d8f")}</Button>
      </div>
    );
  }

  if (!current) return null;

  const queueIndex = doneCount + 1;
  const quantityLines = current.orderQuantities
    ? formatOrderQuantitiesSummary(current.orderQuantities, cerigaQuantityLine).map(cerigaTranslateLabel)
    : [];

  return (
    <div className="quotation-review">
      <div className="qr-topbar flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={exitReview}
          className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
        >
          <X className="h-4 w-4" />{cerigaTranslate("interface.text_7b16a3304635a2e2")}</button>
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_4db0356e9fcaae2c")}</span>
          <span className="text-xs tabular-nums text-white/45">
            {queueIndex}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{totalCount} · {doneCount}{" "}{cerigaTranslate("interface.text_525bc2835adff8b5")}{" "}{remaining.length}{" "}{cerigaTranslate("interface.text_360f84035942243c")}</span>
        </div>
      </div>

      <div className="qr-progress h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#CC2D24] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="qr-layout">
        {/* Left: context */}
        <aside className="qr-context flex min-h-0 flex-col gap-4">
          <div className="qr-order-summary">
            <div className="border-b border-[#252528] bg-gradient-to-br from-[#CC2D24]/14 via-transparent to-transparent px-5 py-5">
              <p className="font-mono text-xs text-[#CC2D24]">{current.id}</p>
              <h2 className="mt-1 text-xl font-semibold leading-snug text-white sm:text-2xl">
                {current.productName}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-[#CC2D24]/40 bg-[#CC2D24]/15 px-2.5 py-0.5 text-[10px] font-medium text-red-200">
                  {cerigaTranslateLabel(STATUS_LABELS[current.status])}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#252528] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/60">
                  {current.kind === 'custom_clothing' ? (
                    <Shirt className="h-3 w-3" />
                  ) : (
                    <Package className="h-3 w-3" />
                  )}
                  {current.kind === 'custom_clothing' ? cerigaTranslate("adminOrders.clothing") : cerigaTranslate("adminOrders.techpack")}
                </span>
              </div>
            </div>

            <div className="qr-order-facts">
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
                    {cerigaTranslateLabel(item.label)}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-white">{item.value}</div>
                  {'sub' in item && item.sub ? (
                    <div className="truncate text-[11px] text-white/40">{item.sub}</div>
                  ) : null}
                </div>
              ))}
            </div>

            {quantityLines.length > 0 ? (
              <div className="border-t border-[#252528] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_92291e8eb6925ffd")}</p>
                <ul className="mt-2 space-y-1 text-[12px] text-white/65">
                  {quantityLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="border-t border-[#252528] px-5 py-3">
              <Link
                to={`/superadmin/orders/${current.id}`}
                className="text-[12px] text-white/45 hover:text-white"
              >{cerigaTranslate("interface.text_bbf5e937ff5f9649")}</Link>
            </div>
          </div>

          {remaining.length > 1 ? (
            <div className="rounded-2xl border border-[#252528] bg-[#111113] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_e31da5b25f8b7324")}</p>
              <ul className="mt-3 space-y-2">
                {remaining.slice(1, 5).map((o, i) => (
                  <li
                    key={o.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-[#252528] bg-black/20 px-3 py-2"
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
        <section className="qr-review-panel">
          <PricingReviewForm
            key={current.id}
            order={current}
            onRejected={action => { setCompletedIds(previous => new Set([...previous, current.id])); toast.success(cerigaTranslateLabel(action==='revise'?'Revised quotation requested from manufacturer':'Quotation rejected — choose another manufacturer')); if(action==='reassign')navigate('/superadmin/assignment'); }}
          onSubmit={handleSubmit}
            onSkip={() => {
              setCompletedIds((prev) => new Set([...prev, current.id]));
              toast.info(cerigaTranslate("interface.text_86a6550248c31860",{value0:(current.id)}));
            }}
          />
        </section>
      </div>
    </div>
  );
}
