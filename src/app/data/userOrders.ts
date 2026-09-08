import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getOrder as getOrderDb,
  insertOrder as insertOrderDb,
  listOrders as listOrdersDb,
  patchOrder as patchOrderDb,
  uploadOrderFiles,
} from '../lib/ordersDb';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { OrderDeliveryInfo } from './orderDelivery';
import {
  distributeQuantity,
  emptySizeBreakdown,
  sumBreakdown,
  type OrderQuantityPlan,
  type SizeBreakdown,
} from './orderQuantities';
import type { ManufacturerQuoteTierRow } from '../lib/ordersDb';

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

/** Where + how the POD print sits on the garment (as designed in the studio). */
export type PodPlacement = {
  /** Horizontal offset from the center of the chest print zone, -50..50 (% of zone width). */
  offsetX: number;
  /** Vertical offset from the center of the chest print zone, -50..50 (% of zone height). */
  offsetY: number;
  /** Print scale relative to the chest print zone, 1..160 (%; 100 = fill zone). */
  scale: number;
  /** Print rotation in degrees, -180..180. */
  rotation: number;
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
  /** Upload-for-quote / POD request details. */
  quoteRequest?: {
    fileNames?: string[];
    storagePaths?: string[];
    quantity?: string;
    timeline?: string;
    notes?: string;
    /** Print-on-demand design summary */
    pod?: {
      designMode: 'image' | 'text';
      text?: string;
      textColor?: string;
      /** Print position/size/rotation as designed in the POD studio. */
      placement?: PodPlacement;
    };
  };
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
  /** Delivery contact captured at the brand Delivery step. */
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Full shipping address captured at the brand Delivery step. */
  delivery?: OrderDeliveryInfo;
  /** Superadmin assignment */
  assignedManufacturerId?: string;
  assignedAt?: string;
  dueQuoteBy?: string;
  manufacturerQuote?: ManufacturerQuoteTierRow[];
  /** Manufacturer-side pipeline status. */
  factoryStatus?: 'new' | 'reviewing' | 'clarifying' | 'quoted' | 'rejected' | 'in_production' | 'completed';
  factoryRejectReason?: string;
  quotedAt?: string;
  /** Ops-only notes. */
  opsNotes?: string;
};

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
  submitted: 'border border-[#5A4530] bg-[#2A2218] text-[#E8A868]',
  awaiting_payment: 'border border-[#5A4530] bg-[#2A2218] text-[#E8A868]',
  priced: 'border border-[#5A4530] bg-[#2A2218] text-[#E8A868]',
  paid: 'border border-[#345040] bg-[#14201A] text-[#7FA888]',
  processing: 'border border-[#5A4530] bg-[#1C0F0F] text-[#E5534A]',
  shipping: 'border border-[#345040] bg-[#14201A] text-[#7FA888]',
  completed: 'border border-[#345040] bg-[#14201A] text-[#7FA888]',
  ready: 'border border-[#345040] bg-[#14201A] text-[#7FA888]',
};

/** Demo seed only when Supabase is not configured (local UI preview). */
const DEMO_SEED_ORDERS: UserOrder[] = [
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
      color: '#161618',
      colorName: 'Black',
      fabricType: 'French Terry',
      gsm: 320,
    },
  },
];

function notifyOrdersUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ceriga-orders-updated'));
  }
}

export async function fetchUserOrders(): Promise<UserOrder[]> {
  if (!isSupabaseConfigured) return DEMO_SEED_ORDERS;
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) return [];
  return listOrdersDb();
}

export async function fetchUserOrderById(id: string): Promise<UserOrder | undefined> {
  if (!isSupabaseConfigured) {
    return DEMO_SEED_ORDERS.find((o) => o.id === id);
  }
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) return undefined;
  const order = await getOrderDb(id);
  return order ?? undefined;
}

/** @deprecated Prefer fetchUserOrders — sync helper for non-DB preview only */
export function getAllUserOrders(): UserOrder[] {
  if (!isSupabaseConfigured) return DEMO_SEED_ORDERS;
  return [];
}

/** @deprecated Prefer fetchUserOrderById */
export function getUserOrderById(id: string): UserOrder | undefined {
  if (!isSupabaseConfigured) return DEMO_SEED_ORDERS.find((o) => o.id === id);
  return undefined;
}

export function getPriceOption(
  order: UserOrder,
  optionId: string,
): OrderPriceOption | undefined {
  return order.priceOptions?.find((o) => o.id === optionId);
}

