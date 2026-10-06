import type { DesignElement } from '../PrintsDesignStep';
import { newPatternSeed, patternMetrics } from '../../../lib/patternGeometry';
import { StudioColorField } from '../StudioColorField';
import { STUDIO_TEXT_MAIN_COLORS, STUDIO_TEXT_POPULAR_COLORS } from '../../../data/studioColorPresets';
import { Switch } from '../../ui/switch';
import { FlipControls } from './FlipControls';
import { PATTERN_CATALOG, patternDefaultColors, patternDefinition } from '../../../lib/patternCatalog';
import { changePatternType } from '../../../lib/patternEditing';

function PatternSlider({ label, ariaLabel = label, value, min, max, step = 1, suffix = '', onChange }: {
  label: string; ariaLabel?: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void;
}) {
  return <label className="block space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</span>
      <span className="text-[10px] font-semibold tabular-nums text-white/70">{Math.round(value * 10) / 10}{suffix}</span>
    </div>
    <input type="range" aria-label={ariaLabel} min={min} max={max} step={step} value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-[#FF3B30]" />
  </label>;
}

export function PatternControls({ element, onChange }: {
  element: DesignElement;
  onChange: (patch: Partial<DesignElement>) => void;
}) {
  const metrics = patternMetrics(element);
  const definition = patternDefinition(metrics.kind);
  const legacy = ['stripes', 'stripes-h', 'checks', 'diagonal', 'dots'].includes(metrics.kind);
  const custom = metrics.kind === 'custom';
  const defaults = patternDefaultColors(metrics.kind);
  const thickness = element.patternThickness ?? (legacy ? metrics.defaultThickness : metrics.kind === 'pinstripes' ? .7 : 2);
  return <fieldset disabled={element.locked} className="min-w-0 space-y-3 disabled:opacity-50" data-pattern-controls>
    <label className="block space-y-1 text-[10px] text-white/65">Pattern type
      <select aria-label="Pattern type" value={metrics.kind} onChange={event => onChange(changePatternType(element, event.target.value))}
        className="h-9 w-full rounded-lg border border-white/15 bg-[#171719] px-2 text-xs text-white">
        {Array.from(new Set(PATTERN_CATALOG.map(item => item.category))).map(category => <optgroup key={category} label={category}>
          {PATTERN_CATALOG.filter(item => item.category === category).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-2"><FlipControls element={element} onChange={onChange} /></div>
    {custom && <label className="block space-y-1 text-[10px] text-white/65">Repeat type
      <select aria-label="Pattern repeat type" value={element.patternRepeat ?? 'grid'} onChange={event => onChange({ patternRepeat: event.target.value as DesignElement['patternRepeat'] })}
        className="h-9 w-full rounded-lg border border-white/15 bg-[#171719] px-2 text-xs text-white">
        <option value="grid">Grid</option><option value="brick">Brick</option><option value="half-drop">Half-Drop</option><option value="mirror">Mirror</option><option value="random">Random</option>
      </select>
    </label>}
    <PatternSlider label={metrics.kind === 'dots' ? 'Dot density' : 'Pattern amount'} ariaLabel="Pattern amount" value={metrics.count} min={1} max={32}
      onChange={(patternCount) => onChange({ patternCount })} />
    <PatternSlider label="Pattern scale" value={metrics.scale * 100} min={10} max={400} suffix="%"
      onChange={(patternScale) => onChange({ patternScale })} />
    {legacy ? <PatternSlider label="Pattern spacing" value={metrics.spacing} min={0} max={200} suffix=" px"
      onChange={(patternSpacing) => onChange({ patternSpacing })} /> : <>
      <PatternSlider label="Horizontal spacing" value={element.patternSpacingX ?? element.patternSpacing ?? 0} min={0} max={200} suffix=" px" onChange={patternSpacingX => onChange({ patternSpacingX })} />
      <PatternSlider label="Vertical spacing" value={element.patternSpacingY ?? element.patternSpacing ?? 0} min={0} max={200} suffix=" px" onChange={patternSpacingY => onChange({ patternSpacingY })} />
    </>}
    {definition?.roughness && <PatternSlider label="Roughness" value={element.patternRoughness ?? 50} min={0} max={100} suffix="%" onChange={patternRoughness => onChange({ patternRoughness })} />}
    {definition?.variation && <PatternSlider label="Variation" value={element.patternVariation ?? 50} min={0} max={100} suffix="%" onChange={patternVariation => onChange({ patternVariation })} />}
    <PatternSlider label="Pattern rotation" value={element.patternRotation ?? 0} min={-180} max={180} suffix="°"
      onChange={(patternRotation) => onChange({ patternRotation })} />
    {(legacy ? metrics.kind !== 'checks' : definition?.thickness) ? <PatternSlider label={metrics.kind === 'dots' || metrics.kind === 'halftone' ? 'Dot size' : 'Line thickness'}
      value={thickness} min={.1} max={Math.max(100, thickness)} step={.1} suffix=" px"
      onChange={(patternThickness) => onChange({ patternThickness })} /> : null}
    {metrics.kind === 'dots' ? <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
      <label className="flex items-center justify-between gap-3 text-[11px] font-medium text-white">
        Randomise
        <Switch aria-label="Randomise dots" checked={element.patternRandomise ?? false}
          onCheckedChange={(patternRandomise) => onChange({ patternRandomise,
            ...(patternRandomise && !Number.isFinite(element.patternSeed) ? { patternSeed: newPatternSeed() } : {}) })}
          className="data-[state=checked]:bg-[#FF3B30]" />
      </label>
      {element.patternRandomise ? <button type="button" onClick={() => onChange({ patternSeed: newPatternSeed() })}
        className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/70 hover:text-white">Reshuffle dots</button> : null}
    </div> : null}
    {custom && element.patternRepeat === 'random' && <>
      <PatternSlider label="Random position" value={element.patternRandomPosition ?? 70} min={0} max={100} suffix="%" onChange={patternRandomPosition => onChange({ patternRandomPosition })} />
      <PatternSlider label="Random rotation" value={element.patternRandomRotation ?? 0} min={0} max={180} suffix="°" onChange={patternRandomRotation => onChange({ patternRandomRotation })} />
      <PatternSlider label="Minimum scale" value={element.patternMinScale ?? 70} min={10} max={300} suffix="%" onChange={patternMinScale => onChange({ patternMinScale, patternMaxScale: Math.max(patternMinScale, element.patternMaxScale ?? 130) })} />
      <PatternSlider label="Maximum scale" value={element.patternMaxScale ?? 130} min={10} max={300} suffix="%" onChange={patternMaxScale => onChange({ patternMaxScale, patternMinScale: Math.min(patternMaxScale, element.patternMinScale ?? 70) })} />
      <p className="text-[10px] text-white/45">Random repeat varies each element within the scale range. Set both to 100% for uniform sizing.</p>
    </>}
    {((custom && element.patternRepeat === 'random') || (!custom && definition?.randomise && metrics.kind !== 'dots')) && <button type="button" onClick={() => onChange({ patternSeed: newPatternSeed() })}
      className="w-full rounded-lg border border-white/15 py-2 text-xs text-white/80 hover:bg-white/10">Randomise pattern</button>}
    {!custom && <StudioColorField allowGradients={legacy} value={element.color ?? defaults[0] ?? '#FFFFFF'}
      onChange={(color) => onChange({ color })} mainColors={STUDIO_TEXT_MAIN_COLORS} popularColors={STUDIO_TEXT_POPULAR_COLORS}
      mainLabel={definition?.colors?.[0] ?? 'Pattern colour'} popularLabel="Quick colours" clearVisible={false} />}
    {definition?.colors?.slice(1).map((label, index) => <label key={label} className="flex items-center justify-between text-[11px] text-white/70">
      {label}<input type="color" aria-label={label} value={element.patternColors?.[index + 1] ?? defaults[index + 1] ?? '#FFFFFF'}
        onChange={event => { const patternColors = [...(element.patternColors ?? defaults)]; patternColors[index + 1] = event.target.value; onChange({ patternColors }); }}
        className="h-7 w-10 cursor-pointer rounded border border-white/15 bg-transparent" />
    </label>)}
    <PatternSlider label="Pattern opacity" value={element.opacity ?? 100} min={0} max={100} suffix="%"
      onChange={(opacity) => onChange({ opacity })} />
  </fieldset>;
}
