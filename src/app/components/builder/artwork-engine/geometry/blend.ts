import type { DesignElement } from '../../PrintStudioEditor';
import { pathSegmentPoint } from '../../../../lib/shapePathEditing';
import { shapeWorldPath } from '../../../../lib/artworkPathOperations';
import { textPathSampler } from '../../../../lib/textPathSampler';
import type { ShapePath } from '../../../../lib/shapeGeometry';
import { inkOf, inkPatch } from '../state/sharedProperties';
import { readableInk } from './colour';

/**
 * Live Blend (reference 16, Illustrator's Blend tool). The group stores only its source paths (hidden children)
 * and these settings. The in-between lines are generated on demand, so saves and undo stay light, and editing
 * any source or setting updates every step.
 */
export type BlendEasing = 'linear' | 'in' | 'out' | 'inOut';
export type BlendSettings = {
  mode: 'steps' | 'distance';
  /** In-between steps (the two sources are extra). */
  steps: number;
  /** Distance between steps in group source units, when mode is 'distance'. */
  spacing: number;
  look: 'lines' | 'smooth';
  easing: BlendEasing;
  /** Easing strength, 0–100. */
  easeAmount: number;
  /** Run the later sources backwards. */
  reverse: boolean;
  /** Slide the start point of closed sources, 0–100 % of the perimeter. */
  twist: number;
  startWidth: number; endWidth: number;
  startOpacity: number; endOpacity: number;
  startColour: string; endColour: string;
  /** Gaussian blur radius in group source units (soft, glowing blends). */
  blur?: number;
  /** Optional path the blend travels along, in group source space. */
  spine?: { path: ShapePath; element?: DesignElement };
};

type P = { x: number; y: number };
type BlendKey = { points: P[]; closed: boolean };
const MAX_STEPS = 600, MAX_BANDS = 32;
export const BLEND_MAX_STEPS = MAX_STEPS;

const singleContour = (element: DesignElement) => {
  const path = shapeWorldPath(element);
  return !path.subpaths?.length && path.nodes.length >= 2;
};

/** Why these objects can't blend; null when they can. */
export function blendIssue(elements: DesignElement[], ids: string[]): string | null {
  const picked = elements.filter(element => ids.includes(element.id));
  if (picked.length < 2) return 'Select two or more paths.';
  if (picked.some(element => element.type !== 'shape' || element.shapeBrush || element.locked || element.hidden)) return 'Blend works on unlocked vector shapes and pen paths.';
  if (picked.some(element => (element.side ?? 'front') !== (picked[0].side ?? 'front'))) return 'Choose paths on the same garment side.';
  try { if (picked.some(element => !singleContour(element))) return 'Choose single paths, without holes.'; } catch { return 'These paths cannot blend.'; }
  return null;
}

