import {amountToCents,percentMinor,applyStoredRate,type Currency} from '../lib/currency';
import {getCurrencyState,sumConvertedMinor} from '../lib/accountCurrency';
export type PricingCurrency = Currency;

export type TechPackPricing = {
  currency: 'EUR';
  pdfCents: number;
  /** PDF + vector asset bundle — optional upsell */
  bundleCents: number;
};

export type ChatPlanPricing = {
  id: string;
  tier: string;
  monthlyCents: number;
  messageLimit: number;
  published: boolean;
  featured?: boolean;
};

export type ManufacturerPlanMargin = {
  planId: string;
  planName: string;
  platformMarginPercent: number;
};

export type ProductionPricingRules = {
  currency: 'GBP';
  /** One margin per manufacturer plan — applied when that factory quotes an order */
  planMargins: ManufacturerPlanMargin[];
  /** Fallback when manufacturer has no plan assigned */
  defaultPlanId: string;
  /** Shown on quote breakdowns — not auto-applied in mock calculator yet */
  estimatedDutiesPercent: number;
};

export type RevenueSource = 'techpack' | 'custom_clothing' | 'chat_subscription' | 'manual';

export type RevenueLedgerRow = {
  id: string;
  date: string;
  source: RevenueSource;
  orderId?: string;
  customerName: string;
  description: string;
  quantity?: number;
  revenueCents: number;
  manufacturerCostCents: number;
  manufacturerShippingCents: number;
  currency?: PricingCurrency;
};

export type PlatformPricingConfig = {
  techPack: TechPackPricing;
  chatPlans: ChatPlanPricing[];
  production: ProductionPricingRules;
};

type OrderKind = 'techpack' | 'custom_clothing';

type LedgerOrder = {
 currency?:Currency;manufacturerCurrency?:Currency;currencySnapshot?:import('./userOrders').OrderPriceOption['currencySnapshot'];
  id: string;
  kind: OrderKind;
  userName: string;
  productName: string;
  createdAt: string;
  finalPriceCents?: number;
  manufacturerQuoteCents?: number;
  status?: string;
};

const DEFAULT_CONFIG: PlatformPricingConfig = {
  techPack: {
    currency: 'EUR',
    pdfCents: 2900,
    bundleCents: 4900,
  },
  chatPlans: [
    { id: 'free', tier: 'Free', monthlyCents: 0, messageLimit: 20, published: true },
    { id: 'studio', tier: 'Studio', monthlyCents: 1900, messageLimit: 500, published: true },
    { id: 'scale', tier: 'Scale', monthlyCents: 4900, messageLimit: 2000, published: true, featured: true },
    { id: 'business', tier: 'Business', monthlyCents: 9900, messageLimit: 10000, published: true },
  ],
  production: {
    currency: 'GBP',
    planMargins: [
      { planId: 'starter', planName: 'Starter', platformMarginPercent: 22 },
      { planId: 'growth', planName: 'Growth', platformMarginPercent: 17.5 },
      { planId: 'partner', planName: 'Partner', platformMarginPercent: 12 },
    ],
    defaultPlanId: 'growth',
    estimatedDutiesPercent: 0,
  },
};

let pricingConfig: PlatformPricingConfig = structuredClone(DEFAULT_CONFIG);

let manualLedgerRows: RevenueLedgerRow[] = [];

export function getDefaultPricingConfig(): PlatformPricingConfig {
  return normalizePricingConfig(structuredClone(DEFAULT_CONFIG));
}

export function getPricingConfig(): PlatformPricingConfig {
  return normalizePricingConfig(structuredClone(pricingConfig));
}

export function normalizePricingConfig(config: PlatformPricingConfig): PlatformPricingConfig {
  const prod = config.production as ProductionPricingRules & { platformMarginPercent?: number };
  if (!Array.isArray(prod.planMargins) || prod.planMargins.length === 0) {
    const legacyMargin = prod.platformMarginPercent ?? 17.5;
    return {
      ...config,
      production: {
        ...DEFAULT_CONFIG.production,
        estimatedDutiesPercent: prod.estimatedDutiesPercent ?? 0,
        planMargins: DEFAULT_CONFIG.production.planMargins.map((p) =>
          p.planId === 'growth' ? { ...p, platformMarginPercent: legacyMargin } : { ...p },
        ),
      },
    };
  }
  return config;
}

export function upsertPricingConfig(next: PlatformPricingConfig): void {
  pricingConfig = normalizePricingConfig(structuredClone(next));
}

export function resetPricingConfig(): void {
  pricingConfig = structuredClone(DEFAULT_CONFIG);
}

export function getProductionMarginPercent(planId?: string): number {
  return resolveMarginForPlan(planId).platformMarginPercent;
}

export function resolveMarginForPlan(planId?: string): ManufacturerPlanMargin {
  const { planMargins, defaultPlanId } = pricingConfig.production;
  const id = planId ?? defaultPlanId;
  return (
    planMargins.find((p) => p.planId === id) ??
    planMargins.find((p) => p.planId === defaultPlanId) ??
    planMargins[0]
  );
}

export function applyProductionMargin(
  quoteCents: number,
  marginPercent = getProductionMarginPercent(),
): number {
  return quoteCents+percentMinor(quoteCents,Math.round(marginPercent*100));
}

export function formatPricingMoney(cents: number, currency: PricingCurrency): string {
  return new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-GB', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function ledgerProfit(row: RevenueLedgerRow): number {
  return row.revenueCents - row.manufacturerCostCents - row.manufacturerShippingCents;
}

