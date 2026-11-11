import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowRight, Check, Package, RefreshCw, Search } from 'lucide-react';
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { getSupabase } from '../../lib/supabaseClient';
import { stageLabel } from '../../lib/productionTimeline';
import { ProductionWorkspace } from '../../components/manufacturer/ProductionWorkspace';
import { OrderQualityControl } from '../../components/quality/OrderQualityControl';
import '../../components/dashboard/manufacturer-dashboard.css';
import '../../components/quality/manufacturer-quality.css';
import '../../components/manufacturer/manufacturer-delivery.css';
import './manufacturer-fulfilment.css';

type Step = 'production' | 'quality' | 'delivery';
type FulfilmentOrder = {
  id: string; name: string; garment: string; quantity: number; status: string;
  qc_status: string; step: Step | 'completed'; stage: string; released_at: string | null;
  expected_completion: string | null; uncertain: boolean | null; needs_review: string | null;
  tracking: string | null;
  history: { id: string; kind: string; explanation: string; created_at: string }[];
};
type Board = { total: number; counts: Partial<Record<Step | 'completed', number>> | null; orders: FulfilmentOrder[] };
const steps: { id: Step; label: string }[] = [
  { id: 'production', label: 'Production' },
  { id: 'quality', label: 'Final quality control' },
  { id: 'delivery', label: 'Delivery' },
];
const date = (value: string | null) => value
  ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not scheduled';