/** Evenly spaced points along a path. */
export function resamplePath(path: ShapePath, count: number): P[] {
  const dense: P[] = [], nodes = path.nodes, spans = nodes.length - (path.closed ? 0 : 1);
  for (let i = 0; i < spans; i++) {
    const a = nodes[i], b = nodes[(i + 1) % nodes.length], curved = a.out || b.in, parts = curved ? 24 : 1;
    for (let j = 0; j < parts; j++) dense.push(curved ? pathSegmentPoint(a, b, j / parts) : { x: a.x + (b.x - a.x) * j / parts, y: a.y + (b.y - a.y) * j / parts });
  }
  dense.push(path.closed ? { x: nodes[0].x, y: nodes[0].y } : { x: nodes[nodes.length - 1].x, y: nodes[nodes.length - 1].y });
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) lengths.push(lengths[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  const total = lengths[lengths.length - 1] || 1, out: P[] = [], last = path.closed ? count : count - 1;
  let at = 0;
  for (let i = 0; i < count; i++) {
    const want = total * i / last;
    while (at < lengths.length - 2 && lengths[at + 1] < want) at++;
    const span = Math.max(1e-9, lengths[at + 1] - lengths[at]), t = Math.max(0, Math.min(1, (want - lengths[at]) / span));
    out.push({ x: dense[at].x + (dense[at + 1].x - dense[at].x) * t, y: dense[at].y + (dense[at + 1].y - dense[at].y) * t });
  }
  return out;
}

const centre = (points: P[]) => { let x = 0, y = 0; for (const p of points) { x += p.x; y += p.y; } return { x: x / points.length, y: y / points.length }; };

/** Match `next` to `base`: best direction and, for closed paths, best start point, so the blend does not twist. */
export function alignPoints(base: P[], next: P[], closed: boolean): P[] {
  const a = centre(base), b = centre(next), n = next.length;
  const score = (candidate: P[], shift: number) => { let sum = 0; for (let i = 0; i < n; i += 2) { const q = candidate[(i + shift) % n]; sum += (base[i].x - a.x - q.x + b.x) ** 2 + (base[i].y - a.y - q.y + b.y) ** 2; } return sum; };
  let best = next, bestShift = 0, bestScore = Infinity;
  for (const candidate of [next, [...next].reverse()]) {
    for (let shift = 0; shift < (closed ? n : 1); shift++) { const value = score(candidate, shift); if (value < bestScore) { bestScore = value; best = candidate; bestShift = shift; } }
  }
  return best.map((_, i) => best[(i + bestShift) % n]);
}

const ease = (t: number, type: BlendEasing, amount: number) => {
  const p = 1 + Math.max(0, Math.min(100, amount)) / 33;
  if (type === 'in') return t ** p;
  if (type === 'out') return 1 - (1 - t) ** p;
  if (type === 'inOut') return t < .5 ? (2 * t) ** p / 2 : 1 - (2 * (1 - t)) ** p / 2;
  return t;
};
const hex = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) : [23, 23, 23];
const mixColour = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

function blendKeys(group: DesignElement): BlendKey[] {
  const s = group.artworkBlend!, sources = group.children ?? [], count = (s.mode === 'distance' || s.steps <= 240) ? 144 : 96;
  const paths = sources.map(source => shapeWorldPath(source)), closed = paths.every(path => path.closed);
  const keys: BlendKey[] = [];
  paths.forEach((path, index) => {
    let points = resamplePath(closed ? path : { ...path, closed: false }, count);
    if (index > 0) {
      points = alignPoints(keys[index - 1].points, points, closed);
      if (s.reverse) points = [...points].reverse();
      if (closed && s.twist) { const shift = Math.round(count * s.twist / 100) % count; points = points.map((_, i) => points[(i + shift) % count]); }
    }
    keys.push({ points, closed });
  });
  return keys;
}

const keyDistance = (keys: BlendKey[]) => {
  let total = 0;
  for (let k = 1; k < keys.length; k++) { let sum = 0; const a = keys[k - 1].points, b = keys[k].points; for (let i = 0; i < a.length; i++) sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y); total += sum / a.length; }
  return total;
};
const stepCount = (s: BlendSettings, keys: BlendKey[]) => Math.max(1, Math.min(MAX_STEPS, Math.round(s.mode === 'distance' ? keyDistance(keys) / Math.max(.05, s.spacing) : s.steps)));

const pointsAt = (keys: BlendKey[], u: number) => {
  const span = u * (keys.length - 1), index = Math.min(keys.length - 2, Math.floor(span)), t = span - index, a = keys[index].points, b = keys[index + 1].points;
  return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
};

type Step = { points: P[]; t: number };
function blendSteps(group: DesignElement, keys = blendKeys(group)): Step[] {
  const s = group.artworkBlend!, total = stepCount(s, keys) + 2, out: Step[] = [];
  const spine = s.spine ? textPathSampler(s.spine.path) : null;
  for (let i = 0; i < total; i++) {
    const raw = i / (total - 1), u = ease(raw, s.easing, s.easeAmount);
    let points = pointsAt(keys, u);
    if (spine) { const at = spine.point(spine.length * raw), c = centre(points); points = points.map(p => ({ x: p.x + at.x - c.x, y: p.y + at.y - c.y })); }
    out.push({ points, t: u });
  }
  return out;
}

