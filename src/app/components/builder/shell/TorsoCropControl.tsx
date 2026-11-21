import {ChevronDown} from 'lucide-react';
import type {CSSProperties} from 'react';
import {VisualOptionGrid,LengthSilhouette,LengthImage} from '../design-system';
import './torso-crop.css';
import './sweatpants-controls.css';

const presets = [[0, 'Original'], [14, 'Cropped'], [24, 'Extra cropped']] as const;
type Preset = `${typeof presets[number][0]}`;
const MAX = 30;
const round = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Body length for T-shirt and Hoodie. Identical to the Tank and Joggers length control: same heading,
 * same option grid, and the same "Length adjustment" field in centimetres. State is unchanged —
 * `value` is still % shorter (0–30); the field converts using the garment's body length.
 */
export function TorsoCropControl({value=0,onChange,garmentImage,bodyLengthCm}:{value?:number;onChange:(value:number)=>void;
  /** Real render of this garment (e.g. hoodie). When given, previews cut that image; otherwise the T-shirt silhouette is used. */
  garmentImage?:string;
  /** Finished body length of the base size, used to show the adjustment in cm. */
  bodyLengthCm?:number}){
  const length = bodyLengthCm && bodyLengthCm > 0 ? bodyLengthCm : 70;
  const min = -round((MAX / 100) * length, 0.5);
  const cm = -round((value / 100) * length, 0.5) || 0;
  const current = presets.some(([amount]) => amount === value) ? String(value) as Preset : null;
  const summary = cm ? `${cm} cm` : 'Original length';
  const setCm = (n: number) => { if (Number.isFinite(n)) { const c = Math.max(min, Math.min(0, n)); onChange(Math.round((-c / length) * 1000) / 10); } };
  return <details className="sweatpants-choice torso-crop-control cx" open>
    <summary><span>Body length<small>{summary}</small></span><ChevronDown size={16}/></summary>
    <VisualOptionGrid label="Body length presets" columns={3} value={current}
      options={presets.map(([amount, label]) => ({ id: String(amount) as Preset, label,
        preview: garmentImage ? <LengthImage src={garmentImage} shortenPercent={amount} /> : <LengthSilhouette shortenPercent={amount} /> }))}
      onChange={id => onChange(Number(id))} />
    <div className="sweatpants-length-adjuster" style={{ '--length-position': `${((cm - min) / -min) * 100}%` } as CSSProperties}>
      <div className="sweatpants-length-value">
        <label htmlFor="torso-length-adjustment">Length adjustment</label>
        <span><input id="torso-length-adjustment" type="number" aria-label="Length adjustment in centimetres" min={min} max={0} step={0.5} value={cm}
          onChange={e => setCm(Number(e.target.value))} /> cm</span>
      </div>
      <div className="sweatpants-length-slider"><div className="sweatpants-length-track" aria-hidden="true" /><input type="range" aria-label="Adjust body length" min={min} max={0} step={0.5} value={cm} onChange={e => setCm(Number(e.target.value))} /></div>
      <div className="sweatpants-length-scale" aria-hidden="true"><span>{min} cm</span><span>0 cm</span></div>
      <button className="sweatpants-length-reset" type="button" disabled={!value} onClick={() => onChange(0)}>Reset length</button>
    </div>
    <p className="cx-section-helper">Adjusts the body and hem only.</p>
  </details>;
}
