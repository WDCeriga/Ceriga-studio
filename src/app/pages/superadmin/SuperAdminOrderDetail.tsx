import { Link, useParams } from 'react-router';
import { ArrowLeft, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SUPER_ORDERS, STATUS_LABELS, formatMoney } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useState } from 'react';

export function SuperAdminOrderDetail() {
  const { id } = useParams();
  const order = MOCK_SUPER_ORDERS.find((o) => o.id === id);
  const [tracking, setTracking] = useState(order?.trackingNumber ?? '');
  const [finalCents, setFinalCents] = useState(order?.finalPriceCents != null ? String(order.finalPriceCents / 100) : '');

  if (!order) {
    return (
      <div className="text-white/60">
        Order not found.{' '}
        <Link to="/superadmin/orders" className="text-[#CC2D24] hover:underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/superadmin/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Orders
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-xl text-white sm:text-2xl">{order.id}</h1>
            <p className="mt-1 text-sm text-white/45">{order.productName}</p>
          </div>
          <BadgePill status={order.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Customer & delivery</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/45">Name</dt>
              <dd className="text-white">{order.userName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/45">Email</dt>
              <dd className="break-all text-white/90">{order.userEmail}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/45">Ship to</dt>
              <dd className="text-right text-white/90">
                {order.deliveryCity}, {order.deliveryCountry}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-white/38">
            Full builder spec, uploaded tech pack PDFs, and line sheets will render here from your backend.
          </p>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Package className="h-4 w-4 text-[#CC2D24]" />
            Pricing (superadmin)
          </h2>
          <p className="mt-2 text-xs text-white/45">
            Manufacturer quote pre-fills here. Adjust margin, tax, and final price before sending to the brand.
          </p>
          {order.manufacturerQuoteCents != null && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70">
              Manufacturer quote:{' '}
              <span className="font-medium text-white">{formatMoney(order.manufacturerQuoteCents)}</span>
            </div>
          )}
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-white/55">Final price (£)</Label>
              <Input
                value={finalCents}
                onChange={(e) => setFinalCents(e.target.value)}
                className="border-white/15 bg-white/5 text-white"
                placeholder="1045.00"
              />
            </div>
            <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={() => toast.success('Mock: pricing saved')}>
              Save pricing
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Status & fulfilment</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/55">Order status</Label>
            <Select defaultValue={order.status}>
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-white/15 text-white" onClick={() => toast.success('Mock: status updated')}>
              Update status
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-white/55">
              <Truck className="h-3.5 w-3.5" />
              Tracking number (after paid)
            </Label>
            <Input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="border-white/15 bg-white/5 font-mono text-sm text-white"
              placeholder="Carrier tracking ID"
            />
            <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/15" onClick={() => toast.success('Mock: tracking saved')}>
              Save tracking
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function BadgePill({ status }: { status: keyof typeof STATUS_LABELS }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/75">
      {STATUS_LABELS[status]}
    </span>
  );
}
