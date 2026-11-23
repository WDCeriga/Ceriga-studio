import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useState } from 'react';
import { ManufacturerDashboardView, type OperationsData, type OperationsFilters } from '../../components/dashboard/ManufacturerDashboardView';
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabaseClient';

const initialFilters: OperationsFilters = {
  days: 30, search: '', stage: 'all', sort: 'deadline', due: 'all', staff: 'all',
  type: 'all', priority: 'all', action: 'all', task_staff: 'all', page: 0, task_page: 0, soon: 3,
};

export function ManufacturerDashboard() {
  useCerigaTranslation();

  const { user, authReady } = useAuth();
  const { access, ready } = useFactoryAccess();
  const scope = JSON.stringify([user?.id, access?.factoryId, access?.permissions]);
  const [filters, setFilters] = useState(initialFilters);
  const [last, setLast] = useState<{ scope: string; data: OperationsData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const data = last?.scope === scope ? last.data : null;

  useEffect(() => {
    if (!ready || !authReady) return;
    if (!isSupabaseConfigured || !access?.factoryId) {
      setError('An active factory workspace is required to load the dashboard.');
      setLoading(false);
      return;
    }

    const abort = new AbortController();
    const parameters = Object.fromEntries(Object.entries(filters).map(([key, value]) => ['p_' + key, value]));
    let inFlight = false;
    async function load() {
      if (inFlight || abort.signal.aborted) return;
      inFlight = true;
      setLoading(true);
      try {
        const { data: next, error: failure } = await getSupabase()
          .rpc('manufacturer_operations_dashboard', parameters).abortSignal(abort.signal);
        if (failure) throw failure;
        if (!next?.counts || !Array.isArray(next.orders)) throw new Error("Invalid dashboard response.");
        if (!abort.signal.aborted) {
          setLast({ scope, data: next });
          setError('');
        }
      } catch (cause) {
        if (!abort.signal.aborted) setError((cause as { message?: string }).message || cerigaTranslate("interface.text_25b8c889b5d82c71"));
      } finally {
        inFlight = false;
        if (!abort.signal.aborted) setLoading(false);
      }
    }

    const initial = window.setTimeout(() => void load(), 200);
    const update = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(update, 30000);
    const events = ['focus', 'ceriga-orders-updated', 'ceriga-qc-updated', 'ceriga-production-timeline', 'ceriga-manufacturer-data-updated'];
    events.forEach(event => window.addEventListener(event, update));
    return () => {
      abort.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, update));
    };
  }, [scope, ready, authReady, access?.factoryId, filters, refresh]);

  function update(patch: Partial<OperationsFilters>) {
    setLoading(true);
    setFilters(previous => ({
      ...previous,
      page: ['search','stage','sort','due','staff','type','priority'].some(key => key in patch) ? 0 : previous.page,
      task_page: ['action','task_staff'].some(key => key in patch) ? 0 : previous.task_page,
      ...patch,
    }));
  }

  return <ManufacturerDashboardView data={data} error={error} loading={loading} filters={filters}
    factoryId={access?.factoryId ?? ''} permissions={access?.permissions ?? []}
    onChange={update} onRefresh={() => setRefresh(value => value + 1)} />;
}
