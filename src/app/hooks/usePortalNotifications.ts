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
  const { isAuthenticated, authReady,user } = useAuth();
  const dbEnabled = isSupabaseConfigured && authReady && isAuthenticated;
  const db = usePortalNotificationsDb(audience, dbEnabled,user?.id||user?.email||'');

  // Local demo store — only used when DB is unavailable.
  const local = useSyncExternalStore(
    subscribePortalNotifications,
    () => getPortalNotificationSnapshot(audience),
    () => getPortalNotificationSnapshot(audience),
  );

  return useMemo(() => {
    if (dbEnabled) {
      return {
        items: db.items,hasMore:db.hasMore,loadMore:db.loadMore,
        unread: db.unread,
        loading: db.loading,error:db.error,refresh:db.refresh,
        markRead: db.markRead,
        markAllRead: db.markAllRead,
        remove: db.remove,
        clearAll: db.clearAll,
      };
    }
    return {
      items: local.items,hasMore:false,loadMore:()=>{},
      unread: local.unread,
      loading: false,error:'',refresh:async()=>{},
      markRead: (id: string) => markPortalNotificationRead(id),
      markAllRead: () => markAllPortalNotificationsRead(audience),
      remove: async(id:string)=>{removePortalNotification(id);return true;},
      clearAll: async()=>{clearPortalNotifications(audience);return true;},
    };
  }, [dbEnabled, db, local, audience]);
}
