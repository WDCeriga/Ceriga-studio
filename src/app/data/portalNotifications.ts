/**
 * Portal notifications for superadmin + manufacturer (persisted).
 * Brand/studio notifications stay in notifications.ts + NotificationsContext.
 */

export type PortalNotificationAudience = 'superadmin' | 'manufacturer';

export type PortalNotificationCategory =
  | 'order'
  | 'pricing'
  | 'message'
  | 'shipping'
  | 'capacity'
  | 'team'
  | 'system';

export type PortalNotification = {
  id: string;
  audience: PortalNotificationAudience;
  category: PortalNotificationCategory;
  title: string;
  body: string;
  /** ISO datetime */
  at: string;
  read: boolean;
  /** Deep link when present */
  href?: string;
};

export const PORTAL_NOTIFICATION_CATEGORY_LABEL: Record<
  PortalNotificationCategory,
  string
> = {
  order: 'Orders',
  pricing: 'Pricing',
  message: 'Messages',
  shipping: 'Shipping',
  capacity: 'Capacity',
  team: 'Team',
  system: 'System',
};

const STORAGE_KEY = 'ceriga_portal_notifications_v1';

function seedPortalNotifications(): PortalNotification[] {
  return [
    // —— Superadmin ——
    {
      id: 'sa-n1',
      audience: 'superadmin',
      category: 'order',
      title: 'New tech pack order',
      body: 'ord-1003 submitted by guest@example.com — needs assignment.',
      at: '2026-04-09T09:00:00Z',
      read: false,
      href: '/superadmin/assignment',
    },
    {
      id: 'sa-n2',
      audience: 'superadmin',
      category: 'pricing',
      title: 'Manufacturer priced order',
      body: 'ord-1001 marked priced — review final pricing before sending to brand.',
      at: '2026-04-08T16:20:00Z',
      read: false,
      href: '/superadmin/orders/ord-1001',
    },
    {
      id: 'sa-n3',
      audience: 'superadmin',
      category: 'message',
      title: 'North Mills replied',
      body: 'New message in the North Mills thread.',
      at: '2026-04-08T11:02:00Z',
      read: true,
      href: '/superadmin/messages',
    },
    {
      id: 'sa-n4',
      audience: 'superadmin',
      category: 'capacity',
      title: 'Time-off awaiting approval',
      body: 'North Mills requested a custom shutdown week — review capacity.',
      at: '2026-04-07T14:30:00Z',
      read: false,
      href: '/superadmin/time-off',
    },
    {
      id: 'sa-n5',
      audience: 'superadmin',
      category: 'shipping',
      title: 'Carrier onboard request',
      body: 'Euro Stitch requested onboarding for a regional express carrier.',
      at: '2026-04-06T10:15:00Z',
      read: false,
      href: '/superadmin/shipping-onboard',
    },
    {
      id: 'sa-n6',
      audience: 'superadmin',
      category: 'system',
      title: 'Quote SLA risk',
      body: '2 assigned orders are past the quote due window.',
      at: '2026-04-05T08:40:00Z',
      read: true,
      href: '/superadmin/assignment',
    },
    // —— Manufacturer ——
    {
      id: 'mf-n1',
      audience: 'manufacturer',
      category: 'order',
      title: 'New order assigned',
      body: 'Acme Clothing — Oversized hoodie (ord-1002). Quote due in 3 days.',
      at: '2026-04-05T10:05:00Z',
      read: false,
      href: '/manufacturer/orders/ord-1002',
    },
    {
      id: 'mf-n2',
      audience: 'manufacturer',
      category: 'message',
      title: 'Ceriga operations',
      body: 'Urban Layer trousers are in clarifying — brand replied about stitch colour.',
      at: '2026-04-10T15:05:00Z',
      read: false,
      href: '/manufacturer/messages',
    },
    {
      id: 'mf-n3',
      audience: 'manufacturer',
      category: 'message',
      title: 'Maya Chen messaged you',
      body: 'I’ve flagged the rib gauge note on ord-1002 for the brand.',
      at: '2026-04-11T09:20:00Z',
      read: false,
      href: '/manufacturer/messages',
    },
    {
      id: 'mf-n4',
      audience: 'manufacturer',
      category: 'capacity',
      title: 'Time-off approved',
      body: 'Your Easter shutdown week is approved and blocks capacity.',
      at: '2026-04-03T12:00:00Z',
      read: true,
      href: '/manufacturer/capacity',
    },
    {
      id: 'mf-n5',
      audience: 'manufacturer',
      category: 'shipping',
      title: 'Shipment in transit',
      body: 'DHL express booking for Acme sample is live — tracking available.',
      at: '2026-04-09T11:30:00Z',
      read: true,
      href: '/manufacturer/shipping',
    },
    {
      id: 'mf-n6',
      audience: 'manufacturer',
      category: 'team',
      title: 'Permission reminder',
      body: 'Priya Shah has a custom override including edit shipping — review if unexpected.',
      at: '2026-04-08T09:00:00Z',
      read: true,
      href: '/manufacturer/team',
    },
    {
      id: 'mf-n7',
      audience: 'manufacturer',
      category: 'order',
      title: 'Quote overdue',
      body: 'ord-1002 is approaching its quote SLA. Start review if not already open.',
      at: '2026-04-07T08:00:00Z',
      read: false,
      href: '/manufacturer/orders',
    },
  ];
}

