import { useEffect, useId, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { ResolvedGarmentLayer } from '../../data/garmentSvgCatalog';
import { measureHoodieSeams, type HoodiePanelSeams, type HoodieSeamGeometry } from '../../data/hoodieSeamGeometry';
import {
  clearStitchOverride, HOODIE_STITCH_REGIONS, resolveStitchSettings, stitchPatternPath,
  STITCH_OPTIONS, STITCH_THREAD_OPTIONS, STITCH_WIDTHS, updateStitchSettings,
  type HoodieStitching, type StitchRegion, type StitchSettings, type StitchStyle,
} from '../../data/hoodieStitching';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';

export function useHoodieSeams(layers: ResolvedGarmentLayer[], enabled: boolean) {
  const [result, setResult] = useState<{ layers: ResolvedGarmentLayer[]; geometry: HoodieSeamGeometry }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setFailed(false);
    measureHoodieSeams(layers).then(geometry => {
      if (active) setResult({ layers, geometry });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [layers, enabled]);
  return { geometry: enabled && result?.layers === layers ? result.geometry : undefined, failed };
}

export function HoodieStitchLayer({ panel, settings }: { panel: HoodiePanelSeams; settings: HoodieStitching }) {
  const maskId = `hoodie-stitch-${useId().replace(/:/g, '')}`;
  const paths = useMemo(() => panel.seams.map(seam => {
    const resolved = resolveStitchSettings(settings, seam.region);
    const curve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    curve.setAttribute('d', seam.path);
    return { ...seam, resolved, pattern: resolved.visible ? stitchPatternPath(curve, resolved.style ?? 'standard') : '' };
  }), [panel, settings]);
  return <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" data-hoodie-stitches="true">
    <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048">
      <image href={panel.clearanceMask} width="2048" height="2048" />
    </mask></defs>
    <g mask={`url(#${maskId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {paths.map(({ region, pattern, resolved }, index) => pattern && <path key={`${region}-${index}`}
        data-stitch-region={region} data-stitch-style={resolved.style} d={pattern}
        stroke={/^#[\da-f]{6}$/i.test(resolved.color ?? '') ? resolved.color : '#B0B0B0'}
        strokeWidth={STITCH_WIDTHS[resolved.thread ?? 'regular']} />)}
    </g>
  </svg>;
}

export function HoodieStitchingPanel({ layers, settings, onChange }: {
  layers: ResolvedGarmentLayer[]; settings?: HoodieStitching; onChange: (settings: HoodieStitching | undefined) => void;
}) {
  const { geometry, failed } = useHoodieSeams(layers, true);
  const [scope, setScope] = useState<StitchRegion | 'global'>('global');
  const prefix = useId();
  const available = new Set(Object.values(geometry ?? {}).flatMap(panel => panel.seams.map(seam => seam.region)));
  const region = scope !== 'global' && available.has(scope) ? scope : undefined;
  const selected = resolveStitchSettings(settings ?? {}, region);
  const inherited = Boolean(region && !settings?.[region]);
  const change = (patch: StitchSettings) => onChange(updateStitchSettings(settings ?? {}, patch, region));
  const selectClass = 'h-9 w-full rounded border border-white/20 bg-[#18181b] px-2 text-xs text-white';
  if (failed) return <p role="alert" className="text-xs text-red-300">Hoodie seam geometry could not be loaded.</p>;
  if (!geometry) return <p role="status" className="text-xs text-white/50">Loading hoodie seams...</p>;
  return <div className="space-y-4" data-hoodie-stitch-panel="true">
    <div className="flex items-center justify-between border-b border-white/10 pb-3">
      <span className="text-xs font-medium text-white">Stitching</span>
      <button type="button" title="Reset stitching" aria-label="Reset stitching" className="p-2 text-white/60 hover:text-white"
        onClick={() => { onChange(undefined); setScope('global'); }}><RotateCcw size={15} /></button>
    </div>
    <div className="space-y-2">
      <label htmlFor={`${prefix}-scope`} className="block text-xs text-white/80">Stitching region</label>
      <select id={`${prefix}-scope`} className={selectClass} value={region ?? 'global'} onChange={event => setScope(event.target.value as typeof scope)}>
        <option value="global">Global stitching</option>
        {Object.entries(HOODIE_STITCH_REGIONS).map(([key, label]) => <option key={key} value={key} disabled={!available.has(key as StitchRegion)}>
          {label}{available.has(key as StitchRegion) ? '' : ' (unavailable)'}
        </option>)}
      </select>
    </div>
    {region && <label className="flex items-center justify-between gap-3 text-xs text-white/80">
      Override global settings
      <input type="checkbox" checked={!inherited} className="h-4 w-4 accent-cyan-400" onChange={event =>
        onChange(event.target.checked ? updateStitchSettings(settings ?? {}, {}, region) : clearStitchOverride(settings ?? {}, region))} />
    </label>}
    <fieldset disabled={inherited} className="space-y-4 disabled:opacity-50">
      <label className="flex items-center justify-between gap-3 text-xs text-white/80">
        Visible stitching
        <input type="checkbox" role="switch" checked={Boolean(settings) && selected.visible !== false} className="h-4 w-4 accent-cyan-400"
          onChange={event => change({ visible: event.target.checked })} />
      </label>
      <div className="space-y-2">
        <label htmlFor={`${prefix}-style`} className="block text-xs text-white/80">Stitch type</label>
        <select id={`${prefix}-style`} className={selectClass} value={selected.style} onChange={event => change({ style: event.target.value as StitchStyle })}>
          {STITCH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor={`${prefix}-thread`} className="block text-xs text-white/80">Line weight</label>
        <select id={`${prefix}-thread`} className={selectClass} value={selected.thread} onChange={event => change({ thread: event.target.value as StitchSettings['thread'] })}>
          {Object.entries(STITCH_THREAD_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <TrimColorFamilyPicker label="Thread colour" value={selected.color}
        onChange={color => change({ color })} onClear={() => change({ color: undefined })} />
    </fieldset>
  </div>;
}