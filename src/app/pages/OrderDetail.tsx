import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { OrderCommunication } from '../components/orders/OrderCommunication';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { CustomerRepeatOrder } from '../components/orders/CustomerRepeatOrder';
import { Fragment, useState } from 'react';
import { OrderQuantitiesSummary } from '../components/builder/OrderQuantitiesStep';
import { Link, useParams } from 'react-router';
import { Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  OrderDetailContent,
  OrderDetailShell,
} from '../components/orders/OrderDetailViews';
import { useUserOrder } from '../data/userOrders';

export function OrderDetail() {
  useCerigaTranslation();

  const { id } = useParams();
  const { order, loading, error } = useUserOrder(id);

  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
  const confirm = async () => {
    if (!id || confirming) return;
    setConfirming(true);
    setConfirmationError('');
    try {
      const result = await getSupabase().rpc('confirm_admin_created_order', {p_order:id});
      if (result.error || result.data !== id) throw new Error(result.error?.message ?? 'Confirmation was not saved.');
      window.dispatchEvent(new Event('ceriga-orders-updated'));
    } catch (cause) {
      setConfirmationError(cause instanceof Error ? cause.message : 'Could not confirm order.');
    } finally {setConfirming(false);}
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-sm text-white/50">{cerigaTranslate("interface.text_5a5f7fb48c3b602b")}</div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-white">
        <div className="text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-white/20" />
          <h2 className="text-lg font-semibold">{cerigaTranslate("interface.text_30658cae73f22632")}</h2>
          <p className="mt-1 text-sm text-white/45">{error || cerigaTranslate("interface.text_24ad8a24141226f0")}</p>
          <Button asChild className="mt-4 h-9 bg-[#CC2D24] text-xs hover:bg-[#CC2D24]/90">
            <Link to="/orders">{cerigaTranslate("orders.back")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <OrderDetailShell order={order}>
      {error && <p role="alert" className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-500/30 p-3 text-sm text-red-300">{cerigaTranslateLabel(error)}</p>}
      {order.status === 'customer_confirmation' && <section className="mx-auto mb-4 max-w-3xl rounded border border-white/20 p-4">
        <h2 className="font-semibold">{cerigaTranslate("interface.text_6af32d9c6615cd57")}</h2>
        <p className="my-2 text-sm">{order.garmentType}{order.specifications?.fabricType && ' · ' + order.specifications.fabricType}{order.specifications?.colorName && ' · ' + order.specifications.colorName}</p>
        {order.orderQuantities && <OrderQuantitiesSummary plan={order.orderQuantities} />}
        {order.delivery && <p className="my-2 text-sm">{[order.delivery.address1,order.delivery.city,order.delivery.postcode,order.delivery.country].filter(Boolean).join(', ')}</p>}
        <Button disabled={confirming} onClick={() => void confirm()}>{confirming?cerigaTranslate("interface.text_b9378c00f9db9004"):cerigaTranslate("interface.text_01b58d1fdc4ac3db")}</Button>
        {confirmationError && <p role="alert">{cerigaTranslateLabel(confirmationError)}</p>}
      </section>}
      {order.status !== 'customer_confirmation' && <OrderDetailContent order={order} />}
      <Fragment key={order.id}>
        {isSupabaseConfigured && order.kind === 'production' && <OrderCommunication orderId={order.id} scope="customer" />}
        <CustomerRepeatOrder order={order} />
      </Fragment>
    </OrderDetailShell>
  );
}
