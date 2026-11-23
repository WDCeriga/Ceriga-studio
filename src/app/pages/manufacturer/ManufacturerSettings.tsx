import {FactoryShippingDefaults} from '../../components/manufacturer/FactoryShippingDefaults';
import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { LanguageSelect, Translate } from '../../i18n/LanguageProvider';
import {ProductionTimelineEditor} from '../../components/manufacturer/ProductionTimelineEditor';
import { readSavedOnboardingLeadTimes } from '../../hooks/useManufacturerLeadTimes';
import { loadCustomisationSettingsFromDb, saveCustomisationSettingsToDb } from '../../data/manufacturerCustomisationDb';
import { loadCompleteManufacturerProfile, saveCompleteManufacturerProfile } from '../../data/manufacturerOnboardingStore';
import { saveMyManufacturerProfile } from '../../data/manufacturerDb';
import { isSupabaseConfigured,getSupabase } from '../../lib/supabaseClient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Factory,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_FACTORY_CAPABILITIES,
  ALL_FACTORY_GARMENTS,
  FACTORY_SHIPPING_REGION_OPTIONS,
  getFactoryWorkspace,
  type FactoryCapability,
  type FactoryGarment,
  type FactoryWorkspace,
} from '../../data/manufacturerPortalMock';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '../../components/ui/dialog';
import '../../components/dashboard/manufacturer-dashboard.css';
import '../../components/manufacturer/manufacturer-settings.css';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';
import { Link, useLocation, useParams } from 'react-router';
import { factoryManagementPages, factoryPageAllowed, useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { ManufacturerFactoryProfile } from './ManufacturerFactoryProfile';
import { Sparkles } from 'lucide-react';
import { ManufacturerCurrencySettings } from '../../components/manufacturer/ManufacturerCurrencySettings';

type ProfileDraft = {
  factoryName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  addressLine: string;
  garments: FactoryGarment[];
  capabilities: FactoryCapability[];
  regions: string[];
  moq: string;
  capacity: string;
  typicalLeadDays: string;
  sampleLeadTimeMinDays: string;
  sampleLeadTimeMaxDays: string;
  bulkLeadTimeMinDays: string;
  bulkLeadTimeMaxDays: string;
  notes: string;
};

function draftFromWorkspace(ws: FactoryWorkspace): ProfileDraft {
  return {
    factoryName: ws.factoryName,
    contactName: ws.contactName,
    contactEmail: ws.contactEmail,
    contactPhone: ws.contactPhone ?? '',
    website: ws.website ?? '',
    addressLine: ws.addressLine ?? '',
    garments: [...ws.garments],
    capabilities: [...ws.capabilities],
    regions: [...ws.shippingRegions],
    moq: String(ws.moq),
    capacity: String(ws.monthlyCapacity),
    typicalLeadDays: String(ws.typicalLeadDays ?? 21),
    sampleLeadTimeMinDays: String(readSavedOnboardingLeadTimes()?.sampleLeadTimeMinDays ?? ''),
    sampleLeadTimeMaxDays: String(readSavedOnboardingLeadTimes()?.sampleLeadTimeMaxDays ?? ''),
    bulkLeadTimeMinDays: String(readSavedOnboardingLeadTimes()?.bulkLeadTimeMinDays ?? ''),
    bulkLeadTimeMaxDays: String(readSavedOnboardingLeadTimes()?.bulkLeadTimeMaxDays ?? ''),
    notes: ws.internalNotes,
  };
}

function sameSorted(a: string[], b: string[]) {
  const aa = [...a].sort();
  const bb = [...b].sort();
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function describeChanges(before: ProfileDraft, after: ProfileDraft): string[] {
  const lines: string[] = [];
  if (before.factoryName !== after.factoryName) lines.push('Factory display name');
  if (before.contactName !== after.contactName) lines.push('Primary contact name');
  if (before.contactEmail !== after.contactEmail) lines.push('Contact email');
  if (before.contactPhone !== after.contactPhone) lines.push('Phone');
  if (before.website !== after.website) lines.push('Website');
  if (before.addressLine !== after.addressLine) lines.push('Address');
  if (!sameSorted(before.garments, after.garments)) {
    lines.push(
      `Garment types (${before.garments.length} → ${after.garments.length}) — affects Ceriga matching`,
    );
  }
  if (!sameSorted(before.capabilities, after.capabilities)) {
    lines.push(
      `Capabilities (${before.capabilities.length} → ${after.capabilities.length}) — affects matching`,
    );
  }
  if (!sameSorted(before.regions, after.regions)) lines.push('Shipping regions');
  if (before.moq !== after.moq) lines.push(`MOQ (${before.moq} → ${after.moq})`);
  if (before.capacity !== after.capacity) {
    lines.push(`Monthly capacity (${before.capacity} → ${after.capacity})`);
  }
  if (before.typicalLeadDays !== after.typicalLeadDays) {
    lines.push(`Typical lead time (${before.typicalLeadDays} → ${after.typicalLeadDays} days)`);
  }
  for(const field of ['sampleLeadTimeMinDays','sampleLeadTimeMaxDays','bulkLeadTimeMinDays','bulkLeadTimeMaxDays'] as const) {
    if(before[field]!==after[field]) lines.push(field.startsWith('sample')?'Sample lead time':'Bulk lead time');
  }
  if (before.notes !== after.notes) lines.push('Internal ops notes');
  return lines;
}

const settingsPages = [
  { id: 'identity', label: 'Identity & contact' },
  { id: 'products', label: 'Products & capabilities' },
  { id: 'logistics', label: 'Capacity & logistics' },
  { id: 'production-timeline', label: 'Turnaround timeline' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'profile', label: 'Factory profile' },
] as const;

type ProfileSection = 'identity' | 'products' | 'logistics';

export function ManufacturerSettings() {
  useCerigaTranslation();

  const { section } = useParams();
  const { hash } = useLocation();
  const { access } = useFactoryAccess();
  const permissions = access?.permissions ?? [];
  const canManageSettings = !isSupabaseConfigured || permissions.includes('settings');
  const canViewProfile = !isSupabaseConfigured || permissions.includes('portfolio') || permissions.includes('verification');
  const availablePages = settingsPages.filter(page => page.id === 'profile' ? canViewProfile : canManageSettings);
  const selected = availablePages.find(page => page.id === (section ?? hash.slice(1))) ?? availablePages[0];
  const managementPages = factoryManagementPages.filter(page => !isSupabaseConfigured || factoryPageAllowed(page.path, permissions));
  if (!selected && !managementPages.length) return <p role="alert">{cerigaTranslate("interface.text_26c849b5c3f4397d")}</p>;

  const active = selected?.id;
  const profileSection = active === 'identity' || active === 'products' || active === 'logistics' ? active : undefined;
  return (
    <div className="factory-home settings-workspace">
      <header className="settings-workspace-heading">
        <h1><Translate k="nav.settings" /></h1>
        {canManageSettings && <Link className="settings-onboarding-link" to="/manufacturer/onboarding"><Sparkles size={14} aria-hidden />{cerigaTranslate("interface.text_fd93d8681624eff0")}</Link>}
      </header>
      {!!availablePages.length && <nav className="settings-page-nav" aria-label={cerigaTranslate("interface.text_e26d51d36781ba17")}>
        {availablePages.map(page => (
          <Link key={page.id} to={'/manufacturer/settings/' + page.id} aria-current={page.id === active ? 'page' : undefined}>{cerigaTranslateLabel(page.label)}</Link>
        ))}
      </nav>}
      {active === 'profile' && <ManufacturerFactoryProfile embedded />}
      {active === 'production-timeline' && <div className="factory-settings settings-timeline"><ProductionTimelineEditor /></div>}
      {active === 'preferences' && <section className="factory-settings settings-panel settings-preferences" aria-label={cerigaTranslate("interface.text_ed7177cc99ea8daf")}><ManufacturerCurrencySettings embedded /><div className="py-3"><LanguageSelect preference /></div></section>}
      {canManageSettings && <ManufacturerSettingsEditor section={profileSection} />}
      {canManageSettings && active==='logistics' && <FactoryShippingDefaults key={access?.factoryId}/> }
      {!!managementPages.length && <section className="settings-management" aria-labelledby="factory-management">
        <h2 id="factory-management" className="settings-management-title"><Translate k="manufacturer.management" /></h2>
        <div className="settings-management-links">
          {managementPages.map(page => <Link key={page.path} to={page.path} className="settings-management-link">
            <strong className="settings-management-label">{cerigaTranslateLabel(page.label)} <span aria-hidden="true">↗</span></strong>
            <span className="settings-management-description">{cerigaTranslateLabel(page.description)}</span>
          </Link>)}
        </div>
      </section>}
    </div>
  );
}

export function ManufacturerSettingsEditor({ section }: { section?: ProfileSection }) {
  useCerigaTranslation();

  const edited=useRef(false),saveLock=useRef(false);
  const [saving,setSaving]=useState(false),[loading,setLoading]=useState(isSupabaseConfigured),[saveError,setSaveError]=useState(''),[loadFailed,setLoadFailed]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{let current=true;if(!isSupabaseConfigured){setLoadFailed(true);setSaveError('Connect to the database to load factory settings.');setLoading(false);return;}setLoading(true);setLoadFailed(false);void (async()=>{try{const {data:{user},error:authError}=await getSupabase().auth.getUser();if(authError||!user)throw Error(authError?.message||'Sign in to load your factory profile');const {data,error}=await getSupabase().rpc('factory_workspace_profile');if(error)throw Error(error.message);if(!data)throw Error('Your factory profile was not returned.');const timings=await loadCustomisationSettingsFromDb();if(current)setSaveError('');if(current&&data&&!edited.current){const next=draftFromWorkspace({...getFactoryWorkspace(),factoryName:data.factory_name,contactName:data.contact_name||'',contactEmail:data.contact_email||user.email||'',contactPhone:data.contact_phone,website:data.website,addressLine:data.address_line,garments:data.garments||[],capabilities:data.capabilities||[],shippingRegions:data.shipping_regions||[],moq:data.moq,monthlyCapacity:data.monthly_capacity,typicalLeadDays:data.typical_lead_days,internalNotes:data.internal_notes||''});for(const field of ['sampleLeadTimeMinDays','sampleLeadTimeMaxDays','bulkLeadTimeMinDays','bulkLeadTimeMaxDays'] as const){if(timings?.[field]!=null)next[field]=String(timings[field]);}setDraft(next);setBaseline(next);}}catch(cause){if(current){setSaveError((cause as Error).message);setLoadFailed(true);};}finally{if(current)setLoading(false);}})();return()=>{current=false;};},[reload]);
  const [tick, setTick] = useState(0);
  const saved = useMemo(() => getFactoryWorkspace(), [tick]);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromWorkspace(getFactoryWorkspace()));
  const [baseline, setBaseline] = useState<ProfileDraft>(() =>
    draftFromWorkspace(getFactoryWorkspace()),
  );
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingToggleOff, setPendingToggleOff] = useState<
    | { kind: 'garment'; value: FactoryGarment }
    | { kind: 'capability'; value: FactoryCapability }
    | null
  >(null);

  const changeLines = describeChanges(baseline, draft);
  const dirty = changeLines.length > 0;

  const patch = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    edited.current=true;setDraft((d) => ({ ...d, [key]: value }));
  };

  const requestToggleGarment = (g: FactoryGarment) => {
    const on = draft.garments.includes(g);
    if (on) {
      if (draft.garments.length <= 1) {
        toast.error(cerigaTranslate("interface.text_a9c6b603c272b390"));
        return;
      }
      setPendingToggleOff({ kind: 'garment', value: g });
      return;
    }
    patch('garments', [...draft.garments, g]);
  };

  const requestToggleCapability = (c: FactoryCapability) => {
    const on = draft.capabilities.includes(c);
    if (on) {
      if (draft.capabilities.length <= 1) {
        toast.error(cerigaTranslate("interface.text_3ca5f16c205ff79e"));
        return;
      }
      setPendingToggleOff({ kind: 'capability', value: c });
      return;
    }
    patch('capabilities', [...draft.capabilities, c]);
  };

  const confirmToggleOff = () => {
    if (!pendingToggleOff) return;
    if (pendingToggleOff.kind === 'garment') {
      patch(
        'garments',
        draft.garments.filter((x) => x !== pendingToggleOff.value),
      );
    } else {
      patch(
        'capabilities',
        draft.capabilities.filter((x) => x !== pendingToggleOff.value),
      );
    }
    setPendingToggleOff(null);
  };

  const toggleRegion = (region: string) => {
    edited.current=true;
    setDraft((d) => ({
      ...d,
      regions: d.regions.includes(region)
        ? d.regions.filter((r) => r !== region)
        : [...d.regions, region],
    }));
  };

  const requestSave = () => {
    if(saving||loading||loadFailed||saveLock.current)return;
    if (draft.garments.length === 0) {
      toast.error(cerigaTranslate("interface.text_a9c6b603c272b390"));
      return;
    }
    if (draft.capabilities.length === 0) {
      toast.error(cerigaTranslate("interface.text_3ca5f16c205ff79e"));
      return;
    }
    if (!draft.factoryName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail.trim())) {
      toast.error(cerigaTranslate("interface.text_74c8a2e9490cd13c"));
      return;
    }
    const moqN = Number(draft.moq);
    const capN = Number(draft.capacity);
    if (!Number.isSafeInteger(moqN) || moqN <= 0 || !Number.isSafeInteger(capN) || capN <= 0) {
      toast.error(cerigaTranslate("interface.text_513b8a46b4337175"));
      return;
    }
    for(const kind of ['sample','bulk'] as const){
      const minimum=Number(kind==='sample'?draft.sampleLeadTimeMinDays:draft.bulkLeadTimeMinDays);
      const maximum=Number(kind==='sample'?draft.sampleLeadTimeMaxDays:draft.bulkLeadTimeMaxDays);
      if(![minimum,maximum].every(value=>Number.isInteger(value)&&value>=1&&value<=3650)||minimum>maximum){toast.error(cerigaTranslate("interface.text_385061c5761e53a9",{value0:(cerigaTranslateLabel(kind))}));return;}
    }
    if (!dirty) {
      toast.message(cerigaTranslate("interface.text_d608d0f6535490fc"));
      return;
    }
    setSaveConfirmOpen(true);
  };

  const save = async () => {
    if(saveLock.current||loading||loadFailed)return false;saveLock.current=true;setSaving(true);setSaveError('');
    try{await saveMyManufacturerProfile({
      factoryName: draft.factoryName.trim(),
      contactName: draft.contactName.trim(),
      contactEmail: draft.contactEmail.trim(),
      contactPhone: draft.contactPhone.trim(),
      website: draft.website.trim(),
      addressLine: draft.addressLine.trim(),
      garments: draft.garments,
      capabilities: draft.capabilities,
      shippingRegions: draft.regions,
      moq: Number(draft.moq) || 50,
      monthlyCapacity: Number(draft.capacity),
      typicalLeadDays: Number(draft.typicalLeadDays) || 21,
      internalNotes: draft.notes.trim(),
    });
    const local=loadCompleteManufacturerProfile();
    const remote=await loadCustomisationSettingsFromDb();
    const timings={sampleLeadTimeMinDays:Number(draft.sampleLeadTimeMinDays),sampleLeadTimeMaxDays:Number(draft.sampleLeadTimeMaxDays),bulkLeadTimeMinDays:Number(draft.bulkLeadTimeMinDays),bulkLeadTimeMaxDays:Number(draft.bulkLeadTimeMaxDays)};
    await saveCustomisationSettingsToDb({...local,...remote,...timings});
    saveCompleteManufacturerProfile({...local,...remote,...timings});
    const next = {...draft,garments:[...draft.garments],capabilities:[...draft.capabilities],regions:[...draft.regions]};
    setBaseline(next);
    setDraft(next);
    setTick((n) => n + 1);
    edited.current=false;toast.success(cerigaTranslate("interface.text_707da314fbb7894c"));return true;
    }catch(cause){const message=(cause as Error).message||'Could not save factory profile';setSaveError(message);toast.error(cerigaTranslateLabel(message));return false;}finally{saveLock.current=false;setSaving(false);}
  };

  const discard = () => {
    setDraft({ ...baseline });edited.current=false;
    setDiscardConfirmOpen(false);
    toast.message(cerigaTranslate("interface.text_6fb7a4651054b186"));
  };

  return (
    <div className="factory-settings space-y-6" hidden={!section && !dirty}>

      {saveError&&(section||dirty)&&<div role='alert' className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300'>{cerigaTranslate("interface.text_524c40d1609238a1")}{" "}{cerigaTranslateLabel(saveError)}. {loadFailed?<button onClick={()=>setReload(v=>v+1)}>{cerigaTranslate("interface.text_a187f03ad5d3394b")}</button>:cerigaTranslate("interface.text_b43308d8ddfb6c2c")}</div>}
      {saving&&<p role='status' className='text-sm text-white/60'>{cerigaTranslate("interface.text_7c2122d95e30c191")}</p>}
      {section&&loading&&<p role="status" className="settings-loading">{cerigaTranslate("interface.text_d42959660b952469")}</p>}
      {dirty ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-100">{cerigaTranslate("interface.text_a710c2b90913b537")}</p>
            <p className="mt-0.5 text-[12px] text-amber-100/70">
              {changeLines.slice(0, 3).join(' · ')}
              {changeLines.length > 3 ? cerigaTranslate("interface.text_2d0fb769d251fb94",{value0:(changeLines.length - 3)}) : ''}{cerigaTranslate("interface.text_9e4e5a0d7ee3a7eb")}</p>
          </div>
        </div>
      ) : null}

      {section === 'identity' && <section className="settings-summary rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6" hidden={loading||loadFailed}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#CC2D24]/25 bg-[#CC2D24]/10">
              <Factory className="h-5 w-5 text-[#CC2D24]" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_d4d1871381903540")}</p>
              <h2 className="mt-0.5 text-lg font-semibold text-white">{baseline.factoryName}</h2>
              <p className="mt-1 text-[12px] text-white/45">
                {baseline.contactName} · {baseline.contactEmail}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:text-right">
            <div className="rounded-xl border border-[#252528] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_f5f2441eadb60b03")}</p>
              <p className="text-sm font-semibold text-white">{baseline.moq}</p>
            </div>
            <div className="rounded-xl border border-[#252528] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_ff632f60b9809587")}</p>
              <p className="text-sm font-semibold text-white">
                {Number(baseline.capacity).toLocaleString(cerigaLocale())}
              </p>
            </div>
          </div>
        </div>
      </section>}

      <fieldset className="settings-profile-fields" disabled={loading||saving||loadFailed} hidden={!section||loading||loadFailed}>
      {section === 'identity' && <section id="identity" className="settings-panel rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#CC2D24]" />
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_5345a4105b24ea7c")}</h2>
        </div>
        <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_bb63818db6bcf76f")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="settings-factory-name" className="text-white/45">{cerigaTranslate("interface.text_c06180739239b167")}</Label>
            <Input
              id="settings-factory-name"
              value={draft.factoryName}
              onChange={(e) => patch('factoryName', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label htmlFor="settings-contact-name" className="text-white/45">{cerigaTranslate("interface.text_1700917b69b260e8")}</Label>
            <Input
              id="settings-contact-name"
              value={draft.contactName}
              onChange={(e) => patch('contactName', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label htmlFor="settings-email" className="flex items-center gap-1.5 text-white/45">
              <Mail className="h-3 w-3" />{" "}{cerigaTranslate("authentication.email")}</Label>
            <Input
              type="email"
              id="settings-email"
              value={draft.contactEmail}
              onChange={(e) => patch('contactEmail', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label htmlFor="settings-phone" className="flex items-center gap-1.5 text-white/45">
              <Phone className="h-3 w-3" />{" "}{cerigaTranslate("adminOrders.phone")}</Label>
            <Input
              id="settings-phone"
              value={draft.contactPhone}
              onChange={(e) => patch('contactPhone', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder="+44 …"
            />
          </div>
          <div>
            <Label htmlFor="settings-website" className="flex items-center gap-1.5 text-white/45">
              <Globe2 className="h-3 w-3" />{" "}{cerigaTranslate("interface.text_b5a229ac8becc603")}</Label>
            <Input
              id="settings-website"
              value={draft.website}
              onChange={(e) => patch('website', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder="https://"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="settings-address" className="flex items-center gap-1.5 text-white/45">
              <MapPin className="h-3 w-3" />{" "}{cerigaTranslate("interface.text_c584c473733ab320")}</Label>
            <Input
              id="settings-address"
              value={draft.addressLine}
              onChange={(e) => patch('addressLine', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder={cerigaTranslate("interface.text_4e62fd5a828212e0")}
            />
          </div>
        </div>
      </section>}

      {section === 'products' && <>
      <section id="products" className="settings-panel rounded-2xl border border-[#CC2D24]/20 bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_f9ba8850ed91acf7")}</h2>
        <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_19fe9115f2fb8a16")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_FACTORY_GARMENTS.map((g) => {
            const on = draft.garments.includes(g);
            return (
              <button
                key={g}
                aria-pressed={on}
                type="button"
                onClick={() => requestToggleGarment(g)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                  on
                    ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                    : 'border-[#252528] text-white/40 hover:text-white/70',
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-panel rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_9460f16ac9b5171e")}</h2>
        <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_b6b1016e1b3e1f13")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_FACTORY_CAPABILITIES.map((c) => {
            const on = draft.capabilities.includes(c);
            return (
              <button
                key={c}
                aria-pressed={on}
                type="button"
                onClick={() => requestToggleCapability(c)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                  on
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-[#252528] text-white/40 hover:text-white/70',
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section></>}

      {section === 'logistics' && <section id="logistics" className="settings-panel rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_2a49d131739d2809")}</h2>
        <p className="mt-1 text-[11px] text-white/40">{cerigaTranslate("interface.text_dca948dc0b799f0e")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="settings-moq" className="text-white/45">{cerigaTranslate("interface.text_a2a2e049c2d6dafa")}</Label>
            <Input
              id="settings-moq" type="number" min="1" step="1" inputMode="numeric"
              value={draft.moq}
              onChange={(e) => patch('moq', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="settings-capacity" className="text-white/45">{cerigaTranslate("interface.text_75b46e70907704ca")}</Label>
            <Input
              id="settings-capacity" type="number" min="1" step="1" inputMode="numeric"
              value={draft.capacity}
              onChange={(e) => patch('capacity', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
            />
          </div>

        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(['sample','bulk'] as const).map(kind=><fieldset key={kind} className="rounded-xl border border-white/10 p-4">
            <legend className="px-2 text-sm font-medium text-white">{kind==='sample'?cerigaTranslate("interface.text_dcba673b75bd2fc9"):cerigaTranslate("interface.text_ee922cfee290b84e")}</legend>
            <div className="grid grid-cols-2 gap-3">{(kind==='sample'?['sampleLeadTimeMinDays','sampleLeadTimeMaxDays'] as const:['bulkLeadTimeMinDays','bulkLeadTimeMaxDays'] as const).map((field,index)=><div key={field}>
              <Label htmlFor={field} className="text-xs text-white/45">{index===0?cerigaTranslate("interface.text_735beee2e390c797"):cerigaTranslate("interface.text_66c9ab177708cbc6")}{" "}{cerigaTranslate("interface.text_ab51004e9d71a485")}</Label>
              <Input id={field} type="number" min="1" max="3650" step="1" value={draft[field]} onChange={event=>patch(field,event.target.value)} className="mt-2 border-white/15 bg-white/5 text-white tabular-nums" />
            </div>)}</div>
          </fieldset>)}
        </div>
        <p className="mt-2 text-xs text-white/40">{cerigaTranslate("interface.text_eb92c46d74d11a61")}</p>
        <div className="mt-5">
          <Label className="text-white/45">{cerigaTranslate("interface.text_672e7f6c22947b61")}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {FACTORY_SHIPPING_REGION_OPTIONS.map((region) => {
              const on = draft.regions.includes(region);
              return (
                <button
                  key={region}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRegion(region)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                    on
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                      : 'border-[#252528] text-white/40 hover:text-white/70',
                  )}
                >
                  {region}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-5">
          <Label htmlFor="settings-notes" className="text-white/45">{cerigaTranslate("interface.text_3498e4d5ff8b2db7")}</Label>
          <Textarea
            id="settings-notes"
              value={draft.notes}
            onChange={(e) => patch('notes', e.target.value)}
            className="mt-1 min-h-[100px] border-white/15 bg-white/5 text-white"
            placeholder={cerigaTranslate("interface.text_ef926de1d8f16ec8")}
          />
          <p className="mt-1.5 text-[11px] text-white/35">{cerigaTranslate("interface.text_35e5944fa284f102")}</p>
        </div>
      </section>}
      </fieldset>

      {dirty&&<div className="settings-savebar sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#252528] bg-black/90 px-4 py-3 backdrop-blur-md">
        <p className="text-[12px] text-white/45">
          {dirty
            ? cerigaTranslate("interface.plural_b979c2c98f2049a7",{value0:(changeLines.length),count:Number(changeLines.length)})
            : cerigaTranslate("interface.text_4d590eb58a645fa1")}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/15 text-white hover:bg-white/5"
            disabled={!dirty||saving||loading||loadFailed}
            onClick={() => setDiscardConfirmOpen(true)}
          >{cerigaTranslate("interface.text_eb1a70e39274bb76")}</Button>
          <Button
            size="sm"
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            disabled={!dirty}
            onClick={requestSave}
          >{cerigaTranslate("interface.text_0c8209e72ec87d9d")}</Button>
        </div>
      </div>}

      <SettingsConfirmation
        open={saveConfirmOpen}
        error={saveError}
        onOpenChange={setSaveConfirmOpen}
        title={cerigaTranslate("interface.text_e353fb727fdffcc1")}
        description={
          changeLines.length
            ? cerigaTranslate("interface.text_7ece551f98b31612",{value0:(changeLines.join('; '))})
            : cerigaTranslate("interface.text_b03dba8003050681")
        }
        confirmLabel={cerigaTranslate("interface.text_0c8209e72ec87d9d")}
        onConfirm={save}
      />

      <SettingsConfirmation
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title={cerigaTranslate("interface.text_470e7ee2a5795561")}
        description={cerigaTranslate("interface.text_252ecac55e03b9f2")}
        confirmLabel={cerigaTranslate("interface.text_f9bfa3dc7c8fcdea")}
        tone="danger"
        onConfirm={discard}
      />

      <SettingsConfirmation
        open={Boolean(pendingToggleOff)}
        onOpenChange={(open) => {
          if (!open) setPendingToggleOff(null);
        }}
        title={
          pendingToggleOff?.kind === 'garment'
            ? cerigaTranslate("interface.text_f4a75ac94a2701bd",{value0:(pendingToggleOff.value)})
            : cerigaTranslate("interface.text_65ed59b91b131176",{value0:(pendingToggleOff?.value)})
        }
        description={
          pendingToggleOff?.kind === 'garment'
            ? cerigaTranslate("interface.text_f41669991b61ca97")
            : cerigaTranslate("interface.text_86a84d292b311602")
        }
        confirmLabel={cerigaTranslate("interface.text_c3812fc4acb861d5")}
        tone="danger"
        onConfirm={confirmToggleOff}
      />
    </div>
  );
}

function SettingsConfirmation({open,onOpenChange,title,description,confirmLabel,onConfirm,tone,error}:{error?:string;open:boolean;onOpenChange:(value:boolean)=>void;title:string;description:string;confirmLabel:string;onConfirm:()=>unknown|Promise<unknown>;tone?:string}){
  useCerigaTranslation();
const[busy,setBusy]=useState(false),lock=useRef(false);return <Dialog open={open} onOpenChange={value=>{if(!lock.current)onOpenChange(value);}}><DialogContent className="settings-dialog sm:max-w-lg"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{error&&<p role="alert">{cerigaTranslateLabel(error)}</p>}<DialogFooter><button disabled={busy} onClick={()=>onOpenChange(false)}>{cerigaTranslate("common.cancel")}</button><button className={tone==='danger'?'settings-danger':'settings-primary'} disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const result=await onConfirm();if(result!==false)onOpenChange(false);}finally{lock.current=false;setBusy(false);}}}>{busy?cerigaTranslate("common.saving"):confirmLabel}</button></DialogFooter></DialogContent></Dialog>;}
