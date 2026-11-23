import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { FactoryMaterialsPanel } from '../../components/manufacturer/FactoryMaterialsPanel';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FACTORY_MATERIAL_KIND_LABEL,
  FACTORY_MATERIAL_UNITS,
  addFactoryMaterial,
  adjustFactoryMaterialQuantity,
  getFactoryMaterialsSummary,
  isMaterialLowStock,
  listFactoryMaterials,
  removeFactoryMaterial,
  updateFactoryMaterial,
  actingHasPermission,
  type FactoryMaterial,
  type FactoryMaterialKind,
  type FactoryMaterialUnit,
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

const KIND_FILTERS: { id: FactoryMaterialKind | 'all' | 'low'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'low', label: 'Low stock' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'trim', label: 'Trim' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'other', label: 'Other' },
];

type Draft = {
  name: string;
  kind: FactoryMaterialKind;
  colour: string;
  gsm: string;
  quantity: string;
  unit: FactoryMaterialUnit;
  reorderAt: string;
  supplier: string;
  location: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  kind: 'fabric',
  colour: '',
  gsm: '',
  quantity: '',
  unit: 'metres',
  reorderAt: '50',
  supplier: '',
  location: '',
  notes: '',
});

function draftFromMaterial(m: FactoryMaterial): Draft {
  return {
    name: m.name,
    kind: m.kind,
    colour: m.colour ?? '',
    gsm: m.gsm != null ? String(m.gsm) : '',
    quantity: String(m.quantity),
    unit: m.unit,
    reorderAt: String(m.reorderAt),
    supplier: m.supplier ?? '',
    location: m.location ?? '',
    notes: m.notes ?? '',
  };
}

function parseDraft(draft: Draft): Omit<FactoryMaterial, 'id' | 'updatedAt'> | null {
  const quantity = Number(draft.quantity);
  const reorderAt = Number(draft.reorderAt);
  if (!draft.name.trim()) return null;
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (!Number.isFinite(reorderAt) || reorderAt < 0) return null;
  const gsmRaw = draft.gsm.trim();
  const gsm = gsmRaw ? Number(gsmRaw) : undefined;
  if (gsmRaw && (!Number.isFinite(gsm) || (gsm ?? 0) <= 0)) return null;
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    colour: draft.colour.trim() || undefined,
    gsm,
    quantity,
    unit: draft.unit,
    reorderAt,
    supplier: draft.supplier.trim() || undefined,
    location: draft.location.trim() || undefined,
    notes: draft.notes.trim() || undefined,
  };
}

