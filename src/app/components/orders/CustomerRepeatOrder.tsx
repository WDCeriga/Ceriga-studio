import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { distributeQuantity, emptySizeBreakdown, type OrderQuantityPlan } from '../../data/orderQuantities';
import type { UserOrder } from '../../data/userOrders';
import { teamRpc } from '../../lib/factoryTeam';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function CustomerRepeatOrder({ order }: { order: UserOrder }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('bulk');
  const [quantity, setQuantity] = useState('');
  const [fabric, setFabric] = useState(order.specifications?.fabricType ?? '');
  const [colour, setColour] = useState(order.specifications?.colorName ?? '');
  const [gsm, setGsm] = useState(String(order.specifications?.gsm ?? ''));
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const sample = order.priceOptions?.find(option => option.id === order.selectedPriceOptionId)?.kind === 'sample';
  const mayApprove = isSupabaseConfigured && order.kind === 'production' && sample && order.status === 'completed' && order.qcStatus === 'approved';
  useEffect(() => {
    if (!mayApprove) return;
    let active = true;
    void teamRpc('customer_order_sample_approval', { p_order: order.id }).then(version => {
      if (active && Number.isInteger(version)) setApproved(true);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not check sample approval');
    });
    return () => { active = false; };
  }, [mayApprove,order.id]);
  if (!isSupabaseConfigured || order.kind !== 'production') return null;
  async function approve() {
    setApproving(true); setError('');
    try {
      await teamRpc('customer_approve_history_sample', { p_order: order.id });
      setApproved(true); setMode('approved');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not approve sample'); }
    finally { setApproving(false); }
  }

  return <details className="mx-auto mt-6 max-w-5xl rounded-xl border border-white/15 bg-white/5 p-4 text-white">
    <summary className="cursor-pointer font-semibold">Use this product for another order</summary>
    <p className="mt-2 text-sm text-white/65">Ceriga links the next order to this product so the assigned factory can see its permitted history.</p>
    {order.productId && <p className="mt-2 text-sm"><Link className="underline" to={'/builder/' + encodeURIComponent(order.productId)}
      state={{ repeatOrder: { id:order.id, name:order.productName, specifications:order.specifications } }}>Revise measurements or artwork in Builder</Link>. Add any artwork needed for the revision.</p>}
    {mayApprove && <button type="button" className="mt-3 rounded border border-white/20 px-3 py-2 text-sm" disabled={approving || approved}
      onClick={() => void approve()}>{approved ? 'Sample approved' : approving ? 'Saving approval…' : 'Approve this sample'}</button>}
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    <form className="mt-4 space-y-3" onSubmit={event => {
      event.preventDefault();
      const units = Number(quantity);
      if (!Number.isInteger(units) || units < 1 || units > 1000000) return;
      const sampleLine = { id: 'sample', kind: 'sample' as const, bySize: mode === 'sample' ? distributeQuantity(units) : emptySizeBreakdown() };
      const orderQuantities: OrderQuantityPlan = {
        mode: 'custom_clothing', sample: sampleLine,
        bulkRuns: mode === 'sample' ? [] : [{ id:'bulk-1', kind:'bulk', targetTotal:units, bySize:distributeQuantity(units) }],
      };
      const specifications = { ...order.specifications, fabricType: fabric || undefined, colorName: colour || undefined,
        color: colour === (order.specifications?.colorName ?? '') ? order.specifications?.color : undefined,
        gsm: gsm ? Number(gsm) : undefined };
      navigate('/delivery', { state: {
        sourceOrderId: order.id, useApprovedSample: mode === 'approved', productId: order.productId,
        productName: order.productName, garmentType: order.garmentType, orderQuantities, specifications,
      } });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Order type<select className="rounded border border-white/20 bg-[#171717] p-2" value={mode} onChange={event => setMode(event.target.value)}>
          <option value="bulk">Bulk order</option><option value="sample">{sample ? 'Sample revision' : 'Sample order'}</option>
          {approved && <option value="approved">Bulk from approved sample</option>}</select></label>
        <label className="grid gap-1 text-sm">Total units<input className="rounded border border-white/20 bg-[#171717] p-2" type="number" required min={1} max={1000000} value={quantity} onChange={event => setQuantity(event.target.value)}/></label>
        {mode !== 'approved' && <>
          <label className="grid gap-1 text-sm">Fabric<input className="rounded border border-white/20 bg-[#171717] p-2" maxLength={120} value={fabric} onChange={event => setFabric(event.target.value)}/></label>
          <label className="grid gap-1 text-sm">Colour<input className="rounded border border-white/20 bg-[#171717] p-2" maxLength={120} value={colour} onChange={event => setColour(event.target.value)}/></label>
          <label className="grid gap-1 text-sm">GSM<input className="rounded border border-white/20 bg-[#171717] p-2" type="number" min={1} max={3000} value={gsm} onChange={event => setGsm(event.target.value)}/></label>
        </>}
      </div>
      {mode === 'approved' && <p className="text-sm text-white/65">The new bulk order uses the approved sample’s saved specifications. Ceriga reviews supporting files before sharing them.</p>}
      <button type="submit" className="rounded-lg bg-[#CC2D24] px-4 py-2 text-sm font-semibold">Continue to delivery</button>
    </form>
  </details>;
}
