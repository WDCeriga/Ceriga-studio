import type { DesignElement } from '../PrintsDesignStep';
import { customAreaGeometryPatch, linkCustomAreaHandles, setCustomAreaPointType } from '../../../lib/customAreaGeometry';
import { usePrintsStudio } from './PrintsStudioContext';

export function CustomAreaPathControls({ element, onChange }: { element: DesignElement; onChange: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio();
  const editing = studio.tool === 'customAreaEdit' || studio.tool === 'customAreaAddPoint';
  const points = element.customAreaPoints ?? [];
  const selected = studio.customAreaPointSelection;
  const indices = selected?.id === element.id ? (selected.indices ?? [selected.index]).filter(i => i >= 0 && i < points.length) : [];
  const button = 'h-9 rounded border border-white/20 px-2 text-[10px] text-white disabled:opacity-35';
  const apply = (next: typeof points) => onChange(customAreaGeometryPatch(next, element));
  const curves = indices.length > 0 && indices.every(i => points[i].in || points[i].out);
  return <fieldset disabled={element.locked} className="space-y-2 disabled:opacity-50" data-custom-area-path-controls>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={button} aria-pressed={editing} onClick={() => {
        studio.setCustomAreaPointSelection(null); studio.setTool(editing ? 'select' : 'customAreaEdit');
        studio.setCropEditingId(null); studio.setDistortEditingId(null); studio.setWarpEditingId(null);
      }}>{editing ? 'Done Editing Path' : 'Edit Path'}</button>
      <button type="button" className={button} aria-pressed={studio.tool === 'customAreaAddPoint'} onClick={() => studio.setTool(studio.tool === 'customAreaAddPoint' ? 'customAreaEdit' : 'customAreaAddPoint')}>Add Point</button>
    </div>
    {editing && <>
      <label className="block text-[10px] text-white/70">Point Type
        <select aria-label="Point Type" disabled={!indices.length} value={!indices.length ? '' : curves ? 'smooth' : indices.every(i => !points[i].in && !points[i].out) ? 'corner' : ''}
          className="mt-1 h-9 w-full rounded border border-white/20 bg-zinc-950 px-2 text-white disabled:opacity-35"
          onChange={event => apply(setCustomAreaPointType(points, indices, event.target.value === 'smooth'))}>
          <option value="" disabled>{indices.length ? 'Mixed' : 'Select anchors'}</option><option value="corner">Corner / Straight</option><option value="smooth">Smooth / Curved</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-[10px] text-white/70"><input type="checkbox" aria-label="Linked Handles" disabled={!curves}
        checked={curves && indices.every(i => points[i].linked !== false)} onChange={event => apply(linkCustomAreaHandles(points, indices, event.target.checked))} />Linked Handles</label>
      <button type="button" className={`${button} w-full`} disabled={!indices.length || points.length - indices.length < 3} onClick={() => {
        apply(points.filter((_, i) => !indices.includes(i))); studio.setCustomAreaPointSelection(null);
      }}>Delete Point</button>
      <p className="text-[10px] leading-relaxed text-white/50">Shift-click anchors to select several. Drag a line to bend it. Click the + on a line to add an anchor without changing the curve. Delete removes selected points; Escape finishes editing.</p>
    </>}
  </fieldset>;
}
