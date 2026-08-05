import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Package, Search, MoreVertical, Copy, FileText, Factory } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../components/ui/utils';
import {
  listQuantityLabel,
  ORDER_STATUS_COLORS,
  useUserOrders,
  type UserOrder,
  type UserOrderKind,
} from '../data/userOrders';

const kindFilters: { key: 'all' | UserOrderKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tech-pack', label: 'Tech pack' },
  { key: 'production', label: 'Production' },
];

function OrderKindBadge({ kind }: { kind: UserOrderKind }) {
  if (kind === 'tech-pack') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/75">
        <FileText className="h-3 w-3 shrink-0 text-white/55" aria-hidden />
        Tech pack
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#CC2D24]/25 bg-[#CC2D24]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E8A8A4]">
      <Factory className="h-3 w-3 shrink-0 text-[#CC2D24]/80" aria-hidden />
      Production
    </span>
  );
}

function TrackingCell({ order }: { order: UserOrder }) {
  if (order.kind === 'tech-pack') {
    return (
      <div className="max-w-[200px]">
        <span className="text-xs text-white/35">—</span>
        <p className="mt-0.5 text-[10px] leading-snug text-white/32">Digital delivery · no shipment</p>
      </div>
    );
  }
  if (order.tracking) {
    return (
      <div className="flex items-center gap-2">
        <span className="break-all font-mono text-[11px] text-blue-400/95">{order.tracking}</span>
        <button
          type="button"
          className="shrink-0 text-white/35 hover:text-white/60"
          aria-label="Copy tracking number"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div>
      <span className="text-xs text-white/40">Pending</span>
      <p className="mt-0.5 text-[10px] text-white/28">Assigned when shipped</p>
    </div>
  );
}

function formatTotal(order: UserOrder): string {
  if (order.total == null) return '—';
  return `€${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function Orders() {
  const navigate = useNavigate();
  const orders = useUserOrders();
  const [kindFilter, setKindFilter] = useState<'all' | UserOrderKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (kindFilter !== 'all' && order.kind !== kindFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.productName.toLowerCase().includes(q) ||
        order.garmentType.toLowerCase().includes(q)
      );
    });
  }, [orders, kindFilter, searchQuery]);

  const openOrder = (id: string) => navigate(`/orders/${id}`);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F]">
      <div className="border-b border-white/10 px-4 pb-3 pt-4 sm:px-5 md:px-7">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
          ORDER MANAGEMENT
        </div>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-1px] text-white">
          Orders
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/45">
          Open any order to see quotes, pay for a tier, track production, or download your tech pack.
        </p>
      </div>

      <div className="border-b border-white/10 bg-[#0F0F0F] px-4 py-3 sm:px-5 md:px-7">
        <div className="flex flex-col gap-3">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <Input
              type="text"
              placeholder="Search by order ID or product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-white/10 bg-white/5 pl-9 text-xs text-white placeholder:text-white/30"
            />
          </div>

          <div
            className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/30 p-1 sm:max-w-sm"
            role="tablist"
            aria-label="Filter orders by type"
          >
            {kindFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={kindFilter === f.key}
                onClick={() => setKindFilter(f.key)}
                className={cn(
                  'whitespace-nowrap rounded-md px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition',
                  kindFilter === f.key
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/65',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 md:px-7 md:py-6">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 py-12 text-center">
            <Package className="mx-auto mb-2 h-10 w-10 text-white/20" />
            <h3 className="mb-2 text-base font-semibold text-white">No orders yet</h3>
            <p className="mb-3 text-xs text-white/50">
              Create a tech pack or place a production order to see it here.
            </p>
            <Button
              asChild
              className="h-7 bg-[#CC2D24] text-[10px] font-semibold text-white hover:bg-[#CC2D24]/90"
            >
              <Link to="/catalog">Browse catalog</Link>
            </Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center">
            <p className="text-sm text-white/55">No orders match your search or filter.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => openOrder(order.id)}
                  className="w-full rounded-2xl border border-white/10 bg-[#141416] p-4 text-left shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-colors hover:border-white/20"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5">
                        <OrderKindBadge kind={order.kind} />
                      </div>
                      <p className="text-[13px] font-semibold leading-snug text-white">
                        {order.productName}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-white/45">{order.id}</p>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 text-[10px]',
                        ORDER_STATUS_COLORS[order.status] ?? 'bg-white/10 text-white/60',
                      )}
                    >
                      {order.statusLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/38">Date</p>
                      <p className="mt-0.5 text-xs text-white/85">{order.orderDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/38">Total</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                        {formatTotal(order)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/38">Details</p>
                      <p className="mt-0.5 text-xs text-white/85">{listQuantityLabel(order) ?? order.garmentType}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[800px] rounded-xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <thead className="border-b border-white/10 bg-[#0F0F0F]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Type / order
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Tracking
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/45">
                        Total
                      </th>
                      <th className="w-12 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                        onClick={() => openOrder(order.id)}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="mb-1.5">
                            <OrderKindBadge kind={order.kind} />
                          </div>
                          <div className="text-[13px] font-medium text-white">{order.productName}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-white/45">{order.id}</div>
                          <div className="mt-0.5 text-[11px] text-white/38">
                            {listQuantityLabel(order) ?? order.garmentType}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <TrackingCell order={order} />
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-white/80">{order.orderDate}</td>
                        <td className="px-4 py-3 align-top">
                          <Badge
                            className={cn(
                              'text-[10px]',
                              ORDER_STATUS_COLORS[order.status] ?? 'bg-white/10 text-white/60',
                            )}
                          >
                            {order.statusLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top text-right text-sm font-semibold tabular-nums text-white">
                          {formatTotal(order)}
                        </td>
                        <td className="px-2 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                              className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white/80"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === order.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-white/10 bg-[#1A1A1A] py-1 shadow-xl">
                                  <Link
                                    to={`/orders/${order.id}`}
                                    className="block px-3 py-2 text-xs text-white hover:bg-white/10"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    View details
                                  </Link>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
