import { formatQuantityLine as cerigaQuantityLine } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { FactoryHistoryOrders } from '../../components/manufacturer/FactoryHistoryOrders';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowUpRight,
  Bookmark,
  Download,
  Package,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FACTORY_STATUS_LABEL,
  bulkStartFactoryReview,
  downloadTextFile,
  factoryOrdersToCsv,
  formatFactoryDate,
  isFactoryQuoteOverdue,
  listFactoryOrders,
  type FactoryOrderStatus,
} from '../../data/manufacturerPortalMock';
import { formatOrderQuantitiesSummary, sumBreakdown } from '../../data/orderQuantities';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../components/ui/utils';

const FILTERS: { id: FactoryOrderStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'clarifying', label: 'Clarifying' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'in_production', label: 'In production' },
  { id: 'rejected', label: 'Declined' },
  { id: 'completed', label: 'Completed' },
];

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-sky-500/15 text-sky-200 ring-sky-500/20',
  clarifying: 'bg-[#CC2D24]/15 text-red-200 ring-[#CC2D24]/25',
  quoted: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
  rejected: 'bg-white/5 text-white/45 ring-white/10',
  in_production: 'bg-violet-500/15 text-violet-200 ring-violet-500/20',
  reviewing: 'bg-white/8 text-white/65 ring-white/10',
  completed: 'bg-white/5 text-white/50 ring-white/10',
};

const SAVED_FILTERS_KEY = 'ceriga_factory_order_filters_v1';

type SavedFilter = {
  id: string;
  name: string;
  status: FactoryOrderStatus | 'all';
  search: string;
  overdueOnly: boolean;
};

function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFilter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedFilters(filters: SavedFilter[]) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

function totalUnits(order: ReturnType<typeof listFactoryOrders>[number]) {
  const sample = sumBreakdown(order.orderQuantities.sample.bySize);
  const bulk = order.orderQuantities.bulkRuns.reduce(
    (s, run) => s + (run.targetTotal ?? sumBreakdown(run.bySize)),
    0,
  );
  return sample + bulk;
}

