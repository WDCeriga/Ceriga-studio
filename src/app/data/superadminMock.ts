/** Mock data for the superadmin console — replace with API calls in production. */

import { applyProductionMargin, getProductionMarginPercent, resolveMarginForPlan } from './superadminPricingMock';
import { getManufacturerPlan } from './manufacturerPlanRegistry';
import {
  distributeQuantity,
  type OrderQuantityPlan,
} from './orderQuantities';
import { mockDelivery, type OrderDeliveryInfo } from './orderDelivery';
export type SuperAdminUser = {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: 'brand' | 'manufacturer' | 'worker';
  createdAt: string;
  lastActive: string;
  ordersCount: number;
};

export type OrderKind = 'techpack' | 'custom_clothing';

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'priced'
  | 'pending_review'
  | 'sent_to_brand'
  | 'paid'
  | 'in_production'
  | 'shipped'
  | 'completed';

/** One priced tier from the manufacturer (sample + up to 3 bulk runs). */
export type ManufacturerQuoteTier = {
  id: string;
  kind: 'sample' | 'bulk';
  label: string;
  totalUnits: number;
  manufacturerQuoteCents: number;
  calculatedPriceCents?: number;
  finalPriceCents?: number;
};

export type SuperAdminOrder = {
  id: string;
  kind: OrderKind;
  userId: string;
  userName: string;
  userEmail: string;
  productName: string;
  status: OrderStatus;
  createdAt: string;
  manufacturerId?: string;
  manufacturerName?: string;
  deliveryCountry: string;
  deliveryCity: string;
  /** Full delivery contact + address from brand Delivery step. */
  delivery?: OrderDeliveryInfo;
  /**
   * Sample + bulk quote tiers from the factory (matches brand quantity options).
   * Prefer this over the legacy single `manufacturerQuoteCents`.
   */
  quoteTiers?: ManufacturerQuoteTier[];
  /** Quantities the brand requested (sample + bulk quote tiers). */
  orderQuantities?: OrderQuantityPlan;
  /**
   * @deprecated Prefer quoteTiers — kept as a summary of the primary bulk/sample quote
   * for list cards that still read a single number.
   */
  manufacturerQuoteCents?: number;
  /** When assigned to a factory — quote SLA deadline (ISO date). */
  dueQuoteBy?: string;
  /** When Ceriga assigned the order to a manufacturer. */
  assignedAt?: string;
  /** Factory declined — reason surfaced for re-route. */
  factoryRejectReason?: string;
  /** Mirror of factory portal quote pipeline when known. */
  factoryQuoteStatus?: 'new' | 'reviewing' | 'clarifying' | 'quoted' | 'rejected';
  /** Ops flagged QC photos for the brand to review. */
  qcFlaggedForBrand?: boolean;
  qcFlagNote?: string;
  qcFlaggedAt?: string;
  /** Ceriga margin applied when quote is received (auto-calculator) */
  cerigaMarginPercent?: number;
  /** Auto-calculated brand price before superadmin review (legacy single-price) */
  calculatedPriceCents?: number;
  /** Superadmin-approved price sent to the brand (legacy single-price) */
  finalPriceCents?: number;
  trackingNumber?: string;
  notes?: string;
  /** Tech pack only */
  garmentType?: string;
  exportFormat?: 'pdf' | 'pdf_bundle';
  /** Legacy mock field — tech packs are pay-per export only */
  creditsUsed?: number;
  /** Custom clothing — source tech pack the customer attached to this order */
  customerTechPack?: CustomerTechPackRef;
};

function customSamplePlan(bulkTiers: number[]): OrderQuantityPlan {
  return {
    mode: 'custom_clothing',
    sample: {
      id: 'sample',
      kind: 'sample',
      targetTotal: 6,
      bySize: { xs: 1, s: 1, m: 1, l: 1, xl: 1, xxl: 1 },
    },
    bulkRuns: bulkTiers.map((tier, i) => ({
      id: `bulk-${i + 1}`,
      kind: 'bulk' as const,
      targetTotal: tier,
      bySize: distributeQuantity(tier),
    })),
  };
}

