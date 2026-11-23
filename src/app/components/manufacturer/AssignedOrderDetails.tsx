import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import{useFactoryAccess}from '../../contexts/FactoryAccessContext';
import { manufacturerOrderState } from '../../lib/manufacturerOrderView';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { getOrder } from '../../lib/ordersDb';
import { fetchComparisonRequests } from '../../lib/manufacturerQuote';
import { FACTORY_STATUS_LABEL } from '../../data/manufacturerPortalMock';
import { FactoryOrderHistoryPanel } from './FactoryOrderHistoryPanel';
import { FactoryOrderDocuments } from './FactoryOrderDocuments';
import { ManufacturerQuoteForm } from './ManufacturerQuoteForm';
import { OrderCommunication } from '../orders/OrderCommunication';
import './manufacturer-quotations.css';
import { ORDER_SIZE_KEYS } from '../../data/builderSteps';
import { orderReference } from '../../lib/factoryOrderHistory';
import type { UserOrder } from '../../data/userOrders';

function Detail({ label, children }: { label: string; children?: ReactNode }) {
  useCerigaTranslation();

  return <div><dt className="text-xs text-white/45">{cerigaTranslateLabel(label)}</dt><dd className="mt-1 break-words text-sm text-white/85">{children || cerigaTranslate("manufacturerOrders.unspecified")}</dd></div>;
}
const date = (value?: string) => value ? new Date(value).toLocaleDateString(cerigaLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not specified';
const specLabels: Record<string, string> = { fit: 'Fit', color: 'Colour', colorName: 'Colour name', neckType: 'Neckline', sleeveType: 'Sleeve style', sleeveLength: 'Sleeve length', fabricType: 'Fabric', gsm: 'Fabric weight (GSM)' };

export function AssignedOrderDetails({ id, quotationOnly = false, queue, onSkip, onResolved, quoteBack }: {
  id: string; quotationOnly?: boolean; queue?: { remaining: number; feedback: string }; onSkip?: () => void; onResolved?: (result: string) => void; quoteBack?: string;
}) {
  useCerigaTranslation();

  const{access}=useFactoryAccess();
  const [order, setOrder] = useState<UserOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setOrder(null);
    let inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{
      const comparisonOrder = quotationOnly ? (await fetchComparisonRequests(id))[0] : undefined;
      const row= comparisonOrder ?? await getOrder(id);
      if(current){if(row&&access?.factoryId&&row.assignedManufacturerId!==access.factoryId)throw new Error("This order is not assigned to the selected factory");setComparison(Boolean(comparisonOrder));setOrder(row);setError(row?'':cerigaTranslate("interface.text_be53a35658cceb8e"));}
    }catch(cause){if(current)setError(cause instanceof Error?cause.message:cerigaTranslate("interface.text_8b7f55320d269f45"));}finally{inFlight=false;if(current)setLoading(false);}};
    void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);window.addEventListener('ceriga-orders-updated',refresh);
    return()=>{current=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('ceriga-orders-updated',refresh);};
  }, [id,access?.factoryId,quotationOnly]);
  const lines = order?.orderQuantities ? [order.orderQuantities.sample, ...order.orderQuantities.bulkRuns].filter(Boolean) : [];
  const specs = Object.entries(order?.specifications || {}).filter(([, value]) => (typeof value === 'string' && value.trim()) || typeof value === 'number');
  const panel = 'rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6';
  const stage = order ? manufacturerOrderState(order) : null;
  const showAction = !quotationOnly && stage && stage.href !== stage.detail && access?.permissions.includes(stage.permission);
  if (quotationOnly) {
    const factoryId = access?.factoryId;
    const quoteSpecs = specs.filter(([key]) => key !== 'color' || !order?.specifications?.colorName);
    const sizeLines = lines.flatMap((line, index) => {
      const sizes = ORDER_SIZE_KEYS.flatMap(size => {
        const count = line.bySize?.[size] ?? 0;
        return count > 0 ? [size.toUpperCase() + ' × ' + count] : [];
      });
      return sizes.length ? [{ id: line.id, label: line.kind === 'sample' ? 'Samples' : 'Bulk option ' + index, sizes }] : [];
    });
    return <div className="manufacturer-quote-detail mx-auto max-w-6xl">
      <div className="quote-navigation">
        <Link to={quoteBack ?? '/manufacturer/orders'}>← {quoteBack ? cerigaTranslate("interface.text_a5ff5d3d356ac348") : cerigaTranslate("orders.back")}</Link>
        {queue && <span>{queue.remaining ? cerigaTranslate("interface.text_338d5f4ce2879d0a",{value0:(queue.remaining)}) : cerigaTranslate("interface.text_45ebc4d635cd266b")}</span>}
      </div>
      {queue?.feedback && <p className="quote-feedback" role="status">{queue.feedback}</p>}
      {loading && <p role="status" className="quote-message">{cerigaTranslate("interface.text_a1bc723f72a4a31d")}</p>}
      {error && <p role="alert" className="quote-message quote-overdue">{cerigaTranslateLabel(error)}</p>}
      {order && <>
        <header className="quote-order-heading">
          <div><p className="quote-reference-number">{orderReference(order.id)}</p><h1>{order.productName}</h1></div>
          <div className="quote-order-status">
            <span>{cerigaTranslateLabel(FACTORY_STATUS_LABEL[order.factoryStatus ?? cerigaTranslate("interface.text_11507a0e2f5e69d5")])}</span>
            {order.dueQuoteBy && <span className={stage?.overdue ? 'quote-overdue' : undefined}>{stage?.overdue ? cerigaTranslate("interface.text_81a4e48221dd064f") : cerigaTranslate("manufacturerOrders.due")}{date(order.dueQuoteBy)}</span>}
          </div>
        </header>
        <div className="quote-columns">
          {access?.permissions.includes('quote') && <ManufacturerQuoteForm comparison={comparison} onSkip={onSkip} appearance="light"
            key={factoryId+':'+order.id} order={order}
            onRejected={reason => { setOrder(previous => previous ? { ...previous, factoryStatus: 'rejected', factoryRejectReason: reason } : previous); onResolved?.('Quotation request declined.'); }}
            onSubmitted={tiers => { setOrder(previous => previous ? { ...previous, manufacturerQuote: tiers, factoryStatus: 'quoted', factoryRejectReason: undefined, quotedAt: new Date().toISOString() } : previous); onResolved?.('Quotation sent to Ceriga for review.'); }}/>}
          <div className="quote-sidebar">
            <aside className="quote-reference" aria-label={cerigaTranslate("interface.text_04db5ae332e5dc58")}>
              <h2>{cerigaTranslate("interface.text_04db5ae332e5dc58")}</h2>
              {!comparison && order.kind === 'production' && factoryId && <FactoryOrderHistoryPanel key={factoryId + id} factoryId={factoryId} orderId={id} quotation/>}
              {(quoteSpecs.length > 0 || order.quoteRequest?.timeline) && <details className="quote-disclosure">
                <summary>{cerigaTranslate("interface.text_8f64b465987c1cdd")}</summary>
                <dl className="quote-specs">
                  {quoteSpecs.map(([key, value]) => <Detail key={key} label={cerigaTranslateLabel(specLabels[key] || key)}>{String(value)}</Detail>)}
                  {order.quoteRequest?.timeline && <Detail label={cerigaTranslate("interface.text_6bf78d62e6fb4916")}>{order.quoteRequest.timeline}</Detail>}
                </dl>
              </details>}
              {sizeLines.length > 0 && <details className="quote-disclosure">
                <summary>{cerigaTranslate("interface.text_c554521b3ed4fbe3")}</summary>
                <dl className="quote-specs">{sizeLines.map(line => <Detail key={line.id} label={cerigaTranslateLabel(line.label)}>{line.sizes.join(' · ')}</Detail>)}</dl>
              </details>}
              {!comparison && factoryId && <FactoryOrderDocuments key={factoryId + id} factoryId={factoryId} orderId={id} compact/>}
            </aside>
            {factoryId && access?.permissions.includes('messages') && <OrderCommunication key={factoryId + id} orderId={id} scope="manufacturer"/>}
          </div>
        </div>
      </>}
    </div>;
  }
  return <div className="quotation-detail assigned-order-detail mx-auto max-w-6xl space-y-6">
    <Link to='/manufacturer/orders' className="inline-flex text-sm text-white/55 hover:text-white">{cerigaTranslate("interface.text_544994bd96305ea8")}</Link>
    {loading && <p role="status">{cerigaTranslate("interface.text_5a5f7fb48c3b602b")}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-700">{cerigaTranslateLabel(error)}</p>}
    {order && <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-red-400">{cerigaTranslate("interface.text_863a07bfd8f39559")}</p><h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">{order.productName}</h1><p className="mt-2 break-all text-xs text-white/40">{order.id}</p></div>
        <span className="w-fit shrink-0 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-sm text-sky-200">{stage?.label}</span>
      </header>
      <section className={panel} aria-label={cerigaTranslate("manufacturerOrders.orderOverview")}><dl className="grid items-center gap-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label={cerigaTranslate("adminOrders.garment")}>{order.garmentType}</Detail><Detail label={cerigaTranslate("adminOrders.type")}>{order.kind === 'tech-pack' ? cerigaTranslate("adminOrders.techpack") : cerigaTranslate("nav.production")}</Detail>{(quotationOnly || stage?.quoteDue) && <Detail label={stage?.overdue ? cerigaTranslate("interface.text_39bf1d7c94caa903") : cerigaTranslate("interface.text_8b7993a7621fc287")}>{date(order.dueQuoteBy)}</Detail>}{showAction && <Link className="assigned-order-action" to={stage.href}>{stage.action} →</Link>}</dl></section>
      {!quotationOnly && order.productionReleasedAt && <section className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5"><h2 className="font-semibold text-emerald-800">{order.manufacturerSubmittedAt?cerigaTranslate("interface.text_4540cd56491a455d"):cerigaTranslate("interface.text_06b6ad254e81b4eb")}</h2><p className="mt-2 text-sm text-white/70">{cerigaTranslate("interface.text_8b42fd05f00233c3")}{" "}{order.priceOptions?.find(option=>option.id===order.selectedPriceOptionId)?.label} · {order.priceOptions?.find(option=>option.id===order.selectedPriceOptionId)?.totalUnits}{" "}{cerigaTranslate("interface.text_547ca613ed240ff8")}</p></section>}
      {order.kind === 'production' && access?.factoryId && <FactoryOrderHistoryPanel key={access.factoryId + id} factoryId={access.factoryId} orderId={id}/>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={panel}><h2 className="text-lg font-semibold">{cerigaTranslate("interface.text_04ce3fac9b3efda5")}</h2>
          {lines.length ? <div className="mt-4 space-y-5">{lines.map((line, index) => {
            const sizes = ORDER_SIZE_KEYS.map(size => [size, line.bySize?.[size] ?? 0] as const);
            const total = line.targetTotal ?? sizes.reduce((sum, [, count]) => sum + count, 0);
            return <div key={line.id || index}><div className="flex justify-between gap-3 text-sm"><h3 className="font-medium">{line.kind === 'sample' ? cerigaTranslate("interface.text_bc228b269ce0d87f") : cerigaTranslate("interface.text_cae3429cd06dab52",{value0:(index + (order.orderQuantities?.sample ? 0 : 1))})}</h3><span className="text-white/60">{total}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</span></div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-white/10"><table className="w-full text-center text-xs"><caption className="sr-only">{cerigaTranslate("interface.text_5664ae31ca216458")}{" "}{line.kind === 'sample' ? cerigaTranslate("interface.text_24baa7a731ce04b4") : cerigaTranslate("interface.text_fcf49bccb05b7cbb",{value0:(index + (order.orderQuantities?.sample ? 0 : 1))})}</caption><thead className="bg-white/5"><tr>{sizes.map(([size]) => <th scope="col" key={size} className="px-3 py-2 font-medium uppercase text-white/50">{size}</th>)}</tr></thead><tbody><tr>{sizes.map(([size, count]) => <td key={size} className="px-3 py-2">{count}</td>)}</tr></tbody></table></div>
            </div>;
          })}{lines.some(line => line.kind === 'bulk') && <p className="text-xs text-white/40">{cerigaTranslate("interface.text_a6ec23a12d43e511")}</p>}</div> : <p className="mt-3 text-sm text-white/50">{order.quoteRequest?.quantity || cerigaTranslate("interface.text_7d608a6c48b94ca9")}</p>}
        </section>
        <section className={panel}><h2 className="text-lg font-semibold">{cerigaTranslate("interface.text_8f64b465987c1cdd")}</h2>{specs.length ? <dl className="mt-4 grid grid-cols-2 gap-5">{specs.map(([key, value]) => <Detail key={key} label={cerigaTranslateLabel(specLabels[key] || key)}>{String(value)}</Detail>)}</dl> : <p className="mt-3 text-sm text-white/50">{cerigaTranslate("interface.text_9d804d17eca1178c")}</p>}</section>
        {order.quoteRequest?.timeline && <section className={panel}><h2 className="text-lg font-semibold">{cerigaTranslate("interface.text_6bf78d62e6fb4916")}</h2><p className="mt-2 text-sm">{order.quoteRequest.timeline}</p></section>}
      </div>
      {access?.factoryId && access.permissions.includes('messages') && order.kind === 'production' && <OrderCommunication key={access.factoryId + id} orderId={id} scope="manufacturer" production={!!order.productionReleasedAt}/>}
      {access?.factoryId && <FactoryOrderDocuments key={access.factoryId + id} factoryId={access.factoryId} orderId={id}/>}
    </>}
  </div>;
}