export function ManufacturerOrders(){return isSupabaseConfigured?<FactoryHistoryOrders/>:<ManufacturerOrdersPreview/>;}
function ManufacturerOrdersPreview() {
  useCerigaTranslation();

  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<FactoryOrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => loadSavedFilters());
  const [saveName, setSaveName] = useState('');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  void tick;
  const orders = listFactoryOrders(filter);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...orders].sort((a, b) => a.dueQuoteBy.localeCompare(b.dueQuoteBy));
    if (overdueOnly) list = list.filter((o) => isFactoryQuoteOverdue(o));
    if (!q) return list;
    return list.filter(
      (o) =>
        o.productName.toLowerCase().includes(q) ||
        o.brandName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.garmentType.toLowerCase().includes(q),
    );
  }, [orders, search, overdueOnly]);

  const overdueCount = useMemo(
    () => listFactoryOrders('all').filter((o) => isFactoryQuoteOverdue(o)).length,
    [tick],
  );

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (filtered.some((o) => o.id === id)) next.add(id);
      }
      return next;
    });
  }, [filtered]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((o) => selected.has(o.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((o) => o.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySaved = (sf: SavedFilter) => {
    setFilter(sf.status);
    setSearch(sf.search);
    setOverdueOnly(sf.overdueOnly);
    toast.success(cerigaTranslate("interface.text_d1c5043e7806d425",{value0:(sf.name)}));
  };

  const saveCurrentFilter = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error(cerigaTranslate("interface.text_33fd1134ee51fc49"));
      return;
    }
    const next: SavedFilter[] = [
      ...savedFilters,
      {
        id: `sf-${Date.now()}`,
        name,
        status: filter,
        search,
        overdueOnly,
      },
    ];
    setSavedFilters(next);
    persistSavedFilters(next);
    setSaveName('');
    toast.success(cerigaTranslate("interface.text_5fa6bbb20c6d4ec3"));
  };

  const removeSaved = (id: string) => {
    const next = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(next);
    persistSavedFilters(next);
  };

  const exportCsv = () => {
    const csv = factoryOrdersToCsv(filtered);
    downloadTextFile(`ceriga-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(cerigaTranslate("interface.text_680cac4e70bbb96c",{value0:(filtered.length)}));
  };

  const selectedNewIds = filtered
    .filter((o) => selected.has(o.id) && o.status === 'new')
    .map((o) => o.id);

  const commitBulkReview = () => {
    const n = bulkStartFactoryReview(selectedNewIds);
    setSelected(new Set());
    setTick((t) => t + 1);
    toast.success(cerigaTranslateLabel(n ? cerigaTranslate("interface.plural_7adbe58aac9cec3d",{value0:(n),count:Number(n)}) : cerigaTranslate("interface.text_d13b9f44551df2a5")));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Package className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{cerigaTranslate("interface.text_94835ea2fcf775cd")}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{cerigaTranslate("nav.orders")}</h1>
          <p className="mt-1 text-sm text-white/45">{cerigaTranslate("interface.text_ba5bfc85e72caf16")}{" "}{filtered.length}{" "}{cerigaTranslate("interface.text_baaf53622a51d975")}{overdueCount > 0 ? (
              <span className="ml-2 text-amber-300/90">· {overdueCount}{" "}{cerigaTranslate("interface.text_b260e2deb09c6094")}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/5 hover:text-white"
            onClick={exportCsv}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_91f71c14c8d6cc64")}</Button>
          <div className="relative w-full max-w-xs sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={cerigaTranslate("interface.text_a883a6c905ac8fb7")}
              className="h-10 w-full rounded-xl border border-[#252528] bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#CC2D24]/50"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
              filter === f.id
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                : 'border-[#252528] text-white/45 hover:text-white/75',
            )}
          >
            {cerigaTranslateLabel(f.label)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
            overdueOnly
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
              : 'border-[#252528] text-white/45 hover:text-white/75',
          )}
        >{cerigaTranslate("interface.text_f8f858967058d792")}</button>
      </div>

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_f52bc3467c8f281b")}</p>
            {savedFilters.length === 0 ? (
              <p className="mt-1 text-[12px] text-white/35">{cerigaTranslate("interface.text_90557b351752810e")}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {savedFilters.map((sf) => (
                  <span
                    key={sf.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#252528] bg-white/[0.03] pl-2.5 pr-1 py-1 text-[11px] text-white/70"
                  >
                    <button type="button" onClick={() => applySaved(sf)} className="hover:text-white">
                      {sf.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSaved(sf.id)}
                      className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white/70"
                      aria-label={cerigaTranslate("interface.text_50256b3995d67d1e",{value0:(sf.name)})}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={cerigaTranslate("interface.text_957064d14820b915")}
              className="h-9 w-40 border-white/15 bg-white/5 text-white"
            />
            <Button
              type="button"
              size="sm"
              className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
              onClick={saveCurrentFilter}
            >
              <Bookmark className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_9fe5192ce42624a0")}</Button>
          </div>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#252528] bg-white/[0.03] px-4 py-3">
          <p className="text-[12px] text-white/65">
            {selected.size}{" "}{cerigaTranslate("interface.text_d7cbbb688b2e506c")}{selectedNewIds.length > 0
              ? cerigaTranslate("interface.text_75aebe26af06b053",{value0:(selectedNewIds.length)})
              : ''}
          </p>
          <Button
            type="button"
            size="sm"
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            disabled={selectedNewIds.length === 0}
            onClick={() => setBulkConfirmOpen(true)}
          >{cerigaTranslate("interface.text_1cf5ecdbaaa0742e")}</Button>
          <button
            type="button"
            className="text-[11px] text-white/40 hover:text-white/70"
            onClick={() => setSelected(new Set())}
          >{cerigaTranslate("interface.text_83b12c2216efb4fd")}</button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-sm text-white/40">{cerigaTranslate("interface.text_bdf0b61d68459dde")}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#252528] bg-[#111113]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="border-b border-[#252528] bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="rounded border-white/30"
                      aria-label={cerigaTranslate("interface.text_b48c0322c62831f7")}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("adminOrders.order")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_fb9ef894175c3274")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_090ed4316f1d99fd")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_baaddf70fb5d432b")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_a9be9c3e9ab66e18")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("manufacturerOrders.quoteDue")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("orders.status")}</th>
                  <th className="px-4 py-3 font-semibold text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const qtyLines = formatOrderQuantitiesSummary(order.orderQuantities, cerigaQuantityLine).map(cerigaTranslateLabel);
                  const units = totalUnits(order);
                  const overdue = isFactoryQuoteOverdue(order);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/manufacturer/orders/${order.id}`)}
                      className="cursor-pointer border-b border-[#252528] transition last:border-0 hover:bg-white/[0.03]"
                    >
                      <td
                        className="px-4 py-3.5 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleOne(order.id)}
                          className="rounded border-white/30"
                          aria-label={cerigaTranslate("interface.text_33de0e8b35aac169",{value0:(order.id)})}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className="font-mono text-[11px] text-white/45">{order.id}</span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="max-w-[200px]">
                          <p className="truncate text-sm font-medium text-white">{order.productName}</p>
                          <p className="mt-0.5 truncate text-[11px] text-white/35">
                            {order.deliveryCity}, {order.deliveryCountry}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <p className="text-sm text-white/80">{order.brandName}</p>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className="text-[12px] text-white/55">{order.garmentType}</span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <p className="text-sm tabular-nums text-white/85">{units}</p>
                        <p className="mt-0.5 max-w-[140px] truncate text-[10px] text-white/35">
                          {qtyLines[0] ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              'text-[12px] tabular-nums',
                              overdue ? 'text-amber-200' : 'text-white/70',
                            )}
                          >
                            {formatFactoryDate(order.dueQuoteBy)}
                          </span>
                          {overdue ? (
                            <span className="inline-flex w-fit rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-inset ring-amber-500/25">{cerigaTranslate("orders.overdue")}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                            STATUS_STYLE[order.status] ?? STATUS_STYLE.reviewing,
                          )}
                        >
                          {cerigaTranslateLabel(FACTORY_STATUS_LABEL[order.status])}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right">
                        <Link
                          to={`/manufacturer/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#252528] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-[#CC2D24]/40 hover:text-white"
                        >{cerigaTranslate("interface.text_ed077f3d8125d60d")}<ArrowUpRight className="h-3.5 w-3.5 text-[#CC2D24]" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title={cerigaTranslate("interface.text_4c535e87aaff2041")}
        description={cerigaTranslate("interface.plural_3108eb17b4360b5f",{value0:(selectedNewIds.length),count:Number(selectedNewIds.length)})}
        confirmLabel={cerigaTranslate("interface.text_1cf5ecdbaaa0742e")}
        onConfirm={commitBulkReview}
      />
    </div>
  );
}