function loadStore(): PortalNotification[] {
  if (typeof window === 'undefined') return seedPortalNotifications();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PortalNotification[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  const seed = seedPortalNotifications();
  persist(seed);
  return seed;
}

function persist(items: PortalNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

let store: PortalNotification[] =
  typeof window !== 'undefined' ? loadStore() : seedPortalNotifications();

let version = 0;
const listeners = new Set<() => void>();

const snapshotCache = new Map<
  PortalNotificationAudience,
  { version: number; items: PortalNotification[]; unread: number }
>();

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribePortalNotifications(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listPortalNotifications(
  audience: PortalNotificationAudience,
): PortalNotification[] {
  return store
    .filter((n) => n.audience === audience)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function countUnreadPortalNotifications(
  audience: PortalNotificationAudience,
): number {
  return store.filter((n) => n.audience === audience && !n.read).length;
}

/** Stable snapshot for useSyncExternalStore. */
export function getPortalNotificationSnapshot(
  audience: PortalNotificationAudience,
) {
  const cached = snapshotCache.get(audience);
  if (cached && cached.version === version) return cached;
  const next = {
    version,
    items: listPortalNotifications(audience),
    unread: countUnreadPortalNotifications(audience),
  };
  snapshotCache.set(audience, next);
  return next;
}

export function markPortalNotificationRead(id: string): void {
  store = store.map((n) => (n.id === id ? { ...n, read: true } : n));
  persist(store);
  notify();
}

export function markAllPortalNotificationsRead(
  audience: PortalNotificationAudience,
): void {
  store = store.map((n) =>
    n.audience === audience ? { ...n, read: true } : n,
  );
  persist(store);
  notify();
}

export function removePortalNotification(id: string): void {
  store = store.filter((n) => n.id !== id);
  persist(store);
  notify();
}

export function clearPortalNotifications(
  audience: PortalNotificationAudience,
): void {
  store = store.filter((n) => n.audience !== audience);
  persist(store);
  notify();
}

export function pushPortalNotification(
  input: Omit<PortalNotification, 'id' | 'at' | 'read'> & {
    id?: string;
    at?: string;
    read?: boolean;
  },
): PortalNotification {
  const item: PortalNotification = {
    id: input.id ?? `pn-${Date.now()}`,
    audience: input.audience,
    category: input.category,
    title: input.title,
    body: input.body,
    href: input.href,
    at: input.at ?? new Date().toISOString(),
    read: input.read ?? false,
  };
  store = [item, ...store];
  persist(store);
  notify();
  return item;
}
