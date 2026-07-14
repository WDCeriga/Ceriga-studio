/** Mock analytics for superadmin statistics — replace with API in production. */

export type StatsPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export const STATS_PERIODS: StatsPeriod[] = ['today', 'week', 'month', 'quarter', 'year', 'all'];

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
  all: 'All time',
};

export type StatsSectionId =
  | 'financial'
  | 'users'
  | 'orders'
  | 'ai-chat'
  | 'manufacturers'
  | 'engagement';

export type StatsSectionMeta = {
  id: StatsSectionId;
  title: string;
  description: string;
  path: string;
  previewMetrics: { label: string; value: string; delta?: string }[];
};

export const STATS_SECTIONS: StatsSectionMeta[] = [
  {
    id: 'financial',
    title: 'Financial',
    description: 'Revenue, margins, payouts, and payment mix across the platform.',
    path: '/superadmin/statistics/financial',
    previewMetrics: [
      { label: 'Gross revenue', value: '£48.2k', delta: '+12%' },
      { label: 'Ceriga margin', value: '£9.4k' },
      { label: 'Avg. order value', value: '£412' },
    ],
  },
  {
    id: 'users',
    title: 'Users',
    description: 'Signups, active accounts, role mix, and retention cohorts.',
    path: '/superadmin/statistics/users',
    previewMetrics: [
      { label: 'Total users', value: '186', delta: '+8%' },
      { label: 'Active (30d)', value: '124' },
      { label: 'New signups', value: '22' },
    ],
  },
  {
    id: 'orders',
    title: 'Orders',
    description: 'Volume, pipeline stages, product mix, and fulfilment timing.',
    path: '/superadmin/statistics/orders',
    previewMetrics: [
      { label: 'Orders placed', value: '117', delta: '+15%' },
      { label: 'In pipeline', value: '34' },
      { label: 'Completed', value: '68' },
    ],
  },
  {
    id: 'ai-chat',
    title: 'AI Chat',
    description: 'Subscription plans, message usage, and chat-driven engagement.',
    path: '/superadmin/statistics/ai-chat',
    previewMetrics: [
      { label: 'Messages sent', value: '12.4k', delta: '+6%' },
      { label: 'Paid subscribers', value: '48' },
      { label: 'Avg. per user', value: '186' },
    ],
  },
  {
    id: 'manufacturers',
    title: 'Manufacturers',
    description: 'Partner throughput, quote speed, and production capacity.',
    path: '/superadmin/statistics/manufacturers',
    previewMetrics: [
      { label: 'Active partners', value: '8' },
      { label: 'Avg. quote time', value: '1.8d' },
      { label: 'Orders assigned', value: '52' },
    ],
  },
  {
    id: 'engagement',
    title: 'Engagement',
    description: 'Messages, notifications, emails, and support activity.',
    path: '/superadmin/statistics/engagement',
    previewMetrics: [
      { label: 'Messages sent', value: '1,240', delta: '+4%' },
      { label: 'Emails sent', value: '86' },
      { label: 'Unread threads', value: '7' },
    ],
  },
];

export const monthlyRevenue = [
  { m: 'Jan', revenue: 4200, margin: 840, orders: 18 },
  { m: 'Feb', revenue: 5100, margin: 1020, orders: 22 },
  { m: 'Mar', revenue: 4800, margin: 960, orders: 19 },
  { m: 'Apr', revenue: 6200, margin: 1240, orders: 28 },
  { m: 'May', revenue: 5800, margin: 1160, orders: 24 },
  { m: 'Jun', revenue: 7100, margin: 1420, orders: 31 },
];

export const revenueByProduct = [
  { name: 'Tech packs', value: 58, revenue: 27900 },
  { name: 'Custom MOQ', value: 32, revenue: 15400 },
  { name: 'Add-ons', value: 10, revenue: 4900 },
];

export const paymentMethods = [
  { name: 'Card', value: 72 },
  { name: 'Chat plan', value: 21 },
  { name: 'Invoice', value: 7 },
];

export const weeklySignups = [
  { w: 'W1', signups: 4, active: 28 },
  { w: 'W2', signups: 7, active: 32 },
  { w: 'W3', signups: 5, active: 35 },
  { w: 'W4', signups: 6, active: 38 },
];

export const usersByRole = [
  { role: 'Brands', count: 142 },
  { role: 'Manufacturers', count: 38 },
  { role: 'Workers', count: 6 },
];

export const userRetention = [
  { week: 'W1', retained: 100 },
  { week: 'W2', retained: 78 },
  { week: 'W3', retained: 65 },
  { week: 'W4', retained: 58 },
  { week: 'W5', retained: 52 },
  { week: 'W6', retained: 48 },
];

export const dailyActiveUsers = [
  { d: 'Mon', users: 42 },
  { d: 'Tue', users: 48 },
  { d: 'Wed', users: 51 },
  { d: 'Thu', users: 46 },
  { d: 'Fri', users: 55 },
  { d: 'Sat', users: 28 },
  { d: 'Sun', users: 22 },
];

export const ordersByStatus = [
  { status: 'Submitted', count: 12 },
  { status: 'Assigned', count: 18 },
  { status: 'Pending review', count: 8 },
  { status: 'In production', count: 14 },
  { status: 'Shipped', count: 9 },
  { status: 'Completed', count: 68 },
];

export const ordersByKind = [
  { name: 'Tech pack', value: 64 },
  { name: 'Custom clothing', value: 36 },
];

