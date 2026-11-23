import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { AdminRecordControls } from '../../components/superadmin/AdminRecordControls';
import { AdminFactoryTeam } from '../../components/superadmin/AdminFactoryTeam';
import './superadmin-manufacturer-detail.css';
import { FactoryOnboardingChecklist } from './FactoryOnboardingChecklist';
import { FactoryVerificationPanel } from '../../components/manufacturer/FactoryVerificationPanel';
import { displayMoney,useCurrency,sumConvertedMinor,formatAccountTotal } from '../../lib/accountCurrency';
import { useEffect, useMemo, useState, useRef } from 'react';
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
import { STATUS_LABELS, formatMoney } from '../../data/superadminMock';
import { adminPatchManufacturerProfile, getPlatformSetting, setPlatformSetting } from '../../lib/superadminDb';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';
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

function defaultManufacturerAccess(userId: string): ProfileAccessConfig {
  return {
    userId,
    audience: 'manufacturers',
    roleLabel: 'Manufacturer',
    enabledPages: PAGE_ACCESS.manufacturers.map((p) => p.id),
    manufacturerPlanId: MANUFACTURER_PLANS[0]?.id ?? 'standard',
  };
}

const ACTIVE_ORDER_STATUSES = new Set([
  'assigned',
  'priced',
  'pending_review',
  'sent_to_brand',
  'paid',
  'in_production',
  'shipped',
]);

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
  return new Date(iso).toLocaleDateString(cerigaLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SuperAdminManufacturerDetail() {
  useCerigaTranslation();

  useCurrency();
  const { id } = useParams<{ id: string }>();
  const { manufacturerList, orders, loading, refresh } = useSuperadminData();
  const seed = id ? manufacturerList.find((m) => m.userId === id) : undefined;
  const pages = PAGE_ACCESS.manufacturers;

  const saveLock=useRef(false);
  const [accessError,setAccessError]=useState('');
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ManufacturerStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [garmentTypes, setGarmentTypes] = useState<GarmentCategory[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certDraft, setCertDraft] = useState('');
  const [savedAccess,setSavedAccess]=useState<ProfileAccessConfig|null>(null);
  const [config, setConfig] = useState<ProfileAccessConfig | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMatching, setSavedMatching] = useState({
    garmentTypes: [] as GarmentCategory[],
    specialties: [] as string[],
    certifications: [] as string[],
  });

  useEffect(() => {
    if (!id || !seed) return;
    let cancelled = false;
    void (async () => {
      const existing = getProfileAccess(id);
      let access = existing ? { ...existing } : defaultManufacturerAccess(id);
      try {
        const remote = await getPlatformSetting<ProfileAccessConfig>(`crm_access_${id}`);
        if (remote?.userId === id) access = remote;
      } catch(cause) {
        if(!cancelled)setAccessError(cause instanceof Error?cause.message:'Could not load manufacturer settings.');
        return;
      }
      if (cancelled) return;
      setStatus(seed.status);
      setNotes(seed.internalNotes);
      setGarmentTypes([...(seed.garmentTypes as GarmentCategory[])]);
      setSpecialties([...seed.specialties]);
      setCertifications([...seed.certifications]);
      setConfig(access);
      setSavedAccess(access);
      setSavedMatching({
        garmentTypes: [...(seed.garmentTypes as GarmentCategory[])],
        specialties: [...seed.specialties],
        certifications: [...seed.certifications],
      });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, seed]);

  const produceDirty =
    !sameList(garmentTypes, savedMatching.garmentTypes) ||
    !sameList(specialties, savedMatching.specialties);
  const certsDirty = !sameList(certifications, savedMatching.certifications);

  const enabledSet = useMemo(
    () => new Set(config?.enabledPages ?? []),
    [config?.enabledPages],
  );

  const manufacturerOrders = useMemo(() => {
    if (!id) return [];
    return orders
      .filter((o) => o.manufacturerId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, id]);

  const orderStats = useMemo(() => {
    return {
      totalOrders: manufacturerOrders.length,
      activeOrders: manufacturerOrders.filter((o) => ACTIVE_ORDER_STATUSES.has(o.status)).length,
      completedOrders: manufacturerOrders.filter((o) => o.status === 'completed').length,
    };
  }, [manufacturerOrders]);

  if(accessError)return <div className="manufacturer-detail md-load-error" role="alert"><h1>{cerigaTranslate("interface.text_55862eb9ff3eb1a2")}</h1><p>{cerigaTranslateLabel(accessError)}</p><button onClick={()=>window.location.reload()}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button></div>;
  if (loading || (seed && !hydrated)) {
    return <PageLoadingFallback />;
  }

  if (!id || !seed || !config || !status) {
    return <Navigate to="/superadmin/manufacturers" replace />;
  }

  const profile = seed;
  const recentOrders = manufacturerOrders.slice(0, 8);
  const margin = resolveMarginForPlan(config.manufacturerPlanId);
  const quotedValue=sumConvertedMinor(manufacturerOrders.filter(o=>o.manufacturerQuoteCents!=null).map(o=>({cents:o.manufacturerQuoteCents!,currency:o.manufacturerCurrency})));

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

  const persistAccess = async (nextConfig: ProfileAccessConfig) => {
    await setPlatformSetting(`crm_access_${nextConfig.userId}`, nextConfig);
    upsertProfileAccess(nextConfig);
    setSavedAccess(nextConfig);
  };

  const runConfirmed = async () => {
    if (!confirm || !config || saveLock.current) return;
    if (confirm.kind === 'status') {
      setStatus(confirm.next);
      setConfirm(null);
      return;
    }
    if (confirm.kind === 'pages') {
      setConfig({
        ...config,
        enabledPages: confirm.mode === 'all' ? pages.map((p) => p.id) : [],
      });
      setConfirm(null);
      return;
    }

    saveLock.current=true;setSaving(true);
    try {
      if (confirm.kind === 'save') {
        await commitSave();
      } else if (confirm.kind === 'remove-page') {
        const nextConfig = {
          ...config,
          enabledPages: config.enabledPages.filter((pid) => pid !== confirm.pageId),
        };
        setConfig(nextConfig);
        await persistAccess(nextConfig);
        toast.success(cerigaTranslate("interface.text_0803456fafd0e5ab",{value0:(confirm.pageLabel)}));
      } else if (confirm.kind === 'save-produce') {
        if (garmentTypes.length === 0) {
          toast.error(cerigaTranslate("interface.text_cfe36394bca21e3c"));
          return;
        }
        await adminPatchManufacturerProfile(profile.userId, {
          garments: garmentTypes,
          specialties,
        });
        setSavedMatching((prev) => ({
          ...prev,
          garmentTypes: [...garmentTypes],
          specialties: [...specialties],
        }));
        await refresh();
        toast.success(cerigaTranslate("interface.text_227b4d765c8bb618"));
      } else if (confirm.kind === 'save-certs') {
        await adminPatchManufacturerProfile(profile.userId, { certifications });
        setSavedMatching((prev) => ({
          ...prev,
          certifications: [...certifications],
        }));
        await refresh();
        toast.success(cerigaTranslate("interface.text_7c63a67c956770c4"));
      }
    } catch (err) {
      toast.error(cerigaTranslateLabel(err instanceof Error ? err.message : cerigaTranslate("interface.text_53ad6f999b1f062f")));
    } finally {
      saveLock.current=false;setSaving(false);
      setConfirm(null);
    }
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
      toast.message(cerigaTranslate("interface.text_eefc26c697134998"));
      return;
    }
    setSpecialties((prev) => [...prev, value]);
    setSpecialtyDraft('');
    toast.message(cerigaTranslate("interface.text_e57a39f6e0bdf386"));
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
      toast.message(cerigaTranslate("interface.text_eefc26c697134998"));
      return;
    }
    setCertifications((prev) => [...prev, value]);
    setCertDraft('');
    toast.message(cerigaTranslate("interface.text_5790a8f8b42fce8c"));
  };

  const commitSave = async () => {
    if (garmentTypes.length === 0) {
      toast.error(cerigaTranslate("interface.text_cfe36394bca21e3c"));
      return;
    }
    if (pendingPlanId) {
      toast.error(cerigaTranslate("interface.text_b1ad0c3d28190213"));
      return;
    }
    await adminPatchManufacturerProfile(profile.userId, {
      status,
      internalNotes: notes.trim(),
      garments: garmentTypes,
      specialties,
      certifications,
    });
    await persistAccess(config);
    setSavedMatching({
      garmentTypes: [...garmentTypes],
      specialties: [...specialties],
      certifications: [...certifications],
    });
    await refresh();
    toast.success(cerigaTranslate("interface.text_27b34241bec64d7f",{value0:(profile.name)}));
  };

  const save = () => {
    if (garmentTypes.length === 0) {
      toast.error(cerigaTranslate("interface.text_cfe36394bca21e3c"));
      return;
    }
    if (pendingPlanId) {
      toast.error(cerigaTranslate("interface.text_b1ad0c3d28190213"));
      return;
    }
    setConfirm({ kind: 'save' });
  };

  const confirmPlanChange = () => {
    if (!pendingPlanId || !config) return;
    setConfig({ ...config, manufacturerPlanId: pendingPlanId });
    setPendingPlanId(null);
    toast.message(cerigaTranslate("interface.text_c9899b7356f4453c"));
  };

  const pendingPlan = pendingPlanId
    ? MANUFACTURER_PLANS.find((p) => p.id === pendingPlanId)
    : undefined;
  const currentPlan = MANUFACTURER_PLANS.find((p) => p.id === config?.manufacturerPlanId);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      toast.success(cerigaTranslate("interface.text_28411e5e86b6fea2"));
    } catch {
      toast.error(cerigaTranslate("interface.text_a623297fd0546ca6"));
    }
  };

  return (
    <div className="manufacturer-detail space-y-6">
      <Link
        to="/superadmin/manufacturers"
        className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />{cerigaTranslate("nav.manufacturers")}</Link>

      <header className="md-header">
        <div className="md-identity"><span className="md-avatar">{initials(profile.name)}</span><div><p className="md-eyebrow">{cerigaTranslate("interface.text_b525d84ea5003ce2")}</p><h1>{profile.name}</h1><div className="md-contact"><a href={'mailto:'+profile.email}>{profile.email}</a><button type="button" onClick={copyEmail} aria-label={cerigaTranslate("interface.text_1449d5fb47172cac")}><Copy size={14}/></button>{[profile.location,profile.country].filter(v=>v&&v!=='—').length>0&&<span>{[profile.location,profile.country].filter(v=>v&&v!=='—').join(', ')}</span>}</div><div className="md-meta"><span className="md-status">{status.charAt(0).toUpperCase()+status.slice(1)}</span><span>{margin.platformMarginPercent}{cerigaTranslate("interface.text_e1fec1faba4a3695")}</span><span>{cerigaTranslate("interface.text_bcdf701c4dfbaee3")}{" "}{formatDate(profile.lastActive)}</span></div></div></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AdminRecordControls entity="manufacturer" id={id} onSaved={refresh} />
          <Button type="button" disabled={saving||(!produceDirty&&!certsDirty&&notes.trim()===(profile.internalNotes||'').trim()&&status===profile.status&&JSON.stringify(config)===JSON.stringify(savedAccess))} onClick={save} className="md-save">{saving?cerigaTranslate("common.saving"):cerigaTranslate("common.saveChanges")}</Button>
        </div>
      </header>
      {profile.status === 'onboarding' && <FactoryOnboardingChecklist key={id} manufacturerId={id} />}
      <section className="md-stats" aria-label={cerigaTranslate("interface.text_8172b7fca7e84cf6")}>{[
        {label:'Active orders',value:orderStats.activeOrders,hint:cerigaTranslate("interface.text_bbe9b7a0fa6d4fa9",{value0:(orderStats.totalOrders)})},
        {label:'Completed orders',value:orderStats.completedOrders,hint:'All time'},
        {label:'Monthly capacity',value:profile.capacityUnitsPerMonth?.toLocaleString()||'—',hint:'Units · reported by factory'},
        {label:'Lead time',value:profile.leadTimeDays?cerigaTranslate("interface.text_707dcea8eeedebe3",{value0:(profile.leadTimeDays)}):'—',hint:cerigaTranslate("interface.text_01cc0d8f04542d47",{value0:(profile.moq||cerigaTranslate("interface.text_d83b9ff3c07a8390"))})},
      ].map(stat=><div key={stat.label}><span>{cerigaTranslateLabel(stat.label)}</span><strong>{stat.value}</strong><small>{cerigaTranslateLabel(stat.hint)}</small></div>)}</section>
      <div className="md-quote-summary"><span>{cerigaTranslate("interface.text_42317bd2545df0b4")}</span><strong>{quotedValue===undefined?cerigaTranslate("interface.text_ca184496974204a0"):formatAccountTotal(quotedValue)}</strong><span>{quotedValue===undefined?cerigaTranslate("interface.text_a4c7afd87d1d5fe2"):cerigaTranslate("interface.text_4783a176a1f87550")}</span></div>
      <FactoryVerificationPanel admin manufacturerId={id}/>
      {id && <AdminFactoryTeam key={id} factoryId={id} />}

      {/* Order matching — primary control for auto-assign */}
      <section className="rounded-2xl border border-amber-500/20 bg-[#111113] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <Link2 className="h-4 w-4 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_aaec53ef5ee2d1d2")}</h2>
            <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_103951468f2c090f")}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_359fb837e59faec7")}</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_GARMENT_CATEGORIES.map((g) => {
              const on = garmentTypes.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  disabled={saving}
                  onClick={() => toggleGarment(g)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                    on
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                      : 'border-[#252528] bg-white/[0.02] text-white/40 hover:text-white/70',
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>
          {garmentTypes.length === 0 ? (
            <p className="mt-2 text-[11px] text-[#CC2D24]">{cerigaTranslate("interface.text_9074def2057972b4")}</p>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_a187548574120567")}</p>
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-md border border-[#252528] bg-white/[0.04] py-0.5 pl-2 pr-1 text-[11px] text-white/70"
              >
                {s}
                <button
                  type="button"
                  onClick={() => setSpecialties((prev) => prev.filter((x) => x !== s))}
                  className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white"
                  aria-label={cerigaTranslate("interface.text_e224cf245aada55a",{value0:(s)})}
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
              aria-label={cerigaTranslate("interface.text_0b79464b7bb5a311")}
              placeholder={cerigaTranslate("interface.text_da3f7841f2913975")}
              className="h-9 border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30"
            />
            <Button
              type="button"
              variant="outline"
              aria-label={cerigaTranslate("interface.text_0b79464b7bb5a311")}
              disabled={saving}
              onClick={addSpecialty}
              className="h-9 shrink-0 border-white/15 bg-transparent px-3 text-white hover:bg-white/5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-[#252528] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/40">
            {produceDirty
              ? cerigaTranslate("interface.text_7ae220f275f1fc67")
              : cerigaTranslate("interface.text_1487a207572ef8db")}
          </p>
          <Button
            type="button"
            disabled={saving||!produceDirty}
            className="h-9 bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40"
            onClick={() => setConfirm({ kind: 'save-produce' })}
          >{cerigaTranslate("interface.text_a0b9211183a952fd")}</Button>
        </div>
      </section>

      {/* Certifications */}
      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <BadgeCheck className="h-4 w-4 text-emerald-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_471502f86c773c59")}</h2>
            <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_d82b1a5480aba856")}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {COMMON_CERTIFICATIONS.map((cert) => {
            const on = certifications.includes(cert);
            return (
              <button
                key={cert}
                type="button"
                aria-pressed={on}
                disabled={saving}
                onClick={() => toggleCertification(cert)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                  on
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-[#252528] bg-white/[0.02] text-white/40 hover:text-white/70',
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
                title={cerigaTranslate("interface.text_82e24c1817319d18")}
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
            aria-label={cerigaTranslate("interface.text_23488c64d999a404")}
            placeholder={cerigaTranslate("interface.text_a4e79be131c92de1")}
            className="h-9 border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30"
          />
          <Button
            type="button"
            variant="outline"
            aria-label={cerigaTranslate("interface.text_5fec0dc796ec8ca7")}
            disabled={saving}
            onClick={addCertification}
            className="h-9 shrink-0 border-white/15 bg-transparent px-3 text-white hover:bg-white/5"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-[#252528] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/40">
            {certsDirty
              ? cerigaTranslate("interface.text_c6e0e4b5091b414a")
              : cerigaTranslate("interface.text_4f038e6cae17d397")}
          </p>
          <Button
            type="button"
            disabled={saving||!certsDirty}
            className="h-9 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
            onClick={() => setConfirm({ kind: 'save-certs' })}
          >{cerigaTranslate("interface.text_a7e3d804779b7cce")}</Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Controls column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#CC2D24]/15">
                <Shield className="h-4 w-4 text-[#CC2D24]" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_4c9f2dba0e22839d")}</h2>
                <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_c2120a1767e84d05")}</p>
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
                <SelectContent className="md-select-menu border-[#252528] bg-[#161618] text-white">
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {cerigaTranslateLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <dl className="mt-4 space-y-2 text-[12px] text-white/45">
              <div className="flex justify-between gap-3">
                <dt>{cerigaTranslate("interface.text_4cfaa9df90c53d55")}</dt>
                <dd className="text-white/70">{profile.leadTimeDays}{" "}{cerigaTranslate("interface.text_ab51004e9d71a485")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{cerigaTranslate("interface.text_69318b0c6a928e7e")}</dt>
                <dd className="text-white/70">{formatDate(profile.joinedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_e01ca5b9a44d6c6f")}</h2>
            <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_7fce93417fd30c30")}</p>
            <div className="mt-4 space-y-2">
              {MANUFACTURER_PLANS.map((plan) => {
                const active = config.manufacturerPlanId === plan.id && !pendingPlanId;
                const pending = pendingPlanId === plan.id;
                const planMargin = resolveMarginForPlan(plan.id);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    data-plan-state={pending?'pending':active?'active':'idle'}
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
                          : 'border-[#252528] bg-black/20 hover:border-white/15',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{plan.name}</span>
                      <span className="text-[10px] text-white/40">{plan.monthlyFee}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-200/85">
                      {plan.commission}{" "}{cerigaTranslate("interface.text_398bd088b766da4b")}{" "}{planMargin.platformMarginPercent}{cerigaTranslate("interface.text_e1fec1faba4a3695")}</p>
                    {active&&<p className="md-current-plan">{cerigaTranslate("interface.text_37ca715f53b6bb83")}</p>}
                    {pending ? (
                      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">{cerigaTranslate("interface.text_574305a4811bbbf2")}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {pendingPlan && currentPlan ? (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                <p className="text-[12px] text-amber-100/90">{cerigaTranslate("interface.text_ce870f2d028966f6")}{" "}<span className="font-semibold">{currentPlan.name}</span>{' '}{cerigaTranslate("interface.text_663ea1bfffe5038f")}{" "}<span className="font-semibold">{pendingPlan.name}</span>{cerigaTranslate("interface.text_2598954d0d802354")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-white/15 bg-transparent text-white hover:bg-white/5"
                    onClick={() => setPendingPlanId(null)}
                  >{cerigaTranslate("common.cancel")}</Button>
                  <Button
                    type="button"
                    className="h-9 bg-amber-500 text-black hover:bg-amber-400"
                    onClick={confirmPlanChange}
                  >{cerigaTranslate("interface.text_d80926e20d999917")}</Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_3498e4d5ff8b2db7")}</h2>
            <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_fa271149e3b13eab")}</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-4 min-h-[120px] border-white/15 bg-white/5 text-sm text-white placeholder:text-white/30"
              placeholder={cerigaTranslate("interface.text_d0e64a06e123ccca")}
            />
          </section>

        </div>

        {/* Access + orders */}
        <div className="space-y-6 lg:col-span-3">


          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_30aca3928c340c4e")}</h2>
                <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_fdb63c43d583e849")}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={() => setConfirm({ kind: 'pages', mode: 'all' })}
                >{cerigaTranslate("interface.text_06f08e7c2f8a8c00")}</button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-white/40 hover:text-white/70"
                  onClick={() => setConfirm({ kind: 'pages', mode: 'none' })}
                >{cerigaTranslate("interface.text_29a390f9237e3c84")}</button>
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
                        : 'border-[#252528] bg-black/20',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{cerigaTranslateLabel(page.label)}</p>
                      <p className="text-[11px] text-white/40">{page.description}</p>
                    </div>
                    <Switch checked={on} onCheckedChange={(v) => togglePage(page.id, v)} />
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_50899514a0528ca6")}</h2>
                <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_2bb6e76273f2e36f")}</p>
              </div>
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-transparent text-white hover:bg-white/5"
              >
                <Link to="/superadmin/orders">
                  <Mail className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_bf98116896a845a3")}</Link>
              </Button>
            </div>

            {recentOrders.length === 0 ? (
              <p className="mt-6 text-sm text-white/40">{cerigaTranslate("interface.text_db57d62000605cb9")}</p>
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
                          {order.id} · {order.userName} · {cerigaTranslateLabel(STATUS_LABELS[order.status])}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-[12px] tabular-nums text-white/55">
                        {order.manufacturerQuoteCents != null
                          ? displayMoney(order.manufacturerQuoteCents,order.quoteTiers?.[0]?.currency)
                          : cerigaTranslate("adminOrders.awaitQuote")}
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
            ? cerigaTranslate("interface.text_df9ed93ded38bb3a")
            : confirm?.kind === 'remove-page'
              ? cerigaTranslate("interface.text_f4a75ac94a2701bd",{value0:(confirm.pageLabel)})
              : confirm?.kind === 'save-produce'
                ? cerigaTranslate("interface.text_19848d7f90283941")
                : confirm?.kind === 'save-certs'
                  ? cerigaTranslate("interface.text_7497a8467b055644")
                  : confirm?.kind === 'pages'
                    ? confirm.mode === 'all'
                      ? cerigaTranslate("interface.text_4213cf84c7d9c815")
                      : cerigaTranslate("interface.text_a2ebd60d66f72932")
                    : cerigaTranslate("interface.text_80c258efd7e565a0")
        }
        description={
          confirm?.kind === 'status'
            ? cerigaTranslate("interface.text_fb5bceaabf7591c4",{value0:(confirm.next)})
            : confirm?.kind === 'remove-page'
              ? cerigaTranslate("interface.text_c760aad10999683e",{value0:(confirm.pageLabel)})
              : confirm?.kind === 'save-produce'
                ? cerigaTranslate('interface.confirmRouting',{value0:profile.name,value1:garmentTypes.length,value2:specialties.length})
                : confirm?.kind === 'save-certs'
                  ? cerigaTranslate('interface.confirmCertifications',{value0:certifications.length})
                  : confirm?.kind === 'pages'
                    ? confirm.mode === 'all'
                      ? cerigaTranslate("interface.text_25f083e9b6bd077b")
                      : cerigaTranslate("interface.text_955c3e817d033c78")
                    : cerigaTranslate("interface.text_1148468a16e43431",{value0:(profile.name)})
        }
        confirmLabel={
          confirm?.kind === 'save' ||
          confirm?.kind === 'remove-page' ||
          confirm?.kind === 'save-produce' ||
          confirm?.kind === 'save-certs'
            ? cerigaTranslate("common.saveChanges")
            : confirm?.kind === 'pages' && confirm.mode === 'none'
              ? cerigaTranslate("interface.text_29a390f9237e3c84")
              : cerigaTranslate("common.confirm")
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
        onConfirm={() => void runConfirmed()}
      />
    </div>
  );
}
