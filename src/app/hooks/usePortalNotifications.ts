import { useCallback, useSyncExternalStore } from 'react';
import {
  clearPortalNotifications,
  getPortalNotificationSnapshot,
  markAllPortalNotificationsRead,
  markPortalNotificationRead,
  removePortalNotification,
  subscribePortalNotifications,
  type PortalNotificationAudience,
} from '../data/portalNotifications';

export function usePortalNotifications(audience: PortalNotificationAudience) {
  const snap = useSyncExternalStore(
    subscribePortalNotifications,
    () => getPortalNotificationSnapshot(audience),
    () => getPortalNotificationSnapshot(audience),
  );

  const markRead = useCallback((id: string) => {
    markPortalNotificationRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    markAllPortalNotificationsRead(audience);
  }, [audience]);

  const remove = useCallback((id: string) => {
    removePortalNotification(id);
  }, []);

  const clearAll = useCallback(() => {
    clearPortalNotifications(audience);
  }, [audience]);

  return {
    items: snap.items,
    unread: snap.unread,
    markRead,
    markAllRead,
    remove,
    clearAll,
  };
}
