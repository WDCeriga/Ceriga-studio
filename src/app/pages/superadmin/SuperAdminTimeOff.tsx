import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarOff, Check, Factory, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  approveFactoryTimeOff,
  declineFactoryTimeOff,
  formatFactoryDate,
  getFactoryTimeOffSummary,
  getFactoryWorkspace,
  holidayEndDate,
  listPendingTimeOffRequests,
  type FactoryHoliday,
} from '../../data/manufacturerPortalMock';
import { listFactoryCapacityOverviews } from '../../data/superadminOpsMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';

function scopeLabel(h: FactoryHoliday): string {
  if (h.scope === 'week') return 'Week off';
  if (h.scope === 'range') return `${h.days ?? 1} days`;
  return '1 day';
}

function rangeText(h: FactoryHoliday): string {
  if (h.scope === 'day') return formatFactoryDate(h.date);
  return `${formatFactoryDate(h.date)} – ${formatFactoryDate(holidayEndDate(h))}`;
}

export function SuperAdminTimeOff() {
  const [tick, setTick] = useState(0);
  void tick;
  const ws = getFactoryWorkspace();
  const summary = useMemo(() => getFactoryTimeOffSummary(), [tick]);
  const pending = useMemo(() => listPendingTimeOffRequests(), [tick]);
  const capacity = useMemo(() => listFactoryCapacityOverviews(), [tick]);

  const [action, setAction] = useState<{
    id: string;
    name: string;
    kind: 'approve' | 'decline';
  } | null>(null);

  const commit = () => {
    if (!action) return;
    if (action.kind === 'approve') {
      approveFactoryTimeOff(action.id);
      toast.success(`Approved “${action.name}” — factory calendar updated`);
    } else {
      declineFactoryTimeOff(action.id);
      toast.success(`Declined “${action.name}”`);
    }
    setAction(null);
    setTick((n) => n + 1);
  };

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
          Cross-factory load, blocked weeks, and time-off approvals — so Ceriga doesn’t over-assign.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
        <h2 className="text-sm font-semibold text-white">Factory capacity map</h2>
        <p className="mt-0.5 text-[11px] text-white/40">
          Live data for North Mills; other partners show seeded capacity signals.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {capacity.map((f) => (
            <Link
              key={f.factoryId}
              to={`/superadmin/manufacturers/${f.userId}`}
              className="rounded-xl border border-white/[0.08] bg-black/20 p-4 transition hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{f.factoryName}</p>
                  <p className="text-[10px] text-white/40">
                    {f.monthlyCapacity.toLocaleString()} u/mo
                    {f.live ? ' · live' : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    f.loadPct >= 85
                      ? 'bg-amber-500/15 text-amber-200'
                      : 'bg-white/5 text-white/50',
                  )}
                >
                  {f.loadPct}% load
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full',
                    f.loadPct >= 85 ? 'bg-amber-400' : 'bg-[#CC2D24]',
                  )}
                  style={{ width: `${Math.min(100, f.loadPct)}%` }}
                />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-[9px] uppercase tracking-wide text-white/30">Blocked</dt>
                  <dd className="text-sm font-semibold tabular-nums text-amber-100">
                    {f.blockedWeeks}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wide text-white/30">Pending</dt>
                  <dd className="text-sm font-semibold tabular-nums text-violet-200">
                    {f.pendingTimeOff}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wide text-white/30">Holidays</dt>
                  <dd className="text-sm font-semibold tabular-nums text-sky-200">
                    {f.approvedCustomHolidays}
                  </dd>
                </div>
              </dl>
              {f.nextBlockedWeek ? (
                <p className="mt-2 text-[10px] text-white/35">
                  Next block · {formatFactoryDate(f.nextBlockedWeek)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Pending</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-violet-200">
            {summary.pending.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Approved custom
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-200">
            {summary.approved.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Declined</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white/50">
            {summary.declined.length}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Time-off awaiting review</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/40">
              <Factory className="h-3.5 w-3.5" />
              {ws.factoryName}
              <Link
                to={`/superadmin/manufacturers/${ws.factoryId === 'm1' ? 'u2' : ws.factoryId}`}
                className="text-[#CC2D24] hover:underline"
              >
                Open manufacturer
              </Link>
            </p>
          </div>
        </div>

        {pending.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/40">
            No pending time-off requests.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {pending.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-white">{h.name}</p>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    {scopeLabel(h)} · {rangeText(h)}
                    {h.requestedAt ? ` · requested ${formatFactoryDate(h.requestedAt)}` : ''}
                  </p>
                  {h.note ? <p className="mt-1 text-[11px] text-white/35">{h.note}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={() => setAction({ id: h.id, name: h.name, kind: 'approve' })}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/5"
                    onClick={() => setAction({ id: h.id, name: h.name, kind: 'decline' })}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.approved.length > 0 ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
          <h2 className="text-sm font-semibold text-white">Recently approved</h2>
          <ul className="mt-3 space-y-2">
            {summary.approved.slice(0, 8).map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2 text-[12px]"
              >
                <span className="font-medium text-sky-50">{h.name}</span>
                <span className="text-white/40">
                  {scopeLabel(h)} · {rangeText(h)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={action != null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={action?.kind === 'approve' ? 'Approve time off?' : 'Decline time off?'}
        description={
          action?.kind === 'approve'
            ? `Approve “${action?.name ?? ''}” for ${ws.factoryName}. Their capacity calendar will show it as an approved holiday and Ceriga will avoid assigning into those dates.`
            : `Decline “${action?.name ?? ''}”. The factory can withdraw or submit a new request.`
        }
        confirmLabel={action?.kind === 'approve' ? 'Approve' : 'Decline'}
        onConfirm={commit}
      />
    </div>
  );
}
