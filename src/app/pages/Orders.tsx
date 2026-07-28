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
      <span className="ceriga-mono inline-flex items-center gap-1 rounded-[3px] border border-[#252528] bg-[#111113] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#A3A3A8]">
        <FileText className="h-3 w-3 shrink-0 text-[#8A8A90]" aria-hidden />
        Tech pack
      </span>
    );
  }
  return (
    <span className="ceriga-mono inline-flex items-center gap-1 rounded-[3px] border border-[#5A4530] bg-[#1C0F0F] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#E5534A]">
      <Factory className="h-3 w-3 shrink-0 text-[#CC2D24]" aria-hidden />
      Production
    </span>
  );
}

function TrackingCell({ order }: { order: UserOrder }) {
  if (order.kind === 'tech-pack') {
    return (
      <div className="max-w-[200px]">
        <span className="text-xs text-[#6B6B72]">—</span>
        <p className="mt-0.5 text-[10px] leading-snug text-[#45454B]">Digital delivery · no shipment</p>
      </div>
    );
  }
  if (order.tracking) {
    return (
      <div className="flex items-center gap-2">
        <span className="ceriga-mono break-all text-[11px] text-[#E5534A]">{order.tracking}</span>
        <button
          type="button"
          className="shrink-0 text-[#6B6B72] hover:text-[#A3A3A8]"
          aria-label="Copy tracking number"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div>
      <span className="text-xs text-[#8A8A90]">Pending</span>
      <p className="mt-0.5 text-[10px] text-[#45454B]">Assigned when shipped</p>
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
    <div className="ceriga-page overflow-x-hidden">
      <div className="mx-auto max-w-[1240px] px-4 pb-3 pt-7 sm:px-8 lg:px-10">
        <div className="ceriga-page-eyebrow">Order management</div>
        <h1 className="ceriga-page-title">Orders</h1>
        <p className="ceriga-page-sub">
          Open any order to see quotes, pay for a tier, track production, or download your tech pack.
        </p>
      </div>

      <div className="mx-auto max-w-[1240px] border-b border-[#252528] px-4 py-3 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A8A90]" />
            <Input
              type="text"
              placeholder="Search by order ID or product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-[#252528] bg-[#161618] pl-9 text-xs text-[#F0EEEE] placeholder:text-[#6B6B72]"
            />
          </div>

          <div
            className="grid grid-cols-3 gap-1 rounded-[6px] border border-[#252528] bg-[#111113] p-1 sm:max-w-sm"
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
                  'ceriga-mono whitespace-nowrap rounded-[4px] px-2 py-2 text-[10px] font-medium uppercase tracking-[0.06em] transition',
                  kindFilter === f.key
                    ? 'border border-[#CC2D24]/40 bg-[#1C0F0F] text-[#E5534A]'
                    : 'text-[#8A8A90] hover:text-[#F0EEEE]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 lg:px-10">
        {orders.length === 0 ? (
          <div className="ceriga-card py-12 text-center">
            <Package className="mx-auto mb-2 h-10 w-10 text-[#45454B]" />
            <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">No orders yet</h3>
            <p className="mb-3 text-xs text-[#6B6B72]">
              Create a tech pack or place a production order to see it here.
            </p>
            <Button asChild className="h-8 bg-[#CC2D24] text-[11px] font-semibold text-white hover:bg-[#E5534A]">
              <Link to="/catalog">Browse catalog</Link>
            </Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="ceriga-card px-4 py-10 text-center">
            <p className="text-sm text-[#8A8A90]">No orders match your search or filter.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => openOrder(order.id)}
                  className="ceriga-card w-full p-4 text-left transition-colors hover:border-[#333338]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5">
                        <OrderKindBadge kind={order.kind} />
                      </div>
                      <p className="text-[13px] font-semibold leading-snug text-[#F0EEEE]">
                        {order.productName}
                      </p>
                      <p className="ceriga-mono mt-1 text-[11px] text-[#6B6B72]">{order.id}</p>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 text-[10px]',
                        ORDER_STATUS_COLORS[order.status] ?? 'bg-[#252528] text-[#A3A3A8]',
                      )}
                    >
                      {order.statusLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-[#252528] pt-3">
                    <div>
                      <p className="ceriga-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B72]">Date</p>
                      <p className="mt-0.5 text-xs text-[#F0EEEE]">{order.orderDate}</p>
                    </div>
                    <div>
                      <p className="ceriga-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B72]">Total</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-[#F0EEEE]">
                        {formatTotal(order)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="ceriga-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B72]">Details</p>
                      <p className="mt-0.5 text-xs text-[#F0EEEE]">{listQuantityLabel(order) ?? order.garmentType}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[800px] overflow-hidden rounded-[6px] border border-[#252528] bg-[#161618]">
                <table className="w-full">
                  <thead className="border-b border-[#252528] bg-[#111113]">
                    <tr>
                      <th className="ceriga-mono px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B6B72]">
                        Type / order
                      </th>
                      <th className="ceriga-mono px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B6B72]">
                        Tracking
                      </th>
                      <th className="ceriga-mono px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B6B72]">
                        Date
                      </th>
                      <th className="ceriga-mono px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B6B72]">
                        Status
                      </th>
                      <th className="ceriga-mono px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B6B72]">
                        Total
                      </th>
                      <th className="w-12 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252528]">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="cursor-pointer transition-colors hover:bg-[#1C1C1E]"
                        onClick={() => openOrder(order.id)}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="mb-1.5">
                            <OrderKindBadge kind={order.kind} />
                          </div>
                          <div className="text-[13px] font-medium text-[#F0EEEE]">{order.productName}</div>
                          <div className="ceriga-mono mt-0.5 text-[11px] text-[#6B6B72]">{order.id}</div>
                          <div className="mt-0.5 text-[11px] text-[#8A8A90]">
                            {listQuantityLabel(order) ?? order.garmentType}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <TrackingCell order={order} />
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-[#A3A3A8]">{order.orderDate}</td>
                        <td className="px-4 py-3 align-top">
                          <Badge
                            className={cn(
                              'text-[10px]',
                              ORDER_STATUS_COLORS[order.status] ?? 'bg-[#252528] text-[#A3A3A8]',
                            )}
                          >
                            {order.statusLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top text-right text-sm font-semibold tabular-nums text-[#F0EEEE]">
                          {formatTotal(order)}
                        </td>
                        <td className="px-2 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                              className="rounded-[4px] p-2 text-[#8A8A90] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === order.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-[6px] border border-[#252528] bg-[#161618] py-1 shadow-xl">
                                  <Link
                                    to={`/orders/${order.id}`}
                                    className="block px-3 py-2 text-xs text-[#F0EEEE] hover:bg-[#1C1C1E]"
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
