import { ArrowDown, ArrowUp, Plus, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import type { GarmentLabel } from '../../data/garmentLabels';
import { createHoodieSizeLabel, hoodieLabelVisibility, isHoodieNeckLabel, type HoodieLabelView } from '../../data/hoodieLabels';
import { GarmentLabelsPanel } from './GarmentLabelsPanel';
import { LabelArtwork } from './LabelArtwork';

export function HoodieLabelsPanel({ labels, selectedId, onSelect, onChange, view, onViewChange }: {
  labels: GarmentLabel[]; selectedId: string | null;
  onSelect: (id: string | null) => void; onChange: (labels: GarmentLabel[]) => void;
  view: HoodieLabelView; onViewChange: (view: HoodieLabelView) => void;
}) {
  const selected = labels.find(label => label.id === selectedId);
  useEffect(() => { if (selected) onViewChange(isHoodieNeckLabel(selected) ? 'interior' : 'exterior'); }, [selected?.id, selected?.position, onViewChange]);
  const index = labels.findIndex(label => label.id === selectedId);
  const reorder = (direction: number) => {
    const next = [...labels];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };
  return <section aria-label="Hoodie labels and branding" className="min-w-0 space-y-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold text-white">Labels & Branding</h3>
      <button type="button" title="Reset labels" aria-label="Reset labels" disabled={!labels.length}
        className="p-2 text-white/65 disabled:opacity-30" onClick={() => { onChange([]); onSelect(null); }}><RotateCcw size={16} /></button>
    </div>
    {selected && isHoodieNeckLabel(selected) && <div className="grid grid-cols-2 gap-1" role="group" aria-label="Label garment context">
      {(['exterior', 'interior'] as const).map(context => <button key={context} type="button" aria-pressed={view === context}
        className="rounded bg-white/5 px-3 py-2 text-xs text-white/70 aria-pressed:bg-white/20" onClick={() => onViewChange(context)}>
        {context === 'interior' ? 'Interior neck' : 'Exterior'}</button>)}
    </div>}
    <button type="button" className="flex items-center gap-2 text-xs text-white/75" onClick={() => {
      const label = createHoodieSizeLabel(); onChange([...labels, label]); onSelect(label.id);
    }}><Plus size={14} />Add size label</button>
    {selected && <>
      {selected.category === 'tag' && <svg aria-label="Label artwork proof" viewBox={`-3 -3 ${selected.widthMm + 6} ${selected.heightMm + 6}`}
        className="h-48 w-full rounded bg-[#e7e9ec] p-3"><LabelArtwork label={selected} /></svg>}
      <p role="status" className="text-xs leading-relaxed text-white/65">{hoodieLabelVisibility(selected)}</p>
      <div className="flex items-center gap-2">
        <button type="button" title="Move label backward" aria-label="Move label backward" disabled={index <= 0}
          className="p-2 text-white/65 disabled:opacity-30" onClick={() => reorder(-1)}><ArrowDown size={16} /></button>
        <button type="button" title="Move label forward" aria-label="Move label forward" disabled={index < 0 || index >= labels.length - 1}
          className="p-2 text-white/65 disabled:opacity-30" onClick={() => reorder(1)}><ArrowUp size={16} /></button>
        <span className="text-[11px] text-white/45">Preview scale: 500 mm body width</span>
      </div>
    </>}
    <GarmentLabelsPanel labels={labels} selectedId={selectedId} onSelect={onSelect} onChange={onChange} tagView="front" />
  </section>;
}