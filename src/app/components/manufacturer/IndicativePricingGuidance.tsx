import { getCurrencyState,setAccountCurrency,displayMoney,useCurrency } from '../../lib/accountCurrency';
import { Coins } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { amountToCents, currencySymbol, formatMoney, SUPPORTED_CURRENCIES, type Currency } from '../../lib/currency';
import type { PricingStructure } from '../../data/manufacturerOnboardingTypes';
import { formatPriceRange, normalizePricing, PRICE_GARMENTS, pricingValidationError, samplePriceRange } from '../../data/manufacturerPricingModel';

export function MoneyInput({ label, cents, currency, onChange }: { label: string; cents?: number; currency: Currency; onChange: (value: number | undefined) => void }) {
  useCurrency();
  return <label className="block text-[11px] text-white/60">{label}
    <span className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2">
      <span aria-hidden="true">{currencySymbol(currency)}</span>
      <Input type="number" min="0" step="0.01" aria-label={`${label} (${currency})`} value={cents === undefined ? '' : cents / 100} onChange={event => onChange(amountToCents(event.target.value))} placeholder={`0.00 ${currency}`} className="h-8 min-w-0 border-0 bg-transparent px-0 text-xs text-white shadow-none" />
    </span>
  </label>;
}

export function CurrencyChoice({ currency, onChange }: { currency: Currency; onChange: (value: Currency) => void }) {
  const account=useCurrency();
  return <div className="flex gap-2" role="group" aria-label="Preferred currency">{SUPPORTED_CURRENCIES.map(value =>
    <button type="button" key={value} disabled={account.saving||!account.ready} aria-pressed={currency === value} onClick={() => {void setAccountCurrency(value).then(()=>onChange(value)).catch(()=>undefined);}} className={cn('flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition', currency === value ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white' : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white')}>
      {value} ({currencySymbol(value)})
    </button>)}</div>;
}

export function IndicativePricingGuidance({ value, onChange }: { value: PricingStructure; onChange: (pricing: PricingStructure) => void }) {
  const account=useCurrency();
  const pricing = normalizePricing({...value,preferredCurrency:account.ready?account.currency:value.preferredCurrency}), currency = pricing.preferredCurrency, book = pricing.priceBooks?.[currency] ?? {};
  const update = (patch: Partial<PricingStructure>) => onChange({ ...pricing, ...patch });
  const error = pricingValidationError(pricing);
  return <section aria-label="Indicative Pricing Guidance" className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Coins className="h-4 w-4 text-[#CC2D24]" />Indicative Pricing Guidance</h3><span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] text-white/40">Optional / Non-binding</span></div>
    <p className="text-xs text-white/40">Provides brands with ballpark estimates. Every order receives a formal quotation based on final tech pack specs.</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <div><p className="mb-2 text-xs text-white/70">Account quoting currency</p><CurrencyChoice currency={currency} onChange={preferredCurrency => update({ preferredCurrency })} /></div>
      <div className="sm:col-span-2"><p className="mb-2 text-xs text-white/70">Sample Pricing Structure</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
        ['flat_fee', 'Flat sample fee'], ['multiplier_2x', '2x bulk unit rate'], ['multiplier_3x', '3x bulk unit rate'], ['custom_quote', 'Custom per sample'],
      ].map(([id, label]) => <button key={id} type="button" aria-pressed={pricing.samplePricingApproach === id} onClick={() => update({ samplePricingApproach: id as PricingStructure['samplePricingApproach'] })} className={cn('rounded-lg border px-2 py-2 text-xs', pricing.samplePricingApproach === id ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white' : 'border-[#252528] text-white/50')}>{label}</button>)}</div></div>
    </div>
    <p className="text-xs text-white/50">This sets the default for new prices. Existing amounts keep their original currency. Display estimates use current exchange rates. Editing a price creates an explicit price in the labelled currency; original saved prices remain intact.</p>
    {pricing.samplePricingApproach === 'flat_fee' && <div className="max-w-xs"><MoneyInput key={currency} label="Flat sample fee" currency={currency} cents={pricing.flatSampleFeeByCurrency?.[currency]} onChange={fee => update({ flatSampleFeeByCurrency: { ...pricing.flatSampleFeeByCurrency, [currency]: fee } })} /></div>}
    {pricing.samplePricingApproach === 'flat_fee' && SUPPORTED_CURRENCIES.filter(other => other !== currency && pricing.flatSampleFeeByCurrency?.[other] !== undefined).map(other => <p key={other} className="text-[11px] text-white/40">Saved flat sample fee: {formatMoney(pricing.flatSampleFeeByCurrency![other]!,other)} (original) · Indicative: {displayMoney(pricing.flatSampleFeeByCurrency![other]!,other)}</p>)}
    {pricing.samplePricingApproach === 'custom_quote' && <p className="text-xs text-white/50">Provide a custom sample quotation in {currency} for each order.</p>}
    <div><h4 className="text-xs font-medium text-white/70">Typical Unit Price Ranges ({currency})</h4>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{PRICE_GARMENTS.map(({ key, label }) => {
        const range = book[key], sample = samplePriceRange(pricing, key);
        const others = SUPPORTED_CURRENCIES.filter(other => other !== currency && pricing.priceBooks?.[other]?.[key]);
        const setBound = (bound: 'minCents' | 'maxCents', amount: number | undefined) => update({ priceBooks: { ...pricing.priceBooks, [currency]: { ...book, [key]: { ...range, currency, [bound]: amount } } } });
        return <fieldset key={key} className="space-y-2"><legend className="text-xs text-white/70">{label}</legend>
          <div key={currency} className="grid grid-cols-2 gap-2"><MoneyInput label={`${label} minimum`} cents={range?.minCents} currency={currency} onChange={amount => setBound('minCents', amount)} /><MoneyInput label={`${label} maximum`} cents={range?.maxCents} currency={currency} onChange={amount => setBound('maxCents', amount)} /></div>
          {sample && <p className="text-[11px] text-white/50">Sample guidance per unit: {sample.minCents===undefined?'Not set':displayMoney(sample.minCents,sample.currency)} – {sample.maxCents===undefined?'Not set':displayMoney(sample.maxCents,sample.currency)}</p>}
          {others.map(other => <p key={other} className="text-[11px] text-white/40">Saved {other}: {formatPriceRange(pricing.priceBooks![other]![key]!)} (original). Indicative: {displayMoney(pricing.priceBooks![other]![key]!.minCents??NaN,other)} – {displayMoney(pricing.priceBooks![other]![key]!.maxCents??NaN,other)}</p>)}
          {pricing.indicativePriceRanges?.[key] && !Object.values(pricing.priceBooks ?? {}).some(otherBook => otherBook?.[key]) && <p className="text-[11px] text-amber-300">Previous price retained: {pricing.indicativePriceRanges[key]}. Enter a structured range when ready.</p>}
        </fieldset>;
      })}</div>
    </div>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </section>;
}
