/**
 * Asset Studio drawing guides. They are plain line geometry drawn beside the artboard,
 * so they can never reach a saved asset or print file.
 */
export type SymmetryMode = 'off' | 'vertical' | 'horizontal' | 'quadrant' | 'radial';
export type SkeletonKind = 'arch' | 'wave' | 'banner' | 'circle' | 'ribbon' | 'perspective';
export type GuideSkeleton = { on: boolean; kind: SkeletonKind; x: number; y: number; width: number; height: number; bend: number; rows: number };
export type RulerUnit = 'px' | 'cm';
export type CustomGuide = { id: string; axis: 'x' | 'y'; at: number };
export type StudioGuides = {
  grid: { on: boolean; size: number; divisions: number };
  isometric: { on: boolean; size: number; angle: number };
  lettering: { on: boolean; rows: number; xHeight: number; capHeight: number; slant: number };
  /** Vanishing points are percentages of the canvas and may sit outside it. */
  perspective: { on: boolean; count: 1 | 2 | 3; lines: number; points: { x: number; y: number }[] };
  symmetry: { mode: SymmetryMode; segments: number };
  /** A low-opacity frame to letter inside. Position and size are percentages of the canvas. */
  skeleton: GuideSkeleton;
  /** Lines and strokes keep to multiples of this angle. */
  angle: { on: boolean; step: number };
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
  skeleton: { on: false, kind: 'arch', x: 50, y: 50, width: 70, height: 26, bend: 45, rows: 2 },
  angle: { on: false, step: 45 },
  rulers: { on: false, unit: 'px' },
  customGuides: [],
  colour: '#2f6fed',
  opacity: 45,
  assisted: false,
};
export const hasLineGuides = (g: StudioGuides) => g.grid.on || g.isometric.on || g.lettering.on || g.perspective.on || g.skeleton.on || g.customGuides.length > 0;
export const guidesActive = (g: StudioGuides) => hasLineGuides(g) || g.symmetry.mode !== 'off' || g.rulers.on;
/** Maps a place in the frame (t along, v across, both 0 to 1) onto the curved layout. */
export function skeletonPoint(s: GuideSkeleton, w: number, h: number, t: number, v: number) {
  const cx = s.x / 100 * w, cy = s.y / 100 * h, W = s.width / 100 * w, H = s.height / 100 * h, b = clamp(s.bend, -100, 100) / 100, across = v - .5, wave = Math.sin(t * Math.PI * 2);
  if (s.kind === 'circle') {
    const sweep = Math.PI * (1 + Math.abs(b)), angle = (b < 0 ? Math.PI / 2 : -Math.PI / 2) + (t - .5) * sweep * (b < 0 ? -1 : 1), outer = Math.min(W, s.width / 100 * w) / 2, radius = Math.max(1, outer - v * Math.min(H, outer * .9));
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }
  const x = cx + (t - .5) * W;
  if (s.kind === 'arch') return { x, y: cy + across * H - b * H * .9 * (Math.sin(Math.PI * t) - .5) };
  if (s.kind === 'wave') return { x, y: cy + across * H + b * H * .55 * wave };
  if (s.kind === 'banner') { const edge = Math.abs(2 * t - 1); return { x, y: cy + across * H * (1 - .22 * edge ** 3) - b * H * .55 * (1 - edge * edge - .5) }; }
  if (s.kind === 'ribbon') return { x: x + across * H * .28 * b * Math.cos(t * Math.PI * 2), y: cy + across * H * (1 - .42 * Math.abs(wave)) + b * H * .5 * wave };
  return { x, y: cy + across * H * (1 + b * .75 * (2 * t - 1)) };
}
/** One curve per lettering line, from the top of the frame to the bottom. */
export function skeletonCurves(s: GuideSkeleton, w: number, h: number, samples = 72) {
  const rows = Math.round(clamp(s.rows, 1, 6));
  return Array.from({ length: rows + 1 }, (_, row) => Array.from({ length: samples + 1 }, (_, i) => skeletonPoint(s, w, h, i / samples, row / rows)));
}
export const guideCurves = (g: StudioGuides, w: number, h: number) => g.skeleton.on ? skeletonCurves(g.skeleton, w, h) : [];
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
  if (g.skeleton.on) {
    const curves = skeletonCurves(g.skeleton, w, h);
    curves.forEach((curve, row) => { const target = row === 0 || row === curves.length - 1 ? axis : major; for (let i = 1; i < curve.length; i++) target.push(seg(curve[i - 1].x, curve[i - 1].y, curve[i].x, curve[i].y)); });
    for (const t of [0, 1]) { const start = skeletonPoint(g.skeleton, w, h, t, 0), end = skeletonPoint(g.skeleton, w, h, t, 1); minor.push(seg(start.x, start.y, end.x, end.y)); }
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
  // Freehand strokes follow skeleton curves whole; only placed points use their short pieces.
  const paths = guidePaths({ ...g, skeleton: denseRays ? { ...g.skeleton, on: false } : g.skeleton, symmetry: { ...g.symmetry, mode: 'off' } }, w, h, denseRays);
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
type GuidePoint = { x: number; y: number };
/** The closest place on a curve, with the direction the curve runs there. */
function onCurve(curve: GuidePoint[], x: number, y: number) {
  let best = { point: curve[0], distance: Infinity, dx: 1, dy: 0 };
  for (let i = 1; i < curve.length; i++) { const a = curve[i - 1], b = curve[i], point = projectToSegment([a.x, a.y, b.x, b.y], x, y), distance = Math.hypot(point.x - x, point.y - y); if (distance < best.distance) best = { point, distance, dx: b.x - a.x, dy: b.y - a.y }; }
  return best;
}
/** Waits for a few units of movement, then locks the stroke to the close line or curve running the same way. */
export function createStrokeAssist(segments: GuideSegment[], settle = 18, curves: GuidePoint[][] = []) {
  let start: GuidePoint | null = null, anchor: GuidePoint | null = null, locked: GuideSegment | null = null, lockedCurve: GuidePoint[] | null = null;
  const nearest = (x: number, y: number) => {
    const options = [...segments.map(item => projectToSegment(item, x, y)), ...curves.map(curve => onCurve(curve, x, y).point)];
    return options.reduce((best, item) => Math.hypot(item.x - x, item.y - y) < Math.hypot(best.x - x, best.y - y) ? item : best);
  };
  const snap = (x: number, y: number) => lockedCurve ? onCurve(lockedCurve, x, y).point : locked ? projectToSegment(locked, x, y) : { x, y };
  const assist = (x: number, y: number) => {
    if (!segments.length && !curves.length) return { x, y };
    if (!start) { start = { x, y }; anchor = nearest(x, y); return anchor; }
    if (!locked && !lockedCurve) {
      const mx = x - start.x, my = y - start.y, moved = Math.hypot(mx, my);
      if (moved < settle) return anchor!;
      const alignment = (dx: number, dy: number) => Math.abs(dx * mx + dy * my) / ((Math.hypot(dx, dy) || 1) * moved);
      const lineScore = (item: GuideSegment) => distanceTo(item, anchor!.x, anchor!.y) + (1 - alignment(item[2] - item[0], item[3] - item[1])) * 160;
      const curveScore = (curve: GuidePoint[]) => { const hit = onCurve(curve, anchor!.x, anchor!.y); return hit.distance + (1 - alignment(hit.dx, hit.dy)) * 160; };
      const bestLine = segments.length ? segments.reduce((best, item) => lineScore(item) < lineScore(best) ? item : best) : null, bestCurve = curves.length ? curves.reduce((best, item) => curveScore(item) < curveScore(best) ? item : best) : null;
      if (bestCurve && (!bestLine || curveScore(bestCurve) <= lineScore(bestLine))) lockedCurve = bestCurve; else locked = bestLine;
    }
    return snap(x, y);
  };
  /** The straight line this stroke settled on, when it chose one. */
  assist.line = () => locked;
  assist.settled = () => Boolean(locked || lockedCurve);
  assist.snap = snap;
  return assist;
}

/** Keeps the distance from one point to another, at the nearest allowed angle. */
export function snapAngle(from: { x: number; y: number }, to: { x: number; y: number }, step: number) {
  const unit = clamp(step, 1, 90) * Math.PI / 180, length = Math.hypot(to.x - from.x, to.y - from.y), angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / unit) * unit;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}