function quoteTiersFor(
  sampleCents: number,
  bulks: { units: number; quoteCents: number }[],
  marginPercent = 17.5,
): [ManufacturerQuoteTier[], number, number] {
  const tiers: ManufacturerQuoteTier[] = [
    {
      id: 'sample',
      kind: 'sample',
      label: 'Sample',
      totalUnits: 6,
      manufacturerQuoteCents: sampleCents,
      calculatedPriceCents: applyProductionMargin(sampleCents, marginPercent),
    },
    ...bulks.map((b, i) => ({
      id: `bulk-${i + 1}`,
      kind: 'bulk' as const,
      label: `Bulk ${i + 1}`,
      totalUnits: b.units,
      manufacturerQuoteCents: b.quoteCents,
      calculatedPriceCents: applyProductionMargin(b.quoteCents, marginPercent),
    })),
  ];
  const primary = tiers.find((t) => t.kind === 'bulk') ?? tiers[0];
  return [tiers, primary.manufacturerQuoteCents, primary.calculatedPriceCents ?? 0];
}

/** Quote tiers for an order (falls back to legacy single quote). */
export function getOrderQuoteTiers(order: SuperAdminOrder): ManufacturerQuoteTier[] {
  if (order.quoteTiers?.length) return order.quoteTiers;
  if (order.manufacturerQuoteCents != null) {
    return [
      {
        id: 'legacy',
        kind: 'bulk',
        label: 'Production quote',
        totalUnits: 0,
        manufacturerQuoteCents: order.manufacturerQuoteCents,
        calculatedPriceCents: order.calculatedPriceCents,
        finalPriceCents: order.finalPriceCents,
      },
    ];
  }
  return [];
}

export function withCalculatedQuoteTiers(
  tiers: ManufacturerQuoteTier[],
  marginPercent: number,
): ManufacturerQuoteTier[] {
  return tiers.map((tier) => ({
    ...tier,
    calculatedPriceCents:
      tier.calculatedPriceCents ??
      applyProductionMargin(tier.manufacturerQuoteCents, marginPercent),
  }));
}

export type CustomerTechPackRef = {
  id: string;
  name: string;
  garmentType: string;
  builderProductId: string;
  projectId: string;
  exportFormat?: 'pdf' | 'pdf_bundle';
  lastExportedAt?: string;
  pageCount?: number;
};

export type ChatAttachment = {
  kind: 'image' | 'file';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
};

export type ChatMessage = {
  id: string;
  from: 'ceriga' | 'contact';
  text: string;
  at: string;
  attachments?: ChatAttachment[];
};

export type ChatThread = {
  id: string;
  type: 'manufacturer' | 'user';
  name: string;
  subtitle: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  messages: ChatMessage[];
};

