import type { DesignElement } from '../../PrintStudioEditor';
import { fitPenPath } from '../../../../lib/artworkPathOperations';
import type { ShapePath } from '../../../../lib/shapeGeometry';

/**
 * Text along garment edges (plan §9.4). Edges are read from the real rendered garment parts, so they follow
 * whatever neckline, hem or sleeve the garment currently has, on every preset and side.
 * `sit` says which side of the edge the letters belong on.
 */
export type GarmentEdgeId = 'neckline' | 'hem' | 'pocket' | 'waistband' | 'sleeve-left' | 'sleeve-right' | 'leg-left' | 'leg-right';
export type GarmentEdge = { id: GarmentEdgeId; label: string; sit: 'below' | 'above' | 'along'; path: ShapePath; length: number };
export type EdgeTarget = { id: string; alpha: ArrayLike<number>; canvas: { width: number; height: number }; width: number; height: number };
export type TextEdgeLink = { id: GarmentEdgeId; side: 'front' | 'back'; gap: number; x: number; y: number; fontSize?: number };

type Point = { x: number; y: number };
const SAMPLES = 40;

const filled = (t: EdgeTarget, x: number, y: number) => t.alpha[(y * t.canvas.width + x) * 4 + 3] > 32;

function smooth(points: Point[], passes = 3) {
  let out = points;
  for (let pass = 0; pass < passes; pass++) out = out.map((p, i) => i === 0 || i === out.length - 1 ? p : { x: p.x, y: (out[i - 1].y + p.y * 2 + out[i + 1].y) / 4 });
  return out;
}
const polylineLength = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

/** Smooth curve through the points (Catmull-Rom as cubic handles). */
export function curveThrough(points: Point[]): ShapePath {
  return { closed: false, nodes: points.map((p, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)], dx = (after.x - before.x) / 6, dy = (after.y - before.y) / 6;
    return { x: p.x, y: p.y, in: i ? { x: p.x - dx, y: p.y - dy } : undefined, out: i < points.length - 1 ? { x: p.x + dx, y: p.y + dy } : undefined };
  }) };
}

/** The top or bottom contour of a part, column by column, left to right. */
export function partContour(t: EdgeTarget, which: 'top' | 'bottom', inset = .04, passes = 3): Point[] {
  const w = t.canvas.width, h = t.canvas.height; let left = w, right = -1;
  for (let x = 0; x < w; x += 2) { let hit = false; for (let y = 0; y < h; y += 2) if (filled(t, x, y)) { hit = true; break; } if (hit) { left = Math.min(left, x); right = Math.max(right, x); } }
  if (right <= left) return [];
  const span = right - left, from = left + span * inset, to = right - span * inset, raw: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = Math.round(from + (to - from) * i / SAMPLES); let found = -1;
    if (which === 'top') { for (let y = 0; y < h; y++) if (filled(t, x, y)) { found = y; break; } } else { for (let y = h - 1; y >= 0; y--) if (filled(t, x, y)) { found = y; break; } }
    if (found >= 0) raw.push({ x: x / w * t.width, y: found / h * t.height });
  }
  return raw.length >= 3 ? smooth(raw, passes) : [];
}

/**
 * A collar can be a sharp V, which letters cannot sit on evenly. Replace it with one gentle curve
 * (limited sag) that stays on the garment side of the collar everywhere.
 */
export function gentleCurveBelow(points: Point[], maxSag = .16): Point[] {
  if (points.length < 3) return points;
  const left = points[0].x, right = points[points.length - 1].x, width = Math.max(1, right - left), mid = (left + right) / 2;
  const u = (x: number) => (x - mid) / (width / 2);
  const meanU2 = points.reduce((s, p) => s + u(p.x) ** 2, 0) / points.length, meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  const top = points.reduce((s, p) => s + (u(p.x) ** 2 - meanU2) * (p.y - meanY), 0), bottom = points.reduce((s, p) => s + (u(p.x) ** 2 - meanU2) ** 2, 0) || 1;
  const limit = width * maxSag, a = Math.max(-limit, Math.min(limit, top / bottom));
  const curve = (x: number) => a * u(x) ** 2;
  const lift = Math.max(...points.map(p => p.y - curve(p.x)));
  return points.map(p => ({ x: p.x, y: curve(p.x) + lift }));
}

/** Centre line along a part's long axis, always reading left to right. */
export function partCentreLine(t: EdgeTarget): Point[] {
  const w = t.canvas.width, h = t.canvas.height, step = Math.max(1, Math.round(Math.max(w, h) / 320)), pts: Point[] = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (filled(t, x, y)) pts.push({ x: x / w * t.width, y: y / h * t.height });
  if (pts.length < 12) return [];
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let xx = 0, yy = 0, xy = 0; for (const p of pts) { xx += (p.x - mx) ** 2; yy += (p.y - my) ** 2; xy += (p.x - mx) * (p.y - my); }
  const angle = .5 * Math.atan2(2 * xy, xx - yy); let ux = Math.cos(angle), uy = Math.sin(angle);
  if (ux < -1e-6 || (Math.abs(ux) < 1e-6 && uy < 0)) { ux = -ux; uy = -uy; }
  const along = pts.map(p => (p.x - mx) * ux + (p.y - my) * uy), min = Math.min(...along), max = Math.max(...along), bins = 18;
  const sums = Array.from({ length: bins }, () => ({ a: 0, c: 0, n: 0 }));
  pts.forEach((p, i) => { const b = Math.min(bins - 1, Math.floor((along[i] - min) / Math.max(1e-6, max - min) * bins)); sums[b].a += along[i]; sums[b].c += -(p.x - mx) * uy + (p.y - my) * ux; sums[b].n++; });
  const line = sums.filter(s => s.n).slice(1, -1).map(s => { const a = s.a / s.n, c = s.c / s.n; return { x: mx + a * ux - c * uy, y: my + a * uy + c * ux }; });
  return line.length >= 3 ? line : [];
}