/** Colour along the blend, passing through every key shape's colour. */
function colourStops(group: DesignElement) {
  const s = group.artworkBlend!, sources = group.children ?? [];
  return sources.map((source, index) => index === 0 ? s.startColour : index === sources.length - 1 ? s.endColour : source.blendColour ?? inkOf(source));
}
const colourAt = (stops: string[], u: number) => {
  const span = Math.max(0, Math.min(1, u)) * (stops.length - 1), index = Math.min(stops.length - 2, Math.floor(span));
  return mixColour(stops[index], stops[index + 1], span - index);
};

const blendKeyOf = (group: DesignElement) => JSON.stringify([group.artworkBlend, group.children]);

/** Drop points that add no visible shape, so hundreds of lines stay light to draw. */
export function simplifyStep(points: P[], tolerance = .06): P[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length), stack: [number, number][] = [[0, points.length - 1]], limit = tolerance * tolerance;
  keep[0] = keep[points.length - 1] = 1;
  while (stack.length) {
    const [from, to] = stack.pop()!, a = points[from], b = points[to], dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
    let worst = -1, far = limit;
    for (let i = from + 1; i < to; i++) {
      const p = points[i], u = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0, ex = p.x - a.x - u * dx, ey = p.y - a.y - u * dy, d = ex * ex + ey * ey;
      if (d > far) { far = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([from, worst], [worst, to]); }
  }
  return points.filter((_, i) => keep[i]);
}

function fitSteps(steps: P[][], closed: boolean) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const row of steps) for (const p of row) { if (p.x < left) left = p.x; if (p.x > right) right = p.x; if (p.y < top) top = p.y; if (p.y > bottom) bottom = p.y; }
  const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
  const parts: ShapePath[] = steps.map(row => ({ closed, nodes: row.map(p => ({ x: Math.round((p.x - left) / width * 1e5) / 1e3, y: Math.round((p.y - top) / height * 1e5) / 1e3 })) }));
  return { x: left + width / 2, y: top + height / 2, width, height, shapePath: { ...parts[0], subpaths: parts.slice(1) } as ShapePath };
}

const bandCache = new Map<string, DesignElement[]>();

/** The generated lines, grouped into a few same-colour compound paths so the canvas and exports stay fast. */
export function blendBands(group: DesignElement): DesignElement[] {
  const s = group.artworkBlend;
  if (!s || (group.children?.length ?? 0) < 2) return [];
  const cacheKey = group.id + blendKeyOf(group), hit = bandCache.get(cacheKey);
  if (hit) return hit;
  const keys = blendKeys(group), steps = blendSteps(group, keys), closed = keys[0].closed;
  const stops = colourStops(group);
  const varies = new Set(stops).size > 1 || s.startWidth !== s.endWidth || s.startOpacity !== s.endOpacity;
  const count = varies ? Math.min(MAX_BANDS, steps.length) : 1, fill = s.look === 'smooth' && closed;
  const bands: DesignElement[] = [];
  for (let b = 0; b < count; b++) {
    const row = steps.filter((_, i) => Math.min(count - 1, Math.floor(i / steps.length * count)) === b);
    if (!row.length) continue;
    const t = row.reduce((sum, step) => sum + step.t, 0) / row.length, colour = colourAt(stops, t);
    const width = s.startWidth + (s.endWidth - s.startWidth) * t, opacity = s.startOpacity + (s.endOpacity - s.startOpacity) * t;
    bands.push({
      ...fitSteps(row.map(step => simplifyStep(step.points)), closed), id: `${group.id}~band-${b}`, type: 'shape', content: 'custom-path', shapeGeometry: 'bounds', rotation: 0,
      color: colour, shapeFilled: fill, shapeFillColor: fill ? colour : undefined, shapeFillRule: 'nonzero', shapeStrokeColor: colour, borderWidth: fill ? 0 : width,
      shapeStrokeCap: 'round', shapeStrokeJoin: 'round', opacity, side: group.side, printMethod: group.printMethod, layerName: `Blend ${b + 1}`,
    } as DesignElement);
  }
  bandCache.set(cacheKey, bands);
  if (bandCache.size > 16) bandCache.delete(bandCache.keys().next().value!);
  return bands;
}

