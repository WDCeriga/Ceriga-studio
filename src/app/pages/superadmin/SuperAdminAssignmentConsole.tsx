import './superadmin-assignment.css';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import { checkManufacturerProduction, recommendManufacturers } from '../../data/assignmentRecommendation';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRightLeft, Clock, Package, Route } from 'lucide-react';
import { toast } from 'sonner';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { STATUS_LABELS, formatMoney, type OrderStatus, type SuperAdminOrder } from '../../data/superadminMock';
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
};

type ConsoleRow = {
  order: SuperAdminOrder;
  overdue: boolean;
  slaHoursLeft: number | null;
  needsReroute: boolean;
};

function daysUntil(iso: string, today = localDate()): number {
  const a = new Date(today + 'T12:00:00Z').getTime();
  const b = new Date(iso + 'T12:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

function buildRows(orders: SuperAdminOrder[]): ConsoleRow[] {
  const today = localDate();
  return orders
    .filter((o) => o.kind === 'custom_clothing')
    .filter((o) => ['submitted', 'assigned', 'priced', 'pending_review'].includes(o.status))
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

export function SuperAdminAssignmentConsole() {
  useCurrency();
  const { orders, manufacturers, loading, error, patchOrder, refresh } = useSuperadminData();
  const rows = buildRows(orders);
  const activeManufacturers = manufacturers.filter((m) => m.onboardingComplete&&m.status!=='paused');

  const [filter, setFilter] = useState<'all' | 'overdue' | 'unassigned' | 'reroute'>('all');
  const [action, setAction] = useState<AssignAction | null>(null);
  const [manufacturerId, setManufacturerId] = useState('');
  const [dueQuoteBy, setDueQuoteBy] = useState(addDaysIso(3));
  const [committing, setCommitting] = useState(false);
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[assignmentError,setAssignmentError]=useState('');
  const commitLock=useRef(false);

  const filtered = rows.filter(r=>[r.order.id,r.order.productName,r.order.userName,r.order.manufacturerName||''].join(' ').toLowerCase().includes(search.trim().toLowerCase())).filter((r) => {
    if (filter === 'overdue') return r.overdue;
    if (filter === 'unassigned') return !r.order.manufacturerId;
    if (filter === 'reroute') return r.needsReroute;
    return true;
  });

  const pageCount=Math.max(1,Math.ceil(filtered.length/20)),currentPage=Math.min(page,pageCount),visible=filtered.slice((currentPage-1)*20,currentPage*20);
  const selectedOrder=orders.find(o=>o.id===action?.orderId);
  const recommendations=selectedOrder?recommendManufacturers(selectedOrder,activeManufacturers):[];
  const overdueCount = rows.filter((r) => r.overdue).length;
  const unassignedCount = rows.filter((r) => !r.order.manufacturerId).length;
  const rerouteCount = rows.filter((r) => r.needsReroute).length;

  const openAssign = (orderId: string, productName: string, mode: 'assign' | 'reroute') => {
    const order = orders.find((candidate) => candidate.id === orderId);
    const primary = order ? recommendManufacturers(order, activeManufacturers)[0] : undefined;
    setManufacturerId(primary?.factory.userId ?? '');
    setDueQuoteBy(addDaysIso(3));
    setAssignmentError('');
    setAction({ orderId, productName, mode });
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
      setAction(null);
      try{await refresh();}catch{toast.error('Assignment saved, but the list could not refresh. Refresh to see the latest records.');}
    }catch(e){setAssignmentError(e instanceof Error?e.message:'Could not save assignment.');}
    finally{commitLock.current=false;setCommitting(false);}
  };

  return (
    <div className="admin-assignment space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
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
        </div>
        <Link
          to="/superadmin/orders/review"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-3 py-2 text-[12px] font-medium text-[#737373] hover:bg-[#fafafa] hover:text-[#262626]"
        >
          Pricing review queue
        </Link>
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
      <div className="assignment-search"><input aria-label="Search assignments" type="search" placeholder="Search order, customer or manufacturer" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{(search||filter!=='all')&&<button type="button" onClick={()=>{setSearch('');setFilter('all');setPage(1);}}>Clear filters</button>}</div>
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

      <div className="assignment-table overflow-hidden rounded-md border border-[#e2e2e2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-[#e2e2e2] bg-[#fafafa] text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Assigned manufacturer</th>
                <th className="px-4 py-3">Quote due</th>
                <th className="px-4 py-3">Time remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#737373]">
                    {loading ? 'Loading assignment requests…' : error ? 'Assignments could not be loaded.' : search||filter!=='all'?'No requests match your filters.':'No orders awaiting assignment or quotation.'}
                  </td>
                </tr>
              ) : (
                visible.map(({ order, overdue, slaHoursLeft, needsReroute }) => (
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
                      <span
                        className={cn(
                          'text-[12px] tabular-nums',
                          overdue ? 'text-[#737373]' : 'text-[#737373]',
                        )}
                      >
                        {formatDate(order.dueQuoteBy)}
                      </span>
                      {overdue ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#737373]">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {slaHoursLeft == null ? (
                        <span className="text-[12px] text-[#737373]">—</span>
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
                      <p className="text-[12px] text-[#737373]">{STATUS_LABELS[order.status]}</p>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="assignment-mobile-list">{visible.map(({order,overdue,needsReroute})=><article key={order.id}><Link to={'/superadmin/orders/'+order.id}><strong>{order.productName}</strong><span>#{order.id.slice(0,8)} · {order.userName}</span></Link><p>{order.manufacturerName||'Unassigned'} · {STATUS_LABELS[order.status]}</p><p>{needsReroute?'Manufacturer declined':overdue?'Quotation overdue':'Quote due '+formatDate(order.dueQuoteBy)}</p>{needsReroute&&order.factoryRejectReason&&<p className="assignment-decline">{order.factoryRejectReason}</p>}<button type="button" onClick={()=>openAssign(order.id,order.productName,order.manufacturerId?'reroute':'assign')}>{order.manufacturerId?'Reassign manufacturer':'Assign manufacturer'}</button></article>)}{!visible.length&&<p>{loading?'Loading assignment requests…':error?'Assignments could not be loaded.':'No matching requests.'}</p>}</div>
      <nav className="assignment-pagination" aria-label="Assignment pages"><span>{filtered.length?(currentPage-1)*20+1:0}–{Math.min(currentPage*20,filtered.length)} of {filtered.length} requests</span><div><button type="button" disabled={loading||currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={loading||currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></nav>
      {action ? (
        <Dialog open onOpenChange={(next) => { if (!next && !committing) setAction(null); }}>
        <DialogContent className="assignment-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-md border-[#e2e2e2] bg-white p-6 text-[#262626] sm:max-w-[600px] sm:p-8">
          <DialogTitle className="pr-6 text-xl font-semibold leading-snug sm:text-2xl">
            {action.mode === 'reroute' ? 'Reassign' : 'Assign'} · {action.productName}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#737373]">Choose a manufacturer and set the quotation deadline.</DialogDescription>
          {assignmentError&&<p role="alert" className="assignment-error">{assignmentError}</p>}
          <div className="space-y-5">
            <div className="assignment-recommendations"><h3>Suggested manufacturers</h3>{recommendations.length?recommendations.map((r,i)=><div key={r.factory.userId} className="assignment-recommendation"><button type="button" disabled={committing} aria-pressed={manufacturerId===r.factory.userId} onClick={()=>setManufacturerId(r.factory.userId)}><span>{i===0?'Primary recommendation':'Alternative'}</span><strong>{r.factory.factoryName}</strong><small>{manufacturerId===r.factory.userId?'Selected':'Select manufacturer'}</small></button><details><summary>Why this match?</summary><ul>{r.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>{r.warning}</p></details></div>):<p>No eligible recommendations match the saved requirements. Review the order specifications and manufacturer profiles.</p>}</div>
            <div>
              <p className="text-sm font-medium text-[#737373]">Manufacturer</p>
              <select aria-label="Manufacturer" value={manufacturerId} disabled={committing} onChange={e=>{setManufacturerId(e.target.value);setAssignmentError('');}}><option value="">Select a manufacturer</option>{activeManufacturers.map(m=>{const match=selectedOrder?checkManufacturerProduction(selectedOrder,m):null;return <option key={m.userId} value={m.userId} disabled={!match?.eligible}>{m.factoryName}{!match?.eligible?' · Requirements not met':''}</option>;})}</select>
            </div>
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
              <p className="text-sm font-medium text-[#737373]">Quote due</p>
              <Input
                aria-label="Quotation deadline" min={localDate()} disabled={committing}
                type="date"
                value={dueQuoteBy}
                onChange={(e) => {setDueQuoteBy(e.target.value);setAssignmentError('');}}
                className="mt-2 h-12 w-full border-[#dedede] bg-[#fafafa] text-base text-[#262626]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="h-12 flex-1 bg-[#CC2D24] text-base text-[#262626] hover:bg-[#CC2D24]/90"
                onClick={commit}
                disabled={committing||!manufacturerId||!(() => { const order=orders.find(item=>item.id===action.orderId);const factory=activeManufacturers.find(item=>item.userId===manufacturerId);return order&&factory&&checkManufacturerProduction(order,factory).eligible; })()}
              >
                {committing ? 'Assigning…' : action.mode==='reroute'?'Reassign manufacturer':'Assign manufacturer'}
              </Button>
              <Button
                variant="outline"
                className="h-12 border-[#dedede] bg-transparent px-6 text-base text-[#737373]"
                disabled={committing} onClick={() => setAction(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
