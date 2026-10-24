import {PaintInput} from '../PrintStudioColorPopover';
import { SliderValueInput } from '../SliderValueInput';
import type { DesignElement } from '../PrintStudioEditor';
import { shapeControls, shapeParameterValue } from '../../../lib/shapeGeometry';
import { solidPaint } from '../../../lib/studioPaint';
import { canFillShape } from './studioAssets';

export function ShapePropertiesPanel({ element, onChange }: { element: DesignElement; onChange: (patch: Partial<DesignElement>) => void }) {
  if (element.type !== 'shape') return null;
  const controls = element.shapePath ? [] : shapeControls(element.content).map(item => element.shapeGeometry === 'bounds' && element.content === 'rect' ? { ...item, default: 0 } : item);
  const corners = controls.filter(item => item.key.startsWith('corner'));
  const update = (key: string, value: number | string) => onChange({ shapeParameters: { ...element.shapeParameters, [key]: value } });
  const colors = [
    { key: 'shapeStrokeColor' as const, label: 'Outline colour', value: element.shapeStrokeColor ?? element.color ?? '#FFFFFF' },
    ...(canFillShape(element) ? [{ key: 'shapeFillColor' as const, label: 'Fill colour', value: element.shapeFillColor ?? element.color ?? '#FFFFFF' }] : []),
  ];
  return <section aria-label="Shape properties" className="space-y-3 border-t border-[#e2e2e2] pt-3">
    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#737373]">Shape properties</div>
    <fieldset disabled={!!element.locked} className="space-y-3 disabled:opacity-50">
      {corners.length > 0 && <label className="block text-[10px] text-[#737373]">Corner radius (all)
        <input type="range" aria-label="Shape Corner radius" min={corners[0].min} max={corners[0].max} step={corners[0].step} value={Number(shapeParameterValue(element, corners[0]))}
          onChange={event => onChange({ shapeParameters: { ...element.shapeParameters, ...Object.fromEntries(corners.map(item => [item.key, Number(event.target.value)])) } })} className="mt-1 block w-full accent-[#262626]" />
      </label>}
      {controls.map(item => {
        const value = shapeParameterValue(element, item);
        return <label key={item.key} className="block text-[10px] text-[#737373]">{item.label}
          {item.options ? <select aria-label={`Shape ${item.label}`} value={String(value)} onChange={event => update(item.key, event.target.value)} className="mt-1 block w-full rounded border border-[#e2e2e2] bg-white p-1 text-xs text-[#262626]">
            {item.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <>
            <span className="float-right"><SliderValueInput label={`Shape ${item.label}`} value={Number(value)} min={item.min} max={item.max} step={item.step} onChange={value=>update(item.key,value)}/></span>
            <input type="range" aria-label={`Shape ${item.label}`} min={item.min} max={item.max} step={item.step} value={Number(value)} onChange={event => update(item.key, Number(event.target.value))} className="mt-1 block w-full accent-[#262626]" />
          </>}
        </label>;
      })}
      {element.shapePath && <p className="text-[10px] text-[#737373]">Custom path. Use Edit Path to change its geometry.</p>}
      <label className="block text-[10px] text-[#737373]">{['wave', 'zigzag', 'squiggly', 'spiral', 'line', 'arc'].includes(element.content) ? 'Thickness' : 'Outline width'}
        <span className="float-right"><SliderValueInput label="Shape thickness" value={element.borderWidth??4} min={0} max={30} step={.5} onChange={borderWidth=>onChange({borderWidth})}/></span>
        <input type="range" aria-label="Shape thickness" min={0} max={30} step={0.5} value={Math.max(0, element.borderWidth ?? 4)} onChange={event => onChange({ borderWidth: Number(event.target.value) })} className="mt-1 block w-full accent-[#262626]" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {colors.map(item => <label key={item.key} className="block text-[10px] text-[#737373]">{item.label}
          <PaintInput ariaLabel={`Shape ${item.label}`}  value={solidPaint(item.value)} onChange={event => onChange({ [item.key]: event.target.value })} className="mt-1 block h-8 w-full rounded border border-[#e2e2e2] bg-transparent" />
        </label>)}
      </div>
      {!!controls.length && <button type="button" onClick={() => onChange({ shapeParameters: undefined })} className="text-[10px] text-[#737373] underline hover:text-[#262626]">Reset geometry</button>}
    </fieldset>
  </section>;
}
