import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Package, RefreshCw, Search, Shirt, SlidersHorizontal, X } from 'lucide-react';
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { manufacturerOrderState, orderGroups } from '../../lib/manufacturerOrderView';
import { getSupabase } from '../../lib/supabaseClient';
import { clientLink, historyDate, orderLink, orderReference, runLabels, stageLabels, useFactoryHistory, type HistoryOrder, type HistoryPage } from '../../lib/factoryOrderHistory';
import '../dashboard/manufacturer-dashboard.css';
import './manufacturer-orders.css';
import './factory-order-history.css';

function stage(row: HistoryOrder) {
  const state = manufacturerOrderState({
    id: row.order_id, status: row.status, factoryStatus: row.factory_status,
    qcStatus: row.qc_status, productionReleasedAt: row.released ? row.created_at : undefined,
  } as Parameters<typeof manufacturerOrderState>[0]);
  if (row.order_group === 'quality' && state.group !== 'quality') {
    return { ...state, label: 'Quality control', action: 'Submit QC', permission: 'qc', href: '/manufacturer/fulfilment/' + row.order_id };
  }
  return { ...state, label: row.order_group === 'production' ? stageLabels[row.stage ?? ''] ?? state.label : state.label };
}

export function GarmentThumbnail({ orderId, factoryId, documentId }: { orderId: string; factoryId: string; documentId?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!documentId) return;
    let active = true;
    let objectUrl: string | undefined;
    void getSupabase().functions.invoke('factory-order-document', { body: { orderId, factoryId, documentId } })
      .then(({ data, error, response }) => {
        const type = response?.headers.get('x-ceriga-file-type');
        if (!active || error || !(data instanceof Blob) || !type || !['image/png','image/jpeg','image/webp'].includes(type)) return;
        objectUrl = URL.createObjectURL(data.slice(0, data.size, type));
        setUrl(objectUrl);
      }).catch(() => { /* The order can still be opened without its preview. */ });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, factoryId, documentId]);
  return <span className="history-thumbnail">{url
    ? <img src={url} alt="" onError={() => setUrl('')}/>
    : <Shirt size={22} aria-hidden />}</span>;
}

function OrderRow({ row, permissions, factoryId, mockup, showClient }: { row: HistoryOrder; permissions: string[]; factoryId: string; mockup?: string; showClient: boolean }) {
  useCerigaTranslation();

  const current = stage(row);
  const canAct = permissions.includes(current.permission);
  const href = canAct ? current.href : orderLink(row.order_id);
  const specs = [row.fabric, row.gsm && row.gsm + ' GSM', row.colour].filter(Boolean).join(' · ');
  const quantity = row.units ? row.units + ' units' : row.run_type === 'options' ? 'Multiple quote options' : 'Quantity to confirm';
  const finished = row.order_group === 'completed' || row.order_group === 'declined';
  return <li className="history-order-row">
    <Link to={orderLink(row.order_id)} className="history-product">
      <GarmentThumbnail key={factoryId + ':' + (mockup ?? '')} orderId={row.order_id} factoryId={factoryId} documentId={mockup}/>
      <span>
        <strong>{row.nickname || row.title}</strong>
        <small>{orderReference(row.order_id)} · {row.garment}</small>
        {specs && <small>{specs}</small>}
      </span>
    </Link>
    {showClient && <div className="history-client">
      <Link to={clientLink(row.customer_code)}>{cerigaTranslate("interface.text_0c77fe09ab336a3e")}{" "}{row.customer_code}</Link>
      {row.prior_count > 0 && <small>{row.is_returning ? cerigaTranslate("interface.text_f42793087b867586") : ''}{row.prior_count}{" "}{cerigaTranslate("interface.text_6da0633528deaa01")}</small>}
    </div>}
    <div className="history-run"><span>{cerigaTranslateLabel(runLabels[row.run_type] ?? runLabels.unclassified)}</span><small>{quantity}</small></div>
    <div className="history-stage">
      <span className="history-stage-name"><i aria-hidden data-attention={row.action_required || row.delayed}/>{cerigaTranslateLabel(current.label)}</span>
      <small className={row.delayed ? 'history-delayed' : undefined}>
        {row.delayed ? cerigaTranslate("interface.text_b3f16bec20d172a9") : ''}{row.due_date ? cerigaTranslate("interface.text_d2cccdf0dac47bca",{value0:(historyDate(row.due_date))}) : finished ? historyDate(row.created_at) : cerigaTranslate("interface.text_295520fc0f054b1a")}
      </small>
    </div>
    <div className="history-next">
      <Link className={row.action_required && canAct ? 'history-action history-action-priority' : 'history-action'} to={href}>
        {canAct ? current.action : cerigaTranslate("orders.view")}<ArrowUpRight size={14} aria-hidden/>
      </Link>
      {row.previous_order && <Link className="history-previous" to={orderLink(row.previous_order)}>{cerigaTranslate("common.previous")}{" "}{orderReference(row.previous_order)}</Link>}
    </div>
  </li>;
}

