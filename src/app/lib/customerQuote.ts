import type { ManufacturerQuoteTierRow } from './ordersDb';
import type { OrderPriceOption } from '../data/userOrders';
import { isCurrency } from './currency';
export type ApprovedTierPrice = { id: string; cents: number };
export function customerPriceOptions(tiers: ManufacturerQuoteTierRow[], approved: ApprovedTierPrice[]): OrderPriceOption[] {
 if(!tiers.length || approved.length!==tiers.length || new Set(approved.map(row=>row.id)).size!==approved.length) throw new Error('Approve a price for every quotation option');
 return tiers.map(tier=>{
  const price=approved.find(row=>row.id===tier.id)?.cents;
  const currency=tier.currency;
  if(!Number.isSafeInteger(price)||price!<=0||price!>100000000000||!isCurrency(currency)||!Number.isInteger(tier.totalUnits)||tier.totalUnits<=0) throw new Error('Each quotation option needs a valid approved price, quantity and currency');
  return {id:tier.id,kind:tier.kind,label:tier.label,description:`${tier.totalUnits} units${tier.leadTimeDays?` · ${tier.leadTimeDays} days lead time`:''}`,totalUnits:tier.totalUnits,priceCents:price!,currency,leadTimeDays:tier.leadTimeDays};
 });
}
