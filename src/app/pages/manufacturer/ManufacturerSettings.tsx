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
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
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
  const { section } = useParams();
  const { hash } = useLocation();
  const { access } = useFactoryAccess();
  const permissions = access?.permissions ?? [];
  const canManageSettings = !isSupabaseConfigured || permissions.includes('settings');
  const canViewProfile = !isSupabaseConfigured || permissions.includes('portfolio') || permissions.includes('verification');
  const availablePages = settingsPages.filter(page => page.id === 'profile' ? canViewProfile : canManageSettings);
  const selected = availablePages.find(page => page.id === (section ?? hash.slice(1))) ?? availablePages[0];
  if (!selected) return <p role="alert">Your role does not have access to factory settings.</p>;

  const active = selected.id;
  const profileSection = active === 'identity' || active === 'products' || active === 'logistics' ? active : undefined;
  return (
    <div className="factory-home settings-workspace">
      <header className="settings-workspace-heading">
        <span>YOUR FACTORY</span>
        <h1>Settings</h1>
        <p>Manage your factory details, production preferences and credentials.</p>
      </header>
      <nav className="settings-page-nav" aria-label="Settings sections">
        {availablePages.map(page => (
          <Link key={page.id} to={'/manufacturer/settings/' + page.id} aria-current={page.id === active ? 'page' : undefined}>{page.label}</Link>
        ))}
      </nav>
      {active === 'profile' && <ManufacturerFactoryProfile embedded />}
      {active === 'production-timeline' && <div className="factory-settings settings-timeline"><ProductionTimelineEditor /></div>}
      {active === 'preferences' && <section className="factory-settings settings-panel settings-preferences" aria-label="Account preferences"><ManufacturerCurrencySettings embedded /></section>}
      {canManageSettings && <ManufacturerSettingsEditor section={profileSection} />}
    </div>
  );
}

