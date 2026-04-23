import { useMemo, useState } from 'react';
import { MOCK_SUPER_NOTIFICATIONS, type SuperAdminNotificationItem } from '../../data/superadminMock';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

type Cat = 'all' | SuperAdminNotificationItem['category'];

export function SuperAdminNotificationsPage() {
  const [filter, setFilter] = useState<Cat>('all');

  const list = useMemo(() => {
    return MOCK_SUPER_NOTIFICATIONS.filter((n) => (filter === 'all' ? true : n.category === filter)).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-white/45">Orders, messages, pricing events — filter by type.</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Cat)}>
          <SelectTrigger className="w-full border-white/15 bg-white/5 text-white sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="order">Orders</SelectItem>
            <SelectItem value="pricing">Pricing</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ul className="space-y-2">
        {list.map((n) => (
          <li
            key={n.id}
            className={cn(
              'rounded-xl border border-white/[0.08] bg-[#111113] px-4 py-3 sm:px-5',
              !n.read && 'border-[#CC2D24]/25 bg-[#CC2D24]/[0.06]',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#CC2D24]/90">{n.category}</span>
              <time className="text-[11px] text-white/40">{new Date(n.at).toLocaleString()}</time>
            </div>
            <div className="mt-1 font-medium text-white">{n.title}</div>
            <p className="mt-0.5 text-sm text-white/55">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