function orderToLedgerRow(order: LedgerOrder): RevenueLedgerRow | null {
  if (order.finalPriceCents == null) return null;

  const isTechPack = order.kind === 'techpack';
  const currency=order.currency;

  return {
    id: `rev-${order.id}`,
    date: order.createdAt,
    source: isTechPack ? 'techpack' : 'custom_clothing',
    orderId: order.id,
    customerName: order.userName,
    description: order.productName,
    quantity: isTechPack ? 1 : undefined,
    revenueCents: order.finalPriceCents,
    manufacturerCostCents: order.manufacturerQuoteCents==null?0:order.manufacturerCurrency===currency?order.manufacturerQuoteCents:order.currencySnapshot?applyStoredRate(order.manufacturerQuoteCents,order.currencySnapshot.rate,order.currencySnapshot.sourceRate,order.currencySnapshot.targetRate):NaN,
    manufacturerShippingCents: 0,
    currency,
  };
}

export function buildRevenueLedger(orders: LedgerOrder[]): RevenueLedgerRow[] {
  const fromOrders = orders.map(orderToLedgerRow).filter((r): r is RevenueLedgerRow => r != null);
  return [...fromOrders, ...manualLedgerRows].sort((a, b) => b.date.localeCompare(a.date));
}

export function addManualLedgerRow(
  row: Omit<RevenueLedgerRow, 'id' | 'source'>,
): RevenueLedgerRow {
  const entry: RevenueLedgerRow = {
    ...row,
    id: `rev-man-${Date.now()}`,
    source: 'manual',
  };
  manualLedgerRows = [entry, ...manualLedgerRows];
  return entry;
}

export function getRevenueSummary(rows:RevenueLedgerRow[]){
 const sum=(selected:RevenueLedgerRow[],kind:'revenue'|'cost'|'profit')=>sumConvertedMinor(selected.map(row=>({currency:row.currency,cents:kind==='revenue'?row.revenueCents:kind==='cost'?row.manufacturerCostCents+row.manufacturerShippingCents:ledgerProfit(row)})));
 return{currency:getCurrencyState().currency,totalRevenueGbp:sum(rows,'revenue'),totalCostGbp:sum(rows,'cost'),totalProfitGbp:sum(rows,'profit'),techPackRevenueEur:sum(rows.filter(r=>r.source==='techpack'),'revenue'),productionRevenueGbp:sum(rows.filter(r=>r.source==='custom_clothing'),'revenue'),productionMarginGbp:sum(rows.filter(r=>r.source==='custom_clothing'),'profit'),rowCount:rows.length};
}

export function techPackListPrice(format: 'pdf' | 'pdf_bundle'): number {
  const { techPack } = pricingConfig;
  return format === 'pdf_bundle' ? techPack.bundleCents : techPack.pdfCents;
}

export function countPendingReviews(orders: { status: string }[]): number {
  return orders.filter((o) => o.status === 'pending_review').length;
}

export const REVENUE_SOURCE_LABELS: Record<RevenueSource, string> = {
  techpack: 'Tech pack export',
  custom_clothing: 'Production order',
  chat_subscription: 'AI chat plan',
  manual: 'Manual entry',
};

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function inputToCents(value: string): number | null {
  const n=amountToCents(value);return n===undefined||!Number.isSafeInteger(n)?null:n;
}

/** Default USD → EUR rate used in the quote calculator (Price US × rate). */


export type CommissionTier = {
  maxQty: number | null;
  rate: number;
  label: string;
};

/** Quantity-based commission tiers (applied to Price EUR). */
export const COMMISSION_TIERS: CommissionTier[] = [
  { maxQty: 9, rate: 0.35, label: '1–9 · 35%' },
  { maxQty: 29, rate: 0.25, label: '10–29 · 25%' },
  { maxQty: 49, rate: 0.2, label: '30–49 · 20%' },
  { maxQty: 99, rate: 0.16, label: '50–99 · 16%' },
  { maxQty: null, rate: 0.1, label: '100+ · 10%' },
];

export function commissionRateForQuantity(quantity: number): number {
  const q = Math.max(0, Math.floor(quantity));
  for (const tier of COMMISSION_TIERS) {
    if (tier.maxQty == null || q <= tier.maxQty) return tier.rate;
  }
  return 0.1;
}

export type QuoteCalculatorResult = {
  priceUsd: number;
  quantity: number;
  usdToEurRate: number;
  priceEur: number;
  commissionRate: number;
  commissionPerItem: number;
  costPerItem: number;
  finalPrice: number;
  totalCommission: number;
};

/**
 * Quote calculator (from ops spreadsheet):
 * - Price EUR = Price US × usdToEurRate
 * - Commission % by quantity tier on Price EUR
 * - Cost per item = Price EUR + commission per item
 * - Final Price = Cost per item × Quantity
 * - Total commission = Commission per item × Quantity
 */
export function calculateQuoteRow(
  priceUsd: number,
  quantity: number,
  usdToEurRate: number,
): QuoteCalculatorResult {
  const usd = Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : 0;
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  if(!Number.isFinite(usdToEurRate)||usdToEurRate<=0)throw new Error('A current exchange rate is required');
  const rate = usdToEurRate;
  const priceEur = usd * rate;
  const commissionRate = commissionRateForQuantity(qty);
  const commissionPerItem = priceEur * commissionRate;
  const costPerItem = priceEur + commissionPerItem;
  const finalPrice = costPerItem * qty;
  const totalCommission = commissionPerItem * qty;

  return {
    priceUsd: usd,
    quantity: qty,
    usdToEurRate: rate,
    priceEur,
    commissionRate,
    commissionPerItem,
    costPerItem,
    finalPrice,
    totalCommission,
  };
}

export function formatEurAmount(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
