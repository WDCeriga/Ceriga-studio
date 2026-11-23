import { useState } from 'react';
import { Check } from 'lucide-react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioRange } from '../../shell/StudioControls';
import { BRUSH_MEDIA, StrokeSample } from '../../shell/DrawPaintStudio';
import { MaterialSelect } from '../../shell/MaterialSelect';
import { BRUSH_PRESETS, type BrushPreset } from '../../../../lib/drawingBrush';
import { isVolumeBrush, type VolumeSettings } from '../../../../lib/brushVolume';
import { clearPathBrush, isPathBrush, patchPathBrush, pathBrushPatch } from '../../../../lib/pathBrush';
import { VolumeBrushControls } from './VolumeBrushControls';
import './volume-brush.css';

/** Put any brush on a shape or pen path. The points stay editable and the brush follows them. */
export function PathBrushControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const [medium, setMedium] = useState('Ink & pencil');
  if (element.type !== 'shape' || (element.shapeBrush && !isPathBrush(element))) return null;
  const on = isPathBrush(element), settings = element.shapeBrush?.strokes[0]?.settings, current = settings?.brushPreset, label = BRUSH_PRESETS.find(item => item.id === current)?.label, brushes = BRUSH_PRESETS.filter(item => item.id !== 'distress-brush' && BRUSH_MEDIA[medium]?.includes(item.id)), colour = element.shapeStrokeColor ?? element.color ?? '#171717';
  return <StudioFold title="Line brush" rowHeight={40} value={on ? label : 'Off'}><fieldset disabled={element.locked} className="cx-restyle">
    <div className="draw-library-controls"><MaterialSelect aria-label="Line brush family" value={medium} onChange={event => setMedium(event.target.value)}>{Object.keys(BRUSH_MEDIA).map(name => <option key={name}>{name}</option>)}</MaterialSelect></div>
    <div className="draw-brushes"><div className="draw-brush-grid" role="region" aria-label="Line brushes" tabIndex={0}>{brushes.map(brush => <button key={brush.id} type="button" aria-label={`Line brush ${brush.label}`} aria-pressed={current === brush.id} onClick={() => update(pathBrushPatch(element, brush.id as BrushPreset))}><StrokeSample preset={brush} /><span>{brush.label}</span>{current === brush.id && <Check size={12} />}</button>)}</div></div>
    {on && <>
      <StudioRange label="Brush size" min={1} max={120} unit="" value={Math.round(element.borderWidth ?? 10)} onChange={borderWidth => update({ borderWidth })} />
      <div className="cx-volume-row"><span>Brush colour</span>{/^#[\da-f]{6}$/i.test(colour) && <input type="color" aria-label="Brush colour" value={colour} onChange={event => update({ shapeStrokeColor: event.target.value })} />}</div>
      {isVolumeBrush(String(current)) && <VolumeBrushControls preset={String(current)} values={settings as unknown as Partial<VolumeSettings>} onChange={patch => update(patchPathBrush(element, patch))} />}
      <button type="button" className="artwork-reset" onClick={() => update(clearPathBrush(element))}>Remove brush</button>
    </>}
  </fieldset></StudioFold>;
}
