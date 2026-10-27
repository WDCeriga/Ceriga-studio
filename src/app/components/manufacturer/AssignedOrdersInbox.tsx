import{useFactoryAccess}from '../../contexts/FactoryAccessContext';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Package, Search } from 'lucide-react';
import { fetchAssignedOrders } from '../../data/manufacturerDb';
import { formatOrderQuantitiesSummary } from '../../data/orderQuantities';
import { FACTORY_STATUS_LABEL } from '../../data/manufacturerPortalMock';
import type { UserOrder } from '../../data/userOrders';

export function AssignedOrdersInbox({quotationOnly=false}:{quotationOnly?:boolean}={}) {
  const{access}=useFactoryAccess();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(quotationOnly?'pending':'all');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setOrders([]);setLoading(true);setError('');
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const rows = await fetchAssignedOrders({quotations:quotationOnly});
        if (current) { setOrders(rows); setError(''); }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Could not load assigned orders');
      } finally {
        inFlight = false;
        if (current) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 10000);
    window.addEventListener('focus', load);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [retry,quotationOnly,access?.factoryId]);

  const filtered = orders.filter(order =>
    (!quotationOnly||(['submitted','awaiting_payment'].includes(order.status)&&['new','reviewing','clarifying','quoted'].includes(order.factoryStatus||'new'))) &&
    (status === 'all' || (status==='pending'?['new','reviewing','clarifying'].includes(order.factoryStatus||'new'):(order.factoryStatus || 'new') === status)) &&
    [order.id, order.productName, order.garmentType].some(value => value.toLowerCase().includes(search.trim().toLowerCase()))
  );
  return <section className="space-y-6 text-white">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]"><Package className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{quotationOnly?'Quotations':'Inbox'}</span></div>
        <h1 className="mt-1.5 text-2xl font-semibold sm:text-3xl">{quotationOnly?'Quotations':'Orders'}</h1>
        <p className="mt-1 text-sm text-white/45">{quotationOnly?'Quotation requests, revisions and submitted quotations':'Orders assigned to your factory by Ceriga'} · {filtered.length} shown</p>
      </div>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/35" />
        <input type="search" aria-label={quotationOnly?'Search quotations':'Search orders'} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, garment, ID…" className="h-10 w-full rounded-xl border border-[#252528] bg-white/[0.03] pl-9 pr-3 text-sm outline-none focus:border-[#CC2D24]/50" />
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5" aria-label="Order status filters">
      {(quotationOnly?[['pending','Needs quotation'],['quoted','Submitted'],['all','All quotations']]:[['all', 'All'], ...Object.entries(FACTORY_STATUS_LABEL)]).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`rounded-lg border px-3 py-1.5 text-xs ${status === value ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100' : 'border-[#252528] text-white/50 hover:text-white'}`}>{label}</button>)}
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-300">{error} <button type="button" className="ml-2 underline" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button></div>}
    <div className="overflow-hidden rounded-2xl border border-[#252528] bg-[#111113]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm" aria-label={quotationOnly?'Quotations':'Assigned orders'} aria-busy={loading}>
          <thead><tr className="border-b border-[#252528] bg-black/30 text-[10px] uppercase tracking-wider text-white/40">
            {['Order', 'Product', 'Type', 'Qty', 'Quote due', 'Status', 'Action'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(order => <tr key={order.id} className="border-b border-[#252528] last:border-0 hover:bg-white/[0.03]">
              <td className="px-4 py-4 text-xs text-white/50">{order.id}</td>
              <td className="px-4 py-4 font-medium">{order.productName}<p className="mt-1 text-xs font-normal text-white/45">{order.garmentType}</p></td>
              <td className="px-4 py-4 text-white/60">{order.kind === 'tech-pack' ? 'Tech pack' : 'Production'}</td>
              <td className="px-4 py-4 text-xs text-white/60">{order.orderQuantities ? formatOrderQuantitiesSummary(order.orderQuantities).join(' · ') : order.quoteRequest?.quantity || 'Not specified'}</td>
              <td className="whitespace-nowrap px-4 py-4 text-white/60">{order.dueQuoteBy ? new Date(order.dueQuoteBy).toLocaleDateString('en-GB') : 'Not specified'}</td>
              <td className="px-4 py-4"><span className="whitespace-nowrap rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70">{quotationOnly?({new:'Quotation requested',reviewing:'Preparing quotation',clarifying:'Revision requested',quoted:'Submitted for review'} as Record<string,string>)[order.factoryStatus||'new']:FACTORY_STATUS_LABEL[order.factoryStatus || 'new']}</span></td>
              <td className="px-4 py-4"><Link to={`/manufacturer/${quotationOnly?'quotations':'orders'}/${order.id}`} className="whitespace-nowrap text-red-300 hover:underline">{quotationOnly?(order.factoryStatus==='quoted'?'View quotation':order.factoryStatus==='clarifying'?'Revise quotation':'Prepare quotation'):'View order'}</Link></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={7} className="px-6 py-16 text-center text-sm text-white/40">{loading ? 'Loading assigned orders…' : error ? 'Orders could not be loaded. Retry above.' : orders.length ? 'No orders match these filters.' : quotationOnly?'No orders currently require a quotation.':'No orders have been assigned to your factory yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}
