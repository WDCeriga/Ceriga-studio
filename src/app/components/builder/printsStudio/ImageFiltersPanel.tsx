import {PaintInput} from '../PrintStudioColorPopover';
import { SliderValueInput } from '../SliderValueInput';
import type { DesignElement } from '../PrintStudioEditor';
import { IMAGE_FILTERS, imageFilterControls, type ImageFilterSettings } from '../../../lib/imageFilters';
import { FilteredImage } from './FilteredImage';

export function ImageFiltersPanel({ element, onChange }: { element: DesignElement | null | undefined; onChange: (patch: Partial<DesignElement>) => void }) {
  const image = element?.type === 'image' ? element : null;
  const settings = image?.imageFilter;
  const selected = settings?.id ?? 'none';
  const update = (key: string, value: number | string) => onChange({ imageFilter: { ...settings, id: selected, intensity: settings?.intensity ?? 100, [key]: value } });
  return <section aria-label="Image filters" className="space-y-2 border-t border-[#e2e2e2] pt-3">
    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">Image</div>
    <details open>
      <summary className="cursor-pointer text-[11px] font-semibold text-[#737373]">Filters</summary>
      {!image ? <p className="mt-2 text-[10px] text-[#737373]">Upload or select an image to preview filters.</p> : <fieldset disabled={!!image.locked} className="mt-2 space-y-3 disabled:opacity-50">
        <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
          {IMAGE_FILTERS.map(filter => <button key={filter.id} type="button" aria-label={filter.id === 'none' ? 'Original / None' : filter.label} aria-pressed={selected === filter.id}
            onClick={() => onChange({ imageFilter: filter.id === 'none' ? undefined : { id: filter.id as ImageFilterSettings['id'], intensity: settings?.intensity ?? 100 } })}
            className={`min-w-0 overflow-hidden rounded-md border text-left ${selected === filter.id ? 'border-[#262626] bg-[#262626]/15' : 'border-[#e2e2e2] bg-[#f2f2f2] hover:border-[#e2e2e2]'}`}>
            <FilteredImage source={image.content} settings={{ id: filter.id as ImageFilterSettings['id'], intensity: 100 }} alt={`${filter.label} preview`} thumbnail className="h-14 w-full object-contain" />
            <span className="block min-h-7 px-1 py-1 text-[9px] leading-tight text-[#737373]">{filter.id === 'none' ? 'Original / None' : filter.label}</span>
          </button>)}
        </div>
        {selected !== 'none' && <>
          <label className="block text-[10px] text-[#737373]">Intensity <span className="float-right"><SliderValueInput label="Filter intensity" value={settings?.intensity??100} unit="%" onChange={value=>update('intensity',value)}/></span>
            <input aria-label="Filter intensity" type="range" min={0} max={100} step={1} value={settings?.intensity ?? 100} onChange={event => update('intensity', Number(event.target.value))} className="mt-1 block w-full accent-[#262626]" />
          </label>
          {imageFilterControls(selected).map(control => {
            const value = settings?.[control.key as keyof ImageFilterSettings] ?? control.default;
            return <label key={control.key} className="block text-[10px] text-[#737373]">{control.label}
              {control.type === 'color' ? <PaintInput ariaLabel={`Filter ${control.label}`}  value={String(value)} onChange={event => update(control.key, event.target.value)} className="mt-1 block h-7 w-full rounded border border-[#e2e2e2] bg-transparent" /> : <>
                <span className="float-right"><SliderValueInput label={`Filter ${control.label}`} value={Number(value)} min={control.min} max={control.max} step={control.step} unit={control.suffix} onChange={value=>update(control.key,value)}/></span>
                <input aria-label={`Filter ${control.label}`} type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={event => update(control.key, Number(event.target.value))} className="mt-1 block w-full accent-[#262626]" />
              </>}
            </label>;
          })}
        </>}
        <p className="text-[9px] leading-snug text-[#737373]">Filters keep your original image and work with Image Adjustments.</p>
      </fieldset>}
    </details>
  </section>;
}