function nextAction(order: FulfilmentOrder) {
  if (order.step === 'completed') return 'View completed order';
  if (order.step === 'delivery') return order.status === 'shipping' ? 'Track delivery' : 'Complete handover';
  if (order.step === 'quality') return order.qc_status === 'pending_review' ? 'Waiting for Ceriga'
    : order.qc_status === 'changes_required' ? 'Update quality control' : 'Submit final quality control';
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
  const { orderId } = useParams();
  const { access, ready } = useFactoryAccess();
  const [board, setBoard] = useState<Board | null>(null);
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const requestedFilter = params.get('step');
  const filter = requestedFilter && ['production', 'quality', 'delivery', 'completed'].includes(requestedFilter) ? requestedFilter : 'active';
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
        if (generation.current === version) setError(cause instanceof Error ? cause.message : 'Could not load fulfilment.');
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
    <div className="fh-topline"><span className="fh-eyebrow">WORKSPACE / FULFILMENT</span>
      <div className="ful-toolbar">{!orderId && access?.permissions.includes('settings') &&
        <Link className="ful-secondary" to="/manufacturer/settings/production-timeline">Production settings</Link>}
        <button type="button" className="ful-secondary" disabled={loading} onClick={refresh}><RefreshCw size={14}/>Refresh</button></div></div>
    <header className="fh-heading"><div>
      {orderId && <Link className="qc-back-link" to="/manufacturer/fulfilment">← All fulfilment orders</Link>}
      <h1>{order?.name || 'Fulfilment'}<span>.</span></h1>
      <p>{order ? [order.garment, order.quantity ? order.quantity + ' units' : '', '#' + order.id.slice(0, 8)].filter(Boolean).join(' · ')
        : 'From paid order to finished garments and carrier handover.'}</p>
    </div></header>
    {error && <div role="alert" className="fh-error"><span>{error}</span><button onClick={refresh}>Try again</button></div>}
    {loading && !board && <p role="status" className="fh-loading">Loading saved fulfilment orders…</p>}
    {orderId ? <>
      {!loading && !error && !order && <section className="ful-empty">This order is unavailable in your factory workspace.</section>}
      {order && <>
        <p className="sr-only" role="status">{nextAction(order)}</p>
        <nav className="ful-tracker" aria-label="Order fulfilment progress">
          {steps.map((step, index) => <button key={step.id} type="button"
            aria-current={selected === step.id ? 'step' : undefined}
            disabled={index > currentIndex} onClick={() => setView(index < currentIndex ? step.id : null)}>
            <span>{index < currentIndex || order.step === 'completed' ? <Check size={16}/> : index + 1}</span>
            <div><strong>{step.label}</strong><small>{index < currentIndex ? 'Completed' : index === currentIndex
              ? nextAction(order) : step.id === 'delivery' ? 'After QC approval' : 'After finishing'}</small></div>
          </button>)}
        </nav>
        {order.needs_review && <p className="ful-warning">{order.needs_review}</p>}
        {selected === 'production' && (current === 'production'
          ? !order.released_at ? <section className="ful-empty">Payment is confirmed. Ceriga is preparing production authorisation.</section>
            : canProduction ? <ProductionWorkspace key={order.id} onlyOrder={order.id}/>
              : <section className="ful-empty">Production is underway. Your role can view this order but cannot update production.</section>
          : <section className="ful-production-history">
            <h2>Production completed</h2>
            <p>Stage changes and quality notes</p>
            {order.history.length ? <ol>{order.history.map(event => <li key={event.id}>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('en-GB')}</time>
              <p>{event.explanation}</p>
            </li>)}</ol> : <p>No stage history has been recorded.</p>}
          </section>)}
        {selected === 'quality' && <OrderQualityControl key={order.id + ':quality'} orderId={order.id} view="quality"/>}
        {selected === 'delivery' && <><p className="ful-hint">{order.status === 'shipping'
          ? 'Your manufacturing work is complete. Follow delivery updates here.'
          : order.step === 'completed' ? 'This order is complete.' : 'Record the tracking or handover reference to finish your manufacturing work.'}</p>
          <OrderQualityControl key={order.id + ':delivery'} orderId={order.id} view="delivery" fulfilment/></>}
        <details className="ful-order-reference"><summary>Specifications, files & order history</summary>
          <Link to={'/manufacturer/orders/' + order.id}>Open full order details <ArrowRight size={14}/></Link>
        </details>
      </>}
    </> : <>
      <nav className="ful-tabs" aria-label="Fulfilment filters">
        {[{id:'active',label:'All active'},...steps,{id:'completed',label:'Completed'}].map(step =>
          <button key={step.id} type="button" aria-pressed={filter === step.id} onClick={() => { setParams(step.id === 'active' ? {} : { step: step.id }); setPage(0); }}>
            {step.label}{step.id !== 'active' && <span>{board?.counts?.[step.id as Step | 'completed'] ?? 0}</span>}
          </button>)}
      </nav>
      <label className="ful-search"><Search size={16}/><input type="search" maxLength={150} value={search}
        placeholder="Search order, garment or ID" aria-label="Search fulfilment"
        onChange={event => { setSearch(event.target.value); setPage(0); }}/></label>
      {board && !error && <section className="ful-list" aria-label="Fulfilment orders">
        {board.orders.map(row => <Link className="ful-order" key={row.id} to={'/manufacturer/fulfilment/' + row.id}>
          <span className="ful-order-icon"><Package size={20}/></span>
          <div className="ful-order-title"><strong>{row.name}</strong><small>{row.garment} · {row.quantity || '—'} units · #{row.id.slice(0,8)}</small></div>
          <div className="ful-order-stage"><strong>{nextAction(row)}</strong><small>{row.step === 'production'
            ? row.uncertain ? 'Completion estimate uncertain' : 'Expected ' + date(row.expected_completion)
            : row.qc_status === 'changes_required' ? 'Ceriga requested corrections' : row.step === 'delivery' ? row.tracking || 'Ready after approved QC' : steps.find(step => step.id === row.step)?.label || 'Completed'}</small></div>
          <ArrowRight size={16}/>
        </Link>)}
        {!board.orders.length && <div className="ful-empty"><Package size={24}/><h2>{search ? 'No matching orders' : 'No orders in this view'}</h2><p>Paid orders and orders already released to your factory appear here.</p></div>}
      </section>}
      {board && board.total > 30 && <footer className="ful-pagination"><span>{board.total} orders · Page {page + 1}</span>
        <button className="ful-secondary" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
        <button className="ful-secondary" disabled={(page + 1) * 30 >= board.total || loading} onClick={() => setPage(value => value + 1)}>Next</button></footer>}
    </>}
  </div>;
}
