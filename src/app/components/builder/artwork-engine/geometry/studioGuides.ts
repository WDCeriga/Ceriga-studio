/**
 * Asset Studio drawing guides. They are plain line geometry drawn beside the artboard,
 * so they can never reach a saved asset or print file.
 */
export type SymmetryMode = 'off' | 'vertical' | 'horizontal' | 'quadrant' | 'radial';
export type RulerUnit = 'px' | 'cm';
export type CustomGuide = { id: string; axis: 'x' | 'y'; at: number };
export type StudioGuides = {
  grid: { on: boolean; size: number; divisions: number };
  isometric: { on: boolean; size: number; angle: number };
  lettering: { on: boolean; rows: number; xHeight: number; capHeight: number; slant: number };
  /** Vanishing points are percentages of the canvas and may sit outside it. */
  perspective: { on: boolean; count: 1 | 2 | 3; lines: number; points: { x: number; y: number }[] };
  symmetry: { mode: SymmetryMode; segments: number };
  rulers: { on: boolean; unit: RulerUnit };
  /** Lines dragged out of the rulers, in canvas units. */
  customGuides: CustomGuide[];
  colour: string;
  opacity: number;
  /** Strokes follow the nearest grid, isometric or lettering line. */
  assisted: boolean;
};
export const DEFAULT_GUIDES: StudioGuides = {
  grid: { on: false, size: 60, divisions: 4 },
  isometric: { on: false, size: 40, angle: 30 },
  lettering: { on: false, rows: 3, xHeight: 55, capHeight: 78, slant: 0 },
  perspective: { on: false, count: 2, lines: 24, points: [{ x: 50, y: 40 }, { x: 6, y: 40 }, { x: 94, y: 40 }, { x: 50, y: 118 }] },
  symmetry: { mode: 'off', segments: 8 },
  rulers: { on: false, unit: 'px' },
  customGuides: [],
  colour: '#2f6fed',
  opacity: 45,
  assisted: false,
};
export const hasLineGuides = (g: StudioGuides) => g.grid.on || g.isometric.on || g.lettering.on || g.perspective.on || g.customGuides.length > 0;
export const guidesActive = (g: StudioGuides) => hasLineGuides(g) || g.symmetry.mode !== 'off' || g.rulers.on;
/** Asset Studio works at 10 canvas units to the centimetre. */
export const CANVAS_UNITS_PER_CM = 10;
/** Ruler marks that stay readable at any zoom: labelled steps of 1, 2 or 5, each split in five. */
export function rulerTicks(length: number, scale: number, unit: RulerUnit) {
  const perUnit = unit === 'cm' ? CANVAS_UNITS_PER_CM : 1, wanted = 64 / Math.max(.001, scale) / perUnit, power = 10 ** Math.floor(Math.log10(wanted)), base = wanted / power, step = (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * power, spacing = step * perUnit, major: { at: number; label: string }[] = [], minor: number[] = [];
  for (let i = 0; i * spacing <= length + 1e-6; i++) { major.push({ at: i * spacing, label: String(Number((i * step).toFixed(4))) }); for (let k = 1; k < 5; k++) { const at = (i + k / 5) * spacing; if (at <= length) minor.push(at); } }
  return { major, minor };
}
/** Which stored points are in use: one central point, or a left, right and optional third. */
export const activeVanishingPoints = (p: StudioGuides['perspective']) => p.count === 1 ? [0] : p.count === 2 ? [1, 2] : [1, 2, 3];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const f = (v: number) => Math.round(v * 100) / 100;
const seg = (x1: number, y1: number, x2: number, y2: number) => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;

/** The part of an endless line through (x, y) at this angle that lies on the artboard. */
function across(x: number, y: number, angle: number, w: number, h: number) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let low = -Infinity, high = Infinity;
  for (const [p, d, max] of [[x, dx, w], [y, dy, h]] as const) {
    if (Math.abs(d) < 1e-9) { if (p < 0 || p > max) return ''; continue; }
    const a = (0 - p) / d, b = (max - p) / d;
    low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
  }
  return high > low ? seg(x + dx * low, y + dy * low, x + dx * high, y + dy * high) : '';
}

