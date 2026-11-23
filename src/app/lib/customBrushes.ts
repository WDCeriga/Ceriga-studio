import { BRUSH_PRESETS, DEFAULT_BRUSH_SETTINGS, type BrushPreset, type BrushSettings } from './drawingBrush';

/** Brushes a designer has tuned and named. Stored in this browser. */
export type CustomBrush = { id: string; name: string; base: BrushPreset; size: number; grain: number; settings: Partial<BrushSettings> };
const KEY = 'ceriga.print.customBrushes.v1', MAX = 60;

export function captureBrush(state: BrushSettings & { brushSize: number; grain: number }, name: string, id: string): CustomBrush {
  const settings = Object.fromEntries(Object.keys(DEFAULT_BRUSH_SETTINGS).filter(key => !['brushPreset', 'symmetry', 'customTextureSource'].includes(key)).map(key => [key, state[key as keyof BrushSettings]]).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value))) as Partial<BrushSettings>;
  if (settings.texture === 'custom') settings.texture = 'smooth';
  return { id, name: name.trim().slice(0, 40) || 'My brush', base: state.brushPreset, size: state.brushSize, grain: state.grain, settings };
}
export function readCustomBrushes(raw: string | null): CustomBrush[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && BRUSH_PRESETS.some(preset => preset.id === item.base) && Number.isFinite(item.size) && Number.isFinite(item.grain) && item.settings && typeof item.settings === 'object').slice(0, MAX) : [];
  } catch { return []; }
}
export function loadCustomBrushes() { try { return readCustomBrushes(localStorage.getItem(KEY)); } catch { return []; } }
export function storeCustomBrushes(brushes: CustomBrush[]) { try { localStorage.setItem(KEY, JSON.stringify(brushes.slice(0, MAX))); return true; } catch { return false; } }
