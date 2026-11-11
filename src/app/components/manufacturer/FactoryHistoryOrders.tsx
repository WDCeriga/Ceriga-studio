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
  return { ...state, label: row.order_group === 'production' ? stageLabels[row.stage ?? ''] ?? state.label : state.label };
}

function GarmentThumbnail({ orderId, factoryId, documentId }: { orderId: string; factoryId: string; documentId?: string }) {
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
      <Link to={clientLink(row.customer_code)}>Client {row.customer_code}</Link>
      {row.prior_count > 0 && <small>{row.is_returning ? 'Returning · ' : ''}{row.prior_count} previous</small>}
    </div>}
    <div className="history-run"><span>{runLabels[row.run_type] ?? runLabels.unclassified}</span><small>{quantity}</small></div>
    <div className="history-stage">
      <span className="history-stage-name"><i aria-hidden data-attention={row.action_required || row.delayed}/>{current.label}</span>
      <small className={row.delayed ? 'history-delayed' : undefined}>
        {row.delayed ? 'Delayed · ' : ''}{row.due_date ? 'Due ' + historyDate(row.due_date) : finished ? historyDate(row.created_at) : 'Due date pending'}
      </small>
    </div>
    <div className="history-next">
      <Link className={row.action_required && canAct ? 'history-action history-action-priority' : 'history-action'} to={href}>
        {canAct ? current.action : 'View order'}<ArrowUpRight size={14} aria-hidden/>
      </Link>
      {row.previous_order && <Link className="history-previous" to={orderLink(row.previous_order)}>Previous {orderReference(row.previous_order)}</Link>}
    </div>
  </li>;
}

const defaults = { p_search: '', p_group: 'all', p_customer_type: 'all', p_run_type: 'all', p_status: 'all', p_due_before: '', p_sort: 'newest', p_page: 1 };
const extraFilters = ['p_run_type', 'p_customer_type', 'p_status', 'p_due_before'] as const;

