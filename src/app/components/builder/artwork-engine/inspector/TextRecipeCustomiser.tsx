import type { DesignElement } from '../../PrintStudioEditor';
import { StudioPaint, StudioRange } from '../../shell/StudioControls';
import { MaterialSelect } from '../../shell/MaterialSelect';
import { textAppearance, textGradientAllowed, type TextAppearanceItem } from '../../../../lib/textAppearance';
import { TEXT_RECIPES, applyTextRecipe } from '../typography/recipes';

const layerName = (item: TextAppearanceItem, index: number, stack: TextAppearanceItem[]) => {
  if (item.type === 'fill') return 'Fill';
  if (item.type === 'extrude') return 'Depth';
  const same = stack.filter(row => row.type === item.type);
  const name = item.type === 'shadow' ? 'Shadow' : 'Outline';
  return same.length > 1 ? `${name} ${stack.slice(0, index + 1).filter(row => row.type === item.type).length}` : name;
};

/** Every value a text style set, in one short list. A style is only ever a starting point. */
export function TextRecipeCustomiser({ element, update, surface, unitsPerCm }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void; surface?: string; unitsPerCm: number }) {
  const recipe = TEXT_RECIPES.find(item => item.id === element.textRecipe?.id);
  if (!recipe) return null;
  const stack = textAppearance(element), size = Math.max(1, element.fontSize ?? 30);
  const patch = (id: string, changes: Partial<TextAppearanceItem>) => update({ textAppearance: stack.map(item => item.id === id ? { ...item, ...changes } : item) });
  const warp = element.vectorTextEffects?.find(effect => effect.enabled && effect.type !== 'envelope');
  const finish = element.textEffects?.find(effect => effect.enabled);
  const shadowDistance = (item: TextAppearanceItem) => Math.hypot(item.xMm ?? 0, item.yMm ?? 0);
  return <div className="cx-recipe-custom" aria-label={`Customise ${recipe.label}`}>
    {stack.map((item, index) => <div className="cx-recipe-custom__layer" key={item.id}>
      <div className="cx-recipe-custom__head">
        <strong>{layerName(item, index, stack)}</strong>
        <label><span className="sr-only">Show {layerName(item, index, stack)}</span><input type="checkbox" checked={item.enabled} onChange={event => patch(item.id, { enabled: event.target.checked })} /></label>
      </div>
      {item.enabled && <>
        <StudioPaint label="Colour" value={item.colour} allowGradients={item.type === 'fill' && textGradientAllowed(element.printMethod)} onChange={colour => patch(item.id, { colour, preserveCharacterColours: false })} />
        {(item.type === 'stroke' || item.type === 'offset') && <StudioRange label="Thickness" unit="mm" min={0} max={30} step={.1} value={Number((item.widthMm ?? 0).toFixed(1))} onChange={widthMm => patch(item.id, { widthMm })} />}
        {(item.type === 'stroke' || item.type === 'offset') && <label className="studio-field">Corners<MaterialSelect aria-label="Outline corners" value={item.join ?? 'round'} onChange={event => patch(item.id, { join: event.target.value as TextAppearanceItem['join'] })}><option value="round">Round</option><option value="miter">Sharp</option><option value="bevel">Bevel</option></MaterialSelect></label>}
        {item.type === 'shadow' && <>
          <StudioRange label="Distance" unit="mm" min={0} max={40} step={.1} value={Number(shadowDistance(item).toFixed(1))} onChange={distance => { const current = shadowDistance(item) || 1, ratio = distance / current; patch(item.id, shadowDistance(item) ? { xMm: (item.xMm ?? 0) * ratio, yMm: (item.yMm ?? 0) * ratio } : { xMm: distance * .707, yMm: distance * .707 }); }} />
          <StudioRange label="Angle" unit="°" min={-180} max={180} value={Math.round(Math.atan2(item.yMm ?? 1, item.xMm ?? 1) * 180 / Math.PI)} onChange={angle => { const distance = shadowDistance(item), a = angle * Math.PI / 180; patch(item.id, { xMm: Math.cos(a) * distance, yMm: Math.sin(a) * distance }); }} />
        </>}
        {item.type === 'extrude' && <>
          <StudioRange label="Depth" unit="mm" min={0} max={40} step={.1} value={Number((item.depthMm ?? 0).toFixed(1))} onChange={depthMm => patch(item.id, { depthMm })} />
          <StudioRange label="Angle" unit="°" min={-180} max={180} value={Math.round(item.angle ?? 45)} onChange={angle => patch(item.id, { angle })} />
        </>}
      </>}
    </div>)}
    <StudioRange label="Letter spacing" unit="%" min={-10} max={60} value={Math.round((element.letterSpacing ?? 0) / size * 100)} onChange={value => update({ letterSpacing: value / 100 * size })} />
    {warp && <StudioRange label="Warp" unit="%" min={-100} max={100} value={warp.bend} onChange={bend => update({ vectorTextEffects: element.vectorTextEffects!.map(effect => effect.id === warp.id ? { ...effect, bend } : effect) })} />}
    {finish && <StudioRange label="Finish strength" unit="%" min={0} max={100} value={finish.intensity} onChange={intensity => update({ textEffects: element.textEffects!.map(effect => effect.id === finish.id ? { ...effect, intensity } : effect) })} />}
    <button type="button" className="cx-recipes__reset" onClick={() => update(applyTextRecipe(element, recipe.id, surface, unitsPerCm))}>Reset {recipe.label}</button>
  </div>;
}
