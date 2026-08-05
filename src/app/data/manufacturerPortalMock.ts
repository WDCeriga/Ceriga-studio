import { distributeQuantity, type OrderQuantityPlan } from './orderQuantities';
import {
  mockDelivery,
  type OrderDeliveryInfo,
  type OrderTechPackLink,
} from './orderDelivery';
import {
  estimateShippingQuoteCents,
  getShippingCarrier,
  seedFactoryShipments,
  seedFactoryShippingPrefs,
  type FactoryShipment,
  type FactoryShippingPrefs,
  type FactoryCarrierSetup,
  type Incoterm,
  type ShippingMode,
  type OnboardedShippingCarrier,
  CERIGA_SHIPPING_CARRIERS,
} from './factoryShipping';
import { submitShippingCarrierOnboardRequest } from './shippingOnboardMock';

export type {
  FactoryShipment,
  FactoryShippingPrefs,
  FactoryCarrierSetup,
  Incoterm,
  ShippingMode,
  OnboardedShippingCarrier,
} from './factoryShipping';

export {
  CERIGA_SHIPPING_CARRIERS,
  SHIPPING_MODE_LABEL,
  INCOTERM_LABEL,
  INCOTERM_HELP,
  ALL_SHIPPING_MODES,
  ALL_INCOTERMS,
  SHIPMENT_STATUS_LABEL,
  estimateShippingQuoteCents,
  getShippingCarrier,
} from './factoryShipping';
export type FactoryGarment =
  | 'Hoodies'
  | 'T-shirts'
  | 'Sweatshirts'
  | 'Joggers'
  | 'Zip-ups'
  | 'Polos'
  | 'Outerwear'
  | 'Shorts';

export type FactoryCapability =
  | 'Cut & sew'
  | 'DTG'
  | 'Screen print'
  | 'Embroidery'
  | 'Sublimations'
  | 'Garment wash / fade'
  | 'Distressing'
  | 'Heat transfer'
  | 'Private label packing';

export const ALL_FACTORY_GARMENTS: FactoryGarment[] = [
  'Hoodies',
  'T-shirts',
  'Sweatshirts',
  'Joggers',
  'Zip-ups',
  'Polos',
  'Outerwear',
  'Shorts',
];

export const ALL_FACTORY_CAPABILITIES: FactoryCapability[] = [
  'Cut & sew',
  'DTG',
  'Screen print',
  'Embroidery',
  'Sublimations',
  'Garment wash / fade',
  'Distressing',
  'Heat transfer',
  'Private label packing',
];

export type DeliveryOptionId = 'economy' | 'standard' | 'express';

export type DeliveryOption = {
  id: DeliveryOptionId;
  label: string;
  daysMin: number;
  daysMax: number;
  surchargePercent: number;
};

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'economy', label: 'Economy sea/road', daysMin: 28, daysMax: 40, surchargePercent: 0 },
  { id: 'standard', label: 'Standard', daysMin: 18, daysMax: 24, surchargePercent: 8 },
  { id: 'express', label: 'Express air', daysMin: 10, daysMax: 14, surchargePercent: 22 },
];

export type FactoryTeamRole = 'admin' | 'quoter' | 'production' | 'viewer';

/** Concrete portal actions — roles map to these; members can override. */
export type FactoryPermission =
  | 'quote'
  | 'decline'
  | 'edit_shipping'
  | 'edit_materials'
  | 'manage_team'
  | 'edit_profile'
  | 'view_stats'
  | 'manage_capacity';

export const ALL_FACTORY_PERMISSIONS: FactoryPermission[] = [
  'quote',
  'decline',
  'edit_shipping',
  'edit_materials',
  'manage_team',
  'edit_profile',
  'view_stats',
  'manage_capacity',
];

export const FACTORY_PERMISSION_LABEL: Record<FactoryPermission, string> = {
  quote: 'Quote orders',
  decline: 'Decline orders',
  edit_shipping: 'Edit shipping',
  edit_materials: 'Edit materials',
  manage_team: 'Manage team',
  edit_profile: 'Edit factory profile',
  view_stats: 'View statistics',
  manage_capacity: 'Manage capacity calendar',
};

export const ROLE_PERMISSIONS: Record<FactoryTeamRole, FactoryPermission[]> = {
  admin: [...ALL_FACTORY_PERMISSIONS],
  quoter: ['quote', 'decline', 'view_stats'],
  production: ['edit_shipping', 'edit_materials', 'manage_capacity', 'view_stats'],
  viewer: ['view_stats'],
};

export type FactoryTeamMember = {
  id: string;
  name: string;
  email: string;
  role: FactoryTeamRole;
  lastActive: string;
  status: 'active' | 'invited';
  /** If set, replaces role defaults for this person. */
  permissions?: FactoryPermission[];
};

export type CapacityWeekBlock = {
  /** ISO date for Monday of the week (YYYY-MM-DD) */
  weekStart: string;
  full: boolean;
  note?: string;
};

export type FactoryHolidayStatus = 'approved' | 'pending' | 'declined';