function OrderList({ customer }: { customer?: string }) {
  const { access, ready } = useFactoryAccess();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => ({ ...defaults, p_search: (params.get('product') ?? '').slice(0, 150) }));
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
    {customer && <Link className="history-back" to="/manufacturer/orders"><ArrowLeft size={15} aria-hidden/> All orders</Link>}
    <header className="history-heading">
      <div>
        <p className="history-eyebrow">{customer ? 'Client history' : 'Factory workspace'}</p>
        <h1>{customer ? 'Client ' + customer : 'Orders'}</h1>
        <p className="history-subtitle">{customer
          ? counts?.returning ? 'Returning client' : 'Order history for this client'
          : 'Track current work and find past orders.'}</p>
      </div>
      <div className="history-heading-actions">
        {!customer && access?.permissions.includes('quote') && <Link className="history-action history-action-primary" to="/manufacturer/quotations">Quote orders <ArrowUpRight size={15} aria-hidden/></Link>}
        {access?.factoryId && <button className="history-action history-icon-button" type="button" disabled={loading} onClick={refresh} aria-label="Refresh orders" title="Refresh orders"><RefreshCw size={16} aria-hidden/></button>}
      </div>
    </header>

    {!noFactory && <>
      {customer && counts && <dl className="history-metrics">{[['all','Orders'],['active','Active'],['completed','Completed'],['products','Products'],['lastOrder','Last order']].map(([key,label]) =>
        <div key={key}><dt>{label}</dt><dd>{key === 'lastOrder' ? historyDate(typeof counts.lastOrder === 'string' ? counts.lastOrder : null) : String(counts[key] ?? '—')}</dd></div>)}</dl>}
      {customer && products.length > 0 && <details className="history-panel history-client-products">
        <summary>Browse products</summary>
        <ul className="history-product-list">{products.map(product => <li key={product.product_reference}>
          <button type="button" aria-pressed={query.p_search === product.product_reference && query.p_group === 'all'} onClick={() => setQuery(previous => ({ ...previous, p_search: product.product_reference, p_group: 'all', p_page: 1 }))}><span>{product.title}<small>{product.product_reference} · {product.garment}</small></span><Search size={15} aria-hidden/></button>
        </li>)}</ul>
      </details>}

      <div className="history-workspace">
        <nav className="history-tabs" aria-label="Order stage">{orderGroups.map(group =>
          <button type="button" key={group.key} onClick={() => change('p_group',group.key)} aria-pressed={query.p_group === group.key}>
            {group.label}{counts && <span>{String(counts[group.key] ?? 0)}</span>}
          </button>
        )}</nav>
        <section className="history-toolbar" aria-label="Search and filter orders">
          <label className="history-search"><Search size={17} aria-hidden/><input type="search" maxLength={150} aria-label="Search orders" placeholder={customer ? 'Search by order or product' : 'Search by order, client, or product'} value={query.p_search} onChange={event => change('p_search',event.target.value)} /></label>
          <button className="history-action history-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="order-history-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={15} aria-hidden/> Filters{activeFilters > 0 && <span className="history-filter-count">{activeFilters}</span>}<ChevronDown size={14} aria-hidden/></button>
          <label className="history-sort"><span className="sr-only">Sort orders</span><select value={query.p_sort} onChange={event => change('p_sort',event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="due">Due date</option><option value="priority">Production priority</option></select></label>
          <div className="history-filters" id="order-history-filters" hidden={!filtersOpen}>
              <label>Type<select value={query.p_run_type} onChange={event => change('p_run_type',event.target.value)}><option value="all">All types</option><option value="sample">Samples</option><option value="bulk">Bulk orders</option><option value="repeat_bulk">Repeat bulk</option></select></label>
              {!customer && <label>Customer<select value={query.p_customer_type} onChange={event => change('p_customer_type',event.target.value)}><option value="all">All customers</option><option value="new">New customers</option><option value="returning">Returning customers</option></select></label>}
              <label>Status<select value={query.p_status} onChange={event => change('p_status',event.target.value)}><option value="all">All statuses</option><option value="active">Active orders</option><option value="completed">Completed</option><option value="delayed">Delayed</option><option value="action">Needs attention</option></select></label>
              <label>Due by<input type="date" value={query.p_due_before} onChange={event => change('p_due_before',event.target.value)}/></label>
          </div>
          {filtered && <button type="button" className="history-reset" onClick={reset}><X size={14} aria-hidden/> Clear filters</button>}
        </section>

        <div aria-busy={loading}>
          {error ? <div role="alert" className="history-empty history-error"><strong>Couldn’t load orders</strong><p>Try again to reconnect to your workspace.</p><button className="history-action" type="button" onClick={refresh}>Try again</button></div>
            : loading ? <div role="status" className="history-empty"><p>Loading orders…</p></div>
            : data?.rows.length ? <div className="history-list">
              <div className="history-list-head" aria-hidden><span>Order</span>{!customer && <span>Client</span>}<span>Type and quantity</span><span>Stage</span><span>Next step</span></div>
              <ul>{data.rows.map(row => <OrderRow key={row.order_id} row={row} showClient={!customer} permissions={access?.permissions ?? []} factoryId={access?.factoryId ?? ''} mockup={mockupByOrder.get(row.order_id)}/>)}</ul>
            </div>
            : <div className="history-empty"><Package size={23} aria-hidden/><strong>{filtered ? 'No matching orders' : 'No orders yet'}</strong>
              <p>{filtered ? 'Try a different search or clear your filters.' : customer ? 'Orders for this client will appear here.' : 'Orders assigned to this workspace will appear here.'}</p>
              {filtered && !customer && <button className="history-action" type="button" onClick={reset}>Clear filters</button>}
            </div>}
        </div>
        {((data && orderCount > 0) || query.p_page > 1) && <footer className="history-pagination">
          <span aria-live="polite">{orderCount > 0 ? firstOrder + '–' + lastOrder + ' of ' + orderCount + ' orders' : 'Page ' + query.p_page}</span>
          <div>
            <button className="history-action history-icon-button" type="button" aria-label="Previous orders page" disabled={query.p_page <= 1 || loading} onClick={() => change('p_page',query.p_page - 1)}><ChevronLeft size={16} aria-hidden/></button>
            <button className="history-action history-icon-button" type="button" aria-label="Next orders page" disabled={!data || query.p_page >= pages} onClick={() => change('p_page',query.p_page + 1)}><ChevronRight size={16} aria-hidden/></button>
          </div>
        </footer>}
      </div>
    </>}
    {noFactory && <div className="history-empty history-panel"><strong>No factory workspace selected</strong><p>Orders are available from an active factory workspace.</p></div>}
  </div>;
}
export function FactoryHistoryOrders() { return <OrderList/>; }
export function FactoryCustomerHistory() {
  const { code } = useParams();
  return <OrderList key={code} customer={code}/>;
}
