import type { DesignElement } from '../PrintsDesignStep';
import { IMAGE_FILTERS, imageFilterControls, type ImageFilterSettings } from '../../../lib/imageFilters';
import { FilteredImage } from './FilteredImage';

export function ImageFiltersPanel({ element, onChange }: { element: DesignElement | null | undefined; onChange: (patch: Partial<DesignElement>) => void }) {
  const image = element?.type === 'image' ? element : null;
  const settings = image?.imageFilter;
  const selected = settings?.id ?? 'none';
  const update = (key: string, value: number | string) => onChange({ imageFilter: { ...settings, id: selected, intensity: settings?.intensity ?? 100, [key]: value } });
  return <section aria-label="Image filters" className="space-y-2 border-t border-white/10 pt-3">
    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">Image</div>
    <details open>
      <summary className="cursor-pointer text-[11px] font-semibold text-white/90">Filters</summary>
      {!image ? <p className="mt-2 text-[10px] text-white/45">Upload or select an image to preview filters.</p> : <fieldset disabled={!!image.locked} className="mt-2 space-y-3 disabled:opacity-50">
        <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
          {IMAGE_FILTERS.map(filter => <button key={filter.id} type="button" aria-label={filter.id === 'none' ? 'Original / None' : filter.label} aria-pressed={selected === filter.id}
            onClick={() => onChange({ imageFilter: filter.id === 'none' ? undefined : { id: filter.id as ImageFilterSettings['id'], intensity: settings?.intensity ?? 100 } })}
            className={`min-w-0 overflow-hidden rounded-md border text-left ${selected === filter.id ? 'border-[#FF3B30] bg-[#FF3B30]/15' : 'border-white/10 bg-white/[0.04] hover:border-white/40'}`}>
            <FilteredImage source={image.content} settings={{ id: filter.id as ImageFilterSettings['id'], intensity: 100 }} alt={`${filter.label} preview`} thumbnail className="h-14 w-full object-contain" />
            <span className="block min-h-7 px-1 py-1 text-[9px] leading-tight text-white/85">{filter.id === 'none' ? 'Original / None' : filter.label}</span>
          </button>)}
        </div>
        {selected !== 'none' && <>
          <label className="block text-[10px] text-white/70">Intensity <span className="float-right tabular-nums">{settings?.intensity ?? 100}%</span>
            <input aria-label="Filter intensity" type="range" min={0} max={100} step={1} value={settings?.intensity ?? 100} onChange={event => update('intensity', Number(event.target.value))} className="mt-1 block w-full accent-[#FF3B30]" />
          </label>
          {imageFilterControls(selected).map(control => {
            const value = settings?.[control.key as keyof ImageFilterSettings] ?? control.default;
            return <label key={control.key} className="block text-[10px] text-white/70">{control.label}
              {control.type === 'color' ? <input aria-label={`Filter ${control.label}`} type="color" value={String(value)} onChange={event => update(control.key, event.target.value)} className="mt-1 block h-7 w-full rounded border border-white/15 bg-transparent" /> : <>
                <span className="float-right tabular-nums">{value}{control.suffix ?? ''}</span>
                <input aria-label={`Filter ${control.label}`} type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={event => update(control.key, Number(event.target.value))} className="mt-1 block w-full accent-[#FF3B30]" />
              </>}
            </label>;
          })}
        </>}
        <p className="text-[9px] leading-snug text-white/40">Filters keep your original image and work with Image Adjustments.</p>
      </fieldset>}
    </details>
  </section>;
}
