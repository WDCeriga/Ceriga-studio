import { useState } from 'react';
import type { DetailBounds, GarmentDetail } from '../../data/garmentDetails';
import { createOpening, resetOpening, setOpeningEndpoint, validateOpening, type OpeningPlacement } from '../../data/garmentOpenings';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';
import type { DetailEditorState } from './GarmentDetails';

const placements: { value: OpeningPlacement; label: string }[] = [
  { value: 'neckline', label: 'Neckline opening' },
  { value: 'shoulder', label: 'Shoulder opening' },
  { value: 'side-seam', label: 'Side seam opening' },
  { value: 'hem', label: 'Bottom / side hem opening' },
  { value: 'full-front', label: 'Full centre opening' },
  { value: 'free', label: 'Free body slit' },
];

function CoordinateInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  const [text, setText] = useState<string | null>(null);
  const display = Number.isFinite(value) ? String(Number(value.toFixed(1))) : '';
  return <label className="min-w-0 text-[11px] text-white/60">{label}
    <input type="number" aria-label={label} min={min} max={max} step="1" value={text ?? display}
      onFocus={() => setText(display)} onBlur={() => setText(null)}
      onChange={event => { setText(event.target.value); const n = event.target.valueAsNumber; if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n); }}
      className="mt-1 w-full min-w-0 rounded border border-white/15 bg-white/5 p-2 text-white" />
  </label>;
}

export function OpeningControls({ detail, bounds, onChange, editor }: {
  detail: GarmentDetail; bounds?: DetailBounds; onChange: (detail: GarmentDetail) => void; editor?: DetailEditorState;
}) {
  const [placement, setPlacement] = useState<OpeningPlacement>('neckline');
  const opening = detail.opening;
  const openingPercent = Math.round(Math.max(0, Math.min(1, detail.zipSliderPosition ?? (detail.variant === 'zip-05' ? .34 : 0))) * 100);
  const validation = bounds && opening ? validateOpening(detail, bounds) : undefined;
  return <section aria-label="Opening construction" className="space-y-3 border-y border-white/15 py-3">
    <h3 className="text-xs font-semibold text-white">Opening construction</h3>
    {!opening && <p className="text-[11px] leading-relaxed text-white/60">This saved zip is an overlay. Its garment stays unchanged until you explicitly convert it.</p>}
    <label className="block text-[11px] text-white/60">Placement preset
      <select aria-label="Opening attachment" value={opening?.attachment ?? placement} disabled={!bounds}
        onChange={event => { const value = event.target.value as OpeningPlacement; setPlacement(value); if (opening && bounds) onChange(createOpening(detail, bounds, value)); }}
        className="mt-1 w-full rounded border border-white/15 bg-[#141416] p-2 text-xs text-white">
        {placements.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {!opening && <button type="button" disabled={!bounds} onClick={() => bounds && onChange(createOpening(detail, bounds, placement))}
      className="rounded border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-40">Convert to constructed opening</button>}
    {!bounds && <p role="status" className="text-xs text-amber-300">Waiting for garment geometry.</p>}
    {opening && <>
      {validation && <div role="status" data-opening-status={validation.status} className={`text-xs ${validation.status === 'Valid' ? 'text-white/70' : 'text-amber-300'}`}>
        <strong>{validation.status}</strong>{validation.reasons.map(reason => <p key={reason} className="mt-1">{reason}</p>)}
      </div>}
      <p className="text-[11px] leading-relaxed text-white/50">Drag the tape to move the whole zip; use its round handle to rotate. Presets place the opening once, without locking it to the collar or seam. Drag either endpoint to reshape it. Coordinates are drawing units, not physical measurements.</p>
      {editor?.onOpeningSnapChange && <label className="flex items-center gap-2 text-xs text-white/60">
        <input type="checkbox" aria-label="Snap opening to guides" checked={editor.openingSnap ?? false} onChange={event => editor.onOpeningSnapChange?.(event.target.checked)} />
        Snap to guides (hold Alt to bypass)
      </label>}
      <div role="group" aria-label="Open or close zip" className="space-y-2">
        <label className="flex items-center gap-3 text-xs text-white/70">Zip opening
          <input type="range" min="0" max="100" step="1" aria-label="Zip opening" aria-valuetext={`${openingPercent}% open`}
            value={openingPercent} onChange={event => onChange({ ...detail, zipSliderPosition: event.currentTarget.valueAsNumber / 100 })}
            className="min-w-0 flex-1 accent-[#CC2D24]" />
          <output className="w-9 text-right">{openingPercent}%</output>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onChange({ ...detail, zipSliderPosition: 0 })} className="rounded border border-white/15 px-3 py-2 text-xs text-white">Close zip</button>
          <button type="button" onClick={() => onChange({ ...detail, zipSliderPosition: .22 })} className="rounded border border-white/15 px-3 py-2 text-xs text-white">Slightly open</button>
          <button type="button" onClick={() => onChange({ ...detail, zipSliderPosition: .55 })} className="rounded border border-white/15 px-3 py-2 text-xs text-white">More open</button>
          <button type="button" onClick={() => onChange({ ...detail, zipSliderPosition: 1 })} className="rounded border border-white/15 px-3 py-2 text-xs text-white">Open zip fully</button>
        </div>
        <p className="text-[11px] text-white/50">Drag the pull or use this slider to separate the teeth and fabric. Inspect the result in Final zip; this is a flat preview, not a cloth simulation.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(['start', 'end'] as const).flatMap(endpoint => (['x', 'y'] as const).map(axis => <CoordinateInput key={`${detail.id}-${endpoint}-${axis}`}
          label={`Opening ${endpoint} ${axis}`} value={opening[endpoint][axis]} min={0} max={2048}
          onChange={value => bounds && onChange(setOpeningEndpoint(detail, bounds, endpoint, { ...opening[endpoint], [axis]: value }))} />))}
        <CoordinateInput key={`${detail.id}-width`} label="Opening width (drawing units)" value={opening.width} min={1} max={200}
          onChange={width => onChange({ ...detail, opening: { ...opening, width } })} />
      </div>
      <TrimColorFamilyPicker label="Opening facing colour" value={opening.facingColor} onChange={facingColor => onChange({ ...detail, opening: { ...opening, facingColor } })}
        onClear={() => onChange({ ...detail, opening: { ...opening, facingColor: '#D4D4D4' } })} />
      {editor?.onOpeningStageChange && <div role="group" aria-label="Construction stages" className="grid grid-cols-2 gap-1">
        {([{ value: 'before', label: 'Before' }, { value: 'path', label: 'Opening path' }, { value: 'construction', label: 'Reconstructed' }, { value: 'final', label: 'Final zip' }] as const).map(stage =>
          <button type="button" key={stage.value} aria-pressed={(editor.openingStage ?? 'final') === stage.value} onClick={() => editor.onOpeningStageChange?.(stage.value)}
            className={`rounded border border-white/15 px-2 py-2 text-[11px] text-white ${(editor.openingStage ?? 'final') === stage.value ? 'bg-white/20' : ''}`}>{stage.label}</button>)}
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange(resetOpening(detail))} className="rounded border border-white/15 px-3 py-2 text-xs text-white">Reset opening</button>
        <button type="button" onClick={() => onChange({ ...detail, opening: undefined })} className="rounded border border-white/15 px-3 py-2 text-xs text-white">Remove opening; keep overlay</button>
      </div>
      <p className="text-[11px] text-white/50">This opening belongs only to the {detail.view ?? 'front'} view. To restore the unmodified garment completely, remove this zip.</p>
    </>}
  </section>;
}
