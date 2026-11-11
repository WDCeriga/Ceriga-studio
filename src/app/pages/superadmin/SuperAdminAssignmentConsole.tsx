import './superadmin-assignment.css';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import { checkManufacturerProduction, recommendManufacturers } from '../../data/assignmentRecommendation';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowDownUp, ArrowRight, ArrowRightLeft, ArrowUp, Clock, ListFilter, Package, Route, Search, Check, Factory } from 'lucide-react';
import { toast } from 'sonner';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { STATUS_LABELS, type OrderStatus, type SuperAdminOrder } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { cn } from '../../components/ui/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso.length===10?iso+'T12:00:00':iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function localDate(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
}

type AssignAction = {
  orderId: string;
  productName: string;
  mode: 'assign' | 'reroute';
  review?: { orderIds: string[]; index: number };
};

type ConsoleRow = {
  order: SuperAdminOrder;
  overdue: boolean;
  slaHoursLeft: number | null;
  needsReroute: boolean;
};

const assignmentStatuses: OrderStatus[] = ['submitted', 'assigned', 'priced', 'pending_review'];

function daysUntil(iso: string, today = localDate()): number {
  const a = new Date(today + 'T12:00:00Z').getTime();
  const b = new Date(iso + 'T12:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

function buildRows(orders: SuperAdminOrder[]): ConsoleRow[] {
  const today = localDate();
  return orders
    .filter((o) => o.kind === 'custom_clothing')
    .filter((o) => assignmentStatuses.includes(o.status))
    .map((order) => {
      const quoteOpen = !order.quoteTiers?.length && !['quoted','priced','pending_review'].includes(order.factoryQuoteStatus??'');
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
        needsReroute: order.factoryQuoteStatus === 'rejected',
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

function needsAssignment({ order, needsReroute }: ConsoleRow) {
  return needsReroute || (!order.manufacturerId && order.status === 'submitted');
}

type AssignmentSort = 'priority' | 'manufacturer-asc' | 'manufacturer-desc' | 'time';
const manufacturerCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function isJustSubmitted({ order, overdue }: ConsoleRow) {
  return order.status === 'submitted' && !order.manufacturerId && !overdue;
}

function statusLabel(row: ConsoleRow) {
  if (row.overdue) return 'Overdue';
  return isJustSubmitted(row) ? 'Just submitted' : STATUS_LABELS[row.order.status];
}

export function SuperAdminAssignmentConsole({ embedded = false }: { embedded?: boolean } = {}) {
  useCurrency();
  const { orders, manufacturers, loading, error, patchOrder, refresh } = useSuperadminData();
  const rows = buildRows(orders);
  const activeManufacturers = manufacturers.filter((m) => m.onboardingComplete&&m.status!=='paused');

  const [filter, setFilter] = useState<'all' | 'overdue' | 'unassigned' | 'reroute' | 'submitted'>('all');
  const [action, setAction] = useState<AssignAction | null>(null);
  const [manufacturerId, setManufacturerId] = useState('');
  const [dueQuoteBy, setDueQuoteBy] = useState(addDaysIso(3));
  const [committing, setCommitting] = useState(false);
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[assignmentError,setAssignmentError]=useState('');
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [sort, setSort] = useState<AssignmentSort>('priority');
  const commitLock=useRef(false);

  const hasFilters = Boolean(search || filter !== 'all');
  const searchTerm = search.trim().toLowerCase();
  const filtered = rows.filter(row => {
    const { order } = row;
    if (![order.id, order.productName, order.userName, order.manufacturerName].join(' ').toLowerCase().includes(searchTerm)) return false;
    if (filter === 'overdue') return row.overdue;
    if (filter === 'unassigned') return !order.manufacturerId;
    if (filter === 'reroute') return row.needsReroute;
    if (filter === 'submitted') return isJustSubmitted(row);
    return true;
  });

  if (sort === 'time') {
    const remaining = (row: ConsoleRow) => row.order.manufacturerId
      ? row.slaHoursLeft ?? Number.MAX_SAFE_INTEGER - 1
      : Number.MAX_SAFE_INTEGER;
    filtered.sort((a, b) => remaining(a) - remaining(b));
  } else if (sort !== 'priority') {
    const factoryNames = new Map(manufacturers.map(factory => [factory.userId, factory.factoryName]));
    const name = (order: SuperAdminOrder) => order.manufacturerName || factoryNames.get(order.manufacturerId ?? '') || '';
    const direction = sort === 'manufacturer-asc' ? 1 : -1;
    filtered.sort(({ order: a }, { order: b }) =>
      Number(!a.manufacturerId) - Number(!b.manufacturerId) || direction * manufacturerCollator.compare(name(a), name(b))
    );
  }

  const manufacturerSort = sort === 'manufacturer-asc' ? 'ascending' : sort === 'manufacturer-desc' ? 'descending' : 'none';
  const ManufacturerArrow = manufacturerSort === 'ascending' ? ArrowUp : manufacturerSort === 'descending' ? ArrowDown : ArrowDownUp;
  const statusFilter = filter === 'overdue' ? 'Overdue' : filter === 'submitted' ? 'Just submitted' : '';
  const manufacturerHeader = <button type="button" className="assignment-column-trigger" data-active={manufacturerSort !== 'none'}
    aria-label={manufacturerSort === 'ascending' ? 'Sort by manufacturer Z to A' : 'Sort by manufacturer A to Z'}
    onClick={() => { setSort(sort === 'manufacturer-asc' ? 'manufacturer-desc' : 'manufacturer-asc'); setPage(1); }}>
    Assigned manufacturer <ManufacturerArrow size={13} aria-hidden />
  </button>;
  const timeHeader = <button type="button" className="assignment-column-trigger" data-active={sort === 'time'}
    aria-pressed={sort === 'time'} aria-label="Sort by time remaining, overdue first"
    onClick={() => { setSort(sort === 'time' ? 'priority' : 'time'); setPage(1); }}>
    Time remaining <ArrowUp size={13} aria-hidden />
  </button>;
  const statusHeader = <button type="button" className="assignment-column-trigger" data-active={Boolean(statusFilter)}
    aria-label={filter === 'overdue' ? 'Show just submitted requests' : filter === 'submitted' ? 'Show all statuses' : 'Show overdue requests'}
    onClick={() => { setFilter(filter === 'overdue' ? 'submitted' : filter === 'submitted' ? 'all' : 'overdue'); setPage(1); }}>
    Status <ListFilter size={13} aria-hidden />{statusFilter && <span className="assignment-status-selection">{statusFilter}</span>}
  </button>;

  const pageCount=Math.max(1,Math.ceil(filtered.length/20)),currentPage=Math.min(page,pageCount),visible=filtered.slice((currentPage-1)*20,currentPage*20);
  const selectedOrder=orders.find(o=>o.id===action?.orderId);
  const recommendations=selectedOrder?recommendManufacturers(selectedOrder,activeManufacturers):[];
  const recommendedIds = new Set(recommendations.map(({ factory }) => factory.userId));
  const manufacturerOptions = [
    ...recommendations.map(({ factory }) => factory),
    ...activeManufacturers.filter(factory => !recommendedIds.has(factory.userId)),
  ];
  const manufacturerMatches = manufacturerOptions.map(factory => ({factory, match: selectedOrder ? checkManufacturerProduction(selectedOrder, factory) : null}));
  const matchingManufacturers = manufacturerMatches.filter(({factory}) => (factory.factoryName+' '+factory.email).toLowerCase().includes(manufacturerSearch.trim().toLowerCase()));
  const eligibleManufacturers = matchingManufacturers.filter(({match}) => match?.eligible);
  const unavailableManufacturers = matchingManufacturers.filter(({match}) => !match?.eligible);
  const selectedManufacturer = activeManufacturers.find(factory => factory.userId === manufacturerId);
  const overdueCount = rows.filter((r) => r.overdue).length;
  const unassignedCount = rows.filter((r) => !r.order.manufacturerId).length;
  const rerouteCount = rows.filter((r) => r.needsReroute).length;
  const reviewIds = filtered.filter(needsAssignment).map(({ order }) => order.id);

  const openAssign = (orderId: string, productName: string, mode: 'assign' | 'reroute', review?: AssignAction['review']) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    const primary = order ? recommendManufacturers(order, activeManufacturers)[0] : undefined;
    setManufacturerId(primary?.factory.userId ?? '');
    setManufacturerSearch('');
    setDueQuoteBy(addDaysIso(3));
    setAssignmentError('');
    setAction({ orderId, productName, mode, review });
  };

  const openReviewOrder = (orderIds: string[], from: number) => {
    const index = orderIds.findIndex((id, position) =>
      position >= from && rows.some(row => row.order.id === id && needsAssignment(row)));
    const next = index >= 0 ? rows.find(row => row.order.id === orderIds[index]) : undefined;
    if (!next) {
      setAction(null);
      toast.success('Assignment review complete. Skipped orders are still available to review.');
      return;
    }
    const { order } = next;
    openAssign(order.id, order.productName, order.manufacturerId ? 'reroute' : 'assign', { orderIds, index });
  };

  const commit = async () => {
    if(commitLock.current)return;
    setAssignmentError('');
    if (!action || !manufacturerId) {
      toast.error('Pick a manufacturer');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueQuoteBy)||!Number.isFinite(Date.parse(dueQuoteBy+'T12:00:00Z'))||new Date(dueQuoteBy+'T12:00:00Z').toISOString().slice(0,10)!==dueQuoteBy||dueQuoteBy<localDate()) {
      setAssignmentError('Choose today or a future quotation deadline.');
      return;
    }
    const target = activeManufacturers.find((m) => m.userId === manufacturerId);
    const order=orders.find(item=>item.id===action.orderId);
    const match=order&&target?checkManufacturerProduction(order,target):null;
    if(!match?.eligible){toast.error(match?.failures.join('; ')||'Could not verify production capabilities');return;}
    commitLock.current=true;setCommitting(true);
    try {
      const ok=await patchOrder(action.orderId,{assignedManufacturerId:manufacturerId,dueQuoteBy});
      if(!ok)throw new Error('Could not save the assignment. Please try again.');
      toast.success((action.mode==='reroute'?'Reassigned to ':'Assigned to ')+(target?.factoryName??'manufacturer'));
      if (action.review) openReviewOrder(action.review.orderIds, action.review.index + 1);
      else setAction(null);
      try{await refresh();}catch{toast.error('Assignment saved, but the list could not refresh. Refresh to see the latest records.');}
    }catch(e){setAssignmentError(e instanceof Error?e.message:'Could not save assignment.');}
    finally{commitLock.current=false;setCommitting(false);}
  };

  return (
    <div className="admin-assignment space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {!embedded && <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Route className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">CERIGA / OPERATIONS</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#262626] sm:text-3xl">
            Manufacturer assignment
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#737373]">
            Match orders with the right factory. Keep quotation requests moving.
          </p>
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="min-h-10 bg-[#CC2D24]"
            disabled={loading || !!error || reviewIds.length === 0}
            onClick={() => openReviewOrder(reviewIds, 0)}
          >
            Review assignments ({reviewIds.length}) <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Link
          to="/superadmin/orders/review"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-3 py-2 text-[12px] font-medium text-[#737373] hover:bg-[#fafafa] hover:text-[#262626]"
        >
          Pricing review queue
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          aria-pressed={filter==='overdue'} onClick={() => {setFilter('overdue');setPage(1);}}
          className={cn(
            'rounded-md border px-4 py-4 text-left transition',
            filter === 'overdue'
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-[#e2e2e2] bg-white hover:bg-[#fafafa]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Overdue quotes
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#737373]">{loading||error?'—':overdueCount}</p>
        </button>
        <button
          type="button"
          aria-pressed={filter==='unassigned'} onClick={() => {setFilter('unassigned');setPage(1);}}
          className={cn(
            'rounded-md border px-4 py-4 text-left transition',
            filter === 'unassigned'
              ? 'border-sky-500/40 bg-sky-500/10'
              : 'border-[#e2e2e2] bg-white hover:bg-[#fafafa]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Unassigned
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#737373]">{loading||error?'—':unassignedCount}</p>
        </button>
        <button
          type="button"
          aria-pressed={filter==='reroute'} onClick={() => {setFilter('reroute');setPage(1);}}
          className={cn(
            'rounded-md border px-4 py-4 text-left transition',
            filter === 'reroute'
              ? 'border-[#CC2D24]/40 bg-[#CC2D24]/10'
              : 'border-[#e2e2e2] bg-white hover:bg-[#fafafa]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Need reassignment
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#737373]">{loading||error?'—':rerouteCount}</p>
        </button>
      </div>

      {error&&<div role="alert" className="assignment-error">Could not load assignments: {error}<button type="button" disabled={loading} onClick={()=>void refresh()}>Retry</button></div>}
      <div className="assignment-search"><input aria-label="Search assignments" type="search" placeholder="Search order, customer or manufacturer" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{hasFilters&&<button type="button" onClick={()=>{setSearch('');setFilter('all');setPage(1);}}>Clear filters</button>}</div>
      <div className="assignment-tabs flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all' as const, label: 'All requests' },
            { id: 'overdue' as const, label: 'Overdue' },
            { id: 'unassigned' as const, label: 'Unassigned' },
            { id: 'reroute' as const, label: 'Reassignment' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter===f.id} onClick={() => {setFilter(f.id);setPage(1);}}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
              filter === f.id
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-[#737373]'
                : 'border-[#e2e2e2] text-[#737373] hover:text-[#737373]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="assignment-mobile-filters" role="group" aria-label="Sort and filter assignments">
        {manufacturerHeader}{timeHeader}{statusHeader}
      </div>
      <div className="assignment-table overflow-hidden rounded-md border border-[#e2e2e2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-[#e2e2e2] bg-[#fafafa] text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                <th scope="col" className="px-4 py-2">Order</th>
                <th scope="col" className="px-4 py-2" aria-sort={manufacturerSort !== 'none' ? manufacturerSort : undefined}>{manufacturerHeader}</th>
                <th scope="col" className="px-4 py-2">Quote due</th>
                <th scope="col" className="px-4 py-2" aria-sort={sort === 'time' ? 'ascending' : undefined}>{timeHeader}</th>
                <th scope="col" className="px-4 py-2">{statusHeader}</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#737373]">
                    {loading ? 'Loading assignment requests…' : error ? 'Assignments could not be loaded.' : hasFilters ? 'No requests match your filters.' : 'No orders awaiting assignment or quotation.'}
                  </td>
                </tr>
              ) : (
                visible.map(row => { const { order, slaHoursLeft, needsReroute } = row; return (
                  <tr key={order.id} className="border-b border-[#e2e2e2] last:border-0">
                    <td className="px-4 py-3.5 align-middle">
                      <Link
                        to={`/superadmin/orders/${order.id}`}
                        className="text-sm font-medium text-[#262626] hover:text-[#CC2D24]"
                      >
                        {order.productName}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-[#737373]">
                        {order.id} · {order.userName}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {order.manufacturerName ? (
                        <p className="text-sm text-[#737373]">{order.manufacturerName}</p>
                      ) : (
                        <span className="text-[12px] text-[#737373]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="text-[12px] tabular-nums text-[#737373]">{formatDate(order.dueQuoteBy)}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {!order.manufacturerId || slaHoursLeft == null ? (
                        <span className="text-[12px] text-[#737373]">{order.manufacturerId ? '—' : 'Unassigned'}</span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[12px] tabular-nums',
                            slaHoursLeft < 0 ? 'text-[#737373]' : 'text-[#737373]',
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {slaHoursLeft < 0
                            ? `${Math.abs(slaHoursLeft)/24} days overdue`
                            : slaHoursLeft===0?'Due today':`${slaHoursLeft/24} days left`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <p className="text-[12px] text-[#737373]">{statusLabel(row)}</p>
                      {order.factoryQuoteStatus ? (
                        <p className="text-[10px] text-[#737373]">
                          Factory: {order.factoryQuoteStatus}
                        </p>
                      ) : null}
                      {needsReroute && order.factoryRejectReason ? (
                        <p className="mt-1 max-w-[200px] text-[10px] text-[#737373]">
                          Declined: {order.factoryRejectReason}
                        </p>
                      ) : null}
                      {order.quoteTiers?.length ? (
                        <p className="text-[10px] text-[#737373]">
                          Quote {displayMoney(order.quoteTiers[0].manufacturerQuoteCents,order.quoteTiers[0].currency)}+
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {!order.manufacturerId ? (
                          <Button
                            size="sm"
                            className="bg-[#CC2D24] text-[#262626] hover:bg-[#CC2D24]/90"
                            onClick={() => openAssign(order.id, order.productName, 'assign')}
                          >
                            <Package className="mr-1 h-3.5 w-3.5" />
                            Assign
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#dedede] bg-[#fafafa] text-[#737373]"
                            onClick={() => openAssign(order.id, order.productName, 'reroute')}
                          >
                            <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                            Reassign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ); })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="assignment-mobile-list">{visible.map(row=>{const {order,overdue,needsReroute}=row;return <article key={order.id}><Link to={'/superadmin/orders/'+order.id}><strong>{order.productName}</strong><span>#{order.id.slice(0,8)} · {order.userName}</span></Link><p>{order.manufacturerName||'Unassigned'} · {statusLabel(row)}</p><p>{needsReroute?'Manufacturer declined':overdue?'Quotation overdue':'Quote due '+formatDate(order.dueQuoteBy)}</p>{needsReroute&&order.factoryRejectReason&&<p className="assignment-decline">{order.factoryRejectReason}</p>}<button type="button" onClick={()=>openAssign(order.id,order.productName,order.manufacturerId?'reroute':'assign')}>{order.manufacturerId?'Reassign manufacturer':'Assign manufacturer'}</button></article>;})}{!visible.length&&<p>{loading?'Loading assignment requests…':error?'Assignments could not be loaded.':'No matching requests.'}</p>}</div>
      <nav className="assignment-pagination" aria-label="Assignment pages"><span>{filtered.length?(currentPage-1)*20+1:0}–{Math.min(currentPage*20,filtered.length)} of {filtered.length} requests</span><div><button type="button" disabled={loading||currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={loading||currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></nav>
      {action ? (
        <Dialog open onOpenChange={(next) => { if (!next && !committing) setAction(null); }}>
        <DialogContent className="assignment-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-md border-[#e2e2e2] bg-white p-6 text-[#262626] sm:max-w-[760px] sm:p-8">
          {action.review && <p className="pr-6 text-xs font-medium text-[#737373]" role="status">
            Assignment {action.review.index + 1} of {action.review.orderIds.length}
          </p>}
          <DialogTitle className="pr-6 text-xl font-semibold leading-snug sm:text-2xl">
            {action.mode === 'reroute' ? 'Change manufacturer' : 'Choose a manufacturer'}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#737373]">{action.productName} · Select a factory, then confirm when its quotation is due.</DialogDescription>
          {action.review && selectedOrder && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-3 py-2.5 text-xs text-[#525252]">
            <span>{selectedOrder.userName} · {selectedOrder.manufacturerName ?? 'Unassigned'}</span>
            <Link className="underline" to={`/superadmin/orders/${selectedOrder.id}`}>View order details</Link>
            {selectedOrder.factoryRejectReason && <p className="w-full">Declined: {selectedOrder.factoryRejectReason}</p>}
          </div>}
          {assignmentError&&<p role="alert" className="assignment-error">{assignmentError}</p>}
          <div className="space-y-5">
            <fieldset className="manufacturer-picker">
              <legend>Manufacturer <span>{manufacturerMatches.filter(({match})=>match?.eligible).length} suitable</span></legend>
              <div className="manufacturer-picker-search"><Search size={16} aria-hidden /><input type="search" aria-label="Search manufacturers" placeholder="Search manufacturers…" value={manufacturerSearch} disabled={committing} onChange={e=>setManufacturerSearch(e.target.value)}/>{manufacturerSearch&&<button type="button" disabled={committing} onClick={()=>setManufacturerSearch('')}>Clear</button>}</div>
              <div className="manufacturer-picker-options">
                {eligibleManufacturers.map(({factory,match})=>{
                  const recommendation = recommendations.find(r=>r.factory.userId===factory.userId);
                  const selected = manufacturerId===factory.userId;
                  return <article key={factory.userId} className={cn('manufacturer-choice',selected&&'is-selected')}>
                    <label className="manufacturer-choice-label">
                      <input type="radio" name="manufacturer" aria-label={factory.factoryName} value={factory.userId} checked={selected} disabled={committing} onChange={()=>{setManufacturerId(factory.userId);setAssignmentError('');}}/>
                      <span className="manufacturer-choice-icon"><Factory size={18}/></span>
                      <span className="manufacturer-choice-body"><span className="manufacturer-choice-name">{factory.factoryName}{recommendation&&<span className="manufacturer-choice-badge">{factory.userId===recommendations[0]?.factory.userId?'Recommended':'Alternative'}</span>}</span><span className="manufacturer-choice-meta">{factory.availableCapacity!=null?factory.availableCapacity.toLocaleString()+' units available':factory.monthlyCapacity!=null?factory.monthlyCapacity.toLocaleString()+' units / month':'Capacity to confirm'} · {factory.assignedOrders!=null?factory.assignedOrders+' active orders':'Workload to confirm'}</span></span>
                      <span className="manufacturer-choice-selected">{selected?<><Check size={14}/>Selected</>:'Select'}</span>
                    </label>
                    <details className="manufacturer-choice-details"><summary>Match details</summary><ul>{(recommendation?.reasons||match?.reasons||[]).map(reason=><li key={reason}>{reason}</li>)}</ul>{recommendation?<p>{recommendation.warning}</p>:!!match?.warnings.length&&<p>{match.warnings.join(' · ')}</p>}</details>
                  </article>;
                })}
                {!eligibleManufacturers.length&&<p className="manufacturer-picker-empty" role="status">{manufacturerSearch?'No suitable manufacturers match your search.':'No suitable manufacturers for this order. Review its requirements and factory profiles.'}</p>}
                {!!unavailableManufacturers.length&&<details className="manufacturer-unavailable"><summary>Requirements not met ({unavailableManufacturers.length})</summary>{unavailableManufacturers.map(({factory,match})=><div key={factory.userId}><strong>{factory.factoryName}</strong><p>{match?.failures.join(' · ')}</p></div>)}</details>}
                {!manufacturerMatches.length&&<p className="manufacturer-picker-empty">No active, onboarded manufacturers available.</p>}
              </div>
            </fieldset>
            {manufacturerId && (()=>{
              const order=orders.find(item=>item.id===action.orderId);
              const factory=activeManufacturers.find(item=>item.userId===manufacturerId);
              const match=order&&factory?checkManufacturerProduction(order,factory):null;
              if(!match)return null;
              return <div className="space-y-3">
                <details className="rounded-lg border border-amber-400/20 p-3 text-xs text-[#737373]">
                  <summary className="cursor-pointer text-[#737373]">Scheduling availability</summary>
                  <ul className="mt-2 space-y-2">{match.warnings.filter(reason=>/working schedule|recorded closures|completion-month workload|active production orders|unavailability|calendar availability/i.test(reason)).map(reason=><li key={reason}>{reason}</li>)}</ul>
                  <p className="mt-2">A quotation deadline is not a production deadline. Confirm the production window and capacity before commitment.</p>
                  <Link to={`/superadmin/time-off?manufacturer=${manufacturerId}`} className="mt-2 inline-block text-[#737373] underline">View factory calendar</Link>
                </details>
                {!!match.failures.length&&<div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-[#737373]"><p className="font-semibold">Cannot assign — requirements do not match</p><ul className="mt-2 list-disc space-y-1 pl-4">{match.failures.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
              </div>;
            })()}
            <div>
              <label htmlFor="assignment-quote-due" className="assignment-deadline-label">Quotation deadline</label>
              <Input
                id="assignment-quote-due" aria-label="Quotation deadline" min={localDate()} disabled={committing}
                type="date"
                value={dueQuoteBy}
                onChange={(e) => {setDueQuoteBy(e.target.value);setAssignmentError('');}}
                className="mt-2 h-12 w-full border-[#dedede] bg-[#fafafa] text-base text-[#262626]"
              />
            </div>
            <div className="assignment-confirmation">
              <p>{selectedManufacturer ? <>Selected: <strong>{selectedManufacturer.factoryName}</strong></> : 'Select a suitable manufacturer to continue.'}</p>
              <div className="flex flex-wrap gap-2">
              <Button
                className="h-12 flex-1 bg-[#CC2D24] text-base text-[#262626] hover:bg-[#CC2D24]/90"
                onClick={commit}
                disabled={committing||!manufacturerId||!(() => { const order=orders.find(item=>item.id===action.orderId);const factory=activeManufacturers.find(item=>item.userId===manufacturerId);return order&&factory&&checkManufacturerProduction(order,factory).eligible; })()}
              >
                {committing ? 'Assigning…' : action.review
                  ? action.mode === 'reroute' ? 'Reassign & continue' : 'Assign & continue'
                  : action.mode === 'reroute' ? 'Reassign manufacturer' : 'Assign manufacturer'}
              </Button>
              <Button
                variant="outline"
                className="h-12 border-[#dedede] bg-transparent px-6 text-base text-[#737373]"
                disabled={committing} onClick={() => {
                  if (!commitLock.current && action.review) openReviewOrder(action.review.orderIds, action.review.index + 1);
                  else if (!commitLock.current) setAction(null);
                }}
              >
                {action.review ? 'Skip for now' : 'Cancel'}
              </Button>
              </div>
            </div>
          </div>
        </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
