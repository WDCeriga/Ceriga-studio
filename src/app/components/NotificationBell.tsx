"use client";

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Bell, ChevronRight, Trash2, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationsContext";
import { NOTIFICATION_CATEGORY_LABEL } from "../data/notifications";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "./ui/utils";

type NotificationBellProps = {
  className?: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function BellInner({ unread }: { unread: number }) {
  return (
    <>
      <Bell className="h-[19px] w-[19px]" strokeWidth={2} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#CC2D24] px-1 text-[9px] font-bold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </>
  );
}

/**
 * Below the lg breakpoint: bell navigates to /notifications (full page, no preview).
 * lg and up: bell toggles the compact peek sheet.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const location = useLocation();
  const { items, remove, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  const unread = items.filter((n) => !n.read).length;
  const active = location.pathname === "/notifications";

  const bellClassName = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-white transition-colors hover:border-white/18 hover:bg-[#161618]",
    active
      ? "border-[#CC2D24]/45 bg-[#CC2D24]/12"
      : "border-white/10 bg-[#111113]/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm",
    className,
  );

  useEffect(() => {
    if (location.pathname === "/notifications") {
      setOpen(false);
    }
  }, [location.pathname]);

  return (
    <>
      {/* Phone / small screens: open full notifications page (no sheet preview) */}
      <Link
        to="/notifications"
        className={cn(bellClassName, "lg:hidden")}
        aria-current={active ? "page" : undefined}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <BellInner unread={unread} />
      </Link>

      {/* Desktop: preview panel */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(bellClassName, "hidden lg:flex")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <BellInner unread={unread} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className={cn(
              "flex flex-col gap-0 overflow-hidden border-white/12 bg-[#111113] p-0 text-white",
              "!inset-y-auto !bottom-5 !top-[max(4.5rem,env(safe-area-inset-top,0px)+1rem)] !left-auto !h-[min(480px,calc(100dvh-6rem))] !max-h-[min(480px,calc(100dvh-6rem))]",
              "w-[min(340px,calc(100vw-1.25rem))] !max-w-none rounded-2xl border shadow-2xl",
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
              "[&>button:last-child]:hidden",
            )}
          >
            <SheetTitle className="sr-only">Recent notifications</SheetTitle>

            <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
                  Inbox
                </p>
                <p className="truncate text-sm font-semibold text-white">Notifications</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete all notifications?")) clearAll();
                    }}
                    className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-white/45">
                  You&apos;re all caught up.
                </p>
              ) : (
                <ul className="space-y-0 divide-y divide-white/[0.06] p-2">
                  {items.slice(0, 12).map((n) => (
                    <li key={n.id}>
                      <div className="flex gap-2 rounded-xl p-2.5 transition-colors hover:bg-white/[0.04]">
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-start gap-2">
                            {!n.read && (
                              <span
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CC2D24]"
                                aria-hidden
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold leading-snug text-[#F0F0EE]">
                                {n.title}
                              </p>
                              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#CC2D24]/85">
                                {NOTIFICATION_CATEGORY_LABEL[n.category]}
                              </p>
                              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/45">
                                {n.body}
                              </p>
                              <p className="mt-1.5 text-[10px] text-white/30">
                                {formatWhen(n.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(n.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-lg text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-300"
                          aria-label={`Delete ${n.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>

            <div className="border-t border-white/10 p-3">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CC2D24]/35 hover:bg-[#CC2D24]/10"
              >
                Open full inbox
                <ChevronRight className="h-4 w-4 opacity-70" />
              </Link>
              <p className="mt-2 text-center text-[10px] text-white/30">
                Filters, sorting, and bulk actions in the full view
              </p>
            </div>
          </SheetContent>
        </Sheet>
    </>
  );
}
