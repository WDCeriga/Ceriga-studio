import { useEffect, useId, useState } from 'react';
import { Shirt, ZoomIn } from 'lucide-react';
import type { ResolvedGarmentLayer } from '../../data/garmentSvgCatalog';
import type { TshirtHemStyles } from '../../data/tshirtHemStyles';
import {
  availableStitchRegions, measureStitchGeometry, renderStitchStyles, resolveStitchSettings,
  stitchRegionPath, updateStitchSettings, STITCH_THREAD_OPTIONS, TSHIRT_STITCH_OPTIONS, TSHIRT_STITCH_REGIONS,
  type StitchGeometry, type StitchRegion, type StitchSettings, type StitchStyle, type TshirtStitching,
} from '../../data/tshirtStitching';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';
import hemGeometry from '../../../assets/studio-tshirt/hem-styles.json';
import { stitchVariant } from '../../data/tshirtStitching';

export type StitchEditor = { region: StitchRegion; closeUp: boolean; onSelect: (region: StitchRegion) => void };

export function useStitchGeometry(layers: ResolvedGarmentLayer[], fit: string, enabled = true) {
  const [result, setResult] = useState<{ layers: ResolvedGarmentLayer[]; geometry: StitchGeometry }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setFailed(false);
    measureStitchGeometry(layers, fit).then(geometry => {
      if (active) setResult({ layers, geometry });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [layers, fit, enabled]);
  return { geometry: result?.layers === layers ? result.geometry : undefined, failed };
}

export function TshirtStitchingLayer({ layers, fit, settings, hems, fabricColor }: {
  layers: ResolvedGarmentLayer[]; fit: string; settings: TshirtStitching; hems?: TshirtHemStyles; fabricColor?: string;
}) {
  const prefix = useId().replace(/:/g, '');
  const { geometry, failed } = useStitchGeometry(layers, fit);
  const source = layers.find(layer => layer.id === 'stitching');
  const hemClips = (hemGeometry as Record<string, Record<string, { stitchCut: string }>>)[`${fit}:${stitchVariant(layers)}`];
  const colors = fabricColor ? Object.fromEntries(layers.filter(layer => layer.kind === 'solid').map(layer => [layer.id, layer.tint ?? fabricColor])) : undefined;
  if (colors) colors.neckline = colors.neck ?? colors.base;
  const markup = source && geometry ? renderStitchStyles(source, { ...geometry, hemClips }, settings, hems, colors, prefix) : '';
  return <div data-layer-id="stitching" data-stitch-ready={Boolean(geometry)} data-stitch-error={failed || undefined}
    className="pointer-events-none absolute inset-0 [&_*]:pointer-events-none [&>svg]:h-full [&>svg]:w-full" aria-hidden="true"
    style={{ zIndex: source?.zIndex ?? 80 }} dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function StitchRegionOverlay({ geometry, hems, editor }: {
  geometry: StitchGeometry; hems?: TshirtHemStyles; editor: StitchEditor;
}) {
  return <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 z-[250] h-full w-full" aria-label="Stitching regions">
    {availableStitchRegions(geometry, hems).map(region => <g key={region}>
      <path d={stitchRegionPath(geometry, region)} fill="none" stroke="transparent" strokeWidth="18"
        vectorEffect="non-scaling-stroke" pointerEvents="stroke" className="cursor-pointer"
        role="button" tabIndex={0} aria-label={`Select ${TSHIRT_STITCH_REGIONS[region]}`} aria-pressed={editor.region === region}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); editor.onSelect(region); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editor.onSelect(region); } }}>
        <title>{TSHIRT_STITCH_REGIONS[region]}</title>
      </path>
    </g>)}
  </svg>;
}

