import { useCallback, useEffect, useState } from 'react';
import {
  distributeQuantity,
  sumBreakdown,
  type OrderQuantityPlan,
} from './orderQuantities';

export type UserOrderKind = 'tech-pack' | 'production';

export type UserOrderStatus =
  | 'submitted'
  | 'awaiting_payment'
  | 'priced'
  | 'paid'
  | 'processing'
  | 'shipping'
  | 'completed'
  | 'ready';

export type OrderPriceOption = {
  id: string;
  kind: 'sample' | 'bulk';
  label: string;
  description: string;
  totalUnits: number;
  priceCents: number;
};

export type UserOrder = {
  id: string;
  kind: UserOrderKind;
  productName: string;
  garmentType: string;
  productId?: string;
  status: UserOrderStatus;
  statusLabel: string;
  orderDate: string;
  total: number | null;
  tracking?: string | null;
  orderQuantities?: OrderQuantityPlan;
  priceOptions?: OrderPriceOption[];
  selectedPriceOptionId?: string;
  paidAmountCents?: number;
  exportFormat?: 'pdf' | 'pdf_bundle';
  revisionUsed?: boolean;
  downloadReady?: boolean;
  /** ISO date when quote/pricing was issued — prices valid for PRICE_VALIDITY_WEEKS */
  pricedAt?: string;
  specifications?: {
    fit?: string;
    color?: string;
    colorName?: string;
    neckType?: string;
    sleeveType?: string;
    sleeveLength?: string;
    fabricType?: string;
    gsm?: number;
  };
};

const STORAGE_KEY = 'ceriga_user_orders_v1';

function customClothingSample(): OrderQuantityPlan['sample'] {
  const bySize = { xs: 1, s: 1, m: 1, l: 1, xl: 1, xxl: 1 } as OrderQuantityPlan['sample']['bySize'];
  return { id: 'sample', kind: 'sample', bySize };
}

function planWithBulks(tiers: number[]): OrderQuantityPlan {
  return {
    mode: 'custom_clothing',
    sample: customClothingSample(),
    bulkRuns: tiers.map((tier, i) => ({
      id: `bulk-${i + 1}`,
      kind: 'bulk' as const,
      targetTotal: tier,
      bySize: distributeQuantity(tier),
    })),
  };
}

function techPackPlan(): OrderQuantityPlan {
  return {
    mode: 'techpack',
    sample: {
      id: 'sample',
      kind: 'sample',
      targetTotal: 5,
      bySize: distributeQuantity(5),
    },
    bulkRuns: [
      {
        id: 'bulk-1',
        kind: 'bulk',
        targetTotal: 100,
        bySize: distributeQuantity(100),
      },
    ],
  };
}

export function buildPriceOptions(
  orderId: string,
  plan: OrderQuantityPlan,
  baseSampleCents = 28500,
  baseBulkCents = 145000,
): OrderPriceOption[] {
  const options: OrderPriceOption[] = [];
  const sampleTotal = sumBreakdown(plan.sample.bySize);

  options.push({
    id: 'sample',
    kind: 'sample',
    label: 'Sample',
    description: `${sampleTotal} units · size run`,
    totalUnits: sampleTotal,
    priceCents: baseSampleCents,
  });

  plan.bulkRuns.forEach((run, index) => {
    const total = sumBreakdown(run.bySize);
    const units = run.targetTotal ?? total;
    if (units <= 0) return;
    options.push({
      id: `bulk-${index + 1}`,
      kind: 'bulk',
      label: `Bulk ${index + 1}`,
      description: `${units} units · production run`,
      totalUnits: units,
      priceCents: baseBulkCents + index * 85000,
    });
  });

  return options.map((opt) => ({
    ...opt,
    // payment route filled at read time via checkoutPath
  }));
}

export function checkoutPath(orderId: string, optionId: string): string {
  return `/orders/${orderId}/checkout/${optionId}`;
}

