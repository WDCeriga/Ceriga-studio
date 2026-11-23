import { StudioRange } from '../../shell/StudioControls';
import { volumeUsesLight, volumeUsesPaper, type VolumeCap, type VolumeSettings } from '../../../../lib/brushVolume';
import './volume-brush.css';

const CAPS: { id: VolumeCap; label: string }[] = [{ id: 'sharp', label: 'Sharp' }, { id: 'round', label: 'Round' }, { id: 'bulb', label: 'Bulb' }];
const Caps = ({ label, value, onChange }: { label: string; value: VolumeCap; onChange: (cap: VolumeCap) => void }) => <div className="cx-volume-row"><span>{label}</span><div className="cx-volume-seg" role="group" aria-label={label}>{CAPS.map(cap => <button key={cap.id} type="button" aria-pressed={value === cap.id} onClick={() => onChange(cap.id)}>{cap.label}</button>)}</div></div>;

/** Every value of a 3D or contour brush. Used while drawing and on finished drawings. */
export function VolumeBrushControls({ preset, values, onChange }: { preset: string; values: Partial<VolumeSettings>; onChange: (patch: Partial<VolumeSettings>) => void }) {
  const inked = volumeUsesPaper(preset), lit = volumeUsesLight(preset), contour = ['halo-line', 'hairline', 'double-line'].includes(preset), neon = preset === 'neon-tube', v = (key: keyof VolumeSettings, fallback: number) => Number(values[key] ?? fallback);
  return <div className="cx-volume">
    <Caps label="Start" value={values.capStart ?? 'round'} onChange={capStart => onChange({ capStart })} />
    <Caps label="End" value={values.capEnd ?? 'round'} onChange={capEnd => onChange({ capEnd })} />
    {!neon && <StudioRange label={preset === 'halo-line' ? 'Core width' : preset === 'double-line' ? 'Inner line' : 'Depth'} min={contour ? 10 : 20} max={contour ? 100 : 200} value={v('volumeDepth', 100)} onChange={volumeDepth => onChange({ volumeDepth })} />}
    {lit && <><StudioRange label="Light angle" min={0} max={360} unit="°" value={v('volumeLight', 225)} onChange={volumeLight => onChange({ volumeLight })} />
      <StudioRange label="Light height" min={10} max={85} unit="°" value={v('volumeElevation', 48)} onChange={volumeElevation => onChange({ volumeElevation })} /></>}
    {lit && !inked && <StudioRange label="Gloss" min={0} max={100} value={v('volumeGloss', 35)} onChange={volumeGloss => onChange({ volumeGloss })} />}
    {(inked && !contour || ['puffy-paint', 'clay', 'icing', 'yarn'].includes(preset)) && <StudioRange label={inked ? 'Dot size' : 'Texture size'} min={30} max={300} value={v('volumeDetail', 100)} onChange={volumeDetail => onChange({ volumeDetail })} />}
    {inked && <StudioRange label="Outline" min={0} max={100} value={v('volumeOutline', 12)} onChange={volumeOutline => onChange({ volumeOutline })} />}
    {lit && <StudioRange label="Creases" min={0} max={100} value={v('volumeCreases', 0)} onChange={volumeCreases => onChange({ volumeCreases })} />}
    {!inked && <StudioRange label={neon ? 'Glow' : 'Shadow'} min={0} max={100} value={v('volumeShadow', 0)} onChange={volumeShadow => onChange({ volumeShadow })} />}
    {inked && <div className="cx-volume-row"><label className="cx-volume-check"><input type="checkbox" aria-label="Fill behind ink" checked={values.volumePaperOn !== false} onChange={event => onChange({ volumePaperOn: event.target.checked })} />Fill behind ink</label>{values.volumePaperOn !== false && <input type="color" aria-label="Fill colour" value={values.volumePaper ?? '#ffffff'} onChange={event => onChange({ volumePaper: event.target.value })} />}</div>}
    <label className="cx-volume-check"><input type="checkbox" aria-label="Fuse crossing strokes" checked={values.volumeMerge !== false} onChange={event => onChange({ volumeMerge: event.target.checked })} />Fuse crossing strokes</label>
  </div>;
}
