import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronRight, Factory, Search } from 'lucide-react';
import {
  getManufacturerOrderStats,
  getManufacturerOverviewStats,
  getManufacturerPlanLabel,
  listManufacturerProfiles,
  type GarmentCategory,
  type ManufacturerProfile,
} from '../../data/manufacturersMock';
import { cn } from '../../components/ui/utils';

const RED = '#CC2D24';
const AMBER = '#F59E0B';

const chartTooltipStyle = {
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

const STATUS_STYLE: Record<ManufacturerProfile['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  paused: 'border-white/15 bg-white/5 text-white/50',
  onboarding: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
};

function GarmentChip({ label }: { label: GarmentCategory | string }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/65">
      {label}
    </span>
  );
}

export function SuperAdminManufacturers() {
  const [search, setSearch] = useState('');
  const [garmentFilter, setGarmentFilter] = useState<GarmentCategory | 'all'>('all');
  const overview = getManufacturerOverviewStats();
  const profiles = listManufacturerProfiles();

  const garmentFilters = useMemo(() => {
    const set = new Set<GarmentCategory>();
    for (const p of profiles) {
      for (const g of p.garmentTypes) set.add(g);
    }
    return Array.from(set).sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (garmentFilter !== 'all' && !p.garmentTypes.includes(garmentFilter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.garmentTypes.some((g) => g.toLowerCase().includes(q))
      );
    });
  }, [profiles, search, garmentFilter]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <Factory className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Partners</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Manufacturers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/45">
          Control factory partners — performance, plans, portal access, and assigned work.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active partners', value: String(overview.activePartners) },
          { label: 'Orders assigned', value: String(overview.totalOrdersAssigned) },
          { label: 'Avg. quote time', value: `${overview.avgQuoteDays}d` },
          { label: 'On-time rate', value: `${overview.avgOnTimeRate}%` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-4"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {kpi.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">Partner throughput</h2>
          <div className="mt-4 h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.throughput}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-10} textAnchor="end" height={46} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="orders" fill={RED} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Garment coverage</h2>
          <p className="mt-1 text-[11px] text-white/35">How many factories cover each product type</p>
          <ul className="mt-4 space-y-2.5">
            {overview.garmentCoverage.map((row) => (
              <li key={row.type} className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/75">{row.type}</span>
                <div className="flex min-w-[120px] items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.partners / Math.max(overview.activePartners, 1)) * 100}%`,
                        background: AMBER,
                      }}
                    />
                  </div>
                  <span className="w-4 text-right text-[11px] tabular-nums text-white/45">
                    {row.partners}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">All manufacturers</h2>
            <p className="mt-1 text-[11px] text-white/35">
              {filtered.length} of {profiles.length} partners
            </p>
          </div>
          <div className="relative max-w-md flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, location, garments…"
              className="h-9 w-full border-0 border-b border-white/15 bg-transparent pl-7 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#CC2D24]/70"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGarmentFilter('all')}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
              garmentFilter === 'all'
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-white'
                : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80',
            )}
          >
            All types
          </button>
          {garmentFilters.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGarmentFilter(g)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                garmentFilter === g
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                  : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80',
              )}
            >
              {g}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#111113] px-6 py-16 text-center">
            <p className="text-sm text-white/45">No manufacturers match.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((profile) => {
              const stats = getManufacturerOrderStats(profile.entityId);
              const plan = getManufacturerPlanLabel(profile.userId);
              return (
                <Link
                  key={profile.userId}
                  to={`/superadmin/manufacturers/${profile.userId}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 transition hover:border-white/[0.14] sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{profile.name}</h3>
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          STATUS_STYLE[profile.status],
                        )}
                      >
                        {profile.status}
                      </span>
                      <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                        {plan}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-white/40">
                      {profile.location}, {profile.country} · MOQ {profile.moq} · Lead {profile.leadTimeDays}d
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {profile.garmentTypes.map((g) => (
                        <GarmentChip key={g} label={g} />
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-6 sm:gap-8">
                    <div className="grid grid-cols-3 gap-4 text-center sm:gap-5">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/35">Orders</div>
                        <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                          {stats.totalOrders}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/35">Quote</div>
                        <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                          {profile.avgQuoteDays}d
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/35">On-time</div>
                        <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                          {profile.onTimeRate}%
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#CC2D24]" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
