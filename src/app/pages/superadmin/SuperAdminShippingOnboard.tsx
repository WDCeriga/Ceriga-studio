import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Ship } from 'lucide-react';
import { toast } from 'sonner';
import { getPlatformSetting, setPlatformSetting } from '../../lib/superadminDb';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { formatMoney } from '../../data/superadminMock';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';

type TabId = 'overview' | 'carriers';

type ShippingCarrier = {
  id: string;
  name: string;
  modes: string;
  notes: string;
};

export function SuperAdminShippingOnboard() {
  const { orders, manufacturerList, loading: dataLoading } = useSuperadminData();
  const [tab, setTab] = useState<TabId>('overview');
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftModes, setDraftModes] = useState('Air / Sea');
  const [draftNotes, setDraftNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const remote = await getPlatformSetting<ShippingCarrier[]>('shipping_carriers');
        if (!cancelled) setCarriers(Array.isArray(remote) ? remote : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load shipping settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overview = useMemo(() => {
    const shipped = orders.filter((o) => o.status === 'shipped' || o.status === 'completed');
    const inTransit = orders.filter((o) => o.status === 'shipped');
    const value = shipped.reduce((sum, o) => sum + (o.finalPriceCents ?? 0), 0);
    return {
      factories: manufacturerList.length,
      carriers: carriers.length,
      shipments: shipped.length,
      inTransit: inTransit.length,
      value,
    };
  }, [orders, manufacturerList, carriers]);

  const persistCarriers = async (next: ShippingCarrier[]) => {
    setSaving(true);
    try {
      await setPlatformSetting('shipping_carriers', next);
      setCarriers(next);
      toast.success('Carriers saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addCarrier = async () => {
    if (!draftName.trim()) {
      toast.error('Enter a carrier name');
      return;
    }
    const next: ShippingCarrier[] = [
      ...carriers,
      {
        id: crypto.randomUUID(),
        name: draftName.trim(),
        modes: draftModes.trim() || '—',
        notes: draftNotes.trim(),
      },
    ];
    setDraftName('');
    setDraftModes('Air / Sea');
    setDraftNotes('');
    await persistCarriers(next);
  };

  const removeCarrier = async (id: string) => {
    await persistCarriers(carriers.filter((c) => c.id !== id));
  };

  if (dataLoading || loading) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <Ship className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Logistics</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Shipping
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Network overview from live orders, plus Ceriga carrier catalog stored in platform settings.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'carriers', label: 'Carrier catalog' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
              tab === t.id
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-white'
                : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white/80',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Factories', value: String(overview.factories) },
              { label: 'Carriers', value: String(overview.carriers) },
              { label: 'Shipped / done', value: String(overview.shipments) },
              { label: 'In transit', value: String(overview.inTransit) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-[#252528] bg-[#111113] px-4 py-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {kpi.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{kpi.value}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">Shipped order value</h2>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {formatMoney(overview.value)}
            </p>
            <p className="mt-2 text-[11px] text-white/40">
              Sum of final prices on shipped and completed orders. Factory onboarding requests will
              appear here once the manufacturer portal submits them.
            </p>
          </section>

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">Factory network</h2>
            {manufacturerList.length === 0 ? (
              <p className="mt-6 text-center text-sm text-white/40">No manufacturers yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[#252528]">
                {manufacturerList.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{m.name}</p>
                      <p className="text-[11px] text-white/40">
                        {m.location}, {m.country}
                      </p>
                    </div>
                    <span className="text-[11px] tabular-nums text-white/45">
                      {m.assignedOrders} orders
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">Add carrier</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-white/55">Name</Label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                  placeholder="DHL Express"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/55">Modes</Label>
                <Input
                  value={draftModes}
                  onChange={(e) => setDraftModes(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-white/55">Notes</Label>
                <Input
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                  placeholder="Preferred lanes, account numbers…"
                />
              </div>
            </div>
            <Button
              className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90"
              disabled={saving}
              onClick={() => void addCarrier()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add carrier
            </Button>
          </section>

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">Catalog</h2>
            {carriers.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-white/12 px-4 py-12 text-center">
                <Package className="mx-auto h-8 w-8 text-white/25" />
                <p className="mt-3 text-sm text-white/45">No carriers saved yet.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {carriers.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#252528] bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-[11px] text-white/40">{c.modes}</p>
                      {c.notes ? <p className="mt-1 text-[11px] text-white/35">{c.notes}</p> : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/15 text-white"
                      disabled={saving}
                      onClick={() => void removeCarrier(c.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
