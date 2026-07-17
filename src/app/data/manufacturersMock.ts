import { MOCK_SUPER_ORDERS, MOCK_SUPER_USERS, type SuperAdminUser } from './superadminMock';
import { getProfileAccess, MANUFACTURER_PLANS } from './crmAccessMock';
import { manufacturerThroughput } from './superadminStatsMock';

export type GarmentCategory =
  | 'Hoodies'
  | 'T-shirts'
  | 'Sweatshirts'
  | 'Joggers'
  | 'Zip-ups'
  | 'Polos'
  | 'Outerwear';

export const ALL_GARMENT_CATEGORIES: GarmentCategory[] = [
  'Hoodies',
  'T-shirts',
  'Sweatshirts',
  'Joggers',
  'Zip-ups',
  'Polos',
  'Outerwear',
];

export const COMMON_CERTIFICATIONS = [
  'OEKO-TEX',
  'GOTS',
  'ISO 9001',
  'BSCI',
  'SEDEX',
  'GRS',
  'Fair Wear',
] as const;

export type ManufacturerStatus = 'active' | 'paused' | 'onboarding';

export type ManufacturerProfile = {
  userId: string;
  entityId: string;
  name: string;
  email: string;
  location: string;
  country: string;
  status: ManufacturerStatus;
  garmentTypes: GarmentCategory[];
  specialties: string[];
  certifications: string[];
  moq: number;
  leadTimeDays: number;
  capacityUnitsPerMonth: number;
  onTimeRate: number;
  avgQuoteDays: number;
  winRate: number;
  quoteToOrderRate: number;
  joinedAt: string;
  lastActive: string;
  internalNotes: string;
};

let profileStore: ManufacturerProfile[] = [
  {
    userId: 'u2',
    entityId: 'm1',
    name: 'North Mills',
    email: 'ops@northmills.io',
    location: 'Manchester',
    country: 'United Kingdom',
    status: 'active',
    garmentTypes: ['Hoodies', 'Sweatshirts', 'Zip-ups', 'Joggers'],
    specialties: ['Heavy fleece', 'Cut & sew', 'DTG ready blanks'],
    certifications: ['OEKO-TEX', 'GOTS'],
    moq: 50,
    leadTimeDays: 18,
    capacityUnitsPerMonth: 4200,
    onTimeRate: 96,
    avgQuoteDays: 1.4,
    winRate: 62,
    quoteToOrderRate: 48,
    joinedAt: '2025-06-01',
    lastActive: '2026-04-07',
    internalNotes: 'Preferred for midweight fleece. Strong UK turnaround.',
  },
  {
    userId: 'u5',
    entityId: 'm2',
    name: 'Euro Stitch Co',
    email: 'production@eurostitch.eu',
    location: 'Porto',
    country: 'Portugal',
    status: 'active',
    garmentTypes: ['T-shirts', 'Polos', 'Hoodies', 'Sweatshirts'],
    specialties: ['Jersey knits', 'Embroidery', 'Small-run fashion'],
    certifications: ['OEKO-TEX', 'ISO 9001'],
    moq: 100,
    leadTimeDays: 21,
    capacityUnitsPerMonth: 6100,
    onTimeRate: 94,
    avgQuoteDays: 2.1,
    winRate: 71,
    quoteToOrderRate: 55,
    joinedAt: '2024-11-02',
    lastActive: '2026-04-06',
    internalNotes: 'Best tee/polo partner. Watch embroidery queue in peak weeks.',
  },
  {
    userId: 'u7',
    entityId: 'm3',
    name: 'Porto Garment Works',
    email: 'hello@portogarment.pt',
    location: 'Braga',
    country: 'Portugal',
    status: 'active',
    garmentTypes: ['Outerwear', 'Zip-ups', 'Hoodies', 'Joggers'],
    specialties: ['Technical shell', 'Bonded seams', 'Private label'],
    certifications: ['OEKO-TEX', 'BSCI'],
    moq: 75,
    leadTimeDays: 24,
    capacityUnitsPerMonth: 2800,
    onTimeRate: 91,
    avgQuoteDays: 1.9,
    winRate: 54,
    quoteToOrderRate: 41,
    joinedAt: '2025-08-19',
    lastActive: '2026-04-04',
    internalNotes: 'Outerwear specialty. Longer lead — set expectations with brands.',
  },
];

