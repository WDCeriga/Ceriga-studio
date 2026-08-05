import { useMemo, useState } from 'react';
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

export function ManufacturerShipping() {
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
      toast.error('Keep at least one mode and one Incoterm');
      return;
    }
    setSaveCarrierOpen(true);
  };

  const saveCarrier = () => {
    if (!actingHasPermission('edit_shipping')) {
      toast.error('You need Edit shipping permission');
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
    toast.success('Carrier setup saved — available when quoting');
  };

  const confirmEnableToggle = () => {
    if (!actingHasPermission('edit_shipping')) {
      toast.error('You need Edit shipping permission');
      return;
    }
    if (!pendingEnable) return;
    const catalog = getShippingCarrier(pendingEnable.carrierId);
    if (pendingEnable.enable && catalog?.status !== 'active') {
      toast.error('This carrier is still pending Ceriga onboarding');
      setPendingEnable(null);
      return;
    }
    setFactoryCarrierEnabled(pendingEnable.carrierId, pendingEnable.enable);
    setPendingEnable(null);
    refresh();
    toast.success(
      pendingEnable.enable
        ? `${pendingEnable.name} enabled for quoting`
        : `${pendingEnable.name} removed from quoting`,
    );
  };

  const saveDefaults = () => {
    if (!actingHasPermission('edit_shipping')) {
      toast.error('You need Edit shipping permission');
      return;
    }
    setFactoryShippingDefaults({
      defaultCarrierId: defaultCarrierId || undefined,
      defaultMode,
      defaultIncoterm,
    });
    refresh();
    toast.success('Quote shipping defaults saved');
  };

  const runQuoteEstimate = () => {
    const units = Number(quoteUnits);
    if (!Number.isFinite(units) || units <= 0) {
      toast.error('Enter a valid unit count');
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
      toast.error('Carrier name required');
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
    toast.success(res.message);
  };

  const saveTracking = () => {
    if (!trackingEditId) return;
    updateFactoryShipment(trackingEditId, {
      trackingNumber: trackingValue.trim(),
      status: trackingValue.trim() ? 'in_transit' : 'booked',
    });
    setTrackingEditId(null);
    setTrackingConfirmOpen(false);
    refresh();
    toast.success('Tracking updated');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Ship className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Logistics</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Shipping
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Enable Ceriga-onboarded carriers, set sea / air / rail / express + Incoterms (DDP, FOB,
            EXW, CIF), generate shipping quotes, and track shipments — then pick them when quoting
            orders.
          </p>
        </div>
        <Link
          to="/manufacturer/orders"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          Quote an order
          <ArrowUpRight className="h-3.5 w-3.5" />
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
            className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-3.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {k.label}
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
                : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'carriers' ? (
        <div className="space-y-4">
          <p className="text-[12px] text-white/40">
            Ceriga onboards shipping companies. Enable the ones you work with — they appear in the
            quote form on each order.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {CERIGA_SHIPPING_CARRIERS.map((carrier) => {
              const setup = getFactoryCarrierSetup(carrier.id);
              const enabled = Boolean(setup?.enabled);
              const pending = carrier.status === 'pending';
              return (
                <div
                  key={carrier.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{carrier.name}</p>
                        {pending ? (
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                            Pending
                          </span>
                        ) : enabled ? (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                            Enabled
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">
                        {carrier.supportedModes.map((m) => SHIPPING_MODE_LABEL[m]).join(' · ')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {carrier.regions.join(', ')}
                        {carrier.trackingSupported ? ' · Tracking' : ''}
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
                      {enabled ? 'Disable' : 'Enable'}
                    </Button>
                    {enabled ? (
                      <Button
                        size="sm"
                        className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                        onClick={() => openEdit(carrier.id)}
                      >
                        Configure
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {editCarrierId ? (
            <section className="rounded-2xl border border-[#CC2D24]/25 bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">
                Configure {getShippingCarrier(editCarrierId)?.name}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-white/45">Account / contract ref</Label>
                  <Input
                    value={accountRef}
                    onChange={(e) => setAccountRef(e.target.value)}
                    className="mt-1 border-white/15 bg-white/5 text-white"
                    placeholder="Optional account number"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-white/45">Modes you offer with this carrier</Label>
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
                                : 'border-white/10 text-white/40',
                            )}
                          >
                            {SHIPPING_MODE_LABEL[m]}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-white/45">Incoterms</Label>
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
                              : 'border-white/10 text-white/40',
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
                  <Label className="text-white/45">Notes</Label>
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
                >
                  Save carrier setup
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/5"
                  onClick={() => setEditCarrierId(null)}
                >
                  Cancel
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'defaults' ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
          <h2 className="text-sm font-semibold text-white">Defaults for new quotes</h2>
          <p className="mt-1 text-[11px] text-white/40">
            Pre-fills carrier, mode, and Incoterm on order quote tiers. Changing this requires
            confirmation.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-white/45">Default carrier</Label>
              <Select value={defaultCarrierId} onValueChange={setDefaultCarrierId}>
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
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
              <Label className="text-white/45">Default mode</Label>
              <Select
                value={defaultMode}
                onValueChange={(v) => setDefaultMode(v as ShippingMode)}
              >
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
              <Label className="text-white/45">Default Incoterm</Label>
              <Select
                value={defaultIncoterm}
                onValueChange={(v) => setDefaultIncoterm(v as Incoterm)}
              >
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
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
          >
            Save defaults
          </Button>
        </section>
      ) : null}

      {tab === 'quotes' ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
          <h2 className="text-sm font-semibold text-white">Generate shipping quotation</h2>
          <p className="mt-1 text-[11px] text-white/40">
            Mock estimate for sea, air, rail, or express with Incoterm uplift — use as a guide when
            pricing order tiers.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-white/45">Mode</Label>
              <Select value={quoteMode} onValueChange={(v) => setQuoteMode(v as ShippingMode)}>
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
              <Label className="text-white/45">Incoterm</Label>
              <Select
                value={quoteIncoterm}
                onValueChange={(v) => setQuoteIncoterm(v as Incoterm)}
              >
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
              <p className="mt-1 text-[10px] text-white/35">{INCOTERM_HELP[quoteIncoterm]}</p>
            </div>
            <div>
              <Label className="text-white/45">Units</Label>
              <Input
                value={quoteUnits}
                onChange={(e) => setQuoteUnits(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90" onClick={runQuoteEstimate}>
              Generate quote
            </Button>
            {quoteResult != null ? (
              <p className="text-sm text-white">
                Estimate{' '}
                <span className="font-semibold tabular-nums text-emerald-300">
                  {formatFactoryMoney(quoteResult)}
                </span>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'tracking' ? (
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Shipments</h2>
            <p className="mt-0.5 text-[11px] text-white/40">Track booked and in-transit deliveries.</p>
          </div>
          {shipments.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-white/45">No shipments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
                    <th className="px-4 py-3 font-semibold">Shipment</th>
                    <th className="px-4 py-3 font-semibold">Carrier</th>
                    <th className="px-4 py-3 font-semibold">Route</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Tracking</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
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
                            {SHIPPING_MODE_LABEL[s.mode]} · {s.incoterm}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-white/70">{carrier?.shortName ?? '—'}</td>
                        <td className="px-4 py-3 text-[12px] text-white/55">
                          {s.origin} → {s.destination}
                          {s.eta ? (
                            <span className="block text-white/35">ETA {s.eta}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                              STATUS_STYLE[s.status],
                            )}
                          >
                            {SHIPMENT_STATUS_LABEL[s.status]}
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
                          >
                            Update
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {trackingEditId ? (
            <div className="border-t border-white/[0.06] px-5 py-4">
              <Label className="text-white/45">Tracking number</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  value={trackingValue}
                  onChange={(e) => setTrackingValue(e.target.value)}
                  className="max-w-sm border-white/15 bg-white/5 font-mono text-white"
                />
                <Button
                  className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                  onClick={() => setTrackingConfirmOpen(true)}
                >
                  Save tracking
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/5"
                  onClick={() => setTrackingEditId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'onboard' ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">Request carrier onboarding</h2>
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            Ask Ceriga to onboard a shipping company. Once active, you can enable it under Carriers
            and select it when quoting.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-white/45">Company name</Label>
              <Input
                value={onboardName}
                onChange={(e) => setOnboardName(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder="e.g. GLS, Chronopost…"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-white/45">Modes needed</Label>
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
                          : 'border-white/10 text-white/40',
                      )}
                    >
                      {on ? <Check className="mr-1 inline h-3 w-3" /> : null}
                      {SHIPPING_MODE_LABEL[m]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-white/45">Regions</Label>
              <Input
                value={onboardRegions}
                onChange={(e) => setOnboardRegions(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white/45">Notes for Ceriga</Label>
              <Input
                value={onboardNotes}
                onChange={(e) => setOnboardNotes(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder="Account manager, lanes…"
              />
            </div>
          </div>
          <Button
            className="mt-5 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            onClick={() => {
              if (!onboardName.trim() || onboardModes.length === 0) {
                toast.error('Name and at least one mode required');
                return;
              }
              setOnboardConfirmOpen(true);
            }}
          >
            <Package className="mr-2 h-4 w-4" />
            Submit onboard request
          </Button>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingEnable)}
        onOpenChange={(open) => {
          if (!open) setPendingEnable(null);
        }}
        title={
          pendingEnable?.enable
            ? `Enable ${pendingEnable.name}?`
            : `Disable ${pendingEnable?.name}?`
        }
        description={
          pendingEnable?.enable
            ? 'This carrier will appear as a shipping option when you quote orders.'
            : 'You will no longer be able to select this carrier on new quotes until you enable it again.'
        }
        confirmLabel={pendingEnable?.enable ? 'Enable carrier' : 'Disable carrier'}
        tone={pendingEnable?.enable ? 'default' : 'danger'}
        onConfirm={confirmEnableToggle}
      />

      <ConfirmDialog
        open={saveCarrierOpen}
        onOpenChange={setSaveCarrierOpen}
        title="Save carrier setup?"
        description="Modes and Incoterms on this carrier will be available when quoting sample and bulk tiers."
        confirmLabel="Save setup"
        onConfirm={saveCarrier}
      />

      <ConfirmDialog
        open={defaultsConfirmOpen}
        onOpenChange={setDefaultsConfirmOpen}
        title="Save shipping defaults?"
        description={`New quote tiers will default to ${getShippingCarrier(defaultCarrierId)?.name ?? 'selected carrier'}, ${SHIPPING_MODE_LABEL[defaultMode]}, ${defaultIncoterm}.`}
        confirmLabel="Save defaults"
        onConfirm={saveDefaults}
      />

      <ConfirmDialog
        open={onboardConfirmOpen}
        onOpenChange={setOnboardConfirmOpen}
        title="Submit onboard request?"
        description={`Ceriga will review onboarding for “${onboardName.trim()}”. You can’t quote with them until the request is approved and the carrier is active.`}
        confirmLabel="Submit request"
        onConfirm={submitOnboard}
      />

      <ConfirmDialog
        open={trackingConfirmOpen}
        onOpenChange={setTrackingConfirmOpen}
        title="Update tracking?"
        description="This updates the shipment record visible to your factory ops team."
        confirmLabel="Save tracking"
        onConfirm={saveTracking}
      />
    </div>
  );
}
