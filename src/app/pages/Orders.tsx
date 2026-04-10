import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Package, Search, MoreVertical, Copy, FileText, Factory } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../components/ui/utils';

export type OrderKind = 'tech-pack' | 'production';

const statusColors: Record<string, string> = {
  draft: 'bg-white/10 text-white/60',
  'requires-action': 'bg-amber-500/20 text-amber-300',
  submitted: 'bg-blue-500/20 text-blue-300',
  priced: 'bg-amber-500/20 text-amber-300',
  accepted: 'bg-teal-500/20 text-teal-300',
  processing: 'bg-purple-500/20 text-purple-300',
  shipping: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-green-500/20 text-green-300',
  /** Tech pack — digital fulfilment */
  paid: 'bg-sky-500/20 text-sky-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
  refunded: 'bg-white/10 text-white/50',
};

type OrderRow = {
  id: string;
  kind: OrderKind;
  productName: string;
  garmentType: string;
  /** Units for production; tech packs use null (not applicable) */
  quantity: number | null;
  status: string;
  statusLabel: string;
  orderDate: string;
  total: number;
  /** Carrier tracking — only meaningful for production orders */
  tracking?: string | null;
};

const mockOrders: OrderRow[] = [
  {
    id: 'tp-001',
    kind: 'tech-pack',
    productName: 'Studio — French Terry crew',
    garmentType: 'Sweatshirt',
    quantity: null,
    status: 'ready',
    statusLabel: 'Download ready',
    orderDate: '8 Apr 2026',
    total: 29.0,
    tracking: null,
  },
  {
    id: 'tp-002',
    kind: 'tech-pack',
    productName: 'Studio — Organic cotton tee',
    garmentType: 'T-Shirt',
    quantity: null,
    status: 'paid',
    statusLabel: 'Paid',
    orderDate: '5 Apr 2026',
    total: 29.0,
    tracking: null,
  },
  {
    id: 'ord-001',
    kind: 'production',
    productName: 'Premium Cotton T-Shirt',
    garmentType: 'T-Shirt',
    quantity: 250,
    status: 'processing',
    statusLabel: 'Processing',
    orderDate: '14 Mar 2026',
    total: 3247.5,
    tracking: null,
  },
  {
    id: 'ord-002',
    kind: 'production',
    productName: 'Classic Pullover Hoodie',
    garmentType: 'Hoodie',
    quantity: 150,
    status: 'priced',
    statusLabel: 'Priced',
    orderDate: '10 Mar 2026',
    total: 4275.0,
    tracking: null,
  },
  {
    id: 'ord-003',
    kind: 'production',
    productName: 'Performance Joggers',
    garmentType: 'Trousers',
    quantity: 100,
    status: 'completed',
    statusLabel: 'Completed',
    orderDate: '2 Mar 2026',
    total: 2600.0,
    tracking: 'DHL 3SADKE991023',
  },
  {
    id: 'ord-004',
    kind: 'production',
    productName: 'French Terry Sweatshirt',
    garmentType: 'Sweatshirt',
    quantity: 200,
    status: 'shipping',
    statusLabel: 'Shipping',
    orderDate: '28 Feb 2026',
    total: 4400.0,
    tracking: 'UPS 1Z999AA10123456784',
  },
];

const kindFilters: { key: 'all' | OrderKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tech-pack', label: 'Tech packs' },
  { key: 'production', label: 'Production' },
];

function OrderKindBadge({ kind }: { kind: OrderKind }) {
  if (kind === 'tech-pack') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/75',
        )}
      >
        <FileText className="h-3 w-3 shrink-0 text-white/55" aria-hidden />
        Tech pack
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-[#CC2D24]/25 bg-[#CC2D24]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E8A8A4]',
      )}
    >
      <Factory className="h-3 w-3 shrink-0 text-[#CC2D24]/80" aria-hidden />
      Production
    </span>
  );
}

