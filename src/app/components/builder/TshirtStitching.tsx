import { useEffect, useState } from 'react';
import type { ResolvedGarmentLayer } from '../../data/garmentSvgCatalog';
import type { TshirtHemStyles } from '../../data/tshirtHemStyles';
import {
  measureStitchGeometry, renderStitchStyles, TSHIRT_STITCH_OPTIONS, TSHIRT_STITCH_REGIONS,
  type StitchGeometry, type StitchRegion, type StitchStyle, type TshirtStitching,
} from '../../data/tshirtStitching';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';

function useStitchGeometry(layers: ResolvedGarmentLayer[], fit: string) {
  const [result, setResult] = useState<{ layers: ResolvedGarmentLayer[]; geometry: StitchGeometry }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    measureStitchGeometry(layers, fit).then(geometry => {
      if (active) setResult({ layers, geometry });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [layers, fit]);
  return { geometry: result?.layers === layers ? result.geometry : undefined, failed };
}

export function TshirtStitchingLayer({ layers, fit, settings, hems }: {
  layers: ResolvedGarmentLayer[]; fit: string; settings: TshirtStitching; hems?: TshirtHemStyles;
}) {
  const { geometry, failed } = useStitchGeometry(layers, fit);
  const source = layers.find(layer => layer.id === 'stitching');
  const markup = source && geometry ? renderStitchStyles(source, geometry, settings, hems) : '';
  return <div data-layer-id="stitching" data-stitch-ready={Boolean(geometry)} data-stitch-error={failed || undefined}
    className="pointer-events-none absolute inset-0 [&_*]:pointer-events-none [&>svg]:h-full [&>svg]:w-full" aria-hidden="true"
    style={{ zIndex: source?.zIndex ?? 80 }} dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function TshirtStitchingPanel({ layers, fit, settings = {}, hems, color, onChange }: {
  layers: ResolvedGarmentLayer[]; fit: string; settings?: TshirtStitching; hems?: TshirtHemStyles;
  color?: string; onChange: (settings: TshirtStitching) => void;
}) {
  const { geometry, failed } = useStitchGeometry(layers, fit);
  if (failed) return <p role="alert" className="text-xs text-red-300">Stitch geometry could not be loaded.</p>;
  if (!geometry) return <p role="status" className="text-xs text-white/50">Loading stitches...</p>;
  return <div className="space-y-5">
    {(Object.keys(TSHIRT_STITCH_REGIONS) as StitchRegion[]).filter(region =>
      geometry.rows[region].length > 0 && hems?.[region as keyof TshirtHemStyles] !== 'none').map(region => (
      <div key={region} className="space-y-2 border-b border-white/10 pb-4">
        <label className="block text-xs text-white/80" htmlFor={`stitch-${region}`}>{TSHIRT_STITCH_REGIONS[region]}</label>
        <select id={`stitch-${region}`} value={settings[region]?.style ?? 'standard'}
          className="h-9 w-full rounded border border-white/20 bg-[#18181b] px-2 text-xs text-white"
          onChange={event => onChange({ ...settings, [region]: { ...settings[region], style: event.target.value as StitchStyle } })}>
          {TSHIRT_STITCH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <TrimColorFamilyPicker label={`${TSHIRT_STITCH_REGIONS[region]} colour`}
          value={settings[region]?.color ?? color}
          onChange={value => onChange({ ...settings, [region]: { ...settings[region], color: value } })}
          onClear={() => onChange({ ...settings, [region]: { ...settings[region], color: undefined } })} />
      </div>
    ))}
  </div>;
}