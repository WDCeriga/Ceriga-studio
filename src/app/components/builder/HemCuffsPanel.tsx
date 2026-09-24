import { Copy, RotateCcw } from 'lucide-react';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';
import { copyHemSettings, resolveHemSettings, updateHemSettings, type HemRegion, type HemSettings, type TshirtHemStyles } from '../../data/tshirtHemStyles';

export function HemCuffsPanel({ regions, styles, selectedId, closeUp, fabricColor, stitchColor, onChange, onSelect, onCloseUp }: {
  regions: HemRegion[]; styles?: TshirtHemStyles; selectedId: string; closeUp: boolean;
  fabricColor: string; stitchColor?: string; onChange: (styles: TshirtHemStyles) => void;
  onSelect: (id: string) => void; onCloseUp: (closeUp: boolean) => void;
}) {
  const all = styles?.editing?.applyAll !== false;
  const selected = regions.find(region => region.id === selectedId) ?? regions[0];
  const effective = (region: HemRegion): HemSettings => ({ color: region.color ?? '', depth: 1, ribWeight: .4, stitchColor: '', ...resolveHemSettings(styles, region.id) });
  const current = selected ? effective(selected) : {};
  const targets = all ? regions : selected ? [selected] : [];
  const mixed = (key: keyof HemSettings) => all && targets.some(region => effective(region)[key] !== current[key]);
  const patch = (settings: HemSettings, construction = false) => {
    const ids = targets.filter(region => !construction || region.adjustable).map(region => region.id);
    if (!ids.length) return;
    onChange(updateHemSettings(styles, ids, selected.id, settings));
  };
  const compatible = selected ? regions.filter(region => region.adjustable === selected.adjustable) : [];
  const constructionEnabled = Boolean(selected?.adjustable);
  const controlClass = 'w-full rounded border border-white/15 bg-[#202023] p-2 text-xs text-white';
  return <div className="space-y-4" data-hem-panel="">
    <label className="flex items-center justify-between gap-3 text-xs font-medium text-white">
      Apply to all hems
      <input type="checkbox" role="switch" aria-label="Apply to all hems" checked={all}
        onChange={event => onChange({ ...styles, editing: { ...styles?.editing, applyAll: event.target.checked } })} className="accent-[#CC2D24]" />
    </label>
    {!selected ? <p className="text-xs text-white/60">This garment has no independently editable hem regions. Its hems are built into the garment artwork.</p> : <>
      <div className="flex gap-1" role="group" aria-label="Hem preview mode">
        {['Garment', 'Close-up'].map((label, index) => <button key={label} type="button" aria-pressed={closeUp === Boolean(index)}
          onClick={() => onCloseUp(Boolean(index))} className="rounded px-3 py-2 text-xs text-white/65 aria-pressed:bg-white/15 aria-pressed:text-white">{label}</button>)}
      </div>
      <label className="block space-y-1.5 text-xs text-white/65">
        <span>{all ? 'Inspect hem' : 'Edit hem'}</span>
        <select aria-label={all ? 'Inspect hem' : 'Edit hem'} value={selected.id} onChange={event => onSelect(event.target.value)} className={controlClass}>
          {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
      </label>
      <div className="text-xs font-medium text-white">{all ? 'All compatible hems' : selected.name}</div>
      <label className="block space-y-1.5 text-xs text-white/65"><span>Finish</span>
        <select aria-label="Hem finish" className={controlClass} disabled={!constructionEnabled}
          value={mixed('finish') ? 'mixed' : current.finish ?? 'normal'} onChange={event => patch({ finish: event.target.value as HemSettings['finish'] }, true)}>
          {mixed('finish') && <option value="mixed" disabled>Mixed</option>}
          <option value="normal">Folded hem</option><option value="ribbed">Ribbed band</option><option value="none">No hem</option>
        </select>
      </label>
      {!constructionEnabled && <p className="text-xs text-white/50">Finish and depth are fixed by this asset. Available native constructions are listed below.</p>}
      <TrimColorFamilyPicker label={`Hem fabric colour${mixed('color') ? ' (mixed)' : ''}`} value={current.color || fabricColor}
        onChange={color => patch({ color })} onClear={() => patch({ color: '' })} />
      <fieldset disabled={!constructionEnabled || current.finish === 'none'} className="space-y-3 disabled:opacity-40">
        <TrimColorFamilyPicker label={`Hem stitch colour${mixed('stitchColor') ? ' (mixed)' : ''}`} value={current.stitchColor || stitchColor || '#B0B0B0'}
          onChange={color => patch({ stitchColor: color }, true)} onClear={() => patch({ stitchColor: '' }, true)} />
        <label className="block space-y-2 text-xs text-white/65"><span>Hem depth / cuff height{mixed('depth') ? ' (mixed)' : ''}</span>
          <input aria-label="Hem depth" type="range" min="55" max="100" step="5" value={Math.round((current.depth ?? 1) * 100)}
            onChange={event => patch({ depth: event.currentTarget.valueAsNumber / 100 }, true)} className="w-full accent-[#CC2D24]" />
          <span className="flex justify-between text-[10px]"><span>Narrow</span><span>{Math.round((current.depth ?? 1) * 100)}% of allowance</span><span>Full</span></span>
        </label>
        {current.finish === 'ribbed' && <label className="block space-y-2 text-xs text-white/65"><span>Rib definition{mixed('ribWeight') ? ' (mixed)' : ''}</span>
          <input aria-label="Rib definition" type="range" min="15" max="75" step="5" value={Math.round((current.ribWeight ?? .4) * 100)}
            onChange={event => patch({ ribWeight: event.currentTarget.valueAsNumber / 100 }, true)} className="w-full accent-[#CC2D24]" />
        </label>}
      </fieldset>
      <p className="text-[11px] text-white/50">Depth stays within the existing hem allowance; garment length is unchanged. Clear fabric colour to inherit the garment fabric.</p>
      <button type="button" className="flex w-full items-center gap-2 rounded border border-white/15 px-3 py-2 text-left text-xs text-white/80"
        onClick={() => onChange(copyHemSettings(styles, compatible.map(region => region.id), current))}>
        <Copy size={14} className="shrink-0" />Apply current settings to all compatible hems
      </button>
      {!all && <button type="button" className="flex items-center gap-2 text-xs text-white/65"
        onClick={() => onChange({ ...styles, editing: { ...styles?.editing, regions: { ...styles?.editing?.regions,
          [selected.id]: { finish: 'normal', color: '', stitchColor: '', depth: 1, ribWeight: .4, ...styles?.editing?.global } } } })}>
        <RotateCcw size={14} />Reset this hem to global settings
      </button>}
    </>}
  </div>;
}