function TrackingCell({ order }: { order: OrderRow }) {
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

export function Orders() {
  const [kindFilter, setKindFilter] = useState<'all' | OrderKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return mockOrders.filter((order) => {
      if (kindFilter !== 'all' && order.kind !== kindFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.productName.toLowerCase().includes(q) ||
        order.garmentType.toLowerCase().includes(q)
      );
    });
  }, [kindFilter, searchQuery]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F]">
      <div className="border-b border-white/10 px-4 pb-3 pt-4 sm:px-5 md:px-7">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">ORDER MANAGEMENT</div>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-1px] text-white">
          Orders
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/45">
          Tech pack purchases (PDF exports) are separate from production orders placed with our manufacturer — tracking
          and fulfilment status apply only to production.
        </p>
      </div>

      <div className="border-b border-white/10 bg-[#0F0F0F] px-4 py-3 sm:px-5 md:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <Input
              type="text"
              placeholder="Search by order ID or product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 border-white/10 bg-white/5 pl-9 text-xs text-white placeholder:text-white/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">Oldest first</span>

            <button type="button" className="rounded p-1 hover:bg-white/10">
              <svg className="h-3.5 w-3.5 text-white/60" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 3V13M8 13L12 9M8 13L4 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:ml-3">
              {kindFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setKindFilter(f.key)}
                  className={`rounded border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    kindFilter === f.key
                      ? 'border-[#CC2D24] bg-[#CC2D24] text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 md:px-7 md:py-6">
        {mockOrders.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 py-12 text-center">
            <Package className="mx-auto mb-2 h-10 w-10 text-white/20" />
            <h3 className="mb-2 text-base font-semibold text-white">No orders yet</h3>
            <p className="mb-3 text-xs text-white/50">Create a tech pack or place a production order to see it here.</p>
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
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/10 bg-[#141416] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <OrderKindBadge kind={order.kind} />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/38">Reference</p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-snug text-white">{order.productName}</p>
                      <p className="mt-1 font-mono text-[11px] text-white/45">{order.id}</p>
                      <p className="mt-1 text-[11px] text-white/40">{order.garmentType}</p>
                    </div>
                    <Badge className={`${statusColors[order.status] ?? 'bg-white/10 text-white/60'} shrink-0 text-[10px]`}>
                      {order.statusLabel}
                    </Badge>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/38">Date</p>
                      <p className="mt-0.5 text-xs text-white/85">{order.orderDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/38">Total</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                        €{order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/38">
                        {order.kind === 'tech-pack' ? 'Type' : 'Quantity'}
                      </p>
                      <p className="mt-0.5 text-xs text-white/85">
                        {order.kind === 'tech-pack' ? 'PDF export' : `${order.quantity} units`}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-3">
                    {order.kind === 'tech-pack' ? (
                      <p className="text-[11px] leading-relaxed text-white/40">
                        No shipping or tracking — your files are delivered in-app and by email.
                      </p>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-white/38">Tracking</p>
                        {order.tracking ? (
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-blue-400/90">
                            <span className="truncate font-mono">{order.tracking}</span>
                            <button
                              type="button"
                              className="shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                              aria-label="Copy tracking"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-white/45">Pending — assigned when shipped</p>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                          className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/10"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === order.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute bottom-full right-0 z-20 mb-1 w-40 rounded-xl border border-white/10 bg-[#1A1A1A] py-1 shadow-xl">
                              <Link
                                to={`/orders/${order.id}`}
                                className="block px-3 py-2 text-xs text-white hover:bg-white/10"
                                onClick={() => setOpenMenuId(null)}
                              >
                                View details
                              </Link>
                              {order.kind === 'production' ? (
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                >
                                  Order again
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
                      <tr key={order.id} className="transition-colors hover:bg-white/[0.04]">
                        <td className="px-4 py-3 align-top">
                          <div className="mb-1.5">
                            <OrderKindBadge kind={order.kind} />
                          </div>
                          <div className="text-[13px] font-medium text-white">{order.productName}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-white/45">{order.id}</div>
                          <div className="mt-0.5 text-[11px] text-white/38">
                            {order.garmentType}
                            {order.kind === 'production' && order.quantity != null ? (
                              <span className="text-white/28"> · {order.quantity} units</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <TrackingCell order={order} />
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-white/80">{order.orderDate}</td>
                        <td className="px-4 py-3 align-top">
                          <Badge
                            className={`${statusColors[order.status] ?? 'bg-white/10 text-white/60'} text-[10px]`}
                          >
                            {order.statusLabel}
                          </Badge>
                          {order.kind === 'tech-pack' ? (
                            <p className="mt-1 max-w-[140px] text-[10px] leading-snug text-white/30">
                              Purchase status only — not production.
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top text-right text-sm font-semibold tabular-nums text-white">
                          €{order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-3 align-top text-right">
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
                                  {order.kind === 'production' ? (
                                    <button
                                      type="button"
                                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                    >
                                      Order again
                                    </button>
                                  ) : null}
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
