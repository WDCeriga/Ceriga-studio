import { useCurrency } from '../lib/accountCurrency';
import { formatMoney } from '../lib/currency';
import { Money } from '../components/Money';
import { PAYMENTS_ENABLED, offerExpired } from '../lib/orderOffer';
import { submitOrderToManufacturer } from '../lib/manufacturerSubmission';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Clock, CreditCard, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  completeCheckout,
  getPriceOption,
  priceValidityDisclaimer,
  useUserOrder,
  type OrderPriceOption,
  type UserOrder,
} from '../data/userOrders';

function resolveCheckoutOption(
  order: UserOrder,
  optionId: string | undefined,
): OrderPriceOption | null {
  if (!optionId) return null;

  if (order.kind === 'tech-pack' && optionId === 'techpack') {
    return {
      id: 'techpack',
      kind: 'sample',
      label: order.exportFormat === 'pdf_bundle' ? 'PDF + bundle' : 'Tech pack PDF',
      description: 'Digital export',
      totalUnits: 0,
      priceCents: (order.total ?? 29) * 100,
      currency:order.totalCurrency,
    };
  }

  return getPriceOption(order, optionId) ?? null;
}

export function OrderCheckout() {
  const accountCurrency = useCurrency();
  const { id, optionId } = useParams();
  const navigate = useNavigate();
  const { order, loading, error } = useUserOrder(id);
  const [paying, setPaying] = useState(false);
  const [completedPreview, setCompletedPreview] = useState<{ orderId: string; optionId: string } | null>(null);

  const option = useMemo(
    () => (order && optionId ? resolveCheckoutOption(order, optionId) : null),
    [order, optionId],
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-sm text-white/50">
        Loading checkout…
      </div>
    );
  }

  if (error || !order || !option || !id || !optionId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-white">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Checkout unavailable</h2>
          {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
          <Button asChild className="mt-4 h-9 bg-[#CC2D24] text-xs hover:bg-[#CC2D24]/90">
            <Link to="/orders">Back to orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (order.kind === 'production' && order.productionReleasedAt &&
      ['processing', 'shipping', 'completed'].includes(order.status)) {
    return <Navigate replace to={`/orders/${id}/fulfilment`} />;
  }

  const expired = offerExpired(order);
    const previewPayment = order.kind !== 'production' && !PAYMENTS_ENABLED;
  const supportHref = `mailto:hello@ceriga.studio?subject=${encodeURIComponent(`Request an updated quote — Ceriga order ${id}`)}`;
  const approvedAmount = option.currency ? formatMoney(option.priceCents, option.currency) : 'Currency needs review';
  const handlePay = async () => {
    if (expired || paying || !option.currency) return;
    if (previewPayment) {
      setCompletedPreview({ orderId: id, optionId });
      return;
    }
    setPaying(true);
    try {
      if(order.kind==='production') {
        await submitOrderToManufacturer(id, optionId);
        toast.success('Order submitted to manufacturer');
      } else await completeCheckout(id, optionId);
      navigate(order.kind === 'production' ? `/orders/${id}/fulfilment` : `/orders/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit order');
    } finally {
      setPaying(false);
    }
  };

  if (previewPayment && completedPreview?.orderId === id && completedPreview.optionId === optionId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-white">
        <section className="w-full max-w-lg space-y-4 rounded-xl border border-[#252528] bg-white/[0.03] p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" aria-hidden />
          <h1 className="text-2xl font-bold">Payment preview</h1>
          <p className="text-sm text-white/70">{order.productName} · {option.label}</p>
          <p className="text-sm text-white/70">This was a payment preview. No charge was made and the order is still awaiting payment.</p>
          <Button asChild className="w-full bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to={`/orders/${id}`} replace>View order</Link>
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#09090B] text-white">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link
          to={`/orders/${id}`}
          className="mb-6 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to order
        </Link>

        <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">{order.kind==='production'?'Submit order':'Checkout'}</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase tracking-[-0.03em] text-white">
          {option.label}
        </h1>
        <p className="mt-1 text-sm text-white/45">{order.productName}</p>

        {option.shipping&&<p className="mt-4 text-xs text-white/60">{option.shipping.provider} · {option.shipping.method}{option.shipping.transitDays ? ` · Estimated ${option.shipping.transitDays} calendar days after collection.` : ''} {option.shipping.tradeTerms}</p>}
        <div className="mt-6 space-y-4 rounded-xl border border-[#252528] bg-white/[0.03] p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/55">{option.description}</span>
            <span className="font-bold tabular-nums text-white">
              {approvedAmount}
            </span>
          </div>
          {option.currency&&accountCurrency.ready&&!accountCurrency.error&&accountCurrency.currency!==option.currency&&<p className="text-xs text-white/60">Indicative conversion: <Money cents={option.priceCents} currency={option.currency}/></p>}
          <div className="border-t border-[#252528] pt-4">
            <div className="mb-3 flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden />
              <p className="text-[11px] leading-relaxed text-amber-100/85">
                {priceValidityDisclaimer(order.pricedAt,order.quoteExpiresAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              {expired?'This quote has expired. Contact Ceriga for an updated quote.':previewPayment?'Payment preview. No charge will be made.':order.kind==='production'?'Submit this option to your assigned manufacturer. No payment is collected.':'Review the approved amount before paying.'}
            </div>
          </div>
          {expired ? <Button asChild className="h-11 w-full bg-[#CC2D24] text-sm font-semibold hover:bg-[#CC2D24]/90">
            <a href={supportHref}><Mail className="mr-2 h-4 w-4" aria-hidden />Request an updated quote</a>
          </Button> : <Button
            type="button"
            disabled={!option.currency || paying}
            className="h-11 w-full bg-[#CC2D24] text-sm font-semibold hover:bg-[#CC2D24]/90 disabled:opacity-50"
            onClick={() => void handlePay()}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {paying ? 'Submitting…' : order.kind==='production'&&!previewPayment?'Submit to manufacturer':`Pay ${approvedAmount}`}
          </Button>}
        </div>

        <p className="mt-4 text-center text-[10px] text-white/30">
          Order {order.id}
        </p>
      </div>
    </div>
  );
}

export default OrderCheckout;
