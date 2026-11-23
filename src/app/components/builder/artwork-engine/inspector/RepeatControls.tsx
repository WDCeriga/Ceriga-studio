import { useState } from 'react';
import { ShapeObjectEditor } from '../../shell/ShapesStudio';
import { ClothingFontPicker } from '../../shell/ClothingFontPicker';
import { TextAppearanceControls } from '../../shell/TextAppearanceControls';
import { fontIdentity } from '../../../../lib/workspaceFonts';
import { StrokeStyleControls } from './StrokeStyleControls';
import { WidthProfileControls } from './WidthProfileControls';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioNumber, StudioRange } from '../../shell/StudioControls';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { REPEAT_MODES, defaultRepeatCentre, releaseRepeat, updateRepeat, type RepeatMode } from '../geometry/repeat';
import { inkOf, inkPatch, isInkable } from '../state/sharedProperties';
import './repeat-controls.css';

/** Small line glyphs for each repeat mode (16px, currentColor). */
export function RepeatGlyph({ mode, size = 16 }: { mode: RepeatMode; size?: number }) {
  const d = {
    radial: 'M12 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM12 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM4.5 12a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0ZM14.5 12a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z',
    'mirror-x': 'M12 3v18M9.5 7 5 12l4.5 5ZM14.5 7l4.5 5-4.5 5Z',
    'mirror-y': 'M3 12h18M7 9.5 12 5l5 4.5ZM7 14.5l5 4.5 5-4.5Z',
    'mirror-4': 'M12 3v18M3 12h18M6 6h3v3H6ZM15 6h3v3h-3ZM6 15h3v3H6ZM15 15h3v3h-3Z',
    turn: 'M6 9.5a6.5 6.5 0 0 1 11.5-2.5M18 14.5a6.5 6.5 0 0 1-11.5 2.5M17.5 3.5V7H14M6.5 20.5V17H10',
  }[mode];
  return <svg className="cx-repeat-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

/** Repeat group panel: mode, copies, span, turn, interlock gap, source colour, release. */
export function RepeatControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio();
  const [editing, setEditing] = useState(false);
  const s = element.artworkRepeat, master = element.children?.[0];
  if (!s || !master) return null;
  const apply = (patch: Parameters<typeof updateRepeat>[1]) => update(updateRepeat(element, patch));
  const mm = (px: number) => px * 10 / Math.max(.0001, studio.unitsPerCm), px = (value: number) => value * Math.max(.0001, studio.unitsPerCm) / 10;
  return <StudioFold title="Repeat" hint="Copies follow the source" open>
    <div className="cx-repeat-modes" role="group" aria-label="Repeat style">
      {REPEAT_MODES.map(({ mode, label }) => <button key={mode} type="button" aria-pressed={s.mode === mode} onClick={() => apply({ settings: { mode, centre: defaultRepeatCentre(master, mode), count: mode === 'radial' ? Math.max(s.count, 3) : s.count } })}>
        <RepeatGlyph mode={mode} size={20} /><span>{label}</span>
      </button>)}
    </div>
    {s.mode === 'radial' && <>
      <StudioRange label="Copies" unit="" min={2} max={24} value={s.count} onChange={count => apply({ settings: { count } })} />
      <StudioRange label="Spread" unit="°" min={30} max={360} step={5} value={s.span} onChange={span => apply({ settings: { span } })} />
      <div className="cx-repeat-toggles">
        <button type="button" aria-pressed={s.rotateCopies} onClick={() => apply({ settings: { rotateCopies: !s.rotateCopies } })}>Turn copies</button>
      </div>
    </>}
    {master.type === 'shape' && <StudioNumber label="Interlock gap" unit="mm" min={0} max={20} step={.1} value={mm(s.gap)} onChange={value => apply({ settings: { gap: px(value) } })} />}
    {isInkable(master) && <label className="cx-repeat-colour"><span>Colour</span>
      <input type="color" aria-label="Repeat colour" value={/^#[0-9a-f]{6}$/i.test(inkOf(master)) ? inkOf(master) : '#171717'} onChange={event => apply({ master: inkPatch(master, event.target.value) })} />
    </label>}
    <div className="cx-repeat-source">
      <button type="button" className="cx-repeat-source__toggle" aria-expanded={editing} onClick={() => setEditing(!editing)}>
        <span>Edit source</span><small>Every copy follows</small>
      </button>
      {editing && <div className="cx-repeat-source__body">
        {master.type === 'text' && <label className="studio-field">Text<textarea rows={2} value={master.content} onChange={event => apply({ master: { content: event.target.value } })} /></label>}
        <StudioNumber label="Source width" unit="mm" min={1} max={400} step={.5} value={mm(master.width)} onChange={value => { const k = px(value) / Math.max(.0001, master.width); apply({ master: { width: master.width * k, height: master.height * k, ...(master.type === 'text' && master.fontSize ? { fontSize: master.fontSize * k } : {}) } }); }} />
        <StudioRange label="Source turn" unit="°" min={-180} max={180} value={Math.round(master.rotation)} onChange={rotation => apply({ master: { rotation } })} />
        {master.type === 'text' && <><label className="studio-field">Font<ClothingFontPicker value={master.fontFamily ?? 'Inter'} sample={master.content} onChange={fontFamily => apply({ master: { fontFamily, ...fontIdentity(fontFamily) } })} /></label><TextAppearanceControls element={{ ...master, textUnitsPerCm: studio.unitsPerCm }} update={patch => apply({ master: patch })} /></>}
        {master.type === 'shape' && <>
          <div className="typography-segments" role="group" aria-label="Source style"><button type="button" aria-pressed={!master.shapeFilled} onClick={() => apply({ master: { shapeFilled: false, shapeStrokeColor: inkOf(master), borderWidth: master.borderWidth || 2 } })}>Outline</button><button type="button" aria-pressed={Boolean(master.shapeFilled)} onClick={() => apply({ master: { shapeFilled: true, shapeFillColor: inkOf(master) } })}>Filled</button></div>
          <StudioNumber label="Outline" unit="mm" min={0} max={40} step={.1} value={mm(master.borderWidth ?? 0)} onChange={value => apply({ master: { borderWidth: px(value), ...(value > 0 && !master.shapeStrokeColor ? { shapeStrokeColor: inkOf(master) } : {}) } })} />
          {(master.borderWidth ?? 0) > 0 && <><StrokeStyleControls element={master} unitsPerCm={studio.unitsPerCm} update={patch => apply({ master: patch })} /><WidthProfileControls element={master} update={patch => apply({ master: patch })} /></>}
          <ShapeObjectEditor element={master} update={patch => apply({ master: patch })} toolsOnly />
        </>}
      </div>}
    </div>
    <button type="button" className="studio-outline-action" onClick={() => update(releaseRepeat(element))}>Release copies</button>
  </StudioFold>;
}
