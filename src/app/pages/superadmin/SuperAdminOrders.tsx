import './superadmin-orders.css';
import {convertMinor} from '../../lib/currency';
import { formatAccountTotal,sumConvertedMinor, displayMoney,useCurrency } from '../../lib/accountCurrency';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calculator,
  CheckCircle2,
  Circle,
  Coins,
  Copy,
  Download,
  Factory,
  FileText,
  MapPin,
  Package,
  Search,
  Shirt,
  Truck,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ORDER_STAGE_GROUPS,
  STATUS_LABELS,
  SUPERADMIN_REVIEW_STATUSES,
  formatMoney,
  getOrderQuoteTiers,
  type OrderKind,
  type OrderStageFilter,
  type OrderStatus,
  type SuperAdminOrder,
} from '../../data/superadminMock';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { DeleteRecordButton } from '../../components/DeleteRecordButton';
import { Button } from '../../components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { cn } from '../../components/ui/utils';
import { ScrollArea } from '../../components/ui/scroll-area';

const TECHPACK_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'submitted', label: 'Payment' },
  { status: 'paid', label: 'Processing' },
  { status: 'completed', label: 'Ready' },
];

const CUSTOM_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'pending_review', label: 'Review' },
  { status: 'sent_to_brand', label: 'To brand' },
  { status: 'in_production', label: 'Production' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'completed', label: 'Done' },
];

const STATUS_RANK: Record<OrderStatus, number> = {
  draft: 0,
  submitted: 1,
  assigned: 2,
  priced: 2,
  pending_review: 3,
  sent_to_brand: 4,
  paid: 4,
  in_production: 5,
  shipped: 6,
  completed: 7,
};

function orderInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

async function copyText(text: string, label: string) { try { await navigator.clipboard.writeText(text); toast.success(`Copied ${label}`); } catch { toast.error('Could not copy. Please select and copy the text.'); } }

const KIND_LABEL: Record<OrderKind, string> = {
  techpack: 'Tech pack',
  custom_clothing: 'Custom clothing',
};

const KIND_STYLE: Record<OrderKind, string> = {
  techpack: 'border-violet-500/30 bg-violet-500/10 text-[#737373]',
  custom_clothing: 'border-sky-500/30 bg-sky-500/10 text-[#737373]',
};

type KindFilter = 'all' | OrderKind;
type SortField = 'order' | 'customer' | 'status' | 'date' | 'price';
type SortDir = 'asc' | 'desc';

const STAGE_LABELS: Record<OrderStageFilter, string> = {
  all: 'All stages',
  review: 'Awaiting your review',
  at_manufacturer: 'At manufacturer',
  with_brand: 'With brand',
  fulfilment: 'In fulfilment',
};

