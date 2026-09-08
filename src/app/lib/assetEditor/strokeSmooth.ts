import type { DrawnPoint } from './types';

function lerp(a: DrawnPoint, b: DrawnPoint, t: number): DrawnPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Chaikin corner-cutting — rounds polyline corners. */
export function chaikinSmooth(
  points: DrawnPoint[],
  iterations = 2,
  closed = false,
): DrawnPoint[] {
  if (points.length < 3) return points;

  let current = [...points];
  if (closed && current.length > 1) {
    current = [...current, current[0]];
  }

  for (let iter = 0; iter < iterations; iter += 1) {
    const next: DrawnPoint[] = [];
    const limit = closed ? current.length - 1 : current.length - 1;

    for (let i = 0; i < limit; i += 1) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push(lerp(a, b, 0.25), lerp(a, b, 0.75));
    }

    if (!closed) {
      next.unshift(current[0]);
      next.push(current[current.length - 1]);
    }

    current = next;
  }

  if (closed && current.length > 1) {
    const first = current[0];
    const last = current[current.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
      current.pop();
    }
  }

  return current;
}

function perpendicularDistance(point: DrawnPoint, lineStart: DrawnPoint, lineEnd: DrawnPoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const proj = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
  return Math.hypot(point.x - proj.x, point.y - proj.y);
}

/** Reduce point count while keeping shape. */
export function douglasPeucker(points: DrawnPoint[], epsilon: number): DrawnPoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i += 1) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}

export function smoothStrokePoints(points: DrawnPoint[], closed: boolean): DrawnPoint[] {
  const smoothed = chaikinSmooth(points, 2, closed);
  return douglasPeucker(smoothed, closed ? 3 : 2);
}

/** Build a smooth SVG path d string for preview/export. */
export function pointsToSmoothPathD(points: DrawnPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i > 0 ? i - 1 : closed ? points.length - 1 : i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : closed ? (i + 2) % points.length : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  if (closed) d += ' Z';
  return d;
}

/** Dense polyline samples along a smooth curve for potrace-compatible export. */
export function densifySmoothPath(points: DrawnPoint[], closed: boolean, segments = 96): DrawnPoint[] {
  if (typeof document === 'undefined' || points.length < 2) return points;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pointsToSmoothPathD(points, closed));
  document.body.appendChild(path);

  try {
    const total = path.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) return points;

    const count = Math.max(segments, points.length);
    const dense: DrawnPoint[] = [];
    for (let i = 0; i <= count; i += 1) {
      const pt = path.getPointAtLength((i / count) * total);
      dense.push({ x: pt.x, y: pt.y });
    }
    return dense;
  } finally {
    path.remove();
  }
}
