import { useSyncExternalStore, useMemo } from 'react';
import {
  clearPortalNotifications,
  getPortalNotificationSnapshot,
  markAllPortalNotificationsRead,
  markPortalNotificationRead,
  removePortalNotification,
  subscribePortalNotifications,
  type PortalNotificationAudience,
} from '../data/portalNotifications';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { usePortalNotificationsDb } from '../data/portalNotificationsDb';

/**
 * Portal notifications for superadmin + manufacturer.
 * DB-backed (with polling) when Supabase is configured; local demo store otherwise.
 */
export function usePortalNotifications(audience: PortalNotificationAudience) {
  const { isAuthenticated, authReady } = useAuth();
  const dbEnabled = isSupabaseConfigured && authReady && isAuthenticated;
  const db = usePortalNotificationsDb(audience, dbEnabled);

  // Local demo store — only used when DB is unavailable.
  const local = useSyncExternalStore(
    subscribePortalNotifications,
    () => getPortalNotificationSnapshot(audience),
    () => getPortalNotificationSnapshot(audience),
  );

  return useMemo(() => {
    if (dbEnabled) {
      return {
        items: db.items,
        unread: db.unread,
        loading: db.loading,
        markRead: (id: string) => void db.markRead(id),
        markAllRead: () => void db.markAllRead(),
        remove: (_id: string) => {},
        clearAll: () => {},
      };
    }
    return {
      items: local.items,
      unread: local.unread,
      loading: false,
      markRead: (id: string) => markPortalNotificationRead(id),
      markAllRead: () => markAllPortalNotificationsRead(audience),
      remove: (id: string) => removePortalNotification(id),
      clearAll: () => clearPortalNotifications(audience),
    };
  }, [dbEnabled, db, local, audience]);
}
