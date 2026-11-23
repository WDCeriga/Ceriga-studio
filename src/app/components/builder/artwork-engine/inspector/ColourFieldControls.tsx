import { Plus, Trash2 } from 'lucide-react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioRange } from '../../shell/StudioControls';
import { COLOUR_FIELD_PRESETS, colourFieldCss, newFieldPoint, type ColourField, type ColourFieldPoint } from '../geometry/colourField';
import { setFieldPoint, useFieldPoint } from '../state/fieldPointSelection';
import './colour-field.css';

const Well = ({ label, value, onChange }: { label: string; value: string; onChange: (colour: string) => void }) => <label className="cx-field-well"><span>{label}</span><input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#171717'} onChange={event => onChange(event.target.value)} /></label>;

/** Soft multi-point colour: pick a look, then edit or drag every point. */
export function ColourFieldControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const field = element.colourField, activeId = useFieldPoint(), active = field?.points.find(item => item.id === activeId) ?? field?.points[0];
  const write = (next: ColourField) => update({ colourField: next, shapeFilled: true });
  const setPoint = (patch: Partial<ColourFieldPoint>) => { if (field && active) write({ ...field, points: field.points.map(item => item.id === active.id ? { ...item, ...patch } : item) }); };
  const presetId = field && COLOUR_FIELD_PRESETS.find(item => JSON.stringify(item.field) === JSON.stringify(field))?.id;
  return <StudioFold title="Colour field" rowHeight={40} value={field ? COLOUR_FIELD_PRESETS.find(item => item.id === presetId)?.label ?? 'Custom' : 'Off'}>
    <div className="cx-field-presets" role="group" aria-label="Colour field looks">
      {COLOUR_FIELD_PRESETS.map(item => <button key={item.id} type="button" aria-pressed={presetId === item.id} onClick={() => { write(structuredClone(item.field)); setFieldPoint(item.field.points[0].id); }}><span style={{ background: colourFieldCss(item.field) }} /><small>{item.label}</small></button>)}
    </div>
    {field && <>
      <Well label="Base colour" value={field.base} onChange={base => write({ ...field, base })} />
      <div className="cx-field-points" role="group" aria-label="Colour points">
        {field.points.map((item, index) => <button key={item.id} type="button" aria-label={`Point ${index + 1}`} aria-pressed={active?.id === item.id} style={{ background: item.colour }} onClick={() => setFieldPoint(item.id)} />)}
        <button type="button" className="is-add" aria-label="Add colour point" title="Add colour point" disabled={field.points.length >= 12} onClick={() => { const next = newFieldPoint(field, crypto.randomUUID()); write({ ...field, points: [...field.points, next] }); setFieldPoint(next.id); }}><Plus size={14} /></button>
      </div>
      {active && <>
        <Well label="Point colour" value={active.colour} onChange={colour => setPoint({ colour })} />
        <StudioRange label="Size" min={2} max={160} value={Math.round(active.size)} onChange={size => setPoint({ size })} />
        <StudioRange label="Softness" min={0} max={100} value={active.softness} onChange={softness => setPoint({ softness })} />
        <StudioRange label="Strength" min={0} max={100} value={active.opacity} onChange={opacity => setPoint({ opacity })} />
        <div className="studio-two-columns">
          <StudioRange label="X" min={-20} max={120} value={Math.round(active.x)} onChange={x => setPoint({ x })} />
          <StudioRange label="Y" min={-20} max={120} value={Math.round(active.y)} onChange={y => setPoint({ y })} />
        </div>
        {field.points.length > 1 && <button type="button" className="studio-outline-action cx-field-remove" onClick={() => { write({ ...field, points: field.points.filter(item => item.id !== active.id) }); setFieldPoint(null); }}><Trash2 size={14} />Remove point</button>}
      </>}
      <button type="button" className="cx-recipes__reset" onClick={() => { update({ colourField: undefined, shapeFillColor: field.base }); setFieldPoint(null); }}>Remove colour field</button>
    </>}
  </StudioFold>;
}
