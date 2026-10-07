import { useEffect, useId, useState } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { StudioColorField } from './StudioColorField';
import { STUDIO_MAIN_COLORS, STUDIO_POPULAR_COLORS } from '../../data/studioColorPresets';
import {
  FABRIC_LIBRARY, FABRIC_PRESETS, applyFabricPreset, assignFabric, fabricTargets,
  initializeFabricDefaults, resetFabricDefaults, resetPartFabric, setGarmentFabric, fabricCategoryForPart, setCategoryFabric,
  resolvePartFabric, setFabricGroupLinked, type FabricAssignments, type FabricCategory, type FabricPart,
} from '../../data/garmentFabrics';
import { fabricAssignmentIssues, fabricSourceRecord } from '../../lib/fabricTextureScans';

const GARMENT_DEFAULT = '__garment-default__';
const CATEGORY_LABELS: Record<FabricCategory, string> = {
  body: 'Body', sleeves: 'Sleeve', neck: 'Neck', hood: 'Hood', cuffs: 'Cuff',
  waistband: 'Waistband', hem: 'Hem', pockets: 'Pocket', panels: 'Panel', lining: 'Lining',
};

export function FabricControls({ parts, value, onChange, legacyFabric, selectedPartId, onSelectPart, garmentType = 'tshirt', technicalView = false, onTechnicalViewChange }: {
  parts: FabricPart[];
  value?: FabricAssignments;
  onChange: (value: FabricAssignments | undefined) => void;
  legacyFabric?: string;
  selectedPartId?: string | null;
  onSelectPart?: (id: string | null) => void;
  garmentType?: string;
  technicalView?: boolean;
  onTechnicalViewChange?: (enabled: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (selectedPartId != null) setSelected(null);
  }, [selectedPartId]);
  const instructionId = useId();
  const state = initializeFabricDefaults(garmentType, value);
  const targets = fabricTargets(parts, state);
  const categories = [...new Set(parts.map(fabricCategoryForPart))];
  const selection = selectedPartId ?? selected;
  const category = categories.find(item => selection === `category:${item}`);
  const target = selection ? targets.find(item => item.id === selection)
    ?? targets.find(item => item.partIds.includes(selection)) : undefined;
  const selectionLabel = category ? `${CATEGORY_LABELS[category]} category default`
    : parts.find(part => part.id === selection)?.label ?? target?.label ?? 'Garment default';
  const members = parts.filter(part => target?.partIds.includes(part.id));
  const issues = fabricAssignmentIssues(parts, state);
  const missing = issues.filter((issue, index) => issues.findIndex(other => other.fabricId === issue.fabricId && other.reason === issue.reason) === index);
  const materials = members.map(part => resolvePartFabric(state, part, parts));
  const mixed = new Set(materials.map(material => material?.id ?? '')).size > 1;
  const defaultFabricId = category ? state.categoryDefaults?.[category] ?? (category === 'lining' ? undefined : state.garmentDefault) : state.garmentDefault;
  const fabric = target ? mixed ? undefined : materials[0] : FABRIC_LIBRARY.find(item => item.id === defaultFabricId);
  const linked = !!target?.group && !state.unlinkedGroups.includes(target.group);
  const interior = { matchExteriorFabric: true, matchExteriorColour: true, ...state.interior };
  const updateInterior = (change: Partial<NonNullable<FabricAssignments['interior']>>) => onChange({ ...state, interior: { ...interior, ...change } });
  const applyFabric = (id: string) => onChange(category ? setCategoryFabric(state, category, id)
    : target ? assignFabric(state, parts, selection ?? target.id, id) : setGarmentFabric(state, id));
  const resetSelected = () => {
    if (target) onChange(resetPartFabric(state, parts, selection ?? target.id));
  };
  const controlClass = 'h-9 border-[#252528] bg-white/5 text-[11px] text-white';
  const labelClass = 'mb-1.5 block text-[10px] uppercase tracking-wider text-white/60';

  if (!parts.length) return <p className="text-[11px] text-white/50">Select garment parts to assign fabrics.</p>;

  return <div className="min-w-0 space-y-3" data-fabric-controls>
    <div>
      <Label htmlFor="fabric-part" className={labelClass}>Apply fabric to</Label>
      <Select value={category ? `category:${category}` : target?.id ?? GARMENT_DEFAULT} onValueChange={id => {
        const next = id === GARMENT_DEFAULT ? null : id;
        setSelected(next);
        onSelectPart?.(parts.some(part => part.id === next) ? next : null);
      }}>
        <SelectTrigger id="fabric-part" className={controlClass}><SelectValue>{selectionLabel}</SelectValue></SelectTrigger>
        <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
          <SelectItem value={GARMENT_DEFAULT}>Garment default</SelectItem>
          {categories.map(item => <SelectItem key={item} value={`category:${item}`}>{CATEGORY_LABELS[item]} category default</SelectItem>)}
          {targets.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <p className="text-[10px] leading-relaxed text-white/45">Set the garment default, then category defaults, then explicit part overrides. Category changes preserve individual and matching-part overrides.</p>
    {target?.group && <label className="flex items-center gap-2 text-[11px] text-white/65">
      <input type="checkbox" checked={linked} onChange={event => onChange(setFabricGroupLinked(state, parts, target.group!, event.target.checked))} />
      Link matching parts' fabrics
    </label>}
    <div>
      <Label htmlFor="fabric-type" className={labelClass}>Fabric Type</Label>
      <Select value={fabric?.id ?? ''} onValueChange={applyFabric}>
        <SelectTrigger id="fabric-type" className={controlClass}><SelectValue placeholder={mixed ? 'Mixed fabrics' : 'Select fabric'} /></SelectTrigger>
        <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
          {FABRIC_LIBRARY.map(item => <SelectItem key={item.id} value={item.id}>{item.name}{fabricSourceRecord(item).sourceStatus === 'unresolved' ? ' — texture unavailable' : ''}</SelectItem>)}
        </SelectContent>
      </Select>
      {fabric ? <p className="mt-2 text-[11px] leading-relaxed text-white/55" data-fabric-spec>
        Composition: {fabric.composition}<br />Weight: {fabric.gsm} GSM
      </p> : null}
      {legacyFabric && !value && <p className="mt-2 text-[10px] text-white/45">Previous specification: {legacyFabric.replaceAll('-', ' ')}.</p>}
    </div>
    <div>
      <p id={instructionId} className="mb-1.5 text-[10px] text-white/45">Click a fabric card to apply, or drag and drop it onto a garment part.</p>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group" aria-label="Fabric cards">
        {FABRIC_LIBRARY.map(item => <button
          key={item.id}
          type="button"
          draggable
          onDragStart={event => {
            event.dataTransfer.setData('application/x-ceriga-material', JSON.stringify({ kind: 'fabric', fabricId: item.id }));
            event.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => applyFabric(item.id)}
          aria-label={`Apply ${item.name} fabric`}
          aria-pressed={fabric?.id === item.id}
          aria-describedby={instructionId}
          className={`w-28 shrink-0 rounded border p-2 text-left text-[10px] ${fabric?.id === item.id ? 'border-[#FF3B30] bg-white/10 text-white' : 'border-white/15 bg-white/5 text-white/65 hover:border-white/35'}`}
        >
          <span className="block font-medium">{item.name}</span>
          <span className="text-white/45">{item.gsm} GSM</span>
        </button>)}
      </div>
    </div>
    {category && <button type="button" className="text-[10px] text-white/50 underline hover:text-white" onClick={() => onChange(setCategoryFabric(state, category, resetFabricDefaults(garmentType).categoryDefaults?.[category]))}>Reset category fabric</button>}
    {target && <button type="button" className="text-[10px] text-white/50 underline hover:text-white" onClick={resetSelected}>Reset selected part fabric</button>}
    {missing.length > 0 && <div role="alert" data-fabric-availability="unresolved" className="rounded border border-amber-400/35 bg-amber-400/5 p-2 text-[11px] leading-relaxed text-amber-100">
      <strong>Fabric textures unavailable</strong>
      <p>Assignments are saved, but these requested textures are unavailable. Plain colour is not a fabric preview.</p>
      <ul className="mt-1 space-y-1">{missing.map(issue => <li key={`${issue.fabricId}:${issue.reason}`} data-missing-fabric={issue.fabricId}>
        <strong>{issue.fabricName}</strong> ({issue.fabricId}) · {issues.filter(other => other.fabricId === issue.fabricId && other.reason === issue.reason).map(other => other.partLabel).join(', ')}<br />{issue.reason}
      </li>)}</ul>
    </div>}
    <div>
      <Label htmlFor="fabric-preset" className={labelClass}>Quick preset</Label>
      <Select value="" onValueChange={id => onChange(applyFabricPreset(state, parts, id))}>
        <SelectTrigger id="fabric-preset" className={controlClass}><SelectValue placeholder="Apply a fabric preset" /></SelectTrigger>
        <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
          {FABRIC_PRESETS.map(preset => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <fieldset className="space-y-2 border-t border-white/10 pt-3">
      <legend className="text-[10px] uppercase tracking-wider text-white/60">Reverse / interior</legend>
      <label className="flex items-center gap-2 text-[11px] text-white/65">
        <input type="checkbox" checked={interior.matchExteriorFabric} onChange={event => updateInterior({ matchExteriorFabric: event.target.checked })} />
        Match exterior fabric
      </label>
      {!interior.matchExteriorFabric && <div>
        <Label htmlFor="interior-fabric-type" className={labelClass}>Interior fabric</Label>
        <Select value={interior.fabricId ?? state.garmentDefault ?? ''} onValueChange={fabricId => updateInterior({ fabricId })}>
          <SelectTrigger id="interior-fabric-type" className={controlClass}><SelectValue placeholder="Select interior fabric" /></SelectTrigger>
          <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
            {FABRIC_LIBRARY.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>}
      <label className="flex items-center gap-2 text-[11px] text-white/65">
        <input type="checkbox" checked={interior.matchExteriorColour} onChange={event => updateInterior({ matchExteriorColour: event.target.checked })} />
        Match exterior colour
      </label>
      {!interior.matchExteriorColour && <div role="group" aria-label="Interior colour">
        <StudioColorField value={interior.colour ?? '#FFFFFF'} onChange={colour => updateInterior({ colour })} mainColors={STUDIO_MAIN_COLORS} popularColors={STUDIO_POPULAR_COLORS} mainLabel="Interior colour" />
      </div>}
      <p className="text-[10px] leading-relaxed text-white/45">Matching uses each exterior part's fabric reverse and colour. Lining is separate: select a lining part above to edit it.</p>
      {onTechnicalViewChange && <label className="flex items-center gap-2 text-[11px] text-white/65">
        <input type="checkbox" checked={technicalView} onChange={event => onTechnicalViewChange(event.target.checked)} />
        Technical / interior view (view only)
      </label>}
    </fieldset>
    <button type="button" className="text-[10px] text-white/50 underline hover:text-white" onClick={() => onChange(resetFabricDefaults(garmentType))}>Reset fabrics to material defaults</button>
  </div>;
}
