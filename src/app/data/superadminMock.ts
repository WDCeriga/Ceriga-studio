/** Mock data for the superadmin console — replace with API calls in production. */

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
  /** Set when manufacturer submits pricing */
  manufacturerQuoteCents?: number;
  /** Superadmin-editable final price in cents */
  finalPriceCents?: number;
  trackingNumber?: string;
  notes?: string;
};

export type ChatThread = {
  id: string;
  type: 'manufacturer' | 'user';
  name: string;
  subtitle: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
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
];

export const MOCK_SUPER_ORDERS: SuperAdminOrder[] = [
  {
    id: 'ord-1001',
    kind: 'techpack',
    userId: 'u1',
    userName: 'Acme Clothing',
    userEmail: 'hello@acme.com',
    productName: 'Premium Cotton T-Shirt — tech pack',
    status: 'priced',
    createdAt: '2026-04-01',
    manufacturerId: 'm1',
    manufacturerName: 'North Mills',
    deliveryCountry: 'UK',
    deliveryCity: 'London',
    manufacturerQuoteCents: 89000,
    finalPriceCents: 104500,
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
  },
  {
    id: 'th2',
    type: 'user',
    name: 'Acme Clothing',
    subtitle: 'Brand',
    lastMessage: 'Can we bump the delivery to week 24?',
    lastAt: 'Yesterday',
    unread: 0,
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
  submitted: 'Submitted',
  assigned: 'Assigned to manufacturer',
  priced: 'Priced',
  sent_to_brand: 'Sent to brand',
  paid: 'Paid',
  in_production: 'In production',
  shipped: 'Shipped',
  completed: 'Completed',
};

export function formatMoney(cents: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}
