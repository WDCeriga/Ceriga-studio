import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Check,
  Clock,
  Package,
  Plus,
  Ship,
  TrendingUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  approveShippingOnboardRequest,
  declineShippingOnboardRequest,
  listShippingOnboardRequests,
} from '../../data/shippingOnboardMock';
import {
  ALL_INCOTERMS,
  ALL_SHIPPING_MODES,
  addCerigaShippingCarrier,
  listCerigaShippingCarriers,
  updateCerigaShippingCarrier,
  type Incoterm,
  type ShippingMode,
} from '../../data/factoryShipping';
import {
  getShippingNetworkStats,
  listFactoryShippingNetwork,
  listNetworkShipments,
  INCOTERM_LABEL,
  SHIPMENT_STATUS_LABEL,
  SHIPPING_MODE_LABEL,
} from '../../data/superadminShippingMock';
import { formatMoney } from '../../data/superadminMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';

type TabId = 'overview' | 'factories' | 'catalog' | 'onboard' | 'shipments';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SuperAdminShippingOnboard() {
  const [tick, setTick] = useState(0);
  void tick;
  const [tab, setTab] = useState<TabId>('overview');

  const stats = useMemo(() => getShippingNetworkStats(), [tick]);
  const factories = useMemo(() => listFactoryShippingNetwork(), [tick]);
  const catalog = useMemo(() => listCerigaShippingCarriers(), [tick]);
  const shipments = useMemo(() => listNetworkShipments(), [tick]);
  const pendingOnboard = useMemo(() => listShippingOnboardRequests('pending'), [tick]);
  const allOnboard = useMemo(() => listShippingOnboardRequests('all'), [tick]);

  const [onboardAction, setOnboardAction] = useState<{
    id: string;
    name: string;
    kind: 'approve' | 'decline';
  } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [carrierName, setCarrierName] = useState('');
  const [shortName, setShortName] = useState('');
  const [regions, setRegions] = useState('UK, EU');
  const [notes, setNotes] = useState('');
  const [modes, setModes] = useState<ShippingMode[]>(['express']);
  const [incoterms, setIncoterms] = useState<Incoterm[]>(['DDP', 'EXW']);

  const refresh = () => setTick((n) => n + 1);

  const commitOnboard = () => {
    if (!onboardAction) return;
    if (onboardAction.kind === 'approve') {
      approveShippingOnboardRequest(onboardAction.id);
      toast.success(`Approved ${onboardAction.name} — added to catalog`);
    } else {
      declineShippingOnboardRequest(onboardAction.id);
      toast.success(`Declined ${onboardAction.name}`);
    }
    setOnboardAction(null);
    refresh();
  };

  const commitAddCarrier = () => {
    if (!carrierName.trim()) {
      toast.error('Carrier name required');
      return;
    }
    if (modes.length === 0 || incoterms.length === 0) {
      toast.error('Pick at least one mode and Incoterm');
      return;
    }
    addCerigaShippingCarrier({
      name: carrierName,
      shortName: shortName || undefined,
      supportedModes: modes,
      supportedIncoterms: incoterms,
      regions: regions.split(/,\s*/).filter(Boolean),
      notes: notes || undefined,
      status: 'active',
      trackingSupported: true,
    });
    toast.success(`Added ${carrierName} to Ceriga catalog`);
    setAddOpen(false);
    setCarrierName('');
    setShortName('');
    setNotes('');
    setRegions('UK, EU');
    setModes(['express']);
    setIncoterms(['DDP', 'EXW']);
    refresh();
  };

  const toggleMode = (m: ShippingMode) => {
    setModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };
  const toggleIncoterm = (i: Incoterm) => {
    setIncoterms((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'factories', label: 'Factories' },
    { id: 'catalog', label: 'Ceriga catalog', count: catalog.length },
    { id: 'onboard', label: 'Onboard requests', count: pendingOnboard.length },
    { id: 'shipments', label: 'Shipments', count: shipments.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Ship className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Logistics</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Shipping
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Factory shipping options, Ceriga carrier catalog, onboard requests, and network
            transit stats.
          </p>
        </div>
        <Button
          className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Ceriga carrier
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
              tab === t.id
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                : 'border-white/10 text-white/45 hover:text-white/75',
            )}
          >
            {t.label}
            {t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Network shipments',
                value: String(stats.totalShipments),
                hint: `${stats.inTransit} in transit · ${stats.delivered} delivered`,
              },
              {
                label: 'Avg transit time',
                value: stats.avgTransitDays != null ? `${stats.avgTransitDays}d` : '—',
                hint: 'ETD → ETA on delivered / planned',
                icon: Clock,
              },
              {
                label: 'On-time delivery',
                value: stats.onTimePct != null ? `${stats.onTimePct}%` : '—',
                hint: 'Delivered by ETA',
                icon: TrendingUp,
              },
              {
                label: 'Avg shipping quote',
                value: stats.avgQuoteCents != null ? formatMoney(stats.avgQuoteCents) : '—',
                hint: `${stats.activeCatalog} active catalog carriers`,
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border border-white/[0.08] bg-[#111113] px-4 py-4"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {k.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{k.value}</p>
                <p className="mt-1 text-[11px] text-white/40">{k.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">Mode mix</h2>
              <ul className="mt-4 space-y-2">
                {stats.modeMix.length === 0 ? (
                  <li className="text-sm text-white/40">No shipments yet.</li>
                ) : (
                  stats.modeMix.map((m) => (
                    <li key={m.mode} className="flex items-center justify-between text-[13px]">
                      <span className="text-white/70">{m.label}</span>
                      <span className="tabular-nums text-white">{m.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">Top carriers used</h2>
              <ul className="mt-4 space-y-2">
                {stats.carrierUsage.length === 0 ? (
                  <li className="text-sm text-white/40">No usage yet.</li>
                ) : (
                  stats.carrierUsage.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-white/70">{c.name}</span>
                      <span className="tabular-nums text-white">{c.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setTab('onboard')}
              className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-left"
            >
              <p className="text-[11px] text-violet-200/80">Pending onboard</p>
              <p className="mt-0.5 text-xl font-semibold text-violet-100">{stats.pendingOnboard}</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('catalog')}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
            >
              <p className="text-[11px] text-white/45">Catalog pending</p>
              <p className="mt-0.5 text-xl font-semibold text-white">{stats.pendingCatalog}</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('factories')}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
            >
              <p className="text-[11px] text-white/45">Enabled factory options</p>
              <p className="mt-0.5 text-xl font-semibold text-white">
                {stats.factoriesEnabledOptions}
              </p>
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'factories' ? (
        <div className="space-y-4">
          {factories.map((f) => (
            <section
              key={f.factoryId}
              className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">{f.factoryName}</h2>
                    {f.live ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-200">
                        Live
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-white/40">{f.location}</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    Default:{' '}
                    {[f.defaultCarrierName, f.defaultMode && SHIPPING_MODE_LABEL[f.defaultMode], f.defaultIncoterm && INCOTERM_LABEL[f.defaultIncoterm]]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-right text-[11px] text-white/45">
                  <div>
                    <p className="text-white/30">Shipments</p>
                    <p className="text-sm font-semibold tabular-nums text-white">{f.shipmentCount}</p>
                  </div>
                  <div>
                    <p className="text-white/30">Avg transit</p>
                    <p className="text-sm font-semibold tabular-nums text-white">
                      {f.avgTransitDays != null ? `${f.avgTransitDays}d` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/30">On-time</p>
                    <p className="text-sm font-semibold tabular-nums text-white">
                      {f.onTimePct != null ? `${f.onTimePct}%` : '—'}
                    </p>
                  </div>
                  <Link
                    to={`/superadmin/manufacturers/${f.userId}`}
                    className="self-end text-[#CC2D24] hover:underline"
                  >
                    Profile
                  </Link>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      <th className="pb-2 pr-3">Carrier</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Modes</th>
                      <th className="pb-2 pr-3">Incoterms</th>
                      <th className="pb-2">Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.options.map((o) => (
                      <tr key={o.carrierId} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-2.5 pr-3 text-sm text-white/85">{o.carrierName}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              o.enabled
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : 'bg-white/5 text-white/40',
                            )}
                          >
                            {o.enabled ? 'Enabled' : 'Off'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[11px] text-white/55">
                          {o.modes.map((m) => SHIPPING_MODE_LABEL[m]).join(', ')}
                        </td>
                        <td className="py-2.5 pr-3 text-[11px] text-white/55">
                          {o.incoterms.join(', ')}
                        </td>
                        <td className="py-2.5 font-mono text-[11px] text-white/40">
                          {o.accountRef ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {tab === 'catalog' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    <p className="text-[11px] text-white/40">{c.shortName}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      c.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : c.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-200'
                          : 'bg-white/5 text-white/40',
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-white/55">
                  {c.supportedModes.map((m) => SHIPPING_MODE_LABEL[m]).join(' · ')}
                </p>
                <p className="mt-1 text-[11px] text-white/40">
                  {c.supportedIncoterms.join(', ')} · {c.regions.join(', ')}
                </p>
                {c.notes ? <p className="mt-2 text-[11px] text-white/35">{c.notes}</p> : null}
                {c.status === 'pending' ? (
                  <Button
                    size="sm"
                    className="mt-3 bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={() => {
                      updateCerigaShippingCarrier(c.id, {
                        status: 'active',
                        trackingSupported: true,
                      });
                      toast.success(`${c.name} activated`);
                      refresh();
                    }}
                  >
                    Activate
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'onboard' ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
          {allOnboard.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">No onboard requests.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {allOnboard.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{r.name}</p>
                    <p className="mt-0.5 text-[12px] text-white/45">
                      {r.factoryName} · {r.regions} · {formatDate(r.requestedAt)}
                    </p>
                    <p className="mt-1 text-[11px] text-white/35">
                      Modes: {r.modes.map((m) => SHIPPING_MODE_LABEL[m]).join(', ')}
                    </p>
                    {r.notes ? <p className="mt-1 text-[11px] text-white/40">{r.notes}</p> : null}
                    {r.status !== 'pending' ? (
                      <p
                        className={cn(
                          'mt-1 text-[10px] font-medium uppercase tracking-wide',
                          r.status === 'approved' ? 'text-emerald-300' : 'text-white/40',
                        )}
                      >
                        {r.status}
                        {r.reviewedAt ? ` · ${formatDate(r.reviewedAt)}` : ''}
                      </p>
                    ) : null}
                  </div>
                  {r.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        onClick={() =>
                          setOnboardAction({ id: r.id, name: r.name, kind: 'approve' })
                        }
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/15 bg-white/[0.03] text-white/80"
                        onClick={() =>
                          setOnboardAction({ id: r.id, name: r.name, kind: 'decline' })
                        }
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'shipments' ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="border-b border-white/[0.08] bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3">Shipment</th>
                  <th className="px-4 py-3">Factory</th>
                  <th className="px-4 py-3">Carrier / mode</th>
                  <th className="px-4 py-3">Lane</th>
                  <th className="px-4 py-3">Transit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quote</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-3 align-middle">
                      <p className="font-mono text-[11px] text-white/45">{s.id}</p>
                      <p className="text-sm text-white/85">{s.brandName}</p>
                      {s.trackingNumber ? (
                        <p className="font-mono text-[10px] text-white/35">{s.trackingNumber}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">{s.factoryName}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white/80">{s.carrierName}</p>
                      <p className="text-[11px] text-white/40">
                        {SHIPPING_MODE_LABEL[s.mode]} · {s.incoterm}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-white/55">
                      {s.origin}
                      <br />→ {s.destination}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] tabular-nums text-white/75">
                        {s.transitDays != null ? `${s.transitDays}d` : '—'}
                      </p>
                      <p className="text-[10px] text-white/35">
                        {s.etd ? formatDate(s.etd) : '—'} → {s.eta ? formatDate(s.eta) : '—'}
                      </p>
                      {s.onTime === true ? (
                        <p className="text-[10px] text-emerald-300">On time</p>
                      ) : s.onTime === false ? (
                        <p className="text-[10px] text-amber-300">Late</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-white/65">
                      {SHIPMENT_STATUS_LABEL[s.status]}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-white/80">
                      {s.shippingQuoteCents != null ? formatMoney(s.shippingQuoteCents) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={onboardAction != null}
        onOpenChange={(open) => {
          if (!open) setOnboardAction(null);
        }}
        title={onboardAction?.kind === 'approve' ? 'Approve carrier?' : 'Decline carrier?'}
        description={
          onboardAction?.kind === 'approve'
            ? `Add “${onboardAction?.name ?? ''}” to the Ceriga shipping catalog.`
            : `Decline “${onboardAction?.name ?? ''}”.`
        }
        confirmLabel={onboardAction?.kind === 'approve' ? 'Approve' : 'Decline'}
        onConfirm={commitOnboard}
      />

      {addOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0c0c0e]/95 p-4 backdrop-blur lg:left-auto lg:right-6 lg:bottom-6 lg:w-[420px] lg:rounded-2xl lg:border">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            <Package className="h-3.5 w-3.5" />
            New Ceriga carrier
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <Label className="text-white/45">Name</Label>
              <Input
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder="e.g. Ceriga Express Hub"
              />
            </div>
            <div>
              <Label className="text-white/45">Short name</Label>
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder="Optional"
              />
            </div>
            <div>
              <Label className="text-white/45">Regions (comma-separated)</Label>
              <Input
                value={regions}
                onChange={(e) => setRegions(e.target.value)}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div>
              <p className="text-[11px] text-white/45">Modes</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ALL_SHIPPING_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMode(m)}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-[10px] font-medium',
                      modes.includes(m)
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                        : 'border-white/10 text-white/40',
                    )}
                  >
                    {SHIPPING_MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-white/45">Incoterms</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ALL_INCOTERMS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleIncoterm(i)}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-[10px] font-medium',
                      incoterms.includes(i)
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                        : 'border-white/10 text-white/40',
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-white/45">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
                onClick={commitAddCarrier}
              >
                Add to catalog
              </Button>
              <Button
                variant="outline"
                className="border-white/15 text-white/70"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
