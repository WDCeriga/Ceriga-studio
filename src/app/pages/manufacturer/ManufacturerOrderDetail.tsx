import { formatQuantityLine as cerigaQuantityLine } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import { AssignedOrderDetails } from '../../components/manufacturer/AssignedOrderDetails';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Ban,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  Send,
  Shirt,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FACTORY_STATUS_LABEL,
  INCOTERM_LABEL,
  SHIPPING_MODE_LABEL,
  estimateShippingQuoteCents,
  formatFactoryDate,
  formatFactoryMoney,
  getFactoryCarrierSetup,
  getFactoryOrder,
  getFactoryShippingPrefs,
  getShippingCarrier,
  listEnabledShippingCarriers,
  rejectFactoryOrder,
  shippingModeToDeliveryOption,
  submitFactoryQuote,
  updateFactoryOrder,
  actingHasPermission,
  type FactoryOrder,
  type FactoryQuoteTierDraft,
  type Incoterm,
  type ShippingMode,
} from '../../data/manufacturerPortalMock';
import { builderTechPackUrl, formatDeliveryLines } from '../../data/orderDelivery';
import { formatOrderQuantitiesSummary, sumBreakdown } from '../../data/orderQuantities';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { OrderFloorWorkflow } from '../../components/manufacturer/OrderFloorWorkflow';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';
import { currencySymbol, LEGACY_FACTORY_CURRENCY, type Currency } from '../../lib/currency';
import { useManufacturerPricing } from '../../data/manufacturerPricing';

export function draftTiersFromOrder(order: FactoryOrder, preferredCurrency: Currency = LEGACY_FACTORY_CURRENCY): FactoryQuoteTierDraft[] {
  const prefs = getFactoryShippingPrefs();
  const defaultCarrier = prefs.defaultCarrierId;
  const defaultMode = prefs.defaultMode ?? 'express';
  const defaultIncoterm = prefs.defaultIncoterm ?? 'DDP';

  const withShipping = (
    tier: FactoryQuoteTierDraft,
    mode: ShippingMode,
  ): FactoryQuoteTierDraft => {
    const shippingQuoteCents =
      tier.shippingQuoteCents ??
      estimateShippingQuoteCents({
        mode: tier.shippingMode ?? mode,
        incoterm: tier.incoterm ?? defaultIncoterm,
        units: tier.totalUnits,
      });
    return {
      ...tier,
      currency: tier.currency ?? (tier.factoryCostCents > 0 || order.quotedAt ? undefined : preferredCurrency),
      shippingCurrency: tier.shippingCurrency ?? LEGACY_FACTORY_CURRENCY,
      shippingCarrierId: tier.shippingCarrierId ?? defaultCarrier,
      shippingMode: tier.shippingMode ?? mode,
      incoterm: tier.incoterm ?? defaultIncoterm,
      deliveryOptionId: shippingModeToDeliveryOption(tier.shippingMode ?? mode),
      shippingQuoteCents,
    };
  };

  if (order.quoteTiers?.length) {
    return order.quoteTiers.map((t) =>
      withShipping(
        { ...t },
        t.shippingMode ?? (t.kind === 'sample' ? 'express' : 'sea'),
      ),
    );
  }

  const sampleUnits = sumBreakdown(order.orderQuantities.sample.bySize);
  const tiers: FactoryQuoteTierDraft[] = [
    withShipping(
      {
        id: 'sample',
        kind: 'sample',
        label: 'Sample',
        totalUnits: sampleUnits || 6,
        factoryCostCents: 0,
        deliveryOptionId: 'express',
        leadTimeDays: 12,
      },
      'express',
    ),
  ];
  order.orderQuantities.bulkRuns.forEach((run, i) => {
    const units = run.targetTotal ?? sumBreakdown(run.bySize);
    if (units <= 0) return;
    tiers.push(
      withShipping(
        {
          id: `bulk-${i + 1}`,
          kind: 'bulk',
          label: `Bulk ${i + 1}`,
          totalUnits: units,
          factoryCostCents: 0,
          deliveryOptionId: 'standard',
          leadTimeDays: 21 + i * 2,
        },
        i === 0 ? 'sea' : 'air',
      ),
    );
  });
  return tiers;
}

