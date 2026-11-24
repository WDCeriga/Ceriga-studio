import type { DesignElement } from '../../PrintStudioEditor';
import { pathPolygons, shapeWorldPath } from '../../../../lib/artworkPathOperations';
import { outlineLettering } from '../../../../lib/editableLettering';
import { readableInk } from './colour';
import { inkOf, inkPatch } from '../state/sharedProperties';

/**
 * Words as shapes (plan F.2). Pure geometry plus the async fit actions.
 * - Envelope: the shape's top and bottom edges, column by column, become the text's warp (text takes the shape's form).
 * - Inside: text is centred in the shape and sized to the shape's width at its middle (badges, shields, patches).
 * - Knockout: the text cuts out of the shape (handled by Combine › Cut out with the text on top).
 */
type FontImports = { family: string; dataUrl: string }[];
export type ShapeProfile = { left: number; top: number; width: number; height: number; topEdge: number[]; bottomEdge: number[] };

/** Column profile of a closed shape in garment space (samples evenly spaced left → right). */
export function shapeProfile(shape: DesignElement, samples = 48): ShapeProfile | null {
  const polygons = pathPolygons(shapeWorldPath(shape));
  const xs = polygons.flatMap(p => p.flatMap(r => r.map(([x]) => x))), ys = polygons.flatMap(p => p.flatMap(r => r.map(([, y]) => y)));
  if (!xs.length) return null;
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const width = right - left, height = bottom - top;
  if (width < 1 || height < 1) return null;
  const topEdge: (number | null)[] = [], bottomEdge: (number | null)[] = [];
  for (let i = 0; i < samples; i++) {
    // Inset the first/last column slightly so a pointed end still has a span.
    const x = left + width * (.01 + .98 * i / (samples - 1));
    const hits: number[] = [];
    for (const polygon of polygons) for (const ring of polygon) for (let k = 0; k < ring.length - 1; k++) {
      const [x1, y1] = ring[k], [x2, y2] = ring[k + 1];
      if ((x1 <= x && x2 > x) || (x2 <= x && x1 > x)) hits.push(y1 + (y2 - y1) * (x - x1) / (x2 - x1));
    }
    topEdge.push(hits.length ? (Math.min(...hits) - top) / height : null);
    bottomEdge.push(hits.length ? (Math.max(...hits) - top) / height : null);
  }
  const fill = (edge: (number | null)[], fallback: number) => edge.map((value, i) => {
    if (value !== null) return value;
    const before = edge.slice(0, i).reverse().find(v => v !== null), after = edge.slice(i + 1).find(v => v !== null);
    return before ?? after ?? fallback;
  }) as number[];
  return { left, top, width, height, topEdge: fill(topEdge, 0), bottomEdge: fill(bottomEdge, 1) };
}

/** Width of the shape at its vertical middle (the line text sits on when placed inside). */
export function middleChord(profile: ShapeProfile) {
  const spans = profile.topEdge.map((t, i) => ({ i, open: t <= .5 && profile.bottomEdge[i] >= .5 })).filter(s => s.open);
  if (!spans.length) return { centre: profile.left + profile.width / 2, width: profile.width * .5 };
  const a = spans[0].i / (profile.topEdge.length - 1), b = spans[spans.length - 1].i / (profile.topEdge.length - 1);
  return { centre: profile.left + profile.width * (.01 + .98 * (a + b) / 2), width: profile.width * .98 * (b - a) };
}

async function layoutSize(text: DesignElement, imports: FontImports) {
  const plain = { ...text, vectorTextEffects: undefined, textShapeMode: 'none' as const, textPath: undefined, textCurveAmount: 0, textBadge: undefined };
  const patch = await outlineLettering(plain, imports);
  return { width: patch.width ?? text.width, height: patch.height ?? text.height };
}

/** Text takes the shape's form; the shape is used up (Illustrator "Make with top object"). */
/**
 * Bends text along a banner or ribbon and keeps the shape behind it, like a sports patch.
 * The text uses the shape's curve but sits inside its middle, clear of the tails and edges.
 */
export async function bendTextInShape(elements: DesignElement[], textId: string, shapeId: string, imports: FontImports = [], inset = { width: .5, height: .36 }): Promise<DesignElement[]> {
  const warped = await warpTextToShape(elements, textId, shapeId, imports), shape = elements.find(e => e.id === shapeId);
  const text = warped.find(e => e.id === textId);
  if (!text || !shape) return elements;
  const fill = (shape.shapeFilled ? shape.shapeFillColor ?? shape.color : undefined) ?? '', ink = text.color ?? '#171717';
  const light = (hex: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null; const n = parseInt(m[1], 16); return (.2126 * (n >> 16 & 255) + .7152 * (n >> 8 & 255) + .0722 * (n & 255)) / 255; };
  // Text the same shade as the shape would vanish, so it switches to black or white for contrast.
  const fillLight = light(fill), inkLight = light(ink), clash = fillLight !== null && inkLight !== null && Math.abs(fillLight - inkLight) < .35;
  const contrast = clash ? (fillLight! > .5 ? '#171717' : '#ffffff') : undefined;
  // Banner tails hang below the body, so the text sits a little above the frame's centre.
  const fitted: DesignElement = { ...text, y: text.y - shape.height * .05, width: text.width * inset.width, height: text.height * inset.height, fontSize: (text.fontSize ?? 30) * inset.width,
    ...(contrast ? { color: contrast, textAppearance: text.textAppearance?.map(item => item.type === 'fill' ? { ...item, colour: contrast } : item) } : {}) };
  // Keep the shape where it was in the stack, with the text straight above it.
  return elements.flatMap(e => e.id === textId ? [] : e.id === shapeId ? [shape, fitted] : [e]);
}

