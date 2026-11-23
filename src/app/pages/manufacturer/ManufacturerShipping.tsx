import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import {FactoryShippingPanel}from '../../components/manufacturer/FactoryShippingPanel';
import { displayMoney,useCurrency } from '../../lib/accountCurrency';
import { useMemo, useState } from 'react';
import { QualityControlQueue } from '../../components/quality/QualityControlQueue';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { Link } from 'react-router';
import {
  ArrowUpRight,
  Check,
  Package,
  Plus,
  Ship,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_INCOTERMS,
  ALL_SHIPPING_MODES,
  CERIGA_SHIPPING_CARRIERS,
  INCOTERM_HELP,
  INCOTERM_LABEL,
  SHIPMENT_STATUS_LABEL,
  SHIPPING_MODE_LABEL,
  estimateShippingQuoteCents,
  formatFactoryMoney,
  getFactoryCarrierSetup,
  getFactoryShippingPrefs,
  getShippingCarrier,
  listFactoryShipments,
  requestShippingCarrierOnboard,
  setFactoryCarrierEnabled,
  setFactoryShippingDefaults,
  updateFactoryCarrierSetup,
  updateFactoryShipment,
  actingHasPermission,
  type Incoterm,
  type ShippingMode,
} from '../../data/manufacturerPortalMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
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
import { LEGACY_FACTORY_CURRENCY } from '../../lib/currency';
import { useManufacturerPricing } from '../../data/manufacturerPricing';

type TabId = 'carriers' | 'defaults' | 'quotes' | 'tracking' | 'onboard';

const TABS: { id: TabId; label: string }[] = [
  { id: 'carriers', label: 'Carriers' },
  { id: 'defaults', label: 'Quote defaults' },
  { id: 'quotes', label: 'Shipping quotes' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'onboard', label: 'Onboard carrier' },
];

const STATUS_STYLE: Record<string, string> = {
  quoted: 'bg-white/10 text-white/70',
  booked: 'bg-sky-500/15 text-sky-200',
  in_transit: 'bg-amber-500/15 text-amber-200',
  delivered: 'bg-emerald-500/15 text-emerald-300',
  exception: 'bg-[#CC2D24]/15 text-red-200',
};