export function ManufacturerOrderDetail(){
  useCurrency();const {id}=useParams();return isSupabaseConfigured&&id?<AssignedOrderDetails id={id}/>:<ManufacturerOrderDetailPreview/>;}
function ManufacturerOrderDetailPreview() {
  useCerigaTranslation();

  useCurrency();
  const { currency, ready: currencyReady, error: currencyError } = useManufacturerPricing();
  const { id } = useParams<{ id: string }>();
  const [version, setVersion] = useState(0);
  const order = useMemo(() => (id ? getFactoryOrder(id) : undefined), [id, version]);
  const refresh = () => setVersion((n) => n + 1);

  const [tiers, setTiers] = useState<FactoryQuoteTierDraft[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [shipCostInputs, setShipCostInputs] = useState<Record<string, string>>({});
  const [quoteConfirmOpen, setQuoteConfirmOpen] = useState(false);
  const enabledCarriers = listEnabledShippingCarriers();
  const draftVersion = useRef('');

  useEffect(() => {
    if (!order) return;
    const revision = `${order.id}:${version}`;
    if (draftVersion.current === revision && Object.values(costInputs).some(value => value.trim())) return;
    draftVersion.current = revision;
    const drafted = draftTiersFromOrder(order, currency);
    setTiers(drafted);
    const init: Record<string, string> = {};
    const shipInit: Record<string, string> = {};
    for (const t of drafted) {
      init[t.id] = t.factoryCostCents > 0 ? (t.factoryCostCents / 100).toFixed(2) : '';
      shipInit[t.id] =
        t.shippingQuoteCents && t.shippingQuoteCents > 0
          ? (t.shippingQuoteCents / 100).toFixed(2)
          : '';
    }
    setCostInputs(init);
    setShipCostInputs(shipInit);
  }, [order?.id, version, currency]);

  if (!id || !order) {
    return <Navigate to="/manufacturer/orders" replace />;
  }

  const latest = order;
  const qtyLines = formatOrderQuantitiesSummary(latest.orderQuantities, cerigaQuantityLine).map(cerigaTranslateLabel);
  const canAct = ['new', 'reviewing', 'clarifying'].includes(latest.status);
  /** Only decline locks pricing — quoted / in production / completed stay editable. */
  const readOnlyQuote = latest.status === 'rejected';
  const isQuoteUpdate = ['quoted', 'in_production', 'completed'].includes(latest.status);
  const delivery = latest.delivery;
  const techPack = latest.techPack;

  const patchTier = (tierId: string, patch: Partial<FactoryQuoteTierDraft>) => {
    setTiers((prev) => prev.map((t) => (t.id === tierId ? { ...t, ...patch } : t)));
  };

  const startReview = () => {
    updateFactoryOrder(latest.id, { status: 'reviewing' });
    refresh();
    toast.message(cerigaTranslate("interface.text_7cf9963207abe30f"));
  };

  const requestSubmitQuote = () => {
    if (!currencyReady || (currencyError && !order.quoteTiers?.length)) {
      toast.error(cerigaTranslate("interface.text_eae2a7e1b78ed05a"));
      return;
    }
    for (const tier of tiers) {
      const n = Number(costInputs[tier.id]);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error(cerigaTranslate("interface.text_ab56cc023678559c",{value0:(tier.label)}));
        return;
      }
    }
    setQuoteConfirmOpen(true);
  };

  const submitQuote = () => {
    if (!actingHasPermission('quote')) {
      toast.error(cerigaTranslate("interface.text_f907e097ab8ee17e"));
      return;
    }
    const next: FactoryQuoteTierDraft[] = [];
    for (const tier of tiers) {
      const n = Number(costInputs[tier.id]);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error(cerigaTranslate("interface.text_ab56cc023678559c",{value0:(tier.label)}));
        return;
      }
      const shipN = Number(shipCostInputs[tier.id]);
      const shippingQuoteCents =
        Number.isFinite(shipN) && shipN >= 0 ? Math.round(shipN * 100) : tier.shippingQuoteCents;
      next.push({
        ...tier,
        factoryCostCents: Math.round(n * 100),
        shippingQuoteCents,
        deliveryOptionId: shippingModeToDeliveryOption(tier.shippingMode ?? 'express'),
      });
    }
    submitFactoryQuote(latest.id, next);
    setTiers(next);
    refresh();
    toast.success(
      cerigaTranslateLabel(isQuoteUpdate
        ? cerigaTranslate("interface.text_1bea9a99fd9e777a")
        : cerigaTranslate("interface.text_d97cad69f3968539")),
    );
  };

  const confirmReject = () => {
    if (!actingHasPermission('decline')) {
      toast.error(cerigaTranslate("interface.text_7042c4073f87d755"));
      return;
    }
    if (!rejectReason.trim()) {
      toast.error(cerigaTranslate("interface.text_5a97cf9ae47af7c6"));
      return;
    }
    rejectFactoryOrder(latest.id, rejectReason);
    setRejectOpen(false);
    refresh();
    toast.success(cerigaTranslate("interface.text_2a82f9eea9ae4ef4"));
  };

  return (
    <div className="space-y-6">
      <Link
        to="/manufacturer/orders"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/45 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_94835ea2fcf775cd")}</Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#CC2D24]">
            {cerigaTranslateLabel(FACTORY_STATUS_LABEL[latest.status])}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {latest.productName}
          </h1>
          <p className="mt-1 text-sm text-white/45">
            {latest.brandName} · {latest.id}{" "}{cerigaTranslate("interface.text_56f73a55c5805499")}{" "}{formatFactoryDate(latest.dueQuoteBy)}
          </p>
        </div>
        {canAct ? (
          <div className="flex flex-wrap gap-2">
            {latest.status === 'new' ? (
              <Button
                variant="outline"
                className="border-white/15 text-white hover:bg-white/5"
                onClick={startReview}
              >{cerigaTranslate("interface.text_1cf5ecdbaaa0742e")}</Button>
            ) : null}
            <Button
              variant="outline"
              className="border-red-500/30 text-red-200 hover:bg-red-500/10"
              onClick={() => setRejectOpen((v) => !v)}
            >
              <Ban className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_b7e4724ccd6aac80")}</Button>
          </div>
        ) : null}
      </div>

      {rejectOpen ? (
        <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-5">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_5ea3c0d8a1dc98be")}</h2>
          <p className="mt-1 text-[12px] text-white/45">{cerigaTranslate("interface.text_ff1604a5fd459e90")}</p>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="mt-3 min-h-[90px] border-white/15 bg-black/30 text-white"
            placeholder={cerigaTranslate("interface.text_79401bb9971077ff")}
          />
          <div className="mt-3 flex gap-2">
            <Button className="bg-red-600 hover:bg-red-500" onClick={confirmReject}>{cerigaTranslate("interface.text_73220c091fc01ae8")}</Button>
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white/5"
              onClick={() => setRejectOpen(false)}
            >{cerigaTranslate("common.cancel")}</Button>
          </div>
        </section>
      ) : null}

      {latest.rejectReason ? (
        <div className="rounded-xl border border-[#252528] bg-white/[0.03] px-4 py-3 text-sm text-white/55">{cerigaTranslate("interface.text_85be99c92549ca81")}{" "}{latest.rejectReason}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_ac40ae1e8d41291c")}</h2>
            <dl className="mt-4 space-y-3 text-[12px]">
              <div className="flex items-start gap-2 text-white/60">
                <Shirt className="mt-0.5 h-3.5 w-3.5 text-white/35" />
                <span>
                  {latest.garmentType} · {latest.fabricNotes}
                </span>
              </div>
            </dl>
            {latest.specialRequirements.length > 0 ? (
              <ul className="mt-4 space-y-1 border-t border-[#252528] pt-3 text-[12px] text-white/50">
                {latest.specialRequirements.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            ) : null}
          </section>

          {techPack ? (
            <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">{cerigaTranslate("adminOrders.techpack")}</h2>
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#252528] bg-white/[0.04]">
                  <FileText className="h-4 w-4 text-white/50" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{techPack.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {techPack.garmentType}
                    {techPack.pageCount ? cerigaTranslate("interface.text_cbb67f1b26438459",{value0:(techPack.pageCount)}) : ''}
                    {techPack.exportFormat === 'pdf_bundle' ? cerigaTranslate("interface.text_53867135d9c4c971") : cerigaTranslate("interface.text_99886b03b79d2d21")}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                    asChild
                  >
                    <a href={builderTechPackUrl(techPack)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_d97ec00f47fd96a9")}</a>
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_f66ab7efffef70b4")}</h2>
            <ul className="mt-3 space-y-1.5 text-[12px] text-white/60">
              {qtyLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          {delivery ? (
            <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#CC2D24]" />
                <h2 className="text-sm font-semibold text-white">{cerigaTranslate("nav.delivery")}</h2>
              </div>
              <dl className="mt-4 space-y-3 text-[12px]">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_2b5c3d26721ae9c3")}</dt>
                  <dd className="mt-1 text-white/80">
                    {delivery.firstName} {delivery.lastName}
                  </dd>
                  <dd className="mt-0.5 text-white/50">{delivery.email}</dd>
                  <dd className="mt-1 flex items-center gap-1.5 text-white/50">
                    <Phone className="h-3 w-3" />
                    {delivery.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_56ef8f20955f2564")}</dt>
                  <dd className="mt-1 space-y-0.5 text-white/80">
                    {formatDeliveryLines(delivery).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </dd>
                </div>
                {delivery.instructions ? (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_4e80e96365cc0517")}</dt>
                    <dd className="mt-1 text-white/60">{delivery.instructions}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <OrderFloorWorkflow order={latest} onBooked={refresh} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_9edcdeb1cd3fb33e")}</h2>
              <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_0c052f461b3d2b4b")}{' '}
                <Link to="/manufacturer/shipping" className="text-[#CC2D24] hover:underline">{cerigaTranslate("nav.shipping")}</Link>
                .{isQuoteUpdate ? cerigaTranslate("interface.text_df2127523099debb") : ''}
              </p>
            </div>

            {enabledCarriers.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-[12px] text-amber-100/90">{cerigaTranslate("interface.text_e1ac10a3e6f41c85")}{' '}
                <Link to="/manufacturer/shipping" className="font-medium underline">{cerigaTranslate("interface.text_588cb2411fd64653")}</Link>{' '}{cerigaTranslate("interface.text_3719f76cb3b8dc4a")}</div>
            ) : null}

            <div className="mt-5 space-y-3">
              <p className="text-xs text-white/45">{cerigaTranslate("interface.text_43121327904e6454")}{" "}{currency}{cerigaTranslate("interface.text_c1c0a6407c1f5d66")}</p>
              {tiers.map((tier) => {
                const carrierSetup = tier.shippingCarrierId
                  ? getFactoryCarrierSetup(tier.shippingCarrierId)
                  : undefined;
                const modeOptions =
                  carrierSetup?.enabledModes ??
                  (['express', 'air', 'sea', 'rail'] as ShippingMode[]);
                const incotermOptions =
                  carrierSetup?.enabledIncoterms ?? (['DDP', 'FOB', 'EXW', 'CIF'] as Incoterm[]);

                return (
                <div
                  key={tier.id}
                  className="rounded-xl border border-[#252528] bg-black/25 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{cerigaTranslateLabel(tier.label)}</p>
                      <p className="text-[11px] text-white/40">{tier.totalUnits}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase',
                        tier.kind === 'sample'
                          ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                          : 'border-amber-500/30 bg-[#CC2D24]/10 text-red-200',
                      )}
                    >
                      {tier.kind}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_156d7ab94409fdbc")}{currencySymbol(tier.currency ?? LEGACY_FACTORY_CURRENCY)} · {tier.currency ?? LEGACY_FACTORY_CURRENCY})</Label>
                      <Input
                        value={costInputs[tier.id] ?? ''}
                        disabled={readOnlyQuote || !currencyReady || Boolean(currencyError && !order.quoteTiers?.length)}
                        onChange={(e) =>
                          setCostInputs((prev) => ({ ...prev, [tier.id]: e.target.value }))
                        }
                        className="mt-1 border-white/15 bg-white/5 text-white tabular-nums disabled:opacity-50"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_1d2b395fd02249bc")}</Label>
                      <Select
                        value={tier.shippingCarrierId ?? ''}
                        disabled={readOnlyQuote || enabledCarriers.length === 0}
                        onValueChange={(v) => {
                          const setup = getFactoryCarrierSetup(v);
                          const mode = setup?.enabledModes[0] ?? 'express';
                          const incoterm = setup?.enabledIncoterms[0] ?? 'DDP';
                          const shippingQuoteCents = estimateShippingQuoteCents({
                            mode,
                            incoterm,
                            units: tier.totalUnits,
                          });
                          patchTier(tier.id, {
                            shippingCarrierId: v,
                            shippingMode: mode,
                            incoterm,
                            deliveryOptionId: shippingModeToDeliveryOption(mode),
                            shippingQuoteCents,
                          });
                          setShipCostInputs((prev) => ({
                            ...prev,
                            [tier.id]: (shippingQuoteCents / 100).toFixed(2),
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white disabled:opacity-50">
                          <SelectValue placeholder={cerigaTranslate("interface.text_69f398120ac0d037")} />
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
                      <Select
                        value={tier.shippingMode ?? 'express'}
                        disabled={readOnlyQuote}
                        onValueChange={(v) => {
                          const mode = v as ShippingMode;
                          const incoterm = tier.incoterm ?? 'DDP';
                          const shippingQuoteCents = estimateShippingQuoteCents({
                            mode,
                            incoterm,
                            units: tier.totalUnits,
                          });
                          patchTier(tier.id, {
                            shippingMode: mode,
                            deliveryOptionId: shippingModeToDeliveryOption(mode),
                            shippingQuoteCents,
                          });
                          setShipCostInputs((prev) => ({
                            ...prev,
                            [tier.id]: (shippingQuoteCents / 100).toFixed(2),
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white disabled:opacity-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#252528] bg-[#161618] text-white">
                          {modeOptions.map((m) => (
                            <SelectItem key={m} value={m}>
                              {cerigaTranslateLabel(SHIPPING_MODE_LABEL[m])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_766608a70c8b0813")}</Label>
                      <Select
                        value={tier.incoterm ?? 'DDP'}
                        disabled={readOnlyQuote}
                        onValueChange={(v) => {
                          const incoterm = v as Incoterm;
                          const mode = tier.shippingMode ?? 'express';
                          const shippingQuoteCents = estimateShippingQuoteCents({
                            mode,
                            incoterm,
                            units: tier.totalUnits,
                          });
                          patchTier(tier.id, { incoterm, shippingQuoteCents });
                          setShipCostInputs((prev) => ({
                            ...prev,
                            [tier.id]: (shippingQuoteCents / 100).toFixed(2),
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white disabled:opacity-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#252528] bg-[#161618] text-white">
                          {incotermOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {cerigaTranslateLabel(INCOTERM_LABEL[t])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_c8f85a2c03c8e607")}{currencySymbol(tier.shippingCurrency ?? LEGACY_FACTORY_CURRENCY)} · {tier.shippingCurrency ?? LEGACY_FACTORY_CURRENCY})</Label>
                      <p className="text-[10px] text-white/40">{cerigaTranslate("interface.text_d053ff9253364c56")}</p>
                      <Input
                        value={shipCostInputs[tier.id] ?? ''}
                        disabled={readOnlyQuote}
                        onChange={(e) =>
                          setShipCostInputs((prev) => ({ ...prev, [tier.id]: e.target.value }))
                        }
                        className="mt-1 border-white/15 bg-white/5 text-white tabular-nums disabled:opacity-50"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_e654c926e10dd296")}</Label>
                      <Input
                        type="number"
                        min={1}
                        disabled={readOnlyQuote}
                        value={tier.leadTimeDays}
                        onChange={(e) =>
                          patchTier(tier.id, { leadTimeDays: Number(e.target.value) || 0 })
                        }
                        className="mt-1 border-white/15 bg-white/5 text-white tabular-nums disabled:opacity-50"
                      />
                    </div>
                  </div>
                  {tier.shippingCarrierId ? (
                    <p className="mt-2 text-[11px] text-white/35">
                      {getShippingCarrier(tier.shippingCarrierId)?.name}
                      {tier.shippingMode ? ` · ${SHIPPING_MODE_LABEL[tier.shippingMode]}` : ''}
                      {tier.incoterm ? ` · ${tier.incoterm}` : ''}
                    </p>
                  ) : null}
                  {tier.factoryCostCents > 0 || Number(costInputs[tier.id]) > 0 ? (
                    <p className="mt-1 text-[11px] text-white/35">{cerigaTranslate("interface.text_c4b97afe643da8e9")}{' '}
                      {displayMoney(tier.factoryCostCents || Math.round((Number(costInputs[tier.id]) || 0) * 100),tier.currency ?? LEGACY_FACTORY_CURRENCY)}
                      {Number(shipCostInputs[tier.id]) > 0
                        ? cerigaTranslate("interface.text_4179a36231dd2f47",{value0:(displayMoney(Math.round(Number(shipCostInputs[tier.id]) * 100),tier.shippingCurrency ?? LEGACY_FACTORY_CURRENCY))})
                        : ''}{' '}{cerigaTranslate("interface.text_aab00a04345ec568")}</p>
                  ) : null}
                </div>
              );
              })}
            </div>

            {!readOnlyQuote ? (
              <Button
                className="mt-5 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                onClick={requestSubmitQuote}
              >
                <Send className="mr-2 h-4 w-4" />
                {isQuoteUpdate ? cerigaTranslate("interface.text_399da5457260fb81") : cerigaTranslate("interface.text_21d70b3e15b57b9c")}
              </Button>
            ) : null}
            {isQuoteUpdate && latest.quotedAt ? (
              <p className="mt-3 text-[12px] text-emerald-200/80">{cerigaTranslate("interface.text_b6816e74adbe8e76")}{" "}{formatFactoryDate(latest.quotedAt)}{" "}{cerigaTranslate("interface.text_f9a6147a45e4a9af")}</p>
            ) : null}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={quoteConfirmOpen}
        onOpenChange={setQuoteConfirmOpen}
        title={isQuoteUpdate ? cerigaTranslate("interface.text_5f0b9e16f944dd4c") : cerigaTranslate("interface.text_997e29276fb3fa97")}
        description={
          isQuoteUpdate
            ? cerigaTranslate("interface.plural_392563c7119bb67f",{value0:(tiers.length),value2:(latest.brandName),count:Number(tiers.length)})
            : cerigaTranslate("interface.plural_56106f0e2a06dc64",{value0:(tiers.length),value2:(latest.brandName),count:Number(tiers.length)})
        }
        confirmLabel={isQuoteUpdate ? cerigaTranslate("interface.text_399da5457260fb81") : cerigaTranslate("interface.text_7a58d9e6f7b74078")}
        onConfirm={submitQuote}
      />
    </div>
  );
}
