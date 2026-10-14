import type { BoundaryLoop, PanellingPoint, PanellingSeam, SeamAnchor } from './panellingTypes';

export const PANELLING_VIEWBOX = 2048;

export const distance = (a: PanellingPoint, b: PanellingPoint) => Math.hypot(a.x - b.x, a.y - b.y);
export const signedArea = (points: PanellingPoint[]) => points.reduce((area, point, index) => {
  const next = points[(index + 1) % points.length];
  return area + point.x * next.y - next.x * point.y;
}, 0) / 2;

export function pointInLoop(point: PanellingPoint, loop: PanellingPoint[]) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function pointInSurface(point: PanellingPoint, boundaries: BoundaryLoop[]) {
  let inside = false;
  for (const boundary of boundaries) if (pointInLoop(point, boundary.points)) inside = !inside;
  return inside;
}

export function projectToSegment(point: PanellingPoint, a: PanellingPoint, b: PanellingPoint) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return { point: { x: a.x + t * dx, y: a.y + t * dy }, t };
}

export function closestBoundaryPoint(point: PanellingPoint, boundaries: BoundaryLoop[]) {
  let nearest: { point: PanellingPoint; distance: number; boundaryId: string } | undefined;
  for (const boundary of boundaries) for (let i = 0; i < boundary.points.length; i++) {
    const projected = projectToSegment(point, boundary.points[i], boundary.points[(i + 1) % boundary.points.length]).point;
    const candidateDistance = distance(point, projected);
    if (!nearest || candidateDistance < nearest.distance) nearest = { point: projected, distance: candidateDistance, boundaryId: boundary.id };
  }
  return nearest;
}

export function mirrorPoint(point: PanellingPoint, axis: number): PanellingPoint {
  return { x: 2 * axis - point.x, y: point.y };
}

export function mirrorSeam(seam: PanellingSeam, axis: number): PanellingSeam {
  return {
    ...seam,
    id: `${seam.id}:mirror`,
    label: `${seam.label} mirror`,
    mirrorGroupId: seam.mirrorGroupId ?? seam.id,
    anchors: seam.anchors.map(anchor => ({
      ...anchor,
      id: `${anchor.id}:mirror`,
      ...mirrorPoint(anchor, axis),
      incoming: anchor.outgoing ? mirrorPoint(anchor.outgoing, axis) : undefined,
      outgoing: anchor.incoming ? mirrorPoint(anchor.incoming, axis) : undefined,
      boundaryId: undefined,
    })),
  };
}

function cubicPoint(a: PanellingPoint, b: PanellingPoint, c: PanellingPoint, d: PanellingPoint, t: number): PanellingPoint {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * a.x + 3 * inverse ** 2 * t * b.x + 3 * inverse * t ** 2 * c.x + t ** 3 * d.x,
    y: inverse ** 3 * a.y + 3 * inverse ** 2 * t * b.y + 3 * inverse * t ** 2 * c.y + t ** 3 * d.y,
  };
}

export function flattenSeam(seam: PanellingSeam, curveSteps = 48) {
  const result: PanellingPoint[] = [];
  for (let index = 0; index < seam.anchors.length - 1; index++) {
    const start = seam.anchors[index], end = seam.anchors[index + 1];
    if (!index) result.push({ x: start.x, y: start.y });
    if (start.outgoing || end.incoming) {
      const control1 = start.outgoing ?? start, control2 = end.incoming ?? end;
      for (let step = 1; step <= curveSteps; step++) result.push(cubicPoint(start, control1, control2, end, step / curveSteps));
    } else result.push({ x: end.x, y: end.y });
  }
  return result;
}

export function seamPath(anchors: SeamAnchor[], close = false) {
  if (!anchors.length) return '';
  let path = `M ${anchors[0].x} ${anchors[0].y}`;
  for (let i = 1; i < anchors.length; i++) {
    const previous = anchors[i - 1], next = anchors[i];
    if (previous.outgoing || next.incoming) {
      const first = previous.outgoing ?? previous, second = next.incoming ?? next;
      path += ` C ${first.x} ${first.y} ${second.x} ${second.y} ${next.x} ${next.y}`;
    } else path += ` L ${next.x} ${next.y}`;
  }
  return close ? `${path} Z` : path;
}

