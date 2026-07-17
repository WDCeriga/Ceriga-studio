import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Clock, CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  checkoutPath,
  completeCheckout,
  formatEuro,
  getPriceOption,
  getUserOrderById,
  priceValidityDisclaimer,
  type OrderPriceOption,
} from '../data/userOrders';

function resolveCheckoutOption(
  orderId: string,
  optionId: string | undefined,
): OrderPriceOption | null {
  const order = getUserOrderById(orderId);
  if (!order || !optionId) return null;

  if (order.kind === 'tech-pack' && optionId === 'techpack') {
    return {
      id: 'techpack',
      kind: 'sample',
      label: order.exportFormat === 'pdf_bundle' ? 'PDF + bundle' : 'Tech pack PDF',
      description: 'Digital export',
      totalUnits: 0,
      priceCents: (order.total ?? 29) * 100,
    };
  }

  return getPriceOption(order, optionId) ?? null;
}

export function OrderCheckout() {
  const { id, optionId } = useParams();
  const navigate = useNavigate();

  const order = id ? getUserOrderById(id) : undefined;
  const option = useMemo(
    () => (id && optionId ? resolveCheckoutOption(id, optionId) : null),
    [id, optionId],
  );

  if (!order || !option || !id || !optionId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0F0F0F] px-4 text-white">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Checkout unavailable</h2>
          <Button asChild className="mt-4 h-9 bg-[#CC2D24] text-xs hover:bg-[#CC2D24]/90">
            <Link to="/orders">Back to orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handlePay = () => {
    completeCheckout(id, optionId);
    navigate(`/orders/${id}`);
  };

  return (
    <div className="min-h-dvh bg-[#0F0F0F] text-white">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link
          to={`/orders/${id}`}
          className="mb-6 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to order
        </Link>

        <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">Checkout</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase tracking-[-0.03em] text-white">
          {option.label}
        </h1>
        <p className="mt-1 text-sm text-white/45">{order.productName}</p>

        <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/55">{option.description}</span>
            <span className="font-bold tabular-nums text-white">
              {formatEuro(option.priceCents)}
            </span>
          </div>
          <div className="border-t border-white/10 pt-4">
            <div className="mb-3 flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden />
              <p className="text-[11px] leading-relaxed text-amber-100/85">
                {priceValidityDisclaimer(order.pricedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Secure payment · mock checkout for prototype
            </div>
          </div>
          <Button
            type="button"
            className="h-11 w-full bg-[#CC2D24] text-sm font-semibold hover:bg-[#CC2D24]/90"
            onClick={handlePay}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {formatEuro(option.priceCents)}
          </Button>
        </div>

        <p className="mt-4 text-center text-[10px] text-white/30">
          Order {order.id} · {checkoutPath(id, optionId)}
        </p>
      </div>
    </div>
  );
}

export default OrderCheckout;