/** Three weights of line: fine, main and the strong axis lines. */
export function guidePaths(g: StudioGuides, w: number, h: number, denseRays = false) {
  const minor: string[] = [], major: string[] = [], axis: string[] = [];
  if (g.grid.on) {
    const size = clamp(g.grid.size, 4, 1000), divisions = Math.round(clamp(g.grid.divisions, 1, 12)), step = size / divisions, cols = Math.ceil(w / step), rows = Math.ceil(h / step);
    for (let i = 0; i <= cols; i++) { const x = i * step; if (x > w) break; (i % divisions ? minor : major).push(seg(x, 0, x, h)); }
    for (let i = 0; i <= rows; i++) { const y = i * step; if (y > h) break; (i % divisions ? minor : major).push(seg(0, y, w, y)); }
  }
  if (g.isometric.on) {
    const size = clamp(g.isometric.size, 6, 1000), angle = clamp(g.isometric.angle, 10, 70) * Math.PI / 180, gap = size / Math.cos(angle), rise = Math.tan(angle) * w;
    for (let x = 0; x <= w; x += size) minor.push(seg(x, 0, x, h));
    for (let y = -rise - gap; y <= h + rise + gap; y += gap) { const up = across(0, y, -angle, w, h), down = across(0, y, angle, w, h); if (up) major.push(up); if (down) major.push(down); }
  }
  if (g.lettering.on) {
    const rows = Math.round(clamp(g.lettering.rows, 1, 12)), rowHeight = h / rows, band = rowHeight * .72, x = clamp(g.lettering.xHeight, 20, 90) / 100, cap = clamp(g.lettering.capHeight, 30, 100) / 100, slant = clamp(g.lettering.slant, -45, 45);
    for (let r = 0; r < rows; r++) {
      const base = r * rowHeight + rowHeight * .82;
      axis.push(seg(0, base, w, base));
      major.push(seg(0, base - band * x, w, base - band * x), seg(0, base - band * cap, w, base - band * cap));
      minor.push(seg(0, base - band, w, base - band), seg(0, base + rowHeight * .14, w, base + rowHeight * .14));
    }
    if (slant) { const angle = (90 + slant) * Math.PI / 180, spacing = rowHeight * .5, reach = Math.abs(Math.tan(slant * Math.PI / 180)) * h; for (let px = -reach; px <= w + reach; px += spacing) { const line = across(px, 0, angle, w, h); if (line) minor.push(line); } }
  }
  if (g.perspective.on) {
    const used = activeVanishingPoints(g.perspective).map(index => g.perspective.points[index]).map(p => ({ x: p.x / 100 * w, y: p.y / 100 * h })), lines = denseRays ? 360 : Math.round(clamp(g.perspective.lines, 6, 72));
    for (const point of used) for (let i = 0; i < lines; i++) { const line = across(point.x, point.y, i / lines * Math.PI, w, h); if (line) minor.push(line); }
    const [first, second] = used, horizon = second && g.perspective.count > 1 ? Math.atan2(second.y - first.y, second.x - first.x) : 0, line = across(first.x, first.y, horizon, w, h);
    if (line) axis.push(line);
  }
  for (const guide of g.customGuides) { if (guide.axis === 'x' && guide.at >= 0 && guide.at <= w) axis.push(seg(guide.at, 0, guide.at, h)); if (guide.axis === 'y' && guide.at >= 0 && guide.at <= h) axis.push(seg(0, guide.at, w, guide.at)); }
  const cx = w / 2, cy = h / 2, mode = g.symmetry.mode;
  if (mode === 'vertical' || mode === 'quadrant') axis.push(seg(cx, 0, cx, h));
  if (mode === 'horizontal' || mode === 'quadrant') axis.push(seg(0, cy, w, cy));
  if (mode === 'radial') {
    const count = Math.round(clamp(g.symmetry.segments, 2, 32));
    for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + i / count * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a), t = Math.min(Math.abs(dx) > 1e-9 ? (dx > 0 ? w - cx : cx) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? (dy > 0 ? h - cy : cy) / Math.abs(dy) : Infinity); axis.push(seg(cx, cy, cx + dx * t, cy + dy * t)); }
  }
  return { minor: minor.join(''), major: major.join(''), axis: axis.join('') };
}

