import {getCurrencyState,sumConvertedMinor} from '../lib/accountCurrency';
import {convertMinor,isCurrency} from '../lib/currency';
import { LEGACY_FACTORY_CURRENCY, type Currency } from '../lib/currency';
import type { FactoryOrder } from './manufacturerPortalMock';

/** Original-currency totals only. Different currencies are never added together. */
export function factoryQuoteFinancials(orders: FactoryOrder[], currency: Currency, days: number, now = new Date()) {
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);
  const byCurrency: Partial<Record<Currency, number>> = {};
  const monthly: Record<string, number> = {};let currencyIncomplete=false;
  for (const order of orders) {
    if (!order.quotedAt || new Date(order.quotedAt) < cutoff) continue;
    const month = new Date(order.quotedAt).toISOString().slice(0, 7);
    for (const tier of order.quoteTiers ?? []) {
      const original = tier.currency;
      if(!isCurrency(original)){currencyIncomplete=true;continue;}
      byCurrency[original] = (byCurrency[original] ?? 0) + tier.factoryCostCents;
      try{monthly[month]=(monthly[month]??0)+convertMinor(tier.factoryCostCents,original,currency,getCurrencyState().rates);}catch{monthly[month]=NaN;}
    }
  }
  const quoteValue = Array.from({ length: days === 30 ? 2 : 4 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (days === 30 ? 1 : 3) + index, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { m: date.toLocaleDateString('en-GB', { month: 'short' }), valueK: (monthly[month] ?? 0) / 100000 };
  });
  return { byCurrency, quoteValue, currencyIncomplete,totalCents: currencyIncomplete?undefined:sumConvertedMinor(Object.entries(byCurrency).map(([currency,cents])=>({cents:cents!,currency:currency as Currency})),currency), currency };
}