function statusTone(status: OrderStatus) {
  if (status === 'pending_review') return 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-200';
  if (status === 'sent_to_brand' || status === 'paid' || status === 'completed')
    return 'border-emerald-500/30 bg-emerald-500/10 text-[#737373]';
  if (status === 'assigned' || status === 'in_production')
    return 'border-amber-500/30 bg-amber-500/10 text-[#737373]';
  if (status === 'submitted' || status === 'priced')
    return 'border-sky-500/30 bg-sky-500/10 text-[#737373]';
  if (status === 'shipped') return 'border-cyan-500/30 bg-cyan-500/10 text-[#737373]';
  return 'border-[#dedede] bg-[#f7f7f7] text-[#737373]';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function displayPrice(order: SuperAdminOrder) {
  if (order.finalPriceCents != null) return displayMoney(order.finalPriceCents,order.currency);
  if (order.calculatedPriceCents != null) return displayMoney(order.calculatedPriceCents,order.manufacturerCurrency);
  return '—';
}

function orderStatusLabel(order: SuperAdminOrder) {
  if (order.kind === 'techpack') {
    if (order.status === 'completed') return 'Download ready';
    if (order.status === 'paid') return 'Processing';
    if (order.status === 'submitted') return 'Awaiting payment';
  }
  return STATUS_LABELS[order.status];
}

function fulfilmentLabel(order: SuperAdminOrder) {
  if (order.kind === 'techpack') return 'Digital';
  return order.manufacturerName ?? '—';
}

function SortableHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const currencyState=useCurrency();
  const active = sortField === field;
  return (
    <th className={className} aria-sort={active?sortDir==='asc'?'ascending':'descending':'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium transition hover:text-[#262626]',
          active ? 'text-[#262626]' : 'text-[#737373]',
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-[#CC2D24]" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-[#CC2D24]" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-35" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function SuperAdminOrders() {
  const currencyState=useCurrency();
  const navigate = useNavigate();
  const { orders: MOCK_SUPER_ORDERS, loading, error, deleteOrder, refresh } = useSuperadminData();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [stageFilter, setStageFilter] = useState<OrderStageFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const activeOrder = useMemo(
    () => MOCK_SUPER_ORDERS.find((o) => o.id === activeOrderId) ?? null,
    [activeOrderId, MOCK_SUPER_ORDERS],
  );

  const stats = useMemo(() => {
    const awaitingReview = MOCK_SUPER_ORDERS.filter((o) =>
      SUPERADMIN_REVIEW_STATUSES.includes(o.status),
    ).length;
    const atManufacturer = MOCK_SUPER_ORDERS.filter((o) =>
      ORDER_STAGE_GROUPS.at_manufacturer.includes(o.status),
    ).length;
    const totalValue = sumConvertedMinor(MOCK_SUPER_ORDERS.filter(o=>o.finalPriceCents!=null).map(o=>({cents:o.finalPriceCents!,currency:o.currency})));
    return {
      total: MOCK_SUPER_ORDERS.length,
      awaitingReview,
      atManufacturer,
      totalValue,
    };
  }, [MOCK_SUPER_ORDERS,currencyState.currency,currencyState.rates]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_SUPER_ORDERS.filter((o) => {
      if (kindFilter !== 'all' && o.kind !== kindFilter) return false;
      if (stageFilter !== 'all' && !ORDER_STAGE_GROUPS[stageFilter].includes(o.status))
        return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.userName.toLowerCase().includes(q) ||
        o.userEmail.toLowerCase().includes(q) ||
        (o.manufacturerName?.toLowerCase().includes(q) ?? false) ||
        o.deliveryCity.toLowerCase().includes(q) ||
        STATUS_LABELS[o.status].toLowerCase().includes(q)
      );
    });
  }, [MOCK_SUPER_ORDERS, search, kindFilter, stageFilter]);

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'order':
          cmp = a.id.localeCompare(b.id) || a.productName.localeCompare(b.productName);
          break;
        case 'customer':
          cmp = a.userName.localeCompare(b.userName) || a.id.localeCompare(b.id);
          break;
        case 'status':
          cmp =
            STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status]) ||
            a.createdAt.localeCompare(b.createdAt);
          break;
        case 'date':
          cmp = a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
          break;
        case 'price': {
 const price=(o:SuperAdminOrder)=>{try{const amount=o.finalPriceCents??o.calculatedPriceCents,source=o.finalPriceCents!=null?o.currency:o.manufacturerCurrency;return amount==null||!source?null:convertMinor(amount,source,currencyState.currency,currencyState.rates);}catch{return null;}};
 const av=price(a),bv=price(b);if(av===null||bv===null)return av===bv?a.id.localeCompare(b.id):av===null?1:-1;cmp=av-bv||a.id.localeCompare(b.id);break;
 }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredOrders, sortField, sortDir, currencyState.currency, currencyState.rates]);

  const pageCount=Math.max(1,Math.ceil(sortedOrders.length/pageSize));
  const currentPage=Math.min(page,pageCount);
  const visibleOrders=sortedOrders.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const toggleSort = (field: SortField) => {
    setPage(1);
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir(field === 'date' || field === 'price' ? 'desc' : 'asc');
  };

  const hasFilters = kindFilter !== 'all' || stageFilter !== 'all' || search.trim().length > 0;

  return (
    <div className="admin-orders space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            CERIGA / OPERATIONS
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#262626] sm:text-3xl">Orders</h1>
          <p className="orders-intro">Every order in view. A clear next step for each.</p>
        </div>
        {stats.awaitingReview > 0 ? (
          <Button
            className="bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
            onClick={() => navigate('/superadmin/orders/review')}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Review {stats.awaitingReview} price{stats.awaitingReview === 1 ? '' : 's'}
          </Button>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Awaiting review', value: stats.awaitingReview },
          { label: 'At manufacturer', value: stats.atManufacturer },
          {
            label: 'Quoted order value',
            value: formatAccountTotal(stats.totalValue),
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-[#e2e2e2] bg-gradient-to-br from-[#161618] to-[#111113] p-4"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-[#262626]">{loading || error ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <p className="orders-note">Counts cover all orders. Quoted value includes unpaid offers; it is not received revenue. Converted values are indicative.</p>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
          <input
            type="search"
            name="platform-order-filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={search}
            aria-label="Search orders"
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search order, customer or manufacturer"
            className="h-10 w-full border-0 border-b border-[#dedede] bg-transparent pl-7 pr-2 text-sm text-[#262626] outline-none transition-colors placeholder:text-[#737373] focus:border-[#CC2D24]/70 focus:ring-0"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Order type" value={kindFilter} onChange={e=>{setKindFilter(e.target.value as KindFilter);setPage(1);}}><option value="all">All types</option><option value="techpack">Tech pack</option><option value="custom_clothing">Custom clothing</option></select>
          <select aria-label="Order stage" value={stageFilter} onChange={e=>{setStageFilter(e.target.value as OrderStageFilter);setPage(1);}}>{Object.entries(STAGE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-xs text-[#737373]">
          Could not load orders: {error} <button type="button" disabled={loading} onClick={()=>void refresh()}>Retry</button>
        </div>
      ) : null}

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373]">
          <span>
            Showing <strong className="text-[#262626]">{sortedOrders.length}</strong> of{' '}
            {MOCK_SUPER_ORDERS.length}
          </span>
          <button
            type="button"
            className="text-[#CC2D24] hover:underline"
            onClick={() => {
              setPage(1);
              setSearch('');
              setKindFilter('all');
              setStageFilter('all');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-[#e2e2e2] bg-white orders-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e2e2e2] bg-[#f7f7f7] text-[11px] uppercase tracking-wider text-[#737373]">
                <SortableHeader
                  field="order"
                  label="Order"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <th className="px-4 py-3.5 font-medium">Type</th>
                <SortableHeader
                  field="customer"
                  label="Customer"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="status"
                  label="Stage"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <th className="px-4 py-3.5 font-medium">Fulfilment</th>
                <th className="px-4 py-3.5 font-medium">Delivery</th>
                <SortableHeader
                  field="price"
                  label="Price"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="date"
                  label="Created"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <th className="px-4 py-3.5">Next step</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Package className="mx-auto h-8 w-8 text-[#737373]" />
                    <p className="mt-3 text-sm text-[#737373]">
                      {loading ? 'Loading orders…' : error ? 'Orders could not be loaded.' : hasFilters ? 'No orders match your filters.' : 'No orders yet. Submitted orders will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                visibleOrders.map((o) => (
                  <OrderTableRow
                    key={o.id}
                    order={o}
                    active={activeOrderId === o.id}
                    onOpen={() => setActiveOrderId(o.id)}
                    onDelete={async () => {
                      await deleteOrder(o.id);
                      if (activeOrderId === o.id) setActiveOrderId(null);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="orders-mobile-list">{visibleOrders.map(o=><article key={o.id}><button type="button" className="orders-mobile-preview" onClick={()=>setActiveOrderId(o.id)}><strong>{o.productName}</strong><span>#{o.id.slice(0,8)} · {KIND_LABEL[o.kind]}</span><span>{o.userName} · {fulfilmentLabel(o)}</span><span>{orderStatusLabel(o)} · {displayPrice(o)}</span></button><Link className="orders-next-action" to={'/superadmin/orders/'+o.id}>{SUPERADMIN_REVIEW_STATUSES.includes(o.status)?'Review quote':o.kind==='custom_clothing'&&o.status==='submitted'?'Assign manufacturer':'Open order'}<ArrowRight size={13}/></Link></article>)}{!visibleOrders.length&&<p role="status">{loading?'Loading orders…':error?'Orders could not be loaded.':hasFilters?'No orders match your filters.':'No orders yet.'}</p>}</div>
      <nav className="orders-pagination" aria-label="Order list pages"><span>{sortedOrders.length?(currentPage-1)*pageSize+1:0}–{Math.min(currentPage*pageSize,sortedOrders.length)} of {sortedOrders.length} orders</span><div><button type="button" disabled={loading||currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={loading||currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></nav>
      <Sheet open={activeOrderId != null} onOpenChange={(open) => !open && setActiveOrderId(null)}>
        <SheetContent
          side="right"
          className="admin-order-preview flex w-full flex-col gap-0 border-[#e2e2e2] bg-white p-0 text-[#262626] sm:max-w-lg"
        >
          {activeOrder ? (
            <OrderPreview
              order={activeOrder}
              onClose={() => setActiveOrderId(null)}
              onOpenFull={() => {
                setActiveOrderId(null);
                navigate(`/superadmin/orders/${activeOrder.id}`);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrderTableRow({
  order,
  active,
  onOpen,
  onDelete,
}: {
  order: SuperAdminOrder;
  active: boolean;
  onOpen: () => void;
  onDelete: () => Promise<void>;
}) {
  const currencyState=useCurrency();
  const needsReview = order.status === 'pending_review';

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'group cursor-pointer border-b border-[#e2e2e2] transition last:border-0',
        needsReview ? 'bg-[#CC2D24]/[0.06] hover:bg-[#CC2D24]/[0.09]' : 'hover:bg-[#f7f7f7]',
        active && 'bg-[#f7f7f7] ring-1 ring-inset ring-[#CC2D24]/25',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="font-mono text-[11px] text-[#CC2D24]/80 group-hover:text-[#CC2D24]">
          {order.id}
        </div>
        <div className="mt-0.5 max-w-[220px] truncate font-medium text-[#262626]">{order.productName}</div>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
            KIND_STYLE[order.kind],
          )}
        >
          {order.kind === 'techpack' ? (
            <Package className="h-3 w-3" />
          ) : (
            <Shirt className="h-3 w-3" />
          )}
          {KIND_LABEL[order.kind]}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#e2e2e2] bg-[#f7f7f7] text-[10px] font-bold text-[#737373]">
            {order.userName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-[#262626]">{order.userName}</div>
            <div className="truncate text-[11px] text-[#737373]">{order.userEmail}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={cn(
            'inline-flex rounded-md border px-2.5 py-0.5 text-[10px] font-medium',
            statusTone(order.status),
          )}
        >
          {orderStatusLabel(order)}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-[#737373]">
          {order.kind === 'techpack' ? (
            <Package className="h-3.5 w-3.5 shrink-0 text-[#737373]" />
          ) : (
            <Factory className="h-3.5 w-3.5 shrink-0 text-[#737373]" />
          )}
          <span className="truncate">{fulfilmentLabel(order)}</span>
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-xs text-[#737373]">
          <MapPin className="h-3 w-3 shrink-0 text-[#737373]" />
          {order.deliveryCity}, {order.deliveryCountry}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="tabular-nums font-medium text-[#737373]">{displayPrice(order)}</div>
        {needsReview && order.calculatedPriceCents != null ? (
          <div className="text-[10px] text-[#CC2D24]/80">Calculated</div>
        ) : null}
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-xs text-[#737373] transition group-hover:text-[#737373]">
          {formatDate(order.createdAt)}
          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
        </span>
        <DeleteRecordButton label={`order ${order.id}`} description="Permanently delete this order and its related records? This cannot be undone." onDelete={onDelete} />
      </td>
      <td className="px-4 py-3.5" onClick={e=>e.stopPropagation()}><Link className="orders-next-action" to={'/superadmin/orders/'+order.id}>{needsReview?'Review quote':order.kind==='custom_clothing'&&order.status==='submitted'?'Assign manufacturer':'Open order'}<ArrowRight size={13}/></Link></td>
    </tr>
  );
}

function OrderPreview({
  order,
  onClose,
  onOpenFull,
}: {
  order: SuperAdminOrder;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const currencyState=useCurrency();
  const needsReview = order.status === 'pending_review';
  const isTechPack = order.kind === 'techpack';
  const headerGradient = isTechPack
    ? 'from-violet-500/14 via-violet-500/[0.03] to-transparent'
    : 'from-[#CC2D24]/14 via-[#CC2D24]/[0.02] to-transparent';
  const accentColor = isTechPack ? 'text-[#737373]' : 'text-[#CC2D24]';
  const accentBg = isTechPack ? 'bg-violet-500/15' : 'bg-[#CC2D24]/15';
  const steps = isTechPack ? TECHPACK_STEPS : CUSTOM_STEPS;
  const currentRank = STATUS_RANK[order.status];

  const stepState = (stepStatus: OrderStatus) => {
    const stepRank = STATUS_RANK[stepStatus];
    if (order.status === stepStatus) return 'current' as const;
    if (currentRank > stepRank) return 'done' as const;
    return 'upcoming' as const;
  };

  return (
    <>
      <div className={cn('shrink-0 border-b border-[#e2e2e2] bg-gradient-to-br px-6 pb-5 pt-10', headerGradient)}>
        <SheetHeader className="space-y-0 p-0 text-left">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[#e2e2e2]',
                accentBg,
                accentColor,
              )}
            >
              {isTechPack ? <Package className="h-6 w-6" /> : <Shirt className="h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <p className={cn('font-mono text-[11px]', accentColor)}>{order.id}</p>
                <button
                  type="button"
                  className="rounded-md p-1 text-[#737373] transition hover:bg-[#f7f7f7] hover:text-[#262626]"
                  onClick={() => copyText(order.id, 'order ID')}
                  aria-label="Copy order ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <SheetTitle className="mt-1.5 text-xl leading-snug text-[#262626]">{order.productName}</SheetTitle>
              <SheetDescription asChild>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-md border px-2.5 py-0.5 text-[10px] font-medium',
                      statusTone(order.status),
                    )}
                  >
                    {orderStatusLabel(order)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[10px] font-medium',
                      KIND_STYLE[order.kind],
                    )}
                  >
                    {KIND_LABEL[order.kind]}
                  </span>
                </div>
              </SheetDescription>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-4 py-3.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                {isTechPack ? 'Export price' : needsReview ? 'Calculated price' : 'Brand price'}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-[#262626]">
                {displayPrice(order)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">Created</p>
              <p className="mt-0.5 text-sm font-medium text-[#737373]">{formatDate(order.createdAt)}</p>
            </div>
          </div>
        </SheetHeader>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-6 py-5">
          {/* Pipeline */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">Progress</h3>
            <div className="mt-3 flex items-center gap-1">
              {steps.map((step, i) => {
                const state = stepState(step.status);
                return (
                  <div key={step.status} className="flex min-w-0 flex-1 items-center gap-1">
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md border transition',
                          state === 'done' && 'border-emerald-500/40 bg-emerald-500/15 text-[#737373]',
                          state === 'current' &&
                            (needsReview && !isTechPack
                              ? 'border-[#CC2D24]/50 bg-[#CC2D24]/20 text-red-200'
                              : isTechPack
                                ? 'border-violet-400/50 bg-violet-500/20 text-[#737373]'
                                : 'border-[#CC2D24]/50 bg-[#CC2D24]/20 text-red-200'),
                          state === 'upcoming' && 'border-[#e2e2e2] bg-[#f7f7f7] text-[#737373]',
                        )}
                      >
                        {state === 'done' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : state === 'current' ? (
                          <Circle className="h-2 w-2 fill-current" />
                        ) : (
                          <Circle className="h-2 w-2" />
                        )}
                      </span>
                      <span
                        className={cn(
                          'w-full truncate text-center text-[9px] font-medium leading-tight',
                          state === 'current' ? 'text-[#262626]' : 'text-[#737373]',
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < steps.length - 1 ? (
                      <div
                        className={cn(
                          'mb-4 h-px w-full min-w-[6px] flex-1',
                          currentRank > STATUS_RANK[step.status] ? 'bg-emerald-500/35' : 'bg-[#f7f7f7]',
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Review callout */}
          {!isTechPack && needsReview && getOrderQuoteTiers(order).length > 0 ? (
            <div className="rounded-md border border-[#CC2D24]/30 bg-gradient-to-br from-[#CC2D24]/12 to-transparent p-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-[#CC2D24]" />
                <p className="text-xs font-semibold text-[#262626]">Ready for your review</p>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                {getOrderQuoteTiers(order).map((tier) => (
                  <div key={tier.id} className="flex justify-between gap-4">
                    <dt className="text-[#737373]">
                      {tier.label}
                      {tier.totalUnits > 0 ? ` · ${tier.totalUnits}u` : ''}
                    </dt>
                    <dd className="tabular-nums font-medium text-[#262626]">
                      {displayMoney(tier.manufacturerQuoteCents,tier.currency)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-[#e2e2e2] pt-2">
                  <dt className="text-[#737373]">Ceriga margin</dt>
                  <dd className="text-[#262626]">{order.cerigaMarginPercent ?? 17.5}%</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {/* Customer */}
          <section className="rounded-md border border-[#e2e2e2] bg-[#f7f7f7] p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">Customer</h3>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#e2e2e2] bg-[#f7f7f7] text-xs font-bold text-[#737373]">
                {orderInitials(order.userName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#262626]">{order.userName}</p>
                <p className="truncate text-xs text-[#737373]">{order.userEmail}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 border-[#dedede] bg-transparent px-2.5 text-[11px] text-[#737373] hover:bg-[#f7f7f7] hover:text-[#262626]"
                asChild
              >
                <Link to={`/superadmin/users/${order.userId}`} onClick={onClose}>
                  Profile
                </Link>
              </Button>
            </div>
          </section>

          {/* Details */}
          <section className="rounded-md border border-[#e2e2e2] bg-[#f7f7f7] p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">Details</h3>
            <dl className="mt-3 divide-y divide-white/[0.06]">
              {isTechPack ? (
                <>
                  <DetailRow icon={FileText} label="Garment" value={order.garmentType ?? '—'} />
                  <DetailRow
                    icon={Download}
                    label="Export"
                    value={order.exportFormat === 'pdf_bundle' ? 'PDF + ZIP bundle' : 'PDF export'}
                  />
                  <DetailRow icon={Coins} label="Billing" value="Pay-per export" />
                </>
              ) : (
                <>
                  <DetailRow icon={Factory} label="Manufacturer" value={order.manufacturerName ?? 'Unassigned'} />
                  <DetailRow
                    icon={Calculator}
                    label="Manufacturer quotes"
                    value={
                      getOrderQuoteTiers(order).length > 0
                        ? `${getOrderQuoteTiers(order).length} tiers · ${getOrderQuoteTiers(order)
                            .map((t) => t.label)
                            .join(', ')}`
                        : 'Awaiting quote'
                    }
                  />
                  {order.trackingNumber ? (
                    <DetailRow icon={Truck} label="Tracking" value={order.trackingNumber} mono />
                  ) : null}
                </>
              )}
              <DetailRow
                icon={MapPin}
                label="Delivery"
                value={`${order.deliveryCity}, ${order.deliveryCountry}`}
              />
            </dl>
          </section>

          {order.notes ? (
            <section className="rounded-md border border-[#e2e2e2] bg-[#f7f7f7] p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">Notes</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#737373]">{order.notes}</p>
            </section>
          ) : null}
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-2 border-t border-[#e2e2e2] bg-white px-6 py-4">
        <Button
          className="w-full bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
          onClick={onOpenFull}
        >
          {isTechPack ? 'Open full order' : needsReview ? 'Review & submit' : 'Open full order'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="w-full border-[#dedede] bg-[#f7f7f7] text-[#737373] hover:bg-[#f7f7f7] hover:text-[#262626]"
          asChild
        >
          <Link to={`/superadmin/users/${order.userId}`} onClick={onClose}>
            <User className="mr-2 h-4 w-4" />
            View customer profile
          </Link>
        </Button>
      </div>
    </>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  mono?: boolean;
}) {
  const currencyState=useCurrency();
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#737373]" />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">{label}</dt>
        <dd className={cn('mt-0.5 text-sm text-[#737373]', mono && 'font-mono text-xs')}>{value}</dd>
      </div>
    </div>
  );
}
