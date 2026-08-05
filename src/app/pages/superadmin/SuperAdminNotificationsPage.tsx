import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  CheckCheck,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';
import {
  PORTAL_NOTIFICATION_CATEGORY_LABEL,
  type PortalNotificationCategory,
} from '../../data/portalNotifications';
import { cn } from '../../components/ui/utils';

type Cat = 'all' | PortalNotificationCategory;

const FILTERS: { key: Cat; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'order', label: 'Orders' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'message', label: 'Messages' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'system', label: 'System' },
];

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SuperAdminNotificationsPage() {
  const { items, unread, markRead, markAllRead, remove, clearAll } =
    usePortalNotifications('superadmin');
  const [filter, setFilter] = useState<Cat>('all');
  const [clearOpen, setClearOpen] = useState(false);

  const list = useMemo(() => {
    return items.filter((n) => (filter === 'all' ? true : n.category === filter));
  }, [filter, items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            Inbox
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Assignment, pricing, messages, capacity, and shipping alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#CC2D24]/30 bg-[#CC2D24]/10 px-3 py-1.5 text-xs font-medium text-red-100">
              <span className="h-1.5 w-1.5 rounded-full bg-[#CC2D24]" />
              {unread} unread
            </span>
          ) : null}
          {unread > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/[0.03] text-white/80"
              onClick={() => {
                markAllRead();
                toast.success('Marked all as read');
              }}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
          {items.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              onClick={() => setClearOpen(true)}
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
              filter === f.key
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                : 'border-white/10 text-white/45 hover:text-white/75',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {list.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-white/12 bg-[#111113] px-4 py-12 text-center text-sm text-white/40">
            {items.length === 0 ? 'No notifications yet.' : 'Nothing in this category.'}
          </li>
        ) : (
          list.map((n) => {
            const inner = (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!n.read ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#CC2D24]" aria-hidden />
                    ) : null}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#CC2D24]/90">
                      {PORTAL_NOTIFICATION_CATEGORY_LABEL[n.category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <time className="text-[11px] text-white/40">{formatWhen(n.at)}</time>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(n.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:bg-red-500/15 hover:text-red-300"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-white">{n.title}</div>
                    <p className="mt-0.5 text-sm text-white/55">{n.body}</p>
                  </div>
                  {n.href ? (
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/30" />
                  ) : null}
                </div>
              </>
            );

            return (
              <li key={n.id}>
                {n.href ? (
                  <Link
                    to={n.href}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'block rounded-xl border px-4 py-3 transition hover:border-white/15 sm:px-5',
                      !n.read
                        ? 'border-[#CC2D24]/25 bg-[#CC2D24]/[0.06]'
                        : 'border-white/[0.08] bg-[#111113]',
                    )}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-left transition hover:border-white/15 sm:px-5',
                      !n.read
                        ? 'border-[#CC2D24]/25 bg-[#CC2D24]/[0.06]'
                        : 'border-white/[0.08] bg-[#111113]',
                    )}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all notifications?"
        description="Removes every item from the owner inbox."
        confirmLabel="Clear all"
        tone="danger"
        onConfirm={() => {
          clearAll();
          toast.success('Notifications cleared');
        }}
      />
    </div>
  );
}