const shiftPath = (path: ShapePath, dx: number, dy: number): ShapePath => ({
  ...path,
  nodes: path.nodes.map(n => ({ ...n, x: n.x + dx, y: n.y + dy, in: n.in && { x: n.in.x + dx, y: n.in.y + dy }, out: n.out && { x: n.out.x + dx, y: n.out.y + dy } })),
  subpaths: path.subpaths?.map(part => shiftPath(part, dx, dy)),
});

/** Regenerate the frame when a source or setting changed, keeping the blend's place on the garment. */
export function refreshBlend(group: DesignElement): DesignElement {
  const s = group.artworkBlend, sources = group.children;
  if (!s || !sources || sources.length < 2 || group.blendKey === blendKeyOf(group)) return group;
  let steps: Step[];
  try { steps = blendSteps(group); } catch { return group; }
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const step of steps) for (const p of step.points) { if (p.x < l) l = p.x; if (p.x > r) r = p.x; if (p.y < t) t = p.y; if (p.y > b) b = p.y; }
  const pad = (s.look === 'lines' ? Math.max(s.startWidth, s.endWidth) / 2 + .5 : .5) + (s.blur ?? 0) * 3;
  const left = l - pad, top = t - pad, width = Math.max(1, r - l + pad * 2), height = Math.max(1, b - t + pad * 2);
  const sourceW = group.groupSourceWidth ?? group.width, sourceH = group.groupSourceHeight ?? group.height;
  const sx = group.width / Math.max(.0001, sourceW), sy = group.height / Math.max(.0001, sourceH);
  const dx = (left + width / 2 - sourceW / 2) * sx * (group.flipHorizontal ? -1 : 1), dy = (top + height / 2 - sourceH / 2) * sy * (group.flipVertical ? -1 : 1);
  const angle = group.rotation * Math.PI / 180;
  const next: DesignElement = {
    ...group,
    x: group.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: group.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    width: width * sx, height: height * sy, groupSourceWidth: width, groupSourceHeight: height,
    children: sources.map(source => ({ ...source, x: source.x - left, y: source.y - top, hidden: true })),
    artworkBlend: s.spine ? { ...s, spine: { ...s.spine, path: shiftPath(s.spine.path, -left, -top) } } : s,
  };
  return { ...next, blendKey: blendKeyOf(next) };
}

/** Turn the selected paths into one live blend. */
export function createBlend(elements: DesignElement[], ids: string[], groupId: string, unitsPerCm: number, surface?: string): DesignElement[] {
  const sources = elements.filter(element => ids.includes(element.id));
  const issue = blendIssue(elements, ids); if (issue) throw new Error(issue);
  const line = Math.max(.15, unitsPerCm * .04);
  const settings: BlendSettings = {
    mode: 'steps', steps: 96, spacing: Math.max(.5, unitsPerCm * .15), look: 'lines', easing: 'linear', easeAmount: 50, reverse: false, twist: 0,
    startWidth: line, endWidth: line, startOpacity: 100, endOpacity: 100, startColour: readableInk(inkOf(sources[0]), surface), endColour: readableInk(inkOf(sources[sources.length - 1]), surface),
  };
  const seed: DesignElement = {
    id: groupId, type: 'group', content: '', layerName: 'Blend', x: .5, y: .5, width: 1, height: 1, rotation: 0, groupSourceWidth: 1, groupSourceHeight: 1,
    side: sources[0].side, printMethod: sources[0].printMethod, locked: false, artworkBlend: settings,
    children: sources.map(source => ({ ...source, hidden: true, builtFrom: undefined })),
  };
  const group = refreshBlend(seed), first = elements.findIndex(element => ids.includes(element.id));
  return elements.flatMap((element, index) => index === first ? [group] : ids.includes(element.id) ? [] : [element]);
}

export function updateBlend(group: DesignElement, settings: Partial<BlendSettings>): DesignElement {
  return group.artworkBlend ? refreshBlend({ ...group, artworkBlend: { ...group.artworkBlend, ...settings } }) : group;
}

export function updateBlendSource(group: DesignElement, id: string, patch: Partial<DesignElement>): DesignElement {
  return refreshBlend({ ...group, children: group.children?.map(child => child.id === id ? { ...child, ...patch } : child) });
}

