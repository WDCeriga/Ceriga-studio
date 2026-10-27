import{useFactoryAccess}from '../../contexts/FactoryAccessContext';
import { ProductionProgress } from './ProductionProgress';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { getOrder, createUploadSignedUrls } from '../../lib/ordersDb';
import { FACTORY_STATUS_LABEL } from '../../data/manufacturerPortalMock';
import { formatDeliveryLines } from '../../data/orderDelivery';
import { ManufacturerQuoteForm } from './ManufacturerQuoteForm';
import { OrderQualityControl } from '../quality/OrderQualityControl';
import { ORDER_SIZE_KEYS } from '../../data/builderSteps';
import type { UserOrder } from '../../data/userOrders';

function Detail({ label, children }: { label: string; children?: ReactNode }) {
  return <div><dt className="text-xs text-white/45">{label}</dt><dd className="mt-1 break-words text-sm text-white/85">{children || 'Not specified'}</dd></div>;
}
const date = (value?: string) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not specified';
const specLabels: Record<string, string> = { fit: 'Fit', color: 'Colour', colorName: 'Colour name', neckType: 'Neckline', sleeveType: 'Sleeve style', sleeveLength: 'Sleeve length', fabricType: 'Fabric', gsm: 'Fabric weight (GSM)' };

export function AssignedOrderDetails({ id,quotationOnly=false }: { id: string;quotationOnly?:boolean }) {
  const{access}=useFactoryAccess();
  const [order, setOrder] = useState<UserOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setOrder(null);
    let inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{const row=await getOrder(id);if(current){if(row&&access?.factoryId&&row.assignedManufacturerId!==access.factoryId)throw new Error('This order is not assigned to the selected factory');setOrder(row);setError(row?'':'Order not found or no longer assigned to your factory');}}catch(cause){if(current)setError(cause instanceof Error?cause.message:'Could not load order');}finally{inFlight=false;if(current)setLoading(false);}};
    void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);window.addEventListener('ceriga-orders-updated',refresh);
    return()=>{current=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('ceriga-orders-updated',refresh);};
  }, [id,access?.factoryId]);
  const open = async (path: string) => {
    try {
      const urls = await createUploadSignedUrls([path]);
      if (!urls[path]) throw Error('File unavailable');
      window.open(urls[path], '_blank', 'noopener,noreferrer');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open file'); }
  };
  const lines = order?.orderQuantities ? [order.orderQuantities.sample, ...order.orderQuantities.bulkRuns].filter(Boolean) : [];
  const specs = Object.entries(order?.specifications || {}).filter(([, value]) => value != null && value !== '');
  const panel = 'rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6';
  return <div className="mx-auto max-w-5xl space-y-6 text-white">
    <Link to={quotationOnly?'/manufacturer/quotations':'/manufacturer/orders'} className="inline-flex text-sm text-white/55 hover:text-white">← Back to {quotationOnly?'quotations':'orders'}</Link>
    {loading && <p role="status">Loading order…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-300">{error}</p>}
    {order && <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-red-400">{quotationOnly?'Quotation':'Assigned order'}</p><h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">{order.productName}</h1><p className="mt-2 break-all text-xs text-white/40">{order.id}</p></div>
        <span className="w-fit shrink-0 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-sm text-sky-200">{FACTORY_STATUS_LABEL[order.factoryStatus || 'new']}</span>
      </header>
      <section className={panel} aria-label="Order overview"><dl className="grid gap-5 sm:grid-cols-3"><Detail label="Garment">{order.garmentType}</Detail><Detail label="Order type">{order.kind === 'tech-pack' ? 'Tech pack' : 'Production'}</Detail><Detail label="Quotation deadline">{date(order.dueQuoteBy)}</Detail></dl></section>
      {!quotationOnly && order.productionReleasedAt && <section className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5"><h2 className="font-semibold text-emerald-200">{order.manufacturerSubmittedAt?'Customer submitted — ready for production':'Payment verified — production released'}</h2><p className="mt-2 text-sm text-white/70">Selected option: {order.priceOptions?.find(option=>option.id===order.selectedPriceOptionId)?.label} · {order.priceOptions?.find(option=>option.id===order.selectedPriceOptionId)?.totalUnits} units.</p></section>}
      {quotationOnly&&access?.permissions.includes('quote')&&<ManufacturerQuoteForm key={`${order.id}:${order.quotedAt||''}:${order.factoryStatus}:${order.factoryRejectReason||''}`} order={order} onRejected={reason => setOrder(previous => previous ? { ...previous, factoryStatus: 'rejected', factoryRejectReason: reason } : previous)} onSubmitted={tiers => setOrder(previous => previous ? { ...previous, manufacturerQuote: tiers, factoryStatus: 'quoted', factoryRejectReason: undefined, quotedAt: new Date().toISOString() } : previous)} />}
      {!quotationOnly&&order.kind === 'production' && <OrderQualityControl orderId={order.id} />}
      {!quotationOnly&&access?.permissions.includes('quote')&&<Link className="inline-block rounded-xl border border-red-400/25 px-4 py-3 text-sm text-red-200" to={"/manufacturer/quotations/"+order.id}>View quotation</Link>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={panel}><h2 className="text-lg font-semibold">Quantities & sizes</h2>
          {lines.length ? <div className="mt-4 space-y-5">{lines.map((line, index) => {
            const sizes = ORDER_SIZE_KEYS.map(size => [size, line.bySize?.[size] ?? 0] as const);
            const total = line.targetTotal ?? sizes.reduce((sum, [, count]) => sum + count, 0);
            return <div key={line.id || index}><div className="flex justify-between gap-3 text-sm"><h3 className="font-medium">{line.kind === 'sample' ? 'Samples' : `Bulk option ${index}`}</h3><span className="text-white/60">{total} units</span></div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-white/10"><table className="w-full text-center text-xs"><caption className="sr-only">Size breakdown for {line.kind === 'sample' ? 'samples' : `bulk option ${index}`}</caption><thead className="bg-white/5"><tr>{sizes.map(([size]) => <th scope="col" key={size} className="px-3 py-2 font-medium uppercase text-white/50">{size}</th>)}</tr></thead><tbody><tr>{sizes.map(([size, count]) => <td key={size} className="px-3 py-2">{count}</td>)}</tr></tbody></table></div>
            </div>;
          })}{lines.some(line => line.kind === 'bulk') && <p className="text-xs text-white/40">Bulk options are separate quotation tiers.</p>}</div> : <p className="mt-3 text-sm text-white/50">{order.quoteRequest?.quantity || 'No quantities supplied.'}</p>}
        </section>
        <section className={panel}><h2 className="text-lg font-semibold">Garment specifications</h2>{specs.length ? <dl className="mt-4 grid grid-cols-2 gap-5">{specs.map(([key, value]) => <Detail key={key} label={specLabels[key] || key}>{String(value)}</Detail>)}</dl> : <p className="mt-3 text-sm text-white/50">No additional specifications supplied.</p>}</section>
        <section className={panel}><h2 className="text-lg font-semibold">Customer requirements</h2><dl className="mt-4 space-y-5"><Detail label="Requested timeline">{order.quoteRequest?.timeline}</Detail><Detail label="Notes"><span className="whitespace-pre-wrap">{order.quoteRequest?.notes || 'No additional notes.'}</span></Detail></dl></section>
        <section className={panel}><h2 className="text-lg font-semibold">Delivery details</h2>{order.delivery ? <dl className="mt-4 space-y-5"><Detail label="Recipient">{[order.delivery.firstName, order.delivery.lastName].filter(Boolean).join(' ')}</Detail><Detail label="Address"><span className="whitespace-pre-line">{formatDeliveryLines(order.delivery).join('\n')}</span></Detail><div className="grid gap-5 sm:grid-cols-2"><Detail label="Email">{order.delivery.email}</Detail><Detail label="Phone">{order.delivery.phone}</Detail></div>{order.delivery.instructions && <Detail label="Delivery instructions">{order.delivery.instructions}</Detail>}</dl> : <p className="mt-3 text-sm text-white/50">No delivery details supplied.</p>}</section>
      </div>
      {!quotationOnly && order.productionReleasedAt && <ProductionProgress orderId={order.id} editable={!!access?.permissions.includes('production') && order.status === 'processing' && order.factoryStatus === 'in_production'}/>}
      <section className={panel}><h2 className="text-lg font-semibold">Supporting files</h2>{order.quoteRequest?.storagePaths?.length ? <div className="mt-4 flex flex-wrap gap-3">{order.quoteRequest.storagePaths.map((path, index) => <button type="button" className="max-w-full break-all rounded-lg border border-white/15 px-4 py-2 text-left text-sm text-red-300 hover:bg-white/5" key={path} onClick={() => void open(path)}>{order.quoteRequest?.fileNames?.[index] || path.split('/').pop() || 'Open file'}</button>)}</div> : <p className="mt-3 text-sm text-white/50">No supporting files attached.</p>}</section>
    </>}
  </div>;
}
