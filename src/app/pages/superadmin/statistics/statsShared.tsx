import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Factory,
  MessageSquare,
  Package,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { cn } from '../../../components/ui/utils';
import {
  PERIOD_LABELS,
  STATS_PERIODS,
  type StatsPeriod,
  type StatsSectionId,
} from '../../../data/superadminStatsMock';

export const RED = '#CC2D24';

export const chartTooltipStyle = {
  background: '#141416',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#fff',
};

export const axisProps = {
  stroke: 'rgba(255,255,255,0.35)',
  fontSize: 11,
  tickLine: false as const,
  axisLine: false as const,
};

export const gridStroke = 'rgba(255,255,255,0.06)';

const SECTION_ICONS: Record<StatsSectionId, typeof BarChart3> = {
  financial: Wallet,
  users: Users,
  orders: Package,
  'ai-chat': MessageSquare,
  manufacturers: Factory,
  engagement: MessageSquare,
};

export function PeriodSelect({
  period,
  onPeriodChange,
  className,
}: {
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  className?: string;
}) {
  return (
    <Select value={period} onValueChange={(v) => onPeriodChange(v as StatsPeriod)}>
      <SelectTrigger
        className={cn('w-full border-white/15 bg-white/5 text-white sm:w-[200px]', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
        {STATS_PERIODS.map((p) => (
          <SelectItem key={p} value={p}>
            {PERIOD_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatsPageHeader({
  title,
  period,
  onPeriodChange,
  backTo = '/superadmin/statistics',
  backLabel = 'All statistics',
}: {
  title: string;
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        </div>
        <PeriodSelect period={period} onPeriodChange={onPeriodChange} />
      </div>
    </div>
  );
}

export function KpiGrid({
  items,
}: {
  items: { label: string; value: string; delta?: string }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {k.label}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{k.value}</div>
          {k.delta ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              <TrendingUp className="h-3 w-3" />
              {k.delta}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ChartPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5', className)}
    >
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-4 h-[260px] w-full min-w-0">{children}</div>
    </div>
  );
}

export function SectionHubCard({
  id,
  title,
  path,
  previewMetrics,
}: {
  id: StatsSectionId;
  title: string;
  path: string;
  previewMetrics: { label: string; value: string; delta?: string }[];
}) {
  const Icon = SECTION_ICONS[id];

  return (
    <Link
      to={path}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] p-5 transition hover:border-[#CC2D24]/35 hover:bg-[#141416]"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.06]"
        style={{ background: RED }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[#CC2D24]">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#CC2D24]" />
      </div>
      <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
        {previewMetrics.map((m) => (
          <div key={m.label}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {m.label}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums text-white">{m.value}</span>
              {m.delta ? (
                <span className="text-[11px] font-medium text-emerald-300">{m.delta}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}

export function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {columns.map((c) => (
                <th key={c} className="pb-3 pr-4 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/[0.04] last:border-0">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      'py-3 pr-4',
                      j === 0 ? 'font-medium text-white' : 'tabular-nums text-white/70',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
