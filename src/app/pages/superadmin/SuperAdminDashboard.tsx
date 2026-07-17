import { Link } from 'react-router';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Clock,
  Factory,
  MessageSquare,
  Package,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  MOCK_SUPER_ORDERS,
  MOCK_SUPER_USERS,
  MOCK_THREADS,
  STATUS_LABELS,
  formatMoney,
  type OrderStatus,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import {
  listPortalNotifications,
  countUnreadPortalNotifications,
  PORTAL_NOTIFICATION_CATEGORY_LABEL,
} from '../../data/portalNotifications';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';

const RED = '#CC2D24';

const revenueTrend = [
  { w: 'W1', revenue: 2800 },
  { w: 'W2', revenue: 3400 },
  { w: 'W3', revenue: 3100 },
  { w: 'W4', revenue: 4200 },
];

const PIPELINE_STATUSES: OrderStatus[] = [
  'assigned',
  'pending_review',
  'sent_to_brand',
  'in_production',
  'shipped',
  'completed',
];

function statusTone(status: OrderStatus) {
  if (status === 'pending_review')
    return 'bg-[#CC2D24]/15 text-red-200 ring-[#CC2D24]/25';
  if (status === 'priced' || status === 'completed' || status === 'paid')
    return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20';
  if (status === 'assigned' || status === 'in_production')
    return 'bg-amber-500/15 text-amber-200 ring-amber-500/20';
  if (status === 'submitted' || status === 'sent_to_brand')
    return 'bg-sky-500/15 text-sky-200 ring-sky-500/20';
  return 'bg-white/10 text-white/70 ring-white/10';
}

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  delta?: string;
  icon: typeof Users;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] p-5 transition hover:border-[#CC2D24]/35 hover:bg-[#141416]"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.07]"
        style={{ background: RED }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">{value}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[#CC2D24]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        {delta ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            {delta}
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center text-[11px] font-medium text-[#CC2D24] opacity-70 transition group-hover:opacity-100">
          View <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function OrderRow({ order }: { order: SuperAdminOrder }) {
  return (
    <Link
      to={`/superadmin/orders/${order.id}`}
      className="flex flex-col gap-2 border-b border-white/[0.06] px-4 py-3.5 transition last:border-0 hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-white/45">{order.id}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
              statusTone(order.status),
            )}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="mt-1 truncate text-sm font-medium text-white/90">{order.productName}</div>
        <div className="mt-0.5 text-xs text-white/45">{order.userName}</div>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-xs text-white/50">
        {order.manufacturerName ? (
          <span className="inline-flex items-center gap-1">
            <Factory className="h-3.5 w-3.5" />
            {order.manufacturerName}
          </span>
        ) : null}
        <span>{formatRelativeDate(order.createdAt)}</span>
        <ArrowUpRight className="h-4 w-4 text-[#CC2D24]/70" />
      </div>
    </Link>
  );
}

export function SuperAdminDashboard() {
  const pendingOrders = MOCK_SUPER_ORDERS.filter((o) =>
    ['pending_review', 'assigned'].includes(o.status),
  );
  const needsReview = MOCK_SUPER_ORDERS.filter((o) => o.status === 'pending_review');
  const revenueCents = MOCK_SUPER_ORDERS.reduce((sum, o) => sum + (o.finalPriceCents ?? 0), 0);
  const unreadNotifs = countUnreadPortalNotifications('superadmin');
  const recentNotifs = listPortalNotifications('superadmin').slice(0, 4);
  const unreadChats = MOCK_THREADS.reduce((sum, t) => sum + t.unread, 0);
  const activeBrands = MOCK_SUPER_USERS.filter((u) => u.role === 'brand').length;

  const pipeline = PIPELINE_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: MOCK_SUPER_ORDERS.filter((o) => o.status === status).length,
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count));

  const attentionItems = [
    ...needsReview.map((o) => ({
      id: o.id,
      tone: 'amber' as const,
      title: 'Review pricing',
      body: `${o.id} · ${formatMoney(o.calculatedPriceCents ?? o.manufacturerQuoteCents ?? 0)}`,
      to: '/superadmin/orders/review',
      state: { startOrderId: o.id },
    })),
    ...MOCK_SUPER_ORDERS.filter((o) => o.status === 'assigned' && o.kind === 'custom_clothing')
      .slice(0, 2)
      .map((o) => ({
        id: `${o.id}-mfg`,
        tone: 'sky' as const,
        title: 'At manufacturer',
        body: `${o.manufacturerName} pricing ${o.id}`,
        to: `/superadmin/orders/${o.id}`,
      })),
  ].slice(0, 4);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            Owner console
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greeting()}
          </h1>
          <p className="mt-1 text-sm text-white/45">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/superadmin/orders/review">
              <Zap className="mr-1.5 h-4 w-4" />
              Review {needsReview.length} price{needsReview.length === 1 ? '' : 's'}
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent text-white hover:bg-white/10"
          >
            <Link to="/superadmin/notifications">
              <Bell className="mr-1.5 h-4 w-4" />
              {unreadNotifs} alerts
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={String(MOCK_SUPER_USERS.length)}
          icon={Users}
          to="/superadmin/users"
        />
        <StatCard
          label="Open orders"
          value={String(pendingOrders.length)}
          icon={Package}
          to="/superadmin/orders"
        />
        <StatCard
          label="Revenue (mock)"
          value={formatMoney(revenueCents)}
          icon={TrendingUp}
          to="/superadmin/statistics"
        />
        <StatCard
          label="Unread messages"
          value={String(unreadChats)}
          icon={MessageSquare}
          to="/superadmin/messages"
        />
      </div>

      {/* Chart + pipeline */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 xl:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Revenue trend</h2>
            </div>
            <Link
              to="/superadmin/statistics"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              Full analytics
            </Link>
          </div>
          <div className="mt-4 h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="w"
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                  formatter={(v: number) => [`£${v.toLocaleString()}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={RED}
                  strokeWidth={2}
                  fill="url(#dashRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold text-white">Order pipeline</h2>
          <div className="mt-5 space-y-3">
            {pipeline.map((row) => (
              <div key={row.status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-white/60">{row.label}</span>
                  <span className="tabular-nums font-medium text-white">{row.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(row.count / pipelineMax) * 100}%`,
                      background: row.count > 0 ? RED : 'transparent',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attention + activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Needs attention</h2>
            </div>
            <Link to="/superadmin/orders" className="text-[11px] font-medium text-[#CC2D24] hover:underline">
              All orders
            </Link>
          </div>
          {attentionItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/80" />
              <p className="text-sm text-white/50">You&apos;re caught up — no urgent items.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {attentionItems.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    state={'state' in item ? item.state : undefined}
                    className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                        item.tone === 'amber'
                          ? 'bg-amber-400'
                          : item.tone === 'sky'
                            ? 'bg-sky-400'
                            : 'bg-emerald-400',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{item.title}</div>
                      <div className="truncate text-xs text-white/45">{item.body}</div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/25" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/40" />
              <h2 className="text-sm font-semibold text-white">Recent activity</h2>
            </div>
            <Link
              to="/superadmin/notifications"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {recentNotifs.map((n) => (
              <li key={n.id} className="px-5 py-3.5">
                <Link
                  to={n.href ?? '/superadmin/notifications'}
                  className="flex items-start gap-3 transition hover:opacity-90"
                >
                  {!n.read ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#CC2D24]" />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-white/15" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white/90">{n.title}</div>
                    <div className="mt-0.5 text-xs text-white/45">{n.body}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-white/30">
                      {PORTAL_NOTIFICATION_CATEGORY_LABEL[n.category]}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent orders + messages */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent orders</h2>
            <Link to="/superadmin/orders" className="text-[11px] font-medium text-[#CC2D24] hover:underline">
              See all
            </Link>
          </div>
          <div>
            {[...MOCK_SUPER_ORDERS]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Messages</h2>
            <Link to="/superadmin/messages" className="text-[11px] font-medium text-[#CC2D24] hover:underline">
              Inbox
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {MOCK_THREADS.map((t) => (
              <li key={t.id}>
                <Link
                  to="/superadmin/messages"
                  className="block px-5 py-3.5 transition hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">{t.name}</span>
                    {t.unread > 0 ? (
                      <span className="shrink-0 rounded-full bg-[#CC2D24] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {t.unread}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-white/55">{t.lastMessage}</div>
                  <div className="mt-1 text-[10px] text-white/30">{t.lastAt}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
