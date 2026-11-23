import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Translate } from '../../i18n/LanguageProvider';
import { Link } from 'react-router';
import { ArrowUpRight, ClipboardList, Factory, Package, RefreshCw, Search, ShieldCheck, Truck } from 'lucide-react';
import { ACTIVITY_LABELS, STAGE_LABELS, TASK_LABELS, percent, type DashboardData, type DashboardStage } from '../../lib/dashboard';
import { orderReference, runLabels, useFactoryHistory } from '../../lib/factoryOrderHistory';
import { stageLabel } from '../../lib/productionTimeline';
import { GarmentThumbnail } from '../manufacturer/FactoryHistoryOrders';
import './manufacturer-dashboard.css';

export type OperationsFilters = {
  days: number; search: string; stage: string; sort: string; due: string; staff: string;
  type: string; priority: string; action: string; task_staff: string;
  page: number; task_page: number; soon: number;
};
type Work = {
  id: string; product: string; garment: string; units: string; stage: DashboardStage;
  production_stage: string; completion: string | null; days_left: number | null;
  priority: string; reported_delay: boolean; customer_code: string | null; is_returning: boolean;
  run_type: string; nickname: string | null; staff: string; action: string; qc_status: string;
};
type Task = Work & { task: string; deadline: string | null };
type Activity = {
  id: string; order_id: string; kind: string; at: string; product: string;
  previous: string | null; next: string | null; employee: string | null;
};
export type OperationsData = {
  today: string; timezone: string; generatedAt: string; days: number;
  counts: Record<'production' | 'pendingQuotes' | 'quality' | 'dispatch' | 'active' | 'overdueQuotes' | 'qcCorrections', number>;
  deadlineCounts: Record<'overdue' | 'today' | 'tomorrow' | 'week', number>;
  tasks: Task[]; orders: Work[]; deadlines: Work[]; activity: Activity[];
  staff: { user_id: string; name: string }[];
  taskTotal: number; floorTotal: number; metrics: DashboardData['metrics'] | null;
};

type Props = {
  data: OperationsData | null; loading: boolean; error: string; filters: OperationsFilters;
  factoryId: string; permissions: string[]; onChange: (patch: Partial<OperationsFilters>) => void; onRefresh: () => void;
};
const deadlines = [
  ['overdue', 'Overdue'], ['today', 'Due today'], ['tomorrow', 'Due tomorrow'], ['week', 'Next 7 days'],
] as const;
const actionPermissions: Record<string, string> = {
  quote: 'quote', revise_quote: 'quote', submit_qc: 'qc', revise_qc: 'qc',
  production_update: 'production', delay: 'production', dispatch: 'shipping',
};
const orderType = (work: Work) => runLabels[work.run_type] || 'Type not recorded';
const quantity = (work: Work) => work.units ? Number(work.units).toLocaleString(cerigaLocale()) + ' units' : 'Quantity not recorded';
const orderPath = (id: string) => '/manufacturer/orders/' + id;
const workPath = (work: Work) => work.action === 'View order' ? orderPath(work.id) : '/manufacturer/fulfilment/' + work.id;
const taskPath = (task: Task) => '/manufacturer/' + (actionPermissions[task.task] === 'quote' ? 'quotations' : 'fulfilment') + '/' + task.id;

