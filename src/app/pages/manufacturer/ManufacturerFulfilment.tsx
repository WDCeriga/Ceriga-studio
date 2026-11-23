import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { activeLocale } from '../../i18n/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowRight, Check, Package, RefreshCw, Search } from 'lucide-react';
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { getSupabase } from '../../lib/supabaseClient';
import { stageLabel } from '../../lib/productionTimeline';
import { ProductionWorkspace } from '../../components/manufacturer/ProductionWorkspace';
import { OrderQualityControl } from '../../components/quality/OrderQualityControl';
import { OrderCommunication } from '../../components/orders/OrderCommunication';
import '../../components/dashboard/manufacturer-dashboard.css';
import '../../components/quality/manufacturer-quality.css';
import '../../components/manufacturer/manufacturer-delivery.css';
import './manufacturer-fulfilment.css';

type Step = 'production' | 'quality' | 'delivery';
type FulfilmentOrder = {
  id: string; name: string; garment: string; quantity: number; status: string;
  qc_status: string; step: Step | 'completed'; stage: string; released_at: string | null;
  expected_completion: string | null; uncertain: boolean | null; needs_review: string | null;
  tracking: string | null;completion_method?:string;
  history: { id: string; kind: string; explanation: string; created_at: string }[];
};
type Board = { total: number; counts: Partial<Record<Step | 'completed', number>> | null; orders: FulfilmentOrder[] };
const steps: { id: Step; label: string }[] = [
  { id: 'production', label: 'Production' },
  { id: 'quality', label: 'Quality check' },
  { id: 'delivery', label: 'Delivery' },
];
const date = (value: string | null) => value
  ? new Date(value).toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short' }) : 'Not scheduled';
function nextAction(order: FulfilmentOrder) {
  if (order.step === 'completed') return o.completion_method==='admin_delivery'?cerigaTranslate('workflow.confirmedDelivery'):o.completion_method==='automatic'?cerigaTranslate('workflow.automaticClosure'):'View completed order';
  if (order.step === 'delivery') return order.status === 'shipping' ? 'Track delivery' : 'Complete handover';
  if (order.step === 'quality') return order.qc_status === 'pending_review' ? 'Waiting for Ceriga to approve the quality check'
    : order.qc_status === 'changes_required' ? 'Update quality check' : 'Submit quality check';
  return order.released_at ? stageLabel(order.stage) : 'Waiting for production authorisation';
}

export function LegacyFulfilmentRoute() {
  const { orderId } = useParams();
  const { pathname } = useLocation();
  const stage = pathname.split('/')[2];
  return <Navigate replace to={'/manufacturer/fulfilment' +
    (orderId ? '/' + orderId : '?step=' + (stage === 'shipping' ? 'delivery' : stage))}/>;
}