export function flattenAbsolutePath(d: string, step: number): PanellingPoint[] | null {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return [];
  const points: PanellingPoint[] = [];
  let index = 0, current: PanellingPoint = { x: 0, y: 0 }, start = current, command = '';
  const read = () => Number(tokens[index++]);
  const line = (to: PanellingPoint) => {
    const count = Math.max(1, Math.ceil(distance(current, to) / step));
    for (let i = 1; i <= count; i++) points.push({ x: current.x + (to.x - current.x) * i / count, y: current.y + (to.y - current.y) * i / count });
    current = to;
  };
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) return null;
    if (command === 'M' || command === 'L') {
      const to = { x: read(), y: read() };
      if (command === 'M') { current = start = to; points.push(to); command = 'L'; } else line(to);
    } else if (command === 'C') {
      const c1 = { x: read(), y: read() }, c2 = { x: read(), y: read() }, to = { x: read(), y: read() };
      const count = Math.max(1, Math.ceil((distance(current, c1) + distance(c1, c2) + distance(c2, to)) / step));
      for (let i = 1; i <= count; i++) {
        const t = i / count, u = 1 - t;
        points.push({
          x: u * u * u * current.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
          y: u * u * u * current.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
        });
      }
      current = to;
    } else if (command === 'Z' || command === 'z') {
      line(start);
    } else return null;
  }
  return points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)) ? points : null;
}

export function sampleSvgBoundaries(svg: SVGSVGElement, parentSurfaceId?: string, pathStep = 18): BoundaryLoop[] {
  const contours: PanellingPoint[][] = [];
  const surface = parentSurfaceId ? svg.querySelector<SVGGElement>(`[data-panelling-parent="${parentSurfaceId}"]`) : svg;
  if (!surface) return [];
  const rootMatrix = svg.getCTM();
  const rootInverse = rootMatrix ? rootMatrix.inverse() : null;

  surface.querySelectorAll('path').forEach(path => {
    const ctm = path.getCTM();
    const matrix = ctm ? (rootInverse ? rootInverse.multiply(ctm) : ctm) : null;
    const place = (point: PanellingPoint) => {
      if (!matrix) return { x: point.x, y: point.y };
      const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return { x: transformed.x, y: transformed.y };
    };
    let samples = flattenAbsolutePath(path.getAttribute('d') ?? '', pathStep);
    if (!samples) {
      // getPointAtLength re-measures the path per call, so this fallback is only for unusual path data.
      const length = path.getTotalLength();
      samples = [];
      for (let offset = 0; length && offset <= length; offset += pathStep) {
        const point = path.getPointAtLength(Math.min(length, offset));
        samples.push({ x: point.x, y: point.y });
      }
    }
    let contour: PanellingPoint[] = [];
    let previous: PanellingPoint | undefined;
    for (const sample of samples) {
      const point = place(sample);
      if (previous && distance(previous, point) > 9) {
        if (contour.length >= 3) contours.push(contour);
        contour = [];
      }
      if (!contour.length || distance(contour[contour.length - 1], point) > .25) contour.push(point);
      previous = point;
    }
    if (contour.length >= 3) contours.push(contour);
  });

  const valid = contours.map((points, index) => {
    if (distance(points[0], points[points.length - 1]) < 12) points = points.slice(0, -1);
    const signed = signedArea(points);
    return { points, index, area: Math.abs(signed), signed };
  }).filter(contour => contour.points.length >= 3 && contour.area > 100);
  const ordered = valid.sort((a, b) => b.area - a.area);
  return ordered.map((contour, index) => {
    const sample = contour.points.reduce((center, point) => ({ x: center.x + point.x / contour.points.length, y: center.y + point.y / contour.points.length }), { x: 0, y: 0 });
    let depth = 0;
    for (const parent of ordered.slice(0, index)) if (pointInLoop(sample, parent.points)) depth++;
    const isHole = depth % 2 === 1;
    const points = (contour.signed > 0) === !isHole ? contour.points : [...contour.points].reverse();
    return { id: `body-boundary-${contour.index}`, role: isHole ? 'hole' as const : 'outer' as const, points };
  });
}

export function inferSymmetryAxis(boundaries: BoundaryLoop[]) {
  const outer = boundaries.filter(boundary => boundary.role === 'outer').sort((a, b) => Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points)))[0];
  if (!outer) return PANELLING_VIEWBOX / 2;
  const xs = outer.points.map(point => point.x);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
}

export function bezierSplit(start: SeamAnchor, end: SeamAnchor, t: number) {
  const p0 = { x: start.x, y: start.y }, p1 = start.outgoing ?? p0, p3 = { x: end.x, y: end.y }, p2 = end.incoming ?? p3;
  const lerp = (a: PanellingPoint, b: PanellingPoint): PanellingPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const p01 = lerp(p0, p1), p12 = lerp(p1, p2), p23 = lerp(p2, p3), p012 = lerp(p01, p12), p123 = lerp(p12, p23), split = lerp(p012, p123);
  return {
    start: { ...start, outgoing: p01 },
    inserted: { id: crypto.randomUUID(), ...split, incoming: p012, outgoing: p123 },
    end: { ...end, incoming: p23 },
  };
}