export async function updateUserOrder(
  id: string,
  patch: Partial<UserOrder>,
): Promise<UserOrder | undefined> {
  if (!isSupabaseConfigured) {
    const idx = DEMO_SEED_ORDERS.findIndex((o) => o.id === id);
    if (idx < 0) return undefined;
    DEMO_SEED_ORDERS[idx] = { ...DEMO_SEED_ORDERS[idx]!, ...patch };
    notifyOrdersUpdated();
    return DEMO_SEED_ORDERS[idx];
  }

  const updated = await patchOrderDb(id, {
    status: patch.status,
    statusLabel: patch.statusLabel,
    total: patch.total,
    tracking: patch.tracking,
    orderQuantities: patch.orderQuantities,
    priceOptions: patch.priceOptions,
    selectedPriceOptionId: patch.selectedPriceOptionId,
    paidAmountCents: patch.paidAmountCents,
    exportFormat: patch.exportFormat,
    revisionUsed: patch.revisionUsed,
    downloadReady: patch.downloadReady,
    pricedAt: patch.pricedAt,
    quoteRequest: patch.quoteRequest,
    specifications: patch.specifications,
    assignedManufacturerId: patch.assignedManufacturerId,
    assignedAt: patch.assignedAt,
    dueQuoteBy: patch.dueQuoteBy,
    manufacturerQuote: patch.manufacturerQuote,
    factoryStatus: patch.factoryStatus,
    factoryRejectReason: patch.factoryRejectReason,
    quotedAt: patch.quotedAt,
    opsNotes: patch.opsNotes,
  });
  notifyOrdersUpdated();
  return updated;
}

export async function createOrderFromSubmit(input: {
  productId?: string;
  productName?: string;
  garmentType?: string;
  kind: UserOrderKind;
  orderQuantities?: OrderQuantityPlan;
  quoteRequest?: UserOrder['quoteRequest'];
  files?: File[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  delivery?: OrderDeliveryInfo;
}): Promise<UserOrder> {
  const isTechPack = input.kind === 'tech-pack';
  const status: UserOrderStatus = isTechPack ? 'awaiting_payment' : 'submitted';
  const statusLabel = isTechPack ? 'Awaiting payment' : 'Awaiting quote';

  if (!isSupabaseConfigured) {
    const order: UserOrder = {
      id: `ord-${Date.now().toString(36)}`,
      kind: input.kind,
      productName: input.productName ?? 'Studio project',
      garmentType: input.garmentType ?? 'Garment',
      productId: input.productId,
      status,
      statusLabel,
      orderDate: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      total: isTechPack ? 29 : null,
      orderQuantities: input.orderQuantities,
      exportFormat: isTechPack ? 'pdf' : undefined,
      pricedAt: isTechPack ? new Date().toISOString().slice(0, 10) : undefined,
      quoteRequest: input.quoteRequest,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      delivery: input.delivery,
    };
    DEMO_SEED_ORDERS.unshift(order);
    notifyOrdersUpdated();
    return order;
  }

  const order = await insertOrderDb({
    kind: input.kind,
    productName: input.productName ?? 'Studio project',
    garmentType: input.garmentType ?? 'Garment',
    productId: input.productId,
    status,
    statusLabel,
    total: isTechPack ? 29 : null,
    orderQuantities: input.orderQuantities,
    exportFormat: isTechPack ? 'pdf' : undefined,
    pricedAt: isTechPack ? new Date().toISOString().slice(0, 10) : undefined,
    quoteRequest: input.quoteRequest,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    delivery: input.delivery,
  });

  if (input.files && input.files.length > 0) {
    const uploaded = await uploadOrderFiles(order.id, input.files);
    const quoteRequest = {
      ...input.quoteRequest,
      fileNames: uploaded.map((u) => u.name),
      storagePaths: uploaded.map((u) => u.path),
    };
    const patched = await patchOrderDb(order.id, { quoteRequest });
    notifyOrdersUpdated();
    return patched;
  }

  notifyOrdersUpdated();
  return order;
}

/** Fixed unit prices for the print-on-demand flow (cents). */
export const POD_UNIT_PRICE_CENTS: Record<'tshirt' | 'hoodie', number> = {
  tshirt: 1899,
  hoodie: 3299,
};

export async function createPrintOnDemandOrder(input: {
  productId: string;
  productName: string;
  garmentType: 'tshirt' | 'hoodie';
  color: string;
  colorName: string;
  bySize: SizeBreakdown;
  designMode: 'image' | 'text';
  text?: string;
  textColor?: string;
  /** Print position/size/rotation chosen in the studio. */
  placement?: PodPlacement;
  imageFile?: File | null;
}): Promise<UserOrder> {
  const units = sumBreakdown(input.bySize);
  if (units < 1) throw new Error('Add at least one unit');
  if (input.designMode === 'text' && !input.text?.trim()) {
    throw new Error('Enter text for your print');
  }
  if (input.designMode === 'image' && !input.imageFile) {
    throw new Error('Upload an image for your print');
  }

  const unitCents = POD_UNIT_PRICE_CENTS[input.garmentType];
  const priceCents = unitCents * units;
  const orderQuantities: OrderQuantityPlan = {
    mode: 'custom_clothing',
    sample: {
      id: 'sample',
      kind: 'sample',
      bySize: emptySizeBreakdown(),
    },
    bulkRuns: [
      {
        id: 'bulk-1',
        kind: 'bulk',
        targetTotal: units,
        bySize: { ...input.bySize },
      },
    ],
  };

  const priceOptions: OrderPriceOption[] = [
    {
      id: 'pod',
      kind: 'bulk',
      label: 'Print order',
      description: `${units} unit${units === 1 ? '' : 's'} · ${input.colorName}`,
      totalUnits: units,
      priceCents,
    },
  ];

  const placement = input.placement;
  const quoteRequest: UserOrder['quoteRequest'] = {
    quantity: String(units),
    notes:
      input.designMode === 'text'
        ? `POD text print: “${input.text?.trim()}”`
        : 'POD image print (see uploaded file)',
    pod: {
      designMode: input.designMode,
      text: input.designMode === 'text' ? input.text?.trim() : undefined,
      textColor: input.designMode === 'text' ? input.textColor : undefined,
      placement: placement ?? undefined,
    },
    fileNames: input.imageFile ? [input.imageFile.name] : undefined,
  };

  const garmentLabel = input.garmentType === 'hoodie' ? 'Hoodie' : 'T-Shirt';
  const specs: UserOrder['specifications'] = {
    color: input.color,
    colorName: input.colorName,
    fabricType: input.garmentType === 'hoodie' ? 'Fleece' : 'Jersey',
  };

  if (!isSupabaseConfigured) {
    const order: UserOrder = {
      id: `ord-${Date.now().toString(36)}`,
      kind: 'production',
      productName: input.productName,
      garmentType: garmentLabel,
      productId: input.productId,
      status: 'priced',
      statusLabel: 'Ready to pay',
      orderDate: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      total: priceCents / 100,
      orderQuantities,
      priceOptions,
      pricedAt: new Date().toISOString().slice(0, 10),
      quoteRequest,
      specifications: specs,
    };
    DEMO_SEED_ORDERS.unshift(order);
    notifyOrdersUpdated();
    return order;
  }

  let order = await insertOrderDb({
    kind: 'production',
    productName: input.productName,
    garmentType: garmentLabel,
    productId: input.productId,
    status: 'priced',
    statusLabel: 'Ready to pay',
    total: priceCents / 100,
    orderQuantities,
    priceOptions,
    pricedAt: new Date().toISOString().slice(0, 10),
    quoteRequest,
    specifications: specs,
  });

  if (input.imageFile) {
    const uploaded = await uploadOrderFiles(order.id, [input.imageFile]);
    order = await patchOrderDb(order.id, {
      quoteRequest: {
        ...quoteRequest,
        fileNames: uploaded.map((u) => u.name),
        storagePaths: uploaded.map((u) => u.path),
      },
    });
  }

  notifyOrdersUpdated();
  return order;
}

export async function completeCheckout(
  orderId: string,
  optionId: string,
): Promise<UserOrder | undefined> {
  const order = await fetchUserOrderById(orderId);
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
  const { isAuthenticated, authReady, usingSupabase } = useAuth();
  const [orders, setOrders] = useState<UserOrder[]>([]);

  const refresh = useCallback(async () => {
    if (!authReady) return;
    if (usingSupabase && !isAuthenticated) {
      setOrders([]);
      return;
    }
    try {
      setOrders(await fetchUserOrders());
    } catch {
      setOrders([]);
    }
  }, [authReady, isAuthenticated, usingSupabase]);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener('ceriga-orders-updated', handler);
    return () => window.removeEventListener('ceriga-orders-updated', handler);
  }, [refresh]);

  return orders;
}

