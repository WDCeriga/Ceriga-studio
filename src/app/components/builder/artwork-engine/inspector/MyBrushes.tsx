import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StudioFold } from '../../shell/StudioControls';
import { StrokeSample } from '../../shell/DrawPaintStudio';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { captureBrush, loadCustomBrushes, storeCustomBrushes, type CustomBrush } from '../../../../lib/customBrushes';
import { BRUSH_PRESETS } from '../../../../lib/drawingBrush';
import './volume-brush.css';

/** Save the current brush with every setting, then reuse it in one tap. */
export function MyBrushes({ onPick }: { onPick: () => void }) {
  const studio = usePrintsStudio(), [brushes, setBrushes] = useState<CustomBrush[]>(loadCustomBrushes), [name, setName] = useState(''), [active, setActive] = useState<string>();
  const tiles = useMemo(() => brushes.map(brush => ({ brush, preset: { id: brush.base, label: brush.name, size: brush.size, grain: brush.grain, settings: brush.settings } })), [brushes]);
  const commit = (next: CustomBrush[]) => { setBrushes(next); if (!storeCustomBrushes(next)) toast.error('Could not save this brush in your browser.'); };
  const save = () => { const label = name.trim() || `${BRUSH_PRESETS.find(item => item.id === studio.brushPreset)?.label ?? 'Brush'} ${brushes.length + 1}`, brush = captureBrush(studio, label, crypto.randomUUID()); commit([brush, ...brushes]); setActive(brush.id); setName(''); };
  const use = (brush: CustomBrush) => { onPick(); studio.setBrushPreset(brush.base); studio.patchBrush(brush.settings); studio.setBrushSize(brush.size); studio.setGrain(brush.grain); setActive(brush.id); };
  return <StudioFold title="My brushes" rowHeight={40} value={brushes.length || 'None'}>
    <div className="cx-my-brush-save"><input aria-label="Brush name" placeholder="Name this brush" maxLength={40} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save(); }} /><button type="button" onClick={save}><Plus size={14} />Save</button></div>
    {tiles.length > 0 && <div className="draw-brushes"><div className="draw-brush-grid" role="region" aria-label="My brushes" tabIndex={0}>{tiles.map(({ brush, preset }) => <div key={brush.id} className="cx-my-brush"><button type="button" aria-label={`Use my brush ${brush.name}`} aria-pressed={active === brush.id} onClick={() => use(brush)}><StrokeSample preset={preset} /><span>{brush.name}</span>{active === brush.id && <Check size={12} />}</button><button type="button" className="is-delete" aria-label={`Delete my brush ${brush.name}`} onClick={() => commit(brushes.filter(item => item.id !== brush.id))}><Trash2 size={12} /></button></div>)}</div></div>}
  </StudioFold>;
}
