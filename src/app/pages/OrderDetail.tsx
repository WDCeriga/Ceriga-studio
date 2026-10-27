import { Link, useParams } from 'react-router';
import { Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  OrderDetailContent,
  OrderDetailShell,
} from '../components/orders/OrderDetailViews';
import { useUserOrder } from '../data/userOrders';

export function OrderDetail() {
  const { id } = useParams();
  const { order, loading, error } = useUserOrder(id);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-sm text-white/50">
        Loading order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-4 text-white">
        <div className="text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-white/20" />
          <h2 className="text-lg font-semibold">Order not found</h2>
          <p className="mt-1 text-sm text-white/45">{error || 'This order may have been removed or the link is wrong.'}</p>
          <Button asChild className="mt-4 h-9 bg-[#CC2D24] text-xs hover:bg-[#CC2D24]/90">
            <Link to="/orders">Back to orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <OrderDetailShell order={order}>
      {error && <p role="alert" className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-500/30 p-3 text-sm text-red-300">{error}</p>}
      <OrderDetailContent order={order} />
    </OrderDetailShell>
  );
}
