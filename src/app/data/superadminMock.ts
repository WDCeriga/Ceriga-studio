/** Mock data for the superadmin console — replace with API calls in production. */

import { applyProductionMargin, getProductionMarginPercent, resolveMarginForPlan } from './superadminPricingMock';
import { getManufacturerPlan } from './manufacturerPlanRegistry';

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
  /** Set when manufacturer submits pricing on their admin side */
  manufacturerQuoteCents?: number;
  /** Ceriga margin applied when quote is received (auto-calculator) */
  cerigaMarginPercent?: number;
  /** Auto-calculated brand price before superadmin review */
  calculatedPriceCents?: number;
  /** Superadmin-approved price sent to the brand */
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

export const MOCK_SUPER_ORDERS: SuperAdminOrder[] = [
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
  {
    id: 'ord-1005',
    kind: 'custom_clothing',
    userId: 'u6',
    userName: 'Blank Collective',
    userEmail: 'orders@blankcollective.com',
    productName: 'Heavyweight sweatshirt bulk order',
    status: 'in_production',
    createdAt: '2026-03-22',
    manufacturerId: 'm2',
    manufacturerName: 'Euro Stitch Co',
    deliveryCountry: 'DE',
    deliveryCity: 'Berlin',
    manufacturerQuoteCents: 245000,
    finalPriceCents: 289000,
    trackingNumber: 'DHL-92847102',
    customerTechPack: {
      id: 'tp-blank-sweat-heavy',
      name: 'Heavyweight sweatshirt spec',
      garmentType: 'Sweatshirt',
      builderProductId: 'sw-001',
      projectId: 'proj-blank-sweat',
      exportFormat: 'pdf',
      lastExportedAt: '2026-03-20',
      pageCount: 14,
    },
  },
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
  {
    id: 'ord-1008',
    kind: 'custom_clothing',
    userId: 'u6',
    userName: 'Blank Collective',
    userEmail: 'orders@blankcollective.com',
    productName: 'Capsule collection — 120 units',
    status: 'paid',
    createdAt: '2026-04-02',
    manufacturerId: 'm2',
    manufacturerName: 'Euro Stitch Co',
    deliveryCountry: 'NL',
    deliveryCity: 'Amsterdam',
    manufacturerQuoteCents: 156000,
    finalPriceCents: 182500,
    customerTechPack: {
      id: 'tp-blank-capsule',
      name: 'Capsule collection line sheet',
      garmentType: 'T-Shirt',
      builderProductId: 'ts-001',
      projectId: 'proj-blank-capsule',
      exportFormat: 'pdf_bundle',
      lastExportedAt: '2026-04-01',
      pageCount: 22,
    },
  },
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
  {
    id: 'ord-1011',
    kind: 'custom_clothing',
    userId: 'u4',
    userName: 'Threadline Apparel',
    userEmail: 'team@threadline.co',
    productName: 'Merino base layer — 800 units',
    status: 'pending_review',
    createdAt: '2026-04-10',
    manufacturerId: 'm2',
    manufacturerName: 'Euro Stitch Co',
    deliveryCountry: 'UK',
    deliveryCity: 'London',
    manufacturerQuoteCents: 312000,
    cerigaMarginPercent: 17.5,
    calculatedPriceCents: 366600,
    customerTechPack: {
      id: 'tp-threadline-merino',
      name: 'Merino base layer specification',
      garmentType: 'T-Shirt',
      builderProductId: 'ts-001',
      projectId: 'proj-threadline-merino',
      exportFormat: 'pdf',
      lastExportedAt: '2026-04-09',
      pageCount: 15,
    },
  },
  {
    id: 'ord-1012',
    kind: 'custom_clothing',
    userId: 'u9',
    userName: 'Urban Layer Ltd',
    userEmail: 'studio@urbanlayer.uk',
    productName: 'Workwear trouser run — 180 units',
    status: 'pending_review',
    createdAt: '2026-04-09',
    manufacturerId: 'm1',
    manufacturerName: 'North Mills',
    deliveryCountry: 'UK',
    deliveryCity: 'Leeds',
    manufacturerQuoteCents: 124500,
    cerigaMarginPercent: 17.5,
    calculatedPriceCents: 146288,
    customerTechPack: {
      id: 'tp-urban-trouser',
      name: 'Workwear trouser tech pack',
      garmentType: 'Trousers',
      builderProductId: 'tr-001',
      projectId: 'proj-urban-trouser',
      exportFormat: 'pdf',
      lastExportedAt: '2026-04-07',
      pageCount: 13,
    },
  },
];

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
