import { Money } from '../Money';
import { useManufacturerPricing } from '../../data/manufacturerPricing';
import { onboardingLeadDays, onboardingLeadRange } from '../../data/manufacturerLeadTimes';
import { readSavedOnboardingLeadTimes, useManufacturerLeadTimes } from '../../hooks/useManufacturerLeadTimes';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UserOrder } from '../../data/userOrders';
import { customerQuoteOptions } from '../../data/customerQuoteOptions';
import type { ManufacturerQuoteTierRow } from '../../lib/ordersDb';
import { rejectOrderQuotation, submitManufacturerQuote } from '../../lib/manufacturerQuote';
import { amountToCents,isCurrency,formatMoney, currencySymbol, type Currency } from '../../lib/currency';

type Draft = { id: string; kind: 'sample' | 'bulk'; label: string; quantity: number; unitPrice: string; days: string };
export function ManufacturerQuoteForm({ order, onSubmitted, onRejected }: { order: UserOrder; onSubmitted: (tiers: ManufacturerQuoteTierRow[]) => void; onRejected: (reason: string) => void }) {
  const {currency: preferredCurrency,ready: currencyReady,error: currencyError,saving: currencySaving} = useManufacturerPricing();
  const [draftCurrency,setDraftCurrency] = useState<Currency | null>(() => order.manufacturerQuote?.length ? order.manufacturerQuote[0].currency || null : null);
  const uncertainCurrency=Boolean(order.manufacturerQuote?.length&&!isCurrency(order.manufacturerQuote[0].currency));
  const currency = draftCurrency ?? preferredCurrency;
  const [rows, setRows] = useState<Draft[]>(() => customerQuoteOptions(order).map(option => {
    const previous = order.manufacturerQuote?.find(t => t.id === option.id);
    const unit = previous?.unitPriceCents ?? (previous && previous.totalUnits > 0 ? previous.manufacturerQuoteCents / previous.totalUnits : undefined);
    return { ...option, unitPrice: unit ? (unit / 100).toFixed(2) : '', days: previous?.leadTimeDays ? String(previous.leadTimeDays) : onboardingLeadDays(readSavedOnboardingLeadTimes(), option.kind) };
  }));
  const touchedDays = useRef(new Set<number>());
  const {profile: leadTimes,error: leadTimeError} = useManufacturerLeadTimes();
  useEffect(() => {
    if(!leadTimes) return;
    setRows(previous => previous.map((row,index) => {
      if(touchedDays.current.has(index) || order.manufacturerQuote?.some(tier=>tier.id===row.id && tier.leadTimeDays)) return row;
      return { ...row, days: onboardingLeadDays(leadTimes,row.kind) || row.days };
    }));
  }, [leadTimes, order.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const canQuote = ['submitted', 'awaiting_payment'].includes(order.status) && ['new', 'reviewing', 'clarifying', 'quoted'].includes(order.factoryStatus || 'new');
  const update = (index: number, field: 'unitPrice' | 'days', value: string) => { if(field==='unitPrice') setDraftCurrency(currency); if(field==='days') touchedDays.current.add(index); setSent(false); setRows(previous => previous.map((row, i) => i === index ? { ...row, [field]: value } : row)); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return; setError('');
    if(uncertainCurrency){setError('This historical quotation has no verified currency. Ask Ceriga to request a revised quotation.');return;}
    if(!currencyReady || currencySaving || currencyError){setError('Load and save your account currency in Settings before submitting.');return;}
    if (!rows.length) { setError('Customer quantity is missing. Ask Ceriga to complete it.'); return; }
    const tiers: ManufacturerQuoteTierRow[] = [];
    for (const row of rows) {
      const unitCents = (amountToCents(row.unitPrice)??NaN);
      if (!Number.isInteger(row.quantity) || row.quantity <= 0 || row.quantity > 100000000 || !/^\d+(\.\d{1,2})?$/.test(row.unitPrice) || unitCents <= 0 || unitCents * row.quantity > 100000000000 || !/^[1-9]\d*$/.test(row.days) || Number(row.days) > 3650) { setError(`Enter a valid unit price and lead time for ${row.label}.`); return; }
      tiers.push({ id: row.id, kind: row.kind, label: row.label, totalUnits: row.quantity, unitPriceCents: unitCents, manufacturerQuoteCents: unitCents * row.quantity, currency, leadTimeDays: Number(row.days) });
    }
    setSaving(true);
    try { await submitManufacturerQuote(order.id, tiers); onSubmitted(tiers); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit quotation'); }
    finally { setSaving(false); }
  };
  const decline = async () => {
    if (saving) return;
    if (reason.trim().length < 3) { setError('Please enter a reason for declining.'); return; }
    setSaving(true); setError('');
    try { await rejectOrderQuotation(order.id, reason); onRejected(reason.trim()); setRejecting(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not decline assignment'); }
    finally { setSaving(false); }
  };
  const inputClass = 'mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/25 px-3 text-sm text-white disabled:opacity-60';
  return <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Manufacturer quotation</h2>
    <p className="mt-2 text-sm text-white/50">Enter your price per item in {currency}, including any shipping or other costs. Totals use the customer's saved quantities. Ceriga reviews your quote before issuing customer pricing.</p>
    {order.factoryStatus === 'quoted' && <p className="mt-3 text-sm text-emerald-300">Quotation submitted — awaiting superadmin review.</p>}
    {order.factoryRejectReason && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">{order.factoryStatus === 'rejected' ? 'Declined: ' : 'Ceriga feedback: '}{order.factoryRejectReason}</p>}
    <p className="mt-2 text-xs text-white/40">Lead times start at the upper end of your saved onboarding range. You can adjust them for this order.</p>
    {!currencyReady && <p className="mt-2 text-sm text-white/50">Loading account currency…</p>}
    {uncertainCurrency&&<p role="alert" className="text-sm text-amber-200">Original currency needs review. Ask Ceriga to request a revised quotation.</p>}{currencyError && <p role="alert" className="mt-2 text-sm text-amber-200">{currencyError} Check Account currency in Settings before quoting.</p>}
    {draftCurrency && draftCurrency !== preferredCurrency && <p className="mt-2 text-xs text-white/50">This quotation keeps its original {draftCurrency} currency. Your current account default is {preferredCurrency}.</p>}
    {leadTimeError && <p role="alert" className="mt-2 text-sm text-amber-200">{leadTimeError} Check the lead time before submitting.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {canQuote ? <form onSubmit={submit} className="mt-5 space-y-5">
      {!rows.length && <p className="text-sm text-amber-200">Customer quantity is missing. Ask Ceriga to complete it before quoting.</p>}
      <fieldset disabled={uncertainCurrency || saving || !currencyReady || currencySaving || Boolean(currencyError)} className="space-y-4 disabled:opacity-60">
        <legend className="sr-only">Quotation options</legend>
        {rows.map((row, index) => <div key={row.id} className="rounded-xl border border-white/10 p-4">
          <h3 className="font-medium">{row.label}</h3>
          <p className="mt-1 text-xs text-white/45">Onboarding {row.kind === 'sample' ? 'sample' : 'bulk'} lead time: {onboardingLeadRange(leadTimes,row.kind)}{onboardingLeadRange(leadTimes,row.kind) !== 'Not set' ? ' days' : ''}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="text-xs text-white/60">Customer quantity<p className="mt-2 flex h-11 items-center text-base font-semibold text-white">{row.quantity} units</p></div>
            <label className="text-xs text-white/60">Price per item ({currencySymbol(currency)} {currency})<input aria-label={`${row.label} price per item`} className={inputClass} type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" value={row.unitPrice} onChange={e => update(index, 'unitPrice', e.target.value)} /></label>
            <label className="text-xs text-white/60">{row.kind === 'sample' ? 'Sample lead time (days)' : 'Bulk lead time (days)'}<input aria-label={`${row.label} lead time`} className={inputClass} type="number" min="1" max="3650" step="1" required value={row.days} onChange={e => update(index, 'days', e.target.value)} /></label>
          </div>
          {row.quantity > 0 && Number(row.unitPrice) > 0 && <p className="mt-3 text-sm text-emerald-300" aria-live="polite">{formatMoney(Math.round(Number(row.unitPrice) * 100), currency)} × {row.quantity} = {formatMoney(Math.round(Number(row.unitPrice) * 100) * row.quantity, currency)} total · Indicative: <Money cents={(amountToCents(row.unitPrice)??NaN)*row.quantity} currency={currency}/></p>}
        </div>)}
      </fieldset>
      {sent && <p role="status" className="text-sm text-emerald-300">Saved and sent to the superadmin pricing review queue.</p>}
      <button disabled={uncertainCurrency || saving || sent || !rows.length || !currencyReady || currencySaving || Boolean(currencyError)} type="submit" className="min-h-11 w-full rounded-lg bg-[#CC2D24] px-5 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto">{saving ? 'Submitting…' : order.factoryStatus === 'quoted' ? 'Send revised quotation to superadmin' : 'Send quotation to superadmin'}</button>
    </form> : <p className="mt-4 text-sm text-white/50">This order is no longer accepting quotations.</p>}
    {canQuote && <div className="mt-5 border-t border-white/10 pt-4">
      <button type="button" disabled={saving} onClick={() => setRejecting(value => !value)} className="text-sm text-red-300 underline">Decline quotation request</button>
      {rejecting && <div className="mt-3 space-y-3"><label className="block text-sm text-white/60">Reason for declining<textarea maxLength={2000} disabled={saving} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 block min-h-24 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white" /></label><button type="button" disabled={saving} onClick={() => void decline()} className="rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-300">{saving ? 'Saving…' : 'Confirm decline'}</button></div>}
    </div>}
  </section>;
}
