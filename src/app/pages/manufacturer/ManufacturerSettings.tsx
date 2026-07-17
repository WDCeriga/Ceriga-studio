import { useMemo, useState } from 'react';
import {
  Building2,
  Factory,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_FACTORY_CAPABILITIES,
  ALL_FACTORY_GARMENTS,
  FACTORY_SHIPPING_REGION_OPTIONS,
  getFactoryWorkspace,
  updateFactoryWorkspace,
  type FactoryCapability,
  type FactoryGarment,
  type FactoryWorkspace,
} from '../../data/manufacturerPortalMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';

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
  if (before.notes !== after.notes) lines.push('Internal ops notes');
  return lines;
}

export function ManufacturerSettings() {
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
    setDraft((d) => ({ ...d, [key]: value }));
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
    setDraft((d) => ({
      ...d,
      regions: d.regions.includes(region)
        ? d.regions.filter((r) => r !== region)
        : [...d.regions, region],
    }));
  };

  const requestSave = () => {
    if (draft.garments.length === 0) {
      toast.error('Keep at least one garment type for matching');
      return;
    }
    if (draft.capabilities.length === 0) {
      toast.error('Keep at least one capability');
      return;
    }
    if (!draft.factoryName.trim() || !draft.contactEmail.trim()) {
      toast.error('Factory name and contact email are required');
      return;
    }
    const moqN = Number(draft.moq);
    const capN = Number(draft.capacity);
    if (!Number.isFinite(moqN) || moqN <= 0 || !Number.isFinite(capN) || capN <= 0) {
      toast.error('MOQ and monthly capacity must be positive numbers');
      return;
    }
    if (!dirty) {
      toast.message('No changes to save');
      return;
    }
    setSaveConfirmOpen(true);
  };

  const save = () => {
    updateFactoryWorkspace({
      factoryName: draft.factoryName.trim(),
      contactName: draft.contactName.trim(),
      contactEmail: draft.contactEmail.trim(),
      contactPhone: draft.contactPhone.trim() || undefined,
      website: draft.website.trim() || undefined,
      addressLine: draft.addressLine.trim() || undefined,
      garments: draft.garments,
      capabilities: draft.capabilities,
      shippingRegions: draft.regions.length ? draft.regions : ['UK'],
      moq: Number(draft.moq) || 50,
      monthlyCapacity: Number(draft.capacity) || 1000,
      typicalLeadDays: Number(draft.typicalLeadDays) || 21,
      internalNotes: draft.notes.trim(),
    });
    const next = draftFromWorkspace(getFactoryWorkspace());
    setBaseline(next);
    setDraft(next);
    setTick((n) => n + 1);
    toast.success('Factory profile saved — Ceriga matching will use the new details');
  };

  const discard = () => {
    setDraft({ ...baseline });
    setDiscardConfirmOpen(false);
    toast.message('Changes discarded');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Settings className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Profile</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Factory profile
          </h1>
          <p className="mt-1 text-sm text-white/45">
            How Ceriga presents and matches your factory. Edits stay local until you confirm save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-white/15 text-white hover:bg-white/5"
            disabled={!dirty}
            onClick={() => setDiscardConfirmOpen(true)}
          >
            Discard
          </Button>
          <Button
            className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            disabled={!dirty}
            onClick={requestSave}
          >
            Save profile
          </Button>
        </div>
      </div>

      {dirty ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-100">Unsaved changes</p>
            <p className="mt-0.5 text-[12px] text-amber-100/70">
              {changeLines.slice(0, 3).join(' · ')}
              {changeLines.length > 3 ? ` · +${changeLines.length - 3} more` : ''}
              . Nothing is live until you confirm Save.
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#CC2D24]/25 bg-[#CC2D24]/10">
              <Factory className="h-5 w-5 text-[#CC2D24]" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Live profile
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-white">{saved.factoryName}</h2>
              <p className="mt-1 text-[12px] text-white/45">
                {saved.contactName} · {saved.contactEmail}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:text-right">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35">MOQ</p>
              <p className="text-sm font-semibold text-white">{saved.moq}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35">Capacity / mo</p>
              <p className="text-sm font-semibold text-white">
                {saved.monthlyCapacity.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#CC2D24]" />
          <h2 className="text-sm font-semibold text-white">Identity & contact</h2>
        </div>
        <p className="mt-1 text-[11px] text-white/40">
          Shown to Ceriga ops and used when brands need a factory contact.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-white/45">Factory name</Label>
            <Input
              value={draft.factoryName}
              onChange={(e) => patch('factoryName', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label className="text-white/45">Primary contact</Label>
            <Input
              value={draft.contactName}
              onChange={(e) => patch('contactName', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 text-white/45">
              <Mail className="h-3 w-3" /> Email
            </Label>
            <Input
              type="email"
              value={draft.contactEmail}
              onChange={(e) => patch('contactEmail', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 text-white/45">
              <Phone className="h-3 w-3" /> Phone
            </Label>
            <Input
              value={draft.contactPhone}
              onChange={(e) => patch('contactPhone', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder="+44 …"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 text-white/45">
              <Globe2 className="h-3 w-3" /> Website
            </Label>
            <Input
              value={draft.website}
              onChange={(e) => patch('website', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder="https://"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-1.5 text-white/45">
              <MapPin className="h-3 w-3" /> Factory address
            </Label>
            <Input
              value={draft.addressLine}
              onChange={(e) => patch('addressLine', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
              placeholder="Street, city, postcode"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#CC2D24]/20 bg-[#111113] p-5 sm:p-6">
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
                type="button"
                onClick={() => requestToggleGarment(g)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                  on
                    ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                    : 'border-white/10 text-white/40 hover:text-white/70',
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
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
                type="button"
                onClick={() => requestToggleCapability(c)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                  on
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 text-white/40 hover:text-white/70',
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Capacity & logistics</h2>
        <p className="mt-1 text-[11px] text-white/40">
          Used for routing and capacity planning. Changes apply only after you save.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-white/45">MOQ (units)</Label>
            <Input
              value={draft.moq}
              onChange={(e) => patch('moq', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
            />
          </div>
          <div>
            <Label className="text-white/45">Monthly capacity</Label>
            <Input
              value={draft.capacity}
              onChange={(e) => patch('capacity', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
            />
          </div>
          <div>
            <Label className="text-white/45">Typical lead time (days)</Label>
            <Input
              value={draft.typicalLeadDays}
              onChange={(e) => patch('typicalLeadDays', e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
            />
          </div>
        </div>
        <div className="mt-5">
          <Label className="text-white/45">Shipping regions</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {FACTORY_SHIPPING_REGION_OPTIONS.map((region) => {
              const on = draft.regions.includes(region);
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                    on
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                      : 'border-white/10 text-white/40 hover:text-white/70',
                  )}
                >
                  {region}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-5">
          <Label className="text-white/45">Internal ops notes</Label>
          <Textarea
            value={draft.notes}
            onChange={(e) => patch('notes', e.target.value)}
            className="mt-1 min-h-[100px] border-white/15 bg-white/5 text-white"
            placeholder="Preferences, rib colours, packing rules…"
          />
          <p className="mt-1.5 text-[11px] text-white/35">
            Factory-only — not shown to brands.
          </p>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/90 px-4 py-3 backdrop-blur-md">
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
            disabled={!dirty}
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
      </div>

      <ConfirmDialog
        open={saveConfirmOpen}
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

      <ConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title="Discard unsaved changes?"
        description="Your edits will be reverted to the last saved factory profile. This cannot be undone."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={discard}
      />

      <ConfirmDialog
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