function date(value: string, timezone: string, includeTime = false) {
  return new Intl.DateTimeFormat(cerigaLocale(), includeTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }
    : { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
}

function deadlineLabel(days: number | null) {
  if (days === null) return '';
  if (days === 0) return 'Due today';
  const duration = Math.abs(days) === 1 ? '1 day' : Math.abs(days) + ' days';
  return days < 0 ? duration + ' overdue' : duration + ' left';
}

function stage(work: Work) {
  if (work.stage === 'production') return stageLabel(work.production_stage);
  if (work.stage === 'quality' && work.qc_status === 'pending_review') return 'Waiting for Ceriga to approve the quality check';
  if (work.stage === 'quality' && work.qc_status === 'changes_required') return 'Quality check changes requested';
  if (work.stage === 'quality') return 'Quality check';
  return STAGE_LABELS[work.stage];
}

function Filter({ label, value, options, onChange }: {
  label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void;
}) {
  useCerigaTranslation();

  return <label className="ops-filter">{cerigaTranslateLabel(label)}<select value={value} onChange={event => onChange(event.target.value)}>
    {options.map(([key, text]) => <option key={key} value={key}>{cerigaTranslateLabel(text)}</option>)}
  </select></label>;
}

function Pages({ page, total, size, loading, onChange, label }: {
  page: number; total: number; size: number; loading: boolean; onChange: (page: number) => void; label: string;
}) {
  useCerigaTranslation();

  if (total <= size && page === 0) return null;
  return <nav className="ops-pages" aria-label={cerigaTranslateLabel(label)}>
    <span>{total ? cerigaTranslate("interface.text_19f9c1045f298511",{value0:(Math.min(page * size + 1, total) + '–' + Math.min((page + 1) * size, total)),value1:(total)}) : cerigaTranslate("interface.text_a43619f321175f57")}</span>
    <button type="button" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>{cerigaTranslate("common.previous")}</button>
    <button type="button" disabled={loading || (page + 1) * size >= total} onClick={() => onChange(page + 1)}>{cerigaTranslate("common.next")}</button>
  </nav>;
}

export function ManufacturerDashboardView({ data, loading, error, filters, factoryId, permissions, onChange, onRefresh }: Props) {
  useCerigaTranslation();

  const counts = data?.counts;
  const imageIds = [...new Set([...(data?.tasks || []), ...(data?.orders || [])].map(row => row.id))];
  const { data: images } = useFactoryHistory<{ order_id: string; document_id: string }[]>(
    'factory_order_mockups', { p_orders: imageIds }, imageIds.length ? factoryId : undefined,
  );
  const imageByOrder = new Map(images?.map(image => [image.order_id, image.document_id]));
  const thumbnail = (id: string) => <GarmentThumbnail key={factoryId + ':' + (imageByOrder.get(id) || '')}
    orderId={id} factoryId={factoryId} documentId={imageByOrder.get(id)} />;
  const allowed = (permission: string) => permissions.includes(permission);
  const metrics = [
    { label: 'In production', count: counts?.production, icon: Factory, link: '/manufacturer/fulfilment?step=production', note: 'Orders in the three production stages', permission: 'view_orders', urgent: data?.deadlineCounts.overdue, urgency: 'overdue' },
    { label: 'Quotes', count: counts?.pendingQuotes, icon: ClipboardList, link: '/manufacturer/quotations', note: 'Requests and revisions awaiting a response', permission: 'quote', urgent: counts?.overdueQuotes, urgency: 'overdue' },
    { label: 'Quality check', count: counts?.quality, icon: ShieldCheck, link: '/manufacturer/fulfilment?step=quality', note: 'Reports to submit, correct or review', permission: 'view_orders', urgent: counts?.qcCorrections, urgency: 'need correction' },
    { label: 'Ready to dispatch', count: counts?.dispatch, icon: Truck, link: '/manufacturer/fulfilment?step=dispatch', note: 'QC approved and awaiting handover', permission: 'view_orders' },
  ];
  const staffOptions = [['all', 'Anyone'], ['unassigned', 'Unassigned'], ...(data?.staff || []).map(({ user_id, name }) => [user_id, name]) ] as [string, string][];
  const historical = data?.metrics;
  const timezone = data?.timezone || 'UTC';
  const floorFiltered = Boolean(filters.search || [filters.stage, filters.due, filters.staff, filters.type, filters.priority].some(value => value !== 'all'));
  const formatCompletion = (work: Work) => work.completion ? date(work.completion, timezone) : 'Date not set';
  const deadlineState = (work: Work) => work.stage === 'production' && work.completion
    ? deadlineLabel(work.days_left) + (work.priority === 'normal' ? ' · On schedule' : work.priority === 'soon' ? ' · Due soon' : '') : '';

  return <div className="factory-home factory-operations">
    <header className="fh-heading ops-heading">
      <div><p className="fh-eyebrow">{data ? date(data.today, timezone) : new Date().toLocaleDateString(cerigaLocale(), { dateStyle: 'long' })}</p>
        <h1><Translate k="manufacturer.factoryOverview" /><span>.</span></h1>
        <p>{data ? cerigaTranslate("interface.text_09614d67a2273520",{value0:(date(data.generatedAt, timezone, true)),value1:(timezone)}) : cerigaTranslate("interface.text_771b3b44163e4094")}</p>
      </div>
      <div className="fh-toolbar">
        {allowed('analytics') && <Filter label={cerigaTranslate("interface.text_6c7cc231ccab004c")} value={String(filters.days)}
          options={[[ '7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} onChange={value => onChange({ days: Number(value) })} />}
        <button type="button" className="fh-icon-button" aria-label={cerigaTranslate("interface.text_d612730f16f60a14")} disabled={loading} onClick={onRefresh}>
          <RefreshCw size={16} className={loading ? 'fh-spinning' : ''} />
        </button>
      </div>
    </header>
    {error && <div role="alert" className="fh-error"><span>{data ? cerigaTranslate("interface.text_6c9384a6f973d1fb") : ''}{cerigaTranslateLabel(error)}</span><button type="button" onClick={onRefresh}>{cerigaTranslate("common.retry")}</button></div>}
    {!data && loading && <p role="status" className="fh-loading"><span className="fh-load-dot" />{cerigaTranslate("interface.text_f74a1e12ed77e589")}</p>}
    {data && <>
      <section className="fh-panel ops-section" aria-labelledby="ops-attention">
        <div className="fh-section-head"><h2 id="ops-attention">{cerigaTranslate("manufacturer.attention")}{" "}<span className="fh-count">{data.taskTotal}</span></h2>
          {allowed('view_orders') && <Link to="/manufacturer/orders">{cerigaTranslate("interface.text_ba522581a125e67f")}{" "}<ArrowUpRight size={14} /></Link>}
        </div>
        <div className="fh-order-toolbar">
          <Filter label={cerigaTranslate("interface.text_64cff1319d2fd2cb")} value={filters.action} options={[['all', 'All actions'], ...Object.entries(actionPermissions)
            .filter(([, permission]) => allowed(permission)).map(([key]) => [key, TASK_LABELS[key].action] as const)]} onChange={value => onChange({ action: value })} />
          <Filter label={cerigaTranslate("interface.text_25738061a8efe378")} value={filters.task_staff} options={staffOptions} onChange={value => onChange({ task_staff: value })} />
          <Filter label={cerigaTranslate("interface.text_12fd708e9c0279d9")} value={String(filters.soon)} options={[[ '1', '1 day'], ['3', '3 days'], ['7', '7 days'], ['14', '14 days']]}
            onChange={value => onChange({ soon: Number(value) })} />
        </div>
        {data.tasks.length ? <ul className="ops-list">{data.tasks.map(task => <li key={task.id}>
          {thumbnail(task.id)}<div className="ops-item"><strong>{task.nickname || task.product}</strong>
            <small>{[orderReference(task.id), task.customer_code, orderType(task), task.staff || cerigaTranslate("adminOrders.unassigned")].filter(Boolean).join(' · ')}</small>
            <p>{cerigaTranslateLabel(TASK_LABELS[task.task].title)}</p>
          </div>
          <div className="ops-due"><strong className={task.days_left !== null && task.days_left < 0 ? 'ops-urgent' : ''}>
            {cerigaTranslateLabel(deadlineLabel(task.days_left) || cerigaTranslate("orders.pending"))}
          </strong>{task.deadline && <small>{cerigaTranslateLabel(date(task.deadline, timezone))}{task.days_left !== null && task.days_left > 0 && task.days_left <= filters.soon ? cerigaTranslate("interface.text_276438052092adf6") : ''}</small>}</div>
          <Link className="fh-task-action" to={taskPath(task)}>{cerigaTranslateLabel(TASK_LABELS[task.task].action)}<ArrowUpRight size={14} /></Link>
        </li>)}</ul> : <div className="fh-empty ops-empty"><h3>{filters.action !== 'all' || filters.task_staff !== 'all' ? cerigaTranslate("interface.text_ba222548c3c5d933") : cerigaTranslate("interface.text_c3a40427d59391a5")}</h3><p>{cerigaTranslate("interface.text_9568932809caa11f")}</p></div>}
        <Pages label={cerigaTranslate("interface.text_172c8a01b464fd2d")} page={filters.task_page} size={6} total={data.taskTotal} loading={loading} onChange={value => onChange({ task_page: value, page: filters.page })} />
      </section>

      <section className="fh-stats" aria-label={cerigaTranslate("interface.text_77b61a7a9ba380c6")}>
        {metrics.filter(metric => allowed(metric.permission)).map(metric => <Link to={metric.link} className="fh-stat" key={metric.label}>
          <div className="fh-stat-label">{cerigaTranslateLabel(metric.label)}<metric.icon size={16} /></div><strong>{metric.count}</strong>
          <div className="fh-stat-note"><span>{cerigaTranslateLabel(metric.note)}</span><ArrowUpRight size={14} /></div>
          {!!metric.urgent && <p className="ops-urgent">{metric.urgent} {cerigaTranslateLabel(metric.urgency)}</p>}
        </Link>)}
      </section>

      <section className="fh-panel ops-section" aria-labelledby="ops-deadlines">
        <div className="fh-section-head"><h2 id="ops-deadlines"><Translate k="manufacturer.deadlines" /></h2>
          {allowed('calendar') && <Link to="/manufacturer/capacity">{cerigaTranslate("nav.calendar")}{" "}<ArrowUpRight size={14} /></Link>}</div>
        <div className="ops-deadline-counts">
          {deadlines.map(([key, label]) => <a key={key} href="#factory-floor"
            onClick={() => onChange({ due: key, stage: 'production', search: '', priority: 'all', type: 'all', staff: 'all', sort: 'deadline' })}>
            <span>{cerigaTranslateLabel(label)}</span><strong className={key === 'overdue' && data.deadlineCounts[key] ? 'ops-urgent' : ''}>{data.deadlineCounts[key]}</strong>
          </a>)}
        </div>
        {data.deadlines.length ? <ul className="ops-list">{data.deadlines.map(work => <li key={work.id}>
          <div className="ops-item"><Link to={workPath(work)}><strong>{work.nickname || work.product}</strong></Link>
            <small>{[orderReference(work.id), quantity(work), stage(work), work.staff || cerigaTranslate("adminOrders.unassigned")].join(' · ')}</small></div>
          <div className="ops-due"><strong>{formatCompletion(work)}</strong><small className={work.priority === 'overdue' ? 'ops-urgent' : ''}>{cerigaTranslateLabel(deadlineLabel(work.days_left))}</small></div>
        </li>)}</ul> : <div className="fh-empty ops-empty"><h3>{cerigaTranslate("interface.text_12f68961c1bf58d9")}</h3><p>{cerigaTranslate("interface.text_87eea612816fab7c")}</p></div>}
      </section>

      <section id="factory-floor" className="fh-panel fh-orders ops-section" aria-labelledby="ops-floor">
        <div className="fh-section-head"><h2 id="ops-floor">{cerigaTranslate("interface.text_7c57cf45e2cdf80b")}{" "}<span className="fh-count">{data.floorTotal}</span></h2>
          <Link to="/manufacturer/fulfilment">{cerigaTranslate("interface.text_32bcf076743cab8a")}{" "}<ArrowUpRight size={14} /></Link></div>
        <div className="fh-order-toolbar">
          <label className="fh-search"><Search size={15} /><input type="search" aria-label={cerigaTranslate("interface.text_cb52fe65df0efa8a")} maxLength={150}
            placeholder={cerigaTranslate("interface.text_00d8d4ca2c4e7659")} value={filters.search} onChange={event => onChange({ search: event.target.value })} /></label>
          <Filter label={cerigaTranslate("interface.text_de838855e4a6e04e")} value={filters.stage} options={[['all', 'All stages'], ['production', 'Production'],
            ['preparation', 'Preparations'], ['cutting_sewing', 'Cutting & Sewing'], ['finishing', 'Finishing'],
            ['quality', 'Quality check'], ['dispatch', 'Ready to dispatch'], ['shipping', 'Dispatched']]} onChange={value => onChange({ stage: value })} />
          <Filter label={cerigaTranslate("interface.text_e1cb6d30fa3f17ee")} value={filters.due} options={[['all', 'Any date'], ...deadlines, ['unset', 'Date not set']]} onChange={value => onChange({ due: value })} />
          <Filter label={cerigaTranslate("interface.text_08ee4565a256df6e")} value={filters.staff} options={staffOptions} onChange={value => onChange({ staff: value })} />
          <Filter label={cerigaTranslate("adminOrders.type")} value={filters.type} options={[['all', 'All types'], ['sample', 'Sample'], ['bulk', 'Bulk'], ['repeat_bulk', 'Repeat bulk']]} onChange={value => onChange({ type: value })} />
          <Filter label={cerigaTranslate("interface.text_d60dbba079223254")} value={filters.priority} options={[['all', 'All priorities'], ['overdue', 'Overdue'], ['soon', 'Due soon'], ['delay', 'Reported delay'], ['normal', 'Normal']]} onChange={value => onChange({ priority: value })} />
          <Filter label={cerigaTranslate("interface.text_bec69036aa27e7fa")} value={filters.sort} options={[['deadline', 'Deadline first'], ['newest', 'Newest first'], ['oldest', 'Oldest first']]} onChange={value => onChange({ sort: value })} />
        </div>
        {data.orders.length ? <div className="ops-floor-grid" role="table" aria-label={cerigaTranslate("interface.text_4d9751b10aee22da")}>
          <div className="ops-floor-head" role="row">{['Order / garment','Quantity','Order type','Current stage','Expected completion','Assigned to','Next action'].map(label =>
            <span key={label} role="columnheader">{cerigaTranslateLabel(label)}</span>)}</div>
          {data.orders.map(work => <div role="row" className="ops-floor-row" key={work.id}>
            <div role="cell" className="ops-order-cell">{thumbnail(work.id)}<Link to={orderPath(work.id)}>
              <strong>{work.nickname || work.product}</strong><small>{[orderReference(work.id), work.garment, work.customer_code].filter(Boolean).join(' · ')}</small>
              {work.is_returning && <small>{cerigaTranslate("interface.text_53d33e1899adb463")}</small>}</Link></div>
            <div role="cell" data-label="Quantity">{quantity(work)}</div>
            <div role="cell" data-label="Order type">{orderType(work)}</div>
            <div role="cell" data-label="Current stage">{cerigaTranslateLabel(stage(work))}{work.reported_delay && work.stage === 'production' && <small>{cerigaTranslate("interface.text_582ec231efa6d312")}</small>}</div>
            <div role="cell" data-label="Expected completion">{formatCompletion(work)}<small className={work.priority === 'overdue' ? 'ops-urgent' : ''}>{deadlineState(work)}</small></div>
            <div role="cell" data-label="Assigned to">{work.staff || cerigaTranslate("adminOrders.unassigned")}</div>
            <div role="cell"><Link to={workPath(work)} className="fh-task-action">{cerigaTranslateLabel(work.action)}<ArrowUpRight size={14} /></Link></div>
          </div>)}
        </div> : <div className="fh-empty ops-empty"><Package size={22} /><h3>{floorFiltered ? cerigaTranslate("common.noOrders") : cerigaTranslate("interface.text_aff3460f7a4e69c5")}</h3>
          <p>{floorFiltered ? cerigaTranslate("interface.text_d8f6f6e3902af01a") : cerigaTranslate("interface.text_66641ade2a653700")}</p></div>}
        <Pages label={cerigaTranslate("interface.text_5e1e5b9e25c53c92")} page={filters.page} total={data.floorTotal} size={12} loading={loading} onChange={value => onChange({ page: value, task_page: filters.task_page })} />
      </section>

      <section className="fh-panel ops-section" aria-labelledby="ops-activity">
        <div className="fh-section-head"><h2 id="ops-activity">{cerigaTranslate("interface.text_08ee9e0b3d0b822f")}</h2><span className="fh-small">{cerigaTranslate("interface.text_f8f03fb441b8b4ae")}</span></div>
        {data.activity.length ? <ul className="ops-list">{data.activity.map(event => <li key={event.id}>
          <div className="ops-item"><Link to={orderPath(event.order_id)}><strong>{event.previous && event.next && event.previous !== event.next
            ? stageLabel(event.previous) + ' → ' + stageLabel(event.next)
            : event.next ? cerigaTranslate("interface.text_befdaee7275f7ef7",{value0:(stageLabel(event.next))}) : ACTIVITY_LABELS[event.kind] || (event.kind === 'order_completed' ? cerigaTranslate("interface.text_e3ab394408d990a3") : cerigaTranslate("interface.text_00f955c35546e054"))}</strong></Link>
            <small>{[event.product, orderReference(event.order_id), event.employee].filter(Boolean).join(' · ')}</small></div>
          <time dateTime={event.at}>{cerigaTranslateLabel(date(event.at, timezone, true))}</time>
        </li>)}</ul> : <div className="fh-empty ops-empty"><h3>{cerigaTranslate("interface.text_779806c2d55e8a6f")}</h3><p>{cerigaTranslate("interface.text_2778b093856b68ed")}</p></div>}
      </section>

      {historical && <section className="fh-performance">
        <div><h2>{cerigaTranslate("interface.text_53db688bb59f22e7")}</h2><p>{cerigaTranslate("interface.text_eb970eb0951c6cde")}{" "}{data.days}{" "}{cerigaTranslate("interface.text_d30107aa1074a8c0")}</p></div>
        <div className="fh-performance-metrics">
          <div><span>{cerigaTranslate("manufacturerOrders.completedOrders")}</span><strong>{historical.completed}</strong></div>
          <div><span>{cerigaTranslate("interface.text_69860d341ddac03c")}</span><strong>{historical.quoteHours === null ? '—' : historical.quoteHours + 'h'}</strong><small>{historical.quoteSamples}{" "}{cerigaTranslate("interface.text_29433d7e23809b21")}</small></div>
          <div><span>{cerigaTranslate("interface.text_9ef9250c1dcc4245")}</span><strong>{historical.qcFirstReviewed ? percent(historical.qcFirstApproved, historical.qcFirstReviewed) : '—'}</strong>
            <small>{historical.qcFirstReviewed}{" "}{cerigaTranslate("interface.text_ba72396532f52e14")}{historical.qcFirstReviewed > 0 && historical.qcFirstReviewed < 5 ? cerigaTranslate("interface.text_8ecafb2810cd4d8d") : ''}</small></div>
        </div>
      </section>}
    </>}
  </div>;
}
