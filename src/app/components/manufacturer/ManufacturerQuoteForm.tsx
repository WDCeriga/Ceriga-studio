import {getSupabase} from '../../lib/supabaseClient';
import {getOrder} from '../../lib/ordersDb';
import {fetchComparisonRequests,submitCheckedFactoryQuote} from '../../lib/manufacturerQuote';
import {Link} from 'react-router';
import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import {shippingDraft,type ShippingDraft} from '../freight/ShippingFields';
import { useManufacturerPricing } from '../../data/manufacturerPricing';
import { onboardingLeadDays } from '../../data/manufacturerLeadTimes';
import { readSavedOnboardingLeadTimes, useManufacturerLeadTimes } from '../../hooks/useManufacturerLeadTimes';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UserOrder } from '../../data/userOrders';
import { customerQuoteOptions } from '../../data/customerQuoteOptions';
import type { ManufacturerQuoteTierRow } from '../../lib/ordersDb';
import { rejectOrderQuotation, respondToComparison, submitManufacturerQuote } from '../../lib/manufacturerQuote';
import { amountToCents,isCurrency,formatMoney, type Currency } from '../../lib/currency';

type Draft = { id: string; kind: 'sample' | 'bulk'; label: string; quantity: number; unitPrice: string; days: string };
export function ManufacturerQuoteForm({ order, onSubmitted, onRejected,onSkip,comparison=false,appearance='dark' }: { comparison?:boolean; appearance?:'light'|'dark';order: UserOrder; onSubmitted: (tiers: ManufacturerQuoteTierRow[]) => void; onRejected: (reason: string) => void; onSkip?: () => void }) {
  useCerigaTranslation();

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
    dirtyDraft.current=true;setSent(false);
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
  const [comments, setComments] = useState('');
  const canQuote = ['submitted', 'awaiting_payment'].includes(order.status) && ['new', 'reviewing', 'clarifying', 'quoted'].includes(order.factoryStatus || 'new');
  const [expected,setExpected]=useState(()=>({at:order.quotedAt??null,status:order.factoryStatus??'new'}));
  const [stale,setStale]=useState(false),[draftFeedback,setDraftFeedback]=useState('');
  const dirtyDraft=useRef(false),draftRevision=useRef(0),draftLock=useRef(false);
  useEffect(()=>{
    const current={at:order.quotedAt??null,status:order.factoryStatus??'new'};
    if(!(sent&&!dirtyDraft.current)&&JSON.stringify(current)!==JSON.stringify(expected))setStale(true);
  },[order.quotedAt,order.factoryStatus]);
  useEffect(()=>{
    let active=true;if(!canQuote)return;
    void getSupabase().rpc('factory_quote_draft',{p_order:order.id}).then(({data,error})=>{
      if(!active)return;if(error){setError(error.message);return;}if(!data)return;
      draftRevision.current=data.revision;
      if(dirtyDraft.current)return;
      const payload=data.payload;
      setRows(current=>current.map(row=>{const saved=payload.rows?.find((item:Draft)=>item.id===row.id);return saved?{...row,unitPrice:String(saved.unitPrice??''),days:String(saved.days??'')}:row;}));
      payload.rows?.forEach((_:Draft,index:number)=>touchedDays.current.add(index));
      setShipping(payload.shipping??{});setDraftCurrency(isCurrency(payload.currency)?payload.currency:null);setComments(payload.comments??'');
      dirtyDraft.current=true;
      if(JSON.stringify(data.base_revision)!==JSON.stringify(expected))setStale(true);
      setDraftFeedback(cerigaTranslate('interface.text_be997844b2a8950f'));
    }).catch(cause=>{if(active)setError(cause.message);});
    return()=>{active=false;};
  },[order.id]);
  const saveDraft=async()=>{
    if(draftLock.current||savingLock.current)return;draftLock.current=true;setSaving(true);setError('');setDraftFeedback('');
    try{
      const {data,error}=await getSupabase().rpc('factory_quote_draft',{p_order:order.id,p_action:'save',p_expected:draftRevision.current,p_base:expected,p_data:{rows,shipping,currency,comments}});
      if(error||!data)throw new Error(error?.message??'The database did not confirm this action.');
      draftRevision.current=data.revision;setDraftFeedback(cerigaTranslate('interface.text_be997844b2a8950f'));
    }catch(cause){setError(cause instanceof Error?cause.message:'The request could not be completed.');}finally{draftLock.current=false;setSaving(false);}
  };
  const adoptLatest=async(keep:boolean)=>{
    if(savingLock.current||draftLock.current)return;draftLock.current=true;setSaving(true);setError('');
    try{
      const latest=comparison?(await fetchComparisonRequests(order.id))[0]:await getOrder(order.id);
      if(!latest)throw new Error('This order is unavailable.');
      const choices=customerQuoteOptions(latest);
      setRows(previous=>choices.map(option=>{
        const saved=keep?previous.find(row=>row.id===option.id):undefined;
        const quote=latest.manufacturerQuote?.find(tier=>tier.id===option.id);
        const unit=quote?.unitPriceCents??(quote&&quote.totalUnits>0?quote.manufacturerQuoteCents/quote.totalUnits:undefined);
        return {...option,unitPrice:saved?.unitPrice??(unit?(unit/100).toFixed(2):''),days:saved?.days??(quote?.leadTimeDays?String(quote.leadTimeDays):'')};
      }));
      if(!keep){setShipping(Object.fromEntries(choices.map(option=>{const terms=latest.manufacturerQuote?.find(tier=>tier.id===option.id)?.shipping;return [option.id,terms?shippingDraft(terms,preferredCurrency):{}];})));setComments('');setDraftCurrency(latest.manufacturerQuote?.[0]?.currency??null);}
      setExpected({at:latest.quotedAt??null,status:latest.factoryStatus??'new'});setStale(false);dirtyDraft.current=keep;
      window.dispatchEvent(new Event('ceriga-orders-updated'));
    }catch(cause){setError(cause instanceof Error?cause.message:'The request could not be completed.');}finally{draftLock.current=false;setSaving(false);}
  };

  const update = (index: number, field: 'unitPrice' | 'days', value: string) => { dirtyDraft.current=true; if(field==='unitPrice') setDraftCurrency(currency); if(field==='days') touchedDays.current.add(index); setSent(false); setRows(previous => previous.map((row, i) => i === index ? { ...row, [field]: value } : row)); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (savingLock.current||draftLock.current) return; setError('');
    if(stale){setError(cerigaTranslate('workflow.draftConflict'));return;}
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
      if (!Number.isInteger(row.quantity) || row.quantity <= 0 || row.quantity > 100000000 || !/^\d+(\.\d{1,2})?$/.test(row.unitPrice) || unitCents <= 0 || unitCents * row.quantity > 100000000000 || !/^[1-9]\d*$/.test(row.days) || Number(row.days) > 3650) { setError(cerigaTranslate("interface.text_a28bee751075c4de",{value0:(row.label)})); return; }
      const delivery = shippingFor(row.id);
      const shippingCents = amountToCents(delivery.priceCents);
      if (!delivery.origin.trim() || !delivery.destination.trim()) {
        setError('Shipping needs a factory country and a delivery country. Check your factory profile or ask Ceriga to update the order.');
        return;
      }
      if (shippingCents == null || shippingCents < 0 || shippingCents > 100000000000 ||
          !shippingMethods.includes(delivery.method)) {
        setError(cerigaTranslate("interface.text_ab60a8ebd40bd7f6",{value0:(row.label)}));
        return;
      }
      tiers.push({ id: row.id, kind: row.kind, label: row.label, totalUnits: row.quantity, unitPriceCents: unitCents, manufacturerQuoteCents: unitCents * row.quantity, currency, leadTimeDays: Number(row.days),shipping: { ...delivery, priceCents: shippingCents, currency: preferredCurrency } });
    }
    } catch(cause) {setError(cause instanceof Error?cause.message:cerigaTranslate("interface.text_5bf2b1168483d542"));return;}
    savingLock.current=true;setSaving(true);
    try {
      await submitCheckedFactoryQuote(order.id,tiers,expected,comparison,comments);
      dirtyDraft.current=false;draftRevision.current=0;
      onSubmitted(tiers); setSent(true);
      void (comparison?fetchComparisonRequests(order.id).then(rows=>rows[0]):getOrder(order.id)).then(persisted=>{
        if(persisted)setExpected({at:persisted.quotedAt??null,status:persisted.factoryStatus??'new'});
      }).catch(cause=>setError(cause.message));
    }
    catch (cause) { if((cause as {code?:string})?.code==='40001')setStale(true);setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_18a15066df1cb84e")); }
    finally { savingLock.current=false;setSaving(false); }
  };
  const decline = async () => {
    if (saving) return;
    if (reason.trim().length < 3) { setError('Please enter a reason for declining.'); return; }
    setSaving(true); setError('');
    try {
      if (comparison) await respondToComparison(order.id, [], reason, true);
      else await rejectOrderQuotation(order.id, reason);
      onRejected(reason.trim()); setRejecting(false);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_30582c5333579ad3")); }
    finally { setSaving(false); }
  };
  const inputClass = 'mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/25 px-3 text-sm text-white disabled:opacity-60';
  return <section className={appearance==='light'?"quotation-form quotation-form-light":"rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6"}>
    <h2 className="text-lg font-semibold">{cerigaTranslate("interface.text_b7b12c58fb12a850")}</h2>
    <p className="mt-1 text-sm text-white/50">{cerigaTranslate("interface.text_047c3de6267b4b15")}</p>
    {order.factoryStatus === 'quoted' && <p className="mt-3 text-sm text-emerald-300">{cerigaTranslate("interface.text_79136d44de58d9c4")}</p>}
    {order.factoryRejectReason && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">{order.factoryStatus === 'rejected' ? cerigaTranslate("interface.text_85be99c92549ca81") : cerigaTranslate("interface.text_fc69d297834dcb5d")}{order.factoryRejectReason}</p>}
    {!currencyReady && <p className="mt-2 text-sm text-white/50">{cerigaTranslate("interface.text_9906cadbcb677ce9")}</p>}
    {uncertainCurrency&&<p role="alert" className="text-sm text-amber-200">{cerigaTranslate("interface.text_524d55c2700d0b86")}</p>}{currencyError && <p role="alert" className="mt-2 text-sm text-amber-200">{cerigaTranslateLabel(currencyError)}{" "}{cerigaTranslate("interface.text_266f84c1729fddf3")}</p>}
    {draftCurrency && draftCurrency !== preferredCurrency && <p className="mt-2 text-xs text-white/50">{cerigaTranslate("interface.text_529ef2940dc6bf0d")}{" "}{draftCurrency}{" "}{cerigaTranslate("interface.text_413879a1bc7eea60")}{" "}{preferredCurrency}.</p>}
    {leadTimeError && <p role="alert" className="mt-2 text-sm text-amber-200">{cerigaTranslateLabel(leadTimeError)}{" "}{cerigaTranslate("interface.text_81ae99e01e7f44ee")}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{cerigaTranslateLabel(error)}</p>}
    {stale&&<div role="alert" className="quote-stale-warning"><p>{cerigaTranslate('workflow.draftConflict')}</p><button type="button" disabled={saving} onClick={()=>void adoptLatest(true)}>{cerigaTranslate('workflow.keepDraft')}</button><button type="button" disabled={saving} onClick={()=>void adoptLatest(false)}>{cerigaTranslate('workflow.loadLatest')}</button></div>}
    {draftFeedback&&<p role="status">{draftFeedback}</p>}
    {canQuote&&<button type="button" className="quote-save-draft" disabled={saving||stale} onClick={()=>void saveDraft()}>{cerigaTranslate('adminOrders.saveDraft')}</button>}
    <Link className="quote-settings-link" to="/manufacturer/settings/logistics#shipping-defaults">{cerigaTranslate("workflow.shippingDefaults")}</Link>
    {canQuote ? <form onSubmit={submit} className="mt-5 space-y-5">
      {!rows.length && <p className="text-sm text-amber-200">{cerigaTranslate("interface.text_8da1af6b3efeae82")}</p>}
      <fieldset disabled={uncertainCurrency || saving || !currencyReady || currencySaving || Boolean(currencyError)} className="space-y-4 disabled:opacity-60">
        <legend className="sr-only">{cerigaTranslate("interface.text_4dc56cfada8c465f")}</legend>
        {rows.map((row, index) => <div key={row.id} className="quotation-option rounded-xl border border-white/10 p-4">
          <div className="quote-option-heading"><h3 className="font-medium">{cerigaTranslateLabel(row.label)}</h3><span>{row.quantity.toLocaleString(cerigaLocale())} {row.quantity === 1 ? cerigaTranslate("interface.text_385cfdbc00ec3203") : cerigaTranslate("interface.text_c981a30c0e7b420b")}</span></div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-white/60">{cerigaTranslate("interface.text_244a76f1b0ed1c8d")}{currency})<input aria-label={cerigaTranslate("interface.text_776fea8cfc31730e",{value0:(row.label)})} className={inputClass} type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" value={row.unitPrice} onChange={e => update(index, 'unitPrice', e.target.value)} /></label>
            <label className="text-xs text-white/60">{cerigaTranslate("interface.text_64bddb6b0473cc8f")}<input aria-label={cerigaTranslate("interface.text_ef39ef6bd0db8ccd",{value0:(row.label)})} className={inputClass} type="number" min="1" max="3650" step="1" required value={row.days} onChange={e => update(index, 'days', e.target.value)} /></label>
            <label className="text-xs text-white/60">{cerigaTranslate("interface.text_8c989c6a4ae3c29c")}<select className={inputClass} required disabled={!shippingMethods.length}
                value={shippingFor(row.id).method}
                onChange={event => updateShipping(row.id, 'method', event.target.value)}>
                <option value="" disabled>{shippingMethods.length ? cerigaTranslate("interface.text_8220df363aac17a5") : cerigaTranslate("interface.text_f6693860c2575404")}</option>
                {shippingMethods.map(method => <option key={method} value={method}>{cerigaTranslateLabel(method)}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">{cerigaTranslate("interface.text_9ccd9b5d244fef7a")}{preferredCurrency})
              <input className={inputClass} required type="number" min={0} step="0.01" placeholder="0.00"
                value={shippingFor(row.id).priceCents}
                onChange={event => updateShipping(row.id, 'priceCents', event.target.value)}/>
            </label>
          </div>
          {!shippingMethods.length && <p className="mt-2 text-xs text-white/60">{cerigaTranslate("interface.text_b2f94701fd0e2dd5")}</p>}
          {row.quantity > 0 && Number(row.unitPrice) > 0 && <p className="mt-3 text-sm text-emerald-300" aria-live="polite" data-quote-total><span>{cerigaTranslate("interface.text_d8ecb2b23b14cfb3")}</span><strong>{formatMoney(Math.round(Number(row.unitPrice) * 100) * row.quantity, currency)}</strong></p>}
        </div>)}
      </fieldset>
      {sent && <p role="status" className="text-sm text-emerald-300">{cerigaTranslate("interface.text_99e7361e2b15393f")}</p>}
      <div className="manufacturer-quote-actions"><button disabled={uncertainCurrency || saving || sent || !rows.length || !currencyReady || currencySaving || Boolean(currencyError)} type="submit" className="min-h-11 w-full rounded-lg bg-[#CC2D24] px-5 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto">{saving ? cerigaTranslate("interface.text_49195f559e4a9f5b") : order.factoryStatus === 'quoted' ? cerigaTranslate("interface.text_e47f6ca9f749d1d1") : cerigaTranslate("interface.text_b16cd70eb7474a11")}</button>{onSkip && <button type="button" className="manufacturer-quote-skip" disabled={saving} onClick={onSkip}>{cerigaTranslate("interface.text_b58eb52c8810b978")}</button>}</div>
      {comparison && <label className="block text-sm">{cerigaTranslate("interface.text_0fb1d035059704fc")}<textarea className="mt-2 w-full rounded border p-2" maxLength={2000} value={comments}
          onChange={event => {dirtyDraft.current=true;setComments(event.target.value);setSent(false);}} />
      </label>}
    </form> : <p className="mt-4 text-sm text-white/50">{cerigaTranslate("interface.text_24b225a56af2e767")}</p>}
    {canQuote && <div className="mt-5 border-t border-white/10 pt-4">
      <button type="button" disabled={saving} onClick={() => setRejecting(value => !value)} className="text-sm text-red-300 underline">{cerigaTranslate("interface.text_9b38a0276be7f213")}</button>
      {rejecting && <div className="mt-3 space-y-3"><label className="block text-sm text-white/60">{cerigaTranslate("interface.text_5f3b146045d55148")}<textarea maxLength={2000} disabled={saving} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 block min-h-24 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white" /></label><button type="button" disabled={saving} onClick={() => void decline()} className="rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-300">{saving ? cerigaTranslate("common.saving") : cerigaTranslate("interface.text_73220c091fc01ae8")}</button></div>}
    </div>}
  </section>;
}
