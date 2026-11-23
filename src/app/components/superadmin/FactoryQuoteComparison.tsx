import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { invalidateSuperadminReads } from '../../lib/superadminDb';
import { formatMoney, isCurrency } from '../../lib/currency';
import type { ManufacturerQuoteTierRow } from '../../lib/ordersDb';
import type { SuperAdminOrder } from '../../data/superadminMock';
import { Button } from '../ui/button';

type FactoryQuote = {
  orderId: string;
  factoryId: string;
  factory: string;
  status: string;
  dueOn: string;
  validUntil?: string;
  comments: string;
  workload: number;
  eligibility: { eligible: boolean; failures: string[]; warnings: string[] };
  tiers: ManufacturerQuoteTierRow[];
};

const statuses: Record<string, string> = {
  pending: 'Pending', submitted: 'Submitted', declined: 'Declined',
  expired: 'Expired', selected: 'Preferred', not_selected: 'Not selected',
};

function combined(tier: ManufacturerQuoteTierRow) {
  return tier.shipping && tier.shipping.currency === tier.currency && Number.isFinite(tier.shipping.priceCents)
    ? tier.manufacturerQuoteCents + tier.shipping.priceCents : null;
}

function money(cents: number | undefined, currency: unknown) {
  return cents != null && isCurrency(currency) ? formatMoney(cents, currency) : 'Missing';
}