export function formatEuro(cents: number): string {
  return `€${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

/** How long quoted prices remain valid before a new quote may be required */
export const PRICE_VALIDITY_WEEKS = 6;

export function priceValidUntilDate(pricedAt: string): Date {
  const issued = new Date(pricedAt);
  const expires = new Date(issued);
  expires.setDate(expires.getDate() + PRICE_VALIDITY_WEEKS * 7);
  return expires;
}

export function formatPriceValidUntil(pricedAt: string): string {
  return priceValidUntilDate(pricedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function priceValidityDisclaimer(pricedAt?: string): string {
  const base = `This price is only valid for ${PRICE_VALIDITY_WEEKS} weeks from when it was quoted. After that, material and production costs may have changed and you may need a new quote before paying.`;
  if (!pricedAt) return base;
  return `${base} Valid until ${formatPriceValidUntil(pricedAt)}.`;
}

export function canEditOrder(order: UserOrder): boolean {
  if (order.kind === 'tech-pack') {
    return order.status === 'submitted' || order.status === 'awaiting_payment';
  }
  return order.status === 'submitted';
}

export function canUseFreeRevision(order: UserOrder): boolean {
  return (
    order.kind === 'tech-pack' &&
    (order.status === 'paid' || order.status === 'ready') &&
    !order.revisionUsed
  );
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500/20 text-blue-300',
  awaiting_payment: 'bg-amber-500/20 text-amber-300',
  priced: 'bg-amber-500/20 text-amber-300',
  paid: 'bg-sky-500/20 text-sky-300',
  processing: 'bg-purple-500/20 text-purple-300',
  shipping: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-green-500/20 text-green-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
};

const SEED_ORDERS: UserOrder[] = [
  {
    id: 'ord-pending',
    kind: 'production',
    productName: 'Organic cotton hoodie',
    garmentType: 'Hoodie',
    productId: 'prod-hoodie-01',
    status: 'submitted',
    statusLabel: 'Awaiting quote',
    orderDate: '12 Apr 2026',
    total: null,
    orderQuantities: planWithBulks([50, 100, 200]),
    specifications: {
      fit: 'Regular',
      color: '#1a1a1a',
      colorName: 'Black',
      fabricType: 'French Terry',
      gsm: 320,
    },
  },
  {
    id: 'ord-002',
    kind: 'production',
    productName: 'Classic Pullover Hoodie',
    garmentType: 'Hoodie',
    productId: 'prod-hoodie-02',
    status: 'priced',
    statusLabel: 'Choose a price',
    orderDate: '10 Mar 2026',
    pricedAt: '2026-03-10',
    total: null,
    orderQuantities: planWithBulks([75]),
    priceOptions: buildPriceOptions('ord-002', planWithBulks([75]), 31200, 427500),
    specifications: { fit: 'Regular', color: '#2d3748', colorName: 'Charcoal', fabricType: 'Fleece', gsm: 280 },
  },
  {
    id: 'ord-priced-3',
    kind: 'production',
    productName: 'Heavyweight crew sweatshirt',
    garmentType: 'Sweatshirt',
    productId: 'prod-sweat-01',
    status: 'priced',
    statusLabel: 'Choose a price',
    orderDate: '8 Apr 2026',
    pricedAt: '2026-04-08',
    total: null,
    orderQuantities: planWithBulks([50, 100, 250]),
    priceOptions: buildPriceOptions('ord-priced-3', planWithBulks([50, 100, 250])),
    specifications: { fit: 'Oversized', color: '#f5f5f5', colorName: 'Heather grey', fabricType: 'French Terry', gsm: 400 },
  },
  {
    id: 'ord-001',
    kind: 'production',
    productName: 'Premium Cotton T-Shirt',
    garmentType: 'T-Shirt',
    productId: 'prod-tee-01',
    status: 'processing',
    statusLabel: 'In production',
    orderDate: '14 Mar 2026',
    total: 3247.5,
    selectedPriceOptionId: 'bulk-1',
    paidAmountCents: 324750,
    orderQuantities: planWithBulks([250]),
    priceOptions: buildPriceOptions('ord-001', planWithBulks([250]), 28500, 324750),
    specifications: {
      fit: 'Regular',
      color: '#000000',
      colorName: 'Black',
      neckType: 'crew',
      sleeveType: 'set-in',
      sleeveLength: 'short',
      fabricType: 'Jersey',
      gsm: 180,
    },
  },
  {
    id: 'ord-004',
    kind: 'production',
    productName: 'French Terry Sweatshirt',
    garmentType: 'Sweatshirt',
    productId: 'prod-sweat-02',
    status: 'shipping',
    statusLabel: 'Shipping',
    orderDate: '28 Feb 2026',
    total: 4400,
    tracking: 'UPS 1Z999AA10123456784',
    selectedPriceOptionId: 'bulk-1',
    paidAmountCents: 440000,
    orderQuantities: planWithBulks([200]),
  },
  {
    id: 'ord-003',
    kind: 'production',
    productName: 'Performance Joggers',
    garmentType: 'Trousers',
    productId: 'prod-jogger-01',
    status: 'completed',
    statusLabel: 'Completed',
    orderDate: '2 Mar 2026',
    total: 2600,
    tracking: 'DHL 3SADKE991023',
    selectedPriceOptionId: 'bulk-1',
    paidAmountCents: 260000,
    orderQuantities: planWithBulks([100]),
  },
  {
    id: 'tp-awaiting',
    kind: 'tech-pack',
    productName: 'Studio — Rib tank top',
    garmentType: 'Tank',
    productId: 'prod-tank-01',
    status: 'awaiting_payment',
    statusLabel: 'Awaiting payment',
    orderDate: '11 Apr 2026',
    pricedAt: '2026-04-11',
    total: 29,
    exportFormat: 'pdf',
    orderQuantities: techPackPlan(),
  },
  {
    id: 'tp-002',
    kind: 'tech-pack',
    productName: 'Studio — Organic cotton tee',
    garmentType: 'T-Shirt',
    productId: 'prod-tee-02',
    status: 'paid',
    statusLabel: 'Paid',
    orderDate: '5 Apr 2026',
    total: 29,
    paidAmountCents: 2900,
    exportFormat: 'pdf',
    downloadReady: true,
    revisionUsed: false,
    orderQuantities: techPackPlan(),
  },
  {
    id: 'tp-001',
    kind: 'tech-pack',
    productName: 'Studio — French Terry crew',
    garmentType: 'Sweatshirt',
    productId: 'prod-sweat-03',
    status: 'ready',
    statusLabel: 'Download ready',
    orderDate: '8 Apr 2026',
    total: 49,
    paidAmountCents: 4900,
    exportFormat: 'pdf_bundle',
    downloadReady: true,
    revisionUsed: true,
    orderQuantities: techPackPlan(),
  },
];

const SEED_IDS = new Set(SEED_ORDERS.map((o) => o.id));

function readStoredOrders(): UserOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredOrders(orders: UserOrder[]): void {
  const dynamic = orders.filter((o) => !SEED_IDS.has(o.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dynamic));
}

export function getAllUserOrders(): UserOrder[] {
  const stored = readStoredOrders().filter((o) => !SEED_IDS.has(o.id));
  return [...SEED_ORDERS, ...stored];
}

export function getUserOrderById(id: string): UserOrder | undefined {
  return getAllUserOrders().find((o) => o.id === id);
}

export function getPriceOption(
  order: UserOrder,
  optionId: string,
): OrderPriceOption | undefined {
  return order.priceOptions?.find((o) => o.id === optionId);
}

export function upsertUserOrder(order: UserOrder): void {
  const all = getAllUserOrders();
  const idx = all.findIndex((o) => o.id === order.id);
  const next = idx >= 0 ? all.map((o, i) => (i === idx ? order : o)) : [...all, order];
  writeStoredOrders(next);
}

export function updateUserOrder(id: string, patch: Partial<UserOrder>): UserOrder | undefined {
  const all = getAllUserOrders();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return undefined;
  const updated = { ...all[idx], ...patch };
  if (SEED_IDS.has(id)) {
    const stored = readStoredOrders().filter((o) => o.id !== id);
    stored.push(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } else {
    const next = all.map((o, i) => (i === idx ? updated : o));
    writeStoredOrders(next);
  }
  window.dispatchEvent(new CustomEvent('ceriga-orders-updated'));
  return updated;
}

export function createOrderFromSubmit(input: {
  productId?: string;
  productName?: string;
  garmentType?: string;
  kind: UserOrderKind;
  orderQuantities?: OrderQuantityPlan;
}): UserOrder {
  const id = `ord-${Date.now().toString(36)}`;
  const isTechPack = input.kind === 'tech-pack';
  const order: UserOrder = {
    id,
    kind: input.kind,
    productName: input.productName ?? 'Studio project',
    garmentType: input.garmentType ?? 'Garment',
    productId: input.productId,
    status: isTechPack ? 'awaiting_payment' : 'submitted',
    statusLabel: isTechPack ? 'Awaiting payment' : 'Awaiting quote',
    orderDate: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    total: isTechPack ? 29 : null,
    orderQuantities: input.orderQuantities,
    exportFormat: isTechPack ? 'pdf' : undefined,
    pricedAt: isTechPack ? new Date().toISOString().slice(0, 10) : undefined,
  };
  upsertUserOrder(order);
  window.dispatchEvent(new CustomEvent('ceriga-orders-updated'));
  return order;
}

export function completeCheckout(orderId: string, optionId: string): UserOrder | undefined {
  const order = getUserOrderById(orderId);
  if (!order) return undefined;

  if (order.kind === 'tech-pack') {
    return updateUserOrder(orderId, {
      status: 'paid',
      statusLabel: 'Paid',
      paidAmountCents: (order.total ?? 29) * 100,
      downloadReady: true,
      revisionUsed: false,
    });
  }

  const option = getPriceOption(order, optionId);
  if (!option) return undefined;

  return updateUserOrder(orderId, {
    status: 'processing',
    statusLabel: 'In production',
    selectedPriceOptionId: optionId,
    paidAmountCents: option.priceCents,
    total: option.priceCents / 100,
  });
}

export function useUserOrders(): UserOrder[] {
  const [orders, setOrders] = useState<UserOrder[]>(() => getAllUserOrders());

  const refresh = useCallback(() => setOrders(getAllUserOrders()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('ceriga-orders-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('ceriga-orders-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  return orders;
}

export function useUserOrder(id: string | undefined): UserOrder | undefined {
  const orders = useUserOrders();
  return id ? orders.find((o) => o.id === id) : undefined;
}

export function listQuantityLabel(order: UserOrder): string | null {
  if (order.kind === 'tech-pack') return 'PDF export';
  if (!order.orderQuantities) return order.total != null ? null : '—';
  const sample = sumBreakdown(order.orderQuantities.sample.bySize);
  const bulkCount = order.orderQuantities.bulkRuns.filter(
    (r) => sumBreakdown(r.bySize) > 0 || r.targetTotal,
  ).length;
  return `${sample} sample · ${bulkCount} bulk tier${bulkCount === 1 ? '' : 's'}`;
}
