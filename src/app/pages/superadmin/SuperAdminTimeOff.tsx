import { useMemo } from 'react';
import { Link } from 'react-router';
import { CalendarOff, Factory } from 'lucide-react';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';
import { cn } from '../../components/ui/utils';

export function SuperAdminTimeOff() {
  const { manufacturerList, orders, loading } = useSuperadminData();

  const capacity = useMemo(() => {
    return manufacturerList.map((m) => {
      const assigned = orders.filter((o) => o.manufacturerId === m.userId).length;
      const loadPct =
        m.capacityUnitsPerMonth > 0
          ? Math.min(100, Math.round((assigned / Math.max(m.capacityUnitsPerMonth / 50, 1)) * 100))
          : assigned > 0
            ? 40
            : 0;
      return {
        id: m.userId,
        name: m.name,
        location: `${m.location}, ${m.country}`,
        monthlyCapacity: m.capacityUnitsPerMonth,
        assignedOrders: assigned,
        loadPct,
        status: m.status,
      };
    });
  }, [manufacturerList, orders]);

  if (loading) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <CalendarOff className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Capacity</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Capacity & holidays
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Cross-factory load from assigned orders. Holiday approvals will appear when factories
          submit time-off from the manufacturer portal.
        </p>
      </div>

      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
        <h2 className="text-sm font-semibold text-white">Factory capacity map</h2>
        <p className="mt-0.5 text-[11px] text-white/40">
          Based on manufacturer profiles and current order assignments.
        </p>
        {capacity.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/40">No manufacturers yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {capacity.map((f) => (
              <Link
                key={f.id}
                to={`/superadmin/manufacturers/${f.id}`}
                className="rounded-xl border border-[#252528] bg-white/[0.02] p-4 transition hover:border-white/15"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Factory className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <h3 className="truncate text-sm font-semibold text-white">{f.name}</h3>
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">{f.location}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      f.status === 'active'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/15 bg-white/5 text-white/50',
                    )}
                  >
                    {f.status}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-white/45">
                    <span>Load signal</span>
                    <span className="tabular-nums text-white/70">{f.loadPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#CC2D24]"
                      style={{ width: `${f.loadPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">
                    {f.assignedOrders} orders · capacity {f.monthlyCapacity || '—'} / mo
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
        <h2 className="text-sm font-semibold text-white">Pending time-off</h2>
        <p className="mt-0.5 text-[11px] text-white/40">
          Approvals from manufacturer holiday requests.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-white/12 px-4 py-12 text-center">
          <p className="text-sm text-white/45">No pending holiday requests.</p>
        </div>
      </section>
    </div>
  );
}