/** A freehand stroke that settles onto the nearest allowed angle from where it began. */
export function createAngleAssist(step: number, settle = 12) {
  let start: { x: number; y: number } | null = null, locked: GuideSegment | null = null;
  const snap = (x: number, y: number) => locked ? projectToSegment(locked, x, y) : { x, y };
  const assist = (x: number, y: number) => {
    if (!start) { start = { x, y }; return start; }
    if (!locked) {
      if (Math.hypot(x - start.x, y - start.y) < settle) return start;
      const aim = snapAngle(start, { x, y }, step), length = Math.hypot(aim.x - start.x, aim.y - start.y) || 1, dx = (aim.x - start.x) / length, dy = (aim.y - start.y) / length;
      locked = [start.x - dx * 100000, start.y - dy * 100000, start.x + dx * 100000, start.y + dy * 100000];
    }
    return snap(x, y);
  };
  assist.line = () => locked;
  assist.settled = () => Boolean(locked);
  assist.snap = snap;
  return assist;
}
/** Guides along the edges and centre of a box, skipping any already there. */
export function guidesFromBox(box: { x: number; y: number; width: number; height: number }, existing: CustomGuide[], makeId: () => string): CustomGuide[] {
  const wanted: Pick<CustomGuide, 'axis' | 'at'>[] = [box.x, box.x + box.width / 2, box.x + box.width].map(at => ({ axis: 'x' as const, at: Math.round(at) })).concat([box.y, box.y + box.height / 2, box.y + box.height].map(at => ({ axis: 'y' as const, at: Math.round(at) })) as never[]);
  const next = [...existing];
  for (const item of wanted) if (!next.some(guide => guide.axis === item.axis && guide.at === item.at)) next.push({ ...item, id: makeId() });
  return next.slice(0, 80);
}