export type ManufacturerOrderStats = {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  quotedOrders: number;
  totalQuoteCents: number;
};

export type ManufacturerOverviewStats = {
  activePartners: number;
  totalOrdersAssigned: number;
  avgQuoteDays: number;
  avgOnTimeRate: number;
  garmentCoverage: { type: GarmentCategory; partners: number }[];
  throughput: { name: string; orders: number; avgDays: number }[];
};

export function listManufacturerProfiles(): ManufacturerProfile[] {
  return profileStore;
}

export function getManufacturerProfile(userId: string): ManufacturerProfile | undefined {
  return profileStore.find((p) => p.userId === userId);
}

export function patchManufacturerControl(
  userId: string,
  patch: Partial<
    Pick<
      ManufacturerProfile,
      'status' | 'internalNotes' | 'garmentTypes' | 'specialties' | 'certifications'
    >
  >,
): ManufacturerProfile | undefined {
  const idx = profileStore.findIndex((p) => p.userId === userId);
  if (idx < 0) return undefined;
  const next = {
    ...profileStore[idx],
    ...patch,
    garmentTypes: patch.garmentTypes
      ? [...patch.garmentTypes]
      : profileStore[idx].garmentTypes,
    specialties: patch.specialties ? [...patch.specialties] : profileStore[idx].specialties,
    certifications: patch.certifications
      ? [...patch.certifications]
      : profileStore[idx].certifications,
  };
  profileStore = profileStore.map((p, i) => (i === idx ? next : p));
  return next;
}

export function getManufacturerUser(userId: string): SuperAdminUser | undefined {
  const user = MOCK_SUPER_USERS.find((u) => u.id === userId && u.role === 'manufacturer');
  return user;
}

export function getManufacturerOrderStats(entityId: string): ManufacturerOrderStats {
  const orders = MOCK_SUPER_ORDERS.filter((o) => o.manufacturerId === entityId);
  const activeStatuses = new Set([
    'assigned',
    'priced',
    'pending_review',
    'sent_to_brand',
    'paid',
    'in_production',
    'shipped',
  ]);
  return {
    totalOrders: orders.length,
    activeOrders: orders.filter((o) => activeStatuses.has(o.status)).length,
    completedOrders: orders.filter((o) => o.status === 'completed').length,
    quotedOrders: orders.filter((o) => o.manufacturerQuoteCents != null).length,
    totalQuoteCents: orders.reduce((sum, o) => sum + (o.manufacturerQuoteCents ?? 0), 0),
  };
}

export function getManufacturerOverviewStats(): ManufacturerOverviewStats {
  const profiles = profileStore;
  const garmentMap = new Map<GarmentCategory, number>();
  for (const p of profiles) {
    for (const g of p.garmentTypes) {
      garmentMap.set(g, (garmentMap.get(g) ?? 0) + 1);
    }
  }

  const assigned = MOCK_SUPER_ORDERS.filter((o) => o.manufacturerId).length;
  const avgQuote =
    profiles.reduce((sum, p) => sum + p.avgQuoteDays, 0) / Math.max(profiles.length, 1);
  const avgOnTime =
    profiles.reduce((sum, p) => sum + p.onTimeRate, 0) / Math.max(profiles.length, 1);

  return {
    activePartners: profiles.filter((p) => p.status === 'active').length,
    totalOrdersAssigned: assigned,
    avgQuoteDays: Math.round(avgQuote * 10) / 10,
    avgOnTimeRate: Math.round(avgOnTime),
    garmentCoverage: Array.from(garmentMap.entries())
      .map(([type, partners]) => ({ type, partners }))
      .sort((a, b) => b.partners - a.partners),
    throughput: manufacturerThroughput,
  };
}

export function getManufacturerPlanLabel(userId: string): string {
  const access = getProfileAccess(userId);
  const plan = MANUFACTURER_PLANS.find((p) => p.id === access?.manufacturerPlanId);
  return plan?.name ?? 'Unassigned';
}

export function formatMoneyCents(cents: number): string {
  return `£${(cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
