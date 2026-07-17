"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadBrandNotifications,
  persistBrandNotifications,
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
  const [items, setItems] = useState<AppNotification[]>(() => loadBrandNotifications());

  const commit = useCallback((updater: (prev: AppNotification[]) => AppNotification[]) => {
    setItems((prev) => {
      const next = updater(prev);
      persistBrandNotifications(next);
      return next;
    });
  }, []);

  const markRead = useCallback(
    (id: string) => {
      commit((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    [commit],
  );

  const markAllRead = useCallback(() => {
    commit((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [commit]);

  const remove = useCallback(
    (id: string) => {
      commit((prev) => prev.filter((n) => n.id !== id));
    },
    [commit],
  );

  const clearAll = useCallback(() => {
    commit(() => []);
  }, [commit]);

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