export async function warpTextToShape(elements: DesignElement[], textId: string, shapeId: string, imports: FontImports = []): Promise<DesignElement[]> {
  const text = elements.find(e => e.id === textId), shape = elements.find(e => e.id === shapeId);
  if (!text || !shape) return elements;
  const profile = shapeProfile(shape); if (!profile) throw new Error('Choose a closed shape to warp the text into.');
  const size = await layoutSize(text, imports), scale = profile.width / Math.max(1, size.width);
  const next: DesignElement = {
    ...text, x: profile.left + profile.width / 2, y: profile.top + profile.height / 2, rotation: 0,
    fontSize: (text.fontSize ?? 30) * scale, width: profile.width, height: profile.height,
    textShapeMode: 'warp', textShapeSource: undefined, textPath: undefined, textCurveAmount: 0, textBadge: undefined,
    vectorTextEffects: [{ id: 'text-shape', type: 'envelope', enabled: true, bend: 0, horizontal: 0, vertical: 0, envelope: { top: profile.topEdge, bottom: profile.bottomEdge, aspect: profile.width / profile.height, strength: 100, sourceShape: shape,
      textBefore: { x: text.x, y: text.y, width: text.width, height: text.height, rotation: text.rotation, fontSize: text.fontSize, autoWidth: text.autoWidth, autoHeight: text.autoHeight } } }],
  };
  return elements.flatMap(e => e.id === shapeId ? [] : e.id === textId ? [next] : [e]);
}

/** Centre the text in the shape and size it to fit the shape's middle; the shape stays (badge text). */
export async function placeTextInside(elements: DesignElement[], textId: string, shapeId: string, imports: FontImports = [], fill = .78): Promise<DesignElement[]> {
  const text = elements.find(e => e.id === textId), shape = elements.find(e => e.id === shapeId);
  if (!text || !shape) return elements;
  const profile = shapeProfile(shape); if (!profile) throw new Error('Choose a closed shape to place the text in.');
  const chord = middleChord(profile), size = await layoutSize(text, imports);
  const scale = Math.min(chord.width * fill / Math.max(1, size.width), profile.height * .55 / Math.max(1, size.height));
  // Readable on the shape: same-colour text flips to light/dark against the shape's fill.
  const surface = shape.shapeFilled ? (shape.shapeFillColor ?? shape.color) : undefined;
  const colour = surface ? readableInk(inkOf(text), surface) : inkOf(text);
  const placed: DesignElement = { ...text, ...(colour !== inkOf(text) ? inkPatch(text, colour) : {}), x: chord.centre, y: profile.top + profile.height / 2, rotation: 0, fontSize: (text.fontSize ?? 30) * scale };
  // Text sits above the shape in the stack.
  const rest = elements.filter(e => e.id !== textId), at = rest.findIndex(e => e.id === shapeId);
  return [...rest.slice(0, at + 1), placed, ...rest.slice(at + 1)];
}

/** Exactly one text and one closed shape on the same side → their ids, else null. */
export function textAndShape(elements: DesignElement[], ids: string[]): { textId: string; shapeId: string } | null {
  if (ids.length !== 2) return null;
  const picked = elements.filter(e => ids.includes(e.id));
  const text = picked.find(e => e.type === 'text'), shape = picked.find(e => e.type === 'shape' && !e.shapeBrush);
  if (!text || !shape || (text.side ?? 'front') !== (shape.side ?? 'front')) return null;
  return { textId: text.id, shapeId: shape.id };
}

/** Undo Warp to shape: the words go back to where they were and the shape returns beneath them. */
export function restoreWarpedShape(elements: DesignElement[], textId: string): DesignElement[] {
  const text = elements.find(e => e.id === textId), envelope = text?.vectorTextEffects?.find(e => e.type === 'envelope')?.envelope;
  if (!text || !envelope) return elements;
  const straight: DesignElement = { ...text, ...(envelope.textBefore ?? {}), vectorTextEffects: undefined, textShapeMode: 'none' };
  return elements.flatMap(e => e.id !== textId ? [e] : envelope.sourceShape ? [envelope.sourceShape, straight] : [straight]);
}
