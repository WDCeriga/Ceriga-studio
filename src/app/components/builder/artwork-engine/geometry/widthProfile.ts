import { pathSegmentPoint } from '../../../../lib/shapePathEditing';
import type { ShapePath } from '../../../../lib/shapeGeometry';

/**
 * Variable-width lines (Illustrator's Width tool). A profile is a set of stops along the line; the stroke is
 * rebuilt as a filled vector outline, so it stays crisp and prints exactly as drawn.
 */
export type WidthStop = { t: number; width: number };
export type WidthProfile = { stops: WidthStop[] };

export const WIDTH_PRESETS: { id: string; label: string; stops: WidthStop[] }[] = [
  { id: 'taper-both', label: 'Taper', stops: [{ t: 0, width: 0 }, { t: .5, width: 100 }, { t: 1, width: 0 }] },
  { id: 'taper-end', label: 'Taper end', stops: [{ t: 0, width: 100 }, { t: 1, width: 0 }] },
  { id: 'taper-start', label: 'Taper start', stops: [{ t: 0, width: 0 }, { t: 1, width: 100 }] },
  { id: 'brush', label: 'Brush', stops: [{ t: 0, width: 8 }, { t: .18, width: 100 }, { t: .7, width: 62 }, { t: 1, width: 0 }] },
  { id: 'swell', label: 'Double', stops: [{ t: 0, width: 10 }, { t: .28, width: 100 }, { t: .5, width: 22 }, { t: .72, width: 100 }, { t: 1, width: 10 }] },
  { id: 'pinch', label: 'Pinch', stops: [{ t: 0, width: 100 }, { t: .5, width: 12 }, { t: 1, width: 100 }] },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Width (0–1 of the stroke) at a position along the line. */
export function widthAt(stops: WidthStop[], t: number) {
  const row = [...stops].sort((a, b) => a.t - b.t);
  if (!row.length) return 1;
  if (t <= row[0].t) return row[0].width / 100;
  for (let i = 1; i < row.length; i++) {
    if (t <= row[i].t) { const span = Math.max(1e-6, row[i].t - row[i - 1].t); return (row[i - 1].width + (row[i].width - row[i - 1].width) * smooth((t - row[i - 1].t) / span)) / 100; }
  }
  return row[row.length - 1].width / 100;
}

type P = { x: number; y: number };
function sample(path: ShapePath, spacing: number): P[] {
  const nodes = path.nodes, spans = nodes.length - (path.closed ? 0 : 1), out: P[] = [];
  for (let i = 0; i < spans; i++) {
    const a = nodes[i], b = nodes[(i + 1) % nodes.length], reach = Math.hypot(b.x - a.x, b.y - a.y) + (a.out ? Math.hypot(a.out.x - a.x, a.out.y - a.y) : 0) + (b.in ? Math.hypot(b.in.x - b.x, b.in.y - b.y) : 0);
    const steps = Math.max(a.out || b.in ? 8 : 2, Math.min(160, Math.ceil(reach / spacing)));
    for (let j = 0; j < steps; j++) out.push(pathSegmentPoint(a, b, j / steps));
  }
  if (!path.closed && nodes.length) out.push({ x: nodes[nodes.length - 1].x, y: nodes[nodes.length - 1].y });
  return out.filter((p, i) => !i || Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y) > 1e-4);
}
const f = (value: number) => (Math.round(value * 100) / 100).toString();
const polygon = (points: P[]) => 'M' + points.map(p => `${f(p.x)} ${f(p.y)}`).join('L') + 'Z';
const disc = (c: P, r: number) => `M${f(c.x - r)} ${f(c.y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;

function outlinePart(path: ShapePath, strokeWidth: number, stops: WidthStop[]) {
  const points = sample(path, Math.max(.6, strokeWidth / 3)), n = points.length;
  if (n < 2) return '';
  const lengths = [0];
  for (let i = 1; i < n; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = (lengths[n - 1] + (path.closed ? Math.hypot(points[0].x - points[n - 1].x, points[0].y - points[n - 1].y) : 0)) || 1;
  const left: P[] = [], right: P[] = [], joins: string[] = [];
  for (let i = 0; i < n; i++) {
    const before = points[path.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], after = points[path.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length, half = strokeWidth * widthAt(stops, lengths[i] / total) / 2;
    left.push({ x: points[i].x + nx * half, y: points[i].y + ny * half });
    right.push({ x: points[i].x - nx * half, y: points[i].y - ny * half });
    // Keep sharp corners and rounded ends full: a small disc fills the outside of the bend.
    const a = Math.atan2(points[i].y - before.y, points[i].x - before.x), b = Math.atan2(after.y - points[i].y, after.x - points[i].x);
    let turn = Math.abs(a - b); if (turn > Math.PI) turn = Math.PI * 2 - turn;
    if (half > .05 && (turn > .35 || (!path.closed && (i === 0 || i === n - 1)))) joins.push(disc(points[i], half));
  }
  const body = path.closed ? polygon(left) + polygon([...right].reverse()) : polygon([...left, ...[...right].reverse()]);
  return body + joins.join('');
}

/** Filled outline of a stroke with a width profile (path in drawing units). Use with fill-rule nonzero. */
export function profileOutline(path: ShapePath, strokeWidth: number, profile: WidthProfile): string {
  return [path, ...(path.subpaths ?? [])].map(part => outlinePart({ ...part, subpaths: undefined }, strokeWidth, profile.stops)).join('');
}

/** Shape of a profile for tiles and the graph, in a width × height box. */
export function profilePreview(stops: WidthStop[], width: number, height: number) {
  const top: string[] = [], bottom: string[] = [], mid = height / 2;
  for (let i = 0; i <= 40; i++) { const t = i / 40, half = widthAt(stops, t) * (height / 2 - 1); top.push(`${f(t * width)} ${f(mid - half)}`); bottom.unshift(`${f(t * width)} ${f(mid + half)}`); }
  return 'M' + top.join('L') + 'L' + bottom.join('L') + 'Z';
}
