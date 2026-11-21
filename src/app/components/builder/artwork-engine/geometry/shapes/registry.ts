import clipping, { type Pair } from 'polygon-clipping';
import type { ShapeControl, ShapePath, ShapePathNode } from '../../../../../lib/shapeGeometry';

/**
 * Parametric fashion shapes (plan §8.1, Phase 1). Each shape is a pure generator: parameters → vector path,
 * in percentages of the object's box (the same format as every Ceriga shape), so it stays editable,
 * scales cleanly and can later be converted to points. Controls appear automatically in the inspector.
 */
export type ShapeFamily = 'Badges' | 'Ribbons' | 'Streetwear' | 'Decorative';
export type ParametricShape = {
  id: string; label: string; family: ShapeFamily;
  /** Default size in canvas units and whether it starts filled. */
  size: [number, number]; filled: boolean;
  controls: ShapeControl[];
  path: (p: (key: string) => number) => ShapePath;
};

const c = (key: string, label: string, min: number, max: number, value: number, step = 1): ShapeControl => ({ key, label, min, max, step, default: value });
const n = (x: number, y: number, inH?: [number, number], outH?: [number, number]): ShapePathNode => ({ x, y, ...(inH ? { in: { x: inH[0], y: inH[1] } } : {}), ...(outH ? { out: { x: outH[0], y: outH[1] } } : {}) });
const closed = (nodes: ShapePathNode[], extra?: Partial<ShapePath>): ShapePath => ({ closed: true, nodes, ...extra });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Deterministic pseudo-random for reseedable shapes. */
const rng = (seed: number) => { let s = Math.max(1, Math.floor(seed)) % 2147483647; return () => (s = s * 16807 % 2147483647) / 2147483647; };

