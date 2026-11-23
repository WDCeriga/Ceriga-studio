import { useState } from 'react';
import { Check } from 'lucide-react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioRange } from '../../shell/StudioControls';
import { BRUSH_MEDIA, StrokeSample } from '../../shell/DrawPaintStudio';
import { MaterialSelect } from '../../shell/MaterialSelect';
import { BRUSH_PRESETS, type BrushPreset } from '../../../../lib/drawingBrush';
import { isVolumeBrush, type VolumeSettings } from '../../../../lib/brushVolume';
import { clearRestyle, patchDrawingStrokes, restyleDrawing } from '../../../../lib/drawingRestyle';
import { VolumeBrushControls } from './VolumeBrushControls';
import './volume-brush.css';

/** Tap a brush and every stroke in the drawing takes it on. Nothing is redrawn or lost. */
export function DrawingRestyleControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const [medium, setMedium] = useState('3D & puff');
  if (element.type !== 'drawing' || !element.drawing?.strokes.length) return null;
  const restyle = element.drawingRestyle, first = element.drawing.strokes[0].settings, current = restyle?.preset ?? first.brushPreset, label = BRUSH_PRESETS.find(item => item.id === current)?.label, brushes = BRUSH_PRESETS.filter(item => BRUSH_MEDIA[medium]?.includes(item.id));
  return <StudioFold title="Restyle" rowHeight={40} open value={restyle ? label : 'Original'}><fieldset disabled={element.locked} className="cx-restyle">
    <div className="draw-library-controls"><MaterialSelect aria-label="Restyle brush family" value={medium} onChange={event => setMedium(event.target.value)}>{Object.keys(BRUSH_MEDIA).map(name => <option key={name}>{name}</option>)}</MaterialSelect></div>
    <div className="draw-brushes"><div className="draw-brush-grid" role="region" aria-label="Restyle brushes" tabIndex={0}>{brushes.map(brush => <button key={brush.id} type="button" aria-label={`Restyle as ${brush.label}`} aria-pressed={current === brush.id} onClick={() => update(restyleDrawing(element, brush.id as BrushPreset))}><StrokeSample preset={brush} /><span>{brush.label}</span>{current === brush.id && <Check size={12} />}</button>)}</div></div>
    {restyle && <StudioRange label="Stroke size" min={20} max={300} value={Math.round(restyle.weight * 100)} onChange={value => update(restyleDrawing(element, restyle.preset, value / 100))} />}
    {isVolumeBrush(String(current)) && <VolumeBrushControls preset={String(current)} values={first as unknown as Partial<VolumeSettings>} onChange={patch => update(patchDrawingStrokes(element, patch))} />}
    {restyle && <button type="button" className="artwork-reset" onClick={() => update(clearRestyle(element))}>Back to original</button>}
  </fieldset></StudioFold>;
}