function ManufacturerMaterialsPreview() {
  useCerigaTranslation();

  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<(typeof KIND_FILTERS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [removeId, setRemoveId] = useState<string | null>(null);

  void tick;
  const refresh = () => setTick((n) => n + 1);

  const summary = getFactoryMaterialsSummary();
  const materials = listFactoryMaterials(
    filter === 'low' || filter === 'all' ? 'all' : filter,
  );

  const filtered = useMemo(() => {
    let list = materials;
    if (filter === 'low') list = list.filter(isMaterialLowStock);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.colour?.toLowerCase().includes(q) ?? false) ||
        (m.supplier?.toLowerCase().includes(q) ?? false) ||
        (m.location?.toLowerCase().includes(q) ?? false),
    );
  }, [materials, filter, search, tick]);

  const openAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const openEdit = (m: FactoryMaterial) => {
    setEditingId(m.id);
    setDraft(draftFromMaterial(m));
    setFormOpen(true);
  };

  const saveForm = () => {
    if (!actingHasPermission('edit_materials')) {
      toast.error(cerigaTranslate("interface.text_2298d90304bfbf5d"));
      return;
    }
    const parsed = parseDraft(draft);
    if (!parsed) {
      toast.error(cerigaTranslate("interface.text_e9f6c91ba44484e8"));
      return;
    }
    if (editingId) {
      updateFactoryMaterial(editingId, parsed);
      toast.success(cerigaTranslate("interface.text_960b41b9e97c338e"));
    } else {
      addFactoryMaterial(parsed);
      toast.success(cerigaTranslate("interface.text_675db460d188484a"));
    }
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft());
    refresh();
  };

  const bump = (id: string, delta: number) => {
    if (!actingHasPermission('edit_materials')) {
      toast.error(cerigaTranslate("interface.text_2298d90304bfbf5d"));
      return;
    }
    adjustFactoryMaterialQuantity(id, delta);
    refresh();
  };

  const confirmRemove = () => {
    if (!actingHasPermission('edit_materials')) {
      toast.error(cerigaTranslate("interface.text_2298d90304bfbf5d"));
      return;
    }
    if (!removeId) return;
    removeFactoryMaterial(removeId);
    setRemoveId(null);
    refresh();
    toast.success(cerigaTranslate("interface.text_ac3d1c7cda0f4b88"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Boxes className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{cerigaTranslate("interface.text_d5cade7ef3191690")}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{cerigaTranslate("nav.materials")}</h1>
          <p className="mt-1 text-sm text-white/45">{cerigaTranslate("interface.text_3ab6dfd3dfcca529")}</p>
        </div>
        <Button className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_42a2f282d2b478d4")}</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'SKUs', value: summary.total },
          { label: 'Low stock', value: summary.lowStock, warn: summary.lowStock > 0 },
          { label: 'Fabrics', value: summary.fabric },
          { label: 'Trims', value: summary.trim },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#252528] bg-[#111113] px-4 py-3.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {cerigaTranslateLabel(card.label)}
            </p>
            <p
              className={cn(
                'mt-1 text-2xl font-semibold tabular-nums',
                card.warn ? 'text-amber-300' : 'text-white',
              )}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                filter === f.id
                  ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                  : 'border-[#252528] bg-white/[0.03] text-white/50 hover:text-white',
              )}
            >
              {cerigaTranslateLabel(f.label)}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={cerigaTranslate("interface.text_7ee80e4c48a14f3f")}
            className="w-full rounded-xl border border-[#252528] bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25"
          />
        </div>
      </div>

      {formOpen ? (
        <section className="rounded-2xl border border-[#CC2D24]/25 bg-[#111113] p-5">
          <h2 className="text-sm font-semibold text-white">
            {editingId ? cerigaTranslate("interface.text_212dfb3b91c8d328") : cerigaTranslate("interface.text_dfe2edea22922952")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_dcd1d5223f73b3a9")}</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder={cerigaTranslate("interface.text_9c9079c726a7b23d")}
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_f5387f9bb6ed7031")}</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as FactoryMaterialKind }))}
              >
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  {(Object.keys(FACTORY_MATERIAL_KIND_LABEL) as FactoryMaterialKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {cerigaTranslateLabel(FACTORY_MATERIAL_KIND_LABEL[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_3a9dfa58df63e0dd")}</Label>
              <Input
                value={draft.colour}
                onChange={(e) => setDraft((d) => ({ ...d, colour: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder={cerigaTranslate("interface.text_59be71333c960fd0")}
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_c2dd5a5efad9c846")}</Label>
              <Input
                value={draft.gsm}
                onChange={(e) => setDraft((d) => ({ ...d, gsm: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
                placeholder="e.g. 380"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_69c89d4117d083bf")}</Label>
              <Input
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_4e545960f1bffc13")}</Label>
              <Select
                value={draft.unit}
                onValueChange={(v) => setDraft((d) => ({ ...d, unit: v as FactoryMaterialUnit }))}
              >
                <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#252528] bg-[#161618] text-white">
                  {FACTORY_MATERIAL_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {cerigaTranslateLabel(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_69eda65222772d4c")}</Label>
              <Input
                value={draft.reorderAt}
                onChange={(e) => setDraft((d) => ({ ...d, reorderAt: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white tabular-nums"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_72e2f03367f77cb2")}</Label>
              <Input
                value={draft.supplier}
                onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">{cerigaTranslate("interface.text_05c557e48be9b1f0")}</Label>
              <Input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                className="mt-1 border-white/15 bg-white/5 text-white"
                placeholder={cerigaTranslate("interface.text_ec8c6538196679a1")}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="text-[10px] text-white/40">{cerigaTranslate("adminOrders.notes")}</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                className="mt-1 min-h-[72px] border-white/15 bg-white/5 text-white"
                placeholder={cerigaTranslate("interface.text_23c6130583e62fad")}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90" onClick={saveForm}>
              {editingId ? cerigaTranslate("common.saveChanges") : cerigaTranslate("interface.text_4b3f79c6c7f39886")}
            </Button>
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white/5"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
            >{cerigaTranslate("common.cancel")}</Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#252528] bg-[#111113]">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-sm text-white/45">{cerigaTranslate("interface.text_239a3733b7744d15")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#252528] text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_616cb218a65b982f")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_f5387f9bb6ed7031")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_9de5d84ed8e5c5b1")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_72e2f03367f77cb2")}</th>
                  <th className="px-4 py-3 font-semibold">{cerigaTranslate("interface.text_15b61974b2707a7b")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{cerigaTranslate("interface.text_ff8059dc6752afdd")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map((m) => {
                  const low = isMaterialLowStock(m);
                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2">
                          {low ? (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                          ) : null}
                          <div>
                            <p className="font-medium text-white">{m.name}</p>
                            <p className="mt-0.5 text-[11px] text-white/40">
                              {[m.colour, m.gsm != null ? cerigaTranslate("interface.text_3da59ea8aa3bfa41",{value0:(m.gsm)}) : null]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </p>
                            {low ? (
                              <p className="mt-1 text-[10px] font-medium text-amber-300/90">{cerigaTranslate("interface.text_3fea74aacc271b2a")}{" "}{m.reorderAt} {m.unit}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md border border-[#252528] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase text-white/55">
                          {cerigaTranslateLabel(FACTORY_MATERIAL_KIND_LABEL[m.kind])}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bump(m.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#252528] text-white/60 hover:bg-white/5 hover:text-white"
                            aria-label={cerigaTranslate("interface.text_991e5ab396c965a1")}
                          >
                            −
                          </button>
                          <span
                            className={cn(
                              'min-w-[4.5rem] text-center tabular-nums font-medium',
                              low ? 'text-amber-200' : 'text-white',
                            )}
                          >
                            {m.quantity}{' '}
                            <span className="text-[11px] font-normal text-white/40">{m.unit}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => bump(m.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#252528] text-white/60 hover:bg-white/5 hover:text-white"
                            aria-label={cerigaTranslate("interface.text_0c2d3b8713b00333")}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-white/55">{m.supplier ?? '—'}</td>
                      <td className="px-4 py-3.5 text-white/45">{m.location ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/15 text-white hover:bg-white/5"
                            onClick={() => openEdit(m)}
                          >{cerigaTranslate("common.edit")}</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/25 text-red-200 hover:bg-red-500/10"
                            onClick={() => setRemoveId(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title={cerigaTranslate("interface.text_883e0f5a8926522a")}
        description={cerigaTranslate("interface.text_2d0ea79da883aa69")}
        confirmLabel={cerigaTranslate("interface.text_c3812fc4acb861d5")}
        tone="danger"
        onConfirm={confirmRemove}
      />
    </div>
  );
}

export function ManufacturerMaterials(){return isSupabaseConfigured ? <FactoryMaterialsPanel/> : <ManufacturerMaterialsPreview/>;}