export const orderVolumeTrend = [
  { m: 'Jan', techpack: 11, custom: 7 },
  { m: 'Feb', techpack: 14, custom: 8 },
  { m: 'Mar', techpack: 12, custom: 7 },
  { m: 'Apr', techpack: 18, custom: 10 },
  { m: 'May', techpack: 16, custom: 8 },
  { m: 'Jun', techpack: 20, custom: 11 },
];

export const fulfilmentDays = [
  { stage: 'Quote', days: 1.8 },
  { stage: 'Review', days: 0.6 },
  { stage: 'Production', days: 12.4 },
  { stage: 'Shipping', days: 3.2 },
];

export const creditsPurchased = [
  { m: 'Jan', purchased: 620, used: 480 },
  { m: 'Feb', purchased: 740, used: 510 },
  { m: 'Mar', purchased: 680, used: 590 },
  { m: 'Apr', purchased: 920, used: 640 },
  { m: 'May', purchased: 810, used: 720 },
  { m: 'Jun', purchased: 1050, used: 800 },
];

export const chatPlansByTier = [
  { plan: 'Free', subscribers: 98 },
  { plan: 'Studio', subscribers: 28 },
  { plan: 'Scale', subscribers: 14 },
  { plan: 'Business', subscribers: 6 },
];

export const manufacturerThroughput = [
  { name: 'North Mills', orders: 21, avgDays: 1.4 },
  { name: 'Euro Stitch', orders: 18, avgDays: 2.1 },
  { name: 'Porto Garment', orders: 13, avgDays: 1.9 },
  { name: 'Lisbon Textiles', orders: 11, avgDays: 2.4 },
];

export const manufacturerQuoteTrend = [
  { m: 'Jan', avgHours: 52 },
  { m: 'Feb', avgHours: 48 },
  { m: 'Mar', avgHours: 44 },
  { m: 'Apr', avgHours: 41 },
  { m: 'May', avgHours: 38 },
  { m: 'Jun', avgHours: 36 },
];

export const engagementTrend = [
  { m: 'Jan', messages: 180, emails: 12, notifications: 340 },
  { m: 'Feb', messages: 210, emails: 18, notifications: 380 },
  { m: 'Mar', messages: 195, emails: 14, notifications: 360 },
  { m: 'Apr', messages: 248, emails: 22, notifications: 420 },
  { m: 'May', messages: 230, emails: 19, notifications: 395 },
  { m: 'Jun', messages: 277, emails: 21, notifications: 445 },
];

export const messageByType = [
  { type: 'Brand ↔ Ceriga', count: 520 },
  { type: 'Ceriga ↔ Manufacturer', count: 480 },
  { type: 'System', count: 240 },
];

export const SECTION_KPI: Record<
  StatsSectionId,
  { label: string; value: string; hint?: string; delta?: string }[]
> = {
  financial: [
    { label: 'Gross revenue', value: '£48,240', delta: '+12.4%', hint: 'All paid orders' },
    { label: 'Ceriga margin', value: '£9,412', delta: '+9.8%', hint: 'After manufacturer cost' },
    { label: 'Avg. order value', value: '£412', hint: 'Paid orders only' },
    { label: 'Refund rate', value: '1.2%', hint: 'Last 90 days' },
  ],
  users: [
    { label: 'Total accounts', value: '186', delta: '+8%', hint: 'All roles' },
    { label: 'Active (30d)', value: '124', delta: '+5%', hint: 'Logged in or ordered' },
    { label: 'New signups', value: '22', delta: '+18%', hint: 'This period' },
    { label: 'Brand / Mfg ratio', value: '3.7:1', hint: '142 brands · 38 manufacturers' },
  ],
  orders: [
    { label: 'Orders placed', value: '117', delta: '+15%', hint: 'Tech pack + custom' },
    { label: 'In pipeline', value: '34', hint: 'Not yet completed' },
    { label: 'Completed', value: '68', delta: '+11%', hint: 'Delivered or exported' },
    { label: 'Avg. fulfilment', value: '17.2d', hint: 'Custom clothing only' },
  ],
  'ai-chat': [
    { label: 'Messages sent', value: '12,420', delta: '+6%', hint: 'All chat tiers' },
    { label: 'Paid subscribers', value: '48', delta: '+9%', hint: 'Studio, Scale, Business' },
    { label: 'Free tier users', value: '98', hint: 'Within monthly allowance' },
    { label: 'Chat MRR', value: '£2,840', delta: '+7%', hint: 'AI subscriptions only' },
  ],
  manufacturers: [
    { label: 'Active partners', value: '8', hint: 'Assigned orders this period' },
    { label: 'Avg. quote time', value: '1.8 days', delta: '-12%', hint: 'Submission to quote' },
    { label: 'Orders assigned', value: '52', delta: '+9%', hint: 'Custom clothing' },
    { label: 'On-time rate', value: '94%', hint: 'Production deadlines met' },
  ],
  engagement: [
    { label: 'Messages', value: '1,240', delta: '+4%', hint: 'All channels' },
    { label: 'Emails sent', value: '86', hint: 'Admin broadcasts + direct' },
    { label: 'Push notifications', value: '445', hint: 'In-app alerts' },
    { label: 'Open threads', value: '7', hint: 'Awaiting reply' },
  ],
};

export function sectionTitle(id: StatsSectionId): string {
  return STATS_SECTIONS.find((s) => s.id === id)?.title ?? id;
}