export type GuideMatrix = [number, number, number, number, number, number];
export const mapGuidePoint = ([a, b, c, d, e, f]: GuideMatrix, x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
/** The extra copies of a stroke for this symmetry, around the centre of a w by h canvas. */
export function symmetryTransforms(symmetry: StudioGuides['symmetry'], w: number, h: number): GuideMatrix[] {
  const flipX: GuideMatrix = [-1, 0, 0, 1, w, 0], flipY: GuideMatrix = [1, 0, 0, -1, 0, h], flipBoth: GuideMatrix = [-1, 0, 0, -1, w, h];
  if (symmetry.mode === 'vertical') return [flipX];
  if (symmetry.mode === 'horizontal') return [flipY];
  if (symmetry.mode === 'quadrant') return [flipX, flipY, flipBoth];
  if (symmetry.mode !== 'radial') return [];
  const count = Math.round(clamp(symmetry.segments, 2, 32)), cx = w / 2, cy = h / 2;
  return Array.from({ length: count - 1 }, (_, index) => {
    const angle = (index + 1) / count * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle);
    return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy] as GuideMatrix;
  });
}
/** Editable copies of a shape: position, rotation and flip follow the symmetry. */
export function symmetryCopies<T extends { x: number; y: number; rotation: number; flipHorizontal?: boolean; flipVertical?: boolean }>(shape: T, symmetry: StudioGuides['symmetry'], w: number, h: number): T[] {
  return symmetryTransforms(symmetry, w, h).map(matrix => {
    const [a, b, c, d] = matrix, point = mapGuidePoint(matrix, shape.x, shape.y);
    if (a * d - b * c > 0) return { ...shape, ...point, rotation: shape.rotation + Math.atan2(b, a) * 180 / Math.PI };
    return { ...shape, ...point, rotation: -shape.rotation, ...(a < 0 ? { flipHorizontal: !shape.flipHorizontal } : { flipVertical: !shape.flipVertical }) };
  });
}
export type GuideSegment = [number, number, number, number];
/** Straight lines a stroke can follow. Symmetry axes mirror drawing rather than attract it. */
export function guideSegments(g: StudioGuides, w: number, h: number, denseRays = false): GuideSegment[] {
  const paths = guidePaths({ ...g, symmetry: { ...g.symmetry, mode: 'off' } }, w, h, denseRays);
  return [...(paths.minor + paths.major + paths.axis).matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
}
export function projectToSegment([x1, y1, x2, y2]: GuideSegment, x: number, y: number) {
  const dx = x2 - x1, dy = y2 - y1, length = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return { x: x1 + dx * t, y: y1 + dy * t };
}
const distanceTo = (segment: GuideSegment, x: number, y: number) => { const p = projectToSegment(segment, x, y); return Math.hypot(p.x - x, p.y - y); };
/** Pulls a placed point onto a nearby guide line, or onto the crossing of two lines. */
export function snapToGuides(segments: GuideSegment[], x: number, y: number, radius: number) {
  const near = segments.map(segment => ({ segment, point: projectToSegment(segment, x, y) })).map(item => ({ ...item, distance: Math.hypot(item.point.x - x, item.point.y - y) })).filter(item => item.distance <= radius).sort((p, q) => p.distance - q.distance);
  if (!near.length) return null;
  const [x1, y1, x2, y2] = near[0].segment, ax = x2 - x1, ay = y2 - y1;
  for (const item of near.slice(1)) {
    const [x3, y3, x4, y4] = item.segment, bx = x4 - x3, by = y4 - y3, cross = ax * by - ay * bx;
    if (Math.abs(cross) < 1e-6 * (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)) continue;
    const t = ((x3 - x1) * by - (y3 - y1) * bx) / cross, hit = { x: x1 + ax * t, y: y1 + ay * t };
    if (Math.hypot(hit.x - x, hit.y - y) <= radius * 1.5) return hit;
  }
  return near[0].point;
}
/** Waits for a few units of movement, then locks the stroke to the close line running the same way. */
export function createStrokeAssist(segments: GuideSegment[], settle = 18) {
  let start: { x: number; y: number } | null = null, anchor: { x: number; y: number } | null = null, locked: GuideSegment | null = null;
  const assist = (x: number, y: number) => {
    if (!segments.length) return { x, y };
    if (!start) {
      start = { x, y };
      anchor = projectToSegment(segments.reduce((best, item) => distanceTo(item, x, y) < distanceTo(best, x, y) ? item : best), x, y);
      return anchor;
    }
    if (!locked) {
      const mx = x - start.x, my = y - start.y, moved = Math.hypot(mx, my);
      if (moved < settle) return anchor!;
      const score = (item: GuideSegment) => { const dx = item[2] - item[0], dy = item[3] - item[1], along = Math.abs(dx * mx + dy * my) / ((Math.hypot(dx, dy) || 1) * moved); return distanceTo(item, anchor!.x, anchor!.y) + (1 - along) * 160; };
      locked = segments.reduce((best, item) => score(item) < score(best) ? item : best);
    }
    return projectToSegment(locked, x, y);
  };
  /** The line this stroke settled on, once it has. */
  assist.line = () => locked;
  return assist;
}

export function readGuides(raw: string | null): StudioGuides {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || typeof v !== 'object') return DEFAULT_GUIDES;
    const mode = ['off', 'vertical', 'horizontal', 'quadrant', 'radial'].includes(v.symmetry?.mode) ? v.symmetry.mode as SymmetryMode : 'off';
    return { grid: { ...DEFAULT_GUIDES.grid, ...v.grid }, isometric: { ...DEFAULT_GUIDES.isometric, ...v.isometric }, lettering: { ...DEFAULT_GUIDES.lettering, ...v.lettering }, perspective: { on: v.perspective?.on === true, count: [1, 2, 3].includes(v.perspective?.count) ? v.perspective.count : DEFAULT_GUIDES.perspective.count, lines: Number.isFinite(v.perspective?.lines) ? clamp(v.perspective.lines, 6, 72) : DEFAULT_GUIDES.perspective.lines, points: DEFAULT_GUIDES.perspective.points.map((fallback, index) => { const point = v.perspective?.points?.[index]; return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? { x: clamp(point.x, -100, 200), y: clamp(point.y, -100, 200) } : fallback; }) }, rulers: { on: v.rulers?.on === true, unit: v.rulers?.unit === 'cm' ? 'cm' : 'px' }, customGuides: Array.isArray(v.customGuides) ? v.customGuides.filter((item: CustomGuide) => typeof item?.id === 'string' && (item.axis === 'x' || item.axis === 'y') && Number.isFinite(item.at)).slice(0, 80) : [], symmetry: { segments: Number.isFinite(v.symmetry?.segments) ? v.symmetry.segments : DEFAULT_GUIDES.symmetry.segments, mode }, colour: /^#[\da-f]{6}$/i.test(v.colour) ? v.colour : DEFAULT_GUIDES.colour, opacity: Number.isFinite(v.opacity) ? clamp(v.opacity, 10, 100) : DEFAULT_GUIDES.opacity, assisted: v.assisted === true };
  } catch { return DEFAULT_GUIDES; }
}
