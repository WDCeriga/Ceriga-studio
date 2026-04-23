import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const revenueSeries = [
  { m: 'Jan', revenue: 4200, users: 12 },
  { m: 'Feb', revenue: 5100, users: 18 },
  { m: 'Mar', revenue: 4800, users: 15 },
  { m: 'Apr', revenue: 6200, users: 22 },
];

const breakdown = [
  { name: 'Tech packs', value: 58 },
  { name: 'Custom MOQ', value: 32 },
  { name: 'Add-ons', value: 10 },
];

const periods = ['today', 'week', 'month', 'quarter', 'year', 'all'] as const;

export function SuperAdminStatistics() {
  const [period, setPeriod] = useState<(typeof periods)[number]>('month');

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Statistics</h1>
          <p className="mt-1 text-sm text-white/45">
            Financial performance, user growth, and mix — wire to your analytics backend.
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as (typeof periods)[number])}>
          <SelectTrigger className="w-full border-white/15 bg-white/5 text-white sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="quarter">This quarter</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Revenue (mock)', value: '£6,200' },
          { label: 'New users', value: '22' },
          { label: 'Avg. order value', value: '£412' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{k.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">Revenue & signups</h2>
          <div className="mt-4 h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#CC2D24" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#CC2D24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="m" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#141416',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#CC2D24" fill="url(#fillRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Revenue mix</h2>
          <div className="mt-4 h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.35)" fontSize={11} hide />
                <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{
                    background: '#141416',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#fff',
                  }}
                />
                <Bar dataKey="value" fill="#CC2D24" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
