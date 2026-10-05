import { useEffect, useId, useState } from 'react';
import { importedGarmentSizes, type ImportedGarment, type ImportedGarmentView } from '../../data/importedGarment';
import type { ImportedMeasurementGuide } from '../../data/importedGarmentMeasurements';

function SizeCell({ label, millimetres, unit, onChange, onHighlight }: {
  label: string; millimetres?: number; unit: 'cm' | 'mm'; onChange: (value?: number) => void; onHighlight: (active: boolean) => void;
}) {
  const factor = unit === 'cm' ? 10 : 1;
  const display = millimetres === undefined ? '' : String(Number((millimetres / factor).toFixed(6)));
  const [draft, setDraft] = useState(display);
  useEffect(() => setDraft(display), [display, unit]);
  return <input type="number" aria-label={`${label} (${unit})`} title="User supplied; blank means not supplied" placeholder="—" min="0" step="any"
    className="w-full min-w-12 rounded border border-white/20 bg-[#1b1b1d] px-1 py-1.5 text-center text-[11px] text-white tabular-nums focus:border-[#FF3B30] focus:outline-none"
    value={draft} onFocus={() => onHighlight(true)}
    onChange={event => { setDraft(event.target.value); event.target.setCustomValidity(''); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={event => {
      onHighlight(false);
      const numeric = Number(draft), converted = numeric * factor;
      if (event.currentTarget.validity.badInput || draft !== '' && (!Number.isFinite(converted) || converted <= 0)) {
        event.currentTarget.setCustomValidity('Enter a positive measurement, or leave blank.');
        event.currentTarget.reportValidity();
        return;
      }
      if (draft !== display) onChange(draft === '' ? undefined : converted);
    }}/>
}

export function ImportedSizeTable({ value, view, guides, unit, onChange, highlightedId, onHighlight }: {
  value: ImportedGarment; view: ImportedGarmentView; guides: ImportedMeasurementGuide[]; unit: 'cm' | 'mm';
  onChange: (value: ImportedGarment) => void; highlightedId?: string | null; onHighlight?: (id: string | null) => void;
}) {
  const descriptionId = useId();
  if (!guides.length) return null;
  return <section aria-label="Size specifications" className="space-y-2">
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{view} size measurements ({unit})</h4>
    <p id={descriptionId} className="text-[10px] text-white/50">Rows follow the detected garment and current view. XS–XXL values are user supplied and blank until entered; no size grading is inferred from the photo. Stored in millimetres; changing units converts the display.</p>
    <div className="overflow-x-auto rounded-md border border-white/10 bg-[#151517]">
      <table className="w-full min-w-[420px] table-fixed text-[11px]" aria-label={`${view} size measurement table`} aria-describedby={descriptionId}>
        <thead><tr className="border-b border-white/10 text-white/55"><th scope="col" className="w-24 px-2 py-2 text-left font-semibold">Measurement</th>
          {importedGarmentSizes.map(size => <th scope="col" key={size} className="px-1 py-2 font-semibold">{size}</th>)}
        </tr></thead>
        <tbody>{guides.map((guide, index) => <tr key={`${view}:${guide.id}`} data-size-measurement-row={guide.id}
          className={`border-b border-white/10 last:border-0 ${highlightedId === guide.id ? 'bg-[#cc2d24]/15' : ''}`}
          onMouseEnter={() => onHighlight?.(guide.id)} onMouseLeave={() => onHighlight?.(null)}>
          <th scope="row" className="break-words px-2 py-2 text-left font-medium">{String.fromCharCode(65 + index)}. {guide.name}</th>
          {importedGarmentSizes.map(size => <td key={size} className="px-1 py-1"><SizeCell label={`${view} ${guide.name} ${size}`} unit={unit}
            millimetres={value.sizeMeasurements?.[view]?.[guide.id]?.[size]} onHighlight={active => onHighlight?.(active ? guide.id : null)}
            onChange={millimetres => {
              const row = { ...value.sizeMeasurements?.[view]?.[guide.id] };
              if (millimetres === undefined) delete row[size]; else row[size] = millimetres;
              onChange({ ...value, sizeMeasurements: { ...value.sizeMeasurements,
                [view]: { ...value.sizeMeasurements?.[view], [guide.id]: row } } });
            }}/></td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
