import { renderBrushStroke } from './drawingBrush';
import { groupVolumeStrokes, isVolumeBrush, renderVolumeStrokes, type VolumeStroke } from './brushVolume';
import { offsetRecordedStroke, type RecordedDrawing, type RecordedStroke } from './drawingReplay';
import { loadTextEffectImage, renderTextEffects, textEffectPadding, type TextPixels } from './textEffectRendering';
import type { TextEffect } from './textEffects';

export const activeDrawingEffects = (element: { shapeEffects?: TextEffect[] }) => (element.shapeEffects ?? []).filter(effect => effect.enabled && effect.intensity > 0);
type DrawingLayer = { drawing?: RecordedDrawing; color?: string; width: number; height: number; shapeEffects?: TextEffect[] };

/** Replay a drawing, then run the same effects stack that text and shapes use. Room is added for glows and shadows. */
export async function replayDrawingWithEffects(element: DrawingLayer, ratio: number, isCancelled: () => boolean = () => false, lane = 'drawing-effects') {
  const source = element.drawing!, effects = activeDrawingEffects(element);
  if (!effects.length) return { canvas: await replayDrawingToCanvas(source, ratio, element.color, isCancelled), padding: 0 };
  const padding = textEffectPadding(effects), perCss = source.width / Math.max(.001, element.width), room = padding * perCss, roomY = padding * source.height / Math.max(.001, element.height);
  const shift = (stroke: RecordedStroke) => offsetRecordedStroke(stroke, room, roomY);
  const padded: RecordedDrawing = { width: source.width + room * 2, height: source.height + roomY * 2, strokes: source.strokes.map(shift), erasers: source.erasers?.map(shift), cuts: source.cuts?.map(cut => cut.map(point => ({ x: point.x + room, y: point.y + roomY }))) };
  const canvas = await replayDrawingToCanvas(padded, ratio, element.color, isCancelled);
  if (!canvas || isCancelled()) return { canvas: null, padding };
  const context = canvas.getContext('2d', { willReadFrequently: true })!, pixels = context.getImageData(0, 0, canvas.width, canvas.height), images: Record<string, TextPixels> = {};
  await Promise.all([...new Set(effects.map(effect => effect.source).filter((value): value is string => Boolean(value)))].map(async value => { images[value] = await loadTextEffectImage(value); }));
  if (isCancelled()) return { canvas: null, padding };
  const data = await renderTextEffects(lane, { data: pixels.data, width: canvas.width, height: canvas.height }, effects, images, ratio * perCss);
  if (isCancelled()) return { canvas: null, padding };
  context.putImageData(new ImageData(new Uint8ClampedArray(data), canvas.width, canvas.height), 0, 0);
  return { canvas, padding };
}

/** Replay recorded strokes at any resolution. Used by the canvas and by print files, so both always match. */
export async function replayDrawingToCanvas(source: RecordedDrawing, ratio: number, color?: string, isCancelled: () => boolean = () => false) {
  const width = Math.max(1, Math.round(source.width * ratio)), height = Math.max(1, Math.round(source.height * ratio));
  const output = document.createElement('canvas'); output.width = width; output.height = height;
  const ctx = output.getContext('2d'); if (!ctx) throw new Error('Drawing canvas unavailable');
  const strokeCanvas = document.createElement('canvas'); strokeCanvas.width = width; strokeCanvas.height = height;
  const ink = strokeCanvas.getContext('2d', { willReadFrequently: true }); if (!ink) throw new Error('Stroke canvas unavailable');
  const images = new Map<string, Promise<HTMLImageElement>>();
  const image = (url: string) => { if (!images.has(url)) { const img = new Image(); img.src = url; images.set(url, img.decode().then(() => img)); } return images.get(url)!; };
  const scaled = (stroke: RecordedStroke) => stroke.points.map(p => ({ ...p, x: p.x * ratio, y: p.y * ratio }));
  for (const group of groupVolumeStrokes(source.strokes as (RecordedStroke & VolumeStroke)[])) {
    if (isCancelled()) return null;
    const stroke = group[0], volume = isVolumeBrush(String(stroke.settings.brushPreset));
    ink.clearRect(0, 0, width, height);
    if (volume) renderVolumeStrokes(ink, group.map(item => ({ ...item, points: scaled(item), settings: { ...item.settings, color: color ?? item.settings.color } })), ratio);
    else {
      renderBrushStroke(ink, scaled(stroke), { ...stroke.settings, color: color ?? stroke.settings.color }, ratio, stroke.seed, stroke.paintFrame);
      if (stroke.mirrorAxis !== undefined) { const copy = document.createElement('canvas'); copy.width = width; copy.height = height; copy.getContext('2d')?.drawImage(strokeCanvas, 0, 0); ink.save(); ink.translate(stroke.mirrorAxis * ratio * 2, 0); ink.scale(-1, 1); ink.drawImage(copy, 0, 0); ink.restore(); }
    }
    if (stroke.clip) { const clip = await image(stroke.clip.url); if (isCancelled()) return null; ink.save(); ink.globalCompositeOperation = 'destination-in'; ink.drawImage(clip, stroke.clip.x * ratio, stroke.clip.y * ratio, stroke.clip.width * ratio, stroke.clip.height * ratio); ink.restore(); }
    ctx.globalAlpha = stroke.opacity; ctx.drawImage(strokeCanvas, 0, 0);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-out';
  for (const erased of source.erasers ?? []) { ink.clearRect(0, 0, width, height); renderBrushStroke(ink, scaled(erased), { ...erased.settings, color: '#fff' }, ratio, erased.seed, erased.paintFrame); ctx.globalAlpha = erased.opacity; ctx.drawImage(strokeCanvas, 0, 0); }
  ctx.globalAlpha = 1;
  for (const cut of source.cuts ?? []) { ctx.beginPath(); cut.forEach((p, i) => i ? ctx.lineTo(p.x * ratio, p.y * ratio) : ctx.moveTo(p.x * ratio, p.y * ratio)); ctx.closePath(); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  return output;
}

/** Print files carry 3D brushes as a high-resolution image of the same replay. */
export async function bakeVolumeDrawing<T extends { type: string; drawing?: RecordedDrawing; content: string; color?: string; width: number; height: number; layerName?: string; shapeEffects?: TextEffect[] }>(element: T): Promise<T> {
  const source = element.drawing, effects = activeDrawingEffects(element);
  if (!source || (!effects.length && !source.strokes.some(stroke => isVolumeBrush(String(stroke.settings.brushPreset))))) return element;
  const room = textEffectPadding(effects) * source.width / Math.max(.001, element.width), ratio = Math.max(2, Math.min(8, 4096 / Math.max(source.width + room * 2, source.height + room * 2)));
  const { canvas, padding } = await replayDrawingWithEffects(element, ratio, undefined, 'drawing-print-' + Math.random());
  if (!canvas) throw new Error(`Could not prepare ${element.layerName ?? 'this drawing'} for print.`);
  return { ...element, type: 'image', content: canvas.toDataURL('image/png'), width: element.width + padding * 2, height: element.height + padding * 2, drawing: undefined, drawingOriginal: undefined, drawingRestyle: undefined, shapeEffects: undefined, color: undefined };
}
