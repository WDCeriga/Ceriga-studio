import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Copy,
  Factory,
  Link2,
  Mail,
  Package,
  Plus,
  Shield,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_GARMENT_CATEGORIES,
  COMMON_CERTIFICATIONS,
  formatMoneyCents,
  getManufacturerOrderStats,
  getManufacturerProfile,
  getManufacturerUser,
  patchManufacturerControl,
  type GarmentCategory,
  type ManufacturerStatus,
} from '../../data/manufacturersMock';
import {
  MANUFACTURER_PLANS,
  PAGE_ACCESS,
  getProfileAccess,
  upsertProfileAccess,
  type ProfileAccessConfig,
} from '../../data/crmAccessMock';
import { resolveMarginForPlan } from '../../data/superadminPricingMock';
import { MOCK_SUPER_ORDERS, STATUS_LABELS, formatMoney } from '../../data/superadminMock';
import {
  getFactoryScorecard,
  getFactoryTeamAudit,
  FACTORY_PERMISSION_LABEL,
} from '../../data/superadminFactoryOpsMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

type PendingConfirm =
  | { kind: 'status'; next: ManufacturerStatus }
  | { kind: 'save' }
  | { kind: 'pages'; mode: 'all' | 'none' }
  | { kind: 'remove-page'; pageId: string; pageLabel: string }
  | { kind: 'save-produce' }
  | { kind: 'save-certs' };