export function TshirtStitchingPanel({ layers, fit, settings = {}, hems, color, onChange, editor, onCloseUpChange }: {
  layers: ResolvedGarmentLayer[]; fit: string; settings?: TshirtStitching; hems?: TshirtHemStyles;
  color?: string; onChange: (settings: TshirtStitching) => void;
  editor: StitchEditor; onCloseUpChange: (closeUp: boolean) => void;
}) {
  const { geometry, failed } = useStitchGeometry(layers, fit);
  const [applyToAll, setApplyToAll] = useState(true);
  const [confirmGlobal, setConfirmGlobal] = useState(false);
  const available = geometry ? availableStitchRegions(geometry, hems) : [];
  const region = available.includes(editor.region) ? editor.region : available[0];
  useEffect(() => {
    if (region && region !== editor.region) editor.onSelect(region);
  }, [region, editor.region, editor.onSelect]);
  if (failed) return <p role="alert" className="text-xs text-red-300">Stitch geometry could not be loaded.</p>;
  if (!geometry) return <p role="status" className="text-xs text-white/50">Loading stitches...</p>;
  const selected = applyToAll ? settings.global ?? {} : region ? resolveStitchSettings(settings, region) : {};
  const change = (patch: StitchSettings) => {
    if (region) onChange(updateStitchSettings(settings, patch, region, applyToAll));
  };
  return <div className="space-y-5">
    <div className="space-y-2 border-b border-white/10 pb-4">
      <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium text-white">
        Apply to all stitching
        <input type="checkbox" role="switch" className="h-4 w-4 accent-cyan-400" checked={applyToAll}
          onChange={event => { if (event.target.checked) setConfirmGlobal(true); else { setApplyToAll(false); setConfirmGlobal(false); } }} />
      </label>
      <p className="text-[11px] text-white/55">Editing mode: <span className="text-cyan-300">{applyToAll ? 'Global' : 'Specific'}</span></p>
      {confirmGlobal && <div role="alert" className="space-y-3 border-l-2 border-amber-400 pl-3 text-xs text-white/80">
        <p>Replace all part settings with the global stitch type, colour and thread appearance?</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded bg-white px-3 py-2 text-black" onClick={() => {
            if (region) onChange(updateStitchSettings(settings, {}, region, true));
            setApplyToAll(true); setConfirmGlobal(false);
          }}>Apply global settings</button>
          <button type="button" className="rounded border border-white/20 px-3 py-2" onClick={() => setConfirmGlobal(false)}>Cancel</button>
        </div>
      </div>}
    </div>
    <div role="group" aria-label="Stitching preview" className="grid grid-cols-2 gap-1 rounded border border-white/15 p-1">
      {[{ closeUp: false, label: 'Garment', Icon: Shirt }, { closeUp: true, label: 'Close-up', Icon: ZoomIn }].map(({ closeUp, label, Icon }) =>
        <button key={label} type="button" aria-pressed={editor.closeUp === closeUp} onClick={() => onCloseUpChange(closeUp)}
          className={`flex h-9 items-center justify-center gap-2 rounded text-xs ${editor.closeUp === closeUp ? 'bg-white/15 text-white' : 'text-white/50'}`}>
          <Icon size={14} />{label}
        </button>)}
    </div>
    <div className="space-y-2">
      <label htmlFor="stitch-region" className="block text-xs text-white/80">{applyToAll ? 'Focus seam' : 'Stitching part'}</label>
      <select id="stitch-region" value={region ?? ''} onChange={event => editor.onSelect(event.target.value as StitchRegion)}
        className="h-9 w-full rounded border border-white/20 bg-[#18181b] px-2 text-xs text-white">
        {!region && <option value="">No visible stitching</option>}
        {(Object.keys(TSHIRT_STITCH_REGIONS) as StitchRegion[]).map(part => <option key={part} value={part} disabled={!available.includes(part)}>
          {TSHIRT_STITCH_REGIONS[part]}{available.includes(part) ? '' : ' (unavailable)'}
        </option>)}
      </select>
    </div>
    <fieldset disabled={!region || confirmGlobal} className="space-y-4 disabled:opacity-50">
      <div className="space-y-2">
        <label htmlFor="stitch-style" className="block text-xs text-white/80">Stitch type</label>
        <select id="stitch-style" value={selected.style ?? 'standard'}
          className="h-9 w-full rounded border border-white/20 bg-[#18181b] px-2 text-xs text-white"
          onChange={event => change({ style: event.target.value as StitchStyle })}>
          {TSHIRT_STITCH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="stitch-thread" className="block text-xs text-white/80">Thread appearance</label>
        <select id="stitch-thread" value={selected.thread ?? 'regular'}
          className="h-9 w-full rounded border border-white/20 bg-[#18181b] px-2 text-xs text-white"
          onChange={event => change({ thread: event.target.value as StitchSettings['thread'] })}>
          {Object.entries(STITCH_THREAD_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <TrimColorFamilyPicker label="Thread colour" value={selected.color ?? color}
        onChange={value => change({ color: value })} onClear={() => change({ color: undefined })} />
    </fieldset>
  </div>;
}