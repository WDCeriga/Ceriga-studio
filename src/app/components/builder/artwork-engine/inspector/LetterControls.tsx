import type { DesignElement } from '../../PrintStudioEditor';
import { StudioNumber, StudioRange } from '../../shell/StudioControls';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { IDENTITY_LETTER, type LetterTransform } from '../geometry/letterStretch';
import { setLetterSelection, useLetterSelection } from '../state/letterSelection';

/** Text words → letter keys are assigned in reading order, skipping spaces. */
export function letterChoices(content: string) {
  let index = 0;
  return [...content].flatMap(label => /\s/.test(label) ? [] : [{ key: 'letter-' + index++, label }]);
}

/** Stretch letters: on-canvas mode plus exact values for the selected letter. */
export function LetterControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio(), selection = useLetterSelection(), on = studio.adjustLettersId === element.id;
  const display = element.textTransform === 'uppercase' ? element.content.toUpperCase() : element.textTransform === 'lowercase' ? element.content.toLowerCase() : element.content;
  const letters = letterChoices(display), key = selection?.elementId === element.id ? selection.key : null, active = letters.find(item => item.key === key);
  const current = (active && element.textGlyphTransforms?.[active.key]) || IDENTITY_LETTER;
  const units = Math.max(.0001, studio.unitsPerCm), mm = (value: number) => Number((value * 10 / units).toFixed(1)), px = (value: number) => value * units / 10;
  const set = (patch: Partial<LetterTransform>) => { if (active) update({ textGlyphTransforms: { ...element.textGlyphTransforms, [active.key]: { ...current, ...patch } } }); };
  const changed = Object.keys(element.textGlyphTransforms ?? {}).length > 0;
  const fill = () => {
    const area = studio.printArea; if (!area?.width) return;
    const width = area.width * .92, ratio = width / Math.max(1, element.width);
    update({ x: area.x + area.width / 2, y: area.y + area.height / 2, width, height: element.height * ratio, fontSize: (element.fontSize ?? 30) * ratio, autoWidth: false, textShapeMode: 'stack', textStackFit: true, textPath: undefined, textEdge: undefined, vectorTextEffects: undefined, textCurveAmount: 0 });
  };
  return <div className="cx-letters">
    <button type="button" className="studio-outline-action" aria-pressed={on} onClick={() => { studio.setAdjustLettersId(on ? null : element.id); if (on) setLetterSelection(null); }}>{on ? 'Done stretching' : 'Stretch letters'}</button>
    {on && <>
      <div className="cx-letters__row" role="group" aria-label="Choose a letter">
        {letters.map(item => <button key={item.key} type="button" aria-pressed={item.key === key} data-changed={Boolean(element.textGlyphTransforms?.[item.key]) || undefined} onClick={() => setLetterSelection({ elementId: element.id, key: item.key })}>{item.label}</button>)}
      </div>
      {active && <>
        <div className="studio-two-columns">
          <StudioNumber label="Width" unit="%" min={5} max={2000} step={1} value={Math.round(current.scaleX * 100)} onChange={value => set({ scaleX: value / 100 })} />
          <StudioNumber label="Height" unit="%" min={5} max={2000} step={1} value={Math.round(current.scaleY * 100)} onChange={value => set({ scaleY: value / 100 })} />
          <StudioNumber label="Move X" unit="mm" min={-2000} max={2000} step={.5} value={mm(current.x)} onChange={value => set({ x: px(value) })} />
          <StudioNumber label="Move Y" unit="mm" min={-2000} max={2000} step={.5} value={mm(current.y)} onChange={value => set({ y: px(value) })} />
        </div>
        <StudioRange label="Rotate" unit="°" min={-180} max={180} value={Math.round(current.rotation)} onChange={rotation => set({ rotation })} />
        <button type="button" className="cx-recipes__reset" onClick={() => { const { [active.key]: _removed, ...rest } = element.textGlyphTransforms ?? {}; update({ textGlyphTransforms: Object.keys(rest).length ? rest : undefined }); }}>Reset {active.label}</button>
      </>}
      {changed && <button type="button" className="cx-recipes__reset" onClick={() => update({ textGlyphTransforms: undefined })}>Reset all letters</button>}
    </>}
    <button type="button" className="studio-outline-action" onClick={fill}>Fill print width</button>
  </div>;
}
