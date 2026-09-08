import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRightLeft, Clock, Package, Route } from 'lucide-react';
import { toast } from 'sonner';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { STATUS_LABELS, formatMoney, type OrderStatus, type SuperAdminOrder } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type AssignAction = {
  orderId: string;
  productName: string;
  mode: 'assign' | 'reroute';
};

type ConsoleRow = {
  order: SuperAdminOrder;
  overdue: boolean;
  slaHoursLeft: number | null;
  needsReroute: boolean;
};

function daysUntil(iso: string, today = new Date().toISOString().slice(0, 10)): number {
  const a = new Date(today + 'T12:00:00').getTime();
  const b = new Date(iso + 'T12:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

function buildRows(orders: SuperAdminOrder[]): ConsoleRow[] {
  const today = new Date().toISOString().slice(0, 10);
  return orders
    .filter((o) => o.kind === 'custom_clothing')
    .filter((o) => ['submitted', 'assigned', 'priced', 'pending_review'].includes(o.status))
    .map((order) => {
      const quoteOpen = !order.quoteTiers?.length;
      const overdue = Boolean(
        order.dueQuoteBy &&
          quoteOpen &&
          !['quoted', 'priced', 'pending_review'].includes(order.factoryQuoteStatus ?? '') &&
          order.dueQuoteBy < today,
      );
      return {
        order,
        overdue,
        slaHoursLeft: order.dueQuoteBy && quoteOpen ? daysUntil(order.dueQuoteBy, today) * 24 : null,
        needsReroute: order.factoryQuoteStatus === 'rejected' || Boolean(order.factoryRejectReason),
      };
    })
    .sort((a, b) => {
      if (a.needsReroute !== b.needsReroute) return a.needsReroute ? -1 : 1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const da = a.order.dueQuoteBy ?? '9999';
      const db = b.order.dueQuoteBy ?? '9999';
      return da.localeCompare(db);
    });
}

export function SuperAdminAssignmentConsole() {
  const { orders, manufacturers, loading, patchOrder, refresh } = useSuperadminData();
  const rows = buildRows(orders);
  const activeManufacturers = manufacturers.filter((m) => m.onboardingComplete);

  const [filter, setFilter] = useState<'all' | 'overdue' | 'unassigned' | 'reroute'>('all');
  const [action, setAction] = useState<AssignAction | null>(null);
  const [manufacturerId, setManufacturerId] = useState('');
  const [dueQuoteBy, setDueQuoteBy] = useState(addDaysIso(3));
  const [committing, setCommitting] = useState(false);

  const filtered = rows.filter((r) => {
    if (filter === 'overdue') return r.overdue;
    if (filter === 'unassigned') return !r.order.manufacturerId;
    if (filter === 'reroute') return r.needsReroute;
    return true;
  });

  const overdueCount = rows.filter((r) => r.overdue).length;
  const unassignedCount = rows.filter((r) => !r.order.manufacturerId).length;
  const rerouteCount = rows.filter((r) => r.needsReroute).length;

  const openAssign = (orderId: string, productName: string, mode: 'assign' | 'reroute') => {
    setManufacturerId(activeManufacturers[0]?.userId ?? '');
    setDueQuoteBy(addDaysIso(3));
    setAction({ orderId, productName, mode });
  };

  const commit = () => {
    if (!action || !manufacturerId) {
      toast.error('Pick a manufacturer');
      return;
    }
    if (!dueQuoteBy) {
      toast.error('Set a quote due date');
      return;
    }
    const target = activeManufacturers.find((m) => m.userId === manufacturerId);
    setCommitting(true);
    void (async () => {
      const ok = await patchOrder(action.orderId, {
        assignedManufacturerId: manufacturerId,
        dueQuoteBy,
      });
      setCommitting(false);
      if (!ok) {
        toast.error('Could not update assignment');
        return;
      }
      toast.success(
        `${action.mode === 'reroute' ? 'Re-routed' : 'Assigned'} to ${target?.factoryName ?? 'manufacturer'} — notified in their portal`,
      );
      setAction(null);
      void refresh();
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Route className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Routing</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Quote & assignment
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Assign factories, chase overdue quote SLAs, and re-route after declines.
          </p>
        </div>
        <Link
          to="/superadmin/orders/review"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#252528] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          Pricing review queue
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setFilter('overdue')}
          className={cn(
            'rounded-2xl border px-4 py-4 text-left transition',
            filter === 'overdue'
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-[#252528] bg-[#111113] hover:bg-white/[0.03]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Overdue quotes
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">{overdueCount}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('unassigned')}
          className={cn(
            'rounded-2xl border px-4 py-4 text-left transition',
            filter === 'unassigned'
              ? 'border-sky-500/40 bg-sky-500/10'
              : 'border-[#252528] bg-[#111113] hover:bg-white/[0.03]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Unassigned
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-200">{unassignedCount}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('reroute')}
          className={cn(
            'rounded-2xl border px-4 py-4 text-left transition',
            filter === 'reroute'
              ? 'border-[#CC2D24]/40 bg-[#CC2D24]/10'
              : 'border-[#252528] bg-[#111113] hover:bg-white/[0.03]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Need re-route
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-200">{rerouteCount}</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all' as const, label: 'All pipeline' },
            { id: 'overdue' as const, label: 'Overdue' },
            { id: 'unassigned' as const, label: 'Unassigned' },
            { id: 'reroute' as const, label: 'Re-route' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
              filter === f.id
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                : 'border-[#252528] text-white/45 hover:text-white/75',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#252528] bg-[#111113]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-[#252528] bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Quote due</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-white/40">
                    {loading ? 'Loading pipeline…' : 'Nothing in this filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map(({ order, overdue, slaHoursLeft, needsReroute }) => (
                  <tr key={order.id} className="border-b border-[#252528] last:border-0">
                    <td className="px-4 py-3.5 align-middle">
                      <Link
                        to={`/superadmin/orders/${order.id}`}
                        className="text-sm font-medium text-white hover:text-[#CC2D24]"
                      >
                        {order.productName}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-white/35">
                        {order.id} · {order.userName}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {order.manufacturerName ? (
                        <p className="text-sm text-white/80">{order.manufacturerName}</p>
                      ) : (
                        <span className="text-[12px] text-sky-200/80">Unassigned</span>
                      )}
                      {order.assignedAt ? (
                        <p className="text-[10px] text-white/35">
                          Assigned {formatDate(order.assignedAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span
                        className={cn(
                          'text-[12px] tabular-nums',
                          overdue ? 'text-amber-200' : 'text-white/70',
                        )}
                      >
                        {formatDate(order.dueQuoteBy)}
                      </span>
                      {overdue ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-200">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {slaHoursLeft == null ? (
                        <span className="text-[12px] text-white/35">—</span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[12px] tabular-nums',
                            slaHoursLeft < 0 ? 'text-amber-200' : 'text-white/65',
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {slaHoursLeft < 0
                            ? `${Math.abs(slaHoursLeft)}h late`
                            : `${slaHoursLeft}h left`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <p className="text-[12px] text-white/65">{STATUS_LABELS[order.status]}</p>
                      {order.factoryQuoteStatus ? (
                        <p className="text-[10px] text-white/35">
                          Factory: {order.factoryQuoteStatus}
                        </p>
                      ) : null}
                      {needsReroute && order.factoryRejectReason ? (
                        <p className="mt-1 max-w-[200px] text-[10px] text-red-200/80">
                          Declined: {order.factoryRejectReason}
                        </p>
                      ) : null}
                      {order.quoteTiers?.length ? (
                        <p className="text-[10px] text-emerald-300/80">
                          Quote {formatMoney(order.quoteTiers[0].manufacturerQuoteCents)}+
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {!order.manufacturerId ? (
                          <Button
                            size="sm"
                            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                            onClick={() => openAssign(order.id, order.productName, 'assign')}
                          >
                            <Package className="mr-1 h-3.5 w-3.5" />
                            Assign
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/15 bg-white/[0.03] text-white/80"
                            onClick={() => openAssign(order.id, order.productName, 'reroute')}
                          >
                            <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                            Re-route
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {action ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#252528] bg-[#0c0c0e]/95 p-4 backdrop-blur sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px] sm:rounded-2xl sm:border">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {action.mode === 'reroute' ? 'Re-route' : 'Assign'} · {action.productName}
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[11px] text-white/45">Manufacturer</p>
              <Select value={manufacturerId} onValueChange={setManufacturerId}>
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue placeholder="Select factory" />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  {activeManufacturers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.factoryName}
                      {m.moq ? ` · MOQ ${m.moq}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[11px] text-white/45">Quote due</p>
              <Input
                type="date"
                value={dueQuoteBy}
                onChange={(e) => setDueQuoteBy(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                onClick={commit}
                disabled={committing}
              >
                {committing ? 'Saving…' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-transparent text-white/70"
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