function ManufacturerShippingPreview() {
  useCerigaTranslation();

  useCurrency();
  const { currency } = useManufacturerPricing();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<TabId>('carriers');
  const refresh = () => setTick((n) => n + 1);
  void tick;

  const prefs = getFactoryShippingPrefs();
  const shipments = listFactoryShipments();
  const enabledCount = prefs.carriers.filter((c) => c.enabled).length;

  const [pendingEnable, setPendingEnable] = useState<{
    carrierId: string;
    name: string;
    enable: boolean;
  } | null>(null);
  const [editCarrierId, setEditCarrierId] = useState<string | null>(null);
  const [accountRef, setAccountRef] = useState('');
  const [modes, setModes] = useState<ShippingMode[]>([]);
  const [incoterms, setIncoterms] = useState<Incoterm[]>([]);
  const [carrierNotes, setCarrierNotes] = useState('');
  const [saveCarrierOpen, setSaveCarrierOpen] = useState(false);

  const [defaultCarrierId, setDefaultCarrierId] = useState(prefs.defaultCarrierId ?? '');
  const [defaultMode, setDefaultMode] = useState<ShippingMode>(prefs.defaultMode ?? 'express');
  const [defaultIncoterm, setDefaultIncoterm] = useState<Incoterm>(prefs.defaultIncoterm ?? 'DDP');
  const [defaultsConfirmOpen, setDefaultsConfirmOpen] = useState(false);

  const [quoteMode, setQuoteMode] = useState<ShippingMode>('express');
  const [quoteIncoterm, setQuoteIncoterm] = useState<Incoterm>('DDP');
  const [quoteUnits, setQuoteUnits] = useState('250');
  const [quoteResult, setQuoteResult] = useState<number | null>(null);

  const [onboardName, setOnboardName] = useState('');
  const [onboardModes, setOnboardModes] = useState<ShippingMode[]>(['express']);
  const [onboardRegions, setOnboardRegions] = useState('UK, EU');
  const [onboardNotes, setOnboardNotes] = useState('');
  const [onboardConfirmOpen, setOnboardConfirmOpen] = useState(false);

  const [trackingEditId, setTrackingEditId] = useState<string | null>(null);
  const [trackingValue, setTrackingValue] = useState('');
  const [trackingConfirmOpen, setTrackingConfirmOpen] = useState(false);

  const enabledCarriers = useMemo(
    () =>
      prefs.carriers
        .filter((c) => c.enabled)
        .map((c) => getShippingCarrier(c.carrierId))
        .filter(Boolean),
    [prefs, tick],
  );

  const openEdit = (carrierId: string) => {
    const setup = getFactoryCarrierSetup(carrierId);
    const catalog = getShippingCarrier(carrierId);
    setEditCarrierId(carrierId);
    setAccountRef(setup?.accountRef ?? '');
    setModes(setup?.enabledModes ?? catalog?.supportedModes ?? []);
    setIncoterms(setup?.enabledIncoterms ?? catalog?.supportedIncoterms ?? []);
    setCarrierNotes(setup?.notes ?? '');
  };

  const requestSaveCarrier = () => {
    if (!editCarrierId) return;
    if (modes.length === 0 || incoterms.length === 0) {
      toast.error(cerigaTranslate("interface.text_1b2535bf707419f1"));
      return;
    }
    setSaveCarrierOpen(true);
  };

  const saveCarrier = () => {
    if (!actingHasPermission('edit_shipping')) {
      toast.error(cerigaTranslate("interface.text_70699aca83866ff8"));
      return;
    }
    if (!editCarrierId) return;
    updateFactoryCarrierSetup(editCarrierId, {
      accountRef: accountRef.trim() || undefined,
      enabledModes: modes,
      enabledIncoterms: incoterms,
      notes: carrierNotes.trim() || undefined,
      enabled: true,
    });
    setEditCarrierId(null);
    refresh();
    toast.success(cerigaTranslate("interface.text_94fc82f53a2ef098"));
  };

  const confirmEnableToggle = () => {
    if (!actingHasPermission('edit_shipping')) {
      toast.error(cerigaTranslate("interface.text_70699aca83866ff8"));
      return;
    }
    if (!pendingEnable) return;
    const catalog = getShippingCarrier(pendingEnable.carrierId);
    if (pendingEnable.enable && catalog?.status !== 'active') {
      toast.error(cerigaTranslate("interface.text_848d3125a40b6918"));
      setPendingEnable(null);
      return;
    }
    setFactoryCarrierEnabled(pendingEnable.carrierId, pendingEnable.enable);
    setPendingEnable(null);
    refresh();
    toast.success(
      cerigaTranslateLabel(pendingEnable.enable
        ? cerigaTranslate("interface.text_09f499f5410ceeea",{value0:(pendingEnable.name)})
        : cerigaTranslate("interface.text_ca830306af4ce862",{value0:(pendingEnable.name)})),
    );
  };

  const saveDefaults = () => {
    if (!actingHasPermission('edit_shipping')) {
      toast.error(cerigaTranslate("interface.text_70699aca83866ff8"));
      return;
    }
    setFactoryShippingDefaults({
      defaultCarrierId: defaultCarrierId || undefined,
      defaultMode,
      defaultIncoterm,
    });
    refresh();
    toast.success(cerigaTranslate("interface.text_0ed274ae57dfbe55"));
  };

  const runQuoteEstimate = () => {
    const units = Number(quoteUnits);
    if (!Number.isFinite(units) || units <= 0) {
      toast.error(cerigaTranslate("interface.text_1fd2eb8eec225a9e"));
      return;
    }
    setQuoteResult(
      estimateShippingQuoteCents({
        mode: quoteMode,
        incoterm: quoteIncoterm,
        units,
      }),
    );
  };

  const submitOnboard = () => {
    if (!onboardName.trim()) {
      toast.error(cerigaTranslate("interface.text_6e7a4a8f699997c2"));
      return;
    }
    const res = requestShippingCarrierOnboard({
      name: onboardName.trim(),
      modes: onboardModes,
      regions: onboardRegions,
      notes: onboardNotes,
    });
    setOnboardConfirmOpen(false);
    setOnboardName('');
    setOnboardNotes('');
    toast.success(cerigaTranslateLabel(res.message));
  };

  const saveTracking = () => {
    if (isSupabaseConfigured) {
      setTrackingConfirmOpen(false);
      toast.error(cerigaTranslate("interface.text_35d65f044a3f0b78"));
      return;
    }
    if (!trackingEditId) return;
    updateFactoryShipment(trackingEditId, {
      trackingNumber: trackingValue.trim(),
      status: trackingValue.trim() ? 'in_transit' : 'booked',
    });
    setTrackingEditId(null);
    setTrackingConfirmOpen(false);
    refresh();
    toast.success(cerigaTranslate("interface.text_e6cab2c1a35afb0e"));
  };

  return (
    <div className="space-y-6">
      {isSupabaseConfigured && <QualityControlQueue shipping />}
      {isSupabaseConfigured && <p className="rounded-xl border border-amber-400/20 p-3 text-sm text-amber-200">{cerigaTranslate("interface.text_baa8447d0c019db3")}</p>}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Ship className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{cerigaTranslate("interface.text_ae6e98909c98e7c9")}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{cerigaTranslate("nav.shipping")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">{cerigaTranslate("interface.text_a961a6c59c377ad7")}</p>
        </div>
        <Link
          to="/manufacturer/orders"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#252528] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >{cerigaTranslate("interface.text_dc357f24155c442e")}<ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Enabled carriers', value: String(enabledCount) },
          {
            label: 'In transit',
            value: String(shipments.filter((s) => s.status === 'in_transit').length),
          },
          {
            label: 'Default',
            value: getShippingCarrier(prefs.defaultCarrierId ?? '')?.shortName ?? '—',
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-[#252528] bg-[#111113] px-4 py-3.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {cerigaTranslateLabel(k.label)}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors',
              tab === t.id
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                : 'border-[#252528] bg-white/[0.03] text-white/50 hover:text-white',
            )}
          >
            {cerigaTranslateLabel(t.label)}
          </button>
        ))}
      </div>

      {tab === 'carriers' ? (
        <div className="space-y-4">
          <p className="text-[12px] text-white/40">{cerigaTranslate("interface.text_419d1e86ef024c09")}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {CERIGA_SHIPPING_CARRIERS.map((carrier) => {
              const setup = getFactoryCarrierSetup(carrier.id);
              const enabled = Boolean(setup?.enabled);
              const pending = carrier.status === 'pending';
              return (
                <div
                  key={carrier.id}
                  className="rounded-2xl border border-[#252528] bg-[#111113] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{carrier.name}</p>
                        {pending ? (
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-200">{cerigaTranslate("orders.pending")}</span>
                        ) : enabled ? (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">{cerigaTranslate("interface.text_92c1cdfdf4cb9cf6")}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">
                        {carrier.supportedModes.map((m) => SHIPPING_MODE_LABEL[m]).join(' · ')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {carrier.regions.join(', ')}
                        {carrier.trackingSupported ? cerigaTranslate("interface.text_373167afbbe2468f") : ''}
                      </p>
                      {carrier.notes ? (
                        <p className="mt-2 text-[11px] text-white/45">{carrier.notes}</p>
                      ) : null}
                    </div>
                    <Truck className="h-4 w-4 shrink-0 text-white/25" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-white hover:bg-white/5"
                      disabled={pending}
                      onClick={() =>
                        setPendingEnable({
                          carrierId: carrier.id,
                          name: carrier.name,
                          enable: !enabled,
                        })
                      }
                    >
                      {enabled ? cerigaTranslate("interface.text_b7e3e4aa4257b9a1") : cerigaTranslate("interface.text_5342e09f2729fbc6")}
                    </Button>
                    {enabled ? (
                      <Button
                        size="sm"
                        className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                        onClick={() => openEdit(carrier.id)}
                      >{cerigaTranslate("interface.text_6defafa2caa65304")}</Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {editCarrierId ? (
            <section className="rounded-2xl border border-[#CC2D24]/25 bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_6defafa2caa65304")}{" "}{getShippingCarrier(editCarrierId)?.name}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-white/45">{cerigaTranslate("interface.text_e1058a7c150c61c1")}</Label>
                  <Input
                    value={accountRef}
                    onChange={(e) => setAccountRef(e.target.value)}
                    className="mt-1 border-white/15 bg-white/5 text-white"
                    placeholder={cerigaTranslate("interface.text_59bbd83c1e71de29")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-white/45">{cerigaTranslate("interface.text_9130ae98bdc81ba1")}</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(getShippingCarrier(editCarrierId)?.supportedModes ?? ALL_SHIPPING_MODES).map(
                      (m) => {
                        const on = modes.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              setModes((prev) =>
                                on ? prev.filter((x) => x !== m) : [...prev, m],
                              )
                            }
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-[12px] font-medium',
                              on
                                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                                : 'border-[#252528] text-white/40',
                            )}
                          >
                            {cerigaTranslateLabel(SHIPPING_MODE_LABEL[m])}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-white/45">{cerigaTranslate("interface.text_6a3ad9122adfbecc")}</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      getShippingCarrier(editCarrierId)?.supportedIncoterms ?? ALL_INCOTERMS
                    ).map((t) => {
                      const on = incoterms.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setIncoterms((prev) =>
                              on ? prev.filter((x) => x !== t) : [...prev, t],
                            )
                          }
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-[12px] font-medium',
                            on
                              ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                              : 'border-[#252528] text-white/40',
                          )}
                          title={INCOTERM_HELP[t]}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-white/45">{cerigaTranslate("adminOrders.notes")}</Label>
                  <Textarea
                    value={carrierNotes}
                    onChange={(e) => setCarrierNotes(e.target.value)}
                    className="mt-1 min-h-[72px] border-white/15 bg-white/5 text-white"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                  onClick={requestSaveCarrier}
                >{cerigaTranslate("interface.text_8c616a878553e8aa")}</Button>
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/5"
                  onClick={() => setEditCarrierId(null)}
                >{cerigaTranslate("common.cancel")}</Button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'defaults' ? (
        <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_d3a6b37b6e287bef")}</h2>
          <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_0b5688f47db8088e")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-white/45">{cerigaTranslate("interface.text_e2a4f708772ccef4")}</Label>
              <Select value={defaultCarrierId} onValueChange={setDefaultCarrierId}>
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue placeholder={cerigaTranslate("interface.text_2a78025de6aae5e7")} />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  {enabledCarriers.map((c) =>
                    c ? (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ) : null,
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/45">{cerigaTranslate("interface.text_e4810f30b95cf415")}</Label>
              <Select
                value={defaultMode}
                onValueChange={(v) => setDefaultMode(v as ShippingMode)}
              >
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
              <Label className="text-white/45">{cerigaTranslate("interface.text_f2ad1c1ab1b4b8b1")}</Label>
              <Select
                value={defaultIncoterm}
                onValueChange={(v) => setDefaultIncoterm(v as Incoterm)}
              >
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  {ALL_INCOTERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-5 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            onClick={() => setDefaultsConfirmOpen(true)}
          >{cerigaTranslate("interface.text_a91af2a1efd13b3a")}</Button>
        </section>
      ) : null}

      {tab === 'quotes' ? (
        <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_5bdce7f24dd02ad3")}</h2>
          <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_0b6324fe0978c193")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-white/45">{cerigaTranslate("interface.text_5e23ec6a300dc60a")}</Label>
              <Select value={quoteMode} onValueChange={(v) => setQuoteMode(v as ShippingMode)}>
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
              <Label className="text-white/45">{cerigaTranslate("interface.text_766608a70c8b0813")}</Label>
              <Select
                value={quoteIncoterm}
                onValueChange={(v) => setQuoteIncoterm(v as Incoterm)}
              >
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
              <p className="mt-1 text-[10px] text-white/35">{INCOTERM_HELP[quoteIncoterm]}</p>
            </div>
            <div>
              <Label className="text-white/45">{cerigaTranslate("interface.text_9fb6669a77ea48bb")}</Label>
              <Input
                value={quoteUnits}
                onChange={(e) => setQuoteUnits(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-white/45">{cerigaTranslate("interface.text_99eb75db4a36c6a8")}{" "}{LEGACY_FACTORY_CURRENCY}{cerigaTranslate("interface.text_aae92f2ea37acd46")}{" "}{currency}{cerigaTranslate("interface.text_faebc2a1093b4684")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90" onClick={runQuoteEstimate}>{cerigaTranslate("interface.text_203eabd69a306a13")}</Button>
            {quoteResult != null ? (
              <p className="text-sm text-white">{cerigaTranslate("interface.text_558ecb0fd23a9e3c")}{' '}
                <span className="font-semibold tabular-nums text-emerald-300">
                  {displayMoney(quoteResult,LEGACY_FACTORY_CURRENCY)}
                </span>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'tracking' ? (
        <section className="overflow-hidden rounded-2xl border border-[#252528] bg-[#111113]">
          <div className="border-b border-[#252528] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_f41deb2033e43bcb")}</h2>
            <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_475363b5abce75aa")}</p>
          </div>
          {shipments.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-white/45">{cerigaTranslate("interface.text_cb4b9567742e4ef2")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#252528] text-[10px] uppercase tracking-wider text-white/35">
                    <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_dfee01bfef7242b7")}</th>
                    <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_271c535631ff3f3d")}</th>
                    <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_adc74704d65d5cc9")}</th>
                    <th className="px-4 py-3 font-semibold">{cerigaTranslate("orders.status")}</th>
                    <th className="px-4 py-3 font-semibold">{cerigaTranslate("adminOrders.tracking")}</th>
                    <th className="px-4 py-3 font-semibold text-right">{cerigaTranslate("interface.text_ff8059dc6752afdd")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {shipments.map((s) => {
                    const carrier = getShippingCarrier(s.carrierId);
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{s.orderId}</p>
                          <p className="text-[11px] text-white/40">{s.brandName}</p>
                          <p className="text-[10px] text-white/35">
                            {cerigaTranslateLabel(SHIPPING_MODE_LABEL[s.mode])} · {s.incoterm}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-white/70">{carrier?.shortName ?? '—'}</td>
                        <td className="px-4 py-3 text-[12px] text-white/55">
                          {s.origin} → {s.destination}
                          {s.eta ? (
                            <span className="block text-white/35">{cerigaTranslate("interface.text_4703fd70dfd54415")}{" "}{s.eta}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                              STATUS_STYLE[s.status],
                            )}
                          >
                            {cerigaTranslateLabel(SHIPMENT_STATUS_LABEL[s.status])}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-white/60">
                          {s.trackingNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/15 text-white hover:bg-white/5"
                            onClick={() => {
                              setTrackingEditId(s.id);
                              setTrackingValue(s.trackingNumber ?? '');
                            }}
                          >{cerigaTranslate("interface.text_c1c1009d3f37ec05")}</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {trackingEditId ? (
            <div className="border-t border-[#252528] px-5 py-4">
              <Label className="text-white/45">{cerigaTranslate("interface.text_d56dcd96cae61231")}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  value={trackingValue}
                  onChange={(e) => setTrackingValue(e.target.value)}
                  className="max-w-sm border-white/15 bg-white/5 font-mono text-white"
                />
                <Button
                  className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                  onClick={() => setTrackingConfirmOpen(true)}
                >{cerigaTranslate("interface.text_84991bae1c6db15b")}</Button>
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/5"
                  onClick={() => setTrackingEditId(null)}
                >{cerigaTranslate("common.cancel")}</Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'onboard' ? (
        <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_ebdc1a06c42308e5")}</h2>
          </div>
          <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_16b62376126141cb")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-white/45">{cerigaTranslate("interface.text_6dfada13d2f4b97e")}</Label>
              <Input
                value={onboardName}
                onChange={(e) => setOnboardName(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder={cerigaTranslate("interface.text_e88fb92b438ae2c8")}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-white/45">{cerigaTranslate("interface.text_84ef94656b760234")}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_SHIPPING_MODES.map((m) => {
                  const on = onboardModes.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setOnboardModes((prev) =>
                          on ? prev.filter((x) => x !== m) : [...prev, m],
                        )
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] font-medium',
                        on
                          ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                          : 'border-[#252528] text-white/40',
                      )}
                    >
                      {on ? <Check className="mr-1 inline h-3 w-3" /> : null}
                      {cerigaTranslateLabel(SHIPPING_MODE_LABEL[m])}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-white/45">{cerigaTranslate("interface.text_610c65d84510bef5")}</Label>
              <Input
                value={onboardRegions}
                onChange={(e) => setOnboardRegions(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white/45">{cerigaTranslate("interface.text_0d0f0cbe0f4b7500")}</Label>
              <Input
                value={onboardNotes}
                onChange={(e) => setOnboardNotes(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder={cerigaTranslate("interface.text_44bae10365f9cb2b")}
              />
            </div>
          </div>
          <Button
            className="mt-5 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            onClick={() => {
              if (!onboardName.trim() || onboardModes.length === 0) {
                toast.error(cerigaTranslate("interface.text_fc1129b1833f3883"));
                return;
              }
              setOnboardConfirmOpen(true);
            }}
          >
            <Package className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_e65f290d31894c2e")}</Button>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingEnable)}
        onOpenChange={(open) => {
          if (!open) setPendingEnable(null);
        }}
        title={
          pendingEnable?.enable
            ? cerigaTranslate("interface.text_f73e9492b94b98a7",{value0:(pendingEnable.name)})
            : cerigaTranslate("interface.text_f9e69f494488e894",{value0:(pendingEnable?.name)})
        }
        description={
          pendingEnable?.enable
            ? cerigaTranslate("interface.text_5b4f08951c9f1a10")
            : cerigaTranslate("interface.text_0751bacc84d5fc96")
        }
        confirmLabel={pendingEnable?.enable ? cerigaTranslate("interface.text_f4b7032efa5a945f") : cerigaTranslate("interface.text_0c0abb64bec6bc07")}
        tone={pendingEnable?.enable ? 'default' : 'danger'}
        onConfirm={confirmEnableToggle}
      />

      <ConfirmDialog
        open={saveCarrierOpen}
        onOpenChange={setSaveCarrierOpen}
        title={cerigaTranslate("interface.text_2bbda720a17769ab")}
        description={cerigaTranslate("interface.text_1f0bbdb9eac2834c")}
        confirmLabel={cerigaTranslate("interface.text_d5e4748f776e114b")}
        onConfirm={saveCarrier}
      />

      <ConfirmDialog
        open={defaultsConfirmOpen}
        onOpenChange={setDefaultsConfirmOpen}
        title={cerigaTranslate("interface.text_4c7a0c97bf0433fd")}
        description={cerigaTranslate("interface.text_ae66dd11408a22a8",{value0:(getShippingCarrier(defaultCarrierId)?.name ?? cerigaTranslate("interface.text_e26be2fc4712649c")),value1:(SHIPPING_MODE_LABEL[defaultMode]),value2:(defaultIncoterm)})}
        confirmLabel={cerigaTranslate("interface.text_a91af2a1efd13b3a")}
        onConfirm={saveDefaults}
      />

      <ConfirmDialog
        open={onboardConfirmOpen}
        onOpenChange={setOnboardConfirmOpen}
        title={cerigaTranslate("interface.text_52c257929068b42d")}
        description={cerigaTranslate("interface.text_8a4ee9a948fc2814",{value0:(onboardName.trim())})}
        confirmLabel={cerigaTranslate("interface.text_917e144e4bc3da89")}
        onConfirm={submitOnboard}
      />

      <ConfirmDialog
        open={trackingConfirmOpen}
        onOpenChange={setTrackingConfirmOpen}
        title={cerigaTranslate("interface.text_0330e23a1ec174bc")}
        description={cerigaTranslate("interface.text_eaeb15d368cc8d0d")}
        confirmLabel={cerigaTranslate("interface.text_84991bae1c6db15b")}
        onConfirm={saveTracking}
      />
    </div>
  );
}

export function ManufacturerShipping(){return isSupabaseConfigured?<FactoryShippingPanel/>:<ManufacturerShippingPreview/>;}
