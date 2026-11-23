import { BRUSH_PRESETS, type BrushPreset } from './drawingBrush';
import { VOLUME_DEFAULTS } from './brushVolume';
import type { RecordedBrushSettings, RecordedDrawing } from './drawingReplay';

/** Restyle keeps every recorded point and swaps only the brush, so any look can be undone or changed again. */
export type DrawingRestyle = { preset: BrushPreset; weight: number; original: RecordedBrushSettings[] };
type Restylable = { drawing?: RecordedDrawing; drawingOriginal?: RecordedDrawing; drawingRestyle?: DrawingRestyle };

const presetOf = (id: unknown) => BRUSH_PRESETS.find(item => item.id === id);
function restyledSettings(source: RecordedBrushSettings, id: BrushPreset, weight: number): RecordedBrushSettings {
  const next = presetOf(id)!, previous = presetOf(source.brushPreset), ratio = previous ? next.size / Math.max(1, previous.size) : 1;
  return { ...source, ...VOLUME_DEFAULTS, taperStart: 0, taperEnd: 0, brushAngle: 90, brushRotation: 0, blur: 0, brushSpacing: 12, ...next.settings, brushPreset: id, grain: next.grain, texture: 'smooth', brushSize: Math.max(1, Math.min(512, source.brushSize * ratio * weight)) } as RecordedBrushSettings;
}
const mapDrawing = <T extends RecordedDrawing | undefined>(drawing: T, change: (settings: RecordedBrushSettings, index: number) => RecordedBrushSettings): T => drawing ? { ...drawing, strokes: drawing.strokes.map((stroke, index) => ({ ...stroke, settings: change(stroke.settings, index) })) } : drawing;

export function restyleDrawing(element: Restylable, id: BrushPreset, weight = element.drawingRestyle?.weight ?? 1) {
  const originals = element.drawing!.strokes.map((stroke, index) => element.drawingRestyle?.original[index] ?? stroke.settings);
  const apply = (_: RecordedBrushSettings, index: number) => restyledSettings(originals[index] ?? originals[originals.length - 1], id, weight);
  return { drawing: mapDrawing(element.drawing, apply), drawingOriginal: mapDrawing(element.drawingOriginal, apply), drawingRestyle: { preset: id, weight, original: originals } };
}
export function clearRestyle(element: Restylable) {
  const original = element.drawingRestyle?.original ?? [], back = (settings: RecordedBrushSettings, index: number) => original[index] ?? settings;
  return { drawing: mapDrawing(element.drawing, back), drawingOriginal: mapDrawing(element.drawingOriginal, back), drawingRestyle: undefined };
}
/** Edit a value on every stroke, such as the light angle, without losing the way back. */
export function patchDrawingStrokes(element: Restylable, patch: Partial<RecordedBrushSettings>) {
  const change = (settings: RecordedBrushSettings) => ({ ...settings, ...patch });
  return { drawing: mapDrawing(element.drawing, change), drawingOriginal: mapDrawing(element.drawingOriginal, change) };
}