function sameList(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

const STATUSES: ManufacturerStatus[] = ['active', 'paused', 'onboarding'];

const STATUS_STYLE: Record<ManufacturerStatus, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  paused: 'border-white/15 bg-white/5 text-white/50',
  onboarding: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SuperAdminManufacturerDetail() {
  const { id } = useParams<{ id: string }>();
  const seed = id ? getManufacturerProfile(id) : undefined;
  const user = id ? getManufacturerUser(id) : undefined;
  const existing = id ? getProfileAccess(id) : undefined;
  const pages = PAGE_ACCESS.manufacturers;

  const [status, setStatus] = useState<ManufacturerStatus | null>(seed?.status ?? null);
  const [notes, setNotes] = useState(seed?.internalNotes ?? '');
  const [garmentTypes, setGarmentTypes] = useState<GarmentCategory[]>(
    () => seed?.garmentTypes ?? [],
  );
  const [specialties, setSpecialties] = useState<string[]>(() => seed?.specialties ?? []);
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [certifications, setCertifications] = useState<string[]>(
    () => seed?.certifications ?? [],
  );
  const [certDraft, setCertDraft] = useState('');
  const [config, setConfig] = useState<ProfileAccessConfig | null>(() =>
    existing ? { ...existing } : null,
  );
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [savedMatching, setSavedMatching] = useState(() => ({
    garmentTypes: [...(seed?.garmentTypes ?? [])] as GarmentCategory[],
    specialties: [...(seed?.specialties ?? [])],
    certifications: [...(seed?.certifications ?? [])],
  }));

  const produceDirty =
    !sameList(garmentTypes, savedMatching.garmentTypes) ||
    !sameList(specialties, savedMatching.specialties);
  const certsDirty = !sameList(certifications, savedMatching.certifications);

  const enabledSet = useMemo(
    () => new Set(config?.enabledPages ?? []),
    [config?.enabledPages],
  );

  if (!id || !seed || !user || !config || !status) {
    return <Navigate to="/superadmin/manufacturers" replace />;
  }

  const profile = seed;
  const orderStats = getManufacturerOrderStats(profile.entityId);
  const scorecard = getFactoryScorecard(profile.userId);
  const teamAudit = getFactoryTeamAudit(profile.userId);
  const recentOrders = MOCK_SUPER_ORDERS.filter((o) => o.manufacturerId === profile.entityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const margin = resolveMarginForPlan(config.manufacturerPlanId);
  const capacityLoad = scorecard?.capacityPct ?? Math.min(
    100,
    Math.round((orderStats.activeOrders / Math.max(profile.capacityUnitsPerMonth / 200, 1)) * 100),
  );

  const togglePage = (pageId: string, on: boolean) => {
    if (!on) {
      const page = pages.find((p) => p.id === pageId);
      setConfirm({
        kind: 'remove-page',
        pageId,
        pageLabel: page?.label ?? 'this page',
      });
      return;
    }
    setConfig((c) => {
      if (!c) return c;
      return { ...c, enabledPages: [...new Set([...c.enabledPages, pageId])] };
    });
  };

  const runConfirmed = () => {
    if (!confirm || !config) return;
    if (confirm.kind === 'status') {
      setStatus(confirm.next);
    } else if (confirm.kind === 'save') {
      commitSave();
    } else if (confirm.kind === 'pages') {
      setConfig({
        ...config,
        enabledPages: confirm.mode === 'all' ? pages.map((p) => p.id) : [],
      });
    } else if (confirm.kind === 'remove-page') {
      const nextConfig = {
        ...config,
        enabledPages: config.enabledPages.filter((pid) => pid !== confirm.pageId),
      };
      setConfig(nextConfig);
      upsertProfileAccess(nextConfig);
      toast.success(`Removed “${confirm.pageLabel}” from portal access`);
    } else if (confirm.kind === 'save-produce') {
      if (garmentTypes.length === 0) {
        toast.error('Select at least one product type for order matching');
        setConfirm(null);
        return;
      }
      patchManufacturerControl(profile.userId, {
        garmentTypes,
        specialties,
      });
      setSavedMatching((prev) => ({
        ...prev,
        garmentTypes: [...garmentTypes],
        specialties: [...specialties],
      }));
      toast.success('Product types & specialities saved for order matching');
    } else if (confirm.kind === 'save-certs') {
      patchManufacturerControl(profile.userId, { certifications });
      setSavedMatching((prev) => ({
        ...prev,
        certifications: [...certifications],
      }));
      toast.success('Certifications saved');
    }
    setConfirm(null);
  };

  const toggleGarment = (g: GarmentCategory) => {
    setGarmentTypes((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const addSpecialty = () => {
    const value = specialtyDraft.trim();
    if (!value) return;
    if (specialties.some((s) => s.toLowerCase() === value.toLowerCase())) {
      toast.message('Already listed');
      return;
    }
    setSpecialties((prev) => [...prev, value]);
    setSpecialtyDraft('');
    toast.message('Speciality added — save to apply for matching');
  };

  const toggleCertification = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert],
    );
  };

  const addCertification = () => {
    const value = certDraft.trim();
    if (!value) return;
    if (certifications.some((c) => c.toLowerCase() === value.toLowerCase())) {
      toast.message('Already listed');
      return;
    }
    setCertifications((prev) => [...prev, value]);
    setCertDraft('');
    toast.message('Certification added — save to apply');
  };

  const commitSave = () => {
    if (garmentTypes.length === 0) {
      toast.error('Select at least one product type for order matching');
      return;
    }
    if (pendingPlanId) {
      toast.error('Confirm or cancel the commercial plan change first');
      return;
    }
    patchManufacturerControl(profile.userId, {
      status,
      internalNotes: notes.trim(),
      garmentTypes,
      specialties,
      certifications,
    });
    upsertProfileAccess(config);
    setSavedMatching({
      garmentTypes: [...garmentTypes],
      specialties: [...specialties],
      certifications: [...certifications],
    });
    toast.success(`Controls saved for ${profile.name}`);
  };

  const save = () => {
    if (garmentTypes.length === 0) {
      toast.error('Select at least one product type for order matching');
      return;
    }
    if (pendingPlanId) {
      toast.error('Confirm or cancel the commercial plan change first');
      return;
    }
    setConfirm({ kind: 'save' });
  };

  const confirmPlanChange = () => {
    if (!pendingPlanId || !config) return;
    setConfig({ ...config, manufacturerPlanId: pendingPlanId });
    setPendingPlanId(null);
    toast.message('Plan selected — click Save controls to apply');
  };

  const pendingPlan = pendingPlanId
    ? MANUFACTURER_PLANS.find((p) => p.id === pendingPlanId)
    : undefined;
  const currentPlan = MANUFACTURER_PLANS.find((p) => p.id === config?.manufacturerPlanId);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      toast.success('Email copied');
    } catch {
      toast.error('Could not copy email');
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/superadmin/manufacturers"
        className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Manufacturers
      </Link>

      {/* Control hero */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-amber-500/12 via-[#CC2D24]/5 to-transparent px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-sm font-bold text-amber-100 sm:h-16 sm:w-16 sm:text-base">
                {initials(profile.name)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                  Partner control
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {profile.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm text-white/55">{profile.email}</span>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                    aria-label="Copy email"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-white/20">·</span>
                  <span className="text-sm text-white/40">
                    {profile.location}, {profile.country}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                      STATUS_STYLE[status],
                    )}
                  >
                    {status}
                  </span>
                  <span className="inline-flex rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55">
                    Entity {profile.entityId}
                  </span>
                  <span className="inline-flex rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55">
                    Margin {margin.platformMarginPercent}%
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={save}
              className="shrink-0 bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
            >
              Save controls
            </Button>
          </div>
        </div>

        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Orders assigned', value: orderStats.totalOrders, icon: Package },
            { label: 'In pipeline', value: orderStats.activeOrders, icon: Factory },
            { label: 'Avg. quote', value: `${profile.avgQuoteDays}d`, icon: Clock },
            { label: 'On-time', value: `${profile.onTimeRate}%`, icon: TrendingUp },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#111113] px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/38">
                <stat.icon className="h-3.5 w-3.5" />
                {stat.label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-white">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Factory scorecard — same KPIs as manufacturer stats export */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Factory scorecard
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              {scorecard?.periodLabel ?? 'Last 90 days'}
              {scorecard?.live ? (
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-200">
                  Live stats
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-[11px] text-white/40">
              Win rate, quote hours, OTIF, and capacity from the factory analytics export.
            </p>
          </div>
          {scorecard ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                Network rank
              </p>
              <p className="text-xl font-semibold tabular-nums text-amber-100">
                #{scorecard.rank}
                <span className="ml-1.5 text-sm font-normal text-amber-100/60">
                  · score {scorecard.score}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: 'Win rate',
              value: `${scorecard?.winRate ?? profile.winRate}%`,
              hint: 'Quotes won',
            },
            {
              label: 'Quote hours',
              value: `${scorecard?.avgQuoteHours ?? Math.round(profile.avgQuoteDays * 24)}h`,
              hint: 'Avg response',
            },
            {
              label: 'OTIF',
              value: `${scorecard?.otifPct ?? '—'}%`,
              hint: 'On time in full',
            },
            {
              label: 'On-time',
              value: `${scorecard?.onTimePct ?? profile.onTimeRate}%`,
              hint: 'Delivery OT',
            },
            {
              label: 'Capacity use',
              value: `${capacityLoad}%`,
              hint: 'Booked vs monthly',
            },
            {
              label: 'Quote→order',
              value: `${scorecard?.quoteToOrderRate ?? profile.quoteToOrderRate}%`,
              hint: `${scorecard?.completed ?? orderStats.completedOrders} done`,
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
            >
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                {m.label}
              </div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums text-white">{m.value}</div>
              <div className="mt-0.5 text-[10px] text-white/35">{m.hint}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-white/30">
          Quoted {formatMoneyCents(orderStats.totalQuoteCents)} · Active{' '}
          {formatDate(profile.lastActive)} · See rankings in Statistics → Manufacturers
        </p>
      </section>

      {/* Order matching — primary control for auto-assign */}
      <section className="rounded-2xl border border-amber-500/20 bg-[#111113] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <Link2 className="h-4 w-4 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">What they can produce</h2>
            <p className="mt-0.5 text-[11px] text-white/40">
              Used to automatically connect orders to this manufacturer. Toggle product types Ceriga
              can route here.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Product types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_GARMENT_CATEGORIES.map((g) => {
              const on = garmentTypes.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGarment(g)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                    on
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                      : 'border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70',
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>
          {garmentTypes.length === 0 ? (
            <p className="mt-2 text-[11px] text-[#CC2D24]">
              Select at least one type or this partner won’t match any orders.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Specialities (matching signals)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] py-0.5 pl-2 pr-1 text-[11px] text-white/70"
              >
                {s}
                <button
                  type="button"
                  onClick={() => setSpecialties((prev) => prev.filter((x) => x !== s))}
                  className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white"
                  aria-label={`Remove ${s}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={specialtyDraft}
              onChange={(e) => setSpecialtyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="Add speciality…"
              className="h-9 border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addSpecialty}
              className="h-9 shrink-0 border-white/15 bg-transparent px-3 text-white hover:bg-white/5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/40">
            {produceDirty
              ? 'Unsaved matching changes — save to update auto-routing.'
              : 'Matching signals are up to date.'}
          </p>
          <Button
            type="button"
            disabled={!produceDirty}
            className="h-9 bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40"
            onClick={() => setConfirm({ kind: 'save-produce' })}
          >
            Save product matching
          </Button>
        </div>
      </section>

      {/* Certifications */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <BadgeCheck className="h-4 w-4 text-emerald-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">Certifications</h2>
            <p className="mt-0.5 text-[11px] text-white/40">
              Compliance and quality credentials for this partner. Toggle common ones or add custom.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {COMMON_CERTIFICATIONS.map((cert) => {
            const on = certifications.includes(cert);
            return (
              <button
                key={cert}
                type="button"
                onClick={() => toggleCertification(cert)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                  on
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70',
                )}
              >
                {cert}
              </button>
            );
          })}
          {certifications
            .filter((c) => !(COMMON_CERTIFICATIONS as readonly string[]).includes(c))
            .map((cert) => (
              <button
                key={cert}
                type="button"
                onClick={() => toggleCertification(cert)}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:border-emerald-500/55"
                title="Click to remove"
              >
                {cert}
              </button>
            ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={certDraft}
            onChange={(e) => setCertDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCertification();
              }
            }}
            placeholder="Add custom certification…"
            className="h-9 border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCertification}
            className="h-9 shrink-0 border-white/15 bg-transparent px-3 text-white hover:bg-white/5"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/40">
            {certsDirty
              ? 'Unsaved certification changes — save to keep them on this partner.'
              : 'Certifications are up to date.'}
          </p>
          <Button
            type="button"
            disabled={!certsDirty}
            className="h-9 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
            onClick={() => setConfirm({ kind: 'save-certs' })}
          >
            Save certifications
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Controls column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#CC2D24]/15">
                <Shield className="h-4 w-4 text-[#CC2D24]" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Partner status</h2>
                <p className="mt-0.5 text-[11px] text-white/40">
                  Controls whether Ceriga can assign new work
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Select
                value={status}
                onValueChange={(v) => {
                  const next = v as ManufacturerStatus;
                  if (next === status) return;
                  setConfirm({ kind: 'status', next });
                }}
              >
                <SelectTrigger className="border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <dl className="mt-4 space-y-2 text-[12px] text-white/45">
              <div className="flex justify-between gap-3">
                <dt>Lead time</dt>
                <dd className="text-white/70">{profile.leadTimeDays} days</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Joined</dt>
                <dd className="text-white/70">{formatDate(profile.joinedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Commercial plan</h2>
            <p className="mt-1 text-[11px] text-white/40">
              Sets commission tier and platform margin for this factory
            </p>
            <div className="mt-4 space-y-2">
              {MANUFACTURER_PLANS.map((plan) => {
                const active = config.manufacturerPlanId === plan.id && !pendingPlanId;
                const pending = pendingPlanId === plan.id;
                const planMargin = resolveMarginForPlan(plan.id);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      if (plan.id === config.manufacturerPlanId) {
                        setPendingPlanId(null);
                        return;
                      }
                      setPendingPlanId(plan.id);
                    }}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-left transition',
                      pending
                        ? 'border-amber-500/70 bg-amber-500/15 ring-1 ring-amber-500/30'
                        : active
                          ? 'border-amber-500/40 bg-amber-500/10'
                          : 'border-white/10 bg-black/20 hover:border-white/15',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{plan.name}</span>
                      <span className="text-[10px] text-white/40">{plan.monthlyFee}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-200/85">
                      {plan.commission} commission · {planMargin.platformMarginPercent}% Ceriga
                      margin
                    </p>
                    {pending ? (
                      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                        Pending confirmation
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {pendingPlan && currentPlan ? (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                <p className="text-[12px] text-amber-100/90">
                  Switch commercial plan from <span className="font-semibold">{currentPlan.name}</span>{' '}
                  to <span className="font-semibold">{pendingPlan.name}</span>? This changes
                  commission and Ceriga margin for this factory.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-white/15 bg-transparent text-white hover:bg-white/5"
                    onClick={() => setPendingPlanId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="h-9 bg-amber-500 text-black hover:bg-amber-400"
                    onClick={confirmPlanChange}
                  >
                    Confirm plan
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Internal ops notes</h2>
            <p className="mt-1 text-[11px] text-white/40">Visible to Ceriga owners only</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-4 min-h-[120px] border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30"
              placeholder="Routing preferences, risks, SLAs…"
            />
          </section>

        </div>

        {/* Access + orders */}
        <div className="space-y-6 lg:col-span-3">
          {teamAudit ? (
            <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                    <Users className="h-4 w-4 text-violet-300" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Team audit</h2>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      Read-only mirror of factory Team &amp; roles — who can quote, decline,
                      shipping, and materials.
                    </p>
                  </div>
                </div>
                {teamAudit.live ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-200">
                    Live roster
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase text-white/40">
                    Snapshot
                  </span>
                )}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      <th className="pb-2 pr-3">Person</th>
                      <th className="pb-2 pr-3">Role</th>
                      <th className="pb-2 pr-2 text-center">Quote</th>
                      <th className="pb-2 pr-2 text-center">Decline</th>
                      <th className="pb-2 pr-2 text-center">Ship</th>
                      <th className="pb-2 text-center">Mats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamAudit.members.map((m) => (
                      <tr key={m.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="text-sm text-white/85">{m.name}</p>
                          <p className="text-[11px] text-white/40">{m.email}</p>
                          {m.hasCustomOverride ? (
                            <p className="mt-0.5 text-[10px] font-medium text-amber-300/90">
                              Custom permission override
                            </p>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] capitalize text-white/60">
                            {m.role}
                          </span>
                          <p className="mt-1 text-[10px] text-white/35">
                            {m.status === 'invited' ? 'Invited' : `Active · ${formatDate(m.lastActive)}`}
                          </p>
                        </td>
                        {(
                          [
                            m.canQuote,
                            m.canDecline,
                            m.canEditShipping,
                            m.canEditMaterials,
                          ] as boolean[]
                        ).map((on, i) => (
                          <td key={i} className="py-2.5 pr-2 text-center">
                            <span
                              className={cn(
                                'inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold',
                                on
                                  ? 'bg-emerald-500/15 text-emerald-200'
                                  : 'bg-white/5 text-white/25',
                              )}
                            >
                              {on ? 'Y' : '—'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {teamAudit.permissionMatrix
                  .filter((row) =>
                    ['quote', 'decline', 'edit_shipping', 'edit_materials'].includes(
                      row.permission,
                    ),
                  )
                  .map((row) => (
                    <div
                      key={row.permission}
                      className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                        {FACTORY_PERMISSION_LABEL[row.permission]}
                      </p>
                      <p className="mt-0.5 text-[12px] text-white/70">
                        {row.memberNames.length > 0 ? row.memberNames.join(', ') : 'Nobody'}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Factory portal access</h2>
                <p className="mt-0.5 text-[11px] text-white/40">
                  What this partner can open in their manufacturer app
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={() => setConfirm({ kind: 'pages', mode: 'all' })}
                >
                  Enable all
                </button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-white/40 hover:text-white/70"
                  onClick={() => setConfirm({ kind: 'pages', mode: 'none' })}
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {pages.map((page) => {
                const on = enabledSet.has(page.id);
                return (
                  <label
                    key={page.id}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition',
                      on
                        ? 'border-[#CC2D24]/25 bg-[#CC2D24]/8'
                        : 'border-white/[0.06] bg-black/20',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{page.label}</p>
                      <p className="text-[11px] text-white/40">{page.description}</p>
                    </div>
                    <Switch checked={on} onCheckedChange={(v) => togglePage(page.id, v)} />
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Assigned order pipeline</h2>
                <p className="mt-0.5 text-[11px] text-white/40">
                  Work currently or previously routed to this partner
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-transparent text-white hover:bg-white/5"
              >
                <Link to="/superadmin/orders">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Open orders
                </Link>
              </Button>
            </div>

            {recentOrders.length === 0 ? (
              <p className="mt-6 text-sm text-white/40">No orders assigned yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      to={`/superadmin/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 py-3.5 transition hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{order.productName}</p>
                        <p className="text-[11px] text-white/40">
                          {order.id} · {order.userName} · {STATUS_LABELS[order.status]}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-[12px] tabular-nums text-white/55">
                        {order.manufacturerQuoteCents != null
                          ? formatMoney(order.manufacturerQuoteCents)
                          : 'Awaiting quote'}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirm != null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.kind === 'status'
            ? 'Change partner status?'
            : confirm?.kind === 'remove-page'
              ? `Remove “${confirm.pageLabel}”?`
              : confirm?.kind === 'save-produce'
                ? 'Save product matching?'
                : confirm?.kind === 'save-certs'
                  ? 'Save certifications?'
                  : confirm?.kind === 'pages'
                    ? confirm.mode === 'all'
                      ? 'Enable all portal pages?'
                      : 'Clear all portal access?'
                    : 'Save partner controls?'
        }
        description={
          confirm?.kind === 'status'
            ? `Set this factory to “${confirm.next}”. Paused partners stop receiving new work assignments.`
            : confirm?.kind === 'remove-page'
              ? `This partner will lose access to “${confirm.pageLabel}” in their manufacturer app. Save to apply.`
              : confirm?.kind === 'save-produce'
                ? `Update what Ceriga can auto-route to ${profile.name}: ${garmentTypes.length} product type${garmentTypes.length === 1 ? '' : 's'}, ${specialties.length} specialit${specialties.length === 1 ? 'y' : 'ies'}.`
                : confirm?.kind === 'save-certs'
                  ? `Save ${certifications.length} certification${certifications.length === 1 ? '' : 's'} on this partner profile.`
                  : confirm?.kind === 'pages'
                    ? confirm.mode === 'all'
                      ? 'This turns on every manufacturer portal page for this partner.'
                      : 'This removes all portal page access until you re-enable pages and save.'
                    : `Save status, commercial plan, product capabilities, and portal access for ${profile.name}?`
        }
        confirmLabel={
          confirm?.kind === 'save' ||
          confirm?.kind === 'remove-page' ||
          confirm?.kind === 'save-produce' ||
          confirm?.kind === 'save-certs'
            ? 'Save changes'
            : confirm?.kind === 'pages' && confirm.mode === 'none'
              ? 'Clear all'
              : 'Confirm'
        }
        tone={
          confirm?.kind === 'status' && confirm.next === 'paused'
            ? 'danger'
            : confirm?.kind === 'pages' && confirm.mode === 'none'
              ? 'danger'
              : confirm?.kind === 'remove-page'
                ? 'danger'
                : 'default'
        }
        onConfirm={runConfirmed}
      />
    </div>
  );
}
