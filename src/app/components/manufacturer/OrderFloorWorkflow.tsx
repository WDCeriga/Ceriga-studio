import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Boxes, CheckCircle2, Ship, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_INCOTERMS,
  ALL_SHIPPING_MODES,
  INCOTERM_LABEL,
  SHIPPING_MODE_LABEL,
  createFactoryShipment,
  estimateShippingQuoteCents,
  formatFactoryMoney,
  getFactoryShipmentForOrder,
  getFactoryShippingPrefs,
  getShippingCarrier,
  listEnabledShippingCarriers,
  listFactoryMaterials,
  type FactoryOrder,
  type Incoterm,
  type ShippingMode,
} from '../../data/manufacturerPortalMock';
import { matchMaterialsToOrder } from '../../data/materialMatch';
import { ConfirmDialog } from '../ConfirmDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';

/** Materials match + book shipment — compact workflow on manufacturer order detail. */
export function OrderFloorWorkflow({
  order,
  onBooked,
}: {
  order: FactoryOrder;
  onBooked?: () => void;
}) {
  const matches = useMemo(
    () =>
      matchMaterialsToOrder(
        listFactoryMaterials(),
        order.fabricNotes,
        order.specialRequirements,
      ),
    [order.id, order.fabricNotes, order.specialRequirements],
  );

  const existing = getFactoryShipmentForOrder(order.id);
  const enabledCarriers = listEnabledShippingCarriers();
  const prefs = getFactoryShippingPrefs();

  const [carrierId, setCarrierId] = useState(
    existing?.carrierId ?? prefs.defaultCarrierId ?? enabledCarriers[0]?.id ?? '',
  );
  const [mode, setMode] = useState<ShippingMode>(
    existing?.mode ?? prefs.defaultMode ?? 'express',
  );
  const [incoterm, setIncoterm] = useState<Incoterm>(
    existing?.incoterm ?? prefs.defaultIncoterm ?? 'DDP',
  );
  const [tracking, setTracking] = useState(existing?.trackingNumber ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const quoteCents = estimateShippingQuoteCents({
    mode,
    incoterm,
    units: order.capacityUnitsEstimate || 100,
  });

  const book = () => {
    if (!carrierId) {
      toast.error('Enable a shipping carrier first');
      return;
    }
    createFactoryShipment({
      orderId: order.id,
      brandName: order.brandName,
      carrierId,
      mode,
      incoterm,
      trackingNumber: tracking.trim() || undefined,
      status: tracking.trim() ? 'in_transit' : 'booked',
      origin: 'Manchester, UK',
      destination: `${order.deliveryCity}, ${order.deliveryCountry}`,
      shippingQuoteCents: quoteCents,
      eta: undefined,
    });
    setConfirmOpen(false);
    onBooked?.();
    toast.success('Shipment booked — appears under Shipping → Tracking');
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">Materials check</h2>
          </div>
          <Link
            to="/manufacturer/materials"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >
            Stock
          </Link>
        </div>
        <p className="mt-1 text-[11px] text-white/40">
          Matched against: <span className="text-white/55">{order.fabricNotes}</span>
        </p>
        {matches.length === 0 ? (
          <p className="mt-3 text-[12px] text-white/40">
            No stock matches — add materials or update fabric notes.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {matches.map(({ material, reasons, lowStock }) => (
              <li
                key={material.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5"
              >
                <div>
                  <p className="text-[13px] font-medium text-white">{material.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {reasons.join(' · ') || material.kind}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'text-[12px] tabular-nums font-medium',
                      lowStock ? 'text-amber-300' : 'text-white/70',
                    )}
                  >
                    {material.quantity} {material.unit}
                  </p>
                  {lowStock ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      Low
                    </p>
                  ) : (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-emerald-300/80">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">Book shipment</h2>
          </div>
          <Link
            to="/manufacturer/shipping"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >
            Carriers
          </Link>
        </div>

        {existing ? (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-[12px]">
            <p className="flex items-center gap-2 font-medium text-emerald-100">
              <Truck className="h-3.5 w-3.5" />
              Already booked
            </p>
            <p className="mt-1 text-emerald-100/70">
              {getShippingCarrier(existing.carrierId)?.name} · {SHIPPING_MODE_LABEL[existing.mode]} ·{' '}
              {existing.incoterm}
              {existing.trackingNumber ? (
                <span className="mt-1 block font-mono text-emerald-200">
                  {existing.trackingNumber}
                </span>
              ) : null}
            </p>
          </div>
        ) : enabledCarriers.length === 0 ? (
          <p className="mt-3 text-[12px] text-amber-200/90">
            Enable a carrier under Shipping before booking.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] text-white/40">Carrier</Label>
                <Select value={carrierId} onValueChange={setCarrierId}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                    {enabledCarriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as ShippingMode)}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                    {ALL_SHIPPING_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {SHIPPING_MODE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Incoterm</Label>
                <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                    {ALL_INCOTERMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {INCOTERM_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Tracking (optional)</Label>
                <Input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="mt-1 border-white/15 bg-white/5 font-mono text-white"
                  placeholder="Carrier ID"
                />
              </div>
            </div>
            <p className="text-[11px] text-white/40">
              Est. shipping {formatFactoryMoney(quoteCents)} · to {order.deliveryCity},{' '}
              {order.deliveryCountry}
            </p>
            <Button
              className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
              onClick={() => setConfirmOpen(true)}
            >
              Book shipment
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Book this shipment?"
        description={`Creates a tracking row for ${order.id} with ${getShippingCarrier(carrierId)?.name ?? 'carrier'} (${SHIPPING_MODE_LABEL[mode]}, ${incoterm}).`}
        confirmLabel="Book shipment"
        onConfirm={book}
      />
    </div>
  );
}