/** Add a key shape halfway along the widest gap, ready to reshape. */
export function addBlendKey(group: DesignElement, newId: string): DesignElement {
  const sources = group.children; if (!group.artworkBlend || !sources || sources.length < 2) return group;
  const keys = blendKeys(group); let at = 0, widest = -1;
  for (let k = 1; k < keys.length; k++) { const gap = keyDistance([keys[k - 1], keys[k]]); if (gap > widest) { widest = gap; at = k - 1; } }
  const a = keys[at].points, b = keys[at + 1].points, mid = a.map((p, i) => ({ x: (p.x + b[i].x) / 2, y: (p.y + b[i].y) / 2 }));
  const frame = fitSteps([mid], keys[0].closed);
  const key: DesignElement = {
    ...sources[at], blendColour: colourAt(colourStops(group), (at + .5) / (sources.length - 1)), ...frame, shapePath: { closed: keys[0].closed, nodes: frame.shapePath.nodes.filter((_, i) => i % 4 === 0) }, id: newId, content: 'custom-path', shapeGeometry: 'bounds',
    rotation: 0, flipHorizontal: false, flipVertical: false, shapeParameters: undefined, shapeCornerRadius: 0, hidden: true, layerName: 'Key shape',
  };
  return refreshBlend({ ...group, children: [...sources.slice(0, at + 1), key, ...sources.slice(at + 1)] });
}

export function removeBlendKey(group: DesignElement, id: string): DesignElement {
  if ((group.children?.length ?? 0) <= 2) return group;
  return refreshBlend({ ...group, children: group.children!.filter(child => child.id !== id) });
}

/** Use a path as the blend's spine (the path is kept so it can be released again). */
export function setBlendSpine(elements: DesignElement[], groupId: string, pathId: string): DesignElement[] {
  const group = elements.find(element => element.id === groupId), path = elements.find(element => element.id === pathId);
  if (!group?.artworkBlend || !path) return elements;
  const w = group.groupSourceWidth ?? group.width, h = group.groupSourceHeight ?? group.height, sx = group.width / w, sy = group.height / h;
  const a = -group.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const local = (p: P) => { const x = p.x - group.x, y = p.y - group.y; return { x: (x * cos - y * sin) / sx * (group.flipHorizontal ? -1 : 1) + w / 2, y: (x * sin + y * cos) / sy * (group.flipVertical ? -1 : 1) + h / 2 }; };
  const world = shapeWorldPath(path), mapped: ShapePath = { closed: false, nodes: world.nodes.map(n => ({ ...local(n), in: n.in && local(n.in), out: n.out && local(n.out) })) };
  const next = updateBlend(group, { spine: { path: mapped, element: path } });
  return elements.flatMap(element => element.id === pathId ? [] : element.id === groupId ? [next] : [element]);
}

/** Back to a straight blend; the spine path returns to the artwork. */
export function clearBlendSpine(elements: DesignElement[], groupId: string): DesignElement[] {
  const group = elements.find(element => element.id === groupId), spine = group?.artworkBlend?.spine;
  if (!group || !spine) return elements;
  const next = updateBlend(group, { spine: undefined });
  return elements.flatMap(element => element.id === groupId ? (spine.element ? [next, spine.element] : [next]) : [element]);
}

/** Expand into real, individually editable shapes, keeping the live blend so it can be restored. */
export function expandBlend(group: DesignElement): DesignElement {
  const bands = blendBands(group).map((band, index) => ({ ...band, id: `${group.id}-expanded-${index}` }));
  // Cleared explicitly: the panel merges this result over the current object.
  return { ...group, artworkBlend: undefined, blendKey: undefined, layerName: 'Expanded blend', children: bands, blendExpandedFrom: group };
}

/** Stop blending: the source paths come back as a normal group. */
export function releaseBlend(group: DesignElement): DesignElement {
  // The paths keep the colours they had in the blend.
  const stops = colourStops(group);
  return { ...group, artworkBlend: undefined, blendKey: undefined, layerName: 'Blend sources', children: group.children?.map((child, index) => ({ ...child, ...inkPatch(child, stops[index]), blendColour: undefined, hidden: false })) };
}
