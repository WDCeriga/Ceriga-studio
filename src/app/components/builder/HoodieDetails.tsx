import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { GarmentDetailsPanel, type DetailEditorState } from './GarmentDetails';
import type { DetailBounds, GarmentDetail } from '../../data/garmentDetails';

export const HOODIE_DETAIL_LAYERS: Record<string, string> = {
  base: 'Body', hood: 'Hood', sleeveLeft: 'Left sleeve', sleeveRight: 'Right sleeve',
  sleeveHemLeft: 'Left cuff', sleeveHemRight: 'Right cuff', bodyHem: 'Waistband', pocket: 'Kangaroo pocket',
};

export function HoodieDetailsPanel({ details, onChange, selectedId, onSelect, target, onTargetChange, bounds, color, editor }: {
  details: GarmentDetail[]; onChange: (details: GarmentDetail[]) => void;
  selectedId: string | null; onSelect: (id: string | null) => void;
  target: string; onTargetChange: (target: string) => void;
  bounds: Record<string, DetailBounds>; color: string;
  editor: DetailEditorState;
}) {
  const front = details.filter(detail => (detail.view ?? 'front') === 'front');
  const selected = front.find(detail => detail.id === selectedId);
  const attachment = selected?.attachment ?? target;
  const sameLayer = front.filter(detail => (detail.attachment ?? 'base') === attachment);
  const position = sameLayer.findIndex(detail => detail.id === selectedId);
  const reorder = (offset: number) => {
    const other = sameLayer[position + offset];
    if (!selected || !other) return;
    const next = [...details];
    const first = next.indexOf(selected), second = next.indexOf(other);
    [next[first], next[second]] = [next[second], next[first]];
    onChange(next);
  };
  return <section aria-label="Hoodie trims and details" className="space-y-4 border-t border-white/15 pt-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase text-white">Trims &amp; Details</h3>
      <button type="button" title="Reset trims" aria-label="Reset trims" disabled={!front.length}
        onClick={() => { onChange(details.filter(detail => detail.view === 'back')); onSelect(null); }}
        className="p-2 text-white/70 disabled:opacity-30"><RotateCcw size={16} /></button>
    </div>
    <label className="block text-xs text-white/70">Attachment layer
      <select aria-label="Trim attachment layer" value={attachment} className="mt-2 w-full rounded border border-white/15 bg-[#202023] p-2 text-white"
        onChange={event => { const next = event.target.value; onTargetChange(next); if (selected) onChange(details.map(detail => detail.id === selected.id ? { ...detail, attachment: next } : detail)); }}>
        {Object.entries(HOODIE_DETAIL_LAYERS).filter(([id]) => bounds[id]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    {selected && <div role="group" aria-label="Trim order on attachment" className="flex gap-2">
      <button type="button" title="Move trim backward" aria-label="Move trim backward" disabled={position <= 0} onClick={() => reorder(-1)} className="p-2 text-white disabled:opacity-30"><ArrowDown size={16} /></button>
      <button type="button" title="Move trim forward" aria-label="Move trim forward" disabled={position < 0 || position === sameLayer.length - 1} onClick={() => reorder(1)} className="p-2 text-white disabled:opacity-30"><ArrowUp size={16} /></button>
    </div>}
    {bounds[attachment] && <GarmentDetailsPanel details={front} selectedId={selectedId} color={color} bounds={bounds[attachment]}
      onSelect={id => { onSelect(id); const detail = front.find(item => item.id === id); if (detail) onTargetChange(detail.attachment ?? 'base'); }}
      onChange={next => onChange([...details.filter(detail => detail.view === 'back'), ...next.map(detail => ({ ...detail, view: 'front' as const, attachment: detail.attachment ?? attachment }))])}
      editor={editor} />}
  </section>;
}