export function useUserOrder(id: string | undefined): {
  order: UserOrder | undefined;
  loading: boolean;
} {
  const { isAuthenticated, authReady, usingSupabase } = useAuth();
  const [order, setOrder] = useState<UserOrder | undefined>(undefined);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id || !authReady) {
      setOrder(undefined);
      setLoading(Boolean(id) && !authReady);
      return;
    }
    if (usingSupabase && !isAuthenticated) {
      setOrder(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const row = await fetchUserOrderById(id);
        if (!cancelled) setOrder(row);
      } catch {
        if (!cancelled) setOrder(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const handler = () => {
      void fetchUserOrderById(id).then((row) => {
        if (!cancelled) setOrder(row);
      });
    };
    window.addEventListener('ceriga-orders-updated', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('ceriga-orders-updated', handler);
    };
  }, [id, authReady, isAuthenticated, usingSupabase]);

  return { order, loading };
}

export function listQuantityLabel(order: UserOrder): string | null {
  if (order.kind === 'tech-pack') return 'PDF export';
  if (order.quoteRequest?.quantity) return `${order.quoteRequest.quantity} units (quote)`;
  if (!order.orderQuantities) return order.total != null ? null : '—';
  const sample = sumBreakdown(order.orderQuantities.sample.bySize);
  const bulkCount = order.orderQuantities.bulkRuns.filter(
    (r) => sumBreakdown(r.bySize) > 0 || r.targetTotal,
  ).length;
  return `${sample} sample · ${bulkCount} bulk tier${bulkCount === 1 ? '' : 's'}`;
}
