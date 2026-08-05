export type NotificationCategory = 'admin' | 'order' | 'payment' | 'shipping' | 'system';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** ISO date string */
  createdAt: string;
  read: boolean;
  /** Deep link into the studio app */
  href?: string;
};

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  admin: 'From admin',
  order: 'Orders',
  payment: 'Payment',
  shipping: 'Shipping',
  system: 'System',
};

const STORAGE_KEY = 'ceriga_brand_notifications_v1';

/** Demo notifications for the notifications page (replace with API later). */
export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    category: 'admin',
    title: 'Welcome to Ceriga Studio',
    body: 'Your account is ready. Explore the catalog to start your first tech pack.',
    createdAt: '2026-04-08T14:22:00.000Z',
    read: false,
    href: '/catalog',
  },
  {
    id: 'n2',
    category: 'order',
    title: 'Order #1042 — In production',
    body: 'Your sample run has moved to cutting. We will notify you when it ships.',
    createdAt: '2026-04-07T09:15:00.000Z',
    read: false,
    href: '/orders',
  },
  {
    id: 'n3',
    category: 'payment',
    title: 'Payment received',
    body: 'We received your payment for invoice INV-2026-014. Thank you.',
    createdAt: '2026-04-06T11:40:00.000Z',
    read: true,
    href: '/orders',
  },
  {
    id: 'n4',
    category: 'shipping',
    title: 'Delivery scheduled',
    body: 'Courier pickup is booked for Thursday. Tracking will be added when dispatched.',
    createdAt: '2026-04-05T16:05:00.000Z',
    read: true,
    href: '/orders',
  },
  {
    id: 'n5',
    category: 'system',
    title: 'Autosave restored',
    body: 'We recovered an unsaved session from your last builder visit.',
    createdAt: '2026-04-04T08:30:00.000Z',
    read: true,
    href: '/studio',
  },
  {
    id: 'n6',
    category: 'order',
    title: 'Order #1038 — Delivered',
    body: 'Your package was delivered. Let us know if anything needs a rework.',
    createdAt: '2026-04-01T13:00:00.000Z',
    read: true,
    href: '/orders',
  },
  {
    id: 'n7',
    category: 'admin',
    title: 'Holiday production window',
    body: 'Please note adjusted lead times for orders placed between Apr 12–18.',
    createdAt: '2026-03-28T10:00:00.000Z',
    read: true,
  },
  {
    id: 'n8',
    category: 'order',
    title: 'Quotes ready',
    body: 'Your manufacturer returned pricing tiers — review and choose a quantity.',
    createdAt: '2026-04-09T10:00:00.000Z',
    read: false,
    href: '/orders',
  },
];

export function loadBrandNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [...MOCK_NOTIFICATIONS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppNotification[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  const seed = [...MOCK_NOTIFICATIONS];
  persistBrandNotifications(seed);
  return seed;
}

export function persistBrandNotifications(items: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