export type FactoryHoliday = {
  id: string;
  /** ISO start date (YYYY-MM-DD). For week scope, Monday of the week. */
  date: string;
  name: string;
  scope: 'day' | 'week' | 'range';
  /**
   * For scope `range`: consecutive days from `date` (inclusive).
   * e.g. days: 3 from Mon = Mon–Wed.
   */
  days?: number;
  /** fixed = standard factory holidays; custom = requested / added by the team */
  source: 'fixed' | 'custom';
  /** Custom time-off needs Ceriga superadmin approval before it blocks capacity. */
  status: FactoryHolidayStatus;
  note?: string;
  requestedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

/** Inclusive end date ISO for a holiday. */
export function holidayEndDate(h: Pick<FactoryHoliday, 'date' | 'scope' | 'days'>): string {
  if (h.scope === 'day') return h.date;
  const start = new Date(h.date + 'T12:00:00');
  if (h.scope === 'week') {
    start.setDate(start.getDate() + 6);
    return start.toISOString().slice(0, 10);
  }
  const n = Math.max(1, h.days ?? 1);
  start.setDate(start.getDate() + (n - 1));
  return start.toISOString().slice(0, 10);
}

export function holidayCoversDate(
  h: Pick<FactoryHoliday, 'date' | 'scope' | 'days'>,
  iso: string,
): boolean {
  if (h.scope === 'day') return h.date === iso;
  if (h.scope === 'week') {
    return mondayOf(new Date(iso + 'T12:00:00')) === h.date;
  }
  const end = holidayEndDate(h);
  return iso >= h.date && iso <= end;
}

export type FactoryOrderStatus =
  | 'new'
  | 'reviewing'
  | 'clarifying'
  | 'quoted'
  | 'rejected'
  | 'in_production'
  | 'completed';

export type FactoryQuoteTierDraft = {
  id: string;
  kind: 'sample' | 'bulk';
  label: string;
  totalUnits: number;
  factoryCostCents: number;
  deliveryOptionId: DeliveryOptionId;
  leadTimeDays: number;
  /** Selected Ceriga-onboarded carrier (from factory shipping setup). */
  shippingCarrierId?: string;
  shippingMode?: ShippingMode;
  incoterm?: Incoterm;
  /** Optional shipping quotation for this tier. */
  shippingQuoteCents?: number;
};

export type ClarificationMessage = {
  id: string;
  from: 'factory' | 'brand' | 'ceriga';
  text: string;
  at: string;
};

export type FactoryOrder = {
  id: string;
  brandName: string;
  brandEmail: string;
  productName: string;
  garmentType: FactoryGarment;
  status: FactoryOrderStatus;
  assignedAt: string;
  dueQuoteBy: string;
  deliveryCountry: string;
  deliveryCity: string;
  /** Full delivery contact + address from brand Delivery step. */
  delivery?: OrderDeliveryInfo;
  orderQuantities: OrderQuantityPlan;
  techPackName: string;
  /** Openable tech pack (builder). */
  techPack?: OrderTechPackLink;
  fabricNotes: string;
  specialRequirements: string[];
  /** Brand-facing Q&A thread (legacy — UI no longer surfaces Ask the brand) */
  clarifications: ClarificationMessage[];
  quoteTiers?: FactoryQuoteTierDraft[];
  rejectReason?: string;
  quotedAt?: string;
  capacityUnitsEstimate: number;
};

const BUILDER_PRODUCT_BY_GARMENT: Partial<Record<FactoryGarment, string>> = {
  Hoodies: 'hd-001',
  'T-shirts': 'ts-001',
  Sweatshirts: 'sw-001',
  Joggers: 'jg-001',
  'Zip-ups': 'zu-001',
  Outerwear: 'jk-001',
};

function ensureFactoryOrderExtras(order: FactoryOrder): FactoryOrder {
  if (order.delivery && order.techPack) {
    return {
      ...order,
      deliveryCity: order.delivery.city,
      deliveryCountry: order.delivery.country,
    };
  }
  const nameParts = order.brandName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? 'Brand';
  const lastName = nameParts.slice(1).join(' ') || 'Contact';
  const delivery =
    order.delivery ??
    mockDelivery({
      firstName,
      lastName,
      email: order.brandEmail,
      city: order.deliveryCity,
      country: order.deliveryCountry,
      phone: '+44 7700 900456',
      address1: '14 Commerce Street',
      address2: 'Goods-in',
      instructions:
        order.id === 'ord-1002'
          ? 'Call on arrival — loading bay at rear'
          : order.id === 'ord-m-204'
            ? 'Deliver Mon–Fri 9–17 only'
            : undefined,
    });
  const techPack =
    order.techPack ??
    ({
      id: `tp-${order.id}`,
      name: order.techPackName,
      garmentType: order.garmentType,
      builderProductId: BUILDER_PRODUCT_BY_GARMENT[order.garmentType] ?? 'hd-001',
      projectId: `proj-${order.id}`,
      exportFormat: 'pdf',
      pageCount: 10,
    } satisfies OrderTechPackLink);

  return {
    ...order,
    delivery,
    techPack,
    deliveryCity: delivery.city,
    deliveryCountry: delivery.country,
  };
}

export type CerigaThreadMessage = {
  id: string;
  from: 'factory' | 'ceriga';
  text: string;
  at: string;
};

export type FactoryChatAttachment = {
  kind: 'image' | 'file';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
};

export type FactoryChatMessage = {
  id: string;
  from: 'factory' | 'contact';
  text: string;
  at: string;
  attachments?: FactoryChatAttachment[];
};

export type FactoryChatThread = {
  id: string;
  /** Manufacturers may only message Ceriga ops or Ceriga workers — never brands. */
  type: 'ceriga' | 'worker';
  name: string;
  subtitle: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  workerId?: string;
  messages: FactoryChatMessage[];
};

export type FactoryMaterialKind = 'fabric' | 'trim' | 'packaging' | 'other';

export type FactoryMaterialUnit = 'metres' | 'kg' | 'rolls' | 'units' | 'cones';

export type FactoryMaterial = {
  id: string;
  name: string;
  kind: FactoryMaterialKind;
  colour?: string;
  /** Weight for fabrics (g/m²). */
  gsm?: number;
  quantity: number;
  unit: FactoryMaterialUnit;
  /** Alert when quantity is at or below this. */
  reorderAt: number;
  supplier?: string;
  /** Simple shelf / bay note — not a full WMS location. */
  location?: string;
  notes?: string;
  updatedAt: string;
};

export const FACTORY_MATERIAL_KIND_LABEL: Record<FactoryMaterialKind, string> = {
  fabric: 'Fabric',
  trim: 'Trim',
  packaging: 'Packaging',
  other: 'Other',
};

export const FACTORY_MATERIAL_UNITS: FactoryMaterialUnit[] = [
  'metres',
  'kg',
  'rolls',
  'units',
  'cones',
];

export type FactoryWorkspace = {
  factoryId: string;
  factoryName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  addressLine?: string;
  typicalLeadDays?: number;
  onboardingComplete: boolean;
  garments: FactoryGarment[];
  capabilities: FactoryCapability[];
  shippingRegions: string[];
  moq: number;
  monthlyCapacity: number;
  team: FactoryTeamMember[];
  orders: FactoryOrder[];
  materials: FactoryMaterial[];
  shipping: FactoryShippingPrefs;
  shipments: FactoryShipment[];
  /** Weeks marked full so Ceriga should not over-assign. */
  capacityBlocks: CapacityWeekBlock[];
  /** Public / factory holidays (seeded fixed + custom). */
  holidays: FactoryHoliday[];
  /** Legacy single Ceriga feed — kept in sync with the ceriga message thread. */
  cerigaMessages: CerigaThreadMessage[];
  /** Multi-thread inbox (Ceriga ops + Ceriga workers only). */
  messageThreads: FactoryChatThread[];
  internalNotes: string;
};

export const FACTORY_SHIPPING_REGION_OPTIONS = [
  'UK',
  'EU',
  'US',
  'CA',
  'AU',
  'Middle East',
  'Asia',
] as const;

const ROLE_LABELS: Record<FactoryTeamRole, string> = {
  admin: 'Factory admin',
  quoter: 'Quoting',
  production: 'Production',
  viewer: 'Viewer',
};

export function factoryRoleLabel(role: FactoryTeamRole): string {
  return ROLE_LABELS[role];
}

function samplePlan(bulkTiers: number[]): OrderQuantityPlan {
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

const STORAGE_KEY = 'ceriga_factory_workspace_v7';

function seedCapacityBlocks(): CapacityWeekBlock[] {
  return [
    { weekStart: '2026-04-20', full: true, note: 'Easter shutdown' },
    { weekStart: '2026-05-25', full: true, note: 'Machine maintenance' },
  ];
}

/** Standard holidays factories always carry — UK bank holidays + Christmas shutdown. */
function seedFixedHolidays(): FactoryHoliday[] {
  const rows: Array<Omit<FactoryHoliday, 'id' | 'source' | 'status'>> = [
    // 2025
    { date: '2025-01-01', name: "New Year's Day", scope: 'day' },
    { date: '2025-04-18', name: 'Good Friday', scope: 'day' },
    { date: '2025-04-21', name: 'Easter Monday', scope: 'day' },
    { date: '2025-05-05', name: 'Early May bank holiday', scope: 'day' },
    { date: '2025-05-26', name: 'Spring bank holiday', scope: 'day' },
    { date: '2025-08-25', name: 'Summer bank holiday', scope: 'day' },
    { date: '2025-12-25', name: 'Christmas Day', scope: 'day' },
    { date: '2025-12-26', name: 'Boxing Day', scope: 'day' },
    { date: '2025-12-22', name: 'Christmas shutdown', scope: 'week', note: 'Factory closed' },
    // 2026
    { date: '2026-01-01', name: "New Year's Day", scope: 'day' },
    { date: '2026-04-03', name: 'Good Friday', scope: 'day' },
    { date: '2026-04-06', name: 'Easter Monday', scope: 'day' },
    { date: '2026-05-04', name: 'Early May bank holiday', scope: 'day' },
    { date: '2026-05-25', name: 'Spring bank holiday', scope: 'day' },
    { date: '2026-08-31', name: 'Summer bank holiday', scope: 'day' },
    { date: '2026-12-25', name: 'Christmas Day', scope: 'day' },
    { date: '2026-12-28', name: 'Boxing Day (substitute)', scope: 'day' },
    { date: '2026-12-21', name: 'Christmas shutdown', scope: 'week', note: 'Factory closed' },
    // 2027
    { date: '2027-01-01', name: "New Year's Day", scope: 'day' },
    { date: '2027-03-26', name: 'Good Friday', scope: 'day' },
    { date: '2027-03-29', name: 'Easter Monday', scope: 'day' },
    { date: '2027-05-03', name: 'Early May bank holiday', scope: 'day' },
    { date: '2027-05-31', name: 'Spring bank holiday', scope: 'day' },
    { date: '2027-08-30', name: 'Summer bank holiday', scope: 'day' },
    { date: '2027-12-27', name: 'Christmas Day (substitute)', scope: 'day' },
    { date: '2027-12-28', name: 'Boxing Day (substitute)', scope: 'day' },
    { date: '2027-12-20', name: 'Christmas shutdown', scope: 'week', note: 'Factory closed' },
  ];
  return rows.map((r, i) => ({
    ...r,
    id: `hol-fixed-${i + 1}`,
    source: 'fixed' as const,
    status: 'approved' as const,
  }));
}

function seedHolidays(): FactoryHoliday[] {
  return [
    ...seedFixedHolidays(),
    {
      id: 'hol-custom-1',
      date: '2026-07-20',
      name: 'Summer factory fortnight (start)',
      scope: 'week',
      source: 'custom',
      status: 'approved',
      note: 'Annual summer break — week 1',
      requestedAt: '2026-05-01',
      reviewedAt: '2026-05-03',
    },
    {
      id: 'hol-custom-2',
      date: '2026-07-27',
      name: 'Summer factory fortnight (end)',
      scope: 'week',
      source: 'custom',
      status: 'approved',
      note: 'Annual summer break — week 2',
      requestedAt: '2026-05-01',
      reviewedAt: '2026-05-03',
    },
    {
      id: 'hol-custom-pending-1',
      date: '2026-09-07',
      name: 'Machinery upgrade week',
      scope: 'week',
      source: 'custom',
      status: 'pending',
      note: 'Need floor clear for new cutter install',
      requestedAt: '2026-07-10',
    },
  ];
}

/** Monday (UTC-safe local) for a given date. */
export function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function listUpcomingWeeks(count = 16, from = new Date()): string[] {
  const start = mondayOf(from);
  const weeks: string[] = [];
  const cursor = new Date(start + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    weeks.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function seedMaterials(): FactoryMaterial[] {
  const today = '2026-04-12';
  return [
    {
      id: 'mat-1',
      name: 'Organic fleece — brushed',
      kind: 'fabric',
      colour: 'Heather grey',
      gsm: 380,
      quantity: 420,
      unit: 'metres',
      reorderAt: 80,
      supplier: 'Pennine Textiles',
      location: 'Bay A / roll rack 2',
      notes: 'Prefer for Acme hoodie runs',
      updatedAt: today,
    },
    {
      id: 'mat-2',
      name: 'French terry',
      kind: 'fabric',
      colour: 'Black',
      gsm: 320,
      quantity: 65,
      unit: 'metres',
      reorderAt: 100,
      supplier: 'Pennine Textiles',
      location: 'Bay A / roll rack 1',
      updatedAt: today,
    },
    {
      id: 'mat-3',
      name: 'Cotton twill',
      kind: 'fabric',
      colour: 'Navy',
      gsm: 280,
      quantity: 210,
      unit: 'metres',
      reorderAt: 60,
      supplier: 'Leeds Mill Supply',
      location: 'Bay B',
      updatedAt: '2026-04-10',
    },
    {
      id: 'mat-4',
      name: '1x1 cotton rib',
      kind: 'trim',
      colour: 'Matching body',
      quantity: 18,
      unit: 'kg',
      reorderAt: 25,
      supplier: 'TrimCo UK',
      location: 'Trim cage',
      notes: 'Check colour lot before cut',
      updatedAt: today,
    },
    {
      id: 'mat-5',
      name: 'YKK #5 metal zip',
      kind: 'trim',
      colour: 'Antique brass',
      quantity: 2400,
      unit: 'units',
      reorderAt: 500,
      supplier: 'YKK distributor',
      location: 'Trim cage / drawer 4',
      updatedAt: '2026-04-08',
    },
    {
      id: 'mat-6',
      name: 'Woven neck label',
      kind: 'trim',
      colour: 'Black / white',
      quantity: 8500,
      unit: 'units',
      reorderAt: 2000,
      supplier: 'Labelprint',
      location: 'Pack room',
      updatedAt: '2026-04-05',
    },
    {
      id: 'mat-7',
      name: 'Polybag — size pack',
      kind: 'packaging',
      quantity: 320,
      unit: 'units',
      reorderAt: 400,
      supplier: 'PackRight',
      location: 'Pack room / shelf C',
      updatedAt: today,
    },
    {
      id: 'mat-8',
      name: 'Polyester core-spun thread',
      kind: 'other',
      colour: 'Black',
      quantity: 42,
      unit: 'cones',
      reorderAt: 15,
      supplier: 'Coats',
      location: 'Sewing floor',
      updatedAt: '2026-04-11',
    },
  ];
}

function seedWorkspace(): FactoryWorkspace {
  return {
    factoryId: 'm1',
    factoryName: 'North Mills',
    contactName: 'James Hale',
    contactEmail: 'ops@northmills.io',
    contactPhone: '+44 161 555 0142',
    website: 'https://northmills.io',
    addressLine: 'Unit 4, Ancoats Mill, Manchester M4 5DL',
    typicalLeadDays: 21,
    onboardingComplete: true,
    garments: ['Hoodies', 'Sweatshirts', 'Zip-ups', 'Joggers'],
    capabilities: ['Cut & sew', 'DTG', 'Embroidery', 'Garment wash / fade'],
    shippingRegions: ['UK', 'EU', 'US'],
    moq: 50,
    monthlyCapacity: 4200,
    internalNotes: 'Prefer midweight fleece. Confirm rib colours before cut.',
    materials: seedMaterials(),
    shipping: seedFactoryShippingPrefs(),
    shipments: seedFactoryShipments(),
    capacityBlocks: seedCapacityBlocks(),
    holidays: seedHolidays(),
    team: [
      {
        id: 'tm1',
        name: 'James Hale',
        email: 'ops@northmills.io',
        role: 'admin',
        lastActive: '2026-04-12',
        status: 'active',
      },
      {
        id: 'tm2',
        name: 'Priya Shah',
        email: 'quotes@northmills.io',
        role: 'quoter',
        lastActive: '2026-04-12',
        status: 'active',
        // Custom override: quote + decline + shipping (beyond quoter defaults)
        permissions: ['quote', 'decline', 'edit_shipping', 'view_stats'],
      },
      {
        id: 'tm3',
        name: 'Tom Reed',
        email: 'floor@northmills.io',
        role: 'production',
        lastActive: '2026-04-11',
        status: 'active',
      },
      {
        id: 'tm4',
        name: 'Sara Nguyen',
        email: 'sara.n@northmills.io',
        role: 'viewer',
        lastActive: '2026-04-08',
        status: 'invited',
      },
    ],
    orders: [
      {
        id: 'ord-1002',
        brandName: 'Acme Clothing',
        brandEmail: 'hello@acme.com',
        productName: 'Oversized hoodie run',
        garmentType: 'Hoodies',
        status: 'new',
        assignedAt: '2026-04-05',
        dueQuoteBy: '2026-04-08',
        deliveryCountry: 'UK',
        deliveryCity: 'Manchester',
        orderQuantities: samplePlan([100, 250, 500]),
        techPackName: 'Oversized hoodie — production spec',
        fabricNotes: '380gsm organic fleece, brushed inside',
        specialRequirements: ['Woven neck label', 'Care label UK', 'Polybag size pack'],
        clarifications: [],
        capacityUnitsEstimate: 250,
      },
      {
        id: 'ord-1012',
        brandName: 'Urban Layer Ltd',
        brandEmail: 'studio@urbanlayer.uk',
        productName: 'Workwear trouser run',
        garmentType: 'Joggers',
        status: 'clarifying',
        assignedAt: '2026-04-09',
        dueQuoteBy: '2026-04-12',
        deliveryCountry: 'UK',
        deliveryCity: 'Leeds',
        orderQuantities: samplePlan([50, 100, 180]),
        techPackName: 'Workwear trouser tech pack',
        fabricNotes: 'Cotton twill 280gsm, contrast stitching',
        specialRequirements: ['Bartacks at stress points', 'YKK zip fly'],
        clarifications: [
          {
            id: 'c1',
            from: 'factory',
            text: 'Can you confirm if the contrast stitch is black or matching body for the 180 unit run?',
            at: '2026-04-10T09:12:00Z',
          },
          {
            id: 'c2',
            from: 'brand',
            text: 'Matching body on bulk — black contrast only on samples.',
            at: '2026-04-10T14:40:00Z',
          },
        ],
        capacityUnitsEstimate: 180,
      },
      {
        id: 'ord-m-204',
        brandName: 'Blank Collective',
        brandEmail: 'orders@blankcollective.com',
        productName: 'Heavyweight zip-up capsule',
        garmentType: 'Zip-ups',
        status: 'quoted',
        assignedAt: '2026-03-28',
        dueQuoteBy: '2026-03-31',
        deliveryCountry: 'DE',
        deliveryCity: 'Berlin',
        orderQuantities: samplePlan([75, 150]),
        techPackName: 'Zip-up capsule v2',
        fabricNotes: 'French terry 320gsm',
        specialRequirements: ['Embroidery left chest', 'Hangtag'],
        clarifications: [],
        quotedAt: '2026-03-30',
        quoteTiers: [
          {
            id: 'sample',
            kind: 'sample',
            label: 'Sample',
            totalUnits: 6,
            factoryCostCents: 26800,
            deliveryOptionId: 'express',
            leadTimeDays: 12,
          },
          {
            id: 'bulk-1',
            kind: 'bulk',
            label: 'Bulk 1',
            totalUnits: 75,
            factoryCostCents: 142000,
            deliveryOptionId: 'standard',
            leadTimeDays: 21,
          },
          {
            id: 'bulk-2',
            kind: 'bulk',
            label: 'Bulk 2',
            totalUnits: 150,
            factoryCostCents: 255000,
            deliveryOptionId: 'standard',
            leadTimeDays: 24,
          },
        ],
        capacityUnitsEstimate: 150,
      },
      {
        id: 'ord-m-188',
        brandName: 'Threadline Apparel',
        brandEmail: 'team@threadline.co',
        productName: 'Acid-wash hoodie test',
        garmentType: 'Hoodies',
        status: 'rejected',
        assignedAt: '2026-03-12',
        dueQuoteBy: '2026-03-15',
        deliveryCountry: 'UK',
        deliveryCity: 'Bristol',
        orderQuantities: samplePlan([200]),
        techPackName: 'Acid wash hoodie',
        fabricNotes: 'Chemical wash process required',
        specialRequirements: ['Heavy acid wash'],
        clarifications: [],
        rejectReason: 'We do not currently run chemical acid-wash at MOQ 200 — partner recommened via Ceriga.',
        capacityUnitsEstimate: 200,
      },
      {
        id: 'ord-m-210',
        brandName: 'Acme Clothing',
        brandEmail: 'hello@acme.com',
        productName: 'Crewneck sweat restock',
        garmentType: 'Sweatshirts',
        status: 'in_production',
        assignedAt: '2026-03-01',
        dueQuoteBy: '2026-03-04',
        deliveryCountry: 'UK',
        deliveryCity: 'London',
        orderQuantities: samplePlan([300]),
        techPackName: 'Crewneck restock',
        fabricNotes: 'Brushed fleece 360gsm',
        specialRequirements: ['Same trim as PO-228'],
        clarifications: [],
        quotedAt: '2026-03-03',
        quoteTiers: [
          {
            id: 'sample',
            kind: 'sample',
            label: 'Sample',
            totalUnits: 6,
            factoryCostCents: 21000,
            deliveryOptionId: 'standard',
            leadTimeDays: 14,
          },
          {
            id: 'bulk-1',
            kind: 'bulk',
            label: 'Bulk 1',
            totalUnits: 300,
            factoryCostCents: 410000,
            deliveryOptionId: 'economy',
            leadTimeDays: 32,
          },
        ],
        capacityUnitsEstimate: 300,
      },
      {
        id: 'ord-m-172',
        brandName: 'Urban Layer Ltd',
        brandEmail: 'studio@urbanlayer.uk',
        productName: 'Jogger first drop',
        garmentType: 'Joggers',
        status: 'completed',
        assignedAt: '2026-01-20',
        dueQuoteBy: '2026-01-24',
        deliveryCountry: 'UK',
        deliveryCity: 'Manchester',
        orderQuantities: samplePlan([120]),
        techPackName: 'Jogger drop 1',
        fabricNotes: 'Loopback 300gsm',
        specialRequirements: [],
        clarifications: [],
        quotedAt: '2026-01-23',
        capacityUnitsEstimate: 120,
      },
    ],
    cerigaMessages: [
      {
        id: 'msg1',
        from: 'ceriga',
        text: 'Hi James — we assigned Acme oversized hoodie (ord-1002). Quote due in 3 days.',
        at: '2026-04-05T10:00:00Z',
      },
      {
        id: 'msg2',
        from: 'factory',
        text: 'Received. We can cover fleece + DTG. Checking rib inventory today.',
        at: '2026-04-05T11:22:00Z',
      },
      {
        id: 'msg3',
        from: 'ceriga',
        text: 'Urban Layer trousers are in clarifying — brand replied about stitch colour.',
        at: '2026-04-10T15:02:00Z',
      },
    ],
    messageThreads: seedFactoryMessageThreads(),
  };
}

function formatThreadTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function seedFactoryMessageThreads(): FactoryChatThread[] {
  const cerigaMsgs: FactoryChatMessage[] = [
    {
      id: 'msg1',
      from: 'contact',
      text: 'Hi James — we assigned Acme oversized hoodie (ord-1002). Quote due in 3 days.',
      at: formatThreadTime('2026-04-05T10:00:00Z'),
    },
    {
      id: 'msg2',
      from: 'factory',
      text: 'Received. We can cover fleece + DTG. Checking rib inventory today.',
      at: formatThreadTime('2026-04-05T11:22:00Z'),
    },
    {
      id: 'msg3',
      from: 'contact',
      text: 'Urban Layer trousers are in clarifying — brand replied about stitch colour.',
      at: formatThreadTime('2026-04-10T15:02:00Z'),
    },
  ];
  return [
    {
      id: 'fmt-ceriga',
      type: 'ceriga',
      name: 'Ceriga operations',
      subtitle: 'Assignments · SLAs · capacity',
      lastMessage: cerigaMsgs[cerigaMsgs.length - 1]?.text ?? '',
      lastAt: cerigaMsgs[cerigaMsgs.length - 1]?.at ?? '',
      unread: 1,
      messages: cerigaMsgs,
    },
    {
      id: 'fmt-worker-maya',
      type: 'worker',
      name: 'Maya Chen',
      subtitle: 'Ceriga worker · Tech packs',
      workerId: 'u8',
      lastMessage: 'I’ve flagged the rib gauge note on ord-1002 for the brand.',
      lastAt: '11 Apr, 09:18',
      unread: 1,
      messages: [
        {
          id: 'maya-1',
          from: 'factory',
          text: 'Maya — can you confirm the rib gauge Ceriga wants on the Acme hoodie?',
          at: '10 Apr, 16:05',
        },
        {
          id: 'maya-2',
          from: 'contact',
          text: '3.5 mm cotton rib, same as the February swatch. I’ll note it on the pack.',
          at: '10 Apr, 16:40',
        },
        {
          id: 'maya-3',
          from: 'contact',
          text: 'I’ve flagged the rib gauge note on ord-1002 for the brand.',
          at: '11 Apr, 09:18',
        },
      ],
    },
    {
      id: 'fmt-worker-james',
      type: 'worker',
      name: 'James Okonkwo',
      subtitle: 'Ceriga worker · Production QA',
      workerId: 'u10',
      lastMessage: 'Sounds good — I’ll keep the QC checklist aligned.',
      lastAt: '9 Apr, 14:22',
      unread: 0,
      messages: [
        {
          id: 'james-1',
          from: 'contact',
          text: 'Hi — when you start the Urban Layer trousers, send photos of the first size set.',
          at: '9 Apr, 11:10',
        },
        {
          id: 'james-2',
          from: 'factory',
          text: 'Will do once cut is signed off. Expect Monday.',
          at: '9 Apr, 13:55',
        },
        {
          id: 'james-3',
          from: 'contact',
          text: 'Sounds good — I’ll keep the QC checklist aligned.',
          at: '9 Apr, 14:22',
        },
      ],
    },
  ];
}

function isCerigaFacingThread(t: FactoryChatThread): boolean {
  return t.type === 'ceriga' || t.type === 'worker';
}

function threadsFromCerigaMessages(messages: CerigaThreadMessage[]): FactoryChatThread[] {
  const mapped: FactoryChatMessage[] = messages.map((m) => ({
    id: m.id,
    from: m.from === 'factory' ? 'factory' : 'contact',
    text: m.text,
    at: formatThreadTime(m.at),
  }));
  const last = mapped[mapped.length - 1];
  const workerSeed = seedFactoryMessageThreads().filter((t) => t.type === 'worker');
  return [
    {
      id: 'fmt-ceriga',
      type: 'ceriga',
      name: 'Ceriga operations',
      subtitle: 'Assignments · SLAs · capacity',
      lastMessage: last?.text ?? '',
      lastAt: last?.at ?? '',
      unread: 0,
      messages: mapped,
    },
    ...workerSeed,
  ];
}

function sanitizeFactoryMessageThreads(
  threads: FactoryChatThread[] | undefined,
  cerigaMessages: CerigaThreadMessage[],
): FactoryChatThread[] {
  const allowed = (threads ?? []).filter(isCerigaFacingThread);
  const hasCeriga = allowed.some((t) => t.id === 'fmt-ceriga' || t.type === 'ceriga');
  const hasWorkers = allowed.some((t) => t.type === 'worker');
  if (hasCeriga && hasWorkers) return allowed;
  // Migrate older brand-only or incomplete inboxes
  const seeded = threadsFromCerigaMessages(cerigaMessages);
  if (!hasCeriga) return seeded;
  const workers = seeded.filter((t) => t.type === 'worker');
  return [...allowed, ...workers.filter((w) => !allowed.some((a) => a.id === w.id))];
}

function loadWorkspace(): FactoryWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FactoryWorkspace;
      if (!parsed.materials?.length) {
        parsed.materials = seedMaterials();
      }
      if (!parsed.shipping?.carriers?.length) {
        parsed.shipping = seedFactoryShippingPrefs();
      }
      if (!parsed.shipments) {
        parsed.shipments = seedFactoryShipments();
      }
      if (!parsed.capacityBlocks) {
        parsed.capacityBlocks = seedCapacityBlocks();
      }
      if (!parsed.holidays?.length) {
        parsed.holidays = seedHolidays();
      } else {
        // Ensure fixed holidays stay present even if an older session wiped them
        const fixed = seedFixedHolidays();
        const custom = parsed.holidays
          .filter((h) => h.source === 'custom')
          .map((h) => ({
            ...h,
            status: h.status ?? ('approved' as FactoryHolidayStatus),
          }));
        const haveFixed = new Set(
          parsed.holidays.filter((h) => h.source === 'fixed').map((h) => `${h.date}|${h.name}`),
        );
        const missingFixed = fixed.filter((h) => !haveFixed.has(`${h.date}|${h.name}`));
        parsed.holidays = [
          ...parsed.holidays
            .filter((h) => h.source === 'fixed')
            .map((h) => ({ ...h, status: 'approved' as const })),
          ...missingFixed,
          ...custom,
        ];
      }
      if (!parsed.messageThreads?.length) {
        parsed.messageThreads = threadsFromCerigaMessages(parsed.cerigaMessages ?? []);
      } else {
        parsed.messageThreads = sanitizeFactoryMessageThreads(
          parsed.messageThreads as FactoryChatThread[],
          parsed.cerigaMessages ?? [],
        );
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return seedWorkspace();
}

let workspace: FactoryWorkspace = typeof window !== 'undefined' ? loadWorkspace() : seedWorkspace();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    /* ignore */
  }
}

export function getFactoryWorkspace(): FactoryWorkspace {
  return workspace;
}

export function resetFactoryWorkspace(): FactoryWorkspace {
  workspace = seedWorkspace();
  persist();
  return workspace;
}

export function updateFactoryWorkspace(
  patch: Partial<
    Omit<
      FactoryWorkspace,
      'orders' | 'team' | 'cerigaMessages' | 'materials' | 'shipping' | 'shipments' | 'capacityBlocks' | 'holidays'
    >
  >,
): FactoryWorkspace {
  workspace = { ...workspace, ...patch };
  persist();
  return workspace;
}

export function completeFactoryOnboarding(input: {
  garments: FactoryGarment[];
  capabilities: FactoryCapability[];
  shippingRegions: string[];
  moq: number;
  monthlyCapacity: number;
}): FactoryWorkspace {
  workspace = {
    ...workspace,
    ...input,
    onboardingComplete: true,
  };
  persist();
  return workspace;
}

export function listFactoryOrders(status?: FactoryOrderStatus | 'all'): FactoryOrder[] {
  const orders = [...workspace.orders]
    .map(ensureFactoryOrderExtras)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  if (!status || status === 'all') return orders;
  return orders.filter((o) => o.status === status);
}

export function getFactoryOrder(id: string): FactoryOrder | undefined {
  const order = workspace.orders.find((o) => o.id === id);
  return order ? ensureFactoryOrderExtras(order) : undefined;
}

export function isMaterialLowStock(m: FactoryMaterial): boolean {
  return m.quantity <= m.reorderAt;
}

export function listFactoryMaterials(kind?: FactoryMaterialKind | 'all'): FactoryMaterial[] {
  const materials = [...(workspace.materials ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (!kind || kind === 'all') return materials;
  return materials.filter((m) => m.kind === kind);
}

export function getFactoryMaterialsSummary() {
  const materials = listFactoryMaterials();
  return {
    total: materials.length,
    lowStock: materials.filter(isMaterialLowStock).length,
    fabric: materials.filter((m) => m.kind === 'fabric').length,
    trim: materials.filter((m) => m.kind === 'trim').length,
    packaging: materials.filter((m) => m.kind === 'packaging').length,
  };
}

export function addFactoryMaterial(
  input: Omit<FactoryMaterial, 'id' | 'updatedAt'>,
): FactoryMaterial {
  const material: FactoryMaterial = {
    ...input,
    id: `mat-${Date.now()}`,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  workspace = {
    ...workspace,
    materials: [...(workspace.materials ?? []), material],
  };
  persist();
  return material;
}

export function updateFactoryMaterial(
  id: string,
  patch: Partial<Omit<FactoryMaterial, 'id'>>,
): FactoryMaterial | undefined {
  const idx = (workspace.materials ?? []).findIndex((m) => m.id === id);
  if (idx < 0) return undefined;
  const next: FactoryMaterial = {
    ...workspace.materials[idx],
    ...patch,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  workspace = {
    ...workspace,
    materials: workspace.materials.map((m, i) => (i === idx ? next : m)),
  };
  persist();
  return next;
}

export function adjustFactoryMaterialQuantity(
  id: string,
  delta: number,
): FactoryMaterial | undefined {
  const current = (workspace.materials ?? []).find((m) => m.id === id);
  if (!current) return undefined;
  return updateFactoryMaterial(id, {
    quantity: Math.max(0, Math.round((current.quantity + delta) * 100) / 100),
  });
}

export function removeFactoryMaterial(id: string): boolean {
  const before = workspace.materials?.length ?? 0;
  workspace = {
    ...workspace,
    materials: (workspace.materials ?? []).filter((m) => m.id !== id),
  };
  persist();
  return (workspace.materials?.length ?? 0) < before;
}

export function shippingModeToDeliveryOption(mode: ShippingMode): DeliveryOptionId {
  if (mode === 'sea' || mode === 'rail') return 'economy';
  if (mode === 'express') return 'express';
  return 'standard';
}

export function getFactoryShippingPrefs(): FactoryShippingPrefs {
  return workspace.shipping ?? seedFactoryShippingPrefs();
}

export function listEnabledShippingCarriers(): OnboardedShippingCarrier[] {
  const prefs = getFactoryShippingPrefs();
  return prefs.carriers
    .filter((c) => c.enabled)
    .map((c) => getShippingCarrier(c.carrierId))
    .filter((c): c is OnboardedShippingCarrier => Boolean(c && c.status === 'active'));
}

export function getFactoryCarrierSetup(carrierId: string): FactoryCarrierSetup | undefined {
  return getFactoryShippingPrefs().carriers.find((c) => c.carrierId === carrierId);
}

export function listFactoryShipments(): FactoryShipment[] {
  return [...(workspace.shipments ?? [])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getFactoryShipmentForOrder(orderId: string): FactoryShipment | undefined {
  return listFactoryShipments().find((s) => s.orderId === orderId);
}

export function createFactoryShipment(
  input: Omit<FactoryShipment, 'id' | 'updatedAt'> & { id?: string },
): FactoryShipment {
  const shipment: FactoryShipment = {
    ...input,
    id: input.id ?? `shp-${Date.now()}`,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  workspace = {
    ...workspace,
    shipments: [shipment, ...(workspace.shipments ?? [])],
  };
  persist();
  return shipment;
}

export function saveFactoryShippingPrefs(next: FactoryShippingPrefs): FactoryShippingPrefs {
  workspace = { ...workspace, shipping: next };
  persist();
  return next;
}

export function setFactoryCarrierEnabled(
  carrierId: string,
  enabled: boolean,
): FactoryShippingPrefs {
  const prefs = getFactoryShippingPrefs();
  const catalog = getShippingCarrier(carrierId);
  const existing = prefs.carriers.find((c) => c.carrierId === carrierId);
  let carriers: FactoryCarrierSetup[];
  if (existing) {
    carriers = prefs.carriers.map((c) =>
      c.carrierId === carrierId ? { ...c, enabled } : c,
    );
  } else if (catalog) {
    carriers = [
      ...prefs.carriers,
      {
        carrierId,
        enabled,
        enabledModes: [...catalog.supportedModes],
        enabledIncoterms: [...catalog.supportedIncoterms],
      },
    ];
  } else {
    carriers = prefs.carriers;
  }
  const next: FactoryShippingPrefs = {
    ...prefs,
    carriers,
    defaultCarrierId:
      enabled && !prefs.defaultCarrierId
        ? carrierId
        : prefs.defaultCarrierId === carrierId && !enabled
          ? carriers.find((c) => c.enabled)?.carrierId
          : prefs.defaultCarrierId,
  };
  return saveFactoryShippingPrefs(next);
}

export function updateFactoryCarrierSetup(
  carrierId: string,
  patch: Partial<Omit<FactoryCarrierSetup, 'carrierId'>>,
): FactoryShippingPrefs {
  const prefs = getFactoryShippingPrefs();
  const carriers = prefs.carriers.map((c) =>
    c.carrierId === carrierId ? { ...c, ...patch } : c,
  );
  if (!carriers.some((c) => c.carrierId === carrierId)) {
    const catalog = getShippingCarrier(carrierId);
    carriers.push({
      carrierId,
      enabled: true,
      enabledModes: patch.enabledModes ?? catalog?.supportedModes ?? ['express'],
      enabledIncoterms: patch.enabledIncoterms ?? catalog?.supportedIncoterms ?? ['DDP'],
      accountRef: patch.accountRef,
      notes: patch.notes,
    });
  }
  return saveFactoryShippingPrefs({ ...prefs, carriers });
}

export function setFactoryShippingDefaults(input: {
  defaultCarrierId?: string;
  defaultMode?: ShippingMode;
  defaultIncoterm?: Incoterm;
}): FactoryShippingPrefs {
  const prefs = getFactoryShippingPrefs();
  return saveFactoryShippingPrefs({ ...prefs, ...input });
}

/** Mock: request Ceriga to onboard a new shipping company. */
export function requestShippingCarrierOnboard(input: {
  name: string;
  modes: ShippingMode[];
  regions: string;
  notes?: string;
}): { ok: true; message: string } {
  submitShippingCarrierOnboardRequest({
    factoryId: workspace.factoryId,
    factoryName: workspace.factoryName,
    ...input,
  });
  return {
    ok: true,
    message:
      'Request sent to Ceriga. Once onboarded, this carrier will appear in your Shipping catalog.',
  };
}

export function updateFactoryShipment(
  id: string,
  patch: Partial<FactoryShipment>,
): FactoryShipment | undefined {
  const idx = (workspace.shipments ?? []).findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  const next = {
    ...workspace.shipments[idx],
    ...patch,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  workspace = {
    ...workspace,
    shipments: workspace.shipments.map((s, i) => (i === idx ? next : s)),
  };
  persist();
  return next;
}

export function updateFactoryOrder(
  id: string,
  patch: Partial<FactoryOrder>,
): FactoryOrder | undefined {
  const idx = workspace.orders.findIndex((o) => o.id === id);
  if (idx < 0) return undefined;
  const next = { ...workspace.orders[idx], ...patch };
  workspace = {
    ...workspace,
    orders: workspace.orders.map((o, i) => (i === idx ? next : o)),
  };
  persist();
  return next;
}

export function rejectFactoryOrder(id: string, reason: string): FactoryOrder | undefined {
  return updateFactoryOrder(id, {
    status: 'rejected',
    rejectReason: reason.trim(),
    quoteTiers: undefined,
  });
}

export function submitFactoryQuote(
  id: string,
  tiers: FactoryQuoteTierDraft[],
): FactoryOrder | undefined {
  return updateFactoryOrder(id, {
    status: 'quoted',
    quoteTiers: tiers,
    quotedAt: new Date().toISOString().slice(0, 10),
  });
}

export function addClarification(
  orderId: string,
  text: string,
  from: ClarificationMessage['from'] = 'factory',
): FactoryOrder | undefined {
  const order = getFactoryOrder(orderId);
  if (!order) return undefined;
  const msg: ClarificationMessage = {
    id: `cl-${Date.now()}`,
    from,
    text: text.trim(),
    at: new Date().toISOString(),
  };
  return updateFactoryOrder(orderId, {
    status: order.status === 'new' || order.status === 'reviewing' ? 'clarifying' : order.status,
    clarifications: [...order.clarifications, msg],
  });
}

export function inviteTeamMember(input: {
  name: string;
  email: string;
  role: FactoryTeamRole;
}): FactoryWorkspace {
  workspace = {
    ...workspace,
    team: [
      ...workspace.team,
      {
        id: `tm-${Date.now()}`,
        name: input.name.trim(),
        email: input.email.trim(),
        role: input.role,
        lastActive: new Date().toISOString().slice(0, 10),
        status: 'invited',
      },
    ],
  };
  persist();
  return workspace;
}

export function updateTeamMemberRole(id: string, role: FactoryTeamRole): FactoryWorkspace {
  workspace = {
    ...workspace,
    team: workspace.team.map((m) =>
      m.id === id
        ? {
            ...m,
            role,
            // Changing role resets custom overrides so defaults apply.
            permissions: undefined,
          }
        : m,
    ),
  };
  persist();
  return workspace;
}

export function memberPermissions(member: FactoryTeamMember): FactoryPermission[] {
  if (member.permissions && member.permissions.length > 0) {
    return member.permissions;
  }
  return [...ROLE_PERMISSIONS[member.role]];
}

export function memberHasPermission(
  member: FactoryTeamMember,
  permission: FactoryPermission,
): boolean {
  return memberPermissions(member).includes(permission);
}

/** Demo “signed-in” factory user — prefer first active admin. */
export function getActingFactoryMember(): FactoryTeamMember {
  const active = workspace.team.filter((m) => m.status === 'active');
  return (
    active.find((m) => m.role === 'admin') ??
    active[0] ??
    workspace.team[0]
  );
}

export function actingHasPermission(permission: FactoryPermission): boolean {
  return memberHasPermission(getActingFactoryMember(), permission);
}

export function updateTeamMemberPermissions(
  id: string,
  permissions: FactoryPermission[],
): FactoryWorkspace {
  workspace = {
    ...workspace,
    team: workspace.team.map((m) => (m.id === id ? { ...m, permissions: [...permissions] } : m)),
  };
  persist();
  return workspace;
}

export function resetTeamMemberPermissions(id: string): FactoryWorkspace {
  workspace = {
    ...workspace,
    team: workspace.team.map((m) =>
      m.id === id ? { ...m, permissions: undefined } : m,
    ),
  };
  persist();
  return workspace;
}

const QUOTE_OPEN_STATUSES: FactoryOrderStatus[] = ['new', 'reviewing', 'clarifying'];

export function isFactoryQuoteOverdue(
  order: FactoryOrder,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  return QUOTE_OPEN_STATUSES.includes(order.status) && order.dueQuoteBy < today;
}

export function bulkStartFactoryReview(ids: string[]): number {
  let count = 0;
  for (const id of ids) {
    const order = getFactoryOrder(id);
    if (!order || order.status !== 'new') continue;
    updateFactoryOrder(id, { status: 'reviewing' });
    count += 1;
  }
  return count;
}

export function factoryOrdersToCsv(orders: FactoryOrder[]): string {
  const header = [
    'id',
    'brand',
    'product',
    'garment',
    'status',
    'assignedAt',
    'dueQuoteBy',
    'overdue',
    'city',
    'country',
    'unitsEstimate',
  ];
  const rows = orders.map((o) =>
    [
      o.id,
      o.brandName,
      o.productName,
      o.garmentType,
      o.status,
      o.assignedAt,
      o.dueQuoteBy,
      isFactoryQuoteOverdue(o) ? 'yes' : 'no',
      o.deliveryCity,
      o.deliveryCountry,
      String(o.capacityUnitsEstimate),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function listCapacityBlocks(): CapacityWeekBlock[] {
  return [...(workspace.capacityBlocks ?? [])].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}

export function isCapacityWeekFull(weekStart: string): boolean {
  return (workspace.capacityBlocks ?? []).some((b) => b.weekStart === weekStart && b.full);
}

export function setCapacityWeekBlock(
  weekStart: string,
  full: boolean,
  note?: string,
): FactoryWorkspace {
  const existing = (workspace.capacityBlocks ?? []).filter((b) => b.weekStart !== weekStart);
  const next = full
    ? [...existing, { weekStart, full: true, note: note?.trim() || undefined }]
    : existing;
  workspace = { ...workspace, capacityBlocks: next.sort((a, b) => a.weekStart.localeCompare(b.weekStart)) };
  persist();
  return workspace;
}

export function updateCapacityWeekNote(weekStart: string, note: string): FactoryWorkspace {
  const blocks = workspace.capacityBlocks ?? [];
  const idx = blocks.findIndex((b) => b.weekStart === weekStart);
  if (idx < 0) {
    return setCapacityWeekBlock(weekStart, true, note);
  }
  workspace = {
    ...workspace,
    capacityBlocks: blocks.map((b, i) =>
      i === idx ? { ...b, note: note.trim() || undefined } : b,
    ),
  };
  persist();
  return workspace;
}

export function listFactoryHolidays(): FactoryHoliday[] {
  return [...(workspace.holidays ?? [])]
    .map((h) => ({
      ...h,
      status: h.status ?? (h.source === 'fixed' ? 'approved' : 'approved'),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function listApprovedHolidays(): FactoryHoliday[] {
  return listFactoryHolidays().filter((h) => h.status === 'approved');
}

export function listPendingTimeOffRequests(): FactoryHoliday[] {
  return listFactoryHolidays().filter((h) => h.source === 'custom' && h.status === 'pending');
}

export function getHolidaysOnDate(
  iso: string,
  opts?: { includePending?: boolean },
): FactoryHoliday[] {
  return listFactoryHolidays().filter((h) => {
    if (!holidayCoversDate(h, iso)) return false;
    if (h.status === 'declined') return false;
    if (h.status === 'pending') return opts?.includePending === true;
    return true;
  });
}

export function getHolidaysForWeek(
  weekStart: string,
  opts?: { includePending?: boolean },
): FactoryHoliday[] {
  return listFactoryHolidays().filter((h) => {
    if (h.status === 'declined') return false;
    if (h.status === 'pending' && !opts?.includePending) return false;
    if (h.scope === 'week') return h.date === weekStart;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + 'T12:00:00');
      d.setDate(d.getDate() + i);
      if (holidayCoversDate(h, d.toISOString().slice(0, 10))) return true;
    }
    return false;
  });
}

export function isHolidayDate(iso: string): boolean {
  return getHolidaysOnDate(iso).length > 0;
}

export function isHolidayWeek(weekStart: string): boolean {
  return listApprovedHolidays().some((h) => h.scope === 'week' && h.date === weekStart);
}

/** Factory requests time off — Ceriga superadmin must approve before it blocks the calendar. */
export function requestFactoryTimeOff(input: {
  date: string;
  name: string;
  scope: 'day' | 'week' | 'range';
  days?: number;
  note?: string;
}): FactoryHoliday {
  const date = input.scope === 'week' ? mondayOf(new Date(input.date + 'T12:00:00')) : input.date;
  const days =
    input.scope === 'range' ? Math.min(30, Math.max(2, Math.round(input.days ?? 2))) : undefined;
  const holiday: FactoryHoliday = {
    id: `hol-req-${Date.now()}`,
    date,
    name: input.name.trim() || 'Time off request',
    scope: input.scope,
    days,
    source: 'custom',
    status: 'pending',
    note: input.note?.trim() || undefined,
    requestedAt: new Date().toISOString().slice(0, 10),
  };
  workspace = {
    ...workspace,
    holidays: [...(workspace.holidays ?? []), holiday],
  };
  persist();
  return holiday;
}

/** @deprecated use requestFactoryTimeOff */
export function addFactoryHoliday(input: {
  date: string;
  name: string;
  scope: 'day' | 'week' | 'range';
  days?: number;
  note?: string;
}): FactoryHoliday {
  return requestFactoryTimeOff(input);
}

export function approveFactoryTimeOff(id: string, reviewNote?: string): FactoryWorkspace {
  workspace = {
    ...workspace,
    holidays: (workspace.holidays ?? []).map((h) =>
      h.id === id && h.source === 'custom'
        ? {
            ...h,
            status: 'approved' as const,
            reviewedAt: new Date().toISOString().slice(0, 10),
            reviewNote: reviewNote?.trim() || h.reviewNote,
          }
        : h,
    ),
  };
  persist();
  return workspace;
}

export function declineFactoryTimeOff(id: string, reviewNote?: string): FactoryWorkspace {
  workspace = {
    ...workspace,
    holidays: (workspace.holidays ?? []).map((h) =>
      h.id === id && h.source === 'custom'
        ? {
            ...h,
            status: 'declined' as const,
            reviewedAt: new Date().toISOString().slice(0, 10),
            reviewNote: reviewNote?.trim() || h.reviewNote,
          }
        : h,
    ),
  };
  persist();
  return workspace;
}

export function removeFactoryHoliday(id: string): FactoryWorkspace {
  const target = (workspace.holidays ?? []).find((h) => h.id === id);
  if (!target || target.source === 'fixed') {
    return workspace;
  }
  // Only pending/declined custom requests can be withdrawn by the factory
  if (target.status === 'approved') {
    return workspace;
  }
  workspace = {
    ...workspace,
    holidays: (workspace.holidays ?? []).filter((h) => h.id !== id),
  };
  persist();
  return workspace;
}

export function getFactoryTimeOffSummary() {
  const all = listFactoryHolidays().filter((h) => h.source === 'custom');
  return {
    factoryId: workspace.factoryId,
    factoryName: workspace.factoryName,
    pending: all.filter((h) => h.status === 'pending'),
    approved: all.filter((h) => h.status === 'approved'),
    declined: all.filter((h) => h.status === 'declined'),
  };
}

export type AnalyticsPeriodDays = 30 | 90;

export function factoryAnalyticsReportCsv(periodDays: AnalyticsPeriodDays): string {
  const a = getFactoryAnalytics(periodDays);
  const lines = [
    'metric,value',
    `period,${a.periodLabel}`,
    `factory,${a.profile.factoryName}`,
    `win_rate_pct,${a.kpis.winRate}`,
    `avg_quote_hours,${a.kpis.avgQuoteHours}`,
    `awaiting_quote,${a.kpis.awaitingQuote}`,
    `in_production,${a.kpis.inProduction}`,
    `completed,${a.kpis.completed}`,
    `declined,${a.kpis.rejected}`,
    `capacity_pct,${a.kpis.capacityPct}`,
    `on_time_pct,${a.kpis.onTimePct}`,
    `otif_pct,${a.kpis.otifPct}`,
    `active_brands,${a.kpis.activeBrands}`,
    `booked_value_gbp,${(a.kpis.bookedValueCents / 100).toFixed(2)}`,
    `low_stock_skus,${a.kpis.lowStock}`,
    `blocked_capacity_weeks,${(workspace.capacityBlocks ?? []).filter((b) => b.full).length}`,
  ];
  for (const p of a.pipeline) {
    lines.push(`pipeline_${p.status.replace(/\s+/g, '_').toLowerCase()},${p.count}`);
  }
  return lines.join('\n');
}

export function sendCerigaMessage(text: string): FactoryWorkspace {
  return sendFactoryThreadMessage('fmt-ceriga', text);
}

export function listFactoryMessageThreads(): FactoryChatThread[] {
  const sanitized = sanitizeFactoryMessageThreads(
    workspace.messageThreads,
    workspace.cerigaMessages ?? [],
  );
  if (
    sanitized.length !== workspace.messageThreads?.length ||
    sanitized.some((t, i) => t.id !== workspace.messageThreads?.[i]?.id)
  ) {
    workspace = { ...workspace, messageThreads: sanitized };
    persist();
  }
  return workspace.messageThreads;
}

export function sendFactoryThreadMessage(
  threadId: string,
  text: string,
  attachments?: FactoryChatAttachment[],
): FactoryWorkspace {
  const target = listFactoryMessageThreads().find((t) => t.id === threadId);
  if (!target || !isCerigaFacingThread(target)) {
    return workspace;
  }

  const nowIso = new Date().toISOString();
  const at = formatThreadTime(nowIso);
  const trimmed = text.trim();
  const msg: FactoryChatMessage = {
    id: `msg-${Date.now()}`,
    from: 'factory',
    text: trimmed,
    at,
    attachments: attachments?.length ? attachments : undefined,
  };

  const threads = listFactoryMessageThreads().map((t) => {
    if (t.id !== threadId) return t;
    return {
      ...t,
      messages: [...t.messages, msg],
      lastMessage: trimmed || (attachments?.[0]?.name ?? 'Attachment'),
      lastAt: at,
      unread: 0,
    };
  });

  const cerigaMessages =
    threadId === 'fmt-ceriga'
      ? [
          ...workspace.cerigaMessages,
          {
            id: msg.id,
            from: 'factory' as const,
            text: trimmed || (attachments?.[0]?.name ?? 'Attachment'),
            at: nowIso,
          },
        ]
      : workspace.cerigaMessages;

  workspace = {
    ...workspace,
    messageThreads: threads,
    cerigaMessages,
  };
  persist();
  return workspace;
}

export function markFactoryThreadRead(threadId: string): FactoryWorkspace {
  workspace = {
    ...workspace,
    messageThreads: listFactoryMessageThreads().map((t) =>
      t.id === threadId ? { ...t, unread: 0 } : t,
    ),
  };
  persist();
  return workspace;
}

export function factoryInboxStats() {
  const orders = workspace.orders;
  return {
    newCount: orders.filter((o) => o.status === 'new').length,
    clarifying: orders.filter((o) => o.status === 'clarifying').length,
    awaitingQuote: orders.filter((o) =>
      ['new', 'reviewing', 'clarifying'].includes(o.status),
    ).length,
    quoted: orders.filter((o) => o.status === 'quoted').length,
    inProduction: orders.filter((o) => o.status === 'in_production').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    rejected: orders.filter((o) => o.status === 'rejected').length,
    capacityUsed: orders
      .filter((o) => ['quoted', 'in_production'].includes(o.status))
      .reduce((s, o) => s + o.capacityUnitsEstimate, 0),
    capacityTotal: workspace.monthlyCapacity,
  };
}

export function factoryStatsSeries() {
  return getFactoryAnalytics(90).legacy;
}

/** Rich analytics payload for the manufacturer Statistics page. */
export function getFactoryAnalytics(periodDays: AnalyticsPeriodDays = 90) {
  const inbox = factoryInboxStats();
  const materials = workspace.materials ?? [];
  const lowStock = materials.filter((m) => m.quantity <= m.reorderAt).length;
  const periodLabel = periodDays === 30 ? 'Last 30 days' : 'Last 90 days';
  const monthTake = periodDays === 30 ? 2 : 4;
  const weekTake = periodDays === 30 ? 4 : 8;
  const scale = periodDays === 30 ? 0.38 : 1;

  const monthlyQuotesAll = [
    { m: 'Nov', quotes: 4, wins: 2, declines: 1, valueK: 18 },
    { m: 'Dec', quotes: 6, wins: 3, declines: 1, valueK: 27 },
    { m: 'Jan', quotes: 5, wins: 4, declines: 0, valueK: 31 },
    { m: 'Feb', quotes: 8, wins: 5, declines: 2, valueK: 44 },
    { m: 'Mar', quotes: 7, wins: 4, declines: 1, valueK: 38 },
    { m: 'Apr', quotes: 9, wins: 6, declines: 1, valueK: 52 },
  ];
  const monthlyQuotes = monthlyQuotesAll.slice(-monthTake);

  const quoteHoursAll = [
    { m: 'Nov', hours: 54 },
    { m: 'Dec', hours: 48 },
    { m: 'Jan', hours: 42 },
    { m: 'Feb', hours: 39 },
    { m: 'Mar', hours: 36 },
    { m: 'Apr', hours: 33 },
  ];
  const quoteHours = quoteHoursAll.slice(-monthTake);

  const garmentMix = workspace.garments.map((g, i) => ({
    name: g,
    value: 18 + i * 7,
    units: 120 + i * 85,
  }));

  const totalQuotes = monthlyQuotes.reduce((s, r) => s + r.quotes, 0);
  const totalWins = monthlyQuotes.reduce((s, r) => s + r.wins, 0);
  const totalDeclines = monthlyQuotes.reduce((s, r) => s + r.declines, 0);
  const winRate = Math.round((totalWins / Math.max(totalQuotes, 1)) * 100);
  const avgQuoteHours = Math.round(
    quoteHours.reduce((s, r) => s + r.hours, 0) / Math.max(quoteHours.length, 1),
  );

  const weeklyThroughputAll = [
    { w: 'W1', units: 180, quotes: 2 },
    { w: 'W2', units: 240, quotes: 3 },
    { w: 'W3', units: 210, quotes: 1 },
    { w: 'W4', units: 320, quotes: 4 },
    { w: 'W5', units: 280, quotes: 2 },
    { w: 'W6', units: 360, quotes: 3 },
    { w: 'W7', units: 310, quotes: 2 },
    { w: 'W8', units: 390, quotes: 4 },
  ];

  return {
    periodDays,
    periodLabel,
    legacy: { monthlyQuotes, quoteHours, garmentMix },
    kpis: {
      winRate,
      avgQuoteHours,
      completed: inbox.completed,
      rejected: inbox.rejected,
      inProduction: inbox.inProduction,
      awaitingQuote: inbox.awaitingQuote,
      capacityPct: Math.round(
        (inbox.capacityUsed / Math.max(inbox.capacityTotal, 1)) * 100,
      ),
      capacityUsed: inbox.capacityUsed,
      capacityTotal: inbox.capacityTotal,
      bookedValueCents: Math.round(4120000 * scale),
      bookedValueDelta:
        periodDays === 30 ? '+6% vs prior 30d' : '+14% vs prior 90d',
      onTimePct: 94,
      otifPct: 91,
      activeBrands: periodDays === 30 ? 4 : 7,
      repeatBrandPct: 62,
      avgLeadDays: 22,
      quotedLeadDays: 24,
      lowStock,
      defectRatePct: 1.4,
      teamActive: workspace.team.filter((t) => t.status === 'active').length,
    },
    monthlyQuotes,
    quoteHours,
    quoteValue: monthlyQuotes.map((r) => ({ m: r.m, valueK: r.valueK, wins: r.wins })),
    weeklyThroughput: weeklyThroughputAll.slice(-weekTake),
    pipeline: [
      { status: 'Awaiting quote', count: inbox.awaitingQuote, fill: '#38BDF8' },
      { status: 'Clarifying', count: inbox.clarifying, fill: '#CC2D24' },
      { status: 'Quoted', count: inbox.quoted, fill: '#34D399' },
      { status: 'In production', count: inbox.inProduction, fill: '#A78BFA' },
      { status: 'Completed', count: inbox.completed, fill: '#94A3B8' },
      { status: 'Declined', count: inbox.rejected, fill: '#64748B' },
    ].filter((p) => p.count > 0),
    ordersByStatus: [
      { name: 'New', count: inbox.newCount },
      { name: 'Reviewing', count: workspace.orders.filter((o) => o.status === 'reviewing').length },
      { name: 'Clarifying', count: inbox.clarifying },
      { name: 'Quoted', count: inbox.quoted },
      { name: 'In production', count: inbox.inProduction },
      { name: 'Completed', count: inbox.completed },
      { name: 'Declined', count: inbox.rejected },
    ],
    capacityWeekly: [
      { w: 'W1', used: 48, limit: 100 },
      { w: 'W2', used: 62, limit: 100 },
      { w: 'W3', used: 55, limit: 100 },
      { w: 'W4', used: 71, limit: 100 },
      { w: 'W5', used: 68, limit: 100 },
      { w: 'W6', used: 82, limit: 100 },
      { w: 'W7', used: 74, limit: 100 },
      { w: 'W8', used: Math.min(95, Math.round((inbox.capacityUsed / Math.max(inbox.capacityTotal, 1)) * 100) || 78), limit: 100 },
    ],
    leadTime: [
      { m: 'Nov', quoted: 28, actual: 30 },
      { m: 'Dec', quoted: 26, actual: 27 },
      { m: 'Jan', quoted: 25, actual: 24 },
      { m: 'Feb', quoted: 24, actual: 23 },
      { m: 'Mar', quoted: 23, actual: 22 },
      { m: 'Apr', quoted: 22, actual: 21 },
    ],
    deliveryMix: [
      { name: 'Economy', value: 22 },
      { name: 'Standard', value: 48 },
      { name: 'Express', value: 30 },
    ],
    garmentMix,
    garmentThroughput: garmentMix.map((g) => ({
      name: g.name,
      units: g.units,
    })),
    declineReasons: [
      { reason: 'Capability / process', count: 3 },
      { reason: 'MOQ too high', count: 2 },
      { reason: 'Lead time', count: 2 },
      { reason: 'Fabric unavailable', count: 1 },
      { reason: 'Capacity full', count: 1 },
    ],
    topBrands: [
      { brand: 'Acme Clothing', orders: 8, units: 920, winPct: 75 },
      { brand: 'Urban Layer Ltd', orders: 6, units: 540, winPct: 67 },
      { brand: 'Blank Collective', orders: 5, units: 710, winPct: 80 },
      { brand: 'Threadline Apparel', orders: 4, units: 380, winPct: 50 },
      { brand: 'Studio Guest Co', orders: 2, units: 120, winPct: 100 },
    ],
    brandRegions: [
      { region: 'UK', orders: 14 },
      { region: 'EU', orders: 6 },
      { region: 'US', orders: 3 },
      { region: 'Other', orders: 1 },
    ],
    quality: [
      { m: 'Nov', defects: 2.1, rework: 1.4 },
      { m: 'Dec', defects: 1.8, rework: 1.2 },
      { m: 'Jan', defects: 1.6, rework: 1.1 },
      { m: 'Feb', defects: 1.5, rework: 0.9 },
      { m: 'Mar', defects: 1.4, rework: 0.8 },
      { m: 'Apr', defects: 1.4, rework: 0.7 },
    ],
    materialsByKind: [
      { kind: 'Fabric', skus: materials.filter((m) => m.kind === 'fabric').length || 3 },
      { kind: 'Trim', skus: materials.filter((m) => m.kind === 'trim').length || 3 },
      { kind: 'Packaging', skus: materials.filter((m) => m.kind === 'packaging').length || 1 },
      { kind: 'Other', skus: materials.filter((m) => m.kind === 'other').length || 1 },
    ],
    materialUsage: [
      { m: 'Nov', metres: 420 },
      { m: 'Dec', metres: 510 },
      { m: 'Jan', metres: 480 },
      { m: 'Feb', metres: 620 },
      { m: 'Mar', metres: 580 },
      { m: 'Apr', metres: 690 },
    ],
    lowStockItems: materials
      .filter((m) => m.quantity <= m.reorderAt)
      .slice(0, 5)
      .map((m) => ({
        name: m.name,
        qty: m.quantity,
        unit: m.unit,
        reorderAt: m.reorderAt,
      })),
    teamActivity: workspace.team.map((t, i) => ({
      name: t.name.split(' ')[0] ?? t.name,
      quotes: t.role === 'quoter' || t.role === 'admin' ? 12 - i * 2 : 0,
      production: t.role === 'production' || t.role === 'admin' ? 8 + i : 1,
    })),
    onTimeTrend: [
      { m: 'Nov', pct: 88 },
      { m: 'Dec', pct: 90 },
      { m: 'Jan', pct: 92 },
      { m: 'Feb', pct: 93 },
      { m: 'Mar', pct: 94 },
      { m: 'Apr', pct: 94 },
    ],
    totals: { totalQuotes, totalWins, totalDeclines },
    profile: {
      moq: workspace.moq,
      monthlyCapacity: workspace.monthlyCapacity,
      regions: workspace.shippingRegions,
      garments: workspace.garments,
      capabilities: workspace.capabilities,
      factoryName: workspace.factoryName,
    },
  };
}

export function formatFactoryMoney(cents: number, currency: 'GBP' | 'EUR' = 'GBP'): string {
  return new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-GB', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function formatFactoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const FACTORY_STATUS_LABEL: Record<FactoryOrderStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  clarifying: 'Clarifying with brand',
  quoted: 'Quoted',
  rejected: 'Declined',
  in_production: 'In production',
  completed: 'Completed',
};