export function FactoryQuoteComparison({ orders, focusedOrder, onSelect,canSelect=true }: {
  orders: SuperAdminOrder[]; focusedOrder?: string; canSelect?:boolean;onSelect: (orderId: string) => void;
}) {
  useCerigaTranslation();

  const [rows, setRows] = useState<FactoryQuote[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<FactoryQuote | null>(null);
  const [reason, setReason] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().rpc(focusedOrder?'review_factory_comparisons':'admin_factory_comparisons',focusedOrder?{p_order:focusedOrder}:{});
        if (error) throw new Error(error.message);
        if (active) {setRows(data ?? []);setError('');}
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_01f57db1941ad3bd"));
      }
    })();
    return () => { active = false; };
  }, [revision, focusedOrder, orders.map(order=>order.id).join(':')]);

  const select = async () => {
    if (!canSelect || !confirm || !reviewed || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error } = await getSupabase().rpc('admin_select_factory_quote', {
        p_order: confirm.orderId, p_factory: confirm.factoryId, p_reason: reason.trim() || null,
      });
      if (error || data !== confirm.orderId) throw new Error(error?.message ?? 'Selection was not saved.');
      invalidateSuperadminReads();
      onSelect(confirm.orderId);
      setConfirm(null);
      setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_18e0b319ac1411c6"));
    } finally {setBusy(false);}
  };

  const orderIds = [...new Set(rows.map(row => row.orderId))];
  if (focusedOrder && orderIds.includes(focusedOrder)) {
    orderIds.splice(orderIds.indexOf(focusedOrder), 1);
    orderIds.unshift(focusedOrder);
  }
  if (!orderIds.length && !error) return null;
  const hasFocusedComparison = Boolean(focusedOrder && orderIds.includes(focusedOrder));
  return <details open={hasFocusedComparison || Boolean(error) || undefined} className="quotation-review mb-6 rounded-md border border-[#e2e2e2] bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold">{cerigaTranslate("interface.text_834667f3072b863e")}{" "}{orderIds.length > 0 && <span className="ml-1 font-normal text-neutral-600">({orderIds.length})</span>}
    </summary>
    <div className="mt-3 space-y-3">
    <button type="button" className="text-sm text-neutral-700 underline underline-offset-2" onClick={() => setRevision(value => value + 1)}>{cerigaTranslate("interface.text_f80e32b61e32f9fa")}</button>
    {error && <p role="alert">{cerigaTranslateLabel(error)}</p>}
    {orderIds.map(orderId => {
      const quotes = rows.filter(row => row.orderId === orderId);
      return <details key={orderId} open={orderId === focusedOrder || orderIds.length === 1 || undefined} className="rounded-md border p-3">
        <summary className="cursor-pointer font-semibold">{orders.find(order => order.id === orderId)?.productName ?? orderId}
          {' · '}{quotes.map(quote => statuses[quote.status] ?? quote.status).join(' / ')}</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {quotes.map(quote => <article key={quote.factoryId} className="space-y-3 rounded border p-3">
            <h3 className="font-semibold">{quote.factory} · {statuses[quote.status]}</h3>
            <p>{quote.eligibility.eligible ? cerigaTranslate("interface.text_2293fb444314610a") : quote.eligibility.failures.join(' · ')} · {quote.workload}{" "}{cerigaTranslate("interface.text_0285970979d4cc5b")}</p>
            {!!quote.eligibility.warnings.length && <p>{quote.eligibility.warnings.join(' · ')}</p>}
            <p>{cerigaTranslate("manufacturerOrders.due")}{" "}{quote.dueOn}{quote.validUntil && cerigaTranslate("interface.text_734e5f9725e24162",{value0:(new Date(quote.validUntil).toLocaleDateString(cerigaLocale()))})}</p>
            {quote.tiers.map(tier => {
              const other = quotes.find(candidate => candidate.factoryId !== quote.factoryId &&
                ['submitted','selected'].includes(candidate.status))?.tiers.find(item => item.id === tier.id);
              const total = combined(tier);
              const otherTotal = other ? combined(other) : null;
              const sameCurrency = Boolean(other && isCurrency(tier.currency) && tier.currency === other.currency);
              return <div key={tier.id} className="space-y-1 border-t pt-2 text-sm">
                <h4 className="font-semibold">{cerigaTranslateLabel(tier.label)} · {tier.totalUnits}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</h4>
                <p>{cerigaTranslate("interface.text_e5018fc9450544ff")}{" "}{money(tier.unitPriceCents, tier.currency)}{" "}{cerigaTranslate("interface.text_694d8d32e7a7290c")}{" "}{money(tier.manufacturerQuoteCents, tier.currency)}</p>
                <p>{cerigaTranslate("nav.shipping")}{" "}{money(tier.shipping?.priceCents, tier.shipping?.currency)}</p>
                <p>{cerigaTranslate("interface.text_8036ed3754e114f2")}{" "}{total == null ? cerigaTranslate("interface.text_861e3cde7a7bde2a") : money(total, tier.currency)}
                  {sameCurrency && total != null && otherTotal != null && total < otherTotal && <strong>{" "}{cerigaTranslate("interface.text_38a90be57e5933e3")}</strong>}</p>
                {other && !sameCurrency && <p>{cerigaTranslate("interface.text_bcfdc66f97a172af")}</p>}
                <p>{cerigaTranslate("nav.production")}{" "}{tier.leadTimeDays ? cerigaTranslate("interface.text_707dcea8eeedebe3",{value0:(tier.leadTimeDays)}) : cerigaTranslate("interface.text_405e947ad2a1245d")}
                  {tier.leadTimeDays && other?.leadTimeDays && tier.leadTimeDays < other.leadTimeDays ? <strong>{" "}{cerigaTranslate("interface.text_6c85379ea088fd77")}</strong> : null}</p>
              </div>;
            })}
            {!quote.tiers.length && <p>{cerigaTranslate("interface.text_fbc2262b8a83f576")}</p>}
            {quote.comments && <p className="whitespace-pre-wrap">{cerigaTranslate("interface.text_0612db205def75f3")}{" "}{quote.comments}</p>}
            {canSelect && quote.status === 'submitted' && quote.eligibility.eligible && <Button type="button" onClick={() => {
              setConfirm(quote);setReason('');setReviewed(false);
            }}>{cerigaTranslate("interface.text_f7cb3f64d7cf6713")}</Button>}
            {confirm?.orderId === orderId && confirm.factoryId === quote.factoryId && <div className="space-y-2 border-t pt-3">
              <label className="block text-sm">{cerigaTranslate("interface.text_c9f1c7eff4186033")}<textarea className="block w-full rounded border p-2" maxLength={500} value={reason}
                  onChange={event => setReason(event.target.value)} />
              </label>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed}
                onChange={event => setReviewed(event.target.checked)} />{cerigaTranslate("interface.text_d2682767c4c2afd4")}</label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!reviewed || busy} onClick={() => void select()}>{cerigaTranslate("common.confirm")}{" "}{quote.factory}</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm(null)}>{cerigaTranslate("common.cancel")}</Button>
              </div>
            </div>}
          </article>)}
        </div>
      </details>;
    })}
    </div>
  </details>;
}
