import { MOCK_SUPER_USERS, type SuperAdminUser } from './superadminMock';
import { seedManufacturerPlans, setManufacturerPlan } from './manufacturerPlanRegistry';

export type AccessAudience = 'users' | 'manufacturers' | 'workers';

export type PageAccessDef = {
  id: string;
  label: string;
  description: string;
};

export type ManufacturerPlan = {
  id: string;
  name: string;
  description: string;
  commission: string;
  monthlyFee: string;
};

export type WorkerRoleTemplate = {
  id: string;
  name: string;
  description: string;
};

export type ProfileAccessConfig = {
  userId: string;
  audience: AccessAudience;
  roleLabel: string;
  enabledPages: string[];
  manufacturerPlanId?: string;
  workerRoleId?: string;
};

export const AUDIENCE_META: Record<
  AccessAudience,
  { title: string; subtitle: string; accent: string; userRole: SuperAdminUser['role'] }
> = {
  users: {
    title: 'Users',
    subtitle: 'Brand accounts — control studio pages and features each customer can access.',
    accent: '#3B82F6',
    userRole: 'brand',
  },
  manufacturers: {
    title: 'Manufacturers',
    subtitle: 'Factory partners — manage portal access, plans, and pricing permissions.',
    accent: '#F59E0B',
    userRole: 'manufacturer',
  },
  workers: {
    title: 'Workers',
    subtitle: 'Internal Ceriga team — assign superadmin areas and operational roles.',
    accent: '#A855F7',
    userRole: 'worker',
  },
};

export const PAGE_ACCESS: Record<AccessAudience, PageAccessDef[]> = {
  users: [
    { id: 'studio', label: 'Studio', description: 'Workflow hub and project entry' },
    { id: 'catalog', label: 'Catalog', description: 'Browse garment templates' },
    { id: 'builder', label: 'Builder', description: 'Design tech packs on garment' },
    { id: 'drafts', label: 'Drafts', description: 'Saved in-progress projects' },
    { id: 'orders', label: 'Orders', description: 'Production and tech pack orders' },
    { id: 'packaging', label: 'Packaging', description: 'Labels and polybag workspace' },
    { id: 'support', label: 'Support chat', description: 'AI and human support' },
    { id: 'settings', label: 'Settings', description: 'Account and billing preferences' },
  ],
  manufacturers: [
    { id: 'inbox', label: 'Order inbox', description: 'Assigned production requests' },
    { id: 'pricing', label: 'Pricing & quotes', description: 'Submit factory pricing' },
    { id: 'messages', label: 'Messages', description: 'Ceriga and brand threads' },
    { id: 'capacity', label: 'Capacity', description: 'Lead times and availability' },
    { id: 'profile', label: 'Factory profile', description: 'Capabilities and certifications' },
    { id: 'analytics', label: 'Analytics', description: 'Quote win rate and throughput' },
  ],
  workers: [
    { id: 'superadmin_dashboard', label: 'Dashboard', description: 'Overview and alerts' },
    { id: 'superadmin_users', label: 'Users', description: 'Customer accounts' },
    { id: 'superadmin_orders', label: 'Orders', description: 'Full order pipeline' },
    { id: 'superadmin_statistics', label: 'Statistics', description: 'Revenue and usage analytics' },
    { id: 'superadmin_crm', label: 'CRM & catalog', description: 'Products and access' },
    { id: 'superadmin_pricing', label: 'Pricing', description: 'Platform pricing rules' },
    { id: 'superadmin_messages', label: 'Messages', description: 'Support and factory inbox' },
    { id: 'superadmin_notifications', label: 'Notifications', description: 'System alerts' },
  ],
};

export const MANUFACTURER_PLANS: ManufacturerPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Up to 10 active orders, standard support',
    commission: '8%',
    monthlyFee: 'Free',
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Priority inbox, analytics, and faster payouts',
    commission: '6%',
    monthlyFee: '£199 / mo',
  },
  {
    id: 'partner',
    name: 'Partner',
    description: 'Dedicated ops contact, SLA, and co-marketing',
    commission: '4%',
    monthlyFee: 'Custom',
  },
];