const edge = (id: GarmentEdgeId, label: string, sit: GarmentEdge['sit'], points: Point[]): GarmentEdge[] =>
  points.length >= 3 ? [{ id, label, sit, path: curveThrough(points), length: polylineLength(points) }] : [];

/** Every edge this garment side actually has. */
export function garmentEdges(targets: EdgeTarget[]): GarmentEdge[] {
  const find = (...ids: string[]) => ids.map(id => targets.find(t => t.id === id)).find(Boolean);
  const neck = find('neck', 'hood'), hem = find('bodyHem', 'hem'), pocket = find('pocket'), waist = find('waistband');
  const sleeveL = find('sleeveLeft'), sleeveR = find('sleeveRight'), legR = find('trouserLegRight'), legL = legR ? find('base') : undefined;
  return [
    ...(neck ? edge('neckline', 'Neckline', 'below', gentleCurveBelow(partContour(neck, 'bottom', .1))) : []),
    ...(waist ? edge('waistband', 'Waistband', 'below', partContour(waist, 'bottom')) : []),
    ...(hem ? edge('hem', 'Hem', 'above', partContour(hem, 'top')) : []),
    ...(pocket ? edge('pocket', 'Pocket', 'below', partContour(pocket, 'top', .08)) : []),
    ...(sleeveL ? edge('sleeve-left', 'Left sleeve', 'along', partCentreLine(sleeveL)) : []),
    ...(sleeveR ? edge('sleeve-right', 'Right sleeve', 'along', partCentreLine(sleeveR)) : []),
    ...(legL ? edge('leg-left', 'Left leg', 'along', partCentreLine(legL)) : []),
    ...(legR ? edge('leg-right', 'Right leg', 'along', partCentreLine(legR)) : []),
  ];
}

/** Baseline offset so the letters clear the edge by `gap`, on the right side of it. */
export function edgeOffset(sit: GarmentEdge['sit'], gap: number, fontSize: number) {
  const cap = fontSize * .72;
  return sit === 'below' ? gap + cap : sit === 'above' ? -gap : cap / 2 + gap;
}

/** The text patch that puts it on an edge. `fit` shrinks the size if the words are longer than the edge. */
export function textOnEdge(text: DesignElement, found: GarmentEdge, side: 'front' | 'back', gap: number, wordWidth?: number): Partial<DesignElement> {
  const fit = wordWidth && wordWidth > found.length * .92 ? found.length * .92 / wordWidth : 1;
  const fontSize = (text.fontSize ?? 30) * fit, frame = fitPenPath(found.path, fontSize * 1.6);
  return {
    x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotation: 0, flipHorizontal: false, flipVertical: false, fontSize,
    autoWidth: false, autoHeight: false, textShapeMode: 'path', textCurveAmount: 0, textBadge: undefined, textStackFit: false, vectorTextEffects: undefined, warp: undefined, perspective: undefined,
    textPath: { path: frame.shapePath, offset: edgeOffset(found.sit, gap, fontSize), flip: text.textPath?.flip, shift: text.textPath?.shift },
    textEdge: { id: found.id, side, gap, x: frame.x, y: frame.y, fontSize },
  };
}

/** After the garment changes: keep linked text on its edge, unless the user moved it away. */
export function refreshEdgeText(text: DesignElement, edges: GarmentEdge[], side: 'front' | 'back'): Partial<DesignElement> | null {
  const link = text.textEdge;
  if (!link || link.side !== side || Math.hypot(text.x - link.x, text.y - link.y) > .5) return null;
  const found = edges.find(item => item.id === link.id); if (!found) return null;
  const next = textOnEdge(text, found, side, link.gap);
  const moved = Math.hypot((next.x ?? 0) - text.x, (next.y ?? 0) - text.y) + Math.abs((next.width ?? 0) - text.width) + Math.abs((next.height ?? 0) - text.height);
  return moved > 1.5 ? next : null;
}

/** Resizing linked text keeps it on the edge with the same clearance. */
export function keepEdgeOnResize(text: DesignElement, edges: GarmentEdge[], side: 'front' | 'back'): DesignElement {
  const link = text.textEdge;
  if (!link || link.side !== side || !text.fontSize || link.fontSize === undefined || Math.abs(link.fontSize - text.fontSize) < 1e-6) return text;
  const found = edges.find(item => item.id === link.id);
  return found ? { ...text, ...textOnEdge(text, found, side, link.gap) } : text;
}