/** Clip polygons to the 0–100 box and return them as subpaths. */
function clipToBox(polys: Pair[][]): ShapePath[] {
  const box: Pair[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const out: ShapePath[] = [];
  for (const poly of polys) {
    const clipped = clipping.intersection([poly], [box]);
    for (const piece of clipped) for (const ring of piece.slice(0, 1)) out.push(closed(ring.slice(0, -1).map(([x, y]) => n(x, y))));
  }
  return out;
}
const compound = (parts: ShapePath[], fillRule: 'evenodd' | 'nonzero' = 'nonzero'): ShapePath =>
  parts.length ? { ...parts[0], subpaths: parts.slice(1), fillRule } : closed([]);

/** Smooth ellipse/circle as four cubic segments. */
function ellipse(cx: number, cy: number, rx: number, ry: number): ShapePath {
  const k = .5523;
  return closed([
    n(cx, cy - ry, [cx - rx * k, cy - ry], [cx + rx * k, cy - ry]),
    n(cx + rx, cy, [cx + rx, cy - ry * k], [cx + rx, cy + ry * k]),
    n(cx, cy + ry, [cx + rx * k, cy + ry], [cx - rx * k, cy + ry]),
    n(cx - rx, cy, [cx - rx, cy + ry * k], [cx - rx, cy - ry * k]),
  ]);
}

const SHAPES: ParametricShape[] = [
  // ---------------- Badges ----------------
  { id: 'badge-shield', label: 'Shield', family: 'Badges', size: [120, 140], filled: true,
    controls: [c('topCurve', 'Top curve', 0, 20, 6), c('shoulder', 'Straight sides', 20, 80, 46), c('point', 'Point sharpness', 0, 100, 70)],
    path: p => {
      const t = p('topCurve'), s = p('shoulder'), sharp = p('point') / 100, tail = (100 - s) * .55, round = (1 - sharp) * 32;
      return closed([n(0, t, undefined, [18, t - t * .6]), n(50, 0, [30, 0], [70, 0]), n(100, t, [82, t - t * .6]),
        n(100, s, undefined, [100, s + tail]), n(50, 100, [50 + round, 100], [50 - round, 100]), n(0, s, [0, s + tail])]);
    } },
  { id: 'badge-crest', label: 'Crest', family: 'Badges', size: [124, 140], filled: true,
    controls: [c('notches', 'Top notches', 1, 6, 3), c('notchDepth', 'Notch depth', 0, 20, 8), c('shoulder', 'Straight sides', 20, 80, 50)],
    path: p => {
      const count = Math.round(p('notches')), d = p('notchDepth'), s = p('shoulder'), tail = (100 - s) * .55, nodes: ShapePathNode[] = [];
      const step = 100 / count;
      for (let i = 0; i < count; i++) { const x0 = i * step; nodes.push(n(x0, 0), n(x0 + step / 2, d)); }
      nodes.push(n(100, 0), n(100, s, undefined, [100, s + tail]), n(50, 100, [62, 98], [38, 98]), n(0, s, [0, s + tail]));
      return closed(nodes);
    } },
  { id: 'badge-seal', label: 'Seal', family: 'Badges', size: [140, 140], filled: true,
    controls: [c('scallops', 'Scallops', 8, 40, 20), c('depth', 'Scallop depth', 1, 15, 5)],
    path: p => {
      const count = Math.round(p('scallops')), depth = p('depth'), nodes: ShapePathNode[] = [];
      for (let i = 0; i < count * 2; i++) {
        const a = (i / (count * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 50 - depth : 50, x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
        const h = (Math.PI * r / (count * 2)) * .55, tx = -Math.sin(a) * h, ty = Math.cos(a) * h;
        nodes.push(n(x, y, [x - tx, y - ty], [x + tx, y + ty]));
      }
      return closed(nodes);
    } },
  { id: 'badge-arch', label: 'Arch badge', family: 'Badges', size: [140, 120], filled: true,
    controls: [c('arch', 'Arch height', 0, 60, 34), c('radius', 'Bottom corners', 0, 20, 6)],
    path: p => {
      const a = p('arch'), r = p('radius');
      return closed([n(0, a, undefined, [0, a * .45]), n(50, 0, [22, 0], [78, 0]), n(100, a, [100, a * .45]),
        n(100, 100 - r, undefined, [100, 100 - r * .45]), n(100 - r, 100, [100 - r * .45, 100]), n(r, 100, undefined, [r * .45, 100]), n(0, 100 - r, [0, 100 - r * .45])]);
    } },
  { id: 'badge-ticket', label: 'Ticket', family: 'Badges', size: [160, 90], filled: true,
    controls: [c('notch', 'Side notch', 0, 30, 14), c('radius', 'Corner radius', 0, 15, 5)],
    path: p => {
      const r = p('notch'), cr = p('radius'), k = .55;
      return closed([n(cr, 0), n(100 - cr, 0, undefined, [100 - cr * (1 - k), 0]), n(100, cr, [100, cr * (1 - k)]),
        n(100, 50 - r, undefined, [100 - r * k * .9, 50 - r]), n(100 - r * .9, 50, [100 - r * .9, 50 - r * k], [100 - r * .9, 50 + r * k]), n(100, 50 + r, [100 - r * k * .9, 50 + r]),
        n(100, 100 - cr, undefined, [100, 100 - cr * (1 - k)]), n(100 - cr, 100, [100 - cr * (1 - k), 100]), n(cr, 100, undefined, [cr * (1 - k), 100]), n(0, 100 - cr, [0, 100 - cr * (1 - k)]),
        n(0, 50 + r, undefined, [r * k * .9, 50 + r]), n(r * .9, 50, [r * .9, 50 + r * k], [r * .9, 50 - r * k]), n(0, 50 - r, [r * k * .9, 50 - r]),
        n(0, cr, undefined, [0, cr * (1 - k)]), n(cr, 0, [cr * (1 - k), 0])]);
    } },
  { id: 'badge-notched', label: 'Plate', family: 'Badges', size: [150, 100], filled: true,
    controls: [c('notch', 'Corner notch', 0, 35, 14)],
    path: p => { const d = p('notch'); return closed([n(d, 0), n(100 - d, 0), n(100, d), n(100, 100 - d), n(100 - d, 100), n(d, 100), n(0, 100 - d), n(0, d)]); } },
  // ---------------- Ribbons ----------------
  { id: 'ribbon-swallowtail', label: 'Swallowtail', family: 'Ribbons', size: [190, 56], filled: true,
    controls: [c('cut', 'Tail cut', 0, 25, 10)],
    path: p => { const d = p('cut'); return closed([n(0, 0), n(100, 0), n(100 - d, 50), n(100, 100), n(0, 100), n(d, 50)]); } },
  { id: 'ribbon-arched', label: 'Arched banner', family: 'Ribbons', size: [200, 90], filled: true,
    controls: [c('bend', 'Bend', 0, 50, 26), c('thickness', 'Band thickness', 20, 70, 44), c('cut', 'Tail cut', 0, 18, 7)],
    path: p => {
      const bend = p('bend'), th = p('thickness'), cut = p('cut'), total = bend + th, sy = (y: number) => y / total * 100;
      return closed([n(0, sy(bend), undefined, [26, sy(-bend * .2)]), n(100, sy(bend), [74, sy(-bend * .2)]), n(100 - cut, sy(bend + th / 2)),
        n(100, sy(bend + th), undefined, [74, sy(th - bend * .2)]), n(0, sy(bend + th), [26, sy(th - bend * .2)]), n(cut, sy(bend + th / 2))]);
    } },
  { id: 'ribbon-folded', label: 'Folded banner', family: 'Ribbons', size: [210, 80], filled: true,
    controls: [c('tail', 'Tail length', 8, 30, 18), c('drop', 'Fold drop', 10, 45, 28), c('cut', 'Tail cut', 0, 12, 6)],
    path: p => {
      const tail = p('tail'), drop = p('drop'), cut = p('cut'), bandH = 100 - drop;
      const band = closed([n(tail * .7, 0), n(100 - tail * .7, 0), n(100 - tail * .7, bandH), n(tail * .7, bandH)]);
      const left = closed([n(0, drop), n(tail, drop), n(tail, 100), n(0, 100), n(cut, drop + (100 - drop) / 2)]);
      const right = closed([n(100 - tail, drop), n(100, drop), n(100 - cut, drop + (100 - drop) / 2), n(100, 100), n(100 - tail, 100)]);
      return compound([band, left, right]);
    } },
  // ---------------- Streetwear ----------------
  { id: 'street-caution-tape', label: 'Caution tape', family: 'Streetwear', size: [220, 50], filled: true,
    controls: [c('stripes', 'Stripes', 3, 16, 8), c('slant', 'Slant', 0, 30, 12), c('weight', 'Stripe weight', 20, 80, 50)],
    path: p => {
      const count = Math.round(p('stripes')), slant = p('slant'), w = 100 / count * p('weight') / 100, polys: Pair[][] = [];
      for (let i = -1; i <= count + 1; i++) { const x = i * 100 / count; polys.push([[x + slant, 0], [x + slant + w, 0], [x + w, 100], [x, 100], [x + slant, 0]]); }
      return compound(clipToBox(polys));
    } },
  { id: 'street-barcode', label: 'Barcode', family: 'Streetwear', size: [160, 70], filled: true,
    controls: [c('bars', 'Bars', 12, 48, 28), c('seed', 'Shuffle', 1, 99, 7)],
    path: p => {
      const count = Math.round(p('bars')), rand = rng(p('seed')), widths = Array.from({ length: count }, () => 1 + Math.floor(rand() * 3)), gaps = widths.map(() => 1 + Math.floor(rand() * 2));
      const total = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) - gaps[gaps.length - 1];
      let x = 0; const bars: ShapePath[] = [];
      widths.forEach((w, i) => { const x0 = x / total * 100, x1 = (x + w) / total * 100; bars.push(closed([n(x0, 0), n(x1, 0), n(x1, 100), n(x0, 100)])); x += w + gaps[i]; });
      return compound(bars);
    } },
  { id: 'street-utility-tab', label: 'Utility tab', family: 'Streetwear', size: [170, 70], filled: true,
    controls: [c('hole', 'Grommet size', 0, 30, 16), c('point', 'Pointed end', 0, 30, 14)],
    path: p => {
      const hole = p('hole'), pt = p('point');
      const tab = closed([n(0, 0), n(100 - pt, 0), n(100, 50), n(100 - pt, 100), n(0, 100)]);
      return hole > 0 ? compound([tab, ellipse(14, 50, hole / 2 * .55, hole)], 'evenodd') : tab;
    } },
  { id: 'street-warning', label: 'Warning', family: 'Streetwear', size: [140, 124], filled: true,
    controls: [c('frame', 'Frame weight', 4, 30, 12)],
    path: p => {
      const f = p('frame'), inset = f * 1.7;
      return compound([closed([n(50, 0), n(100, 100), n(0, 100)]), closed([n(50, inset * 1.15), n(100 - inset, 100 - f), n(inset, 100 - f)])], 'evenodd');
    } },
  // ---------------- Decorative ----------------
  { id: 'deco-flames', label: 'Flames', family: 'Decorative', size: [150, 150], filled: true,
    controls: [c('tongues', 'Flames', 3, 9, 5), c('wild', 'Wildness', 0, 100, 45), c('seed', 'Shuffle', 1, 99, 3)],
    path: p => {
      const count = Math.round(p('tongues')), wild = p('wild') / 100, rand = rng(p('seed')), nodes: ShapePathNode[] = [n(8, 100, undefined, [8, 90])];
      for (let i = 0; i < count; i++) {
        const x0 = 8 + (i / count) * 84, x1 = 8 + ((i + 1) / count) * 84, peakX = lerp(x0, x1, .5 + (rand() - .5) * .5 * wild), peakY = Math.max(0, 10 + rand() * 35 * wild + (Math.abs(i - (count - 1) / 2) / count) * 40);
        const valleyY = 62 + rand() * 12;
        if (i > 0) nodes.push(n(x0, valleyY, [x0 - 4, valleyY - 6], [x0 + 4, valleyY - 6]));
        nodes.push(n(peakX, peakY, [peakX - (x1 - x0) * .1, peakY + 18], [peakX + (x1 - x0) * .1, peakY + 18]));
      }
      nodes.push(n(92, 100, [92, 90]));
      return closed(nodes); // flat base closes back to the first node
    } },
  { id: 'deco-drips', label: 'Drips', family: 'Decorative', size: [200, 110], filled: true,
    controls: [c('band', 'Band height', 10, 50, 26), c('drips', 'Drips', 2, 10, 5), c('length', 'Drip length', 10, 70, 45), c('seed', 'Shuffle', 1, 99, 11)],
    path: p => {
      const band = p('band'), count = Math.round(p('drips')), len = p('length'), rand = rng(p('seed')), nodes: ShapePathNode[] = [n(0, 0), n(100, 0), n(100, band)];
      const slots = Array.from({ length: count }, (_, i) => (i + .5) / count * 100).reverse();
      for (const cx of slots) {
        const w = 4 + rand() * 6, l = Math.min(100 - band, len * (.45 + rand() * .55)), bottom = band + l;
        nodes.push(n(cx + w / 2 + 2, band, undefined, [cx + w / 2, band]), n(cx + w / 2, bottom - w / 2, [cx + w / 2, band + l * .4]),
          n(cx, bottom, [cx + w / 2, bottom + 1], [cx - w / 2, bottom + 1]), n(cx - w / 2, bottom - w / 2, undefined, [cx - w / 2, band + l * .4]), n(cx - w / 2 - 2, band, [cx - w / 2, band]));
      }
      nodes.push(n(0, band));
      return closed(nodes);
    } },
  { id: 'deco-spark', label: 'Spark', family: 'Decorative', size: [120, 120], filled: true,
    controls: [c('points', 'Points', 4, 8, 4), c('pinch', 'Pinch', 30, 95, 75)],
    path: p => {
      const count = Math.round(p('points')), pinch = p('pinch') / 100, nodes: ShapePathNode[] = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2, x = 50 + Math.cos(a) * 50, y = 50 + Math.sin(a) * 50;
        nodes.push(n(x, y, [lerp(x, 50, pinch), lerp(y, 50, pinch)], [lerp(x, 50, pinch), lerp(y, 50, pinch)]));
      }
      return closed(nodes);
    } },
  { id: 'deco-barbed-wire', label: 'Barbed wire', family: 'Decorative', size: [220, 50], filled: false,
    controls: [c('barbs', 'Barbs', 3, 14, 6), c('size', 'Barb size', 10, 45, 28), c('wave', 'Twist', 0, 30, 10)],
    path: p => {
      const count = Math.round(p('barbs')), size = p('size'), wave = p('wave');
      const wireA: ShapePath = { closed: false, nodes: Array.from({ length: 13 }, (_, i) => n(i / 12 * 100, 50 + Math.sin(i / 12 * Math.PI * 4) * wave)) };
      const wireB: ShapePath = { closed: false, nodes: Array.from({ length: 13 }, (_, i) => n(i / 12 * 100, 50 - Math.sin(i / 12 * Math.PI * 4) * wave)) };
      const barbs: ShapePath[] = [];
      for (let i = 0; i < count; i++) {
        const x = (i + .5) / count * 100, h = size, w = h * .45;
        barbs.push({ closed: false, nodes: [n(x - w, 50 - h), n(x + w, 50 + h)] }, { closed: false, nodes: [n(x + w, 50 - h), n(x - w, 50 + h)] });
      }
      return { ...wireA, subpaths: [wireB, ...barbs] };
    } },
];

export const PARAMETRIC_SHAPES: Record<string, ParametricShape> = Object.fromEntries(SHAPES.map(shape => [shape.id, shape]));
export const PARAMETRIC_FAMILIES: ShapeFamily[] = ['Badges', 'Ribbons', 'Streetwear', 'Decorative'];
export const shapesInFamily = (family: ShapeFamily) => SHAPES.filter(shape => shape.family === family).map(shape => shape.id);

export function parametricShapeControls(content: string): ShapeControl[] | null {
  return PARAMETRIC_SHAPES[content]?.controls ?? null;
}

/** Path for a parametric shape, reading its saved parameters (clamped to each control's range). */
export function parametricShapePath(element: { content: string; shapeParameters?: Record<string, number | string> }): ShapePath | null {
  const shape = PARAMETRIC_SHAPES[element.content];
  if (!shape) return null;
  const p = (key: string) => {
    const control = shape.controls.find(item => item.key === key);
    const raw = Number(element.shapeParameters?.[key]);
    const value = Number.isFinite(raw) ? raw : Number(control?.default ?? 0);
    return control ? Math.min(control.max, Math.max(control.min, value)) : value;
  };
  return shape.path(p);
}