export const WORKER_ROLE_TEMPLATES: WorkerRoleTemplate[] = [
  { id: 'ops', name: 'Operations', description: 'Orders, users, and day-to-day fulfilment' },
  { id: 'support', name: 'Support', description: 'Messages and customer assistance' },
  { id: 'finance', name: 'Finance', description: 'Statistics, pricing, and billing review' },
  { id: 'admin', name: 'Full admin', description: 'All superadmin areas except settings' },
];

const DEFAULT_ROLE_LABELS: Record<AccessAudience, string> = {
  users: 'Brand owner',
  manufacturers: 'Factory admin',
  workers: 'Operations',
};

const DEFAULT_WORKER_ROLE = 'ops';

function defaultPages(audience: AccessAudience): string[] {
  return PAGE_ACCESS[audience].map((p) => p.id);
}

function audienceForUser(user: SuperAdminUser): AccessAudience | null {
  if (user.role === 'brand') return 'users';
  if (user.role === 'manufacturer') return 'manufacturers';
  if (user.role === 'worker') return 'workers';
  return null;
}

function buildInitialAccess(): ProfileAccessConfig[] {
  return MOCK_SUPER_USERS.flatMap((user) => {
    const audience = audienceForUser(user);
    if (!audience) return [];
    return [
      {
        userId: user.id,
        audience,
        roleLabel: DEFAULT_ROLE_LABELS[audience],
        enabledPages: defaultPages(audience),
        manufacturerPlanId:
          audience === 'manufacturers'
            ? user.id === 'u2'
              ? 'starter'
              : user.id === 'u5'
                ? 'partner'
                : 'growth'
            : undefined,
        workerRoleId: audience === 'workers' ? DEFAULT_WORKER_ROLE : undefined,
      },
    ];
  });
}

let accessStore: ProfileAccessConfig[] = buildInitialAccess();

function syncManufacturerPlansFromStore(): void {
  const entries: Record<string, string> = {};
  for (const profile of accessStore) {
    if (profile.audience === 'manufacturers' && profile.manufacturerPlanId) {
      entries[profile.userId] = profile.manufacturerPlanId;
    }
  }
  seedManufacturerPlans(entries);
}

syncManufacturerPlansFromStore();

export function getProfilesForAudience(audience: AccessAudience): SuperAdminUser[] {
  const role = AUDIENCE_META[audience].userRole;
  return MOCK_SUPER_USERS.filter((u) => u.role === role);
}

export function getProfileAccess(userId: string): ProfileAccessConfig | undefined {
  return accessStore.find((a) => a.userId === userId);
}

export function upsertProfileAccess(config: ProfileAccessConfig): void {
  const idx = accessStore.findIndex((a) => a.userId === config.userId);
  if (idx >= 0) {
    accessStore = accessStore.map((a) => (a.userId === config.userId ? config : a));
  } else {
    accessStore = [...accessStore, config];
  }
  if (config.audience === 'manufacturers') {
    setManufacturerPlan(config.userId, config.manufacturerPlanId);
  }
}

export function countEnabledPages(config: ProfileAccessConfig): number {
  return config.enabledPages.length;
}

export function applyWorkerRoleTemplate(roleId: string): string[] {
  const all = PAGE_ACCESS.workers.map((p) => p.id);
  switch (roleId) {
    case 'ops':
      return ['superadmin_dashboard', 'superadmin_users', 'superadmin_orders', 'superadmin_messages'];
    case 'support':
      return ['superadmin_dashboard', 'superadmin_users', 'superadmin_messages', 'superadmin_notifications'];
    case 'finance':
      return ['superadmin_dashboard', 'superadmin_statistics', 'superadmin_pricing', 'superadmin_orders'];
    case 'admin':
      return all.filter((id) => id !== 'superadmin_notifications');
    default:
      return all;
  }
}
