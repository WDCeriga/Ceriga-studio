import {shippingDraft,type ShippingDraft} from '../freight/ShippingFields';
import { useManufacturerPricing } from '../../data/manufacturerPricing';
import { onboardingLeadDays } from '../../data/manufacturerLeadTimes';
import { readSavedOnboardingLeadTimes, useManufacturerLeadTimes } from '../../hooks/useManufacturerLeadTimes';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UserOrder } from '../../data/userOrders';
import { customerQuoteOptions } from '../../data/customerQuoteOptions';
import type { ManufacturerQuoteTierRow } from '../../lib/ordersDb';
import { rejectOrderQuotation, submitManufacturerQuote } from '../../lib/manufacturerQuote';
import { amountToCents,isCurrency,formatMoney, type Currency } from '../../lib/currency';

type Draft = { id: string; kind: 'sample' | 'bulk'; label: string; quantity: number; unitPrice: string; days: string };
export function ManufacturerQuoteForm({ order, onSubmitted, onRejected,onSkip,appearance='dark' }: { appearance?:'light'|'dark';order: UserOrder; onSubmitted: (tiers: ManufacturerQuoteTierRow[]) => void; onRejected: (reason: string) => void; onSkip?: () => void }) {
  const {currency: preferredCurrency,ready: currencyReady,error: currencyError,saving: currencySaving} = useManufacturerPricing();
  const [draftCurrency,setDraftCurrency] = useState<Currency | null>(() => order.manufacturerQuote?.length ? order.manufacturerQuote[0].currency || null : null);
  const uncertainCurrency=Boolean(order.manufacturerQuote?.length&&!isCurrency(order.manufacturerQuote[0].currency));
  const currency = draftCurrency ?? preferredCurrency;
  const [rows, setRows] = useState<Draft[]>(() => customerQuoteOptions(order).map(option => {
    const previous = order.manufacturerQuote?.find(t => t.id === option.id);
    const unit = previous?.unitPriceCents ?? (previous && previous.totalUnits > 0 ? previous.manufacturerQuoteCents / previous.totalUnits : undefined);
    return { ...option, unitPrice: unit ? (unit / 100).toFixed(2) : '', days: previous?.leadTimeDays ? String(previous.leadTimeDays) : onboardingLeadDays(readSavedOnboardingLeadTimes(), option.kind) };
  }));
  const [shipping,setShipping]=useState<Record<string,Partial<ShippingDraft>>>(()=>Object.fromEntries(customerQuoteOptions(order).map(o=>[o.id,(() => { const terms = order.manufacturerQuote?.find(t => t.id === o.id)?.shipping; return terms ? shippingDraft(terms, preferredCurrency) : {}; })()])));
  const touchedDays = useRef(new Set<number>());
  const {profile: leadTimes,error: leadTimeError} = useManufacturerLeadTimes();
  useEffect(() => {
    if(!leadTimes) return;
    setRows(previous => previous.map((row,index) => {
      if(touchedDays.current.has(index) || order.manufacturerQuote?.some(tier=>tier.id===row.id && tier.leadTimeDays)) return row;
      return { ...row, days: onboardingLeadDays(leadTimes,row.kind) || row.days };
    }));
  }, [leadTimes, order.id]);
  const shippingMethods = leadTimes?.shippingMethods ?? [];
  const shippingFor = (id: string) => {
    const draft = shipping[id] ?? {};
    const method = draft.method ?? shippingMethods[0] ?? '';
    return {
      priceCents: draft.currency === preferredCurrency ? draft.priceCents ?? '' : '',
      provider: (draft.provider ?? leadTimes?.shippingProvidersByMethod?.[method] ?? leadTimes?.shippingProvider)
        ?.trim() || 'Not specified',
      method: shippingMethods.includes(method) ? method : '',
      origin: leadTimes?.country?.trim() || draft.origin || '',
      destination: order.delivery?.country?.trim() || draft.destination || '',
    };
  };
  const updateShipping = (id: string, key: 'priceCents' | 'method', value: string) => {
    setSent(false);
    setShipping(previous => ({ ...previous, [id]: {
      ...previous[id],
      ...(key === 'method' ? { provider: undefined } : {}),
      [key]: value,
      ...(key === 'priceCents' ? { currency: preferredCurrency } : {}),
    } }));
  };
  const savingLock=useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const canQuote = ['submitted', 'awaiting_payment'].includes(order.status) && ['new', 'reviewing', 'clarifying', 'quoted'].includes(order.factoryStatus || 'new');
  const update = (index: number, field: 'unitPrice' | 'days', value: string) => { if(field==='unitPrice') setDraftCurrency(currency); if(field==='days') touchedDays.current.add(index); setSent(false); setRows(previous => previous.map((row, i) => i === index ? { ...row, [field]: value } : row)); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (savingLock.current) return; setError('');
    if(uncertainCurrency){setError('This historical quotation has no verified currency. Ask Ceriga to request a revised quotation.');return;}
    if(!currencyReady || currencySaving || currencyError){setError('Load and save your account currency in Settings before submitting.');return;}
    if (!rows.length) { setError('Customer quantity is missing. Ask Ceriga to complete it.'); return; }
    if (rows.some(row => !row.id?.trim()) || new Set(rows.map(row => row.id)).size !== rows.length) {
      setError('Some quantity options could not be identified. Refresh this order. If the issue persists, ask Ceriga to check the order.');
      return;
    }
    const tiers: ManufacturerQuoteTierRow[] = [];
    try {
    for (const row of rows) {
      const unitCents = (amountToCents(row.unitPrice)??NaN);
      if (!Number.isInteger(row.quantity) || row.quantity <= 0 || row.quantity > 100000000 || !/^\d+(\.\d{1,2})?$/.test(row.unitPrice) || unitCents <= 0 || unitCents * row.quantity > 100000000000 || !/^[1-9]\d*$/.test(row.days) || Number(row.days) > 3650) { setError(`Enter a valid unit price and lead time for ${row.label}.`); return; }
      const delivery = shippingFor(row.id);
      const shippingCents = amountToCents(delivery.priceCents);
      if (!delivery.origin.trim() || !delivery.destination.trim()) {
        setError('Shipping needs a factory country and a delivery country. Check your factory profile or ask Ceriga to update the order.');
        return;
      }
      if (shippingCents == null || shippingCents < 0 || shippingCents > 100000000000 ||
          !shippingMethods.includes(delivery.method)) {
        setError(`Complete the shipping price and method for ${row.label}.`);
        return;
      }
      tiers.push({ id: row.id, kind: row.kind, label: row.label, totalUnits: row.quantity, unitPriceCents: unitCents, manufacturerQuoteCents: unitCents * row.quantity, currency, leadTimeDays: Number(row.days),shipping: { ...delivery, priceCents: shippingCents, currency: preferredCurrency } });
    }
    } catch(cause) {setError(cause instanceof Error?cause.message:'Check shipping information.');return;}
    savingLock.current=true;setSaving(true);
    try { await submitManufacturerQuote(order.id, tiers); onSubmitted(tiers); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit quotation'); }
    finally { savingLock.current=false;setSaving(false); }
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
  return <section className={appearance==='light'?"quotation-form quotation-form-light":"rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6"}>
    <h2 className="text-lg font-semibold">Prepare quotation</h2>
    <p className="mt-1 text-sm text-white/50">Ceriga reviews your quote before sharing it with the customer.</p>
    {order.factoryStatus === 'quoted' && <p className="mt-3 text-sm text-emerald-300">Quotation submitted — awaiting Ceriga review.</p>}
    {order.factoryRejectReason && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">{order.factoryStatus === 'rejected' ? 'Declined: ' : 'Ceriga feedback: '}{order.factoryRejectReason}</p>}
    {!currencyReady && <p className="mt-2 text-sm text-white/50">Loading account currency…</p>}
    {uncertainCurrency&&<p role="alert" className="text-sm text-amber-200">Original currency needs review. Ask Ceriga to request a revised quotation.</p>}{currencyError && <p role="alert" className="mt-2 text-sm text-amber-200">{currencyError} Check Account currency in Settings before quoting.</p>}
    {draftCurrency && draftCurrency !== preferredCurrency && <p className="mt-2 text-xs text-white/50">This quotation keeps its original {draftCurrency} currency. Your current account default is {preferredCurrency}.</p>}
    {leadTimeError && <p role="alert" className="mt-2 text-sm text-amber-200">{leadTimeError} Check the lead time before submitting.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {canQuote ? <form onSubmit={submit} className="mt-5 space-y-5">
      {!rows.length && <p className="text-sm text-amber-200">Customer quantity is missing. Ask Ceriga to complete it before quoting.</p>}
      <fieldset disabled={uncertainCurrency || saving || !currencyReady || currencySaving || Boolean(currencyError)} className="space-y-4 disabled:opacity-60">
        <legend className="sr-only">Quotation options</legend>
        {rows.map((row, index) => <div key={row.id} className="quotation-option rounded-xl border border-white/10 p-4">
          <div className="quote-option-heading"><h3 className="font-medium">{row.label}</h3><span>{row.quantity.toLocaleString('en-GB')} {row.quantity === 1 ? 'unit' : 'units'}</span></div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-white/60">Unit price ({currency})<input aria-label={`${row.label} price per item`} className={inputClass} type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" value={row.unitPrice} onChange={e => update(index, 'unitPrice', e.target.value)} /></label>
            <label className="text-xs text-white/60">Production lead time (days)<input aria-label={`${row.label} lead time`} className={inputClass} type="number" min="1" max="3650" step="1" required value={row.days} onChange={e => update(index, 'days', e.target.value)} /></label>
            <label className="text-xs text-white/60">Shipping method
              <select className={inputClass} required disabled={!shippingMethods.length}
                value={shippingFor(row.id).method}
                onChange={event => updateShipping(row.id, 'method', event.target.value)}>
                <option value="" disabled>{shippingMethods.length ? 'Select a shipping method' : 'No shipping methods saved'}</option>
                {shippingMethods.map(method => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">Shipping price ({preferredCurrency})
              <input className={inputClass} required type="number" min={0} step="0.01" placeholder="0.00"
                value={shippingFor(row.id).priceCents}
                onChange={event => updateShipping(row.id, 'priceCents', event.target.value)}/>
            </label>
          </div>
          {!shippingMethods.length && <p className="mt-2 text-xs text-white/60">Add shipping methods in Shipping &amp; Services in your factory profile.</p>}
          {row.quantity > 0 && Number(row.unitPrice) > 0 && <p className="mt-3 text-sm text-emerald-300" aria-live="polite" data-quote-total><span>Manufacturing subtotal</span><strong>{formatMoney(Math.round(Number(row.unitPrice) * 100) * row.quantity, currency)}</strong></p>}
        </div>)}
      </fieldset>
      {sent && <p role="status" className="text-sm text-emerald-300">Quotation saved and sent to Ceriga for review.</p>}
      <div className="manufacturer-quote-actions"><button disabled={uncertainCurrency || saving || sent || !rows.length || !currencyReady || currencySaving || Boolean(currencyError)} type="submit" className="min-h-11 w-full rounded-lg bg-[#CC2D24] px-5 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto">{saving ? 'Submitting…' : order.factoryStatus === 'quoted' ? 'Submit revised quotation' : 'Submit quotation'}</button>{onSkip && <button type="button" className="manufacturer-quote-skip" disabled={saving} onClick={onSkip}>Skip for now</button>}</div>
    </form> : <p className="mt-4 text-sm text-white/50">This order is no longer accepting quotations.</p>}
    {canQuote && <div className="mt-5 border-t border-white/10 pt-4">
      <button type="button" disabled={saving} onClick={() => setRejecting(value => !value)} className="text-sm text-red-300 underline">Decline quotation request</button>
      {rejecting && <div className="mt-3 space-y-3"><label className="block text-sm text-white/60">Reason for declining<textarea maxLength={2000} disabled={saving} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 block min-h-24 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white" /></label><button type="button" disabled={saving} onClick={() => void decline()} className="rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-300">{saving ? 'Saving…' : 'Confirm decline'}</button></div>}
    </div>}
  </section>;
}
