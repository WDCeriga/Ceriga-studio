"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  clearAllNotifications,
  deleteNotification,
  fetchBrandNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../data/notifications";

type NotificationsContextValue = {
  items: AppNotification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, usingSupabase } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!authReady) return;
    if (usingSupabase && !isAuthenticated) {
      setItems([]);
      return;
    }
    try {
      setItems(await fetchBrandNotifications());
    } catch {
      setItems([]);
    }
  }, [authReady, isAuthenticated, usingSupabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      void markNotificationRead(id).catch(() => void refresh());
    },
    [refresh],
  );

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllNotificationsRead().catch(() => void refresh());
  }, [refresh]);

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((n) => n.id !== id));
      void deleteNotification(id).catch(() => void refresh());
    },
    [refresh],
  );

  const clearAll = useCallback(() => {
    setItems([]);
    void clearAllNotifications().catch(() => void refresh());
  }, [refresh]);

  const unread = items.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({ items, unread, markRead, markAllRead, remove, clearAll }),
    [items, unread, markRead, markAllRead, remove, clearAll],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