export type SuperAdminNotificationItem = {
  id: string;
  category: 'order' | 'message' | 'system' | 'pricing';
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export const MOCK_SUPER_USERS: SuperAdminUser[] = [
  {
    id: 'u1',
    name: 'Acme Clothing',
    email: 'hello@acme.com',
    credits: 120,
    role: 'brand',
    createdAt: '2025-01-12',
    lastActive: '2026-04-08',
    ordersCount: 14,
  },
  {
    id: 'u2',
    name: 'North Mills',
    email: 'ops@northmills.io',
    credits: 0,
    role: 'manufacturer',
    createdAt: '2025-06-01',
    lastActive: '2026-04-07',
    ordersCount: 8,
  },
  {
    id: 'u3',
    name: 'Studio Guest',
    email: 'guest@example.com',
    credits: 45,
    role: 'brand',
    createdAt: '2026-03-20',
    lastActive: '2026-04-09',
    ordersCount: 2,
  },
  {
    id: 'u4',
    name: 'Threadline Apparel',
    email: 'team@threadline.co',
    credits: 80,
    role: 'brand',
    createdAt: '2025-09-14',
    lastActive: '2026-04-10',
    ordersCount: 9,
  },
  {
    id: 'u5',
    name: 'Euro Stitch Co',
    email: 'production@eurostitch.eu',
    credits: 0,
    role: 'manufacturer',
    createdAt: '2024-11-02',
    lastActive: '2026-04-06',
    ordersCount: 21,
  },
  {
    id: 'u6',
    name: 'Blank Collective',
    email: 'orders@blankcollective.com',
    credits: 200,
    role: 'brand',
    createdAt: '2025-02-28',
    lastActive: '2026-04-11',
    ordersCount: 31,
  },
  {
    id: 'u7',
    name: 'Porto Garment Works',
    email: 'hello@portogarment.pt',
    credits: 0,
    role: 'manufacturer',
    createdAt: '2025-08-19',
    lastActive: '2026-04-04',
    ordersCount: 12,
  },
  {
    id: 'u8',
    name: 'Maya Chen',
    email: 'maya.chen@ceriga.io',
    credits: 0,
    role: 'worker',
    createdAt: '2026-01-08',
    lastActive: '2026-04-10',
    ordersCount: 0,
  },
  {
    id: 'u9',
    name: 'Urban Layer Ltd',
    email: 'studio@urbanlayer.uk',
    credits: 15,
    role: 'brand',
    createdAt: '2026-02-01',
    lastActive: '2026-04-08',
    ordersCount: 4,
  },
  {
    id: 'u10',
    name: 'James Okonkwo',
    email: 'j.okonkwo@ceriga.io',
    credits: 0,
    role: 'worker',
    createdAt: '2025-12-15',
    lastActive: '2026-04-07',
    ordersCount: 0,
  },
];

function ensureSuperOrderDelivery(order: SuperAdminOrder): SuperAdminOrder {
  if (order.delivery) {
    return {
      ...order,
      deliveryCity: order.delivery.city,
      deliveryCountry: order.delivery.country,
    };
  }
  const parts = order.userName.trim().split(/\s+/);
  const delivery = mockDelivery({
    firstName: parts[0] ?? 'Brand',
    lastName: parts.slice(1).join(' ') || 'Contact',
    email: order.userEmail,
    city: order.deliveryCity,
    country: order.deliveryCountry,
    phone: '+44 7700 900789',
    address1: '22 Warehouse Lane',
    address2: order.kind === 'custom_clothing' ? 'Receiving desk' : undefined,
    instructions:
      order.kind === 'custom_clothing'
        ? 'Signature required. Leave with reception if closed after 5pm.'
        : undefined,
  });
  return {
    ...order,
    delivery,
    deliveryCity: delivery.city,
    deliveryCountry: delivery.country,
  };
}

export let MOCK_SUPER_ORDERS: SuperAdminOrder[] = [
  {
    id: 'ord-1001',
    kind: 'techpack',
    userId: 'u1',
    userName: 'Acme Clothing',
    userEmail: 'hello@acme.com',
    productName: 'Premium Cotton T-Shirt — tech pack',
    status: 'completed',
    createdAt: '2026-04-01',
    deliveryCountry: 'UK',
    deliveryCity: 'London',
    finalPriceCents: 2900,
    garmentType: 'T-Shirt',
    exportFormat: 'pdf',
    creditsUsed: 0,
  },
  {
    id: 'ord-1002',
    kind: 'custom_clothing',
    userId: 'u1',
    userName: 'Acme Clothing',
    userEmail: 'hello@acme.com',
    productName: 'Oversized hoodie run (250 units)',
    status: 'assigned',
    createdAt: '2026-04-05',
    manufacturerId: 'm1',
    manufacturerName: 'North Mills',
    assignedAt: '2026-04-05',
    dueQuoteBy: '2026-04-08',
    factoryQuoteStatus: 'reviewing',
    deliveryCountry: 'UK',
    deliveryCity: 'Manchester',
    customerTechPack: {
      id: 'tp-acme-hoodie-run',
      name: 'Oversized hoodie — production spec',
      garmentType: 'Hoodie',
      builderProductId: 'hd-001',
      projectId: 'proj-acme-hoodie-250',
      exportFormat: 'pdf',
      lastExportedAt: '2026-04-04',
      pageCount: 12,
    },
  },
  {
    id: 'ord-1003',
    kind: 'techpack',
    userId: 'u3',
    userName: 'Studio Guest',
    userEmail: 'guest@example.com',
    productName: 'Tech pack PDF export',
    status: 'submitted',
    createdAt: '2026-04-08',
    deliveryCountry: 'US',
    deliveryCity: 'New York',
    garmentType: 'Hoodie',
    exportFormat: 'pdf',
  },
  {
    id: 'ord-1004',
    kind: 'custom_clothing',
    userId: 'u4',
    userName: 'Threadline Apparel',
    userEmail: 'team@threadline.co',
    productName: 'Recycled fleece jacket — 500 units',
    status: 'assigned',
    createdAt: '2026-04-09',
    manufacturerId: 'm2',
    manufacturerName: 'Euro Stitch Co',
    assignedAt: '2026-04-09',
    dueQuoteBy: '2026-04-11',
    factoryQuoteStatus: 'rejected',
    factoryRejectReason: 'Lead time too tight for recycled fleece MOQ this month',
    deliveryCountry: 'UK',
    deliveryCity: 'Bristol',
    customerTechPack: {
      id: 'tp-threadline-fleece',
      name: 'Recycled fleece jacket tech pack',
      garmentType: 'Jacket',
      builderProductId: 'jk-001',
      projectId: 'proj-threadline-fleece',
      exportFormat: 'pdf_bundle',
      lastExportedAt: '2026-04-08',
      pageCount: 18,
    },
  },
  (() => {
    const [tiers, primaryQuote, primaryCalc] = quoteTiersFor(
      28500,
      [
        { units: 50, quoteCents: 145000 },
        { units: 100, quoteCents: 245000 },
        { units: 250, quoteCents: 520000 },
      ],
      17.5,
    );
    const withFinals = tiers.map((t) =>
      t.id === 'bulk-2'
        ? { ...t, finalPriceCents: 289000 }
        : { ...t, finalPriceCents: t.calculatedPriceCents },
    );
    return {
      id: 'ord-1005',
      kind: 'custom_clothing' as const,
      userId: 'u6',
      userName: 'Blank Collective',
      userEmail: 'orders@blankcollective.com',
      productName: 'Heavyweight sweatshirt bulk order',
      status: 'in_production' as const,
      createdAt: '2026-03-22',
      manufacturerId: 'm2',
      manufacturerName: 'Euro Stitch Co',
      deliveryCountry: 'DE',
      deliveryCity: 'Berlin',
      orderQuantities: customSamplePlan([50, 100, 250]),
      quoteTiers: withFinals,
      manufacturerQuoteCents: primaryQuote,
      calculatedPriceCents: primaryCalc,
      finalPriceCents: 289000,
      trackingNumber: 'DHL-92847102',
      customerTechPack: {
        id: 'tp-blank-sweat-heavy',
        name: 'Heavyweight sweatshirt spec',
        garmentType: 'Sweatshirt',
        builderProductId: 'sw-001',
        projectId: 'proj-blank-sweat',
        exportFormat: 'pdf' as const,
        lastExportedAt: '2026-03-20',
        pageCount: 14,
      },
    };
  })(),
  {
    id: 'ord-1006',
    kind: 'techpack',
    userId: 'u9',
    userName: 'Urban Layer Ltd',
    userEmail: 'studio@urbanlayer.uk',
    productName: 'Cargo pant tech pack v2',
    status: 'paid',
    createdAt: '2026-03-10',
    deliveryCountry: 'UK',
    deliveryCity: 'Leeds',
    finalPriceCents: 2900,
    garmentType: 'Trousers',
    exportFormat: 'pdf',
    creditsUsed: 1,
  },
  {
    id: 'ord-1007',
    kind: 'techpack',
    userId: 'u4',
    userName: 'Threadline Apparel',
    userEmail: 'team@threadline.co',
    productName: 'Organic tee line sheet pack',
    status: 'completed',
    createdAt: '2026-02-14',
    deliveryCountry: 'UK',
    deliveryCity: 'London',
    finalPriceCents: 4900,
    garmentType: 'T-Shirt',
    exportFormat: 'pdf_bundle',
    creditsUsed: 0,
  },
  (() => {
    const [tiers, primaryQuote, primaryCalc] = quoteTiersFor(
      24800,
      [
        { units: 50, quoteCents: 98000 },
        { units: 120, quoteCents: 156000 },
      ],
      17.5,
    );
    const withFinals = tiers.map((t) =>
      t.id === 'bulk-2'
        ? { ...t, finalPriceCents: 182500 }
        : { ...t, finalPriceCents: t.calculatedPriceCents },
    );
    return {
      id: 'ord-1008',
      kind: 'custom_clothing' as const,
      userId: 'u6',
      userName: 'Blank Collective',
      userEmail: 'orders@blankcollective.com',
      productName: 'Capsule collection — 120 units',
      status: 'paid' as const,
      createdAt: '2026-04-02',
      manufacturerId: 'm2',
      manufacturerName: 'Euro Stitch Co',
      deliveryCountry: 'NL',
      deliveryCity: 'Amsterdam',
      orderQuantities: customSamplePlan([50, 120]),
      quoteTiers: withFinals,
      manufacturerQuoteCents: primaryQuote,
      calculatedPriceCents: primaryCalc,
      finalPriceCents: 182500,
      customerTechPack: {
        id: 'tp-blank-capsule',
        name: 'Capsule collection line sheet',
        garmentType: 'T-Shirt',
        builderProductId: 'ts-001',
        projectId: 'proj-blank-capsule',
        exportFormat: 'pdf_bundle' as const,
        lastExportedAt: '2026-04-01',
        pageCount: 22,
      },
    };
  })(),
  {
    id: 'ord-1009',
    kind: 'techpack',
    userId: 'u1',
    userName: 'Acme Clothing',
    userEmail: 'hello@acme.com',
    productName: 'Spring drop polo tech pack',
    status: 'paid',
    createdAt: '2026-04-07',
    deliveryCountry: 'UK',
    deliveryCity: 'London',
    finalPriceCents: 2900,
    garmentType: 'Polo',
    exportFormat: 'pdf',
    creditsUsed: 0,
  },
  {
    id: 'ord-1010',
    kind: 'custom_clothing',
    userId: 'u9',
    userName: 'Urban Layer Ltd',
    userEmail: 'studio@urbanlayer.uk',
    productName: 'Sample run — 24 hoodies',
    status: 'draft',
    createdAt: '2026-04-11',
    manufacturerId: 'm1',
    manufacturerName: 'North Mills',
    deliveryCountry: 'UK',
    deliveryCity: 'Manchester',
    customerTechPack: {
      id: 'tp-urban-hoodie-sample',
      name: 'Sample hoodie — tech pack v3',
      garmentType: 'Hoodie',
      builderProductId: 'hd-001',
      projectId: 'proj-urban-hoodie-24',
      exportFormat: 'pdf',
      lastExportedAt: '2026-04-10',
      pageCount: 11,
    },
  },
  (() => {
    const [tiers, primaryQuote, primaryCalc] = quoteTiersFor(
      32000,
      [
        { units: 100, quoteCents: 118000 },
        { units: 250, quoteCents: 210000 },
        { units: 800, quoteCents: 312000 },
      ],
      17.5,
    );
    return {
      id: 'ord-1011',
      kind: 'custom_clothing' as const,
      userId: 'u4',
      userName: 'Threadline Apparel',
      userEmail: 'team@threadline.co',
      productName: 'Merino base layer — 800 units',
      status: 'pending_review' as const,
      createdAt: '2026-04-10',
      manufacturerId: 'm2',
      manufacturerName: 'Euro Stitch Co',
      deliveryCountry: 'UK',
      deliveryCity: 'London',
      orderQuantities: customSamplePlan([100, 250, 800]),
      quoteTiers: tiers,
      manufacturerQuoteCents: primaryQuote,
      cerigaMarginPercent: 17.5,
      calculatedPriceCents: primaryCalc,
      customerTechPack: {
        id: 'tp-threadline-merino',
        name: 'Merino base layer specification',
        garmentType: 'T-Shirt',
        builderProductId: 'ts-001',
        projectId: 'proj-threadline-merino',
        exportFormat: 'pdf' as const,
        lastExportedAt: '2026-04-09',
        pageCount: 15,
      },
    };
  })(),
  (() => {
    const [tiers, primaryQuote, primaryCalc] = quoteTiersFor(
      26500,
      [
        { units: 50, quoteCents: 72000 },
        { units: 100, quoteCents: 98000 },
        { units: 180, quoteCents: 124500 },
      ],
      17.5,
    );
    return {
      id: 'ord-1012',
      kind: 'custom_clothing' as const,
      userId: 'u9',
      userName: 'Urban Layer Ltd',
      userEmail: 'studio@urbanlayer.uk',
      productName: 'Workwear trouser run — 180 units',
      status: 'pending_review' as const,
      createdAt: '2026-04-09',
      manufacturerId: 'm1',
      manufacturerName: 'North Mills',
      deliveryCountry: 'UK',
      deliveryCity: 'Leeds',
      orderQuantities: customSamplePlan([50, 100, 180]),
      quoteTiers: tiers,
      manufacturerQuoteCents: primaryQuote,
      cerigaMarginPercent: 17.5,
      calculatedPriceCents: primaryCalc,
      customerTechPack: {
        id: 'tp-urban-trouser',
        name: 'Workwear trouser tech pack',
        garmentType: 'Trousers',
        builderProductId: 'tr-001',
        projectId: 'proj-urban-trouser',
        exportFormat: 'pdf' as const,
        lastExportedAt: '2026-04-07',
        pageCount: 13,
      },
    };
  })(),
].map(ensureSuperOrderDelivery);

export const MOCK_THREADS: ChatThread[] = [
  {
    id: 'th1',
    type: 'manufacturer',
    name: 'North Mills',
    subtitle: 'Manufacturing',
    lastMessage: 'We can start cutting next week if colours are signed off.',
    lastAt: '10:42',
    unread: 2,
    messages: [
      {
        id: 'th1-m1',
        from: 'ceriga',
        text: 'Hi — can you confirm thread gauge for the rib on ord-1001?',
        at: '09:14',
      },
      {
        id: 'th1-m2',
        from: 'contact',
        text: '3.5 mm cotton rib, same as your approved swatch from February.',
        at: '09:22',
      },
      {
        id: 'th1-m3',
        from: 'ceriga',
        text: 'Perfect. Customer signed off PMS 186C for the body panel yesterday.',
        at: '10:05',
      },
      {
        id: 'th1-m4',
        from: 'contact',
        text: 'We can start cutting next week if colours are signed off.',
        at: '10:42',
      },
    ],
  },
  {
    id: 'th2',
    type: 'user',
    name: 'Acme Clothing',
    subtitle: 'Brand',
    lastMessage: 'Can we bump the delivery to week 24?',
    lastAt: 'Yesterday',
    unread: 0,
    messages: [
      {
        id: 'th2-m1',
        from: 'contact',
        text: 'Morning — any update on the heavyweight tee run?',
        at: 'Mon 11:02',
      },
      {
        id: 'th2-m2',
        from: 'ceriga',
        text: 'Production is on track for week 22. I’ll send tracking once it leaves the mill.',
        at: 'Mon 14:18',
      },
      {
        id: 'th2-m3',
        from: 'contact',
        text: 'Can we bump the delivery to week 24?',
        at: 'Yesterday',
      },
    ],
  },
];

export const MOCK_SUPER_NOTIFICATIONS: SuperAdminNotificationItem[] = [
  {
    id: 'n1',
    category: 'order',
    title: 'New tech pack order',
    body: 'ord-1003 submitted by guest@example.com',
    at: '2026-04-09T09:00:00Z',
    read: false,
  },
  {
    id: 'n2',
    category: 'pricing',
    title: 'Manufacturer priced order',
    body: 'ord-1001 marked priced — review final pricing',
    at: '2026-04-08T16:20:00Z',
    read: false,
  },
  {
    id: 'n3',
    category: 'message',
    title: 'North Mills',
    body: 'New message in thread',
    at: '2026-04-08T11:02:00Z',
    read: true,
  },
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Received',
  assigned: 'At manufacturer',
  priced: 'Manufacturer quoted',
  pending_review: 'Awaiting your review',
  sent_to_brand: 'Sent to brand',
  paid: 'Paid',
  in_production: 'In production',
  shipped: 'Shipped',
  completed: 'Completed',
};

/** @deprecated Use getProductionMarginPercent() from superadminPricingMock */
export const CERIGA_DEFAULT_MARGIN_PERCENT = 17.5;

export function applyCerigaMargin(
  quoteCents: number,
  marginPercent?: number,
) {
  return applyProductionMargin(
    quoteCents,
    marginPercent ?? getProductionMarginPercent(),
  );
}

/** Mock manufacturer entity id on orders → CRM user id (plan assigned in Roles & access). */
export const MANUFACTURER_ENTITY_TO_USER: Record<string, string> = {
  m1: 'u2',
  m2: 'u5',
  m3: 'u7',
};

export type ResolvedProductionMargin = {
  planId: string;
  planName: string;
  platformMarginPercent: number;
  manufacturerId?: string;
  manufacturerName?: string;
};

export function resolveMarginForManufacturer(
  manufacturerId?: string,
  manufacturerName?: string,
): ResolvedProductionMargin {
  if (!manufacturerId) {
    const fallback = resolveMarginForPlan();
    return {
      planId: fallback.planId,
      planName: fallback.planName,
      platformMarginPercent: fallback.platformMarginPercent,
      manufacturerId,
      manufacturerName,
    };
  }

  const userId = MANUFACTURER_ENTITY_TO_USER[manufacturerId];
  const plan = resolveMarginForPlan(userId ? getManufacturerPlan(userId) : undefined);

  return {
    planId: plan.planId,
    planName: plan.planName,
    platformMarginPercent: plan.platformMarginPercent,
    manufacturerId,
    manufacturerName,
  };
}

export function applyCerigaMarginForManufacturer(quoteCents: number, manufacturerId?: string) {
  const { platformMarginPercent } = resolveMarginForManufacturer(manufacturerId);
  return applyCerigaMargin(quoteCents, platformMarginPercent);
}

/** Orders sitting in the superadmin review queue (custom clothing pricing). */
export const SUPERADMIN_REVIEW_STATUSES: OrderStatus[] = ['pending_review'];

export const ORDER_STAGE_GROUPS = {
  review: SUPERADMIN_REVIEW_STATUSES,
  at_manufacturer: ['submitted', 'assigned'] as OrderStatus[],
  with_brand: ['priced', 'sent_to_brand'] as OrderStatus[],
  fulfilment: ['paid', 'in_production', 'shipped', 'completed'] as OrderStatus[],
} as const;

export type OrderStageFilter = keyof typeof ORDER_STAGE_GROUPS | 'all';

export function formatMoney(cents: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}

const ORDER_OPS_KEY = 'ceriga_superadmin_orders_ops_v1';

function loadOrderOpsPatches(): Record<string, Partial<SuperAdminOrder>> {
  try {
    const raw = localStorage.getItem(ORDER_OPS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Partial<SuperAdminOrder>>;
  } catch {
    /* ignore */
  }
  return {};
}

function persistOrderOpsPatches(patches: Record<string, Partial<SuperAdminOrder>>) {
  try {
    localStorage.setItem(ORDER_OPS_KEY, JSON.stringify(patches));
  } catch {
    /* ignore */
  }
}

/** Apply persisted assignment / QC patches onto the in-memory order list. */
export function hydrateSuperAdminOrdersFromStorage() {
  if (typeof window === 'undefined') return;
  const patches = loadOrderOpsPatches();
  MOCK_SUPER_ORDERS = MOCK_SUPER_ORDERS.map((o) =>
    patches[o.id] ? { ...o, ...patches[o.id] } : o,
  );
}

if (typeof window !== 'undefined') {
  hydrateSuperAdminOrdersFromStorage();
}

export function getSuperAdminOrder(id: string): SuperAdminOrder | undefined {
  return MOCK_SUPER_ORDERS.find((o) => o.id === id);
}

export function patchSuperAdminOrder(
  id: string,
  patch: Partial<SuperAdminOrder>,
): SuperAdminOrder | undefined {
  const idx = MOCK_SUPER_ORDERS.findIndex((o) => o.id === id);
  if (idx < 0) return undefined;
  const next = { ...MOCK_SUPER_ORDERS[idx], ...patch };
  MOCK_SUPER_ORDERS = MOCK_SUPER_ORDERS.map((o, i) => (i === idx ? next : o));
  const all = loadOrderOpsPatches();
  all[id] = { ...(all[id] ?? {}), ...patch };
  persistOrderOpsPatches(all);
  return next;
}