const defaults = { p_search: '', p_group: 'all', p_customer_type: 'all', p_run_type: 'all', p_status: 'all', p_due_before: '', p_sort: 'newest', p_page: 1 };
const extraFilters = ['p_run_type', 'p_customer_type', 'p_status', 'p_due_before'] as const;

function OrderList({ customer }: { customer?: string }) {
  useCerigaTranslation();

  const { access, ready } = useFactoryAccess();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => ({ ...defaults, p_search: (params.get('product') ?? '').slice(0, 150), p_status: params.get('status') === 'action' ? 'action' : 'all' }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data, lastData, error, loading, refresh } = useFactoryHistory<HistoryPage>('factory_order_history_list', {
    ...query, p_customer: customer ?? null, p_due_before: query.p_due_before || null,
  }, access?.factoryId, 180);
  const orderIds = data?.rows.map(row => row.order_id) ?? [];
  const { data: mockups } = useFactoryHistory<{ order_id: string; document_id: string }[]>(
    'factory_order_mockups', { p_orders: orderIds }, orderIds.length ? access?.factoryId : undefined,
  );
  const mockupByOrder = new Map(mockups?.map(row => [row.order_id, row.document_id]));
  const change = (key: keyof typeof query, value: string | number) => setQuery(previous => ({ ...previous, p_page: 1, [key]: value }));
  const reset = () => setQuery({ ...defaults });
  const activeFilters = extraFilters.filter(key => query[key] !== defaults[key]).length;
  const filtered = Boolean(query.p_search.trim() || activeFilters || query.p_group !== 'all');
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 24));
  const counts = (data ?? lastData)?.counts;
  const products = (data ?? lastData)?.products ?? [];
  const noFactory = ready && !access?.factoryId;
  const orderCount = data?.total ?? 0;
  const firstOrder = (query.p_page - 1) * 24 + 1;
  const lastOrder = Math.min(query.p_page * 24, orderCount);

  return <div className="factory-home factory-orders factory-history" data-client-history={Boolean(customer)}>
    {customer && <Link className="history-back" to="/manufacturer/orders"><ArrowLeft size={15} aria-hidden/>{" "}{cerigaTranslate("orders.all")}</Link>}
    <header className="history-heading">
      <div>
        <p className="history-eyebrow">{customer ? cerigaTranslate("interface.text_69dd565a178ef4c3") : cerigaTranslate("interface.text_c46143a78610bd2d")}</p>
        <h1>{customer ? cerigaTranslate("interface.text_3528b04087c15a8d",{value0:(customer)}) : cerigaTranslate("nav.orders")}</h1>
        <p className="history-subtitle">{customer
          ? counts?.returning ? cerigaTranslate("interface.text_53d33e1899adb463") : cerigaTranslate("interface.text_87aea38dcdb4c323")
          : cerigaTranslate("interface.text_a0a3d8b6d8b9a727")}</p>
      </div>
      <div className="history-heading-actions">
        {!customer && access?.permissions.includes('quote') && <Link className="history-action history-action-primary" to="/manufacturer/quotations">{cerigaTranslate("manufacturerOrders.quoteAction")}{" "}<ArrowUpRight size={15} aria-hidden/></Link>}
        {access?.factoryId && <button className="history-action history-icon-button" type="button" disabled={loading} onClick={refresh} aria-label={cerigaTranslate("manufacturerOrders.refreshOrders")} title={cerigaTranslate("manufacturerOrders.refreshOrders")}><RefreshCw size={16} aria-hidden/></button>}
      </div>
    </header>

    {!noFactory && <>
      {customer && counts && <dl className="history-metrics">{[['all','Orders'],['active','Active'],['completed','Completed'],['products','Products'],['lastOrder','Last order']].map(([key,label]) =>
        <div key={key}><dt>{cerigaTranslateLabel(label)}</dt><dd>{key === 'lastOrder' ? historyDate(typeof counts.lastOrder === 'string' ? counts.lastOrder : null) : String(counts[key] ?? '—')}</dd></div>)}</dl>}
      {customer && products.length > 0 && <details className="history-panel history-client-products">
        <summary>{cerigaTranslate("interface.text_0f96c11707fec7be")}</summary>
        <ul className="history-product-list">{products.map(product => <li key={product.product_reference}>
          <button type="button" aria-pressed={query.p_search === product.product_reference && query.p_group === 'all'} onClick={() => setQuery(previous => ({ ...previous, p_search: product.product_reference, p_group: 'all', p_page: 1 }))}><span>{product.title}<small>{product.product_reference} · {product.garment}</small></span><Search size={15} aria-hidden/></button>
        </li>)}</ul>
      </details>}

      <div className="history-workspace">
        <nav className="history-tabs" aria-label={cerigaTranslate("adminOrders.stage")}>{orderGroups.map(group =>
          <button type="button" key={group.key} onClick={() => change('p_group',group.key)} aria-pressed={query.p_group === group.key}>
            {cerigaTranslateLabel(group.label)}{counts && <span>{String(counts[group.key] ?? 0)}</span>}
          </button>
        )}</nav>
        <section className="history-toolbar" aria-label={cerigaTranslate("interface.text_9cfd1d23d5c98182")}>
          <label className="history-search"><Search size={17} aria-hidden/><input type="search" maxLength={150} aria-label={cerigaTranslate("common.searchOrders")} placeholder={customer ? cerigaTranslate("interface.text_e5d7cf76d8b3e383") : cerigaTranslate("interface.text_c41708387ffae1fa")} value={query.p_search} onChange={event => change('p_search',event.target.value)} /></label>
          <button className="history-action history-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="order-history-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={15} aria-hidden/>{" "}{cerigaTranslate("interface.text_546ebb8eb993ea56")}{activeFilters > 0 && <span className="history-filter-count">{activeFilters}</span>}<ChevronDown size={14} aria-hidden/></button>
          <label className="history-sort"><span className="sr-only">{cerigaTranslate("manufacturerOrders.sortOrders")}</span><select value={query.p_sort} onChange={event => change('p_sort',event.target.value)}><option value="newest">{cerigaTranslate("interface.text_ffb6f5764bddb68c")}</option><option value="oldest">{cerigaTranslate("interface.text_6e2ebdab3c02a3e6")}</option><option value="due">{cerigaTranslate("interface.text_e1cb6d30fa3f17ee")}</option><option value="priority">{cerigaTranslate("interface.text_de6d4013d7d56486")}</option></select></label>
          <div className="history-filters" id="order-history-filters" hidden={!filtersOpen}>
              <label>{cerigaTranslate("interface.text_baaddf70fb5d432b")}<select value={query.p_run_type} onChange={event => change('p_run_type',event.target.value)}><option value="all">{cerigaTranslate("adminOrders.allTypes")}</option><option value="sample">{cerigaTranslate("interface.text_bc228b269ce0d87f")}</option><option value="bulk">{cerigaTranslate("interface.text_5341d1dfa50af637")}</option><option value="repeat_bulk">{cerigaTranslate("interface.text_bb4ebb1dba913770")}</option></select></label>
              {!customer && <label>{cerigaTranslate("adminOrders.customer")}<select value={query.p_customer_type} onChange={event => change('p_customer_type',event.target.value)}><option value="all">{cerigaTranslate("interface.text_7f4048355f2cee3d")}</option><option value="new">{cerigaTranslate("interface.text_f5ff2c3d9a4a93ef")}</option><option value="returning">{cerigaTranslate("interface.text_105990560ebe42c0")}</option></select></label>}
              <label>{cerigaTranslate("orders.status")}<select value={query.p_status} onChange={event => change('p_status',event.target.value)}><option value="all">{cerigaTranslate("interface.text_8ee57323a6f24cc7")}</option><option value="active">{cerigaTranslate("interface.text_6db3e14682d759f4")}</option><option value="completed">{cerigaTranslate("orders.completed")}</option><option value="delayed">{cerigaTranslate("interface.text_a5c19c9f134a8c6a")}</option><option value="action">{cerigaTranslate("manufacturerOrders.attention")}</option></select></label>
              <label>{cerigaTranslate("interface.text_eb38f68738f5c1e5")}<input type="date" value={query.p_due_before} onChange={event => change('p_due_before',event.target.value)}/></label>
          </div>
          {filtered && <button type="button" className="history-reset" onClick={reset}><X size={14} aria-hidden/>{" "}{cerigaTranslate("orders.clear")}</button>}
        </section>

        <div aria-busy={loading}>
          {error ? <div role="alert" className="history-empty history-error"><strong>{cerigaTranslate("interface.text_38fd372659006439")}</strong><p>{cerigaTranslate("interface.text_d73a9d4ab7c6b47b")}</p><button className="history-action" type="button" onClick={refresh}>{cerigaTranslate("common.retry")}</button></div>
            : loading ? <div role="status" className="history-empty"><p>{cerigaTranslate("adminOrders.loading")}</p></div>
            : data?.rows.length ? <div className="history-list">
              <div className="history-list-head" aria-hidden><span>{cerigaTranslate("adminOrders.order")}</span>{!customer && <span>{cerigaTranslate("interface.text_0c77fe09ab336a3e")}</span>}<span>{cerigaTranslate("interface.text_3cd6b982dacc0ea5")}</span><span>{cerigaTranslate("interface.text_de838855e4a6e04e")}</span><span>{cerigaTranslate("orders.nextStep")}</span></div>
              <ul>{data.rows.map(row => <OrderRow key={row.order_id} row={row} showClient={!customer} permissions={access?.permissions ?? []} factoryId={access?.factoryId ?? ''} mockup={mockupByOrder.get(row.order_id)}/>)}</ul>
            </div>
            : <div className="history-empty"><Package size={23} aria-hidden/><strong>{filtered ? cerigaTranslate("common.noOrders") : cerigaTranslate("interface.text_104b6eb41be38459")}</strong>
              <p>{filtered ? cerigaTranslate("interface.text_88d56d0d37144cc4") : customer ? cerigaTranslate("interface.text_04cfc791bbf0831d") : cerigaTranslate("interface.text_9e4f6e2ff2bda3a2")}</p>
              {filtered && !customer && <button className="history-action" type="button" onClick={reset}>{cerigaTranslate("orders.clear")}</button>}
            </div>}
        </div>
        {((data && orderCount > 0) || query.p_page > 1) && <footer className="history-pagination">
          <span aria-live="polite">{orderCount > 0 ? cerigaTranslate("interface.text_34fe24ce9648284d",{value0:(firstOrder + '–' + lastOrder),value1:(orderCount)}) : cerigaTranslate("interface.text_a371c8ce7255a8c1",{value0:(query.p_page)})}</span>
          <div>
            <button className="history-action history-icon-button" type="button" aria-label={cerigaTranslate("manufacturerOrders.previous")} disabled={query.p_page <= 1 || loading} onClick={() => change('p_page',query.p_page - 1)}><ChevronLeft size={16} aria-hidden/></button>
            <button className="history-action history-icon-button" type="button" aria-label={cerigaTranslate("manufacturerOrders.next")} disabled={!data || query.p_page >= pages} onClick={() => change('p_page',query.p_page + 1)}><ChevronRight size={16} aria-hidden/></button>
          </div>
        </footer>}
      </div>
    </>}
    {noFactory && <div className="history-empty history-panel"><strong>{cerigaTranslate("interface.text_f7070f928aa83935")}</strong><p>{cerigaTranslate("interface.text_4e0fa5a40b597e21")}</p></div>}
  </div>;
}
export function FactoryHistoryOrders() { return <OrderList/>; }
export function FactoryCustomerHistory() {
  const { code } = useParams();
  return <OrderList key={code} customer={code}/>;
}