export function ManufacturerFulfilment() {
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const { orderId } = useParams();
  const { access, ready } = useFactoryAccess();
  const [board, setBoard] = useState<Board | null>(null);
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const requestedFilter = params.get('step');
  const filter = requestedFilter && ['production', 'quality', 'delivery', 'dispatch', 'completed'].includes(requestedFilter) ? requestedFilter : 'active';
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filter]);
  useEffect(() => { if (orderId) window.scrollTo(0, 0); }, [orderId]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<Step | null>(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const scope = access?.factoryId;
  useEffect(() => {
    const version = ++generation.current;
    let inFlight = false;
    setBoard(null); setError(''); setLoading(true); setView(null);
    if (!ready) return;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const { data, error: failure } = await getSupabase().rpc('factory_fulfilment_board', {
          p_search: orderId || search.trim(), p_filter: orderId ? 'all' : filter, p_page: orderId ? 0 : page,
        });
        if (failure) throw new Error(failure.message);
        if (generation.current === version) { setBoard(data); setError(''); }
      } catch (cause) {
        if (generation.current === version) setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_0e64c0a875bbc97c"));
      } finally {
        inFlight = false;
        if (generation.current === version) setLoading(false);
      }
    };
    const debounce = window.setTimeout(() => void load(), 200);
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 15000);
    const events = ['focus', 'ceriga-orders-updated', 'ceriga-qc-updated', 'ceriga-production-timeline'];
    events.forEach(event => window.addEventListener(event, refresh));
    return () => {
      generation.current++; clearTimeout(debounce); clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, refresh));
    };
  }, [ready, scope, orderId, search, filter, page, retry]);

  const order = board?.orders.find(row => row.id === orderId);
  const current = order?.step === 'completed' ? 'delivery' : order?.step;
  const currentIndex = steps.findIndex(step => step.id === current);
  const selected = view && steps.findIndex(step => step.id === view) < currentIndex ? view : current;
  const canProduction = access?.permissions.includes('production');
  const refresh = useCallback(() => setRetry(value => value + 1), []);
  return <div className="factory-home manufacturer-quality-page manufacturer-delivery-page fulfilment">
    <div className="fh-topline"><span className="fh-eyebrow">{cerigaTranslate("interface.text_4589592ebde7924c")}</span>
      <div className="ful-toolbar">{!orderId && access?.permissions.includes('settings') &&
        <Link className="ful-secondary" to="/manufacturer/settings/production-timeline">{cerigaTranslate("interface.text_49ddfbe50dbaf2c5")}</Link>}
        <button type="button" className="ful-secondary" disabled={loading} onClick={refresh}><RefreshCw size={14}/>{cerigaTranslate("common.refresh")}</button></div></div>
    <header className="fh-heading"><div>
      {orderId && <Link className="qc-back-link" to="/manufacturer/fulfilment">{cerigaTranslate("interface.text_033b4debccafaa5b")}</Link>}
      <h1>{order?.name || (filter === 'dispatch' ? cerigaTranslate("interface.text_3dbb0f62af23c873") : t('nav.fulfilment'))}<span>.</span></h1>
      <p>{order ? [order.garment, order.quantity ? cerigaTranslate("interface.text_44b3c2a4a47289c6",{value0:(order.quantity)}) : '', '#' + order.id.slice(0, 8)].filter(Boolean).join(' · ')
        : cerigaTranslate("interface.text_d9a669dcc6042c49")}</p>
    </div></header>
    {error && <div role="alert" className="fh-error"><span>{cerigaTranslateLabel(error)}</span><button onClick={refresh}>{cerigaTranslate("common.retry")}</button></div>}
    {loading && !board && <p role="status" className="fh-loading">{cerigaTranslate("interface.text_2fadbe7db6bff695")}</p>}
    {orderId ? <>
      {!loading && !error && !order && <section className="ful-empty">{cerigaTranslate("interface.text_bd4249da5771cf04")}</section>}
      {order && <>
        <p className="sr-only" role="status">{cerigaTranslateLabel(nextAction(order))}</p>
        <nav className="ful-tracker" aria-label={cerigaTranslate("interface.text_6900dd9c643d6263")}>
          {steps.map((step, index) => <button key={step.id} type="button"
            aria-current={selected === step.id ? 'step' : undefined}
            disabled={index > currentIndex} onClick={() => setView(index < currentIndex ? step.id : null)}>
            <span>{index < currentIndex || order.step === 'completed' ? <Check size={16}/> : index + 1}</span>
            <div><strong>{cerigaTranslateLabel(translateLabel(step.label))}</strong><small>{index < currentIndex ? cerigaTranslate("orders.completed") : index === currentIndex
              ? nextAction(order) : step.id === 'delivery' ? cerigaTranslate("interface.text_fbe34926a32561eb") : cerigaTranslate("interface.text_6c5d97a47611d7c0")}</small></div>
          </button>)}
        </nav>
        {order.expected_completion&&current==='production'&&<p className="ful-hint">{t('workflow.forecast')}: {date(order.expected_completion)}</p>}
        {order.needs_review && <p className="ful-warning">{order.needs_review}</p>}
        {selected === 'production' && (current === 'production'
          ? !order.released_at ? <section className="ful-empty">{cerigaTranslate("interface.text_f4002308a59b9b8a")}</section>
            : canProduction ? <ProductionWorkspace key={order.id} onlyOrder={order.id}/>
              : <section className="ful-empty">{cerigaTranslate("interface.text_5ab18d5c37b5499b")}</section>
          : <section className="ful-production-history">
            <h2>{cerigaTranslate("interface.text_b955219cc281a9c1")}</h2>
            <p>{cerigaTranslate("interface.text_1630174da4facd31")}</p>
            {order.history.length ? <ol>{order.history.map(event => <li key={event.id}>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(cerigaLocale())}</time>
              <p>{event.explanation}</p>
            </li>)}</ol> : <p>{cerigaTranslate("interface.text_11abdb57d1896421")}</p>}
          </section>)}
        {selected === 'quality' && <OrderQualityControl key={order.id + ':quality'} orderId={order.id} view="quality"/>}
        {selected === 'delivery' && <><p className="ful-hint">{order.status === 'shipping'
          ? cerigaTranslate("interface.text_f5cd96f1eafc930c")
          : order.step === 'completed' ? cerigaTranslate("interface.text_454ed0962571de61") : cerigaTranslate("interface.text_98f96b36a8077e7c")}</p>
          <OrderQualityControl key={order.id + ':delivery'} orderId={order.id} view="delivery" fulfilment/></>}
        <details className="ful-order-reference"><summary>{cerigaTranslate("interface.text_d2d6b44b04d272c4")}</summary>
          <Link to={'/manufacturer/orders/' + order.id}>{cerigaTranslate("interface.text_d38229132aaea564")}{" "}<ArrowRight size={14}/></Link>
        </details>
        {access?.permissions.includes('messages') && <OrderCommunication key={access.factoryId + order.id} orderId={order.id} scope="manufacturer" production={!!order.released_at}/>}
      </>}
    </> : <>
      <nav className="ful-tabs" aria-label={cerigaTranslate("interface.text_289b49d6b78a33ee")}>
        {[{id:'active',label:'All active'},...steps,{id:'completed',label:'Completed'}].map(step =>
          <button key={step.id} type="button" aria-pressed={filter === step.id} onClick={() => { setParams(step.id === 'active' ? {} : { step: step.id }); setPage(0); }}>
            {cerigaTranslateLabel(translateLabel(step.label))}{step.id !== 'active' && <span>{board?.counts?.[step.id as Step | 'completed'] ?? 0}</span>}
          </button>)}
      </nav>
      <label className="ful-search"><Search size={16}/><input type="search" maxLength={150} value={search}
        placeholder={cerigaTranslate("interface.text_ac21243b529c9725")} aria-label={cerigaTranslate("interface.text_a3c4adf95a8d247b")}
        onChange={event => { setSearch(event.target.value); setPage(0); }}/></label>
      {board && !error && <section className="ful-list" aria-label={cerigaTranslate("interface.text_640d3ab1ee9719ad")}>
        {board.orders.map(row => <Link className="ful-order" key={row.id} to={'/manufacturer/fulfilment/' + row.id}>
          <span className="ful-order-icon"><Package size={20}/></span>
          <div className="ful-order-title"><strong>{row.name}</strong><small>{row.garment} · {row.quantity || '—'}{" "}{cerigaTranslate("interface.text_4b708fe6094206c0")}{row.id.slice(0,8)}</small></div>
          <div className="ful-order-stage"><strong>{cerigaTranslateLabel(nextAction(row))}</strong><small>{row.step === 'production'
            ? row.uncertain ? cerigaTranslate("interface.text_b43320aa0dd609ca") : cerigaTranslate("interface.text_4f2fe2210beca605",{value0:(date(row.expected_completion))})
            : row.qc_status === 'changes_required' ? cerigaTranslate("interface.text_e6d91c2b497b48a1") : row.step === 'delivery' ? row.tracking || cerigaTranslate("interface.text_1ab4a5d269b2c8ae") : steps.find(step => step.id === row.step)?.label || cerigaTranslate("orders.completed")}</small></div>
          <ArrowRight size={16}/>
        </Link>)}
        {!board.orders.length && <div className="ful-empty"><Package size={24}/><h2>{search ? cerigaTranslate("common.noOrders") : cerigaTranslate("interface.text_c77bb70d2adbc98d")}</h2><p>{cerigaTranslate("interface.text_edbefc0af06140e1")}</p></div>}
      </section>}
      {board && board.total > 30 && <footer className="ful-pagination"><span>{board.total}{" "}{cerigaTranslate("interface.text_344c6ba453f98b4b")}{" "}{page + 1}</span>
        <button className="ful-secondary" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>{cerigaTranslate("common.previous")}</button>
        <button className="ful-secondary" disabled={(page + 1) * 30 >= board.total || loading} onClick={() => setPage(value => value + 1)}>{cerigaTranslate("common.next")}</button></footer>}
    </>}
  </div>;
}
