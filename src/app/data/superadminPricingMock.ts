export type PricingCurrency = 'EUR' | 'GBP';

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
  currency: PricingCurrency;
};

export type PlatformPricingConfig = {
  techPack: TechPackPricing;
  chatPlans: ChatPlanPricing[];
  production: ProductionPricingRules;
};

type OrderKind = 'techpack' | 'custom_clothing';

type LedgerOrder = {
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

let manualLedgerRows: RevenueLedgerRow[] = [
  {
    id: 'rev-man-1',
    date: '2026-03-28',
    source: 'manual',
    customerName: 'Northshore Retail Group',
    description: 'White-label onboarding workshop (offline)',
    quantity: 1,
    revenueCents: 250000,
    manufacturerCostCents: 0,
    manufacturerShippingCents: 0,
    currency: 'GBP',
  },
  {
    id: 'rev-chat-1',
    date: '2026-04-01',
    source: 'chat_subscription',
    customerName: 'Threadline Apparel',
    description: 'Scale plan — April 2026',
    revenueCents: 4900,
    manufacturerCostCents: 0,
    manufacturerShippingCents: 0,
    currency: 'EUR',
  },
];

export function getPricingConfig(): PlatformPricingConfig {
  return normalizePricingConfig(structuredClone(pricingConfig));
}

function normalizePricingConfig(config: PlatformPricingConfig): PlatformPricingConfig {
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
  return Math.round(quoteCents * (1 + marginPercent / 100));
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
  const currency: PricingCurrency = isTechPack ? 'EUR' : 'GBP';

  return {
    id: `rev-${order.id}`,
    date: order.createdAt,
    source: isTechPack ? 'techpack' : 'custom_clothing',
    orderId: order.id,
    customerName: order.userName,
    description: order.productName,
    quantity: isTechPack ? 1 : undefined,
    revenueCents: order.finalPriceCents,
    manufacturerCostCents: order.manufacturerQuoteCents ?? 0,
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

export function getRevenueSummary(rows: RevenueLedgerRow[]) {
  let totalRevenueGbp = 0;
  let totalCostGbp = 0;
  let techPackRevenueEur = 0;
  let productionRevenueGbp = 0;
  let productionMarginGbp = 0;

  for (const row of rows) {
    const profit = ledgerProfit(row);
    if (row.currency === 'EUR') {
      if (row.source === 'techpack') techPackRevenueEur += row.revenueCents;
    } else {
      totalRevenueGbp += row.revenueCents;
      totalCostGbp += row.manufacturerCostCents + row.manufacturerShippingCents;
      if (row.source === 'custom_clothing') {
        productionRevenueGbp += row.revenueCents;
        productionMarginGbp += profit;
      }
    }
  }

  return {
    totalRevenueGbp,
    totalCostGbp,
    totalProfitGbp: totalRevenueGbp - totalCostGbp,
    techPackRevenueEur,
    productionRevenueGbp,
    productionMarginGbp,
    rowCount: rows.length,
  };
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
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
