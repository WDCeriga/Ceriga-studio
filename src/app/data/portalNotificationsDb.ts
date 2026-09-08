import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { PortalNotification, PortalNotificationAudience } from './portalNotifications';

type Row = {
  id: string;
  audience: PortalNotificationAudience;
  user_id: string | null;
  category: PortalNotification['category'];
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
};

function rowToNotification(row: Row): PortalNotification {
  return {
    id: row.id,
    audience: row.audience,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    at: row.created_at,
    read: row.read,
  };
}

/** Fetch notifications for the current viewer (RLS scopes superadmin vs manufacturer). */
export async function fetchPortalNotifications(
  audience: PortalNotificationAudience,
): Promise<PortalNotification[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (audience === 'manufacturer' && !user) return [];
  if (audience === 'superadmin' && !user) return [];

  const { data, error } = await supabase
    .from('portal_notifications')
    .select('*')
    .eq('audience', audience)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToNotification);
}

export async function markPortalNotificationReadInDb(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from('portal_notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllPortalNotificationsReadInDb(
  audience: PortalNotificationAudience,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from('portal_notifications')
    .update({ read: true })
    .eq('audience', audience)
    .eq('read', false);
  if (error) throw error;
}

/**
 * DB-backed portal notifications with light polling. When Supabase is not
 * configured this hook transparently falls back to the local demo store.
 */
export function usePortalNotificationsDb(audience: PortalNotificationAudience, enabled: boolean) {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled || !isSupabaseConfigured) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setItems(await fetchPortalNotifications(audience));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [audience, enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const t = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(t);
  }, [refresh, enabled]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await markPortalNotificationReadInDb(id);
        await refresh();
      } catch {
        /* ignore */
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    try {
      await markAllPortalNotificationsReadInDb(audience);
      await refresh();
    } catch {
      /* ignore */
    }
  }, [audience, refresh]);

  const unread = items.filter((n) => !n.read).length;
  return { items, unread, loading, refresh, markRead, markAllRead };
}