export function readGuides(raw: string | null): StudioGuides {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || typeof v !== 'object') return DEFAULT_GUIDES;
    const mode = ['off', 'vertical', 'horizontal', 'quadrant', 'radial'].includes(v.symmetry?.mode) ? v.symmetry.mode as SymmetryMode : 'off';
    return { grid: { ...DEFAULT_GUIDES.grid, ...v.grid }, isometric: { ...DEFAULT_GUIDES.isometric, ...v.isometric }, lettering: { ...DEFAULT_GUIDES.lettering, ...v.lettering }, perspective: { on: v.perspective?.on === true, count: [1, 2, 3].includes(v.perspective?.count) ? v.perspective.count : DEFAULT_GUIDES.perspective.count, lines: Number.isFinite(v.perspective?.lines) ? clamp(v.perspective.lines, 6, 72) : DEFAULT_GUIDES.perspective.lines, points: DEFAULT_GUIDES.perspective.points.map((fallback, index) => { const point = v.perspective?.points?.[index]; return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? { x: clamp(point.x, -100, 200), y: clamp(point.y, -100, 200) } : fallback; }) }, skeleton: { on: v.skeleton?.on === true, kind: ['arch', 'wave', 'banner', 'circle', 'ribbon', 'perspective'].includes(v.skeleton?.kind) ? v.skeleton.kind : DEFAULT_GUIDES.skeleton.kind, x: Number.isFinite(v.skeleton?.x) ? clamp(v.skeleton.x, -50, 150) : DEFAULT_GUIDES.skeleton.x, y: Number.isFinite(v.skeleton?.y) ? clamp(v.skeleton.y, -50, 150) : DEFAULT_GUIDES.skeleton.y, width: Number.isFinite(v.skeleton?.width) ? clamp(v.skeleton.width, 10, 150) : DEFAULT_GUIDES.skeleton.width, height: Number.isFinite(v.skeleton?.height) ? clamp(v.skeleton.height, 4, 100) : DEFAULT_GUIDES.skeleton.height, bend: Number.isFinite(v.skeleton?.bend) ? clamp(v.skeleton.bend, -100, 100) : DEFAULT_GUIDES.skeleton.bend, rows: Number.isFinite(v.skeleton?.rows) ? Math.round(clamp(v.skeleton.rows, 1, 6)) : DEFAULT_GUIDES.skeleton.rows }, angle: { on: v.angle?.on === true, step: Number.isFinite(v.angle?.step) ? Math.round(clamp(v.angle.step, 1, 90)) : DEFAULT_GUIDES.angle.step }, rulers: { on: v.rulers?.on === true, unit: v.rulers?.unit === 'cm' ? 'cm' : 'px' }, customGuides: Array.isArray(v.customGuides) ? v.customGuides.filter((item: CustomGuide) => typeof item?.id === 'string' && (item.axis === 'x' || item.axis === 'y') && Number.isFinite(item.at)).slice(0, 80) : [], symmetry: { segments: Number.isFinite(v.symmetry?.segments) ? v.symmetry.segments : DEFAULT_GUIDES.symmetry.segments, mode }, colour: /^#[\da-f]{6}$/i.test(v.colour) ? v.colour : DEFAULT_GUIDES.colour, opacity: Number.isFinite(v.opacity) ? clamp(v.opacity, 10, 100) : DEFAULT_GUIDES.opacity, assisted: v.assisted === true };
  } catch { return DEFAULT_GUIDES; }
}
