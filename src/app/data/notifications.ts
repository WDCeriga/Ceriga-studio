import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

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

type NotificationRow = {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
};

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

/** Demo seed only when Supabase is not configured. */
const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    category: 'admin',
    title: 'Welcome to Ceriga Studio',
    body: 'Your account is ready. Create a project to start your first tech pack.',
    createdAt: '2026-04-08T14:22:00.000Z',
    read: false,
    href: '/create',
  },
];

export async function fetchBrandNotifications(): Promise<AppNotification[]> {
  if (!isSupabaseConfigured) return [...DEMO_NOTIFICATIONS];
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('brand_notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(rowToNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from('brand_notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('brand_notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('brand_notifications').delete().eq('id', id);
  if (error) throw error;
}

export async function clearAllNotifications(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('brand_notifications').delete().eq('user_id', user.id);
  if (error) throw error;
}
