import { BRUSH_PRESETS, DEFAULT_BRUSH_SETTINGS, type BrushPreset } from './drawingBrush';
import { VOLUME_DEFAULTS } from './brushVolume';
import { replayDrawingToCanvas } from './drawingRaster';
import type { RecordedBrushSettings, RecordedDrawing, RecordedStroke } from './drawingReplay';
import { shapeToEditablePath, type ShapePath } from './shapeGeometry';
import { pathSegmentPoint } from './shapePathEditing';
import { supportsVectorDrawing } from './vectorDrawing';
import type { DesignElement } from '../components/builder/PrintStudioEditor';

/**
 * A brush on a path. Only the brush is stored: its route is read from the live path every time,
 * so editing points, corners or shape parameters restyles the line straight away.
 */
export const isPathBrush = (element: Pick<DesignElement, 'shapeBrush'>) => Boolean(element.shapeBrush?.pathBrush);

export function pathBrushPatch(element: DesignElement, id: BrushPreset): Partial<DesignElement> {
  const preset = BRUSH_PRESETS.find(item => item.id === id)!, already = isPathBrush(element), borderWidth = already ? element.borderWidth ?? preset.size : Math.max(element.borderWidth ?? 0, preset.size * .55);
  const settings = { ...DEFAULT_BRUSH_SETTINGS, ...VOLUME_DEFAULTS, ...preset.settings, brushPreset: id, brushSize: borderWidth, color: '#171717', opacity: 100, pressure: false, stabilization: 0, grain: preset.grain, pencil: { tiltShading: false } } as RecordedBrushSettings;
  return { borderWidth, shapeBrush: { width: element.width, height: element.height, pathBrush: true, previousWidth: already ? element.shapeBrush!.previousWidth : element.borderWidth ?? 0, strokes: [{ points: [], settings, seed: 1, opacity: 1 }] } };
}
export const clearPathBrush = (element: DesignElement): Partial<DesignElement> => ({ shapeBrush: undefined, borderWidth: element.shapeBrush?.previousWidth ?? element.borderWidth });
export function patchPathBrush(element: DesignElement, patch: Partial<RecordedBrushSettings>): Partial<DesignElement> {
  const source = element.shapeBrush!;
  return { shapeBrush: { ...source, strokes: source.strokes.map(stroke => ({ ...stroke, settings: { ...stroke.settings, ...patch } })) } };
}

/** The drawing for this path right now, in the object's own units. */
export function pathBrushDrawing(element: DesignElement): RecordedDrawing {
  const template = element.shapeBrush!.strokes[0], width = element.width, height = element.height, path = shapeToEditablePath(element), parts: ShapePath[] = [path, ...(path.subpaths ?? [])];
  const strokes: RecordedStroke[] = [];
  parts.forEach((part, index) => {
    if (part.nodes.length < 2) return;
    const points: RecordedStroke['points'] = [], spans = part.closed ? part.nodes.length : part.nodes.length - 1;
    for (let i = 0; i < spans; i++) {
      const a = part.nodes[i], b = part.nodes[(i + 1) % part.nodes.length], reach = Math.hypot((b.x - a.x) * width / 100, (b.y - a.y) * height / 100) + (a.out || b.in ? Math.hypot(((a.out?.x ?? a.x) - a.x) * width / 100, ((a.out?.y ?? a.y) - a.y) * height / 100) + Math.hypot(((b.in?.x ?? b.x) - b.x) * width / 100, ((b.in?.y ?? b.y) - b.y) * height / 100) : 0), steps = Math.max(4, Math.min(240, Math.ceil(reach / 1.5)));
      for (let j = i ? 1 : 0; j <= steps; j++) { const p = pathSegmentPoint(a, b, j / steps); points.push({ x: p.x * width / 100, y: p.y * height / 100, p: 1, tilt: 0 }); }
    }
    strokes.push({ points, seed: index + 1, opacity: 1, paintFrame: { x: 0, y: 0, width, height }, settings: { ...template.settings, brushSize: Math.max(.5, element.borderWidth ?? template.settings.brushSize), color: element.shapeStrokeColor ?? element.color ?? template.settings.color } });
  });
  return { width, height, strokes };
}

/** Room around the path for thick, glowing or shadowed brushes. */
export function pathBrushPadding(drawing: RecordedDrawing) {
  return Math.ceil(Math.max(8, ...drawing.strokes.map(stroke => stroke.settings.brushSize * (['neon-tube'].includes(String(stroke.settings.brushPreset)) ? 2.4 : 1.6) + 6)));
}
export function paddedDrawing(drawing: RecordedDrawing, pad: number): RecordedDrawing {
  return { width: drawing.width + pad * 2, height: drawing.height + pad * 2, strokes: drawing.strokes.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ ...point, x: point.x + pad, y: point.y + pad })), paintFrame: stroke.paintFrame ? { ...stroke.paintFrame, x: stroke.paintFrame.x + pad, y: stroke.paintFrame.y + pad } : undefined })) };
}

/** Print files: pixel-based brushes become a high-resolution image, with any fill kept as vector underneath. */
export async function bakePathBrush(element: DesignElement): Promise<DesignElement> {
  if (!isPathBrush(element)) return element;
  const drawing = pathBrushDrawing(element);
  if (supportsVectorDrawing(drawing)) return element;
  const pad = pathBrushPadding(drawing), full = paddedDrawing(drawing, pad), ratio = Math.max(2, Math.min(8, 4096 / Math.max(full.width, full.height))), canvas = await replayDrawingToCanvas(full, ratio);
  if (!canvas) throw new Error(`Could not prepare ${element.layerName ?? 'this line'} for print.`);
  const w = element.width, h = element.height, local = { x: w / 2, y: h / 2, rotation: 0, flipHorizontal: false, flipVertical: false, opacity: 100 };
  const ink: DesignElement = { id: element.id + '-brush', type: 'image', content: canvas.toDataURL('image/png'), ...local, width: w + pad * 2, height: h + pad * 2 };
  const fill: DesignElement | null = element.shapeFilled ? { ...element, ...local, id: element.id + '-fill', shapeBrush: undefined, borderWidth: 0 } : null;
  return { ...element, type: 'group', shapeBrush: undefined, groupSourceWidth: w, groupSourceHeight: h, children: fill ? [fill, ink] : [ink] };
}
