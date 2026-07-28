import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Clock,
  Download,
  Factory,
  Package,
  Shirt,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  formatFactoryMoney,
  getFactoryAnalytics,
  downloadTextFile,
  factoryAnalyticsReportCsv,
  type AnalyticsPeriodDays,
} from '../../data/manufacturerPortalMock';
import { cn } from '../../components/ui/utils';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';

const RED = '#CC2D24';
const PIE_COLORS = ['#CC2D24', '#3B82F6', '#10B981', '#F59E0B', '#A78BFA', '#64748B'];

const tooltipStyle = {
  background: '#141416',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#fff',
};

const axisProps = {
  stroke: 'rgba(255,255,255,0.35)',
  fontSize: 11,
  tickLine: false as const,
  axisLine: false as const,
};

const gridStroke = 'rgba(255,255,255,0.06)';

type SectionId = 'overview' | 'orders' | 'quoting' | 'production' | 'materials' | 'brands';

const SECTIONS: { id: SectionId; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'quoting', label: 'Quoting', icon: Target },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'materials', label: 'Materials', icon: Boxes },
  { id: 'brands', label: 'Brands & quality', icon: Users },
];

function ChartPanel({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-2xl border border-white/[0.08] bg-[#111113] p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[11px] text-white/40">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: typeof TrendingUp;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
        {Icon ? (
          <Icon className={cn('h-3.5 w-3.5', warn ? 'text-amber-400' : 'text-white/25')} />
        ) : null}
      </div>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          warn ? 'text-amber-300' : 'text-white',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}

export function ManufacturerStatistics() {
  const [section, setSection] = useState<SectionId>('overview');
  const [periodDays, setPeriodDays] = useState<AnalyticsPeriodDays>(90);
  const a = useMemo(() => getFactoryAnalytics(periodDays), [periodDays]);

  const exportReport = () => {
    const csv = factoryAnalyticsReportCsv(periodDays);
    downloadTextFile(
      `ceriga-factory-report-${periodDays}d-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
    toast.success(`Exported ${a.periodLabel.toLowerCase()} report`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <BarChart3 className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Analytics</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Statistics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Throughput, quoting speed, capacity, materials, brand mix, and quality for{' '}
            {a.profile.factoryName} · {a.periodLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {([30, 90] as AnalyticsPeriodDays[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPeriodDays(d)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12px] font-medium transition',
                  periodDays === d
                    ? 'bg-[#CC2D24]/20 text-red-100'
                    : 'text-white/45 hover:text-white/75',
                )}
              >
                {d} days
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/5 hover:text-white"
            onClick={exportReport}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export report
          </Button>
          <Link
            to="/manufacturer/orders"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            Orders inbox
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/manufacturer/materials"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            Materials
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors',
                active
                  ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                  : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === 'overview' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Win rate"
              value={`${a.kpis.winRate}%`}
              hint={`${a.totals.totalWins} wins / ${a.totals.totalQuotes} quotes`}
              icon={Target}
            />
            <KpiCard
              label="Booked factory value"
              value={formatFactoryMoney(a.kpis.bookedValueCents)}
              hint={a.kpis.bookedValueDelta}
              icon={TrendingUp}
            />
            <KpiCard
              label="Avg quote response"
              value={`${a.kpis.avgQuoteHours}h`}
              hint="Last 6 months average"
              icon={Clock}
            />
            <KpiCard
              label="Capacity used"
              value={`${a.kpis.capacityPct}%`}
              hint={`${a.kpis.capacityUsed.toLocaleString()} / ${a.kpis.capacityTotal.toLocaleString()} units`}
              icon={Factory}
            />
            <KpiCard label="On-time delivery" value={`${a.kpis.onTimePct}%`} hint={`OTIF ${a.kpis.otifPct}%`} />
            <KpiCard
              label="In production"
              value={String(a.kpis.inProduction)}
              hint={`${a.kpis.awaitingQuote} awaiting quote`}
              icon={Package}
            />
            <KpiCard
              label="Active brands"
              value={String(a.kpis.activeBrands)}
              hint={`${a.kpis.repeatBrandPct}% repeat`}
              icon={Users}
            />
            <KpiCard
              label="Low stock SKUs"
              value={String(a.kpis.lowStock)}
              hint="From Materials"
              icon={AlertTriangle}
              warn={a.kpis.lowStock > 0}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <ChartPanel
              title="Weekly throughput"
              subtitle="Units cut / packed · quotes submitted"
              className="lg:col-span-3"
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.weeklyThroughput} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={RED} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="w" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                    <Area
                      type="monotone"
                      dataKey="units"
                      name="Units"
                      stroke={RED}
                      fill="url(#fillUnits)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="quotes"
                      name="Quotes"
                      stroke="#38BDF8"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Live pipeline" subtitle="Orders by stage" className="lg:col-span-2">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={a.pipeline}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {a.pipeline.map((p) => (
                        <Cell key={p.status} fill={p.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Quotes vs wins" subtitle="6-month Ceriga funnel">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.monthlyQuotes}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                    <Bar dataKey="quotes" name="Quotes" fill="rgba(204,45,36,0.35)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="wins" name="Wins" fill={RED} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="On-time trend" subtitle="% deliveries on or before promise">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.onTimeTrend}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis domain={[80, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      name="On-time %"
                      stroke="#34D399"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">Factory profile snapshot</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/35">MOQ</p>
                <p className="mt-1 text-lg font-semibold text-white">{a.profile.moq}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/35">Monthly capacity</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {a.profile.monthlyCapacity.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-white/35">Regions</p>
                <p className="mt-1 text-sm text-white/80">{a.profile.regions.join(', ')}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.profile.garments.map((g) => (
                <span
                  key={g}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/60"
                >
                  {g}
                </span>
              ))}
              {a.profile.capabilities.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-[#CC2D24]/25 bg-[#CC2D24]/10 px-2 py-1 text-[11px] text-red-100/80"
                >
                  {c}
                </span>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {section === 'orders' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Awaiting quote" value={String(a.kpis.awaitingQuote)} icon={Clock} />
            <KpiCard label="Quoted" value={String(a.ordersByStatus.find((x) => x.name === 'Quoted')?.count ?? 0)} />
            <KpiCard label="In production" value={String(a.kpis.inProduction)} icon={Package} />
            <KpiCard label="Completed" value={String(a.kpis.completed)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <ChartPanel title="Orders by status" className="lg:col-span-3">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.ordersByStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={gridStroke} horizontal={false} />
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={100} {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={RED} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Ship-to regions" className="lg:col-span-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={a.brandRegions}
                      dataKey="orders"
                      nameKey="region"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {a.brandRegions.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Weekly units" subtitle="Production output">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.weeklyThroughput}>
                    <defs>
                      <linearGradient id="fillWeekly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="w" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="units"
                      stroke="#A78BFA"
                      fill="url(#fillWeekly)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Delivery option mix" subtitle="Quoted shipping preferences">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.deliveryMix}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="% of quotes" fill="#38BDF8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>
        </div>
      ) : null}

      {section === 'quoting' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Win rate" value={`${a.kpis.winRate}%`} icon={Target} />
            <KpiCard label="Quotes (6 mo)" value={String(a.totals.totalQuotes)} />
            <KpiCard label="Wins" value={String(a.totals.totalWins)} />
            <KpiCard label="Declines" value={String(a.totals.totalDeclines)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <ChartPanel title="Quotes, wins & declines" className="lg:col-span-3">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.monthlyQuotes}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                    <Bar dataKey="quotes" name="Quotes" fill="rgba(255,255,255,0.2)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="wins" name="Wins" fill={RED} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="declines" name="Declines" fill="#64748B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Avg response (hours)" className="lg:col-span-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.quoteHours}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${v}h`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="#34D399"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Quoted value" subtitle="Factory cost booked (£k)">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.quoteValue}>
                    <defs>
                      <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={RED} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={RED} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `£${v}k`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="valueK"
                      name="Value"
                      stroke={RED}
                      fill="url(#fillValue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Decline reasons" subtitle="Why jobs were turned down">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.declineReasons} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid stroke={gridStroke} horizontal={false} />
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="reason" width={120} {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>
        </div>
      ) : null}

      {section === 'production' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Capacity used"
              value={`${a.kpis.capacityPct}%`}
              hint={`${a.kpis.capacityUsed} / ${a.kpis.capacityTotal} units`}
              icon={Factory}
            />
            <KpiCard label="Avg lead (actual)" value={`${a.kpis.avgLeadDays}d`} hint={`Quoted ${a.kpis.quotedLeadDays}d`} />
            <KpiCard label="On-time" value={`${a.kpis.onTimePct}%`} />
            <KpiCard label="OTIF" value={`${a.kpis.otifPct}%`} hint="On time in full" />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <ChartPanel
              title="Capacity utilisation"
              subtitle="% of monthly capacity booked"
              className="lg:col-span-3"
            >
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.capacityWeekly}>
                    <defs>
                      <linearGradient id="fillCap" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="w" {...axisProps} />
                    <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="used"
                      name="Used %"
                      stroke="#F59E0B"
                      fill="url(#fillCap)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="limit"
                      name="Cap"
                      stroke="rgba(255,255,255,0.25)"
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Quoted vs actual lead" className="lg:col-span-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.leadTime}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${v}d`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                    <Line type="monotone" dataKey="quoted" name="Quoted" stroke="#38BDF8" strokeWidth={2} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke={RED} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Garment throughput" subtitle="Units by capability line">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.garmentThroughput}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="units" fill={RED} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Mix of live capabilities" subtitle="% of recent volume">
              <ul className="grid gap-2 sm:grid-cols-2">
                {a.garmentMix.map((g) => (
                  <li
                    key={g.name}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                  >
                    <div className="flex items-center gap-2 text-white/45">
                      <Shirt className="h-3.5 w-3.5" />
                      <span className="text-[11px]">{g.name}</span>
                    </div>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">{g.value}%</p>
                    <p className="text-[11px] text-white/35">{g.units} units</p>
                  </li>
                ))}
              </ul>
            </ChartPanel>
          </div>
        </div>
      ) : null}

      {section === 'materials' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Low stock"
              value={String(a.kpis.lowStock)}
              warn={a.kpis.lowStock > 0}
              icon={AlertTriangle}
            />
            <KpiCard
              label="Fabric SKUs"
              value={String(a.materialsByKind.find((m) => m.kind === 'Fabric')?.skus ?? 0)}
            />
            <KpiCard
              label="Trim SKUs"
              value={String(a.materialsByKind.find((m) => m.kind === 'Trim')?.skus ?? 0)}
            />
            <KpiCard label="Fabric used (Apr)" value={`${a.materialUsage.at(-1)?.metres ?? 0}m`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <ChartPanel title="Fabric consumption" subtitle="Metres drawn per month" className="lg:col-span-3">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.materialUsage}>
                    <defs>
                      <linearGradient id="fillMat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="metres"
                      name="Metres"
                      stroke="#3B82F6"
                      fill="url(#fillMat)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Stock by kind" className="lg:col-span-2">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.materialsByKind}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="kind" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="skus" fill="#A78BFA" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Needs reorder</h2>
              <Link
                to="/manufacturer/materials"
                className="text-[12px] font-medium text-[#CC2D24] hover:underline"
              >
                Open materials
              </Link>
            </div>
            {a.lowStockItems.length === 0 ? (
              <p className="mt-4 text-sm text-white/45">No low-stock items right now.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {a.lowStockItems.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-white">{item.name}</span>
                    </div>
                    <span className="tabular-nums text-amber-200">
                      {item.qty} {item.unit}
                      <span className="text-white/35"> / reorder {item.reorderAt}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {section === 'brands' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Active brands" value={String(a.kpis.activeBrands)} icon={Users} />
            <KpiCard label="Repeat rate" value={`${a.kpis.repeatBrandPct}%`} />
            <KpiCard label="Defect rate" value={`${a.kpis.defectRatePct}%`} hint="Last 6 months" />
            <KpiCard label="Team active" value={String(a.kpis.teamActive)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <ChartPanel title="Top brands by volume" className="lg:col-span-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
                      <th className="pb-2 font-semibold">Brand</th>
                      <th className="pb-2 font-semibold">Orders</th>
                      <th className="pb-2 font-semibold">Units</th>
                      <th className="pb-2 font-semibold">Win %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {a.topBrands.map((b) => (
                      <tr key={b.brand}>
                        <td className="py-2.5 font-medium text-white">{b.brand}</td>
                        <td className="py-2.5 tabular-nums text-white/60">{b.orders}</td>
                        <td className="py-2.5 tabular-nums text-white/60">{b.units}</td>
                        <td className="py-2.5 tabular-nums text-emerald-300">{b.winPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartPanel>

            <ChartPanel title="Quality trend" subtitle="Defect & rework %" className="lg:col-span-2">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.quality}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="m" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                    <Line type="monotone" dataKey="defects" name="Defects" stroke={RED} strokeWidth={2} />
                    <Line type="monotone" dataKey="rework" name="Rework" stroke="#F59E0B" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <ChartPanel title="Team activity (mock)" subtitle="Quotes handled · production touches">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.teamActivity}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }} />
                  <Bar dataKey="quotes" name="Quotes" fill={RED} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="production" name="Production" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>
      ) : null}
    </div>
  );
}