export function ManufacturerSettingsEditor({ section }: { section?: ProfileSection }) {
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
        toast.error('Keep at least one garment type for matching');
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
        toast.error('Keep at least one capability');
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
      toast.error('Keep at least one garment type for matching');
      return;
    }
    if (draft.capabilities.length === 0) {
      toast.error('Keep at least one capability');
      return;
    }
    if (!draft.factoryName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail.trim())) {
      toast.error('Factory name and contact email are required');
      return;
    }
    const moqN = Number(draft.moq);
    const capN = Number(draft.capacity);
    if (!Number.isSafeInteger(moqN) || moqN <= 0 || !Number.isSafeInteger(capN) || capN <= 0) {
      toast.error('MOQ and monthly capacity must be positive whole numbers');
      return;
    }
    for(const kind of ['sample','bulk'] as const){
      const minimum=Number(kind==='sample'?draft.sampleLeadTimeMinDays:draft.bulkLeadTimeMinDays);
      const maximum=Number(kind==='sample'?draft.sampleLeadTimeMaxDays:draft.bulkLeadTimeMaxDays);
      if(![minimum,maximum].every(value=>Number.isInteger(value)&&value>=1&&value<=3650)||minimum>maximum){toast.error(`Enter a valid ${kind} lead-time range (1–3650 days).`);return;}
    }
    if (!dirty) {
      toast.message('No changes to save');
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
    edited.current=false;toast.success('Factory profile saved');return true;
    }catch(cause){const message=(cause as Error).message||'Could not save factory profile';setSaveError(message);toast.error(message);return false;}finally{saveLock.current=false;setSaving(false);}
  };

  const discard = () => {
    setDraft({ ...baseline });edited.current=false;
    setDiscardConfirmOpen(false);
    toast.message('Changes discarded');
  };

  return (
    <div className="factory-settings space-y-6" hidden={!section && !dirty}>

      {saveError&&(section||dirty)&&<div role='alert' className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300'>Factory profile: {saveError}. {loadFailed?<button onClick={()=>setReload(v=>v+1)}>Reload saved profile</button>:'Your edits remain available. If a save partly completed, retry to finish.'}</div>}
      {saving&&<p role='status' className='text-sm text-white/60'>Saving factory profile…</p>}
      {section === 'identity' && (
        <div className="settings-editor-actions">
          <Link to="/manufacturer/onboarding"><Sparkles size={14} aria-hidden /> Edit onboarding</Link>
        </div>
      )}
      {section&&loading&&<p role="status" className="settings-loading">Loading saved factory settings…</p>}
      {dirty ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-100">Unsaved changes</p>
            <p className="mt-0.5 text-[12px] text-amber-100/70">
              {changeLines.slice(0, 3).join(' · ')}
              {changeLines.length > 3 ? ` · +${changeLines.length - 3} more` : ''}
              . Save your profile to apply these changes.
            </p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Live profile
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-white">{baseline.factoryName}</h2>
              <p className="mt-1 text-[12px] text-white/45">
                {baseline.contactName} · {baseline.contactEmail}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:text-right">
            <div className="rounded-xl border border-[#252528] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35">MOQ</p>
              <p className="text-sm font-semibold text-white">{baseline.moq}</p>
            </div>
            <div className="rounded-xl border border-[#252528] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35">Capacity / mo</p>
              <p className="text-sm font-semibold text-white">
                {Number(baseline.capacity).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>}

      <fieldset className="settings-profile-fields" disabled={loading||saving||loadFailed} hidden={!section||loading||loadFailed}>
      {section === 'identity' && <section id="identity" className="settings-panel rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#CC2D24]" />
          <h2 className="text-sm font-semibold text-white">Identity & contact</h2>
        </div>
        <p className="mt-1 text-[11px] text-white/40">
          Shown to Ceriga ops and used when brands need a factory contact.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="settings-factory-name" className="text-white/45">Factory name</Label>
            <Input
              id="settings-factory-name"
              value={draft.factoryName}
              onChange={(e) => patch('factoryName', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label htmlFor="settings-contact-name" className="text-white/45">Primary contact</Label>
            <Input
              id="settings-contact-name"
              value={draft.contactName}
              onChange={(e) => patch('contactName', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label htmlFor="settings-email" className="flex items-center gap-1.5 text-white/45">
              <Mail className="h-3 w-3" /> Email
            </Label>
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
              <Phone className="h-3 w-3" /> Phone
            </Label>
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
              <Globe2 className="h-3 w-3" /> Website
            </Label>
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
              <MapPin className="h-3 w-3" /> Factory address
            </Label>
            <Input
              id="settings-address"
              value={draft.addressLine}
              onChange={(e) => patch('addressLine', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder="Street, city, postcode"
            />
          </div>
        </div>
      </section>}

      {section === 'products' && <>
      <section id="products" className="settings-panel rounded-2xl border border-[#CC2D24]/20 bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Clothes you produce</h2>
        <p className="mt-1 text-[11px] text-white/40">
          Turning a type off reduces what Ceriga can auto-assign. Removing one asks for confirmation.
        </p>
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
        <h2 className="text-sm font-semibold text-white">Capabilities</h2>
        <p className="mt-1 text-[11px] text-white/40">
          Print, embroidery, wash, packing — removing one requires confirmation.
        </p>
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
        <h2 className="text-sm font-semibold text-white">Capacity & logistics</h2>
        <p className="mt-1 text-[11px] text-white/40">
          Used for routing and capacity planning. Changes apply only after you save.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="settings-moq" className="text-white/45">MOQ (units)</Label>
            <Input
              id="settings-moq" type="number" min="1" step="1" inputMode="numeric"
              value={draft.moq}
              onChange={(e) => patch('moq', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="settings-capacity" className="text-white/45">Monthly capacity</Label>
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
            <legend className="px-2 text-sm font-medium text-white">{kind==='sample'?'Sample lead time':'Bulk lead time'}</legend>
            <div className="grid grid-cols-2 gap-3">{(kind==='sample'?['sampleLeadTimeMinDays','sampleLeadTimeMaxDays'] as const:['bulkLeadTimeMinDays','bulkLeadTimeMaxDays'] as const).map((field,index)=><div key={field}>
              <Label htmlFor={field} className="text-xs text-white/45">{index===0?'Minimum':'Maximum'} days</Label>
              <Input id={field} type="number" min="1" max="3650" step="1" value={draft[field]} onChange={event=>patch(field,event.target.value)} className="mt-2 border-white/15 bg-white/5 text-white tabular-nums" />
            </div>)}</div>
          </fieldset>)}
        </div>
        <p className="mt-2 text-xs text-white/40">Saved sample and bulk lead times prefill the matching quotation options.</p>
        <div className="mt-5">
          <Label className="text-white/45">Shipping regions</Label>
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
          <Label htmlFor="settings-notes" className="text-white/45">Internal ops notes</Label>
          <Textarea
            id="settings-notes"
              value={draft.notes}
            onChange={(e) => patch('notes', e.target.value)}
            className="mt-1 min-h-[100px] border-white/15 bg-white/5 text-white"
            placeholder="Preferences, rib colours, packing rules…"
          />
          <p className="mt-1.5 text-[11px] text-white/35">
            Saved as internal factory notes.
          </p>
        </div>
      </section>}
      </fieldset>

      {dirty&&<div className="settings-savebar sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#252528] bg-black/90 px-4 py-3 backdrop-blur-md">
        <p className="text-[12px] text-white/45">
          {dirty
            ? `${changeLines.length} pending change${changeLines.length === 1 ? '' : 's'} — confirm to publish`
            : 'Profile is up to date'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/15 text-white hover:bg-white/5"
            disabled={!dirty||saving||loading||loadFailed}
            onClick={() => setDiscardConfirmOpen(true)}
          >
            Discard
          </Button>
          <Button
            size="sm"
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            disabled={!dirty}
            onClick={requestSave}
          >
            Save profile
          </Button>
        </div>
      </div>}

      <SettingsConfirmation
        open={saveConfirmOpen}
        error={saveError}
        onOpenChange={setSaveConfirmOpen}
        title="Save factory profile?"
        description={
          changeLines.length
            ? `You're about to update: ${changeLines.join('; ')}. Ceriga matching and capacity routing will use these values.`
            : 'Save the current factory profile.'
        }
        confirmLabel="Save profile"
        onConfirm={save}
      />

      <SettingsConfirmation
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title="Discard unsaved changes?"
        description="Your edits will be reverted to the last saved factory profile. This cannot be undone."
        confirmLabel="Discard changes"
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
            ? `Remove “${pendingToggleOff.value}”?`
            : `Remove capability “${pendingToggleOff?.value}”?`
        }
        description={
          pendingToggleOff?.kind === 'garment'
            ? 'Ceriga may stop auto-assigning this garment type to your factory until you add it back and save.'
            : 'This capability will no longer be used for matching until you add it back and save the profile.'
        }
        confirmLabel="Remove"
        tone="danger"
        onConfirm={confirmToggleOff}
      />
    </div>
  );
}

function SettingsConfirmation({open,onOpenChange,title,description,confirmLabel,onConfirm,tone,error}:{error?:string;open:boolean;onOpenChange:(value:boolean)=>void;title:string;description:string;confirmLabel:string;onConfirm:()=>unknown|Promise<unknown>;tone?:string}){const[busy,setBusy]=useState(false),lock=useRef(false);return <Dialog open={open} onOpenChange={value=>{if(!lock.current)onOpenChange(value);}}><DialogContent className="settings-dialog sm:max-w-lg"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{error&&<p role="alert">{error}</p>}<DialogFooter><button disabled={busy} onClick={()=>onOpenChange(false)}>Cancel</button><button className={tone==='danger'?'settings-danger':'settings-primary'} disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const result=await onConfirm();if(result!==false)onOpenChange(false);}finally{lock.current=false;setBusy(false);}}}>{busy?'Saving…':confirmLabel}</button></DialogFooter></DialogContent></Dialog>;}
