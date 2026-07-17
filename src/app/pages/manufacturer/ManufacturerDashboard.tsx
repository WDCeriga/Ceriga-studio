import { Link } from 'react-router';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Factory,
  MessageCircle,
  Package,
  TrendingUp,
  Users,
  AlertCircle,
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
  FACTORY_STATUS_LABEL,
  factoryInboxStats,
  factoryStatsSeries,
  formatFactoryDate,
  getFactoryWorkspace,
  listFactoryOrders,
  type FactoryOrder,
  type FactoryOrderStatus,
} from '../../data/manufacturerPortalMock';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';

const RED = '#CC2D24';

const PIPELINE: FactoryOrderStatus[] = [
  'new',
  'reviewing',
  'clarifying',
  'quoted',
  'in_production',
  'completed',
];

function statusTone(status: FactoryOrderStatus) {
  if (status === 'clarifying' || status === 'new')
    return 'bg-[#CC2D24]/15 text-red-200 ring-[#CC2D24]/25';
  if (status === 'quoted' || status === 'completed')
    return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20';
  if (status === 'in_production') return 'bg-violet-500/15 text-violet-200 ring-violet-500/20';
  if (status === 'reviewing') return 'bg-sky-500/15 text-sky-200 ring-sky-500/20';
  return 'bg-white/10 text-white/70 ring-white/10';
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

function OrderRow({ order }: { order: FactoryOrder }) {
  return (
    <Link
      to={`/manufacturer/orders/${order.id}`}
      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/[0.06] px-4 py-3 transition last:border-0 hover:bg-white/[0.03] sm:grid-cols-[7rem_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem_auto_auto]"
    >
      <span className="hidden font-mono text-[11px] text-white/40 sm:inline">{order.id}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white/90">{order.productName}</div>
        <div className="mt-0.5 truncate text-xs text-white/40 sm:hidden">{order.brandName}</div>
      </div>
      <div className="hidden truncate text-xs text-white/50 sm:block">{order.brandName}</div>
      <div className="hidden text-xs tabular-nums text-white/45 sm:block">
        {formatFactoryDate(order.dueQuoteBy)}
      </div>
      <span
        className={cn(
          'justify-self-end rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
          statusTone(order.status),
        )}
      >
        {FACTORY_STATUS_LABEL[order.status]}
      </span>
      <ArrowUpRight className="h-4 w-4 justify-self-end text-[#CC2D24]/70" />
    </Link>
  );
}

export function ManufacturerDashboard() {
  const ws = getFactoryWorkspace();
  const stats = factoryInboxStats();
  const series = factoryStatsSeries();
  const orders = listFactoryOrders();

  const urgent = orders
    .filter((o) => ['new', 'clarifying', 'reviewing'].includes(o.status))
    .sort((a, b) => a.dueQuoteBy.localeCompare(b.dueQuoteBy));

  const capacityPct = Math.min(
    100,
    Math.round((stats.capacityUsed / Math.max(stats.capacityTotal, 1)) * 100),
  );

  const pipeline = PIPELINE.map((status) => ({
    status,
    label: FACTORY_STATUS_LABEL[status],
    count: orders.filter((o) => o.status === status).length,
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count));

  const winRate =
    series.monthlyQuotes.reduce((s, r) => s + r.quotes, 0) > 0
      ? Math.round(
          (series.monthlyQuotes.reduce((s, r) => s + r.wins, 0) /
            series.monthlyQuotes.reduce((s, r) => s + r.quotes, 0)) *
            100,
        )
      : 0;

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const latestMsgs = [...ws.cerigaMessages].slice(-4).reverse();
  const activeTeam = ws.team.filter((m) => m.status === 'active');

  return (
    <div className="space-y-8">
      {/* Header — same proportions as superadmin */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            Factory floor
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greeting()}, {ws.factoryName}
          </h1>
          <p className="mt-1 text-sm text-white/45">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/manufacturer/orders">
              <Zap className="mr-1.5 h-4 w-4" />
              Quote inbox ({stats.awaitingQuote})
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent text-white hover:bg-white/10"
          >
            <Link to="/manufacturer/messages">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Ceriga ops
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting quote"
          value={String(stats.awaitingQuote)}
          icon={Package}
          to="/manufacturer/orders"
        />
        <StatCard
          label="Quoted"
          value={String(stats.quoted)}
          icon={CheckCircle2}
          to="/manufacturer/orders"
        />
        <StatCard
          label="In production"
          value={String(stats.inProduction)}
          icon={Factory}
          to="/manufacturer/orders"
        />
        <StatCard
          label="Capacity load"
          value={`${capacityPct}%`}
          delta={`${stats.capacityUsed}/${stats.capacityTotal} u`}
          icon={TrendingUp}
          to="/manufacturer/statistics"
        />
      </div>

      {/* Chart + pipeline */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 xl:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Quote wins</h2>
              <p className="mt-0.5 text-[11px] text-white/40">Last 6 months · {winRate}% win rate</p>
            </div>
            <Link
              to="/manufacturer/statistics"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              Full analytics
            </Link>
          </div>
          <div className="mt-4 h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series.monthlyQuotes}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="factoryWins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="m"
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                />
                <Area
                  type="monotone"
                  dataKey="wins"
                  name="Wins"
                  stroke={RED}
                  strokeWidth={2}
                  fill="url(#factoryWins)"
                />
                <Area
                  type="monotone"
                  dataKey="quotes"
                  name="Quotes"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1.5}
                  fill="transparent"
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

      {/* Attention + Ceriga */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#CC2D24]" />
              <h2 className="text-sm font-semibold text-white">Needs attention</h2>
            </div>
            <Link
              to="/manufacturer/orders"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              All orders
            </Link>
          </div>
          {urgent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/80" />
              <p className="text-sm text-white/50">You&apos;re caught up — no quotes waiting.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {urgent.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/manufacturer/orders/${order.id}`}
                    className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-white/[0.03]"
                  >
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#CC2D24]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{order.productName}</div>
                      <div className="truncate text-xs text-white/45">
                        {order.brandName} · due {formatFactoryDate(order.dueQuoteBy)} ·{' '}
                        {FACTORY_STATUS_LABEL[order.status]}
                      </div>
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
              <h2 className="text-sm font-semibold text-white">Ceriga ops</h2>
            </div>
            <Link
              to="/manufacturer/messages"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              Open thread
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {latestMsgs.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-white/45">No messages yet.</li>
            ) : (
              latestMsgs.map((m) => (
                <li key={m.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        m.from === 'ceriga' ? 'bg-[#CC2D24]' : 'bg-white/25',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/90 line-clamp-2">{m.text}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/30">
                        {m.from} · {formatFactoryDate(m.at)}
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Recent orders + team */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent orders</h2>
            <Link
              to="/manufacturer/orders"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="hidden border-b border-white/[0.06] bg-black/25 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/35 sm:grid sm:grid-cols-[7rem_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem_auto_auto] sm:gap-3">
            <span>Order</span>
            <span>Product</span>
            <span>Brand</span>
            <span>Due</span>
            <span className="text-right">Status</span>
            <span />
          </div>
          <div>
            {[...orders]
              .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
              .slice(0, 5)
              .map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Team</h2>
            <Link
              to="/manufacturer/team"
              className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              Manage
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {activeTeam.map((member) => (
              <li key={member.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{member.name}</p>
                    <p className="truncate text-xs text-white/45">{member.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium capitalize text-white/55">
                    {member.role}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {ws.garments.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className="rounded-md border border-[#CC2D24]/25 bg-[#CC2D24]/10 px-2 py-0.5 text-[10px] text-red-100"
                >
                  {g}
                </span>
              ))}
            </div>
            <Link
              to="/manufacturer/settings"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#CC2D24] hover:underline"
            >
              <Users className="h-3 w-3" />
              Edit capabilities
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
