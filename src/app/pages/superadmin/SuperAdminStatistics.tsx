import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { STATS_SECTIONS, type StatsPeriod } from '../../data/superadminStatsMock';
import { formatMoney } from '../../data/superadminMock';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';
import { PeriodSelect, RED, SectionHubCard, chartTooltipStyle, gridStroke, axisProps } from './statistics/statsShared';

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleString('en-GB', { month: 'short' });
}

export function SuperAdminStatistics() {
  const { orders, users, loading } = useSuperadminData();
  const [period, setPeriod] = useState<StatsPeriod>('month');

  const snapshot = useMemo(() => {
    const grossCents = orders.reduce((sum, o) => sum + (o.finalPriceCents ?? 0), 0);
    const factoryCents = orders.reduce((sum, o) => sum + (o.manufacturerQuoteCents ?? 0), 0);
    const marginCents = Math.max(0, grossCents - factoryCents);
    const activeUsers = users.filter((u) => u.role === 'brand' || u.role === 'manufacturer').length;

    const byMonth = new Map<string, number>();
    for (const o of orders) {
      const key = monthKey(o.createdAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + (o.finalPriceCents ?? 0));
    }
    const keys = Array.from(byMonth.keys()).sort();
    const lastSix = keys.slice(-6);
    const chart =
      lastSix.length > 0
        ? lastSix.map((k) => ({ m: monthLabel(k), revenue: Math.round((byMonth.get(k) ?? 0) / 100) }))
        : [{ m: '—', revenue: 0 }];

    return {
      grossCents,
      marginCents,
      activeUsers,
      orderCount: orders.length,
      chart,
    };
  }, [orders, users]);

  if (loading) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <BarChart3 className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Analytics</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Statistics</h1>
        </div>
        <PeriodSelect period={period} onPeriodChange={setPeriod} />
      </div>

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Platform snapshot</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            Live from orders
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Gross revenue', value: formatMoney(snapshot.grossCents) },
            { label: 'Active users', value: String(snapshot.activeUsers) },
            { label: 'Orders', value: String(snapshot.orderCount) },
            { label: 'Est. margin', value: formatMoney(snapshot.marginCents) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#252528] bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{k.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-white">{k.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 h-[200px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshot.chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="hubRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="m" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `£${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke={RED} fill="url(#hubRev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white">Explore by area</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {STATS_SECTIONS.map((s) => (
            <SectionHubCard key={s.id} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
