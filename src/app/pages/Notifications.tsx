import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  CreditCard,
  Package,
  Shield,
  Ship,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useNotifications } from "../contexts/NotificationsContext";
import {
  NOTIFICATION_CATEGORY_LABEL,
  type AppNotification,
  type NotificationCategory,
} from "../data/notifications";
import { cn } from "../components/ui/utils";

type SortKey = "newest" | "oldest";

const CATEGORY_FILTERS: Array<{ key: "all" | NotificationCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "admin", label: NOTIFICATION_CATEGORY_LABEL.admin },
  { key: "order", label: NOTIFICATION_CATEGORY_LABEL.order },
  { key: "payment", label: NOTIFICATION_CATEGORY_LABEL.payment },
  { key: "shipping", label: NOTIFICATION_CATEGORY_LABEL.shipping },
  { key: "system", label: NOTIFICATION_CATEGORY_LABEL.system },
];

function categoryIcon(category: NotificationCategory) {
  switch (category) {
    case "admin":
      return Shield;
    case "order":
      return Package;
    case "payment":
      return CreditCard;
    case "shipping":
      return Ship;
    case "system":
      return Sparkles;
  }
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function Notifications() {
  const navigate = useNavigate();
  const { items, remove, clearAll } = useNotifications();
  const [filter, setFilter] = useState<"all" | NotificationCategory>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const rows = useMemo(() => {
    let list: AppNotification[] =
      filter === "all" ? [...items] : items.filter((n) => n.category === filter);

    list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });

    return list;
  }, [filter, sort, items]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div
      className="min-h-dvh overflow-x-hidden p-4 sm:p-6 md:p-8"
      style={{
        background: "#0A0A0B",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => navigate(-1)}
        className="mb-5 h-8 border-white/20 px-3 text-[10px] !text-white hover:bg-white/10"
      >
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        BACK
      </Button>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: "#CC2D24" }}
          >
            Inbox
          </p>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "#F8F8F7", lineHeight: 1.08 }}
          >
            Notifications
          </h1>
          <p className="mt-2 max-w-lg text-base" style={{ color: "#ffffff50" }}>
            Messages from the team, orders, payments, and system updates. Filter and sort
            to find what matters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 && (
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: "#CC2D2420",
                color: "#FCA5A5",
                border: "1px solid #CC2D2440",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#CC2D24]" aria-hidden />
              {unread} unread
            </div>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Delete all notifications? This cannot be undone.")) {
                  clearAll();
                }
              }}
              className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300/90 transition-colors hover:bg-red-500/20"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters + sort */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                  active
                    ? "bg-[#CC2D24] text-white"
                    : "border border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-lg border border-white/10 bg-[#111113] px-3 text-sm text-white outline-none focus:border-[#CC2D24]/50 focus:ring-1 focus:ring-[#CC2D24]/30"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div style={{ height: "1px", background: "#ffffff09" }} className="mb-6" />

      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li
            className="rounded-2xl border border-dashed border-white/12 p-10 text-center text-sm text-white/45"
            style={{ background: "#111113" }}
          >
            {items.length === 0
              ? "No notifications yet."
              : "No notifications in this category yet."}
          </li>
        ) : (
          rows.map((n) => {
            const Icon = categoryIcon(n.category);
            return (
              <li
                key={n.id}
                className="rounded-2xl border border-white/[0.08] p-4 transition-colors hover:border-white/[0.12]"
                style={{ background: "#111113" }}
              >
                <div className="flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: "#ffffff08",
                      border: "1px solid #ffffff10",
                    }}
                  >
                    <Icon className="h-5 w-5 text-white/70" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {!n.read && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[#CC2D24]"
                            title="Unread"
                            aria-hidden
                          />
                        )}
                        <h2 className="text-sm font-semibold text-[#F0F0EE]">{n.title}</h2>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <time
                          className="text-[11px] text-white/35"
                          dateTime={n.createdAt}
                        >
                          {formatWhen(n.createdAt)}
                        </time>
                        <button
                          type="button"
                          onClick={() => remove(n.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-red-500/15 hover:text-red-300"
                          aria-label={`Delete ${n.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#CC2D24]/90">
                      {NOTIFICATION_CATEGORY_LABEL[n.category]}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/55">{n.body}</p>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
