import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import './superadmin-assignment.css';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import { getSupabase } from '../../lib/supabaseClient';
import { assignMatchedManufacturer, invalidateSuperadminReads } from '../../lib/superadminDb';
import { checkManufacturerProduction, recommendManufacturers } from '../../data/assignmentRecommendation';
import { useEffect, useRef, useState } from 'react';
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
  return new Date(iso.length===10?iso+'T12:00:00':iso).toLocaleDateString(cerigaLocale(), {
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

type Match = {
  id: string; name: string; eligible: boolean; failures: string[]; warnings: string[]; reasons: string[];
  rank?: number; comparable?: boolean; reason?: string; active?: number; units?: number;
  samples?: number; bulk?: number; unknownUnits?: number; unscheduled?: number;
  capacity?: number | null; capacitySource?: 'reported' | 'estimated' | 'unknown';
  capacityShortfall?: boolean;
  opportunities?: number; paid?: number; outstanding?: number; declines?: number; expired?: number;
  leadDays?: number; closedDays?: number; quoteConflict?: boolean; competingDeadlines?: number;
  closureDeadlines?: number; reliability?: number | null; lastAssignment?: string;
};

type AssignmentEvent = {
  id: string; event: string; at: string; factory: string; dueQuoteBy?: string; overrideReason?: string;
};

const assignmentEventLabels: Record<string, string> = {
  assigned: 'Assigned · quotation requested',
  offer_published: 'Customer quotation published',
  manufacturer_declined: 'Request declined',
  admin_rejected: 'Quotation rejected',
  manufacturer_quotation_rejected: 'Quotation rejected',
  request_expired: 'Request expired',
  matching_quote_submitted: 'Quotation submitted',
  matching_manufacturer_selected: 'Manufacturer selected',
  matching_payment_confirmed: 'Payment confirmed',
  matching_production_started: 'Production released',
  matching_order_completed: 'Order completed',
};

function isMissingFunction(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST202';
}

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
      const needsReroute = ['rejected', 'declined', 'expired'].includes(order.factoryQuoteStatus ?? '');
      const quoteOpen = Boolean(order.manufacturerId) && !needsReroute && !order.quoteTiers?.length && !['quoted','priced','pending_review'].includes(order.factoryQuoteStatus??'');
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
        needsReroute,
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
  return needsReroute || (!order.manufacturerId && order.status === 'submitted' &&
    order.statusLabel !== 'Comparing manufacturer quotations');
}

type AssignmentSort = 'priority' | 'manufacturer-asc' | 'manufacturer-desc' | 'time';
const manufacturerCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function isJustSubmitted({ order, overdue }: ConsoleRow) {
  return order.status === 'submitted' && !order.manufacturerId && !overdue;
}

function statusLabel(row: ConsoleRow) {
  if (row.needsReroute) return 'Need reassignment';
  if (row.overdue) return 'Overdue';
  return isJustSubmitted(row) ? 'Just submitted' : STATUS_LABELS[row.order.status];
}

export function SuperAdminAssignmentConsole({ embedded = false }: { embedded?: boolean } = {}) {
  useCerigaTranslation();

  useCurrency();
  const { orders, manufacturers, loading, error, patchOrder, refresh } = useSuperadminData({scope:'assignment'});
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
    aria-label={manufacturerSort === 'ascending' ? cerigaTranslate("interface.text_37ee214a993adfce") : cerigaTranslate("interface.text_cc6409344789b09a")}
    onClick={() => { setSort(sort === 'manufacturer-asc' ? 'manufacturer-desc' : 'manufacturer-asc'); setPage(1); }}>{cerigaTranslate("interface.text_1b1cd45494319003")}{" "}<ManufacturerArrow size={13} aria-hidden />
  </button>;
  const timeHeader = <button type="button" className="assignment-column-trigger" data-active={sort === 'time'}
    aria-pressed={sort === 'time'} aria-label={cerigaTranslate("interface.text_916ffe60b3ef38c4")}
    onClick={() => { setSort(sort === 'time' ? 'priority' : 'time'); setPage(1); }}>{cerigaTranslate("interface.text_864927fe11e01252")}{" "}<ArrowUp size={13} aria-hidden />
  </button>;
  const statusHeader = <button type="button" className="assignment-column-trigger" data-active={Boolean(statusFilter)}
    aria-label={filter === 'overdue' ? cerigaTranslate("interface.text_b64f86c655500eed") : filter === 'submitted' ? cerigaTranslate("interface.text_ae7c855fe54cd79e") : cerigaTranslate("interface.text_df197b27f9a320ec")}
    onClick={() => { setFilter(filter === 'overdue' ? 'submitted' : filter === 'submitted' ? 'all' : 'overdue'); setPage(1); }}>{cerigaTranslate("orders.status")}{" "}<ListFilter size={13} aria-hidden />{statusFilter && <span className="assignment-status-selection">{statusFilter}</span>}
  </button>;

  const pageCount=Math.max(1,Math.ceil(filtered.length/20)),currentPage=Math.min(page,pageCount),visible=filtered.slice((currentPage-1)*20,currentPage*20);
  const selectedOrder=orders.find(o=>o.id===action?.orderId);
  const [ranking, setRanking] = useState<{ key: string; windowDays?: number; candidates: Match[]; comparisonReleaseReady?:boolean; evidenceUpdatedAt?:Record<string,string>; legacy?: boolean } | null>(null);
  const [rankingError, setRankingError] = useState('');
  const [rankingRetry, setRankingRetry] = useState(0);
  const [history, setHistory] = useState<AssignmentEvent[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'automatic' | 'manual' | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [modeError, setModeError] = useState('');
  const [compareTwo, setCompareTwo] = useState(false);
  const [secondChoice, setSecondChoice] = useState('');
  const [secondDue, setSecondDue] = useState('');

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().rpc('admin_assignment_mode');
        if (error) throw error;
        if (current) setAssignmentMode(data === 'automatic' ? 'automatic' : 'manual');
      } catch (cause) {
        if (current) setModeError(isMissingFunction(cause)
          ? 'Automatic assignment requires the database update.'
          : 'Could not load the assignment mode.');
      }
    })();
    return () => { current = false; };
  }, []);

  const toggleAssignmentMode = async () => {
    if (!assignmentMode || savingMode) return;
    setSavingMode(true);
    setModeError('');
    try {
      const { data, error } = await getSupabase().rpc('admin_assignment_mode', {
        p_mode: assignmentMode === 'automatic' ? 'manual' : 'automatic',
      });
      if (error) throw new Error(error.message);
      setAssignmentMode(data === 'automatic' ? 'automatic' : 'manual');
      await refresh();
    } catch (cause) {
      setModeError(cause instanceof Error ? cause.message : 'Could not save the assignment mode.');
    } finally {
      setSavingMode(false);
    }
  };
  const orderId = action?.orderId;
  const validDeadline = /^\d{4}-\d{2}-\d{2}$/.test(dueQuoteBy) &&
    Number.isFinite(Date.parse(dueQuoteBy + 'T12:00:00Z')) && dueQuoteBy >= localDate();
  const rankKey = orderId + ':' + dueQuoteBy + ':' + rankingRetry;
  const currentRanking = ranking?.key === rankKey ? ranking : null;
  const recommendations = currentRanking?.legacy && selectedOrder
    ? (() => {
        const factories = activeManufacturers;
        const ranked = recommendManufacturers(selectedOrder, factories);
        const rankedIds = ranked.map(({ factory }) => factory.userId);
        const sorted = [...ranked.map(({ factory }) => factory), ...factories.filter(factory => !rankedIds.includes(factory.userId))];
        return sorted.map((factory): Match => {
          const match = checkManufacturerProduction(selectedOrder, factory);
          return { ...match, id: factory.userId, name: factory.factoryName, rank: rankedIds.indexOf(factory.userId) + 1 };
        });
      })()
    : currentRanking?.candidates ?? [];
  const preferred = recommendations.find(match => match.rank === 1);

  useEffect(() => {
    if (!orderId || !validDeadline) return;
    let cancelled = false;
    setRankingError('');
    void (async () => {
      try {
        const { data, error } = await getSupabase().rpc('admin_manufacturer_matching', { p_order: orderId, p_due: dueQuoteBy });
        if (error) throw error;
        if (!cancelled) {
          const result = data as { windowDays: number; candidates: Match[];comparisonReleaseReady?:boolean };
          setRanking({ key: rankKey, ...result });
          setManufacturerId(previous =>
            result.candidates.some(match => match.id === previous && match.eligible)
              ? previous : result.candidates.find(match => match.rank === 1)?.id ?? '');
        }
      } catch (cause) {
        if (cancelled) return;
        if (isMissingFunction(cause)) setRanking({ key: rankKey, candidates: [], legacy: true });
        else setRankingError((cause as { message?: string }).message ?? 'Could not load recommendations.');
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, dueQuoteBy, validDeadline, rankKey]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    void (async () => {
      try {
        const { data, error } = await getSupabase().rpc('admin_manufacturer_assignment_history', { p_order: orderId });
        if (error) throw error;
        if (!cancelled) setHistory(data as AssignmentEvent[]);
      } catch (cause) {
        if (!cancelled) setHistoryError(isMissingFunction(cause)
          ? 'Assignment history requires the matching database update.'
          : (cause as { message?: string }).message ?? 'Could not load history.');
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const manufacturerMatches = recommendations.map(match => {
    const factory = activeManufacturers.find(item => item.userId === match.id);
    return { factory: { userId: match.id, factoryName: match.name, email: factory?.email ?? '' }, match };
  });
  const matchingManufacturers = manufacturerMatches.filter(({factory}) => (factory.factoryName+' '+factory.email).toLowerCase().includes(manufacturerSearch.trim().toLowerCase()));
  const eligibleManufacturers = matchingManufacturers.filter(({match}) => match.eligible);
  const unavailableManufacturers = matchingManufacturers.filter(({match}) => !match.eligible);
  const selectedMatch = recommendations.find(match => match.id === manufacturerId && match.eligible);
  const secondOptions = recommendations.filter(match => match.eligible && match.id !== manufacturerId);
  const secondMatch = secondOptions.find(match => match.id === secondChoice) ?? secondOptions[0];
  const selectedManufacturer = manufacturerMatches.find(({ factory }) => factory.userId === manufacturerId)?.factory;
  const overdueCount = rows.filter((r) => r.overdue).length;
  const unassignedCount = rows.filter((r) => !r.order.manufacturerId).length;
  const rerouteCount = rows.filter((r) => r.needsReroute).length;
  const reviewIds = filtered.filter(needsAssignment).map(({ order }) => order.id);

  const openAssign = (orderId: string, productName: string, mode: 'assign' | 'reroute', review?: AssignAction['review']) => {
    setManufacturerId('');
    setCompareTwo(false);
    setSecondChoice('');
    setSecondDue('');
    setRanking(null);
    setRankingError('');
    setHistory([]);
    setHistoryError('');
    setOverrideReason('');
    setManufacturerSearch('');
    setDueQuoteBy(addDaysIso(3));
    setAssignmentError('');
    setAction({ orderId, productName, mode, review });
  };

  const linkedOrder=useRef('');
  useEffect(()=>{
    const target=typeof window!=='undefined'?new URLSearchParams(window.location?.search??'').get('order'):null;
    if(!target||loading||linkedOrder.current===target)return;
    const order=orders.find(row=>row.id===target);
    if(order){linkedOrder.current=target;openAssign(order.id,order.productName,order.manufacturerId?'reroute':'assign');}
  },[loading,orders]);

  const openReviewOrder = (orderIds: string[], from: number) => {
    const index = orderIds.findIndex((id, position) =>
      position >= from && rows.some(row => row.order.id === id && needsAssignment(row)));
    const next = index >= 0 ? rows.find(row => row.order.id === orderIds[index]) : undefined;
    if (!next) {
      setAction(null);
      toast.success(cerigaTranslate("interface.text_bebf24e5ad8b7bd3"));
      return;
    }
    const { order } = next;
    openAssign(order.id, order.productName, order.manufacturerId ? 'reroute' : 'assign', { orderIds, index });
  };

  const commit = async () => {
    if(commitLock.current)return;
    setAssignmentError('');
    if (!action || !manufacturerId) {
      toast.error(cerigaTranslate("interface.text_525d63d47d693a41"));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueQuoteBy)||!Number.isFinite(Date.parse(dueQuoteBy+'T12:00:00Z'))||new Date(dueQuoteBy+'T12:00:00Z').toISOString().slice(0,10)!==dueQuoteBy||dueQuoteBy<localDate()) {
      setAssignmentError('Choose today or a future quotation deadline.');
      return;
    }
    if (!selectedMatch) return;
    commitLock.current=true;setCommitting(true);
    try {
      const reason = preferred && preferred.id !== manufacturerId ? overrideReason.trim() || null : null;
      if (compareTwo) {
        if(currentRanking?.comparisonReleaseReady===false)throw new Error(cerigaTranslate('workflow.comparisonUnavailable'));
        if (!secondMatch) throw new Error("Choose a second eligible manufacturer.");
        const { data, error } = await getSupabase().rpc('admin_request_factory_comparison', {
          p_order: action.orderId, p_first: manufacturerId, p_second: secondMatch.id,
          p_due: dueQuoteBy, p_second_due: secondDue || dueQuoteBy,
        });
        if (error || data !== action.orderId) throw new Error(error?.message ?? 'Quotation requests were not saved.');
        invalidateSuperadminReads();
      } else if (currentRanking?.legacy) {
        const saved = await patchOrder(action.orderId, { assignedManufacturerId: manufacturerId, dueQuoteBy });
        if (!saved) throw new Error("Could not save the assignment.");
      } else {
        await assignMatchedManufacturer(action.orderId, manufacturerId, dueQuoteBy, reason);
      }
      toast.success(cerigaTranslateLabel(compareTwo ? cerigaTranslate("interface.text_2cb203e6166af493")
        : (action.mode==='reroute'?cerigaTranslate("interface.text_36ce9ea79376c7f8"):cerigaTranslate("interface.text_08ee4565a256df6e"))+(selectedManufacturer?.factoryName??'manufacturer')));
      if (action.review) openReviewOrder(action.review.orderIds, action.review.index + 1);
      else setAction(null);
      try{await refresh();}catch{toast.error(cerigaTranslate("interface.text_bce3972dd06c038d"));}
    }catch(e){setAssignmentError(e instanceof Error?e.message:'Could not save assignment.');}
    finally{commitLock.current=false;setCommitting(false);}
  };

  return (
    <div className="admin-assignment space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {!embedded && <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Route className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">{cerigaTranslate("adminOrders.operations")}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#262626] sm:text-3xl">{cerigaTranslate("interface.text_4d57f3249dff149f")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#737373]">{cerigaTranslate("interface.text_cc8b7adf1cc914c4")}</p>
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-h-10"
            aria-label={cerigaTranslate("interface.text_60585f25c44761cb")} aria-pressed={assignmentMode === 'automatic'}
            disabled={!assignmentMode || savingMode} onClick={() => void toggleAssignmentMode()}>
            {savingMode ? cerigaTranslate("common.saving") : assignmentMode === 'automatic' ? cerigaTranslate("interface.text_327d9a23b6eda22c") : assignmentMode === 'manual' ? cerigaTranslate("interface.text_ab56d8a4a51d7cbd") : cerigaTranslate("interface.text_e34bfe08d279183b")}
          </Button>
          <Button
            type="button"
            className="min-h-10 bg-[#CC2D24]"
            disabled={loading || !!error || reviewIds.length === 0}
            onClick={() => openReviewOrder(reviewIds, 0)}
          >{cerigaTranslate("interface.text_8132bd19032a8d33")}{reviewIds.length}) <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {modeError && <p role="alert" className="assignment-error">{cerigaTranslateLabel(modeError)}</p>}
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("interface.text_f8f858967058d792")}</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("adminOrders.unassigned")}</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("interface.text_d32355c76e883f79")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#737373]">{loading||error?'—':rerouteCount}</p>
        </button>
      </div>

      {error&&<div role="alert" className="assignment-error">{cerigaTranslate("interface.text_3420e6c94fcfc431")}{" "}{cerigaTranslateLabel(error)}<button type="button" disabled={loading} onClick={()=>void refresh()}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button></div>}
      <div className="assignment-search"><input aria-label={cerigaTranslate("interface.text_42e6430634c3258e")} type="search" placeholder={cerigaTranslate("adminOrders.search")} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{hasFilters&&<button type="button" onClick={()=>{setSearch('');setFilter('all');setPage(1);}}>{cerigaTranslate("orders.clear")}</button>}</div>
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
            {cerigaTranslateLabel(f.label)}
          </button>
        ))}
      </div>

      <div className="assignment-mobile-filters" role="group" aria-label={cerigaTranslate("interface.text_9358a8af7c9dbc58")}>
        {cerigaTranslateLabel(manufacturerHeader)}{cerigaTranslateLabel(timeHeader)}{cerigaTranslateLabel(statusHeader)}
      </div>
      <div className="assignment-table overflow-hidden rounded-md border border-[#e2e2e2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-[#e2e2e2] bg-[#fafafa] text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                <th scope="col" className="px-4 py-2">{cerigaTranslate("adminOrders.order")}</th>
                <th scope="col" className="px-4 py-2" aria-sort={manufacturerSort !== 'none' ? manufacturerSort : undefined}>{cerigaTranslateLabel(manufacturerHeader)}</th>
                <th scope="col" className="px-4 py-2">{cerigaTranslate("manufacturerOrders.quoteDue")}</th>
                <th scope="col" className="px-4 py-2" aria-sort={sort === 'time' ? 'ascending' : undefined}>{cerigaTranslateLabel(timeHeader)}</th>
                <th scope="col" className="px-4 py-2">{cerigaTranslateLabel(statusHeader)}</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#737373]">
                    {loading ? cerigaTranslate("interface.text_8f923d0e9d192623") : error ? cerigaTranslate("interface.text_2e745b246fd8e238") : hasFilters ? cerigaTranslate("interface.text_523cb28c6ba3db23") : cerigaTranslate("interface.text_591812e5298131b8")}
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
                        <span className="text-[12px] text-[#737373]">{cerigaTranslate("adminOrders.unassigned")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="text-[12px] tabular-nums text-[#737373]">{formatDate(order.dueQuoteBy)}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {!order.manufacturerId || slaHoursLeft == null ? (
                        <span className="text-[12px] text-[#737373]">{order.manufacturerId ? '—' : cerigaTranslate("adminOrders.unassigned")}</span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[12px] tabular-nums',
                            slaHoursLeft < 0 ? 'text-[#737373]' : 'text-[#737373]',
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {slaHoursLeft < 0
                            ? cerigaTranslate("interface.text_aa29a6b86caa9a92",{value0:(Math.abs(slaHoursLeft)/24)})
                            : slaHoursLeft===0?cerigaTranslate("interface.text_19e82138c35ffb6f"):cerigaTranslate("interface.text_af8b4f405e213fd8",{value0:(slaHoursLeft/24)})}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <p className="text-[12px] text-[#737373]">{cerigaTranslateLabel(statusLabel(row))}</p>
                      {order.factoryQuoteStatus ? (
                        <p className="text-[10px] text-[#737373]">{cerigaTranslate("interface.text_eb15f88dbe7997e8")}{" "}{order.factoryQuoteStatus}
                        </p>
                      ) : null}
                      {needsReroute && order.factoryRejectReason ? (
                        <p className="mt-1 max-w-[200px] text-[10px] text-[#737373]">{cerigaTranslate("interface.text_85be99c92549ca81")}{" "}{order.factoryRejectReason}
                        </p>
                      ) : null}
                      {order.quoteTiers?.length ? (
                        <p className="text-[10px] text-[#737373]">{cerigaTranslate("interface.text_eb4cdebd82bf1194")}{" "}{displayMoney(order.quoteTiers[0].manufacturerQuoteCents,order.quoteTiers[0].currency)}+
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
                            <Package className="mr-1 h-3.5 w-3.5" />{cerigaTranslate("interface.text_8ece895c9b32c643")}</Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#dedede] bg-[#fafafa] text-[#737373]"
                            onClick={() => openAssign(order.id, order.productName, 'reroute')}
                          >
                            <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />{cerigaTranslate("interface.text_4591c339cfa65f0a")}</Button>
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

      <div className="assignment-mobile-list">{visible.map(row=>{const {order,overdue,needsReroute}=row;return <article key={order.id}><Link to={'/superadmin/orders/'+order.id}><strong>{order.productName}</strong><span>#{order.id.slice(0,8)} · {order.userName}</span></Link><p>{order.manufacturerName||cerigaTranslate("adminOrders.unassigned")} · {cerigaTranslateLabel(statusLabel(row))}</p><p>{needsReroute?cerigaTranslate("interface.text_8e12d5fdbc866a18"):overdue?cerigaTranslate("interface.text_b84a0750c36a1a25"):cerigaTranslate("interface.text_ce771a5ec66dc4df",{value0:(formatDate(order.dueQuoteBy))})}</p>{needsReroute&&order.factoryRejectReason&&<p className="assignment-decline">{order.factoryRejectReason}</p>}<button type="button" onClick={()=>openAssign(order.id,order.productName,order.manufacturerId?'reroute':'assign')}>{order.manufacturerId?cerigaTranslate("interface.text_a57e26d2ab95c2f1"):cerigaTranslate("adminOrders.assign")}</button></article>;})}{!visible.length&&<p>{loading?cerigaTranslate("interface.text_8f923d0e9d192623"):error?cerigaTranslate("interface.text_2e745b246fd8e238"):cerigaTranslate("interface.text_c0661a583269d084")}</p>}</div>
      <nav className="assignment-pagination" aria-label={cerigaTranslate("interface.text_88db161ef32369c8")}><span>{filtered.length?(currentPage-1)*20+1:0}–{Math.min(currentPage*20,filtered.length)}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{filtered.length}{" "}{cerigaTranslate("interface.text_ec72420df5dfbdce")}</span><div><button type="button" disabled={loading||currentPage<=1} onClick={()=>setPage(currentPage-1)}>{cerigaTranslate("common.previous")}</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={loading||currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>{cerigaTranslate("common.next")}</button></div></nav>
      {action ? (
        <Dialog open onOpenChange={(next) => { if (!next && !committing) setAction(null); }}>
        <DialogContent className="assignment-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-md border-[#e2e2e2] bg-white p-6 text-[#262626] sm:max-w-[760px] sm:p-8">
          {action.review && <p className="pr-6 text-xs font-medium text-[#737373]" role="status">{cerigaTranslate("interface.text_153cdaaec56103da")}{" "}{action.review.index + 1}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{action.review.orderIds.length}
          </p>}
          <DialogTitle className="pr-6 text-xl font-semibold leading-snug sm:text-2xl">
            {action.mode === 'reroute' ? cerigaTranslate("interface.text_ffe01012913a7e33") : cerigaTranslate("interface.text_87a07c01e2d180d3")}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#737373]">{action.productName}{" "}{cerigaTranslate("interface.text_460e5ee3e0d875e6")}</DialogDescription>
          {action.review && selectedOrder && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-3 py-2.5 text-xs text-[#525252]">
            <span>{selectedOrder.userName} · {selectedOrder.manufacturerName ?? cerigaTranslate("adminOrders.unassigned")}</span>
            <Link className="underline" to={`/superadmin/orders/${selectedOrder.id}`}>{cerigaTranslate("interface.text_fd6e2450fe014f75")}</Link>
            {selectedOrder.factoryRejectReason && <p className="w-full">{cerigaTranslate("interface.text_85be99c92549ca81")}{" "}{selectedOrder.factoryRejectReason}</p>}
          </div>}
          {assignmentError&&<p role="alert" className="assignment-error">{cerigaTranslateLabel(assignmentError)}</p>}
          <div className="space-y-5">
            <details className="manufacturer-unavailable">
              <summary>{cerigaTranslate("interface.text_1892bae2c2508718")}</summary>
              {historyLoading ? <p role="status">{cerigaTranslate("interface.text_a960c435c77f666c")}</p> : historyError ? <p role="alert">{cerigaTranslateLabel(historyError)}</p>
                : !history.length ? <p>{cerigaTranslate("interface.text_8c1d5002f0062ab8")}</p> : <ul className="space-y-2">
                  {history.map(event => <li key={event.id}>
                    <strong>{event.factory}</strong> · {cerigaTranslateLabel(assignmentEventLabels[event.event] ?? event.event)} · {formatDate(event.at)}
                    {event.dueQuoteBy && <p>{cerigaTranslate("manufacturerOrders.quoteDue")}{" "}{formatDate(event.dueQuoteBy)}</p>}
                    {event.overrideReason && <p>{cerigaTranslate("interface.text_ee6541aed4070fae")}{" "}{event.overrideReason}</p>}
                  </li>)}
                </ul>}
            </details>
            {rankingError && <div role="alert" className="assignment-error">{cerigaTranslateLabel(rankingError)}{' '}
              <button type="button" onClick={() => setRankingRetry(value => value + 1)}>{cerigaTranslate("interface.text_1fb7f74df156179f")}</button>
            </div>}
            {!currentRanking && !rankingError && validDeadline && <p role="status">{cerigaTranslate("interface.text_a67b970957d118c8")}</p>}
            {currentRanking?.legacy ? <p role="status" className="text-xs text-[#737373]">{cerigaTranslate("interface.text_2b1afcff9678a7af")}{' '}<button type="button" className="underline" onClick={() => setRankingRetry(value => value + 1)}>{cerigaTranslate("interface.text_fb7099ad8e818d42")}</button>
            </p> : currentRanking && <p className="text-xs text-[#737373]">{cerigaTranslate("interface.text_f9d1b3a336cf2dce")}{" "}{currentRanking.windowDays}{" "}{cerigaTranslate("interface.text_4deca289f6d1830b")}</p>}
            <fieldset className="manufacturer-picker">
              <legend>{cerigaTranslate("adminOrders.factory")}{" "}<span>{manufacturerMatches.filter(({match})=>match?.eligible).length}{" "}{cerigaTranslate("interface.text_2d92fc5142e6a2c1")}</span></legend>
              {!currentRanking?.legacy && selectedOrder && !selectedOrder.quoteTiers?.length && (
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={compareTwo} disabled={committing}
                    onChange={event => setCompareTwo(event.target.checked)} />{cerigaTranslate("interface.text_dfd29b6d84841025")}</label>
              )}
              <div className="manufacturer-picker-search"><Search size={16} aria-hidden /><input type="search" aria-label={cerigaTranslate("interface.text_45e581d780d8902a")} placeholder={cerigaTranslate("interface.text_ec054f02deadb787")} value={manufacturerSearch} disabled={committing} onChange={e=>setManufacturerSearch(e.target.value)}/>{manufacturerSearch&&<button type="button" disabled={committing} onClick={()=>setManufacturerSearch('')}>{cerigaTranslate("interface.text_83b12c2216efb4fd")}</button>}</div>
              <div className="manufacturer-picker-options">
                {eligibleManufacturers.map(({factory,match})=>{
                  const selected = manufacturerId===factory.userId;
                  return <article key={factory.userId} className={cn('manufacturer-choice',selected&&'is-selected')}>
                    <label className="manufacturer-choice-label">
                      <input type="radio" name="manufacturer" aria-label={factory.factoryName} value={factory.userId} checked={selected} disabled={committing} onChange={()=>{setManufacturerId(factory.userId);setAssignmentError('');}}/>
                      <span className="manufacturer-choice-icon"><Factory size={18}/></span>
                      <span className="manufacturer-choice-body">
                        <span className="manufacturer-choice-name">{factory.factoryName}
                          <span className="manufacturer-choice-badge">{match.rank === 1 ? cerigaTranslate("interface.text_d70604e843046137") : match.comparable ? cerigaTranslate("interface.text_3dd02aae9f536c12") : cerigaTranslate("interface.text_1889cf7628004753")}</span>
                        </span>
                        {!currentRanking?.legacy && <><span className="manufacturer-choice-meta">{match.active}{" "}{cerigaTranslate("interface.text_20532dcaeae1d057")}{" "}{match.capacity == null
                          ? cerigaTranslate("interface.text_64e2affa4b87afdb") : match.capacity.toLocaleString(cerigaLocale()) + ' ' + (match.capacitySource === 'reported' ? cerigaTranslate("interface.text_d263e8f17bd64426") : cerigaTranslate("interface.text_ee7ae711e2d4dc96"))}</span>
                        <span className="manufacturer-choice-meta">{match.opportunities}{" "}{cerigaTranslate("interface.text_c3d3a39a95ef850a")}{" "}{match.paid}{" "}{cerigaTranslate("interface.text_e5a4a69c8e5f2887")}</span>
                        <span className="manufacturer-choice-meta">{cerigaTranslateLabel(match.reason)}</span></>}
                      </span>
                      <span className="manufacturer-choice-selected">{selected?<><Check size={14}/>{cerigaTranslate("interface.text_57fd7a0cf33f2666")}</>:cerigaTranslate("interface.text_2a78025de6aae5e7")}</span>
                    </label>
                    <details className="manufacturer-choice-details"><summary>{cerigaTranslate("interface.text_770ca257b35dad40")}</summary>
                      <ul>
                        {currentRanking?.evidenceUpdatedAt?.[match.id]&&<li>{cerigaTranslate('workflow.evidenceUpdated')}: {formatDate(currentRanking.evidenceUpdatedAt[match.id])}</li>}
                        {match.reasons.map(reason => <li key={reason}>{cerigaTranslateLabel(reason)}</li>)}
                        {!currentRanking?.legacy && <><li>{match.samples}{" "}{cerigaTranslate("interface.text_9ff25b8fc15262a6")}{" "}{match.bulk}{" "}{cerigaTranslate("interface.text_09fc6dc6a80a7ba2")}{" "}{match.units?.toLocaleString(cerigaLocale())}{" "}{cerigaTranslate("interface.text_64f35981e4c0f85b")}</li>
                        {!!match.unknownUnits && <li>{match.unknownUnits}{" "}{cerigaTranslate("interface.text_c00da41f0171791b")}</li>}
                        {match.capacityShortfall && <li>{cerigaTranslate("interface.text_454b73744abdbb1a")}</li>}
                        <li>{match.outstanding}{" "}{cerigaTranslate("interface.text_1a53ba886ec2553b")}{" "}{match.declines}{" "}{cerigaTranslate("interface.text_3240c10db229d918")}{" "}{match.expired}{" "}{cerigaTranslate("interface.text_1bae7110ba6c0758")}</li>
                        {match.lastAssignment && <li>{cerigaTranslate("interface.text_556bc0f0b5edc410")}{" "}{formatDate(match.lastAssignment)}</li>}
                        {match.leadDays != null && <li>{cerigaTranslate("interface.text_bbd85641c99f6f09")}{" "}{match.leadDays}{" "}{cerigaTranslate("interface.text_ab51004e9d71a485")}</li>}
                        {match.reliability != null && <li>{match.reliability}{cerigaTranslate("interface.text_d27ae60cfab0a0f0")}</li>}
                        {match.quoteConflict && <li>{cerigaTranslate("interface.text_3b27a0f59fc8599f")}</li>}
                        {!!match.closedDays && <li>{match.closedDays}{" "}{cerigaTranslate("interface.text_79b781a1fcd63377")}</li>}
                        {!!match.closureDeadlines && <li>{match.closureDeadlines}{" "}{cerigaTranslate("interface.text_ecf597e3732b520e")}</li>}
                        {!!match.competingDeadlines && <li>{match.competingDeadlines}{" "}{cerigaTranslate("interface.text_96447eb5f29fbfc8")}</li>}
                        {!!match.unscheduled && <li>{match.unscheduled}{" "}{cerigaTranslate("interface.text_56852e1bde39d8a2")}</li>}</>}
                        {match.warnings.map(warning => <li key={warning}>{warning}</li>)}
                      </ul>
                    </details>
                  </article>;
                })}
                {currentRanking && !eligibleManufacturers.length && <p className="manufacturer-picker-empty" role="status">{manufacturerSearch
                  ? cerigaTranslate("interface.text_04f549ba1ebd64ab")
                  : manufacturerMatches.length
                    ? cerigaTranslate("interface.text_170771b73e0ecf0f")
                    : cerigaTranslate("interface.text_85803ddbda9f6f67")}</p>}
                {!!unavailableManufacturers.length&&<details open={!eligibleManufacturers.length || undefined} className="manufacturer-unavailable"><summary>{cerigaTranslate("interface.text_5d08dcdb3dccf2ee")}{unavailableManufacturers.length})</summary>{unavailableManufacturers.map(({factory,match})=><div key={factory.userId}><strong>{factory.factoryName}</strong><p>{match.failures.join(' · ')}</p></div>)}</details>}
              </div>
            </fieldset>
            {compareTwo && <div className="space-y-3 rounded border p-3">{currentRanking?.comparisonReleaseReady===false&&<p role="alert" className="text-sm text-red-700">{cerigaTranslate('workflow.comparisonUnavailable')}</p>}
              <label className="block text-sm">{cerigaTranslate("interface.text_cb227a883cc2e990")}<select className="mt-2 block w-full rounded border p-2" disabled={committing || !secondOptions.length}
                  value={secondMatch?.id ?? ''} onChange={event => setSecondChoice(event.target.value)}>
                  {!secondOptions.length && <option value="">{cerigaTranslate("interface.text_d52f24b7ce7f778a")}</option>}
                  {secondOptions.map(match => <option key={match.id} value={match.id}>{match.name}</option>)}
                </select>
              </label>
              {secondMatch && <p className="text-xs text-[#737373]">{cerigaTranslateLabel(secondMatch.reason)} · {secondMatch.active}{" "}{cerigaTranslate("interface.text_0285970979d4cc5b")}</p>}
              <label className="block text-sm">{cerigaTranslate("interface.text_fabf507da0151d88")}<Input type="date" min={localDate()} value={secondDue || dueQuoteBy} disabled={committing}
                  onChange={event => setSecondDue(event.target.value)} />
              </label>
            </div>}
            {selectedMatch && <Link className="text-xs underline" to={'/superadmin/time-off?manufacturer=' + manufacturerId}>{cerigaTranslate("interface.text_31174a3431f6e1b9")}</Link>}
            {!compareTwo && !currentRanking?.legacy && preferred && selectedMatch && preferred.id !== manufacturerId && (
              <label className="block text-sm">{cerigaTranslate("interface.text_25c6f92c14934226")}<Input className="mt-2" value={overrideReason} maxLength={500} disabled={committing}
                  onChange={event => setOverrideReason(event.target.value)} />
              </label>
            )}
            <div>
              <label htmlFor="assignment-quote-due" className="assignment-deadline-label">{cerigaTranslate("interface.text_8b7993a7621fc287")}</label>
              <Input
                id="assignment-quote-due" aria-label={cerigaTranslate("interface.text_8b7993a7621fc287")} min={localDate()} disabled={committing}
                type="date"
                value={dueQuoteBy}
                onChange={(e) => {setDueQuoteBy(e.target.value);setAssignmentError('');}}
                className="mt-2 h-12 w-full border-[#dedede] bg-[#fafafa] text-base text-[#262626]"
              />
            </div>
            <div className="assignment-confirmation">
              <p>{selectedManufacturer ? <>{cerigaTranslate("interface.text_bef9d85df8ea13fe")}{" "}<strong>{selectedManufacturer.factoryName}</strong></> : cerigaTranslate("interface.text_893602743e0bb364")}</p>
              <div className="flex flex-wrap gap-2">
              <Button
                className="h-12 flex-1 bg-[#CC2D24] text-base text-[#262626] hover:bg-[#CC2D24]/90"
                onClick={commit}
                disabled={committing || !selectedMatch || (compareTwo && (!secondMatch||currentRanking?.comparisonReleaseReady===false))}
              >
                {committing ? cerigaTranslate("interface.text_8157fc4e6bdbbefa") : compareTwo ? cerigaTranslate("interface.text_7db5029ac7360cee") : action.review
                  ? action.mode === 'reroute' ? cerigaTranslate("interface.text_68583714172701b4") : cerigaTranslate("interface.text_86702c2c91547704")
                  : action.mode === 'reroute' ? cerigaTranslate("interface.text_a57e26d2ab95c2f1") : cerigaTranslate("adminOrders.assign")}
              </Button>
              <Button
                variant="outline"
                className="h-12 border-[#dedede] bg-transparent px-6 text-base text-[#737373]"
                disabled={committing} onClick={() => {
                  if (!commitLock.current && action.review) openReviewOrder(action.review.orderIds, action.review.index + 1);
                  else if (!commitLock.current) setAction(null);
                }}
              >
                {action.review ? cerigaTranslate("interface.text_b58eb52c8810b978") : cerigaTranslate("common.cancel")}
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
