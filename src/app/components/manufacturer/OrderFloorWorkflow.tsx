import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
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
import { LEGACY_FACTORY_CURRENCY } from '../../lib/currency';

/** Materials match + book shipment — compact workflow on manufacturer order detail. */
export function OrderFloorWorkflow({
  order,
  onBooked,
}: {
  order: FactoryOrder;
  onBooked?: () => void;
}) {
  useCerigaTranslation();

  useCurrency();
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
      toast.error(cerigaTranslate("interface.text_19544e629fc34544"));
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
      shippingCurrency: LEGACY_FACTORY_CURRENCY,
      eta: undefined,
    });
    setConfirmOpen(false);
    onBooked?.();
    toast.success(cerigaTranslate("interface.text_8f6c9a62ad30191e"));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_a3b31cb2ea807e1d")}</h2>
          </div>
          <Link
            to="/manufacturer/materials"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >{cerigaTranslate("interface.text_d5cade7ef3191690")}</Link>
        </div>
        <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_084845e4a9b84c27")}{" "}<span className="text-white/55">{order.fabricNotes}</span>
        </p>
        {matches.length === 0 ? (
          <p className="mt-3 text-[12px] text-white/40">{cerigaTranslate("interface.text_2ff7871a6759eacf")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {matches.map(({ material, reasons, lowStock }) => (
              <li
                key={material.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#252528] bg-black/25 px-3 py-2.5"
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
                      <AlertTriangle className="h-3 w-3" />{cerigaTranslate("interface.text_f793de205ead5ac3")}</p>
                  ) : (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-emerald-300/80">
                      <CheckCircle2 className="h-3 w-3" />{cerigaTranslate("interface.text_565339bc4d33d728")}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_88bf554a928a577b")}</h2>
          </div>
          <Link
            to="/manufacturer/shipping"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >{cerigaTranslate("interface.text_2dfbed90b2d4b0d9")}</Link>
        </div>

        {existing ? (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-[12px]">
            <p className="flex items-center gap-2 font-medium text-emerald-100">
              <Truck className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_6a06f2896d1b0f18")}</p>
            <p className="mt-1 text-emerald-100/70">
              {getShippingCarrier(existing.carrierId)?.name} · {cerigaTranslateLabel(SHIPPING_MODE_LABEL[existing.mode])} ·{' '}
              {existing.incoterm}
              {existing.trackingNumber ? (
                <span className="mt-1 block font-mono text-emerald-200">
                  {existing.trackingNumber}
                </span>
              ) : null}
            </p>
          </div>
        ) : enabledCarriers.length === 0 ? (
          <p className="mt-3 text-[12px] text-amber-200/90">{cerigaTranslate("interface.text_b5c61beeeb1d06d8")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_271c535631ff3f3d")}</Label>
                <Select value={carrierId} onValueChange={setCarrierId}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    {enabledCarriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_5e23ec6a300dc60a")}</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as ShippingMode)}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    {ALL_SHIPPING_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {cerigaTranslateLabel(SHIPPING_MODE_LABEL[m])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_766608a70c8b0813")}</Label>
                <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
                  <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#252528] bg-[#161618] text-white">
                    {ALL_INCOTERMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {cerigaTranslateLabel(INCOTERM_LABEL[t])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_ff9a823a09d27126")}</Label>
                <Input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="mt-1 border-white/15 bg-white/5 font-mono text-white"
                  placeholder={cerigaTranslate("interface.text_9a71f391e7999450")}
                />
              </div>
            </div>
            <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_77d3e22f2c23072e")}{" "}{displayMoney(quoteCents,LEGACY_FACTORY_CURRENCY)}{" "}{cerigaTranslate("interface.text_105281449127556d")}{" "}{order.deliveryCity},{' '}
              {order.deliveryCountry}
            </p>
            <Button
              className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
              onClick={() => setConfirmOpen(true)}
            >{cerigaTranslate("interface.text_88bf554a928a577b")}</Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={cerigaTranslate("interface.text_c68366b18a3708f6")}
        description={cerigaTranslate("interface.text_60547fd561214951",{value0:(order.id),value1:(getShippingCarrier(carrierId)?.name ?? cerigaTranslate("interface.text_5803587e6791c119")),value2:(SHIPPING_MODE_LABEL[mode]),value3:(incoterm)})}
        confirmLabel={cerigaTranslate("interface.text_88bf554a928a577b")}
        onConfirm={book}
      />
    </div>
  );
}
